import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import * as DishRepo from "../repositories/dishRepo";
import * as OrderRepo from "../repositories/orderRepo";
import * as SettingsRepo from "../repositories/settingsRepo";
import { notifEmitter } from "../utils/notificationEmitter";

// ── GET /api/customer/dishes ─────────────────────────────────────────────────
export async function getPublicDishes(req: Request, res: Response, next: NextFunction) {
  try {
    const all = DishRepo.findAll();
    const available = all
      .filter(d => d && d.isAvailable && d.isOnlineAvailable)
      .map(d => {
        // strip internal tracking field before sending to public
        if (!d) return d;
        const { numberOfOrders: _n, ...pub } = d as Record<string, unknown> & { numberOfOrders: unknown };
        void _n;
        return pub;
      });
    res.json({ success: true, data: available });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/customer/order ─────────────────────────────────────────────────
export async function placeCustomerOrder(req: Request, res: Response, next: NextFunction) {
  try {
    if (!SettingsRepo.isOnlineOrdersEnabled()) {
      return next(createHttpError(503, "Online ordering is currently unavailable. Please visit us in person."));
    }

    const {
      orderType = 'dine-in',
      tableNo,
      customerDetails,
      items,
      bills,
      deliveryAddress = '',
      specialInstructions = '',
      paymentMethod = 'Cash',
      paymentStatus = 'Pending',
      paymentData,
      amountPaid = 0,
    } = req.body;

    if (!customerDetails || !items || !bills) {
      return next(createHttpError(400, "customerDetails, items, and bills are required"));
    }
    if (!Array.isArray(items) || items.length === 0) {
      return next(createHttpError(400, "items must be a non-empty array"));
    }

    // Merge specialInstructions into customerDetails for storage
    const enrichedCustomerDetails = {
      ...customerDetails,
      ...(specialInstructions ? { specialInstructions } : {}),
    };

    const order = OrderRepo.create({
      customerDetails: enrichedCustomerDetails,
      orderStatus: "In Progress",
      bills,
      items,
      tableId: tableNo ? Number(tableNo) : null,
      paymentMethod,
      paymentStatus,
      paymentData: paymentData ?? {},
      amountPaid,
      balanceDueOnOrder: bills.totalWithTax ?? 0,
      orderType,
      deliveryAddress,
    });

    // Notify POS admin in real-time
    notifEmitter.emit("admin", {
      type: "new_order",
      orderId: String(order._id),
      orderType,
      tableNo: tableNo ? Number(tableNo) : null,
      customerName: customerDetails?.name,
      totalAmount: (bills as Record<string, number>).total,
    });

    res.status(201).json({
      success: true,
      data: { _id: order._id, orderStatus: order.orderStatus },
    });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/customer/order/:id/add-items ──────────────────────────────────
export async function addItemsToOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = String(req.params.id);
    const { newItems, updatedBills } = req.body;

    if (!Array.isArray(newItems) || newItems.length === 0) {
      return next(createHttpError(400, "newItems must be a non-empty array"));
    }
    if (!updatedBills) {
      return next(createHttpError(400, "updatedBills is required"));
    }

    const existing = OrderRepo.findById(orderId, false) as Record<string, unknown> | null;
    if (!existing) return next(createHttpError(404, "Order not found"));

    const status = existing.orderStatus as string;
    if (status === "Completed" || status === "Cancelled") {
      return next(createHttpError(400, "Cannot add items to a completed or cancelled order"));
    }

    const updated = OrderRepo.appendItems(orderId, newItems, updatedBills);
    if (!updated) return next(createHttpError(500, "Failed to update order"));

    const allItems = (updated.items as Array<Record<string, unknown>>);
    const maxBatch = allItems.reduce((max, item) => Math.max(max, Number(item.batch) || 1), 1);

    notifEmitter.emit("admin", {
      type: "items_added",
      orderId,
      orderType: existing.orderType as string,
      tableNo: existing.table ? Number(existing.table) : null,
      customerName: (existing.customerDetails as Record<string, unknown>)?.name as string,
      batch: maxBatch,
      newItemsCount: newItems.length,
      totalAmount: (updatedBills as Record<string, number>).total,
    });

    res.json({ success: true, data: { _id: orderId, batch: maxBatch } });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/customer/order/:id ──────────────────────────────────────────────
export async function getOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const order = OrderRepo.findById(String(req.params.id), false);
    if (!order) return next(createHttpError(404, "Order not found"));

    // Return only non-sensitive fields
    const {
      _id, orderStatus, paymentStatus, items, bills,
      orderType, createdAt,
      customerDetails,
    } = order as Record<string, unknown>;

    const safeCustomer = customerDetails
      ? { name: (customerDetails as { name?: string }).name }
      : {};

    res.json({
      success: true,
      data: { _id, orderStatus, paymentStatus, items, bills, orderType, createdAt, customerDetails: safeCustomer },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/customer/order/:id/stream (SSE) ─────────────────────────────────
export async function streamOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const order = OrderRepo.findById(id, false);
    if (!order) return next(createHttpError(404, "Order not found"));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const TERMINAL = new Set(["Completed", "Cancelled"]);
    const o = order as Record<string, unknown>;
    let lastStatus        = o.orderStatus as string;
    let lastPaymentStatus = o.paymentStatus as string;
    // Simple hash to detect item additions by POS staff
    const itemsHash = (r: Record<string, unknown>) => {
      const items = (r.items as unknown[]) ?? [];
      return `${items.length}_${(r.bills as Record<string, number>)?.totalWithTax ?? 0}`;
    };
    let lastItemsHash = itemsHash(o);

    // Send initial state immediately
    res.write(`data: ${JSON.stringify({ orderStatus: lastStatus, paymentStatus: lastPaymentStatus })}\n\n`);

    if (TERMINAL.has(lastStatus)) {
      res.end();
      return;
    }

    const poll = setInterval(() => {
      const latest = OrderRepo.findById(String(id), false) as Record<string, unknown> | null;
      if (!latest) { clearInterval(poll); res.end(); return; }

      const newStatus  = latest.orderStatus as string;
      const newPayment = latest.paymentStatus as string;
      const newHash    = itemsHash(latest);
      const itemsUpdated = newHash !== lastItemsHash;

      if (newStatus !== lastStatus || newPayment !== lastPaymentStatus || itemsUpdated) {
        lastStatus        = newStatus;
        lastPaymentStatus = newPayment;
        lastItemsHash     = newHash;
        res.write(`data: ${JSON.stringify({
          orderStatus: newStatus,
          paymentStatus: newPayment,
          ...(itemsUpdated && { itemsUpdated: true }),
        })}\n\n`);
      }

      if (TERMINAL.has(newStatus)) {
        clearInterval(poll);
        res.end();
      }
    }, 3000);

    // Auto-close after 10 minutes to prevent zombie connections
    const timeout = setTimeout(() => {
      clearInterval(poll);
      res.end();
    }, 10 * 60 * 1000);

    req.on("close", () => {
      clearInterval(poll);
      clearTimeout(timeout);
    });
  } catch (err) {
    next(err);
  }
}
