# StockCycle lives in its own collection, not inside Expense

The inventory system needs to track raw material consumption cycles (start date, end date, plates consumed, early-restock flag) alongside the existing financial expense records. We chose a separate `StockCycle` collection that references `Expense` by ID, rather than extending the `Expense` schema with inventory fields.

**Why:** `Expense` is a financial ledger — amount, type, date. Mixing inventory state (cycleStatus, platesConsumed, isEarlyRestock) into it would couple two distinct concerns that evolve independently. A future change to prediction logic or cycle boundaries would not need to touch the financial model.

**Considered alternative:** Adding inventory fields directly to `Expense`. Rejected because it would force every expense query to carry unused inventory state, and because non-raw-material expenses (staff salary, utilities) would have null inventory fields with no meaning.
