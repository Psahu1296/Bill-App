import React, { useState } from "react";
import { useSelector } from "react-redux";
import { getTotalPrice } from "../../redux/slices/cartSlice";
import {
  addOrder,
  createOrderRazorpay,
  updateOrder,
  verifyPaymentRazorpay,
} from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";
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
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
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
    customerDetails: {
      name: customerData.customerName,
      phone: customerData.customerPhone,
      guests: customerData.guests,
    },
    orderStatus: "In Progress" as OrderStatus,
    bills: {
      total: Math.floor(total),
      tax: tax,
      totalWithTax: Math.floor(totalPriceWithTax),
    },
    items: cartData,
    table: customerData.table?.tableId,
    paymentMethod: paymentMethod,
  });

  const handlePlaceOrder = async () => {
    if (!paymentMethod) {
      enqueueSnackbar("Please select a payment method!", { variant: "warning" });
      return;
    }

    if (paymentMethod === "Online") {
      try {
        const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
        if (!res) {
          enqueueSnackbar("Razorpay SDK failed to load. Are you online?", {
            variant: "warning",
          });
          return;
        }

        const { data } = await createOrderRazorpay({
          amount: totalPriceWithTax,
        });

        const options = {
          key: `${import.meta.env.VITE_RAZORPAY_KEY_ID}`,
          amount: (data as { order: { amount: number; currency: string; id: string } }).order.amount,
          currency: (data as { order: { amount: number; currency: string; id: string } }).order.currency,
          name: "RESTRO",
          description: "Secure Payment for Your Meal",
          order_id: (data as { order: { amount: number; currency: string; id: string } }).order.id,
          handler: async function (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) {
            const verification = await verifyPaymentRazorpay(response);
            enqueueSnackbar(
              (verification.data as { message: string }).message,
              { variant: "success" }
            );
            const orderData = {
              ...buildOrderData(),
              bills: { total, tax, totalWithTax: totalPriceWithTax },
              paymentData: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
              },
            };
            orderMutation.mutate(orderData);
          },
          prefill: {
            name: customerData.customerName,
            email: "",
            contact: customerData.customerPhone,
          },
          theme: { color: "#025cca" },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch {
        enqueueSnackbar("Payment Failed!", { variant: "error" });
      }
    } else {
      const orderData = orderId
        ? { id: orderId, ...buildOrderData() }
        : buildOrderData();
      orderMutation.mutate(orderData);
    }
  };

  type OrderMutationData = AddOrderPayload & { id?: string };

  const orderMutation = useMutation({
    mutationFn: (reqData: OrderMutationData) =>
      (reqData.id ? updateOrder(reqData as unknown as { id: string; [key: string]: unknown }) : addOrder(reqData)),
    onSuccess: (resData) => {
      const { data } = (resData as { data: { data: Order } }).data;
      setOrderInfo(data);
      dispatch(removeCustomer());
      dispatch(removeAllItems());
      enqueueSnackbar("Order Placed!", { variant: "success" });
      navigate("/", { replace: true });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || "Failed to place order.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const orderData = buildOrderData();

  return (
    <>
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">
          Items({cartData.length})
        </p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          ₹{total.toFixed(2)}
        </h1>
      </div>
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">Tax(5.25%)</p>
        <h1 className="text-[#f5f5f5] text-md font-bold">₹{tax.toFixed(2)}</h1>
      </div>
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">Total With Tax</p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          ₹{totalPriceWithTax.toFixed(2)}
        </h1>
      </div>
      <div className="flex items-center gap-3 px-5 mt-4">
        <button
          onClick={() => setPaymentMethod("Cash")}
          className={`bg-[#1f1f1f] px-4 py-3 w-full rounded-lg text-[#ababab] font-semibold ${
            paymentMethod === "Cash" ? "bg-[#383737]" : ""
          }`}
        >
          Cash
        </button>
        <button
          disabled
          onClick={() => setPaymentMethod("Online")}
          className={`bg-[#1f1f1f] px-4 py-3 w-full rounded-lg text-[#ababab] font-semibold ${
            paymentMethod === "Online" ? "bg-[#383737]" : ""
          }`}
        >
          Online
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 px-5 mt-4">
        <button
          onClick={handlePlaceOrder}
          className="bg-[#f6b100] px-4 py-3 w-full rounded-lg text-[#1f1f1f] font-semibold text-lg"
        >
          Place Order
        </button>
        <button
          disabled={!orderId}
          className="px-4 py-3 w-full rounded-lg bg-[#2e4a40] text-[#02ca3a] font-semibold text-lg"
          onClick={() => setIsPayModalOpen(true)}
        >
          Pay
        </button>
      </div>

      {showInvoice && orderInfo && (
        <Invoice orderInfo={orderInfo} setShowInvoice={setShowInvoice} />
      )}
      <PayModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        order={{ _id: orderId ?? "", ...orderData } as Partial<Order> & { _id: string }}
        customerData={customerData}
      />
    </>
  );
};

export default Bill;
