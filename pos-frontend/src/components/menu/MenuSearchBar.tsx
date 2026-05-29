import React from "react";
import { FaSearch } from "react-icons/fa";

interface MenuSearchBarProps {
  value: string;
  onChange: (v: string) => void;
}

const MenuSearchBar: React.FC<MenuSearchBarProps> = ({ value, onChange }) => (
  <div className="glass-input rounded-xl flex items-center gap-3 px-4 py-2 w-full max-w-xs">
    <FaSearch className="text-dhaba-muted text-sm" />
    <input
      type="text"
      placeholder="Search dishes..."
      className="bg-transparent text-dhaba-text text-sm outline-none flex-1 placeholder:text-dhaba-muted/50"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

export default MenuSearchBar;
