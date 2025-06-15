import React, { useState, useEffect, useMemo } from "react";
import BottomNav from "../components/shared/BottomNav";
import OrderCard from "../components/orders/OrderCard";
import BackButton from "../components/shared/BackButton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrders } from "../https/index";
import { enqueueSnackbar } from "notistack";

const Orders = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  // Initialize to today's date in YYYY-MM-DD format for the input
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);


  useEffect(() => {
    document.title = "POS | Orders";
  }, []);

  // Use useQuery with the date in the queryKey
  const { data: resData, isLoading, isError, error } = useQuery({
    queryKey: ["orders", selectedDate],
    queryFn: async () =>  getOrders({ startDate: selectedDate, endDate: selectedDate }),
    placeholderData: keepPreviousData,
  });

  if (isError) {
    // Ensuring enqueueSnackbar is only called once per error
    // (This pattern helps prevent infinite loops if refetches occur)
    // You might also use a separate error state for displaying on UI
    console.error("Error loading orders:", error);
    enqueueSnackbar("Failed to load orders: " + error.message, { variant: "error" });
  }

  // Filter orders by status AFTER they've been fetched for the selected date
  const orderList = useMemo(() => {
    if (!resData?.data.data) return []; // Ensure resData.data exists
    
    const ordersForSelectedDate = resData.data.data;

    if (statusFilter === "all") {
      return ordersForSelectedDate;
    } else {
      return ordersForSelectedDate.filter((order) => order?.orderStatus === statusFilter);
    }
  }, [statusFilter, resData]);

  return (
    // Main section background and overall height
    <section className="bg-[#1f1f1f] flex flex-col h-[calc(100vh-5rem)] overflow-hidden">
      <div className="flex items-center justify-between px-10 py-4">
        <div className="flex items-center gap-4">
          <BackButton /> {/* Assuming BackButton aligns with the theme */}
          <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
            Orders
          </h1>
        </div>
        <div className="flex items-center justify-around gap-4">
          {/* Date Selector */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            // Apply theme colors for background, text, border, and focus
            className="bg-[#383838] text-[#f5f5f5] px-4 py-2 rounded-lg font-semibold 
                       border border-transparent focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />

          {/* Status Filters - Buttons */}
          {/* Apply consistent active/inactive states with theme colors */}
          <button
            onClick={() => setStatusFilter("all")}
            className={`text-[#ababab] text-lg rounded-lg px-5 py-2 font-semibold transition-colors duration-200
              ${statusFilter === "all" ? "bg-[#383838] text-[#f5f5f5]" : "hover:bg-[#262626]"}
            `}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter("In Progress")}
            className={`text-[#ababab] text-lg rounded-lg px-5 py-2 font-semibold transition-colors duration-200
              ${statusFilter === "In Progress" ? "bg-[#383838] text-[#f5f5f5]" : "hover:bg-[#262626]"}
            `}
          >
            In Progress
          </button>
          <button
            onClick={() => setStatusFilter("Ready")}
            className={`text-[#ababab] text-lg rounded-lg px-5 py-2 font-semibold transition-colors duration-200
              ${statusFilter === "Ready" ? "bg-[#383838] text-[#f5f5f5]" : "hover:bg-[#262626]"}
            `}
          >
            Ready
          </button>
          <button
            onClick={() => setStatusFilter("Completed")}
            className={`text-[#ababab] text-lg rounded-lg px-5 py-2 font-semibold transition-colors duration-200
              ${statusFilter === "Completed" ? "bg-[#383838] text-[#f5f5f5]" : "hover:bg-[#262626]"}
            `}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Orders List Container - Flex-1 to take remaining height, scrollable */}
      <div className="flex flex-1 flex-wrap justify-center gap-3 px-16 py-4 pb-12 overflow-y-scroll scrollbar-hide">
        {isLoading ? (
          <p className="flex-1 text-gray-400 text-center text-lg">Loading orders for {selectedDate}...</p>
        ) : orderList?.length > 0 ? (
          orderList.map((order) => {
            return <OrderCard key={order._id} order={order} type={statusFilter}/>;
          })
        ) : (
          <p className="flex-1 text-gray-400 text-center text-lg">No orders available for {selectedDate} with status "{statusFilter}".</p>
        )}
      </div>

      <BottomNav /> {/* Assuming BottomNav aligns with the theme */}
    </section>
  );
};

export default Orders;