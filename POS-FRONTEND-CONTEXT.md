# POS Frontend — Context & Code Guide

> **Root:** `pos-frontend/`  
> **Framework:** React 18 + TypeScript + Vite  
> **Styling:** Tailwind CSS  
> **Last updated:** 2026-04-02

---

## Tech Stack

| Concern | Library |
|---|---|
| Framework | React 18 |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Routing | react-router-dom 6 |
| Global state | Redux Toolkit + react-redux |
| API calls | axios (via `axiosWrapper`) |
| Forms | react-hook-form 7 |
| Animations | framer-motion 11 |
| Toasts | notistack 3 |
| Icons | react-icons 5 |
| QR codes | qrcode.react |
| Date utils | (via backend; display formatting inline) |

---

## Folder Structure

```
pos-frontend/src/
├── App.tsx                  # React Router setup, all routes defined here
├── main.tsx                 # ReactDOM root, Redux Provider, Notistack Provider
├── https/
│   └── index.ts             # All API call functions (axios wrappers)
├── https/
│   └── axiosWrapper.ts      # Axios instance (baseURL='', withCredentials=true)
├── redux/
│   ├── store.ts             # Redux store
│   └── slices/
│       ├── cartSlice.ts     # Cart items + bill state
│       ├── userSlice.ts     # Logged-in user info + isAuth
│       └── customerSlice.ts # Active customer / table context for a session
├── types/
│   └── index.ts             # All TypeScript interfaces and types
├── pages/                   # Full-page components (route targets)
│   ├── Auth.tsx
│   ├── Home.tsx
│   ├── Dashboard.tsx
│   ├── Menu.tsx             # Add-to-order menu flow
│   ├── Orders.tsx           # Order list + management
│   ├── OrderSummary.tsx
│   ├── Tables.tsx
│   ├── DishesPage.tsx
│   ├── Staff.tsx
│   ├── Consumables.tsx
│   ├── DataManagement.tsx
│   ├── AppUpdate.tsx
│   └── ServerStatus.tsx
├── components/              # Reusable UI components, grouped by domain
│   ├── shared/              # Layout, NavBar, modals, loading states
│   ├── orders/              # OrderCard, OrderStatusSwitcher, etc.
│   ├── dishes/              # DishCard, DishForm, etc.
│   ├── tables/              # TableCard, etc.
│   ├── dashboard/           # Metrics, charts
│   ├── menu/                # MenuItemCard, CartBar
│   ├── home/                # Home screen widgets
│   ├── staff/               # StaffCard, SalaryForm
│   ├── customerLedger/      # LedgerEntry, LedgerSummary
│   ├── dataManagement/      # Import/export UI
│   ├── auth/                # Login form
│   ├── invoice/             # Invoice/receipt printing
│   └── matrix/              # Data matrix views
└── pages/index.ts           # Re-exports all page components
```

---

## Routing (`App.tsx`)

Routes are declared with `react-router-dom` v6 `<Routes>` / `<Route>`. Protected routes check Redux `isAuth`. Add new routes directly in `App.tsx`.

---

## Redux State

### Store (`redux/store.ts`)

```typescript
import { configureStore } from "@reduxjs/toolkit";
import cartReducer from "./slices/cartSlice";
import userReducer from "./slices/userSlice";
import customerReducer from "./slices/customerSlice";

export const store = configureStore({
  reducer: { cart: cartReducer, user: userReducer, customer: customerReducer },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Slices

| Slice | State | Key actions |
|---|---|---|
| `cartSlice` | `{ items: CartItem[], bill: OrderBills }` | `addItem`, `removeItem`, `updateQuantity`, `clearCart`, `setBill` |
| `userSlice` | `UserState` (extends `User` + `isAuth: boolean`) | `setUser`, `clearUser` |
| `customerSlice` | `CustomerState` (orderId, name, phone, guests, table) | `setCustomer`, `clearCustomer` |

Use typed hooks from `redux/hooks.ts`:
```typescript
import { useAppSelector, useAppDispatch } from "@/redux/hooks";
const dispatch = useAppDispatch();
const cart = useAppSelector(state => state.cart);
```

---

## API Client (`https/index.ts`)

All API calls are functions exported from `src/https/index.ts`. They use `axiosWrapper` which has `baseURL = ''` and `withCredentials: true` (sends auth cookies).

### Available API Functions

**Auth**
- `login({ email, password })`
- `register({ name, email, phone, password, role })`
- `getUserData()`
- `logout()`

**Tables**
- `getTables()`
- `addTable({ tableNo, seats })`
- `updateTable({ tableId, status, orderId })`

**Orders**
- `addOrder(data: AddOrderPayload)`
- `getOrders(filters?)`
- `getOrderById(id)`
- `updateOrder({ id, ...fields })`
- `updateOrderStatus({ orderId, orderStatus, paymentStatus })`
- `deleteOrder(id, password)`

**Dishes**
- `getDishes()`
- `addDish(data: AddDishPayload)`
- `updateDish(dishId, dishData)`
- `deleteDish(dishId)`
- `getFrequentDishes()`
- `bulkAddDishes(data[])`
- `seedDefaultDishes()`

**Earnings**
- `getDailyEarnings()`
- `getDashboardEarningsSummary()`
- `getPeriodEarnings(periodType)`

**Expenses**
- `addExpense(data)`, `getAllExpenses(filters?)`, `getExpensesByPeriod(periodType, date?)`, `updateExpense(id, updates)`, `deleteExpense(id)`

**Customer Ledger**
- `getCustomerLedger(phone)`
- `getAllCustomerLedgers(filters?)`
- `recordCustomerPayment(phone, amount, note?)`
- `addDebtToLedger(phone, amount, orderId?, note?)`
- `createLedgerEntry(data)`, `updateLedgerEntry(data)`, `deleteLedgerEntry(phone)`

**Consumables**
- `addConsumable(data)`, `getAllConsumables(filters?)`, `getConsumableDailySummary(date?)`, `updateConsumable(id, updates)`, `deleteConsumable(id)`

**Staff**
- `getAllStaff(filters?)`, `addStaff(data)`, `updateStaff(id, data)`, `deleteStaff(id)`, `toggleStaffActive(id)`
- `addStaffPayment(staffId, data)`, `deleteStaffPayment(staffId, paymentId)`

**Settings / Online Config**
- `getOnlineOrdersStatus()` → `GET /api/settings/online-orders`
- `setOnlineOrdersStatus(isOnline)` → `PUT /api/settings/online-orders`
- `getSavedDishCatalog()`, `saveCurrentDishesAsCatalog()`, `patchDishCatalog({ add?, remove? })`

> **Online Config** (new module — add these if needed):
> - `GET /api/online-config/flags` → `{ isOnline, deliveryEnabled, availableTimeStart, availableTimeEnd }`
> - `PUT /api/online-config/flags` → update any flag
> - `GET /api/online-config/delivery-areas` → active delivery areas
> - `POST /api/online-config/delivery-areas` → add area `{ name }`
> - `DELETE /api/online-config/delivery-areas/:id`
> - `PATCH /api/online-config/delivery-areas/:id` → `{ isActive: boolean }`

**Payments**
- `createOrderRazorpay({ amount })`
- `verifyPaymentRazorpay({ razorpay_order_id, razorpay_payment_id, razorpay_signature })`

---

## TypeScript Types (`types/index.ts`)

### Core Domain Types

```typescript
type OrderStatus = 'Pending' | 'Cooking' | 'In Progress' | 'Ready' | 'Completed' | 'Cancelled';
type PaymentStatus = 'Pending' | 'Paid' | 'Refunded';
type PaymentMethod = 'Cash' | 'Online';
type OrderType = 'dine-in' | 'takeaway' | 'delivery';
```

### Key Interfaces

| Interface | Used for |
|---|---|
| `Dish` | Menu item from `/api/dishes` |
| `DishVariant` | `{ size, price, markedPrice?, onlinePrice? }` |
| `Order` | Full order object with populated `table` |
| `CartItem` | `{ id, name, variantSize, pricePerQuantity, quantity, price, batch? }` |
| `OrderBills` | `{ total, discount?, roundOff?, totalWithTax }` |
| `OrderCustomerDetails` | `{ name, phone, guests }` |
| `Table` | Table with status `'Available' \| 'Booked'` |
| `User` | Staff user (`_id, name, email, phone, role`) |
| `StaffMember` | Staff with payments array |
| `CustomerLedger` | Customer credit account with transactions |
| `ConsumableEntry` | Tea/gutka/cigarette log entry |
| `AddOrderPayload` | Body for `POST /api/order` |
| `AddDishPayload` | Body for `POST /api/dishes` |
| `ApiResponse<T>` | `{ success, message, data: T }` |

---

## Conventions & Patterns

### Adding an API call

1. Add the function to `src/https/index.ts` using `axiosWrapper`
2. If a new request shape is needed, add the interface to `src/types/index.ts`

```typescript
// https/index.ts
export const getMyResource = () => axiosWrapper.get("/api/my-module");
export const createMyResource = (data: MyPayload) => axiosWrapper.post("/api/my-module", data);
export const deleteMyResource = (id: string) => axiosWrapper.delete(`/api/my-module/${id}`);
```

### Adding a page

1. Create `src/pages/MyPage.tsx`
2. Export it from `src/pages/index.ts`
3. Add a `<Route path="/my-page" element={<MyPage />} />` in `App.tsx`

### Toasts (notistack)

```typescript
import { useSnackbar } from "notistack";
const { enqueueSnackbar } = useSnackbar();
enqueueSnackbar("Done!", { variant: "success" });   // success | error | warning | info
```

### Icons (react-icons)

Use `react-icons` with tree-shaken imports:
```typescript
import { FiTrash2 } from "react-icons/fi";
import { MdDashboard } from "react-icons/md";
```

### Forms (react-hook-form)

```typescript
import { useForm } from "react-hook-form";
const { register, handleSubmit, reset, formState: { errors } } = useForm<MyFormData>();
```

### Animations (framer-motion)

```typescript
import { motion, AnimatePresence } from "framer-motion";
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
```

---

## Order Status Flow

```
Pending → Cooking → Ready → Completed
                          ↘ Cancelled (from any state)
```

`'In Progress'` is kept in the type union for legacy data compatibility but new orders go through `Pending → Cooking`.

**POS staff actions:**
- `Pending` → Accept (→ Cooking) or Reject (→ Cancelled)
- `Cooking` → Mark Ready
- `Ready` → Mark Done (→ Completed)

---

## Key Shared Components

| Component | Location | Notes |
|---|---|---|
| `NavBar` | `components/shared/` | Sidebar/top nav with route links |
| `OrderCard` | `components/orders/OrderCard.tsx` | Displays order; pulsing amber for Pending |
| `OrderStatusSwitcher` | `components/orders/OrderStatusSwitcher.tsx` | Accept/Reject/Mark Ready/Done buttons |
| `DishCard` | `components/dishes/DishCard.tsx` | Dish display in menu and dish list |
| `CartBar` | `components/menu/CartBar.tsx` | Sticky cart summary bar in menu flow |
| `InvoiceView` | `components/invoice/` | Printable invoice/receipt |

---

## Environment Variables (Vite)

Variables must be prefixed `VITE_` to be exposed to the browser.  
Access with `import.meta.env.VITE_MY_VAR`.

Common vars:
- `VITE_API_URL` — backend base URL (defaults to `''` for same-origin)
- `VITE_RAZORPAY_KEY_ID` — public Razorpay key

---

## Build & Dev

```bash
# Dev (hot reload)
npm run dev          # vite dev server on :5173

# Build
npm run build        # outputs to dist/

# Preview built app
npm run preview
```

The built `dist/` folder is referenced by the backend in production via:
```typescript
// app.ts
const frontendBuildPath = process.env["FRONTEND_DIST_PATH"] ?? path.join(__dirname, "../../pos-frontend/dist");
app.use(express.static(frontendBuildPath));
app.get("*", (req, res) => res.sendFile(path.join(frontendBuildPath, "index.html")));
```
