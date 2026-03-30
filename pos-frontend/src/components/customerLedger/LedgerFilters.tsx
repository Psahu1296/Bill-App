import { motion } from "framer-motion";
import { FaSearch, FaCalendarAlt, FaSortAmountDown } from "react-icons/fa";

export type PresetKey = "today" | "week" | "month" | "year" | "custom" | "all";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week",  label: "Week" },
  { key: "month", label: "Month" },
  { key: "year",  label: "Year" },
  { key: "custom", label: "Custom" },
  { key: "all",  label: "All" },
];

interface LedgerFiltersProps {
  preset: PresetKey;
  customStart: string;
  customEnd: string;
  searchTerm: string;
  sortByDue: boolean;
  onPresetChange: (p: PresetKey) => void;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  onSortToggle: () => void;
}

const LedgerFilters: React.FC<LedgerFiltersProps> = ({
  preset,
  customStart,
  customEnd,
  searchTerm,
  sortByDue,
  onPresetChange,
  onCustomStartChange,
  onCustomEndChange,
  onSearchChange,
  onSortToggle,
}) => {
  return (
    <>
      {/* Date preset filter */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onPresetChange(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                preset === key
                  ? "bg-gradient-warm text-dhaba-bg shadow-glow"
                  : "glass-card text-dhaba-muted border border-dhaba-border/20 hover:text-dhaba-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom date pickers */}
        {preset === "custom" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 items-center"
          >
            <FaCalendarAlt className="text-dhaba-muted text-sm shrink-0" />
            <input
              type="date"
              value={customStart}
              onChange={(e) => onCustomStartChange(e.target.value)}
              className="glass-input rounded-xl px-3 py-2 text-sm text-dhaba-text outline-none flex-1 bg-transparent"
            />
            <span className="text-dhaba-muted text-xs">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => onCustomEndChange(e.target.value)}
              className="glass-input rounded-xl px-3 py-2 text-sm text-dhaba-text outline-none flex-1 bg-transparent"
            />
          </motion.div>
        )}
      </div>

      {/* Search + sort */}
      <div className="flex gap-2">
        <div className="glass-input rounded-xl flex items-center gap-3 px-4 py-2.5 flex-1">
          <FaSearch className="text-dhaba-muted text-sm shrink-0" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-transparent text-dhaba-text text-sm outline-none flex-1 placeholder:text-dhaba-muted/50"
          />
        </div>
        <button
          onClick={onSortToggle}
          title={sortByDue ? "Sorted: Most Due First" : "Sorted: Recent First"}
          className={`glass-card rounded-xl px-3 flex items-center gap-1.5 text-xs font-bold border transition-all shrink-0 ${
            sortByDue
              ? "text-dhaba-danger border-dhaba-danger/30 bg-dhaba-danger/10"
              : "text-dhaba-muted border-dhaba-border/20 hover:text-dhaba-text"
          }`}
        >
          <FaSortAmountDown size={13} />
          {sortByDue ? "Most Due" : "Recent"}
        </button>
      </div>
    </>
  );
};

export default LedgerFilters;
