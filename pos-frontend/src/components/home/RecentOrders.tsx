import React, { useEffect, useMemo } from "react";
import OrderList from "./OrderList";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getOrders } from "../../https/index";
import { useNavigate } from "react-router-dom";
import { FaCheckDouble, FaExternalLinkAlt } from "react-icons/fa";
import type { Order } from "../../types";

const RecentOrders: React.FC = () => {
  const navigate = useNavigate();

  const { data: resData, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: () => getOrders(),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (isError) enqueueSnackbar("Something went wrong!", { variant: "error" });
  }, [isError]);

  const allOrders: Order[] = resData?.data?.data ?? [];
  const inProgressOrders = useMemo(() => allOrders.filter((o) => o.orderStatus === "In Progress"), [allOrders]);
  const readyOrders      = useMemo(() => allOrders.filter((o) => o.orderStatus === "Ready"),       [allOrders]);
  const totalActive      = inProgressOrders.length + readyOrders.length;

  return (
    <div className="glass-card rounded-[2rem] overflow-hidden min-h-[400px] flex flex-col h-full relative group border border-dhaba-border/20 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 relative z-10 bg-black/10">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tracking-wide">Live Orders</h2>
          {totalActive > 0 && (
            <span className="h-6 w-6 rounded-xl bg-dhaba-accent/20 border border-dhaba-accent/50 text-dhaba-accent text-[11px] font-black flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.2)]">
              {totalActive}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate("/orders")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all border border-white/5 hover:border-white/20"
        >
          View all <FaExternalLinkAlt className="text-[10px]" />
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto min-h-0 scrollbar-hide space-y-6 relative z-10">
        {/* Ready section */}
        {readyOrders.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="h-2 w-2 rounded-full bg-dhaba-success shadow-[0_0_8px_rgba(34,197,94,0.8)] shrink-0" />
              <p className="text-[10px] font-black text-dhaba-success/90 uppercase tracking-[0.2em]">
                Ready to Serve <span className="opacity-50">({readyOrders.length})</span>
              </p>
            </div>
            <div className="space-y-2.5">
              {readyOrders.map((o) => <OrderList key={o._id} order={o} />)}
            </div>
          </div>
        )}

        {/* In Progress section */}
        {inProgressOrders.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="h-2 w-2 rounded-full bg-dhaba-accent animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)] shrink-0" />
              <p className="text-[10px] font-black text-dhaba-accent/90 uppercase tracking-[0.2em]">
                In Progress <span className="opacity-50">({inProgressOrders.length})</span>
              </p>
            </div>
            <div className="space-y-2.5">
              {inProgressOrders.map((o) => <OrderList key={o._id} order={o} />)}
            </div>
          </div>
        )}

        {/* Empty */}
        {totalActive === 0 && (
          <div className="flex flex-col items-center justify-center py-16 h-full text-dhaba-muted">
            <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 shadow-inner flex items-center justify-center mb-4">
              <FaCheckDouble className="text-2xl text-dhaba-success/40" />
            </div>
            <p className="font-display text-lg font-black text-white/70 tracking-wide">All caught up!</p>
            <p className="text-xs font-bold text-white/30 uppercase tracking-widest mt-1">No active orders</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentOrders;
