import React from "react";
import { FaCheckDouble, FaLongArrowAltRight, FaCircle } from "react-icons/fa";
import { getAvatarName } from "../../utils/index";
import { useNavigate } from "react-router-dom";
import { updateList } from "../../redux/slices/cartSlice";
import { updateTable as tableStateUpdate, setCustomer } from "../../redux/slices/customerSlice";
import { useAppDispatch } from "../../redux/hooks";
import type { Order } from "../../types";

interface OrderListProps {
  order: Order;
}

const OrderList: React.FC<OrderListProps> = ({ order }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const onOrderClick = () => {
    const { customerDetails, table, items } = order;
    dispatch(setCustomer({ ...customerDetails } as { name: string; phone: string; guests: number }));
    // Map populated table._id to tableId so Bill.tsx can read customerData.table?.tableId
    dispatch(tableStateUpdate({ table: { tableId: table._id, tableNo: table.tableNo } }));
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
        <h1 className="text-[#f6b100] font-semibold border border-[#f6b100] rounded-lg p-1">
          Table <FaLongArrowAltRight className="text-[#ababab] ml-2 inline" />{" "}
          {order.table.tableNo}
        </h1>
        <div className="flex flex-col items-end gap-2">
          {order.orderStatus === "Ready" ? (
            <p className="text-green-600 bg-[#2e4a40] px-2 py-1 rounded-lg">
              <FaCheckDouble className="inline mr-2" /> {order.orderStatus}
            </p>
          ) : (
            <p className="text-yellow-600 bg-[#4a452e] px-2 py-1 rounded-lg">
              <FaCircle className="inline mr-2" /> {order.orderStatus}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderList;
