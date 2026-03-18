import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDishes, seedDefaultDishes } from "../../https";
import MenuItem from "./MenuItem";
import { FaSearch, FaLeaf, FaDrumstickBite, FaUtensils } from "react-icons/fa";
import { GiWheat, GiRiceCooker, GiCookingPot } from "react-icons/gi";
import { MdFastfood, MdLocalDrink } from "react-icons/md";
import type { Dish } from "../../types";

const typeFilters = [
  { key: "all", label: "All", icon: <MdFastfood /> },
  { key: "veg", label: "Veg", icon: <FaLeaf /> },
  { key: "non-veg", label: "Non-Veg", icon: <FaDrumstickBite /> },
];

const categoryFilters = [
  { key: "all", label: "All" },
  { key: "rice", label: "Rice", icon: <GiRiceCooker /> },
  { key: "roti", label: "Roti", icon: <GiWheat /> },
  { key: "sabji", label: "Sabji", icon: <GiCookingPot /> },
  { key: "drinks", label: "Drinks", icon: <MdLocalDrink /> },
];

const MenuContainer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeType, setActiveType] = useState("all");
  const [activeCategory, setActiveCategory] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(false);

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

  // Merge predefined category chips with any extra categories found in BE data
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
    return allDishes.filter((dish) => {
      if (availableOnly && !dish.isAvailable) return false;
      if (searchTerm && !dish.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (activeType !== "all") {
        const dishType = dish.type?.toLowerCase().replace(/[-_\s]/g, "");
        const filterType = activeType.replace(/[-_\s]/g, "");
        if (dishType !== filterType) return false;
      }
      if (activeCategory !== "all") {
        if (dish.category?.toLowerCase() !== activeCategory) return false;
      }
      return true;
    });
  }, [allDishes, searchTerm, activeType, activeCategory, availableOnly]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-dhaba-muted">
        <div className="spinner mr-3" />
        Loading dishes...
      </div>
    );
  }

  // Empty DB — prompt to load the default menu
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
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-1.5">
          {typeFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveType(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeType === f.key
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
        <button
          onClick={() => setAvailableOnly((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            availableOnly
              ? "bg-dhaba-success/20 text-dhaba-success border border-dhaba-success/40"
              : "glass-input text-dhaba-muted hover:text-dhaba-text"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${availableOnly ? "bg-dhaba-success" : "bg-dhaba-muted"}`} />
          Available only
        </button>
      </div>

      {/* Category filters */}
      <div className="px-6 mb-3 flex flex-wrap items-center gap-1.5">
        {dynamicCategories.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveCategory(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeCategory === f.key
                ? "bg-dhaba-accent/20 text-dhaba-accent border border-dhaba-accent/40"
                : "glass-input text-dhaba-muted hover:text-dhaba-text"
            }`}
          >
            {"icon" in f && (f as { icon?: React.ReactNode }).icon}
            {f.label}
          </button>
        ))}
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
