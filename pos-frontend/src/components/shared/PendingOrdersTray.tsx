import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiAlertCircle, FiCheckCircle, FiEdit2, FiRefreshCw, FiX } from "react-icons/fi";
import { usePendingOrders, type PendingOrder } from "../../context/PendingOrdersContext";

function OrderEntry({ order }: { order: PendingOrder }) {
  const { retry, restoreAndEdit, dismiss } = usePendingOrders();
  const { status, retries, tableNo, total, localId } = order;

  const label = tableNo != null ? `Table ${tableNo}` : "Takeaway";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={`
        glass-card rounded-2xl pl-4 pr-3 py-3 flex items-center gap-3 shadow-elevated min-w-0
        border transition-colors
        ${status === "failed"     ? "border-dhaba-danger/40"  : ""}
        ${status === "saved"      ? "border-dhaba-success/40" : ""}
        ${status === "submitting" ? "border-dhaba-border/40"  : ""}
      `}
    >
      {/* Status icon */}
      <div className="shrink-0 text-base">
        {status === "submitting" && (
          <span className="inline-block h-4 w-4 border-2 border-dhaba-warning border-t-transparent rounded-full animate-spin" />
        )}
        {status === "saved"  && <FiCheckCircle  className="text-dhaba-success" />}
        {status === "failed" && <FiAlertCircle  className="text-dhaba-danger"  />}
      </div>

      {/* Order info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-dhaba-text truncate">
          {label} · ₹{total.toLocaleString("en-IN")}
        </p>
        <p className={`text-[10px] font-semibold mt-0.5 ${
          status === "submitting" ? "text-dhaba-warning" :
          status === "saved"      ? "text-dhaba-success" :
                                    "text-dhaba-danger"
        }`}>
          {status === "submitting" && `Saving${retries > 0 ? ` (retry ${retries}/${MAX_DISPLAY_RETRIES})` : ""}…`}
          {status === "saved"      && "Saved ✓"}
          {status === "failed"     && "Failed to save"}
        </p>
      </div>

      {/* Failed: retry + edit */}
      {status === "failed" && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => retry(localId)}
            title="Retry"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold
              bg-dhaba-accent/10 text-dhaba-accent border border-dhaba-accent/30
              hover:bg-dhaba-accent/20 transition-colors"
          >
            <FiRefreshCw className="text-[10px]" /> Retry
          </button>
          <button
            onClick={() => restoreAndEdit(localId)}
            title="Edit order"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold
              bg-dhaba-surface text-dhaba-muted border border-dhaba-border/50
              hover:text-dhaba-text transition-colors"
          >
            <FiEdit2 className="text-[10px]" /> Edit
          </button>
        </div>
      )}

      {/* Saved: dismiss */}
      {status === "saved" && (
        <button
          onClick={() => dismiss(localId)}
          className="shrink-0 text-dhaba-muted hover:text-dhaba-text transition-colors"
        >
          <FiX className="text-sm" />
        </button>
      )}
    </motion.div>
  );
}

const MAX_DISPLAY_RETRIES = 3;

export default function PendingOrdersTray() {
  const { orders } = usePendingOrders();
  if (orders.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 w-72 space-y-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {orders.map(order => (
          <div key={order.localId} className="pointer-events-auto">
            <OrderEntry order={order} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
