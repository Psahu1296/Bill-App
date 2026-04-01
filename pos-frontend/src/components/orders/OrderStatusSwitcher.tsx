import React from "react";
import type { OrderStatus } from "../../types";

// For Pending orders, show Accept / Reject instead of the normal switcher
interface OrderStatusSwitcherProps {
  currentStatus: OrderStatus;
  isPending: boolean;
  pendingStatus: OrderStatus | undefined;
  onStatusChange: (e: React.MouseEvent, status: OrderStatus) => void;
}

const COOKING_OPTIONS: OrderStatus[] = ["Cooking", "Ready", "Completed"];

const statusBtnCfg: Record<string, { active: string; idle: string; label: string }> = {
  "Cooking": {
    active: "bg-dhaba-accent/20 text-dhaba-accent border border-dhaba-accent/40 shadow-sm",
    idle:   "text-dhaba-muted hover:text-dhaba-accent hover:bg-dhaba-accent/10",
    label:  "Cooking",
  },
  "In Progress": {
    active: "bg-dhaba-accent/20 text-dhaba-accent border border-dhaba-accent/40 shadow-sm",
    idle:   "text-dhaba-muted hover:text-dhaba-accent hover:bg-dhaba-accent/10",
    label:  "Cooking",
  },
  "Ready": {
    active: "bg-dhaba-success/20 text-dhaba-success border border-dhaba-success/40 shadow-sm",
    idle:   "text-dhaba-muted hover:text-dhaba-success hover:bg-dhaba-success/10",
    label:  "Ready",
  },
  "Completed": {
    active: "bg-dhaba-surface text-dhaba-text border border-dhaba-border/40 shadow-sm",
    idle:   "text-dhaba-muted hover:text-dhaba-text hover:bg-dhaba-surface-hover",
    label:  "Done",
  },
  "Cancelled": {
    active: "bg-dhaba-danger/20 text-dhaba-danger border border-dhaba-danger/40 shadow-sm",
    idle:   "text-dhaba-muted hover:text-dhaba-danger hover:bg-dhaba-danger/10",
    label:  "Cancelled",
  },
};

const OrderStatusSwitcher: React.FC<OrderStatusSwitcherProps> = ({
  currentStatus, isPending, pendingStatus, onStatusChange,
}) => {
  // Pending orders get Accept / Reject buttons
  if (currentStatus === "Pending") {
    const isAccepting = isPending && pendingStatus === "Cooking";
    const isRejecting = isPending && pendingStatus === "Cancelled";
    return (
      <div
        className="flex items-center gap-1 pt-1 border-t border-dhaba-border/20"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[10px] text-dhaba-warning font-bold uppercase tracking-wider mr-1 shrink-0 animate-pulse">
          New:
        </span>
        <div className="flex flex-1 gap-1">
          <button
            type="button"
            disabled={isPending}
            onClick={(e) => onStatusChange(e, "Cooking")}
            className="flex-1 flex items-center justify-center gap-1 text-[11px] font-bold py-1.5 rounded-xl transition-all duration-150 bg-dhaba-success/20 text-dhaba-success border border-dhaba-success/40 hover:bg-dhaba-success/30 disabled:cursor-not-allowed"
          >
            {isAccepting ? (
              <span className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
            ) : null}
            Accept
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={(e) => onStatusChange(e, "Cancelled")}
            className="flex-1 flex items-center justify-center gap-1 text-[11px] font-bold py-1.5 rounded-xl transition-all duration-150 bg-dhaba-danger/10 text-dhaba-danger border border-dhaba-danger/30 hover:bg-dhaba-danger/20 disabled:cursor-not-allowed"
          >
            {isRejecting ? (
              <span className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
            ) : null}
            Reject
          </button>
        </div>
      </div>
    );
  }

  // Normal switcher for Cooking / Ready / Completed
  const options = currentStatus === "In Progress" ? ["In Progress", "Ready", "Completed"] as const : COOKING_OPTIONS;
  return (
    <div
      className="flex items-center gap-1 pt-1 border-t border-dhaba-border/20"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-[10px] text-dhaba-muted font-bold uppercase tracking-wider mr-1 shrink-0">
        Status:
      </span>
      <div className="flex flex-1 gap-1">
        {options.map((s) => {
          const btnCfg  = statusBtnCfg[s];
          const isActive = currentStatus === s || (s === "Cooking" && currentStatus === "In Progress");
          const isLoading = isPending && pendingStatus === s;
          return (
            <button
              key={s}
              type="button"
              disabled={isPending}
              onClick={(e) => onStatusChange(e, s)}
              className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-bold py-1.5 rounded-xl transition-all duration-150
                ${isActive ? btnCfg.active : btnCfg.idle}
                disabled:cursor-not-allowed
              `}
            >
              {isLoading ? (
                <span className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
              ) : isActive ? (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              ) : null}
              {btnCfg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OrderStatusSwitcher;
