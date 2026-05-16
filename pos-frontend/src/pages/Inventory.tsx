import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInventoryDashboard,
  getInventoryCycleHistory,
  getInventoryVariants,
  updateInventoryCycle,
  updateExpensePresetPieceMap,
  updateInventoryConfig,
} from "../https";
import type { InventoryItem, StockCycle, TrackingMode } from "../types";
import { enqueueSnackbar } from "notistack";
import { FaBoxOpen, FaChartLine, FaHistory, FaExclamationTriangle, FaPuzzlePiece, FaClock } from "react-icons/fa";
import { MdRefresh, MdInventory } from "react-icons/md";
import Skeleton from "../components/shared/Skeleton";
import BackButton from "../components/shared/BackButton";

const labelClass = "text-[10px] font-black text-white/40 uppercase tracking-[0.2em]";
const valueClass = "font-display text-xl font-black text-white/90 tracking-tight";

function DaysTag({ days }: { days: number | null }) {
  if (days === null) return <span className="text-white/30 text-sm font-medium">—</span>;
  const color = days <= 1
    ? "text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.3)]"
    : days <= 3
      ? "text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.3)]"
      : "text-emerald-400";
  return <span className={`font-display text-xl font-black ${color}`}>{days.toFixed(1)} <span className="text-sm font-bold opacity-70">days</span></span>;
}

function CycleHistoryPanel({
  rawMaterial,
  consumptionUnit,
  trackingMode,
  onClose,
}: {
  rawMaterial: string;
  consumptionUnit: string;
  trackingMode: "order-linked" | "time-linked";
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["inventory-cycles", rawMaterial],
    queryFn: () =>
      getInventoryCycleHistory(rawMaterial).then((r) => r.data.data as StockCycle[]),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isEarlyRestock }: { id: string; isEarlyRestock: boolean }) =>
      updateInventoryCycle(id, { isEarlyRestock }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-cycles", rawMaterial] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      enqueueSnackbar("Cycle updated", { variant: "success" });
    },
    onError: () => enqueueSnackbar("Failed to update cycle", { variant: "error" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="glass-card w-full max-w-lg rounded-[1.5rem] overflow-hidden flex flex-col max-h-[85vh] border border-white/10 shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />

        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 relative z-10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <FaHistory className="text-blue-400 text-sm" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-white/90 tracking-wide">{rawMaterial}</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Cycle History</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[11px] font-black text-white/50 hover:text-white uppercase tracking-wider px-4 py-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-4 relative z-10 scrollbar-hide">
          {isLoading && <Skeleton className="h-[120px] rounded-xl" count={3} />}
          {!isLoading && (!data || data.length === 0) && (
            <div className="text-center py-12 flex flex-col items-center justify-center">
              <FaHistory className="text-2xl text-white/20 mb-3" />
              <p className="text-white/80 font-black tracking-wide">No cycles recorded</p>
            </div>
          )}

          {data?.map((cycle) => (
            <div
              key={cycle._id}
              className={`rounded-[1.25rem] p-5 border transition-all ${cycle.cycleStatus === "active"
                ? "border-blue-500/30 bg-blue-500/10"
                : "border-white/10 bg-[#1e293b]"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${cycle.cycleStatus === "active"
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      : "bg-white/5 text-white/40 border-white/10"}`}>
                      {cycle.cycleStatus === "active" ? "Active" : "Closed"}
                    </span>
                    {cycle.isEarlyRestock && (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider bg-orange-500/10 text-orange-400 border-orange-500/30">
                        Early Restock
                      </span>
                    )}
                  </div>
                  <p className="font-display text-xl font-black text-white/90">
                    {cycle.quantityKg} <span className="text-sm text-white/50">kg</span>
                  </p>
                  <p className="text-[11px] font-bold text-white/40">
                    <span className="text-white/60">Start:</span> {new Date(cycle.startDate).toLocaleString("en-IN")}
                    {cycle.endDate && <> → <span className="text-white/60">End:</span> {new Date(cycle.endDate).toLocaleString("en-IN")}</>}
                  </p>

                  {cycle.cycleStatus === "closed" && (
                    <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-white/30">Performance</p>
                      {trackingMode === "time-linked" ? (
                        <p className="text-sm font-bold text-white/70">
                          Lasted <span className="text-emerald-400 font-black">{cycle.daysLasted?.toFixed(1) ?? "—"} days</span>
                        </p>
                      ) : (
                        <p className="text-sm font-bold text-white/70">
                          <span className="text-white/90">{cycle.unitsConsumed}</span> {consumptionUnit} →{" "}
                          <span className="text-emerald-400 font-black bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {cycle.unitsConsumed > 0 ? (cycle.quantityKg / cycle.unitsConsumed).toFixed(3) : "—"} kg/{consumptionUnit}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {cycle.cycleStatus === "closed" && (
                  <label className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0 mt-1">
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Early</span>
                    <input
                      type="checkbox"
                      checked={cycle.isEarlyRestock}
                      onChange={(e) => toggleMutation.mutate({ id: cycle._id, isEarlyRestock: e.target.checked })}
                      className="h-4 w-4 accent-orange-400 rounded-sm bg-white/10 border-white/20"
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PieceMapEditor({
  presetId,
  rawMaterial,
  variantPieceMap,
}: {
  presetId: string;
  rawMaterial: string;
  variantPieceMap: Record<string, number> | null;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Fetch real variant names from dishes tagged to this raw material
  const { data: variantKeys = [], isLoading: variantsLoading } = useQuery({
    queryKey: ["inventory-variants", rawMaterial],
    queryFn: () => getInventoryVariants(rawMaterial).then((r) => r.data.data as string[]),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Derive the keys to show: real variants from DB, plus _default fallback
  const allKeys = variantKeys.length > 0
    ? [...new Set([...variantKeys, "_default"])]
    : ["_default"];

  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    allKeys.forEach((k) => {
      base[k] = variantPieceMap?.[k] !== undefined ? String(variantPieceMap[k]) : "";
    });
    return base;
  });

  // Sync draft when allKeys change (variants loaded from API)
  const syncedKeys = JSON.stringify(allKeys);
  React.useEffect(() => {
    setDraft((prev) => {
      const next: Record<string, string> = {};
      allKeys.forEach((k) => {
        next[k] = prev[k] ?? (variantPieceMap?.[k] !== undefined ? String(variantPieceMap[k]) : "");
      });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncedKeys]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const map: Record<string, number> = {};
      for (const [k, v] of Object.entries(draft)) {
        const n = parseFloat(v);
        if (!isNaN(n) && n > 0) map[k] = n;
      }
      return updateExpensePresetPieceMap(presetId, Object.keys(map).length > 0 ? map : null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      enqueueSnackbar("Piece map saved", { variant: "success" });
      setOpen(false);
    },
    onError: () => enqueueSnackbar("Failed to save piece map", { variant: "error" }),
  });

  const displayLabel = (key: string) => key === "_default" ? "Default (1pc)" : key;

  return (
    <div className="border border-white/5 rounded-2xl overflow-hidden relative z-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FaPuzzlePiece className="text-purple-400 text-xs" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Piece Map</span>
          {variantPieceMap && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider">
              Active
            </span>
          )}
        </div>
        <span className="text-[10px] font-black text-white/30 uppercase tracking-wider">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 bg-black/20 flex flex-col gap-3">
          <p className="text-[10px] text-white/30 font-medium">
            Pieces per variant for 1 {rawMaterial} order
          </p>
          {variantsLoading ? (
            <Skeleton className="h-10 rounded-lg" count={1} />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {allKeys.map((key) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/40">
                    {displayLabel(key)}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="—"
                    value={draft[key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-white/80 text-center focus:outline-none focus:border-purple-500/50 focus:bg-purple-500/5 transition-colors"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex-1 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[11px] font-black uppercase tracking-wider hover:bg-purple-500/30 transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 text-[11px] font-black uppercase tracking-wider hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const STOCK_UNITS = ["kg", "ltr", "pc", "cylinder", "tray", "packet", "box"];
const CONSUMPTION_UNITS = ["plates", "pc", "ltr", "days", "servings", "kg"];

function InventoryConfigEditor({
  item,
}: {
  item: Pick<InventoryItem, "presetId" | "rawMaterial" | "trackingMode" | "stockUnit" | "consumptionUnit" | "stockToConsumptionFactor" | "aliases">;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    trackingMode: item.trackingMode as TrackingMode,
    stockUnit: item.stockUnit,
    consumptionUnit: item.consumptionUnit,
    stockToConsumptionFactor: String(item.stockToConsumptionFactor),
    aliasInput: "",
    aliases: [...(item.aliases ?? [])],
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      updateInventoryConfig(item.presetId, {
        trackingMode: draft.trackingMode,
        stockUnit: draft.stockUnit,
        consumptionUnit: draft.consumptionUnit,
        stockToConsumptionFactor: parseFloat(draft.stockToConsumptionFactor) || 1,
        aliases: draft.aliases,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      enqueueSnackbar("Inventory config saved", { variant: "success" });
      setOpen(false);
    },
    onError: () => enqueueSnackbar("Failed to save config", { variant: "error" }),
  });

  const addAlias = () => {
    const val = draft.aliasInput.trim().toLowerCase();
    if (val && !draft.aliases.includes(val)) {
      setDraft((d) => ({ ...d, aliases: [...d.aliases, val], aliasInput: "" }));
    }
  };

  const removeAlias = (alias: string) =>
    setDraft((d) => ({ ...d, aliases: d.aliases.filter((a) => a !== alias) }));

  return (
    <div className="border border-white/5 rounded-2xl overflow-hidden relative z-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MdInventory className="text-indigo-400 text-xs" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Tracking Config</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${item.trackingMode === "time-linked"
            ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
            {item.trackingMode === "time-linked" ? "Time" : "Order"}
          </span>
        </div>
        <span className="text-[10px] font-black text-white/30">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 bg-black/20 flex flex-col gap-4">
          {/* Tracking mode */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Tracking Mode</p>
            <div className="flex gap-2">
              {(["order-linked", "time-linked"] as TrackingMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDraft((d) => ({ ...d, trackingMode: mode }))}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${draft.trackingMode === mode
                    ? mode === "time-linked"
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400"
                      : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"}`}
                >
                  {mode === "time-linked" ? "Time-linked" : "Order-linked"}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-white/30 mt-1.5">
              {draft.trackingMode === "time-linked"
                ? "Gas, cylinder — tracks days lasted per fill"
                : "Food items — counts plates sold from orders"}
            </p>
          </div>

          {/* Units row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5">Stock Unit</p>
              <select
                value={draft.stockUnit}
                onChange={(e) => setDraft((d) => ({ ...d, stockUnit: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-white/80 focus:outline-none focus:border-indigo-500/50 transition-colors"
              >
                {STOCK_UNITS.map((u) => <option key={u} value={u} className="bg-[#1e293b]">{u}</option>)}
              </select>
              <p className="text-[9px] text-white/30 mt-1">purchase / fill unit</p>
            </div>
            {draft.trackingMode === "order-linked" && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5">Consumption Unit</p>
                <select
                  value={draft.consumptionUnit}
                  onChange={(e) => setDraft((d) => ({ ...d, consumptionUnit: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-white/80 focus:outline-none focus:border-indigo-500/50 transition-colors"
                >
                  {CONSUMPTION_UNITS.map((u) => <option key={u} value={u} className="bg-[#1e293b]">{u}</option>)}
                </select>
                <p className="text-[9px] text-white/30 mt-1">unit shown in stats</p>
              </div>
            )}
          </div>

          {/* Aliases */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Name Aliases</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="e.g. anda, maachh"
                value={draft.aliasInput}
                onChange={(e) => setDraft((d) => ({ ...d, aliasInput: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAlias())}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-bold text-white/80 focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-white/20"
              />
              <button
                onClick={addAlias}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-black hover:bg-indigo-500/30 transition-colors"
              >
                Add
              </button>
            </div>
            {draft.aliases.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {draft.aliases.map((alias) => (
                  <span key={alias} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60">
                    {alias}
                    <button onClick={() => removeAlias(alias)} className="text-white/30 hover:text-red-400 transition-colors ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[9px] text-white/30 mt-1.5">Hindi/regional names matched in custom order items</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1 border-t border-white/5">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex-1 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[11px] font-black uppercase tracking-wider hover:bg-indigo-500/30 transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save Config"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 text-[11px] font-black uppercase tracking-wider hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryCard({ item }: { item: InventoryItem }) {
  const [showHistory, setShowHistory] = useState(false);
  const [targetDays, setTargetDays] = useState(7);
  const { consumptionUnit, stockUnit, trackingMode, avgDaysLasted } = item;

  const isTimeLinkd = trackingMode === "time-linked";

  const restockQty =
    !isTimeLinkd && item.consumptionRate && item.dailyUnitRate > 0
      ? (item.dailyUnitRate * targetDays * item.consumptionRate).toFixed(2)
      : null;

  const isLowStock = item.prediction.daysRemaining !== null && item.prediction.daysRemaining <= 3;

  return (
    <>
      <div className={`glass-card rounded-[1.5rem] p-6 flex flex-col gap-5 border shadow-sm relative overflow-hidden group transition-all duration-300 ${isLowStock
        ? "border-orange-500/30 hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(251,146,60,0.15)]"
        : "border-dhaba-border/20 hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]"}`}>
        <div className={`absolute inset-0 bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isLowStock ? "from-orange-500/10" : "from-blue-500/5"}`} />

        {/* Header */}
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border ${isLowStock ? "bg-orange-500/10 border-orange-500/20 text-orange-400" : "bg-white/5 border-white/10 text-white/60"}`}>
              {isTimeLinkd ? <FaClock className="text-xl" /> : <FaBoxOpen className="text-xl" />}
            </div>
            <div className="flex flex-col justify-center">
              <h3 className="font-display font-black text-white/90 text-xl tracking-wide">{item.rawMaterial}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${item.activeCycle
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-white/5 text-white/40 border-white/10"}`}>
                  {item.activeCycle ? `${item.activeCycle.quantityKg} ${stockUnit} Active` : "No active stock"}
                </span>
                {isTimeLinkd && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                    Time-linked
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group/btn"
            title="Cycle history"
          >
            <FaHistory className="text-white/40 group-hover/btn:text-white/90 text-sm" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 relative z-10">
          {isTimeLinkd ? (
            <>
              <div className="bg-[#1e293b] border border-white/5 rounded-2xl p-4 flex flex-col justify-center shadow-inner">
                <p className={labelClass}>Avg Duration</p>
                <p className={`${valueClass} mt-1`}>{avgDaysLasted?.toFixed(1) ?? "—"}</p>
                <p className="text-[10px] font-bold text-white/30 mt-0.5">days/{stockUnit}</p>
              </div>
              <div className="bg-[#1e293b] border border-white/5 rounded-2xl p-4 flex flex-col justify-center shadow-inner col-span-2">
                <p className={labelClass}>Cycles</p>
                <p className={`${valueClass} mt-1`}>{item.closedCyclesCount}</p>
                <p className="text-[10px] font-bold text-white/30 mt-0.5">completed</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-[#1e293b] border border-white/5 rounded-2xl p-4 flex flex-col justify-center shadow-inner">
                <p className={labelClass}>Daily Avg</p>
                <p className={`${valueClass} mt-1`}>{item.dailyUnitRate.toFixed(1)}</p>
                <p className="text-[10px] font-bold text-white/30 mt-0.5">{consumptionUnit}/day</p>
              </div>
              <div className="bg-[#1e293b] border border-white/5 rounded-2xl p-4 flex flex-col justify-center shadow-inner">
                <p className={labelClass}>Usage</p>
                <p className={`${valueClass} mt-1`}>
                  {item.consumptionRate !== null ? `${(item.consumptionRate * 1000).toFixed(0)}g` : "—"}
                </p>
                <p className="text-[10px] font-bold text-white/30 mt-0.5">per {consumptionUnit}</p>
              </div>
              <div className="bg-[#1e293b] border border-white/5 rounded-2xl p-4 flex flex-col justify-center shadow-inner">
                <p className={labelClass}>{consumptionUnit} Sold</p>
                <p className={`${valueClass} mt-1`}>
                  {item.activeUnitsConsumed !== null ? item.activeUnitsConsumed : "—"}
                </p>
                <p className="text-[10px] font-bold text-white/30 mt-0.5">this cycle</p>
              </div>
            </>
          )}
        </div>

        {/* Prediction */}
        <div className="bg-gradient-to-r from-white/5 to-transparent border border-white/5 rounded-2xl p-4 flex items-center justify-between relative z-10">
          <div>
            <p className={`${labelClass} mb-1`}>Estimated Runway</p>
            <DaysTag days={item.prediction.daysRemaining} />
          </div>
          {item.activeCycle && !isTimeLinkd && item.consumptionRate === null && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-2 max-w-[140px]">
              <p className="text-[9px] font-bold text-white/50 leading-tight text-right">
                Complete first cycle to enable predictions
              </p>
            </div>
          )}
          {item.activeCycle && isTimeLinkd && avgDaysLasted === null && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-2 max-w-[140px]">
              <p className="text-[9px] font-bold text-white/50 leading-tight text-right">
                Complete first cycle to calibrate duration
              </p>
            </div>
          )}
        </div>

        {/* Restock recommendation — order-linked only */}
        {!isTimeLinkd && item.consumptionRate !== null && item.dailyUnitRate > 0 && (
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-5 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FaChartLine className="text-blue-400 text-sm" />
                <p className={`${labelClass} text-blue-400/80`}>Restock Planner</p>
              </div>
              <div className="flex gap-1.5 bg-black/20 p-1 rounded-xl border border-white/5">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setTargetDays(d)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${targetDays === d
                      ? "bg-blue-500 text-white shadow-lg"
                      : "text-white/40 hover:text-white/80 hover:bg-white/5"}`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end justify-between border-t border-blue-500/10 pt-3">
              <p className="text-xs font-bold text-white/40">Suggested Purchase</p>
              <p className="font-display font-black text-blue-400 text-2xl drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">
                {restockQty} <span className="text-sm opacity-70">{stockUnit}</span>
              </p>
            </div>
          </div>
        )}

        {/* Piece map config — order-linked only */}
        {!isTimeLinkd && (
          <PieceMapEditor
            presetId={item.presetId}
            rawMaterial={item.rawMaterial}
            variantPieceMap={item.variantPieceMap}
          />
        )}

        {/* Inventory tracking config */}
        <InventoryConfigEditor item={item} />

        {/* Cycles count */}
        <div className="flex items-center justify-between mt-auto pt-2 relative z-10">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/30 uppercase tracking-widest">
            <FaHistory className="text-[9px]" />
            <span>{item.closedCyclesCount} closed {item.closedCyclesCount === 1 ? "cycle" : "cycles"}</span>
          </div>
        </div>
      </div>

      {showHistory && (
        <CycleHistoryPanel
          rawMaterial={item.rawMaterial}
          consumptionUnit={consumptionUnit}
          trackingMode={trackingMode}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}

const Inventory: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => getInventoryDashboard().then((r) => r.data.data as InventoryItem[]),
    staleTime: 60 * 1000,
  });

  const totalItems = data?.length || 0;
  const lowStockItems = data?.filter(i => i.prediction.daysRemaining !== null && i.prediction.daysRemaining <= 3).length || 0;
  const activeCycles = data?.filter(i => i.activeCycle).length || 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-dhaba-bg relative overflow-y-auto">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] z-0 pointer-events-none" />
      <div className="fixed top-[20%] right-[-10%] w-[30%] h-[30%] bg-emerald-500/10 rounded-full blur-[100px] z-0 pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col pb-24 px-4 sm:px-6 md:px-8 max-w-6xl mx-auto w-full pt-8 space-y-8">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="font-display text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tracking-wide">
                Inventory
              </h1>
              <p className="text-sm text-white/50 mt-1 font-medium tracking-wide">
                Stock cycles, consumption rates, and restock predictions
              </p>
            </div>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["inventory"] })}
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group shrink-0"
            title="Refresh Data"
          >
            <MdRefresh className="text-white/60 group-hover:text-white group-hover:rotate-180 transition-all duration-500 text-xl" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card rounded-[1.25rem] p-5 flex flex-col gap-3 border border-dhaba-border/20 shadow-sm relative overflow-hidden group hover:border-blue-500/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
              <MdInventory className="text-blue-400 text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Tracked Items</p>
              <p className="font-display text-2xl font-black text-white/90 mt-0.5 tracking-tight">{totalItems}</p>
            </div>
          </div>
          <div className="glass-card rounded-[1.25rem] p-5 flex flex-col gap-3 border border-dhaba-border/20 shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <FaBoxOpen className="text-emerald-400 text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Active Cycles</p>
              <p className="font-display text-2xl font-black text-emerald-400 mt-0.5 tracking-tight drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">{activeCycles}</p>
            </div>
          </div>
          <div className="glass-card rounded-[1.25rem] p-5 flex flex-col gap-3 border border-dhaba-border/20 shadow-sm relative overflow-hidden group hover:border-orange-500/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20">
              <FaExclamationTriangle className="text-orange-400 text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Low Stock</p>
              <p className={`font-display text-2xl font-black mt-0.5 tracking-tight ${lowStockItems > 0 ? "text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.3)]" : "text-white/90"}`}>
                {lowStockItems}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Skeleton className="h-[300px] rounded-[1.5rem]" count={4} gap="gap-5" />
          </div>
        )}

        {isError && (
          <div className="text-center py-20 flex flex-col items-center justify-center glass-card rounded-[1.5rem] border border-red-500/20 bg-red-500/5">
            <FaExclamationTriangle className="text-2xl text-red-400 mb-4" />
            <p className="text-red-400 font-black tracking-wide text-lg">Failed to load inventory</p>
            <p className="text-xs text-red-400/60 mt-1">Please check your connection and try again.</p>
          </div>
        )}

        {!isLoading && data?.length === 0 && (
          <div className="text-center py-20 flex flex-col items-center justify-center glass-card rounded-[1.5rem] border border-white/5">
            <FaBoxOpen className="text-3xl text-white/20 mb-4" />
            <p className="text-white/80 font-black tracking-wide text-lg">No materials found</p>
            <p className="text-xs text-white/40 mt-1 max-w-[250px]">
              Add Raw Material expense presets in Settings to start tracking inventory cycles.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {data?.map((item) => (
            <InventoryCard key={item.rawMaterial} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Inventory;
