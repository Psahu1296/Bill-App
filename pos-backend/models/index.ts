import mongoose, { Schema, Document, Model } from "mongoose";

// ── Shared JSON transform: always output _id as string, strip __v ─────────────
const baseOptions = {
  timestamps: true,
  toJSON: {
    transform(_doc: Document, ret: Record<string, unknown>) {
      ret._id = String(ret._id);
      delete ret.__v;
      return ret;
    },
  },
};

// ── StoreSetting ─────────────────────────────────────────────────────────────
const storeSettingSchema = new Schema(
  { key: { type: String, required: true, unique: true }, value: { type: String, required: true } },
  { timestamps: { updatedAt: "updatedAt", createdAt: false }, toJSON: baseOptions.toJSON }
);
export const StoreSetting: Model<Document & { key: string; value: string }> =
  mongoose.models.StoreSetting ?? mongoose.model("StoreSetting", storeSettingSchema);

// ── User ──────────────────────────────────────────────────────────────────────
const userSchema = new Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    phone:    { type: String, default: "" },
    password: { type: String, required: true },
    role:     { type: String, required: true, default: "staff" },
  },
  baseOptions
);
export const User = mongoose.models.User ?? mongoose.model("User", userSchema);

// ── Table ─────────────────────────────────────────────────────────────────────
const tableSchema = new Schema(
  {
    tableNo:        { type: Number, required: true, unique: true },
    status:         { type: String, default: "Available" },
    seats:          { type: Number, default: 4 },
    isVirtual:      { type: Boolean, default: false },
    currentOrderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
  },
  baseOptions
);
export const Table = mongoose.models.Table ?? mongoose.model("Table", tableSchema);

// ── Dish ──────────────────────────────────────────────────────────────────────
const dishSchema = new Schema(
  {
    image:             { type: String, default: "" },
    name:              { type: String, required: true, unique: true },
    type:              { type: String, required: true },
    category:          { type: String, required: true },
    variants:          { type: [Schema.Types.Mixed], required: true },
    description:       { type: String, default: "" },
    descriptionHi:     { type: String, default: "" },
    isAvailable:        { type: Boolean, default: true },
    isFrequent:         { type: Boolean, default: false },
    isOnlineAvailable:  { type: Boolean, default: false },
    isPreorder:         { type: Boolean, default: false },
    numberOfOrders:     { type: Number, default: 0 },
    excludeFromPopular: { type: Boolean, default: false },
    rawMaterial:       { type: String, default: "" },
  },
  baseOptions
);
export const Dish = mongoose.models.Dish ?? mongoose.model("Dish", dishSchema);

// ── Order ─────────────────────────────────────────────────────────────────────
const orderSchema = new Schema(
  {
    customerDetails:   { type: Schema.Types.Mixed, required: true },
    orderStatus:       { type: String, default: "Pending" },
    orderDate:         { type: Date, default: Date.now },
    bills:             { type: Schema.Types.Mixed, required: true },
    items:             { type: [Schema.Types.Mixed], default: [] },
    table:             { type: Schema.Types.ObjectId, ref: "Table", default: null },
    paymentMethod:     { type: String, default: null },
    paymentData:       { type: Schema.Types.Mixed, default: {} },
    paymentStatus:     { type: String, default: "Pending" },
    amountPaid:        { type: Number, default: 0 },
    balanceDueOnOrder: { type: Number, default: 0 },
    orderType:         { type: String, default: "dine-in" },
    deliveryAddress:   { type: String, default: "" },
    idempotencyKey:    { type: String, default: null, index: true },
  },
  {
    ...baseOptions,
    toJSON: {
      transform(_doc: Document, ret: Record<string, unknown>) {
        ret._id = String(ret._id);
        if (ret.table && typeof ret.table === "object") {
          const t = ret.table as Record<string, unknown>;
          t._id = String(t._id);
        } else if (ret.table != null) {
          ret.table = String(ret.table);
        }
        delete ret.__v;
        return ret;
      },
    },
  }
);
export const Order = mongoose.models.Order ?? mongoose.model("Order", orderSchema);

// ── Payment ───────────────────────────────────────────────────────────────────
const paymentSchema = new Schema(
  {
    paymentId: { type: String, unique: true, sparse: true },
    orderId:   { type: String, default: null },
    amount:    { type: Number, default: null },
    currency:  { type: String, default: null },
    status:    { type: String, default: null },
    method:    { type: String, default: null },
    email:     { type: String, default: null },
    contact:   { type: String, default: null },
  },
  { ...baseOptions, timestamps: { createdAt: "createdAt", updatedAt: false } }
);
export const Payment = mongoose.models.Payment ?? mongoose.model("Payment", paymentSchema);

// ── Expense ───────────────────────────────────────────────────────────────────
const expenseSchema = new Schema(
  {
    type:        { type: String, required: true },
    name:        { type: String, required: true },
    amount:      { type: Number, required: true },
    quantity:    { type: Number, default: null },
    unit:        { type: String, default: "" },
    description: { type: String, default: "" },
    expenseDate: { type: Date, default: Date.now },
  },
  baseOptions
);
export const Expense = mongoose.models.Expense ?? mongoose.model("Expense", expenseSchema);

// ── DailyEarning ──────────────────────────────────────────────────────────────
const dailyEarningSchema = new Schema(
  {
    date:                          { type: Date, required: true, unique: true },
    totalEarnings:                 { type: Number, default: 0 },
    percentageChangeFromYesterday: { type: Number, default: 0 },
  },
  baseOptions
);
export const DailyEarning = mongoose.models.DailyEarning ?? mongoose.model("DailyEarning", dailyEarningSchema);

// ── CustomerLedger (with embedded transactions) ────────────────────────────────
const ledgerTxSchema = new Schema(
  {
    orderId:         { type: Schema.Types.ObjectId, ref: "Order", default: null },
    transactionType: { type: String, required: true },
    amount:          { type: Number, required: true },
    timestamp:       { type: Date, default: Date.now },
    notes:           { type: String, default: "" },
  },
  { _id: true, toJSON: baseOptions.toJSON }
);

const customerLedgerSchema = new Schema(
  {
    customerPhone: { type: String, required: true, unique: true },
    customerName:  { type: String, required: true },
    balanceDue:    { type: Number, default: 0 },
    lastActivity:  { type: Date, default: Date.now },
    transactions:  { type: [ledgerTxSchema], default: [] },
  },
  baseOptions
);
export const CustomerLedger = mongoose.models.CustomerLedger ?? mongoose.model("CustomerLedger", customerLedgerSchema);

// ── Consumable ────────────────────────────────────────────────────────────────
const consumableSchema = new Schema(
  {
    type:          { type: String, required: true },
    quantity:      { type: Number, required: true },
    pricePerUnit:  { type: Number, required: true },
    consumerType:  { type: String, required: true },
    consumerName:  { type: String, required: true },
    consumerPhone: { type: String, default: null },
    amountPaid:    { type: Number, default: null },
    itemName:      { type: String, default: null },
    orderId:       { type: Schema.Types.ObjectId, ref: "Order", default: null },
    timestamp:     { type: Date, default: Date.now },
  },
  baseOptions
);
consumableSchema.index({ timestamp: 1 });
consumableSchema.index({ type: 1, timestamp: 1 });
export const Consumable = mongoose.models.Consumable ?? mongoose.model("Consumable", consumableSchema);

// ── Staff (with embedded payments) ────────────────────────────────────────────
const staffPaymentSchema = new Schema(
  {
    amount: { type: Number, required: true },
    type:   { type: String, required: true },
    note:   { type: String, default: "" },
    date:   { type: Date, default: Date.now },
  },
  { _id: true, toJSON: baseOptions.toJSON }
);

const staffSchema = new Schema(
  {
    name:          { type: String, required: true },
    phone:         { type: String, required: true },
    role:          { type: String, required: true },
    monthlySalary: { type: Number, default: 0 },
    joinDate:      { type: Date, default: Date.now },
    isActive:      { type: Boolean, default: true },
    payments:      { type: [staffPaymentSchema], default: [] },
  },
  baseOptions
);
staffSchema.index({ isActive: 1 });
staffSchema.index({ role: 1 });
export const Staff = mongoose.models.Staff ?? mongoose.model("Staff", staffSchema);

// ── DeliveryArea ──────────────────────────────────────────────────────────────
const deliveryAreaSchema = new Schema(
  {
    name:           { type: String, required: true, unique: true },
    isActive:       { type: Boolean, default: true },
    deliveryFee:    { type: Number, default: 0 },
    minOrderAmount: { type: Number, default: 0 },
  },
  baseOptions
);
export const DeliveryArea = mongoose.models.DeliveryArea ?? mongoose.model("DeliveryArea", deliveryAreaSchema);

// ── CustomerProfile ───────────────────────────────────────────────────────────
const customerProfileSchema = new Schema(
  {
    phone:         { type: String, required: true, unique: true },
    name:          { type: String, required: true },
    preferredArea: { type: String, default: "" },
    totalOrders:   { type: Number, default: 0 },
    lastOrderedAt: { type: Date, default: null },
  },
  baseOptions
);
export const CustomerProfile = mongoose.models.CustomerProfile ?? mongoose.model("CustomerProfile", customerProfileSchema);

// ── CustomerOtpSession ────────────────────────────────────────────────────────
const customerOtpSessionSchema = new Schema(
  {
    phone:     { type: String, required: true },
    otpCode:   { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts:  { type: Number, default: 0 },
    verified:  { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);
customerOtpSessionSchema.index({ phone: 1 });
export const CustomerOtpSession =
  mongoose.models.CustomerOtpSession ?? mongoose.model("CustomerOtpSession", customerOtpSessionSchema);

// ── DishRequest ───────────────────────────────────────────────────────────────
const dishRequestSchema = new Schema(
  {
    customerName:  { type: String, required: true },
    customerPhone: { type: String, required: true },
    dishName:      { type: String, required: true },
    description:   { type: String, default: "" },
    status:        { type: String, default: "pending" }, // pending | noted | added | rejected
    adminNote:     { type: String, default: "" },
  },
  baseOptions
);
dishRequestSchema.index({ status: 1, createdAt: -1 });
export const DishRequest =
  mongoose.models.DishRequest ?? mongoose.model("DishRequest", dishRequestSchema);

// ── ExpensePreset ─────────────────────────────────────────────────────────────
const priceHistoryEntrySchema = new Schema(
  { amount: { type: Number, required: true }, date: { type: Date, default: Date.now } },
  { _id: false }
);

const expensePresetSchema = new Schema(
  {
    name:           { type: String, required: true, unique: true },
    category:       { type: String, required: true },
    type:           { type: String, required: true },
    lastPrice:      { type: Number, default: 0 },
    priceHistory:   { type: [priceHistoryEntrySchema], default: [] },
    isStaffLinked:  { type: Boolean, default: false },
    order:          { type: Number, default: 0 },
    isActive:       { type: Boolean, default: true },
    variantPieceMap: { type: Schema.Types.Mixed, default: null },
    // Inventory tracking config
    trackingMode:              { type: String, default: "order-linked" }, // "order-linked" | "time-linked"
    stockUnit:                 { type: String, default: "kg" },           // purchase unit shown on stock fill
    consumptionUnit:           { type: String, default: "plates" },       // unit shown in consumption stats
    stockToConsumptionFactor:  { type: Number, default: 1 },              // e.g. 1 tray = 30 pc
    aliases:                   { type: [String], default: [] },           // regional/Hindi synonyms
  },
  baseOptions
);
export const ExpensePreset = mongoose.models.ExpensePreset ?? mongoose.model("ExpensePreset", expensePresetSchema);

// ── PreOrder ──────────────────────────────────────────────────────────────────
const preOrderSchema = new Schema(
  {
    customerName:         { type: String, required: true },
    customerPhone:        { type: String, required: true },
    scheduledFor:         { type: Date, required: true },
    items:                { type: [Schema.Types.Mixed], default: [] }, // [{name, quantity}]
    guestCount:           { type: Number, default: 1 },
    orderType:            { type: String, default: "dine-in" }, // dine-in | takeaway | delivery
    deliveryAddress:      { type: String, default: "" },
    specialInstructions:  { type: String, default: "" },
    status:               { type: String, default: "pending" }, // pending | confirmed | cancelled | completed
    adminNote:            { type: String, default: "" },
    estimatedTotal:       { type: Number, default: 0 },   // customer's rough estimate
    estimatedAmount:      { type: Number, default: 0 },   // admin-set actual estimate
    depositAmount:        { type: Number, default: 0 },   // 50% of estimatedTotal, set on initiation
    depositPaid:          { type: Boolean, default: false },
    depositTransactionId: { type: String, default: "" },
    depositPaidAt:        { type: Date, default: null },
  },
  baseOptions
);
preOrderSchema.index({ scheduledFor: 1, status: 1 });
preOrderSchema.index({ customerPhone: 1 });
export const PreOrder =
  mongoose.models.PreOrder ?? mongoose.model("PreOrder", preOrderSchema);

// ── StockCycle ─────────────────────────────────────────────────────────────────
const stockCycleSchema = new Schema(
  {
    expenseId:      { type: Schema.Types.ObjectId, ref: "Expense", required: true },
    rawMaterial:    { type: String, required: true },
    quantityKg:     { type: Number, required: true },
    startDate:      { type: Date, required: true },
    endDate:        { type: Date, default: null },
    unitsConsumed:  { type: Number, default: 0 },
    daysLasted:     { type: Number, default: null },     // time-linked only: endDate - startDate in days
    isEarlyRestock: { type: Boolean, default: false },
    cycleStatus:    { type: String, default: "active" }, // "active" | "closed"
  },
  baseOptions
);
stockCycleSchema.index({ rawMaterial: 1, cycleStatus: 1 });
stockCycleSchema.index({ rawMaterial: 1, startDate: -1 });
export const StockCycle =
  mongoose.models.StockCycle ?? mongoose.model("StockCycle", stockCycleSchema);
