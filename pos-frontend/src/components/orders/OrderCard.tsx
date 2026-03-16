import React from "react";
import { FaCheckDouble, FaCircle } from "react-icons/fa";
import { formatDateAndTime, getAvatarName } from "../../utils/index";
import { IoCheckmarkDoneCircle } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { setCustomer, updateTable as tableStateUpdate } from "../../redux/slices/customerSlice";
import { updateList } from "../../redux/slices/cartSlice";
import { useAppDispatch } from "../../redux/hooks";
import type { Order } from "../../types";

interface OrderCardProps {
  order: Order;
  type: string;
}

const OrderCard: React.FC<OrderCardProps> = ({ order }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const isCompleted = order.orderStatus === "Completed";
  const isCompletedAndFullyPaid = isCompleted && (order.paymentStatus === "Paid" || (order.amountPaid || 0) >= order.bills.totalWithTax);

  const onOrderClick = () => {
    // Completed orders always go to the read-only summary page
    if (isCompleted) {
      navigate(`/order-summary?orderId=${order._id}`);
      return;
    }
    // Active orders → load into menu editor
    const { customerDetails, table, items } = order;
    dispatch(setCustomer({ ...customerDetails } as { name: string; phone: string; guests: number }));
    dispatch(tableStateUpdate({ table: { tableId: table._id, tableNo: table.tableNo } }));
    dispatch(updateList([...items]));
    navigate(`/menu?orderId=${order._id}`);
  };

  const statusConfig = {
    "Ready": { chip: "bg-dhaba-success/15 text-dhaba-success", icon: <FaCheckDouble className="inline mr-1.5" />, sub: "Ready to serve" },
    "Completed": { chip: "bg-dhaba-success/15 text-dhaba-success", icon: <IoCheckmarkDoneCircle className="inline h-4 w-4 mr-1.5" />, sub: "Order completed" },
    "In Progress": { chip: "bg-dhaba-accent/15 text-dhaba-accent", icon: <FaCircle className="inline mr-1.5 text-[6px]" />, sub: "Preparing your order" },
  };
  const cfg = statusConfig[order.orderStatus as keyof typeof statusConfig] || statusConfig["In Progress"];

  return (
    <div
      className={`w-[480px] glass-card rounded-2xl p-5 transition-all duration-300 ${
        isCompleted && isCompletedAndFullyPaid ? "opacity-70" : "cursor-pointer hover:shadow-glow hover:-translate-y-0.5"
      }`}
      onClick={onOrderClick}
    >
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-warm flex items-center justify-center text-sm font-bold text-dhaba-bg flex-shrink-0">
          {getAvatarName(order.customerDetails.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-dhaba-text font-bold">{order.customerDetails.name}</h3>
              <p className="text-dhaba-muted text-xs mt-0.5">
                Table {order.table.tableNo} · Dine in
              </p>
            </div>
            <div className="text-right">
              <span className={`status-chip ${cfg.chip}`}>
                {cfg.icon}{order.orderStatus}
              </span>
              <p className="text-dhaba-muted text-[10px] mt-1">{cfg.sub}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 text-dhaba-muted text-xs">
        <p>{formatDateAndTime(order.orderDate)}</p>
        <p className="font-semibold">{order.items.length} Items</p>
      </div>

      <div className="h-px bg-dhaba-border/30 my-3" />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-dhaba-text font-bold text-lg">₹{order.bills.totalWithTax.toFixed(0)}</p>
          <p className="text-dhaba-muted text-xs">Paid: ₹{(order.amountPaid || 0).toFixed(0)}</p>
        </div>
        <p className="text-dhaba-accent font-bold text-lg">
          Due: ₹{Math.max(0, order.bills.totalWithTax - (order.amountPaid || 0)).toFixed(0)}
        </p>
      </div>
    </div>
  );
};

export default OrderCard;
