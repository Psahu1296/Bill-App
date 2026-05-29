import React, { useMemo } from "react";
import { GiWheat, GiRiceCooker, GiCookingPot } from "react-icons/gi";
import { MdLocalDrink } from "react-icons/md";
import { FaCoffee } from "react-icons/fa";
import type { Dish } from "../../types";

const BASE_CATEGORIES = [
  { key: "all",        label: "All" },
  { key: "rice",       label: "Rice",       icon: <GiRiceCooker /> },
  { key: "roti",       label: "Roti",       icon: <GiWheat /> },
  { key: "sabji",      label: "Sabji",      icon: <GiCookingPot /> },
  { key: "drinks",     label: "Drinks",     icon: <MdLocalDrink /> },
  { key: "consumable", label: "Consumable", icon: <FaCoffee /> },
];

interface MenuCategoryFiltersProps {
  dishes: Dish[];
  active: string;
  onChange: (key: string) => void;
}

const MenuCategoryFilters: React.FC<MenuCategoryFiltersProps> = ({ dishes, active, onChange }) => {
  const categories = useMemo(() => {
    const existing = new Set(dishes.map((d) => d.category?.toLowerCase()).filter(Boolean));
    const predefinedKeys = BASE_CATEGORIES.map((c) => c.key);
    const extras = [...existing]
      .filter((c) => c !== "all" && !predefinedKeys.includes(c as string))
      .map((c) => ({ key: c as string, label: (c as string).charAt(0).toUpperCase() + (c as string).slice(1) }));
    return [...BASE_CATEGORIES, ...extras];
  }, [dishes]);

  return (
    <div className="px-6 mb-3 flex flex-wrap items-center gap-1.5">
      {categories.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            active === f.key
              ? "bg-dhaba-accent/20 text-dhaba-accent border border-dhaba-accent/40"
              : "glass-input text-dhaba-muted hover:text-dhaba-text"
          }`}
        >
          {"icon" in f && (f as { icon?: React.ReactNode }).icon}
          {f.label}
        </button>
      ))}
    </div>
  );
};

export default MenuCategoryFilters;
