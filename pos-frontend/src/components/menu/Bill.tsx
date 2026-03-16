import React, { useState } from "react";
import { useSelector } from "react-redux";
import { getTotalPrice } from "../../redux/slices/cartSlice";
import { addOrder, createOrderRazorpay, updateOrder, verifyPaymentRazorpay } from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeAllItems } from "../../redux/slices/cartSlice";
import { removeCustomer } from "../../redux/slices/customerSlice";
import Invoice from "../invoice/Invoice";
import { useNavigate, useSearchParams } from "react-router-dom";
import PayModal from "./PayModal";
import { useAppDispatch } from "../../redux/hooks";
import type { RootState } from "../../redux/store";
import type { Order, AddOrderPayload, PaymentMethod, OrderStatus } from "../../types";

declare global {
  interface Window { Razorpay: new (options: Record<string, unknown>) => { open: () => void }; }
}

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const Bill: React.FC = () => {
  const dispatch = useAppDispatch();
  const [param] = useSearchParams();
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const orderId = param.get("orderId");
  const navigate = useNavigate();

  const customerData = useSelector((state: RootState) => state.customer);
  const cartData = useSelector((state: RootState) => state.cart);
  const total = useSelector(getTotalPrice);
  const taxRate = 5.25;
  const tax = (total * taxRate) / 100;
  const totalPriceWithTax = total + tax;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [showInvoice, setShowInvoice] = useState(false);
  const [orderInfo, setOrderInfo] = useState<Order | undefined>();

  const buildOrderData = () => ({
    customerDetails: { name: customerData.customerName, phone: customerData.customerPhone, guests: customerData.guests },
    orderStatus: "In Progress" as OrderStatus,
    bills: { total: Math.floor(total), tax, totalWithTax: Math.floor(totalPriceWithTax) },
    items: cartData,
    table: customerData.table?.tableId,
    paymentMethod,
  });

  const handlePlaceOrder = async () => {
    if (!paymentMethod) { enqueueSnackbar("Please select a payment method!", { variant: "warning" }); return; }
    if (paymentMethod === "Online") {
      try {
        const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
        if (!res) { enqueueSnackbar("Razorpay SDK failed to load.", { variant: "warning" }); return; }
        const { data } = await createOrderRazorpay({ amount: totalPriceWithTax });
        const options = {
          key: `${import.meta.env.VITE_RAZORPAY_KEY_ID}`,
          amount: (data as { order: { amount: number; currency: string; id: string } }).order.amount,
          currency: (data as { order: { amount: number; currency: string; id: string } }).order.currency,
          name: "DHABA POS",
          description: "Secure Payment",
          order_id: (data as { order: { amount: number; currency: string; id: string } }).order.id,
          handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
            await verifyPaymentRazorpay(response);
            orderMutation.mutate({ ...buildOrderData(), paymentData: { razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id } });
          },
          prefill: { name: customerData.customerName, contact: customerData.customerPhone },
          theme: { color: "#E8A317" },
        };
        new window.Razorpay(options).open();
      } catch { enqueueSnackbar("Payment Failed!", { variant: "error" }); }
    } else {
      const orderData = orderId ? { id: orderId, ...buildOrderData() } : buildOrderData();
      orderMutation.mutate(orderData);
    }
  };

  type OrderMutationData = AddOrderPayload & { id?: string };

  const orderMutation = useMutation({
    mutationFn: (reqData: OrderMutationData) => (reqData.id ? updateOrder(reqData as unknown as { id: string; [key: string]: unknown }) : addOrder(reqData)),
    onSuccess: (resData) => {
      const { data } = (resData as { data: { data: Order } }).data;
      setOrderInfo(data);
      dispatch(removeCustomer());
      dispatch(removeAllItems());
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      enqueueSnackbar("Order Processed!", { variant: "success" });
      setIsPayModalOpen(false);
      navigate("/", { replace: true });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(error.response?.data?.message || "Failed to place order.", { variant: "error" });
    },
  });

  const handlePaymentSubmit = (paidAmount: number, payMethod: PaymentMethod, isFullyPaid: boolean) => {
    const orderData = buildOrderData();
    const amountAlreadyPaid = orderId && orderInfo ? (orderInfo.amountPaid || 0) : 0;
    const updates = {
      ...orderData,
      amountPaid: amountAlreadyPaid + paidAmount,
      paymentMethod: payMethod,
      paymentStatus: isFullyPaid ? "Paid" : "Pending",
      orderStatus: "Completed" as OrderStatus,
    };
    orderMutation.mutate(orderId ? { id: orderId, ...updates } : updates);
  };

  const currentOrderData = buildOrderData();

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-dhaba-muted">Items ({cartData.length})</span>
          <span className="text-dhaba-text font-semibold">₹{total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-dhaba-muted">Tax (5.25%)</span>
          <span className="text-dhaba-text font-semibold">₹{tax.toFixed(2)}</span>
        </div>
        <div className="h-px bg-dhaba-border/20" />
        <div className="flex justify-between">
          <span className="text-dhaba-accent text-xs font-bold uppercase tracking-wider">Total</span>
          <span className="font-display text-lg font-bold text-dhaba-accent">₹{totalPriceWithTax.toFixed(0)}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setPaymentMethod("Cash")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
            paymentMethod === "Cash" ? "bg-dhaba-accent/15 text-dhaba-accent border border-dhaba-accent/30" : "glass-input text-dhaba-muted"
          }`}
        >
          💵 Cash
        </button>
        <button
          disabled
          onClick={() => setPaymentMethod("Online")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all opacity-50 ${
            paymentMethod === "Online" ? "bg-dhaba-accent/15 text-dhaba-accent border border-dhaba-accent/30" : "glass-input text-dhaba-muted"
          }`}
        >
          💳 Online
        </button>
      </div>

      <div className="space-y-2">
        <button onClick={handlePlaceOrder} className="w-full btn-accent rounded-xl py-3 text-sm">
          {orderId ? "Update Order" : "Place Order"}
        </button>
        <button
          className="w-full py-2.5 rounded-xl bg-dhaba-success/10 text-dhaba-success font-bold text-sm border border-dhaba-success/20 hover:bg-dhaba-success/20 transition-colors"
          onClick={() => setIsPayModalOpen(true)}
        >
          Pay & Complete
        </button>
      </div>

      {showInvoice && orderInfo && <Invoice orderInfo={orderInfo} setShowInvoice={setShowInvoice} />}
      <PayModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        order={{ _id: orderId ?? "", ...currentOrderData } as Partial<Order> & { _id: string }}
        customerData={customerData}
        onSubmitPayment={handlePaymentSubmit}
      />
    </div>
  );
};

export default Bill;
