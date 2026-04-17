import React, { useCallback, useEffect, useState } from "react";
import { useSnackbar } from "notistack";
import {
  FaClipboardList, FaCheck, FaCalendarAlt, FaSpinner
} from "react-icons/fa";
import {
  getDishRequests, updateDishRequest, deleteDishRequest,
  getPreOrders, updatePreOrder, deletePreOrder,
} from "../https";
import type { DishRequest, PreOrder } from "../types";

import { DISH_STATUSES, PREORDER_STATUSES, dishStatusCfg, preOrderStatusCfg } from "../components/requests/RequestsHelpers";
import DishRequestCard from "../components/requests/DishRequestCard";
import PreOrderCard from "../components/requests/PreOrderCard";

const Requests: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | Requests"; }, []);
  const { enqueueSnackbar } = useSnackbar();

  const [activeTab, setActiveTab] = useState<"dish" | "preorder">("dish");
  const [dishFilter, setDishFilter] = useState("all");
  const [preOrderFilter, setPreOrderFilter] = useState("all");
  const [dishRequests, setDishRequests] = useState<DishRequest[]>([]);
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDishRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDishRequests(dishFilter !== "all" ? { status: dishFilter } : undefined);
      setDishRequests((res.data as { data: DishRequest[] }).data ?? []);
    } catch {
      enqueueSnackbar("Failed to load dish requests", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [dishFilter, enqueueSnackbar]);

  const fetchPreOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPreOrders(preOrderFilter !== "all" ? { status: preOrderFilter } : undefined);
      setPreOrders((res.data as { data: PreOrder[] }).data ?? []);
    } catch {
      enqueueSnackbar("Failed to load pre-orders", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [preOrderFilter, enqueueSnackbar]);

  useEffect(() => { if (activeTab === "dish") fetchDishRequests(); }, [activeTab, fetchDishRequests]);
  useEffect(() => { if (activeTab === "preorder") fetchPreOrders(); }, [activeTab, fetchPreOrders]);

  // ── Handlers ──

  async function handleSaveDish(id: string, status: string, adminNote: string) {
    try {
      await updateDishRequest(id, { status, adminNote });
      enqueueSnackbar("Dish request updated successfully", { variant: "success" });
      fetchDishRequests();
    } catch {
      enqueueSnackbar("Failed to update dish request", { variant: "error" });
    }
  }

  async function handleDeleteDish(id: string) {
    try {
      await deleteDishRequest(id);
      enqueueSnackbar("Dish request deleted", { variant: "success" });
      setDishRequests((prev) => prev.filter((d) => d._id !== id));
    } catch {
      enqueueSnackbar("Failed to delete dish request", { variant: "error" });
    }
  }

  async function handleUpdatePreOrder(
    id: string,
    data: { status?: string; adminNote?: string; estimatedAmount?: number; depositAmount?: number; depositPaid?: boolean; depositPaidAt?: string | null }
  ) {
    try {
      await updatePreOrder(id, data);
      enqueueSnackbar("Pre-order updated successfully", { variant: "success" });
      fetchPreOrders();
    } catch {
      enqueueSnackbar("Failed to update pre-order", { variant: "error" });
    }
  }

  async function handleDeletePreOrder(id: string) {
    try {
      await deletePreOrder(id);
      enqueueSnackbar("Pre-order deleted", { variant: "success" });
      setPreOrders((prev) => prev.filter((p) => p._id !== id));
    } catch {
      enqueueSnackbar("Failed to delete pre-order", { variant: "error" });
    }
  }

  // ── Summary counts ──
  const pendingDish = dishRequests.filter((d) => d.status === "pending").length;
  const pendingPreOrder = preOrders.filter((p) => p.status === "pending").length;
  const depositPaidCount = preOrders.filter((p) => p.depositPaid).length;

  return (
    <div className="bg-[#0f1115] min-h-[calc(100vh-4rem)] pb-24 text-white font-sans selection:bg-dhaba-accent/30 selection:text-white">
      {/* Background Ambience */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-dhaba-accent/10 via-[#1A1C23]/20 to-transparent pointer-events-none opacity-60 mix-blend-screen" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-dhaba-accent/20 rounded-full blur-[100px] pointer-events-none opacity-30" />
      <div className="absolute top-48 right-1/4 w-80 h-80 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none opacity-40" />

      <div className="px-6 sm:px-10 pt-8 space-y-10 max-w-[1600px] mx-auto relative z-10">
        {/* ── Page hero ── */}
        <div className="relative overflow-hidden rounded-[2rem] bg-black/40 backdrop-blur-xl border border-white/10 p-8 sm:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
          <div className="relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-dhaba-accent/20 to-dhaba-accent/5 ring-1 ring-dhaba-accent/30 text-dhaba-accent rounded-2xl mb-6 shadow-inner">
                <FaClipboardList className="text-xl" />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/60 mb-4">
                Customer Requests
              </h1>
              <p className="text-dhaba-muted text-lg md:text-xl font-medium leading-relaxed max-w-xl">
                Seamlessly review suggested dishes and manage advance food bookings from your patrons.
              </p>
            </div>

            {/* Summary Chips */}
            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              <div className="bg-dhaba-warning/10 border border-dhaba-warning/20 px-5 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-xl transition-transform hover:scale-105">
                <div className="w-2.5 h-2.5 rounded-full bg-dhaba-warning animate-pulse shadow-[0_0_10px_currentColor]" />
                <span className="text-white font-bold text-sm md:text-base">
                  {pendingDish} <span className="text-dhaba-muted font-normal text-sm ml-1">Dish Requests</span>
                </span>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 px-5 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-xl transition-transform hover:scale-105">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_10px_currentColor]" />
                <span className="text-white font-bold text-sm md:text-base">
                  {pendingPreOrder} <span className="text-dhaba-muted font-normal text-sm ml-1">Pre-Orders</span>
                </span>
              </div>
              {depositPaidCount > 0 && (
                <div className="bg-dhaba-success/15 border border-dhaba-success/30 px-5 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-[0_0_15px_rgba(34,197,94,0.1)] transition-transform hover:scale-105">
                  <FaCheck className="text-dhaba-success" />
                  <span className="text-white font-bold text-sm md:text-base">
                    {depositPaidCount} <span className="text-dhaba-success/80 font-normal text-sm ml-1">Paid Deposits</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Controls Row (Tabs + Filters) ── */}
        <div className="flex flex-col 2xl:flex-row items-center gap-6 justify-between bg-[#1A1C23]/60 p-3 rounded-[2rem] border border-white/5 backdrop-blur-xl shadow-xl">

          {/* Tabs Switcher */}
          <div className="flex w-full 2xl:w-auto bg-black/40 p-1.5 rounded-3xl border border-white/5 relative">
            {(["dish", "preorder"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 2xl:flex-none px-8 md:px-12 py-3.5 rounded-[1.25rem] text-sm md:text-base font-bold transition-all duration-300 relative z-10 ${activeTab === tab
                  ? "text-white"
                  : "text-dhaba-muted/80 hover:text-white hover:bg-white/5"
                  }`}
              >
                {/* Active Tab Background */}
                {activeTab === tab && (
                  <div className="absolute inset-0 bg-gradient-to-r from-dhaba-accent to-orange-500 rounded-[1.25rem] shadow-lg shadow-dhaba-accent/20 -z-10" />
                )}
                {tab === "dish" ? "Dish Requests" : "Pre-Orders"}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto w-full 2xl:w-auto pb-2 2xl:pb-0 px-2 2xl:px-4 hide-scrollbar">
            {activeTab === "dish" ? (
              <React.Fragment>
                <div className="flex items-center gap-2 pr-4 border-r border-white/10 shrink-0 hidden sm:flex">
                  <div className="w-1 h-4 bg-dhaba-muted/30 rounded-full" />
                  <span className="text-[11px] font-bold text-dhaba-muted/60 uppercase tracking-[0.2em]">Filter</span>
                </div>
                {["all", ...DISH_STATUSES].map((s) => (
                  <button
                    key={s}
                    onClick={() => setDishFilter(s)}
                    className={`px-5 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition-all whitespace-nowrap border shrink-0 ${dishFilter === s
                      ? "bg-white/15 text-white border-white/20 shadow-inner"
                      : "bg-transparent text-dhaba-muted border-transparent hover:bg-white/10 hover:text-white/90"
                      }`}
                  >
                    {s === "all" ? "All Requests" : dishStatusCfg[s].label}
                  </button>
                ))}
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div className="flex items-center gap-2 pr-4 border-r border-white/10 shrink-0 hidden sm:flex">
                  <div className="w-1 h-4 bg-dhaba-muted/30 rounded-full" />
                  <span className="text-[11px] font-bold text-dhaba-muted/60 uppercase tracking-[0.2em]">Filter</span>
                </div>
                {["all", ...PREORDER_STATUSES].map((s) => (
                  <button
                    key={s}
                    onClick={() => setPreOrderFilter(s)}
                    className={`px-5 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition-all whitespace-nowrap border shrink-0 ${preOrderFilter === s
                      ? "bg-white/15 text-white border-white/20 shadow-inner"
                      : "bg-transparent text-dhaba-muted border-transparent hover:bg-white/10 hover:text-white/90"
                      }`}
                  >
                    {s === "all" ? "All Orders" : preOrderStatusCfg[s].label}
                  </button>
                ))}
              </React.Fragment>
            )}
          </div>
        </div>

        {/* ── Content Grid ── */}
        <div className="min-h-[40vh] relative">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm rounded-[2rem] border border-white/5 z-20">
              <FaSpinner className="animate-spin text-5xl text-dhaba-accent mb-4 drop-shadow-[0_0_15px_currentColor]" />
              <p className="text-white/80 font-medium tracking-wide">Loading data...</p>
            </div>
          ) : activeTab === "dish" ? (
            dishRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 bg-[#1A1C23]/40 border border-white/5 rounded-[2rem] text-center space-y-5">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-2">
                  <FaClipboardList className="text-4xl text-white/20" />
                </div>
                <h3 className="text-2xl font-bold text-white/80">No Dish Requests Found</h3>
                <p className="text-dhaba-muted max-w-md">Try selecting a different filter or wait for customers to submit their suggestions.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                {dishRequests.map((item) => (
                  <DishRequestCard
                    key={item._id}
                    item={item}
                    onSave={handleSaveDish}
                    onDelete={handleDeleteDish}
                  />
                ))}
              </div>
            )
          ) : (
            preOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 bg-[#1A1C23]/40 border border-white/5 rounded-[2rem] text-center space-y-5">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-2">
                  <FaCalendarAlt className="text-4xl text-white/20" />
                </div>
                <h3 className="text-2xl font-bold text-white/80">No Pre-Orders Yet</h3>
                <p className="text-dhaba-muted max-w-md">No pre-orders match the current filter. Fresh advance bookings will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 lg:gap-8 items-start">
                {preOrders.map((item) => (
                  <PreOrderCard
                    key={item._id}
                    item={item}
                    onUpdate={handleUpdatePreOrder}
                    onDelete={handleDeletePreOrder}
                  />
                ))}
              </div>
            )
          )}
        </div>

      </div>
    </div>
  );
};

export default Requests;
