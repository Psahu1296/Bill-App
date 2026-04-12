import mongoose from "mongoose";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import path from "path";
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
} from "../models/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function migrateData() {
  const dbPath = process.argv[2];
  if (!dbPath) {
    console.error("Usage: npx tsx scripts/migrateToMongo.ts <path_to_dhaba_pos.db>");
    process.exit(1);
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("Error: MONGODB_URI not set in .env");
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to MongoDB.`);

  console.log(`Opening SQLite Database at ${dbPath}...`);
  const sqlite = new Database(dbPath, { readonly: true });

  // Safety mappings
  const tableIdMap: Record<number, mongoose.Types.ObjectId> = {};
  const orderIdMap: Record<number, mongoose.Types.ObjectId> = {};
  const ledgerIdMap: Record<number, mongoose.Types.ObjectId> = {};
  const staffIdMap: Record<number, mongoose.Types.ObjectId> = {};
  
  // Track tables to later insert their current_order_id link
  const tableCurrentOrderLink: Array<{ tableObjectId: mongoose.Types.ObjectId, sqliteOrderId: number }> = [];

  // ── PHASE 1: Independent Models ────────────────────────────────────────────────

  // StoreSettings
  console.log("Migrating StoreSettings...");
  const settingsRows = sqlite.prepare(`SELECT * FROM store_settings`).all() as any[];
  for (const row of settingsRows) {
    try {
      await StoreSetting.updateOne(
        { key: row.key },
        { value: row.value },
        { upsert: true }
      );
    } catch(err) { console.warn(`Failed saving setting ${row.key}:`, err); }
  }

  // Users
  console.log("Migrating Users...");
  const userRows = sqlite.prepare(`SELECT * FROM users`).all() as any[];
  for (const row of userRows) {
    try {
      await User.updateOne(
        { email: row.email },
        {
          name: row.name,
          phone: row.phone || "",
          password: row.password_hash,
          role: row.role,
        },
        { upsert: true }
      );
    } catch(err) { console.warn(`Failed saving user ${row.email}:`, err); }
  }

  // Dishes
  console.log("Migrating Dishes...");
  const dishRows = sqlite.prepare(`SELECT * FROM dishes`).all() as any[];
  for (const row of dishRows) {
    let parsedVariants = [];
    try { parsedVariants = JSON.parse(row.variants); } catch (e) { /* IGNORE */ }
    
    try {
      await Dish.updateOne(
        { name: row.name },
        {
          image: row.image,
          type: row.type,
          category: row.category,
          variants: parsedVariants,
          description: row.description,
          descriptionHi: row.description_hi,
          isAvailable: row.is_available === 1,
          isFrequent: row.is_frequent === 1,
          isOnlineAvailable: row.is_online_available === 1,
          numberOfOrders: row.number_of_orders,
        },
        { upsert: true }
      );
    } catch(err) { console.warn(`Failed saving dish ${row.name}:`, err); }
  }

  // Expenses
  console.log("Migrating Expenses...");
  const expenseRows = sqlite.prepare(`SELECT * FROM expenses`).all() as any[];
  for (const row of expenseRows) {
    try {
      await Expense.create({
        type: row.type,
        name: row.name,
        amount: row.amount,
        description: row.description,
        expenseDate: new Date(row.expense_date),
      });
    } catch(err) { console.warn(`Failed saving expense ${row.id}:`, err); }
  }

  // Daily Earnings
  console.log("Migrating Daily Earnings...");
  const earningRows = sqlite.prepare(`SELECT * FROM daily_earnings`).all() as any[];
  for (const row of earningRows) {
    try {
      await DailyEarning.updateOne(
        { date: new Date(row.date) },
        {
          totalEarnings: row.total_earnings,
          percentageChangeFromYesterday: row.percentage_change_from_yesterday,
        },
        { upsert: true }
      );
    } catch(err) { console.warn(`Failed saving earnings ${row.date}:`, err); }
  }

  // Delivery Areas
  console.log("Migrating Delivery Areas...");
  try {
    const areaRows = sqlite.prepare(`SELECT * FROM delivery_areas`).all() as any[];
    for (const row of areaRows) {
      await DeliveryArea.updateOne(
        { name: row.name },
        {
          isActive: row.is_active === 1,
        },
        { upsert: true }
      );
    }
  } catch (err: any) {
    console.warn(`Skipped delivery areas due to potential missing SQLite table: ${err.message}`);
  }

  // Customer OTP Sessions
  console.log("Migrating OTP Sessions...");
  try {
    const otpRows = sqlite.prepare(`SELECT * FROM customer_otp_sessions`).all() as any[];
    for (const row of otpRows) {
      await CustomerOtpSession.create({
        phone: row.phone,
        otpCode: row.otp_code,
        expiresAt: new Date(row.expires_at),
        attempts: row.attempts,
        verified: row.verified === 1,
      });
    }
  } catch (err: any) {
    console.warn(`Skipped otp sessions due to potential missing SQLite table: ${err.message}`);
  }

  // ── PHASE 2: Relational Models ────────────────────────────────────────────────

  // Tables
  console.log("Migrating Tables...");
  const tableRows = sqlite.prepare(`SELECT * FROM tables_tb`).all() as any[];
  for (const row of tableRows) {
    try {
      const tableObjId = new mongoose.Types.ObjectId();
      tableIdMap[row.id] = tableObjId;

      if (row.current_order_id) {
        tableCurrentOrderLink.push({ tableObjectId: tableObjId, sqliteOrderId: row.current_order_id });
      }

      await Table.updateOne(
        { tableNo: row.table_no },
        {
          $setOnInsert: { _id: tableObjId },
          status: row.status,
          seats: row.seats,
          isVirtual: row.is_virtual === 1,
          currentOrderId: null, // to be populated
        },
        { upsert: true }
      );
    } catch(err) { console.warn(`Failed saving table ${row.table_no}:`, err); }
  }

  // Orders
  console.log("Migrating Orders...");
  const orderRows = sqlite.prepare(`SELECT * FROM orders`).all() as any[];
  for (const row of orderRows) {
    try {
      const orderObjId = new mongoose.Types.ObjectId();
      orderIdMap[row.id] = orderObjId;

      let bills = {};
      let items = [];
      let customerDetails = {};
      let paymentData = {};
      try { bills = JSON.parse(row.bills); } catch(e){}
      try { items = JSON.parse(row.items); } catch(e){}
      try { customerDetails = JSON.parse(row.customer_details); } catch(e){}
      try { paymentData = JSON.parse(row.payment_data); } catch(e){}

      await Order.create({
        _id: orderObjId,
        customerDetails,
        orderStatus: row.order_status,
        orderDate: new Date(row.order_date),
        bills,
        items,
        table: row.table_id ? tableIdMap[row.table_id] : null,
        paymentMethod: row.payment_method,
        paymentData,
        paymentStatus: row.payment_status,
        amountPaid: row.amount_paid,
        balanceDueOnOrder: row.balance_due_on_order,
        orderType: row.order_type,
        deliveryAddress: row.delivery_address,
        idempotencyKey: row.idempotency_key,
      });
    } catch(err) { console.warn(`Failed saving order ${row.id}:`, err); }
  }

  // Link Tables CurrentOrderId
  console.log("Linking Tables to their Active Orders...");
  for (const link of tableCurrentOrderLink) {
    const mongoOrderId = orderIdMap[link.sqliteOrderId];
    if (mongoOrderId) {
      await Table.updateOne({ _id: link.tableObjectId }, { currentOrderId: mongoOrderId });
    }
  }

  // Payments
  console.log("Migrating Payments...");
  const paymentRows = sqlite.prepare(`SELECT * FROM payments`).all() as any[];
  for (const row of paymentRows) {
    try {
      await Payment.create({
        paymentId: row.payment_id,
        orderId: row.order_id, // Preserved as string for Razorpay ID fallback.
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        method: row.method,
        email: row.email,
        contact: row.contact,
        createdAt: new Date(row.created_at)
      });
    } catch(err) { console.warn(`Failed saving payment ${row.id}:`, err); }
  }

  // Consumables
  console.log("Migrating Consumables...");
  const consumableRows = sqlite.prepare(`SELECT * FROM consumables`).all() as any[];
  for (const row of consumableRows) {
    try {
      await Consumable.create({
        type: row.type,
        quantity: row.quantity,
        pricePerUnit: row.price_per_unit,
        consumerType: row.consumer_type,
        consumerName: row.consumer_name,
        orderId: row.order_id ? orderIdMap[row.order_id] : null,
        timestamp: new Date(row.timestamp),
      });
    } catch(err) { console.warn(`Failed saving consumable ${row.id}:`, err); }
  }

  // ── PHASE 3: Embedded Models ────────────────────────────────────────────────

  // Ledger & Transactions
  console.log("Migrating Customer Ledger and Transactions...");
  const ledgerRows = sqlite.prepare(`SELECT * FROM customer_ledger`).all() as any[];
  for (const row of ledgerRows) {
    try {
      const ledgerObjId = new mongoose.Types.ObjectId();
      ledgerIdMap[row.id] = ledgerObjId;

      // Extract linked transactions for this ledger
      const txRows = sqlite.prepare(`SELECT * FROM customer_ledger_transactions WHERE ledger_id = ?`).all(row.id) as any[];
      const transactions = txRows.map(tx => ({
        orderId: tx.order_id ? orderIdMap[tx.order_id] : null,
        transactionType: tx.transaction_type,
        amount: tx.amount,
        timestamp: new Date(tx.timestamp),
        notes: tx.notes,
      }));

      await CustomerLedger.updateOne(
        { customerPhone: row.customer_phone },
        {
          $setOnInsert: { _id: ledgerObjId }, // Only set deterministic ID if new
          customerName: row.customer_name,
          balanceDue: row.balance_due,
          lastActivity: new Date(row.last_activity),
          transactions: transactions,
        },
        { upsert: true }
      );
    } catch(err) { console.warn(`Failed saving customer ledger ${row.id}:`, err); }
  }

  // Staff & Payments
  console.log("Migrating Staff and Staff Payments...");
  const staffRows = sqlite.prepare(`SELECT * FROM staff`).all() as any[];
  for (const row of staffRows) {
    try {
      const staffObjId = new mongoose.Types.ObjectId();
      staffIdMap[row.id] = staffObjId;

      // Extract linked payments
      const spRows = sqlite.prepare(`SELECT * FROM staff_payments WHERE staff_id = ?`).all(row.id) as any[];
      const payments = spRows.map(sp => ({
        amount: sp.amount,
        type: sp.type,
        date: new Date(sp.date),
        note: sp.note,
      }));

      await Staff.create({
        _id: staffObjId,
        name: row.name,
        phone: row.phone,
        role: row.role,
        monthlySalary: row.monthly_salary,
        joinDate: new Date(row.join_date),
        isActive: row.is_active === 1,
        payments: payments,
      });
    } catch(err) { console.warn(`Failed saving staff ${row.id}:`, err); }
  }

  console.log("✅ Migration completed successfully!");
  process.exit(0);
}

// Global Exception Catcher
migrateData().catch((err) => {
  console.error("Migration failed due to an error:");
  console.error(err);
  process.exit(1);
});
