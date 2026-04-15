import { EventEmitter } from "events";

export type AdminNotification = {
  type: "new_order" | "items_added" | "dish_request" | "pre_order";
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
};

class NotificationEmitter extends EventEmitter {}

export const notifEmitter = new NotificationEmitter();
notifEmitter.setMaxListeners(100); // allow many concurrent SSE connections
