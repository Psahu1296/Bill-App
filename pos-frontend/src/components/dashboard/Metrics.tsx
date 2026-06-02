import React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getDashboardEarningsSummary,
  getExpensesByPeriod,
  getOrders,
  getDishes,
  getTables,
  getDashboardChartData,
  getTopRevenueDishes,
  getDailySummary,
  getDailySummaryRange,
} from "../../https";
import MatrixCard from "../matrix/MatrixCard";
import DashboardCharts from "./DashboardCharts";
import type { Dish, Order, Table } from "../../types";
import { FaUtensils, FaTable, FaHourglassHalf, FaLayerGroup } from "react-icons/fa";
import { MdCalendarMonth } from "react-icons/md";

const PRESET_TYPES = [
  { value: "day",   label: "Today"     },
  { value: "week",  label: "This Week" },
  { value: "month", label: "This Month"},
  { value: "year",  label: "This Year" },
];

const TypeMap: Record<string, string> = {
  day: "daily", week: "weekly", month: "monthly", year: "yearly",
};

interface DailySummaryItem {
  date: string;
  revenue: number;
  order_count: number;
  expenses: { total: number };
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function subDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

function getPeriodRange(period: string): { from: string; to: string } {
  const today = new Date();
  const todayStr = fmt(today);
  switch (period) {
    case "week": {
      const day = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      return { from: fmt(monday), to: todayStr };
    }
    case "month":
      return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: todayStr };
    case "year":
      return { from: fmt(new Date(today.getFullYear(), 0, 1)), to: todayStr };
    default:
      return { from: todayStr, to: todayStr };
  }
}

const Metrics: React.FC = () => {
  const [period, setPeriod] = React.useState("day");
  const isCustom = period === "custom";

  const todayStr = fmt(new Date());
  const [customFrom, setCustomFrom] = React.useState(() => fmt(subDays(new Date(), 6)));
  const [customTo, setCustomTo] = React.useState(todayStr);

  // ── Preset financial data ────────────────────────────────────────────────────
  const { data: expensesRes } = useQuery({
    queryKey: ["expensesSummary", period],
    queryFn: () => getExpensesByPeriod(period),
    enabled: !isCustom,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const { data: earningsRes } = useQuery({
    queryKey: ["dashboardEarnings"],
    queryFn: getDashboardEarningsSummary,
    enabled: !isCustom,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  // ── Preset chart ─────────────────────────────────────────────────────────────
  const { data: chartRes, isLoading: presetChartLoading } = useQuery({
    queryKey: ["dashboardChart", period],
    queryFn: () => getDashboardChartData(period),
    enabled: !isCustom,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  // ── Custom range chart (daily summary range) ─────────────────────────────────
  const { data: rangeRes, isLoading: rangeLoading } = useQuery({
    queryKey: ["dailySummaryRange", customFrom, customTo],
    queryFn: () => getDailySummaryRange(customFrom, customTo),
    enabled: isCustom,
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

  // ── Top dishes (respects preset period OR custom range) ──────────────────────
  const periodRange = getPeriodRange(period);
  const dishesFrom = isCustom ? customFrom : periodRange.from;
  const dishesTo   = isCustom ? customTo   : periodRange.to;

  const { data: topDishesRes } = useQuery({
    queryKey: ["topRevenueDishes", dishesFrom, dishesTo],
    queryFn: () => getTopRevenueDishes({ limit: 6, from: dishesFrom, to: dishesTo }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  // ── Today's daily summary for payment split donut ────────────────────────────
  const { data: dailySummaryRes } = useQuery({
    queryKey: ["dailySummary", todayStr],
    queryFn: () => getDailySummary(todayStr),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  // ── Derived values ───────────────────────────────────────────────────────────
  const rangeItems = (rangeRes?.data as { data?: DailySummaryItem[] } | undefined)?.data ?? [];

  // Financial cards
  const earningsData = earningsRes?.data?.data as Record<string, { total: number; percentageChange: number }> | undefined;
  const earnings     = earningsData?.[TypeMap[period]];

  const displayIncome: number = isCustom
    ? rangeItems.reduce((s, d) => s + d.revenue, 0)
    : Math.floor(earnings?.total ?? 0);

  const displayExpenses: number | undefined = isCustom
    ? rangeItems.reduce((s, d) => s + d.expenses.total, 0)
    : (expensesRes?.data?.data as { totalExpenses?: number } | undefined)?.totalExpenses;

  const percent = isCustom ? undefined : (earnings?.percentageChange ?? 0);

  // Chart data
  const presetChartData = (chartRes?.data as { data?: { labels: string[]; income: number[]; expenses: number[]; orders: number[] } })?.data;

  const customChartData = isCustom && rangeItems.length > 0
    ? {
        labels:   rangeItems.map(d => d.date.slice(5)),
        income:   rangeItems.map(d => d.revenue),
        expenses: rangeItems.map(d => d.expenses.total),
        orders:   rangeItems.map(d => d.order_count),
      }
    : undefined;

  const chartData   = isCustom ? customChartData : presetChartData;
  const chartLoading = isCustom ? rangeLoading : presetChartLoading;

  // Live cards
  const dishes     = (dishesRes?.data?.data  as Dish[]  | undefined) ?? [];
  const tables     = (tablesRes?.data?.data  as Table[] | undefined) ?? [];
  const inProgress = (ordersRes?.data?.data  as Order[] | undefined) ?? [];
  const ready      = (readyRes?.data?.data   as Order[] | undefined) ?? [];

  const totalDishes     = dishes.length;
  const availableDishes = dishes.filter((d) => d.isAvailable).length;
  const totalTables     = tables.length;
  const bookedTables    = tables.filter((t) => t.status === "Booked").length;
  const activeOrders    = inProgress.length + ready.length;
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

  const chartPeriodLabel = isCustom ? "custom" : period;

  return (
    <div className="container mx-auto px-6">
      {/* ── Header + period selector ── */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h2 className="font-display text-xl font-bold text-dhaba-text">Overall Performance</h2>
          <p className="text-sm text-dhaba-muted mt-1">Track your dhaba's growth and metrics</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset period tabs */}
          <div className="flex items-center gap-1 p-1 bg-dhaba-surface/50 rounded-xl border border-dhaba-border/50">
            {PRESET_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setPeriod(t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  period === t.value
                    ? "bg-dhaba-accent/10 text-dhaba-accent border border-dhaba-accent/30"
                    : "text-dhaba-muted hover:text-dhaba-text border border-transparent"
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => setPeriod("custom")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                isCustom
                  ? "bg-dhaba-accent/10 text-dhaba-accent border border-dhaba-accent/30"
                  : "text-dhaba-muted hover:text-dhaba-text border border-transparent"
              }`}
            >
              <MdCalendarMonth className="text-sm" />
              Custom
            </button>
          </div>

          {/* Date inputs — only visible in custom mode */}
          {isCustom && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="glass-input rounded-xl px-3 py-2 text-dhaba-text text-xs font-medium focus:outline-none focus:ring-1 focus:ring-dhaba-accent/50"
              />
              <span className="text-dhaba-muted text-xs font-bold">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayStr}
                onChange={(e) => setCustomTo(e.target.value)}
                className="glass-input rounded-xl px-3 py-2 text-dhaba-text text-xs font-medium focus:outline-none focus:ring-1 focus:ring-dhaba-accent/50"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Financial cards ── */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <MatrixCard metric={{
          title: "Expenses",
          value: displayExpenses != null ? `₹${Math.floor(displayExpenses).toLocaleString("en-IN")}` : "No Data",
          percentage: undefined,
          color: "hsl(var(--dhaba-danger))",
          isIncrease: false,
        }} />
        <MatrixCard metric={{
          title: "Income",
          value: `₹${displayIncome.toLocaleString("en-IN")}`,
          percentage: percent ? `${percent}%` : undefined,
          color: "hsl(var(--dhaba-success))",
          isIncrease: (percent ?? 0) >= 0,
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

      {/* ── Charts ── */}
      <DashboardCharts
        data={chartData}
        isLoading={chartLoading}
        period={chartPeriodLabel}
        customRange={isCustom ? { from: customFrom, to: customTo } : undefined}
        topDishes={(topDishesRes?.data as { data?: { name: string; totalRevenue: number; totalQuantity: number; orderCount: number }[] })?.data}
        paymentSplit={(dailySummaryRes?.data as { data?: { payment_split: { cash: number; upi: number; card: number; credit: number } } })?.data?.payment_split}
        avgOrderValue={(dailySummaryRes?.data as { data?: { avg_order_value: number } })?.data?.avg_order_value}
      />
    </div>
  );
};

export default Metrics;
