import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCustomerLedger, recordCustomerPayment, searchCustomerProfiles, updateLedgerEntry } from "../../https";
import { axiosWrapper } from "../../https/axiosWrapper";
import { enqueueSnackbar } from "notistack";
import { AnimatePresence, motion } from "framer-motion";
import { FaArrowLeft, FaPhone, FaMoneyBillWave, FaShoppingBag, FaWallet, FaArrowUp, FaArrowDown, FaPen } from "react-icons/fa";
import { MdAccountBalanceWallet, MdReceipt } from "react-icons/md";
import { FaTimes } from "react-icons/fa";
import BottomNav from "../shared/BottomNav";
import UserAvatar from "../shared/UserAvatar";
import LedgerBadge from "../shared/LedgerBadge";
import type { Order } from "../../types";

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(date: string) {
  return new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Other"];

const CustomerDetail: React.FC = () => {
  const { phone = "" } = useParams<{ phone: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"orders" | "ledger">("orders");
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payNotes, setPayNotes] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Load profile from cached search results first, then fetch ledger
  const { data: profilesRes } = useQuery({
    queryKey: ["customerProfiles", ""],
    enabled: false, // only read from cache, don't refetch
  });
  const cachedCustomers = (profilesRes as { data?: { data?: unknown[] } } | undefined)?.data?.data ?? [];
  const cachedProfile = (cachedCustomers as { phone: string; name: string; isLedgerOnly?: boolean; totalOrders?: number }[])
    .find((c) => c.phone === phone);

  // Fallback: fetch the profile directly if not in cache
  const { data: profileSearchRes } = useQuery({
    queryKey: ["customerProfileByPhone", phone],
    queryFn: () => searchCustomerProfiles({ phone }),
    enabled: !cachedProfile && !!phone,
  });
  const profile = cachedProfile ?? (profileSearchRes?.data?.data as { phone: string; name: string; isLedgerOnly?: boolean; totalOrders?: number }[] | undefined)?.[0];

  const isLedgerOnly = profile?.isLedgerOnly ?? false;

  const { data: ordersRes, isLoading: ordersLoading } = useQuery({
    queryKey: ["customerOrders", phone],
    queryFn: () => axiosWrapper.get(`/api/customer/orders/${phone}`),
    enabled: !!phone,
  });

  const { data: ledgerRes, isLoading: ledgerLoading } = useQuery({
    queryKey: ["customerLedger", phone],
    queryFn: () => getCustomerLedger(phone),
    enabled: !!phone,
  });

  const orders: Order[] = ordersRes?.data?.data ?? [];
  const ledger = ledgerRes?.data?.data ?? null;
  const balanceDue: number = ledger?.balanceDue ?? 0;

  const payMutation = useMutation({
    mutationFn: () =>
      recordCustomerPayment(phone, {
        amountPaid: Number(payAmount),
        notes: payNotes ? `${payNotes} (${payMethod})` : payMethod,
      }),
    onSuccess: () => {
      enqueueSnackbar("Payment recorded!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["customerLedger", phone] });
      queryClient.invalidateQueries({ queryKey: ["customerProfiles"] });
      queryClient.invalidateQueries({ queryKey: ["customerLedgers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardEarningsSummary"] });
      setPayOpen(false);
      setPayAmount("");
      setPayNotes("");
      setPayMethod("Cash");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(err.response?.data?.message ?? "Payment failed.", { variant: "error" });
    },
  });

  const editMutation = useMutation({
    mutationFn: () =>
      updateLedgerEntry(phone, {
        customerName: editName.trim() || undefined,
        customerPhone: editPhone.trim() || undefined,
      }),
    onSuccess: () => {
      enqueueSnackbar("Customer updated!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["customerProfiles"] });
      queryClient.invalidateQueries({ queryKey: ["customerProfileByPhone", phone] });
      setEditOpen(false);
      if (editPhone.trim() && editPhone.trim() !== phone) {
        navigate(`/customers/${editPhone.trim()}`, { replace: true });
      }
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(err.response?.data?.message ?? "Update failed.", { variant: "error" });
    },
  });

  const remaining = Math.max(0, balanceDue - (Number(payAmount) || 0));
  const displayName = profile?.name ?? phone;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-dhaba-bg relative overflow-y-auto">
      {/* Ambient Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] z-0 pointer-events-none" />
      <div className="fixed top-[20%] right-[-10%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[100px] z-0 pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 glass-card border-b border-dhaba-border/20 px-4 py-4 flex items-center gap-4 shadow-sm backdrop-blur-xl bg-[#0c111d]/80">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 shadow-inner"
          >
            <FaArrowLeft className="text-white/70" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <UserAvatar name={displayName} className="relative h-11 w-11 text-lg" />
            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 truncate tracking-wide">{displayName}</h1>
                {isLedgerOnly && <LedgerBadge />}
              </div>
              <p className="text-xs text-white/50 flex items-center gap-1 mt-0.5">
                <FaPhone className="text-[10px]" /> {phone}
                {!isLedgerOnly && (profile?.totalOrders ?? 0) > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[9px] font-bold border border-blue-500/20">
                    {profile!.totalOrders} ORDERS
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setEditName(profile?.name ?? ""); setEditPhone(phone); setEditOpen(true); }}
            className="p-2.5 bg-white/5 hover:bg-blue-500/20 hover:text-blue-400 rounded-xl transition-all border border-white/5 shadow-inner"
            title="Edit customer"
          >
            <FaPen className="text-white/70 text-sm" />
          </button>
        </div>

        {/* Balance strip */}
        {balanceDue > 0 && (
          <div className="relative overflow-hidden flex items-center justify-between px-6 py-4 border-b border-red-500/20 bg-red-500/5">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent pointer-events-none" />
            <div className="relative flex items-center gap-3 z-10">
              <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                <MdAccountBalanceWallet className="text-red-400 text-lg" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-red-400/70 uppercase tracking-widest">Outstanding Due</span>
                <span className="text-base font-black text-red-400 tracking-tight">₹{balanceDue.toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={() => { setPayAmount(balanceDue.toFixed(2)); setPayOpen(true); }}
              className="relative z-10 text-xs font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95 transition-all shadow-md"
            >
              Settle
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex px-4 pt-4 border-b border-dhaba-border/20 sticky top-[73px] z-10 bg-[#0c111d]/90 backdrop-blur-md">
          {(["orders", "ledger"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 pb-3 text-sm font-black transition-all capitalize tracking-wide ${
                tab === t
                  ? "text-blue-400 border-b-2 border-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]"
                  : "text-white/40 hover:text-white/70 border-b-2 border-transparent"
              }`}
            >
              {t === "orders" ? `Orders${orders.length > 0 ? ` (${orders.length})` : ""}` : "Ledger"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 px-4 py-6 space-y-4">
          {tab === "orders" && (
            ordersLoading ? (
              <div className="py-12 text-center text-white/40 text-sm animate-pulse font-bold tracking-widest uppercase">Loading orders…</div>
            ) : orders.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10 shadow-inner">
                  <FaShoppingBag className="text-3xl text-white/20" />
                </div>
                <p className="text-white/80 font-black tracking-wide">No orders yet</p>
                <p className="text-xs text-white/40 mt-1">Orders placed via the customer app appear here.</p>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order._id} className="glass-card rounded-[1.25rem] p-5 space-y-3 border border-dhaba-border/20 hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                        <MdReceipt className="text-blue-400 text-sm" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black tracking-widest text-white/50 uppercase">Order #{order._id.slice(-6)}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${
                            order.orderStatus === "Completed"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : order.orderStatus === "Cancelled"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          }`}>
                            {order.orderStatus}
                          </span>
                          {order.orderType && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-white/60 border border-white/10 capitalize">
                              {order.orderType}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider bg-white/5 px-2 py-1 rounded-md border border-white/5">{fmt(order.orderDate)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3 pt-2 border-t border-white/5">
                    <p className="text-[11px] text-white/60 leading-relaxed font-medium">
                      {order.items.map(i => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ")}
                    </p>
                    <p className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 flex-shrink-0">
                      ₹{order.bills.totalWithTax.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-[10px] text-white/30 font-semibold">{fmtTime(order.orderDate)}</p>
                </div>
              ))
            )
          )}

          {tab === "ledger" && (
            ledgerLoading ? (
              <div className="py-12 text-center text-white/40 text-sm animate-pulse font-bold tracking-widest uppercase">Loading ledger…</div>
            ) : !ledger || ledger.transactions?.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10 shadow-inner">
                  <MdAccountBalanceWallet className="text-3xl text-white/20" />
                </div>
                <p className="text-white/80 font-black tracking-wide">No transactions</p>
                <p className="text-xs text-white/40 mt-1">Ledger entries appear when a balance is recorded.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card rounded-[1.25rem] p-5 text-center border border-dhaba-border/20 shadow-sm relative overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-br opacity-10 pointer-events-none ${balanceDue > 0 ? "from-red-500" : "from-emerald-500"}`} />
                    <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">Balance Due</p>
                    <p className={`font-display text-2xl font-black mt-1 tracking-tight ${balanceDue > 0 ? "text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.3)]" : "text-emerald-400"}`}>
                      ₹{balanceDue.toFixed(2)}
                    </p>
                  </div>
                  <div className="glass-card rounded-[1.25rem] p-5 text-center border border-dhaba-border/20 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 opacity-50 pointer-events-none" />
                    <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">Transactions</p>
                    <p className="font-display text-2xl font-black text-white/90 mt-1 tracking-tight">{ledger.transactions?.length ?? 0}</p>
                  </div>
                </div>

                {balanceDue > 0 && (
                  <button
                    onClick={() => { setPayAmount(balanceDue.toFixed(2)); setPayOpen(true); }}
                    className="w-full py-4 rounded-[1.25rem] bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-sm hover:shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all flex items-center justify-center gap-2 active:scale-[0.98] border border-orange-400/30"
                  >
                    <FaMoneyBillWave /> Record Payment
                  </button>
                )}

                <div className="space-y-3 mt-4">
                  {[...(ledger.transactions ?? [])].reverse().map((tx: { transactionType: string; amount: number; notes?: string; timestamp: string; orderId?: string }, idx: number) => {
                    const isCredit = tx.transactionType === "payment_received" || tx.transactionType === "balance_decreased";
                    return (
                      <div key={idx} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3 border border-dhaba-border/10 hover:border-white/20 transition-colors">
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border shadow-inner ${isCredit ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                            {isCredit ? <FaArrowDown className="text-[10px]" /> : <FaArrowUp className="text-[10px]" />}
                          </div>
                          <div className="flex flex-col">
                            <p className="text-xs font-black text-white/80 capitalize tracking-wide">
                              {tx.transactionType.replace(/_/g, " ")}
                            </p>
                            {tx.notes && <p className="text-[10px] text-white/50 mt-0.5 truncate max-w-[180px]">{tx.notes}</p>}
                            <p className="text-[9px] text-white/40 mt-0.5 font-bold uppercase tracking-wider">{fmt(tx.timestamp)}</p>
                          </div>
                        </div>
                        <span className={`text-sm font-black flex-shrink-0 tracking-tight ${
                          isCredit ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {isCredit ? "-" : "+"}₹{tx.amount.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          )}
        </div>
      </div>

      {/* Payment modal */}
      <AnimatePresence>
        {payOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0c111d]/90 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm rounded-[2rem] overflow-hidden"
            >
              {/* Modal Glow Border */}
              <div className="absolute inset-[-50%] animate-spin z-0 pointer-events-none" style={{ animationDuration: '6s', background: 'conic-gradient(from 180deg at 50% 50%, #f97316 0deg, #ef4444 180deg, transparent 360deg)' }} />
              <div className="absolute inset-[1px] bg-[#111827] rounded-[1.95rem] z-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                  <div>
                    <h2 className="font-display text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">Record Payment</h2>
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">{displayName}</p>
                  </div>
                  <button onClick={() => setPayOpen(false)} className="p-2.5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all border border-white/5">
                    <FaTimes className="text-white/70" />
                  </button>
                </div>

                <div className="grid grid-cols-2 divide-x divide-white/5 border-b border-white/5 bg-white/[0.02]">
                  <div className="px-5 py-4 text-center">
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Outstanding</p>
                    <p className="font-display text-xl font-black text-red-400 mt-1 tracking-tight">₹{balanceDue.toFixed(2)}</p>
                  </div>
                  <div className="px-5 py-4 text-center">
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Remaining</p>
                    <p className={`font-display text-xl font-black mt-1 tracking-tight ${remaining === 0 ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]" : "text-orange-400"}`}>
                      ₹{remaining.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="px-6 py-6 space-y-5 bg-[#111827]">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-black text-white/60 uppercase tracking-[0.15em]">Amount Paid *</label>
                      <button type="button" onClick={() => setPayAmount(balanceDue.toFixed(2))} className="text-[10px] font-black text-orange-400 hover:text-orange-300 transition-colors uppercase tracking-wider px-2 py-1 rounded bg-orange-500/10 border border-orange-500/20">
                        Pay Full
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-black">₹</span>
                      <input
                        type="number"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full bg-[#1e293b] rounded-xl pl-8 pr-4 py-3.5 text-white font-black text-sm focus:outline-none focus:ring-2 ring-orange-500/50 border border-white/5 placeholder:text-white/20 transition-all shadow-inner"
                        step="0.01" min="0.01" max={balanceDue}
                        placeholder={balanceDue.toFixed(2)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-white/60 uppercase tracking-[0.15em] mb-2.5">Payment Method</label>
                    <div className="flex gap-2 flex-wrap">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m} type="button" onClick={() => setPayMethod(m)}
                          className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                            payMethod === m
                              ? "bg-gradient-to-br from-orange-500/20 to-red-500/20 text-orange-400 border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.15)]"
                              : "bg-[#1e293b] text-white/50 border-white/5 hover:bg-white/10 hover:text-white/80"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-white/60 uppercase tracking-[0.15em] mb-2">
                      Notes <span className="normal-case font-medium text-white/30 tracking-normal">(optional)</span>
                    </label>
                    <input
                      value={payNotes} onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="Any remarks…"
                      className="w-full bg-[#1e293b] rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none focus:ring-2 ring-orange-500/50 border border-white/5 placeholder:text-white/20 transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="px-6 py-5 bg-[#0f172a] border-t border-white/5 flex gap-3 justify-end">
                  <button onClick={() => setPayOpen(false)} className="px-6 py-3 rounded-xl text-white/50 font-black text-[11px] uppercase tracking-wider hover:text-white hover:bg-white/5 transition-all">
                    Cancel
                  </button>
                  <button
                    onClick={() => payMutation.mutate()}
                    disabled={!payAmount || Number(payAmount) <= 0 || payMutation.isPending}
                    className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-8 py-3 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center gap-2 hover:shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-orange-400/30 active:scale-95"
                  >
                    {payMutation.isPending && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {payMutation.isPending ? "Recording…" : "Confirm"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit customer modal */}
      <AnimatePresence>
        {editOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0c111d]/90 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm rounded-[2rem] overflow-hidden"
            >
              <div className="absolute inset-[-50%] animate-spin z-0 pointer-events-none" style={{ animationDuration: '6s', background: 'conic-gradient(from 180deg at 50% 50%, #3b82f6 0deg, #8b5cf6 180deg, transparent 360deg)' }} />
              <div className="absolute inset-[1px] bg-[#111827] rounded-[1.95rem] z-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                  <div>
                    <h2 className="font-display text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">Edit Customer</h2>
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">Update name or phone number</p>
                  </div>
                  <button onClick={() => setEditOpen(false)} className="p-2.5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all border border-white/5">
                    <FaTimes className="text-white/70" />
                  </button>
                </div>

                <div className="px-6 py-6 space-y-5 bg-[#111827]">
                  <div>
                    <label className="block text-[10px] font-black text-white/60 uppercase tracking-[0.15em] mb-2">Name</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Customer name"
                      className="w-full bg-[#1e293b] rounded-xl px-4 py-3.5 text-white font-medium text-sm focus:outline-none focus:ring-2 ring-blue-500/50 border border-white/5 placeholder:text-white/20 transition-all shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-white/60 uppercase tracking-[0.15em] mb-2">Phone Number</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-black text-sm"><FaPhone /></span>
                      <input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="Phone number"
                        className="w-full bg-[#1e293b] rounded-xl pl-9 pr-4 py-3.5 text-white font-medium text-sm focus:outline-none focus:ring-2 ring-blue-500/50 border border-white/5 placeholder:text-white/20 transition-all shadow-inner"
                      />
                    </div>
                    {editPhone.trim() !== phone && editPhone.trim() && (
                      <p className="text-[10px] text-amber-400/80 mt-1.5 font-semibold">Phone change will redirect to updated profile</p>
                    )}
                  </div>
                </div>

                <div className="px-6 py-5 bg-[#0f172a] border-t border-white/5 flex gap-3 justify-end">
                  <button onClick={() => setEditOpen(false)} className="px-6 py-3 rounded-xl text-white/50 font-black text-[11px] uppercase tracking-wider hover:text-white hover:bg-white/5 transition-all">
                    Cancel
                  </button>
                  <button
                    onClick={() => editMutation.mutate()}
                    disabled={(!editName.trim() && editPhone.trim() === phone) || editMutation.isPending}
                    className="bg-gradient-to-r from-blue-500 to-violet-600 text-white px-8 py-3 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center gap-2 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400/30 active:scale-95"
                  >
                    {editMutation.isPending && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {editMutation.isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="relative z-20">
        <BottomNav />
      </div>
    </div>
  );
};

export default CustomerDetail;
