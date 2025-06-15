import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { addItems } from "../../redux/slices/cartSlice";
import { FaShoppingCart } from "react-icons/fa";

const MenuItem = ({ item }) => {
  const [itemCount, setItemCount] = useState(0);
  // State to hold the currently selected variant (e.g., { size: 'Full', price: 350 })
  const [selectedVariant, setSelectedVariant] = useState(null);
  const dispatch = useDispatch();

  // Initialize selectedVariant when item prop changes or component mounts
  useEffect(() => {
    if (item && item.variants && item.variants.length > 0) {
      // Set default to the first variant, or 'Full' if available, otherwise 'Regular'
      const defaultVariant =
        item.variants.find((v) => v.size === "Full") ||
        item.variants.find((v) => v.size === "Regular") ||
        item.variants[0]; // Fallback to first available
      setSelectedVariant(defaultVariant);
    } else {
      setSelectedVariant(null); // No variants available
    }
  }, [item]); // Re-run if item prop changes

  // Update item count and ensure it stays linked to selected variant
  const increment = () => {
    setItemCount((prev) => prev + 1);
  };

  const decrement = () => {
    if (itemCount <= 0) return;
    setItemCount((prev) => prev - 1);
  };

  // Handler for adding/updating item in cart
  const handleAddToCart = () => {
    if (itemCount === 0 || !selectedVariant) return; // Cannot add 0 or if no variant selected

    const newCartItem = {
      id: item._id, // Dish ID
      name: item.name,
      variantSize: selectedVariant.size, // Store selected variant size
      pricePerQuantity: selectedVariant.price, // Store selected variant's price
      quantity: itemCount, // Current count for this variant
      price: selectedVariant.price * itemCount, // Total price for this line item
    };

    dispatch(addItems(newCartItem)); // Use your updateItemQuantity action
    setItemCount(0); // Reset local count after adding to cart
  };

  // If no variants or not selected, disable interaction
  if (
    !item ||
    !item.variants ||
    item.variants.length === 0 ||
    !selectedVariant
  ) {
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
      key={item._id} // Key should be on the outer-most element in a list map
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
        <p className="text-yellow-500 text-xl font-semibold">
          Price
        </p>
        <p className="text-[#f5f5f5] text-xl font-bold">
          ₹ {selectedVariant.price ? selectedVariant.price.toFixed(2) : "N/A"}
        </p>
      </div>

      <div className="flex items-center justify-between w-full">
        {/* Display Price of Selected Variant */}

        {/* Variant Selector (NEW) */}
        <div className="w-full my-3">
          <select
            value={selectedVariant.size} // Control the select input
            onChange={(e) => {
              const newSize = e.target.value;
              const variant = item.variants.find((v) => v.size === newSize);
              if (variant) {
                setSelectedVariant(variant);
                setItemCount(0); // Reset count when variant changes
              }
            }}
            className="w- py-1 px-2 rounded bg-[#1f1f1f] border border-[#333] text-[#02ca3a] focus:outline-none focus:ring-1 focus:ring-yellow-400 appearance-none"
          >
            {item.variants.map((variant) => (
              <option key={variant.size} value={variant.size} >
                {variant.size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between bg-[#1f1f1f] px-4 py-3 rounded-lg gap-6 w-[50%]">
          <button
            onClick={decrement} // No need to pass item._id here, itemCount is local
            className="text-yellow-500 text-2xl"
          >
            &minus;
          </button>
          <span className="text-white">{itemCount}</span>
          <button
            onClick={increment} // No need to pass item._id here
            className="text-yellow-500 text-2xl"
          >
            &#43;
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuItem;
