import React, { useState, useEffect, useCallback } from "react";
import { FaCoffee, FaBox, FaPlus, FaTrash, FaTimes } from "react-icons/fa";
import { GiCigarette } from "react-icons/gi";
import { FiRefreshCw } from "react-icons/fi";
import BackButton from "../components/shared/BackButton";
import {
  addConsumable,
  getAllConsumables,
  deleteConsumable,
  getAllStaff,
  getDishes,
} from "../https";
import type { ConsumableEntry, ConsumableType, ConsumableDailySummary, ConsumerType, StaffMember, Dish, StaffRole } from "../types";

interface SizeVariant { label: string; price: number; }

interface ConsumableConfig {
  label: string;
  icon: React.ReactNode;
  unit: string;
  variants: SizeVariant[];
}

// ── Default config (fallback if no matching dish found) ──
const DEFAULT_CONSUMABLE_CONFIG: Record<ConsumableType, ConsumableConfig> = {
  tea: {
    label: "Tea / Chai", icon: <FaCoffee />, unit: "cup",
    variants: [{ label: "Regular", price: 10 }, { label: "Large", price: 20 }],
  },
  gutka: {
    label: "Gutka / Pouch", icon: <FaBox />, unit: "pouch",
    variants: [{ label: "Regular", price: 5 }, { label: "Large", price: 10 }],
  },
  cigarette: {
    label: "Cigarette", icon: <GiCigarette />, unit: "stick",
    variants: [{ label: "Stick", price: 20 }],
  },
};

// Map a dish name → consumable type
const dishToConsumableType = (dish: Dish): ConsumableType | null => {
  const n = dish.name.toLowerCase();
  if (n.includes("tea") || n.includes("chai")) return "tea";
  if (n.includes("gutka")) return "gutka";
  if (n.includes("cigarette") || n.includes("cig")) return "cigarette";
  return null;
};

const ROLE_EMOJI: Record<StaffRole, string> = {
  cook: "👨‍🍳", supplier: "🚚", owner: "👑", manager: "📋", delivery: "🏍️", other: "👤",
};

const getSummaryFromEntries = (entries: ConsumableEntry[], type: ConsumableType): ConsumableDailySummary => {
  const items = entries.filter((e) => e.type === type);
  const customerItems = items.filter((e) => e.consumerType === "customer");
  const staffItems = items.filter((e) => e.consumerType === "staff");
  const ownerItems = items.filter((e) => e.consumerType === "owner");
  return {
    totalSold: customerItems.reduce((s, e) => s + e.quantity, 0),
    totalRevenue: customerItems.reduce((s, e) => s + e.quantity * e.pricePerUnit, 0),
    staffConsumed: staffItems.reduce((s, e) => s + e.quantity, 0),
    ownerConsumed: ownerItems.reduce((s, e) => s + e.quantity, 0),
    wastedValue: [...staffItems, ...ownerItems].reduce((s, e) => s + e.quantity * e.pricePerUnit, 0),
  };
};

const Consumables: React.FC = () => {
  useEffect(() => {
    document.title = "Dhaba POS | Consumables";
  }, []);

  const [consumableConfig, setConsumableConfig] = useState(DEFAULT_CONSUMABLE_CONFIG);
  const [entries, setEntries] = useState<ConsumableEntry[]>([]);
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [activeTab, setActiveTab] = useState<ConsumableType>("tea");
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Form state ──
  const [formQty, setFormQty] = useState(1);
  const [formVariantIdx, setFormVariantIdx] = useState(0);
  const [formConsumerType, setFormConsumerType] = useState<ConsumerType>("customer");
  const [formName, setFormName] = useState("");
  const [formSelectedStaff, setFormSelectedStaff] = useState<string[]>([]);

  // ── Fetch today's entries ──
  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const res = await getAllConsumables({ date: today });
      setEntries(res.data?.data ?? []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message || e.message || "Failed to load consumables.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    getAllStaff({ isActive: "true" })
      .then((res) => setAvailableStaff(res.data?.data ?? []))
      .catch(() => { });
    // Fetch dishes to update consumable variants/prices
    getDishes()
      .then((res) => {
        const dishes: Dish[] = res.data?.data ?? [];
        const updated = { ...DEFAULT_CONSUMABLE_CONFIG };
        for (const dish of dishes) {
          const type = dishToConsumableType(dish);
          if (type && dish.variants.length > 0) {
            updated[type] = {
              ...updated[type],
              variants: dish.variants.map((v) => ({ label: v.size, price: v.price })),
            };
          }
        }
        setConsumableConfig(updated);
      })
      .catch(() => { });
  }, [fetchEntries]);

  const config = consumableConfig[activeTab];
  const filtered = entries.filter((e) => e.type === activeTab);
  const summary = getSummaryFromEntries(entries, activeTab);
  const activeVariant = config.variants[formVariantIdx] ?? config.variants[0];

  const handleConsumerTypeSwitch = (ct: ConsumerType) => {
    setFormConsumerType(ct);
    setFormName("");
    setFormSelectedStaff([]);
  };

  const toggleStaffSelection = (staffId: string) => {
    setFormSelectedStaff((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const resetForm = () => {
    setFormQty(1);
    setFormVariantIdx(0);
    setFormName("");
    setFormConsumerType("customer");
    setFormSelectedStaff([]);
  };

  const canSubmit = formConsumerType === "staff" ? formSelectedStaff.length > 0 : true;

  // ── Add Entry ──
  const handleAdd = async () => {
    if (formQty < 1 || !canSubmit) return;
    setIsSubmitting(true);
    try {
      const consumerName =
        formConsumerType === "staff"
          ? formSelectedStaff
            .map((id) => availableStaff.find((s) => s._id === id)?.name || "")
            .filter(Boolean)
            .join(", ")
          : formName.trim() || (formConsumerType === "customer" ? "Walk-in" : "Owner");

      await addConsumable({
        type: activeTab,
        quantity: formQty,
        pricePerUnit: activeVariant.price,
        consumerType: formConsumerType,
        consumerName,
        staffIds: formConsumerType === "staff" ? formSelectedStaff : undefined,
      });

      setShowAddModal(false);
      resetForm();
      await fetchEntries();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message || e.message || "Failed to add entry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete Entry ──
  const handleDelete = async (id: string) => {
    try {
      setEntries((prev) => prev.filter((e) => e._id !== id));
      await deleteConsumable(id);
    } catch {
      await fetchEntries();
    }
  };

  const tabs: ConsumableType[] = ["tea", "gutka", "cigarette"];

  return (
    <div className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-8">
      <div className="container mx-auto px-6 py-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="font-display text-2xl font-bold text-dhaba-text">Consumables Tracker</h1>
              <p className="text-sm text-dhaba-muted">Tea, Gutka & Cigarette — Sales & Consumption</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchEntries}
              disabled={isLoading}
              className="p-2.5 rounded-xl glass-input text-dhaba-muted hover:text-dhaba-text transition-colors"
              title="Refresh"
            >
              <FiRefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="bg-gradient-warm text-dhaba-bg px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all"
            >
              <FaPlus /> Add Entry
            </button>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-dhaba-danger/10 border border-dhaba-danger/30 text-dhaba-danger text-sm font-medium flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-dhaba-muted hover:text-dhaba-danger">✕</button>
          </div>
        )}

        {/* ── Tab Switcher ── */}
        <div className="glass-card rounded-2xl p-1 flex gap-1 mb-6 w-fit">
          {tabs.map((tab) => {
            const c = consumableConfig[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${activeTab === tab
                    ? "bg-dhaba-accent/15 text-dhaba-accent shadow-glow"
                    : "text-dhaba-muted hover:text-dhaba-text hover:bg-dhaba-surface-hover"
                  }`}
              >
                {c.icon} {c.label}
              </button>
            );
          })}
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <SummaryCard label="Sold (Customers)" value={summary.totalSold} unit={config.unit} color="text-dhaba-success" />
          <SummaryCard label="Revenue" value={`₹${summary.totalRevenue}`} color="text-dhaba-success" />
          <SummaryCard label="Staff Consumed" value={summary.staffConsumed} unit={config.unit} color="text-dhaba-warning" />
          <SummaryCard label="Owner Consumed" value={summary.ownerConsumed} unit={config.unit} color="text-dhaba-accent" />
          <SummaryCard label="Wasted Value" value={`₹${summary.wastedValue}`} color="text-dhaba-danger" highlight />
        </div>

        {/* ── Entries Table ── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-dhaba-border/20 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-dhaba-text">Today's {config.label} Log</h2>
            <span className="text-xs text-dhaba-muted">{filtered.length} {filtered.length === 1 ? "entry" : "entries"}</span>
          </div>
          <div className="divide-y divide-dhaba-border/10">
            {isLoading ? (
              <div className="px-6 py-10 flex justify-center">
                <div className="w-6 h-6 border-2 border-dhaba-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-10 text-center text-dhaba-muted">No entries yet</div>
            ) : (
              filtered.map((entry) => (
                <div key={entry._id} className="px-6 py-3.5 flex items-center justify-between hover:bg-dhaba-surface-hover/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold ${entry.consumerType === "customer" ? "bg-dhaba-success/15 text-dhaba-success"
                        : entry.consumerType === "staff" ? "bg-dhaba-warning/15 text-dhaba-warning"
                          : "bg-dhaba-accent/15 text-dhaba-accent"
                      }`}>
                      {entry.quantity}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-dhaba-text">{entry.consumerName}</p>
                      <p className="text-xs text-dhaba-muted">
                        {entry.consumerType === "customer" ? "🛒 Customer Sale" : entry.consumerType === "staff" ? "👷 Staff" : "👑 Owner"}
                        {" · "}
                        {new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${entry.consumerType === "customer" ? "text-dhaba-success" : "text-dhaba-danger"}`}>
                        {entry.consumerType === "customer" ? "+" : "-"}₹{entry.quantity * entry.pricePerUnit}
                      </p>
                      <p className="text-[10px] text-dhaba-muted uppercase tracking-wider">{entry.quantity} × ₹{entry.pricePerUnit}</p>
                    </div>
                    <button onClick={() => handleDelete(entry._id)} className="p-2 rounded-lg hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger transition-colors">
                      <FaTrash size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Add Entry Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 space-y-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold text-dhaba-text flex items-center gap-2">
              {config.icon} Add {config.label}
            </h2>

            {/* Consumer Type */}
            <div>
              <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Who?</label>
              <div className="flex gap-2">
                {(["customer", "staff", "owner"] as ConsumerType[]).map((ct) => (
                  <button
                    key={ct}
                    onClick={() => handleConsumerTypeSwitch(ct)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${formConsumerType === ct ? "bg-dhaba-accent/15 text-dhaba-accent" : "glass-input text-dhaba-muted hover:text-dhaba-text"
                      }`}
                  >
                    {ct === "customer" ? "🛒 Customer" : ct === "staff" ? "👷 Staff" : "👑 Owner"}
                  </button>
                ))}
              </div>
            </div>

            {/* Name / Staff selector */}
            <div>
              <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">
                {formConsumerType === "staff" ? "Select Staff" : formConsumerType === "owner" ? "Owner" : "Name (optional)"}
              </label>
              {formConsumerType === "customer" ? (
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Walk-in"
                  className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50"
                />
              ) : formConsumerType === "staff" ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {availableStaff.filter((s) => s.role !== "owner").map((s) => (
                      <button
                        key={s._id}
                        onClick={() => toggleStaffSelection(s._id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${formSelectedStaff.includes(s._id)
                            ? "bg-dhaba-accent/20 text-dhaba-accent ring-1 ring-dhaba-accent/40"
                            : "glass-input text-dhaba-muted hover:text-dhaba-text"
                          }`}
                      >
                        {ROLE_EMOJI[s.role]} {s.name}
                        {formSelectedStaff.includes(s._id) && <FaTimes size={8} className="ml-1" />}
                      </button>
                    ))}
                  </div>
                  {formSelectedStaff.length > 0 && (
                    <p className="text-[10px] text-dhaba-accent font-semibold">{formSelectedStaff.length} staff selected</p>
                  )}
                </div>
              ) : (
                <select
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none appearance-none"
                >
                  <option value="">Select owner</option>
                  {availableStaff.filter((s) => s.role === "owner").map((s) => (
                    <option key={s._id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Size variant dropdown */}
            <div>
              <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Size</label>
              <select
                value={formVariantIdx}
                onChange={(e) => setFormVariantIdx(Number(e.target.value))}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none appearance-none focus:ring-1 ring-dhaba-accent/50"
              >
                {config.variants.map((v, i) => (
                  <option key={v.label} value={i} className="bg-dhaba-surface text-dhaba-text">
                    {v.label} — ₹{v.price}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">
                Quantity ({config.unit}s)
              </label>
              <div className="glass-input rounded-xl flex items-center gap-4 px-4 py-2 w-fit">
                <button onClick={() => setFormQty((p) => Math.max(1, p - 1))} className="text-dhaba-accent font-bold text-lg w-6">−</button>
                <span className="text-dhaba-text font-bold text-lg w-6 text-center">{formQty}</span>
                <button onClick={() => setFormQty((p) => p + 1)} className="text-dhaba-accent font-bold text-lg w-6">+</button>
              </div>
            </div>

            {/* Price Preview */}
            <div className="glass-card rounded-xl p-4 flex justify-between items-center">
              <span className="text-dhaba-muted text-sm font-medium">
                {activeVariant.label} × {formQty} @ ₹{activeVariant.price}
              </span>
              <span className={`font-display text-xl font-bold ${formConsumerType === "customer" ? "text-dhaba-success" : "text-dhaba-danger"}`}>
                {formConsumerType === "customer" ? "+" : "-"}₹{formQty * activeVariant.price}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                disabled={isSubmitting}
                className="flex-1 glass-input rounded-xl py-2.5 text-dhaba-muted font-semibold text-sm hover:text-dhaba-text transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={isSubmitting || !canSubmit || formQty < 1}
                className="flex-1 bg-gradient-warm text-dhaba-bg rounded-xl py-2.5 font-bold text-sm hover:shadow-glow transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </>
                ) : "Add Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Helpers ──
const SummaryCard: React.FC<{ label: string; value: string | number; unit?: string; color: string; highlight?: boolean }> = ({
  label, value, unit, color, highlight,
}) => (
  <div className={`glass-card rounded-2xl p-5 transition-all duration-200 ${highlight ? "ring-1 ring-dhaba-danger/30 shadow-glow" : "hover:shadow-glow"}`}>
    <p className="text-dhaba-muted text-xs font-bold tracking-wider uppercase mb-2">{label}</p>
    <p className={`font-display text-2xl font-bold ${color}`}>
      {value}
      {unit && <span className="text-sm text-dhaba-muted ml-1">{unit}s</span>}
    </p>
  </div>
);

export default Consumables;
