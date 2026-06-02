# Analytics API — Implementation Summary

All endpoints added/fixed across two sessions. All require `Authorization` header (JWT) via the existing `isVerifiedUser` middleware unless noted otherwise.

---

## 1. `GET /api/daily-summary/:date`

**What it does:** Full day picture in one call. Replaces any Python script that stitches together multiple endpoints.

**Files:**
- Created: `pos-backend/controllers/dailySummaryController.ts`
- Created: `pos-backend/routes/dailySummaryRoutes.ts`
- Modified: `pos-backend/app.ts` — registered `app.use("/api/daily-summary", dailySummaryRoutes)`

**Request:**
```
GET /api/daily-summary/2026-05-20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2026-05-20",
    "revenue": 2273,
    "order_count": 8,
    "cancelled_count": 0,
    "payment_split": {
      "cash": 4,
      "upi": 2,
      "card": 0,
      "credit": 2
    },
    "top_items_by_qty": [
      { "name": "Roti", "quantity": 12 },
      { "name": "Shahi Paneer", "quantity": 5 }
    ],
    "top_items_by_revenue": [
      { "name": "Shahi Paneer", "revenue": 750 },
      { "name": "Thali", "revenue": 600 }
    ],
    "peak_hour_ist": "1:00 PM – 2:00 PM IST",
    "first_order_time_ist": "10:32 AM IST",
    "avg_order_value": 284,
    "expenses": {
      "total": 450,
      "by_type": { "food": 300, "supplies": 150 }
    },
    "consumables": {
      "tea": 5,
      "gutka": 3,
      "cigarette": 2
    }
  }
}
```

**Notes:**
- All times are in IST (Asia/Kolkata). UTC day boundaries are computed correctly via `getZonedStartOfDayUtc` / `getZonedEndOfDayUtc`.
- `revenue` = sum of `amountPaid` for non-cancelled orders (matches the DailyEarning model).
- `payment_split` counts orders per method. `credit` is the catch-all for anything not cash/upi/card.
- `top_items_by_qty` and `top_items_by_revenue` return top 5 each.
- `consumables` counts only customer-facing entries (`consumerType: "customer"`).

---

## 2. `GET /api/daily-summary/range?from=YYYY-MM-DD&to=YYYY-MM-DD`

**What it does:** Returns an array of daily summaries. Used for trend queries and analytics backfill.

**Files:** Same as #1 (`dailySummaryController.ts` / `dailySummaryRoutes.ts`).

**Request:**
```
GET /api/daily-summary/range?from=2026-05-19&to=2026-05-21
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "date": "2026-05-19", "revenue": 1800, "order_count": 6, ... },
    { "date": "2026-05-20", "revenue": 2273, "order_count": 8, ... },
    { "date": "2026-05-21", "revenue": 3100, "order_count": 12, ... }
  ]
}
```
Each entry has the same full shape as endpoint #1.

**Notes:**
- Max range: 90 days. Returns 400 if exceeded.
- **Performance:** Runs exactly 3 MongoDB queries for the entire range (Orders, Expenses, Consumables), then partitions by day in memory. Not N×3.
- `/range` is registered before `/:date` in the router so "range" is never treated as a date param.

---

## 3. `GET /api/earnings/range?from=YYYY-MM-DD&to=YYYY-MM-DD`

**What it does:** Lightweight revenue-per-date array. Reads from the pre-computed `DailyEarning` collection (fast). For queries like "revenue this month" or "best week in March".

**Files:**
- Modified: `pos-backend/controllers/earningController.ts` — added `getEarningsRange`
- Modified: `pos-backend/routes/earningRoute.ts` — added `/range` before `/:periodType`

**Request:**
```
GET /api/earnings/range?from=2026-03-01&to=2026-03-31
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "date": "2026-03-01", "revenue": 1500 },
    { "date": "2026-03-02", "revenue": 0 },
    { "date": "2026-03-03", "revenue": 2800 }
  ]
}
```

**Notes:**
- Zero-fills every date in range. Days with no orders show `revenue: 0` instead of being omitted.
- Reads from `DailyEarning` (pre-computed nightly) — very fast even for large ranges.
- `/range` registered before `/:periodType` to avoid route conflict.

---

## 4. `GET /api/order?date=YYYY-MM-DD` (Fix)

**What it does:** Exact single-day order filter using IST boundaries. Previously only `startDate` (open-ended) existed.

**Files:**
- Modified: `pos-backend/controllers/orderController.ts` — `getOrders` now extracts `?date=`, computes IST start/end, passes as `startDate`/`endDate`
- Modified: `pos-backend/repositories/orderRepo.ts` — fixed `endDate` logic: UTC midnight override only applies to bare `YYYY-MM-DD` strings, not full ISO timestamps (which are now passed from the controller)

**Request:**
```
GET /api/order?date=2026-05-20
```
Can still combine with other filters:
```
GET /api/order?date=2026-05-20&orderStatus=Completed&paymentStatus=Paid
```

**Notes:**
- `?date=` takes priority over `startDate`/`endDate` if all three are passed.
- Existing `startDate`/`endDate` params still work unchanged for backwards compatibility.
- The repo bug fix: previously passing an ISO string as `endDate` would have its time overridden by `setUTCHours(23,59,59,999)`, causing wrong results.

---

## 5. `GET /api/dishes` — filter params (Enhancement)

**What it does:** Server-side filtering of dishes. Previously returned all dishes and filtering happened in Python.

**Files:**
- Modified: `pos-backend/repositories/dishRepo.ts` — added `DishFilters` interface + filter logic to `findAll()`
- Modified: `pos-backend/controllers/dishController.ts` — `getDishes` reads filter params from query

**Request:**
```
GET /api/dishes?type=veg&category=roti&search=paneer&minPrice=50&maxPrice=200
```
All params are optional. Without any params, returns all dishes (same as before).

**Query params:**

| Param | Type | Description |
|---|---|---|
| `type` | string | Exact match on `dish.type` (e.g. `veg`, `non-veg`) |
| `category` | string | Exact match on `dish.category` (e.g. `roti`, `curry`) |
| `search` | string | Case-insensitive regex on dish name |
| `minPrice` | number | Matches dishes with at least one variant ≥ this price |
| `maxPrice` | number | Matches dishes with at least one variant ≤ this price |

**Notes:**
- Price filtering uses MongoDB `$elemMatch` on the `variants` array — matches a dish if *any* of its variants falls in the price range.
- No breaking change — existing callers without params still get all dishes.

---

## 6. `GET /api/expenses?from=&to=` (Fix)

**What it does:** Date range filtering on expenses now works with `from`/`to` params. The Python code previously fetched all expenses and filtered client-side because it used `from`/`to` but the API only accepted `startDate`/`endDate`.

**Files:**
- Modified: `pos-backend/controllers/expenseController.ts` — `getAllExpenses` now accepts both `from`/`to` (new) and `startDate`/`endDate` (legacy). `from`/`to` take priority.

**Request:**
```
GET /api/expenses?from=2026-05-01&to=2026-05-31
GET /api/expenses?from=2026-05-01&to=2026-05-31&type=food_raw_material
```

**Notes:**
- IST-correct date boundaries already existed in the original code. This was purely a param-name mismatch.
- `startDate`/`endDate` still work for any existing integrations.

---

## 7. `GET /api/ledger/all?hasBalance=true` (Enhancement)

**What it does:** Returns only customers with outstanding dues, sorted by balance descending, without the transactions array. Replaces Python's `rank_customers()` logic.

**Files:**
- Modified: `pos-backend/repositories/ledgerRepo.ts` — added `sortBy` option + compact mode (uses `.select("-transactions")` to exclude the transactions array from the query)
- Modified: `pos-backend/controllers/customerLedgerController.ts` — `getAllCustomerLedgers` handles `hasBalance`, `sortBy` params

**Request:**
```
GET /api/ledger/all?hasBalance=true
```
Or with explicit control:
```
GET /api/ledger/all?status=unpaid&sortBy=balance
```

**Response shape when `hasBalance=true`:**
```json
{
  "success": true,
  "data": [
    { "_id": "...", "customerName": "Ramesh", "customerPhone": "9876543210", "balanceDue": 1200, "lastActivity": "...", "createdAt": "...", "updatedAt": "..." },
    { "_id": "...", "customerName": "Suresh", "customerPhone": "9988776655", "balanceDue": 450, "lastActivity": "...", "createdAt": "...", "updatedAt": "..." }
  ]
}
```
No `transactions` field — keeps the payload small.

**Notes:**
- `hasBalance=true` is a single flag that activates: `balanceDue > 0` filter + `balanceDue DESC` sort + no transactions.
- `sortBy=balance` can also be used independently on any `getAllCustomerLedgers` query without forcing the other two behaviors.
- Default sort (without `hasBalance` or `sortBy`) is still `lastActivity DESC` — no breaking change.

---

## 8. `GET /api/ledger/all?search=:name` (Enhancement)

**What it does:** Customer name search on the ledger. Previously only phone-based lookup existed via `GET /api/ledger/:phone`.

**Files:**
- Modified: `pos-backend/controllers/customerLedgerController.ts` — `search` is now an alias for the existing `name` param (which already did case-insensitive regex in the repo).

**Request:**
```
GET /api/ledger/all?search=Ramesh
GET /api/ledger/all?name=Ramesh
```
Both are equivalent. Can combine with `hasBalance`:
```
GET /api/ledger/all?search=Ramesh&hasBalance=true
```

**Notes:**
- No repo change needed — `ledgerRepo.findAll({ name })` already used `$regex` with `$options: "i"`.
- This eliminates the "Ramesh ka kitna baaki hai?" problem — name lookup now works without knowing the phone number.

---

## 9. `GET /api/dishes/top-revenue` (New)

**What it does:** Returns top dishes ranked by total revenue earned (quantity × price per order item) over an optional date range. Answers "Which dish makes us the most money?" — not answerable from the existing `/frequent` endpoint which only counts order volume.

**Files:**
- Modified: `pos-backend/controllers/dishController.ts` — added `getTopRevenueDishes`
- Modified: `pos-backend/routes/dishRoute.ts` — registered `/top-revenue` before `/:id`

**Request:**
```
GET /api/dishes/top-revenue
GET /api/dishes/top-revenue?limit=5
GET /api/dishes/top-revenue?limit=10&from=2026-05-01&to=2026-05-31
```

**Query params:**

| Param | Default | Description |
|---|---|---|
| `limit` | 10 | Max dishes to return (capped at 50) |
| `from` | none | IST start date filter (YYYY-MM-DD) |
| `to` | none | IST end date filter (YYYY-MM-DD) |

**Response:**
```json
{
  "success": true,
  "data": [
    { "name": "Shahi Paneer", "totalRevenue": 18750, "totalQuantity": 125, "orderCount": 98 },
    { "name": "Thali",        "totalRevenue": 15600, "totalQuantity": 78,  "orderCount": 78 },
    { "name": "Roti",         "totalRevenue": 6000,  "totalQuantity": 600, "orderCount": 310 }
  ]
}
```

**Notes:**
- Uses MongoDB aggregation: `$match` → `$unwind $items` → `$group by items.name` summing `qty × pricePerQuantity` → `$sort` → `$limit`.
- Cancelled orders are excluded from the aggregation.
- `orderCount` = number of order-item rows (i.e. how many times the dish appeared in an order, not unique orders).

---

## File Change Index

| File | Change Type | What Changed |
|---|---|---|
| `controllers/dailySummaryController.ts` | **Created** | `getDailySummary` + `getDailySummaryRange` + `buildSummaryFromData` helper |
| `routes/dailySummaryRoutes.ts` | **Created** | `/range` + `/:date` routes |
| `app.ts` | Modified | Registered `/api/daily-summary` |
| `controllers/earningController.ts` | Modified | Added `getEarningsRange` |
| `routes/earningRoute.ts` | Modified | Added `/range` before `/:periodType` |
| `controllers/orderController.ts` | Modified | `getOrders` — `?date=` param + import `getZonedEndOfDayUtc` |
| `repositories/orderRepo.ts` | Modified | `endDate` UTC override — skip when ISO timestamp passed |
| `repositories/dishRepo.ts` | Modified | `DishFilters` interface + filter logic in `findAll()` |
| `controllers/dishController.ts` | Modified | `getDishes` reads filter params; added `getTopRevenueDishes` |
| `routes/dishRoute.ts` | Modified | Added `/top-revenue` route |
| `controllers/expenseController.ts` | Modified | `getAllExpenses` — `from`/`to` aliases |
| `repositories/ledgerRepo.ts` | Modified | `compactToApi`; `findAll` — `sortBy` + `compact` options |
| `controllers/customerLedgerController.ts` | Modified | `getAllCustomerLedgers` — `hasBalance`, `search`, `sortBy` params |
