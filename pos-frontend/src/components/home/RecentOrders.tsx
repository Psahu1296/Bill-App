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
    <div className="glass-card rounded-3xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-dhaba-border/20">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-dhaba-text">Live Orders</h2>
          {totalActive > 0 && (
            <span className="h-5 w-5 rounded-full bg-dhaba-accent text-dhaba-bg text-[10px] font-bold flex items-center justify-center animate-pulse">
              {totalActive}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate("/orders")}
          className="flex items-center gap-1.5 text-xs font-bold text-dhaba-accent hover:underline"
        >
          View all <FaExternalLinkAlt className="text-[9px]" />
        </button>
      </div>

      <div className="p-3 space-y-4 max-h-[420px] overflow-y-auto scrollbar-hide">
        {/* Ready section */}
        {readyOrders.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-dhaba-success shrink-0" />
              <p className="text-[10px] font-bold text-dhaba-success uppercase tracking-wider">
                Ready to Serve — {readyOrders.length}
              </p>
            </div>
            <div className="space-y-1">
              {readyOrders.map((o) => <OrderList key={o._id} order={o} />)}
            </div>
          </div>
        )}

        {/* In Progress section */}
        {inProgressOrders.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-dhaba-accent animate-pulse shrink-0" />
              <p className="text-[10px] font-bold text-dhaba-accent uppercase tracking-wider">
                In Progress — {inProgressOrders.length}
              </p>
            </div>
            <div className="space-y-1">
              {inProgressOrders.map((o) => <OrderList key={o._id} order={o} />)}
            </div>
          </div>
        )}

        {/* Empty */}
        {totalActive === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-dhaba-muted">
            <FaCheckDouble className="text-3xl mb-3 text-dhaba-success opacity-50" />
            <p className="font-semibold text-sm text-dhaba-text">All caught up!</p>
            <p className="text-xs mt-1">No active orders right now.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentOrders;
