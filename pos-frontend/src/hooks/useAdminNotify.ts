import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "../context/NotificationContext";
import { enqueueSnackbar } from "notistack";

/**
 * Opens an SSE connection to /api/admin/notify/stream.
 * On every event: refetches orders + adds a notification for card highlight.
 * Mount once at the app layout level (e.g. inside the auth-protected routes).
 */
export function useAdminNotify(enabled = true) {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource("/api/admin/notify/stream", { withCredentials: true });

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        // Refetch orders list so the updated card appears immediately
        queryClient.invalidateQueries({ queryKey: ["orders"] });

        addNotification(data);

        // Toast
        if (data.type === "new_order") {
          const where = data.tableNo ? `Table ${data.tableNo}` : data.orderType;
          enqueueSnackbar(
            `New order from ${data.customerName || "customer"} · ${where} · ₹${data.totalAmount ?? ""}`,
            { variant: "info", autoHideDuration: 6000 }
          );
        } else if (data.type === "items_added") {
          const where = data.tableNo ? `Table ${data.tableNo}` : "";
          enqueueSnackbar(
            `${data.customerName || "Customer"} added ${data.newItemsCount} more item(s)${where ? ` · ${where}` : ""}`,
            { variant: "info", autoHideDuration: 6000 }
          );
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      // Let the browser auto-reconnect (EventSource does this by default);
      // only close if readyState is CLOSED to avoid duplicate listeners.
      if (es.readyState === EventSource.CLOSED) es.close();
    };

    return () => es.close();
  }, [enabled, queryClient, addNotification]);
}
