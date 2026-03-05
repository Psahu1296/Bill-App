import React, { useEffect, useRef } from "react";
import { RiDeleteBin2Fill } from "react-icons/ri";
import { FaNotesMedical } from "react-icons/fa6";
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
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [cartData]);

  const handleRemove = (itemId: string) => {
    dispatch(removeItem(itemId));
  };

  const updateItemCount = (itemId: string, quantity: number) => {
    dispatch(updateItem({ id: itemId, quantity }));
  };

  return (
    <div className="px-4 py-2">
      <h1 className="text-lg text-[#e4e4e4] font-semibold tracking-wide">
        Order Details
      </h1>
      <div
        className="mt-4 overflow-y-scroll scrollbar-hide h-[380px]"
        ref={scrollRef}
      >
        {cartData.length === 0 ? (
          <p className="text-[#ababab] text-sm flex justify-center items-center h-[380px]">
            Your cart is empty. Start adding items!
          </p>
        ) : (
          cartData.map((item) => (
            <div key={item.id} className="bg-[#1f1f1f] rounded-lg px-4 py-4 mb-2">
              <div className="flex items-center justify-between">
                <h1 className="text-[#ababab] font-semibold tracking-wide text-md">
                  {item.name}
                </h1>
                <div className="flex gap-4 items-center">
                  <div
                    className="bg-[#e47575] h-8 w-8 rounded-full cursor-pointer"
                    onClick={() => updateItemCount(item.id, -1)}
                  >
                    <FaMinus className="text-[#922626] m-2" />
                  </div>
                  <p className="text-[#ababab] font-semibold">x{item.quantity}</p>
                  <div
                    className="bg-[#8ddb75] h-8 w-8 rounded-full cursor-pointer"
                    onClick={() => updateItemCount(item.id, 1)}
                  >
                    <FaPlus className="text-[#1d7337] m-2" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3">
                  <RiDeleteBin2Fill
                    onClick={() => handleRemove(item.id)}
                    className="text-[#ababab] cursor-pointer"
                    size={20}
                  />
                  <FaNotesMedical
                    className="text-[#ababab] cursor-pointer"
                    size={20}
                  />
                </div>
                <p className="text-[#f5f5f5] text-md font-bold">₹{item.price}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CartInfo;
