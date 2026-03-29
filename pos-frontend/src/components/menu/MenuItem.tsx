import React, { useState, useEffect } from "react";
import { useAppDispatch } from "../../redux/hooks";
import { addItems } from "../../redux/slices/cartSlice";
import type { Dish, DishVariant } from "../../types";
import { getDishImage } from "../../utils";

interface MenuItemProps { item: Dish; }

const MenuItem: React.FC<MenuItemProps> = ({ item }) => {
  const [itemCount, setItemCount] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<DishVariant | null>(null);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (item?.variants?.length > 0) {
      setSelectedVariant(
        item.variants.find((v) => v.size === "Full") ||
        item.variants.find((v) => v.size === "Regular") ||
        item.variants[0]
      );
    } else {
      setSelectedVariant(null);
    }
  }, [item]);

  const increment = () => setItemCount((prev) => prev + 1);
  const decrement = () => { if (itemCount > 1) setItemCount((prev) => prev - 1); };

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    dispatch(addItems({
      id: item._id,
      name: item.name,
      variantSize: selectedVariant.size,
      pricePerQuantity: selectedVariant.price,
      markedPricePerQuantity: selectedVariant.markedPrice,
      quantity: itemCount,
      price: selectedVariant.price * itemCount,
    }));
    setItemCount(1);
  };

  if (!item?.variants?.length || !selectedVariant) {
    return (
      <div className="glass-card rounded-2xl p-4 min-w-[220px] h-[148px] opacity-50 flex flex-col justify-between">
        <h3 className="text-dhaba-text font-semibold text-sm">{item.name}</h3>
        <p className="text-dhaba-muted text-xs">No variants available</p>
      </div>
    );
  }

  const dishImage = getDishImage(item.name, item.image);
  const isNonVeg  = item.type === "non-veg";
  const hasMultiVariants = item.variants.length > 1;

  return (
    <div
      onClick={handleAddToCart}
      className={`relative overflow-hidden rounded-2xl min-w-[220px] h-[148px] flex flex-col justify-between cursor-pointer
        transition-all duration-200 hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.98]
        glass-card
        ${!item.isAvailable ? "opacity-40 pointer-events-none" : ""}
        ${isNonVeg ? "border border-red-500/20" : "border border-green-500/10"}
      `}
    >
      {/* Right-side image panel */}
      {dishImage && (
        <>
          <img
            src={dishImage}
            alt=""
            aria-hidden
            className="absolute right-0 top-0 h-full w-[48%] object-cover pointer-events-none select-none"
          />
          {/* gradient fade — left edge of image blends into card */}
          <div
            className="absolute right-[38%] top-0 h-full w-[16%] pointer-events-none"
            style={{ background: "linear-gradient(to right, hsl(var(--dhaba-card)), transparent)" }}
          />
          {/* dark scrim over image so it doesn't overpower */}
          <div className="absolute right-0 top-0 h-full w-[48%] bg-dhaba-bg/40 pointer-events-none" />
        </>
      )}

      {/* Content */}
      <div className="relative flex flex-col justify-between h-full p-3.5">

        {/* Top: veg indicator + name — constrained so image shows */}
        <div className={`space-y-1 ${dishImage ? "pr-[44%]" : ""}`}>
          <div className="flex items-center gap-1.5">
            {/* Indian food type indicator */}
            <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm border ${isNonVeg ? "border-red-500" : "border-green-500"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isNonVeg ? "bg-red-500" : "bg-green-500"}`} />
            </span>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${isNonVeg ? "text-red-400" : "text-green-400"}`}>
              {isNonVeg ? "Non-veg" : "Veg"}
            </span>
          </div>
          <h3 className="text-dhaba-text font-bold text-sm leading-tight line-clamp-2">{item.name}</h3>
        </div>

        {/* Bottom: price + controls */}
        <div className="space-y-2">
          {/* Price */}
          <div className={`${dishImage ? "pr-[44%]" : ""} leading-none`}>
            {selectedVariant.markedPrice != null && selectedVariant.markedPrice > selectedVariant.price && (
              <span className="text-dhaba-muted text-[11px] line-through mr-1.5 font-normal">
                ₹{selectedVariant.markedPrice}
              </span>
            )}
            <span className="font-display text-xl font-bold text-dhaba-text">₹{selectedVariant.price}</span>
            <span className="text-dhaba-muted text-[10px] font-normal ml-1">{selectedVariant.size}</span>
            {selectedVariant.markedPrice != null && selectedVariant.markedPrice > selectedVariant.price && (
              <span className="block text-[9px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-md mt-1 w-fit">
                Save ₹{selectedVariant.markedPrice - selectedVariant.price}
              </span>
            )}
          </div>

          {/* Variant pills + counter */}
          <div className="flex items-center justify-between gap-1.5">
            {/* Variant selector - pill buttons */}
            {hasMultiVariants ? (
              <div onClick={(e) => e.stopPropagation()} className="flex gap-1">
                {item.variants.map((v) => (
                  <button
                    key={v.size}
                    onClick={(e) => { e.stopPropagation(); setSelectedVariant(v); setItemCount(1); }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                      selectedVariant.size === v.size
                        ? "bg-dhaba-accent text-dhaba-bg"
                        : "glass-input text-dhaba-muted hover:text-dhaba-text"
                    }`}
                  >
                    {v.size}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-dhaba-muted font-medium">{selectedVariant.size}</span>
            )}

            {/* Counter */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center glass-input rounded-lg overflow-hidden"
            >
              <button
                onClick={decrement}
                className="px-2 py-1 text-dhaba-accent font-bold text-sm hover:bg-dhaba-surface transition-colors"
              >
                −
              </button>
              <span className="px-2 text-dhaba-text font-bold text-xs min-w-[20px] text-center">{itemCount}</span>
              <button
                onClick={increment}
                className="px-2 py-1 text-dhaba-accent font-bold text-sm hover:bg-dhaba-surface transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuItem;
