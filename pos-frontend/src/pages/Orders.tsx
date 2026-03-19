import React, { useState, useEffect, useMemo } from "react";
import BottomNav from "../components/shared/BottomNav";
import OrderCard from "../components/orders/OrderCard";
import BackButton from "../components/shared/BackButton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrders } from "../https/index";
import { enqueueSnackbar } from "notistack";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaClipboardList, FaHourglassHalf, FaCheckCircle,
  FaExclamationCircle, FaCalendarAlt,
} from "react-icons/fa";
import { IoCheckmarkDoneCircle } from "react-icons/io5";
import type { Order } from "../types";

const STATUS_FILTERS = ["All", "In Progress", "Ready", "Completed"] as const;
type FilterKey = typeof STATUS_FILTERS[number];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const Orders: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<FilterKey>("All");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr();

  useEffect(() => { document.title = "Dhaba POS | Orders"; }, []);

  const { data: resData, isLoading, isError, error } = useQuery({
    queryKey: ["orders", selectedDate],
    queryFn: () => getOrders({ startDate: selectedDate, endDate: selectedDate }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  // Active orders fetched without date filter so lingering In Progress / Ready
  // orders from previous days always show up when viewing today.
  const { data: activeInProgressRes } = useQuery({
    queryKey: ["orders", "active", "inprogress"],
    queryFn: () => getOrders({ orderStatus: "In Progress" }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    enabled: isToday,
  });
  const { data: activeReadyRes } = useQuery({
    queryKey: ["orders", "active", "ready"],
    queryFn: () => getOrders({ orderStatus: "Ready" }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    enabled: isToday,
  });

  useEffect(() => {
    if (isError) enqueueSnackbar("Failed to load orders: " + (error as Error).message, { variant: "error" });
  }, [isError, error]);

  const allOrders = useMemo<Order[]>(() => {
    const dateFiltered: Order[] = resData?.data?.data ?? [];
    if (!isToday) return dateFiltered;
    // Merge date-filtered + all active orders (dedup by _id)
    const extra: Order[] = [
      ...((activeInProgressRes?.data?.data as Order[]) ?? []),
      ...((activeReadyRes?.data?.data   as Order[]) ?? []),
    ];
    const map = new Map<string, Order>();
    [...dateFiltered, ...extra].forEach((o) => map.set(o._id, o));
    return Array.from(map.values());
  }, [resData, activeInProgressRes, activeReadyRes, isToday]);

  // ── Stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const inProgress = allOrders.filter((o) => o.orderStatus === "In Progress").length;
    const ready      = allOrders.filter((o) => o.orderStatus === "Ready").length;
    const completed  = allOrders.filter((o) => o.orderStatus === "Completed").length;
    const revenue    = allOrders.reduce((s, o) => s + (o.amountPaid || 0), 0);
    const pending    = allOrders.reduce((s, o) => s + Math.max(0, o.bills.totalWithTax - (o.amountPaid || 0)), 0);
    return { total: allOrders.length, inProgress, ready, completed, revenue, pending };
  }, [allOrders]);

  // ── Filtered list ─────────────────────────────────────────────
  const filteredOrders = useMemo<Order[]>(() => {
    if (statusFilter === "All") return allOrders;
    return allOrders.filter((o) => o.orderStatus === statusFilter);
  }, [statusFilter, allOrders]);

  // ── Grouped (only when "All") ─────────────────────────────────
  const grouped = useMemo(() => {
    if (statusFilter !== "All") return null;
    return {
      inProgress: allOrders.filter((o) => o.orderStatus === "In Progress"),
      ready:      allOrders.filter((o) => o.orderStatus === "Ready"),
      completed:  allOrders.filter((o) => o.orderStatus === "Completed"),
    };
  }, [statusFilter, allOrders]);

  // ── Filter pill config ────────────────────────────────────────
  const pillCfg: Record<FilterKey, { color: string; active: string; count: number }> = {
    "All":         { color: "text-dhaba-muted hover:text-dhaba-text",        active: "bg-dhaba-surface text-dhaba-text shadow-sm",        count: stats.total },
    "In Progress": { color: "text-dhaba-accent/70 hover:text-dhaba-accent",   active: "bg-dhaba-accent/15 text-dhaba-accent",              count: stats.inProgress },
    "Ready":       { color: "text-dhaba-success/70 hover:text-dhaba-success", active: "bg-dhaba-success/15 text-dhaba-success",            count: stats.ready },
    "Completed":   { color: "text-dhaba-muted hover:text-dhaba-text",         active: "bg-dhaba-surface text-dhaba-text shadow-sm",        count: stats.completed },
  };

  return (
    <section className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-24">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-dhaba-border/20">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="font-display text-2xl font-bold text-dhaba-text">Orders</h1>
            <p className="text-xs text-dhaba-muted mt-0.5">
              {isToday ? "Today's live view" : selectedDate}
              {isLoading && <span className="ml-2 text-dhaba-accent animate-pulse">· updating…</span>}
            </p>
          </div>
        </div>

        {/* Date picker */}
        <div className="flex items-center gap-2">
          {!isToday && (
            <button
              onClick={() => setSelectedDate(todayStr())}
              className="text-xs font-bold text-dhaba-accent glass-card px-3 py-2 rounded-xl border border-dhaba-accent/20 hover:bg-dhaba-accent/10 transition-all"
            >
              Today
            </button>
          )}
          <label className="glass-input rounded-xl flex items-center gap-2 px-4 py-2.5 cursor-pointer">
            <FaCalendarAlt className="text-dhaba-muted text-sm" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-dhaba-text text-sm font-medium focus:outline-none"
            />
          </label>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-5 divide-x divide-dhaba-border/20 border-b border-dhaba-border/20">
        {[
          { icon: <FaClipboardList />,      label: "Total",       value: stats.total,                           color: "text-dhaba-text" },
          { icon: <FaHourglassHalf />,      label: "In Progress", value: stats.inProgress,                      color: "text-dhaba-accent" },
          { icon: <FaCheckCircle />,        label: "Ready",       value: stats.ready,                           color: "text-dhaba-success" },
          { icon: <IoCheckmarkDoneCircle />,label: "Revenue",     value: `₹${stats.revenue.toFixed(0)}`,        color: "text-dhaba-success" },
          { icon: <FaExclamationCircle />,  label: "Pending Due", value: `₹${stats.pending.toFixed(0)}`,        color: stats.pending > 0 ? "text-dhaba-danger" : "text-dhaba-muted" },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="flex flex-col items-center py-3 gap-1">
            <span className={`text-sm ${color}`}>{icon}</span>
            <p className={`font-display text-lg font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-dhaba-muted uppercase tracking-wider font-bold">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter pills ── */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-dhaba-border/10">
        <div className="glass-card rounded-2xl p-1 flex gap-1">
          {STATUS_FILTERS.map((s) => {
            const cfg = pillCfg[s];
            const isActive = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1.5 text-sm rounded-xl px-4 py-2 font-semibold transition-all duration-200 ${
                  isActive ? cfg.active : cfg.color
                }`}
              >
                {s}
                {cfg.count > 0 && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                    isActive ? "bg-white/20" : "bg-dhaba-surface/80"
                  }`}>
                    {cfg.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center py-20 text-dhaba-muted">
            <div className="h-6 w-6 border-2 border-dhaba-accent border-t-transparent rounded-full animate-spin mb-4" />
            <p>Loading orders…</p>
          </div>
        ) : grouped ? (
          /* Grouped "All" view */
          <div className="space-y-6">
            {grouped.inProgress.length > 0 && (
              <Section
                title="In Progress"
                count={grouped.inProgress.length}
                color="text-dhaba-accent"
                dotColor="bg-dhaba-accent"
                pulse
                orders={grouped.inProgress}
              />
            )}
            {grouped.ready.length > 0 && (
              <Section
                title="Ready to Serve"
                count={grouped.ready.length}
                color="text-dhaba-success"
                dotColor="bg-dhaba-success"
                orders={grouped.ready}
              />
            )}
            {grouped.completed.length > 0 && (
              <Section
                title="Completed"
                count={grouped.completed.length}
                color="text-dhaba-muted"
                dotColor="bg-dhaba-muted"
                orders={grouped.completed}
              />
            )}
            {allOrders.length === 0 && <EmptyState date={selectedDate} filter="All" />}
          </div>
        ) : (
          /* Single-status filtered view */
          filteredOrders.length > 0 ? (
            <AnimatePresence>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredOrders.map((order) => (
                  <motion.div
                    key={order._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <OrderCard order={order} />
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          ) : (
            <EmptyState date={selectedDate} filter={statusFilter} />
          )
        )}
      </div>

      <BottomNav />
    </section>
  );
};

// ── Section component (used in grouped view) ──────────────────────
interface SectionProps {
  title: string;
  count: number;
  color: string;
  dotColor: string;
  pulse?: boolean;
  orders: Order[];
}

const Section: React.FC<SectionProps> = ({ title, count, color, dotColor, pulse, orders }) => (
  <div>
    {/* Section heading */}
    <div className="flex items-center gap-2 mb-3">
      <span className={`h-2.5 w-2.5 rounded-full ${dotColor} ${pulse ? "animate-pulse" : ""}`} />
      <h2 className={`font-bold text-sm uppercase tracking-wider ${color}`}>{title}</h2>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg bg-dhaba-surface/80 ${color}`}>{count}</span>
      <div className="flex-1 h-px bg-dhaba-border/20" />
    </div>
    <AnimatePresence>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orders.map((order) => (
          <motion.div
            key={order._id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <OrderCard order={order} />
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  </div>
);

// ── Empty state ───────────────────────────────────────────────────
const EmptyState: React.FC<{ date: string; filter: string }> = ({ date, filter }) => (
  <div className="flex flex-col items-center py-20 text-dhaba-muted">
    <FaClipboardList className="text-5xl mb-4 opacity-20" />
    <p className="font-semibold text-lg text-dhaba-text">No orders found</p>
    <p className="text-sm mt-1">
      {date} · {filter === "All" ? "any status" : `"${filter}"`}
    </p>
  </div>
);

export default Orders;
