# Dhaba POS — Project Reference

> Complete context document for both frontend and backend. Use this in every conversation about this project.

---

## Overview

**Product:** Dhaba POS — Point-of-Sale desktop application for Indian dhabas/restaurants
**App ID:** `com.dhaba.pos` | **Publisher:** Psahu1296
**Architecture:** Electron desktop shell → embedded Express backend → React SPA
**Database:** SQLite (offline-first, no internet required)
**Platforms:** Windows, macOS (x64 + arm64), Linux

```
Bill-App/
├── pos-backend/          Express REST API + SQLite
├── pos-frontend/         React 18 SPA (Vite)
├── electron/             Electron main process
├── electron-builder.yml  Desktop packaging config
├── docker-compose.yml    Legacy (MongoDB, not in use)
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

**Packaging:** Frontend + Electron main → `app.asar`. Backend → `extraResources/backend/` (outside asar so SQLite native bindings work).
**Auto-update:** GitHub Releases via `electron-updater`. Backend proxies `GET /api/updates/releases` to avoid rate limits.

---

## Backend (`pos-backend`)

### Tech Stack

| Package | Purpose |
|---|---|
| Express 4.21 | HTTP framework |
| better-sqlite3 3.12.8 | SQLite (synchronous, offline) |
| jsonwebtoken 9.0.3 | JWT auth (httpOnly cookie) |
| bcryptjs 3.0.2 | Password hashing |
| Razorpay 2.9.5 | Online payments |
| node-cron | Daily earnings job (00:05 IST) |
| date-fns-tz | Timezone handling (Asia/Kolkata) |
| xlsx | Excel export |
| tsx | TypeScript executor |

### Environment Variables

```env
PORT=5002
JWT_SECRET=your_secret
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
FRONTEND_URL=http://localhost:5173
DATABASE_PATH=           # optional, custom SQLite path
FRONTEND_DIST_PATH=      # optional, custom static files path
NODE_ENV=development
GH_TOKEN=                # optional, for GitHub releases proxy
```

### SQLite Schema

All timestamps in ISO 8601. JSON columns stored as serialized strings, parsed on read.

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| name | TEXT | |
| email | TEXT UNIQUE | |
| phone | TEXT | |
| password | TEXT | bcrypt hashed |
| role | TEXT | admin / staff |
| created_at / updated_at | TEXT | |

#### `tables_tb`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| table_no | INTEGER UNIQUE | |
| status | TEXT | Available / Booked |
| seats | INTEGER | |
| current_order_id | TEXT FK → orders | nullable |

#### `dishes`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| name | TEXT UNIQUE | |
| type | TEXT | veg / non-veg |
| category | TEXT | roti / rice / sabji / drinks / etc. |
| image | TEXT | URL or empty |
| variants | JSON | `[{size, price}]` |
| description | TEXT | |
| is_available | INTEGER | 0 / 1 |
| is_frequent | INTEGER | 0 / 1 |
| number_of_orders | INTEGER | incremented on order |

#### `orders`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| customer_details | JSON | `{name, phone, guests}` |
| items | JSON | `[{id, name, variantSize, quantity, price, pricePerQuantity}]` |
| bills | JSON | `{subtotal, discount, tax, roundoff, totalWithTax}` |
| order_status | TEXT | In Progress / Ready / Completed / Cancelled |
| payment_status | TEXT | Pending / Paid / Refunded |
| payment_method | TEXT | Cash / Online |
| amount_paid | REAL | Can exceed totalWithTax (overpay = credit) |
| balance_due_on_order | REAL | Remaining at time of last update |
| table_id | TEXT FK → tables_tb | |
| payment_data | JSON | Razorpay data if online |
| created_at / updated_at | TEXT | |

#### `payments`
| Column | Notes |
|---|---|
| payment_id | Razorpay payment ID |
| order_id | Internal order ID |
| amount, currency, status, method | Razorpay fields |

#### `expenses`
| Column | Notes |
|---|---|
| type | Category string |
| name | Description |
| amount | REAL |
| expense_date | DATE string |

#### `daily_earnings`
| Column | Notes |
|---|---|
| date | TEXT UNIQUE (YYYY-MM-DD) |
| total_earnings | REAL |
| percentage_change_from_yesterday | REAL |

#### `customer_ledger`
| Column | Notes |
|---|---|
| customer_phone | TEXT UNIQUE |
| customer_name | TEXT |
| balance_due | REAL — total outstanding |
| last_activity | TEXT timestamp |

#### `customer_ledger_transactions`
| Column | Notes |
|---|---|
| ledger_id | FK → customer_ledger |
| order_id | FK → orders (nullable) |
| transaction_type | balance_increased / balance_decreased / payment_received |
| amount | REAL |
| notes | TEXT |
| timestamp | TEXT |

#### `consumables`
| Column | Notes |
|---|---|
| type | tea / cigarette / gutka / other |
| quantity | REAL |
| price_per_unit | REAL |
| consumer_type | customer / staff / owner |
| consumer_name | TEXT |
| order_id | FK → orders (nullable, auto-linked) |
| timestamp | TEXT IST |

#### `staff`
| Column | Notes |
|---|---|
| name, phone | TEXT |
| role | TEXT |
| monthly_salary | REAL |
| join_date | TEXT |
| is_active | INTEGER 0/1 |

#### `staff_payments`
| Column | Notes |
|---|---|
| staff_id | FK → staff |
| amount | REAL |
| type | salary / bonus / advance |
| date | TEXT |
| note | TEXT |

### Key Business Logic

**Consumable auto-sync:** When an order is created/updated, `orderController` scans item names for keywords (`chai`, `tea`, `cigarette`, `gutka`) and auto-creates consumable records. Existing consumable records for the order are deleted and recreated on update.

**Overpay / Pay Later:**
- `amount_paid` can be 0 (pay later → `paymentStatus: Pending`) or greater than `totalWithTax` (overpay → credit stored as `amountPaid - totalWithTax`)
- `balance_due_on_order` = `totalWithTax - amountPaid` (can be negative for credit)

**Daily earnings cron:** Runs at `00:05 Asia/Kolkata`. Sums all `paymentStatus = Paid` orders for the day, calculates % change vs previous day, upserts `daily_earnings`.

**Customer Ledger:** Auto-updated when an order has `paymentStatus: Pending`. Separate `ledger_transactions` table tracks every debit/credit event for audit trail.

### API Endpoints

All routes except `/health`, `/api/user/login`, `/api/user/register`, `/api/payment/webhook-verification`, and `/api/updates/releases` require JWT cookie (`accessToken`).

#### Auth — rate limited
```
POST /api/user/register       5 req/hour
POST /api/user/login          10 req/15min
GET  /api/user                [Auth] current user
POST /api/user/logout         [Auth]
```

#### Orders
```
POST /api/order                        create order
GET  /api/order                        list (filters: startDate, endDate, tableId, customerPhone, orderStatus, paymentStatus)
GET  /api/order/:id                    single order
PUT  /api/order/:id                    update (status, payment, amountPaid, etc.)
```

#### Tables
```
POST /api/table                        add table
GET  /api/table                        list all
PUT  /api/table/:id                    update status / currentOrderId
```

#### Dishes
```
POST /api/dishes                       add dish
GET  /api/dishes                       list all
GET  /api/dishes/frequent              popular dishes (query: limit, minOrders)
POST /api/dishes/bulk                  batch create
POST /api/dishes/seed                  seed default menu
PUT  /api/dishes/:id                   update
DELETE /api/dishes/:id                 delete
```

#### Payments (Razorpay)
```
POST /api/payment/create-order         create Razorpay order
POST /api/payment/verify-payment       verify signature, record payment
POST /api/payment/webhook-verification Razorpay webhook (no auth, raw body)
```

#### Earnings
```
GET /api/earnings/daywise              today vs yesterday
GET /api/earnings/dashboard            dashboard KPI summary
GET /api/earnings/:periodType          day/week/month/year (query: numPeriods)
POST /api/earnings/calculate-daily     manual trigger
```

#### Expenses
```
POST   /api/expenses                   add
GET    /api/expenses                   list (query: from, to, type)
GET    /api/expenses/summary/:period   period summary
PUT    /api/expenses/:id               update
DELETE /api/expenses/:id               delete
```

#### Customer Ledger
```
GET  /api/ledger/all                   all ledger accounts (query: status)
GET  /api/ledger/:phone                single customer ledger
POST /api/ledger/:phone/pay            record payment (reduces balance)
POST /api/ledger/:phone/add-debt       add debt entry
```

#### Consumables
```
POST   /api/consumables                log item
GET    /api/consumables                list (query: from, to, type)
GET    /api/consumables/summary/day    daily summary by type (query: date)
PUT    /api/consumables/:id            update
DELETE /api/consumables/:id            delete
```

#### Staff
```
GET    /api/staff                              list (query: active)
POST   /api/staff                              add
PUT    /api/staff/:id                          update
DELETE /api/staff/:id                          delete
PATCH  /api/staff/:id/toggle-active            toggle active
POST   /api/staff/:id/payments                 record payment
DELETE /api/staff/:id/payments/:paymentId      delete payment
```

#### Data Management
```
GET    /api/data/stats                  record counts
GET    /api/data/export?format=excel    export all data
DELETE /api/data/delete                 bulk delete (query: entityType, ids)
POST   /api/data/reset                  reset DB (dev only)
```

#### Updates
```
GET /api/updates/releases               proxy GitHub Releases API
```

#### Static
```
GET * (non-API)   serve React index.html for SPA routing
```

### Layer Architecture

```
Route → Middleware (tokenVerification) → Controller → Repository → SQLite
                                      ↓
                              globalErrorHandler
```

Repositories use prepared statements. `rowToApi()` converts snake_case DB rows + JSON strings → camelCase JS objects.

---

## Frontend (`pos-frontend`)

### Tech Stack

| Package | Purpose |
|---|---|
| React 18.3.1 | UI framework |
| React Router 7.1.3 | SPA routing |
| Redux Toolkit 2.5.0 | Global state |
| TanStack Query 5.66.0 | Server state / caching |
| Axios 1.7.9 | HTTP client (withCredentials: true) |
| Tailwind CSS 3.4.17 | Styling |
| Framer Motion | Animations |
| Notistack | Toast notifications |
| React Hook Form 7.57.0 | Form handling |
| react-image | Lazy image loading with fallback |
| react-icons | Icon library |
| Vite 6.0.5 | Build tool |

### Design System (Tailwind)

CSS variables defined in `index.css`, consumed via Tailwind config:

| Token | HSL Value | Usage |
|---|---|---|
| `dhaba-bg` | `15 12% 7%` | Page background |
| `dhaba-surface` | `20 10% 12%` | Cards, panels |
| `dhaba-card` | `18 10% 14%` | Inner cards |
| `dhaba-surface-hover` | `20 10% 16%` | Hover states |
| `dhaba-accent` | amber/gold | Primary CTA, highlights |
| `dhaba-success` | green | Paid, available, veg |
| `dhaba-danger` | red | Error, non-veg, outstanding |
| `dhaba-warning` | yellow-orange | Pending, partial |
| `dhaba-muted` | dim text | Labels, secondary text |
| `dhaba-text` | near-white | Primary text |
| `dhaba-border` | subtle | Dividers |

**Custom classes:** `glass-card` (backdrop-blur surface), `glass-input` (form inputs), `bg-gradient-warm` (amber gradient CTA), `shadow-glow` (glow effect), `font-display` (heading font).

### Redux Store

```typescript
store = {
  user:     { _id, name, email, phone, role, isAuth }
  customer: { orderId, customerName, customerPhone, guests, table: { tableId, tableNo } }
  cart:     CartItem[]  // CartItem = { id, name, variantSize, pricePerQuantity, quantity, price }
}
```

**Key actions:**
- `setUser / removeUser` — login/logout
- `setCustomer / removeCustomer / updateTable` — current order context
- `addItems` — upsert to cart (merges quantity if same id+variant)
- `updateItem / removeItem / removeAllItems / updateList`
- Selector: `getTotalPrice(state)` — sum of cart prices

### Pages & Routes

| Route | Page | Key Features |
|---|---|---|
| `/auth` | Auth | Login + Register |
| `/` | Home | Dashboard: popular dishes, recent orders, KPIs, quick consumable log |
| `/menu` | Menu | POS: browse dishes, cart, customer info, bill, Pay modal |
| `/orders` | Orders | Order list with status filters, pay remaining balance |
| `/tables` | Tables | Table grid, status, add tables |
| `/dashboard` | Dashboard | Revenue metrics, add dish, add expense |
| `/dashboard/dishes` | DishesPage | Full dish CRUD, bulk add, seed default menu |
| `/ledger` | Ledger | Customer credit tracking, settle orders, record payment |
| `/consumables` | Consumables | Log tea/cigarettes/gutka, daily summary |
| `/staff` | Staff | Employee CRUD, salary payments |
| `/order-summary` | OrderSummary | Print invoice for completed order |
| `/data-management` | DataManagement | Export Excel, bulk delete, reset DB |
| `/app-update` | AppUpdate | Check GitHub releases, version info |

All routes except `/auth` wrapped in `ProtectedRoutes` (redirects to `/auth` if not logged in).

### Component Map

```
components/
├── auth/
│   ├── Login.tsx
│   └── Register.tsx
├── shared/
│   ├── Header.tsx             top nav, user menu
│   ├── BottomNav.tsx          mobile tab bar
│   ├── Modal.tsx              generic modal wrapper
│   ├── FullScreenLoader.tsx
│   └── BackButton.tsx
├── home/
│   ├── Greetings.tsx
│   ├── PopularDishes.tsx      frequent dishes carousel, seed default menu CTA
│   ├── RecentOrders.tsx
│   ├── MiniCard.tsx           KPI widget
│   ├── OrderList.tsx
│   ├── NewOrderModal.tsx
│   └── QuickConsumableModal.tsx
├── menu/
│   ├── MenuContainer.tsx      category tabs + item grid
│   ├── MenuItem.tsx           dish card — image bg, variant pills, counter, add to cart
│   ├── CustomerInfo.tsx       name / phone / guests input
│   ├── CustomerAutocomplete.tsx  autocomplete past customers
│   ├── CartInfo.tsx           cart items, quantity controls
│   ├── Bill.tsx               subtotal, discount, tax, roundoff, total — triggers PayModal
│   └── PayModal.tsx           Cash / Online, Pay Later (₹0), overpay → credit
├── orders/
│   ├── OrderCard.tsx          status badge, pay button, navigate to summary
│   └── PayRemainingModal.tsx  partial payment, Pay Later, overpay
├── tables/
│   └── TableCard.tsx
├── dashboard/
│   ├── Metrics.tsx            earnings, customers, orders cards
│   ├── AddDishModal.tsx
│   ├── AddExpenseModal.tsx
│   └── RecentOrders.tsx
├── dishes/
│   ├── Dishes.tsx
│   ├── DishesCard.tsx         dish card with image, edit/delete
│   └── BulkAddDishModal.tsx
├── customerLedger/
│   ├── CustomerLedgerList.tsx  balances, transaction history
│   ├── PaymentModal.tsx        record payment against ledger
│   └── SettleOrdersModal.tsx   settle specific orders, supports overpay → credit
└── invoice/
    ├── Invoice.tsx
    └── BillTemplate.tsx        print-friendly bill layout
```

### Payment Flow

**Cash / Pay Later / Overpay** (handled in `PayModal`, `PayRemainingModal`, `SettleOrdersModal`):
- `paying = 0` → Pay Later → `paymentStatus: Pending`, full amount goes to ledger
- `0 < paying < outstanding` → Partial → `paymentStatus: Pending`, remainder goes to ledger
- `paying >= outstanding` → Full → `paymentStatus: Paid`
- `paying > outstanding` → Overpay → `paymentStatus: Paid`, excess = `amountPaid - totalWithTax` stored as credit on the order. In `SettleOrdersModal`, excess is applied to the most recent order.

**Online (Razorpay):**
1. Frontend calls `createOrderRazorpay(amount)` → gets Razorpay order ID
2. Razorpay SDK opens payment sheet
3. On success: `verifyPaymentRazorpay(orderId, paymentId, signature)` → backend verifies HMAC, records payment

### HTTP Layer (`src/https/index.ts`)

Axios instance: `baseURL: ""`, `withCredentials: true` (cookies).

All functions listed in the Backend API section above have corresponding frontend wrappers. Naming convention: same name, camelCase, returns Axios promise.

Special: `updateOrderStatus({ orderId, orderStatus, paymentStatus })` — lightweight status-only update that avoids rebaking bills.

### Types (`src/types/index.ts`)

```typescript
type OrderStatus   = 'In Progress' | 'Ready' | 'Completed' | 'Cancelled'
type PaymentStatus = 'Pending' | 'Paid' | 'Refunded'
type PaymentMethod = 'Cash' | 'Online'

interface Dish {
  _id: string; name: string; image?: string; type: 'veg'|'non-veg';
  category: string; variants: DishVariant[]; description?: string;
  isAvailable: boolean; isFrequent: boolean; numberOfOrders: number;
}
interface DishVariant { size: string; price: number; }

interface Order {
  _id: string;
  customerDetails: { name: string; phone: string; guests: number };
  table: Table;
  items: CartItem[];
  bills: { subtotal: number; discount: number; tax: number; roundoff: number; totalWithTax: number; };
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  balanceDueOnOrder: number;
  orderDate: string;
  paymentData?: object;
}

interface CustomerLedger {
  _id: string; customerName: string; customerPhone: string;
  balanceDue: number; lastActivity: string;
  transactions: LedgerTransaction[];
}
interface LedgerTransaction {
  transactionType: 'balance_increased'|'balance_decreased'|'payment_received';
  amount: number; orderId?: string; notes?: string; timestamp: string;
}
```

### Utilities (`src/utils/index.ts`)

```typescript
getDishImage(name: string, remoteImage?: string): string | undefined
// Priority: remoteImage → LOCAL_DISH_IMAGES[name] (exact) → case-insensitive fuzzy match

getBgColor(): string          // random from 10-color palette
getAvatarName(name): string   // "Param Sahu" → "PS"
formatDate(date): string      // "March 22, 2026"
formatDateAndTime(date): string // full IST datetime string
```

**`LOCAL_DISH_IMAGES`** — 30+ dish names mapped to local asset imports from `assets/images/`:
- Chai, Jeera Rice, Plain Rice, Dal Fry, Dal Tadka, Mix Veg, Lassi, Sweet Lassi
- Mutton Biryani, Chicken Biryani, Veg Biryani, Veg/Chicken Fried Rice
- Paneer Butter Masala, Shahi Paneer, Matar Paneer, Paneer Chilly, Paneer Masala
- Roti, Butter Roti, Tandoori Roti
- Aloo Gobi, Gobhi Matar, Aloo Matar
- Egg Bhurji, Egg Curry, Fish Curry, Chicken Roast
- Rajma Chawal, Masala Rice, Matar Rice, Dal Rice

**`DISH_FALLBACK_IMAGES`** (constants/index.ts) — external Wikimedia URLs for dishes without local images (Plain Paratha, Puri, Naan, Dal Makhani, Chicken Curry, Butter Chicken, Mutton Curry, Nimbu Pani, Cold Drink, Water Bottle).

### Local Image Assets (`src/assets/images/`)

```
chai.jpg          fried_rice.jpg        chiken_biryani.jpg
jeera_rice.webp   rice.jpg              mutton_biryani.jpg
daal_tadka.webp   "Daal Fry.jpg"        mix_veg.webp
lassi.webp        sahi_paneer.webp      paneer_butter_masala.jpg
matar_paneer.webp paneer_chilly.webp    paneer_masala.webp
egg_bhurji.webp   egg_bhurji_curry.webp gobhi_matar.webp
fish_curry.jpg    fish_curry.avif       chiken_roast.webp
tandoori_roti.jpg daal_rice.webp        masala_rice.webp
matar-rice.webp   rajma-chawal-1.jpg    roti.webp
veg_biryani.jpg   logo.png
"Daal Fry - Edited.jpg"
```

---

## Security

| Concern | Implementation |
|---|---|
| Auth | JWT in `httpOnly` cookie (`accessToken`, 24h expiry) |
| Passwords | bcryptjs, 10 salt rounds |
| Rate limiting | Login: 10/15min, Register: 5/hour |
| CORS | Restricted to `FRONTEND_URL` |
| SQL injection | Prepared statements in all repos |
| Razorpay | HMAC-SHA256 signature verified server-side |
| Webhooks | Raw body preserved for signature check |
| Error details | Stack trace only in `NODE_ENV=development` |

---

## Development Notes

- **Database:** Migrated from MongoDB (docker-compose is legacy) to SQLite in production. `better-sqlite3` is synchronous — no async/await in repos.
- **Timezone:** Everything in `Asia/Kolkata`. `date-fns-tz` used in earnings calc. Frontend uses `toLocaleString("en-US", { timeZone: "Asia/Kolkata" })`.
- **Electron serving:** In production, Express serves `FRONTEND_DIST_PATH` as static files and handles `*` → `index.html` for SPA routing.
- **Native modules:** `better-sqlite3` must be rebuilt for Electron's Node version on each platform. GitHub Actions handles this with `electron-rebuild`.
- **WAL mode:** SQLite configured with WAL journal mode + 5s busy timeout to handle concurrent reads during Electron lifecycle.
- **Bill locking:** When an existing order is updated (payment), bills are NOT recalculated on the frontend — only payment fields are sent to prevent price drift.
