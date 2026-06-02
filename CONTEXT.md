# Bill-App POS — Inventory Context

Domain language for the smart inventory system. All terms below are canonical — use them exactly in code, PRs, and conversations.

## Language

### Raw Materials

**Raw Material**:
A bulk physical ingredient purchased by weight (kg) — e.g., Fish, Chicken, Rice. Sourced from `ExpensePreset` names with `category: "Raw Material"`.
_Avoid_: Ingredient, item, stock item

**Raw Material Dish**:
A dish whose primary ingredient is a specific Raw Material. Identified by `dish.rawMaterial` (explicit tag) first, then by case-insensitive name match (legacy fallback). Both checks must be tried in order.
_Avoid_: Fish dish, chicken item, ingredient-linked dish

**Consumption Rate**:
The average kg of a Raw Material consumed per Unit sold, derived from closed non-early-restock Stock Cycles. Shows "—" until at least one cycle closes.
_Avoid_: Usage rate, kg per serving, average consumption

**Daily Unit Rate**:
The 14-day rolling average of Units sold per day for a given Raw Material. Used as the velocity input for Stock Prediction.
_Avoid_: Daily plate rate, daily average, sales rate, demand rate

**Unit**:
The base counting measure for a Raw Material's consumption. For materials without a Variant Piece Map, 1 order item = 1 Unit (plate). For materials with a Variant Piece Map (e.g., Fish), Units are pieces — a Full plate = 4 Units, Half = 2 Units, unmapped = 1 Unit.
_Avoid_: Plate, piece, serving (use Unit as the canonical term in code; display label varies per material)

**Variant Piece Map**:
A per-Raw-Material config stored on `ExpensePreset.variantPieceMap` that defines how many Units (pieces) each dish variant contributes. Keys are `variantSize` strings (`"Full"`, `"Half"`) plus `"_default"` as fallback. Absent map = treat every order item as 1 Unit.
_Avoid_: Piece config, serving size map, portion mapping

### Stock Cycles

**Stock Cycle**:
The inventory period that begins when a Raw Material is purchased and ends when the same Raw Material is purchased again. Tracks quantity bought and Units consumed during that window.
_Avoid_: Stock period, inventory batch, replenishment window

**Active Cycle**:
A Stock Cycle with no end date — the current open window for a Raw Material.
_Avoid_: Open cycle, current stock, live batch

**Closed Cycle**:
A Stock Cycle that has ended (next purchase recorded). Has a final `unitsConsumed` count and contributes to Consumption Rate unless flagged as Early Restock.
_Avoid_: Completed cycle, finished batch

**Early Restock**:
A purchase flagged by the admin at purchase time to indicate the previous stock was not yet exhausted. The resulting Closed Cycle is excluded from Consumption Rate calculation.
_Avoid_: Early purchase, premature restock, overflow stock

### Predictions

**Stock Prediction**:
An estimate of how many days the current Active Cycle stock will last, computed as: `quantityKg / (Consumption Rate × Daily Plate Rate)`. Displayed alongside a "plan restock" input.
_Avoid_: Forecast, stock estimate, days remaining

**Restock Recommendation**:
The quantity (kg) the admin should buy to cover a target number of days, computed as: `Daily Plate Rate × target days × Consumption Rate`.
_Avoid_: Buy suggestion, reorder quantity, purchase recommendation

## Relationships

- A **Raw Material** has zero or one **Active Cycle** at any time
- A **Stock Cycle** belongs to exactly one **Raw Material**
- A **Stock Cycle** references exactly one **Expense** (the purchase record)
- A **Raw Material** has zero or more **Raw Material Dishes**
- A **Closed Cycle** contributes to **Consumption Rate** unless `isEarlyRestock: true`
- **Daily Plate Rate** and **Consumption Rate** together produce a **Stock Prediction**

## Example dialogue

> **Dev:** "When admin buys fish again, do we close the old cycle immediately?"
> **Domain expert:** "Yes — the purchase auto-closes the Active Cycle. If admin checks 'early restock,' that Closed Cycle is excluded from the Consumption Rate."

> **Dev:** "What if there's no history yet — no closed cycles?"
> **Domain expert:** "Stock Prediction still shows using Daily Plate Rate alone for days remaining. Consumption Rate shows '—' until first cycle closes."

## Voice Order

**Voice Order**:
A feature that lets the admin speak dish names, variants, and quantities in a single utterance (e.g. "2 dal fry full, 1 chicken curry, 3 roti"). The browser captures speech via Web Speech API, sends the raw transcript text to the backend, which fuzzy-matches against the dish catalogue and returns structured cart items.
_Avoid_: voice input, speech-to-cart, mic order

**Voice Transcript**:
The raw text string produced by the browser's Web Speech API from the admin's spoken utterance. Sent as-is to `POST /api/dishes/voice-parse`.
_Avoid_: audio, speech blob, recording

**Voice Parse Result**:
The backend response from `POST /api/dishes/voice-parse`. Contains three lists: `resolved` (confident matches ready to add to cart), `ambiguous` (query phrase matched multiple dishes above threshold — requires admin confirmation), and `unmatched` (phrases that matched nothing).
_Avoid_: parse response, NLP result

**Resolved Item**:
A voice-parsed cart item where a single dish matched the spoken phrase with confidence above threshold. Has `dish`, `variant` (defaulted via Full → Regular → variants[0]), and `quantity`. Added to cart immediately without confirmation.
_Avoid_: matched item, confirmed item

**Ambiguous Item**:
A voice-parsed phrase that matched multiple dishes above the fuzzy threshold (e.g. "dal" → Dal Fry, Dal Makhani, Dal Tadka). Shown in an inline resolver UI — admin taps one candidate to confirm. Only then added to cart.
_Avoid_: conflict, multi-match, unclear item

**Default Variant**:
The variant automatically selected when the admin does not specify one in the voice utterance. Resolution order: variant with `size === "Full"` → `size === "Regular"` → `variants[0]`.
_Avoid_: fallback variant, auto-variant

## Menu Component Architecture

**MenuContainer**:
The shared orchestrator component for browsing and filtering the dish catalogue. Callback-based — it does not own the cart. Accepts `onAddToCart(dish, variant, qty)` and optional `onAddCustom(name, price)`. Used on the Menu page (wraps Redux dispatch) and past order modals (wraps local state).
_Avoid_: menu panel, dish browser

**Controlled Menu**:
The pattern where `MenuContainer` is stateless about cart destination. The parent decides what happens when a dish is added. Contrast with the old approach where `MenuContainer` dispatched directly to Redux.
_Avoid_: stateless menu, dumb menu

## Flagged ambiguities

- "plates sold" means completed orders (`orderStatus === "Completed"`) only — pending and cancelled orders do not count as consumption.
- "fish dishes" is resolved via two-pass lookup: explicit `dish.rawMaterial` tag first, then name-contains fallback for legacy dishes. Both must be checked.
- "expense" refers to the financial record (`Expense` collection); "stock cycle" refers to the inventory record (`StockCycle` collection) — these are separate concerns that share a reference, not the same thing.
