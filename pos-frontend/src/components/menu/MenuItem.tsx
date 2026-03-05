import React, { useState, useEffect } from "react";
import { useAppDispatch } from "../../redux/hooks";
import { addItems } from "../../redux/slices/cartSlice";
import { FaShoppingCart } from "react-icons/fa";
import type { Dish, DishVariant } from "../../types";

interface MenuItemProps {
  item: Dish;
}

const MenuItem: React.FC<MenuItemProps> = ({ item }) => {
  const [itemCount, setItemCount] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<DishVariant | null>(null);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (item?.variants?.length > 0) {
      const defaultVariant =
        item.variants.find((v) => v.size === "Full") ||
        item.variants.find((v) => v.size === "Regular") ||
        item.variants[0];
      setSelectedVariant(defaultVariant);
    } else {
      setSelectedVariant(null);
    }
  }, [item]);

  const increment = () => setItemCount((prev) => prev + 1);
  const decrement = () => {
    if (itemCount <= 0) return;
    setItemCount((prev) => prev - 1);
  };

  const handleAddToCart = () => {
    if (itemCount === 0 || !selectedVariant) return;
    dispatch(
      addItems({
        id: item._id,
        name: item.name,
        variantSize: selectedVariant.size,
        pricePerQuantity: selectedVariant.price,
        quantity: itemCount,
        price: selectedVariant.price * itemCount,
      })
    );
    setItemCount(0);
  };

  if (!item?.variants?.length || !selectedVariant) {
    return (
      <div className="flex flex-col items-start justify-between p-4 min-w-[280px] rounded-lg h-[150px] cursor-not-allowed bg-gray-700/50 text-gray-500">
        <h1 className="text-lg font-semibold">{item.name}</h1>
        <p className="text-sm">No variants available.</p>
        <div className="text-center w-full">N/A</div>
      </div>
    );
  }

  return (
    <div
      className={`${
        item.isAvailable ? "" : "pointer-events-none bg-red-700/10"
      } flex flex-col items-start justify-between p-4 min-w-[280px] rounded-lg h-[180px] cursor-pointer hover:bg-[#2a2a2a] bg-[#1a1a1a]`}
    >
      <div className="flex items-start justify-between w-full">
        <h1 className="text-[#f5f5f5] text-lg font-semibold">{item.name}</h1>
        <button
          onClick={handleAddToCart}
          className="bg-[#2e4a40] text-[#02ca3a] p-2 rounded-lg"
        >
          <FaShoppingCart size={20} />
        </button>
      </div>

      <div className="w-full flex justify-between">
        <p className="text-yellow-500 text-xl font-semibold">Price</p>
        <p className="text-[#f5f5f5] text-xl font-bold">
          ₹{selectedVariant.price ? selectedVariant.price.toFixed(2) : "N/A"}
        </p>
      </div>

      <div className="flex items-center justify-between w-full">
        <div className="w-full my-3">
          <select
            value={selectedVariant.size}
            onChange={(e) => {
              const variant = item.variants.find((v) => v.size === e.target.value);
              if (variant) {
                setSelectedVariant(variant);
                setItemCount(0);
              }
            }}
            className="w- py-1 px-2 rounded bg-[#1f1f1f] border border-[#333] text-[#02ca3a] focus:outline-none focus:ring-1 focus:ring-yellow-400 appearance-none"
          >
            {item.variants.map((variant) => (
              <option key={variant.size} value={variant.size}>
                {variant.size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between bg-[#1f1f1f] px-4 py-3 rounded-lg gap-6 w-[50%]">
          <button onClick={decrement} className="text-yellow-500 text-2xl">
            &minus;
          </button>
          <span className="text-white">{itemCount}</span>
          <button onClick={increment} className="text-yellow-500 text-2xl">
            &#43;
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuItem;
