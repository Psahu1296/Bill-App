import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCustomerLedger,
  recordCustomerPayment,
  searchCustomerProfiles,
  updateLedgerEntry,
  getOrders,
} from "../../https";
import {
  exportToPDF,
  exportToExcel,
  shareViaWhatsAppText,
  shareViaNativeShare,
  type ExportPayload,
} from "../../utils/ledgerExport";
import { enqueueSnackbar } from "notistack";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaArrowLeft, FaPhone, FaWallet,
  FaPen, FaMapMarkerAlt, FaShoppingBag, FaChevronDown, FaChevronUp,
  FaWhatsapp, FaFilePdf, FaFileExcel, FaShareAlt,
} from "react-icons/fa";
import { MdAccountBalanceWallet, MdReceipt } from "react-icons/md";
import { FaTimes } from "react-icons/fa";
import BottomNav from "../shared/BottomNav";
import UserAvatar from "../shared/UserAvatar";
import LedgerBadge from "../shared/LedgerBadge";
import type { Order, CustomerProfile, CustomerLedger } from "../../types";

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(date: string) {
  return new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function paymentStatusInfo(order: Order) {
  if (order.paymentStatus === "Paid") return { label: "Paid", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
  if ((order.balanceDueOnOrder ?? 0) > 0 && (order.amountPaid ?? 0) > 0)
    return { label: "Partial", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
  return { label: "Unpaid", cls: "bg-red-500/10 text-red-400 border-red-500/20" };
}

const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Other"];

const CustomerDetail: React.FC = () => {
  const { phone = "" } = useParams<{ phone: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payNotes, setPayNotes] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Try to read profile from list-page cache first
  const { data: profilesRes } = useQuery({ queryKey: ["customerProfiles", ""], enabled: false });
  const cachedCustomers = (profilesRes as { data?: { data?: unknown[] } } | undefined)?.data?.data ?? [];
  const cachedProfile = (cachedCustomers as CustomerProfile[]).find((c) => c.phone === phone);

  const { data: profileSearchRes } = useQuery({
    queryKey: ["customerProfileByPhone", phone],
    queryFn: () => searchCustomerProfiles({ phone }),
    enabled: !cachedProfile && !!phone,
  });
  const profile: CustomerProfile | undefined =
    cachedProfile ?? (profileSearchRes?.data?.data as CustomerProfile[] | undefined)?.[0];

  // All POS orders for this customer (protected route)
  const { data: ordersRes, isLoading: ordersLoading } = useQuery({
    queryKey: ["customerOrders", phone],
    queryFn: () => getOrders({ customerPhone: phone }),
    enabled: !!phone,
  });

  // Ledger for outstanding balance
  const { data: ledgerRes } = useQuery({
    queryKey: ["customerLedger", phone],
    queryFn: () => getCustomerLedger(phone),
    enabled: !!phone,
  });

  const rawOrders: Order[] = ordersRes?.data?.data ?? [];
  const orders = [...rawOrders].sort(
    (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
  );

  const ledger: CustomerLedger | null = ledgerRes?.data?.data ?? null;
  const balanceDue: number = ledger?.balanceDue ?? profile?.balanceDue ?? 0;
  const isLedgerOnly = profile?.isLedgerOnly ?? false;
  const displayName = profile?.name ?? ledger?.customerName ?? phone;

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
      setPayAmount(""); setPayNotes(""); setPayMethod("Cash");
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

  const exportPayload: ExportPayload = { orders, profile, ledger, phone };

  async function handleWhatsApp() {
    setSharing(true);
    try {
      const shared = await shareViaNativeShare(exportPayload);
      if (!shared) shareViaWhatsAppText(exportPayload);
    } catch {
      shareViaWhatsAppText(exportPayload);
    } finally {
      setSharing(false);
      setShareOpen(false);
    }
  }

  function handlePDF() {
    exportToPDF(exportPayload);
    setShareOpen(false);
  }

  function handleExcel() {
    exportToExcel(exportPayload);
    setShareOpen(false);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-dhaba-bg relative overflow-y-auto">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] z-0 pointer-events-none" />
      <div className="fixed top-[20%] right-[-10%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[100px] z-0 pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col pb-24">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 glass-card border-b border-dhaba-border/20 px-4 py-4 flex items-center gap-4 shadow-sm backdrop-blur-xl bg-[#0c111d]/80">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 shadow-inner"
          >
            <FaArrowLeft className="text-white/70" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 truncate tracking-wide">
              {displayName}
            </h1>
            <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Customer Profile</p>
          </div>

          <button
            onClick={() => { setEditName(profile?.name ?? ""); setEditPhone(phone); setEditOpen(true); }}
            className="p-2.5 bg-white/5 hover:bg-blue-500/20 hover:text-blue-400 rounded-xl transition-all border border-white/5 shadow-inner"
            title="Edit customer"
          >
            <FaPen className="text-white/70 text-sm" />
          </button>
        </div>

        <div className="px-4 sm:px-6 pt-6 space-y-6 max-w-2xl mx-auto w-full">

          {/* ── Profile Card ───────────────────────────────────────── */}
          <div className="glass-card rounded-[1.5rem] overflow-hidden border border-dhaba-border/20 shadow-sm">
            {/* Avatar + name */}
            <div className="relative p-6 flex items-start gap-4">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
              <UserAvatar name={displayName} className="relative h-16 w-16 text-2xl shrink-0" />
              <div className="flex-1 min-w-0 relative">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-xl font-black text-white/90 tracking-wide">{displayName}</h2>
                  {isLedgerOnly && <LedgerBadge />}
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-white/50 text-xs font-bold">
                  <FaPhone className="text-[10px]" />
                  <span>{phone}</span>
                </div>
                {profile?.preferredArea && (
                  <div className="flex items-center gap-2 mt-1 text-white/40 text-xs font-medium">
                    <FaMapMarkerAlt className="text-[10px]" />
                    <span>{profile.preferredArea}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShareOpen(true)}
                className="p-2.5 bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-xl transition-all border border-white/5 shadow-inner"
                title="Share ledger"
              >
                <FaShareAlt className="text-white/70 text-sm" />
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 divide-x divide-white/5 border-t border-white/5">
              <div className="px-4 py-4 text-center">
                <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.15em]">Orders</p>
                <p className="font-display text-lg font-black text-white/90 mt-0.5">
                  {profile?.totalOrders ?? orders.length ?? 0}
                </p>
              </div>
              <div className="px-4 py-4 text-center">
                <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.15em]">Last Order</p>
                <p className="text-[11px] font-black text-white/70 mt-0.5">
                  {profile?.lastOrderedAt
                    ? fmt(profile.lastOrderedAt)
                    : orders[0]
                      ? fmt(orders[0].orderDate)
                      : "—"}
                </p>
              </div>
              <div className="px-4 py-4 text-center">
                <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.15em]">Since</p>
                <p className="text-[11px] font-black text-white/70 mt-0.5">
                  {profile?.createdAt
                    ? fmt(profile.createdAt)
                    : ledger?.lastActivity
                      ? fmt(ledger.lastActivity)
                      : "—"}
                </p>
              </div>
            </div>

            {/* Balance row */}
            <div
              className={`border-t px-6 py-4 flex items-center justify-between ${balanceDue > 0
                  ? "border-red-500/20 bg-red-500/5"
                  : "border-emerald-500/10 bg-emerald-500/5"
                }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg border ${balanceDue > 0
                      ? "bg-red-500/10 border-red-500/20"
                      : "bg-emerald-500/10 border-emerald-500/20"
                    }`}
                >
                  <MdAccountBalanceWallet
                    className={`text-lg ${balanceDue > 0 ? "text-red-400" : "text-emerald-400"}`}
                  />
                </div>
                <div>
                  <p
                    className={`text-[9px] font-black uppercase tracking-widest ${balanceDue > 0 ? "text-red-400/70" : "text-emerald-400/70"
                      }`}
                  >
                    Balance Due
                  </p>
                  <p
                    className={`text-base font-black tracking-tight ${balanceDue > 0 ? "text-red-400" : "text-emerald-400"
                      }`}
                  >
                    {balanceDue > 0 ? `₹${balanceDue.toFixed(2)}` : "Settled ✓"}
                  </p>
                </div>
              </div>
              {balanceDue > 0 && (
                <button
                  onClick={() => { setPayAmount(balanceDue.toFixed(2)); setPayOpen(true); }}
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95 transition-all shadow-md"
                >
                  Settle
                </button>
              )}
            </div>
          </div>

          {/* ── Orders Section ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-[1px] flex-1 bg-white/5" />
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
                <FaShoppingBag className="text-blue-400/60" />
                Orders {!ordersLoading && `(${orders.length})`}
              </p>
              <div className="h-[1px] flex-1 bg-white/5" />
            </div>

            {ordersLoading ? (
              <div className="py-12 text-center text-white/40 text-sm animate-pulse font-bold tracking-widest uppercase">
                Loading orders…
              </div>
            ) : orders.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                  <FaShoppingBag className="text-2xl text-white/20" />
                </div>
                <p className="text-white/70 font-black tracking-wide text-sm">No orders found</p>
                <p className="text-xs text-white/30 mt-1">Orders placed at the counter appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const isExpanded = expandedOrderId === order._id;
                  const status = paymentStatusInfo(order);

                  return (
                    <div
                      key={order._id}
                      className="glass-card rounded-[1.25rem] overflow-hidden border border-dhaba-border/20 hover:border-blue-500/30 transition-all duration-300"
                    >
                      {/* Collapsed row — always visible */}
                      <button
                        className="w-full px-5 py-4 flex items-center gap-3 text-left"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order._id)}
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                          <MdReceipt className="text-blue-400 text-sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-white/70 uppercase tracking-wider">
                            {fmt(order.orderDate)}
                            <span className="text-white/30 ml-2 font-normal normal-case tracking-normal">
                              {fmtTime(order.orderDate)}
                            </span>
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {order.orderType && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/5 text-white/50 border border-white/10 capitalize">
                                {order.orderType}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-black text-white/90">
                              ₹{order.bills.totalWithTax.toFixed(0)}
                            </span>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${status.cls}`}>
                              {status.label}
                            </span>
                          </div>
                          {isExpanded
                            ? <FaChevronUp className="text-white/30 text-xs" />
                            : <FaChevronDown className="text-white/30 text-xs" />
                          }
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="border-t border-white/5 bg-white/[0.02]">
                          {/* Items table */}
                          <div className="px-5 pt-4 pb-2">
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-3">Items</p>
                            <div className="space-y-2.5">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-white/80 leading-tight">{item.name}</p>
                                    {item.variantSize && (
                                      <p className="text-[10px] text-white/40 mt-0.5">{item.variantSize}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs font-bold text-white/50 shrink-0">
                                    <span>×{item.quantity}</span>
                                    <span className="text-white/30">@ ₹{item.pricePerQuantity}</span>
                                    <span className="text-white/80 font-black w-14 text-right">
                                      ₹{(item.price ?? item.pricePerQuantity * item.quantity).toFixed(0)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Bill breakdown */}
                          <div className="mx-5 my-3 border-t border-white/5 pt-3 space-y-1.5">
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Bill</p>
                            {order.bills.subtotal != null && (
                              <div className="flex justify-between text-xs">
                                <span className="text-white/50">Subtotal</span>
                                <span className="text-white/70 font-bold">₹{order.bills.subtotal.toFixed(2)}</span>
                              </div>
                            )}
                            {(order.bills.tax ?? 0) > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-white/50">Tax (GST)</span>
                                <span className="text-white/70 font-bold">₹{order.bills.tax!.toFixed(2)}</span>
                              </div>
                            )}
                            {(order.bills.discount ?? 0) > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-white/50">Discount</span>
                                <span className="text-emerald-400 font-bold">-₹{order.bills.discount!.toFixed(2)}</span>
                              </div>
                            )}
                            {order.bills.roundOff != null && order.bills.roundOff !== 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-white/50">Round Off</span>
                                <span className="text-white/50 font-bold">
                                  {order.bills.roundOff > 0 ? "+" : ""}₹{order.bills.roundOff.toFixed(2)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-black pt-2 border-t border-white/10">
                              <span className="text-white/80">Total</span>
                              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                                ₹{order.bills.totalWithTax.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Payment row */}
                          <div className="mx-5 mb-4 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Payment</p>
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <FaWallet className="text-white/30 text-xs" />
                                <span className="text-xs text-white/60 font-bold capitalize">
                                  {order.paymentMethod ?? "—"}
                                </span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <p className="text-[9px] font-black text-white/30 uppercase tracking-wider">Paid</p>
                                  <p className="text-xs font-black text-emerald-400">
                                    ₹{(order.amountPaid ?? 0).toFixed(2)}
                                  </p>
                                </div>
                                {(order.balanceDueOnOrder ?? 0) > 0 && (
                                  <div className="text-center">
                                    <p className="text-[9px] font-black text-white/30 uppercase tracking-wider">Due</p>
                                    <p className="text-xs font-black text-red-400">
                                      ₹{order.balanceDueOnOrder.toFixed(2)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Share Ledger Bottom Sheet ──────────────────────────────── */}
      <AnimatePresence>
        {shareOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShareOpen(false)}
              className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 z-[100] max-w-lg mx-auto"
            >
              <div className="relative overflow-hidden rounded-t-[2rem] bg-[#0d1526] border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]">
                {/* Subtle glow strip */}
                <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                {/* Drag pill */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-3 pb-5">
                  <div>
                    <h3 className="font-display text-lg font-black text-white tracking-wide">
                      Share Ledger
                    </h3>
                    <p className="text-xs text-white/40 mt-0.5">
                      {orders.length} orders · {displayName}
                    </p>
                  </div>
                  <button
                    onClick={() => setShareOpen(false)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all"
                  >
                    <FaTimes className="text-white/50 text-sm" />
                  </button>
                </div>

                {/* Options */}
                <div className="px-4 pb-8 space-y-3">
                  {/* WhatsApp */}
                  <button
                    onClick={handleWhatsApp}
                    disabled={sharing || orders.length === 0}
                    className="w-full group flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-900/30 group-hover:shadow-emerald-500/30 transition-shadow">
                      <FaWhatsapp className="text-white text-xl" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-black text-white/90 tracking-wide">
                        Share via WhatsApp
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {sharing ? "Preparing PDF…" : "Send PDF or text summary to customer"}
                      </p>
                    </div>
                    {sharing && (
                      <span className="h-4 w-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin shrink-0" />
                    )}
                  </button>

                  {/* PDF */}
                  <button
                    onClick={handlePDF}
                    disabled={orders.length === 0}
                    className="w-full group flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-red-500/40 hover:bg-red-500/5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shrink-0 shadow-lg shadow-red-900/30 group-hover:shadow-red-500/30 transition-shadow">
                      <FaFilePdf className="text-white text-xl" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-black text-white/90 tracking-wide">
                        Download PDF
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        Formatted ledger — printable, shareable
                      </p>
                    </div>
                  </button>

                  {/* Excel */}
                  <button
                    onClick={handleExcel}
                    disabled={orders.length === 0}
                    className="w-full group flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-green-500/40 hover:bg-green-500/5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-green-600 to-teal-700 flex items-center justify-center shrink-0 shadow-lg shadow-green-900/30 group-hover:shadow-green-500/30 transition-shadow">
                      <FaFileExcel className="text-white text-xl" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-black text-white/90 tracking-wide">
                        Download Excel
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        Spreadsheet — editable, filterable
                      </p>
                    </div>
                  </button>

                  {orders.length === 0 && (
                    <p className="text-center text-xs text-white/30 font-medium pt-1">
                      No orders to export yet
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Payment Modal ───────────────────────────────────────────── */}
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
              <div
                className="absolute inset-[-50%] animate-spin z-0 pointer-events-none"
                style={{ animationDuration: "6s", background: "conic-gradient(from 180deg at 50% 50%, #f97316 0deg, #ef4444 180deg, transparent 360deg)" }}
              />
              <div className="absolute inset-[1px] bg-[#111827] rounded-[1.95rem] z-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                  <div>
                    <h2 className="font-display text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
                      Record Payment
                    </h2>
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">{displayName}</p>
                  </div>
                  <button
                    onClick={() => setPayOpen(false)}
                    className="p-2.5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all border border-white/5"
                  >
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
                      <button
                        type="button"
                        onClick={() => setPayAmount(balanceDue.toFixed(2))}
                        className="text-[10px] font-black text-orange-400 hover:text-orange-300 transition-colors uppercase tracking-wider px-2 py-1 rounded bg-orange-500/10 border border-orange-500/20"
                      >
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
                        step="0.01" min="0.01"
                        placeholder={balanceDue.toFixed(2)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-white/60 uppercase tracking-[0.15em] mb-2.5">
                      Payment Method
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m} type="button" onClick={() => setPayMethod(m)}
                          className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${payMethod === m
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
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="Any remarks…"
                      className="w-full bg-[#1e293b] rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none focus:ring-2 ring-orange-500/50 border border-white/5 placeholder:text-white/20 transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="px-6 py-5 bg-[#0f172a] border-t border-white/5 flex gap-3 justify-end">
                  <button
                    onClick={() => setPayOpen(false)}
                    className="px-6 py-3 rounded-xl text-white/50 font-black text-[11px] uppercase tracking-wider hover:text-white hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => payMutation.mutate()}
                    disabled={!payAmount || Number(payAmount) <= 0 || payMutation.isPending}
                    className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-8 py-3 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center gap-2 hover:shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-orange-400/30 active:scale-95"
                  >
                    {payMutation.isPending && (
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    {payMutation.isPending ? "Recording…" : "Confirm"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Edit Customer Modal ─────────────────────────────────────── */}
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
              <div
                className="absolute inset-[-50%] animate-spin z-0 pointer-events-none"
                style={{ animationDuration: "6s", background: "conic-gradient(from 180deg at 50% 50%, #3b82f6 0deg, #8b5cf6 180deg, transparent 360deg)" }}
              />
              <div className="absolute inset-[1px] bg-[#111827] rounded-[1.95rem] z-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                  <div>
                    <h2 className="font-display text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
                      Edit Customer
                    </h2>
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">
                      Update name or phone number
                    </p>
                  </div>
                  <button
                    onClick={() => setEditOpen(false)}
                    className="p-2.5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all border border-white/5"
                  >
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
                    <label className="block text-[10px] font-black text-white/60 uppercase tracking-[0.15em] mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-black text-sm">
                        <FaPhone />
                      </span>
                      <input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="Phone number"
                        className="w-full bg-[#1e293b] rounded-xl pl-9 pr-4 py-3.5 text-white font-medium text-sm focus:outline-none focus:ring-2 ring-blue-500/50 border border-white/5 placeholder:text-white/20 transition-all shadow-inner"
                      />
                    </div>
                    {editPhone.trim() !== phone && editPhone.trim() && (
                      <p className="text-[10px] text-amber-400/80 mt-1.5 font-semibold">
                        Phone change will redirect to updated profile
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-6 py-5 bg-[#0f172a] border-t border-white/5 flex gap-3 justify-end">
                  <button
                    onClick={() => setEditOpen(false)}
                    className="px-6 py-3 rounded-xl text-white/50 font-black text-[11px] uppercase tracking-wider hover:text-white hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => editMutation.mutate()}
                    disabled={(!editName.trim() && editPhone.trim() === phone) || editMutation.isPending}
                    className="bg-gradient-to-r from-blue-500 to-violet-600 text-white px-8 py-3 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center gap-2 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400/30 active:scale-95"
                  >
                    {editMutation.isPending && (
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
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
