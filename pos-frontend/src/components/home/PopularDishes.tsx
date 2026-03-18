import React from "react";
import { useNavigate } from "react-router-dom";
import { getDishes, getFrequentDishes, seedDefaultDishes } from "../../https";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FaUtensils } from "react-icons/fa";
import type { Dish } from "../../types";

const PopularDishes: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: popularDishesRes } = useQuery({
    queryKey: ["popularDishes"],
    queryFn: async () => getFrequentDishes(),
  });

  const { data: allDishesRes } = useQuery({
    queryKey: ["dishes"],
    queryFn: getDishes,
  });

  const seedMutation = useMutation({
    mutationFn: seedDefaultDishes,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
      queryClient.invalidateQueries({ queryKey: ["popularDishes"] });
    },
  });

  const popDishes: Dish[] = popularDishesRes?.data?.data ?? [];
  const allDishes: Dish[] = allDishesRes?.data?.data ?? [];
  const isEmpty = allDishesRes !== undefined && allDishes.length === 0;

  return (
    <div className="glass-card rounded-3xl overflow-hidden h-full">
      <div className="flex justify-between items-center px-6 py-4 border-b border-dhaba-border/20">
        <h2 className="section-title text-dhaba-text">🔥 Popular Dishes</h2>
        <span className="text-dhaba-accent text-xs font-bold tracking-wider uppercase">
          Top sellers
        </span>
      </div>

      {/* Empty DB — prompt to seed */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-dhaba-accent/10 flex items-center justify-center">
            <FaUtensils className="text-dhaba-accent text-xl" />
          </div>
          <div>
            <p className="text-dhaba-text font-semibold text-sm">Menu is empty</p>
            <p className="text-dhaba-muted text-xs mt-1 leading-relaxed">
              Load the default dhaba menu to get started. You can edit prices and images later.
            </p>
          </div>
          {seedMutation.isError && (
            <p className="text-red-400 text-xs">Something went wrong. Try again.</p>
          )}
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="w-full py-2.5 rounded-2xl bg-gradient-warm text-dhaba-bg font-bold text-sm hover:shadow-glow transition-all disabled:opacity-50"
            >
              {seedMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
                  Loading...
                </span>
              ) : (
                "Load Default Menu"
              )}
            </button>
            <button
              onClick={() => navigate("/dashboard/dishes")}
              className="w-full py-2 rounded-2xl text-dhaba-muted text-xs hover:text-dhaba-text transition-colors"
            >
              or manage dishes manually →
            </button>
          </div>
        </div>
      ) : popDishes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <p className="text-dhaba-muted text-sm">No popular dishes yet.</p>
          <p className="text-dhaba-muted/60 text-xs mt-1">Start taking orders to see top sellers.</p>
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default PopularDishes;
