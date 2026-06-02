# Dhaba POS — Project Reference

> Complete context document for both frontend and backend. Use this in every conversation about this project.

---

## Overview

**Product:** Dhaba POS — Point-of-Sale desktop application for Indian dhabas/restaurants
**App ID:** `com.dhaba.pos` | **Publisher:** Psahu1296
**Architecture:** Electron desktop shell → embedded Express backend → React SPA
**Database:** MongoDB (Mongoose) - App has fully migrated from SQLite to MongoDB.
**Platforms:** Windows, macOS (x64 + arm64), Linux

```
Bill-App/
├── pos-backend/          Express REST API + Mongoose Models
├── pos-frontend/         React 18 SPA (Vite)
├── electron/             Electron main process
├── electron-builder.yml  Desktop packaging config
└── package.json          Monorepo build scripts
```

---

## Monorepo Scripts

| Script | Purpose |
|---|---|
| `electron:dev` | Run Electron in dev mode |
| `build` | Compile all three parts |
| `dist:win` / `dist:mac` / `dist:linux` | Build platform installers |
| `test:health` | Smoke test against running backend |

**Packaging:** Frontend + Electron main → `app.asar`.
**Auto-update:** GitHub Releases via `electron-updater`. Backend proxies `GET /api/updates/releases` to avoid rate limits.

---

## Backend (`pos-backend`)

### Tech Stack

| Package | Purpose |
|---|---|
| Express 4.21 | HTTP framework |
| Mongoose 8.9 | MongoDB Object Modeling |
| jsonwebtoken 9.0.3 | JWT auth (httpOnly cookie) |
| bcryptjs 3.0.2 | Password hashing |
| Razorpay 2.9.5 | Online payments |
| node-cron | Daily earnings job (00:05 IST) & Reminders |
| date-fns-tz | Timezone handling (Asia/Kolkata) |
| xlsx | Excel export |
| tsx | TypeScript executor |
| multer | File uploads |
| firebase-admin | Push Notifications / Firebase Auth |

### Environment Variables

```env
PORT=5001
MONGODB_URI=mongodb+srv://...  # Required for MongoDB connection
JWT_SECRET=your_secret
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
FRONTEND_URL=http://localhost:5173
CUSTOMER_APP_URL=http://localhost:5174
PHONEPE_ENV=UAT               # PhonePe Environment integration
NODE_ENV=development
GH_TOKEN=                     # optional, for GitHub releases proxy
```

### MongoDB Schema (Mongoose Models)

All timestamps in ISO 8601. Mongoose automatically handles `createdAt` and `updatedAt`.

#### `User`
- `name`, `email` (unique), `phone`, `password` (bcrypt hashed), `role` (admin/staff)

#### `Table`
- `tableNo` (unique), `status` (Available/Booked), `seats`, `isVirtual` (for takeaway), `currentOrderId` (ObjectId ref Order)

#### `Dish`
- `name` (unique), `type` (veg/non-veg), `category`, `image`
- `variants`: `[{size, price}]`
- `description`, `descriptionHi` (Hindi)
- `isAvailable`, `isFrequent`, `isOnlineAvailable`, `isPreorder`
- `numberOfOrders`

#### `Order`
- `customerDetails`: `{name, phone, guests}`
- `items`: `[{id, name, variantSize, quantity, price, pricePerQuantity}]`
- `bills`: `{subtotal, discount, tax, roundoff, totalWithTax}`
- `orderStatus`: Pending / In Progress / Ready / Completed / Cancelled
- `paymentStatus`: Pending / Paid / Refunded
- `paymentMethod`: Cash / Online
- `amountPaid`, `balanceDueOnOrder`
- `table` (ObjectId ref Table)
- `orderType`: dine-in / takeaway / delivery
- `deliveryAddress`, `idempotencyKey`
- `paymentData`

#### `Payment`
- `paymentId`, `orderId`, `amount`, `currency`, `status`, `method`, `email`, `contact`

#### `Expense` & `ExpensePreset`
- `Expense`: `type`, `name`, `amount`, `quantity`, `unit`, `description`, `expenseDate`
- `ExpensePreset`: `name`, `category`, `type`, `lastPrice`, `priceHistory`, `isActive`

#### `DailyEarning`
- `date` (unique), `totalEarnings`, `percentageChangeFromYesterday`

#### `CustomerLedger`
- `customerPhone` (unique), `customerName`, `balanceDue`, `lastActivity`
- `transactions`: Embedded array `[{orderId, transactionType, amount, timestamp, notes}]`

#### `Consumable`
- `type`, `quantity`, `pricePerUnit`, `consumerType`, `consumerName`, `orderId` (ObjectId ref Order)

#### `Staff`
- `name`, `phone`, `role`, `monthlySalary`, `joinDate`, `isActive`
- `payments`: Embedded array `[{amount, type, note, date}]`

#### `PreOrder` & `DishRequest`
- `PreOrder`: `customerName`, `customerPhone`, `scheduledFor`, `items`, `guestCount`, `orderType`, `status`, `estimatedTotal`, `depositAmount`, `depositPaid`
- `DishRequest`: `customerName`, `customerPhone`, `dishName`, `description`, `status`

#### `DeliveryArea` & `CustomerProfile` & `CustomerOtpSession`
- Stores delivery configurations, profiles, and OTP data for online ordering app integration.

### API Endpoints

Most routes require a JWT cookie (`accessToken`).

#### Auth & Users
- `POST /api/user/register`
- `POST /api/user/login`
- `GET  /api/user` (current user)

#### POS Core
- `POST /api/order` | `GET /api/order` | `PUT /api/order/:id`
- `POST /api/table` | `GET /api/table` | `PUT /api/table/:id`
- `POST /api/dishes` | `GET /api/dishes` | `PUT /api/dishes/:id`

#### Online Config & Customer Requests
- `/api/online-config`: Online ordering configurations.
- `/api/requests`: Dish requests and pre-order management.
- `/api/customer`: Customer details & CRM.
- `/api/profiles` & `/api/reminders`: Profiles & automated push reminders.

#### Analytics
- `/api/daily-summary/:date`: Full day picture — revenue, orders, payment split, top items, peak hour, consumables.
- `/api/daily-summary/range?from=&to=`: Array of daily summaries (max 90 days).
- `/api/earnings/chart?period=`: Bucketed income/expenses/orders (hourly/daily/monthly).
- `/api/earnings/range?from=&to=`: Revenue per day from pre-computed DailyEarning collection.
- `/api/dishes/top-revenue?limit=&from=&to=`: Top dishes ranked by revenue via aggregation.

#### Finance & Operations
- `/api/earnings`: Daily/dashboard/period earning summaries.
- `/api/expenses` & `/api/expense-presets`: Expense tracking with preset categories and variant piece maps.
- `/api/inventory`: Raw material stock cycles, consumption rates, restock predictions.
- `/api/ledger`: Customer credit (Khata) tracking.
- `/api/consumables`: Logging internal consumption (tea, gutka, cigarette).
- `/api/staff`: Employee management and payments.

#### Payments
- `/api/payment` & `/api/payment/phonepe`: Razorpay and PhonePe integrations.

#### Others
- `/api/data`: Data exports (Excel) and management.
- `/api/migration`: Tools to migrate from old DB schemas.
- `/api/updates`: GitHub releases proxy for Electron OTA updates.
- `/api/admin/notify`: Server-Sent Events (SSE) for real-time admin notifications.

---

## Frontend (`pos-frontend`)

### Tech Stack

| Package | Purpose |
|---|---|
| React 18.3.1 | UI framework |
| React Router 7.1.3 | SPA routing |
| Redux Toolkit 2.5.0 | Global state (user, cart, customer) |
| TanStack Query 5.66.0 | Server state / caching / mutations |
| Axios 1.7.9 | HTTP client (withCredentials: true) |
| Tailwind CSS 3.4.17 | Styling & Design System |
| Framer Motion 11.18 | Animations |
| Notistack 3.0 | Toast notifications |
| React Hook Form 7.57 | Form handling |
| Recharts 3.8 | Charts (area, bar, pie) |
| Vite 6.0.5 | Build tool |

### Redux Store

```typescript
store = {
  user:     { _id, name, email, phone, role, isAuth }
  customer: { orderId, customerName, customerPhone, guests, table: { tableId, tableNo } }
  cart:     CartItem[]
}
```

### Pages & Routes

| Route | Component | Key Features |
|---|---|---|
| `/auth` | `Auth` | Login + Register |
| `/` | `Home` | Dashboard: recent orders, KPIs, quick consumable log |
| `/menu` | `Menu` | POS: browse dishes (voice order), cart, bill, Pay modal |
| `/orders` | `Orders` | Order list with date/status filters, pay remaining balance |
| `/tables` | `Tables` | Table grid, status, add tables |
| `/customers` | `Customers` | CRM, ledger and balances |
| `/customers/:phone` | `CustomerDetail` | Customer order history and khata |
| `/consumables` | `Consumables` | Log internal tea/gutka/cigarettes |
| `/staff` | `Staff` | Employee CRUD, salary payments |
| `/expenses` | `Expenses` | Expense tracking, filtering, summary dashboard |
| `/dashboard` | `Dashboard` | Analytics with period selector and custom date range |
| `/dashboard/dishes` | `DishesPage` | Full dish CRUD |
| `/requests` | `Requests` | Pre-orders and customer dish requests |
| `/online-config` | `OnlineConfig` | Delivery areas, online ordering flags |
| `/inventory` | `Inventory` | Raw material stock cycles, consumption rates, predictions |
| `/server-status` | `ServerStatus` | MongoDB connection health |
| `/app-update` | `AppUpdate` | GitHub releases, version info |

*(All routes except `/auth` are protected)*

### Design System (Tailwind)

Premium "Sovereign Parlor" & Dhaba Aesthetic CSS variables in `index.css`:
- `dhaba-bg`: Page background
- `dhaba-surface` / `dhaba-card`: Glassmorphic Cards & panels
- `dhaba-accent`: Primary CTA (Amber/Gold)
- `dhaba-success` / `dhaba-danger` / `dhaba-warning`
- Custom utility classes: `.glass-card`, `.glass-input`, `.shadow-glow`

### Real-Time Updates
Admin notifications and alerts are pushed from backend to frontend using Server-Sent Events (SSE) via the `/api/admin/notify` endpoint, mounted globally in `App.tsx`.

### Security

- **Auth**: JWT in `httpOnly` cookie (`accessToken`).
- **Passwords**: bcryptjs.
- **Rate limiting**: Global rate limiter + strict limits on Login/Register.
- **CORS**: Restricted to `FRONTEND_URL`, `CUSTOMER_APP_URL`, and Electron `file://` or `app://`.
- **Payment Verification**: Razorpay and PhonePe webhooks securely verified using server-side SDKs and hashes.
