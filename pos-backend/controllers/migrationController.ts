import { Request, Response, NextFunction } from "express";
import Database from "better-sqlite3";
import fs from "fs";
import mongoose from "mongoose";
import {
  User,
  Table,
  Dish,
  Order,
  Payment,
  Expense,
  DailyEarning,
  CustomerLedger,
  Consumable,
  Staff,
  DeliveryArea,
  StoreSetting,
  CustomerOtpSession,
} from "../models/index";
import path from "path";

export const uploadAndMigrateDb = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No database file uploaded." });
    }

    const dbPath = req.file.path;
    console.log(`Starting Cloud Migration from uploaded SQLite db at ${dbPath}...`);

    let sqlite;
    try {
      sqlite = new Database(dbPath, { readonly: true });
    } catch (e: any) {
      fs.unlinkSync(dbPath);
      return res.status(400).json({ success: false, message: "Invalid SQLite database file provided.", error: e.message });
    }

    // Safety mappings
    const tableIdMap: Record<number, mongoose.Types.ObjectId> = {};
    const orderIdMap: Record<number, mongoose.Types.ObjectId> = {};
    const ledgerIdMap: Record<number, mongoose.Types.ObjectId> = {};
    const staffIdMap: Record<number, mongoose.Types.ObjectId> = {};
    
    // Track tables to later insert their current_order_id link
    const tableCurrentOrderLink: Array<{ tableObjectId: mongoose.Types.ObjectId, sqliteOrderId: number }> = [];

    // ── PHASE 1: Independent Models ────────────────────────────────────────────────

    console.log("Migrating StoreSettings...");
    try {
      const settingsRows = sqlite.prepare(`SELECT * FROM store_settings`).all() as any[];
      for (const row of settingsRows) {
        await StoreSetting.updateOne({ key: row.key }, { value: row.value }, { upsert: true });
      }
    } catch(err) { console.warn("Skipped settings"); }

    console.log("Migrating Users...");
    try {
      const userRows = sqlite.prepare(`SELECT * FROM users`).all() as any[];
      for (const row of userRows) {
        await User.updateOne(
          { email: row.email },
          { name: row.name, phone: row.phone || "", password: row.password_hash, role: row.role },
          { upsert: true }
        );
      }
    } catch(err) { console.warn("Skipped users"); }

    console.log("Migrating Dishes...");
    try {
      const dishRows = sqlite.prepare(`SELECT * FROM dishes`).all() as any[];
      for (const row of dishRows) {
        let parsedVariants = [];
        try { parsedVariants = JSON.parse(row.variants); } catch (e) { /* IGNORE */ }
        await Dish.updateOne(
          { name: row.name },
          {
            image: row.image, type: row.type, category: row.category, variants: parsedVariants,
            description: row.description, descriptionHi: row.description_hi,
            isAvailable: row.is_available === 1, isFrequent: row.is_frequent === 1,
            isOnlineAvailable: row.is_online_available === 1, numberOfOrders: row.number_of_orders,
          },
          { upsert: true }
        );
      }
    } catch(err) { console.warn("Skipped dishes"); }

    console.log("Migrating Expenses...");
    try {
      const expenseRows = sqlite.prepare(`SELECT * FROM expenses`).all() as any[];
      for (const row of expenseRows) {
        await Expense.create({
          type: row.type, name: row.name, amount: row.amount, description: row.description,
          expenseDate: new Date(row.expense_date),
        });
      }
    } catch(err) { console.warn("Skipped expenses"); }

    console.log("Migrating Daily Earnings...");
    try {
      const earningRows = sqlite.prepare(`SELECT * FROM daily_earnings`).all() as any[];
      for (const row of earningRows) {
        await DailyEarning.updateOne(
          { date: new Date(row.date) },
          { totalEarnings: row.total_earnings, percentageChangeFromYesterday: row.percentage_change_from_yesterday },
          { upsert: true }
        );
      }
    } catch(err) { console.warn("Skipped daily earnings"); }

    console.log("Migrating Delivery Areas...");
    try {
      const areaRows = sqlite.prepare(`SELECT * FROM delivery_areas`).all() as any[];
      for (const row of areaRows) {
        await DeliveryArea.updateOne({ name: row.name }, { isActive: row.is_active === 1 }, { upsert: true });
      }
    } catch (err: any) { console.warn(`Skipped delivery areas`); }

    console.log("Migrating OTP Sessions...");
    try {
      const otpRows = sqlite.prepare(`SELECT * FROM customer_otp_sessions`).all() as any[];
      for (const row of otpRows) {
        await CustomerOtpSession.create({
          phone: row.phone, otpCode: row.otp_code, expiresAt: new Date(row.expires_at),
          attempts: row.attempts, verified: row.verified === 1,
        });
      }
    } catch (err: any) { console.warn(`Skipped otp sessions`); }

    // ── PHASE 2: Relational Models ────────────────────────────────────────────────

    console.log("Migrating Tables...");
    try {
      const tableRows = sqlite.prepare(`SELECT * FROM tables_tb`).all() as any[];
      for (const row of tableRows) {
        const tableObjId = new mongoose.Types.ObjectId();
        tableIdMap[row.id] = tableObjId;
        if (row.current_order_id) tableCurrentOrderLink.push({ tableObjectId: tableObjId, sqliteOrderId: row.current_order_id });
        await Table.updateOne(
          { tableNo: row.table_no },
          { $setOnInsert: { _id: tableObjId }, status: row.status, seats: row.seats, isVirtual: row.is_virtual === 1, currentOrderId: null },
          { upsert: true }
        );
      }
    } catch(err) { console.warn("Skipped tables"); }

    console.log("Migrating Orders...");
    try {
      const orderRows = sqlite.prepare(`SELECT * FROM orders`).all() as any[];
      for (const row of orderRows) {
        const orderObjId = new mongoose.Types.ObjectId();
        orderIdMap[row.id] = orderObjId;
        let bills = {}, items = [], customerDetails = {}, paymentData = {};
        try { bills = JSON.parse(row.bills); } catch(e){}
        try { items = JSON.parse(row.items); } catch(e){}
        try { customerDetails = JSON.parse(row.customer_details); } catch(e){}
        try { paymentData = JSON.parse(row.payment_data); } catch(e){}
        await Order.create({
          _id: orderObjId, customerDetails, orderStatus: row.order_status, orderDate: new Date(row.order_date),
          bills, items, table: row.table_id ? tableIdMap[row.table_id] : null, paymentMethod: row.payment_method,
          paymentData, paymentStatus: row.payment_status, amountPaid: row.amount_paid,
          balanceDueOnOrder: row.balance_due_on_order, orderType: row.order_type, deliveryAddress: row.delivery_address,
          idempotencyKey: row.idempotency_key,
        });
      }
    } catch(err) { console.warn("Skipped orders"); }

    console.log("Linking Tables to their Active Orders...");
    for (const link of tableCurrentOrderLink) {
      const mongoOrderId = orderIdMap[link.sqliteOrderId];
      if (mongoOrderId) {
        await Table.updateOne({ _id: link.tableObjectId }, { currentOrderId: mongoOrderId });
      }
    }

    console.log("Migrating Payments...");
    try {
      const paymentRows = sqlite.prepare(`SELECT * FROM payments`).all() as any[];
      for (const row of paymentRows) {
        await Payment.create({
          paymentId: row.payment_id, orderId: row.order_id, amount: row.amount, currency: row.currency,
          status: row.status, method: row.method, email: row.email, contact: row.contact, createdAt: new Date(row.created_at)
        });
      }
    } catch(err) { console.warn("Skipped payments"); }

    console.log("Migrating Consumables...");
    try {
      const consumableRows = sqlite.prepare(`SELECT * FROM consumables`).all() as any[];
      for (const row of consumableRows) {
        await Consumable.create({
          type: row.type, quantity: row.quantity, pricePerUnit: row.price_per_unit, consumerType: row.consumer_type,
          consumerName: row.consumer_name, orderId: row.order_id ? orderIdMap[row.order_id] : null, timestamp: new Date(row.timestamp),
        });
      }
    } catch(err) { console.warn("Skipped consumables"); }

    // ── PHASE 3: Embedded Models ────────────────────────────────────────────────

    console.log("Migrating Customer Ledger and Transactions...");
    try {
      const ledgerRows = sqlite.prepare(`SELECT * FROM customer_ledger`).all() as any[];
      for (const row of ledgerRows) {
        const ledgerObjId = new mongoose.Types.ObjectId();
        ledgerIdMap[row.id] = ledgerObjId;
        const txRows = sqlite.prepare(`SELECT * FROM customer_ledger_transactions WHERE ledger_id = ?`).all(row.id) as any[];
        const transactions = txRows.map(tx => ({
          orderId: tx.order_id ? orderIdMap[tx.order_id] : null, transactionType: tx.transaction_type,
          amount: tx.amount, timestamp: new Date(tx.timestamp), notes: tx.notes,
        }));
        await CustomerLedger.updateOne(
          { customerPhone: row.customer_phone },
          { $setOnInsert: { _id: ledgerObjId }, customerName: row.customer_name, balanceDue: row.balance_due,
            lastActivity: new Date(row.last_activity), transactions: transactions,
          }, { upsert: true }
        );
      }
    } catch(err) { console.warn("Skipped ledgers"); }

    console.log("Migrating Staff and Staff Payments...");
    try {
      const staffRows = sqlite.prepare(`SELECT * FROM staff`).all() as any[];
      for (const row of staffRows) {
        const staffObjId = new mongoose.Types.ObjectId();
        staffIdMap[row.id] = staffObjId;
        const spRows = sqlite.prepare(`SELECT * FROM staff_payments WHERE staff_id = ?`).all(row.id) as any[];
        const payments = spRows.map(sp => ({
          amount: sp.amount, type: sp.type, date: new Date(sp.date), note: sp.note,
        }));
        await Staff.create({
          _id: staffObjId, name: row.name, phone: row.phone, role: row.role, monthlySalary: row.monthly_salary,
          joinDate: new Date(row.join_date), isActive: row.is_active === 1, payments: payments,
        });
      }
    } catch(err) { console.warn("Skipped staff"); }

    // Clean up
    try { fs.unlinkSync(dbPath); } catch (e) { /* ignore */ }

    console.log("✅ Migration completed successfully!");
    return res.status(200).json({ success: true, message: "Database migrated to Cloud MongoDB successfully!" });

  } catch (error: any) {
    console.error("Migration failed:", error);
    try { if (req.file) fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
    return res.status(500).json({ success: false, message: "Critical internal migration failure", error: error.message || error });
  }
};
