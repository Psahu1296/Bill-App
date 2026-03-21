import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllCustomerLedgers, recordCustomerPayment } from "../../https";
import { enqueueSnackbar } from "notistack";
import { motion, AnimatePresence } from "framer-motion";
import PaymentModal from "./PaymentModal";
import SettleOrdersModal from "./SettleOrdersModal";
import BottomNav from "../shared/BottomNav";
import { FaSearch, FaChevronDown, FaChevronUp, FaWallet, FaUsers } from "react-icons/fa";
import type { CustomerLedger, LedgerTransaction } from "../../types";

function getAvatarInitials(name: string) {
  return name.trim().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Compute a running balance column for transactions (newest-first array from API)
function withRunningBalance(txs: LedgerTransaction[]): (LedgerTransaction & { runningBalance: number })[] {
  // Work oldest→newest to build running balance, then reverse back for display
  const oldest = [...txs].reverse();
  let bal = 0;
  const withBal = oldest.map((tx) => {
    const isCredit =
      tx.transactionType === "balance_decreased" ||
      tx.transactionType === "payment_received";
    bal = isCredit ? bal - tx.amount : bal + tx.amount;
    return { ...tx, runningBalance: Math.max(0, bal) };
  });
  return withBal.reverse();
}

function formatTxType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const CustomerLedgerList: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [customerToPay, setCustomerToPay] = useState<CustomerLedger | null>(null);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [customerToSettle, setCustomerToSettle] = useState<CustomerLedger | null>(null);

  const { data: customersRes, isLoading, isError, error } = useQuery({
    queryKey: ["customerLedgers", showAll],
    queryFn: () => getAllCustomerLedgers(showAll ? {} : { status: "unpaid" }),
  });

  const allCustomers: CustomerLedger[] = customersRes?.data?.data ?? [];

  const filteredCustomers = useMemo<CustomerLedger[]>(() => {
    if (!allCustomers.length) return [];
    if (!searchTerm) return allCustomers;
    const q = searchTerm.toLowerCase();
    return allCustomers.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.includes(q)
    );
  }, [allCustomers, searchTerm]);

  const totalOutstanding = useMemo(
    () => allCustomers.reduce((sum, c) => sum + (c.balanceDue ?? 0), 0),
    [allCustomers]
  );

  const recordPaymentMutation = useMutation({
    mutationFn: ({
      phone,
      amountPaid,
      notes,
      orderId,
    }: {
      phone: string;
      amountPaid: number;
      notes?: string;
      orderId?: string;
    }) => recordCustomerPayment(phone, { amountPaid, notes, orderId }),
    onSuccess: (res) => {
      enqueueSnackbar(
        (res.data as { message?: string })?.message || "Payment recorded!",
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
      <div className="flex items-center justify-center py-20 text-dhaba-muted">
        <div className="h-5 w-5 border-2 border-dhaba-accent border-t-transparent rounded-full animate-spin mr-3" />
        Loading ledger...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center p-8 text-dhaba-danger">
        Error loading ledger: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="px-6 pt-6 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-dhaba-text">Customer Ledger</h1>
          <p className="text-sm text-dhaba-muted mt-0.5">
            {showAll ? "All customers" : "Customers with outstanding balance"}
          </p>
        </div>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="glass-card text-xs font-bold px-4 py-2 rounded-xl text-dhaba-accent border border-dhaba-accent/20 hover:bg-dhaba-accent/10 transition-all"
        >
          {showAll ? "Show Unpaid Only" : "Show All"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-dhaba-danger/15 flex items-center justify-center shrink-0">
            <FaWallet className="text-dhaba-danger" />
          </div>
          <div>
            <p className="text-xs text-dhaba-muted font-bold uppercase tracking-wider">Total Outstanding</p>
            <p className="font-display text-xl font-bold text-dhaba-danger">
              ₹{totalOutstanding.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-dhaba-accent/15 flex items-center justify-center shrink-0">
            <FaUsers className="text-dhaba-accent" />
          </div>
          <div>
            <p className="text-xs text-dhaba-muted font-bold uppercase tracking-wider">
              {showAll ? "Total Customers" : "Unpaid Customers"}
            </p>
            <p className="font-display text-xl font-bold text-dhaba-text">{allCustomers.length}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass-input rounded-xl flex items-center gap-3 px-4 py-2.5">
        <FaSearch className="text-dhaba-muted text-sm shrink-0" />
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent text-dhaba-text text-sm outline-none flex-1 placeholder:text-dhaba-muted/50"
        />
      </div>

      {/* List */}
      {filteredCustomers.length === 0 ? (
        <div className="text-center py-16 text-dhaba-muted">
          <FaWallet className="text-4xl mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No customers found</p>
          <p className="text-sm mt-1">
            {searchTerm ? "Try a different search term." : "No outstanding balances."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((customer) => {
            const isExpanded = expandedCustomerId === customer._id;
            const txsWithBal = withRunningBalance(customer.transactions ?? []);

            return (
              <div key={customer._id} className="glass-card rounded-2xl overflow-hidden">
                {/* Row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-dhaba-surface-hover transition-colors"
                  onClick={() => setExpandedCustomerId(isExpanded ? null : customer._id)}
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-xl bg-gradient-warm flex items-center justify-center text-dhaba-bg font-bold text-sm shrink-0">
                    {getAvatarInitials(customer.customerName)}
                  </div>

                  {/* Name + phone */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-dhaba-text truncate">{customer.customerName}</p>
                    <p className="text-xs text-dhaba-muted">{customer.customerPhone}</p>
                  </div>

                  {/* Balance */}
                  <div className="text-right shrink-0">
                    <p className={`font-display text-lg font-bold ${customer.balanceDue > 0 ? "text-dhaba-danger" : "text-dhaba-success"}`}>
                      ₹{(customer.balanceDue ?? 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-dhaba-muted font-medium">
                      {customer.balanceDue > 0 ? "outstanding" : "settled"}
                    </p>
                  </div>

                  {/* Pay / Settle buttons */}
                  {customer.balanceDue > 0 && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenPaymentModal(customer); }}
                        className="px-4 py-1.5 rounded-xl bg-gradient-warm text-dhaba-bg text-xs font-bold hover:shadow-glow transition-all"
                      >
                        Pay
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCustomerToSettle(customer); setSettleModalOpen(true); }}
                        className="px-3 py-1.5 rounded-xl bg-dhaba-accent/10 text-dhaba-accent border border-dhaba-accent/20 text-xs font-bold hover:bg-dhaba-accent/20 transition-all"
                      >
                        Settle Orders
                      </button>
                    </div>
                  )}

                  {/* Expand chevron */}
                  <span className="text-dhaba-muted shrink-0">
                    {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                  </span>
                </div>

                {/* Expanded transactions */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="border-t border-dhaba-border/20 overflow-hidden"
                    >
                      <div className="p-4 space-y-2">
                        <p className="text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-3">
                          Transaction History
                        </p>

                        {txsWithBal.length === 0 ? (
                          <p className="text-sm text-dhaba-muted text-center py-4">No transactions yet.</p>
                        ) : (
                          <>
                            {/* Table header */}
                            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-1.5 text-[10px] font-bold text-dhaba-muted uppercase tracking-wider">
                              <span>Type</span>
                              <span className="text-right">Amount</span>
                              <span className="text-right">Balance After</span>
                              <span className="text-right">Date</span>
                            </div>

                            <div className="space-y-1">
                              {txsWithBal.map((tx, idx) => {
                                const isCredit =
                                  tx.transactionType === "balance_decreased" ||
                                  tx.transactionType === "payment_received";
                                return (
                                  <div
                                    key={idx}
                                    className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-2.5 rounded-xl bg-dhaba-surface/40 hover:bg-dhaba-surface-hover transition-colors"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-dhaba-text truncate">
                                        {formatTxType(tx.transactionType)}
                                      </p>
                                      {tx.notes && (
                                        <p className="text-[10px] text-dhaba-muted truncate">{tx.notes}</p>
                                      )}
                                      {tx.orderId && (
                                        <p className="text-[10px] text-dhaba-muted">Order #{tx.orderId.slice(-6)}</p>
                                      )}
                                    </div>
                                    <span className={`text-sm font-bold tabular-nums ${isCredit ? "text-dhaba-success" : "text-dhaba-danger"}`}>
                                      {isCredit ? "−" : "+"}₹{tx.amount.toFixed(2)}
                                    </span>
                                    <span className="text-xs font-semibold text-dhaba-text tabular-nums text-right">
                                      ₹{tx.runningBalance.toFixed(2)}
                                    </span>
                                    <span className="text-[10px] text-dhaba-muted text-right whitespace-nowrap">
                                      {new Date(tx.timestamp).toLocaleDateString("en-IN", {
                                        day: "2-digit", month: "short",
                                      })}
                                      <br />
                                      {new Date(tx.timestamp).toLocaleTimeString("en-IN", {
                                        hour: "2-digit", minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => { setPaymentModalOpen(false); setCustomerToPay(null); }}
        customer={customerToPay}
        recordPaymentMutation={recordPaymentMutation}
      />
      <SettleOrdersModal
        isOpen={settleModalOpen}
        onClose={() => { setSettleModalOpen(false); setCustomerToSettle(null); }}
        customer={customerToSettle}
      />
      <BottomNav />
    </div>
  );
};

export default CustomerLedgerList;
