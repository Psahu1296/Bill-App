import React from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import { Img } from "react-image";
import type { Dish } from "../../types";

const CATEGORY_COLORS: Record<string, string> = {
  veg: "bg-green-500 text-green-900",
  non_veg: "bg-red-500 text-red-900",
  egg: "bg-orange-500 text-orange-900",
};

interface DishCardProps {
  dish: Dish;
  onEdit?: (dish: Dish) => void;
  onDelete?: (dishId: string) => void;
}

const DishCard: React.FC<DishCardProps> = ({ dish, onEdit, onDelete }) => {
  const chipColorClass =
    CATEGORY_COLORS[dish.category] || "bg-gray-500 text-gray-900";

  return (
    <div className="flex flex-col bg-[#1f1f1f] rounded-lg pb-3 shadow-md overflow-hidden text-[#f5f5f5] h-[260px] w-[260px] border border-gray-700">
      <div className="w-full h-24 rounded-s-lg rounded-e-lg overflow-hidden flex-shrink-0">
        <Img
          src={[dish.image, "https://via.placeholder.com/150?text=No+Image"]}
          alt={dish.name}
          className="w-full h-full object-cover"
          loader={<div className="w-full h-full bg-gray-700 animate-pulse" />}
          unloader={
            <div className="w-full h-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">
              Img Error
            </div>
          }
        />
      </div>

      <div className="flex flex-col flex-grow items-start px-3">
        <div className="flex w-full justify-between my-2">
          <div className="w-[80%]">
            <h3 className="text-lg font-semibold">{dish.name}</h3>
            <p className="text-sm text-gray-400">Orders: {dish.numberOfOrders}</p>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${chipColorClass} flex-shrink-0 h-fit`}
          >
            {dish.category.replace(/_/g, " ").toUpperCase()}
          </span>
        </div>

        <div className="flex w-full flex-col flex-wrap gap-x-3 justify-between gap-y-1 text-yellow-400 font-semibold">
          {dish.variants?.length > 0 ? (
            dish.variants.map((variant, index) => (
              <span key={index}>
                {variant.size}: ₹{variant.price ? variant.price.toFixed(2) : "N/A"}
              </span>
            ))
          ) : (
            <span className="text-red-400">No price set</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center space-x-2 gap-6 flex-shrink-0">
        {onEdit && (
          <button
            onClick={() => onEdit(dish)}
            className="text-blue-500 hover:text-blue-700 transition-colors"
            aria-label={`Edit ${dish.name}`}
          >
            <FaEdit size={20} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(dish._id)}
            className="text-red-500 hover:text-red-700 transition-colors"
            aria-label={`Delete ${dish.name}`}
          >
            <FaTrash size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

export default DishCard;
