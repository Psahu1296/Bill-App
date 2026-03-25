import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bulkAddDishes, getSavedDishCatalog, saveCurrentDishesAsCatalog, patchDishCatalog } from "../../https";
import { enqueueSnackbar } from "notistack";
import { DEFAULT_DISH_CATALOG } from "../../data/defaultDishCatalog";
import type { Dish } from "../../types";
import { FaCloudDownloadAlt, FaLeaf, FaSave, FaHistory, FaPlus, FaTimes, FaChevronDown, FaChevronUp } from "react-icons/fa";

interface CatalogEntry {
  name: string;
  image: string;
  type: string;
  category: string;
  variants: { size: string; price: number }[];
  description: string;
  isAvailable: boolean;
  isFrequent: boolean;
}

interface Props {
  existingDishes: Dish[];
}

const TYPE_COLOR: Record<string, string> = {
  veg: "text-green-400 bg-green-400/10",
  "non-veg": "text-red-400 bg-red-400/10",
  main_course: "text-orange-400 bg-orange-400/10",
  beverage: "text-blue-400 bg-blue-400/10",
};

// ── Selectable dish row ───────────────────────────────────────────────────────

interface DishRowProps {
  dish: CatalogEntry;
  selected: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}

const DishRow: React.FC<DishRowProps> = ({ dish, selected, onToggle, action }) => (
  <div
    className={`glass-card rounded-xl px-4 py-2.5 flex items-center gap-3 transition-all border cursor-pointer ${
      selected ? "border-dhaba-accent/50 bg-dhaba-accent/5" : "border-transparent hover:border-dhaba-border/30"
    }`}
    onClick={onToggle}
  >
    <div className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
      selected ? "bg-dhaba-accent border-dhaba-accent" : "border-dhaba-border/40"
    }`}>
      {selected && <div className="h-2 w-2 rounded-sm bg-dhaba-bg" />}
    </div>
    <div className={`h-2.5 w-2.5 rounded-sm border-2 flex-shrink-0 ${dish.type === "veg" ? "border-green-400" : "border-red-400"}`} />
    <span className="text-sm text-dhaba-text font-medium flex-1 capitalize">{dish.name}</span>
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize hidden sm:inline ${TYPE_COLOR[dish.type] ?? "text-dhaba-muted bg-dhaba-surface"}`}>
      {dish.type.replace("_", " ")}
    </span>
    <div className="flex gap-1">
      {dish.variants.map((v) => (
        <span key={v.size} className="text-[11px] text-dhaba-muted bg-dhaba-surface px-2 py-0.5 rounded-lg">
          {v.size} ₹{v.price}
        </span>
      ))}
    </div>
    {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const DefaultDishesTab: React.FC<Props> = ({ existingDishes }) => {
  const queryClient = useQueryClient();
  const [addFromMenuOpen, setAddFromMenuOpen] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [selectedToImport, setSelectedToImport] = useState<{ saved: Set<string>; builtin: Set<string> }>({
    saved: new Set(), builtin: new Set(),
  });

  const existingNames = useMemo(
    () => new Set(existingDishes.map((d) => d.name.trim().toLowerCase())),
    [existingDishes]
  );

  const { data: savedCatalogRes } = useQuery({
    queryKey: ["dish-catalog"],
    queryFn: getSavedDishCatalog,
  });
  const savedCatalog = (savedCatalogRes?.data as { data?: { dishes: CatalogEntry[]; savedAt: string } })?.data;
  const savedCatalogNames = useMemo(
    () => new Set((savedCatalog?.dishes ?? []).map((d: CatalogEntry) => d.name.trim().toLowerCase())),
    [savedCatalog]
  );

  // Menu dishes not yet in the saved catalog
  const menuNotInCatalog = useMemo(
    () => existingDishes.filter((d) => !savedCatalogNames.has(d.name.trim().toLowerCase())),
    [existingDishes, savedCatalogNames]
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: saveCurrentDishesAsCatalog,
    onSuccess: (res) => {
      enqueueSnackbar((res.data as { message?: string })?.message ?? "Catalog saved!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["dish-catalog"] });
    },
    onError: () => enqueueSnackbar("Failed to save catalog.", { variant: "error" }),
  });

  const addToCatalogMutation = useMutation({
    mutationFn: (dishes: CatalogEntry[]) => patchDishCatalog({ add: dishes }),
    onSuccess: (res) => {
      enqueueSnackbar((res.data as { message?: string })?.message ?? "Added to catalog!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["dish-catalog"] });
      setSelectedToAdd(new Set());
      setAddFromMenuOpen(false);
    },
    onError: () => enqueueSnackbar("Failed to update catalog.", { variant: "error" }),
  });

  const removeFromCatalogMutation = useMutation({
    mutationFn: (names: string[]) => patchDishCatalog({ remove: names }),
    onSuccess: () => {
      enqueueSnackbar("Removed from catalog.", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["dish-catalog"] });
    },
    onError: () => enqueueSnackbar("Failed to remove.", { variant: "error" }),
  });

  const importMutation = useMutation({
    mutationFn: (dishes: CatalogEntry[]) => bulkAddDishes(dishes),
    onSuccess: (res) => {
      enqueueSnackbar((res.data as { message?: string })?.message ?? "Dishes imported!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
      queryClient.invalidateQueries({ queryKey: ["popularDishes"] });
      setSelectedToImport({ saved: new Set(), builtin: new Set() });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(err.response?.data?.message ?? "Import failed.", { variant: "error" });
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toggleAddSelect = (name: string) =>
    setSelectedToAdd((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const toggleImportSelect = (section: "saved" | "builtin", name: string) =>
    setSelectedToImport((prev) => {
      const n = new Set(prev[section]);
      n.has(name) ? n.delete(name) : n.add(name);
      return { ...prev, [section]: n };
    });

  const dishToEntry = (d: Dish): CatalogEntry => ({
    name: d.name, image: d.image ?? "", type: d.type, category: d.category,
    variants: d.variants ?? [], description: d.description ?? "",
    isAvailable: d.isAvailable !== false, isFrequent: d.isFrequent === true,
  });

  const handleAddSelected = () => {
    const dishes = menuNotInCatalog
      .filter((d) => selectedToAdd.has(d.name))
      .map(dishToEntry);
    if (dishes.length) addToCatalogMutation.mutate(dishes);
  };

  const handleImport = (section: "saved" | "builtin", allDishes: CatalogEntry[]) => {
    const sel = selectedToImport[section];
    const dishes = sel.size > 0
      ? allDishes.filter((d) => sel.has(d.name))
      : allDishes.filter((d) => !existingNames.has(d.name.trim().toLowerCase()));
    if (dishes.length) importMutation.mutate(dishes);
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderCatalogSection = (
    section: "saved" | "builtin",
    dishes: CatalogEntry[],
    title: string,
    subtitle: string,
    icon: React.ReactNode,
  ) => {
    const newDishes = dishes.filter((d) => !existingNames.has(d.name.trim().toLowerCase()));
    const alreadyAdded = dishes.filter((d) => existingNames.has(d.name.trim().toLowerCase()));
    const sel = selectedToImport[section];

    const grouped = dishes.reduce((acc, d) => {
      if (existingNames.has(d.name.trim().toLowerCase())) return acc;
      (acc[d.category] ??= []).push(d);
      return acc;
    }, {} as Record<string, CatalogEntry[]>);

    return (
      <div className="glass-card rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dhaba-border/20">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-dhaba-accent/10 flex items-center justify-center text-dhaba-accent">
              {icon}
            </div>
            <div>
              <p className="text-sm font-bold text-dhaba-text">{title}</p>
              <p className="text-xs text-dhaba-muted">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {newDishes.length > 0 && (
              <button
                onClick={() =>
                  setSelectedToImport((prev) => ({
                    ...prev,
                    [section]: sel.size === newDishes.length ? new Set() : new Set(newDishes.map((d) => d.name)),
                  }))
                }
                className="text-xs text-dhaba-muted font-bold hover:text-dhaba-text transition-colors"
              >
                {sel.size === newDishes.length ? "Deselect All" : "Select All"}
              </button>
            )}
            <button
              onClick={() => handleImport(section, dishes)}
              disabled={importMutation.isPending || newDishes.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-warm text-dhaba-bg font-bold text-xs hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importMutation.isPending ? (
                <div className="h-3 w-3 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
              ) : <FaCloudDownloadAlt />}
              {sel.size > 0 ? `Import (${sel.size})` : newDishes.length === 0 ? "All in Menu" : `Import All (${newDishes.length})`}
            </button>
          </div>
        </div>

        {/* Dish list */}
        <div className="p-4 space-y-4">
          {newDishes.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-6 text-dhaba-muted text-sm">
              <FaLeaf className="text-green-400" /> All dishes from this catalog are in your menu
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-xs font-bold uppercase tracking-wider text-dhaba-muted mb-2 capitalize">
                  {category} <span className="text-dhaba-accent">({items.length})</span>
                </p>
                <div className="grid gap-1.5">
                  {items.map((dish) => (
                    <DishRow
                      key={dish.name}
                      dish={dish}
                      selected={sel.has(dish.name)}
                      onToggle={() => toggleImportSelect(section, dish.name)}
                      action={
                        section === "saved" ? (
                          <button
                            onClick={() => removeFromCatalogMutation.mutate([dish.name])}
                            disabled={removeFromCatalogMutation.isPending}
                            title="Remove from catalog"
                            className="p-1.5 rounded-lg hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger transition-colors"
                          >
                            <FaTimes className="text-xs" />
                          </button>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Already in menu */}
          {alreadyAdded.length > 0 && (
            <div className="border-t border-dhaba-border/10 pt-3">
              <p className="text-xs text-dhaba-muted mb-2">Already in menu ({alreadyAdded.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {alreadyAdded.map((d) => (
                  <span key={d.name} className="text-xs px-2.5 py-0.5 rounded-full glass-card text-dhaba-muted line-through capitalize">
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Top action bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-dhaba-muted">
          Restore dishes from a saved or built-in catalog, or build your own default.
        </p>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || existingDishes.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass-card text-dhaba-accent font-bold text-sm border border-dhaba-accent/20 hover:bg-dhaba-accent/10 transition-all disabled:opacity-50"
        >
          {saveMutation.isPending
            ? <div className="h-3.5 w-3.5 border-2 border-dhaba-accent border-t-transparent rounded-full animate-spin" />
            : <FaSave />}
          Save Current Menu as Default
        </button>
      </div>

      {/* ── Add from menu ──────────────────────────────────────────────────── */}
      {savedCatalog && menuNotInCatalog.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden border border-dhaba-accent/20">
          <button
            className="w-full flex items-center justify-between p-4 text-left"
            onClick={() => setAddFromMenuOpen((v) => !v)}
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-dhaba-accent/10 flex items-center justify-center">
                <FaPlus className="text-dhaba-accent text-xs" />
              </div>
              <div>
                <p className="text-sm font-bold text-dhaba-text">Add from Current Menu</p>
                <p className="text-xs text-dhaba-muted">
                  {menuNotInCatalog.length} dish{menuNotInCatalog.length !== 1 ? "es" : ""} not yet in saved catalog
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedToAdd.size > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddSelected(); }}
                  disabled={addToCatalogMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-dhaba-accent text-dhaba-bg font-bold text-xs hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {addToCatalogMutation.isPending
                    ? <div className="h-3 w-3 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
                    : <FaPlus />}
                  Add ({selectedToAdd.size})
                </button>
              )}
              {addFromMenuOpen ? <FaChevronUp className="text-dhaba-muted text-xs" /> : <FaChevronDown className="text-dhaba-muted text-xs" />}
            </div>
          </button>

          {addFromMenuOpen && (
            <div className="border-t border-dhaba-border/20 p-4 space-y-1.5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-dhaba-muted">Select dishes to add to your saved catalog</p>
                <button
                  onClick={() =>
                    setSelectedToAdd(
                      selectedToAdd.size === menuNotInCatalog.length
                        ? new Set()
                        : new Set(menuNotInCatalog.map((d) => d.name))
                    )
                  }
                  className="text-xs text-dhaba-accent font-bold hover:underline"
                >
                  {selectedToAdd.size === menuNotInCatalog.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              {menuNotInCatalog.map((dish) => (
                <DishRow
                  key={dish.name}
                  dish={{ name: dish.name, image: dish.image ?? "", type: dish.type, category: dish.category, variants: dish.variants ?? [], description: dish.description ?? "", isAvailable: true, isFrequent: false }}
                  selected={selectedToAdd.has(dish.name)}
                  onToggle={() => toggleAddSelect(dish.name)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Saved catalog ─────────────────────────────────────────────────── */}
      {savedCatalog && renderCatalogSection(
        "saved",
        savedCatalog.dishes,
        "My Saved Catalog",
        `${savedCatalog.dishes.length} dishes · saved ${new Date(savedCatalog.savedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
        <FaHistory />,
      )}

      {/* ── Built-in catalog ──────────────────────────────────────────────── */}
      {renderCatalogSection(
        "builtin",
        DEFAULT_DISH_CATALOG,
        "Built-in Catalog",
        `${DEFAULT_DISH_CATALOG.length} dishes · default dhaba menu`,
        <FaLeaf />,
      )}
    </div>
  );
};

export default DefaultDishesTab;
