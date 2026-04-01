# Customer App — Complete Context for New Agent

> **Customer app:** `/Volumes/DevSSD/projects/sahu-family-dhaba-creator/`  
> **Backend + POS:** `/Volumes/DevSSD/projects/Bill-App/`  
> This document covers what exists, what needs to change, and why.

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

**Payment model (unchanged, keep as-is):**
- Delivery = prepaid via PhonePe (already implemented)
- Dine-in / Takeaway = post-paid cash at counter (already implemented)

---

## Change 1 — 4-State Order Flow (Zomato-style)

### Why
Orders currently go straight to "In Progress" (cooking). Owner wants a Pending → accept step so the kitchen can review and optionally edit items before committing.

### New OrderStatus type

**Current** (`src/types/index.ts`):
```typescript
export type OrderStatus = 'In Progress' | 'Ready' | 'Completed' | 'Cancelled';
```

**Required:**
```typescript
export type OrderStatus = 'Pending' | 'Cooking' | 'Ready' | 'Completed' | 'Cancelled';
```

### Status display mapping (for `src/pages/OrderConfirmation.tsx`)

| Status | Icon | Color | Customer label | Note |
|---|---|---|---|---|
| `Pending` | Clock/Hourglass | warning (amber) | "Confirming your order..." | show explanation card |
| `Cooking` | ChefHat | accent (amber) | "Kitchen is preparing your food" | show ETA "~20 min" |
| `Ready` | CheckCircle | success (green) | "Your order is ready!" | delivery → "Out for Delivery!" |
| `Completed` | CheckCircle | success (green) | "Thank you! Visit again." | |
| `Cancelled` | XCircle | danger (red) | "Order cancelled" | |

### Pending explanation card (show while status = Pending)
> "We're reviewing your order. We'll start cooking as soon as it's confirmed — usually within 2 minutes."

### ETA hint (show after status = Cooking)
Static text: "Estimated time: ~20 minutes"

### `itemsUpdated` banner (SSE pushes `itemsUpdated: true`)
Show banner: "Some items were adjusted by the kitchen"

### 4-Node Stepper (replace current 3-dot stepper)

Current stepper code (inline in `OrderConfirmation.tsx` lines ~135–148):
```typescript
{(['In Progress', 'Ready', 'Completed'] as const).map(...)}
```

Replace with 4 nodes: `Pending → Cooking → Ready → Completed`
- Active node: pulse animation
- Completed nodes: checkmark icon fill in success color
- Future nodes: dimmed surface color
- Cancelled: all nodes reset to inactive

### i18n keys to add (`src/i18n/translations.ts`, both `en` and `hi`)
- `order.pending` — "Confirming your order..."
- `order.cooking` — "Kitchen is preparing your food"
- `order.pendingDescription` — "We're reviewing your order. Usually confirmed within 2 minutes."
- `order.outForDelivery` — "Out for Delivery!"
- `order.etaText` — "Estimated time: ~20 min"
- `order.itemsAdjusted` — "Some items were adjusted by the kitchen"

---

## Change 2 — Order History + Reorder

### Why
`/orders` page currently only shows 1 active order. Owner wants past orders visible with a reorder button.

### localStorage schema (key: `dhaba_order_history`)
```typescript
interface OrderHistoryEntry {
  orderId: string;
  date: string;          // ISO timestamp
  orderType: OrderType;
  total: number;
  items: CartItem[];     // full items for reorder
  customerName: string;
}
type OrderHistory = OrderHistoryEntry[];
```

### `src/pages/Checkout.tsx` — save on success
In both `placeOrderMutation.onSuccess` and `phonePayMutation.onSuccess`, append to `dhaba_order_history`:
```typescript
const entry: OrderHistoryEntry = {
  orderId: result._id,
  date: new Date().toISOString(),
  orderType: orderType!,
  total: bill.total,
  items,
  customerName: name.trim(),
};
const history = JSON.parse(localStorage.getItem('dhaba_order_history') || '[]');
history.unshift(entry);             // newest first
localStorage.setItem('dhaba_order_history', JSON.stringify(history.slice(0, 20))); // keep last 20
```

### `src/pages/Orders.tsx` — full history + reorder
- Active order section at top (unchanged: from CartContext `orderId`)
- Past orders section below: read from `dhaba_order_history`
- Each past order card: date, orderType badge, items preview (first 2 + "+N more"), total
- **"Reorder" button** on each card:
  - For each item in entry.items, call `addItem` from CartContext
  - Navigate to `/cart`
- Empty state unchanged (no past orders message)

---

## SSE (Real-Time Updates) — Already Working, No Changes Needed

`GET /api/customer/order/:id/stream` already exists and sends:
```json
{ "orderStatus": "Pending", "paymentStatus": "Pending" }
// on admin accept:
{ "orderStatus": "Cooking" }
// on items edited by staff:
{ "orderStatus": "Cooking", "itemsUpdated": true }
// on mark ready:
{ "orderStatus": "Ready" }
```

The `EventSource` hook in `OrderConfirmation.tsx` already handles this — just update the display logic for new states.

---

## Backend Changes Required (pos-backend)

### `pos-backend/controllers/customerController.ts` (line 62)
```typescript
// BEFORE:
orderStatus: "In Progress",
// AFTER:
orderStatus: "Pending",
```

### `pos-backend/db/schema.ts`
Add `"Pending"` and `"Cooking"` wherever `order_status` values are validated/constrained.

---

## POS Changes Required (pos-frontend)

### `pos-frontend/src/types/index.ts` (line 66)
```typescript
// BEFORE:
export type OrderStatus = 'In Progress' | 'Ready' | 'Completed' | 'Cancelled';
// AFTER:
export type OrderStatus = 'Pending' | 'Cooking' | 'Ready' | 'Completed' | 'Cancelled';
```

### `pos-frontend/src/components/orders/OrderStatusSwitcher.tsx`
- Pending orders: **Accept** button (→ Cooking) + **Reject** button (→ Cancelled)
- Cooking orders: "Mark Ready" button (→ Ready)
- Ready orders: "Mark Done" button (→ Completed)
- Remove "In Progress" everywhere

### `pos-frontend/src/pages/Orders.tsx`
Add **"New Orders"** section at top:
- Shows all `Pending` orders prominently with pulsing amber UI
- Each card: customer name, order type, item list, total
- Accept → moves to Cooking (can open `/menu?orderId=X` to edit items first)
- Reject → moves to Cancelled with confirmation

### `pos-frontend/src/components/orders/OrderCard.tsx`
Add pulsing amber "New Order" badge for `Pending` status (similar to existing notification glow).

---

## Key Files Reference

| File | Purpose |
|---|---|
| `src/types/index.ts` | OrderStatus type — UPDATE |
| `src/pages/OrderConfirmation.tsx` | Order tracking page — UPDATE (stepper, labels) |
| `src/pages/Checkout.tsx` | Order placement — UPDATE (save to history) |
| `src/pages/Orders.tsx` | Orders list — UPDATE (full history + reorder) |
| `src/i18n/translations.ts` | EN + HI strings — UPDATE (add new keys) |
| `src/context/CartContext.tsx` | Cart state — READ (need `addItem` for reorder) |
| `src/services/api.ts` | API calls — READ only |

---

## Design System (already correct, no changes)

Tailwind color classes: `dhaba-accent` (amber), `dhaba-success` (green), `dhaba-danger` (red), `dhaba-warning` (amber), `dhaba-muted` (grey)  
Utilities: `glass-card`, `glass-input`, `btn-primary`, `shadow-glow`

Use existing tokens throughout — no new CSS needed.
