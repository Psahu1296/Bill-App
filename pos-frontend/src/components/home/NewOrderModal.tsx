import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaBolt } from "react-icons/fa";
import { MdTableRestaurant, MdChair } from "react-icons/md";
import { useQuery } from "@tanstack/react-query";
import { getTables } from "../../https";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../redux/hooks";
import { setCustomer, updateTable } from "../../redux/slices/customerSlice";
import { removeAllItems } from "../../redux/slices/cartSlice";
import type { Table } from "../../types";

interface NewOrderModalProps {
  onClose: () => void;
}

const NewOrderModal: React.FC<NewOrderModalProps> = ({ onClose }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { data: tablesRes, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  const allTables: Table[]  = tablesRes?.data?.data ?? [];
  const available           = allTables.filter((t) => t.status === "Available");

  const handlePick = (table: Table) => {
    dispatch(removeAllItems());
    dispatch(setCustomer({ name: "Driver", phone: "0000000000", guests: 1 }));
    dispatch(updateTable({ table: { tableId: table._id, tableNo: table.tableNo } }));
    navigate("/menu");
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="glass-card w-full max-w-md rounded-3xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-dhaba-border/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-dhaba-accent/10 flex items-center justify-center">
                <FaBolt className="text-dhaba-accent" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-dhaba-text">Quick Order</h2>
                <p className="text-xs text-dhaba-muted">
                  {isLoading ? "Loading…" : `${available.length} table${available.length !== 1 ? "s" : ""} available — tap to start`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group"
            >
              <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" />
            </button>
          </div>

          {/* Table grid */}
          <div className="p-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-dhaba-muted">
                <div className="h-4 w-4 border-2 border-dhaba-accent border-t-transparent rounded-full animate-spin" />
                Loading tables…
              </div>
            ) : available.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-dhaba-muted">
                <MdTableRestaurant className="text-4xl mb-3 opacity-30" />
                <p className="font-semibold text-dhaba-text">All tables are booked</p>
                <p className="text-sm mt-1">Free up a table first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {available.map((table) => (
                  <button
                    key={table._id}
                    onClick={() => handlePick(table)}
                    className="glass-input hover:bg-dhaba-accent/10 hover:border-dhaba-accent/40 border border-transparent
                      rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-150
                      hover:shadow-glow hover:-translate-y-0.5 group"
                  >
                    <MdTableRestaurant className="text-2xl text-dhaba-accent group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-dhaba-text text-base">Table {table.tableNo}</span>
                    <span className="flex items-center gap-1 text-[11px] text-dhaba-muted">
                      <MdChair className="text-xs" />{table.seats} seats
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <p className="text-center text-[11px] text-dhaba-muted pb-4 px-6">
            Customer defaults to <span className="font-semibold text-dhaba-text">Driver</span> — update name/phone on the menu page if needed.
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default NewOrderModal;
