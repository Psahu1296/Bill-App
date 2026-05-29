import React from "react";
import { FaPlus, FaMinus, FaTrash } from "react-icons/fa";
import type { LocalCartItem } from "./PastOrderItemBuilder";

interface LocalCartDisplayProps {
  cartItems: LocalCartItem[];
  onChangeQty: (id: string, variantSize: string | undefined, delta: number) => void;
  onRemove: (id: string, variantSize: string | undefined) => void;
}

const LocalCartDisplay: React.FC<LocalCartDisplayProps> = ({ cartItems, onChangeQty, onRemove }) => {
  if (cartItems.length === 0) return null;

  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wider text-dhaba-muted mb-3">
        Order Items <span className="text-dhaba-accent">({cartItems.length})</span>
      </h3>
      <div className="space-y-1.5">
        {cartItems.map((item) => (
          <div
            key={`${item.id}_${item.variantSize}`}
            className="flex items-center justify-between glass-input rounded-xl px-4 py-2.5"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-dhaba-text truncate">{item.name}</p>
              <p className="text-[11px] text-dhaba-muted">{item.variantSize} · ₹{item.pricePerQuantity} each</p>
            </div>
            <div className="flex items-center gap-3 ml-3">
              <div className="flex items-center glass-card rounded-lg overflow-hidden">
                <button
                  onClick={() => onChangeQty(item.id, item.variantSize, -1)}
                  className="px-2 py-1 text-dhaba-accent font-bold text-sm hover:bg-dhaba-surface transition-colors"
                >
                  <FaMinus className="text-[9px]" />
                </button>
                <span className="px-2 text-sm font-bold text-dhaba-text min-w-[24px] text-center">{item.quantity}</span>
                <button
                  onClick={() => onChangeQty(item.id, item.variantSize, 1)}
                  className="px-2 py-1 text-dhaba-accent font-bold text-sm hover:bg-dhaba-surface transition-colors"
                >
                  <FaPlus className="text-[9px]" />
                </button>
              </div>
              <span className="text-sm font-bold text-dhaba-text w-16 text-right">₹{item.price}</span>
              <button
                onClick={() => onRemove(item.id, item.variantSize)}
                className="p-1.5 rounded-lg hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger transition-colors"
              >
                <FaTrash className="text-xs" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default LocalCartDisplay;
