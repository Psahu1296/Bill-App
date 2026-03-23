import { EventEmitter } from "events";

export type AdminNotification = {
  type: "new_order" | "items_added";
  orderId: string;
  orderType: string;
  tableNo?: number | null;
  customerName?: string;
  batch?: number;
  newItemsCount?: number;
  totalAmount?: number;
};

class NotificationEmitter extends EventEmitter {}

export const notifEmitter = new NotificationEmitter();
notifEmitter.setMaxListeners(100); // allow many concurrent SSE connections
