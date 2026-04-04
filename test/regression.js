#!/usr/bin/env node
/**
 * Dhaba POS — Regression + Concurrent Load Test Suite
 *
 * Covers:
 *   1. Health check
 *   2. Admin auth (login / cookie)
 *   3. Tables API
 *   4. Full order lifecycle  (dine-in, takeaway, delivery)
 *   5. Multi-round item addition
 *   6. Payment status update
 *   7. Customer-app public flows (dishes, place order, status polling)
 *   8. Concurrent order creation  (busy-hour simulation)
 *   9. Concurrent status updates on different orders
 *  10. Cleanup of all test orders created
 *
 * Usage:
 *   BASE_URL=http://localhost:5002 \
 *   ADMIN_EMAIL=admin@dhaba.com   \
 *   ADMIN_PASS=yourpassword       \
 *   node test/regression.js
 *
 * Defaults: BASE_URL=http://localhost:5002, reads email/pass from env only.
 */

const BASE_URL   = process.env.BASE_URL   || "http://localhost:5002";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASS  = process.env.ADMIN_PASS;

// ── Tiny test runner ──────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const createdOrderIds = [];  // track for cleanup

function pass(name) {
  passed++;
  console.log(`  ✅ PASS  ${name}`);
}

function fail(name, reason) {
  failed++;
  console.error(`  ❌ FAIL  ${name}`);
  console.error(`         ${reason}`);
}

async function test(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (err) {
    fail(name, err.message ?? String(err));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertStatus(res, expected, context) {
  if (res.status !== expected) {
    throw new Error(`${context ?? ""}: expected HTTP ${expected}, got ${res.status}`);
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

let authCookie = "";

async function api(method, path, body, overrideCookie) {
  const headers = { "Content-Type": "application/json" };
  const cookie = overrideCookie !== undefined ? overrideCookie : authCookie;
  if (cookie) headers["Cookie"] = `accessToken=${cookie}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data, headers: res.headers };
}

const get   = (path, cookie)       => api("GET",    path, null,  cookie);
const post  = (path, body, cookie) => api("POST",   path, body,  cookie);
const put   = (path, body, cookie) => api("PUT",    path, body,  cookie);
const patch = (path, body, cookie) => api("PATCH",  path, body,  cookie);
const del   = (path, cookie)       => api("DELETE", path, null,  cookie);

// ── Sample order data factory ─────────────────────────────────────────────────

function sampleItems() {
  return [
    { id: "1", name: "Dal Makhani", variantSize: "Full", pricePerQuantity: 180, quantity: 1, price: 180, batch: 1 },
    { id: "2", name: "Butter Naan",  variantSize: "Regular", pricePerQuantity: 40,  quantity: 2, price: 80,  batch: 1 },
  ];
}

function sampleBills(extraItems = []) {
  const items = [...sampleItems(), ...extraItems];
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const total    = subtotal;
  const totalWithTax = Math.round(total * 1.05); // 5% GST
  return { subtotal, total, totalWithTax };
}

function sampleCustomer(suffix = "") {
  return { name: `Test Customer${suffix}`, phone: `9${String(Date.now()).slice(-9)}`, guests: 2 };
}

// ── 1. Health ─────────────────────────────────────────────────────────────────

async function runHealthTests() {
  console.log("\n── 1. Health check ──");
  await test("GET /health returns 200 with fingerprint", async () => {
    const res = await get("/health", "");
    assertStatus(res, 200, "/health");
    assert(res.data?.app === "dhaba-pos", `fingerprint mismatch: ${res.data?.app}`);
    assert(res.data?.status === "ok", "status not ok");
  });
}

// ── 2. Auth ───────────────────────────────────────────────────────────────────

async function runAuthTests() {
  console.log("\n── 2. Admin auth ──");

  if (!ADMIN_EMAIL || !ADMIN_PASS) {
    console.warn("  ⚠️  ADMIN_EMAIL / ADMIN_PASS not set — skipping auth-dependent tests.");
    return false;
  }

  let loginOk = false;
  await test("POST /api/user/login sets accessToken cookie", async () => {
    const res = await fetch(`${BASE_URL}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
    });
    assertStatus({ status: res.status }, 200, "login");
    const setCookie = res.headers.get("set-cookie") || "";
    const match = setCookie.match(/accessToken=([^;]+)/);
    assert(match, `No accessToken cookie in response. set-cookie: ${setCookie}`);
    authCookie = match[1];
    loginOk = true;
  });

  if (!loginOk) return false;

  await test("GET /api/user returns current user (authenticated)", async () => {
    const res = await get("/api/user");
    assertStatus(res, 200, "/api/user");
    assert(res.data?.data, "no user data returned");
  });

  await test("GET /api/user returns 401 with no cookie", async () => {
    const res = await get("/api/user", "");
    assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
  });

  return true;
}

// ── 3. Tables ─────────────────────────────────────────────────────────────────

let physicalTable = null;
let virtualTable  = null;

async function runTableTests() {
  console.log("\n── 3. Tables ──");

  await test("GET /api/table returns array", async () => {
    const res = await get("/api/table");
    assertStatus(res, 200, "/api/table");
    const tables = res.data?.data ?? [];
    assert(Array.isArray(tables), "tables is not an array");
    assert(tables.length > 0, "no tables found — seed data missing?");

    physicalTable = tables.find(t => !t.isVirtual && t.status !== "Booked");
    virtualTable  = tables.find(t => t.isVirtual);

    assert(virtualTable, "no virtual table found — needed for takeaway/delivery orders");
    console.log(`     physical=${physicalTable?._id ?? "none available"} virtual=${virtualTable._id}`);
  });

  // If no physical table is free (e.g. fresh isolated DB), create one for the lifecycle test
  if (!physicalTable) {
    await test("POST /api/table — create physical table for dine-in test", async () => {
      const res = await post("/api/table", { tableNo: 901, seats: 4 });
      assertStatus(res, 201, "create table");
      physicalTable = res.data?.data;
      assert(physicalTable?._id, "no table _id returned");
      console.log(`     created physical table _id=${physicalTable._id}`);
    });
  }
}

// ── 4. Full order lifecycle ───────────────────────────────────────────────────

async function runOrderLifecycleTests() {
  console.log("\n── 4. Order lifecycle ──");

  // 4a. Create dine-in order on a physical table
  let dineInOrderId = null;
  if (physicalTable) {
    await test("POST /api/order — create dine-in order", async () => {
      const body = {
        orderType: "dine-in",
        table: Number(physicalTable._id),
        customerDetails: sampleCustomer(" (dine-in)"),
        items: sampleItems(),
        bills: sampleBills(),
        paymentMethod: "Cash",
        paymentStatus: "Pending",
        amountPaid: 0,
      };
      const res = await post("/api/order", body);
      assertStatus(res, 201, "create dine-in order");
      assert(res.data?.data?._id, "no order _id returned");
      dineInOrderId = res.data.data._id;
      createdOrderIds.push(dineInOrderId);
      console.log(`     dine-in orderId=${dineInOrderId}`);
    });

    await test("GET /api/order/:id — fetch dine-in order", async () => {
      assert(dineInOrderId, "no dine-in order to fetch");
      const res = await get(`/api/order/${dineInOrderId}`);
      assertStatus(res, 200, "fetch order");
      assert(res.data?.data?.orderStatus === "Pending", `expected Pending, got ${res.data?.data?.orderStatus}`);
    });

    await test("PUT /api/order/:id — update status Pending → Cooking", async () => {
      assert(dineInOrderId, "no dine-in order");
      const res = await put(`/api/order/${dineInOrderId}`, { orderStatus: "Cooking" });
      assertStatus(res, 200, "status → Cooking");
      assert(res.data?.data?.orderStatus === "Cooking", "status not Cooking");
    });

    await test("PUT /api/order/:id — update status Cooking → Ready", async () => {
      assert(dineInOrderId, "no dine-in order");
      const res = await put(`/api/order/${dineInOrderId}`, { orderStatus: "Ready" });
      assertStatus(res, 200, "status → Ready");
    });

    await test("PUT /api/order/:id — mark as Completed + Paid (full payment)", async () => {
      assert(dineInOrderId, "no dine-in order");
      const bills = sampleBills();
      const res = await put(`/api/order/${dineInOrderId}`, {
        orderStatus: "Completed",
        paymentStatus: "Paid",
        amountPaid: bills.totalWithTax,
      });
      assertStatus(res, 200, "Completed + Paid");
      assert(res.data?.data?.orderStatus === "Completed", "not Completed");
    });
  } else {
    console.warn("  ⚠️  No free physical table — dine-in lifecycle skipped.");
  }

  // 4b. Takeaway order (uses virtual table)
  let takeawayOrderId = null;
  await test("POST /api/order — create takeaway order (virtual table)", async () => {
    assert(virtualTable, "no virtual table");
    const body = {
      orderType: "takeaway",
      table: Number(virtualTable._id),
      customerDetails: sampleCustomer(" (takeaway)"),
      items: sampleItems(),
      bills: sampleBills(),
      paymentMethod: "Cash",
      paymentStatus: "Paid",
      amountPaid: sampleBills().totalWithTax,
    };
    const res = await post("/api/order", body);
    assertStatus(res, 201, "create takeaway order");
    takeawayOrderId = res.data.data._id;
    createdOrderIds.push(takeawayOrderId);
    console.log(`     takeaway orderId=${takeawayOrderId}`);
  });

  // 4c. Delivery order (uses virtual table)
  let deliveryOrderId = null;
  await test("POST /api/order — create delivery order (virtual table)", async () => {
    assert(virtualTable, "no virtual table");
    const body = {
      orderType: "delivery",
      table: Number(virtualTable._id),
      customerDetails: sampleCustomer(" (delivery)"),
      items: sampleItems(),
      bills: sampleBills(),
      paymentMethod: "Online",
      paymentStatus: "Pending",
      amountPaid: 0,
    };
    const res = await post("/api/order", body);
    assertStatus(res, 201, "create delivery order");
    deliveryOrderId = res.data.data._id;
    createdOrderIds.push(deliveryOrderId);
    console.log(`     delivery orderId=${deliveryOrderId}`);
  });

  // 4d. Multi-round item addition to delivery order
  await test("POST /api/order — add items (round 2) to delivery order", async () => {
    assert(deliveryOrderId, "no delivery order");
    const extraItems = [
      { id: "3", name: "Lassi", variantSize: "Large", pricePerQuantity: 80, quantity: 1, price: 80 },
    ];
    const allItems  = [...sampleItems(), ...extraItems];
    const body = {
      _id: deliveryOrderId,
      table: Number(virtualTable._id),
      customerDetails: sampleCustomer(" (delivery)"),
      items: allItems,
      bills: sampleBills(extraItems),
      paymentMethod: "Online",
      paymentStatus: "Pending",
      amountPaid: 0,
    };
    const res = await post("/api/order", body);
    assertStatus(res, 200, "add items round 2");
    const returnedItems = res.data?.data?.items ?? [];
    assert(returnedItems.length >= 3, `expected ≥3 items, got ${returnedItems.length}`);
    // Round 2 items should have batch=2
    const round2 = returnedItems.filter(i => i.batch === 2);
    assert(round2.length > 0, "no batch=2 items — multi-round not tracked");
  });

  // 4e. Partial payment flow
  await test("PUT /api/order/:id — partial payment recorded (amountPaid)", async () => {
    assert(deliveryOrderId, "no delivery order");
    const partial = 100;
    const res = await put(`/api/order/${deliveryOrderId}`, { amountPaid: partial });
    assertStatus(res, 200, "partial payment");
    const due = res.data?.data?.balanceDueOnOrder;
    assert(due > 0, `expected balanceDue > 0, got ${due}`);
  });

  return { dineInOrderId, takeawayOrderId, deliveryOrderId };
}

// ── 5. Validation / error handling ───────────────────────────────────────────

async function runValidationTests() {
  console.log("\n── 5. Validation & error handling ──");

  await test("POST /api/order — 400 on missing customerDetails", async () => {
    const res = await post("/api/order", {
      table: virtualTable?._id ?? 1,
      items: sampleItems(),
      bills: sampleBills(),
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  await test("POST /api/order — 400 on invalid table ID", async () => {
    const res = await post("/api/order", {
      table: 99999,
      customerDetails: sampleCustomer(),
      items: sampleItems(),
      bills: sampleBills(),
    });
    assert(res.status === 400 || res.status === 404, `expected 400/404, got ${res.status}`);
  });

  await test("GET /api/order/999999 — 404 for non-existent order", async () => {
    const res = await get("/api/order/999999");
    assert(res.status === 404, `expected 404, got ${res.status}`);
  });

  await test("GET /api/order/abc — 400 on non-numeric ID", async () => {
    const res = await get("/api/order/abc");
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });
}

// ── 6. Customer-app public routes ─────────────────────────────────────────────

async function runCustomerAppTests() {
  console.log("\n── 6. Customer-app public routes ──");

  let onlineDishId = null;

  await test("GET /api/customer/dishes — returns available dishes", async () => {
    const res = await get("/api/customer/dishes", "");
    assertStatus(res, 200, "public dishes");
    const dishes = res.data?.data ?? [];
    // May be empty in dev if no dishes are marked online-available — just check shape
    assert(Array.isArray(dishes), "data is not an array");
    if (dishes.length > 0) {
      onlineDishId = dishes[0]._id;
      assert(dishes[0].name, "dish missing name");
      assert(dishes[0].variants, "dish missing variants");
      assert(dishes[0].numberOfOrders === undefined, "internal tracking field leaked");
    } else {
      console.warn("     ⚠️  no online-available dishes — mark some in the admin to fully test");
    }
  });

  await test("POST /api/customer/order — place customer delivery order", async () => {
    const items = onlineDishId
      ? [{ id: onlineDishId, name: "Test Dish", variantSize: "Regular", pricePerQuantity: 150, quantity: 1, price: 150, batch: 1 }]
      : sampleItems();
    const bills = { subtotal: 150, total: 150, totalWithTax: 158 };
    const res = await post("/api/customer/order", {
      orderType: "delivery",
      customerDetails: sampleCustomer(" (public)"),
      deliveryAddress: "123 Test Street, Test Town",
      items,
      bills,
      paymentMethod: "Cash",
      paymentStatus: "Pending",
      amountPaid: 0,
    }, "");
    // 201 = placed OK; 503 = online ordering disabled (valid in dev)
    assert(res.status === 201 || res.status === 503,
      `unexpected status ${res.status}: ${JSON.stringify(res.data)}`);
    if (res.status === 201) {
      const oid = res.data?.data?._id;
      assert(oid, "no order _id from customer route");
      createdOrderIds.push(oid);
      console.log(`     customer orderId=${oid}`);

      // Check order status endpoint
      await test("GET /api/customer/order/:id — status polling", async () => {
        const r2 = await get(`/api/customer/order/${oid}`, "");
        assertStatus(r2, 200, "customer order status");
        assert(r2.data?.data?.orderStatus, "missing orderStatus");
      });
    } else {
      console.warn("     ⚠️  online ordering disabled — 503 expected, skipping status check");
    }
  });

  await test("GET /api/customer/dishes — internal fields stripped", async () => {
    const res = await get("/api/customer/dishes", "");
    const dishes = res.data?.data ?? [];
    for (const d of dishes) {
      assert(d.numberOfOrders === undefined, `numberOfOrders leaked on dish ${d._id}`);
    }
  });
}

// ── 7. Online config ──────────────────────────────────────────────────────────

async function runOnlineConfigTests() {
  console.log("\n── 7. Online config (public flags) ──");

  await test("GET /api/online-config/flags — returns store status flags", async () => {
    const res = await get("/api/online-config/flags", "");
    assertStatus(res, 200, "/flags");
    const d = res.data?.data ?? res.data;
    assert(typeof d?.isOnline === "boolean", "isOnline not boolean");
    assert(typeof d?.deliveryEnabled === "boolean", "deliveryEnabled not boolean");
  });

  await test("GET /api/online-config/delivery-areas — returns array", async () => {
    const res = await get("/api/online-config/delivery-areas", "");
    assertStatus(res, 200, "delivery-areas");
    const areas = res.data?.data ?? res.data;
    assert(Array.isArray(areas), "delivery-areas is not an array");
  });
}

// ── 8. Concurrent order creation (busy-hour simulation) ──────────────────────

async function runConcurrentOrderTests() {
  console.log("\n── 8. Concurrent order creation (10 simultaneous) ──");

  if (!virtualTable) {
    console.warn("  ⚠️  No virtual table found — skipping concurrent tests.");
    return;
  }

  const N = 10;
  const results = await Promise.allSettled(
    Array.from({ length: N }, (_, i) =>
      post("/api/order", {
        orderType: "delivery",
        table: Number(virtualTable._id),
        customerDetails: { name: `Concurrent Customer ${i + 1}`, phone: `9${String(100000000 + i)}`, guests: 1 },
        items: [{ id: "1", name: "Dal", variantSize: "Half", pricePerQuantity: 100, quantity: 1, price: 100, batch: 1 }],
        bills: { subtotal: 100, total: 100, totalWithTax: 105 },
        paymentMethod: "Cash",
        paymentStatus: "Pending",
        amountPaid: 0,
      })
    )
  );

  const succeeded = results.filter(r => r.status === "fulfilled" && r.value.status === 201);
  const failed401 = results.filter(r => r.status === "fulfilled" && r.value.status !== 201);
  const rejected  = results.filter(r => r.status === "rejected");

  for (const r of succeeded) {
    const id = r.value?.data?.data?._id;
    if (id) createdOrderIds.push(id);
  }

  await test(`All ${N} concurrent orders created (no failures/race conditions)`, async () => {
    assert(
      succeeded.length === N,
      `Only ${succeeded.length}/${N} succeeded. Failed: ${failed401.length} wrong-status, ${rejected.length} rejected.`
    );
  });

  // Verify all created orders are independently retrievable
  await test("All concurrently-created orders are independently queryable", async () => {
    const ids = succeeded.map(r => r.value.data.data._id);
    const fetches = await Promise.all(ids.map(id => get(`/api/order/${id}`)));
    const allOk = fetches.every(r => r.status === 200);
    assert(allOk, `Some concurrent orders not retrievable: ${fetches.filter(r => r.status !== 200).length} failures`);
  });
}

// ── 9. Concurrent status updates ──────────────────────────────────────────────

async function runConcurrentStatusTests() {
  console.log("\n── 9. Concurrent status updates (5 simultaneous) ──");

  if (!virtualTable) return;

  // Create 5 fresh orders to update simultaneously
  const fresh = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      post("/api/order", {
        orderType: "takeaway",
        table: Number(virtualTable._id),
        customerDetails: { name: `Status Test ${i}`, phone: `8${String(100000000 + i)}`, guests: 1 },
        items: sampleItems(),
        bills: sampleBills(),
        paymentMethod: "Cash",
        paymentStatus: "Pending",
        amountPaid: 0,
      })
    )
  );

  const freshIds = fresh
    .filter(r => r.status === 201)
    .map(r => r.data.data._id);
  freshIds.forEach(id => createdOrderIds.push(id));

  await test("5 concurrent Pending→Cooking status updates all succeed", async () => {
    const updates = await Promise.allSettled(
      freshIds.map(id => put(`/api/order/${id}`, { orderStatus: "Cooking" }))
    );
    const ok = updates.filter(r => r.status === "fulfilled" && r.value.status === 200).length;
    assert(ok === freshIds.length, `Only ${ok}/${freshIds.length} concurrent status updates succeeded`);
  });

  await test("5 concurrent Cooking→Ready status updates all succeed", async () => {
    const updates = await Promise.allSettled(
      freshIds.map(id => put(`/api/order/${id}`, { orderStatus: "Ready" }))
    );
    const ok = updates.filter(r => r.status === "fulfilled" && r.value.status === 200).length;
    assert(ok === freshIds.length, `Only ${ok}/${freshIds.length} concurrent Ready updates succeeded`);
  });
}

// ── 10. Cleanup ───────────────────────────────────────────────────────────────

async function runCleanup() {
  console.log("\n── 10. Cleanup ──");

  if (createdOrderIds.length === 0) {
    console.log("  (nothing to clean up)");
    return;
  }

  // We need the admin password to delete orders
  if (!ADMIN_PASS) {
    console.warn(`  ⚠️  ADMIN_PASS not set — cannot delete ${createdOrderIds.length} test orders. Delete manually.`);
    console.warn("  Order IDs:", createdOrderIds.join(", "));
    return;
  }

  // DELETE requires password in the request body (not query param)
  const results = await Promise.allSettled(
    createdOrderIds.map(id => api("DELETE", `/api/order/${id}`, { password: ADMIN_PASS }))
  );

  const deleted  = results.filter(r => r.status === "fulfilled" && r.value.status === 200).length;
  const notFound = results.filter(r => r.status === "fulfilled" && r.value.status === 404).length;
  const errors   = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && r.value.status > 404)).length;

  console.log(`  Deleted: ${deleted}  NotFound(already gone): ${notFound}  Errors: ${errors}`);
  if (errors > 0) {
    console.warn("  ⚠️  Some orders could not be deleted. Check logs.");
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(60));
  console.log(" Dhaba POS — Regression + Concurrent Load Tests");
  console.log(`  Target: ${BASE_URL}`);
  console.log("═".repeat(60));

  const start = Date.now();

  await runHealthTests();
  const authed = await runAuthTests();

  if (!authed) {
    console.warn("\n⚠️  Auth failed — admin-authenticated tests will be skipped.");
  }

  await runTableTests();

  if (authed) {
    await runOrderLifecycleTests();
    await runValidationTests();
    await runConcurrentOrderTests();
    await runConcurrentStatusTests();
  }

  await runCustomerAppTests();
  await runOnlineConfigTests();
  await runCleanup();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log("\n" + "═".repeat(60));
  console.log(` Results: ${passed} passed, ${failed} failed  (${elapsed}s)`);
  console.log("═".repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

main().catch(err => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
