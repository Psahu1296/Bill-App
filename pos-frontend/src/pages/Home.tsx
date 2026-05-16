import React, { useState, useEffect, useMemo } from "react";
import BottomNav from "../components/shared/BottomNav";
import Greetings from "../components/home/Greetings";
import RecentOrders from "../components/home/RecentOrders";
import OnlineOrders from "../components/home/OnlineOrders";
import NewOrderModal from "../components/home/NewOrderModal";
import QuickConsumableModal from "../components/home/QuickConsumableModal";
import { getDailyEarnings, getOrders, getAllExpenses, getDishRequests, getPreOrders } from "../https";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { enqueueSnackbar } from "notistack";
import {
  FaPlus, FaArrowUp, FaArrowDown,
  FaHourglassHalf, FaCheckCircle, FaExclamationCircle,
  FaBoxOpen, FaCoffee, FaClipboardList,
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
  const earningPct = earningsData?.percentageChange ?? 0;
  const todayExpenses = Math.floor(Number((todayExpensesRes?.data as { total?: number })?.total ?? 0));

  const todayOrders: Order[] = useMemo(() => (todayOrdersRes?.data?.data as Order[]) ?? [], [todayOrdersRes]);
  const yesterdayOrders: Order[] = useMemo(() => (yesterdayOrdersRes?.data?.data as Order[]) ?? [], [yesterdayOrdersRes]);

  // Derived from live order data — stays in sync with Orders page (no DailyEarning cache lag)
  const earnings = useMemo(
    () => Math.floor(todayOrders.reduce((s, o) => s + (o.amountPaid || 0), 0)),
    [todayOrders]
  );
  const netEarnings = earnings - todayExpenses;

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

  const { data: pendingDishRes } = useQuery({
    queryKey: ["dish-requests", "pending"],
    queryFn: () => getDishRequests({ status: "pending" }),
    staleTime: 2 * 60_000,
  });
  const { data: pendingPreOrderRes } = useQuery({
    queryKey: ["pre-orders", "pending"],
    queryFn: () => getPreOrders({ status: "pending" }),
    staleTime: 2 * 60_000,
  });

  const pendingDish     = ((pendingDishRes?.data as { data?: unknown[] })?.data ?? []).length;
  const pendingPreOrder = ((pendingPreOrderRes?.data as { data?: unknown[] })?.data ?? []).length;
  const totalPending    = pendingDish + pendingPreOrder;

  // Badge tooltip: e.g. "3 dish · 2 bookings"
  const requestsBadgeTitle = [
    pendingDish     > 0 ? `${pendingDish} dish`     : "",
    pendingPreOrder > 0 ? `${pendingPreOrder} booking${pendingPreOrder > 1 ? "s" : ""}` : "",
  ].filter(Boolean).join(" · ");

  const quickActions = [
    { label: "Inventory", icon: <FaBoxOpen />, path: "/inventory", badge: 0, badgeTitle: "" },
  ];

  return (
    <section className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-24 overflow-y-auto relative">
      {/* Ambient Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] z-0 pointer-events-none" />
      <div className="fixed top-[20%] right-[-10%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[100px] z-0 pointer-events-none" />

      <div className="relative z-10 px-4 sm:px-6 md:px-8 pt-8 space-y-8 max-w-[1600px] mx-auto w-full">

        {/* ── Greeting ── */}
        <Greetings />

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map(({ label, value, icon, pct, color, iconBg, pulse }) => (
            <div key={label} className="glass-card rounded-[1.5rem] p-5 space-y-3 border border-dhaba-border/20 relative overflow-hidden">
              
              {/* Premium Static Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${iconBg.replace('/15', '/10')} opacity-50 pointer-events-none`} />
              
              <div className="relative z-10 flex items-center justify-between">
                <p className="text-dhaba-muted text-[11px] font-bold uppercase tracking-wider">{label}</p>
                <div className={`h-10 w-10 rounded-xl ${iconBg} ${color} flex items-center justify-center text-lg shadow-sm border border-white/5 ${pulse ? "animate-pulse ring-2 ring-current ring-offset-2 ring-offset-dhaba-bg" : ""}`}>
                  {icon}
                </div>
              </div>
              
              <div className="relative z-10 flex justify-between items-end">
                <p className={`font-display text-4xl font-extrabold tracking-tight ${color}`}>{value}</p>
              </div>
              
              {label === "Today's Revenue" && (
                <div className="relative z-10 flex items-center gap-2 flex-wrap pt-1">
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-dhaba-danger/10 text-dhaba-danger text-xs font-bold border border-dhaba-danger/20">
                    <FaArrowDown className="text-[10px]" />
                    Exp: ₹{todayExpenses.toLocaleString("en-IN")}
                  </span>
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${netEarnings >= 0 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}>
                    Net: ₹{netEarnings.toLocaleString("en-IN")}
                  </span>
                </div>
              )}
              
              {pct !== null && label !== "Today's Revenue" && (
                <div className="relative z-10 flex items-center gap-2 pt-1">
                  <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border
                    ${pct >= 0 ? "bg-dhaba-success/10 text-dhaba-success border-dhaba-success/20" : "bg-dhaba-danger/10 text-dhaba-danger border-dhaba-danger/20"}`}>
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

          {quickActions.map(({ label, icon, path, badge, badgeTitle }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="relative flex items-center gap-2.5 px-6 py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex-1 justify-center hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.98] transition-all border border-blue-400/20"
            >
              <span className="text-lg opacity-90">{icon}</span>
              {label}
              {badge > 0 && (
                <span
                  title={badgeTitle}
                  className="absolute -top-2 -right-2 min-w-[1.375rem] h-[1.375rem] px-1.5 rounded-full bg-dhaba-warning text-dhaba-bg text-[10px] font-extrabold flex items-center justify-center shadow-md ring-2 ring-dhaba-bg animate-pulse"
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          ))}

          {/* ── Ultra Premium Requests Button ── */}
          <button
            onClick={() => navigate("/requests")}
            className={`group relative flex items-center justify-between px-5 py-3 rounded-[1.5rem] flex-1 transition-all duration-500 overflow-hidden active:scale-95 ${
              pendingPreOrder > 0 || pendingDish > 0
                ? "border-none shadow-[0_0_50px_-10px_rgba(59,130,246,0.5)] hover:shadow-[0_0_65px_-5px_rgba(59,130,246,0.7)] hover:-translate-y-1 bg-[#0f172a]"
                : "glass-card text-dhaba-text hover:bg-dhaba-surface border border-dhaba-border/20 hover:shadow-md"
            }`}
          >
            {/* 1) Spinning Edge Glow Border */}
            {(pendingPreOrder > 0 || pendingDish > 0) && (
              <div 
                className="absolute inset-[-150%] animate-spin z-0 pointer-events-none" 
                style={{ 
                  animationDuration: '4s', 
                  background: 'conic-gradient(from 180deg at 50% 50%, #3b82f6 0deg, #a855f7 180deg, transparent 360deg)' 
                }} 
              />
            )}
            
            {/* 2) Inner Dark Mask (Leaves a 2px gap showing the spinning edge) */}
            {(pendingPreOrder > 0 || pendingDish > 0) && (
              <div className="absolute inset-[2px] bg-[#0c111d] rounded-[1.4rem] z-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] pointer-events-none" />
            )}

            {/* 3) Ambient Background Orb */}
            {(pendingPreOrder > 0 || pendingDish > 0) && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-[30px] z-0 animate-pulse pointer-events-none" />
            )}

            {/* 4) Main Content Container */}
            <div className={`relative z-10 flex items-center justify-between w-full h-full gap-2 ${pendingPreOrder === 0 && pendingDish === 0 ? "justify-center" : ""}`}>
              
              {/* Left Side: Icon & Title */}
              <div className="flex items-center gap-3">
                <div className={`relative flex items-center justify-center w-12 h-12 rounded-[1rem] transition-all duration-300 ${pendingPreOrder > 0 || pendingDish > 0 ? "bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 shadow-inner" : "bg-blue-500/10 text-blue-500"}`}>
                  <FaClipboardList className={`text-xl ${pendingPreOrder > 0 || pendingDish > 0 ? "text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]" : ""}`} />
                  
                  {/* Ping Dot on Icon */}
                  {(pendingPreOrder > 0 || pendingDish > 0) && (
                     <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0c111d] animate-bounce shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                  )}
                </div>
                
                <div className="flex flex-col items-start text-left">
                  <span className={`text-sm md:text-base font-black tracking-wide ${pendingPreOrder > 0 || pendingDish > 0 ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400" : "text-dhaba-text"}`}>
                    Requests
                  </span>
                  {(pendingPreOrder > 0 || pendingDish > 0) ? (
                    <span className="text-[9px] md:text-[10px] font-bold text-white/50 uppercase tracking-[0.2em] mt-0.5">
                      New Action
                    </span>
                  ) : (
                    <span className="text-[10px] text-dhaba-muted uppercase tracking-widest mt-0.5">Manage</span>
                  )}
                </div>
              </div>

              {/* Right Side: Data Counter Badges */}
              {(pendingPreOrder > 0 || pendingDish > 0) && (
                <div className="flex flex-col gap-1.5 shrink-0 py-1">
                  
                  {/* Pre-Orders Counter */}
                  {pendingPreOrder > 0 && (
                    <div className="group/badge relative flex items-center justify-between gap-3 bg-[#1e293b]/80 px-2.5 py-1.5 rounded-xl border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.3)] backdrop-blur-md overflow-hidden min-w-[100px]">
                       <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-transparent opacity-0 group-hover/badge:opacity-100 transition-opacity" />
                       <span className="relative z-10 text-white text-[10px] md:text-[11px] font-black tracking-widest uppercase">Bookings</span>
                       <span className="relative z-10 flex items-center justify-center bg-blue-500 text-white min-w-[20px] h-5 px-1.5 rounded text-[10px] md:text-xs font-black shadow-[0_0_10px_rgba(59,130,246,0.8)] border border-blue-400/50">
                         {pendingPreOrder}
                       </span>
                    </div>
                  )}
                  
                  {/* Dishes Counter */}
                  {pendingDish > 0 && (
                    <div className="flex items-center justify-between gap-3 bg-[#1e293b]/60 px-2.5 py-1 rounded-xl border border-white/5 backdrop-blur-sm min-w-[100px]">
                       <span className="text-white/60 text-[9px] md:text-[10px] font-bold tracking-widest uppercase">Dishes</span>
                       <span className="flex items-center justify-center bg-dhaba-warning/15 text-dhaba-warning min-w-[18px] h-4 px-1 rounded text-[9px] md:text-[10px] font-black border border-dhaba-warning/20">
                         {pendingDish}
                       </span>
                    </div>
                  )}
                  
                </div>
              )}
            </div>
          </button>
        </div>

        {/* ── Main content ── */}
        <div className="grid grid-cols-12 gap-8 pb-10 items-stretch">
          <div className="col-span-12 xl:col-span-7 flex flex-col h-full">
            <RecentOrders />
          </div>
          <div className="col-span-12 xl:col-span-5 flex flex-col h-full">
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
