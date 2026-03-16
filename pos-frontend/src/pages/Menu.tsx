import React, { useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import { MdRestaurantMenu } from "react-icons/md";
import MenuContainer from "../components/menu/MenuContainer";
import CustomerInfo from "../components/menu/CustomerInfo";
import CartInfo from "../components/menu/CartInfo";
import Bill from "../components/menu/Bill";
import { useSelector } from "react-redux";
import { useAppDispatch } from "../redux/hooks";
import { removeAllItems, updateList } from "../redux/slices/cartSlice";
import { setCustomer, updateTable } from "../redux/slices/customerSlice";
import { useSearchParams } from "react-router-dom";
import { getOrderById } from "../https";
import type { RootState } from "../redux/store";
import type { Order } from "../types";

const Menu: React.FC = () => {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  useEffect(() => {
    document.title = "POS | Menu";

    if (orderId) {
      getOrderById(orderId)
        .then((res) => {
          const orderData = res.data.data as Order;
          dispatch(
            setCustomer({
              name: orderData.customerDetails.name,
              phone: orderData.customerDetails.phone,
              guests: orderData.customerDetails.guests,
            })
          );
          if (orderData.table) {
            dispatch(
              updateTable({
                table: {
                  tableId: orderData.table._id,
                  tableNo: orderData.table.tableNo,
                },
              })
            );
          }
          dispatch(updateList(orderData.items));
        })
        .catch((err) => {
          console.error("Failed to load order data:", err);
        });
    }

    return () => {
      dispatch(removeAllItems());
    };
  }, [dispatch, orderId]);

  const customerData = useSelector((state: RootState) => state.customer);

  return (
    <section className="bg-[#1f1f1f] flex gap-3 h-fit pb-20">
      <div className="flex-[3]">
        <div className="flex items-center justify-between px-10 py-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
              Menu
            </h1>
          </div>
          <div className="flex items-center justify-around gap-4">
            <div className="flex items-center gap-3 cursor-pointer">
              <MdRestaurantMenu className="text-[#f5f5f5] text-4xl" />
              <div className="flex flex-col items-start">
                <h1 className="text-md text-[#f5f5f5] font-semibold tracking-wide">
                  {customerData.customerName || "Customer Name"}
                </h1>
                <p className="text-xs text-[#ababab] font-medium">
                  Table : {customerData.table?.tableNo || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>
        <MenuContainer />
      </div>
      <div className="flex-[1] bg-[#1a1a1a] mt-4 mr-3 h-[780px] rounded-lg pt-2 basis-[12%]">
        <CustomerInfo />
        <hr className="border-[#2a2a2a] border-t-2" />
        <CartInfo />
        <hr className="border-[#2a2a2a] border-t-2" />
        <Bill />
      </div>
      <BottomNav />
    </section>
  );
};

export default Menu;
