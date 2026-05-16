import React from "react";
import { FaEdit, FaTrash, FaFire, FaGlobe } from "react-icons/fa";
import { Img } from "react-image";
import type { Dish } from "../../types";
import { getDishImage } from "../../utils";

const CATEGORY_BADGE: Record<string, { bg: string; dot: string; label: string }> = {
  veg: { bg: "bg-black/60 text-green-400 border-green-500/30", dot: "bg-green-400", label: "VEG" },
  non_veg: { bg: "bg-black/60 text-red-400 border-red-500/30", dot: "bg-red-400", label: "NON-VEG" },
  egg: { bg: "bg-black/60 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-400", label: "EGG" },
};

interface DishCardProps {
  dish: Dish;
  onEdit?: (dish: Dish) => void;
  onDelete?: (dishId: string) => void;
}

const DishCard: React.FC<DishCardProps> = ({ dish, onEdit, onDelete }) => {
  const badge = CATEGORY_BADGE[dish.category] || { bg: "bg-white/5 text-white/50 border-white/10", dot: "bg-white/50", label: dish.category };

  return (
    <div className="glass-card rounded-[1.5rem] overflow-hidden w-full max-w-[300px] group hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-300 relative border border-white/5 bg-black/20 flex flex-col">
      {/* Image Container */}
      <div className="relative h-[180px] overflow-hidden shrink-0 bg-[#121620]">
        <Img
          src={[
            getDishImage(dish.name, dish.image),
            "https://via.placeholder.com/400x300?text=No+Image"
          ].filter(Boolean) as string[]}
          alt={dish.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          loader={<div className="w-full h-full bg-white/5 animate-pulse" />}
          unloader={
            <div className="w-full h-full bg-white/5 flex items-center justify-center text-xs font-bold tracking-widest uppercase text-white/30">
              No Image
            </div>
          }
        />

        {/* Soft dark gradient over image */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

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
              <div className="bg-black/60 text-orange-400 p-1.5 rounded-lg border border-orange-500/30 backdrop-blur-md shadow-md" title="Frequently Ordered">
                <FaFire size={12} />
              </div>
            )}
            {dish.isOnlineAvailable && (
              <div className="bg-black/60 text-rose-500 p-1.5 rounded-lg border border-rose-500/30 backdrop-blur-md shadow-md" title="Available Online">
                <FaGlobe size={12} />
              </div>
            )}
          </div>
        </div>

        {/* Unavailable Overlay */}
        {!dish.isAvailable && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
            <span className="text-red-400 font-black text-xs tracking-[0.2em] uppercase bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.15)]">
              Unavailable
            </span>
          </div>
        )}

        {/* Base Price Float */}
        <div className="absolute bottom-3 right-3 flex flex-col items-end">
          {dish.variants?.[0]?.markedPrice != null && dish.variants[0].markedPrice > dish.variants[0].price && (
            <div className="text-[10px] font-bold line-through text-white/50 mb-0.5 tracking-wide">
              ₹{dish.variants[0].markedPrice}
            </div>
          )}
          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shadow-lg flex items-center gap-1.5">
            <span className="text-[9px] font-black text-white/50 tracking-widest uppercase">From</span>
            <span className="font-display text-lg font-black text-white">
              ₹{dish.variants?.[0]?.price ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 flex flex-col flex-1 relative z-10">
        <div className="mb-4">
          <h3 className="font-display text-lg font-black text-white/90 leading-tight line-clamp-1 tracking-wide group-hover:text-blue-400 transition-colors">
            {dish.name}
          </h3>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] text-white/40 font-black tracking-widest uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5">
              {dish.numberOfOrders} orders
            </span>
            {dish.numberOfOrders > 100 && (
              <span className="text-[8px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(234,179,8,0.2)] font-black tracking-widest">
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
                className="bg-black/40 border border-white/5 text-[10px] font-bold text-white/70 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-inner"
              >
                <span className="text-white/90">{v.size}</span>
                <span className="opacity-30">|</span>
                <div className="flex items-center gap-1">
                  {v.markedPrice != null && v.markedPrice > v.price && (
                    <span className="line-through text-white/40">₹{v.markedPrice}</span>
                  )}
                  <span className="text-white">₹{v.price}</span>
                  {v.onlinePrice != null && v.onlinePrice > 0 && (
                    <span className="text-rose-500 ml-0.5 flex items-center gap-0.5" title="Online Price">
                      <FaGlobe size={8} /> ₹{v.onlinePrice}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <span className="text-[10px] font-bold text-red-400/70 tracking-widest uppercase">No variants</span>
          )}
        </div>

        <div className="flex-1" /> {/* Spacer */}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-4 border-t border-white/5">
          {onEdit && (
            <button
              onClick={() => onEdit(dish)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/20 transition-all"
            >
              <FaEdit size={12} /> Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(dish._id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
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
