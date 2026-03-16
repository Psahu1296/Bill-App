import React, { useEffect, useMemo } from "react";
import { FaSearch } from "react-icons/fa";
import OrderList from "./OrderList";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getOrders } from "../../https/index";
import type { Order } from "../../types";

const RecentOrders: React.FC = () => {
  const { data: resData, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => getOrders(),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError) enqueueSnackbar("Something went wrong!", { variant: "error" });
  }, [isError]);

  const onGoingOrders = useMemo<Order[]>(() => {
    const allOrders: Order[] = resData?.data?.data ?? [];
    return allOrders.filter((order) => order?.orderStatus === "In Progress");
  }, [resData?.data?.data]);

  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      <div className="flex justify-between items-center px-6 py-4 border-b border-dhaba-border/20">
        <h2 className="section-title text-dhaba-text">Recent Orders</h2>
        <a href="/orders" className="text-dhaba-accent text-xs font-bold tracking-wider uppercase hover:underline">
          View all →
        </a>
      </div>

      <div className="px-6 pt-4">
        <div className="glass-input rounded-xl flex items-center gap-3 px-4 py-2.5">
          <FaSearch className="text-dhaba-muted text-sm" />
          <input
            type="text"
            placeholder="Search recent orders..."
            className="bg-transparent outline-none text-dhaba-text text-sm flex-1 placeholder:text-dhaba-muted/50"
          />
        </div>
      </div>

      <div className="px-4 py-4 overflow-y-auto max-h-[380px] scrollbar-hide space-y-2">
        {onGoingOrders?.length > 0 ? (
          onGoingOrders.map((order) => <OrderList key={order._id} order={order} />)
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-dhaba-muted">
            <span className="text-4xl mb-3">🍽️</span>
            <p className="font-medium">No ongoing orders</p>
            <p className="text-xs mt-1">All caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentOrders;
