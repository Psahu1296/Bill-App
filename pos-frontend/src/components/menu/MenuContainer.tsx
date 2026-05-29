import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDishes, seedDefaultDishes } from "../../https";
import { FaUtensils } from "react-icons/fa";
import type { Dish, DishVariant } from "../../types";

import MenuSearchBar from "./MenuSearchBar";
import MenuTypeFilters from "./MenuTypeFilters";
import MenuCategoryFilters from "./MenuCategoryFilters";
import MenuKeywordFilters from "./MenuKeywordFilters";
import MenuDishGrid from "./MenuDishGrid";
import CustomItemPopover from "./CustomItemPopover";
import VoiceOrderButton from "./VoiceOrderButton";

export interface MenuContainerProps {
  onAddToCart: (dish: Dish, variant: DishVariant, qty: number) => void;
  onAddCustom?: (name: string, price: number) => void;
}

const MenuContainer: React.FC<MenuContainerProps> = ({ onAddToCart, onAddCustom }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeType, setActiveType] = useState("all");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeKeyword, setActiveKeyword] = useState("all");
  const [availableOnly] = useState(false);
  const [frequentOnly] = useState(false);

  const queryClient = useQueryClient();

  const { data: dishes, isLoading } = useQuery({
    queryKey: ["dishes"],
    queryFn: getDishes,
  });

  const seedMutation = useMutation({
    mutationFn: seedDefaultDishes,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dishes"] }),
  });

  const allDishes: Dish[] = dishes?.data?.data ?? [];

  const filteredDishes = useMemo(() => {
    let result = allDishes.filter((dish) => {
      if (availableOnly && !dish.isAvailable) return false;
      if (frequentOnly && !dish.isFrequent) return false;
      if (searchTerm && !dish.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (activeType !== "all") {
        const dishType = dish.type?.toLowerCase().replace(/[-_\s]/g, "");
        if (dishType !== activeType.replace(/[-_\s]/g, "")) return false;
      }
      if (activeCategory !== "all" && dish.category?.toLowerCase() !== activeCategory) return false;
      if (activeKeyword !== "all" && !dish.name.toLowerCase().includes(activeKeyword)) return false;
      return true;
    });
    if (frequentOnly) {
      result = [...result].sort((a, b) => (b.numberOfOrders ?? 0) - (a.numberOfOrders ?? 0));
    }
    return result;
  }, [allDishes, searchTerm, activeType, activeCategory, activeKeyword, availableOnly, frequentOnly]);

  const handleSearchChange = (v: string) => {
    setSearchTerm(v);
    setActiveKeyword("all");
  };

  const handleKeywordChange = (k: string) => {
    setActiveKeyword(k);
    setSearchTerm("");
  };

  if (allDishes.length === 0 && !isLoading) {
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
      {/* Top bar: search + type filters + voice + custom */}
      <div className="px-6 mb-3 flex flex-wrap items-center gap-3 relative">
        <MenuSearchBar value={searchTerm} onChange={handleSearchChange} />
        <MenuTypeFilters active={activeType} onChange={setActiveType} />
        <VoiceOrderButton onAddToCart={onAddToCart} />
        {onAddCustom && <CustomItemPopover onAdd={onAddCustom} />}
      </div>

      <MenuCategoryFilters dishes={allDishes} active={activeCategory} onChange={setActiveCategory} />
      <MenuKeywordFilters active={activeKeyword} onChange={handleKeywordChange} />

      <div className="h-px bg-dhaba-border/20 mx-6" />
      <MenuDishGrid dishes={filteredDishes} isLoading={isLoading} onAddToCart={onAddToCart} />
    </>
  );
};

export default MenuContainer;
