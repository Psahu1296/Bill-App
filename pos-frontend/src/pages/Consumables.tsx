import React, { useState, useEffect, useCallback } from "react";
import { FaCoffee, FaBox, FaPlus, FaTrash, FaTimes } from "react-icons/fa";
import { GiCigarette } from "react-icons/gi";
import { MdFoodBank } from "react-icons/md";
import { FiRefreshCw } from "react-icons/fi";
import BackButton from "../components/shared/BackButton";
import CustomerFields from "../components/shared/CustomerFields";
import {
  addConsumableBatch,
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
  snack: {
    label: "Snacks", icon: <MdFoodBank />, unit: "item",
    variants: [],
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

interface CartItem {
  key: string;
  type: ConsumableType;
  itemName?: string;
  variantLabel: string;
  pricePerUnit: number;
  quantity: number;
}

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

  // ── Consumer state ──
  const [formConsumerType, setFormConsumerType] = useState<ConsumerType>("customer");
  const [formName, setFormName]   = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formSelectedStaff, setFormSelectedStaff] = useState<string[]>([]);

  // ── Item builder state ──
  const [formItemType, setFormItemType] = useState<ConsumableType>("tea");
  const [formQty, setFormQty]           = useState(1);
  const [formVariantIdx, setFormVariantIdx] = useState(0);
  const [snackDishes, setSnackDishes]   = useState<Dish[]>([]);
  const [formSelectedSnackDish, setFormSelectedSnackDish] = useState<Dish | null>(null);
  const [formSelectedSnackVariantIdx, setFormSelectedSnackVariantIdx] = useState(0);

  // ── Cart + payment state ──
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [formAmountPaid, setFormAmountPaid] = useState<number | "">("");

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
        setSnackDishes(dishes.filter((d) => d.category === "snacks" && d.isAvailable));
      })
      .catch(() => { });
  }, [fetchEntries]);

  // ── Derived (log view) ──
  const config   = consumableConfig[activeTab];
  const filtered = entries.filter((e) => e.type === activeTab);
  const summary  = getSummaryFromEntries(entries, activeTab);

  // ── Derived (item builder) ──
  const builderConfig = consumableConfig[formItemType];
  const builderSnackVariant = formSelectedSnackDish
    ? formSelectedSnackDish.variants[formSelectedSnackVariantIdx] ?? formSelectedSnackDish.variants[0]
    : null;
  const builderVariant = formItemType === "snack"
    ? { label: formSelectedSnackDish?.name ?? "", price: builderSnackVariant?.price ?? 0 }
    : builderConfig.variants[formVariantIdx] ?? builderConfig.variants[0];

  const cartTotal = cart.reduce((s, i) => s + i.quantity * i.pricePerUnit, 0);

  const canAddToCart =
    formQty >= 1 &&
    (formItemType === "snack" ? formSelectedSnackDish !== null : builderVariant != null);

  const canSubmit =
    cart.length > 0 &&
    (formConsumerType === "staff" ? formSelectedStaff.length > 0 : true);

  const resetItemBuilder = () => {
    setFormQty(1);
    setFormVariantIdx(0);
    setFormSelectedSnackDish(null);
    setFormSelectedSnackVariantIdx(0);
  };

  const resetForm = () => {
    setFormConsumerType("customer");
    setFormName("");
    setFormPhone("");
    setFormSelectedStaff([]);
    setFormItemType("tea");
    setCart([]);
    setFormAmountPaid("");
    resetItemBuilder();
  };

  const handleConsumerTypeSwitch = (ct: ConsumerType) => {
    setFormConsumerType(ct);
    setFormName("");
    setFormPhone("");
    setFormSelectedStaff([]);
  };

  const toggleStaffSelection = (staffId: string) => {
    setFormSelectedStaff((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  // ── Add item to cart ──
  const handleAddToCart = () => {
    if (!canAddToCart) return;
    setCart((prev) => [...prev, {
      key: `${Date.now()}-${Math.random()}`,
      type: formItemType,
      ...(formItemType === "snack" && formSelectedSnackDish ? { itemName: formSelectedSnackDish.name } : {}),
      variantLabel: builderVariant?.label ?? "",
      pricePerUnit: builderVariant?.price ?? 0,
      quantity: formQty,
    }]);
    resetItemBuilder();
  };

  // ── Submit batch ──
  const handleAdd = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const consumerName =
        formConsumerType === "staff"
          ? formSelectedStaff.map((id) => availableStaff.find((s) => s._id === id)?.name || "").filter(Boolean).join(", ")
          : formName.trim() || (formConsumerType === "customer" ? "Walk-in" : "Owner");

      await addConsumableBatch({
        items: cart.map((i) => ({
          type: i.type,
          ...(i.itemName ? { itemName: i.itemName } : {}),
          quantity: i.quantity,
          pricePerUnit: i.pricePerUnit,
        })),
        consumerType: formConsumerType,
        consumerName,
        ...(formConsumerType === "customer" && formPhone ? { consumerPhone: formPhone } : {}),
        ...(formConsumerType === "customer" && formAmountPaid !== "" ? { amountPaid: formAmountPaid } : {}),
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

  const tabs: ConsumableType[] = ["tea", "gutka", "cigarette", "snack"];

  return (
    <div className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-8">
      <div className="container mx-auto px-6 py-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="font-display text-2xl font-bold text-dhaba-text">Consumables Tracker</h1>
              <p className="text-sm text-dhaba-muted">Tea, Gutka, Cigarette & Snacks — Sales & Consumption</p>
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
                      <p className="text-sm font-semibold text-dhaba-text">
                        {entry.itemName ? `${entry.itemName} · ` : ""}{entry.consumerName}
                      </p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowAddModal(false); resetForm(); }}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg mx-4 space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-dhaba-text">Add Entry</h2>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="p-1.5 rounded-lg hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger transition-colors">
                <FaTimes size={13} />
              </button>
            </div>

            {/* ── Who ── */}
            <div>
              <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Who?</label>
              <div className="flex gap-2 mb-3">
                {(["customer", "staff", "owner"] as ConsumerType[]).map((ct) => (
                  <button key={ct} onClick={() => handleConsumerTypeSwitch(ct)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${formConsumerType === ct ? "bg-dhaba-accent/15 text-dhaba-accent" : "glass-input text-dhaba-muted hover:text-dhaba-text"}`}>
                    {ct === "customer" ? "🛒 Customer" : ct === "staff" ? "👷 Staff" : "👑 Owner"}
                  </button>
                ))}
              </div>
              {formConsumerType === "customer" ? (
                <CustomerFields
                  value={{ name: formName, phone: formPhone }}
                  onChange={({ name, phone }) => { setFormName(name); setFormPhone(phone); }}
                  inputClassName="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50"
                />
              ) : formConsumerType === "staff" ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {availableStaff.filter((s) => s.role !== "owner").map((s) => (
                      <button key={s._id} onClick={() => toggleStaffSelection(s._id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${formSelectedStaff.includes(s._id) ? "bg-dhaba-accent/20 text-dhaba-accent ring-1 ring-dhaba-accent/40" : "glass-input text-dhaba-muted hover:text-dhaba-text"}`}>
                        {ROLE_EMOJI[s.role]} {s.name}
                        {formSelectedStaff.includes(s._id) && <FaTimes size={8} className="ml-1" />}
                      </button>
                    ))}
                  </div>
                  {formSelectedStaff.length > 0 && <p className="text-[10px] text-dhaba-accent font-semibold">{formSelectedStaff.length} staff selected</p>}
                </div>
              ) : (
                <select value={formName} onChange={(e) => setFormName(e.target.value)}
                  className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none appearance-none">
                  <option value="">Select owner</option>
                  {availableStaff.filter((s) => s.role === "owner").map((s) => (
                    <option key={s._id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* ── Item Builder ── */}
            <div className="glass-card rounded-2xl p-4 space-y-4">
              <p className="text-xs font-bold text-dhaba-muted uppercase tracking-wider">Add Items</p>

              {/* Type chips */}
              <div className="flex flex-wrap gap-2">
                {(["tea", "gutka", "cigarette", "snack"] as ConsumableType[]).map((t) => {
                  const c = consumableConfig[t];
                  return (
                    <button key={t} onClick={() => { setFormItemType(t); resetItemBuilder(); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${formItemType === t ? "bg-dhaba-accent/20 border-dhaba-accent/40 text-dhaba-accent" : "bg-dhaba-surface/60 border-dhaba-border/30 text-dhaba-muted hover:text-dhaba-text"}`}>
                      {c.icon} {c.label}
                    </button>
                  );
                })}
              </div>

              {/* Snack dish picker OR size variant */}
              {formItemType === "snack" ? (
                <div>
                  {snackDishes.length === 0
                    ? <p className="text-xs text-dhaba-muted italic">No snack dishes found. Add dishes with category "snacks" first.</p>
                    : <div className="flex flex-wrap gap-2">
                        {snackDishes.map((dish) => (
                          <button key={dish._id} onClick={() => { setFormSelectedSnackDish(dish); setFormSelectedSnackVariantIdx(0); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${formSelectedSnackDish?._id === dish._id ? "bg-dhaba-accent/20 border-dhaba-accent/40 text-dhaba-accent" : "bg-dhaba-surface/60 border-dhaba-border/30 text-dhaba-muted hover:text-dhaba-text"}`}>
                            {dish.name} <span className="font-normal text-dhaba-muted">₹{dish.variants[0]?.price}</span>
                          </button>
                        ))}
                      </div>
                  }
                  {formSelectedSnackDish && formSelectedSnackDish.variants.length > 1 && (
                    <select value={formSelectedSnackVariantIdx} onChange={(e) => setFormSelectedSnackVariantIdx(Number(e.target.value))}
                      className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none appearance-none mt-2">
                      {formSelectedSnackDish.variants.map((v, i) => (
                        <option key={v.size} value={i} className="bg-dhaba-surface">{v.size} — ₹{v.price}</option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <select value={formVariantIdx} onChange={(e) => setFormVariantIdx(Number(e.target.value))}
                  className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none appearance-none">
                  {builderConfig.variants.map((v, i) => (
                    <option key={v.label} value={i} className="bg-dhaba-surface">{v.label} — ₹{v.price}</option>
                  ))}
                </select>
              )}

              {/* Quantity + Add to cart */}
              <div className="flex items-center gap-3">
                <div className="glass-input rounded-xl flex items-center gap-3 px-3 py-2">
                  <button onClick={() => setFormQty((p) => Math.max(1, p - 1))} className="text-dhaba-accent font-bold text-lg w-5">−</button>
                  <span className="text-dhaba-text font-bold w-5 text-center">{formQty}</span>
                  <button onClick={() => setFormQty((p) => p + 1)} className="text-dhaba-accent font-bold text-lg w-5">+</button>
                </div>
                <div className="text-sm text-dhaba-muted">
                  {builderVariant && builderVariant.price > 0 && (
                    <span className="font-semibold text-dhaba-text">₹{formQty * builderVariant.price}</span>
                  )}
                </div>
                <button onClick={handleAddToCart} disabled={!canAddToCart}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-dhaba-accent/15 text-dhaba-accent text-xs font-bold hover:bg-dhaba-accent/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <FaPlus size={10} /> Add
                </button>
              </div>
            </div>

            {/* ── Cart ── */}
            {cart.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-dhaba-muted uppercase tracking-wider">Cart</p>
                {cart.map((item) => (
                  <div key={item.key} className="flex items-center justify-between glass-input rounded-xl px-4 py-2.5">
                    <div className="text-sm text-dhaba-text font-semibold">
                      {item.itemName ?? item.variantLabel}
                      <span className="ml-2 text-xs font-normal text-dhaba-muted">× {item.quantity}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${formConsumerType === "customer" ? "text-dhaba-success" : "text-dhaba-danger"}`}>
                        {formConsumerType === "customer" ? "+" : "-"}₹{item.quantity * item.pricePerUnit}
                      </span>
                      <button onClick={() => setCart((p) => p.filter((i) => i.key !== item.key))}
                        className="text-dhaba-muted hover:text-dhaba-danger transition-colors">
                        <FaTimes size={11} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-2 text-sm font-bold text-dhaba-text border-t border-dhaba-border/20 mt-1">
                  <span>Total</span>
                  <span className={formConsumerType === "customer" ? "text-dhaba-success" : "text-dhaba-danger"}>
                    {formConsumerType === "customer" ? "+" : "-"}₹{cartTotal}
                  </span>
                </div>
              </div>
            )}

            {/* ── Amount Paid (customer only, cart non-empty) ── */}
            {formConsumerType === "customer" && cart.length > 0 && (
              <div>
                <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">
                  Amount Paid <span className="normal-case font-normal">(leave blank if fully paid)</span>
                </label>
                <input type="number" min={0} max={cartTotal}
                  value={formAmountPaid}
                  onChange={(e) => setFormAmountPaid(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={`₹${cartTotal} (full)`}
                  className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50"
                />
                {formAmountPaid !== "" && formAmountPaid < cartTotal && (
                  <p className={`mt-1.5 text-[11px] font-semibold ${formPhone ? "text-dhaba-warning" : "text-dhaba-danger"}`}>
                    {formPhone
                      ? `₹${cartTotal - formAmountPaid} will be added to ${formName || "customer"}'s ledger`
                      : "Phone required to record due in ledger"}
                  </p>
                )}
              </div>
            )}

            {/* ── Footer ── */}
            <div className="flex gap-3">
              <button onClick={() => { setShowAddModal(false); resetForm(); }} disabled={isSubmitting}
                className="flex-1 glass-input rounded-xl py-2.5 text-dhaba-muted font-semibold text-sm hover:text-dhaba-text transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleAdd} disabled={isSubmitting || !canSubmit}
                className="flex-1 bg-gradient-warm text-dhaba-bg rounded-xl py-2.5 font-bold text-sm hover:shadow-glow transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {isSubmitting
                  ? <><div className="w-4 h-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" /> Saving…</>
                  : `Save ${cart.length > 0 ? `(${cart.length} item${cart.length > 1 ? "s" : ""})` : ""}`}
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
