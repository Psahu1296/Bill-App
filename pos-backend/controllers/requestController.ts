import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import config from "../config/config";
import * as DishRequestRepo from "../repositories/dishRequestRepo";
import * as PreOrderRepo from "../repositories/preOrderRepo";
import { notifEmitter } from "../utils/notificationEmitter";

// ── Shared PhonePe helpers (mirrors phonePeController.ts) ────────────────────
const UAT_BASE       = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const PROD_TOKEN_URL = "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";
const PROD_API_BASE  = "https://api.phonepe.com/apis/pg";

const isProd = () => config.phonePeEnv === "PRODUCTION";
const tokenEndpoint = () =>
  isProd() ? PROD_TOKEN_URL : `${UAT_BASE}/v1/oauth/token`;
const apiBase = () => (isProd() ? PROD_API_BASE : UAT_BASE);

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 30_000) return cachedToken;

  const resp = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:     "client_credentials",
      client_id:      config.phonePeClientId,
      client_secret:  config.phonePeClientSecret,
      client_version: String(config.phonePeClientVersion),
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`PhonePe token fetch failed: ${err}`);
  }

  const json = await resp.json() as {
    access_token: string;
    expires_in:   number | null;
    expires_at:   number;
  };
  cachedToken    = json.access_token;
  tokenExpiresAt = json.expires_at
    ? json.expires_at * 1000
    : now + (json.expires_in ?? 3600) * 1000;
  return cachedToken as string;
}

// ── PUBLIC: GET /api/requests/dish/available ────────────────────────────────
export async function getAvailableDishRequests(_req: Request, res: Response, next: NextFunction) {
  try {
    const availableDishes = [
      {
        _id: "64a000000000000000000001",
        dishName: "Afghani Chicken",
        description: "Creamy, mildly spiced chicken roasted in tandoor.",
        image: "https://images.unsplash.com/photo-1599487405270-b072482cb4cd?auto=format&fit=crop&w=500&q=60"
      },
      {
        _id: "64a000000000000000000002",
        dishName: "Mutton Rogan Josh",
        description: "Aromatic Kashmiri mutton curry.",
        image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=500&q=60"
      },
      {
        _id: "64a000000000000000000003",
        dishName: "Butter Naan Combo",
        description: "Soft butter naan served with rich gravy.",
        image: "https://images.unsplash.com/photo-1626779848529-57788da20067?auto=format&fit=crop&w=500&q=60"
      }
    ];
    res.json({ success: true, data: availableDishes });
  } catch (err) { next(err); }
}

// ── PUBLIC: POST /api/requests/dish ─────────────────────────────────────────
export async function submitDishRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { customerName, customerPhone, dishName, description } =
      req.body as {
        customerName?: string;
        customerPhone?: string;
        dishName?: string;
        description?: string;
      };

    if (!customerName?.trim())
      return res
        .status(400)
        .json({ success: false, message: "customerName is required" });
    if (!customerPhone?.trim())
      return res
        .status(400)
        .json({ success: false, message: "customerPhone is required" });
    if (!dishName?.trim())
      return res
        .status(400)
        .json({ success: false, message: "dishName is required" });

    const data = await DishRequestRepo.create({
      customerName:  customerName.trim(),
      customerPhone: customerPhone.trim(),
      dishName:      dishName.trim(),
      description:   description?.trim() ?? "",
    });

    notifEmitter.emit("admin", {
      type:         "dish_request",
      requestId:    data._id as string,
      customerName: customerName.trim(),
      dishName:     dishName.trim(),
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── ADMIN: GET /api/requests/dish ────────────────────────────────────────────
export async function getDishRequests(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { status, startDate, endDate } = req.query as Record<string, string>;
    const filters: Parameters<typeof DishRequestRepo.findAll>[0] = {};
    if (status) filters.status = status;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate)   filters.endDate   = new Date(endDate);

    const data = await DishRequestRepo.findAll(filters);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── ADMIN: PATCH /api/requests/dish/:id ─────────────────────────────────────
export async function updateDishRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = req.params.id as string;
    const { status, adminNote } = req.body as {
      status?: string;
      adminNote?: string;
    };

    const VALID_STATUSES = ["pending", "noted", "added", "rejected"];
    if (status && !VALID_STATUSES.includes(status))
      return next(createHttpError(400, `status must be one of: ${VALID_STATUSES.join(", ")}`));

    const data = await DishRequestRepo.update(id, { status, adminNote });
    if (!data) return next(createHttpError(404, "Dish request not found"));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── ADMIN: DELETE /api/requests/dish/:id ─────────────────────────────────────
export async function deleteDishRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = req.params.id as string;
    const data = await DishRequestRepo.remove(id);
    if (!data) return next(createHttpError(404, "Dish request not found"));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── PUBLIC: POST /api/requests/preorder ──────────────────────────────────────
export async function submitPreOrder(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      customerName,
      customerPhone,
      scheduledFor,
      items,
      guestCount,
      orderType,
      deliveryAddress,
      specialInstructions,
      estimatedTotal,
    } = req.body as {
      customerName?: string;
      customerPhone?: string;
      scheduledFor?: string;
      items?: {
        id?: string;
        name: string;
        variantSize?: string;
        pricePerQuantity?: number;
        quantity: number;
        price?: number;
      }[];
      guestCount?: number;
      orderType?: string;
      deliveryAddress?: string;
      specialInstructions?: string;
      estimatedTotal?: number;
    };

    if (!customerName?.trim())
      return res
        .status(400)
        .json({ success: false, message: "customerName is required" });
    if (!customerPhone?.trim())
      return res
        .status(400)
        .json({ success: false, message: "customerPhone is required" });
    if (!scheduledFor)
      return res
        .status(400)
        .json({ success: false, message: "scheduledFor is required" });
    if (!Array.isArray(items) || items.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "At least one item is required" });

    const scheduled = new Date(scheduledFor);
    if (isNaN(scheduled.getTime()))
      return res
        .status(400)
        .json({ success: false, message: "scheduledFor must be a valid date" });
    if (scheduled < new Date())
      return res
        .status(400)
        .json({ success: false, message: "scheduledFor must be in the future" });

    const data = await PreOrderRepo.create({
      customerName:        customerName.trim(),
      customerPhone:       customerPhone.trim(),
      scheduledFor:        scheduled,
      items,
      guestCount:          guestCount ?? 1,
      orderType:           orderType ?? "dine-in",
      deliveryAddress:     deliveryAddress ?? "",
      specialInstructions: specialInstructions ?? "",
      estimatedTotal:      estimatedTotal ?? 0,
    });

    notifEmitter.emit("admin", {
      type:         "pre_order",
      requestId:    data._id as string,
      customerName: customerName.trim(),
      scheduledFor: scheduled.toISOString(),
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── PUBLIC: GET /api/requests/preorder/by-phone/:phone ───────────────────────
export async function getCustomerPreOrders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const phone = req.params.phone as string;
    if (!phone?.trim())
      return next(createHttpError(400, "phone is required"));

    const data = await PreOrderRepo.findByPhone(phone.trim());
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── PUBLIC: POST /api/requests/preorder/:id/pay-deposit ──────────────────────
export async function initiateDepositPayment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = req.params.id as string;
    const body = req.body as { redirectUrl?: string; returnUrl?: string };
    const resolvedUrl = body.returnUrl || body.redirectUrl;

    if (!resolvedUrl?.trim())
      return next(createHttpError(400, "redirectUrl or returnUrl is required"));

    if (!config.phonePeClientId || !config.phonePeClientSecret)
      return next(createHttpError(503, "PhonePe is not configured on this server"));

    const preOrder = await PreOrderRepo.findById(id);
    if (!preOrder) return next(createHttpError(404, "Pre-order not found"));

    const estimatedTotal = (preOrder.estimatedTotal as number) ?? 0;
    if (estimatedTotal <= 0)
      return next(
        createHttpError(400, "Set an estimated total before paying a deposit")
      );

    const depositAmount   = Math.round(estimatedTotal / 2);
    const merchantOrderId = `DEP_${id}_${Date.now()}`;
    const amountPaise     = depositAmount * 100;

    const token = await getAccessToken();

    const resp = await fetch(`${apiBase()}/checkout/v2/pay`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `O-Bearer ${token}`,
      },
      body: JSON.stringify({
        merchantOrderId,
        amount:      amountPaise,
        expireAfter: 1200,
        paymentFlow: {
          type:         "PG_CHECKOUT",
          message:      `Advance deposit for pre-order`,
          merchantUrls: { redirectUrl: resolvedUrl },
        },
        metaInfo: { udf1: String(preOrder.customerPhone) },
      }),
    });

    const json = await resp.json() as Record<string, unknown>;

    if (!resp.ok) {
      console.error("PhonePe deposit initiate failed:", json);
      return next(
        createHttpError(502, (json.message as string) ?? "PhonePe initiation failed")
      );
    }

    // Persist the depositAmount so callback can record it
    await PreOrderRepo.update(id, { depositAmount });

    res.json({
      success: true,
      data: {
        redirectUrl:           json.redirectUrl,
        merchantTransactionId: merchantOrderId,
        depositAmount,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── ADMIN: GET /api/requests/preorder ────────────────────────────────────────
export async function getPreOrders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { status, date, startDate, endDate } = req.query as Record<
      string,
      string
    >;
    const filters: Parameters<typeof PreOrderRepo.findAll>[0] = {};
    if (status) filters.status = status;
    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      filters.startDate = d;
      filters.endDate   = nextDay;
    } else {
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate)   filters.endDate   = new Date(endDate);
    }

    const data = await PreOrderRepo.findAll(filters);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── ADMIN: PATCH /api/requests/preorder/:id ──────────────────────────────────
export async function updatePreOrder(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = req.params.id as string;
    const { status, adminNote, estimatedAmount } = req.body as {
      status?: string;
      adminNote?: string;
      estimatedAmount?: number;
    };

    const VALID_STATUSES = ["pending", "confirmed", "cancelled", "completed"];
    if (status && !VALID_STATUSES.includes(status))
      return next(
        createHttpError(400, `status must be one of: ${VALID_STATUSES.join(", ")}`)
      );

    const data = await PreOrderRepo.update(id, {
      status,
      adminNote,
      estimatedAmount,
    });
    if (!data) return next(createHttpError(404, "Pre-order not found"));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── ADMIN: DELETE /api/requests/preorder/:id ─────────────────────────────────
export async function deletePreOrder(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = req.params.id as string;
    const data = await PreOrderRepo.remove(id);
    if (!data) return next(createHttpError(404, "Pre-order not found"));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
