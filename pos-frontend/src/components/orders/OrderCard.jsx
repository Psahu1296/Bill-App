import React from "react";
import { FaCheckDouble, FaLongArrowAltRight } from "react-icons/fa";
import { FaCircle } from "react-icons/fa";
import { formatDateAndTime, getAvatarName } from "../../utils/index";
import { IoCheckmarkDoneCircle } from "react-icons/io5";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setCustomer } from "../../redux/slices/customerSlice";
import { updateList } from "../../redux/slices/cartSlice";
import {
  updateTable as tableStateUpdate,
} from "../../redux/slices/customerSlice";

const OrderCard = ({ key, order, type }) => {

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const onOrderClick = () => {
    if (type === "Complete") return;
    const { customerDetails, table, items } = order;
    dispatch(setCustomer({ ...customerDetails, ...table }));
    dispatch(tableStateUpdate({ table }));
    dispatch(updateList([...items]));
    navigate(`/menu?orderId=${order._id}`);
  };
  return (
    <div
      key={key}
      className={`w-[500px] max-h-[220px] bg-[#262626] p-4 rounded-lg mb-4 ${
        type !== "Complete" ? "cursor-pointer hover:bg-[#1a1a1a]" : ""
      }`}
      onClick={onOrderClick}
    >
      <div className="flex items-center gap-5">
        <button className="bg-[#f6b100] p-3 text-xl font-bold rounded-lg">
          {getAvatarName(order.customerDetails.name)}
        </button>
        <div className="flex items-center justify-between w-[100%]">
          <div className="flex flex-col items-start gap-1">
            <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
              {order.customerDetails.name}
            </h1>
            <p className="text-[#ababab] text-sm">
              #{Math.floor(new Date(order.orderDate).getTime())} / Dine in
            </p>
            <p className="text-[#ababab] text-sm">
              Table{" "}
              <FaLongArrowAltRight className="text-[#ababab] ml-2 inline" />{" "}
              {order.table.tableNo}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {order.orderStatus === "Ready" ? (
              <>
                <p className="orange-green-600 bg-[#4a3b2e] px-2 py-1 rounded-lg">
                  <FaCheckDouble className="inline mr-2" /> {order.orderStatus}
                </p>
                <p className="text-[#ababab] text-sm">
                  <FaCircle className="inline mr-2 orange-green-600" /> Ready to
                  serve
                </p>
              </>
            ) : order.orderStatus === "Completed" ? (
              <>
                <p className="text-green-600 bg-[#3a5d36] px-2 py-1 rounded-lg">
                  <IoCheckmarkDoneCircle className="inline h-6 w-6 mr-2" />{" "}
                  {order.orderStatus}
                </p>
                <p className="text-[#ababab] text-sm">
                  <FaCircle className="inline mr-2 text-green-600" /> Order
                  completed
                </p>
              </>
            ) : (
              <>
                <p className="text-yellow-600 bg-[#4a452e] px-2 py-1 rounded-lg">
                  <FaCircle className="inline mr-2" /> {order.orderStatus}
                </p>
                <p className="text-[#ababab] text-sm">
                  <FaCircle className="inline mr-2 text-yellow-600" /> Preparing
                  your order
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center mt-4 text-[#ababab]">
        <p>{formatDateAndTime(order.orderDate)}</p>
        <p>{order.items.length} Items</p>
      </div>
      <hr className="w-full mt-4 border-t-1 border-gray-500" />
      <div className="flex items-center justify-between mt-4">
        <h1 className="text-[#f5f5f5] text-lg font-semibold">Total</h1>
        <p className="text-[#f5f5f5] text-lg font-semibold">
          ₹{order.bills.totalWithTax.toFixed(2)}
        </p>
      </div>
    </div>
  );
};

export default OrderCard;
