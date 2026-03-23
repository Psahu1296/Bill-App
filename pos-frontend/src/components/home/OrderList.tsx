import React from "react";
import { FaCheckDouble, FaCircle, FaUtensils } from "react-icons/fa";
import { MdTableRestaurant } from "react-icons/md";
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

  const isReady = order.orderStatus === "Ready";
  const balanceDue = Math.max(0, order.bills.totalWithTax - (order.amountPaid || 0));

  const onOrderClick = () => {
    if (order.orderStatus === "Completed") {
      navigate(`/order-summary?orderId=${order._id}`);
      return;
    }
    const { customerDetails, table, items } = order;
    dispatch(setCustomer({ ...customerDetails } as { name: string; phone: string; guests: number }));
    if (table) {
      dispatch(tableStateUpdate({ table: { tableId: table._id, tableNo: table.tableNo } }));
    }
    dispatch(updateList([...items]));
    navigate(`/menu?orderId=${order._id}`);
  };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all duration-200 hover:bg-dhaba-surface-hover group
        border-l-2 ${isReady ? "border-l-dhaba-success" : "border-l-dhaba-accent"}
      `}
      onClick={onOrderClick}
    >
      {/* Avatar */}
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold text-dhaba-bg shrink-0
        ${isReady ? "bg-dhaba-success" : "bg-gradient-warm"}
      `}>
        {getAvatarName(order.customerDetails.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-dhaba-text font-semibold text-sm truncate leading-tight">
          {order.customerDetails.name}
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-dhaba-muted mt-0.5">
          <MdTableRestaurant className="text-xs" />
          <span>{order.table ? `T-${order.table.tableNo}` : (order.orderType ?? "Online")}</span>
          <span className="opacity-40">·</span>
          <FaUtensils className="text-[9px]" />
          <span>{order.items.length} items</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <p className="text-dhaba-text font-bold text-sm">₹{order.bills.totalWithTax.toFixed(0)}</p>
        {balanceDue > 0.01 ? (
          <span className="text-[10px] text-dhaba-danger font-semibold">₹{balanceDue.toFixed(0)} due</span>
        ) : (
          isReady ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-dhaba-success">
              <FaCheckDouble className="text-[8px]" /> Ready
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold text-dhaba-accent">
              <FaCircle className="text-[6px] animate-pulse" /> Cooking
            </span>
          )
        )}
      </div>
    </div>
  );
};

export default OrderList;
