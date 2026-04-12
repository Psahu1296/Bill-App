import { Response, NextFunction } from "express";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { CustomRequest as Request } from "../types";
import mongoose from "mongoose";
import {
  Order, Staff, Consumable, Table, Dish,
  CustomerLedger, Payment, Expense, DailyEarning,
} from "../models";
import * as earningRepo from "../repositories/earningRepo";
import * as userRepo from "../repositories/userRepo";
import { getZonedStartOfDayUtc } from "./earningController";

// ─── Stats ────────────────────────────────────────────────────────────────────

export const getStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [orders, staff, consumables, tables, dishes, ledger] = await Promise.all([
      Order.countDocuments(),
      Staff.countDocuments(),
      Consumable.countDocuments(),
      Table.countDocuments(),
      Dish.countDocuments(),
      CustomerLedger.countDocuments(),
    ]);

    const counts = { orders, staff, consumables, tables, dishes, ledger };
    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    res.json({ success: true, data: { totalRecords, counts, dbSize: "MongoDB Atlas" } });
  } catch (err) {
    next(err);
  }
};

// ─── Export helper ────────────────────────────────────────────────────────────

async function fetchModuleRows(
  mod: string,
  startDate?: string,
  endDate?: string
): Promise<Record<string, unknown>[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dateRange = (col: string): Record<string, any> | null => {
    if (!startDate && !endDate) return null;
    const q: Record<string, unknown> = {};
    if (startDate) q.$gte = new Date(startDate);
    if (endDate) { const e = new Date(endDate); e.setUTCHours(23,59,59,999); q.$lte = e; }
    return { [col]: q };
  };

  if (mod === "orders") {
    const q = dateRange("orderDate") ?? {};
    return (await Order.find(q).sort({ orderDate: -1 }).lean()).map(d => ({
      ...d, _id: String(d._id),
      table: d.table ? String(d.table) : null,
    }));
  }
  if (mod === "consumables") {
    const q = dateRange("timestamp") ?? {};
    return (await Consumable.find(q).sort({ timestamp: -1 }).lean()).map(d => ({
      ...d, _id: String(d._id),
      orderId: d.orderId ? String(d.orderId) : null,
    }));
  }
  if (mod === "staff") {
    return (await Staff.find().lean()).map(d => ({ ...d, _id: String(d._id) }));
  }
  if (mod === "tables") {
    return (await Table.find().sort({ tableNo: 1 }).lean()).map(d => ({
      ...d, _id: String(d._id),
      currentOrderId: d.currentOrderId ? String(d.currentOrderId) : null,
    }));
  }
  if (mod === "dishes") {
    return (await Dish.find().sort({ name: 1 }).lean()).map(d => ({ ...d, _id: String(d._id) }));
  }
  if (mod === "ledger") {
    return (await CustomerLedger.find().lean()).map(d => ({
      ...d, _id: String(d._id),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactions: (d.transactions ?? []).map((t: any) => ({
        ...t, _id: String(t._id),
        orderId: t.orderId ? String(t.orderId) : null,
      })),
    }));
  }
  return [];
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const exportData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modules, startDate, endDate, format } = req.query as Record<string, string>;

    if (!modules) {
      res.status(400).json({ success: false, message: "modules query param is required" });
      return;
    }

    const validMods = ["orders", "staff", "consumables", "tables", "dishes", "ledger"];
    const moduleList = modules.split(",").filter(m => validMods.includes(m));
    const result: Record<string, Record<string, unknown>[]> = {};

    for (const mod of moduleList) {
      result[mod] = await fetchModuleRows(mod, startDate, endDate);
    }

    const ts = Date.now();

    if (format === "csv") {
      const csvParts: string[] = [];
      for (const [mod, rows] of Object.entries(result)) {
        if (!rows.length) { csvParts.push(`### ${mod}\n(no data)`); continue; }
        const headers = Object.keys(rows[0]).join(",");
        const body = rows.map(r =>
          Object.values(r).map(v =>
            v == null ? "" : typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v
          ).join(",")
        ).join("\n");
        csvParts.push(`### ${mod}\n${headers}\n${body}`);
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="dhaba-export-${ts}.csv"`);
      res.send(csvParts.join("\n\n"));
      return;
    }

    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();
      for (const [mod, rows] of Object.entries(result)) {
        const flatRows = rows.map(r => {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(r)) {
            out[k] = typeof v === "object" && v !== null ? JSON.stringify(v) : v;
          }
          return out;
        });
        const ws = XLSX.utils.json_to_sheet(flatRows.length ? flatRows : [{}]);
        XLSX.utils.book_append_sheet(wb, ws, mod.slice(0, 31));
      }
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="dhaba-export-${ts}.xlsx"`);
      res.send(buf);
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="dhaba-export-${ts}.json"`);
    res.json({ exportedAt: new Date().toISOString(), data: result });
  } catch (err) {
    next(err);
  }
};

// ─── Delete Preview ───────────────────────────────────────────────────────────

export const deletePreview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modules, startDate, endDate } = req.query as Record<string, string>;
    if (!modules) {
      res.status(400).json({ success: false, message: "modules query param is required" });
      return;
    }

    const validMods = ["orders", "staff", "consumables", "tables", "dishes", "ledger"];
    const moduleList = modules.split(",").filter(m => validMods.includes(m));
    const counts: Record<string, number> = {};
    const cascaded: Record<string, number> = {};

    const dateQuery = (col: string) => {
      if (!startDate && !endDate) return {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q: Record<string, any> = {};
      if (startDate) q.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setUTCHours(23,59,59,999); q.$lte = e; }
      return { [col]: q };
    };

    const ModelMap: Record<string, typeof mongoose.Model> = {
      orders: Order, consumables: Consumable, staff: Staff,
      tables: Table, dishes: Dish, ledger: CustomerLedger,
    };
    const DateColMap: Record<string, string | null> = {
      orders: "orderDate", consumables: "timestamp",
      staff: null, tables: null, dishes: null, ledger: null,
    };

    for (const mod of moduleList) {
      const M = ModelMap[mod] as typeof Order;
      const dc = DateColMap[mod];
      const q = dc ? dateQuery(dc) : {};
      counts[mod] = await M.countDocuments(q);
    }

    if (moduleList.includes("orders")) {
      const ordQ = dateQuery("orderDate");
      const orderDocs = await Order.find(ordQ).select("_id").lean();
      const orderIds = orderDocs.map(o => o._id);

      if (orderIds.length > 0) {
        if (!moduleList.includes("consumables")) {
          const cc = await Consumable.countDocuments({ orderId: { $in: orderIds } });
          if (cc > 0) cascaded["consumables (linked to orders)"] = cc;
        }
        const ltc = await CustomerLedger.countDocuments({
          "transactions.orderId": { $in: orderIds },
        });
        if (ltc > 0) cascaded["ledger transactions (linked to orders)"] = ltc;
      }
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0)
                + Object.values(cascaded).reduce((a, b) => a + b, 0);

    res.json({ success: true, data: { counts, cascaded, total } });
  } catch (err) {
    next(err);
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modules, startDate, endDate } = req.body as {
      modules: string[];
      startDate?: string;
      endDate?: string;
    };

    if (!Array.isArray(modules) || modules.length === 0) {
      res.status(400).json({ success: false, message: "modules array is required" });
      return;
    }

    const counts: Record<string, number> = {};

    const dateQ = (col: string) => {
      if (!startDate && !endDate) return {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q: Record<string, any> = {};
      if (startDate) q.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setUTCHours(23,59,59,999); q.$lte = e; }
      return { [col]: q };
    };

    if (modules.includes("orders")) {
      const ordQ = dateQ("orderDate");
      const orderDocs = await Order.find(ordQ).select("_id orderDate amountPaid").lean();
      const orderIds = orderDocs.map(o => o._id);

      if (orderIds.length > 0) {
        // Reverse earnings for consumables linked to orders
        const custConsumables = await Consumable.find({
          orderId: { $in: orderIds },
          consumerType: "customer",
        }).select("timestamp quantity pricePerUnit").lean();
        for (const c of custConsumables) {
          try {
            const key = getZonedStartOfDayUtc(new Date(c.timestamp as Date)).toISOString();
            await earningRepo.incrementEarnings(key, -((c.quantity as number) * (c.pricePerUnit as number)));
          } catch { /* ignore */ }
        }
        await Consumable.deleteMany({ orderId: { $in: orderIds } });
        counts["consumables"] = (counts["consumables"] ?? 0) + custConsumables.length;

        // Reverse ledger balances for transactions tied to these orders
        const ledgerDocs = await CustomerLedger.find({
          "transactions.orderId": { $in: orderIds },
        }).lean();
        for (const led of ledgerDocs) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const related = (led.transactions as any[]).filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (t: any) => t.orderId && orderIds.some(id => String(id) === String(t.orderId))
          );
          let delta = 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const tx of related as any[]) {
            const wasPos = tx.transactionType === "full_payment_due" || tx.transactionType === "balance_increased";
            delta += wasPos ? -tx.amount : tx.amount;
          }
          if (delta !== 0) {
            await CustomerLedger.findByIdAndUpdate(led._id, {
              $pull: { transactions: { orderId: { $in: orderIds } } },
              $inc: { balanceDue: delta },
            });
          }
        }

        // Reverse daily_earnings for orders
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const o of orderDocs as any[]) {
          if (o.amountPaid > 0) {
            try {
              const key = getZonedStartOfDayUtc(new Date(o.orderDate)).toISOString();
              await earningRepo.incrementEarnings(key, -o.amountPaid);
            } catch { /* ignore */ }
          }
        }
      }

      const result = await Order.deleteMany(ordQ);
      counts["orders"] = result.deletedCount;
    }

    for (const mod of modules) {
      if (mod === "orders") continue;
      if (mod === "consumables") {
        const q = dateQ("timestamp");
        const r = await Consumable.deleteMany(q);
        counts["consumables"] = (counts["consumables"] ?? 0) + r.deletedCount;
      } else if (mod === "staff") {
        const r = await Staff.deleteMany({});
        counts["staff"] = r.deletedCount;
      } else if (mod === "tables") {
        await Table.deleteMany({});
        // Re-seed virtual takeaway table
        await Table.updateOne(
          { tableNo: 0 },
          { $setOnInsert: { tableNo: 0, seats: 0, status: "Available", isVirtual: true } },
          { upsert: true }
        );
        const r2 = await Table.countDocuments();
        counts["tables"] = r2;
      } else if (mod === "dishes") {
        const r = await Dish.deleteMany({});
        counts["dishes"] = r.deletedCount;
      } else if (mod === "ledger") {
        const r = await CustomerLedger.deleteMany({});
        counts["ledger"] = r.deletedCount;
      }
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    res.json({ success: true, message: `Deleted ${total} record(s).`, data: counts });
  } catch (err) {
    next(err);
  }
};

// ─── Import (Restore) ─────────────────────────────────────────────────────────

export const importData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { exportedAt?: string; data?: Record<string, unknown[]> } | Record<string, unknown[]>;
    const moduleData: Record<string, unknown[]> =
      (body as { data?: Record<string, unknown[]> }).data ??
      (body as Record<string, unknown[]>);

    if (!moduleData || typeof moduleData !== "object" || Array.isArray(moduleData)) {
      res.status(400).json({ success: false, message: "Invalid backup format." });
      return;
    }

    const counts: Record<string, number> = {};

    if (Array.isArray(moduleData["orders"])) {
      let cnt = 0;
      for (const raw of moduleData["orders"] as Record<string, unknown>[]) {
        const idempKey = raw["idempotencyKey"] as string | undefined;
        const filter = idempKey ? { idempotencyKey: idempKey } : { _id: new mongoose.Types.ObjectId() };
        await Order.updateOne(filter, { $setOnInsert: {
          customerDetails: raw["customerDetails"],
          orderStatus: raw["orderStatus"],
          orderDate: raw["orderDate"] ? new Date(raw["orderDate"] as string) : new Date(),
          bills: raw["bills"],
          items: raw["items"] ?? [],
          paymentMethod: raw["paymentMethod"],
          paymentStatus: raw["paymentStatus"],
          amountPaid: raw["amountPaid"] ?? 0,
          balanceDueOnOrder: raw["balanceDueOnOrder"] ?? 0,
          orderType: raw["orderType"] ?? "dine-in",
          deliveryAddress: raw["deliveryAddress"] ?? "",
          idempotencyKey: idempKey ?? null,
        } }, { upsert: true });
        const amountPaid = Number(raw["amountPaid"]);
        if (amountPaid > 0 && raw["orderDate"]) {
          try {
            const key = getZonedStartOfDayUtc(new Date(raw["orderDate"] as string)).toISOString();
            await earningRepo.incrementEarnings(key, amountPaid);
          } catch { /* ignore */ }
        }
        cnt++;
      }
      counts["orders"] = cnt;
    }

    if (Array.isArray(moduleData["staff"])) {
      let cnt = 0;
      for (const raw of moduleData["staff"] as Record<string, unknown>[]) {
        const { payments, _id: _sid, ...staffData } = raw;
        const parsedPayments = Array.isArray(payments)
          ? payments
          : typeof payments === "string"
          ? JSON.parse(payments)
          : [];
        await Staff.updateOne(
          { name: staffData["name"], phone: staffData["phone"] },
          { $setOnInsert: { ...staffData, payments: parsedPayments } },
          { upsert: true }
        );
        cnt++;
      }
      counts["staff"] = cnt;
    }

    if (Array.isArray(moduleData["consumables"])) {
      let cnt = 0;
      for (const raw of moduleData["consumables"] as Record<string, unknown>[]) {
        const { _id: _cid, ...cData } = raw;
        await Consumable.create({
          ...cData,
          timestamp: cData["timestamp"] ? new Date(cData["timestamp"] as string) : new Date(),
        }).catch(() => { /* skip duplicates */ });
        if (cData["consumerType"] === "customer" && cData["orderId"] != null) {
          const qty = Number(cData["quantity"]);
          const ppu = Number(cData["pricePerUnit"] ?? cData["price_per_unit"]);
          if (qty > 0 && ppu > 0 && cData["timestamp"]) {
            try {
              const key = getZonedStartOfDayUtc(new Date(cData["timestamp"] as string)).toISOString();
              await earningRepo.incrementEarnings(key, qty * ppu);
            } catch { /* ignore */ }
          }
        }
        cnt++;
      }
      counts["consumables"] = cnt;
    }

    if (Array.isArray(moduleData["dishes"])) {
      let cnt = 0;
      for (const raw of moduleData["dishes"] as Record<string, unknown>[]) {
        const { _id: _did, ...dData } = raw;
        await Dish.updateOne(
          { name: dData["name"] },
          { $setOnInsert: dData },
          { upsert: true }
        );
        cnt++;
      }
      counts["dishes"] = cnt;
    }

    if (Array.isArray(moduleData["tables"])) {
      let cnt = 0;
      for (const raw of moduleData["tables"] as Record<string, unknown>[]) {
        const { _id: _tid, currentOrderId: _co, ...tData } = raw;
        await Table.updateOne(
          { tableNo: tData["tableNo"] },
          { $setOnInsert: { ...tData, currentOrderId: null } },
          { upsert: true }
        );
        cnt++;
      }
      // Ensure virtual table exists
      await Table.updateOne(
        { tableNo: 0 },
        { $setOnInsert: { tableNo: 0, seats: 0, status: "Available", isVirtual: true } },
        { upsert: true }
      );
      counts["tables"] = cnt;
    }

    if (Array.isArray(moduleData["ledger"])) {
      let cnt = 0;
      for (const raw of moduleData["ledger"] as Record<string, unknown>[]) {
        const { transactions: txRaw, _id: _lid, ...ledData } = raw;
        const parsedTxs = Array.isArray(txRaw)
          ? txRaw
          : typeof txRaw === "string"
          ? JSON.parse(txRaw)
          : [];
        let balanceDue = Number(ledData["balanceDue"] ?? ledData["balance_due"] ?? 0);
        if (balanceDue < 0) balanceDue = 0;
        await CustomerLedger.updateOne(
          { customerPhone: ledData["customerPhone"] ?? ledData["customer_phone"] },
          { $setOnInsert: {
            customerPhone: ledData["customerPhone"] ?? ledData["customer_phone"],
            customerName: ledData["customerName"] ?? ledData["customer_name"],
            balanceDue,
            lastActivity: ledData["lastActivity"] ? new Date(ledData["lastActivity"] as string) : new Date(),
            transactions: parsedTxs.map((t: Record<string, unknown>) => ({
              transactionType: t["transactionType"] ?? t["transaction_type"],
              amount: t["amount"],
              timestamp: t["timestamp"] ? new Date(t["timestamp"] as string) : new Date(),
              notes: t["notes"] ?? "",
            })),
          } },
          { upsert: true }
        );
        cnt++;
      }
      counts["ledger"] = cnt;
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    res.json({ success: true, message: `Restored ${total} record(s).`, data: counts });
  } catch (err) {
    next(err);
  }
};

// ─── Recalculate daily_earnings ───────────────────────────────────────────────

export const recalcEarnings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await Order.find({ amountPaid: { $gt: 0 } })
      .select("orderDate amountPaid").lean();
    const consumables = await Consumable.find({ consumerType: "customer", orderId: { $ne: null } })
      .select("timestamp quantity pricePerUnit").lean();

    const totals = new Map<string, number>();

    for (const o of orders) {
      try {
        const key = getZonedStartOfDayUtc(new Date(o.orderDate as Date)).toISOString();
        totals.set(key, (totals.get(key) ?? 0) + (o.amountPaid as number));
      } catch { /* skip */ }
    }
    for (const c of consumables) {
      try {
        const key = getZonedStartOfDayUtc(new Date(c.timestamp as Date)).toISOString();
        totals.set(key, (totals.get(key) ?? 0) + (c.quantity as number) * (c.pricePerUnit as number));
      } catch { /* skip */ }
    }

    await DailyEarning.deleteMany({});
    for (const [dateIso, total] of totals) {
      await earningRepo.incrementEarnings(dateIso, total);
    }

    res.json({
      success: true,
      message: `Recalculated earnings for ${totals.size} day(s).`,
      data: Object.fromEntries(totals),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Full DB Reset ─────────────────────────────────────────────────────────────

export const resetDb = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { confirmPhrase, password } = req.body as { confirmPhrase?: string; password?: string };

    if (confirmPhrase !== "RESET") {
      res.status(400).json({ success: false, message: "Confirmation phrase incorrect." });
      return;
    }
    if (!password) {
      res.status(400).json({ success: false, message: "Admin password is required." });
      return;
    }

    const userId = (req.user as { _id: string })?._id;
    const user = await userRepo.findById(userId);
    if (!user || (user as Record<string, unknown>).role !== "Admin") {
      res.status(403).json({ success: false, message: "Admin access required." });
      return;
    }
    const isMatch = await bcrypt.compare(password, (user as Record<string, unknown>).password as string);
    if (!isMatch) {
      res.status(401).json({ success: false, message: "Incorrect password." });
      return;
    }

    await Promise.all([
      CustomerLedger.deleteMany({}),
      Consumable.deleteMany({}),
      Order.deleteMany({}),
      Payment.deleteMany({}),
      Expense.deleteMany({}),
      DailyEarning.deleteMany({}),
    ]);

    // Reset tables to Available, keep layout
    await Table.updateMany({}, { $set: { status: "Available", currentOrderId: null } });

    // Reset dish order counts
    await Dish.updateMany({}, { $set: { numberOfOrders: 0 } });

    res.json({
      success: true,
      message: "Database reset complete. All operational data has been cleared.",
    });
  } catch (err) {
    next(err);
  }
};
