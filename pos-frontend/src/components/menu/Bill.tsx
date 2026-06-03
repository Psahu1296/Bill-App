import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { getTotalPrice } from "../../redux/slices/cartSlice";
import { addOrder, updateOrder, getOrderById } from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { removeAllItems } from "../../redux/slices/cartSlice";
import { removeCustomer } from "../../redux/slices/customerSlice";
import Invoice from "../invoice/Invoice";
import { useNavigate, useSearchParams } from "react-router-dom";
import PayModal from "./PayModal";
import UpiQrModal from "./UpiQrModal";
import { useAppDispatch } from "../../redux/hooks";
import type { RootState } from "../../redux/store";
import type { Order, AddOrderPayload, PaymentMethod, OrderStatus } from "../../types";
import { usePendingOrders } from "../../context/PendingOrdersContext";

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

  const { submit: submitPending } = usePendingOrders();
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [showInvoice, setShowInvoice] = useState(false);
  const [orderInfo, setOrderInfo] = useState<Order | undefined>();

  // UPI QR modal state
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [isUpiConfirming, setIsUpiConfirming] = useState(false);
  // Pending payment details held while QR modal is open
  const pendingUpi = useRef<{ paidAmount: number; isFullyPaid: boolean; targetOrderId: string | null } | null>(null);

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

  type OrderMutationData = AddOrderPayload & { id?: string };

  const handlePlaceOrder = () => {
    if (orderId) {
      // Updating an existing order — keep blocking so admin sees confirmation
      orderMutation.mutate({ id: orderId, ...buildOrderData() } as unknown as OrderMutationData);
      return;
    }
    // New order — optimistic: clear UI immediately, submit in background
    const payload = buildOrderData();
    const tableNo = customerData.table?.tableNo;
    dispatch(removeCustomer());
    dispatch(removeAllItems());
    navigate("/", { replace: true });
    submitPending(payload as AddOrderPayload, tableNo, Math.round(finalTotal));
  };

  const orderMutation = useMutation({
    mutationFn: (reqData: OrderMutationData) => (reqData.id ? updateOrder(reqData as unknown as { id: string; [key: string]: unknown }) : addOrder(reqData)),
    onSuccess: (resData) => {
      const { data } = (resData as { data: { data: Order } }).data;
      setOrderInfo(data);
      dispatch(removeCustomer());
      dispatch(removeAllItems());
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardEarnings"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      enqueueSnackbar("Order Processed!", { variant: "success" });
      setIsPayModalOpen(false);
      navigate("/", { replace: true });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(error.response?.data?.message || "Failed to place order.", { variant: "error" });
    },
  });

  const isAnyPaymentPending = orderMutation.isPending || isPaymentProcessing;

  const completeOrder = async (targetId: string, paidAmount: number, payMethod: PaymentMethod, isFullyPaid: boolean) => {
    const amountAlreadyPaid = existingOrder?.amountPaid ?? orderInfo?.amountPaid ?? 0;
    return updateOrder({
      id: targetId,
      amountPaid: orderId ? amountAlreadyPaid + paidAmount : paidAmount,
      paymentMethod: payMethod,
      paymentStatus: isFullyPaid ? "Paid" : "Pending",
      orderStatus: "Completed",
    }).then((resData) => {
      const { data } = (resData as { data: { data: Order } }).data;
      setOrderInfo(data);
      dispatch(removeCustomer());
      dispatch(removeAllItems());
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardEarnings"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      enqueueSnackbar("Order Processed!", { variant: "success" });
      setIsPayModalOpen(false);
      navigate("/", { replace: true });
    });
  };

  const handlePaymentSubmit = async (paidAmount: number, payMethod: PaymentMethod, isFullyPaid: boolean) => {
    if (payMethod === "Online") {
      setIsPayModalOpen(false);

      // For a new order, create it first so it exists before the QR is shown
      let targetOrderId: string | null = orderId;
      if (!targetOrderId) {
        try {
          const orderResp = await addOrder({ ...buildOrderData(), paymentStatus: "Pending" });
          targetOrderId = (orderResp.data as { data: { _id: string } }).data._id;
        } catch {
          enqueueSnackbar("Failed to create order. Please try again.", { variant: "error" });
          return;
        }
      }

      pendingUpi.current = { paidAmount, isFullyPaid, targetOrderId };
      setIsUpiModalOpen(true);
      return;
    }

    if (orderId) {
      // Existing order: never rebake bills — only send payment fields
      setIsPaymentProcessing(true);
      completeOrder(orderId, paidAmount, payMethod, isFullyPaid)
        .catch((error: { response?: { data?: { message?: string } } }) => {
          enqueueSnackbar(error.response?.data?.message || "Failed to process payment.", { variant: "error" });
        })
        .finally(() => setIsPaymentProcessing(false));
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

  const handleUpiConfirm = async () => {
    if (!pendingUpi.current) return;
    const { paidAmount, isFullyPaid, targetOrderId } = pendingUpi.current;
    if (!targetOrderId) return;

    setIsUpiConfirming(true);
    try {
      await completeOrder(targetOrderId, paidAmount, "Online", isFullyPaid);
      setIsUpiModalOpen(false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      enqueueSnackbar(err.response?.data?.message || "Failed to record payment.", { variant: "error" });
    } finally {
      setIsUpiConfirming(false);
      pendingUpi.current = null;
    }
  };

  const handleUpiClose = () => {
    if (isUpiConfirming) return;
    // If we created a new order just for the QR, cancel it
    if (!orderId && pendingUpi.current?.targetOrderId) {
      updateOrder({ id: pendingUpi.current.targetOrderId, orderStatus: "Cancelled" }).catch(() => {});
    }
    pendingUpi.current = null;
    setIsUpiModalOpen(false);
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

  const upiOrderRef = orderId
    ? orderId.slice(-6)
    : pendingUpi.current?.targetOrderId?.slice(-6) ?? "NEW";

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
          disabled={!!orderId && orderMutation.isPending}
          className="w-full btn-accent rounded-xl py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {orderId && orderMutation.isPending
            ? <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : null}
          {orderId ? "Update Order" : "Place Order"}
        </button>
        <button
          disabled={isAnyPaymentPending}
          className="w-full py-2.5 rounded-xl bg-dhaba-success/10 text-dhaba-success font-bold text-sm border border-dhaba-success/20 hover:bg-dhaba-success/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => setIsPayModalOpen(true)}
        >
          Pay & Complete
        </button>
      </div>

      {showInvoice && orderInfo && <Invoice orderInfo={orderInfo} setShowInvoice={setShowInvoice} />}

      <PayModal
        isOpen={isPayModalOpen}
        onClose={() => { if (!isAnyPaymentPending) setIsPayModalOpen(false); }}
        order={{ _id: orderId ?? "", ...currentOrderData } as Partial<Order> & { _id: string }}
        customerData={customerData}
        isPending={isAnyPaymentPending}
        onSubmitPayment={handlePaymentSubmit}
      />

      <UpiQrModal
        isOpen={isUpiModalOpen}
        onClose={handleUpiClose}
        onConfirm={handleUpiConfirm}
        amount={finalTotal}
        orderRef={upiOrderRef}
        isConfirming={isUpiConfirming}
      />
    </div>
  );
};

export default Bill;
