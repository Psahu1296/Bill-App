import React, { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrderById } from "../https";
import { enqueueSnackbar } from "notistack";
import BackButton from "../components/shared/BackButton";
import BottomNav from "../components/shared/BottomNav";
import type { Order } from "../types";
import { getAvatarName } from "../utils";
import PayRemainingModal from "../components/orders/PayRemainingModal";
import { IoPrintOutline } from "react-icons/io5";
import { printBill } from "../utils/printBill";

const OrderSummary: React.FC = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const navigate = useNavigate();
  const [isPayModalOpen, setIsPayModalOpen] = React.useState(false);

  const handlePrint = (order: Order) => printBill(order);

  useEffect(() => {
    document.title = "POS | Order Summary";
  }, []);

  const { data: resData, isLoading, isError, refetch } = useQuery({
    queryKey: ["orderSummary", orderId],
    queryFn: async () => {
      if (!orderId) throw new Error("No Order ID provided");
      return getOrderById(orderId);
    },
    enabled: !!orderId,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError) {
      enqueueSnackbar("Failed to load order summary", { variant: "error" });
      navigate("/orders");
    }
  }, [isError, navigate]);

  if (isLoading || !resData) {
    return (
      <div className="bg-dhaba-bg min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-4">
        <div className="spinner"></div>
        <p className="text-dhaba-accent font-display text-lg tracking-wider font-bold">Loading Order...</p>
      </div>
    );
  }

  const order = resData.data.data as Order;
  const balanceDue = Math.max(0, order.bills.totalWithTax - (order.amountPaid || 0));

  return (
    <section className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-24 overflow-y-auto">
      <div className="flex items-center gap-4 px-6 py-5">
        <BackButton />
        <h1 className="font-display text-2xl font-bold text-dhaba-text tracking-wider">Order Summary</h1>
      </div>

      <div className="max-w-4xl mx-auto px-6">
        <div className="glass-card rounded-2xl p-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-warm flex items-center justify-center text-xl font-bold text-dhaba-bg flex-shrink-0 shadow-glow">
              {getAvatarName(order.customerDetails.name)}
            </div>
            <div>
              <h2 className="text-dhaba-text font-semibold text-lg">{order.customerDetails.name}</h2>
              <p className="text-dhaba-muted text-sm mt-0.5">{order.customerDetails.phone}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-dhaba-muted text-xs font-bold tracking-widest uppercase">Order #{order._id.slice(-6)}</p>
            <p className="text-dhaba-text text-sm font-semibold mt-1">Table T-{order.table?.tableNo || "N/A"}</p>
            <p className="text-dhaba-muted text-sm mt-0.5">Guests: {order.customerDetails.guests}</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 mb-6">
          <h3 className="section-title text-dhaba-text mb-4 border-b border-dhaba-border/20 pb-4">Order Items</h3>
          <div className="space-y-4">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className="glass-input w-10 h-10 rounded-xl flex items-center justify-center text-dhaba-accent font-bold text-sm">
                    {item.quantity}×
                  </div>
                  <div>
                    <p className="text-dhaba-text font-semibold text-sm">{item.name}</p>
                    {item.variantSize && <p className="text-dhaba-muted text-xs mt-0.5">{item.variantSize}</p>}
                  </div>
                </div>
                <p className="font-display text-lg font-bold text-dhaba-text">₹{(item.price).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 mb-8">
          <h3 className="section-title text-dhaba-text mb-4 border-b border-dhaba-border/20 pb-4">Billing Details</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-dhaba-muted text-sm">
              <p>Subtotal</p>
              <p className="font-semibold text-dhaba-text">₹{order.bills.total.toFixed(2)}</p>
            </div>
            {!!order.bills.discount && (
              <div className="flex justify-between text-dhaba-muted text-sm">
                <p>Discount</p>
                <p className="font-semibold text-red-400">-₹{order.bills.discount.toFixed(2)}</p>
              </div>
            )}
            {!!order.bills.roundOff && (
              <div className="flex justify-between text-dhaba-muted text-sm">
                <p>Round Off</p>
                <p className="font-semibold text-dhaba-text">{order.bills.roundOff > 0 ? "+" : ""}₹{order.bills.roundOff.toFixed(2)}</p>
              </div>
            )}
            <div className="flex justify-between pt-4 border-t border-dhaba-border/20">
              <p className="text-dhaba-text font-bold uppercase tracking-wider text-sm">Total Bill</p>
              <p className="font-display text-2xl font-bold text-dhaba-text">₹{order.bills.totalWithTax.toFixed(2)}</p>
            </div>
            <div className="flex justify-between text-dhaba-muted text-sm pt-2">
              <p>Amount Paid ({order.paymentMethod})</p>
              <p className="font-semibold text-dhaba-success">₹{(order.amountPaid || 0).toFixed(2)}</p>
            </div>
            {balanceDue > 0 && (
              <div className="flex justify-between items-center pt-3 border-t border-dhaba-border/20 mt-3">
                <p className="text-dhaba-accent font-bold uppercase tracking-wider text-sm">Balance Due</p>
                <p className="font-display text-2xl font-bold text-dhaba-danger">₹{balanceDue.toFixed(2)}</p>
              </div>
            )}
          </div>

          <div className="space-y-3 mt-8">
            {balanceDue > 0 && (
              <button
                onClick={() => setIsPayModalOpen(true)}
                className="w-full btn-accent rounded-xl py-4 font-bold text-base shadow-glow-lg focus:outline-none"
              >
                Pay Remaining Balance
              </button>
            )}
            <button
              onClick={() => handlePrint(order)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-dhaba-success/10 text-dhaba-success font-bold text-base border border-dhaba-success/20 hover:bg-dhaba-success/20 transition-colors"
            >
              <IoPrintOutline className="text-xl" /> Print Invoice
            </button>
          </div>
        </div>
      </div>
      <BottomNav />
      
      {isPayModalOpen && (
         <PayRemainingModal
           onClose={() => setIsPayModalOpen(false)}
           order={order} 
           balanceDue={balanceDue} 
           onSuccess={() => {
             setIsPayModalOpen(false);
             refetch();
           }}
         />
      )}
    </section>
  );
};

export default OrderSummary;
