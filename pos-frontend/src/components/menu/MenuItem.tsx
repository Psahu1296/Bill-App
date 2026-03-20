import React, { useState, useEffect } from "react";
import { useAppDispatch } from "../../redux/hooks";
import { addItems } from "../../redux/slices/cartSlice";
import { FaShoppingCart } from "react-icons/fa";
import type { Dish, DishVariant } from "../../types";

interface MenuItemProps { item: Dish; }

const MenuItem: React.FC<MenuItemProps> = ({ item }) => {
  const [itemCount, setItemCount] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<DishVariant | null>(null);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (item?.variants?.length > 0) {
      setSelectedVariant(item.variants.find((v) => v.size === "Full") || item.variants.find((v) => v.size === "Regular") || item.variants[0]);
    } else {
      setSelectedVariant(null);
    }
  }, [item]);

  const increment = () => setItemCount((prev) => prev + 1);
  const decrement = () => { if (itemCount > 1) setItemCount((prev) => prev - 1); };

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    dispatch(addItems({
      id: item._id, name: item.name, variantSize: selectedVariant.size,
      pricePerQuantity: selectedVariant.price, quantity: itemCount, price: selectedVariant.price * itemCount,
    }));
    setItemCount(1);
  };

  if (!item?.variants?.length || !selectedVariant) {
    return (
      <div className="glass-card rounded-2xl p-4 min-w-[260px] h-[160px] opacity-50 flex flex-col justify-between">
        <h3 className="text-dhaba-text font-semibold">{item.name}</h3>
        <p className="text-dhaba-muted text-sm">No variants available</p>
      </div>
    );
  }

  return (
    <div
      onClick={handleAddToCart}
      className={`glass-card rounded-2xl p-4 min-w-[260px] h-[180px] flex flex-col justify-between transition-all duration-200 hover:shadow-glow hover:-translate-y-0.5 cursor-pointer active:scale-[0.98] ${!item.isAvailable ? "opacity-40 pointer-events-none" : ""}`}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-dhaba-text font-semibold text-sm">{item.name}</h3>
        <button
          onClick={(e) => { e.stopPropagation(); handleAddToCart(); }}
          className="bg-dhaba-success/15 text-dhaba-success p-2 rounded-xl hover:bg-dhaba-success/25 transition-colors"
        >
          <FaShoppingCart size={14} />
        </button>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-dhaba-accent text-xs font-bold tracking-wider uppercase">Price</p>
        <p className="font-display text-xl font-bold text-dhaba-text">₹{selectedVariant.price}</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <select
          value={selectedVariant.size}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            const v = item.variants.find((v) => v.size === e.target.value);
            if (v) { setSelectedVariant(v); setItemCount(1); }
          }}
          className="glass-input rounded-lg py-1.5 px-2 text-dhaba-accent text-xs font-semibold focus:outline-none appearance-none"
        >
          {item.variants.map((v) => <option key={v.size} value={v.size}>{v.size}</option>)}
        </select>

        <div onClick={(e) => e.stopPropagation()} className="glass-input rounded-xl flex items-center gap-4 px-3 py-1.5">
          <button onClick={decrement} className="text-dhaba-accent font-bold text-lg w-6">−</button>
          <span className="text-dhaba-text font-bold text-sm w-4 text-center">{itemCount}</span>
          <button onClick={increment} className="text-dhaba-accent font-bold text-lg w-6">+</button>
        </div>
      </div>
    </div>
  );
};

export default MenuItem;
