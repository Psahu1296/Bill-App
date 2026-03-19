import React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getDashboardEarningsSummary,
  getExpensesByPeriod,
  getOrders,
  getDishes,
  getTables,
} from "../../https";
import MatrixCard from "../matrix/MatrixCard";
import type { Dish, Order, Table } from "../../types";
import { FaUtensils, FaTable, FaHourglassHalf, FaLayerGroup } from "react-icons/fa";

const METRICS_TYPES = [
  { value: "day",   label: "Today"     },
  { value: "week",  label: "This Week" },
  { value: "month", label: "This Month"},
  { value: "year",  label: "This Year" },
];

const TypeMap: Record<string, string> = {
  day: "daily", week: "weekly", month: "monthly", year: "yearly",
};

const Metrics: React.FC = () => {
  const [metrics, setMetrics] = React.useState(METRICS_TYPES[0]);

  // ── Financial data ───────────────────────────────────────────────────────────
  const { data: expensesRes } = useQuery({
    queryKey: ["expensesSummary", metrics.value],
    queryFn: () => getExpensesByPeriod(metrics.value),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const { data: earningsRes } = useQuery({
    queryKey: ["earnings"],
    queryFn: getDashboardEarningsSummary,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  // ── Live inventory / order counts ────────────────────────────────────────────
  const { data: dishesRes } = useQuery({
    queryKey: ["dishes"],
    queryFn: getDishes,
    placeholderData: keepPreviousData,
    refetchInterval: 120_000,
  });

  const { data: tablesRes } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const { data: ordersRes } = useQuery({
    queryKey: ["orders", "active"],
    queryFn: () => getOrders({ orderStatus: "In Progress" }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const { data: readyRes } = useQuery({
    queryKey: ["orders", "ready"],
    queryFn: () => getOrders({ orderStatus: "Ready" }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  // ── Derived values ───────────────────────────────────────────────────────────
  const earningsData = earningsRes?.data?.data as Record<string, { total: number; percentageChange: number }> | undefined;
  const earnings     = earningsData?.[TypeMap[metrics.value]];
  const total        = Math.floor(earnings?.total ?? 0);
  const percent      = earnings?.percentageChange ?? 0;

  const expensesTotal = (expensesRes?.data?.data as { totalExpenses?: number } | undefined)?.totalExpenses;

  const dishes      = (dishesRes?.data?.data  as Dish[]  | undefined) ?? [];
  const tables      = (tablesRes?.data?.data  as Table[] | undefined) ?? [];
  const inProgress  = (ordersRes?.data?.data  as Order[] | undefined) ?? [];
  const ready       = (readyRes?.data?.data   as Order[] | undefined) ?? [];

  const totalDishes     = dishes.length;
  const availableDishes = dishes.filter((d) => d.isAvailable).length;
  const totalTables     = tables.length;
  const bookedTables    = tables.filter((t) => t.status === "Booked").length;
  const activeOrders    = inProgress.length + ready.length;

  // Unique dish types / categories
  const uniqueCategories = new Set(dishes.map((d) => d.type)).size;

  const liveCards = [
    {
      icon: <FaUtensils />,
      title: "Dishes",
      value: `${availableDishes} / ${totalDishes}`,
      sub: "available",
      color: "text-dhaba-accent",
      iconBg: "bg-dhaba-accent/15",
    },
    {
      icon: <FaLayerGroup />,
      title: "Categories",
      value: String(uniqueCategories),
      sub: "dish types",
      color: "text-dhaba-warning",
      iconBg: "bg-dhaba-warning/15",
    },
    {
      icon: <FaTable />,
      title: "Tables",
      value: `${bookedTables} / ${totalTables}`,
      sub: "occupied",
      color: "text-dhaba-success",
      iconBg: "bg-dhaba-success/15",
    },
    {
      icon: <FaHourglassHalf />,
      title: "Active Orders",
      value: String(activeOrders),
      sub: `${inProgress.length} cooking · ${ready.length} ready`,
      color: activeOrders > 0 ? "text-dhaba-danger" : "text-dhaba-muted",
      iconBg: activeOrders > 0 ? "bg-dhaba-danger/15" : "bg-dhaba-surface",
      pulse: activeOrders > 0,
    },
  ];

  return (
    <div className="container mx-auto px-6">
      {/* ── Header + period selector ── */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="font-display text-xl font-bold text-dhaba-text">Overall Performance</h2>
          <p className="text-sm text-dhaba-muted mt-1">Track your dhaba's growth and metrics</p>
        </div>
        <select
          value={metrics.value}
          onChange={(e) => {
            const selected = METRICS_TYPES.find((t) => t.value === e.target.value);
            if (selected) setMetrics(selected);
          }}
          className="glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm font-medium focus:outline-none appearance-none"
        >
          {METRICS_TYPES.map((type) => (
            <option key={type.value} value={type.value} className="bg-dhaba-surface text-dhaba-text">
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Financial cards ── */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <MatrixCard metric={{
          title: "Expenses",
          value: expensesTotal != null ? `₹${expensesTotal.toLocaleString("en-IN")}` : "No Data",
          percentage: undefined,
          color: "hsl(var(--dhaba-danger))",
          isIncrease: false,
        }} />
        <MatrixCard metric={{
          title: "Income",
          value: `₹${total.toLocaleString("en-IN")}`,
          percentage: percent ? `${percent}%` : undefined,
          color: "hsl(var(--dhaba-success))",
          isIncrease: percent >= 0,
        }} />
      </div>

      {/* ── Live stats ── */}
      <div>
        <h2 className="font-display text-xl font-bold text-dhaba-text mb-1">Live Stats</h2>
        <p className="text-sm text-dhaba-muted mb-5">Real-time inventory &amp; order overview</p>
        <div className="grid grid-cols-4 gap-4">
          {liveCards.map(({ icon, title, value, sub, color, iconBg, pulse }) => (
            <div key={title} className="glass-card rounded-2xl p-5 hover:shadow-glow transition-all duration-200 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-dhaba-muted text-xs font-bold tracking-wider uppercase">{title}</p>
                <div className={`h-8 w-8 rounded-xl ${iconBg} ${color} flex items-center justify-center text-sm ${pulse ? "animate-pulse" : ""}`}>
                  {icon}
                </div>
              </div>
              <p className={`font-display text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-dhaba-muted">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Metrics;
