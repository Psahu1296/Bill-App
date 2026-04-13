import React, { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrders } from "../../https/index";
import { useNavigate } from "react-router-dom";
import { FaMotorcycle, FaExternalLinkAlt, FaUtensils } from "react-icons/fa";
import { MdLocationOn } from "react-icons/md";
import { IoTimeOutline } from "react-icons/io5";
import { getAvatarName, formatDateAndTime } from "../../utils/index";
import { setCustomer, updateTable as tableStateUpdate } from "../../redux/slices/customerSlice";
import { updateList } from "../../redux/slices/cartSlice";
import { useAppDispatch } from "../../redux/hooks";
import type { Order } from "../../types";

// ── Compact delivery order row ────────────────────────────────────────────────
const DeliveryRow: React.FC<{ order: Order }> = ({ order }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const isPending    = order.orderStatus === "Pending";
  const isReady      = order.orderStatus === "Ready";
  const balanceDue   = Math.max(0, order.bills.totalWithTax - (order.amountPaid || 0));

  const dotColor = isPending
    ? "bg-dhaba-warning animate-pulse"
    : isReady
    ? "bg-dhaba-success"
    : "bg-blue-400 animate-pulse";

  const onClick = () => {
    const { customerDetails, table, items } = order;
    dispatch(setCustomer({ ...customerDetails } as { name: string; phone: string; guests: number }));
    if (table) dispatch(tableStateUpdate({ table: { tableId: table._id, tableNo: table.tableNo } }));
    dispatch(updateList([...items]));
    navigate(`/menu?orderId=${order._id}`);
  };

  const deliveryAddress = (order as unknown as Record<string, unknown>).deliveryAddress as string | undefined;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group border-l-[3px] backdrop-blur-sm
        ${isPending ? "border-l-orange-500 bg-gradient-to-r from-orange-500/10 to-orange-500/5 hover:from-orange-500/20 shadow-orange-500/5 ring-1 ring-orange-500/20" : 
          isReady ? "border-l-emerald-500 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 hover:from-emerald-500/20 shadow-emerald-500/5 ring-1 ring-emerald-500/20" : 
          "border-l-blue-500 bg-gradient-to-r from-blue-500/10 to-blue-500/5 hover:from-blue-500/20 shadow-blue-500/5 ring-1 ring-blue-500/20"}
      `}
    >
      {/* Avatar */}
      <div className={`h-10 w-10 rounded-[14px] flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-inner
        ${isPending ? "bg-orange-500" : isReady ? "bg-emerald-500" : "bg-blue-500"}
      `}>
        {getAvatarName(order.customerDetails.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-dhaba-text font-bold text-sm truncate leading-tight group-hover:text-current transition-colors">
          {order.customerDetails.name}
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-dhaba-muted mt-1 font-medium">
          {deliveryAddress ? (
            <>
              <MdLocationOn className="text-xs text-blue-400 shrink-0" />
              <span className="truncate max-w-[120px]">{deliveryAddress}</span>
            </>
          ) : (
            <>
              <FaUtensils className="text-[10px]" />
              <span>{order.items.length} items</span>
            </>
          )}
          <span className="opacity-40">·</span>
          <IoTimeOutline className="text-xs shrink-0" />
          <span className="shrink-0">{formatDateAndTime(order.orderDate)}</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <p className="text-dhaba-text font-black text-[15px]">₹{order.bills.totalWithTax.toFixed(0)}</p>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-dhaba-bg/50">
          <span className={`h-1.5 w-1.5 rounded-full ${dotColor} shadow-sm shadow-current`} />
          {balanceDue > 0.01 ? (
            <span className="text-[10px] text-red-500 font-bold uppercase tracking-wide border-b border-red-500/30">₹{balanceDue.toFixed(0)} DUE</span>
          ) : (
            <span className={`text-[10px] font-bold uppercase tracking-wider
              ${isPending ? "text-orange-500" : isReady ? "text-emerald-500" : "text-blue-500"}
            `}>
              {isPending ? "Accept?" : isReady ? "Ready" : "Cooking"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Labelled section ──────────────────────────────────────────────────────────
const DeliverySection: React.FC<{
  label: string;
  count: number;
  dotCls: string;
  textCls: string;
  orders: Order[];
}> = ({ label, count, dotCls, textCls, orders }) => (
  <div>
    <div className="flex items-center gap-2 px-2 mb-2">
      <span className={`h-2 w-2 rounded-full shrink-0 ${dotCls}`} />
      <p className={`text-[10px] font-bold uppercase tracking-wider ${textCls}`}>
        {label} — {count}
      </p>
    </div>
    <div className="space-y-1">
      {orders.map((o) => <DeliveryRow key={o._id} order={o} />)}
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const OnlineOrders: React.FC = () => {
  const navigate = useNavigate();

  const { data: resData } = useQuery({
    queryKey: ["orders"],
    queryFn: () => getOrders(),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

  const allOrders: Order[] = resData?.data?.data ?? [];

  const deliveryOrders = useMemo(
    () => allOrders.filter(
      (o) => o.orderType === "delivery" &&
             o.orderStatus !== "Completed" &&
             o.orderStatus !== "Cancelled"
    ),
    [allOrders]
  );

  const pending  = useMemo(() => deliveryOrders.filter((o) => o.orderStatus === "Pending"),                                       [deliveryOrders]);
  const cooking  = useMemo(() => deliveryOrders.filter((o) => o.orderStatus === "Cooking" || o.orderStatus === "In Progress"),    [deliveryOrders]);
  const ready    = useMemo(() => deliveryOrders.filter((o) => o.orderStatus === "Ready"),                                         [deliveryOrders]);
  const total    = deliveryOrders.length;

  return (
    <div className="glass-card rounded-[2rem] overflow-hidden border border-blue-400/30 shadow-2xl shadow-blue-500/10 relative pb-4 bg-gradient-to-b from-blue-500/5 to-dhaba-bg">
      {/* Header */}
      <div className="relative overflow-hidden px-6 py-6 border-b border-blue-400/20 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 shadow-sm">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl -mt-10 -mr-10 pointer-events-none"></div>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
              <FaMotorcycle className="text-white text-xl drop-shadow-md" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-xl text-white drop-shadow-sm tracking-wide">Live Delivery</h2>
              <p className="text-[11px] text-blue-100 font-medium tracking-wide opacity-90 uppercase mt-0.5">Online Queue</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {total > 0 && (
              <span className="px-3 py-1 rounded-full bg-white text-blue-600 text-xs font-black shadow-lg shadow-black/10 animate-pulse border border-white/40 tracking-wider">
                {total} ACTIVE
              </span>
            )}
            <button
              onClick={() => navigate("/orders")}
              className="flex items-center gap-1.5 text-[10px] font-bold text-blue-100 hover:text-white transition-colors uppercase tracking-widest bg-black/10 hover:bg-black/20 px-2 py-1 rounded-md backdrop-blur-sm"
            >
              View all <FaExternalLinkAlt className="text-[9px]" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 max-h-[500px] overflow-y-auto scrollbar-hide">
        {pending.length > 0 && (
          <DeliverySection
            label="New — Needs Acceptance"
            count={pending.length}
            dotCls="bg-orange-500 animate-pulse shadow-sm shadow-orange-500"
            textCls="text-orange-500"
            orders={pending}
          />
        )}
        {cooking.length > 0 && (
          <DeliverySection
            label="Being Prepared"
            count={cooking.length}
            dotCls="bg-blue-500 animate-pulse shadow-sm shadow-blue-500"
            textCls="text-blue-500"
            orders={cooking}
          />
        )}
        {ready.length > 0 && (
          <DeliverySection
            label="Ready for Pickup"
            count={ready.length}
            dotCls="bg-emerald-500 shadow-sm shadow-emerald-500"
            textCls="text-emerald-500"
            orders={ready}
          />
        )}

        {total === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-dhaba-muted">
            <div className="h-20 w-20 rounded-full bg-blue-500/5 flex items-center justify-center mb-4 border border-blue-500/10">
              <FaMotorcycle className="text-4xl text-blue-400 opacity-60" />
            </div>
            <p className="font-bold text-base text-dhaba-text tracking-wide">No Delivery Orders</p>
            <p className="text-xs mt-1.5 font-medium opacity-80">New online orders will appear here automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineOrders;
