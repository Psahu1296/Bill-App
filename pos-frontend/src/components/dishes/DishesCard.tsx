import React from "react";
import { FaEdit, FaTrash, FaFire } from "react-icons/fa";
import { Img } from "react-image";
import type { Dish } from "../../types";
import { getDishImage } from "../../utils";

const CATEGORY_BADGE: Record<string, { bg: string; dot: string; label: string }> = {
  veg: { bg: "bg-dhaba-success/15 text-dhaba-success", dot: "bg-dhaba-success", label: "VEG" },
  non_veg: { bg: "bg-dhaba-danger/15 text-dhaba-danger", dot: "bg-dhaba-danger", label: "NON-VEG" },
  egg: { bg: "bg-dhaba-warning/15 text-dhaba-warning", dot: "bg-dhaba-warning", label: "EGG" },
};

interface DishCardProps {
  dish: Dish;
  onEdit?: (dish: Dish) => void;
  onDelete?: (dishId: string) => void;
}

const DishCard: React.FC<DishCardProps> = ({ dish, onEdit, onDelete }) => {
  const badge = CATEGORY_BADGE[dish.category] || { bg: "bg-dhaba-muted/15 text-dhaba-muted", dot: "bg-dhaba-muted", label: dish.category };

  return (
    <div className="glass-card rounded-2xl overflow-hidden w-[280px] group hover:shadow-glow hover:-translate-y-1 transition-all duration-300 relative">
      {/* Image */}
      <div className="relative h-40 overflow-hidden">
        <Img
          src={[
            getDishImage(dish.name, dish.image),
            "https://via.placeholder.com/300x200?text=No+Image"
          ].filter(Boolean) as string[]}
          alt={dish.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          loader={<div className="w-full h-full bg-dhaba-surface animate-pulse" />}
          unloader={
            <div className="w-full h-full bg-dhaba-surface flex items-center justify-center text-xs text-dhaba-muted">
              No Image
            </div>
          }
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dhaba-bg/90 via-dhaba-bg/20 to-transparent" />

        {/* Category badge */}
        <div className={`absolute top-3 left-3 ${badge.bg} px-2.5 py-1 rounded-lg flex items-center gap-1.5 backdrop-blur-sm`}>
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
          <span className="text-[10px] font-bold tracking-wider">{badge.label}</span>
        </div>

        {/* Availability */}
        {!dish.isAvailable && (
          <div className="absolute inset-0 bg-dhaba-bg/70 backdrop-blur-sm flex items-center justify-center">
            <span className="text-dhaba-danger font-bold text-sm tracking-wider uppercase bg-dhaba-danger/10 px-4 py-2 rounded-xl">
              Unavailable
            </span>
          </div>
        )}

        {/* Popular fire badge */}
        {dish.isFrequent && (
          <div className="absolute top-3 right-3 bg-dhaba-accent/20 text-dhaba-accent p-2 rounded-lg backdrop-blur-sm">
            <FaFire size={12} />
          </div>
        )}

        {/* Price tag floating on image */}
        <div className="absolute bottom-3 right-3 bg-dhaba-bg/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-dhaba-border/20">
          <span className="font-display text-lg font-bold text-dhaba-accent">
            ₹{dish.variants?.[0]?.price ?? "—"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-display text-base font-bold text-dhaba-text leading-tight truncate">
            {dish.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-dhaba-muted font-bold tracking-wider uppercase">
              {dish.numberOfOrders} orders
            </span>
            {dish.numberOfOrders > 100 && (
              <span className="text-[9px] bg-dhaba-accent/10 text-dhaba-accent px-1.5 py-0.5 rounded-md font-bold">
                BESTSELLER
              </span>
            )}
          </div>
        </div>

        {/* Variants */}
        <div className="flex flex-wrap gap-1.5">
          {dish.variants?.length > 0 ? (
            dish.variants.map((v, i) => (
              <span
                key={i}
                className="glass-input text-[11px] font-semibold text-dhaba-text px-2.5 py-1 rounded-lg"
              >
                {v.size} · <span className="text-dhaba-accent">₹{v.price}</span>
              </span>
            ))
          ) : (
            <span className="text-xs text-dhaba-danger">No variants</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-dhaba-border/10">
          {onEdit && (
            <button
              onClick={() => onEdit(dish)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-dhaba-muted hover:text-dhaba-accent hover:bg-dhaba-accent/10 transition-all"
              aria-label={`Edit ${dish.name}`}
            >
              <FaEdit size={12} /> Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(dish._id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-dhaba-muted hover:text-dhaba-danger hover:bg-dhaba-danger/10 transition-all"
              aria-label={`Delete ${dish.name}`}
            >
              <FaTrash size={11} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DishCard;
