import React, { useState, useEffect, useMemo } from "react";
import BottomNav from "../components/shared/BottomNav";
import OrderCard from "../components/orders/OrderCard";
import BackButton from "../components/shared/BackButton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrders } from "../https/index";
import { enqueueSnackbar } from "notistack";
import type { Order } from "../types";

const Orders: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    document.title = "POS | Orders";
  }, []);

  const { data: resData, isLoading, isError, error } = useQuery({
    queryKey: ["orders", selectedDate],
    queryFn: async () =>
      getOrders({ startDate: selectedDate, endDate: selectedDate }),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError) {
      enqueueSnackbar(
        "Failed to load orders: " + (error as Error).message,
        { variant: "error" }
      );
    }
  }, [isError, error]);

  const orderList = useMemo<Order[]>(() => {
    const all: Order[] = resData?.data?.data ?? [];
    if (statusFilter === "all") return all;
    return all.filter((order) => order?.orderStatus === statusFilter);
  }, [statusFilter, resData]);

  return (
    <section className="bg-[#1f1f1f] flex flex-col h-[calc(100vh-5rem)] overflow-hidden">
      <div className="flex items-center justify-between px-10 py-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
            Orders
          </h1>
        </div>
        <div className="flex items-center justify-around gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#383838] text-[#f5f5f5] px-4 py-2 rounded-lg font-semibold border border-transparent focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          {["all", "In Progress", "Ready", "Completed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[#ababab] text-lg rounded-lg px-5 py-2 font-semibold transition-colors duration-200 ${
                statusFilter === s
                  ? "bg-[#383838] text-[#f5f5f5]"
                  : "hover:bg-[#262626]"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-wrap justify-center gap-3 px-16 py-4 pb-12 overflow-y-scroll scrollbar-hide">
        {isLoading ? (
          <p className="flex-1 text-gray-400 text-center text-lg">
            Loading orders for {selectedDate}...
          </p>
        ) : orderList?.length > 0 ? (
          orderList.map((order) => (
            <OrderCard key={order._id} order={order} type={statusFilter} />
          ))
        ) : (
          <p className="flex-1 text-gray-400 text-center text-lg">
            No orders available for {selectedDate} with status &quot;{statusFilter}&quot;.
          </p>
        )}
      </div>

      <BottomNav />
    </section>
  );
};

export default Orders;
