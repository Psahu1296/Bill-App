import React, { useState, useEffect, useMemo } from "react";
import BottomNav from "../components/shared/BottomNav";
import Greetings from "../components/home/Greetings";
import RecentOrders from "../components/home/RecentOrders";
import PopularDishes from "../components/home/PopularDishes";
import NewOrderModal from "../components/home/NewOrderModal";
import QuickConsumableModal from "../components/home/QuickConsumableModal";
import { getDailyEarnings, getOrders, getAllExpenses } from "../https";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { enqueueSnackbar } from "notistack";
import {
  FaPlus, FaArrowUp, FaArrowDown,
  FaHourglassHalf, FaCheckCircle, FaExclamationCircle,
  FaUserTie, FaCoffee,
} from "react-icons/fa";
import { BsCashCoin } from "react-icons/bs";
import type { Order } from "../types";

function todayLocalStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayLocalStr() {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const todayStr = todayLocalStr();
const yesterdayStr = yesterdayLocalStr();

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showQuickConsumable, setShowQuickConsumable] = useState(false);
  useEffect(() => { document.title = "Dhaba POS | Home"; }, []);

  const { data: earningsRes, isError } = useQuery({
    queryKey: ["earnings"],
    queryFn: getDailyEarnings,
    placeholderData: keepPreviousData,
  });

  const { data: todayOrdersRes } = useQuery({
    queryKey: ["orders", "today"],
    queryFn: () => getOrders({ startDate: todayStr, endDate: todayStr }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const { data: yesterdayOrdersRes } = useQuery({
    queryKey: ["orders", "yesterday"],
    queryFn: () => getOrders({ startDate: yesterdayStr, endDate: yesterdayStr }),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError) enqueueSnackbar("Failed to load earnings data", { variant: "error" });
  }, [isError]);

  const { data: todayExpensesRes } = useQuery({
    queryKey: ["expenses", "today"],
    queryFn: () => getAllExpenses({ startDate: todayStr, endDate: todayStr }),
    placeholderData: keepPreviousData,
  });

  const earningsData = earningsRes?.data?.data as { todayEarning?: number; percentageChange?: number } | undefined;
  const earnings = Math.floor(Number(earningsData?.todayEarning ?? 0));
  const earningPct = earningsData?.percentageChange ?? 0;
  const todayExpenses = Math.floor(Number((todayExpensesRes?.data as { total?: number })?.total ?? 0));
  const netEarnings = earnings - todayExpenses;

  const todayOrders: Order[] = useMemo(() => (todayOrdersRes?.data?.data as Order[]) ?? [], [todayOrdersRes]);
  const yesterdayOrders: Order[] = useMemo(() => (yesterdayOrdersRes?.data?.data as Order[]) ?? [], [yesterdayOrdersRes]);

  const stats = useMemo(() => {
    const active = todayOrders.filter((o) => o.orderStatus === "In Progress" || o.orderStatus === "Ready").length;
    const completed = todayOrders.filter((o) => o.orderStatus === "Completed").length;
    const pending = todayOrders.reduce((s, o) => s + Math.max(0, o.bills.totalWithTax - (o.amountPaid || 0)), 0);
    const totalToday = todayOrders.length;
    const totalYest = yesterdayOrders.length;
    const orderPct = totalYest === 0
      ? (totalToday > 0 ? 100 : 0)
      : Math.round(((totalToday - totalYest) / totalYest) * 100);
    return { active, completed, pending, totalToday, orderPct };
  }, [todayOrders, yesterdayOrders]);

  const statCards = [
    {
      label: "Today's Revenue",
      value: `₹${earnings.toLocaleString("en-IN")}`,
      icon: <BsCashCoin />,
      pct: earningPct,
      color: "text-dhaba-success",
      iconBg: "bg-dhaba-success/15",
    },
    {
      label: "Active Orders",
      value: String(stats.active),
      icon: <FaHourglassHalf />,
      pct: null,
      color: "text-dhaba-accent",
      iconBg: "bg-dhaba-accent/15",
      pulse: stats.active > 0,
    },
    {
      label: "Completed",
      value: String(stats.completed),
      icon: <FaCheckCircle />,
      pct: stats.orderPct,
      color: "text-dhaba-text",
      iconBg: "bg-dhaba-surface",
    },
    {
      label: "Pending Balance",
      value: `₹${stats.pending.toFixed(0)}`,
      icon: <FaExclamationCircle />,
      pct: null,
      color: stats.pending > 0 ? "text-dhaba-danger" : "text-dhaba-muted",
      iconBg: stats.pending > 0 ? "bg-dhaba-danger/15" : "bg-dhaba-surface",
    },
  ];

  const quickActions = [
    { label: "Staff", icon: <FaUserTie />, path: "/staff" },
  ];

  return (
    <section className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-24 overflow-y-auto">
      <div className="px-6 pt-4 space-y-5">

        {/* ── Greeting ── */}
        <Greetings />

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon, pct, color, iconBg, pulse }) => (
            <div key={label} className="glass-card rounded-2xl p-4 space-y-3 hover:shadow-glow transition-all duration-300">
              <div className="flex items-center justify-between">
                <p className="text-dhaba-muted text-xs font-bold uppercase tracking-wider">{label}</p>
                <div className={`h-8 w-8 rounded-xl ${iconBg} ${color} flex items-center justify-center text-sm ${pulse ? "animate-pulse" : ""}`}>
                  {icon}
                </div>
              </div>
              <p className={`font-display text-3xl font-bold ${color}`}>{value}</p>
              {label === "Today's Revenue" && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dhaba-danger/15 text-dhaba-danger text-[10px] font-bold">
                    <FaArrowDown className="text-[8px]" />
                    ₹{todayExpenses.toLocaleString("en-IN")}
                  </span>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${netEarnings >= 0 ? "bg-yellow-400/15 text-yellow-400" : "bg-dhaba-danger/15 text-dhaba-danger"}`}>
                    Net ₹{netEarnings.toLocaleString("en-IN")}
                  </span>
                </div>
              )}
              {pct !== null && (
                <div className="flex items-center gap-1.5">
                  <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full
                    ${pct >= 0 ? "bg-dhaba-success/15 text-dhaba-success" : "bg-dhaba-danger/15 text-dhaba-danger"}`}>
                    {pct >= 0 ? <FaArrowUp className="text-[8px]" /> : <FaArrowDown className="text-[8px]" />}
                    {Math.abs(pct)}%
                  </span>
                  <span className="text-dhaba-muted text-xs">vs yesterday</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Quick actions ── */}
        <div className="flex gap-3">
          {/* New Order — opens modal */}
          <button
            onClick={() => setShowNewOrder(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm bg-gradient-warm text-dhaba-bg flex-1 justify-center hover:shadow-glow transition-all"
          >
            <FaPlus className="text-base" /> New Order
          </button>

          {/* Chai / Sutta — opens quick consumable modal */}
          <button
            onClick={() => setShowQuickConsumable(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm bg-gradient-warm text-dhaba-bg flex-1 justify-center hover:shadow-glow transition-all"
          >
            <FaPlus className="text-base" /> <FaCoffee className="text-base" /> Chai / Sutta
          </button>

          {quickActions.map(({ label, icon, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm glass-card text-dhaba-text hover:bg-dhaba-surface-hover flex-1 justify-center hover:shadow-glow transition-all"
            >
              <span className="text-base">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* ── Main content ── */}
        <div className="flex gap-5 pb-2">
          <div className="flex-[3]">
            <RecentOrders />
          </div>
          <div className="flex-[2]">
            <PopularDishes />
          </div>
        </div>

      </div>
      <BottomNav />
      {showNewOrder && <NewOrderModal onClose={() => setShowNewOrder(false)} />}
      {showQuickConsumable && <QuickConsumableModal onClose={() => setShowQuickConsumable(false)} />}
    </section>
  );
};

export default Home;
