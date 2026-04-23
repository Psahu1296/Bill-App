import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaPlus, FaSearch, FaReceipt, FaTrash, FaEdit, FaTimes } from "react-icons/fa";
import { FiRefreshCw } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import BackButton from "../components/shared/BackButton";
import AddExpenseModal from "../components/dashboard/AddExpenseModal";
import { getAllExpenses, updateExpense, deleteExpense } from "../https";
import type { Expense } from "../types";
import { getErrorMessage, getTodayISO } from "../utils";

const EXPENSE_TYPES = [
  "food_raw_material",
  "labor_salary",
  "utility_bill",
  "rent",
  "marketing",
  "maintenance",
  "other",
];

const TYPE_COLORS: Record<string, string> = {
  food_raw_material: "bg-dhaba-success/15 text-dhaba-success",
  labor_salary: "bg-dhaba-accent/15 text-dhaba-accent",
  utility_bill: "bg-yellow-500/15 text-yellow-400",
  rent: "bg-purple-500/15 text-purple-400",
  marketing: "bg-orange-500/15 text-orange-400",
  maintenance: "bg-dhaba-danger/15 text-dhaba-danger",
  other: "bg-dhaba-muted/15 text-dhaba-muted",
};

type Period = "today" | "week" | "month" | "year" | "all";

function getPeriodDates(period: Period): Record<string, string> {
  if (period === "all") return {};
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  if (period === "today") return { startDate: today, endDate: today };
  if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { startDate: start.toISOString().split("T")[0], endDate: today };
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: start.toISOString().split("T")[0], endDate: today };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  return { startDate: start.toISOString().split("T")[0], endDate: today };
}

function formatTypeLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function formatExpenseDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditExpenseModalProps {
  expense: Expense | null;
  onClose: () => void;
  onSaved: () => void;
}

const EditExpenseModal: React.FC<EditExpenseModalProps> = ({ expense, onClose, onSaved }) => {
  const [form, setForm] = useState({
    type: "",
    name: "",
    amount: "",
    description: "",
    expenseDate: getTodayISO(),
  });

  useEffect(() => {
    if (expense) {
      setForm({
        type: expense.type,
        name: expense.name,
        amount: String(expense.amount),
        description: expense.description ?? "",
        expenseDate: new Date(expense.expenseDate).toISOString().split("T")[0],
      });
    }
  }, [expense]);

  const mutation = useMutation({
    mutationFn: (updates: object) => updateExpense(expense!._id, updates),
    onSuccess: () => {
      enqueueSnackbar("Expense updated!", { variant: "success" });
      onSaved();
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(err.response?.data?.message ?? "Failed to update expense.", { variant: "error" });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.type || !form.name || !form.amount) {
      enqueueSnackbar("Please fill all required fields.", { variant: "error" });
      return;
    }
    mutation.mutate({
      type: form.type,
      name: form.name,
      amount: parseFloat(form.amount),
      description: form.description,
      expenseDate: form.expenseDate ? new Date(form.expenseDate) : undefined,
    });
  };

  const inputClass = "w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50";
  const labelClass = "block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5";

  return (
    <AnimatePresence>
      {expense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="glass-card w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-dhaba-border/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-dhaba-accent/10 flex items-center justify-center">
                  <FaEdit className="text-dhaba-accent" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-dhaba-text">Edit Expense</h2>
                  <p className="text-xs text-dhaba-muted">Update expense details</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group">
                <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" />
              </button>
            </div>

            <form id="edit-expense-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className={labelClass}>Expense Type *</label>
                <select name="type" value={form.type} onChange={handleChange} required className={`${inputClass} appearance-none`}>
                  <option value="" disabled className="bg-dhaba-surface">Select type</option>
                  {EXPENSE_TYPES.map(t => (
                    <option key={t} value={t} className="bg-dhaba-surface text-dhaba-text">{formatTypeLabel(t)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Name *</label>
                <input type="text" name="name" value={form.name} onChange={handleChange} required className={inputClass} placeholder="Expense name" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Amount (₹) *</label>
                  <input type="number" name="amount" value={form.amount} onChange={handleChange} required step="0.01" min="0" className={inputClass} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelClass}>Date *</label>
                  <input type="date" name="expenseDate" value={form.expenseDate} onChange={handleChange} required className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Notes <span className="normal-case text-dhaba-muted font-normal">(optional)</span></label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={2} className={`${inputClass} resize-none`} placeholder="Any additional details..." />
              </div>
            </form>

            <div className="px-6 py-4 bg-dhaba-surface/30 border-t border-dhaba-border/20 flex gap-3 justify-end">
              <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl text-dhaba-muted font-bold text-sm hover:text-dhaba-text transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                form="edit-expense-form"
                disabled={mutation.isPending}
                className="bg-gradient-warm text-dhaba-bg px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutation.isPending && <div className="h-4 w-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />}
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All" },
];

const Expenses: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | Expenses"; }, []);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [filterType, setFilterType] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAllExpenses(getPeriodDates(period));
      setExpenses(res.data?.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load expenses."));
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      enqueueSnackbar("Expense deleted.", { variant: "success" });
      setDeleteConfirmId(null);
      fetchExpenses();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(err.response?.data?.message ?? "Failed to delete.", { variant: "error" });
    },
  });

  const filtered = useMemo(() => expenses.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) &&
    (filterType === "all" || e.type === filterType)
  ), [expenses, search, filterType]);

  const totalAmount = useMemo(() => filtered.reduce((sum, e) => sum + e.amount, 0), [filtered]);
  const avgAmount = filtered.length ? Math.round(totalAmount / filtered.length) : 0;

  return (
    <div className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-8">
      <div className="container mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="font-display text-2xl font-bold text-dhaba-text">Expense Management</h1>
              <p className="text-sm text-dhaba-muted">
                {filtered.length} {filtered.length === 1 ? "entry" : "entries"} · ₹{totalAmount.toLocaleString("en-IN")} total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchExpenses}
              disabled={isLoading}
              className="p-2.5 rounded-xl glass-input text-dhaba-muted hover:text-dhaba-text transition-colors"
              title="Refresh"
            >
              <FiRefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-warm text-dhaba-bg px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all"
            >
              <FaPlus /> Add Expense
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-dhaba-danger/10 border border-dhaba-danger/30 text-dhaba-danger text-sm font-medium flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-dhaba-muted hover:text-dhaba-danger">✕</button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass-card rounded-2xl p-5">
            <p className="text-xs text-dhaba-muted font-bold uppercase tracking-wider mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-dhaba-danger">₹{totalAmount.toLocaleString("en-IN")}</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <p className="text-xs text-dhaba-muted font-bold uppercase tracking-wider mb-1">No. of Entries</p>
            <p className="text-2xl font-bold text-dhaba-text">{filtered.length}</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <p className="text-xs text-dhaba-muted font-bold uppercase tracking-wider mb-1">Avg per Entry</p>
            <p className="text-2xl font-bold text-dhaba-accent">
              {filtered.length ? `₹${avgAmount.toLocaleString("en-IN")}` : "—"}
            </p>
          </div>
        </div>

        {/* Period Filter */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="glass-card rounded-xl p-1 flex gap-1">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  period === p.key ? "bg-dhaba-accent/15 text-dhaba-accent" : "text-dhaba-muted hover:text-dhaba-text"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search + Type Filter */}
        <div className="flex items-start gap-4 mb-6 flex-wrap">
          <div className="glass-input flex items-center gap-3 rounded-xl px-4 py-2.5 flex-1 max-w-md">
            <FaSearch className="text-dhaba-muted text-sm flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent outline-none text-dhaba-text text-sm font-medium placeholder:text-dhaba-muted/50 flex-1"
            />
          </div>
          <div className="glass-card rounded-xl p-1 flex gap-1 flex-wrap">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                filterType === "all" ? "bg-dhaba-accent/15 text-dhaba-accent" : "text-dhaba-muted hover:text-dhaba-text"
              }`}
            >
              All
            </button>
            {EXPENSE_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  filterType === t ? "bg-dhaba-accent/15 text-dhaba-accent" : "text-dhaba-muted hover:text-dhaba-text"
                }`}
              >
                {formatTypeLabel(t)}
              </button>
            ))}
          </div>
        </div>

        {/* Expense List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 border-2 border-dhaba-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-16 w-16 rounded-2xl bg-dhaba-surface flex items-center justify-center">
              <FaReceipt className="text-dhaba-muted text-2xl" />
            </div>
            <p className="text-dhaba-muted text-sm font-medium">No expenses found</p>
            <p className="text-dhaba-muted/60 text-xs">Try a different period or filter</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map(expense => (
                <motion.div
                  key={expense._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="glass-card rounded-2xl px-5 py-4 flex items-center gap-4"
                >
                  {/* Icon */}
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[expense.type] ?? TYPE_COLORS.other}`}>
                    <FaReceipt className="text-sm" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold text-dhaba-text text-sm truncate">{expense.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${TYPE_COLORS[expense.type] ?? TYPE_COLORS.other}`}>
                        {formatTypeLabel(expense.type)}
                      </span>
                    </div>
                    {expense.description && (
                      <p className="text-xs text-dhaba-muted truncate">{expense.description}</p>
                    )}
                    <p className="text-[10px] text-dhaba-muted mt-0.5">{formatExpenseDate(expense.expenseDate)}</p>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-dhaba-danger">₹{expense.amount.toLocaleString("en-IN")}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditingExpense(expense)}
                      className="p-2 rounded-xl hover:bg-dhaba-accent/10 transition-colors group"
                      title="Edit"
                    >
                      <FaEdit className="text-dhaba-muted text-sm group-hover:text-dhaba-accent transition-colors" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(expense._id)}
                      className="p-2 rounded-xl hover:bg-dhaba-danger/10 transition-colors group"
                      title="Delete"
                    >
                      <FaTrash className="text-dhaba-muted text-sm group-hover:text-dhaba-danger transition-colors" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onExpenseAdded={fetchExpenses}
      />

      {/* Edit Expense Modal */}
      <EditExpenseModal
        expense={editingExpense}
        onClose={() => setEditingExpense(null)}
        onSaved={fetchExpenses}
      />

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card rounded-2xl p-6 w-full max-w-sm shadow-glow"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto bg-dhaba-danger/15">
                <FaTrash className="text-dhaba-danger text-xl" />
              </div>
              <h2 className="font-display text-lg font-bold text-dhaba-text text-center mb-1">Delete Expense?</h2>
              <p className="text-dhaba-muted text-sm text-center mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 glass-card rounded-xl py-2.5 text-sm text-dhaba-muted hover:bg-dhaba-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirmId!)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-dhaba-danger/90 hover:bg-dhaba-danger text-white transition-colors disabled:opacity-60"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Expenses;
