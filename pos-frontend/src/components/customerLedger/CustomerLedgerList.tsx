import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllCustomerLedgers, recordCustomerPayment, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry } from "../../https";
import { enqueueSnackbar } from "notistack";
import { motion, AnimatePresence } from "framer-motion";
import PaymentModal from "./PaymentModal";
import SettleOrdersModal from "./SettleOrdersModal";
import BottomNav from "../shared/BottomNav";
import { FaSearch, FaChevronDown, FaChevronUp, FaWallet, FaUsers, FaCalendarAlt, FaSortAmountDown, FaPlus, FaEdit, FaTrash, FaTimes } from "react-icons/fa";
import type { CustomerLedger, LedgerTransaction } from "../../types";

function getAvatarInitials(name: string) {
  return name.trim().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Compute a running balance column for transactions (newest-first array from API)
function withRunningBalance(txs: LedgerTransaction[]): (LedgerTransaction & { runningBalance: number })[] {
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

type PresetKey = "today" | "week" | "month" | "year" | "custom" | "all";

interface DateRange {
  startDate?: string;
  endDate?: string;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getPresetRange(preset: PresetKey): DateRange {
  const now = new Date();
  const todayStr = toDateStr(now);
  if (preset === "today") {
    return { startDate: `${todayStr}T00:00:00`, endDate: `${todayStr}T23:59:59` };
  }
  if (preset === "week") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { startDate: `${toDateStr(from)}T00:00:00`, endDate: `${todayStr}T23:59:59` };
  }
  if (preset === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: `${toDateStr(from)}T00:00:00`, endDate: `${todayStr}T23:59:59` };
  }
  if (preset === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    return { startDate: `${toDateStr(from)}T00:00:00`, endDate: `${todayStr}T23:59:59` };
  }
  return {};
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "custom", label: "Custom" },
  { key: "all", label: "All" },
];

const CustomerLedgerList: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [preset, setPreset] = useState<PresetKey>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [sortByDue, setSortByDue] = useState(true);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [customerToPay, setCustomerToPay] = useState<CustomerLedger | null>(null);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [customerToSettle, setCustomerToSettle] = useState<CustomerLedger | null>(null);

  // Create / Edit modal
  const [crudModalOpen, setCrudModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerLedger | null>(null); // null = create mode
  const [crudName, setCrudName] = useState("");
  const [crudPhone, setCrudPhone] = useState("");
  const [crudBalance, setCrudBalance] = useState("");
  const [crudNotes, setCrudNotes] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<CustomerLedger | null>(null);

  const dateRange = useMemo<DateRange>(() => {
    if (preset === "custom") {
      return {
        startDate: customStart ? `${customStart}T00:00:00` : undefined,
        endDate: customEnd ? `${customEnd}T23:59:59` : undefined,
      };
    }
    return getPresetRange(preset);
  }, [preset, customStart, customEnd]);

  const queryFilters = useMemo(() => ({
    ...dateRange,
  }), [dateRange]);

  const { data: customersRes, isLoading, isError, error } = useQuery({
    queryKey: ["customerLedgers", queryFilters],
    queryFn: () => getAllCustomerLedgers(queryFilters as Record<string, unknown>),
  });

  const allCustomers: CustomerLedger[] = customersRes?.data?.data ?? [];

  const filteredCustomers = useMemo<CustomerLedger[]>(() => {
    if (!allCustomers.length) return [];
    const q = searchTerm.toLowerCase();
    const filtered = searchTerm
      ? allCustomers.filter(
          (c) => c.customerName.toLowerCase().includes(q) || c.customerPhone.includes(q)
        )
      : allCustomers;
    if (sortByDue) return [...filtered].sort((a, b) => (b.balanceDue ?? 0) - (a.balanceDue ?? 0));
    return filtered;
  }, [allCustomers, searchTerm, sortByDue]);

  const totalOutstanding = useMemo(
    () => allCustomers.reduce((sum, c) => sum + (c.balanceDue ?? 0), 0),
    [allCustomers]
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customerLedgers"] });

  const openCreate = () => {
    setEditTarget(null);
    setCrudName(""); setCrudPhone(""); setCrudBalance(""); setCrudNotes("");
    setCrudModalOpen(true);
  };
  const openEdit = (c: CustomerLedger) => {
    setEditTarget(c);
    setCrudName(c.customerName); setCrudPhone(c.customerPhone); setCrudBalance(""); setCrudNotes("");
    setCrudModalOpen(true);
  };
  const closeCrud = () => { setCrudModalOpen(false); setEditTarget(null); };

  const crudMutation = useMutation({
    mutationFn: () => {
      if (editTarget) {
        return updateLedgerEntry(editTarget.customerPhone, {
          customerName: crudName || undefined,
          customerPhone: crudPhone !== editTarget.customerPhone ? crudPhone : undefined,
        });
      }
      return createLedgerEntry({
        customerName: crudName,
        customerPhone: crudPhone,
        initialBalance: crudBalance ? Number(crudBalance) : 0,
        notes: crudNotes || undefined,
      });
    },
    onSuccess: () => {
      enqueueSnackbar(editTarget ? "Customer updated." : "Ledger entry created.", { variant: "success" });
      invalidate();
      closeCrud();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(err.response?.data?.message || "Operation failed.", { variant: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (phone: string) => deleteLedgerEntry(phone),
    onSuccess: () => {
      enqueueSnackbar("Ledger entry deleted.", { variant: "success" });
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(err.response?.data?.message || "Delete failed.", { variant: "error" });
    },
  });

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

  const presetLabel = PRESETS.find((p) => p.key === preset)?.label ?? "";

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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-dhaba-text">Customer Ledger</h1>
          <p className="text-sm text-dhaba-muted mt-0.5">
            {preset === "all"
              ? "All time"
              : preset === "custom"
              ? customStart || customEnd
                ? `${customStart || "…"} → ${customEnd || "…"}`
                : "Pick date range below"
              : `${presetLabel} view`}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-warm text-dhaba-bg text-sm font-bold hover:shadow-glow transition-all"
        >
          <FaPlus size={11} /> New Entry
        </button>
      </div>

      {/* Date preset filter */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPreset(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                preset === key
                  ? "bg-gradient-warm text-dhaba-bg shadow-glow"
                  : "glass-card text-dhaba-muted border border-dhaba-border/20 hover:text-dhaba-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom date pickers */}
        {preset === "custom" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 items-center"
          >
            <FaCalendarAlt className="text-dhaba-muted text-sm shrink-0" />
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="glass-input rounded-xl px-3 py-2 text-sm text-dhaba-text outline-none flex-1 bg-transparent"
            />
            <span className="text-dhaba-muted text-xs">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="glass-input rounded-xl px-3 py-2 text-sm text-dhaba-text outline-none flex-1 bg-transparent"
            />
          </motion.div>
        )}
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
            <p className="text-xs text-dhaba-muted font-bold uppercase tracking-wider">Customers</p>
            <p className="font-display text-xl font-bold text-dhaba-text">{allCustomers.length}</p>
          </div>
        </div>
      </div>

      {/* Search + sort */}
      <div className="flex gap-2">
        <div className="glass-input rounded-xl flex items-center gap-3 px-4 py-2.5 flex-1">
          <FaSearch className="text-dhaba-muted text-sm shrink-0" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-dhaba-text text-sm outline-none flex-1 placeholder:text-dhaba-muted/50"
          />
        </div>
        <button
          onClick={() => setSortByDue((v) => !v)}
          title={sortByDue ? "Sorted: Most Due First" : "Sorted: Recent First"}
          className={`glass-card rounded-xl px-3 flex items-center gap-1.5 text-xs font-bold border transition-all shrink-0 ${
            sortByDue
              ? "text-dhaba-danger border-dhaba-danger/30 bg-dhaba-danger/10"
              : "text-dhaba-muted border-dhaba-border/20 hover:text-dhaba-text"
          }`}
        >
          <FaSortAmountDown size={13} />
          {sortByDue ? "Most Due" : "Recent"}
        </button>
      </div>

      {/* List */}
      {filteredCustomers.length === 0 ? (
        <div className="text-center py-16 text-dhaba-muted">
          <FaWallet className="text-4xl mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No customers found</p>
          <p className="text-sm mt-1">
            {searchTerm
              ? "Try a different search term."
              : preset === "today"
              ? "No activity today."
              : "No activity in this period."}
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

                  {/* Edit / Delete */}
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openEdit(customer)}
                      className="p-2 rounded-lg hover:bg-dhaba-accent/10 text-dhaba-muted hover:text-dhaba-accent transition-colors"
                      title="Edit"
                    >
                      <FaEdit size={12} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(customer)}
                      className="p-2 rounded-lg hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger transition-colors"
                      title="Delete"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>

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
                          <p className="text-sm text-dhaba-muted text-center py-4">No transactions in this period.</p>
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

      {/* ── Create / Edit modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {crudModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="glass-card w-full max-w-sm rounded-3xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-dhaba-border/20">
                <h2 className="font-display text-lg font-bold text-dhaba-text">
                  {editTarget ? "Edit Customer" : "New Ledger Entry"}
                </h2>
                <button onClick={closeCrud} className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors">
                  <FaTimes className="text-dhaba-muted" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5">Customer Name</label>
                  <input
                    value={crudName}
                    onChange={(e) => setCrudName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5">Phone Number</label>
                  <input
                    value={crudPhone}
                    onChange={(e) => setCrudPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="9876543210"
                    type="tel"
                    className="w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50"
                  />
                </div>
                {!editTarget && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5">
                        Initial Balance (₹) <span className="font-normal normal-case">— leave 0 if none</span>
                      </label>
                      <input
                        value={crudBalance}
                        onChange={(e) => setCrudBalance(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="0"
                        type="number"
                        min="0"
                        step="1"
                        className="w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5">Notes (optional)</label>
                      <input
                        value={crudNotes}
                        onChange={(e) => setCrudNotes(e.target.value)}
                        placeholder="e.g. Old credit from before system"
                        className="w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="px-6 py-4 bg-dhaba-surface/30 border-t border-dhaba-border/20 flex gap-3 justify-end">
                <button onClick={closeCrud} className="px-5 py-2.5 rounded-xl text-dhaba-muted font-bold text-sm hover:text-dhaba-text transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => crudMutation.mutate()}
                  disabled={!crudName.trim() || !crudPhone.trim() || crudMutation.isPending}
                  className="bg-gradient-warm text-dhaba-bg px-7 py-2.5 rounded-xl font-bold text-sm hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {crudMutation.isPending ? "Saving…" : editTarget ? "Save Changes" : "Create"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete confirmation ─────────────────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="glass-card w-full max-w-xs rounded-3xl overflow-hidden"
            >
              <div className="px-6 py-6 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-dhaba-danger/15 flex items-center justify-center mx-auto">
                  <FaTrash className="text-dhaba-danger text-lg" />
                </div>
                <h2 className="font-display text-lg font-bold text-dhaba-text">Delete Ledger?</h2>
                <p className="text-sm text-dhaba-muted">
                  This will permanently remove <span className="text-dhaba-text font-semibold">{deleteTarget.customerName}</span>'s
                  ledger and all their transaction history.
                  {deleteTarget.balanceDue > 0 && (
                    <span className="block mt-1 text-dhaba-danger font-semibold">
                      ₹{deleteTarget.balanceDue.toFixed(2)} outstanding balance will be lost.
                    </span>
                  )}
                </p>
              </div>
              <div className="px-6 py-4 bg-dhaba-surface/30 border-t border-dhaba-border/20 flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 rounded-xl text-dhaba-muted font-bold text-sm hover:text-dhaba-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteTarget.customerPhone)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-dhaba-danger/10 text-dhaba-danger border border-dhaba-danger/20 font-bold text-sm hover:bg-dhaba-danger/20 transition-all disabled:opacity-40"
                >
                  {deleteMutation.isPending ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
};

export default CustomerLedgerList;
