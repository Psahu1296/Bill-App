import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaTimes, FaPhone, FaUser, FaMotorcycle, FaMapMarkerAlt,
  FaUtensils, FaEdit, FaCheckCircle, FaBan,
} from "react-icons/fa";
import { MdReceipt } from "react-icons/md";
import { IoTimeOutline, IoCheckmarkDoneCircle } from "react-icons/io5";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../redux/hooks";
import { setCustomer, updateTable as tableStateUpdate } from "../../redux/slices/customerSlice";
import { updateList } from "../../redux/slices/cartSlice";
import { updateOrderStatus } from "../../https/index";
import { formatDateAndTime } from "../../utils/index";
import PayRemainingModal from "./PayRemainingModal";
import type { Order, OrderStatus } from "../../types";

interface Props {
  order: Order;
  onClose: () => void;
}

const STATUS_FLOW: OrderStatus[] = ["Cooking", "Ready", "Completed"];

function ProgressBar({ currentStatus }: { currentStatus: OrderStatus }) {
  const currentIdx = STATUS_FLOW.indexOf(currentStatus);
  return (
    <div className="flex items-center justify-between">
      {STATUS_FLOW.map((s, i) => {
        const isDone   = currentIdx > i;
        const isActive = currentIdx === i;
        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isDone   ? "bg-dhaba-success text-dhaba-bg" :
                isActive ? "bg-dhaba-accent text-dhaba-bg ring-2 ring-dhaba-accent/30" :
                           "bg-dhaba-surface text-dhaba-muted"
              }`}>
                {isDone ? <IoCheckmarkDoneCircle className="text-sm" /> : s[0]}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${
                isActive ? "text-dhaba-accent" : isDone ? "text-dhaba-success" : "text-dhaba-muted"
              }`}>{s}</span>
            </div>
            {i < STATUS_FLOW.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded-full ${isDone ? "bg-dhaba-success" : "bg-dhaba-border/20"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const DeliveryOrderModal: React.FC<Props> = ({ order, onClose }) => {
  const dispatch    = useAppDispatch();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const [showPayModal, setShowPayModal] = useState(false);

  const balanceDue  = Math.max(0, order.bills.totalWithTax - (order.amountPaid || 0));
  const isCompleted = order.orderStatus === "Completed";
  const isCancelled = order.orderStatus === "Cancelled";
  const isPending   = order.orderStatus === "Pending";

  const statusMutation = useMutation({
    mutationFn: (newStatus: OrderStatus) =>
      updateOrderStatus({ orderId: order._id, orderStatus: newStatus, paymentStatus: order.paymentStatus }),
    onSuccess: (_, newStatus) => {
      enqueueSnackbar(
        newStatus === "Cancelled" ? "Order rejected." : `Status → ${newStatus}`,
        { variant: newStatus === "Cancelled" ? "error" : "success" }
      );
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (newStatus === "Cancelled") onClose();
    },
    onError: () => enqueueSnackbar("Failed to update status.", { variant: "error" }),
  });

  const handleEditOrder = () => {
    const { customerDetails, table, items } = order;
    dispatch(setCustomer({ ...customerDetails } as { name: string; phone: string; guests: number }));
    if (table) dispatch(tableStateUpdate({ table: { tableId: table._id, tableNo: table.tableNo } }));
    dispatch(updateList([...items]));
    navigate(`/menu?orderId=${order._id}`);
    onClose();
  };

  const mutPending = statusMutation.isPending;

  return createPortal(
    <>
      <AnimatePresence>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, type: "spring", bounce: 0.4 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-[2rem] overflow-hidden flex flex-col max-h-[90vh] bg-dhaba-bg border border-dhaba-border/20 shadow-2xl shadow-blue-500/10"
          >
            {/* ── Premium Header ── */}
            <div className="relative overflow-hidden px-6 py-8 shrink-0 bg-gradient-to-br from-blue-600 via-blue-500 to-blue-800">
              {/* Decorative background elements */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
              <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-blue-300 opacity-20 rounded-full blur-xl"></div>
              
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-xl shadow-blue-900/30">
                    <FaMotorcycle className="text-white text-2xl drop-shadow-md" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-display text-xl font-bold text-white tracking-wide drop-shadow-sm">Delivery Order</h2>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border backdrop-blur-sm shadow-sm ${
                        isPending   ? "bg-orange-500/20 text-orange-100 border-orange-500/30" :
                        isCancelled ? "bg-red-500/20 text-red-100 border-red-500/30" :
                        isCompleted ? "bg-emerald-500/20 text-emerald-100 border-emerald-500/30" :
                                      "bg-white/20 text-white border-white/30"
                      }`}>
                        {order.orderStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-blue-100 font-medium">
                      <span className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-md backdrop-blur-sm">
                        <IoTimeOutline className="text-blue-200" />
                        {formatDateAndTime(order.orderDate)}
                      </span>
                      <span className="bg-black/20 px-2 py-0.5 rounded-md text-white font-mono uppercase tracking-wider backdrop-blur-sm">
                        #{order._id.slice(-6)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 bg-black/10 hover:bg-black/30 text-white/80 hover:text-white rounded-xl transition-all border border-white/5 hover:border-white/20 backdrop-blur-sm group"
                >
                  <FaTimes className="text-sm group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="overflow-y-auto flex-1 bg-dhaba-bg">
              {/* Customer */}
              <div className="px-6 py-5 border-b border-dhaba-border/10">
                <p className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider mb-3">Customer Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 glass-card bg-dhaba-surface/30 p-3 rounded-2xl border border-dhaba-border/10">
                    <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                      <FaUser className="text-blue-500 text-xs" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-dhaba-text leading-none mb-1">{order.customerDetails.name}</p>
                      <p className="text-xs text-dhaba-muted">{order.customerDetails.guests} person{order.customerDetails.guests > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 glass-card bg-dhaba-surface/30 p-3 rounded-2xl border border-dhaba-border/10">
                    <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                      <FaPhone className="text-green-500 text-xs" />
                    </div>
                    <div>
                      <a
                        href={`tel:${order.customerDetails.phone}`}
                        className="text-sm font-bold text-dhaba-text leading-none mb-1 hover:text-dhaba-accent transition-colors block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.customerDetails.phone}
                      </a>
                      <p className="text-xs text-dhaba-muted">Contact</p>
                    </div>
                  </div>
                  {order.deliveryAddress && (
                    <div className="col-span-2 flex items-start gap-3 glass-card bg-dhaba-surface/30 p-3 rounded-2xl border border-dhaba-border/10">
                      <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <FaMapMarkerAlt className="text-purple-500 text-xs" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-dhaba-muted mb-0.5">Delivery Address</p>
                        <p className="text-sm font-medium text-dhaba-text leading-snug">{order.deliveryAddress}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar (skip for Pending / Cancelled) */}
              {!isPending && !isCancelled && (
                <div className="px-6 py-5 border-b border-dhaba-border/10">
                  <p className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider mb-4">Live Progress</p>
                  <ProgressBar currentStatus={order.orderStatus} />
                </div>
              )}

              {/* Items */}
              <div className="px-6 py-5 border-b border-dhaba-border/10">
                <p className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider mb-3">
                  Order Items <span className="bg-dhaba-surface text-dhaba-text px-1.5 py-0.5 rounded text-[9px] ml-1">{order.items.length}</span>
                </p>
                <div className="space-y-1.5">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-2.5 rounded-xl hover:bg-dhaba-surface/50 border border-transparent hover:border-dhaba-border/20 transition-all group">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="h-8 w-8 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <FaUtensils className="text-[10px] text-orange-500" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-dhaba-text truncate">{item.name}</p>
                          {item.variantSize && (
                            <p className="text-[10px] text-dhaba-muted">{item.variantSize}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="flex items-center justify-center h-6 w-6 rounded-md bg-dhaba-surface text-xs font-medium text-dhaba-text shadow-sm">
                          {item.quantity}
                        </span>
                        <span className="text-sm font-bold text-dhaba-text w-16 text-right">
                          ₹{item.price.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bill summary */}
              <div className="px-6 py-5 bg-dhaba-surface/10">
                <div className="glass-card rounded-2xl p-4 border border-dhaba-border/10 shadow-sm relative overflow-hidden bg-dhaba-bg/50">
                  <MdReceipt className="absolute -right-4 -bottom-4 text-6xl text-dhaba-text opacity-[0.03] rotate-12" />
                  
                  <p className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider mb-4">Payment Summary</p>
                  
                  <div className="space-y-2.5 relative z-10">
                    <div className="flex justify-between text-sm font-medium text-dhaba-muted">
                      <span>Subtotal</span>
                      <span className="text-dhaba-text">₹{order.bills.total.toFixed(0)}</span>
                    </div>
                    {order.bills.discount ? (
                      <div className="flex justify-between text-sm font-medium text-dhaba-success">
                        <span>Discount applied</span>
                        <span>-₹{order.bills.discount.toFixed(0)}</span>
                      </div>
                    ) : null}
                    {order.bills.roundOff ? (
                      <div className="flex justify-between text-sm font-medium text-dhaba-muted">
                        <span>Round off</span>
                        <span>{order.bills.roundOff > 0 ? "+" : ""}₹{order.bills.roundOff.toFixed(0)}</span>
                      </div>
                    ) : null}
                    
                    <div className="border-t border-dashed border-dhaba-border/30 pt-3 mt-2">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-bold text-dhaba-text">Grand Total</span>
                        <span className="text-xl font-display font-black text-blue-500 drop-shadow-sm">₹{order.bills.totalWithTax.toFixed(0)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-dhaba-bg border border-dhaba-border/20 rounded-xl p-2.5 text-center shadow-inner">
                          <p className="text-[9px] text-dhaba-muted uppercase tracking-wider mb-0.5">Amount Paid</p>
                          <p className="font-bold text-dhaba-success text-sm">₹{(order.amountPaid || 0).toFixed(0)}</p>
                        </div>
                        <div className={`flex-1 border rounded-xl p-2.5 text-center shadow-inner ${
                          balanceDue > 0 ? "bg-red-500/5 border-red-500/20" : "bg-emerald-500/5 border-emerald-500/20"
                        }`}>
                          <p className={`text-[9px] uppercase tracking-wider mb-0.5 ${balanceDue > 0 ? "text-red-500/70" : "text-emerald-500/70"}`}>Balance Due</p>
                          <p className={`font-bold text-sm ${balanceDue > 0 ? "text-red-500" : "text-emerald-500"}`}>
                            {balanceDue > 0 ? `₹${balanceDue.toFixed(0)}` : "Cleared"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Footer actions ── */}
            <div className="px-6 py-5 shrink-0 bg-dhaba-bg border-t border-dhaba-border/20">
              <div className="flex flex-col gap-3">
                {/* Pending: big accept / reject */}
                {isPending && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => statusMutation.mutate("Cancelled")}
                      disabled={mutPending}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold bg-white text-red-500 border border-red-100 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 dark:bg-red-500/10 dark:border-red-500/20 dark:hover:bg-red-500/20"
                    >
                      {mutPending && statusMutation.variables === "Cancelled"
                        ? <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        : <FaBan />}
                      Reject Order
                    </button>
                    <button
                      onClick={() => statusMutation.mutate("Cooking")}
                      disabled={mutPending}
                      className="flex-[2] flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-xl shadow-emerald-500/30 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {mutPending && statusMutation.variables === "Cooking"
                        ? <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        : <FaCheckCircle />}
                      Accept & Cook
                    </button>
                  </div>
                )}

                {/* Cooking → Ready */}
                {order.orderStatus === "Cooking" && (
                  <button
                    onClick={() => statusMutation.mutate("Ready")}
                    disabled={mutPending}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 shadow-xl shadow-orange-500/30 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {mutPending
                      ? <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : null}
                    Mark Ready for Pickup
                  </button>
                )}

                {/* Ready → Delivered */}
                {order.orderStatus === "Ready" && (
                  <button
                    onClick={() => balanceDue > 0.01 ? setShowPayModal(true) : statusMutation.mutate("Completed")}
                    disabled={mutPending}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {mutPending
                      ? <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : null}
                    {balanceDue > 0.01 ? `Collect ₹${balanceDue.toFixed(0)} & Complete` : "Confirm Delivery"}
                  </button>
                )}

                {/* Collect outstanding (any status) */}
                {balanceDue > 0.01 && !isPending && !isCancelled && order.orderStatus !== "Ready" && (
                  <button
                    onClick={() => setShowPayModal(true)}
                    className="w-full py-3 rounded-2xl text-sm font-bold text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-all shadow-sm active:scale-[0.98] dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-500 dark:hover:bg-amber-500/20"
                  >
                    Collect ₹{balanceDue.toFixed(0)} Payment
                  </button>
                )}

                {/* Edit + secondary actions */}
                <div className="flex gap-3 mt-1">
                  {!isCompleted && !isCancelled && (
                    <button
                      onClick={handleEditOrder}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold glass-input text-dhaba-text border border-dhaba-border/20 hover:bg-dhaba-surface hover:shadow-sm transition-all active:scale-[0.98]"
                    >
                      <FaEdit className="text-blue-500" /> Edit Order
                    </button>
                  )}
                  {isCompleted && (
                    <button
                      onClick={() => { navigate(`/order-summary?orderId=${order._id}`); onClose(); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold glass-input text-dhaba-text border border-dhaba-border/20 hover:bg-dhaba-surface hover:shadow-sm transition-all active:scale-[0.98]"
                    >
                      <MdReceipt className="text-blue-500" /> View Invoice
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="px-6 py-3 rounded-2xl text-sm font-semibold glass-input text-dhaba-muted hover:text-dhaba-text border border-dhaba-border/10 hover:bg-dhaba-surface transition-all active:scale-[0.98]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Pay modal sits outside the main modal so it renders on top */}
      {showPayModal && (
        <PayRemainingModal
          order={order}
          balanceDue={balanceDue}
          onClose={() => setShowPayModal(false)}
          onSuccess={() => {
            setShowPayModal(false);
            queryClient.invalidateQueries({ queryKey: ["orders"] });
          }}
        />
      )}
    </>,
    document.body
  );
};

export default DeliveryOrderModal;
