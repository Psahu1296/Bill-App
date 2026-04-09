# WhatsApp Business Ordering Integration — Future Reference

## Overview

Customers order directly via WhatsApp — browse catalog, select items, pay, and order appears in the admin app in real-time.

**Status:** Not yet implemented — kept for future reference.

---

## What's Already Ready (Zero Changes Needed)

- `POST /api/customer/order` — public API, no auth, triggers admin SSE notifications
- PhonePe + Razorpay webhook handlers auto-mark orders "Paid"
- Admin app shows orders in real-time
- Customer tracking by phone number built in
- `GET /api/customer/dishes` — public menu API

---

## Prerequisites

1. **Meta Business Account** — verified on Meta Business Manager
2. **WhatsApp Business API access** — via Meta Cloud API (free) or a BSP (paid, easier)
   - Recommended BSPs for India: **WATI**, **Interakt**, **AiSensy** (₹3,000–8,000/month)
3. **Dedicated phone number** — NOT already on WhatsApp consumer app
4. **Public HTTPS URL** — for webhook (Cloudflare tunnel `*.sahu-dhaba-pos.co.in` is already in CORS allowlist)

---

## Two Implementation Routes

### Route 1: BSP (Business Solution Provider) — Fast, No-Code

Use **WATI or Interakt** — Indian BSPs that handle everything:
- WhatsApp Business API setup
- Drag-and-drop conversation flow builder
- Native catalog + button messages
- Payment link sending
- Just configure their webhook to hit your existing `POST /api/customer/order`

**Cost:** ₹3,000–8,000/month  
**Time to go live:** Days

### Route 2: Custom `whatsapp-service` — Full Control

New Node.js + TypeScript service in the monorepo.

---

## Architecture (Custom Route)

```
Customer (WhatsApp) 
    ↓  message
WhatsApp Business API (Meta Cloud)
    ↓  webhook POST
[NEW] whatsapp-service  ←→  Session Store (SQLite)
    ↓  REST calls
Existing pos-backend Customer API
    ↓  SSE notification
Admin POS Frontend (sees order in real-time)
    ↓  payment link
Customer pays via PhonePe link
    ↓  webhook
Existing PhonePe webhook → marks order "Paid"
    ↓  WhatsApp message back
Customer: "Order confirmed, being prepared!"
```

---

## New Service: `whatsapp-service/`

| File | Purpose |
|---|---|
| `src/index.ts` | Express server, webhook verification |
| `src/webhookHandler.ts` | Receive & verify WhatsApp webhook events |
| `src/messageProcessor.ts` | Route messages by type (text, button, list reply) |
| `src/flowEngine.ts` | Conversation FSM |
| `src/sessionManager.ts` | Per-phone session store |
| `src/whatsappClient.ts` | Send messages via Meta Cloud API |
| `src/menuBuilder.ts` | Fetch dishes → build interactive list messages |
| `src/orderService.ts` | Call `POST /api/customer/order` + PhonePe initiate |

---

## Conversation Flow (State Machine)

```
IDLE
  → "hi" / "menu" / "order"
SHOW_CATEGORIES
  → Customer selects category
SHOW_ITEMS
  → Customer selects item + quantity
CART
  → "Add more" → SHOW_CATEGORIES
  → "Checkout" → CONFIRM_ORDER
CONFIRM_ORDER
  → Customer types name + delivery/takeaway choice
CREATE_ORDER
  → POST /api/customer/order (paymentStatus: "Pending")
  → POST /api/payment/phonepe/initiate → get payment link
AWAITING_PAYMENT
  → Send payment link to customer
  → PhonePe webhook fires → order marked "Paid"
  → Send "Payment received! Order #X is being prepared"
ORDER_LIVE
  → Poll GET /api/customer/order/:id
  → Send "Your order is Ready!" when status = "Ready"
```

---

## WhatsApp Message Types

| Scenario | Type |
|---|---|
| Menu categories | Interactive List Message |
| Item selection | Interactive Button Message |
| Cart summary | Formatted Text |
| Confirm/Cancel | Interactive Button Message |
| Payment link | Text with URL |
| Order status | Text / Template Message |

---

## Payment Flow

**PhonePe (Recommended for India):**
1. `POST /api/payment/phonepe/initiate` → get `redirectUrl`
2. Send URL as WhatsApp message to customer
3. Customer pays on PhonePe
4. `POST /api/payment/phonepe/callback` auto-updates order to "Paid"
5. Bot sends WhatsApp confirmation to customer

---

## Minimal Backend Changes Needed

1. **CORS** — add whatsapp-service URL to `pos-backend/app.ts` allowlist
2. **PhonePe callback notification** — emit event or call callback URL when payment completes, so bot can send WhatsApp message to customer

---

## Environment Variables (whatsapp-service)

```env
WHATSAPP_TOKEN=<Meta Cloud API token>
WHATSAPP_PHONE_NUMBER_ID=<phone number ID from Meta>
WHATSAPP_VERIFY_TOKEN=<your webhook verification token>
POS_BACKEND_URL=https://your-tunnel.sahu-dhaba-pos.co.in
```

---

## Hosting Options

| Option | Cost | Notes |
|---|---|---|
| Railway / Render | ~$5/mo | Easiest for custom service |
| WATI / Interakt BSP | ₹3,000–8,000/mo | No-code, fastest to launch |
| Cloudflare Workers | Free tier | Lightweight, stateless only |

---

## Implementation Steps (DIY)

1. Create Meta Business account + WhatsApp Business API access
2. Get dedicated phone number
3. Deploy `whatsapp-service` to Railway/Render (public HTTPS URL)
4. Register webhook URL with Meta
5. Build conversation FSM
6. Test with Meta sandbox number
7. Go live — update backend CORS

---

## Verification Checklist

- [ ] Send "hi" to WhatsApp number → receive menu
- [ ] Select items → receive cart summary
- [ ] Checkout → receive PhonePe payment link
- [ ] Complete payment → receive order confirmation
- [ ] Admin app shows order in real-time (Pending → Paid)
