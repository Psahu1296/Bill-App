/**
 * Firestore ↔ Local SQLite sync layer.
 *
 * Responsibilities (local POS only):
 *  1. Listen for new/modified customer orders on Firestore → insert into local SQLite + notify POS
 *  2. Push order status/payment changes back to Firestore after POS staff actions
 *  3. Push menu + config + delivery areas to Firestore on any local change
 *  4. Heartbeat: write /config/posStatus every 30s so customer app knows POS is online
 */
import admin from "firebase-admin";
import { getFirestoreDb } from "./firebaseAdmin";
import { getDb } from "../db";
import { notifEmitter } from "./notificationEmitter";

const HB_MS = 30_000; // heartbeat interval

// ── Retry queue for failed Firestore writes ────────────────────────────────────
interface RetryItem {
  fn: () => Promise<void>;
  attempt: number;
}
const retryQueue: RetryItem[] = [];
const MAX_QUEUE = 50;
const MAX_RETRY = 5;

function enqueue(fn: () => Promise<void>) {
  if (retryQueue.length >= MAX_QUEUE) retryQueue.shift();
  retryQueue.push({ fn, attempt: 0 });
}

async function drainRetryQueue() {
  const failed: RetryItem[] = [];
  for (const item of retryQueue) {
    try {
      await item.fn();
    } catch {
      item.attempt++;
      if (item.attempt < MAX_RETRY) failed.push(item);
    }
  }
  retryQueue.length = 0;
  retryQueue.push(...failed);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function firestoreDocToOrder(data: admin.firestore.DocumentData, firestoreId: string) {
  return {
    firestoreId,
    customerDetails:   data.customerDetails ?? {},
    orderStatus:       data.orderStatus ?? "Pending",
    orderDate:         data.orderDate?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    bills:             data.bills ?? {},
    items:             data.items ?? [],
    tableNo:           data.tableNo ?? null,
    paymentMethod:     data.paymentMethod ?? "Cash",
    paymentData:       data.paymentData ?? {},
    paymentStatus:     data.paymentStatus ?? "Pending",
    amountPaid:        data.amountPaid ?? 0,
    balanceDueOnOrder: data.bills?.totalWithTax ?? 0,
    orderType:         data.orderType ?? "takeaway",
    deliveryAddress:   data.deliveryAddress ?? "",
  };
}

// ── 1. Firestore order listener ───────────────────────────────────────────────

let listenerStartedAt: admin.firestore.Timestamp | null = null;
let unsubscribeOrders: (() => void) | null = null;

function subscribeToOrders() {
  const db = getFirestoreDb();

  // Only listen to orders created after this process started (avoid re-processing history)
  const since = listenerStartedAt ?? admin.firestore.Timestamp.now();
  listenerStartedAt = since;

  // Restore the last-seen timestamp from local SQLite (survives restarts)
  try {
    const saved = getDb()
      .prepare("SELECT value FROM store_settings WHERE key = 'firestore_last_synced_at'")
      .get() as { value: string } | undefined;
    if (saved?.value) {
      listenerStartedAt = admin.firestore.Timestamp.fromDate(new Date(saved.value));
    }
  } catch { /* first run */ }

  console.log(`[firestore] Listening for orders since ${listenerStartedAt.toDate().toISOString()}`);

  unsubscribeOrders = db
    .collection("orders")
    .where("createdAt", ">", listenerStartedAt)
    .onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") handleNewOrder(change.doc);
          if (change.type === "modified") handleModifiedOrder(change.doc);
        });
      },
      (err) => {
        console.error("[firestore] Order listener error — will reconnect:", err.message);
        // onSnapshot auto-reconnects; log is enough
      }
    );
}

function handleNewOrder(doc: admin.firestore.QueryDocumentSnapshot) {
  const order = firestoreDocToOrder(doc.data(), doc.id);
  const localDb = getDb();

  // Upsert into local SQLite using firestoreId as idempotency_key
  const existing = localDb
    .prepare("SELECT id FROM orders WHERE idempotency_key = ?")
    .get(order.firestoreId);

  if (existing) return; // already synced

  try {
    // Find the virtual takeaway table (table_no = 0) as fallback table_id
    const takeawayTable = localDb
      .prepare("SELECT id FROM tables_tb WHERE table_no = 0")
      .get() as { id: number } | undefined;

    const tableId = order.tableNo != null
      ? (localDb.prepare("SELECT id FROM tables_tb WHERE table_no = ?").get(order.tableNo) as { id: number } | undefined)?.id ?? takeawayTable?.id
      : takeawayTable?.id;

    localDb.prepare(`
      INSERT INTO orders
        (customer_details, order_status, order_date, bills, items,
         table_id, payment_method, payment_data, payment_status,
         amount_paid, balance_due_on_order, order_type, delivery_address,
         idempotency_key, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      JSON.stringify(order.customerDetails),
      order.orderStatus,
      order.orderDate,
      JSON.stringify(order.bills),
      JSON.stringify(order.items),
      tableId ?? null,
      order.paymentMethod,
      JSON.stringify(order.paymentData),
      order.paymentStatus,
      order.amountPaid,
      order.balanceDueOnOrder,
      order.orderType,
      order.deliveryAddress,
      order.firestoreId,
      order.orderDate,
      order.orderDate,
    );

    // Persist sync timestamp
    localDb.prepare(`
      INSERT INTO store_settings (key, value, updated_at)
      VALUES ('firestore_last_synced_at', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(order.orderDate);

    // Notify POS admin screen
    notifEmitter.emit("admin", {
      type:         "new_order",
      orderId:      order.firestoreId,
      orderType:    order.orderType,
      tableNo:      order.tableNo,
      customerName: (order.customerDetails as { name?: string }).name ?? "Customer",
      totalAmount:  (order.bills as { total?: number }).total ?? 0,
    });

    console.log(`[firestore] New order synced: ${order.firestoreId}`);
  } catch (err) {
    console.error("[firestore] Failed to insert order:", (err as Error).message);
  }
}

function handleModifiedOrder(doc: admin.firestore.QueryDocumentSnapshot) {
  // Customer can add items to an open dine-in order — sync to local SQLite
  const data = doc.data();
  const localDb = getDb();

  const row = localDb
    .prepare("SELECT id, order_status FROM orders WHERE idempotency_key = ?")
    .get(doc.id) as { id: number; order_status: string } | undefined;

  if (!row) return; // not yet synced
  if (["Completed", "Cancelled"].includes(row.order_status)) return; // terminal

  if (data.items !== undefined || data.bills !== undefined) {
    localDb.prepare(
      "UPDATE orders SET items = ?, bills = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(
      JSON.stringify(data.items ?? []),
      JSON.stringify(data.bills ?? {}),
      row.id,
    );

    notifEmitter.emit("admin", {
      type:         "items_added",
      orderId:      String(row.id),
      orderType:    data.orderType ?? "dine-in",
      tableNo:      data.tableNo ?? null,
      customerName: data.customerDetails?.name ?? "Customer",
      newItemsCount: (data.items ?? []).length,
      totalAmount:  data.bills?.total ?? 0,
    });
  }
}

// ── 2. Push order status to Firestore ─────────────────────────────────────────

export function pushOrderStatusToFirestore(
  firestoreId: string | null | undefined,
  update: {
    orderStatus?:       string;
    paymentStatus?:     string;
    amountPaid?:        number;
    balanceDueOnOrder?: number;
    items?:             unknown[];
    bills?:             unknown;
    paymentData?:       unknown;
  }
) {
  if (!firestoreId) return; // POS-created order — not in Firestore

  const fn = async () => {
    const db = getFirestoreDb();
    await db.collection("orders").doc(firestoreId).update({
      ...update,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  };

  fn().catch(() => enqueue(fn));
}

// ── 3. Push menu + config to Firestore ────────────────────────────────────────

export async function pushConfigToFirestore() {
  try {
    const localDb = getDb();
    const fs = getFirestoreDb();

    // Menu
    const dishes = localDb.prepare("SELECT * FROM dishes WHERE is_online_available = 1").all();
    const dishPayload = dishes.map((d) => {
      const r = d as Record<string, unknown>;
      return {
        _id:             String(r.id),
        name:            r.name,
        image:           r.image,
        type:            r.type,
        category:        r.category,
        variants:        typeof r.variants === "string" ? JSON.parse(r.variants as string) : r.variants,
        description:     r.description,
        descriptionHi:   r.description_hi,
        isAvailable:     r.is_available !== 0,
        isOnlineAvailable: r.is_online_available !== 0,
      };
    });

    // Config flags
    const settingsRows = localDb
      .prepare("SELECT key, value FROM store_settings WHERE key IN ('online_orders','available_time_start','available_time_end','delivery_enabled')")
      .all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const s of settingsRows) settings[s.key] = s.value;

    // Delivery areas
    const areas = localDb.prepare("SELECT * FROM delivery_areas WHERE is_active = 1").all();
    const areaPayload = (areas as Record<string, unknown>[]).map((a) => ({
      _id:            String(a.id),
      name:           a.name,
      isActive:       a.is_active !== 0,
      deliveryFee:    a.delivery_fee,
      minOrderAmount: a.min_order_amount,
    }));

    const batch = fs.batch();
    batch.set(fs.collection("menu").doc("dishes"), {
      dishes: dishPayload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(fs.collection("config").doc("flags"), {
      isOnline:          settings["online_orders"] !== "false",
      deliveryEnabled:   settings["delivery_enabled"] !== "false",
      availableTimeStart: settings["available_time_start"] ?? "09:00",
      availableTimeEnd:  settings["available_time_end"] ?? "22:00",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(fs.collection("config").doc("deliveryAreas"), {
      areas: areaPayload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    console.log("[firestore] Config pushed");
  } catch (err) {
    console.warn("[firestore] pushConfigToFirestore failed:", (err as Error).message);
    enqueue(pushConfigToFirestore);
  }
}

// ── 4. Heartbeat ──────────────────────────────────────────────────────────────

async function sendHeartbeat() {
  try {
    await getFirestoreDb().collection("config").doc("posStatus").set({
      online:    true,
      lastSeen:  admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch {
    // Silent — customer will see banner after 3 min
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
let started = false;

export function startFirestoreSync() {
  if (started) return;
  started = true;

  console.log("[firestore] Starting sync service…");

  subscribeToOrders();
  void sendHeartbeat();
  void pushConfigToFirestore();

  setInterval(() => { void sendHeartbeat(); void drainRetryQueue(); }, HB_MS);
}
