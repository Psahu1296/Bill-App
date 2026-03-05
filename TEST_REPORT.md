# Bill-App (POS System) - Comprehensive Test Report

**Date:** 2026-03-05
**Scope:** Full application flow mapping, gap analysis, and test recommendations

---

## Table of Contents

1. [API Endpoint Map](#1-api-endpoint-map)
2. [Frontend Route Map](#2-frontend-route-map)
3. [User Flow Analysis](#3-user-flow-analysis)
4. [Identified Gaps and Risks](#4-identified-gaps-and-risks)
5. [Recommended Test Cases](#5-recommended-test-cases)
6. [Suggested Testing Stack](#6-suggested-testing-stack)

---

## 1. API Endpoint Map

### Authentication (`/api/user`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/user/register` | No | Register a new user (name, phone, email, password, role) |
| POST | `/api/user/login` | No | Login with email/password, sets httpOnly cookie |
| POST | `/api/user/logout` | Yes | Clears accessToken cookie |
| GET | `/api/user/` | Yes | Get current user data |

### Tables (`/api/table`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/table/` | Yes | Add a new table (tableNo, seats) |
| GET | `/api/table/` | Yes | Get all tables (populates currentOrder) |
| PUT | `/api/table/:id` | Yes | Update table status/currentOrder |

### Dishes (`/api/dishes`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/dishes/` | Yes | Add a new dish (with variants) |
| GET | `/api/dishes/` | Yes | Get all dishes |
| GET | `/api/dishes/frequent` | Yes | Get frequently ordered dishes |
| PUT | `/api/dishes/:id` | Yes | Update a dish |
| DELETE | `/api/dishes/:id` | Yes | Delete a dish |

### Orders (`/api/order`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/order/` | Yes | Create or update an order (upsert via `_id` in body) |
| GET | `/api/order/` | Yes | Get orders with filters (date, table, phone, status) |
| GET | `/api/order/:id` | Yes | Get single order by ID |
| PUT | `/api/order/:id` | Yes | Update order (status, payment, amounts); cascades to ledger, earnings, table |

### Payments (`/api/payment`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/payment/create-order` | Yes | Create Razorpay order |
| POST | `/api/payment/verify-payment` | Yes | Verify Razorpay payment signature |
| POST | `/api/payment/webhook-verification` | No | Razorpay webhook handler |

### Earnings (`/api/earnings`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/earnings/daywise` | No* | Get today's vs yesterday's earnings |
| GET | `/api/earnings/dashboard` | No* | Get daily/weekly/monthly/yearly summary |
| GET | `/api/earnings/:periodType` | No* | Get earnings for day/week/month/year period |
| POST | `/api/earnings/calculate-daily` | No* | Manually trigger daily earning calculation |

### Expenses (`/api/expenses`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/expenses/` | Yes** | Add an expense |
| GET | `/api/expenses/` | Yes** | Get all expenses (with optional filters) |
| PUT | `/api/expenses/:id` | Yes** | Update an expense |
| DELETE | `/api/expenses/:id` | Yes** | Delete an expense |
| GET | `/api/expenses/summary/:periodType` | Yes** | Get expenses by period (day/month/year) |

### Customer Ledger (`/api/ledger`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/ledger/all` | Yes | Get all customer ledgers (with filters) |
| GET | `/api/ledger/:phone` | Yes | Get ledger for a specific customer |
| POST | `/api/ledger/:phone/pay` | Yes | Record a payment against customer balance |

> *Earnings routes are missing `isVerifiedUser` middleware
> **Expenses routes use a hardcoded `authMiddleware` that always sets `req.user = { role: 'admin' }` -- bypasses real auth

---

## 2. Frontend Route Map

| Path | Component | Auth Required | Description |
|------|-----------|---------------|-------------|
| `/` | `Home` | Yes | Dashboard home with earnings, recent orders, popular dishes |
| `/auth` | `Auth` | No (redirects if logged in) | Login / Register toggle |
| `/tables` | `Tables` | Yes | View all tables, filter by status, select table for ordering |
| `/menu` | `Menu` | Yes | Browse dishes, add to cart, enter customer info, place order |
| `/orders` | `Orders` | Yes | View orders by date, filter by status |
| `/dashboard` | `Dashboard` | Yes | Admin panel: metrics, add table/dish/expense, manage dishes |
| `/ledger` | `CustomerLedgerList` | Yes | View customer balances, record payments |
| `*` | Not Found | No | Catch-all 404 |

---

## 3. User Flow Analysis

### 3.1 Authentication Flow

**Register (Happy Path):**
1. User navigates to `/auth`, clicks "Sign up"
2. Fills in name, email, phone, password, selects role (Waiter/Cashier/Admin)
3. Submits form -> `POST /api/user/register`
4. Backend validates all fields present, checks email uniqueness, hashes password, saves user
5. Success toast shown, auto-switches to login form after 1.5s

**Login (Happy Path):**
1. User enters email and password on `/auth`
2. Submits form -> `POST /api/user/login`
3. Backend verifies credentials, creates JWT (1d expiry), sets httpOnly cookie
4. Frontend dispatches `setUser` to Redux, navigates to `/`

**Logout:**
1. User triggers logout -> `POST /api/user/logout`
2. Backend clears `accessToken` cookie
3. Frontend clears Redux state, redirects to `/auth`

**Session Restoration:**
1. On app load, `useLoadData` hook calls `GET /api/user/`
2. If valid cookie exists, user data is restored to Redux
3. If not, user stays on `/auth`

### 3.2 Table Management Flow

**View Tables:**
1. Navigate to `/tables` -> `GET /api/table/` (populates currentOrder.customerDetails)
2. Tables displayed as cards with status (Available/Booked), seats, customer avatar

**Select Table for New Order:**
1. Click an "Available" table card
2. Dispatches `updateTable` to Redux (stores tableId, tableNo)
3. Navigates to `/menu`

**Change Table Status (Manual):**
1. Click "Change Status" button on any table card
2. Calls `PUT /api/table/:id` with toggled status
3. On success: clears customer/cart Redux, reloads entire page (`window.location.reload()`)

### 3.3 Menu and Ordering Flow

**Browse and Add to Cart:**
1. On `/menu`, dishes loaded via `GET /api/dishes/`
2. User can search dishes by name
3. Each `MenuItem` can be added to Redux cart (with variant selection)

**Enter Customer Info:**
1. `CustomerInfo` component displays current customer from Redux
2. Customer details (name, phone, guests) set via `setCustomer` Redux action

**Place Order (Cash - Happy Path):**
1. Cart items accumulated in Redux, bill calculated (subtotal + 5.25% tax)
2. User selects payment method (Cash; Online is disabled)
3. Clicks "Place Order"
4. If existing orderId in URL params -> calls `PUT /api/order/:id` (update)
5. Otherwise -> calls `POST /api/order/` (create)
6. Backend: creates order, marks table as Booked, updates customer ledger if balance due, updates daily earnings
7. Frontend: clears cart + customer, shows success toast, navigates to `/`

**Place Order (Online/Razorpay - Currently Disabled):**
1. Loads Razorpay SDK script
2. Creates Razorpay order via `POST /api/payment/create-order`
3. Opens Razorpay checkout modal
4. On payment success: verifies via `POST /api/payment/verify-payment`
5. Then creates the POS order

**Pay Button (Settle Order):**
1. Enabled only when `orderId` exists in URL search params
2. Opens `PayModal` with order summary (total, paid, outstanding)
3. User enters amount, clicks "Record Payment"
4. Calls `PUT /api/order/:id` with updated amountPaid, paymentStatus="Paid", orderStatus="Completed"
5. Backend: updates order, recalculates ledger, updates daily earnings, frees table if fully settled

### 3.4 Orders Management Flow

**View Orders:**
1. Navigate to `/orders`
2. Date picker defaults to today, fetches `GET /api/order?startDate=X&endDate=X`
3. Orders displayed as cards, filterable by status (All/In Progress/Ready/Completed)

**Update Order Status (via OrderCard):**
1. OrderCard allows status updates (not fully visible without reading OrderCard component)
2. Calls `PUT /api/order/:id` with new status

### 3.5 Customer Ledger Flow

**View Ledgers:**
1. Navigate to `/ledger`
2. Fetches `GET /api/ledger/all` (with hasBalanceDue filter)
3. Displays customer list with balance due, searchable by name/phone
4. Expandable accordion shows transaction history

**Record Payment:**
1. Click "Pay" on a customer row -> opens PaymentModal
2. Pre-fills outstanding balance amount
3. User can adjust amount, add notes, select payment method
4. Submits `POST /api/ledger/:phone/pay`
5. Backend: decrements balance, adds transaction record, updates daily earnings

### 3.6 Dashboard / Admin Flow

**Metrics Tab:**
1. `Metrics` component fetches `GET /api/earnings/dashboard`
2. Displays daily/weekly/monthly/yearly earnings with percentage changes

**Orders Tab:**
1. `RecentOrders` component shows recent orders (similar to home page)

**Dishes Tab:**
1. `DishesList` component shows all dishes with management capabilities

**Add Table Modal:**
1. Opens modal to add new table (tableNo, seats)
2. Calls `POST /api/table/`

**Add Dish Modal:**
1. Opens modal with form for dish details (image, name, type, category, variants)
2. Calls `POST /api/dishes/`

**Add Expense Modal:**
1. Opens modal for expense entry (type, name, amount, description, date)
2. Calls `POST /api/expenses/`

### 3.7 Expense Tracking Flow

**Add Expense:**
1. From Dashboard, click "Add Expense" -> modal opens
2. Fill in type, name, amount, description
3. Calls `POST /api/expenses/`

**View/Filter Expenses:**
1. Via API: `GET /api/expenses/` with optional startDate, endDate, type filters
2. Period summary: `GET /api/expenses/summary/:periodType`
3. No dedicated frontend page for viewing expenses (only add modal exists)

---

## 4. Identified Gaps and Risks

### 4.1 Security Issues (Critical)

| ID | Issue | Location | Severity |
|----|-------|----------|----------|
| S1 | **Earnings routes have no auth middleware** - all `/api/earnings/*` endpoints are publicly accessible | `earningRoute.ts` | Critical |
| S2 | **Expense routes use fake auth middleware** - hardcodes `req.user = { role: 'admin' }` instead of using `isVerifiedUser` | `expenseRoutes.ts:9-13` | Critical |
| S3 | **No role-based access control (RBAC)** - any authenticated user (Waiter/Cashier/Admin) can add tables, delete dishes, add expenses, view earnings | All routes | High |
| S4 | **No password strength validation** - registration accepts any password length/complexity | `userController.ts:15` | Medium |
| S5 | **Webhook secret typo** - config key is `razorpyWebhookSecret` (missing 'a' in razorpay) -- if this doesn't match config, webhook verification silently fails | `paymentController.ts:51` | Medium |

### 4.2 Data Integrity Issues

| ID | Issue | Location | Severity |
|----|-------|----------|----------|
| D1 | **addOrder uses `_id` in body for upsert** - conflates create and update in a POST endpoint, confusing REST semantics. If a client sends a stale `_id`, it silently updates an old order | `orderController.ts:29-50` | High |
| D2 | **Table update bug: `return error` instead of `return next(error)`** - when table is not found on update, the error object is returned but never sent to client; request hangs | `tableController.ts:61` | High |
| D3 | **Order update sets table field `currentOrderId` but model uses `currentOrder`** - field name mismatch when creating new order: `currentOrderId` vs schema's `currentOrder` | `orderController.ts:63` vs `tableModel.ts:14` | High |
| D4 | **Customer ledger `balanceDue` has `min: 0`** but `$inc` with negative values in `recordCustomerPayment` could theoretically push it negative if payment > balance (validation only on FE) | `customerLedgerModel.ts:20`, `customerLedgerController.ts:46` | Medium |
| D5 | **Order's `updateOrderById` transaction type mismatch** - pushes `balance_increased` / `balance_decreased` to ledger but schema enum only allows `partial_payment`, `full_payment_due`, `payment_received`, `adjustment` | `orderController.ts:249` vs `customerLedgerModel.ts:30` | High |
| D6 | **PayModal always sets `paymentStatus: "Paid"` and `orderStatus: "Completed"`** even for partial payments - commented-out logic for partial payment handling | `PayModal.jsx:68-80` | Medium |

### 4.3 Frontend Issues

| ID | Issue | Location | Severity |
|----|-------|----------|----------|
| F1 | **`enqueueSnackbar` called in render path** in Tables page - if `isError` is true, snackbar fires on every re-render (also `enqueueSnackbar` is never imported) | `Tables.jsx:25` | High |
| F2 | **`enqueueSnackbar` called in render path** in Orders page - same infinite snackbar issue on error | `Orders.jsx:31` | High |
| F3 | **No customer info entry point** - `CustomerInfo` component displays customer data but there's no visible UI to SET customer name/phone/guests before ordering. The `setCustomer` action exists but no component dispatches it on the menu page | Missing component | High |
| F4 | **`window.location.reload()` on table status change** - causes full app reload instead of using React Query invalidation | `TableCard.jsx:40` | Medium |
| F5 | **"In Progress" count hardcoded to 16** on Home page | `Home.jsx:44` | Low |
| F6 | **Missing `key` prop** on TableCard map in Tables page | `Tables.jsx:60-68` | Low |
| F7 | **Tables page filter buttons don't actually filter** - `status` state is set but never used to filter the rendered tables | `Tables.jsx:38-55,57-69` | Medium |
| F8 | **No loading/disabled state on login/register buttons** - users can submit multiple times | `Login.jsx:78-83`, `Register.jsx:142-147` | Low |
| F9 | **Login error handler assumes `error.response` exists** - network errors will crash with `Cannot read properties of undefined` | `Login.jsx:37-39` | Medium |
| F10 | **Register error handler same issue** | `Register.jsx:46-48` | Medium |
| F11 | **No expense viewing page** - expenses can only be added from Dashboard modal, but there's no way to view/edit/delete them from the frontend | Missing page | Medium |

### 4.4 Integration Issues

| ID | Issue | Location | Severity |
|----|-------|----------|----------|
| I1 | **FE `updateTable` sends `tableId` key** but BE expects `id` in URL params - the FE correctly uses `axiosWrapper.put(/api/table/${tableId})` but also sends `orderId` in body while BE expects it as `orderId` in body (this one works) | `https/index.js:14-15` | Low |
| I2 | **No explicit link between table selection and customer info** - selecting a table on Tables page dispatches `updateTable` but doesn't prompt for customer details; user arrives at Menu page with empty customer info | `TableCard.jsx` -> `Menu.jsx` | High |
| I3 | **`updateOrder` in FE `https/index.js` sends `id` in body** then destructures, but `Bill.jsx` also sends `id` as top-level key for the mutation -- double check for consistency | `https/index.js:28-31`, `Bill.jsx:121-124` | Low |

### 4.5 Missing Features / Edge Cases

| ID | Issue | Severity |
|----|-------|----------|
| M1 | No order cancellation flow from frontend | Medium |
| M2 | No table deletion capability | Low |
| M3 | No dish availability toggle from menu (isAvailable field exists in model but not used in menu filtering) | Medium |
| M4 | No pagination on orders, dishes, or ledger lists | Medium |
| M5 | No email uniqueness index on User model (relies on application-level check only) | Medium |
| M6 | No refresh token mechanism - single JWT with 1-day expiry, no renewal | Low |
| M7 | Webhook handler saves Payment record but doesn't link it to the POS order | Medium |

---

## 5. Recommended Test Cases

### 5.1 Backend Unit Tests

#### Authentication
| # | Test Case | Type |
|---|-----------|------|
| U1 | Register with all valid fields returns 201 and user without password | Unit |
| U2 | Register with missing fields returns 400 | Unit |
| U3 | Register with duplicate email returns 400 | Unit |
| U4 | Login with valid credentials returns 200 and sets cookie | Unit |
| U5 | Login with wrong password returns 401 | Unit |
| U6 | Login with non-existent email returns 401 | Unit |
| U7 | getUserData with valid token returns user data | Unit |
| U8 | Logout clears accessToken cookie | Unit |
| U9 | Password is hashed before saving (bcrypt pre-save hook) | Unit |

#### Tables
| # | Test Case | Type |
|---|-----------|------|
| U10 | Add table with valid tableNo and seats returns 201 | Unit |
| U11 | Add table with duplicate tableNo returns 400 | Unit |
| U12 | Add table without tableNo returns 400 | Unit |
| U13 | Get tables returns all tables with populated currentOrder | Unit |
| U14 | Update table with valid ID updates status | Unit |
| U15 | Update table with invalid ID returns 404 | Unit |
| U16 | **BUG TEST: Update table when table not found returns error to client** (currently returns error object, not next(error)) | Unit |

#### Dishes
| # | Test Case | Type |
|---|-----------|------|
| U17 | Add dish with valid fields and variants returns 201 | Unit |
| U18 | Add dish with missing required fields returns 400 | Unit |
| U19 | Add dish with empty variants array returns 400 | Unit |
| U20 | Add dish with variant missing price returns 400 | Unit |
| U21 | Add dish with duplicate name returns 409 | Unit |
| U22 | Get all dishes returns array | Unit |
| U23 | Get frequent dishes respects limit and minOrders params | Unit |
| U24 | Update dish variants with valid data succeeds | Unit |
| U25 | Delete dish with valid ID removes dish | Unit |
| U26 | Delete dish with non-existent ID returns 404 | Unit |

#### Orders
| # | Test Case | Type |
|---|-----------|------|
| U27 | Create order with valid data returns 201, marks table as Booked | Unit |
| U28 | Create order with invalid table ID returns 400 | Unit |
| U29 | Create order with non-existent table returns 404 | Unit |
| U30 | Create order with `_id` in body updates existing order | Unit |
| U31 | Create order with balance due creates/updates customer ledger | Unit |
| U32 | Create order with amountPaid > 0 updates daily earnings | Unit |
| U33 | Get orders filters by date range correctly | Unit |
| U34 | Get orders filters by customerPhone, tableId, orderStatus, paymentStatus | Unit |
| U35 | Update order to Paid status adds remaining amount to daily earnings | Unit |
| U36 | Update order from Paid to Refunded reverses earnings | Unit |
| U37 | Update completed+paid order frees table (sets Available, clears currentOrder) | Unit |
| U38 | Update cancelled order frees table | Unit |
| U39 | **BUG TEST: Ledger transaction type 'balance_increased'/'balance_decreased' passes schema validation** (currently these are not in enum) | Unit |

#### Payments
| # | Test Case | Type |
|---|-----------|------|
| U40 | Create Razorpay order with valid amount returns order details | Unit |
| U41 | Verify payment with valid signature returns success | Unit |
| U42 | Verify payment with invalid signature returns 400 | Unit |
| U43 | Webhook with valid signature and payment.captured event saves Payment | Unit |
| U44 | Webhook with invalid signature returns 400 | Unit |

#### Expenses
| # | Test Case | Type |
|---|-----------|------|
| U45 | Add expense with valid fields returns 201 | Unit |
| U46 | Add expense with missing required fields returns 400 | Unit |
| U47 | Add expense with negative amount returns 400 | Unit |
| U48 | Get all expenses with date filters returns correct set | Unit |
| U49 | Get expenses by period (day/month/year) returns summary | Unit |
| U50 | Update expense with valid ID succeeds | Unit |
| U51 | Delete expense with valid ID succeeds | Unit |

#### Customer Ledger
| # | Test Case | Type |
|---|-----------|------|
| U52 | Get customer ledger by phone returns correct data | Unit |
| U53 | Get customer ledger with non-existent phone returns 404 | Unit |
| U54 | Record payment decrements balanceDue correctly | Unit |
| U55 | Record payment with amount <= 0 returns 400 | Unit |
| U56 | Record payment updates daily earnings | Unit |
| U57 | Get all ledgers with status=unpaid filters correctly | Unit |
| U58 | Get all ledgers with name search uses regex correctly | Unit |

#### Earnings
| # | Test Case | Type |
|---|-----------|------|
| U59 | getDailyEarnings returns today and yesterday earnings | Unit |
| U60 | getDashboardEarningsSummary returns all four period summaries | Unit |
| U61 | getPeriodEarnings with periodType=day returns correct number of periods | Unit |
| U62 | calculateAndSaveDailyEarnings creates/updates DailyEarning record | Unit |

### 5.2 Backend Integration Tests

| # | Test Case | Type |
|---|-----------|------|
| I1 | Full order lifecycle: create order -> update to Paid -> verify table freed, ledger updated, earnings updated | Integration |
| I2 | Order with partial payment: create with amountPaid < total -> update with full payment -> verify ledger reflects both transactions | Integration |
| I3 | Customer with multiple orders: verify cumulative ledger balance | Integration |
| I4 | Record customer payment via ledger endpoint -> verify earnings updated | Integration |
| I5 | Auth middleware rejects expired tokens | Integration |
| I6 | Auth middleware rejects tampered tokens | Integration |
| I7 | Razorpay payment flow: create order -> verify payment -> confirm Payment model saved | Integration |

### 5.3 Frontend Unit Tests (React Testing Library)

| # | Test Case | Component |
|---|-----------|-----------|
| FU1 | Login form renders email and password inputs | Login |
| FU2 | Login form submits with entered credentials | Login |
| FU3 | Login shows error snackbar on failed login | Login |
| FU4 | Register form renders all fields and role buttons | Register |
| FU5 | Register role selection highlights selected role | Register |
| FU6 | Register form validates required fields | Register |
| FU7 | TableCard displays table number, status, seats | TableCard |
| FU8 | TableCard click on Available table navigates to /menu | TableCard |
| FU9 | TableCard click on Booked table does nothing | TableCard |
| FU10 | MenuContainer renders dishes from API | MenuContainer |
| FU11 | MenuContainer search filters dishes by name | MenuContainer |
| FU12 | Bill component calculates tax correctly (5.25%) | Bill |
| FU13 | Bill "Place Order" requires payment method | Bill |
| FU14 | PayModal validates amount > 0 | PayModal |
| FU15 | PayModal validates amount <= outstanding balance | PayModal |
| FU16 | CustomerLedgerList renders customer list with balances | CustomerLedgerList |
| FU17 | CustomerLedgerList search filters by name and phone | CustomerLedgerList |
| FU18 | PaymentModal pre-fills outstanding balance | PaymentModal |
| FU19 | ProtectedRoutes redirects to /auth when not authenticated | App |
| FU20 | ProtectedRoutes renders children when authenticated | App |

### 5.4 End-to-End Tests (Playwright)

| # | Test Case | Flow |
|---|-----------|------|
| E1 | Full registration -> login -> redirect to home | Auth |
| E2 | Login with invalid credentials shows error | Auth |
| E3 | Unauthenticated user redirected to /auth | Auth |
| E4 | View tables page, verify table cards render | Tables |
| E5 | Select available table -> redirected to menu | Tables -> Menu |
| E6 | Browse menu, search for a dish, add to cart | Menu |
| E7 | Complete order: select table -> add items -> enter customer info -> place order | Full Order |
| E8 | View orders for today, filter by status | Orders |
| E9 | Pay for an existing order via PayModal | Payment |
| E10 | View customer ledger, expand transaction history | Ledger |
| E11 | Record payment in customer ledger | Ledger |
| E12 | Dashboard: view metrics, switch tabs | Dashboard |
| E13 | Dashboard: add a new table | Dashboard |
| E14 | Dashboard: add a new dish with variants | Dashboard |
| E15 | Dashboard: add a new expense | Dashboard |
| E16 | Logout and verify redirect to auth | Auth |

---

## 6. Suggested Testing Stack

### Backend Testing
- **Test Runner:** Vitest or Jest
- **HTTP Testing:** Supertest (for integration tests against Express app)
- **Database:** mongodb-memory-server (in-memory MongoDB for isolated tests)
- **Mocking:** Vitest built-in mocks or jest.mock for external services (Razorpay)

### Frontend Testing
- **Test Runner:** Vitest (already using Vite as bundler)
- **Component Testing:** React Testing Library (@testing-library/react)
- **User Events:** @testing-library/user-event
- **Mocking:** MSW (Mock Service Worker) for API mocking
- **Redux Store Testing:** Provide test Redux store wrapper

### End-to-End Testing
- **Framework:** Playwright
- **Why:** Cross-browser support, auto-waiting, good developer experience, built-in test generator
- **Setup:** Use Playwright's `webServer` config to auto-start dev servers

### Recommended `devDependencies` to Add

```json
{
  "pos-backend devDependencies": {
    "vitest": "^3.x",
    "supertest": "^7.x",
    "@types/supertest": "^6.x",
    "mongodb-memory-server": "^10.x"
  },
  "pos-frontend devDependencies": {
    "vitest": "^3.x",
    "@testing-library/react": "^16.x",
    "@testing-library/jest-dom": "^6.x",
    "@testing-library/user-event": "^14.x",
    "msw": "^2.x",
    "jsdom": "^25.x"
  },
  "root devDependencies": {
    "@playwright/test": "^1.x"
  }
}
```

---

## Summary of Critical Findings

| Priority | Count | Key Items |
|----------|-------|-----------|
| Critical | 2 | Earnings routes unauthenticated; Expense routes bypass auth |
| High | 8 | Table update bug (response hangs), field name mismatch (currentOrderId vs currentOrder), ledger transaction type enum mismatch, no customer info entry UI, snackbar in render path, tables filter not working |
| Medium | 10 | Partial payment always marked as Paid, no expense viewing page, no RBAC, no pagination, no dish availability filtering |
| Low | 5 | Hardcoded "In Progress" count, missing key props, no loading states on auth forms, no refresh token |

**Total identified issues: 25**
**Recommended test cases: 89** (62 unit, 7 integration, 20 frontend unit, 16 e2e)
