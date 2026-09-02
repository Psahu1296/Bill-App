/**
 * Backfills CustomerLedger.balanceDue for existing dine-in/takeaway orders
 * that predate the addOrder ledger fixes:
 *   1. Only "Completed" orders wrote a full_payment_due entry — "Pending"
 *      orders with an outstanding balance never touched the ledger.
 *   2. Takeaway orders were treated like delivery (force-marked "Paid" on
 *      completion) instead of tracking unpaid balance as customer debt.
 *
 * Finds every dine-in/takeaway order with balanceDueOnOrder > 0 (any
 * non-Cancelled status) that has no full_payment_due transaction recorded
 * yet, and writes one — mirroring the logic in
 * controllers/orderController.ts addOrder.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." npx tsx scripts/backfillLedgerDebt.ts
 *       (dry run — lists what would change, writes nothing)
 *   MONGODB_URI="..." npx tsx scripts/backfillLedgerDebt.ts --apply
 *       (actually writes the missing ledger entries)
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Order } from "../models";
import * as ledgerRepo from "../repositories/ledgerRepo";

dotenv.config();

async function main() {
  const apply = process.argv.includes("--apply");

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is not set");

  await mongoose.connect(uri, { dbName: "dhaba-pos" });
  console.log(`✅ Connected to ${uri.replace(/\/\/[^@]+@/, "//***@")}`);
  console.log(apply ? "Mode: APPLY (will write to the ledger)\n" : "Mode: DRY RUN (no writes)\n");

  const candidates = await Order.find({
    orderType: { $in: ["dine-in", "takeaway"] },
    orderStatus: { $ne: "Cancelled" },
    balanceDueOnOrder: { $gt: 0 },
  }).lean();

  console.log(`Found ${candidates.length} dine-in/takeaway order(s) with an outstanding balance.\n`);

  let missing = 0;
  let skipped = 0;
  let totalBackfilled = 0;

  for (const order of candidates) {
    const orderId = String(order._id);
    const phone = (order.customerDetails as Record<string, unknown> | undefined)?.phone as string | undefined;
    const name = (order.customerDetails as Record<string, unknown> | undefined)?.name as string | undefined;
    const balance = (order.balanceDueOnOrder as number) ?? 0;

    if (!phone) {
      console.log(`  ⚠️  Order ${orderId} has no customer phone — skipping.`);
      skipped++;
      continue;
    }

    if ((name ?? "").trim().toLowerCase() === "driver") {
      console.log(`  ⏭️  Order ${orderId} — "Driver" placeholder customer, skipping.`);
      skipped++;
      continue;
    }

    const alreadyRecorded = await ledgerRepo.getFullPaymentDueForOrder(orderId);
    if (alreadyRecorded) {
      skipped++;
      continue;
    }

    missing++;
    totalBackfilled += balance;
    console.log(
      `  ${apply ? "→ Recording" : "→ Would record"} ₹${balance.toFixed(2)} for ${name ?? "?"} ` +
      `(${phone}) — order ${orderId}, status "${order.orderStatus}", dated ${new Date(order.orderDate as Date).toLocaleDateString("en-IN")}`
    );

    if (apply) {
      await ledgerRepo.upsertWithTransaction({
        customerPhone: phone,
        customerName: name ?? phone,
        balanceDelta: balance,
        transaction: {
          orderId,
          transactionType: "full_payment_due",
          amount: balance,
          timestamp: new Date(order.orderDate as Date).toISOString(),
          notes: `Order #${orderId} — backfilled (₹${balance.toFixed(2)} outstanding)`,
        },
      });
    }
  }

  console.log(`\n${missing} order(s) missing a ledger entry (total ₹${totalBackfilled.toFixed(2)}), ${skipped} already recorded/skipped.`);
  if (!apply && missing > 0) {
    console.log("Re-run with --apply to write these entries.");
  }
}

main()
  .catch((err) => {
    console.error("❌", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
