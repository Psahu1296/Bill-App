import fs from "fs";
import { Response, NextFunction } from "express";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { CustomRequest as Request } from "../types";
import { getDb } from "../db";
import * as earningRepo from "../repositories/earningRepo";
import * as userRepo from "../repositories/userRepo";
import { getZonedStartOfDayUtc } from "./earningController";

const TABLE_MAP: Record<string, string> = {
  orders: "orders",
  staff: "staff",
  consumables: "consumables",
  tables: "tables_tb",
  dishes: "dishes",
  ledger: "customer_ledger",
};

// Column used for date-range filtering per module (null = no filter)
const DATE_COL: Record<string, string | null> = {
  orders: "order_date",
  consumables: "timestamp",
  staff: null,
  tables: null,
  dishes: null,
  ledger: null,
};

// ─── Stats ────────────────────────────────────────────────────────────────────

export const getStats = (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    let totalRecords = 0;
    const counts: Record<string, number> = {};

    for (const [key, table] of Object.entries(TABLE_MAP)) {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number };
      counts[key] = row.cnt;
      totalRecords += row.cnt;
    }

    const dbPath = process.env["DATABASE_PATH"] ?? "";
    let dbSize = "N/A";
    if (dbPath) {
      try {
        const bytes = fs.statSync(dbPath).size;
        dbSize =
          bytes > 1_048_576
            ? `${(bytes / 1_048_576).toFixed(1)} MB`
            : `${(bytes / 1024).toFixed(1)} KB`;
      } catch {
        // file might not exist yet in dev
      }
    }

    res.json({ success: true, data: { totalRecords, counts, dbSize } });
  } catch (err) {
    next(err);
  }
};

// ─── Export helper ────────────────────────────────────────────────────────────

function fetchModuleRows(
  mod: string,
  startDate?: string,
  endDate?: string
): Record<string, unknown>[] {
  const db = getDb();
  const table = TABLE_MAP[mod];
  const dateCol = DATE_COL[mod];

  let sql: string;
  const params: string[] = [];

  if (mod === "staff") {
    // Include payments as JSON array
    sql = `
      SELECT s.*,
        (SELECT json_group_array(json_object(
          'id', sp.id, 'amount', sp.amount, 'type', sp.type, 'date', sp.date, 'note', sp.note
        )) FROM staff_payments sp WHERE sp.staff_id = s.id) AS payments
      FROM staff s
    `;
  } else if (mod === "ledger") {
    // Include transactions as JSON array
    sql = `
      SELECT l.*,
        (SELECT json_group_array(json_object(
          'id', t.id, 'transaction_type', t.transaction_type,
          'amount', t.amount, 'timestamp', t.timestamp, 'notes', t.notes
        )) FROM customer_ledger_transactions t WHERE t.ledger_id = l.id) AS transactions
      FROM customer_ledger l
    `;
  } else if (dateCol && startDate && endDate) {
    const endDt = new Date(endDate);
    endDt.setUTCHours(23, 59, 59, 999);
    sql = `SELECT * FROM ${table} WHERE ${dateCol} >= ? AND ${dateCol} <= ? ORDER BY ${dateCol} DESC`;
    params.push(new Date(startDate).toISOString(), endDt.toISOString());
  } else {
    sql = `SELECT * FROM ${table}`;
  }

  return db.prepare(sql).all(...params) as Record<string, unknown>[];
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const exportData = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modules, startDate, endDate, format } = req.query as Record<string, string>;

    if (!modules) {
      res.status(400).json({ success: false, message: "modules query param is required" });
      return;
    }

    const moduleList = modules.split(",").filter((m) => TABLE_MAP[m]);
    const result: Record<string, Record<string, unknown>[]> = {};

    for (const mod of moduleList) {
      result[mod] = fetchModuleRows(mod, startDate, endDate);
    }

    const ts = Date.now();

    if (format === "csv") {
      const csvParts: string[] = [];
      for (const [mod, rows] of Object.entries(result)) {
        if (!rows.length) {
          csvParts.push(`### ${mod}\n(no data)`);
          continue;
        }
        const headers = Object.keys(rows[0]).join(",");
        const body = rows
          .map((r) =>
            Object.values(r)
              .map((v) =>
                v == null
                  ? ""
                  : typeof v === "string"
                  ? `"${v.replace(/"/g, '""')}"`
                  : v
              )
              .join(",")
          )
          .join("\n");
        csvParts.push(`### ${mod}\n${headers}\n${body}`);
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="dhaba-export-${ts}.csv"`
      );
      res.send(csvParts.join("\n\n"));
      return;
    }

    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();
      for (const [mod, rows] of Object.entries(result)) {
        // Flatten any JSON-string columns so they're readable in the sheet
        const flatRows = rows.map((r) => {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(r)) {
            if (typeof v === "string") {
              try {
                const parsed = JSON.parse(v);
                // Only flatten if it's an object/array (not a plain string that happens to be valid JSON)
                if (typeof parsed === "object" && parsed !== null) {
                  out[k] = JSON.stringify(parsed); // keep as compact string in cell
                } else {
                  out[k] = v;
                }
              } catch {
                out[k] = v;
              }
            } else {
              out[k] = v;
            }
          }
          return out;
        });
        const ws = XLSX.utils.json_to_sheet(flatRows.length ? flatRows : [{}]);
        XLSX.utils.book_append_sheet(wb, ws, mod.slice(0, 31)); // sheet names max 31 chars
      }
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="dhaba-export-${ts}.xlsx"`);
      res.send(buf);
      return;
    }

    // Default: JSON
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="dhaba-export-${ts}.json"`
    );
    res.json({ exportedAt: new Date().toISOString(), data: result });
  } catch (err) {
    next(err);
  }
};

// ─── Delete Preview ───────────────────────────────────────────────────────────

export const deletePreview = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modules, startDate, endDate } = req.query as Record<string, string>;

    if (!modules) {
      res.status(400).json({ success: false, message: "modules query param is required" });
      return;
    }

    const db = getDb();
    const moduleList = modules.split(",").filter((m) => TABLE_MAP[m]);
    // counts: directly selected records
    // cascaded: auto-deleted due to order cascade (not explicitly selected)
    const counts: Record<string, number> = {};
    const cascaded: Record<string, number> = {};

    for (const mod of moduleList) {
      const table = TABLE_MAP[mod];
      const dateCol = DATE_COL[mod];

      let row: { cnt: number };
      if (dateCol && startDate && endDate) {
        const endDt = new Date(endDate);
        endDt.setUTCHours(23, 59, 59, 999);
        row = db.prepare(
          `SELECT COUNT(*) as cnt FROM ${table} WHERE ${dateCol} >= ? AND ${dateCol} <= ?`
        ).get(new Date(startDate).toISOString(), endDt.toISOString()) as { cnt: number };
      } else {
        row = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number };
      }
      counts[mod] = row.cnt;
    }

    // When orders are selected, count cascaded linked records (mirrors deleteData logic)
    if (moduleList.includes("orders")) {
      let orderIds: number[];
      if (startDate && endDate) {
        const endDt = new Date(endDate);
        endDt.setUTCHours(23, 59, 59, 999);
        orderIds = (db.prepare(
          `SELECT id FROM orders WHERE order_date >= ? AND order_date <= ?`
        ).all(new Date(startDate).toISOString(), endDt.toISOString()) as { id: number }[]).map(r => r.id);
      } else {
        orderIds = (db.prepare(`SELECT id FROM orders`).all() as { id: number }[]).map(r => r.id);
      }

      if (orderIds.length > 0) {
        const ph = orderIds.map(() => "?").join(",");

        // Consumables linked to these orders (not already in selected modules)
        if (!moduleList.includes("consumables")) {
          const { cnt } = db.prepare(
            `SELECT COUNT(*) as cnt FROM consumables WHERE order_id IN (${ph})`
          ).get(...orderIds) as { cnt: number };
          if (cnt > 0) cascaded["consumables (linked to orders)"] = cnt;
        }

        // Ledger transactions linked to these orders
        const { cnt: ltCnt } = db.prepare(
          `SELECT COUNT(*) as cnt FROM customer_ledger_transactions WHERE order_id IN (${ph})`
        ).get(...orderIds) as { cnt: number };
        if (ltCnt > 0) cascaded["ledger transactions (linked to orders)"] = ltCnt;
      }
    }

    const total =
      Object.values(counts).reduce((a, b) => a + b, 0) +
      Object.values(cascaded).reduce((a, b) => a + b, 0);

    res.json({ success: true, data: { counts, cascaded, total } });
  } catch (err) {
    next(err);
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteData = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modules, startDate, endDate } = req.body as {
      modules: string[];
      startDate?: string;
      endDate?: string;
    };

    if (!Array.isArray(modules) || modules.length === 0) {
      res.status(400).json({ success: false, message: "modules array is required" });
      return;
    }

    const db = getDb();
    const counts: Record<string, number> = {};

    const deleteTx = db.transaction(() => {
      // Orders require cascading cleanup of consumables, ledger, and earnings
      if (modules.includes("orders")) {
        // 1. Find the order IDs (and data needed for reversals) that will be deleted
        type OrderRow = { id: number; order_date: string; amount_paid: number };
        let orderRows: OrderRow[];
        if (startDate && endDate) {
          const endDt = new Date(endDate);
          endDt.setUTCHours(23, 59, 59, 999);
          orderRows = db.prepare(
            `SELECT id, order_date, amount_paid FROM orders WHERE order_date >= ? AND order_date <= ?`
          ).all(new Date(startDate).toISOString(), endDt.toISOString()) as OrderRow[];
        } else {
          orderRows = db.prepare(`SELECT id, order_date, amount_paid FROM orders`).all() as OrderRow[];
        }

        const orderIds = orderRows.map(r => r.id);

        if (orderIds.length > 0) {
          const placeholders = orderIds.map(() => "?").join(",");

          // 2. Reverse daily_earnings for customer consumables linked to these orders,
          //    then delete those consumable entries.
          type ConsumableRow = { timestamp: string; quantity: number; price_per_unit: number };
          const customerConsumables = db.prepare(
            `SELECT timestamp, quantity, price_per_unit FROM consumables
             WHERE order_id IN (${placeholders}) AND consumer_type = 'customer'`
          ).all(...orderIds) as ConsumableRow[];

          for (const c of customerConsumables) {
            try {
              const dateIso = getZonedStartOfDayUtc(new Date(c.timestamp)).toISOString();
              earningRepo.incrementEarnings(dateIso, -(c.quantity * c.price_per_unit));
            } catch { /* ignore earnings errors */ }
          }

          const consumableResult = db.prepare(
            `DELETE FROM consumables WHERE order_id IN (${placeholders})`
          ).run(...orderIds) as { changes: number };
          counts["consumables"] = (counts["consumables"] ?? 0) + consumableResult.changes;

          // 3. Reverse customer_ledger balances for transactions linked to these orders,
          //    then delete those transactions.
          type LedgerTxRow = { ledger_id: number; transaction_type: string; amount: number };
          const ledgerTxs = db.prepare(
            `SELECT ledger_id, transaction_type, amount FROM customer_ledger_transactions
             WHERE order_id IN (${placeholders})`
          ).all(...orderIds) as LedgerTxRow[];

          // Compute net balance reversal per ledger entry
          const balanceReversals = new Map<number, number>();
          for (const tx of ledgerTxs) {
            // Determine the original delta direction:
            //   "full_payment_due" / "balance_increased" → was +amount (customer owed more)
            //   "balance_decreased" / "payment_received" → was -amount (customer paid / balance reduced)
            const wasPositive = tx.transaction_type === "full_payment_due" || tx.transaction_type === "balance_increased";
            const reversalDelta = wasPositive ? -tx.amount : tx.amount;
            balanceReversals.set(tx.ledger_id, (balanceReversals.get(tx.ledger_id) ?? 0) + reversalDelta);
          }

          const updateLedger = db.prepare(
            `UPDATE customer_ledger SET balance_due = MAX(0, balance_due + ?), updated_at = datetime('now') WHERE id = ?`
          );
          for (const [ledgerId, delta] of balanceReversals) {
            updateLedger.run(delta, ledgerId);
          }

          db.prepare(
            `DELETE FROM customer_ledger_transactions WHERE order_id IN (${placeholders})`
          ).run(...orderIds);

          // 4. Reverse daily_earnings for each order's amount_paid
          for (const order of orderRows) {
            if (order.amount_paid > 0) {
              try {
                const dateIso = getZonedStartOfDayUtc(new Date(order.order_date)).toISOString();
                earningRepo.incrementEarnings(dateIso, -order.amount_paid);
              } catch { /* ignore */ }
            }
          }
        }

        // 5. Delete the orders
        let orderResult: { changes: number };
        if (startDate && endDate) {
          const endDt = new Date(endDate);
          endDt.setUTCHours(23, 59, 59, 999);
          orderResult = db.prepare(
            `DELETE FROM orders WHERE order_date >= ? AND order_date <= ?`
          ).run(new Date(startDate).toISOString(), endDt.toISOString()) as { changes: number };
        } else {
          orderResult = db.prepare(`DELETE FROM orders`).run() as { changes: number };
        }
        counts["orders"] = orderResult.changes;
      }

      // Handle all other selected modules normally
      for (const mod of modules) {
        if (mod === "orders") continue; // already handled above
        const table = TABLE_MAP[mod];
        if (!table) continue;

        const dateCol = DATE_COL[mod];
        let result: { changes: number };

        if (dateCol && startDate && endDate) {
          const endDt = new Date(endDate);
          endDt.setUTCHours(23, 59, 59, 999);
          result = db
            .prepare(`DELETE FROM ${table} WHERE ${dateCol} >= ? AND ${dateCol} <= ?`)
            .run(new Date(startDate).toISOString(), endDt.toISOString()) as { changes: number };
        } else {
          result = db.prepare(`DELETE FROM ${table}`).run() as { changes: number };
        }

        counts[mod] = result.changes;

        // Re-seed virtual takeaway table after tables are deleted
        if (mod === "tables") {
          db.prepare("INSERT OR IGNORE INTO tables_tb (table_no, seats, is_virtual) VALUES (0, 0, 1)").run();
        }
      }
    });

    deleteTx();

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    res.json({
      success: true,
      message: `Deleted ${total} record(s).`,
      data: counts,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Import (Restore) ─────────────────────────────────────────────────────────

export const importData = (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { exportedAt?: string; data?: Record<string, unknown[]> } | Record<string, unknown[]>;

    // Accept both { exportedAt, data: {...} } and a flat { orders, staff, ... }
    const moduleData: Record<string, unknown[]> =
      (body as { data?: Record<string, unknown[]> }).data ??
      (body as Record<string, unknown[]>);

    if (!moduleData || typeof moduleData !== "object" || Array.isArray(moduleData)) {
      res.status(400).json({ success: false, message: "Invalid backup format." });
      return;
    }

    const db = getDb();
    const counts: Record<string, number> = {};

    const importTx = db.transaction(() => {
      // ── orders ──────────────────────────────────────────────────────────────
      if (Array.isArray(moduleData["orders"])) {
        let cnt = 0;
        for (const raw of moduleData["orders"] as Record<string, unknown>[]) {
          const row = { ...raw };

          // ── Normalize old bills format { total, roundOff, totalWithTax } ──────
          // New format: { subtotal, tax, roundoff, total }
          if (typeof row["bills"] === "string") {
            try {
              const b = JSON.parse(row["bills"] as string) as Record<string, number>;
              if ("totalWithTax" in b && !("subtotal" in b)) {
                const normalized = {
                  subtotal: b["total"] ?? b["totalWithTax"] ?? 0,
                  tax:      b["tax"]   ?? 0,
                  roundoff: b["roundOff"] ?? 0,
                  total:    b["totalWithTax"] ?? b["total"] ?? 0,
                };
                row["bills"] = JSON.stringify(normalized);
              }
            } catch { /* leave as-is if unparseable */ }
          }

          // ── Normalize old items: add missing variantSize ─────────────────────
          if (typeof row["items"] === "string") {
            try {
              const items = JSON.parse(row["items"] as string) as Record<string, unknown>[];
              const fixed = items.map((it) =>
                "variantSize" in it ? it : { ...it, variantSize: "Regular" }
              );
              row["items"] = JSON.stringify(fixed);
            } catch { /* leave as-is */ }
          }

          const cols = Object.keys(row);
          db.prepare(`INSERT OR REPLACE INTO orders (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
            .run(...cols.map((c) => row[c]));
          // Re-credit daily_earnings for the order's amount_paid (mirrors deleteData reversal)
          const amountPaid = Number(row["amount_paid"]);
          if (amountPaid > 0) {
            try {
              const dateIso = getZonedStartOfDayUtc(new Date(row["order_date"] as string)).toISOString();
              earningRepo.incrementEarnings(dateIso, amountPaid);
            } catch { /* ignore earnings errors */ }
          }
          cnt++;
        }
        counts["orders"] = cnt;
      }

      // ── staff (+ nested payments) ────────────────────────────────────────────
      if (Array.isArray(moduleData["staff"])) {
        let cnt = 0;
        for (const raw of moduleData["staff"] as Record<string, unknown>[]) {
          const { payments: paymentsRaw, ...staffRow } = raw;
          const cols = Object.keys(staffRow);
          db.prepare(`INSERT OR REPLACE INTO staff (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
            .run(...cols.map((c) => staffRow[c]));

          const payments: Record<string, unknown>[] =
            typeof paymentsRaw === "string"
              ? (JSON.parse(paymentsRaw) as Record<string, unknown>[])
              : Array.isArray(paymentsRaw)
              ? (paymentsRaw as Record<string, unknown>[])
              : [];

          for (const p of payments) {
            // Ensure staff_id is present (not included in the export JSON object)
            const payment: Record<string, unknown> = { staff_id: staffRow["id"], ...p };
            const pcols = Object.keys(payment);
            db.prepare(`INSERT OR REPLACE INTO staff_payments (${pcols.join(", ")}) VALUES (${pcols.map(() => "?").join(", ")})`)
              .run(...pcols.map((c) => payment[c]));
          }
          cnt++;
        }
        counts["staff"] = cnt;
      }

      // ── consumables ───────────────────────────────────────────────────────────
      if (Array.isArray(moduleData["consumables"])) {
        let cnt = 0;
        for (const row of moduleData["consumables"] as Record<string, unknown>[]) {
          const cols = Object.keys(row);
          db.prepare(`INSERT OR REPLACE INTO consumables (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
            .run(...cols.map((c) => row[c]));
          // Re-credit daily_earnings for customer consumables linked to orders (mirrors deleteData reversal)
          if (row["consumer_type"] === "customer" && row["order_id"] != null) {
            try {
              const qty = Number(row["quantity"]);
              const ppu = Number(row["price_per_unit"]);
              if (qty > 0 && ppu > 0) {
                const dateIso = getZonedStartOfDayUtc(new Date(row["timestamp"] as string)).toISOString();
                earningRepo.incrementEarnings(dateIso, qty * ppu);
              }
            } catch { /* ignore earnings errors */ }
          }
          cnt++;
        }
        counts["consumables"] = cnt;
      }

      // ── tables ────────────────────────────────────────────────────────────────
      if (Array.isArray(moduleData["tables"])) {
        let cnt = 0;
        for (const row of moduleData["tables"] as Record<string, unknown>[]) {
          const cols = Object.keys(row);
          db.prepare(`INSERT OR REPLACE INTO tables_tb (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
            .run(...cols.map((c) => row[c]));
          cnt++;
        }
        counts["tables"] = cnt;
        // Re-seed virtual takeaway table — old backups won't have it
        db.prepare("INSERT OR IGNORE INTO tables_tb (table_no, seats, is_virtual) VALUES (0, 0, 1)").run();
      }

      // ── dishes ────────────────────────────────────────────────────────────────
      if (Array.isArray(moduleData["dishes"])) {
        let cnt = 0;
        for (const row of moduleData["dishes"] as Record<string, unknown>[]) {
          const cols = Object.keys(row);
          db.prepare(`INSERT OR REPLACE INTO dishes (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
            .run(...cols.map((c) => row[c]));
          cnt++;
        }
        counts["dishes"] = cnt;
      }

      // ── ledger (+ nested transactions) ───────────────────────────────────────
      if (Array.isArray(moduleData["ledger"])) {
        let cnt = 0;
        for (const raw of moduleData["ledger"] as Record<string, unknown>[]) {
          const { transactions: txRaw, ...ledgerRow } = raw;
          // Old backups can have negative balance_due (overpaid) — clamp to 0
          if (typeof ledgerRow["balance_due"] === "number" && ledgerRow["balance_due"] < 0) {
            ledgerRow["balance_due"] = 0;
          }
          const cols = Object.keys(ledgerRow);
          db.prepare(`INSERT OR REPLACE INTO customer_ledger (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
            .run(...cols.map((c) => ledgerRow[c]));

          const transactions: Record<string, unknown>[] =
            typeof txRaw === "string"
              ? (JSON.parse(txRaw) as Record<string, unknown>[])
              : Array.isArray(txRaw)
              ? (txRaw as Record<string, unknown>[])
              : [];

          for (const t of transactions) {
            // Ensure ledger_id is present (not included in the export JSON object)
            const tx: Record<string, unknown> = { ledger_id: ledgerRow["id"], ...t };
            const tcols = Object.keys(tx);
            db.prepare(`INSERT OR REPLACE INTO customer_ledger_transactions (${tcols.join(", ")}) VALUES (${tcols.map(() => "?").join(", ")})`)
              .run(...tcols.map((c) => tx[c]));
          }
          cnt++;
        }
        counts["ledger"] = cnt;
      }
    });

    importTx();

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    res.json({
      success: true,
      message: `Restored ${total} record(s).`,
      data: counts,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Recalculate daily_earnings from actual orders + consumables ───────────────

export const recalcEarnings = (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();

    type OrderRow = { order_date: string; amount_paid: number };
    type ConsumableRow = { timestamp: string; quantity: number; price_per_unit: number };

    const orders = db.prepare(
      `SELECT order_date, amount_paid FROM orders WHERE amount_paid > 0`
    ).all() as OrderRow[];

    const consumables = db.prepare(
      `SELECT timestamp, quantity, price_per_unit FROM consumables
       WHERE consumer_type = 'customer' AND order_id IS NOT NULL`
    ).all() as ConsumableRow[];

    // Accumulate totals per day-bucket (IST start-of-day stored as UTC ISO)
    const totals = new Map<string, number>();

    for (const o of orders) {
      try {
        const key = getZonedStartOfDayUtc(new Date(o.order_date)).toISOString();
        totals.set(key, (totals.get(key) ?? 0) + o.amount_paid);
      } catch { /* skip malformed dates */ }
    }

    for (const c of consumables) {
      try {
        const key = getZonedStartOfDayUtc(new Date(c.timestamp)).toISOString();
        totals.set(key, (totals.get(key) ?? 0) + c.quantity * c.price_per_unit);
      } catch { /* skip malformed dates */ }
    }

    const recalcTx = db.transaction(() => {
      // Wipe existing earnings and rebuild clean
      db.prepare("DELETE FROM daily_earnings").run();
      try { db.prepare("DELETE FROM sqlite_sequence WHERE name = 'daily_earnings'").run(); } catch { /* ok */ }

      for (const [dateIso, total] of totals) {
        earningRepo.incrementEarnings(dateIso, total);
      }
    });

    recalcTx();

    res.json({
      success: true,
      message: `Recalculated earnings for ${totals.size} day(s).`,
      data: Object.fromEntries(totals),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Full DB Reset ─────────────────────────────────────────────────────────────
// Clears all operational/transactional data.
// Preserved: users, dishes (menu), tables_tb (structure), staff (profiles).

export const resetDb = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { confirmPhrase, password } = req.body as { confirmPhrase?: string; password?: string };

    if (confirmPhrase !== "RESET") {
      res.status(400).json({ success: false, message: "Confirmation phrase incorrect." });
      return;
    }

    if (!password) {
      res.status(400).json({ success: false, message: "Admin password is required." });
      return;
    }

    // Verify the logged-in admin's password
    const userId = (req.user as { _id: string | number })?._id;
    const user = userRepo.findById(userId);
    if (!user || (user as Record<string, unknown>).role !== "Admin") {
      res.status(403).json({ success: false, message: "Admin access required." });
      return;
    }
    const isMatch = await bcrypt.compare(password, (user as Record<string, unknown>).password as string);
    if (!isMatch) {
      res.status(401).json({ success: false, message: "Incorrect password." });
      return;
    }

    const db = getDb();

    const resetTx = db.transaction(() => {
      // Transactional / operational data — full wipe
      db.prepare("DELETE FROM customer_ledger_transactions").run();
      db.prepare("DELETE FROM customer_ledger").run();
      db.prepare("DELETE FROM consumables").run();
      db.prepare("DELETE FROM orders").run();
      db.prepare("DELETE FROM payments").run();
      db.prepare("DELETE FROM expenses").run();
      db.prepare("DELETE FROM daily_earnings").run();
      db.prepare("DELETE FROM staff_payments").run();

      // Reset auto-increment sequences for wiped tables
      const resetSeq = db.prepare("DELETE FROM sqlite_sequence WHERE name = ?");
      for (const t of ["customer_ledger_transactions", "customer_ledger", "consumables", "orders", "payments", "expenses", "daily_earnings", "staff_payments"]) {
        try { resetSeq.run(t); } catch { /* sqlite_sequence may not have this row yet */ }
      }

      // Reset tables to Available (keep table layout / seat config)
      db.prepare("UPDATE tables_tb SET status = 'Available', current_order_id = NULL, updated_at = datetime('now')").run();

      // Reset dish order counts
      db.prepare("UPDATE dishes SET number_of_orders = 0, updated_at = datetime('now')").run();
    });

    resetTx();

    res.json({
      success: true,
      message: "Database reset complete. All operational data has been cleared.",
    });
  } catch (err) {
    next(err);
  }
};
