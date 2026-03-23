# Dhaba Customer Ordering App — Spec & Build Guide

> Mobile-first web app where anyone in the local area scans a QR code (on a poster, pamphlet, table, or storefront), browses the menu, and places an order — which flows directly into the Dhaba POS system.

---

## Concept

QR codes are printed on:
- **Posters** around the neighborhood / colony
- **Pamphlets** distributed locally
- **Tables** inside the dhaba (dine-in)
- **Storefront** / front door
- **Visiting cards**

Customers scan → get the menu on their phone → pick how they want their order (dine-in / takeaway / delivery) → place the order → staff sees it in the POS immediately.

**This replaces phone calls and in-person order-taking for local customers.**

---

## Order Types

| Type | Who uses it | What they provide |
|---|---|---|
| **Dine-in** | Customer already at a table inside | Nothing extra — table number auto-read from QR URL |
| **Takeaway / Pickup** | Local customer who'll come pick up | Name + phone |
| **Delivery** | Local customer ordering from home/office | Name + phone + delivery address |

The QR URL encodes the order type:

```
Dine-in table 4:    https://order.yourdhaba.com/?type=dine-in&table=4
Takeaway poster:    https://order.yourdhaba.com/?type=takeaway
Delivery poster:    https://order.yourdhaba.com/?type=delivery
Generic (user picks): https://order.yourdhaba.com/
```

If no `type` param → show the **OrderType selector screen** first.

---

## How It Connects to the POS

The customer app calls the **same Express backend** that the POS desktop app uses. No new server needed.

| What customer app needs | Existing POS API |
|---|---|
| Browse menu | `GET /api/dishes` |
| Place order | `POST /api/order` (needs public variant — see Phase 2) |
| Track order status | `GET /api/order/:id` |
| Table number | Encoded in QR URL param |

**Phase 1:** Order submission is **mocked locally** (no backend call). Everything else (browsing dishes) uses the real API if available, otherwise uses a bundled static menu snapshot as fallback.

**Phase 2:** Backend adds `POST /api/order/public` (no JWT) and the mock is swapped out for the real call.

---

## Tech Stack

| | Choice | Reason |
|---|---|---|
| Framework | React 18 + Vite | Same as POS frontend |
| Styling | Tailwind CSS | Same design tokens — consistent brand |
| State | Zustand | Lightweight, no boilerplate |
| Data fetching | TanStack Query | Same as POS |
| Animation | Framer Motion | Same as POS |
| Routing | React Router v7 | Same as POS |
| Icons | react-icons | Same as POS |
| Toasts | Notistack | Same as POS |
| Hosting | Vercel / Netlify | Free static deploy |

---

## Project Structure

```
customer-app/
├── public/
│   └── logo.png
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                        design tokens (copied from POS)
│   ├── pages/
│   │   ├── Splash.tsx                   parse URL → detect order type + table
│   │   ├── OrderTypeSelector.tsx        pick: Dine-in / Takeaway / Delivery
│   │   ├── Menu.tsx                     browse + filter dishes
│   │   ├── Cart.tsx                     review, customer details, place order
│   │   ├── OrderConfirmed.tsx           success screen
│   │   └── OrderStatus.tsx             live status tracker
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx               logo + order type badge + table/mode indicator
│   │   │   └── BottomCartBar.tsx        sticky: item count + total + checkout CTA
│   │   ├── menu/
│   │   │   ├── CategoryTabs.tsx         horizontal scrollable category pills
│   │   │   ├── DishCard.tsx             image, veg badge, name, price, add button
│   │   │   ├── DishDetailSheet.tsx      bottom sheet: variants, qty, add to cart
│   │   │   └── SearchBar.tsx            debounced search
│   │   ├── cart/
│   │   │   ├── CartItem.tsx             row: thumb + name + variant + qty controls + price
│   │   │   ├── BillSummary.tsx          subtotal / tax / roundoff / total
│   │   │   ├── CustomerDetailsForm.tsx  name, phone (always), address (delivery only)
│   │   │   └── OrderTypeChip.tsx        small badge showing current mode
│   │   ├── order/
│   │   │   ├── StatusStepper.tsx        In Progress → Ready → Completed/Out for Delivery
│   │   │   └── OrderedItemsList.tsx     read-only item list
│   │   └── shared/
│   │       ├── VegBadge.tsx             Indian food type indicator
│   │       ├── ImageWithFallback.tsx
│   │       └── FullScreenLoader.tsx
│   ├── store/
│   │   ├── cartStore.ts                 Zustand — items, add/update/remove/clear
│   │   └── sessionStore.ts             Zustand — orderType, tableNo, address, orderId
│   ├── api/
│   │   ├── client.ts                    Axios instance → VITE_API_URL
│   │   ├── dishes.ts                    getDishes(), with static fallback
│   │   └── orders.ts                    placeOrder() mock → real, getOrderStatus()
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── parseUrl.ts                  read type + table from URL params
│   │   ├── dishImage.ts                 getDishImage() — same as POS
│   │   └── bill.ts                      calculateBill() — mirrors POS logic
│   └── constants/
│       └── index.ts                     TAX_RATE, fallback menu, delivery radius note
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

---

## User Flows

### Flow A — Dine-in (table QR inside dhaba)
```
Scan QR: ?type=dine-in&table=4
  → Splash (auto-detect) → skip selector
  → Menu (header shows "Table 4 · Dine-in")
  → Cart (no address field, minimal details)
  → Place Order → OrderConfirmed → OrderStatus
```

### Flow B — Takeaway (poster QR / storefront)
```
Scan QR: ?type=takeaway
  → Splash → skip selector
  → Menu (header shows "Takeaway")
  → Cart (name + phone required)
  → Place Order → OrderConfirmed ("Ready in ~20 min, come pick up")
  → OrderStatus
```

### Flow C — Delivery (pamphlet QR)
```
Scan QR: ?type=delivery
  → Splash → skip selector
  → Menu (header shows "Delivery")
  → Cart (name + phone + address required)
  → Place Order → OrderConfirmed ("We'll deliver to your address")
  → OrderStatus (status changes to "Out for Delivery")
```

### Flow D — Generic QR (no type param)
```
Scan QR: https://order.yourdhaba.com/
  → Splash → OrderTypeSelector
  → User picks Dine-in (enters table number manually) / Takeaway / Delivery
  → Menu → Cart → ... same as above
```

---

## Pages — Detailed Spec

### `Splash.tsx`
- Shows dhaba logo full-screen for ~1s
- Calls `parseUrl()` → sets `orderType` + `tableNo` in `sessionStore`
- Starts `getDishes()` prefetch in background
- If `type` param present → redirect to `/menu`
- If no `type` param → redirect to `/select-type`
- If dishes fail to load → use static fallback menu (`constants/index.ts`)

### `OrderTypeSelector.tsx`
- Three large tap cards:
  - **Dine-in** — "I'm at a table" — fork icon
  - **Takeaway** — "I'll pick it up" — bag icon
  - **Delivery** — "Deliver to me" — scooter icon
- Dine-in card shows a number input: "Enter your table number"
- On confirm → saves to `sessionStore` → navigate to `/menu`

### `Menu.tsx`
- **Header:** Dhaba name + order-type chip (e.g. "Table 4 · Dine-in" | "Takeaway" | "Delivery")
- **Search bar:** Debounced 300ms, searches name + category
- **Category tabs:** Horizontal scroll — derived live from dish data (All / Roti / Rice / Sabji / Drinks / ...)
- **Dish grid:** 2 columns mobile, 3 columns tablet+
  - Each card: dish image, veg indicator, name (2-line clamp), "from ₹X", `+` button
  - Single variant → `+` adds directly with count badge
  - Multiple variants → opens `DishDetailSheet`
  - `isAvailable: false` → greyed out, non-interactive, "Unavailable" chip
- **Bottom cart bar:** Hidden when cart empty. `{N} items · ₹{total} → Checkout`

### `DishDetailSheet.tsx`
- Framer Motion `AnimatePresence` slide-up bottom sheet
- Backdrop tap / swipe-down to close
- Dish image (full width, aspect-ratio 16/9)
- Name, veg badge, description
- Variant pill selector (same as POS `MenuItem`)
- Quantity stepper
- "Add to Cart — ₹{price}" CTA (full width)

### `Cart.tsx`
- Back button → `/menu`
- **Order type chip** at top (e.g. "Delivery to your address")
- Item rows: thumbnail, name, variant, `−` qty `+`, line total
- Empty cart → illustration + "Browse Menu" CTA
- Bill summary block: subtotal / GST 5% / roundoff / **Total**
- **Customer details form:**
  - Name (required for takeaway + delivery, optional for dine-in)
  - Phone (required for takeaway + delivery, optional for dine-in)
  - Address textarea (required for delivery, hidden for others)
  - Special instructions (optional, all types)
- **"Place Order"** — full-width gradient button, disabled until required fields filled

### `OrderConfirmed.tsx`
- CSS keyframe checkmark animation (no Lottie dep)
- Title changes by type:
  - Dine-in: "Order placed! Food is being prepared."
  - Takeaway: "Order placed! Come pick up in ~20 min."
  - Delivery: "Order placed! We'll deliver to your address."
- Shows order token: `#A3F2C1`
- "Track Order →" CTA

### `OrderStatus.tsx`
- Polls `GET /api/order/:id` every 15s (stops on Completed)
- Stepper adapts by order type:
  - Dine-in:  `In Progress → Ready → Served`
  - Takeaway: `In Progress → Ready for Pickup → Picked Up`
  - Delivery: `In Progress → Out for Delivery → Delivered`
- Read-only item list + bill total
- `Ready` state → green banner "Your order is ready!"
- `Completed` state → "Thank you! Visit again."

---

## State Management (Zustand)

### `cartStore.ts`
```typescript
interface CartItem {
  id: string;
  name: string;
  variantSize: string;
  pricePerQuantity: number;
  quantity: number;
  price: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'price'>) => void;  // upsert by id+variantSize
  updateQty: (id: string, variantSize: string, qty: number) => void;
  removeItem: (id: string, variantSize: string) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}
// persist: localStorage key "dhaba_cart"
```

### `sessionStore.ts`
```typescript
type OrderType = 'dine-in' | 'takeaway' | 'delivery';

interface SessionStore {
  orderType: OrderType | null;
  tableNo: number | null;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  specialInstructions: string;
  orderId: string | null;

  setOrderType: (type: OrderType) => void;
  setTable: (n: number) => void;
  setCustomer: (name: string, phone: string) => void;
  setDeliveryAddress: (address: string) => void;
  setInstructions: (text: string) => void;
  setOrderId: (id: string) => void;
  clear: () => void;
}
// persist: sessionStorage key "dhaba_session"
```

---

## URL Parsing (`src/utils/parseUrl.ts`)

```typescript
export type OrderType = 'dine-in' | 'takeaway' | 'delivery';

export interface ParsedParams {
  orderType: OrderType | null;
  tableNo: number | null;
}

export const parseUrl = (): ParsedParams => {
  const p = new URLSearchParams(window.location.search);
  const rawType = p.get('type') as OrderType | null;
  const orderType = ['dine-in', 'takeaway', 'delivery'].includes(rawType ?? '')
    ? rawType
    : null;
  const tableNo = p.get('table') ? parseInt(p.get('table')!, 10) : null;
  return { orderType, tableNo };
};
```

**QR Code URLs to generate and print:**

| Where to place | URL |
|---|---|
| Table 1 | `https://order.yourdhaba.com/?type=dine-in&table=1` |
| Table 2 | `https://order.yourdhaba.com/?type=dine-in&table=2` |
| … (one per table) | … |
| Takeaway poster | `https://order.yourdhaba.com/?type=takeaway` |
| Delivery pamphlet | `https://order.yourdhaba.com/?type=delivery` |
| Visiting card / generic | `https://order.yourdhaba.com/` |

---

## API Layer

### `client.ts`
```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});
```

### `dishes.ts`
```typescript
export const getDishes = async (): Promise<Dish[]> => {
  try {
    const res = await api.get<{ data: Dish[] }>('/api/dishes');
    return res.data.data;
  } catch {
    // Phase 1 fallback — return static snapshot if backend unreachable
    return STATIC_MENU_FALLBACK;
  }
};
```

`STATIC_MENU_FALLBACK` in `constants/index.ts` — a hardcoded subset of the menu so the app works even without a running backend.

### `orders.ts`
```typescript
export interface PlaceOrderPayload {
  orderType: 'dine-in' | 'takeaway' | 'delivery';
  tableNo?: number;
  customerDetails: { name: string; phone: string; guests: number };
  deliveryAddress?: string;
  specialInstructions?: string;
  items: CartItem[];
  bills: BillBreakdown;
}

// ── Phase 1: mock ──────────────────────────────────────────
export const placeOrder = async (payload: PlaceOrderPayload): Promise<string> => {
  await new Promise(r => setTimeout(r, 900));
  const id = Math.random().toString(36).slice(-8).toUpperCase();
  localStorage.setItem('dhaba_last_order', JSON.stringify({ id, ...payload }));
  return id;
};

// ── Phase 2: real API (swap in when backend ready) ─────────
// export const placeOrder = async (payload: PlaceOrderPayload): Promise<string> => {
//   const res = await api.post<{ data: { _id: string } }>('/api/order/public', {
//     orderType: payload.orderType,
//     customerDetails: payload.customerDetails,
//     table: payload.tableNo,
//     deliveryAddress: payload.deliveryAddress,
//     specialInstructions: payload.specialInstructions,
//     items: payload.items,
//     bills: payload.bills,
//     amountPaid: 0,
//     paymentMethod: 'Cash',
//   });
//   return res.data.data._id;
// };

export const getOrderStatus = (orderId: string) =>
  api.get<{ data: { orderStatus: string; items: CartItem[] } }>(`/api/order/${orderId}`);
```

---

## Bill Calculation (`src/utils/bill.ts`)

Mirrors POS `Bill.tsx` exactly — totals always match what staff sees.

```typescript
const TAX_RATE = 0.05;

export interface BillBreakdown {
  subtotal: number; tax: number; roundoff: number; total: number;
}

export const calculateBill = (items: CartItem[], discount = 0): BillBreakdown => {
  const subtotal = items.reduce((s, i) => s + i.price, 0) - discount;
  const tax      = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const raw      = subtotal + tax;
  const rounded  = Math.round(raw);
  const roundoff = parseFloat((rounded - raw).toFixed(2));
  return { subtotal, tax, roundoff, total: rounded };
};
```

---

## Design Tokens

Exact same CSS variables as the POS (`pos-frontend/src/index.css`):

```css
:root {
  --dhaba-bg:            15 12% 7%;
  --dhaba-surface:       20 10% 12%;
  --dhaba-card:          18 10% 14%;
  --dhaba-surface-hover: 20 10% 16%;
  /* + accent, success, danger, warning, muted, text, border */
}
```

Extra mobile tokens:
```css
  --bottom-safe: env(safe-area-inset-bottom);
```

Custom Tailwind classes to copy from POS:
- `glass-card` — backdrop blur surface
- `glass-input` — form input style
- `bg-gradient-warm` — amber gradient (CTA buttons)
- `shadow-glow` — glow effect on hover
- `font-display` — display heading font

**Mobile UX rules:**
- All tap targets ≥ 44×44px
- Bottom sheet max-height 85vh, scroll inside
- Sticky bars: `padding-bottom: calc(1rem + var(--bottom-safe))`
- Prefer `:active` over `:hover` for feedback

---

## Connecting to the POS (Phase 2)

Only **one backend change** needed. Add to `pos-backend`:

**`POST /api/order/public`** — no JWT required
- Validate: `tableNo` exists + is `Available` (for dine-in)
- Set: `amountPaid: 0`, `paymentStatus: "Pending"`, `orderStatus: "In Progress"`
- Add fields to orders table: `order_type` (dine-in/takeaway/delivery), `delivery_address`
- Rate limit: 5 req/min per IP
- Returns: `{ data: { _id: string } }`

**Make these existing routes public (no JWT):**
- `GET /api/dishes` — customers need to see the menu
- `GET /api/order/:id` — customers need to track status

**That's it.** The POS Orders page will automatically show the new orders as they come in via React Query polling.

### What the POS staff sees per order type

| Order type | POS shows |
|---|---|
| Dine-in | Table number + "Dine-in" tag, `paymentStatus: Pending` |
| Takeaway | Customer name + phone + "Takeaway" tag |
| Delivery | Customer name + phone + address + "Delivery" tag |

---

## Environment Variables

```env
# .env.local (dev)
VITE_API_URL=http://localhost:5002
VITE_DHABA_NAME="Param's Dhaba"
VITE_DHABA_TAGLINE="Order from anywhere"
VITE_CURRENCY_SYMBOL=₹

# .env.production
VITE_API_URL=https://your-backend-url.com
```

---

## Deployment

```bash
cd customer-app
npm run build          # outputs dist/
# Deploy dist/ to Vercel/Netlify — takes 2 minutes
```

**CORS:** Add customer app domain to POS backend `FRONTEND_URL` (or allow multiple origins).

---

## Files to Copy from POS Frontend

| From `pos-frontend/src/` | To `customer-app/src/` | What |
|---|---|---|
| `assets/images/` | `assets/images/` | All 28 local dish images |
| `utils/index.ts` | `utils/dishImage.ts` | `getDishImage()` + image imports |
| `index.css` | `index.css` | Design tokens + glass-card/input |
| `tailwind.config.js` | `tailwind.config.js` | Dhaba color system |
| `types/index.ts` | `types/index.ts` | Dish, CartItem, Order types |

---

## Phase Comparison

| Feature | Phase 1 | Phase 2 |
|---|---|---|
| Browse menu | ✅ Real API + static fallback | ✅ Same |
| Dine-in ordering | 🟡 Mocked | ✅ Real |
| Takeaway ordering | 🟡 Mocked | ✅ Real |
| Delivery ordering | 🟡 Mocked | ✅ Real |
| Order status tracking | 🟡 Static success screen | ✅ Live polling |
| Staff marks Ready | ❌ | ✅ Customer sees it |
| Payment online | ❌ | ✅ Razorpay |
| Customer ledger link | ❌ | ✅ Phone → auto-link |
| Admin disables dish | ❌ | ✅ `isAvailable` hides it |
| Delivery radius guard | ❌ | ✅ Area pincode check |
