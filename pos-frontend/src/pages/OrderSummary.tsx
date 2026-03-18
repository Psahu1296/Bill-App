import React, { useEffect, useRef } from "react";
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

const OrderSummary: React.FC = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const navigate = useNavigate();
  const [isPayModalOpen, setIsPayModalOpen] = React.useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handlePrint = (order: Order) => {
    const WinPrint = window.open("", "", "width=500,height=750");
    if (!WinPrint) return;
    WinPrint.document.write(`<!DOCTYPE html><html><head><title>Receipt #${order._id.slice(-6)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; max-width: 400px; margin: auto; color: #222; }
      h2 { text-align:center; font-size: 1.3rem; margin-bottom: 4px; }
      p { margin: 2px 0; font-size: 0.85rem; }
      .row { display: flex; justify-content: space-between; }
      .divider { border: none; border-top: 1px dashed #999; margin: 8px 0; }
      .total { font-size: 1.1rem; font-weight: bold; }
      .footer { text-align: center; margin-top: 16px; font-size: 0.8rem; color: #888; }
    </style></head><body>
    <h2>&#x1F372; Dhaba POS</h2><p style="text-align:center;color:#888;">Order Receipt</p>
    <hr class="divider">
    <p>Order #: <strong>${order._id.slice(-6)}</strong></p>
    <p>Name: <strong>${order.customerDetails.name}</strong></p>
    <p>Phone: ${order.customerDetails.phone}</p>
    <p>Table: T-${order.table?.tableNo || "N/A"} &nbsp;|&nbsp; Guests: ${order.customerDetails.guests}</p>
    <hr class="divider">
    <p><strong>Items</strong></p>
    ${order.items.map(i => `<div class="row"><span>${i.name} (${i.variantSize}) x${i.quantity}</span><span>&#x20B9;${i.price.toFixed(2)}</span></div>`).join("")}
    <hr class="divider">
    <div class="row"><span>Subtotal</span><span>&#x20B9;${order.bills.total.toFixed(2)}</span></div>
    <div class="row"><span>Tax (5.25%)</span><span>&#x20B9;${order.bills.tax.toFixed(2)}</span></div>
    <div class="row total"><span>Total</span><span>&#x20B9;${order.bills.totalWithTax.toFixed(2)}</span></div>
    <hr class="divider">
    <div class="row"><span>Paid (${order.paymentMethod})</span><span>&#x20B9;${(order.amountPaid || 0).toFixed(2)}</span></div>
    <div class="footer">Thank you for dining with us! &#x2764;</div>
    </body></html>`);
    WinPrint.document.close();
    WinPrint.focus();
    setTimeout(() => { WinPrint.print(); WinPrint.close(); }, 600);
  };

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
            <div className="flex justify-between text-dhaba-muted text-sm">
              <p>Tax (5.25%)</p>
              <p className="font-semibold text-dhaba-text">₹{order.bills.tax.toFixed(2)}</p>
            </div>
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

          {balanceDue > 0 ? (
            <button
              onClick={() => setIsPayModalOpen(true)}
              className="w-full mt-8 btn-accent rounded-xl py-4 font-bold text-base shadow-glow-lg focus:outline-none"
            >
              Pay Remaining Balance
            </button>
          ) : (
            <button
              onClick={() => handlePrint(order)}
              className="w-full mt-8 flex items-center justify-center gap-2 py-4 rounded-xl bg-dhaba-success/10 text-dhaba-success font-bold text-base border border-dhaba-success/20 hover:bg-dhaba-success/20 transition-colors"
            >
              <IoPrintOutline className="text-xl" /> Print Invoice
            </button>
          )}
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
