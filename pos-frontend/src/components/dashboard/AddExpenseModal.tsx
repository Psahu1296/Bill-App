import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaReceipt } from "react-icons/fa";
import { useMutation } from "@tanstack/react-query";
import { addExpense } from "../../https";
import type { AddExpensePayload } from "../../types";
import { enqueueSnackbar } from "notistack";

const EXPENSE_TYPES = [
  "food_raw_material",
  "labor_salary",
  "utility_bill",
  "rent",
  "marketing",
  "maintenance",
  "other",
];

interface ExpenseFormData {
  type: string;
  name: string;
  amount: string;
  description: string;
  expenseDate: string;
}

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseAdded?: () => void;
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ isOpen, onClose, onExpenseAdded }) => {
  const defaultExpenseData: ExpenseFormData = {
    type: "",
    name: "",
    amount: "",
    description: "",
    expenseDate: new Date().toISOString().split("T")[0],
  };

  const [expenseData, setExpenseData] = useState<ExpenseFormData>(defaultExpenseData);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setExpenseData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCloseModal = () => {
    setExpenseData(defaultExpenseData);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseData.type || !expenseData.name || expenseData.amount === "" || parseFloat(expenseData.amount) < 0) {
      enqueueSnackbar("Please fill all required fields and ensure amount is valid.", { variant: "error" });
      return;
    }
    expenseMutation.mutate({
      ...expenseData,
      amount: parseFloat(expenseData.amount),
      expenseDate: expenseData.expenseDate ? new Date(expenseData.expenseDate) : undefined,
    });
  };

  const expenseMutation = useMutation({
    mutationFn: (reqData: AddExpensePayload) => addExpense(reqData),
    onSuccess: (res) => {
      enqueueSnackbar((res.data as { message?: string })?.message || "Expense added!", { variant: "success" });
      handleCloseModal();
      onExpenseAdded?.();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(error.response?.data?.message || "Failed to add expense.", { variant: "error" });
    },
  });

  const inputClass =
    "w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50";
  const labelClass = "block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="glass-card w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-dhaba-border/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-dhaba-accent/10 flex items-center justify-center">
                  <FaReceipt className="text-dhaba-accent" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-dhaba-text">Add Expense</h2>
                  <p className="text-xs text-dhaba-muted">Record a new business expense</p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group"
              >
                <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" />
              </button>
            </div>

            {/* Body */}
            <form id="expense-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Type */}
              <div>
                <label className={labelClass}>Expense Type *</label>
                <select
                  name="type"
                  value={expenseData.type}
                  onChange={handleInputChange}
                  required
                  className={`${inputClass} appearance-none`}
                >
                  <option value="" disabled className="bg-dhaba-surface">Select type</option>
                  {EXPENSE_TYPES.map((type) => (
                    <option key={type} value={type} className="bg-dhaba-surface text-dhaba-text">
                      {type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              {/* Name */}
              <div>
                <label className={labelClass}>Name *</label>
                <input
                  type="text"
                  name="name"
                  value={expenseData.name}
                  onChange={handleInputChange}
                  required
                  className={inputClass}
                  placeholder="e.g. Potatoes, John Doe Salary"
                />
              </div>

              {/* Amount + Date row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Amount (₹) *</label>
                  <input
                    type="number"
                    name="amount"
                    value={expenseData.amount}
                    onChange={handleInputChange}
                    required
                    step="0.01"
                    min="0"
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelClass}>Date *</label>
                  <input
                    type="date"
                    name="expenseDate"
                    value={expenseData.expenseDate}
                    onChange={handleInputChange}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelClass}>
                  Notes <span className="normal-case text-dhaba-muted font-normal">(optional)</span>
                </label>
                <textarea
                  name="description"
                  value={expenseData.description}
                  onChange={handleInputChange}
                  rows={2}
                  className={`${inputClass} resize-none`}
                  placeholder="Any additional details..."
                />
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 bg-dhaba-surface/30 border-t border-dhaba-border/20 flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-6 py-2.5 rounded-xl text-dhaba-muted font-bold text-sm hover:text-dhaba-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="expense-form"
                disabled={expenseMutation.isPending}
                className="bg-gradient-warm text-dhaba-bg px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {expenseMutation.isPending && (
                  <div className="h-4 w-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
                )}
                {expenseMutation.isPending ? "Adding..." : "Add Expense"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddExpenseModal;
