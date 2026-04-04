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
      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all duration-200
        hover:bg-blue-500/5 group border-l-2
        ${isPending ? "border-l-dhaba-warning" : isReady ? "border-l-dhaba-success" : "border-l-blue-400"}
      `}
    >
      {/* Avatar */}
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0
        ${isPending ? "bg-dhaba-warning/80" : isReady ? "bg-dhaba-success" : "bg-blue-500"}
      `}>
        {getAvatarName(order.customerDetails.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-dhaba-text font-semibold text-sm truncate leading-tight">
          {order.customerDetails.name}
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-dhaba-muted mt-0.5">
          {deliveryAddress ? (
            <>
              <MdLocationOn className="text-xs text-blue-400 shrink-0" />
              <span className="truncate max-w-[120px]">{deliveryAddress}</span>
            </>
          ) : (
            <>
              <FaUtensils className="text-[9px]" />
              <span>{order.items.length} items</span>
            </>
          )}
          <span className="opacity-40">·</span>
          <IoTimeOutline className="text-[10px] shrink-0" />
          <span className="shrink-0">{formatDateAndTime(order.orderDate)}</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <p className="text-dhaba-text font-bold text-sm">₹{order.bills.totalWithTax.toFixed(0)}</p>
        <div className="flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
          {balanceDue > 0.01 ? (
            <span className="text-[10px] text-dhaba-danger font-semibold">₹{balanceDue.toFixed(0)} due</span>
          ) : (
            <span className={`text-[10px] font-bold
              ${isPending ? "text-dhaba-warning" : isReady ? "text-dhaba-success" : "text-blue-400"}
            `}>
              {isPending ? "Needs acceptance" : isReady ? "Ready" : "Cooking"}
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
    <div className="glass-card rounded-3xl overflow-hidden border border-blue-500/10">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-blue-500/15 bg-blue-500/5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <FaMotorcycle className="text-blue-400 text-sm" />
          </div>
          <h2 className="font-bold text-dhaba-text">Delivery Queue</h2>
          {total > 0 && (
            <span className="h-5 w-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {total}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate("/orders")}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:underline"
        >
          View all <FaExternalLinkAlt className="text-[9px]" />
        </button>
      </div>

      <div className="p-3 space-y-4 max-h-[420px] overflow-y-auto scrollbar-hide">
        {pending.length > 0 && (
          <DeliverySection
            label="New — Needs Acceptance"
            count={pending.length}
            dotCls="bg-dhaba-warning animate-pulse"
            textCls="text-dhaba-warning"
            orders={pending}
          />
        )}
        {cooking.length > 0 && (
          <DeliverySection
            label="Being Prepared"
            count={cooking.length}
            dotCls="bg-blue-400 animate-pulse"
            textCls="text-blue-400"
            orders={cooking}
          />
        )}
        {ready.length > 0 && (
          <DeliverySection
            label="Ready for Pickup"
            count={ready.length}
            dotCls="bg-dhaba-success"
            textCls="text-dhaba-success"
            orders={ready}
          />
        )}

        {total === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-dhaba-muted">
            <FaMotorcycle className="text-3xl mb-3 text-blue-400 opacity-40" />
            <p className="font-semibold text-sm text-dhaba-text">No delivery orders</p>
            <p className="text-xs mt-1">Online orders will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineOrders;
