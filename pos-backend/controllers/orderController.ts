import { Response, NextFunction } from "express";
import createHttpError from "http-errors";
import * as orderRepo from "../repositories/orderRepo";
import * as tableRepo from "../repositories/tableRepo";
import * as dishRepo from "../repositories/dishRepo";
import * as consumableRepo from "../repositories/consumableRepo";
import * as ledgerRepo from "../repositories/ledgerRepo";
import * as earningRepo from "../repositories/earningRepo";
import { getZonedStartOfDayUtc } from "./earningController";
import { CustomRequest as Request } from "../types";

// ── Consumable sync helper ────────────────────────────────────────────────────
const CIGARETTE_KEYWORDS = ["gold flake", "classic", "bristol", "four square", "wills", "navy cut", "cigarette"];
const GUTKA_KEYWORDS = ["gutka", "pauch", "pan masala", "pouch", "manikchand", "rajnigandha", "goa"];

const getConsumableType = (dishName: string, dishCategory?: string): "tea" | "gutka" | "cigarette" | null => {
  const n = dishName.toLowerCase();
  // Tea/chai — match by name
  if (n.includes("tea") || n.includes("chai")) return "tea";
  // Cigarette — match by name
  if (CIGARETTE_KEYWORDS.some(kw => n.includes(kw))) return "cigarette";
  // Gutka — match by name
  if (GUTKA_KEYWORDS.some(kw => n.includes(kw))) return "gutka";
  // Tobacco category fallback (for future dishes)
  if (dishCategory === "tobacco") return "gutka";
  return null;
};

const syncConsumablesFromOrder = (order: Record<string, unknown>) => {
  try {
    const items: Record<string, unknown>[] = (order.items as Record<string, unknown>[]) ?? [];
    if (items.length === 0) return;

    const entries: Parameters<typeof consumableRepo.bulkCreate>[0] = [];
    for (const item of items) {
      const dishId = item.id as string;
      if (!dishId || isNaN(Number(dishId))) continue;
      const dish = dishRepo.findById(dishId);
      if (!dish) continue;
      const consumableType = getConsumableType(
        (dish as Record<string, unknown>).name as string,
        (dish as Record<string, unknown>).category as string
      );
      if (!consumableType) continue;
      entries.push({
        type: consumableType,
        quantity: item.quantity as number,
        pricePerUnit: item.pricePerQuantity as number,
        consumerType: "customer",
        consumerName: ((order.customerDetails as Record<string, unknown>)?.name as string) ?? "Customer",
        orderId: Number(order._id),
        timestamp: (order.orderDate as string) ?? new Date().toISOString(),
      });
    }

    if (entries.length > 0) {
      consumableRepo.bulkCreate(entries);
      console.log(`✅ Auto-synced ${entries.length} consumable(s) from order ${order._id}`);
    }
  } catch (err) {
    console.error("⚠️  Failed to sync consumables from order:", err);
  }
};

// ── Controllers ───────────────────────────────────────────────────────────────

const addOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { _id, amountPaid = 0, ...orderData } = req.body;

    if (!orderData.customerDetails?.name || !orderData.customerDetails?.phone) {
      return next(createHttpError(400, "Customer name and phone are required!"));
    }
    if (orderData.bills?.totalWithTax === undefined && orderData.bills?.totalWithTax !== 0) {
      return next(createHttpError(400, "Bill total is required!"));
    }

    const tableId = orderData.table;
    if (!tableId || isNaN(Number(tableId))) {
      return next(createHttpError(400, "Invalid Table ID in order data!"));
    }
    const table = tableRepo.findById(tableId);
    if (!table) return next(createHttpError(404, "Table not found for order!"));

    const totalBill = orderData.bills?.totalWithTax;
    const balanceDueOnOrder = Math.max(0, totalBill - amountPaid);

    // If _id provided — update existing order
    if (_id) {
      if (isNaN(Number(_id))) return next(createHttpError(400, "Invalid Order ID format in body for update!"));

      // Preserve / assign batch numbers so items added by staff go to the next round
      if (Array.isArray(orderData.items) && orderData.items.length > 0) {
        const existing = orderRepo.findById(_id, false) as Record<string, unknown> | null;
        if (existing) {
          const existingItems = (existing.items as Array<Record<string, unknown>>) ?? [];
          // map: "id_variantSize" → batch number from DB
          const batchMap = new Map<string, number>();
          let maxBatch = 1;
          for (const item of existingItems) {
            const key = `${item.id}_${item.variantSize ?? ''}`;
            const b = Number(item.batch) || 1;
            batchMap.set(key, b);
            if (b > maxBatch) maxBatch = b;
          }
          const nextBatch = maxBatch + 1;
          orderData.items = orderData.items.map((item: Record<string, unknown>) => {
            const key = `${item.id}_${item.variantSize ?? ''}`;
            return { ...item, batch: batchMap.has(key) ? batchMap.get(key) : nextBatch };
          });
        }
      }

      const updatedOrder = orderRepo.update(_id, {
        ...orderData,
        tableId: Number(tableId),
        amountPaid,
        balanceDueOnOrder,
      }) as Record<string, unknown>;
      if (!updatedOrder) return next(createHttpError(404, "Order not found for update!"));
      consumableRepo.removeByOrderId(_id);
      syncConsumablesFromOrder(updatedOrder);
      return res.status(200).json({ success: true, message: "Order updated!", data: updatedOrder });
    }

    // Create new order (wrapped in a SQLite transaction for atomicity)
    const db = require("../db").getDb();
    const createOrderTx = db.transaction(() => {
      const newOrder = orderRepo.create({
        customerDetails: orderData.customerDetails,
        orderStatus: orderData.orderStatus ?? "Pending",
        orderDate: orderData.orderDate,
        bills: orderData.bills,
        items: orderData.items ?? [],
        tableId: Number(tableId),
        paymentMethod: orderData.paymentMethod,
        paymentData: orderData.paymentData,
        paymentStatus: orderData.paymentStatus ?? "Pending",
        amountPaid,
        balanceDueOnOrder,
      });

      // Mark table as Booked
      tableRepo.update(tableId, { status: "Booked", currentOrderId: Number(newOrder!._id) });

      return newOrder!;
    });

    const newOrder = createOrderTx() as Record<string, unknown>;

    // Ledger: only record if there is an outstanding balance
    const customerPhone = orderData.customerDetails?.phone;
    const customerName  = orderData.customerDetails?.name;
    if (balanceDueOnOrder > 0) {
      try {
        ledgerRepo.upsertWithTransaction({
          customerPhone,
          customerName,
          balanceDelta: balanceDueOnOrder,
          transaction: {
            orderId: Number(newOrder._id),
            transactionType: "full_payment_due",
            amount: totalBill,
            notes: `Bill for Order #${newOrder._id}`,
          },
        });
      } catch (e) { console.error("Ledger error on addOrder:", e); }
    }

    // Daily earnings: count amountPaid immediately
    if (amountPaid > 0) {
      try {
        const dateIso = getZonedStartOfDayUtc(
          new Date((newOrder.orderDate as string) ?? new Date())
        ).toISOString();
        earningRepo.incrementEarnings(dateIso, amountPaid);
      } catch (e) { console.error("Earnings error on addOrder:", e); }
    }

    // Increment dish order counts for popularity tracking
    try {
      const items = (newOrder.items as { id: string; quantity: number }[]) ?? [];
      if (items.length > 0) dishRepo.incrementOrderCounts(items);
    } catch (e) { console.error("Failed to increment dish order counts:", e); }

    // Auto-sync consumables (fire-and-forget)
    syncConsumablesFromOrder(newOrder);

    res.status(201).json({ success: true, message: "Order created!", data: newOrder });
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || isNaN(Number(id))) return next(createHttpError(400, "Invalid id!"));

    const order = orderRepo.findById(id, true);
    if (!order) return next(createHttpError(404, "Order not found!"));
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, tableId, customerPhone, orderStatus, paymentStatus } = req.query;
    const orders = orderRepo.findAll({
      startDate: startDate as string | undefined,
      endDate:   endDate   as string | undefined,
      tableId:   tableId   as string | undefined,
      customerPhone: customerPhone as string | undefined,
      orderStatus:   orderStatus   as string | undefined,
      paymentStatus: paymentStatus as string | undefined,
    });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

const updateOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || isNaN(Number(id))) return next(createHttpError(400, "Invalid Order ID format!"));

    const { _id: _bodyId, id: _bodyId2, ...requestBodyUpdates } = req.body;

    const currentOrder = orderRepo.findById(id, false) as Record<string, unknown> | null;
    if (!currentOrder) return next(createHttpError(404, "Order not found!"));

    const orderTotalWithTax = ((currentOrder.bills as Record<string,unknown>)?.totalWithTax as number) ?? 0;
    const orderCreationDate = new Date((currentOrder.orderDate as string));
    const oldPaymentStatus  = currentOrder.paymentStatus as string;
    const oldAmountPaid     = currentOrder.amountPaid as number;

    const updatePayload: Record<string, unknown> = { ...requestBodyUpdates };

    if (requestBodyUpdates.amountPaid !== undefined) {
      updatePayload.amountPaid = requestBodyUpdates.amountPaid;
      updatePayload.balanceDueOnOrder = Math.max(0, orderTotalWithTax - requestBodyUpdates.amountPaid);
    }

    // Determine earning delta
    let amountChangeForEarnings = 0;
    if (requestBodyUpdates.amountPaid !== undefined) {
      amountChangeForEarnings = (updatePayload.amountPaid as number) - oldAmountPaid;
    } else if (requestBodyUpdates.paymentStatus === "Paid" && oldPaymentStatus !== "Paid") {
      amountChangeForEarnings = orderTotalWithTax - oldAmountPaid;
      updatePayload.amountPaid = orderTotalWithTax;
      updatePayload.balanceDueOnOrder = 0;
    } else if (
      (requestBodyUpdates.paymentStatus === "Refunded" || requestBodyUpdates.paymentStatus === "Pending") &&
      oldAmountPaid > 0
    ) {
      amountChangeForEarnings = -oldAmountPaid;
      updatePayload.amountPaid = 0;
      updatePayload.balanceDueOnOrder = orderTotalWithTax;
    }

    const updatedOrder = orderRepo.update(id, updatePayload) as Record<string, unknown>;
    if (!updatedOrder) return next(createHttpError(404, "Order not found after update!"));

    // Ledger delta
    const oldBalanceDue = Math.max(0, orderTotalWithTax - oldAmountPaid);
    const newBalanceDue = updatedOrder.balanceDueOnOrder as number;
    const netChange     = newBalanceDue - oldBalanceDue;

    if (netChange !== 0) {
      const phone = (updatedOrder.customerDetails as Record<string,unknown>)?.phone as string;
      const name  = (updatedOrder.customerDetails as Record<string,unknown>)?.name  as string;
      try {
        ledgerRepo.upsertWithTransaction({
          customerPhone: phone,
          customerName: name,
          balanceDelta: netChange,
          transaction: {
            orderId: Number(updatedOrder._id),
            transactionType: netChange > 0 ? "balance_increased" : "balance_decreased",
            amount: Math.abs(netChange),
            notes: `Order #${updatedOrder._id} updated. Net change: ${netChange.toFixed(2)}`,
          },
        });
      } catch (e) { console.error("Ledger error on updateOrder:", e); }
    }

    // Earnings delta
    if (amountChangeForEarnings !== 0) {
      try {
        earningRepo.incrementEarnings(
          getZonedStartOfDayUtc(orderCreationDate).toISOString(),
          amountChangeForEarnings
        );
      } catch (e) { console.error("Earnings error on updateOrder:", e); }
    }

    // Auto table status
    const tableId = currentOrder.table as string | null;
    if (tableId) {
      const targetTable = tableRepo.findById(tableId) as Record<string, unknown> | null;
      if (targetTable && String(targetTable.currentOrder) === String(currentOrder._id)) {
        const isSettled   = updatedOrder.orderStatus === "Completed" && updatedOrder.paymentStatus === "Paid";
        const isCancelled = updatedOrder.orderStatus === "Cancelled";
        if ((isSettled || isCancelled) && targetTable.status !== "Available") {
          tableRepo.update(tableId, { status: "Available", currentOrderId: null });
        }
      }
    }

    // Re-sync consumables if items changed
    if (requestBodyUpdates.items !== undefined) {
      consumableRepo.removeByOrderId(id);
      syncConsumablesFromOrder(updatedOrder);
    }

    res.status(200).json({ success: true, message: "Order updated successfully!", data: updatedOrder });
  } catch (error) {
    next(error);
  }
};

export { addOrder, getOrderById, getOrders, updateOrderById };
