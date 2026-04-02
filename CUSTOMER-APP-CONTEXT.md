# Customer App — Complete Context for New Agent

> **Customer app:** `/Volumes/DevSSD/projects/sahu-family-dhaba-creator/`  
> **Backend + POS:** `/Volumes/DevSSD/projects/Bill-App/`  
> **Last updated:** 2026-04-02

---

## Repositories

| Repo | Purpose |
|---|---|
| `/Volumes/DevSSD/projects/sahu-family-dhaba-creator/` | Customer-facing web app (React + Vite) |
| `/Volumes/DevSSD/projects/Bill-App/pos-backend/` | Express + SQLite backend (shared) |
| `/Volumes/DevSSD/projects/Bill-App/pos-frontend/` | POS staff desktop app |

---

## What the Customer App Is

Mobile-first React SPA. Customers scan a QR code → browse menu → pick dine-in / takeaway / delivery → place order → track it live via SSE.

**Payment model (unchanged):**
- Delivery = prepaid via PhonePe
- Dine-in / Takeaway = post-paid cash at counter

---

## Tech Stack

| Concern | Library |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Routing | react-router-dom v6 |
| Server state | @tanstack/react-query 5 |
| Styling | Tailwind CSS (custom `dhaba-*` tokens) |
| i18n | Custom context — EN + HI (`src/i18n/translations.ts`) |
| Toasts | sonner |
| Icons | lucide-react |

---

## Folder Structure

```
src/
├── App.tsx                    # React Router setup — all routes here
├── main.tsx                   # Entry, providers
├── pages/
│   ├── Landing.tsx            # QR-code entry, sets API URL + orderType
│   ├── Dashboard.tsx          # Home screen with entry grid
│   ├── Catalog.tsx            # Static catalog (no cart)
│   ├── Menu.tsx               # Live menu with add-to-cart
│   ├── Cart.tsx               # Cart review
│   ├── Checkout.tsx           # Name/phone/area form + payment
│   ├── Orders.tsx             # Active order + past orders
│   ├── OrderConfirmation.tsx  # Live order tracking (SSE)
│   ├── Profile.tsx            # Customer profile + full order history
│   ├── Contact.tsx
│   ├── PrivacyPolicy.tsx
│   ├── Terms.tsx
│   ├── RefundPolicy.tsx
│   └── NotFound.tsx
├── components/
│   ├── Header.tsx / Footer.tsx
│   ├── DishCard.tsx
│   ├── CartBar.tsx
│   └── ui/                    # shadcn primitives (sonner, tooltip)
├── context/
│   ├── CartContext.tsx         # Cart state + session persistence
│   └── LanguageContext.tsx     # EN/HI toggle
├── hooks/
│   ├── useProfile.ts          # Customer profile localStorage + backend sync
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── services/
│   └── api.ts                 # All apiFetch query/mutation functions
├── types/
│   └── index.ts               # All TypeScript interfaces
└── i18n/
    └── translations.ts        # EN + HI string keys
```

---

## Routes (`App.tsx`)

| Path | Component | Notes |
|---|---|---|
| `/` | `Landing` | Handles `?api=`, `?type=`, `?table=`, `?catalog=` QR params |
| `/dashboard` | `Dashboard` | Home grid, shows "Welcome back" if profile saved |
| `/catalog` | `Catalog` | Read-only menu, no cart |
| `/menu` | `Menu` | Live menu + cart |
| `/cart` | `Cart` | Cart review, navigates to checkout |
| `/checkout` | `Checkout` | Pre-fills from saved profile |
| `/orders` | `Orders` | Active order + localStorage history |
| `/order/:id` | `OrderConfirmation` | Real-time status via SSE |
| `/profile` | `Profile` | Saved profile + full order history (API + localStorage) |
| `/contact` | `Contact` | |
| `/privacy-policy` | `PrivacyPolicy` | |
| `/terms` | `Terms` | |
| `/refund-policy` | `RefundPolicy` | |

---

## Order Status Type

```typescript
type OrderStatus = 'Pending' | 'Cooking' | 'Ready' | 'Completed' | 'Cancelled';
```

**Flow:** `Pending → Cooking → Ready → Completed` (Cancelled from any state)

**Status display mapping (OrderConfirmation.tsx):**

| Status | Customer label | Color |
|---|---|---|
| `Pending` | "Confirming your order..." | amber / warning |
| `Cooking` | "Kitchen is preparing your food" | amber / accent |
| `Ready` | "Your order is ready!" (delivery → "Out for Delivery!") | green / success |
| `Completed` | "Thank you! Visit again." | green / success |
| `Cancelled` | "Order cancelled" | red / danger |

---

## Customer Profile System

### `hooks/useProfile.ts`

Central hook — localStorage-first, backend syncs silently.

```typescript
const { profile, hasProfile, saveProfile, updateProfile, clearProfile } = useProfile();
```

- `profile: SavedProfile | null` — from `localStorage` key `dhaba_customer_profile`
- `saveProfile({ phone, name, preferredArea })` — saves locally + fires `POST /api/customer/profile`
- `updateProfile({ name?, preferredArea? })` — merges locally + fires `PATCH /api/customer/profile/:phone`
- `clearProfile()` — removes from localStorage
- On mount: silently attempts backend sync via `GET /api/customer/profile/:phone`; updates local if backend is newer

### `SavedProfile` type

```typescript
interface SavedProfile {
  phone: string;       // 10-digit normalised
  name: string;
  preferredArea: string;  // last-used delivery area name
  savedAt: string;        // ISO timestamp
}
```

### Profile is saved/updated only on successful order placement (inside `saveOrderHistory` in `Checkout.tsx`).

---

## localStorage Keys

| Key | Type | Scope | Purpose |
|---|---|---|---|
| `dhaba_customer_profile` | `SavedProfile` JSON | `localStorage` | Saved name, phone, preferred delivery area |
| `dhaba_order_history` | `OrderHistoryEntry[]` JSON (max 20) | `localStorage` | Past order history for Orders + Profile pages |
| `dhaba_active_order` | session JSON | `sessionStorage` | Active order state (orderId, items, orderType, tableNo) |
| `apiUrl` | string | `sessionStorage` | Backend base URL set by QR code `?api=` param |
| `dhaba-lang` | `'en'` or `'hi'` | `localStorage` | Language preference |

---

## API Layer (`services/api.ts`)

All calls use `apiFetch<T>(path, init?)` which reads `sessionStorage.apiUrl` for the base URL.

### Store status / online config
```typescript
storeStatusQueryOptions          // GET /api/online-config/flags → OnlineConfigFlags
deliveryAreasQueryOptions         // GET /api/online-config/delivery-areas → DeliveryArea[]
```

### Customer profile
```typescript
getCustomerProfile(phone)         // GET /api/customer/profile/:phone → SavedProfile | null
upsertCustomerProfile(data)       // POST /api/customer/profile (fire-and-forget from hook)
patchCustomerProfile(phone, data) // PATCH /api/customer/profile/:phone (fire-and-forget from hook)
customerOrdersQueryOptions(phone) // GET /api/customer/orders/:phone → PublicOrder[]
```

### Dishes / orders
```typescript
dishesQueryOptions                // GET /api/customer/dishes
orderQueryOptions(orderId)        // GET /api/customer/order/:id
placeOrder(payload)               // POST /api/customer/order
addItemsToOrder(orderId, ...)     // PATCH /api/customer/order/:id/add-items
initiatePhonePePayment(data)      // POST /api/payment/phonepe/initiate
phonePeStatusQueryOptions(txnId)  // GET /api/payment/phonepe/status/:txnId (polls until terminal)
```

---

## Key Types (`types/index.ts`)

```typescript
type OrderType   = 'dine-in' | 'takeaway' | 'delivery';
type OrderStatus = 'Pending' | 'Cooking' | 'Ready' | 'Completed' | 'Cancelled';

interface SavedProfile   { phone, name, preferredArea, savedAt }
interface DeliveryArea   { _id, name, isActive }
interface OnlineConfigFlags { isOnline, deliveryEnabled, availableTimeStart, availableTimeEnd }
interface PublicOrder    { _id, orderStatus, orderType, items, bills, orderDate, customerDetails }
interface CartItem       { id, name, variantSize, pricePerQuantity, quantity, price, batch? }
interface BillBreakdown  { subtotal, total, totalWithTax }
interface CustomerDetails { name, phone, guests? }
interface OrderPayload   { orderType, tableNo?, customerDetails, deliveryAddress?, specialInstructions?, items, bills, amountPaid, paymentMethod, paymentStatus, paymentData? }
```

---

## Checkout Flow (`pages/Checkout.tsx`)

1. **Pre-fills** name, phone, preferred delivery area from `useProfile()`
2. Shows **"Not you?"** chip if profile exists — one tap to clear and reset form
3. Delivery address = **area selector buttons** (from `deliveryAreasQueryOptions`), not free-text
4. On successful order:
   - Saves to `dhaba_order_history` (localStorage)
   - Calls `saveProfile({ phone, name, preferredArea })` → updates localStorage + fires backend upsert
5. Dine-in/Takeaway → `POST /api/customer/order` (cash, Pending)
6. Delivery → `POST /api/customer/order` then `POST /api/payment/phonepe/initiate` (PhonePe redirect)

---

## Profile Page (`/profile`)

- **No profile** → empty state + "Place first order" button
- **Profile exists:**
  - Editable name + preferred delivery area (same button grid as Checkout)
  - Phone shown read-only (identity key)
  - Save button appears only when values differ from saved profile
  - "Clear Saved Profile" link at bottom
- **Order history** — merges `GET /api/customer/orders/:phone` + `dhaba_order_history` localStorage
  - API wins on conflict (same orderId)
  - Sorted newest first
  - Each card shows type badge, date, item preview, total
  - **Reorder** button rebuilds cart and navigates to `/cart`
  - API error → fallback to localStorage-only data with warning indicator

---

## Dashboard (`/dashboard`)

- Shows **"Welcome back, [FirstName]!"** when `profile` exists, otherwise generic welcome
- Shows **"Profile & Orders"** link when profile exists → navigates to `/profile`

---

## SSE (Real-Time Order Tracking)

`GET /api/customer/order/:id/stream` — EventSource in `OrderConfirmation.tsx`:
- Polls every 3 seconds
- Closes after 10 minutes of inactivity
- Events: `{ orderStatus, paymentStatus?, itemsUpdated? }`
- `itemsUpdated: true` shows banner: "Some items were adjusted by the kitchen"

---

## i18n (`i18n/translations.ts`)

Both `en` and `hi` objects. Key groups:
- `menu.*`, `cart.*`, `checkout.*`, `orders.*`, `order.*` (confirmation), `dashboard.*`
- `profile.*` — profile page strings
- `offline.*` — offline screen (shows `availableTimeStart`–`availableTimeEnd` from flags)
- `footer.*`, `contact.*`, `privacy.*`, `terms.*`, `refund.*`

**Interpolation:** `t('key', { name: 'Raj' })` replaces `{name}` in the string.

---

## Design System (Tailwind tokens)

| Token | Color | Use |
|---|---|---|
| `dhaba-accent` | Amber | Primary brand, CTAs |
| `dhaba-success` | Green | Order ready, completed |
| `dhaba-danger` | Red | Cancelled, errors |
| `dhaba-warning` | Amber | Pending state |
| `dhaba-muted` | Grey | Secondary text |
| `dhaba-text` | — | Primary text |
| `dhaba-surface` | — | Card backgrounds |
| `dhaba-bg` | — | Page background |
| `dhaba-border` | — | Dividers |

**Utility classes:** `glass-card`, `glass-input`, `btn-primary`, `shadow-glow`

---

## CartContext (`context/CartContext.tsx`)

```typescript
{
  items, committedItems,          // editable + locked items
  orderId,                        // active order ID (locks cart after dine-in placement)
  orderType, tableNo,
  customerDetails, deliveryAddress, specialInstructions,
  bill, addOnBill, totalItems,
  addItem, removeItem, updateQuantity,
  clearCart, lockCart,
  setOrderType, setCustomerDetails, setDeliveryAddress, setSpecialInstructions
}
```

- **Session persistence key:** `dhaba_active_order` (sessionStorage)
- `lockCart(orderId, items)` → called after dine-in order placed; enables add-more flow
- `committedItems` = batch 1 (original order); new `items` = batch 2+
