import React, { useEffect } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getOrders, updateOrderStatus } from "../../https/index";
import { formatDateAndTime } from "../../utils";
import { useNavigate } from "react-router-dom";
import { IoPrintOutline } from "react-icons/io5";
import type { Order, OrderStatus, PaymentStatus } from "../../types";

const RecentOrders: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleRowClick = (order: Order) => {
    if (order.orderStatus === "Completed") {
      navigate(`/order-summary?orderId=${order._id}`);
    } else {
      navigate(`/menu?orderId=${order._id}`);
    }
  };

  const handlePrint = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    const WinPrint = window.open("", "", "width=500,height=750");
    if (!WinPrint) return;
    WinPrint.document.write(`<!DOCTYPE html><html><head><title>Receipt #${order._id.slice(-6)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; max-width: 400px; margin: auto; color: #222; }
      h2 { text-align:center; font-size: 1.3rem; margin-bottom: 4px; }
      p { margin: 2px 0; font-size: 0.85rem; }
      .row { display: flex; justify-content: space-between; }
      .divider { border: none; border-top: 1px dashed #999; margin: 8px 0; }
      .total { font-size: 1.1rem; font-weight: bold; }
      .footer { text-align: center; margin-top: 16px; font-size: 0.8rem; color: #888; }
    </style></head><body>
    <h2>&#x1F372; Dhaba POS</h2><p style="text-align:center;color:#888;">Order Receipt</p>
    <hr class="divider">
    <p>Order #: <strong>${order._id.slice(-6)}</strong></p>
    <p>Name: <strong>${order.customerDetails.name}</strong></p>
    <p>Phone: ${order.customerDetails.phone}</p>
    <p>Table: T-${order.table.tableNo} &nbsp;|&nbsp; Guests: ${order.customerDetails.guests}</p>
    <hr class="divider">
    <p><strong>Items</strong></p>
    ${order.items.map(i => `<div class="row"><span>${i.name} x${i.quantity}</span><span>&#x20B9;${i.price.toFixed(2)}</span></div>`).join("")}
    <hr class="divider">
    <div class="row"><span>Subtotal</span><span>&#x20B9;${order.bills.total.toFixed(2)}</span></div>
    <div class="row total"><span>Total</span><span>&#x20B9;${order.bills.totalWithTax.toFixed(2)}</span></div>
    <hr class="divider">
    <div class="row"><span>Paid (${order.paymentMethod})</span><span>&#x20B9;${(order.amountPaid || 0).toFixed(2)}</span></div>
    <div class="footer">Thank you for dining with us! &#x2764;</div>
    </body></html>`);
    WinPrint.document.close();
    WinPrint.focus();
    setTimeout(() => { WinPrint.print(); WinPrint.close(); }, 600);
  };

  const orderStatusUpdateMutation = useMutation({
    mutationFn: ({ orderId, orderStatus }: { orderId: string; orderStatus: OrderStatus }) =>
      updateOrderStatus({ orderId, orderStatus, paymentStatus: (orderStatus === "Completed" ? "Paid" : "Pending") as PaymentStatus }),
    onSuccess: () => {
      enqueueSnackbar("Order status updated!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: () => { enqueueSnackbar("Failed to update!", { variant: "error" }); },
  });

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const { data: resData, isError } = useQuery({
    queryKey: ["orders", "dashboard", todayStr],
    queryFn: () => getOrders({ startDate: todayStr, endDate: todayStr }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (isError) enqueueSnackbar("Something went wrong!", { variant: "error" });
  }, [isError]);

  const orders: Order[] = resData?.data?.data ?? [];

  return (
    <div className="container mx-auto glass-card rounded-2xl p-6 mx-6">
      <h2 className="font-display text-xl font-bold text-dhaba-text mb-6">Recent Orders</h2>
      <div className="overflow-x-auto rounded-xl">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-dhaba-surface text-dhaba-muted text-xs font-bold tracking-wider uppercase">
              <th className="p-4 rounded-tl-xl">Customer</th>
              <th className="p-4">Status</th>
              <th className="p-4">Date & Time</th>
              <th className="p-4">Items</th>
              <th className="p-4">Table</th>
              <th className="p-4">Total</th>
              <th className="p-4">Payment</th>
              <th className="p-4 rounded-tr-xl">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, index) => (
              <tr
                key={index}
                className="border-b border-dhaba-border/15 hover:bg-dhaba-surface-hover/50 transition-colors cursor-pointer"
                onClick={() => handleRowClick(order)}
              >
                <td className="p-4 text-dhaba-text font-semibold">{order.customerDetails.name}</td>
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                  <select
                    className="glass-input rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none appearance-none"
                    style={{ color: order.orderStatus === "Ready" || order.orderStatus === "Completed" ? "hsl(var(--dhaba-success))" : "hsl(var(--dhaba-accent))" }}
                    value={order.orderStatus}
                    onChange={(e) => orderStatusUpdateMutation.mutate({ orderId: order._id, orderStatus: e.target.value as OrderStatus })}
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Ready">Ready</option>
                    <option value="Completed">Completed</option>
                  </select>
                </td>
                <td className="p-4 text-dhaba-muted text-xs">{formatDateAndTime(order.orderDate)}</td>
                <td className="p-4 text-dhaba-text">{order.items.length}</td>
                <td className="p-4"><span className="text-dhaba-accent font-bold">T-{order.table.tableNo}</span></td>
                <td className="p-4 text-dhaba-text font-bold">₹{order.bills.totalWithTax}</td>
                <td className="p-4 text-dhaba-muted">{order.paymentMethod}</td>
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                  {order.paymentStatus === "Pending" ? (
                    <button
                      className="btn-accent rounded-lg px-3 py-1.5 text-xs"
                      onClick={(e) => { e.stopPropagation(); navigate(`/order-summary?orderId=${order._id}`); }}
                    >
                      Pay
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handlePrint(e, order)}
                      className="flex items-center gap-1.5 text-dhaba-success text-xs font-bold hover:text-dhaba-success/80 transition-colors"
                      title="Print Receipt"
                    >
                      <IoPrintOutline className="text-sm" /> Print
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentOrders;
