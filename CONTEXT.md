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
The average kg of a Raw Material consumed per plate sold, derived from closed non-early-restock Stock Cycles. Shows "—" until at least one cycle closes.
_Avoid_: Usage rate, kg per serving, average consumption

**Daily Plate Rate**:
The 14-day rolling average of Raw Material Dish plates sold per day for a given Raw Material. Used as the velocity input for Stock Prediction.
_Avoid_: Daily average, sales rate, demand rate

### Stock Cycles

**Stock Cycle**:
The inventory period that begins when a Raw Material is purchased and ends when the same Raw Material is purchased again. Tracks quantity bought and plates consumed during that window.
_Avoid_: Stock period, inventory batch, replenishment window

**Active Cycle**:
A Stock Cycle with no end date — the current open window for a Raw Material.
_Avoid_: Open cycle, current stock, live batch

**Closed Cycle**:
A Stock Cycle that has ended (next purchase recorded). Has a final `platesConsumed` count and contributes to Consumption Rate unless flagged as Early Restock.
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

## Flagged ambiguities

- "plates sold" means completed orders (`orderStatus === "Completed"`) only — pending and cancelled orders do not count as consumption.
- "fish dishes" is resolved via two-pass lookup: explicit `dish.rawMaterial` tag first, then name-contains fallback for legacy dishes. Both must be checked.
- "expense" refers to the financial record (`Expense` collection); "stock cycle" refers to the inventory record (`StockCycle` collection) — these are separate concerns that share a reference, not the same thing.
