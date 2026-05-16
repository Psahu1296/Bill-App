import React from "react";
import { FaCheckDouble, FaCircle, FaUtensils, FaMotorcycle, FaShoppingBag } from "react-icons/fa";
import { MdTableRestaurant } from "react-icons/md";
import { FiClock } from "react-icons/fi";
import { getAvatarName } from "../../utils/index";
import { useNavigate } from "react-router-dom";
import { updateList } from "../../redux/slices/cartSlice";
import { updateTable as tableStateUpdate, setCustomer } from "../../redux/slices/customerSlice";
import { useAppDispatch } from "../../redux/hooks";
import type { Order } from "../../types";

interface OrderListProps {
  order: Order;
}

const getTimeAgo = (dateStr?: string) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
};

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

  const shortId = order._id.slice(-4).toUpperCase();
  const timeAgo = getTimeAgo(order.orderDate);

  let TypeIcon = MdTableRestaurant;
  let typeColor = "text-purple-400";
  let typeBg = "bg-purple-500/10";
  let typeBorder = "border-purple-500/20";
  let typeLabel = "Table";

  if (order.orderType === "delivery" || (!order.table && order.orderType !== "takeaway")) {
    TypeIcon = FaMotorcycle;
    typeColor = "text-blue-400";
    typeBg = "bg-blue-500/10";
    typeBorder = "border-blue-500/20";
    typeLabel = "Delivery";
  } else if (order.orderType === "takeaway") {
    TypeIcon = FaShoppingBag;
    typeColor = "text-orange-400";
    typeBg = "bg-orange-500/10";
    typeBorder = "border-orange-500/20";
    typeLabel = "Takeaway";
  } else if (order.table) {
    typeLabel = `T-${order.table.tableNo}`;
  }

  return (
    <div
      className={`glass-card rounded-[1.25rem] p-3 flex items-center gap-3 cursor-pointer transition-all duration-300 group hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] border ${isReady ? "border-dhaba-success/30 hover:border-dhaba-success/60" : "border-white/5 hover:border-white/20"} relative overflow-hidden`}
      onClick={onOrderClick}
    >
      {/* Ready glow background */}
      {isReady && <div className="absolute inset-0 bg-gradient-to-r from-dhaba-success/5 to-transparent pointer-events-none" />}

      {/* Avatar / Type Icon container */}
      <div className={`h-11 w-11 rounded-xl flex flex-col items-center justify-center shrink-0 border relative z-10 ${isReady ? "bg-dhaba-success/10 border-dhaba-success/30" : typeBg + " " + typeBorder}`}>
        <TypeIcon className={`text-lg mb-0.5 ${isReady ? "text-dhaba-success" : typeColor}`} />
        <span className={`text-[8px] font-black uppercase tracking-wider ${isReady ? "text-dhaba-success/70" : typeColor + "/70"}`}>{typeLabel}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-white/90 font-black text-[13px] truncate tracking-wide">
            {order.customerDetails.name}
          </p>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest bg-white/5 text-white/40 border border-white/10 uppercase">
            #{shortId}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/50 font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1">
            <FaUtensils className="text-[9px]" />
            <span>{order.items.length} items</span>
          </div>
          <span className="opacity-30">|</span>
          <div className="flex items-center gap-1">
            <FiClock className="text-[10px]" />
            <span>{timeAgo}</span>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 relative z-10">
        <p className={`font-display text-[15px] font-black tracking-tight ${balanceDue > 0.01 ? "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]" : "text-white/90"}`}>
          ₹{order.bills.totalWithTax.toFixed(0)}
        </p>
        
        {isReady ? (
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-dhaba-success bg-dhaba-success/10 px-1.5 py-0.5 rounded border border-dhaba-success/20">
            <FaCheckDouble className="text-[8px]" /> Ready
          </span>
        ) : balanceDue > 0.01 ? (
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
            ₹{balanceDue.toFixed(0)} due
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-dhaba-accent">
            <FaCircle className="text-[6px] animate-pulse" /> Cooking
          </span>
        )}
      </div>
    </div>
  );
};

export default OrderList;
