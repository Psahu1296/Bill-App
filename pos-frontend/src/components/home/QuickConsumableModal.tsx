import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaCoffee, FaBox, FaMinus, FaPlus } from "react-icons/fa";
import { GiCigarette } from "react-icons/gi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addConsumable, getAllStaff, getDishes } from "../../https";
import { enqueueSnackbar } from "notistack";
import type { ConsumableType, ConsumerType, StaffMember, Dish } from "../../types";

interface QuickConsumableModalProps {
  onClose: () => void;
}

interface SizeVariant {
  label: string;
  price: number;
}

interface TypeConfig {
  key: ConsumableType;
  label: string;
  icon: React.ReactNode;
  unit: string;
  variants: SizeVariant[];
}

const DEFAULT_TYPES: TypeConfig[] = [
  {
    key: "tea",
    label: "Tea / Chai",
    icon: <FaCoffee />,
    unit: "cup",
    variants: [
      { label: "Regular", price: 10 },
      { label: "Large",   price: 20 },
    ],
  },
  {
    key: "cigarette",
    label: "Cigarette",
    icon: <GiCigarette />,
    unit: "stick",
    variants: [{ label: "Stick", price: 20 }],
  },
  {
    key: "gutka",
    label: "Gutka",
    icon: <FaBox />,
    unit: "pouch",
    variants: [
      { label: "Regular", price: 5 },
      { label: "Large",   price: 10 },
    ],
  },
];

const dishToType = (dish: Dish): ConsumableType | null => {
  const n = dish.name.toLowerCase();
  if (n.includes("tea") || n.includes("chai")) return "tea";
  if (n.includes("gutka")) return "gutka";
  if (n.includes("cigarette") || n.includes("cig")) return "cigarette";
  return null;
};

const CONSUMERS: { key: ConsumerType; label: string }[] = [
  { key: "customer", label: "Customer" },
  { key: "staff",    label: "Staff"    },
  { key: "owner",    label: "Owner"    },
];

const CHIP_BASE = "flex flex-col items-center gap-1 py-2.5 rounded-2xl border transition-colors text-xs font-semibold";
const CHIP_ON   = "bg-dhaba-accent/15 border-dhaba-accent/40 text-dhaba-accent";
const CHIP_OFF  = "bg-dhaba-surface border-dhaba-border/20 text-dhaba-muted hover:text-dhaba-text hover:border-dhaba-border/40";

const QuickConsumableModal: React.FC<QuickConsumableModalProps> = ({ onClose }) => {
  const queryClient = useQueryClient();

  const [types,         setTypes]         = useState<TypeConfig[]>(DEFAULT_TYPES);
  const [type,          setType]          = useState<ConsumableType>("tea");
  const [consumerType,  setConsumerType]  = useState<ConsumerType>("customer");
  const [qty,           setQty]           = useState(1);
  const [variantIdx,    setVariantIdx]    = useState(0);

  // Customer fields
  const [custName,  setCustName]  = useState("");
  const [custPhone, setCustPhone] = useState("");

  // Staff / owner
  const [allStaff,       setAllStaff]       = useState<StaffMember[]>([]);
  const [selectedStaff,  setSelectedStaff]  = useState<string[]>([]);
  const [selectedOwner,  setSelectedOwner]  = useState("");

  useEffect(() => {
    getAllStaff({ isActive: "true" })
      .then((res) => setAllStaff(res.data?.data ?? []))
      .catch(() => {});
    getDishes()
      .then((res) => {
        const dishes: Dish[] = res.data?.data ?? [];
        setTypes((prev) =>
          prev.map((cfg) => {
            const match = dishes.find((d) => dishToType(d) === cfg.key);
            if (match && match.variants.length > 0) {
              return { ...cfg, variants: match.variants.map((v) => ({ label: v.size, price: v.price })) };
            }
            return cfg;
          })
        );
      })
      .catch(() => {});
  }, []);

  const selected      = types.find((t) => t.key === type)!;
  const activeVariant = selected.variants[variantIdx] ?? selected.variants[0];

  const staffList = allStaff.filter((s) => s.role !== "owner");
  const ownerList = allStaff.filter((s) => s.role === "owner");

  const handleTypeSwitch = (key: ConsumableType) => {
    setType(key);
    setVariantIdx(0);
  };

  const handleConsumerSwitch = (key: ConsumerType) => {
    setConsumerType(key);
    setSelectedStaff([]);
    setSelectedOwner("");
    setCustName("");
    setCustPhone("");
  };

  const toggleStaff = (id: string) =>
    setSelectedStaff((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // Derive final consumer name for the payload
  const resolvedName = (() => {
    if (consumerType === "customer") return custName.trim() || "Walk-in";
    if (consumerType === "staff")
      return selectedStaff
        .map((id) => allStaff.find((s) => s._id === id)?.name ?? "")
        .filter(Boolean)
        .join(", ") || "Staff";
    return selectedOwner || "Owner";
  })();

  const canSubmit = (() => {
    if (consumerType === "staff") return selectedStaff.length > 0;
    return true; // customer & owner: name is optional (falls back to default)
  })();

  const mutation = useMutation({
    mutationFn: () =>
      addConsumable({
        type,
        quantity:     qty,
        pricePerUnit: activeVariant.price,
        consumerType,
        consumerName: resolvedName,
        staffIds: consumerType === "staff" ? selectedStaff : undefined,
      }),
    onSuccess: () => {
      enqueueSnackbar(`${selected.label} ×${qty} logged!`, { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["consumables"] });
      onClose();
    },
    onError: () => enqueueSnackbar("Failed to log entry.", { variant: "error" }),
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="glass-card w-full max-w-sm rounded-3xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-dhaba-border/20">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-dhaba-accent/10 flex items-center justify-center text-dhaba-accent">
                <FaCoffee />
              </div>
              <h2 className="font-display text-base font-bold text-dhaba-text">Quick Entry</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group">
              <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger text-sm" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Type picker */}
            <div className="grid grid-cols-3 gap-2">
              {types.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => handleTypeSwitch(key)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-colors text-sm font-semibold
                    ${type === key ? CHIP_ON : CHIP_OFF}`}
                >
                  <span className="text-xl">{icon}</span>
                  <span className="text-[11px] font-bold leading-tight text-center">{label}</span>
                </button>
              ))}
            </div>

            {/* Size variant dropdown */}
            <div>
              <p className="text-[10px] text-dhaba-muted uppercase tracking-wider font-bold mb-1.5">Size</p>
              <select
                value={variantIdx}
                onChange={(e) => setVariantIdx(Number(e.target.value))}
                className="w-full bg-dhaba-surface border border-dhaba-border/20 rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none appearance-none focus:border-dhaba-accent/40 transition-colors"
              >
                {selected.variants.map((v, i) => (
                  <option key={v.label} value={i} className="bg-dhaba-surface text-dhaba-text">
                    {v.label} — ₹{v.price}
                  </option>
                ))}
              </select>
            </div>

            {/* Consumer type */}
            <div className="grid grid-cols-3 gap-2">
              {CONSUMERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleConsumerSwitch(key)}
                  className={`${CHIP_BASE} ${consumerType === key ? CHIP_ON : CHIP_OFF}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Consumer-specific input */}
            {consumerType === "customer" && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="Name (optional)"
                  className="w-full bg-dhaba-surface border border-dhaba-border/20 rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50 focus:border-dhaba-accent/40 transition-colors"
                />
                <input
                  type="tel"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full bg-dhaba-surface border border-dhaba-border/20 rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50 focus:border-dhaba-accent/40 transition-colors"
                />
              </div>
            )}

            {consumerType === "staff" && (
              <div className="space-y-2">
                <p className="text-[10px] text-dhaba-muted uppercase tracking-wider font-bold">Select staff</p>
                {staffList.length === 0 ? (
                  <p className="text-xs text-dhaba-muted">No active staff found</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {staffList.map((s) => {
                      const active = selectedStaff.includes(s._id);
                      return (
                        <button
                          key={s._id}
                          onClick={() => toggleStaff(s._id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5
                            ${active ? CHIP_ON : CHIP_OFF}`}
                        >
                          {s.name}
                          {active && <FaTimes size={8} />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedStaff.length > 0 && (
                  <p className="text-[10px] text-dhaba-accent font-semibold">{selectedStaff.length} selected</p>
                )}
              </div>
            )}

            {consumerType === "owner" && (
              <div className="space-y-2">
                <p className="text-[10px] text-dhaba-muted uppercase tracking-wider font-bold">Select owner</p>
                {ownerList.length === 0 ? (
                  <p className="text-xs text-dhaba-muted">No owners in staff list</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {ownerList.map((s) => {
                      const active = selectedOwner === s.name;
                      return (
                        <button
                          key={s._id}
                          onClick={() => setSelectedOwner(active ? "" : s.name)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
                            ${active ? CHIP_ON : CHIP_OFF}`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Quantity + price */}
            <div className="flex items-center justify-between bg-dhaba-surface rounded-2xl px-4 py-3">
              <div>
                <p className="text-[10px] text-dhaba-muted uppercase tracking-wider font-bold">Quantity</p>
                <p className="text-[11px] text-dhaba-muted mt-0.5">
                  ₹{activeVariant.price} / {selected.unit} · Total ₹{activeVariant.price * qty}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="h-8 w-8 rounded-xl bg-dhaba-bg flex items-center justify-center text-dhaba-muted hover:text-dhaba-text transition-colors"
                >
                  <FaMinus className="text-xs" />
                </button>
                <span className="font-display text-2xl font-bold text-dhaba-text w-8 text-center tabular-nums">
                  {qty}
                </span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="h-8 w-8 rounded-xl bg-dhaba-accent/10 flex items-center justify-center text-dhaba-accent hover:bg-dhaba-accent/20 transition-colors"
                >
                  <FaPlus className="text-xs" />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-dhaba-border/20 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-dhaba-muted font-bold text-sm hover:text-dhaba-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !canSubmit}
              className="flex-1 bg-gradient-warm text-dhaba-bg py-2.5 rounded-xl font-bold text-sm hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {mutation.isPending && (
                <span className="h-3.5 w-3.5 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
              )}
              Log Entry
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default QuickConsumableModal;
