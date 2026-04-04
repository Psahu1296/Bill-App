import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDishes, seedDefaultDishes } from "../../https";
import MenuItem from "./MenuItem";
import { FaSearch, FaLeaf, FaDrumstickBite, FaUtensils, FaFire, FaCoffee, FaPlus } from "react-icons/fa";
import { GiWheat, GiRiceCooker, GiCookingPot } from "react-icons/gi";
import { MdFastfood, MdLocalDrink } from "react-icons/md";
import type { Dish } from "../../types";
import { useAppDispatch } from "../../redux/hooks";
import { addItems } from "../../redux/slices/cartSlice";

const typeFilters = [
  { key: "all", label: "All", icon: <MdFastfood /> },
  { key: "veg", label: "Veg", icon: <FaLeaf /> },
  { key: "non-veg", label: "Non-Veg", icon: <FaDrumstickBite /> },
];

const keywordFilters = [
  { key: "all",     label: "All" },
  { key: "dal",     label: "Dal" },
  { key: "paneer",  label: "Paneer" },
  { key: "chicken", label: "Chicken" },
  { key: "fish",    label: "Fish" },
  { key: "mutton",  label: "Mutton" },
  { key: "egg",     label: "Egg" },
  { key: "rice",    label: "Rice" },
  { key: "naan",    label: "Naan" },
  { key: "roti",    label: "Roti" },
  { key: "soup",    label: "Soup" },
  { key: "biryani", label: "Biryani" },
  { key: "lassi",   label: "Lassi" },
];

const categoryFilters = [
  { key: "all", label: "All" },
  { key: "rice", label: "Rice", icon: <GiRiceCooker /> },
  { key: "roti", label: "Roti", icon: <GiWheat /> },
  { key: "sabji", label: "Sabji", icon: <GiCookingPot /> },
  { key: "drinks", label: "Drinks", icon: <MdLocalDrink /> },
  { key: "consumable", label: "Consumable", icon: <FaCoffee /> },
];

const MenuContainer: React.FC = () => {
  const dispatch = useAppDispatch();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeType, setActiveType] = useState("all");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeKeyword, setActiveKeyword] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [frequentOnly, setFrequentOnly] = useState(false);

  // Custom item popover
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCustom) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowCustom(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCustom]);

  const handleAddCustom = () => {
    const price = parseFloat(customPrice);
    if (!customName.trim() || isNaN(price) || price <= 0) return;
    dispatch(addItems({
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      pricePerQuantity: price,
      quantity: 1,
    }));
    setCustomName("");
    setCustomPrice("");
    setShowCustom(false);
  };

  const queryClient = useQueryClient();

  const { data: dishes, isLoading } = useQuery({
    queryKey: ["dishes"],
    queryFn: getDishes,
  });

  const seedMutation = useMutation({
    mutationFn: seedDefaultDishes,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
    },
  });

  const allDishes: Dish[] = dishes?.data?.data ?? [];

  const dynamicCategories = useMemo(() => {
    const cats = new Set(
      allDishes.map((d) => d.category?.toLowerCase()).filter(Boolean)
    );
    const predefined = categoryFilters.map((c) => c.key);
    const extra = [...cats].filter((c) => c !== "all" && !predefined.includes(c as string));
    return [
      ...categoryFilters,
      ...extra.map((c) => ({ key: c as string, label: (c as string).charAt(0).toUpperCase() + (c as string).slice(1) })),
    ];
  }, [allDishes]);

  const filteredDishes = useMemo(() => {
    let result = allDishes.filter((dish) => {
      if (availableOnly && !dish.isAvailable) return false;
      if (frequentOnly && !dish.isFrequent) return false;
      if (searchTerm && !dish.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (activeType !== "all") {
        const dishType = dish.type?.toLowerCase().replace(/[-_\s]/g, "");
        const filterType = activeType.replace(/[-_\s]/g, "");
        if (dishType !== filterType) return false;
      }
      if (activeCategory !== "all") {
        if (dish.category?.toLowerCase() !== activeCategory) return false;
      }
      if (activeKeyword !== "all") {
        if (!dish.name.toLowerCase().includes(activeKeyword)) return false;
      }
      return true;
    });
    if (frequentOnly) {
      result = [...result].sort((a, b) => (b.numberOfOrders ?? 0) - (a.numberOfOrders ?? 0));
    }
    return result;
  }, [allDishes, searchTerm, activeType, activeCategory, activeKeyword, availableOnly, frequentOnly]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-dhaba-muted">
        <div className="spinner mr-3" />
        Loading dishes...
      </div>
    );
  }

  if (allDishes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="glass-card rounded-3xl p-10 max-w-sm w-full space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-dhaba-accent/10 flex items-center justify-center mx-auto">
            <FaUtensils className="text-dhaba-accent text-2xl" />
          </div>
          <h3 className="font-display text-lg font-bold text-dhaba-text">Menu is empty</h3>
          <p className="text-dhaba-muted text-sm leading-relaxed">
            No dishes found. Load the default dhaba menu to get started quickly — you can edit
            prices, images, and availability afterwards.
          </p>
          {seedMutation.isError && (
            <p className="text-red-400 text-xs">Something went wrong. Try again.</p>
          )}
          {seedMutation.isSuccess && (
            <p className="text-dhaba-success text-xs">
              {(seedMutation.data as { data: { data: { added: number } } })?.data?.data?.added ?? ""} dishes loaded!
            </p>
          )}
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="w-full py-3 rounded-2xl bg-gradient-warm text-dhaba-bg font-bold text-sm hover:shadow-glow transition-all disabled:opacity-50"
          >
            {seedMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Loading menu...
              </span>
            ) : (
              "Load Default Menu"
            )}
          </button>
          <p className="text-dhaba-muted/50 text-[10px]">
            Or add dishes manually via the Add Dish button above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-6 mb-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="glass-input rounded-xl flex items-center gap-3 px-4 py-2 w-full max-w-xs">
          <FaSearch className="text-dhaba-muted text-sm" />
          <input
            type="text"
            placeholder="Search dishes..."
            className="bg-transparent text-dhaba-text text-sm outline-none flex-1 placeholder:text-dhaba-muted/50"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setActiveKeyword("all"); }}
          />
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-1.5">
          {typeFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveType(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeType === f.key
                  ? "bg-dhaba-accent text-dhaba-bg shadow-glow"
                  : "glass-input text-dhaba-muted hover:text-dhaba-text"
                }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>

        {/* Available only toggle */}
        {/* <button
          onClick={() => setAvailableOnly((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            availableOnly
              ? "bg-dhaba-success/20 text-dhaba-success border border-dhaba-success/40"
              : "glass-input text-dhaba-muted hover:text-dhaba-text"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${availableOnly ? "bg-dhaba-success" : "bg-dhaba-muted"}`} />
          Available only
        </button> */}

        {/* Frequently ordered toggle */}
        {/* <button
          onClick={() => setFrequentOnly((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            frequentOnly
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
              : "glass-input text-dhaba-muted hover:text-dhaba-text"
          }`}
        >
          <FaFire className={frequentOnly ? "text-orange-400" : "text-dhaba-muted"} />
          Frequently Ordered
        </button> */}

        {/* Custom item */}
        <div className="relative ml-auto" ref={popoverRef}>
          <button
            onClick={() => setShowCustom((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-warm text-dhaba-bg hover:shadow-glow transition-all"
          >
            <FaPlus size={10} />
            Custom Item
          </button>

          {showCustom && (
            <div className="absolute right-0 top-full mt-2 z-30 glass-card rounded-2xl p-4 w-64 space-y-3 shadow-lg border border-dhaba-border/30">
              <p className="text-xs font-bold text-dhaba-muted uppercase tracking-wider">Add Custom Item</p>
              <input
                autoFocus
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
                placeholder="Item name (e.g. Extra Roti)"
                className="w-full glass-input rounded-xl px-3 py-2 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50 focus:ring-1 ring-dhaba-accent/50"
              />
              <input
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
                placeholder="Price (₹)"
                min={1}
                className="w-full glass-input rounded-xl px-3 py-2 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50 focus:ring-1 ring-dhaba-accent/50"
              />
              <button
                onClick={handleAddCustom}
                disabled={!customName.trim() || !customPrice || parseFloat(customPrice) <= 0}
                className="w-full py-2 rounded-xl bg-gradient-warm text-dhaba-bg font-bold text-sm hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add to Cart
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Category filters */}
      <div className="px-6 mb-3 flex flex-wrap items-center gap-1.5">
        {dynamicCategories.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveCategory(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeCategory === f.key
                ? "bg-dhaba-accent/20 text-dhaba-accent border border-dhaba-accent/40"
                : "glass-input text-dhaba-muted hover:text-dhaba-text"
              }`}
          >
            {"icon" in f && (f as { icon?: React.ReactNode }).icon}
            {f.label}
          </button>
        ))}
      </div>

      {/* Keyword (ingredient) quick filters */}
      <div className="px-6 mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-dhaba-muted/60 mr-1 shrink-0">
          Ingredient
        </span>
        {keywordFilters.map((f) => {
          const isActive = activeKeyword === f.key;
          return (
            <button
              key={f.key}
              onClick={() => { setActiveKeyword(f.key); setSearchTerm(""); }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                isActive
                  ? "bg-orange-500/25 text-orange-400 border border-orange-500/50"
                  : "glass-input text-dhaba-muted hover:text-dhaba-text"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="h-px bg-dhaba-border/20 mx-6" />
      <div className="flex flex-wrap gap-3 px-6 py-4 overflow-y-auto">
        {filteredDishes.length === 0 ? (
          <p className="text-dhaba-muted text-sm py-8 w-full text-center">
            No dishes match your filters.
          </p>
        ) : (
          filteredDishes.map((item) => <MenuItem key={item._id} item={item} />)
        )}
      </div>
    </>
  );
};

export default MenuContainer;
