import type { Dish, Table, Order, CustomerLedger } from "./types";

export const dummyDishes: Dish[] = [
  {
    _id: "dish_1",
    name: "Paneer Butter Masala",
    image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc0",
    type: "Veg",
    category: "Main Course",
    variants: [{ size: "Full", price: 250 }, { size: "Half", price: 140 }],
    description: "Rich and creamy tomato gravy with soft paneer cubes.",
    isAvailable: true,
    isFrequent: true,
    numberOfOrders: 120,
  },
  {
    _id: "dish_2",
    name: "Chicken Tikka Masala",
    image: "https://images.unsplash.com/photo-1565557612715-9c1d1a3eb87a",
    type: "Non-Veg",
    category: "Main Course",
    variants: [{ size: "Full", price: 350 }, { size: "Half", price: 190 }],
    description: "Roasted marinated chicken chunks in spiced curry sauce.",
    isAvailable: true,
    isFrequent: true,
    numberOfOrders: 200,
  },
  {
    _id: "dish_3",
    name: "Garlic Naan",
    image: "https://images.unsplash.com/photo-1606859191214-25806e8e2423",
    type: "Veg",
    category: "Breads",
    variants: [{ size: "Standard", price: 40 }],
    isAvailable: true,
    isFrequent: true,
    numberOfOrders: 500,
  },
  {
    _id: "dish_4",
    name: "Dal Makhani",
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d",
    type: "Veg",
    category: "Main Course",
    variants: [{ size: "Full", price: 180 }],
    isAvailable: true,
    isFrequent: false,
    numberOfOrders: 85,
  }
];

export const dummyTables: Table[] = [
  { _id: "table_1", tableNo: 1, seats: 4, status: "Available" },
  { _id: "table_2", tableNo: 2, seats: 2, status: "Booked", currentOrder: { _id: "order_1", customerDetails: { name: "John Doe" } } },
  { _id: "table_3", tableNo: 3, seats: 6, status: "Available" },
  { _id: "table_4", tableNo: 4, seats: 4, status: "Available" },
];

export const dummyOrders: Order[] = [
  {
    _id: "order_1",
    customerDetails: { name: "John Doe", phone: "9876543210", guests: 2 },
    table: { _id: "table_2", tableNo: 2, seats: 2, status: "Booked" },
    items: [
      { id: "dish_1", name: "Paneer Butter Masala", variantSize: "Full", pricePerQuantity: 250, quantity: 1, price: 250 },
      { id: "dish_3", name: "Garlic Naan", variantSize: "Standard", pricePerQuantity: 40, quantity: 3, price: 120 }
    ],
    bills: { total: 370, totalWithTax: 370 },
    orderStatus: "In Progress",
    paymentStatus: "Pending",
    paymentMethod: "Cash",
    amountPaid: 0,
    balanceDueOnOrder: 389.42,
    orderDate: new Date().toISOString(),
  },
  {
    _id: "order_2",
    customerDetails: { name: "Alice Smith", phone: "9123456780", guests: 4 },
    table: { _id: "table_3", tableNo: 3, seats: 6, status: "Available" },
    items: [
      { id: "dish_2", name: "Chicken Tikka Masala", variantSize: "Full", pricePerQuantity: 350, quantity: 2, price: 700 }
    ],
    bills: { total: 700, totalWithTax: 700 },
    orderStatus: "Completed",
    paymentStatus: "Paid",
    paymentMethod: "Online",
    amountPaid: 736.75,
    balanceDueOnOrder: 0,
    orderDate: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  }
];

export const dummyCustomerLedger: CustomerLedger[] = [
  {
    _id: "ledger_1",
    customerName: "Ramesh Truck Driver",
    customerPhone: "9998887776",
    balanceDue: 450,
    lastActivity: new Date().toISOString(),
    transactions: [
      { transactionType: "full_payment_due", amount: 450, orderId: "order_3", timestamp: new Date().toISOString() }
    ]
  }
];

// Helper to simulate API delay
export const mockDelay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));
