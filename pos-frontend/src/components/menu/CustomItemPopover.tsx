import React, { useState, useRef, useEffect } from "react";
import { FaPlus } from "react-icons/fa";

interface CustomItemPopoverProps {
  onAdd: (name: string, price: number) => void;
}

const CustomItemPopover: React.FC<CustomItemPopoverProps> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAdd = () => {
    const p = parseFloat(price);
    if (!name.trim() || isNaN(p) || p <= 0) return;
    onAdd(name.trim(), p);
    setName("");
    setPrice("");
    setOpen(false);
  };

  return (
    <div className="relative ml-auto" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-warm text-dhaba-bg hover:shadow-glow transition-all"
      >
        <FaPlus size={10} />
        Custom Item
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 glass-card rounded-2xl p-4 w-64 space-y-3 shadow-lg border border-dhaba-border/30">
          <p className="text-xs font-bold text-dhaba-muted uppercase tracking-wider">Add Custom Item</p>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Item name (e.g. Extra Roti)"
            className="w-full glass-input rounded-xl px-3 py-2 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50 focus:ring-1 ring-dhaba-accent/50"
          />
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Price (₹)"
            min={1}
            className="w-full glass-input rounded-xl px-3 py-2 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50 focus:ring-1 ring-dhaba-accent/50"
          />
          <button
            onClick={handleAdd}
            disabled={!name.trim() || !price || parseFloat(price) <= 0}
            className="w-full py-2 rounded-xl bg-gradient-warm text-dhaba-bg font-bold text-sm hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add to Cart
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomItemPopover;
