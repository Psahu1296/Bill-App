import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

export type OrderNotification = {
  type: "new_order" | "items_added";
  orderId: string;
  orderType: string;
  tableNo?: number | null;
  customerName?: string;
  batch?: number;
  newItemsCount?: number;
  totalAmount?: number;
  receivedAt: number;
};

interface NotificationContextType {
  /** Map of orderId → latest notification for that order */
  notifications: Map<string, OrderNotification>;
  addNotification: (n: Omit<OrderNotification, "receivedAt">) => void;
  clearNotification: (orderId: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const HIGHLIGHT_TTL_MS = 12_000; // card glows for 12 s

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Map<string, OrderNotification>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearNotification = useCallback((orderId: string) => {
    setNotifications(prev => {
      const next = new Map(prev);
      next.delete(orderId);
      return next;
    });
  }, []);

  const addNotification = useCallback((n: Omit<OrderNotification, "receivedAt">) => {
    const entry: OrderNotification = { ...n, receivedAt: Date.now() };
    setNotifications(prev => new Map(prev).set(n.orderId, entry));

    // Auto-clear after TTL
    if (timers.current.has(n.orderId)) clearTimeout(timers.current.get(n.orderId));
    timers.current.set(n.orderId, setTimeout(() => clearNotification(n.orderId), HIGHLIGHT_TTL_MS));
  }, [clearNotification]);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, clearNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
}
