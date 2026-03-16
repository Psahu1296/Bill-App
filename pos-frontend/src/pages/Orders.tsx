import React, { useState, useEffect, useMemo } from "react";
import BottomNav from "../components/shared/BottomNav";
import OrderCard from "../components/orders/OrderCard";
import BackButton from "../components/shared/BackButton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrders } from "../https/index";
import { enqueueSnackbar } from "notistack";
import type { Order } from "../types";

const statusFilters = ["all", "In Progress", "Ready", "Completed"];

const Orders: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { document.title = "Dhaba POS | Orders"; }, []);

  const { data: resData, isLoading, isError, error } = useQuery({
    queryKey: ["orders", selectedDate],
    queryFn: async () => getOrders({ startDate: selectedDate, endDate: selectedDate }),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError) enqueueSnackbar("Failed to load orders: " + (error as Error).message, { variant: "error" });
  }, [isError, error]);

  const orderList = useMemo<Order[]>(() => {
    const all: Order[] = resData?.data?.data ?? [];
    if (statusFilter === "all") return all;
    return all.filter((order) => order?.orderStatus === statusFilter);
  }, [statusFilter, resData]);

  return (
    <section className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-24">
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="font-display text-2xl font-bold text-dhaba-text">Orders</h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm font-medium focus:outline-none"
          />
          <div className="glass-card rounded-2xl p-1 flex gap-1">
            {statusFilters.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-sm rounded-xl px-4 py-2 font-semibold transition-all duration-200 ${
                  statusFilter === s
                    ? "bg-dhaba-accent/15 text-dhaba-accent shadow-glow"
                    : "text-dhaba-muted hover:text-dhaba-text hover:bg-dhaba-surface-hover"
                }`}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4 px-6 py-2 overflow-y-auto scrollbar-hide">
        {isLoading ? (
          <div className="flex flex-col items-center py-20 text-dhaba-muted">
            <div className="spinner mb-4" />
            <p>Loading orders for {selectedDate}...</p>
          </div>
        ) : orderList?.length > 0 ? (
          orderList.map((order) => <OrderCard key={order._id} order={order} type={statusFilter} />)
        ) : (
          <div className="flex flex-col items-center py-20 text-dhaba-muted">
            <span className="text-5xl mb-4">📋</span>
            <p className="font-semibold text-lg">No orders found</p>
            <p className="text-sm mt-1">for {selectedDate} with status "{statusFilter}"</p>
          </div>
        )}
      </div>

      <BottomNav />
    </section>
  );
};

export default Orders;
