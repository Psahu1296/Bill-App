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
    if (order.orderStatus === "Completed") {
      navigate(`/order-summary?orderId=${order._id}`);
      return;
    }
    const { customerDetails, table, items } = order;
    dispatch(setCustomer({ ...customerDetails } as { name: string; phone: string; guests: number }));
    dispatch(tableStateUpdate({ table: { tableId: table._id, tableNo: table.tableNo } }));
    dispatch(updateList([...items]));
    navigate(`/menu?orderId=${order._id}`);
  };

  return (
    <div
      className="flex items-center gap-4 p-3 rounded-2xl hover:bg-dhaba-surface-hover cursor-pointer transition-all duration-200 group"
      onClick={onOrderClick}
    >
      <div className="h-12 w-12 rounded-xl bg-gradient-warm flex items-center justify-center text-sm font-bold text-dhaba-bg flex-shrink-0 group-hover:shadow-glow transition-shadow">
        {getAvatarName(order.customerDetails.name)}
      </div>
      <div className="flex items-center justify-between flex-1 min-w-0">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-dhaba-text font-semibold text-sm truncate">
            {order.customerDetails.name}
          </h3>
          <p className="text-dhaba-muted text-xs">{order.items.length} Items</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-dhaba-accent text-xs font-bold border border-dhaba-accent/30 rounded-lg px-2.5 py-1 bg-dhaba-accent/5">
            T-{order.table.tableNo}
          </span>
          {order.orderStatus === "Ready" ? (
            <span className="status-chip bg-dhaba-success/15 text-dhaba-success">
              <FaCheckDouble className="inline mr-1" /> Ready
            </span>
          ) : (
            <span className="status-chip bg-dhaba-accent/15 text-dhaba-accent">
              <FaCircle className="inline mr-1 text-[6px]" /> In Progress
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderList;
