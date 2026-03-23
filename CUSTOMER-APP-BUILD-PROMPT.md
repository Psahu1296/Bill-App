# Build: Dhaba Customer Ordering Web App

Mobile-first React + Vite + TypeScript app. Customers scan a QR code → browse menu → pick order type (dine-in / takeaway / delivery) → place order → track status.

Use **TanStack Query** for all server state. Tailwind, shadcn only.

---

## Two Order Scenarios

| | Dine-in / Takeaway | Delivery |
|---|---|---|
| Who | Customer at the dhaba or picking up | Local customer ordering from home |
| Payment | **Pay later** — cash at table / counter | **Prepaid online** — Razorpay before order is placed |
| `amountPaid` | `0` | `bills.total` |
| `paymentMethod` | `"Cash"` | `"Online"` |
| `paymentStatus` | `"Pending"` | `"Paid"` |

**Delivery flow:** Cart → Customer details + address → **Payment (Razorpay)** → order placed on payment success → Confirmed → Track status.
**Dine-in / Takeaway flow:** Cart → Customer details → Place Order directly → Confirmed → Track status.

---

## Backend API

Base URL: `import.meta.env.VITE_API_URL` · No auth required.

```
GET  /api/dishes                      → { data: Dish[] }
POST /api/payment/create-order        → { data: { id: string, amount: number, currency: string } }
POST /api/payment/verify-payment      → { data: { success: boolean } }
POST /api/order/public                → { data: { _id: string } }   ← Phase 2, mock for now
GET  /api/order/:id                   → { data: Order }
```

**POST /api/payment/create-order body:** `{ amount: number }` (in rupees, backend converts to paise)

**POST /api/payment/verify-payment body:**
```json
{ "razorpay_order_id": "string", "razorpay_payment_id": "string", "razorpay_signature": "string" }
```

**POST /api/order/public body:**
```json
{
  "orderType": "dine-in | takeaway | delivery",
  "tableNo": 4,
  "customerDetails": { "name": "string", "phone": "string", "guests": 1 },
  "deliveryAddress": "string (delivery only)",
  "specialInstructions": "string (optional)",
  "items": [{ "id": "string", "name": "string", "variantSize": "string", "quantity": 1, "pricePerQuantity": 60, "price": 60 }],
  "bills": { "subtotal": 100, "tax": 5, "roundoff": 0, "total": 105 },
  "amountPaid": 105,
  "paymentMethod": "Online",
  "paymentStatus": "Paid",
  "paymentData": { "razorpay_order_id": "...", "razorpay_payment_id": "...", "razorpay_signature": "..." }
}
```
For dine-in/takeaway: `amountPaid: 0`, `paymentMethod: "Cash"`, `paymentStatus: "Pending"`, no `paymentData`.

**Razorpay on the frontend:**
- Load Razorpay checkout script: `https://checkout.razorpay.com/v1/checkout.js`
- Call `createOrder(amount)` → get Razorpay order ID → open `window.Razorpay({ key: VITE_RAZORPAY_KEY_ID, ... })`
- On `handler` callback: call `verifyPayment(ids)` → on success → call `placeOrder(payload)` with `paymentStatus: "Paid"`
- On payment failure/dismiss: show error, stay on cart page

**Mock order until backend ready** — generate random ID, save to localStorage, resolve after 800ms. Comment: `// PHASE 2: replace with real API`.

**QR URL params:** `?type=dine-in&table=4` · `?type=takeaway` · `?type=delivery` · no param = show selector screen.

**Env vars:** `VITE_API_URL` · `VITE_RAZORPAY_KEY_ID`

---

## Data Types

```ts
export type OrderType   = 'dine-in' | 'takeaway' | 'delivery'
export type OrderStatus = 'In Progress' | 'Ready' | 'Completed' | 'Cancelled'

export interface DishVariant  { size: string; price: number }
export interface Dish         { _id: string; name: string; image?: string; type: 'veg'|'non-veg'; category: string; variants: DishVariant[]; description?: string; isAvailable: boolean }
export interface CartItem     { id: string; name: string; variantSize: string; pricePerQuantity: number; quantity: number; price: number }
export interface BillBreakdown{ subtotal: number; tax: number; roundoff: number; total: number }
export interface Order        { _id: string; orderStatus: OrderStatus; items: CartItem[]; bills: BillBreakdown; customerDetails: { name: string; phone: string } }
export interface RazorpayResult { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
```

---

## `tailwind.config.js`

```js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'dhaba-bg':           'hsl(var(--dhaba-bg))',
        'dhaba-surface':      'hsl(var(--dhaba-surface))',
        'dhaba-card':         'hsl(var(--dhaba-card))',
        'dhaba-surface-hover':'hsl(var(--dhaba-surface-hover))',
        'dhaba-accent':       'hsl(var(--dhaba-accent))',
        'dhaba-success':      'hsl(var(--dhaba-success))',
        'dhaba-danger':       'hsl(var(--dhaba-danger))',
        'dhaba-warning':      'hsl(var(--dhaba-warning))',
        'dhaba-muted':        'hsl(var(--dhaba-muted))',
        'dhaba-text':         'hsl(var(--dhaba-text))',
        'dhaba-border':       'hsl(var(--dhaba-border))',
      },
      fontFamily: { display: ['"Playfair Display"', 'serif'] },
    },
  },
  plugins: [],
}
```

## `src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');

:root {
  --dhaba-bg:            15 12% 7%;
  --dhaba-surface:       20 10% 12%;
  --dhaba-card:          18 10% 14%;
  --dhaba-surface-hover: 20 10% 16%;
  --dhaba-accent:        38 92% 50%;
  --dhaba-accent-dark:   32 90% 42%;
  --dhaba-success:       142 71% 45%;
  --dhaba-danger:        0 84% 60%;
  --dhaba-warning:       38 92% 50%;
  --dhaba-muted:         20 6% 50%;
  --dhaba-text:          30 20% 96%;
  --dhaba-border:        20 8% 22%;
}

* { -webkit-tap-highlight-color: transparent; }

body {
  background-color: hsl(var(--dhaba-bg));
  color: hsl(var(--dhaba-text));
  font-family: 'Inter', sans-serif;
  overscroll-behavior: none;
}

@layer components {
  .glass-card {
    background: hsl(var(--dhaba-surface) / 0.7);
    backdrop-filter: blur(12px);
    border: 1px solid hsl(var(--dhaba-border) / 0.5);
  }
  .glass-input {
    background: hsl(var(--dhaba-surface) / 0.6);
    border: 1px solid hsl(var(--dhaba-border) / 0.4);
    color: hsl(var(--dhaba-text));
  }
  .btn-primary {
    background: linear-gradient(135deg, hsl(var(--dhaba-accent)), hsl(var(--dhaba-accent-dark)));
    color: hsl(var(--dhaba-bg));
    font-weight: 700;
  }
  .btn-primary:active { opacity: 0.85; transform: scale(0.98); }
  .font-display { font-family: 'Playfair Display', serif; }
  .shadow-glow  { box-shadow: 0 0 20px hsl(var(--dhaba-accent) / 0.25); }
}
```
