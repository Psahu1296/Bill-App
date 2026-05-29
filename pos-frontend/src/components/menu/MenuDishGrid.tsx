import React from "react";
import MenuItem from "./MenuItem";
import Skeleton from "../shared/Skeleton";
import type { Dish, DishVariant } from "../../types";

interface MenuDishGridProps {
  dishes: Dish[];
  isLoading: boolean;
  onAddToCart: (dish: Dish, variant: DishVariant, qty: number) => void;
}

const MenuDishGrid: React.FC<MenuDishGridProps> = ({ dishes, isLoading, onAddToCart }) => {
  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-3 px-6 py-4">
        <Skeleton className="h-36 w-40" count={12} gap="gap-3" />
      </div>
    );
  }

  if (dishes.length === 0) {
    return (
      <p className="text-dhaba-muted text-sm py-8 w-full text-center px-6">
        No dishes match your filters.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 px-6 py-4 overflow-y-auto">
      {dishes.map((item) => (
        <MenuItem key={item._id} item={item} onAddToCart={onAddToCart} />
      ))}
    </div>
  );
};

export default MenuDishGrid;
