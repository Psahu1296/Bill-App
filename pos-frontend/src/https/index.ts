import { axiosWrapper } from "./axiosWrapper";
import type { AddOrderPayload, AddDishPayload, AddExpensePayload, OrderStatus, PaymentStatus, AddConsumablePayload } from "../types";

// Auth Endpoints
export const login = (data: { email: string; password: string }) =>
  axiosWrapper.post("/api/user/login", data);

export const register = (data: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
}) => axiosWrapper.post("/api/user/register", data);

export const getUserData = () => axiosWrapper.get("/api/user");

export const logout = () => axiosWrapper.post("/api/user/logout");

// Table Endpoints
export const addTable = (data: { tableNo: string | number; seats: string | number }) =>
  axiosWrapper.post("/api/table/", data);

export const getTables = () => axiosWrapper.get("/api/table");

export const updateTable = ({
  tableId,
  ...tableData
}: {
  tableId: string;
  status: string;
  orderId: string | null;
}) => axiosWrapper.put(`/api/table/${tableId}`, tableData);

// Payment Endpoints
// BE validates typeof amount !== 'number', so amount must be a number (not a string)
export const createOrderRazorpay = (data: { amount: number }) =>
  axiosWrapper.post("/api/payment/create-order", data);

export const verifyPaymentRazorpay = (data: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) => axiosWrapper.post("/api/payment/verify-payment", data);

// Order Endpoints
export const addOrder = (data: AddOrderPayload) => axiosWrapper.post("/api/order/", data);

export const getOrderById = (id: string) => axiosWrapper.get(`/api/order/${id}`);

export const getOrders = (filters: Record<string, string> = {}) =>
  axiosWrapper.get("/api/order", { params: filters });

export const updateOrderStatus = ({
  orderId,
  orderStatus,
  paymentStatus,
}: {
  orderId: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
}) => axiosWrapper.put(`/api/order/${orderId}`, { orderStatus, paymentStatus });

export const updateOrder = (data: { id: string; [key: string]: unknown }) => {
  const { id, ...body } = data;
  return axiosWrapper.put(`/api/order/${id}`, body);
};

// Dishes Endpoints
export const addDish = (data: AddDishPayload) => axiosWrapper.post("/api/dishes/", data);

export const getDishes = () => axiosWrapper.get("/api/dishes");

export const updateDish = (dishId: string, dishData: object) =>
  axiosWrapper.put(`/api/dishes/${dishId}`, dishData);

export const deleteDish = (dishId: string) =>
  axiosWrapper.delete(`/api/dishes/${dishId}`);

export const getFrequentDishes = () =>
  axiosWrapper.get("/api/dishes/frequent");

// Earnings
export const getDailyEarnings = () =>
  axiosWrapper.get("/api/earnings/daywise");

export const getDashboardEarningsSummary = () =>
  axiosWrapper.get("/api/earnings/dashboard");

export const getPeriodEarnings = (periodType: string) =>
  axiosWrapper.get(`/api/earnings/${periodType}`);

// Expenses
export const addExpense = (expenseData: AddExpensePayload) =>
  axiosWrapper.post("/api/expenses", expenseData);

export const getAllExpenses = (filters: Record<string, string> = {}) => {
  const params = new URLSearchParams(filters).toString();
  return axiosWrapper.get(`/api/expenses${params ? "?" + params : ""}`);
};

export const getExpensesByPeriod = (periodType: string, date: string | null = null) => {
  const params = date ? `?date=${date}` : "";
  return axiosWrapper.get(`/api/expenses/summary/${periodType}${params}`);
};

export const updateExpense = (id: string, updates: object) =>
  axiosWrapper.put(`/api/expenses/${id}`, updates);

export const deleteExpense = (id: string) =>
  axiosWrapper.delete(`/api/expenses/${id}`);

// Customer Ledger API
export const getCustomerLedger = (phone: string) =>
  axiosWrapper.get(`/api/ledger/${phone}`);

export const recordCustomerPayment = (
  phone: string,
  paymentData: { amountPaid: number; orderId?: string; notes?: string }
) => axiosWrapper.post(`/api/ledger/${phone}/pay`, paymentData);

export const getAllCustomerLedgers = (filters: Record<string, unknown> = {}) =>
  axiosWrapper.get("/api/ledger/all", { params: filters });

export const addDebtToLedger = (
  phone: string,
  data: { amountDue: number; orderId?: string; customerName?: string; notes?: string }
) => axiosWrapper.post(`/api/ledger/${phone}/add-debt`, data);

// Consumables
export const addConsumable = (data: AddConsumablePayload) =>
  axiosWrapper.post("/api/consumables", data);

export const getAllConsumables = (filters: Record<string, string> = {}) =>
  axiosWrapper.get("/api/consumables", { params: filters });

export const getConsumableDailySummary = (date?: string) =>
  axiosWrapper.get("/api/consumables/summary/day", {
    params: date ? { date } : {},
  });

export const updateConsumable = (id: string, updates: object) =>
  axiosWrapper.put(`/api/consumables/${id}`, updates);

export const deleteConsumable = (id: string) =>
  axiosWrapper.delete(`/api/consumables/${id}`);
