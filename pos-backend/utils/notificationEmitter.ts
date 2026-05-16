import { EventEmitter } from "events";

export type ReminderItem = {
  type: "expense_reminder" | "labor_reminder" | "credit_reminder";
  message: string;
  /** ISO date string — which day this reminder is for */
  date: string;
  /** For credit_reminder: number of customers with outstanding balance */
  count?: number;
  /** For credit_reminder: total outstanding ₹ amount */
  totalAmount?: number;
};

export type AdminNotification = {
  type: "new_order" | "items_added" | "dish_request" | "pre_order" | "reminders";
  orderId?: string;
  orderType?: string;
  tableNo?: number | null;
  customerName?: string;
  batch?: number;
  newItemsCount?: number;
  totalAmount?: number;
  // Request-specific fields
  requestId?: string;
  dishName?: string;
  scheduledFor?: string;
  // Reminder-specific fields
  reminders?: ReminderItem[];
};

class NotificationEmitter extends EventEmitter {}

export const notifEmitter = new NotificationEmitter();
notifEmitter.setMaxListeners(100); // allow many concurrent SSE connections
