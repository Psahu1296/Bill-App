import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import createHttpError from "http-errors";
import bcrypt from "bcryptjs";
import * as orderRepo from "../repositories/orderRepo";
import * as tableRepo from "../repositories/tableRepo";
import * as dishRepo from "../repositories/dishRepo";
import * as consumableRepo from "../repositories/consumableRepo";
import * as ledgerRepo from "../repositories/ledgerRepo";
import * as earningRepo from "../repositories/earningRepo";
import * as userRepo from "../repositories/userRepo";
import { getZonedStartOfDayUtc } from "./earningController";
import { CustomRequest as Request } from "../types";

// ── Consumable sync helper ────────────────────────────────────────────────────
const CIGARETTE_KEYWORDS = ["gold flake", "classic", "bristol", "four square", "wills", "navy cut", "cigarette"];
const GUTKA_KEYWORDS = ["gutka", "pauch", "pan masala", "pouch", "manikchand", "rajnigandha", "goa"];

const getConsumableType = (dishName: string, dishCategory?: string): "tea" | "gutka" | "cigarette" | null => {
  const n = dishName.toLowerCase();
  if (n.includes("tea") || n.includes("chai")) return "tea";
  if (CIGARETTE_KEYWORDS.some(kw => n.includes(kw))) return "cigarette";
  if (GUTKA_KEYWORDS.some(kw => n.includes(kw))) return "gutka";
  if (dishCategory === "tobacco") return "gutka";
  return null;
};

const syncConsumablesFromOrder = async (order: Record<string, unknown>) => {
  try {
    const items: Record<string, unknown>[] = (order.items as Record<string, unknown>[]) ?? [];
    if (items.length === 0) return;

    const entries: Parameters<typeof consumableRepo.bulkCreate>[0] = [];
    for (const item of items) {
      const dishId = item.id as string;
      if (!dishId || !mongoose.isValidObjectId(dishId)) continue;
      const dish = await dishRepo.findById(dishId);
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
        orderId: order._id as string,
        timestamp: (order.orderDate instanceof Date)
          ? (order.orderDate as Date).toISOString()
          : (order.orderDate as string) ?? new Date().toISOString(),
      });
    }

    if (entries.length > 0) {
      await consumableRepo.bulkCreate(entries);
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
    if (!tableId || !mongoose.isValidObjectId(tableId)) {
      return next(createHttpError(400, "Invalid Table ID in order data!"));
    }
    const table = await tableRepo.findById(tableId);
    if (!table) return next(createHttpError(404, "Table not found for order!"));

    const totalBill = orderData.bills?.totalWithTax;
    const balanceDueOnOrder = Math.max(0, totalBill - amountPaid);

    // If _id provided — update existing order
    if (_id) {
      if (!mongoose.isValidObjectId(_id)) return next(createHttpError(400, "Invalid Order ID format in body for update!"));

      if (Array.isArray(orderData.items) && orderData.items.length > 0) {
        const existing = await orderRepo.findById(_id, false) as Record<string, unknown> | null;
        if (existing) {
          const existingItems = (existing.items as Array<Record<string, unknown>>) ?? [];
          const batchMap = new Map<string, number>();
          let maxBatch = 1;
          for (const item of existingItems) {
            const key = `${item.id}_${item.variantSize ?? ""}`;
            const b = Number(item.batch) || 1;
            batchMap.set(key, b);
            if (b > maxBatch) maxBatch = b;
          }
          const nextBatch = maxBatch + 1;
          orderData.items = orderData.items.map((item: Record<string, unknown>) => {
            const key = `${item.id}_${item.variantSize ?? ""}`;
            return { ...item, batch: batchMap.has(key) ? batchMap.get(key) : nextBatch };
          });
        }
      }

      const updatedOrder = await orderRepo.update(_id, {
        ...orderData,
        tableId,
        amountPaid,
        balanceDueOnOrder,
      }) as Record<string, unknown> | null;

      if (!updatedOrder) return next(createHttpError(404, "Order not found for update!"));

      await consumableRepo.removeByOrderId(_id);
      await syncConsumablesFromOrder(updatedOrder);

      return res.status(200).json({ success: true, message: "Order updated!", data: updatedOrder });
    }

    // Create new order
    const isVirtualTable = Boolean((table as Record<string, unknown>).isVirtual);

    const newOrder = await orderRepo.create({
      customerDetails: orderData.customerDetails,
      orderStatus: orderData.orderStatus ?? "Pending",
      orderDate: orderData.orderDate,
      bills: orderData.bills,
      items: orderData.items ?? [],
      tableId,
      paymentMethod: orderData.paymentMethod,
      paymentData: orderData.paymentData,
      paymentStatus: orderData.paymentStatus ?? "Pending",
      amountPaid,
      balanceDueOnOrder,
      orderType: orderData.orderType,
      deliveryAddress: orderData.deliveryAddress,
    }) as Record<string, unknown>;

    // Mark physical tables as Booked
    if (!isVirtualTable) {
      await tableRepo.update(tableId, { status: "Booked", currentOrderId: newOrder._id as string });
    }

    // Daily earnings
    if (amountPaid > 0) {
      try {
        const dateIso = getZonedStartOfDayUtc(
          new Date((newOrder.orderDate as Date | string | undefined) ?? new Date())
        ).toISOString();
        await earningRepo.incrementEarnings(dateIso, amountPaid);
      } catch (e) { console.error("Earnings error on addOrder:", e); }
    }

    // Increment dish order counts
    try {
      const items = (newOrder.items as { id: string; quantity: number }[]) ?? [];
      if (items.length > 0) await dishRepo.incrementOrderCounts(items);
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
    if (!id || !mongoose.isValidObjectId(id)) return next(createHttpError(400, "Invalid id!"));

    const order = await orderRepo.findById(id, true);
    if (!order) return next(createHttpError(404, "Order not found!"));
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, tableId, customerPhone, orderStatus, paymentStatus, excludeStatus } = req.query;
    const orders = await orderRepo.findAll({
      startDate: startDate as string | undefined,
      endDate:   endDate   as string | undefined,
      tableId:   tableId   as string | undefined,
      customerPhone: customerPhone as string | undefined,
      orderStatus:   orderStatus   as string | undefined,
      paymentStatus: paymentStatus as string | undefined,
      excludeStatus: excludeStatus as string | undefined,
    });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

const updateOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.isValidObjectId(id)) return next(createHttpError(400, "Invalid Order ID format!"));

    const { _id: _bodyId, id: _bodyId2, ...requestBodyUpdates } = req.body;

    const currentOrder = await orderRepo.findById(id, false) as Record<string, unknown> | null;
    if (!currentOrder) return next(createHttpError(404, "Order not found!"));

    const orderTotalWithTax = ((currentOrder.bills as Record<string, unknown>)?.totalWithTax as number) ?? 0;
    const orderCreationDate = new Date((currentOrder.orderDate as Date | string));
    const oldPaymentStatus  = currentOrder.paymentStatus as string;
    const oldAmountPaid     = currentOrder.amountPaid as number;

    const updatePayload: Record<string, unknown> = { ...requestBodyUpdates };

    if (requestBodyUpdates.amountPaid !== undefined) {
      updatePayload.amountPaid = requestBodyUpdates.amountPaid;
      updatePayload.balanceDueOnOrder = Math.max(0, orderTotalWithTax - requestBodyUpdates.amountPaid);
    }

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

    const justCompleted =
      requestBodyUpdates.orderStatus === "Completed" &&
      (currentOrder.orderStatus as string) !== "Completed";

    const tableRef = currentOrder.table;
    const tableId = tableRef
      ? typeof tableRef === "object"
        ? String((tableRef as Record<string, unknown>)._id)
        : String(tableRef)
      : null;

    const updatedOrder = await orderRepo.update(id, updatePayload) as Record<string, unknown> | null;
    if (!updatedOrder) return next(createHttpError(404, "Order not found after update!"));

    // Ledger: record when order JUST completes with outstanding balance.
    // Delivery / takeaway orders are excluded — cash is collected at the door,
    // so we add to earnings instead of opening a credit ledger entry.
    if (justCompleted) {
      const finalBalanceDue = (updatedOrder.balanceDueOnOrder as number) ?? 0;
      const orderType = (updatedOrder.orderType as string) ?? "dine-in";
      const isDineIn = orderType === "dine-in";

      if (finalBalanceDue > 0) {
        if (isDineIn) {
          const phone = (updatedOrder.customerDetails as Record<string, unknown>)?.phone as string;
          const name  = (updatedOrder.customerDetails as Record<string, unknown>)?.name  as string;
          const alreadyRecorded = await ledgerRepo.getFullPaymentDueForOrder(id);
          if (!alreadyRecorded && phone) {
            await ledgerRepo.upsertWithTransaction({
              customerPhone: phone,
              customerName: name,
              balanceDelta: finalBalanceDue,
              transaction: {
                orderId: id,
                transactionType: "full_payment_due",
                amount: finalBalanceDue,
                timestamp: orderCreationDate.toISOString(),
                notes: `Order #${id} completed — ₹${finalBalanceDue.toFixed(2)} outstanding`,
              },
            });
          }
        } else {
          // Delivery/takeaway: cash collected at door — record as earnings
          amountChangeForEarnings += finalBalanceDue;
          await orderRepo.update(id, { paymentStatus: "Paid", amountPaid: orderTotalWithTax, balanceDueOnOrder: 0 });
        }
      }
    }

    // Ledger: reconcile when customer details or amountPaid changes on an
    // ALREADY-completed dine-in order. Handles phone reassignment correctly by
    // reversing the old phone's contribution first, then re-applying to the new phone.
    const alreadyCompleted = !justCompleted && (currentOrder.orderStatus as string) === "Completed";
    const orderTypeVal     = (currentOrder.orderType as string) ?? "dine-in";

    if (alreadyCompleted && orderTypeVal === "dine-in") {
      const oldPhone = (currentOrder.customerDetails as Record<string, unknown>)?.phone as string;
      const oldName  = (currentOrder.customerDetails as Record<string, unknown>)?.name  as string;

      const newCustomerDetails = requestBodyUpdates.customerDetails as Record<string, unknown> | undefined;
      const newPhone = (newCustomerDetails?.phone as string | undefined) ?? oldPhone;
      const newName  = (newCustomerDetails?.name  as string | undefined) ?? oldName;

      const phoneChanged      = newPhone !== oldPhone;
      const amountPaidChanged = requestBodyUpdates.amountPaid !== undefined &&
                                (requestBodyUpdates.amountPaid as number) !== oldAmountPaid;
      const nameOnlyChanged   = !phoneChanged && !amountPaidChanged && newName !== oldName;

      if (phoneChanged || amountPaidChanged) {
        // Step 1 — erase this order's footprint from the old phone's ledger
        if (oldPhone) {
          await ledgerRepo.reverseOrderTransactions(id, oldPhone, oldName);
        }

        // Step 2 — write the correct balance to the new phone's ledger
        const effectivePaid = requestBodyUpdates.amountPaid !== undefined
          ? (requestBodyUpdates.amountPaid as number)
          : oldAmountPaid;
        const newBalance = Math.max(0, orderTotalWithTax - effectivePaid);

        if (newBalance > 0 && newPhone) {
          await ledgerRepo.upsertWithTransaction({
            customerPhone: newPhone,
            customerName:  newName,
            balanceDelta:  newBalance,
            transaction: {
              orderId:         id,
              transactionType: "full_payment_due",
              amount:          newBalance,
              timestamp:       orderCreationDate.toISOString(),
              notes:           `Order #${id.slice(-6)} — updated by admin (₹${newBalance.toFixed(2)} outstanding)`,
            },
          });
        }
      } else if (nameOnlyChanged && oldPhone) {
        // Name changed but phone/payment didn't — just update the ledger display name
        await ledgerRepo.updateCustomer(oldPhone, { name: newName });
      }
    }

    // Earnings delta
    if (amountChangeForEarnings !== 0) {
      await earningRepo.incrementEarnings(
        getZonedStartOfDayUtc(orderCreationDate).toISOString(),
        amountChangeForEarnings
      );
    }

    // Auto table status
    if (tableId && mongoose.isValidObjectId(tableId)) {
      const targetTable = await tableRepo.findById(tableId) as Record<string, unknown> | null;
      if (targetTable && String(targetTable.currentOrder) === id) {
        const isSettled   = updatedOrder.orderStatus === "Completed" && updatedOrder.paymentStatus === "Paid";
        const isCancelled = updatedOrder.orderStatus === "Cancelled";
        if ((isSettled || isCancelled) && targetTable.status !== "Available") {
          await tableRepo.update(tableId, { status: "Available", currentOrderId: null });
        }
      }
    }

    // Re-sync consumables if items changed
    if (requestBodyUpdates.items !== undefined) {
      await consumableRepo.removeByOrderId(id);
      await syncConsumablesFromOrder(updatedOrder);
    }

    res.status(200).json({ success: true, message: "Order updated successfully!", data: updatedOrder });
  } catch (error) {
    next(error);
  }
};

const deleteOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.isValidObjectId(id)) return next(createHttpError(400, "Invalid Order ID!"));

    const { password } = req.body as { password?: string };
    if (!password) return next(createHttpError(400, "Password is required to delete an order."));
    const currentUser = await userRepo.findById((req.user as Record<string, unknown>)._id as string) as Record<string, unknown> | null;
    if (!currentUser) return next(createHttpError(401, "User not found."));
    const isMatch = await bcrypt.compare(password, currentUser.password as string);
    if (!isMatch) return next(createHttpError(401, "Incorrect password."));

    const order = await orderRepo.findById(id, false) as Record<string, unknown> | null;
    if (!order) return next(createHttpError(404, "Order not found!"));

    const amountPaid       = (order.amountPaid as number) ?? 0;
    const orderDate        = new Date(order.orderDate as Date | string);
    const customerDetails  = order.customerDetails as Record<string, unknown>;
    const phone            = customerDetails?.phone as string;
    const name             = customerDetails?.name as string;

    const tableRef = order.table;
    const tableId = tableRef
      ? typeof tableRef === "object"
        ? String((tableRef as Record<string, unknown>)._id)
        : String(tableRef)
      : null;

    // Look up ledger entry before deletion
    const ledgerEntry = phone ? await ledgerRepo.getFullPaymentDueForOrder(id) : null;

    // Reverse ledger
    if (phone && ledgerEntry) {
      await ledgerRepo.upsertWithTransaction({
        customerPhone: phone,
        customerName: name,
        balanceDelta: -ledgerEntry.amount,
        transaction: {
          orderId: id,
          transactionType: "balance_decreased",
          amount: ledgerEntry.amount,
          notes: `Order #${id} deleted — ₹${ledgerEntry.amount.toFixed(2)} reversed`,
        },
      });
    }

    // Reverse earnings
    if (amountPaid > 0) {
      await earningRepo.incrementEarnings(
        getZonedStartOfDayUtc(orderDate).toISOString(),
        -amountPaid
      );
    }

    // Free the table
    if (tableId && mongoose.isValidObjectId(tableId)) {
      const table = await tableRepo.findById(tableId) as Record<string, unknown> | null;
      if (table && String(table.currentOrder) === id) {
        await tableRepo.update(tableId, { status: "Available", currentOrderId: null });
      }
    }

    await consumableRepo.removeByOrderId(id);
    await orderRepo.remove(id);

    res.status(200).json({ success: true, message: "Order deleted successfully!" });
  } catch (error) {
    next(error);
  }
};

export { addOrder, getOrderById, getOrders, updateOrderById, deleteOrderById };
