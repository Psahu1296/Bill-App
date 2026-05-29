import React from "react";
import { FaLeaf, FaDrumstickBite } from "react-icons/fa";
import { MdFastfood } from "react-icons/md";

const TYPE_FILTERS = [
  { key: "all",     label: "All",     icon: <MdFastfood /> },
  { key: "veg",     label: "Veg",     icon: <FaLeaf /> },
  { key: "non-veg", label: "Non-Veg", icon: <FaDrumstickBite /> },
];

interface MenuTypeFiltersProps {
  active: string;
  onChange: (key: string) => void;
}

const MenuTypeFilters: React.FC<MenuTypeFiltersProps> = ({ active, onChange }) => (
  <div className="flex items-center gap-1.5">
    {TYPE_FILTERS.map((f) => (
      <button
        key={f.key}
        onClick={() => onChange(f.key)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          active === f.key
            ? "bg-dhaba-accent text-dhaba-bg shadow-glow"
            : "glass-input text-dhaba-muted hover:text-dhaba-text"
        }`}
      >
        {f.icon}
        {f.label}
      </button>
    ))}
  </div>
);

export default MenuTypeFilters;
