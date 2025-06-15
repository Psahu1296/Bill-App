import React from "react";
import { FaCheckDouble, FaLongArrowAltRight } from "react-icons/fa";
import { FaCircle } from "react-icons/fa";
import { getAvatarName } from "../../utils/index";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { addItems, updateList } from "../../redux/slices/cartSlice";
import {
  updateTable as tableStateUpdate,
} from "../../redux/slices/customerSlice";
import { setCustomer } from "../../redux/slices/customerSlice";

const OrderList = ({ key, order }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const onOrderClick = () => {
    const { customerDetails, table, items } = order;
    dispatch(setCustomer({...customerDetails,...table}));
    dispatch(tableStateUpdate({ table }));
    dispatch(updateList([...items]));
    navigate(`/menu?orderId=${order._id}`);
  };
  return (
    <div
      className="flex items-center gap-5 mb-3 hover:bg-[#262626] p-4 rounded-lg cursor-pointer"
      onClick={onOrderClick}
    >
      <button className="bg-[#f6b100] p-3 text-xl font-bold rounded-lg">
        {getAvatarName(order.customerDetails.name)}
      </button>
      <div className="flex items-center justify-between w-[100%]">
        <div className="flex flex-col items-start gap-1">
          <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
            {order.customerDetails.name}
          </h1>
          <p className="text-[#ababab] text-sm">{order.items.length} Items</p>
        </div>

        <h1 className="text-[#f6b100] font-semibold border border-[#f6b100] rounded-lg p-1 ">
          Table <FaLongArrowAltRight className="text-[#ababab] ml-2 inline" />{" "}
          {order.table.tableNo}
        </h1>

        <div className="flex flex-col items-end gap-2">
          {order.orderStatus === "Ready" ? (
            <>
              <p className="text-green-600 bg-[#2e4a40] px-2 py-1 rounded-lg">
                <FaCheckDouble className="inline mr-2" /> {order.orderStatus}
              </p>
            </>
          ) : (
            <>
              <p className="text-yellow-600 bg-[#4a452e] px-2 py-1 rounded-lg">
                <FaCircle className="inline mr-2" /> {order.orderStatus}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderList;
