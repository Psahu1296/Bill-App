/**
 * PhonePe Payment Gateway integration — SDK v2 (OAuth / O-Bearer token).
 * Docs: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout
 *
 * All amounts are in paise (₹1 = 100 paise).
 */
import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import config from "../config/config";
import * as OrderRepo from "../repositories/orderRepo";
import * as PaymentRepo from "../repositories/paymentRepo";
import * as earningRepo from "../repositories/earningRepo";
import * as PreOrderRepo from "../repositories/preOrderRepo";
import { getZonedStartOfDayUtc } from "./earningController";

// Sandbox shares one base URL; production uses separate hosts for token vs API
const UAT_BASE       = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const PROD_TOKEN_URL = "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";
const PROD_API_BASE  = "https://api.phonepe.com/apis/pg";

const isProd = () => config.phonePeEnv === "PRODUCTION";
const tokenEndpoint = () => isProd() ? PROD_TOKEN_URL : `${UAT_BASE}/v1/oauth/token`;
const apiBase       = () => isProd() ? PROD_API_BASE  : UAT_BASE;

// ── OAuth token cache ────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0; // Unix ms

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
  return cachedToken;
}

// ── POST /api/payment/phonepe/initiate ───────────────────────────────────────
export async function initiatePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { amount, orderId, customerPhone, redirectUrl } = req.body;

    if (!amount || !orderId || !redirectUrl) {
      return next(createHttpError(400, "amount, orderId, and redirectUrl are required"));
    }
    if (!config.phonePeClientId || !config.phonePeClientSecret) {
      return next(createHttpError(503, "PhonePe is not configured on this server"));
    }

    const merchantOrderId = `TXN_${orderId}_${Date.now()}`;
    const amountPaise     = Math.round(Number(amount) * 100);
    const token           = await getAccessToken();

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
          message:      `Payment for order #${orderId}`,
          merchantUrls: { redirectUrl },
        },
        ...(customerPhone ? { metaInfo: { udf1: String(customerPhone) } } : {}),
      }),
    });

    const json = await resp.json() as Record<string, unknown>;

    if (!resp.ok) {
      console.error("PhonePe initiate failed:", json);
      return next(createHttpError(502, (json.message as string) ?? "PhonePe payment initiation failed"));
    }

    res.json({
      success: true,
      data: {
        redirectUrl:           json.redirectUrl,
        merchantTransactionId: merchantOrderId,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/payment/phonepe/callback ───────────────────────────────────────
export async function handleCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers["authorization"] as string | undefined;
    if (!authHeader?.startsWith("O-Bearer ")) {
      return res.status(401).json({ success: false });
    }

    const callbackToken = authHeader.slice("O-Bearer ".length);
    const verifyResp = await fetch(`${apiBase()}/v1/oauth/token/verify`, {
      headers: { "Authorization": `O-Bearer ${callbackToken}` },
    });
    if (!verifyResp.ok) {
      console.warn("PhonePe callback: token verification failed");
      return res.status(401).json({ success: false });
    }

    const body    = req.body as Record<string, unknown>;
    const payload = (body.payload ?? body) as Record<string, unknown>;
    const merchantOrderId = payload.merchantOrderId as string | undefined;
    const state           = payload.state           as string | undefined;
    const txnId           = payload.orderId         as string | undefined;

    // Determine prefix: "TXN" = regular order, "DEP" = pre-order deposit
    const parts    = merchantOrderId?.split("_") ?? [];
    const prefix   = parts[0];       // "TXN" | "DEP"
    const internalId = parts[1];     // orderId or preOrderId

    if (internalId && state === "COMPLETED") {
      if (prefix === "TXN") {
        // ── Existing order payment logic ──────────────────────────────────────
        const orderId = internalId;
        const order = await OrderRepo.findById(orderId, false);
        if (order) {
          const total = ((order.bills as Record<string, unknown>)?.totalWithTax as number) ?? 0;

          // Sequential (idempotent): order update then payment record
          await OrderRepo.update(orderId, {
            paymentStatus:     "Paid",
            paymentMethod:     "Online",
            amountPaid:        total,
            balanceDueOnOrder: 0,
            paymentData:       body,
          });

          await PaymentRepo.create({
            paymentId: txnId ?? merchantOrderId ?? "",
            orderId,
            amount:    total,
            currency:  "INR",
            status:    "COMPLETED",
            method:    "UPI",
            contact:   ((order.customerDetails as Record<string, unknown>)?.phone as string) ?? "",
          });

          // Record earnings for this online payment
          try {
            const orderDate = new Date((order as Record<string, unknown>).orderDate as Date | string);
            await earningRepo.incrementEarnings(getZonedStartOfDayUtc(orderDate).toISOString(), total);
          } catch (e) {
            console.error("Error updating daily earnings on PhonePe callback:", e);
          }
        }
      } else if (prefix === "DEP") {
        // ── Pre-order deposit payment ─────────────────────────────────────────
        const preOrderId = internalId;
        await PreOrderRepo.update(preOrderId, {
          depositPaid:          true,
          depositTransactionId: txnId ?? merchantOrderId ?? "",
          depositPaidAt:        new Date(),
        });
        console.log(`[PhonePe] Deposit marked as paid for pre-order ${preOrderId}`);
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/payment/phonepe/status/:txnId ───────────────────────────────────
export async function checkPaymentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { txnId } = req.params;
    if (!config.phonePeClientId || !config.phonePeClientSecret) {
      return next(createHttpError(503, "PhonePe is not configured on this server"));
    }

    const token = await getAccessToken();

    const resp = await fetch(`${apiBase()}/checkout/v2/order/${txnId}/status`, {
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `O-Bearer ${token}`,
      },
    });

    const json = await resp.json() as Record<string, unknown>;

    const state = resp.ok
      ? (json.state ?? "PENDING")
      : "FAILED";

    res.json({
      success: true,
      data: {
        state,
        code:    json.code,
        message: json.message,
      },
    });
  } catch (err) {
    next(err);
  }
}
