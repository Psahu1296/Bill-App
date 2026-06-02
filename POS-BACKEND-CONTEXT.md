# POS Backend — Context & Code Guide

> **Root:** `pos-backend/`
> **Runtime:** Node.js + TypeScript (compiled/run via `tsx`)
> **Database:** MongoDB via Mongoose
> **Last updated:** 2026-06-02

---

## Tech Stack

| Concern | Library |
|---|---|
| HTTP framework | Express 4.x |
| Database | MongoDB via Mongoose 8.x |
| Auth | jsonwebtoken + cookie-parser (httpOnly cookie) |
| Password hashing | bcryptjs |
| Job scheduling | node-cron |
| Payments | Razorpay SDK + PhonePe (custom HTTP) |
| Push notifications | firebase-admin |
| Rate limiting | express-rate-limit |
| Error creation | http-errors |
| Date utilities | date-fns, date-fns-tz |
| Excel export | xlsx |
| File uploads | multer |
| TypeScript runner | tsx |

---

## Folder Structure

```
pos-backend/
├── app.ts                  # Express app setup, CORS, route registration
├── server.ts               # Entry point: MongoDB connect + app.listen
├── config/
│   └── config.ts           # Frozen config object from env vars
├── models/                 # Mongoose models (one file per domain)
├── controllers/            # Request handlers (business logic)
├── repositories/           # Data access layer (Mongoose queries)
├── routes/                 # Route definitions
├── middlewares/
│   ├── tokenVerification.ts   # JWT auth guard → sets req.user
│   └── globalErrorHandler.ts  # Catches next(err), returns JSON
├── types/
│   └── index.ts            # CustomRequest (extends Request with req.user)
└── utils/                  # Shared helpers
```

---

## Architecture Patterns

### Repository Pattern

Every DB interaction goes through a repository. Never query the DB directly from a controller.

```typescript
// repositories/yourRepo.ts
import { YourModel } from "../models";

export const findAll = () => YourModel.find().lean();

export const findById = (id: string) => YourModel.findById(id).lean();

export const create = (data: object) => YourModel.create(data);

export const update = (id: string, updates: object) =>
  YourModel.findByIdAndUpdate(id, updates, { new: true }).lean();
```

### Controller Pattern

```typescript
// controllers/yourController.ts
import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import * as yourRepo from "../repositories/yourRepo";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await yourRepo.findAll();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
```

**Key conventions:**
- Always `async/await`, always `try/catch`, always `next(error)` on failure
- Response shape: `{ success: boolean, data?: T, message?: string }`
- Use `createHttpError` from `http-errors` for 400/404/403 errors

### Auth Middleware

`isVerifiedUser` reads the JWT from an HttpOnly cookie `accessToken`. On success it attaches decoded payload to `req.user`. Import `CustomRequest` from `types/` to access `req.user`.

---

## All API Routes

Routes are registered in `app.ts`. All paths prefixed with `/api/`.

| Prefix | Route file | Notes |
|---|---|---|
| `/api/user` | `userRoute.ts` | Login, register, logout, get current user |
| `/api/order` | `orderRoute.ts` | Full CRUD for orders |
| `/api/table` | `tableRoute.ts` | Table CRUD, status updates |
| `/api/payment` | `paymentRoute.ts` | Razorpay create-order, verify-payment, webhook |
| `/api/payment/phonepe` | `phonePeRoute.ts` | PhonePe initiate, callback, status |
| `/api/dishes` | `dishRoute.ts` | Dish CRUD, bulk add, seed, voice-parse, top-revenue |
| `/api/earnings` | `earningRoute.ts` | Daily/period/dashboard earnings, chart data, range |
| `/api/expenses` | `expenseRoutes.ts` | Expense CRUD + summary by period |
| `/api/expense-presets` | `expensePresetRoutes.ts` | Preset categories with variant piece maps |
| `/api/inventory` | `inventoryRoutes.ts` | Stock cycles, consumption rates, predictions |
| `/api/ledger` | `customerLedgerRoutes.ts` | Customer credit/debit ledger |
| `/api/consumables` | `consumableRoutes.ts` | Tea/gutka/cigarette tracking |
| `/api/staff` | `staffRoutes.ts` | Staff profiles and salary payments |
| `/api/data` | `dataRoutes.ts` | DB export/import (Excel) |
| `/api/updates` | `updateRoutes.ts` | App version checks (GitHub Releases proxy) |
| `/api/customer` | `customerRoute.ts` | Public endpoints for customer app |
| `/api/settings` | `settingsRoute.ts` | Online-orders toggle, dish catalog snapshot |
| `/api/admin/notify` | `adminNotifyRoute.ts` | SSE push notifications to POS |
| `/api/online-config` | `onlineConfigRoute.ts` | Delivery areas + config flags |
| `/api/requests` | `requestRoutes.ts` | Pre-orders and dish requests from customer app |
| `/api/profiles` | `profilesRoute.ts` | Customer profiles |
| `/api/reminders` | `reminderRoute.ts` | Automated push reminders |
| `/api/daily-summary` | `dailySummaryRoutes.ts` | Per-day analytics summary + range |
| `/api/migration` | `migrationRoutes.ts` | DB migration tools |

### Key `/api/dishes` endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/` | All dishes; supports `?type=&category=&search=&minPrice=&maxPrice=` |
| POST | `/` | Create dish |
| PUT | `/:id` | Update dish |
| DELETE | `/:id` | Delete dish |
| GET | `/frequent` | Most ordered dishes |
| GET | `/top-revenue` | Top dishes by revenue; supports `?limit=&from=&to=` |
| POST | `/bulk` | Bulk create |
| POST | `/seed` | Seed default menu |
| POST | `/voice-parse` | Transcribe audio → structured cart items (Sarvam STT) |

### Key `/api/earnings` endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard` | Daily/weekly/monthly/yearly totals with % change |
| GET | `/chart` | Bucketed income + expenses + orders; `?period=day\|week\|month\|year` |
| GET | `/range` | Revenue per day from DailyEarning collection; `?from=&to=` |
| GET | `/daywise` | Today vs yesterday |
| GET | `/:periodType` | Period totals array |

### Key `/api/daily-summary` endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/range` | Array of daily summaries (max 90 days); `?from=&to=` |
| GET | `/:date` | Full day picture: revenue, orders, payment split, top items, peak hour, expenses, consumables |

### `/api/online-config` endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/flags` | Public | `{ isOnline, deliveryEnabled, availableTimeStart, availableTimeEnd }` |
| PUT | `/flags` | Protected | Update any/all flags |
| GET | `/delivery-areas` | Public | Active areas (`?all=true` for all) |
| POST | `/delivery-areas` | Protected | Add area `{ name }` |
| DELETE | `/delivery-areas/:id` | Protected | Remove area |
| PATCH | `/delivery-areas/:id` | Protected | Toggle `{ isActive: boolean }` |

### `/api/customer` endpoints (Public — no auth)

| Method | Path | Notes |
|---|---|---|
| GET | `/dishes` | Online-available dishes only |
| POST | `/order` | Place order (dine-in / takeaway / delivery) |
| GET | `/order/:id` | Order status (customer-safe subset) |
| PATCH | `/order/:id/add-items` | Add more items to active dine-in order |
| GET | `/order/:id/stream` | SSE real-time order status |
| GET | `/profile/:phone` | Customer profile (never 404 — returns null if missing) |
| POST | `/profile` | Upsert profile |
| PATCH | `/profile/:phone` | Update name/area |
| GET | `/orders/:phone` | Past orders by phone |

---

## Mongoose Models

| Model | Key Fields |
|---|---|
| `User` | `name`, `email` (unique), `phone`, `password` (hashed), `role` |
| `Table` | `tableNo` (unique), `status` (Available/Booked), `seats`, `isVirtual`, `currentOrderId` |
| `Dish` | `name`, `type`, `category`, `variants[]`, `isAvailable`, `isFrequent`, `isOnlineAvailable`, `rawMaterial`, `numberOfOrders` |
| `Order` | `items[]`, `bills`, `orderStatus`, `paymentStatus`, `paymentMethod`, `amountPaid`, `table`, `orderType`, `customerDetails` |
| `Expense` | `type`, `name`, `amount`, `quantity`, `unit`, `expenseDate` |
| `ExpensePreset` | `name`, `category`, `type`, `variantPieceMap`, `lastPrice`, `priceHistory` |
| `StockCycle` | `rawMaterial`, `quantityKg`, `expense` (ref), `startDate`, `endDate`, `unitsConsumed`, `isEarlyRestock` |
| `DailyEarning` | `date` (unique), `totalEarnings`, `percentageChangeFromYesterday` |
| `CustomerLedger` | `customerPhone` (unique), `customerName`, `balanceDue`, `transactions[]` |
| `Consumable` | `type`, `quantity`, `pricePerUnit`, `consumerType`, `orderId` |
| `Staff` | `name`, `phone`, `role`, `monthlySalary`, `isActive`, `payments[]` |
| `PreOrder` | `customerName`, `customerPhone`, `scheduledFor`, `items[]`, `status`, `estimatedTotal`, `depositPaid` |
| `DishRequest` | `customerName`, `customerPhone`, `dishName`, `status` |
| `DeliveryArea` | `name`, `isActive` |
| `CustomerProfile` | `phone`, `name`, `preferredArea`, `totalOrders` |

---

## Config (`config/config.ts`)

```typescript
const config = Object.freeze({
  port: process.env.PORT || 5001,
  mongodbUri: process.env.MONGODB_URI,   // required
  jwtSecret: process.env.JWT_SECRET,
  frontendUrl: process.env.FRONTEND_URL,
  customerAppUrl: process.env.CUSTOMER_APP_URL,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  phonePeEnv: process.env.PHONEPE_ENV || "UAT",
  sarvamApiKey: process.env.SARVAM_API_KEY,   // voice-parse
});
```

---

## CORS

Allowed origins:
- `config.frontendUrl`, `config.customerAppUrl`
- `*.trycloudflare.com` (quick tunnels)
- `*.sahu-dhaba-pos.co.in` (named tunnel)
- `http://localhost:8080`, `http://localhost:5173`, `http://localhost:5174` (local dev)
- Electron `file://` and `app://`

---

## Cron Jobs

| Job | Schedule | What it does |
|---|---|---|
| Daily earnings | 00:05 IST | `calculateAndSaveDailyEarnings()` — upserts into `DailyEarning` |
| Reminders | Configurable | Push notifications for scheduled reminders |

---

## How to Add a New Module

1. **Model** — Create `models/yourModel.ts` with Mongoose schema
2. **Repository** — Create `repositories/yourRepo.ts` — Mongoose queries only
3. **Controller** — Create `controllers/yourController.ts` — handle req/res, call `next(error)` on failure
4. **Route** — Create `routes/yourRoute.ts` — apply `isVerifiedUser` to protected endpoints
5. **Register** — Add `import + app.use("/api/your-module", yourRoute)` in `app.ts`
