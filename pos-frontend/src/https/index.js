import { axiosWrapper } from "./axiosWrapper";

// API Endpoints

// Auth Endpoints
export const login = (data) => axiosWrapper.post("/api/user/login", data);
export const register = (data) => axiosWrapper.post("/api/user/register", data);
export const getUserData = () => axiosWrapper.get("/api/user");
export const logout = () => axiosWrapper.post("/api/user/logout");

// Table Endpoints
export const addTable = (data) => axiosWrapper.post("/api/table/", data);
export const getTables = () => axiosWrapper.get("/api/table");
export const updateTable = ({ tableId, ...tableData }) =>
  axiosWrapper.put(`/api/table/${tableId}`, tableData);

// Payment Endpoints
export const createOrderRazorpay = (data) =>
  axiosWrapper.post("/api/payment/create-order", data);
export const verifyPaymentRazorpay = (data) =>
  axiosWrapper.post("/api/payment//verify-payment", data);

// Order Endpoints
export const addOrder = (data) => axiosWrapper.post("/api/order/", data);
export const getOrders = (filters = {}) => axiosWrapper.get("/api/order", { params: filters });
export const updateOrderStatus = ({ orderId, orderStatus, paymentStatus }) =>
  axiosWrapper.put(`/api/order/status/${orderId}`, {
    orderStatus,
    paymentStatus,
  });
export const updatePaymentStatus = ({ orderId, paymentStatus }) =>
  axiosWrapper.put(`/api/order/status/${orderId}`, { paymentStatus });
export const updateOrder = (data) =>
  axiosWrapper.put(`/api/order/${data.id}`, data);

// Dishes Endpoints
export const addDish = (data) => axiosWrapper.post("/api/dishes/", data);
export const getDishes = () => axiosWrapper.get("/api/dishes");
export const updateDish = (dishId, dishData) =>
  axiosWrapper.put(`/api/dishes/${dishId}`, dishData);
export const deleteDish = (dishId) =>
  axiosWrapper.delete(`/api/dishes/${dishId}`);
export const getFrequentDishes = () => axiosWrapper.get(`/api/dishes/frequent`);

// Earnings
export const getDailyEarnings = () => axiosWrapper.get(`/api/earnings/daywise`);
export const getDashboardEarningsSummary = () => axiosWrapper.get(`/api/earnings/dashboard`);
// param   periodType: 'day', 'week', 'month', 'year'
export const getPeriodEarnings = (periodType) =>
  axiosWrapper.get(`/api/earnings/${periodType}`);

export const addExpense = (expenseData) => axiosWrapper.post(`/api/expenses`, expenseData);
export const getAllExpenses = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  return axiosWrapper.get(`/api/expenses${params ? '?' + params : ''}`);
};
// param   periodType: 'day', 'month', 'year'
// param   date: specific date to query for (e.g., '2025-06-10')
export const getExpensesByPeriod = (periodType, date = null) => {
  const params = date ? `?date=${date}` : '';
  return axiosWrapper.get(`/api/expenses/summary/${periodType}${params}`);
};
export const updateExpense = (id, updates) => axiosWrapper.put(`/api/expenses/${id}`, updates);
export const deleteExpense = (id) => axiosWrapper.delete(`/api/expenses/${id}`);

// --- CUSTOMER LEDGER API ---
export const getCustomerLedger = (phone) => axiosWrapper.get(`/api/ledger/${phone}`);
export const recordCustomerPayment = (phone, paymentData) =>
  axiosWrapper.post(`/api/ledger/${phone}/pay`, paymentData);
export const getAllCustomerLedgers = (filters ={}) =>
  axiosWrapper.post(`/api/ledger/all`, { params: filters });