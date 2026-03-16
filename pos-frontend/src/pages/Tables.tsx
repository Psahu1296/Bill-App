import React, { useState, useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import TableCard from "../components/tables/TableCard";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getTables } from "../https";
import { enqueueSnackbar } from "notistack";
import type { Table } from "../types";

const Tables: React.FC = () => {
  const [status, setStatus] = useState("all");

  useEffect(() => { document.title = "Dhaba POS | Tables"; }, []);

  const { data: resData, isError } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => getTables(),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError) enqueueSnackbar("Something went wrong!", { variant: "error" });
  }, [isError]);

  const tables: Table[] = resData?.data?.data ?? [];

  return (
    <section className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-24">
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="font-display text-2xl font-bold text-dhaba-text">Tables</h1>
        </div>
        <div className="glass-card rounded-2xl p-1 flex gap-1">
          {["all", "booked"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-sm rounded-xl px-5 py-2 font-semibold transition-all duration-200 ${
                status === s
                  ? "bg-dhaba-accent/15 text-dhaba-accent shadow-glow"
                  : "text-dhaba-muted hover:text-dhaba-text hover:bg-dhaba-surface-hover"
              }`}
            >
              {s === "all" ? "All" : "Booked"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-6 py-2">
        {tables.map((table) => (
          <TableCard
            key={table._id}
            id={table._id}
            name={table.tableNo}
            status={table.status}
            initials={table?.currentOrder?.customerDetails.name}
            orderId={table?.currentOrder?._id}
            seats={table.seats}
          />
        ))}
      </div>

      <BottomNav />
    </section>
  );
};

export default Tables;
