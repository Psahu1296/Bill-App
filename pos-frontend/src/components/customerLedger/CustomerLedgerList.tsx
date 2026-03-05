import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllCustomerLedgers, recordCustomerPayment } from "../../https";
import { enqueueSnackbar } from "notistack";
import { motion, AnimatePresence } from "framer-motion";
import PaymentModal from "./PaymentModal";
import type { CustomerLedger } from "../../types";

const CustomerLedgerList: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [customerToPay, setCustomerToPay] = useState<CustomerLedger | null>(null);

  const {
    data: customers,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["customerLedgers"],
    queryFn: () => getAllCustomerLedgers({ hasBalanceDue: true }),
  });

  const filteredCustomers = useMemo<CustomerLedger[]>(() => {
    const list: CustomerLedger[] = customers?.data?.data ?? [];
    if (!list.length) return [];
    const lowercased = searchTerm.toLowerCase();
    return list.filter(
      (customer) =>
        customer.customerName.toLowerCase().includes(lowercased) ||
        customer.customerPhone.includes(lowercased)
    );
  }, [customers, searchTerm]);

  const recordPaymentMutation = useMutation({
    mutationFn: ({
      phone,
      amountPaid,
      orderId,
      notes,
    }: {
      phone: string;
      amountPaid: number;
      orderId?: string;
      notes?: string;
    }) => recordCustomerPayment(phone, { amountPaid, orderId, notes }),
    onSuccess: (res) => {
      enqueueSnackbar(
        (res as { message?: string })?.message || "Payment recorded!",
        { variant: "success" }
      );
      queryClient.invalidateQueries({ queryKey: ["customerLedgers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardEarningsSummary"] });
      setPaymentModalOpen(false);
      setCustomerToPay(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(
        err.response?.data?.message || "Failed to record payment.",
        { variant: "error" }
      );
    },
  });

  const handleOpenPaymentModal = (customer: CustomerLedger) => {
    setCustomerToPay(customer);
    setPaymentModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="text-center p-8 text-gray-300">
        Loading customer ledger...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center p-8 text-red-400">
        Error loading customer ledger: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#262626] min-h-screen text-[#f5f5f5]">
      <h1 className="text-3xl font-bold mb-6">Customer Ledger</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 rounded-lg bg-[#1f1f1f] border border-[#333] text-[#f5f5f5] focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <p className="text-center text-gray-400">
          No customers found with outstanding balance.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((customer) => (
            <div
              key={customer._id}
              className="bg-[#1f1f1f] rounded-lg shadow-md overflow-hidden"
            >
              <div
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-[#2a2a2a] transition-colors"
                onClick={() =>
                  setExpandedCustomerId(
                    expandedCustomerId === customer._id ? null : customer._id
                  )
                }
              >
                <div className="flex flex-col">
                  <span className="text-lg font-semibold">
                    {customer.customerName}
                  </span>
                  <span className="text-sm text-gray-400">
                    {customer.customerPhone}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-xl font-bold text-yellow-400">
                    ₹{customer.balanceDue ? customer.balanceDue.toFixed(2) : "0.00"} Due
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenPaymentModal(customer);
                    }}
                    className="bg-yellow-400 text-gray-900 px-3 py-1 rounded-md text-sm font-medium hover:bg-yellow-500"
                  >
                    Pay
                  </button>
                  <span className="text-gray-400">
                    {expandedCustomerId === customer._id ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              <AnimatePresence>
                {expandedCustomerId === customer._id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="p-4 border-t border-[#333]"
                  >
                    <h3 className="text-md font-semibold mb-3 text-gray-300">
                      Transaction History
                    </h3>
                    {customer.transactions?.length > 0 ? (
                      <ul className="space-y-2 text-sm">
                        {customer.transactions.map((tx, idx) => (
                          <li
                            key={idx}
                            className="bg-[#1a1a1a] p-3 rounded-md flex justify-between items-center"
                          >
                            <div>
                              <p className="font-medium">
                                {tx.transactionType.replace(/_/g, " ")}:{" "}
                                <span
                                  className={
                                    tx.transactionType.includes("decreased") ||
                                    tx.transactionType.includes("received")
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }
                                >
                                  ₹{tx.amount.toFixed(2)}
                                </span>
                              </p>
                              {tx.orderId && (
                                <p className="text-gray-400">
                                  Order ID: #{tx.orderId.slice(-6)}
                                </p>
                              )}
                              {tx.notes && (
                                <p className="text-gray-400">
                                  Notes: {tx.notes}
                                </p>
                              )}
                            </div>
                            <span className="text-gray-500 text-xs">
                              {new Date(tx.timestamp).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500">
                        No transactions recorded yet.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        customer={customerToPay}
        recordPaymentMutation={recordPaymentMutation}
      />
    </div>
  );
};

export default CustomerLedgerList;
