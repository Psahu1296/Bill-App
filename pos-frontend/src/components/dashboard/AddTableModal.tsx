import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes } from "react-icons/fa";
import { MdTableRestaurant } from "react-icons/md";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addTable, getTables } from "../../https";
import { enqueueSnackbar } from "notistack";
import type { Table } from "../../types";

interface AddTableModalProps {
  setIsTableModalOpen: () => void;
}

const AddTableModal: React.FC<AddTableModalProps> = ({ setIsTableModalOpen }) => {
  const queryClient = useQueryClient();
  const [tableData, setTableData] = useState({ tableNo: "", seats: "4" });

  const { data: tablesRes } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  // Auto-fill next table number whenever existing tables load
  useEffect(() => {
    const tables: Table[] = tablesRes?.data?.data ?? [];
    if (tables.length > 0) {
      const maxNo = Math.max(...tables.map((t) => Number(t.tableNo)));
      setTableData((prev) => ({ ...prev, tableNo: String(maxNo + 1) }));
    } else {
      setTableData((prev) => ({ ...prev, tableNo: "1" }));
    }
  }, [tablesRes]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTableData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    tableMutation.mutate(tableData);
  };

  const tableMutation = useMutation({
    mutationFn: (reqData: { tableNo: string; seats: string }) => addTable(reqData),
    onSuccess: (res) => {
      enqueueSnackbar((res.data as { message: string }).message, { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setIsTableModalOpen();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(error.response?.data?.message ?? "Error adding table.", { variant: "error" });
    },
  });

  const inputClass =
    "w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50";
  const labelClass = "block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="glass-card w-full max-w-sm rounded-3xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-dhaba-border/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-dhaba-accent/10 flex items-center justify-center">
                <MdTableRestaurant className="text-dhaba-accent text-xl" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-dhaba-text">Add Table</h2>
                <p className="text-xs text-dhaba-muted">
                  {(tablesRes?.data?.data as Table[])?.length
                    ? `${(tablesRes?.data?.data as Table[]).length} table(s) exist — next suggested below`
                    : "No tables yet — starting from 1"}
                </p>
              </div>
            </div>
            <button
              onClick={setIsTableModalOpen}
              className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group"
            >
              <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" />
            </button>
          </div>

          {/* Body */}
          <form id="table-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label className={labelClass}>Table Number *</label>
              <input
                type="number"
                name="tableNo"
                value={tableData.tableNo}
                onChange={handleInputChange}
                required
                min="1"
                className={inputClass}
                placeholder="e.g. 1"
              />
            </div>
            <div>
              <label className={labelClass}>Number of Seats *</label>
              <input
                type="number"
                name="seats"
                value={tableData.seats}
                onChange={handleInputChange}
                required
                min="1"
                className={inputClass}
                placeholder="e.g. 4"
              />
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 bg-dhaba-surface/30 border-t border-dhaba-border/20 flex gap-3 justify-end">
            <button
              type="button"
              onClick={setIsTableModalOpen}
              className="px-6 py-2.5 rounded-xl text-dhaba-muted font-bold text-sm hover:text-dhaba-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="table-form"
              disabled={tableMutation.isPending}
              className="bg-gradient-warm text-dhaba-bg px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {tableMutation.isPending && (
                <div className="h-4 w-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
              )}
              {tableMutation.isPending ? "Adding..." : "Add Table"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AddTableModal;
