# POS Backend — Context & Code Guide

> **Root:** `pos-backend/`  
> **Runtime:** Node.js + TypeScript (compiled/run via `tsx`)  
> **Database:** SQLite via `better-sqlite3` (file: `dhaba-pos.db`)  
> **Last updated:** 2026-04-02 (online-config module, customer profiles)

---

## Tech Stack

| Concern | Library |
|---|---|
| HTTP framework | Express 4.x |
| Database | better-sqlite3 (SQLite, WAL mode) |
| Auth | jsonwebtoken + cookie-parser |
| Password hashing | bcryptjs |
| Job scheduling | node-cron |
| Payments | Razorpay SDK + PhonePe (custom HTTP) |
| Rate limiting | express-rate-limit |
| Error creation | http-errors |
| Date utilities | date-fns, date-fns-tz |
| Excel export | xlsx |
| TypeScript runner | tsx + nodemon (dev) |

---

## Folder Structure

```
pos-backend/
├── app.ts                  # Express app setup, CORS, route registration
├── server.ts               # HTTP server entry point
├── config/
│   └── config.ts           # Frozen config object from env vars
├── controllers/            # Request handlers (business logic)
├── repositories/           # SQL queries (data access layer)
├── routes/                 # Route definitions
├── db/
│   ├── schema.ts           # CREATE TABLE statements (idempotent)
│   └── index.ts            # DB init, WAL pragmas, migrations
├── middlewares/
│   ├── tokenVerification.ts   # JWT auth guard → sets req.user
│   └── globalErrorHandler.ts  # Catches next(err), returns JSON
├── types/
│   └── index.ts            # CustomRequest (extends Request with req.user)
├── scripts/
│   └── patch-node25.ts     # Node 25 compat shim
└── utils/                  # Shared helpers
```

---

## Database

### Connection & Pragmas

```typescript
// db/index.ts
_db.pragma("journal_mode = WAL");   // concurrent reads
_db.pragma("foreign_keys = ON");
_db.pragma("busy_timeout = 5000");  // wait up to 5s on SQLITE_BUSY
```

### Schema Overview

| Table | Purpose |
|---|---|
| `users` | POS staff accounts (email, hashed password, role) |
| `tables_tb` | Dine-in tables (`tables` is a reserved SQL word) |
| `dishes` | Menu items with variants (JSON array), `is_online_available` flag |
| `orders` | All orders — dine-in, takeaway, delivery; `customer_details`, `items`, `bills` stored as JSON |
| `payments` | Razorpay/PhonePe payment records |
| `expenses` | Manual expense entries |
| `daily_earnings` | Pre-computed daily totals (updated by cron) |
| `customer_ledger` | Credit/debit balance per customer (phone-keyed) |
| `customer_ledger_transactions` | Individual ledger entries |
| `consumables` | Tea/gutka/cigarette consumption tracking |
| `staff` | Staff profiles with salary |
| `staff_payments` | Salary disbursements |
| `store_settings` | Generic `key TEXT PK / value TEXT` store for config flags |
| `delivery_areas` | Admin-managed delivery zones (name, is_active) |
| `customer_profiles` | Public-facing customer identity store (phone PK, name, preferred_area, total_orders) — separate from POS ledger |

### Migrations

Add new migrations at the bottom of `runMigrations()` in `db/index.ts`. Pattern:

```typescript
// Add column safely (ALTER TABLE throws if col already exists)
try {
  db.prepare("ALTER TABLE orders ADD COLUMN new_col TEXT NOT NULL DEFAULT ''").run();
} catch { /* already exists */ }

// Create table idempotently
db.prepare(`CREATE TABLE IF NOT EXISTS new_table (...)`).run();

// Seed defaults
db.prepare("INSERT OR IGNORE INTO store_settings (key, value) VALUES ('my_flag', 'true')").run();
```

### store_settings keys

| Key | Default | Meaning |
|---|---|---|
| `online_orders` | `'true'` | Whether online ordering is open |
| `delivery_enabled` | `'true'` | Whether delivery order type is available |
| `available_time_start` | `'09:00'` | Store open time (HH:MM) |
| `available_time_end` | `'22:00'` | Store close time (HH:MM) |
| `dish_catalog` | — | JSON snapshot of dishes for customer app |

### `utils/normalizePhone.ts`

Shared utility — strips formatting and country code, returns last 10 digits. Use whenever storing or querying by phone number.

```typescript
normalizePhone("+91-98765-43210") // → "9876543210"
normalizePhone("09876543210")     // → "9876543210"
```

Used in: `customerProfileRepo.ts`, `customerController.ts` (`getCustomerOrders`).

---

## Architecture Patterns

### Repository Pattern

Every DB interaction goes through a repository. Never query the DB directly from a controller.

```typescript
// repositories/yourRepo.ts
import { getDb } from "../db";

function rowToApi(row: Record<string, unknown>) {
  return {
    _id: String(row["id"]),
    name: row["name"] as string,
    isActive: row["is_active"] !== 0,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}

export function findAll() {
  return (getDb().prepare("SELECT * FROM your_table ORDER BY id DESC").all() as Record<string, unknown>[])
    .map(rowToApi);
}

export function create(name: string) {
  const db = getDb();
  const result = db.prepare("INSERT INTO your_table (name) VALUES (?)").run(name);
  return findById(result.lastInsertRowid as number)!;
}

export function findById(id: number) {
  const row = getDb().prepare("SELECT * FROM your_table WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToApi(row) : null;
}
```

**Key conventions:**
- Column names are `snake_case` in SQL, converted to `camelCase` in `rowToApi`
- Boolean columns are `INTEGER (0/1)` — convert with `!== 0`
- JSON columns (`items`, `bills`, `variants`) are stored as TEXT strings — parse/stringify in the repo
- Always return camelCase from repositories; controllers never touch raw SQL rows

### Controller Pattern

```typescript
// controllers/yourController.ts
import { Request, Response, NextFunction } from "express";
import * as YourRepo from "../repositories/yourRepo";

export function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const data = YourRepo.findAll();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) {
      res.status(400).json({ success: false, message: "name is required" });
      return;
    }
    const data = YourRepo.create(name.trim());
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
```

**Key conventions:**
- Always wrap in `try/catch`, pass errors to `next(err)`
- Validate inputs inline; return early with `res.status(400).json(...)` then `return`
- Response shape: `{ success: boolean, data?: T, message?: string }`
- Use `createHttpError` from `http-errors` for standard HTTP errors (404, 403, etc.)

### Route Pattern

```typescript
// routes/yourRoute.ts
import { Router } from "express";
import { isVerifiedUser } from "../middlewares/tokenVerification";
import { getAll, create, remove } from "../controllers/yourController";

const router = Router();

router.get("/", getAll);                        // PUBLIC
router.post("/", isVerifiedUser, create);       // PROTECTED
router.delete("/:id", isVerifiedUser, remove);  // PROTECTED

export default router;
```

### Auth Middleware

`isVerifiedUser` reads the JWT from an HttpOnly cookie. On success it attaches decoded payload to `req.user`. Import type `CustomRequest` from `types/` if you need to access `req.user`.

```typescript
import { CustomRequest } from "../types";
export function myProtectedHandler(req: CustomRequest, res: Response, next: NextFunction) {
  const userId = (req.user as { id: string }).id;
}
```

### Error Handler

All unhandled errors flow to `globalErrorHandler` (registered last in `app.ts`). It reads `err.status` from `http-errors` shaped errors and responds with JSON.

---

## All API Routes

Routes are registered in `app.ts`. All paths are prefixed with `/api/`.

| Prefix | Route file | Notes |
|---|---|---|
| `/api/user` | `userRoute.ts` | Login, register, logout, get current user |
| `/api/order` | `orderRoute.ts` | Full CRUD for orders |
| `/api/table` | `tableRoute.ts` | Table CRUD, table status updates |
| `/api/payment` | `paymentRoute.ts` | Razorpay create-order, verify-payment, webhook |
| `/api/payment/phonepe` | `phonePeRoute.ts` | PhonePe initiate, callback, status |
| `/api/dishes` | `dishRoute.ts` | Dish CRUD, bulk add, seed defaults |
| `/api/earnings` | `earningRoute.ts` | Daily / period earnings |
| `/api/expenses` | `expenseRoutes.ts` | Expense CRUD |
| `/api/ledger` | `customerLedgerRoutes.ts` | Customer credit/debit ledger |
| `/api/consumables` | `consumableRoutes.ts` | Tea/gutka/cigarette tracking |
| `/api/staff` | `staffRoutes.ts` | Staff profiles and salary payments |
| `/api/data` | `dataRoutes.ts` | DB export/import (Excel) |
| `/api/updates` | `updateRoutes.ts` | App version checks |
| `/api/customer` | `customerRoute.ts` | Public endpoints for customer app (dishes, place order, SSE stream) |
| `/api/payment/phonepe` | `phonePeRoute.ts` | PhonePe payment flow |
| `/api/settings` | `settingsRoute.ts` | online-orders toggle, dish catalog snapshot |
| `/api/admin/notify` | `adminNotifyRoute.ts` | Push notifications to POS |
| `/api/online-config` | `onlineConfigRoute.ts` | Delivery areas CRUD + config flags (isOnline, deliveryEnabled, available hours) |

### `/api/online-config` Detail

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/flags` | Public | Returns `{ isOnline, deliveryEnabled, availableTimeStart, availableTimeEnd }` |
| PUT | `/flags` | Protected | Update any/all flags |
| GET | `/delivery-areas` | Public | Active areas (add `?all=true` for all including inactive) |
| POST | `/delivery-areas` | Protected | Add area `{ name }` |
| DELETE | `/delivery-areas/:id` | Protected | Remove area |
| PATCH | `/delivery-areas/:id` | Protected | Toggle `{ isActive: boolean }` |

### `/api/customer` Detail (Public — no auth)

| Method | Path | Description |
|---|---|---|
| GET | `/dishes` | Dishes with `is_online_available = 1` only |
| POST | `/order` | Place order (dine-in / takeaway / delivery) |
| GET | `/order/:id` | Order status (customer-safe subset of fields) |
| PATCH | `/order/:id/add-items` | Add more items to active order |
| GET | `/order/:id/stream` | SSE real-time order status (polls every 3s, closes after 10 min) |
| GET | `/profile/:phone` | Look up saved customer profile — returns `null` if not found (never 404) |
| POST | `/profile` | Upsert profile `{ phone, name, preferredArea? }` — increments `total_orders` counter |
| PATCH | `/profile/:phone` | Update `{ name?, preferredArea? }` |
| GET | `/orders/:phone` | Past orders for a phone number (strips internal fields) |

> **Phone normalisation** — all profile and order-by-phone endpoints call `normalizePhone()` before querying, so `+91-98765-43210` and `9876543210` resolve to the same record.

---

## How to Add a New Module

1. **Schema** — Add `CREATE TABLE IF NOT EXISTS ...` to `db/schema.ts`
2. **Migration** — Add idempotent migration block at the bottom of `runMigrations()` in `db/index.ts`
3. **Repository** — Create `repositories/yourRepo.ts` with `rowToApi`, CRUD functions
4. **Controller** — Create `controllers/yourController.ts`; import repo, handle req/res, call `next(err)` on error
5. **Route** — Create `routes/yourRoute.ts`; apply `isVerifiedUser` to protected endpoints
6. **Register** — Add `import + app.use("/api/your-module", yourRoute)` in `app.ts`

---

## Config (`config/config.ts`)

```typescript
const config = Object.freeze({
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET,
  frontendUrl: process.env.FRONTEND_URL,
  customerAppUrl: process.env.CUSTOMER_APP_URL,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  // ...
});
```

Env file: `.env` at `pos-backend/` root. `DATABASE_PATH` env var overrides the default `dhaba-pos.db` location.

---

## CORS

Allowed origins (hardcoded + env-configured):
- `config.frontendUrl`, `config.customerAppUrl`
- `*.trycloudflare.com` (quick tunnels)
- `*.sahu-dhaba-pos.co.in` (named tunnel)
- `http://localhost:8080`, `http://localhost:5173` (local dev)

---

## Cron Jobs

One job in `app.ts`: runs at `05:00 IST` daily, calls `calculateAndSaveDailyEarnings()` which computes and upserts into `daily_earnings`.

---

## New Repositories Added

| File | Purpose |
|---|---|
| `repositories/onlineConfigRepo.ts` | `getAllAreas`, `getActiveAreas`, `addArea`, `deleteArea`, `toggleArea`, `getFlags`, `setFlags` |
| `repositories/customerProfileRepo.ts` | `getProfile(phone)`, `upsertProfile({ phone, name, preferred_area? })`, `updateProfile(phone, updates)` |

## New Controllers Added

| File | Handles |
|---|---|
| `controllers/onlineConfigController.ts` | GET/PUT flags, GET/POST/DELETE/PATCH delivery areas |
| `controllers/customerProfileController.ts` | GET/POST/PATCH customer profile |
| `controllers/customerController.ts` | Added `getCustomerOrders(phone)` — queries `orderRepo.findAll({ customerPhone })` |
