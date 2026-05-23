import React from "react";
import { FaEdit, FaTrash, FaFire, FaGlobe } from "react-icons/fa";
import { Img } from "react-image";
import type { Dish } from "../../types";
import { getDishImage } from "../../utils";

const CATEGORY_BADGE: Record<string, { bg: string; dot: string; label: string }> = {
  veg: { bg: "bg-dhaba-bg/80 text-dhaba-success border-dhaba-success/30", dot: "bg-dhaba-success", label: "VEG" },
  non_veg: { bg: "bg-dhaba-bg/80 text-dhaba-danger border-dhaba-danger/30", dot: "bg-dhaba-danger", label: "NON-VEG" },
  egg: { bg: "bg-dhaba-bg/80 text-dhaba-accent border-dhaba-accent/30", dot: "bg-dhaba-accent", label: "EGG" },
};

interface DishCardProps {
  dish: Dish;
  onEdit?: (dish: Dish) => void;
  onDelete?: (dishId: string) => void;
}

const DishCard: React.FC<DishCardProps> = ({ dish, onEdit, onDelete }) => {
  const badge = CATEGORY_BADGE[dish.category] || { bg: "bg-dhaba-surface/50 text-dhaba-muted border-dhaba-border/50", dot: "bg-dhaba-muted", label: dish.category };

  return (
    <div className="glass-card rounded-[1.5rem] overflow-hidden w-full max-w-[300px] group hover:-translate-y-1 transition-all duration-300 relative flex flex-col hover:shadow-elevated hover:border-dhaba-accent/30">
      {/* Image Container */}
      <div className="relative h-[180px] overflow-hidden shrink-0 bg-dhaba-surface">
        <Img
          src={[
            getDishImage(dish.name, dish.image),
            "https://via.placeholder.com/400x300?text=No+Image"
          ].filter(Boolean) as string[]}
          alt={dish.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          loader={<div className="w-full h-full bg-dhaba-surface/50 animate-pulse" />}
          unloader={
            <div className="w-full h-full bg-dhaba-surface/50 flex items-center justify-center text-xs font-bold tracking-widest uppercase text-dhaba-muted/50">
              No Image
            </div>
          }
        />

        {/* Soft dark gradient over image */}
        <div className="absolute inset-0 bg-gradient-to-t from-dhaba-bg via-transparent to-transparent pointer-events-none opacity-80" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          {/* Veg/Non-Veg Badge */}
          <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 backdrop-blur-md shadow-sm ${badge.bg}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot} shadow-[0_0_5px_currentColor]`} />
            <span className="text-[9px] font-black tracking-widest uppercase">{badge.label}</span>
          </div>

          {/* Feature Badges (Fire, Globe) */}
          <div className="flex flex-col gap-1.5 items-end">
            {dish.isFrequent && (
              <div className="bg-dhaba-bg/80 text-dhaba-orange p-1.5 rounded-lg border border-dhaba-orange/30 backdrop-blur-md shadow-md" title="Frequently Ordered">
                <FaFire size={12} />
              </div>
            )}
            {dish.isOnlineAvailable && (
              <div className="bg-dhaba-bg/80 text-dhaba-info p-1.5 rounded-lg border border-dhaba-info/30 backdrop-blur-md shadow-md" title="Available Online">
                <FaGlobe size={12} />
              </div>
            )}
          </div>
        </div>

        {/* Unavailable Overlay */}
        {!dish.isAvailable && (
          <div className="absolute inset-0 bg-dhaba-bg/60 backdrop-blur-sm flex items-center justify-center z-10">
            <span className="text-dhaba-danger font-black text-xs tracking-[0.2em] uppercase bg-dhaba-danger/10 border border-dhaba-danger/30 px-4 py-2 rounded-xl shadow-[0_0_20px_hsl(var(--dhaba-danger)/0.2)]">
              Unavailable
            </span>
          </div>
        )}

        {/* Base Price Float */}
        <div className="absolute bottom-3 right-3 flex flex-col items-end">
          {dish.variants?.[0]?.markedPrice != null && dish.variants[0].markedPrice > dish.variants[0].price && (
            <div className="text-[10px] font-bold line-through text-dhaba-muted mb-0.5 tracking-wide">
              ₹{dish.variants[0].markedPrice}
            </div>
          )}
          <div className="bg-dhaba-bg/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-dhaba-border shadow-lg flex items-center gap-1.5">
            <span className="text-[9px] font-black text-dhaba-muted tracking-widest uppercase">From</span>
            <span className="font-display text-lg font-black text-dhaba-accent drop-shadow-[0_0_8px_hsl(var(--dhaba-accent)/0.5)]">
              ₹{dish.variants?.[0]?.price ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 flex flex-col flex-1 relative z-10">
        <div className="mb-4">
          <h3 className="font-display text-lg font-black text-dhaba-text leading-tight line-clamp-1 tracking-wide group-hover:text-dhaba-accent transition-colors">
            {dish.name}
          </h3>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] text-dhaba-muted font-black tracking-widest uppercase bg-dhaba-surface px-2 py-0.5 rounded border border-dhaba-border/50">
              {dish.numberOfOrders} orders
            </span>
            {dish.numberOfOrders > 100 && (
              <span className="text-[8px] bg-dhaba-accent/10 border border-dhaba-accent/30 text-dhaba-accent px-1.5 py-0.5 rounded shadow-[0_0_8px_hsl(var(--dhaba-accent)/0.3)] font-black tracking-widest">
                BESTSELLER
              </span>
            )}
          </div>
        </div>

        {/* Variants Pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {dish.variants?.length > 0 ? (
            dish.variants.map((v, i) => (
              <div
                key={i}
                className="bg-dhaba-surface/80 border border-dhaba-border/50 text-[10px] font-bold text-dhaba-text/80 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-inner"
              >
                <span className="text-dhaba-text">{v.size}</span>
                <span className="opacity-30">|</span>
                <div className="flex items-center gap-1">
                  {v.markedPrice != null && v.markedPrice > v.price && (
                    <span className="line-through text-dhaba-muted">₹{v.markedPrice}</span>
                  )}
                  <span className="text-dhaba-accent">₹{v.price}</span>
                  {v.onlinePrice != null && v.onlinePrice > 0 && (
                    <span className="text-dhaba-info ml-0.5 flex items-center gap-0.5" title="Online Price">
                      <FaGlobe size={8} /> ₹{v.onlinePrice}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <span className="text-[10px] font-bold text-dhaba-danger/80 tracking-widest uppercase">No variants</span>
          )}
        </div>

        <div className="flex-1" /> {/* Spacer */}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-4 border-t border-dhaba-border/30">
          {onEdit && (
            <button
              onClick={() => onEdit(dish)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dhaba-surface/50 border border-dhaba-border/50 text-[10px] font-black uppercase tracking-widest text-dhaba-muted hover:text-dhaba-accent hover:bg-dhaba-accent/10 hover:border-dhaba-accent/30 hover:shadow-glow transition-all"
            >
              <FaEdit size={12} /> Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(dish._id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dhaba-surface/50 border border-dhaba-border/50 text-[10px] font-black uppercase tracking-widest text-dhaba-muted hover:text-dhaba-danger hover:bg-dhaba-danger/10 hover:border-dhaba-danger/30 hover:shadow-[0_0_15px_hsl(var(--dhaba-danger)/0.2)] transition-all"
            >
              <FaTrash size={12} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DishCard;
