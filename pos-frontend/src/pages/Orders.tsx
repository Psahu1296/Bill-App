import React, { useState, useEffect, useMemo, useRef } from "react";
import BottomNav from "../components/shared/BottomNav";
import OrderCard from "../components/orders/OrderCard";
import BackButton from "../components/shared/BackButton";
import AddPastOrderModal from "../components/orders/AddPastOrderModal";
import Skeleton from "../components/shared/Skeleton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrders } from "../https/index";
import { enqueueSnackbar } from "notistack";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaClipboardList, FaHourglassHalf, FaCheckCircle,
  FaExclamationCircle, FaCalendarAlt, FaPlus, FaSearch, FaTimes,
} from "react-icons/fa";
import { IoCheckmarkDoneCircle } from "react-icons/io5";
import type { Order } from "../types";

const STATUS_FILTERS = ["All", "Pending", "Cooking", "Ready", "Completed"] as const;
type FilterKey = typeof STATUS_FILTERS[number];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const Orders: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<FilterKey>("All");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [showAddPastOrder, setShowAddPastOrder] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const isToday = selectedDate === todayStr();
  const isSearchMode = debouncedSearch.length >= 2;

  useEffect(() => { document.title = "Dhaba POS | Orders"; }, []);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: resData, isLoading, isError, error } = useQuery({
    queryKey: ["orders", selectedDate],
    queryFn: () => getOrders({ startDate: selectedDate, endDate: selectedDate }),
    placeholderData: keepPreviousData,
    refetchInterval: isToday ? 30_000 : false,
    enabled: !isSearchMode,
  });

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["orders", "search", debouncedSearch],
    queryFn: () => getOrders({ search: debouncedSearch }),
    placeholderData: keepPreviousData,
    enabled: isSearchMode,
  });

  // Single query for all non-completed active orders (Pending/Cooking/In Progress/Ready).
  const { data: activeOrdersRes } = useQuery({
    queryKey: ["orders", "active"],
    queryFn: () => getOrders({ excludeStatus: "Completed" }),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
    enabled: isToday && !isSearchMode,
  });

  useEffect(() => {
    if (isError) enqueueSnackbar("Failed to load orders: " + (error as Error).message, { variant: "error" });
  }, [isError, error]);

  const allOrders = useMemo<Order[]>(() => {
    if (isSearchMode) return (searchData?.data?.data as Order[]) ?? [];
    const dateFiltered: Order[] = resData?.data?.data ?? [];
    if (!isToday) return dateFiltered;
    // Merge date-filtered + active orders (dedup by _id)
    const extra: Order[] = (activeOrdersRes?.data?.data as Order[]) ?? [];
    const map = new Map<string, Order>();
    [...dateFiltered, ...extra].forEach((o) => map.set(o._id, o));
    return Array.from(map.values());
  }, [resData, activeOrdersRes, isToday, isSearchMode, searchData]);

  // ── Stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pendingOrders = allOrders.filter((o) => o.orderStatus === "Pending").length;
    const cooking    = allOrders.filter((o) => o.orderStatus === "Cooking" || o.orderStatus === "In Progress").length;
    const ready      = allOrders.filter((o) => o.orderStatus === "Ready").length;
    const completed  = allOrders.filter((o) => o.orderStatus === "Completed").length;
    const revenue    = allOrders.reduce((s, o) => s + (o.amountPaid || 0), 0);
    const pendingDue = allOrders.reduce((s, o) => s + Math.max(0, o.bills.totalWithTax - (o.amountPaid || 0)), 0);
    return { total: allOrders.length, pendingOrders, cooking, ready, completed, revenue, pendingDue };
  }, [allOrders]);

  // ── Filtered list ─────────────────────────────────────────────
  const filteredOrders = useMemo<Order[]>(() => {
    if (statusFilter === "All") return allOrders;
    if (statusFilter === "Cooking") return allOrders.filter((o) => o.orderStatus === "Cooking" || o.orderStatus === "In Progress");
    return allOrders.filter((o) => o.orderStatus === statusFilter);
  }, [statusFilter, allOrders]);

  // ── Grouped ────────────
  const grouped = useMemo(() => {
    if (statusFilter !== "All") return null;
    return {
      pending:    allOrders.filter((o) => o.orderStatus === "Pending"),
      cooking:    allOrders.filter((o) => o.orderStatus === "Cooking" || o.orderStatus === "In Progress"),
      ready:      allOrders.filter((o) => o.orderStatus === "Ready"),
      completed:  allOrders.filter((o) => o.orderStatus === "Completed"),
    };
  }, [statusFilter, allOrders]);

  // ── Filter pill config ────────────────────────────────────────
  const pillCfg: Record<FilterKey, { color: string; active: string; count: number }> = {
    "All":       { color: "text-dhaba-muted hover:text-dhaba-text",          active: "bg-dhaba-surface text-dhaba-text shadow-sm",      count: stats.total },
    "Pending":   { color: "text-dhaba-warning/70 hover:text-dhaba-warning",  active: "bg-dhaba-warning/15 text-dhaba-warning",          count: stats.pendingOrders },
    "Cooking":   { color: "text-dhaba-accent/70 hover:text-dhaba-accent",    active: "bg-dhaba-accent/15 text-dhaba-accent",            count: stats.cooking },
    "Ready":     { color: "text-dhaba-success/70 hover:text-dhaba-success",  active: "bg-dhaba-success/15 text-dhaba-success",          count: stats.ready },
    "Completed": { color: "text-dhaba-muted hover:text-dhaba-text",          active: "bg-dhaba-surface text-dhaba-text shadow-sm",      count: stats.completed },
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-dhaba-bg relative overflow-y-auto">
      {/* Ambient Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] z-0 pointer-events-none" />
      <div className="fixed top-[20%] right-[-10%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[100px] z-0 pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col pb-24 px-4 sm:px-6 md:px-8 max-w-[1600px] mx-auto w-full pt-8 space-y-6">

        {/* Header & Actions */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="shrink-0 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors shadow-inner">
              <BackButton />
            </div>
            <div>
              <h1 className="font-display text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tracking-wide">Orders Hub</h1>
              <p className="text-sm text-white/50 mt-1 font-medium tracking-wide">
                {isSearchMode ? `Search: "${debouncedSearch}"` : isToday ? "Today's live view" : selectedDate}
                {(isLoading || searchLoading) && <span className="ml-2 text-blue-400 animate-pulse font-bold tracking-widest uppercase text-[10px]">· updating…</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Premium Search */}
            <div className="relative group flex-1 lg:flex-none lg:w-72">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm pointer-events-none group-focus-within:text-blue-400 transition-colors" />
              <input
                ref={searchRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, phone, ID…"
                className="w-full bg-[#1e293b] rounded-2xl pl-11 pr-10 py-3.5 text-white font-black text-sm focus:outline-none focus:ring-2 ring-blue-500/50 border border-white/5 placeholder:text-white/20 transition-all shadow-inner"
              />
              {searchInput && (
                <button
                  onClick={() => { setSearchInput(""); setDebouncedSearch(""); searchRef.current?.focus(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors bg-white/5 hover:bg-white/10 p-1 rounded-full border border-white/10 shadow-inner"
                >
                  <FaTimes className="text-xs" />
                </button>
              )}
            </div>

            <div className={`flex flex-wrap items-center gap-3 transition-all duration-300 ${isSearchMode ? "opacity-30 pointer-events-none grayscale" : ""}`}>
              <button
                onClick={() => setShowAddPastOrder(true)}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all shadow-md active:scale-95 border border-blue-400/20 uppercase tracking-wider"
              >
                <FaPlus className="text-[10px]" />
                Past Order
              </button>
              {!isToday && (
                <button
                  onClick={() => { setSelectedDate(todayStr()); setSearchInput(""); setDebouncedSearch(""); }}
                  className="flex items-center justify-center px-5 py-3.5 rounded-2xl font-black text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-all border border-blue-500/20 uppercase tracking-wider"
                >
                  Today
                </button>
              )}
              <label className="flex items-center gap-3 px-4 py-3 bg-[#1e293b] rounded-2xl border border-white/5 shadow-inner cursor-pointer hover:border-white/10 transition-colors">
                <FaCalendarAlt className="text-white/40 text-sm" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setSearchInput(""); setDebouncedSearch(""); }}
                  className="bg-transparent text-white font-black text-sm focus:outline-none uppercase tracking-wider w-full lg:w-auto"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Stats strip - glass cards grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { icon: <FaClipboardList />,      label: "Total Orders",value: stats.total,                              color: "text-white/90",        iconColor: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
            { icon: <FaHourglassHalf />,      label: "New",         value: stats.pendingOrders,                      color: stats.pendingOrders > 0 ? "text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" : "text-white/40", iconColor: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", pulse: stats.pendingOrders > 0 },
            { icon: <FaCheckCircle />,        label: "Ready",       value: stats.ready,                              color: "text-emerald-400",     iconColor: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/20" },
            { icon: <IoCheckmarkDoneCircle />,label: "Revenue",     value: `₹${stats.revenue.toFixed(0)}`,           color: "text-emerald-400",     iconColor: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/20" },
            { icon: <FaExclamationCircle />,  label: "Pending Due", value: `₹${stats.pendingDue.toFixed(0)}`,        color: stats.pendingDue > 0 ? "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" : "text-white/40", iconColor: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
          ].map(({ icon, label, value, color, iconColor, bg, border, pulse }) => (
            <div key={label} className={`glass-card rounded-[1.25rem] p-4 flex flex-col gap-3 border border-dhaba-border/20 shadow-sm relative overflow-hidden group hover:${border} transition-all`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${bg} opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none`} />
              <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center shrink-0 border ${border} ${pulse ? "animate-pulse shadow-[0_0_15px_rgba(251,146,60,0.3)]" : ""}`}>
                <span className={`text-lg ${iconColor}`}>{icon}</span>
              </div>
              <div className="relative z-10">
                <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">{label}</p>
                <p className={`font-display text-2xl font-black mt-0.5 tracking-tight ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
           {(["All", "Pending", "Cooking", "Ready", "Completed"] as const).map((s) => {
             const isActive = statusFilter === s;
             const count = pillCfg[s].count;
             return (
               <button
                 key={s}
                 onClick={() => setStatusFilter(s)}
                 className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 transition-all border ${
                   isActive
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                    : "bg-[#1e293b] text-white/50 border-white/5 hover:bg-white/10 hover:text-white/80"
                 }`}
               >
                 {s}
                 {count > 0 && (
                   <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                     isActive ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-white/5 text-white/40 border-white/10"
                   }`}>
                     {count}
                   </span>
                 )}
               </button>
             );
           })}
        </div>

        {/* Content Area */}
        <div className="flex-1 pb-10">
          {(isLoading || searchLoading) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <Skeleton className="h-44 rounded-[1.25rem]" count={6} gap="gap-6" />
            </div>
          ) : grouped ? (
            <div className="space-y-8">
              {grouped.pending.length > 0 && <Section title="New Orders — Awaiting Acceptance" count={grouped.pending.length} color="text-orange-400" bg="bg-orange-500/10" border="border-orange-500/20" pulse orders={grouped.pending} />}
              {grouped.cooking.length > 0 && <Section title="Cooking" count={grouped.cooking.length} color="text-blue-400" bg="bg-blue-500/10" border="border-blue-500/20" pulse orders={grouped.cooking} />}
              {grouped.ready.length > 0 && <Section title="Ready to Serve" count={grouped.ready.length} color="text-emerald-400" bg="bg-emerald-500/10" border="border-emerald-500/20" orders={grouped.ready} />}
              {grouped.completed.length > 0 && <Section title="Completed" count={grouped.completed.length} color="text-white/40" bg="bg-white/5" border="border-white/10" orders={grouped.completed} />}
              {allOrders.length === 0 && <EmptyState date={selectedDate} filter="All" search={isSearchMode ? debouncedSearch : undefined} />}
            </div>
          ) : (
            filteredOrders.length > 0 ? (
              <AnimatePresence>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredOrders.map((order) => (
                    <motion.div key={order._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
                      <OrderCard order={order} />
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            ) : (
              <EmptyState date={selectedDate} filter={statusFilter} search={isSearchMode ? debouncedSearch : undefined} />
            )
          )}
        </div>
      </div>

      <div className="relative z-20">
        <BottomNav />
      </div>
      {showAddPastOrder && <AddPastOrderModal onClose={() => setShowAddPastOrder(false)} />}
    </div>
  );
};

// ── Section component (used in grouped view) ──────────────────────
interface SectionProps {
  title: string;
  count: number;
  color: string;
  bg: string;
  border: string;
  pulse?: boolean;
  orders: Order[];
}

const Section: React.FC<SectionProps> = ({ title, count, color, bg, border, pulse, orders }) => (
  <div>
    <div className="flex items-center gap-3 mb-4">
      <div className={`flex items-center justify-center h-8 px-3 rounded-lg ${bg} border ${border} ${pulse ? "animate-pulse shadow-[0_0_15px_rgba(251,146,60,0.2)]" : ""}`}>
        <h2 className={`font-black text-[10px] uppercase tracking-widest ${color}`}>{title}</h2>
      </div>
      <span className={`text-[10px] font-black px-2 py-1 rounded border ${bg} ${border} ${color}`}>{count}</span>
      <div className={`flex-1 h-px ${bg}`} />
    </div>
    <AnimatePresence>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {orders.map((order) => (
          <motion.div key={order._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
            <OrderCard order={order} />
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  </div>
);

// ── Empty state ───────────────────────────────────────────────────
const EmptyState: React.FC<{ date: string; filter: string; search?: string }> = ({ date, filter, search }) => {
  if (search) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-dhaba-muted">
        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10 shadow-inner">
          <FaSearch className="text-4xl text-white/20" />
        </div>
        <p className="font-black text-lg text-white/80 tracking-wide">No orders found for "{search}"</p>
        <p className="text-xs text-white/40 mt-2 font-medium tracking-wide">
          Try a different name, phone number, or order ID.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 text-dhaba-muted">
      <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10 shadow-inner">
        <FaClipboardList className="text-4xl text-white/20" />
      </div>
      <p className="font-black text-lg text-white/80 tracking-wide">No orders found</p>
      <p className="text-xs text-white/40 mt-2 font-medium tracking-wide">
        {date} · {filter === "All" ? "any status" : `"${filter}"`}
      </p>
    </div>
  );
};

export default Orders;
