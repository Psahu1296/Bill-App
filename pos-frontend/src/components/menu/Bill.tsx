import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";
import { getTotalPrice } from "../../redux/slices/cartSlice";
import { addOrder, updateOrder, getOrderById, initiatePhonePePayment, getPhonePePaymentStatus } from "../../https/index";
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
  interface Window {
    PhonePeCheckout: {
      transact: (options: { tokenUrl: string; callback: (response: string) => void; type: "IFRAME" | "REDIRECT" }) => void;
      closePage: () => void;
    };
  }
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
  const [isPhonePeLoading, setIsPhonePeLoading] = useState(false);
  const [isPhonePeOpen, setIsPhonePeOpen] = useState(false);
  const [isPhonePePolling, setIsPhonePePolling] = useState(false);

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

  const handlePlaceOrder = () => {
    const orderData = orderId ? { id: orderId, ...buildOrderData() } : buildOrderData();
    orderMutation.mutate(orderData);
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

  const handlePaymentSubmit = async (paidAmount: number, payMethod: PaymentMethod, isFullyPaid: boolean) => {
    if (payMethod === "Online") {
      setIsPhonePeLoading(true);
      setIsPayModalOpen(false);
      let targetOrderId: string | null = orderId;
      try {
        if (!targetOrderId) {
          // New order — create it first so the webhook can reference it by ID
          const orderResp = await addOrder({ ...buildOrderData(), paymentStatus: "Pending" });
          targetOrderId = (orderResp.data as { data: { _id: string } }).data._id;
        }

        const { data: ppResp } = await initiatePhonePePayment({
          amount:        finalTotal,
          orderId:       targetOrderId,
          customerPhone: customerData.customerPhone,
          redirectUrl:   window.location.origin,
        });
        const tokenUrl = (ppResp as { data: { redirectUrl: string } }).data.redirectUrl;

        setIsPhonePeLoading(false);
        const loaded = await loadScript("https://mercury.phonepe.com/web/bundle/checkout.js");
        if (!loaded) { enqueueSnackbar("PhonePe SDK failed to load.", { variant: "warning" }); return; }

        const confirmedOrderId = targetOrderId;
        const confirmedAmount  = finalTotal;
        const merchantTxnId    = (ppResp as { data: { merchantTransactionId: string } }).data.merchantTransactionId;

        setIsPhonePeOpen(true);
        window.PhonePeCheckout.transact({
          tokenUrl,
          type: "IFRAME",
          callback: (response: string) => {
            setIsPhonePeOpen(false);
            if (response === "USER_CANCEL") {
              enqueueSnackbar("Payment cancelled.", { variant: "warning" });
              return;
            }
            if (response === "CONCLUDED") {
              // Poll PhonePe status API until COMPLETED/FAILED, then update order
              setIsPhonePePolling(true);
              let attempts = 0;
              const MAX = 15;
              const poll = setInterval(async () => {
                attempts++;
                try {
                  const res = await getPhonePePaymentStatus(merchantTxnId);
                  const state = (res.data as { data: { state: string } }).data.state;
                  if (state === "COMPLETED") {
                    clearInterval(poll);
                    setIsPhonePePolling(false);
                    await updateOrder({
                      id: confirmedOrderId!,
                      paymentStatus: "Paid",
                      paymentMethod: "Online",
                      amountPaid: confirmedAmount,
                      orderStatus: "Completed",
                    });
                    dispatch(removeCustomer());
                    dispatch(removeAllItems());
                    queryClient.invalidateQueries({ queryKey: ["earnings"] });
                    queryClient.invalidateQueries({ queryKey: ["orders"] });
                    enqueueSnackbar("Payment successful! Order completed.", { variant: "success" });
                    navigate("/", { replace: true });
                    return;
                  }
                  if (state === "FAILED") {
                    clearInterval(poll);
                    setIsPhonePePolling(false);
                    enqueueSnackbar("Payment failed. Please try again.", { variant: "error" });
                    return;
                  }
                } catch { /* keep polling on network error */ }
                if (attempts >= MAX) {
                  clearInterval(poll);
                  setIsPhonePePolling(false);
                  enqueueSnackbar("Could not verify payment. Check order status manually.", { variant: "warning" });
                  queryClient.invalidateQueries({ queryKey: ["orders"] });
                  navigate("/", { replace: true });
                }
              }, 2000);
            }
          },
        });
      } catch {
        setIsPhonePeLoading(false);
        setIsPhonePeOpen(false);
        // Cancel a freshly created order if PhonePe initiation failed
        if (!orderId && targetOrderId) {
          updateOrder({ id: targetOrderId, orderStatus: "Cancelled" }).catch(() => {});
        }
        enqueueSnackbar("PhonePe payment failed!", { variant: "error" });
      }
      return;
    }

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
        paymentStatus: isFullyPaid ? "Paid" : "Pending",
        orderStatus: isFullyPaid ? "Completed" : "In Progress",
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
          onClick={() => setPaymentMethod("Online")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
            paymentMethod === "Online" ? "bg-dhaba-accent/15 text-dhaba-accent border border-dhaba-accent/30" : "glass-input text-dhaba-muted"
          }`}
        >
          💳 Online
        </button>
      </div>

      <div className="space-y-2">
        <button
          onClick={handlePlaceOrder}
          disabled={isPhonePeLoading}
          className="w-full btn-accent rounded-xl py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPhonePeLoading ? "Connecting to PhonePe…" : orderId ? "Update Order" : "Place Order"}
        </button>
        <button
          className="w-full py-2.5 rounded-xl bg-dhaba-success/10 text-dhaba-success font-bold text-sm border border-dhaba-success/20 hover:bg-dhaba-success/20 transition-colors"
          onClick={() => setIsPayModalOpen(true)}
        >
          Pay & Complete
        </button>
      </div>

      {/* Close button rendered into body so it sits above the PhonePe iframe */}
      {isPhonePeOpen && createPortal(
        <button
          onClick={() => {
            window.PhonePeCheckout.closePage();
            setIsPhonePeOpen(false);
            enqueueSnackbar("Payment cancelled.", { variant: "warning" });
          }}
          style={{ position: "fixed", top: 16, right: 16, zIndex: 2147483647 }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dhaba-danger text-white text-sm font-bold shadow-lg hover:bg-dhaba-danger/80 transition-colors"
        >
          ✕ Close PhonePe
        </button>,
        document.body
      )}

      {/* Verification overlay shown after payment CONCLUDED while polling status */}
      {isPhonePePolling && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 2147483647, background: "rgba(0,0,0,0.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, border: "4px solid #E8A317", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Verifying payment…</p>
        </div>,
        document.body
      )}

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
