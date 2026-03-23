// ── Domain types ──────────────────────────────────────────────────────────────

export interface DishVariant {
  size: string;
  price: number;
  // dishModel sets _id: false — Mongoose does not generate _id for variant subdocs
}

export interface Dish {
  _id: string;
  name: string;
  image: string;
  type: string;
  category: string;
  variants: DishVariant[];
  description?: string;
  isAvailable: boolean;
  isFrequent: boolean;
  numberOfOrders: number;
}

export interface TableInfo {
  tableId: string;
  tableNo: number | string;
}

export interface Table {
  _id: string;
  tableNo: number | string;
  seats: number;
  status: 'Available' | 'Booked';
  currentOrder?: {
    _id: string;
    customerDetails: { name: string };
  };
}

export interface CartItem {
  id: string;
  name: string;
  variantSize?: string;
  pricePerQuantity: number;
  quantity: number;
  price: number;
  batch?: number;
}

export interface OrderCustomerDetails {
  name: string;
  phone: string;
  guests: number;
}

export interface OrderBills {
  total: number;
  discount?: number;
  roundOff?: number;
  totalWithTax: number;
}

export type OrderStatus = 'In Progress' | 'Ready' | 'Completed' | 'Cancelled';
export type PaymentStatus = 'Pending' | 'Paid' | 'Refunded';
export type PaymentMethod = 'Cash' | 'Online';

// Populated table shape returned by GET /api/order (Order.find().populate("table"))
export interface PopulatedOrderTable {
  _id: string;
  tableNo: number | string;
  seats: number;
  status: 'Available' | 'Booked';
}

export interface Order {
  _id: string;
  customerDetails: OrderCustomerDetails;
  // getOrders populates table; getOrderById returns raw ObjectId string
  // table is null for online orders (takeaway/delivery)
  table: PopulatedOrderTable | null;
  orderType?: 'dine-in' | 'takeaway' | 'delivery';
  deliveryAddress?: string;
  items: CartItem[];
  bills: OrderBills;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  balanceDueOnOrder: number;
  orderDate: string;
  paymentData?: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
  };
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

// ── Redux state types ─────────────────────────────────────────────────────────

export interface CustomerState {
  orderId: string;
  customerName: string;
  customerPhone: string;
  guests: number;
  table: TableInfo | null;
}

export interface UserState extends User {
  isAuth: boolean;
}

// ── Customer Ledger ───────────────────────────────────────────────────────────

export interface LedgerTransaction {
  transactionType: string;
  amount: number;
  orderId?: string;
  notes?: string;
  timestamp: string;
}

export interface CustomerLedger {
  _id: string;
  customerName: string;
  customerPhone: string;
  balanceDue: number;
  lastActivity: string;
  transactions: LedgerTransaction[];
}

// ── Metrics / Constants ───────────────────────────────────────────────────────

export interface MetricItem {
  title: string;
  value: string | number;
  percentage?: string;
  color: string;
  isIncrease?: boolean;
}

export interface PopularDishItem {
  id: number;
  image: string;
  name: string;
  numberOfOrders: number;
}

export interface StaticMenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
}

export interface MenuCategory {
  id: number;
  name: string;
  bgColor: string;
  icon: string;
  items: StaticMenuItem[];
}

export interface StaticOrder {
  id: string;
  customer: string;
  status: string;
  dateTime: string;
  items: number;
  tableNo: number;
  total: number;
}

export interface StaticTable {
  id: number;
  name: string;
  status: string;
  initial: string;
  seats: number;
}

// ── API request payload types ─────────────────────────────────────────────────

export interface AddOrderPayload {
  customerDetails: OrderCustomerDetails;
  orderStatus: OrderStatus;
  bills: OrderBills;
  items: CartItem[];
  table: string | undefined;
  paymentMethod: PaymentMethod;
  amountPaid?: number;
  paymentData?: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
  };
}

export interface AddDishPayload {
  name: string;
  image?: string;
  type: string;
  category: string;
  variants: DishVariant[];
  description?: string;
  isAvailable?: boolean;
  isFrequent?: boolean;
}

export interface AddExpensePayload {
  type: string;
  name: string;
  amount: number;
  description?: string;
  expenseDate?: string | Date;
}

export type ConsumableType = "tea" | "gutka" | "cigarette";
export type ConsumerType = "customer" | "staff" | "owner";

export interface AddConsumablePayload {
  type: ConsumableType;
  quantity: number;
  pricePerUnit?: number;
  consumerType: ConsumerType;
  consumerName: string;
  orderId?: string | null;
  timestamp?: string;
  staffIds?: string[];
}

// Shape returned by GET /api/consumables
export interface ConsumableEntry {
  _id: string;
  type: ConsumableType;
  quantity: number;
  pricePerUnit: number;
  consumerType: ConsumerType;
  consumerName: string;
  orderId?: string | null;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumableDailySummary {
  totalSold: number;
  totalRevenue: number;
  staffConsumed: number;
  ownerConsumed: number;
  wastedValue: number;
}

// ── Staff ─────────────────────────────────────────────────────────────────────

export type StaffRole = "cook" | "supplier" | "owner" | "manager" | "delivery" | "other";

export interface StaffPayment {
  _id: string;
  amount: number;
  type: "daily" | "monthly" | "advance" | "bonus" | "deduction";
  date: string;
  note: string;
}

export interface StaffMember {
  _id: string;
  name: string;
  phone: string;
  role: StaffRole;
  monthlySalary: number;
  joinDate: string;
  isActive: boolean;
  payments: StaffPayment[];
}

export interface AddStaffPayload {
  name: string;
  phone: string;
  role: StaffRole;
  monthlySalary: number;
  joinDate?: string;
}

export interface AddPaymentPayload {
  amount: number;
  type: "daily" | "monthly" | "advance" | "bonus" | "deduction";
  note?: string;
}

// ── API response wrapper ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
