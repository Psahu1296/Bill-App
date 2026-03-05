import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoMdClose } from "react-icons/io";
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

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onExpenseAdded,
}) => {
  const defaultExpenseData: ExpenseFormData = {
    type: "",
    name: "",
    amount: "",
    description: "",
    expenseDate: new Date().toISOString().split("T")[0],
  };

  const [expenseData, setExpenseData] =
    useState<ExpenseFormData>(defaultExpenseData);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setExpenseData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !expenseData.type ||
      !expenseData.name ||
      expenseData.amount === "" ||
      parseFloat(expenseData.amount) < 0
    ) {
      enqueueSnackbar("Please fill all required fields and ensure amount is valid.", {
        variant: "error",
      });
      return;
    }
    const dataToSend = {
      ...expenseData,
      amount: parseFloat(expenseData.amount),
      expenseDate: expenseData.expenseDate
        ? new Date(expenseData.expenseDate)
        : undefined,
    };
    expenseMutation.mutate(dataToSend);
  };

  const handleCloseModal = () => {
    setExpenseData(defaultExpenseData);
    onClose();
  };

  const expenseMutation = useMutation({
    mutationFn: (reqData: AddExpensePayload) => addExpense(reqData),
    onSuccess: (res) => {
      enqueueSnackbar(
        (res.data as { message?: string })?.message || "Expense added!",
        { variant: "success" }
      );
      handleCloseModal();
      onExpenseAdded?.();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(
        error.response?.data?.message || "Failed to add expense.",
        { variant: "error" }
      );
    },
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-[#262626] p-6 rounded-lg shadow-lg w-full max-w-lg mx-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[#f5f5f5] text-xl font-semibold">
                Add New Expense
              </h2>
              <button onClick={handleCloseModal} className="text-[#f5f5f5] hover:text-red-500">
                <IoMdClose size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">
                  Expense Type
                </label>
                <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
                  <select
                    name="type"
                    value={expenseData.type}
                    onChange={handleInputChange}
                    className="bg-transparent flex-1 text-white focus:outline-none appearance-none pr-8"
                    required
                  >
                    <option value="" disabled>Select Type</option>
                    {EXPENSE_TYPES.map((type) => (
                      <option key={type} value={type} className="bg-[#262626] text-white">
                        {type
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">
                  Name / Description
                </label>
                <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
                  <input
                    type="text"
                    name="name"
                    value={expenseData.name}
                    onChange={handleInputChange}
                    className="bg-transparent flex-1 text-white focus:outline-none"
                    placeholder="e.g., Potatoes, John Doe Salary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">
                  Amount
                </label>
                <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
                  <input
                    type="number"
                    name="amount"
                    value={expenseData.amount}
                    onChange={handleInputChange}
                    className="bg-transparent flex-1 text-white focus:outline-none"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">
                  Date
                </label>
                <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
                  <input
                    type="date"
                    name="expenseDate"
                    value={expenseData.expenseDate}
                    onChange={handleInputChange}
                    className="bg-transparent flex-1 text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">
                  Additional Notes (Optional)
                </label>
                <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
                  <textarea
                    name="description"
                    value={expenseData.description}
                    onChange={handleInputChange}
                    className="bg-transparent flex-1 text-white focus:outline-none resize-y"
                    rows={3}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={expenseMutation.isPending}
                className="w-full rounded-lg py-3 text-lg bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {expenseMutation.isPending ? "Adding Expense..." : "Add Expense"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddExpenseModal;
