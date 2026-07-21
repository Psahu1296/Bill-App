import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FaPlus, FaSearch, FaReceipt, FaTrash, FaEdit, FaTimes,
  FaCheck, FaPencilAlt, FaChevronDown,
} from "react-icons/fa";
import { FiRefreshCw, FiCalendar, FiFolder, FiList } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import BackButton from "../components/shared/BackButton";
import BottomNav from "../components/shared/BottomNav";
import {
  getAllExpenses, updateExpense, deleteExpense,
  getExpensePresets, createExpensePreset, deleteExpensePreset,
  addExpense, getAllStaff, addStaffPayment,
} from "../https";
import type { Expense, ExpensePreset, StaffMember } from "../types";
import { getErrorMessage, getTodayISO } from "../utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPENSE_TYPES = [
  "food_raw_material", "labor_salary", "utility_bill",
  "rent", "marketing", "maintenance", "other",
];

const UNIT_MAPPING: Record<string, string> = {
  fish: "kg",
  chicken: "kg",
  meat: "kg",
  paneer: "kg",
  milk: "Ltr",
  oil: "Ltr",
  gutka: "packet",
  masala: "packet",
  bread: "packet",
  egg: "piece",
  eggs: "piece",
};

const guessUnit = (name: string): string => {
  const lowerName = name.toLowerCase();
  for (const [key, unit] of Object.entries(UNIT_MAPPING)) {
    if (lowerName.includes(key)) return unit;
  }
  return "";
};

const PRESET_CATEGORIES = ["Raw Material", "Staff", "Utilities", "Other"];

const CATEGORY_TO_TYPE: Record<string, string> = {
  "Raw Material": "food_raw_material",
  "Staff":        "labor_salary",
  "Utilities":    "utility_bill",
  "Other":        "other",
};

const TYPE_COLORS: Record<string, string> = {
  food_raw_material: "bg-dhaba-success/15 text-dhaba-success",
  labor_salary:      "bg-dhaba-accent/15 text-dhaba-accent",
  utility_bill:      "bg-yellow-500/15 text-yellow-400",
  rent:              "bg-purple-500/15 text-purple-400",
  marketing:         "bg-orange-500/15 text-orange-400",
  maintenance:       "bg-dhaba-danger/15 text-dhaba-danger",
  other:             "bg-dhaba-muted/15 text-dhaba-muted",
};

type Period = "today" | "week" | "month" | "year" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week",  label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year",  label: "This Year" },
  { key: "all",   label: "All" },
];

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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Edit Expense Modal ────────────────────────────────────────────────────────

interface EditExpenseModalProps {
  expense: Expense | null;
  onClose: () => void;
  onSaved: () => void;
}

const EditExpenseModal: React.FC<EditExpenseModalProps> = ({ expense, onClose, onSaved }) => {
  const [form, setForm] = useState({ type: "", name: "", amount: "", quantity: "", unit: "", description: "", expenseDate: getTodayISO() });

  useEffect(() => {
    if (expense) {
      setForm({
        type:        expense.type,
        name:        expense.name,
        amount:      String(expense.amount),
        quantity:    expense.quantity ? String(expense.quantity) : "",
        unit:        expense.unit ?? "",
        description: expense.description ?? "",
        expenseDate: new Date(expense.expenseDate).toISOString().split("T")[0],
      });
    }
  }, [expense]);

  const mutation = useMutation({
    mutationFn: (updates: object) => updateExpense(expense!._id, updates),
    onSuccess: () => { enqueueSnackbar("Expense updated!", { variant: "success" }); onSaved(); onClose(); },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(err.response?.data?.message ?? "Failed to update expense.", { variant: "error" });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(f => {
      const updated = { ...f, [name]: value };
      if (name === "name" && !f.unit) {
        const guessed = guessUnit(value);
        if (guessed) updated.unit = guessed;
      }
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.type || !form.name || !form.amount) { enqueueSnackbar("Fill all required fields.", { variant: "error" }); return; }
    mutation.mutate({ 
      type: form.type, 
      name: form.name, 
      amount: parseFloat(form.amount), 
      quantity: form.quantity ? parseFloat(form.quantity) : undefined,
      unit: form.unit,
      description: form.description, 
      expenseDate: form.expenseDate ? new Date(form.expenseDate) : undefined 
    });
  };

  const inputClass = "w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50";
  const labelClass = "block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5";

  return (
    <AnimatePresence>
      {expense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="glass-card w-full max-w-md rounded-3xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-dhaba-border/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-dhaba-accent/10 flex items-center justify-center"><FaEdit className="text-dhaba-accent" /></div>
                <div><h2 className="font-display text-xl font-bold text-dhaba-text">Edit Expense</h2><p className="text-xs text-dhaba-muted">Update expense details</p></div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group"><FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" /></button>
            </div>
            <form id="edit-expense-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className={labelClass}>Expense Type *</label>
                <select name="type" value={form.type} onChange={handleChange} required className={`${inputClass} appearance-none`}>
                  <option value="" disabled className="bg-dhaba-surface">Select type</option>
                  {EXPENSE_TYPES.map(t => <option key={t} value={t} className="bg-dhaba-surface text-dhaba-text">{formatTypeLabel(t)}</option>)}
                </select>
              </div>
              <div><label className={labelClass}>Name *</label><input type="text" name="name" value={form.name} onChange={handleChange} required className={inputClass} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>Amount (₹) *</label><input type="number" name="amount" value={form.amount} onChange={handleChange} required step="0.01" min="0" className={inputClass} /></div>
                <div><label className={labelClass}>Date *</label><input type="date" name="expenseDate" value={form.expenseDate} onChange={handleChange} required className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>Qty <span className="normal-case font-normal">(optional)</span></label><input type="number" name="quantity" value={form.quantity} onChange={handleChange} step="0.01" min="0" className={inputClass} placeholder="e.g. 5" /></div>
                <div>
                  <label className={labelClass}>Unit <span className="normal-case font-normal">(optional)</span></label>
                  <input type="text" name="unit" value={form.unit} onChange={handleChange} list="edit-unit-options" className={inputClass} placeholder="e.g. kg, Ltr" />
                  <datalist id="edit-unit-options">
                    <option value="kg" />
                    <option value="gram" />
                    <option value="Ltr" />
                    <option value="ml" />
                    <option value="packet" />
                    <option value="piece" />
                    <option value="box" />
                  </datalist>
                </div>
              </div>
              <div><label className={labelClass}>Notes <span className="normal-case font-normal">(optional)</span></label><textarea name="description" value={form.description} onChange={handleChange} rows={2} className={`${inputClass} resize-none`} /></div>
            </form>
            <div className="px-6 py-4 bg-dhaba-surface/30 border-t border-dhaba-border/20 flex gap-3 justify-end">
              <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl text-dhaba-muted font-bold text-sm hover:text-dhaba-text transition-colors">Cancel</button>
              <button type="submit" form="edit-expense-form" disabled={mutation.isPending} className="bg-gradient-warm text-dhaba-bg px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all disabled:opacity-50">
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

// ── Add Expense Modal ───────────────────────────────────────────────────────────

interface AddExpenseModalProps {
  presets: ExpensePreset[];
  staff: StaffMember[];
  onClose: () => void;
  onAdded: () => void;
  onPresetsChanged: () => void;
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ presets, staff, onClose, onAdded, onPresetsChanged }) => {
  const [activePreset, setActivePreset] = useState<ExpensePreset | "custom">("custom");
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddPresetForm, setShowAddPresetForm] = useState(false);
  const [saveAsPresetName, setSaveAsPresetName] = useState<string | null>(null);

  const isCustom = activePreset === "custom";
  const preset = isCustom ? null : (activePreset as ExpensePreset);
  const isStaffLinked = preset?.isStaffLinked ?? false;

  const [form, setForm] = useState({
    name:        preset?.name ?? "",
    type:        preset?.type ?? "other",
    amount:      preset && preset.lastPrice > 0 ? String(preset.lastPrice) : "",
    quantity:    "",
    unit:        "",
    description: "",
    expenseDate: getTodayISO(),
    staffId:     "",
  });
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (preset) {
      setForm(prev => ({
        ...prev,
        name:   preset.name,
        type:   preset.type,
        amount: preset.lastPrice > 0 ? String(preset.lastPrice) : "",
      }));
    } else {
      setForm(prev => ({
        ...prev,
        name:   "",
        type:   "other",
        amount: "",
      }));
    }
    setTimeout(() => amountRef.current?.focus(), 100);
  }, [preset]);

  const expenseMutation = useMutation({
    mutationFn: () => addExpense({
      type:        form.type,
      name:        form.name.trim(),
      amount:      parseFloat(form.amount),
      quantity:    form.quantity ? parseFloat(form.quantity) : undefined,
      unit:        form.unit,
      description: form.description,
      expenseDate: new Date(form.expenseDate).toISOString(),
      ...(preset?._id ? { presetId: preset._id } : {}),
    }),
    onSuccess: () => {
      enqueueSnackbar("Expense added!", { variant: "success" });
      onAdded();
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(err.response?.data?.message ?? "Failed to add expense.", { variant: "error" });
    },
  });

  const staffPaymentMutation = useMutation({
    mutationFn: () => addStaffPayment(form.staffId, {
      amount: parseFloat(form.amount),
      type:   "monthly",
      note:   form.description || "Expense tracker payment",
      date:   form.expenseDate,
    }),
  });

  const deletePresetMutation = useMutation({
    mutationFn: (id: string) => deleteExpensePreset(id),
    onSuccess: (_, deletedId) => { 
      enqueueSnackbar("Preset removed.", { variant: "success" }); 
      onPresetsChanged(); 
      if (!isCustom && preset?._id === deletedId) setActivePreset("custom"); 
    },
    onError: () => enqueueSnackbar("Failed to remove preset.", { variant: "error" }),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { enqueueSnackbar("Name is required.", { variant: "error" }); return; }
    if (!form.amount || parseFloat(form.amount) < 0) { enqueueSnackbar("Enter a valid amount.", { variant: "error" }); return; }
    if (isStaffLinked && !form.staffId) { enqueueSnackbar("Please select a staff member.", { variant: "error" }); return; }

    if (isStaffLinked && form.staffId) {
      await staffPaymentMutation.mutateAsync();
    }
    expenseMutation.mutate();

    if (isCustom && saveAsPresetName === null && !showSavePrompt) {
      setShowSavePrompt(true);
      return; 
    }
  };

  const inputClass = "w-full glass-input rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 ring-blue-500/50 border border-white/5 placeholder:text-white/30 transition-all bg-black/20";
  const labelClass = "block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5";

  const lastThree = preset?.priceHistory?.slice(-3).reverse() ?? [];
  const isPending = expenseMutation.isPending || staffPaymentMutation.isPending;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="glass-card w-full max-w-lg rounded-[1.5rem] overflow-hidden flex flex-col shadow-2xl border border-white/10 max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 shadow-inner flex items-center justify-center">
              <FaPlus className="text-blue-400 text-lg" />
            </div>
            <div>
              <h2 className="font-display text-xl font-black text-white/90 tracking-wide">
                Add Expense
              </h2>
              <p className="text-xs text-white/40 font-bold tracking-wide">
                Create a new entry or select a preset
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-xl transition-colors border border-transparent hover:border-white/10">
            <FaTimes className="text-white/40 hover:text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6">
          
          {/* Presets Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Select Preset</p>
              {isEditMode ? (
                <button type="button" onClick={() => { setIsEditMode(false); setShowAddPresetForm(false); }} className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5">
                  <FaCheck className="text-[9px]" /> Done Editing
                </button>
              ) : (
                <button type="button" onClick={() => { setIsEditMode(true); setShowAddPresetForm(false); }} className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 border border-white/10 hover:text-white/90 hover:bg-white/10 text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5">
                  <FaPencilAlt className="text-[9px]" /> Manage
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <button
                type="button"
                onClick={() => !isEditMode && setActivePreset("custom")}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-2 border-2 border-dashed ${activePreset === "custom" ? "bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]" : "bg-transparent text-white/50 border-white/10 hover:border-white/30 hover:text-white/90"}`}
                disabled={isEditMode}
              >
                <FaPlus className="text-[10px]" /> Custom
              </button>
              
              <div className="w-px h-6 bg-white/10 shrink-0 mx-1" />

              {presets.map(p => {
                const isActive = !isEditMode && activePreset !== "custom" && activePreset?._id === p._id;
                return (
                  <div key={p._id} className="relative flex-shrink-0 group">
                    <button
                      type="button"
                      onClick={() => !isEditMode && setActivePreset(p)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${isActive ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "glass-card text-white/80 hover:text-white border border-white/10 hover:bg-white/10"}`}
                      disabled={isEditMode}
                    >
                      {p.name}
                    </button>
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() => deletePresetMutation.mutate(p._id)}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-400 transition-all shadow-md z-10 border border-red-300"
                      >
                        <FaTimes className="text-white text-xs" />
                      </button>
                    )}
                  </div>
                );
              })}

              {isEditMode && !showAddPresetForm && (
                <button type="button" onClick={() => { setSaveAsPresetName(null); setShowAddPresetForm(true); }} className="px-4 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0 glass-card text-blue-400 border-2 border-dashed border-blue-500/40 hover:border-blue-500/70 hover:bg-blue-500/5 transition-all flex items-center gap-2">
                  <FaPlus className="text-[10px]" /> New Preset
                </button>
              )}
            </div>

            <AnimatePresence>
              {showAddPresetForm && (
                <AddPresetForm prefillName={saveAsPresetName ?? undefined} onCreated={() => { setShowAddPresetForm(false); setSaveAsPresetName(null); onPresetsChanged(); }} onCancel={() => { setShowAddPresetForm(false); setSaveAsPresetName(null); }} />
              )}
            </AnimatePresence>
          </div>

          <hr className="border-white/10" />

          {/* Form Body */}
          <form id="add-expense-modal-form" onSubmit={handleSubmit} className="space-y-5">
            
            {!isCustom && (
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 shadow-inner flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0"><FaCheck className="text-blue-400 text-sm" /></div>
                <div>
                  <p className="text-white/90 text-sm font-black tracking-wide">{preset?.name}</p>
                  <p className="text-blue-400/80 text-[10px] font-bold uppercase tracking-widest">{formatTypeLabel(preset?.type || "")}</p>
                </div>
              </div>
            )}

            {isCustom && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(prev => {
                        const updated = { ...prev, name: val };
                        if (!prev.unit) {
                          const guessed = guessUnit(val);
                          if (guessed) updated.unit = guessed;
                        }
                        return updated;
                      });
                    }}
                    required
                    className={inputClass}
                    placeholder="e.g. Mustard Oil"
                    autoFocus
                  />
                </div>
                <div>
                  <label className={labelClass}>Category *</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                    required
                    className={`${inputClass} appearance-none`}
                  >
                    {EXPENSE_TYPES.map(t => (
                      <option key={t} value={t} className="bg-[#1e293b] text-white">{formatTypeLabel(t)}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {isStaffLinked && (
              <div>
                <label className={labelClass}>Staff Member *</label>
                <div className="relative">
                  <select
                    value={form.staffId}
                    onChange={e => setForm(prev => ({ ...prev, staffId: e.target.value }))}
                    required
                    className={`${inputClass} appearance-none pr-8`}
                  >
                    <option value="" disabled className="bg-[#1e293b]">Select staff...</option>
                    {staff.filter(s => s.isActive).map(s => (
                      <option key={s._id} value={s._id} className="bg-[#1e293b] text-white">
                        {s.name} ({s.role})
                      </option>
                    ))}
                  </select>
                  <FaChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-xs pointer-events-none" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Amount (₹) *</label>
                <input
                  ref={amountRef}
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  required
                  step="0.01"
                  min="0"
                  className={inputClass}
                  placeholder="0.00"
                  autoFocus={!isCustom}
                />
                {lastThree.length > 0 && (
                  <p className="text-[10px] text-white/40 mt-1.5 font-bold">
                    Last: {lastThree.map(h => `₹${h.amount}`).join(", ")}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Date *</label>
                <input
                  type="date"
                  value={form.expenseDate}
                  onChange={e => setForm(prev => ({ ...prev, expenseDate: e.target.value }))}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Qty <span className="normal-case font-normal">(opt)</span></label>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                  step="0.01"
                  min="0"
                  className={inputClass}
                  placeholder="e.g. 5"
                />
              </div>
              <div>
                <label className={labelClass}>Unit <span className="normal-case font-normal">(opt)</span></label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
                  list="quick-unit-options"
                  className={inputClass}
                  placeholder="e.g. kg, Ltr"
                />
                <datalist id="quick-unit-options">
                  <option value="kg" /><option value="gram" /><option value="Ltr" /><option value="ml" />
                  <option value="packet" /><option value="piece" /><option value="box" />
                </datalist>
              </div>
            </div>

            <div>
              <label className={labelClass}>Notes <span className="normal-case font-normal">(opt)</span></label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                className={inputClass}
                placeholder="Any details..."
              />
            </div>

            <AnimatePresence>
              {showSavePrompt && isCustom && form.name.trim() && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="pt-2 border-t border-white/10">
                  <p className="text-xs text-white/50 mb-3 font-bold">
                    Save <span className="font-black text-white">"{form.name.trim()}"</span> as a preset for next time?
                  </p>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowSavePrompt(false)} className="flex-1 glass-card rounded-xl py-2.5 text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors font-bold border border-white/5">
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSaveAsPresetName(form.name.trim()); setShowAddPresetForm(true); setShowSavePrompt(false); }}
                      className="flex-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-xl py-2.5 text-xs font-black tracking-wide hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <FaCheck className="text-[10px]" /> Save Preset
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex gap-3 justify-end mt-auto">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl text-white/50 font-bold text-sm hover:text-white hover:bg-white/5 transition-all">
            Cancel
          </button>
          <button
            type="submit"
            form="add-expense-modal-form"
            disabled={isPending}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white px-8 py-3 rounded-xl font-black tracking-wide text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400/50"
          >
            {isPending && <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {isPending ? "Adding..." : "Add Expense"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Add Preset Form ───────────────────────────────────────────────────────────

interface AddPresetFormProps {
  onCreated: () => void;
  onCancel: () => void;
  prefillName?: string;
}

const AddPresetForm: React.FC<AddPresetFormProps> = ({ onCreated, onCancel, prefillName }) => {
  const [name, setName] = useState(prefillName ?? "");
  const [category, setCategory] = useState("Raw Material");
  const [isStaffLinked, setIsStaffLinked] = useState(false);

  useEffect(() => { if (prefillName) setName(prefillName); }, [prefillName]);

  const mutation = useMutation({
    mutationFn: () => createExpensePreset({
      name: name.trim(),
      category,
      type: isStaffLinked ? "labor_salary" : (CATEGORY_TO_TYPE[category] ?? "other"),
      isStaffLinked,
    }),
    onSuccess: () => { enqueueSnackbar("Preset added!", { variant: "success" }); onCreated(); },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(err.response?.data?.message ?? "Failed to create preset.", { variant: "error" });
    },
  });

  const inputClass = "glass-input rounded-xl px-3 py-2 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass-card rounded-xl p-4 border border-dashed border-dhaba-accent/30 mt-2"
    >
      <p className="text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-3">New Preset</p>
      <div className="flex flex-wrap gap-2 items-end">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Preset name..."
          className={`${inputClass} flex-1 min-w-[120px]`}
          autoFocus
        />
        <select
          value={category}
          onChange={e => { setCategory(e.target.value); setIsStaffLinked(e.target.value === "Staff"); }}
          className={`${inputClass} appearance-none`}
        >
          {PRESET_CATEGORIES.map(c => <option key={c} value={c} className="bg-dhaba-surface">{c}</option>)}
        </select>
        <button
          onClick={() => mutation.mutate()}
          disabled={!name.trim() || mutation.isPending}
          className="bg-dhaba-accent/15 text-dhaba-accent rounded-xl px-4 py-2 text-sm font-semibold hover:bg-dhaba-accent/25 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <FaCheck className="text-xs" /> Save
        </button>
        <button onClick={onCancel} className="p-2 rounded-xl hover:bg-dhaba-danger/10 transition-colors group">
          <FaTimes className="text-dhaba-muted text-sm group-hover:text-dhaba-danger" />
        </button>
      </div>
    </motion.div>
  );
};

// ── Expense Row Component ─────────────────────────────────────────────────────

const ExpenseRow = ({ expense, onEdit, onDelete }: { expense: Expense, onEdit: () => void, onDelete: () => void }) => {
  return (
    <div className="w-full glass-card rounded-[1.25rem] px-5 py-4 flex items-center gap-4 hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all duration-300 text-left border border-dhaba-border/20 group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/5 shadow-inner ${TYPE_COLORS[expense.type] ?? TYPE_COLORS.other}`}>
        <FaReceipt className="text-lg" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-black text-white/90 text-[15px] leading-tight truncate tracking-wide">{expense.name}</span>
          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/10 ${TYPE_COLORS[expense.type] ?? TYPE_COLORS.other}`}>{formatTypeLabel(expense.type)}</span>
        </div>
        {expense.description && <p className="text-xs text-white/40 truncate">{expense.description}</p>}
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mt-1">{formatDate(expense.expenseDate)}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <p className="font-display text-lg font-black text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.3)] tracking-tight">₹{expense.amount.toLocaleString("en-IN")}</p>
        {expense.quantity ? <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">{expense.quantity} {expense.unit}</p> : null}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2 z-10">
        <button onClick={onEdit} className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all" title="Edit">
          <FaEdit className="text-white/40 hover:text-blue-400 text-sm transition-colors" />
        </button>
        <button onClick={onDelete} className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-red-500/10 hover:border-red-500/30 transition-all" title="Delete">
          <FaTrash className="text-white/40 hover:text-red-400 text-sm transition-colors" />
        </button>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const Expenses: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | Expenses"; }, []);

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Preset state
  const [presets, setPresets] = useState<ExpensePreset[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Tab & Accordion state
  const [activeTab, setActiveTab] = useState<"daywise" | "category" | "all">("daywise");
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Staff state (for staff-linked presets)
  const [staff, setStaff] = useState<StaffMember[]>([]);

  const fetchExpenses = useCallback(async () => {
    setIsLoadingExpenses(true);
    setError(null);
    try {
      const res = await getAllExpenses(getPeriodDates(period));
      setExpenses(res.data?.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load expenses."));
    } finally {
      setIsLoadingExpenses(false);
    }
  }, [period]);

  const fetchPresets = useCallback(async () => {
    setIsLoadingPresets(true);
    try {
      const res = await getExpensePresets();
      setPresets(res.data?.data ?? []);
    } catch {
      // non-critical — silently fail
    } finally {
      setIsLoadingPresets(false);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await getAllStaff({ isActive: "true" });
      setStaff(res.data?.data ?? []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => { fetchPresets(); fetchStaff(); }, [fetchPresets, fetchStaff]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => { enqueueSnackbar("Expense deleted.", { variant: "success" }); setDeleteConfirmId(null); fetchExpenses(); },
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

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => {
      // Raw materials: break down by item name (Fish, Chicken, Rice…)
      // Everything else: stay at type level (Staff, Utilities…)
      const key = e.type === "food_raw_material"
        ? e.name.trim()
        : formatTypeLabel(e.type);
      map[key] = (map[key] || 0) + e.amount;
    });
    const sorted = Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    // Cap at 8 slices — group tail into "Others" to keep chart readable
    if (sorted.length <= 8) return sorted;
    const top = sorted.slice(0, 8);
    const othersValue = sorted.slice(8).reduce((s, d) => s + d.value, 0);
    return [...top, { name: "Others", value: othersValue }];
  }, [filtered]);

  const itemData = useMemo(() => {
    const map: Record<string, { amount: number; quantity: number; unit: string; name: string }> = {};
    filtered.forEach(e => {
      const key = e.name.trim();
      const matchKey = key.toLowerCase();
      if (!map[matchKey]) map[matchKey] = { amount: 0, quantity: 0, unit: e.unit || "", name: key };
      map[matchKey].amount += e.amount;
      if (e.quantity) map[matchKey].quantity += e.quantity;
      if (!map[matchKey].unit && e.unit) map[matchKey].unit = e.unit;
    });
    return Object.values(map)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filtered]);

  const groupedByDate = useMemo(() => {
    const map: Record<string, { total: number; expenses: Expense[] }> = {};
    filtered.forEach(e => {
      const d = formatDate(e.expenseDate);
      if (!map[d]) map[d] = { total: 0, expenses: [] };
      map[d].total += e.amount;
      map[d].expenses.push(e);
    });
    return Object.entries(map).sort((a, b) => new Date(b[1].expenses[0].expenseDate).getTime() - new Date(a[1].expenses[0].expenseDate).getTime());
  }, [filtered]);

  const groupedByCategory = useMemo(() => {
    const map: Record<string, { total: number; expenses: Expense[] }> = {};
    filtered.forEach(e => {
      const c = formatTypeLabel(e.type);
      if (!map[c]) map[c] = { total: 0, expenses: [] };
      map[c].total += e.amount;
      map[c].expenses.push(e);
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filtered]);

  const COLORS = [
    '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899',
    '#ef4444', '#14b8a6', '#f97316', '#a78bfa', '#6b7280',
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-dhaba-bg relative overflow-y-auto">
      {/* Ambient Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] z-0 pointer-events-none" />
      <div className="fixed top-[20%] right-[-10%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[100px] z-0 pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col pb-24 px-4 sm:px-6 md:px-8 max-w-6xl mx-auto w-full pt-8 space-y-6">

        {/* 1. Header & Period Filters */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="self-start mt-1">
              <BackButton />
            </div>
            <div>
              <h1 className="font-display text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tracking-wide">Expense Tracker</h1>
              <p className="text-sm text-white/50 mt-1 font-medium tracking-wide">
                {filtered.length} {filtered.length === 1 ? "entry" : "entries"} · ₹{totalAmount.toLocaleString("en-IN")} total
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-6 py-2.5 rounded-[1.25rem] bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-black tracking-wide text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all border border-blue-400/50"
            >
              <FaPlus className="text-xs" /> Add Expense
            </button>
            <div className="glass-card rounded-[1.25rem] p-1.5 flex gap-1 border border-dhaba-border/20 shadow-sm">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)} className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${period === p.key ? "bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]" : "bg-transparent text-white/50 border-transparent hover:bg-white/5 hover:text-white/80"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={fetchExpenses}
              disabled={isLoadingExpenses}
              className="p-3 rounded-[1.25rem] glass-card text-dhaba-muted hover:text-dhaba-text hover:bg-white/5 border border-dhaba-border/20 shadow-sm transition-all flex items-center justify-center shrink-0"
              title="Refresh"
            >
              <FiRefreshCw size={16} className={isLoadingExpenses ? "animate-spin text-blue-400" : ""} />
            </button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-dhaba-danger/10 border border-dhaba-danger/30 text-dhaba-danger text-sm font-medium flex items-center justify-between shadow-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-dhaba-muted hover:text-dhaba-danger transition-colors">✕</button>
          </div>
        )}

        {/* 2. Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="glass-card rounded-[1.25rem] p-5 flex flex-col gap-3 border border-dhaba-border/20 shadow-sm relative overflow-hidden group hover:border-red-500/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
              <FaReceipt className="text-red-400 text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Total Spent</p>
              <p className="font-display text-2xl font-black text-red-400 mt-0.5 tracking-tight drop-shadow-[0_0_10px_rgba(248,113,113,0.3)]">₹{totalAmount.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <div className="glass-card rounded-[1.25rem] p-5 flex flex-col gap-3 border border-dhaba-border/20 shadow-sm relative overflow-hidden group hover:border-blue-500/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
              <FiList className="text-blue-400 text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">No. of Entries</p>
              <p className="font-display text-2xl font-black text-white/90 mt-0.5 tracking-tight">{filtered.length}</p>
            </div>
          </div>
          <div className="glass-card rounded-[1.25rem] p-5 flex flex-col gap-3 border border-dhaba-border/20 shadow-sm relative overflow-hidden group hover:border-orange-500/30 transition-all hidden md:flex">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20">
              <FiRefreshCw className="text-orange-400 text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Avg per Entry</p>
              <p className="font-display text-2xl font-black text-orange-400 mt-0.5 tracking-tight">
                {filtered.length ? `₹${avgAmount.toLocaleString("en-IN")}` : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* 3. Analytics Graphs */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Breakdown */}
            <div className="glass-card rounded-[1.25rem] p-5 min-h-[400px] flex flex-col border border-dhaba-border/20 shadow-sm relative overflow-hidden group hover:border-purple-500/30 transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Category Breakdown</p>
              </div>
              <div className="h-[320px] relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={70} outerRadius={100} paddingAngle={2}>
                      {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN')}`} contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Items Breakdown */}
            <div className="glass-card rounded-[1.25rem] p-5 min-h-[400px] flex flex-col border border-dhaba-border/20 shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Top 5 Items (Value)</p>
              </div>
              <div className="h-[320px] relative z-10 -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={itemData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 'bold' }} width={90} />
                    <Tooltip formatter={(value: any, name: any, props: any) => { const item = props.payload; const qtyStr = item.quantity ? ` (${item.quantity} ${item.unit})` : ""; return [`₹${Number(value).toLocaleString('en-IN')}${qtyStr}`, "Spent"]; }} contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                      {itemData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* 4. List Controls */}
        <div className="glass-card rounded-[1.5rem] p-2 border border-dhaba-border/20 shadow-sm relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-2">
            <button onClick={() => setActiveTab("daywise")} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider shrink-0 transition-all flex items-center gap-2 ${activeTab === "daywise" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80 hover:bg-white/5"}`}>
              <FiCalendar className="text-[14px]" /> Day-wise
            </button>
            <button onClick={() => setActiveTab("category")} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider shrink-0 transition-all flex items-center gap-2 ${activeTab === "category" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80 hover:bg-white/5"}`}>
              <FiFolder className="text-[14px]" /> By Category
            </button>
            <button onClick={() => setActiveTab("all")} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider shrink-0 transition-all flex items-center gap-2 ${activeTab === "all" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80 hover:bg-white/5"}`}>
              <FiList className="text-[14px]" /> All Entries
            </button>
          </div>
          
          {activeTab === "all" && (
            <div className="flex-1 md:max-w-xs px-2 md:px-0">
              <div className="relative group w-full">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none group-focus-within:text-blue-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Search entries..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-black/20 rounded-xl pl-10 pr-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:ring-1 ring-blue-500/50 border border-white/5 placeholder:text-white/30 transition-all"
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Category filters for All Entries view */}
        <AnimatePresence>
          {activeTab === "all" && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <button onClick={() => setFilterType("all")} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all border ${filterType === "all" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "bg-[#1e293b] text-white/40 border-white/5 hover:bg-white/10 hover:text-white/80"}`}>All</button>
              {EXPENSE_TYPES.map(t => (
                <button key={t} onClick={() => setFilterType(t)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all border ${filterType === t ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "bg-[#1e293b] text-white/40 border-white/5 hover:bg-white/10 hover:text-white/80"}`}>
                  {formatTypeLabel(t)}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 6. Expense List Views */}
        {isLoadingExpenses ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 border-2 border-dhaba-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 glass-card rounded-[1.5rem] border border-white/5">
            <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 shadow-inner flex items-center justify-center"><FaReceipt className="text-white/20 text-2xl" /></div>
            <p className="text-white/80 text-lg font-black tracking-wide">No expenses found</p>
            <p className="text-white/40 text-xs font-bold">Try a different period or filter</p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* --- DAY-WISE VIEW --- */}
            {activeTab === "daywise" && (
              <div className="space-y-4">
                {groupedByDate.map(([date, data]) => {
                  const isExpanded = expandedDates[date] ?? false;
                  return (
                    <div key={date} className="glass-card rounded-[1.5rem] overflow-hidden border border-dhaba-border/20 shadow-sm transition-all group relative">
                      <div className={`absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent pointer-events-none transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                      <button 
                        onClick={() => setExpandedDates(prev => ({ ...prev, [date]: !isExpanded }))}
                        className="w-full px-6 py-5 flex items-center justify-between transition-colors relative z-10"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-xl border shadow-inner flex items-center justify-center transition-all ${isExpanded ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-white/40 group-hover:text-blue-400 group-hover:border-blue-500/30'}`}>
                            <FaChevronDown className={`text-sm transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="font-display text-xl font-black text-white/90 tracking-wide">{date}</span>
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-0.5">{data.expenses.length} entries</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-display text-2xl font-black text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.3)] tracking-tight">₹{data.total.toLocaleString("en-IN")}</span>
                        </div>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-dhaba-border/20 bg-black/20 relative z-10 shadow-inner">
                            <div className="p-4 space-y-3">
                              {data.expenses.map(expense => (
                                <ExpenseRow key={expense._id} expense={expense} onEdit={() => setEditingExpense(expense)} onDelete={() => setDeleteConfirmId(expense._id)} />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {/* --- CATEGORY VIEW --- */}
            {activeTab === "category" && (
              <div className="space-y-4">
                {groupedByCategory.map(([category, data]) => {
                  const isExpanded = expandedCategories[category] ?? false;
                  return (
                    <div key={category} className="glass-card rounded-[1.5rem] overflow-hidden border border-dhaba-border/20 shadow-sm transition-all group relative">
                      <div className={`absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent pointer-events-none transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                      <button 
                        onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !isExpanded }))}
                        className="w-full px-6 py-5 flex items-center justify-between transition-colors relative z-10"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-xl border shadow-inner flex items-center justify-center transition-all ${isExpanded ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-white/40 group-hover:text-blue-400 group-hover:border-blue-500/30'}`}>
                            <FaChevronDown className={`text-sm transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="font-display text-xl font-black text-white/90 tracking-wide">{category}</span>
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-0.5">{data.expenses.length} entries</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-display text-2xl font-black text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.3)] tracking-tight">₹{data.total.toLocaleString("en-IN")}</span>
                        </div>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-dhaba-border/20 bg-black/20 relative z-10 shadow-inner">
                            <div className="p-4 space-y-3">
                              {data.expenses.map(expense => (
                                <ExpenseRow key={expense._id} expense={expense} onEdit={() => setEditingExpense(expense)} onDelete={() => setDeleteConfirmId(expense._id)} />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {/* --- ALL ENTRIES VIEW --- */}
            {activeTab === "all" && (
              <div className="space-y-3">
                <AnimatePresence>
                  {filtered.map(expense => (
                    <motion.div key={expense._id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                      <ExpenseRow expense={expense} onEdit={() => setEditingExpense(expense)} onDelete={() => setDeleteConfirmId(expense._id)} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <AddExpenseModal
            presets={presets}
            staff={staff}
            onClose={() => setIsAddModalOpen(false)}
            onAdded={fetchExpenses}
            onPresetsChanged={fetchPresets}
          />
        )}
      </AnimatePresence>

      {/* Edit Expense Modal */}
      <EditExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} onSaved={fetchExpenses} />

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-card rounded-2xl p-6 w-full max-w-sm shadow-glow border border-white/10">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto bg-red-500/10 border border-red-500/20"><FaTrash className="text-red-400 text-xl" /></div>
              <h2 className="font-display text-xl font-black text-white/90 text-center mb-1">Delete Expense?</h2>
              <p className="text-white/50 text-sm text-center mb-6 font-medium">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 glass-card rounded-xl py-3 text-sm font-bold text-white/70 hover:text-white border border-white/10 hover:bg-white/10 transition-colors">Cancel</button>
                <button onClick={() => deleteMutation.mutate(deleteConfirmId!)} disabled={deleteMutation.isPending} className="flex-1 rounded-xl py-3 text-sm font-black bg-red-500/90 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all disabled:opacity-60 border border-red-400/50">
                  {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <BottomNav />
    </div>
  );
};

export default Expenses;
