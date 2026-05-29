import React from "react";

const KEYWORD_FILTERS = [
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

interface MenuKeywordFiltersProps {
  active: string;
  onChange: (key: string) => void;
}

const MenuKeywordFilters: React.FC<MenuKeywordFiltersProps> = ({ active, onChange }) => (
  <div className="px-6 mb-3 flex flex-wrap items-center gap-1.5">
    <span className="text-[10px] font-bold uppercase tracking-wider text-dhaba-muted/60 mr-1 shrink-0">
      Ingredient
    </span>
    {KEYWORD_FILTERS.map((f) => (
      <button
        key={f.key}
        onClick={() => onChange(f.key)}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
          active === f.key
            ? "bg-orange-500/25 text-orange-400 border border-orange-500/50"
            : "glass-input text-dhaba-muted hover:text-dhaba-text"
        }`}
      >
        {f.label}
      </button>
    ))}
  </div>
);

export default MenuKeywordFilters;
