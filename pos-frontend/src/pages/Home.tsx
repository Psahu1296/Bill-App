import React, { useState, useEffect, useMemo } from "react";
import BottomNav from "../components/shared/BottomNav";
import Greetings from "../components/home/Greetings";
import RecentOrders from "../components/home/RecentOrders";
import OnlineOrders from "../components/home/OnlineOrders";
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
      <div className="px-8 pt-6 space-y-8 max-w-[1600px] mx-auto">

        {/* ── Greeting ── */}
        <Greetings />

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-4 gap-6">
          {statCards.map(({ label, value, icon, pct, color, iconBg, pulse }) => (
            <div key={label} className="glass-card rounded-[1.5rem] p-5 space-y-3 hover:shadow-glow hover:-translate-y-1 transition-all duration-300 border border-dhaba-border/20">
              <div className="flex items-center justify-between">
                <p className="text-dhaba-muted text-[11px] font-bold uppercase tracking-wider">{label}</p>
                <div className={`h-10 w-10 rounded-xl ${iconBg} ${color} flex items-center justify-center text-lg shadow-sm ${pulse ? "animate-pulse ring-2 ring-current ring-offset-2 ring-offset-dhaba-bg" : ""}`}>
                  {icon}
                </div>
              </div>
              <div className="flex justify-between items-end">
                <p className={`font-display text-4xl font-extrabold tracking-tight ${color}`}>{value}</p>
              </div>
              {label === "Today's Revenue" && (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-dhaba-danger/15 text-dhaba-danger text-xs font-bold border border-dhaba-danger/20">
                    <FaArrowDown className="text-[10px]" />
                    Exp: ₹{todayExpenses.toLocaleString("en-IN")}
                  </span>
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${netEarnings >= 0 ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" : "bg-red-500/15 text-red-500 border-red-500/20"}`}>
                    Net: ₹{netEarnings.toLocaleString("en-IN")}
                  </span>
                </div>
              )}
              {pct !== null && label !== "Today's Revenue" && (
                <div className="flex items-center gap-2 pt-1">
                  <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border
                    ${pct >= 0 ? "bg-dhaba-success/15 text-dhaba-success border-dhaba-success/20" : "bg-dhaba-danger/15 text-dhaba-danger border-dhaba-danger/20"}`}>
                    {pct >= 0 ? <FaArrowUp className="text-[10px]" /> : <FaArrowDown className="text-[10px]" />}
                    {Math.abs(pct)}%
                  </span>
                  <span className="text-dhaba-muted text-[11px] font-medium">vs yesterday</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Quick actions ── */}
        <div className="flex gap-4">
          <button
            onClick={() => setShowNewOrder(true)}
            className="flex items-center gap-2.5 px-6 py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-orange-400 to-orange-600 text-white flex-1 justify-center hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.98] transition-all border border-orange-400/20"
          >
            <FaPlus className="text-lg" /> New POS Order
          </button>

          <button
            onClick={() => setShowQuickConsumable(true)}
            className="flex items-center gap-2.5 px-6 py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex-1 justify-center hover:shadow-lg hover:shadow-emerald-500/30 active:scale-[0.98] transition-all border border-emerald-400/20"
          >
            <FaCoffee className="text-lg" /> Quick Chai / Snacks
          </button>

          {quickActions.map(({ label, icon, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="flex items-center gap-2.5 px-6 py-4 rounded-2xl font-bold text-sm glass-card text-dhaba-text hover:bg-dhaba-surface border border-dhaba-border/20 flex-1 justify-center hover:shadow-md active:scale-[0.98] transition-all"
            >
              <span className="text-lg text-blue-500">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* ── Main content ── */}
        <div className="grid grid-cols-12 gap-8 pb-10">
          <div className="col-span-12 xl:col-span-7 flex flex-col gap-8">
            <RecentOrders />
            <PopularDishes />
          </div>
          <div className="col-span-12 xl:col-span-5 flex flex-col gap-8">
            <OnlineOrders />
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
