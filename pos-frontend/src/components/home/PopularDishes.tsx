import React from "react";
import { getFrequentDishes } from "../../https";
import { useQuery } from "@tanstack/react-query";
import type { Dish } from "../../types";

const PopularDishes: React.FC = () => {
  const { data: popularDishesRes } = useQuery({
    queryKey: ["popularDishes"],
    queryFn: async () => getFrequentDishes(),
  });

  const popDishes: Dish[] = popularDishesRes?.data?.data ?? [];

  return (
    <div className="glass-card rounded-3xl overflow-hidden h-full">
      <div className="flex justify-between items-center px-6 py-4 border-b border-dhaba-border/20">
        <h2 className="section-title text-dhaba-text">🔥 Popular Dishes</h2>
        <span className="text-dhaba-accent text-xs font-bold tracking-wider uppercase">
          Top sellers
        </span>
      </div>
      <div className="overflow-y-auto max-h-[calc(100vh-16rem)] scrollbar-hide p-4 space-y-2">
        {popDishes.map((dish, index) => (
          <div
            key={dish._id}
            className="flex items-center gap-4 p-3 rounded-2xl hover:bg-dhaba-surface-hover transition-all duration-200 group"
          >
            <span className={`font-display text-2xl font-bold w-8 text-center ${index < 3 ? "text-dhaba-accent" : "text-dhaba-muted/40"}`}>
              {index + 1}
            </span>
            <div className="relative">
              <img
                src={dish.image}
                alt={dish.name}
                className="w-12 h-12 rounded-xl object-cover border-2 border-dhaba-border/30 group-hover:border-dhaba-accent/40 transition-colors"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100";
                }}
              />
              {index < 3 && (
                <span className="absolute -top-1 -right-1 text-xs">
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-dhaba-text font-semibold text-sm truncate">
                {dish.name}
              </h3>
              <p className="text-dhaba-muted text-xs mt-0.5">
                <span className="text-dhaba-accent font-bold">{dish.numberOfOrders}</span> orders
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PopularDishes;
