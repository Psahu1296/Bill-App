import React, { useState } from "react";
import { useNotifications } from "../../context/NotificationContext";
import { FaCheckDouble, FaPhone, FaUser, FaUtensils } from "react-icons/fa";
import { IoCheckmarkDoneCircle, IoTimeOutline } from "react-icons/io5";
import { MdTableRestaurant } from "react-icons/md";
import { formatDateAndTime, getAvatarName } from "../../utils/index";
import { useNavigate } from "react-router-dom";
import { setCustomer, updateTable as tableStateUpdate } from "../../redux/slices/customerSlice";
import { updateList } from "../../redux/slices/cartSlice";
import { useAppDispatch } from "../../redux/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrderStatus, deleteOrder } from "../../https/index";
import { enqueueSnackbar } from "notistack";
import PayRemainingModal from "./PayRemainingModal";
import type { Order, OrderStatus } from "../../types";
import { MdDeleteOutline } from "react-icons/md";

interface OrderCardProps {
  order: Order;
}

const STATUS_OPTIONS: OrderStatus[] = ["In Progress", "Ready", "Completed"];

const statusBtnCfg: Record<OrderStatus, { active: string; idle: string; label: string }> = {
  "In Progress": {
    active: "bg-dhaba-accent/20 text-dhaba-accent border border-dhaba-accent/40 shadow-sm",
    idle:   "text-dhaba-muted hover:text-dhaba-accent hover:bg-dhaba-accent/10",
    label:  "In Progress",
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

const OrderCard: React.FC<OrderCardProps> = ({ order }) => {
  const dispatch      = useAppDispatch();
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const { notifications, clearNotification } = useNotifications();

  const [showPayModal, setShowPayModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const notification = notifications.get(order._id);
  const isHighlighted = !!notification;

  const isCompleted   = order.orderStatus === "Completed";
  const isReady       = order.orderStatus === "Ready";
  const isInProgress  = order.orderStatus === "In Progress";
  const balanceDue    = Math.max(0, order.bills.totalWithTax - (order.amountPaid || 0));
  const isFullyPaid   = balanceDue < 0.01;

  const statusMutation = useMutation({
    mutationFn: (newStatus: OrderStatus) =>
      updateOrderStatus({
        orderId: order._id,
        orderStatus: newStatus,
        paymentStatus: order.paymentStatus,
      }),
    onSuccess: (_, newStatus) => {
      enqueueSnackbar(`Status updated to "${newStatus}"`, { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: () => {
      enqueueSnackbar("Failed to update status.", { variant: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrder(order._id, deletePassword),
    onSuccess: () => {
      enqueueSnackbar("Order deleted.", { variant: "success" });
      setShowDeleteConfirm(false);
      setDeletePassword("");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      enqueueSnackbar(msg ?? "Failed to delete order.", { variant: "error" });
    },
  });

  const handleStatusChange = (e: React.MouseEvent, newStatus: OrderStatus) => {
    e.stopPropagation();
    if (newStatus === order.orderStatus || statusMutation.isPending) return;
    // If marking complete with unpaid balance → show payment modal first
    if (newStatus === "Completed" && balanceDue > 0.01) {
      setShowPayModal(true);
      return;
    }
    statusMutation.mutate(newStatus);
  };

  const onOrderClick = () => {
    if (isCompleted) {
      navigate(`/order-summary?orderId=${order._id}`);
      return;
    }
    const { customerDetails, table, items } = order;
    dispatch(setCustomer({ ...customerDetails } as { name: string; phone: string; guests: number }));
    if (table) {
      dispatch(tableStateUpdate({ table: { tableId: table._id, tableNo: table.tableNo } }));
    }
    dispatch(updateList([...items]));
    navigate(`/menu?orderId=${order._id}`);
  };

  // ── Status config (card styling) ──────────────────────────────
  const cardCfg = {
    "In Progress": {
      border:   "border-l-4 border-l-dhaba-accent",
      headerBg: "bg-dhaba-accent/5",
      badge:    "bg-dhaba-accent/15 text-dhaba-accent",
      icon:     <span className="inline-block h-2 w-2 rounded-full bg-dhaba-accent animate-pulse mr-1.5 align-middle" />,
      subtext:  "Kitchen is preparing",
    },
    "Ready": {
      border:   "border-l-4 border-l-dhaba-success",
      headerBg: "bg-dhaba-success/5",
      badge:    "bg-dhaba-success/15 text-dhaba-success",
      icon:     <FaCheckDouble className="inline mr-1.5 text-xs" />,
      subtext:  "Ready to serve",
    },
    "Completed": {
      border:   balanceDue > 0.01 ? "border-l-4 border-l-dhaba-danger" : "border-l-4 border-l-dhaba-border/40",
      headerBg: "bg-transparent",
      badge:    "bg-dhaba-success/15 text-dhaba-success",
      icon:     <IoCheckmarkDoneCircle className="inline h-4 w-4 mr-1.5" />,
      subtext:  balanceDue > 0.01 ? "Balance pending" : "Fully paid",
    },
    "Cancelled": {
      border:   "border-l-4 border-l-dhaba-danger",
      headerBg: "bg-dhaba-danger/5",
      badge:    "bg-dhaba-danger/15 text-dhaba-danger",
      icon:     null,
      subtext:  "Order cancelled",
    },
  } as const;

  const cfg = cardCfg[order.orderStatus as keyof typeof cardCfg] ?? cardCfg["In Progress"];

  // ── Batch grouping ───────────────────────────────────────────
  const batchGroups = (() => {
    const map = new Map<number, typeof order.items>();
    order.items.forEach(i => {
      const b = i.batch ?? 1;
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(i);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  })();
  const hasMultipleBatches = batchGroups.length > 1;

  // ── Items preview (first 3, single-batch only) ────────────────
  const previewItems = order.items.slice(0, 3);
  const extraItems   = order.items.length - 3;

  return (
    <>
    <div
      onClick={() => { clearNotification(order._id); onOrderClick(); }}
      className={`w-full glass-card rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer
        hover:-translate-y-0.5 hover:shadow-glow
        ${isHighlighted ? "ring-2 ring-dhaba-accent animate-pulse shadow-glow" : cfg.border}
        ${isCompleted && isFullyPaid ? "opacity-60" : ""}
      `}
    >
      {/* ── Header ── */}
      <div className={`flex items-center justify-between px-4 py-3 ${cfg.headerBg} border-b border-dhaba-border/20`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold text-dhaba-bg shrink-0
            ${isInProgress ? "bg-gradient-warm" : isReady ? "bg-dhaba-success" : "bg-dhaba-muted/40"}
          `}>
            {getAvatarName(order.customerDetails.name)}
          </div>
          <div>
            <p className="font-bold text-dhaba-text text-sm leading-tight">{order.customerDetails.name}</p>
            <div className="flex items-center gap-2 text-[11px] text-dhaba-muted mt-0.5">
              <span className="flex items-center gap-1">
                <FaPhone className="text-[9px]" />{order.customerDetails.phone}
              </span>
              <span className="opacity-40">·</span>
              <span className="flex items-center gap-1">
                <FaUser className="text-[9px]" />{order.customerDetails.guests} guests
              </span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-dhaba-muted hover:text-dhaba-danger hover:bg-dhaba-danger/10 transition-colors mb-0.5"
            title="Delete order"
          >
            <MdDeleteOutline className="text-base" />
          </button>
          {isHighlighted && (
            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg bg-dhaba-accent text-dhaba-bg animate-bounce">
              {notification?.type === "new_order" ? "🔔 New Order!" : "➕ Items Added!"}
            </span>
          )}
          {!isHighlighted && hasMultipleBatches && (
            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg bg-dhaba-accent/15 text-dhaba-accent">
              Multi-round
            </span>
          )}
          <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-lg ${cfg.badge}`}>
            {cfg.icon}{order.orderStatus}
          </span>
          <p className="text-[10px] text-dhaba-muted mt-0.5">{cfg.subtext}</p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-4 py-3 space-y-3">
        {/* Table + time */}
        <div className="flex items-center justify-between text-xs text-dhaba-muted">
          <span className="flex items-center gap-1.5 font-semibold">
            <MdTableRestaurant className="text-sm" />{order.table ? `Table ${order.table.tableNo}` : (order.orderType ?? "Online")}
          </span>
          <span className="flex items-center gap-1.5">
            <IoTimeOutline className="text-sm" />{formatDateAndTime(order.orderDate)}
          </span>
        </div>

        {/* Items — grouped by batch when multi-round, flat preview otherwise */}
        {hasMultipleBatches ? (
          <div className="space-y-2">
            {batchGroups.map(([batch, batchItems]) => (
              <div key={batch}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md
                    ${batch === 1
                      ? "bg-dhaba-surface text-dhaba-muted"
                      : "bg-dhaba-accent/15 text-dhaba-accent"
                    }`}
                  >
                    {batch === 1 ? "Round 1" : `Round ${batch}`}
                  </span>
                  <div className="flex-1 h-px bg-dhaba-border/30" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {batchItems.map((item, i) => (
                    <span
                      key={i}
                      className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-medium
                        ${batch === 1
                          ? "bg-dhaba-surface/60 text-dhaba-text"
                          : "bg-dhaba-accent/10 text-dhaba-accent"
                        }`}
                    >
                      <FaUtensils className="text-[9px] opacity-60" />
                      {item.name}
                      <span className="opacity-60">×{item.quantity}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {previewItems.map((item, i) => (
              <span
                key={i}
                className="flex items-center gap-1 text-[11px] bg-dhaba-surface/60 text-dhaba-text px-2.5 py-1 rounded-lg font-medium"
              >
                <FaUtensils className="text-[9px] text-dhaba-muted" />
                {item.name}
                <span className="text-dhaba-muted">×{item.quantity}</span>
              </span>
            ))}
            {extraItems > 0 && (
              <span className="text-[11px] text-dhaba-accent font-bold px-2 py-1 rounded-lg bg-dhaba-accent/10">
                +{extraItems} more
              </span>
            )}
          </div>
        )}

        {/* ── Bill row ── */}
        <div className="flex items-center justify-between pt-1 border-t border-dhaba-border/20">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] text-dhaba-muted uppercase tracking-wider">Total</p>
              <p className="font-bold text-dhaba-text text-base">₹{order.bills.totalWithTax.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-dhaba-muted uppercase tracking-wider">Paid</p>
              <p className="font-semibold text-dhaba-success text-sm">₹{(order.amountPaid || 0).toFixed(0)}</p>
            </div>
          </div>

          {balanceDue > 0.01 ? (
            <div className="text-right">
              <p className="text-[10px] text-dhaba-muted uppercase tracking-wider">Due</p>
              <p className="font-bold text-dhaba-danger text-base">₹{balanceDue.toFixed(0)}</p>
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold text-dhaba-success bg-dhaba-success/10 px-3 py-1.5 rounded-xl">
              <IoCheckmarkDoneCircle className="text-sm" /> Paid
            </span>
          )}
        </div>

        {/* ── Status switcher ── */}
        <div
          className="flex items-center gap-1 pt-1 border-t border-dhaba-border/20"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] text-dhaba-muted font-bold uppercase tracking-wider mr-1 shrink-0">
            Status:
          </span>
          <div className="flex flex-1 gap-1">
            {STATUS_OPTIONS.map((s) => {
              const btnCfg  = statusBtnCfg[s];
              const isActive = order.orderStatus === s;
              const isLoading = statusMutation.isPending && statusMutation.variables === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={(e) => handleStatusChange(e, s)}
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
      </div>
    </div>

    {showDeleteConfirm && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); setDeletePassword(""); }}
      >
        <div
          className="glass-card rounded-2xl p-6 w-80 shadow-glow"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-dhaba-danger/15 flex items-center justify-center shrink-0">
              <MdDeleteOutline className="text-xl text-dhaba-danger" />
            </div>
            <div>
              <p className="font-bold text-dhaba-text text-sm">Delete Order?</p>
              <p className="text-xs text-dhaba-muted">#{order._id} · {order.customerDetails.name}</p>
            </div>
          </div>
          <p className="text-xs text-dhaba-muted mb-4 leading-relaxed">
            This permanently deletes the order and reverses any outstanding ledger balance and earnings.
          </p>
          <input
            type="password"
            placeholder="Enter your password to confirm"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="glass-input w-full rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-dhaba-danger/50"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-dhaba-surface text-dhaba-muted hover:bg-dhaba-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={deleteMutation.isPending || !deletePassword}
              onClick={() => deleteMutation.mutate()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-dhaba-danger/15 text-dhaba-danger hover:bg-dhaba-danger/25 transition-colors disabled:opacity-50"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    )}

    {showPayModal && (
      <div onClick={(e) => e.stopPropagation()}>
        <PayRemainingModal
          order={order}
          balanceDue={balanceDue}
          onClose={() => setShowPayModal(false)}
          onSuccess={() => {
            setShowPayModal(false);
            queryClient.invalidateQueries({ queryKey: ["orders"] });
          }}
        />
      </div>
    )}
    </>
  );
};

export default OrderCard;
