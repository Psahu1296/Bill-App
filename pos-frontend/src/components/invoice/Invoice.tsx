import React from "react";
import { motion } from "framer-motion";
import { FaCheck } from "react-icons/fa6";
import type { Order } from "../../types";
import { printBill } from "../../utils/printBill";
import { shareOnWhatsApp } from "../../utils/shareOnWhatsApp";
import { IoLogoWhatsapp } from "react-icons/io";

interface InvoiceProps {
  orderInfo: Order;
  setShowInvoice: (show: boolean) => void;
}

const Invoice: React.FC<InvoiceProps> = ({ orderInfo, setShowInvoice }) => {
  const handlePrint = () => printBill(orderInfo);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-4 rounded-lg shadow-lg w-[400px]">
        <div className="p-4">
          <div className="flex justify-center mb-4">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              transition={{ duration: 0.5, type: "spring", stiffness: 150 }}
              className="w-12 h-12 border-8 border-green-500 rounded-full flex items-center justify-center shadow-lg bg-green-500"
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="text-2xl"
              >
                <FaCheck className="text-white" />
              </motion.span>
            </motion.div>
          </div>

          <h2 className="text-xl font-bold text-center mb-2">Order Receipt</h2>
          <p className="text-gray-600 text-center">Thank you for your order!</p>

          <div className="mt-4 border-t pt-4 text-sm text-gray-700">
            <p>
              <strong>Order ID:</strong> {orderInfo._id}
            </p>
            <p>
              <strong>Name:</strong> {orderInfo.customerDetails.name}
            </p>
            <p>
              <strong>Phone:</strong> {orderInfo.customerDetails.phone}
            </p>
            <p>
              <strong>Guests:</strong> {orderInfo.customerDetails.guests}
            </p>
          </div>

          <div className="mt-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Items Ordered</h3>
            <ul className="text-sm text-gray-700">
              {orderInfo.items.map((item, index) => {
                const savedPerUnit = item.markedPricePerQuantity != null && item.markedPricePerQuantity > item.pricePerQuantity
                  ? item.markedPricePerQuantity - item.pricePerQuantity
                  : 0;
                return (
                  <li key={index} className="flex flex-col text-xs mb-1">
                    <div className="flex justify-between items-center">
                      <span>{item.name} x{item.quantity}</span>
                      <span>₹{item.price.toFixed(2)}</span>
                    </div>
                    {savedPerUnit > 0 && (
                      <span className="text-right text-green-600 text-[10px]">
                        saved ₹{(savedPerUnit * item.quantity).toFixed(0)} <span className="text-gray-400 line-through">(MRP ₹{(item.markedPricePerQuantity! * item.quantity).toFixed(2)})</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-4 border-t pt-4 text-sm">
            <p>
              <strong>Subtotal:</strong> ₹{orderInfo.bills.total.toFixed(2)}
            </p>
            {orderInfo.bills.discount ? (
              <p>
                <strong>Discount:</strong> -₹{orderInfo.bills.discount.toFixed(2)}
              </p>
            ) : null}
            {orderInfo.bills.roundOff ? (
              <p>
                <strong>Round Off:</strong> {orderInfo.bills.roundOff > 0 ? "+" : ""}₹{orderInfo.bills.roundOff.toFixed(2)}
              </p>
            ) : null}
            <p className="text-md font-semibold">
              <strong>Grand Total:</strong> ₹
              {orderInfo.bills.totalWithTax.toFixed(2)}
            </p>
            {(() => {
              const totalSaved = orderInfo.items.reduce((acc, item) => {
                if (item.markedPricePerQuantity != null && item.markedPricePerQuantity > item.pricePerQuantity) {
                  return acc + (item.markedPricePerQuantity - item.pricePerQuantity) * item.quantity;
                }
                return acc;
              }, 0);
              return totalSaved > 0 ? (
                <p className="text-green-600 font-bold text-sm mt-1">
                  You saved ₹{totalSaved.toFixed(0)} today!
                </p>
              ) : null;
            })()}
          </div>

          <div className="mb-2 mt-2 text-xs">
            {orderInfo.paymentMethod === "Cash" ? (
              <p>
                <strong>Payment Method:</strong> {orderInfo.paymentMethod}
              </p>
            ) : (
              <>
                <p>
                  <strong>Payment Method:</strong> {orderInfo.paymentMethod}
                </p>
                <p>
                  <strong>Razorpay Order ID:</strong>{" "}
                  {orderInfo.paymentData?.razorpay_order_id}
                </p>
                <p>
                  <strong>Razorpay Payment ID:</strong>{" "}
                  {orderInfo.paymentData?.razorpay_payment_id}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <button
            onClick={handlePrint}
            className="text-blue-500 hover:underline text-xs px-4 py-2 rounded-lg"
          >
            Print Receipt
          </button>
          <button
            onClick={() => shareOnWhatsApp(orderInfo)}
            className="flex items-center gap-1 text-green-600 hover:underline text-xs px-4 py-2 rounded-lg"
          >
            <IoLogoWhatsapp className="text-base" /> WhatsApp
          </button>
          <button
            onClick={() => setShowInvoice(false)}
            className="text-red-500 hover:underline text-xs px-4 py-2 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Invoice;
