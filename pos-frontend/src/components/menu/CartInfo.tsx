import React, { useEffect, useRef } from "react";
import { RiDeleteBin2Fill } from "react-icons/ri";
import { useSelector } from "react-redux";
import { removeItem, updateItem } from "../../redux/slices/cartSlice";
import { FaMinus, FaPlus } from "react-icons/fa";
import { useAppDispatch } from "../../redux/hooks";
import type { RootState } from "../../redux/store";

const CartInfo: React.FC = () => {
  const cartData = useSelector((state: RootState) => state.cart);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [cartData]);

  return (
    <div className="px-4 py-3 flex-1 flex flex-col min-h-0">
      <h3 className="text-sm text-dhaba-text font-bold tracking-wider uppercase mb-3">
        Order Details
      </h3>
      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2" ref={scrollRef}>
        {cartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-dhaba-muted">
            <span className="text-3xl mb-2">🛒</span>
            <p className="text-xs">Cart is empty</p>
          </div>
        ) : (
          cartData.map((item) => (
            <div key={item.id} className="glass-input rounded-xl px-3 py-3">
              <div className="flex items-center justify-between">
                <h4 className="text-dhaba-text text-xs font-semibold truncate flex-1 mr-2">
                  {item.name}
                </h4>
                <div className="flex gap-2 items-center">
                  <button
                    className="h-6 w-6 rounded-lg bg-dhaba-danger/15 text-dhaba-danger flex items-center justify-center hover:bg-dhaba-danger/25 transition-colors"
                    onClick={() => dispatch(updateItem({ id: item.id, quantity: -1 }))}
                  >
                    <FaMinus size={8} />
                  </button>
                  <span className="text-dhaba-text text-xs font-bold w-5 text-center">
                    {item.quantity}
                  </span>
                  <button
                    className="h-6 w-6 rounded-lg bg-dhaba-success/15 text-dhaba-success flex items-center justify-center hover:bg-dhaba-success/25 transition-colors"
                    onClick={() => dispatch(updateItem({ id: item.id, quantity: 1 }))}
                  >
                    <FaPlus size={8} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <button onClick={() => dispatch(removeItem(item.id))} className="text-dhaba-muted hover:text-dhaba-danger transition-colors">
                  <RiDeleteBin2Fill size={14} />
                </button>
                <p className="text-dhaba-accent text-sm font-bold">₹{item.price}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CartInfo;
