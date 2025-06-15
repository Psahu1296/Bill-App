import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion"; // Make sure AnimatePresence is imported
import { IoMdClose } from "react-icons/io";
import { useMutation } from "@tanstack/react-query";
import { addExpense } from "../../https"; // Adjust the import path for addExpense API function
import { enqueueSnackbar } from "notistack";

// Define your expense types based on models/expenseModel.js enum
const EXPENSE_TYPES = [
  "food_raw_material",
  "labor_salary",
  "utility_bill",
  "rent",
  "marketing",
  "maintenance",
  "other",
];

const AddExpenseModal = ({ isOpen, onClose, onExpenseAdded }) => {
  const [expenseData, setExpenseData] = useState({
    type: "", // Will be selected from dropdown
    name: "",
    amount: "", // Store as string initially from input
    description: "", // Optional
    expenseDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format for input
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setExpenseData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Basic client-side validation
    if (!expenseData.type || !expenseData.name || expenseData.amount === "" || parseFloat(expenseData.amount) < 0) {
      enqueueSnackbar("Please fill all required fields and ensure amount is valid.", { variant: "error" });
      return;
    }

    const dataToSend = {
      ...expenseData,
      amount: parseFloat(expenseData.amount), // Convert amount to number
      expenseDate: expenseData.expenseDate ? new Date(expenseData.expenseDate) : undefined, // Convert date string to Date object
    };
    expenseMutation.mutate(dataToSend);
  };

  const handleCloseModal = () => {
    // Reset form when closing
    setExpenseData({
      type: "",
      name: "",
      amount: "",
      description: "",
      expenseDate: new Date().toISOString().split('T')[0],
    });
    onClose(); // Call the parent's onClose prop
  };

  const expenseMutation = useMutation({
    mutationFn: (reqData) => addExpense(reqData),
    onSuccess: (res) => {
      enqueueSnackbar(res.message || "Expense added successfully!", { variant: "success" });
      handleCloseModal(); // Reset form and close modal
      onExpenseAdded && onExpenseAdded(); // Trigger optional callback for parent
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || "Failed to add expense. Please try again.";
      enqueueSnackbar(errorMessage, { variant: "error" });
      console.error("Add Expense Error:", error);
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
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[#f5f5f5] text-xl font-semibold">Add New Expense</h2>
              <button
                onClick={handleCloseModal}
                className="text-[#f5f5f5] hover:text-red-500"
              >
                <IoMdClose size={24} />
              </button>
            </div>

            {/* Modal Body - Form */}
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Expense Type */}
              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">Expense Type</label>
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
                        {type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">Name / Description</label>
                <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
                  <input
                    type="text"
                    name="name"
                    value={expenseData.name}
                    onChange={handleInputChange}
                    className="bg-transparent flex-1 text-white focus:outline-none"
                    placeholder="e.g., Potatoes, John Doe Salary, Electricity Bill"
                    required
                  />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">Amount</label>
                <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
                  <input
                    type="number"
                    name="amount"
                    value={expenseData.amount}
                    onChange={handleInputChange}
                    className="bg-transparent flex-1 text-white focus:outline-none"
                    step="0.01" // Allow decimal amounts
                    required
                  />
                </div>
              </div>

              {/* Expense Date */}
              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">Date</label>
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

              {/* Description (Optional) */}
              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">Additional Notes (Optional)</label>
                <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
                  <textarea
                    name="description"
                    value={expenseData.description}
                    onChange={handleInputChange}
                    className="bg-transparent flex-1 text-white focus:outline-none resize-y"
                    rows="3"
                  ></textarea>
                </div>
              </div>

              <button
                type="submit"
                disabled={expenseMutation.isPending}
                className="w-full rounded-lg py-3 text-lg bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {expenseMutation.isPending ? 'Adding Expense...' : 'Add Expense'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddExpenseModal;