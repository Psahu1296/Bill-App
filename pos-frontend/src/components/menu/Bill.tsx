import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { getTotalPrice } from "../../redux/slices/cartSlice";
import { addOrder, createOrderRazorpay, updateOrder, verifyPaymentRazorpay, getOrderById } from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  const [discount, setDiscount] = useState(0);
  const [roundOffEnabled, setRoundOffEnabled] = useState(false);

  const afterDiscount = Math.max(0, total - discount);
  const roundedTotal = roundOffEnabled ? Math.round(afterDiscount / 10) * 10 : afterDiscount;
  const roundOff = roundedTotal - afterDiscount;
  const finalTotal = roundedTotal;

  // Fetch saved order when editing an existing one — bills must come from DB, not UI
  const { data: existingOrderRes } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderById(orderId!),
    enabled: !!orderId,
  });
  const existingOrder = (existingOrderRes?.data as { data?: Order })?.data;

  // Auto-update bills in DB whenever tax/discount/roundoff changes for an existing order
  const billSyncDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!orderId) return;
    if (billSyncDebounce.current) clearTimeout(billSyncDebounce.current);
    billSyncDebounce.current = setTimeout(() => {
      updateOrder({
        id: orderId,
        bills: {
          total: Math.floor(total),
          ...(discount > 0 && { discount }),
          ...(roundOffEnabled && roundOff !== 0 && { roundOff }),
          totalWithTax: Math.round(finalTotal),
        },
      } as { id: string; [key: string]: unknown });
    }, 500);
    return () => { if (billSyncDebounce.current) clearTimeout(billSyncDebounce.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discount, roundOffEnabled, orderId, total]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [showInvoice, setShowInvoice] = useState(false);
  const [orderInfo, setOrderInfo] = useState<Order | undefined>();

  const buildOrderData = () => ({
    customerDetails: { name: customerData.customerName, phone: customerData.customerPhone, guests: customerData.guests },
    orderStatus: "In Progress" as OrderStatus,
    bills: {
      total: Math.floor(total),
      ...(discount > 0 && { discount }),
      ...(roundOffEnabled && roundOff !== 0 && { roundOff }),
      totalWithTax: Math.round(finalTotal),
    },
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
        const { data } = await createOrderRazorpay({ amount: finalTotal });
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
    if (orderId) {
      // Existing order: never rebake bills — only send payment fields
      const amountAlreadyPaid = existingOrder?.amountPaid ?? orderInfo?.amountPaid ?? 0;
      updateOrder({
        id: orderId,
        amountPaid: amountAlreadyPaid + paidAmount,
        paymentMethod: payMethod,
        paymentStatus: isFullyPaid ? "Paid" : "Pending",
        orderStatus: "Completed",
      }).then((resData) => {
        const { data } = (resData as { data: { data: Order } }).data;
        setOrderInfo(data);
        dispatch(removeCustomer());
        dispatch(removeAllItems());
        queryClient.invalidateQueries({ queryKey: ["earnings"] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        enqueueSnackbar("Order Processed!", { variant: "success" });
        setIsPayModalOpen(false);
        navigate("/", { replace: true });
      }).catch((error: { response?: { data?: { message?: string } } }) => {
        enqueueSnackbar(error.response?.data?.message || "Failed to process payment.", { variant: "error" });
      });
    } else {
      // New order: bake in current bills (discount/roundoff) + payment
      const orderData = buildOrderData();
      orderMutation.mutate({
        ...orderData,
        amountPaid: paidAmount,
        paymentMethod: payMethod,
      } as unknown as OrderMutationData);
    }
  };

  // For PayModal: use DB data for existing orders but always override bills with
  // the locally-computed total so the modal reflects discount/roundoff instantly
  // without waiting for a query refetch.
  const currentOrderData = orderId && existingOrder
    ? {
        ...existingOrder,
        bills: {
          ...existingOrder.bills,
          totalWithTax: Math.round(finalTotal),
        },
      }
    : buildOrderData();

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="space-y-2">
        {/* Subtotal */}
        <div className="flex justify-between text-xs">
          <span className="text-dhaba-muted">Items ({cartData.length})</span>
          <span className="text-dhaba-text font-semibold">₹{total.toFixed(2)}</span>
        </div>

        {/* Discount row */}
        <div className="flex justify-between items-center text-xs">
          <label className="text-dhaba-muted">Discount (₹)</label>
          <div className="flex items-center gap-2">
            {discount > 0 && (
              <span className="text-red-400 font-semibold">-₹{discount.toFixed(2)}</span>
            )}
            <input
              type="number"
              min={0}
              max={total}
              value={discount === 0 ? "" : discount}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setDiscount(Math.min(val, total));
              }}
              placeholder="0"
              className="w-16 text-right bg-dhaba-surface border border-dhaba-border/30 rounded-lg px-2 py-1 text-dhaba-text text-xs focus:outline-none focus:border-dhaba-accent/50"
            />
          </div>
        </div>

        {/* Round Off row */}
        <div className="flex justify-between items-center text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-dhaba-muted">
            <input
              type="checkbox"
              checked={roundOffEnabled}
              onChange={(e) => setRoundOffEnabled(e.target.checked)}
              className="w-3 h-3 accent-dhaba-accent cursor-pointer"
            />
            Round Off
          </label>
          {roundOffEnabled && roundOff !== 0 && (
            <span className={`font-semibold ${roundOff > 0 ? "text-dhaba-success" : "text-red-400"}`}>
              {roundOff > 0 ? "+" : ""}₹{roundOff.toFixed(2)}
            </span>
          )}
        </div>

        <div className="h-px bg-dhaba-border/20" />
        <div className="flex justify-between">
          <span className="text-dhaba-accent text-xs font-bold uppercase tracking-wider">Total</span>
          <span className="font-display text-lg font-bold text-dhaba-accent">₹{finalTotal.toFixed(0)}</span>
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
