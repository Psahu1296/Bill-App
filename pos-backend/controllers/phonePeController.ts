/**
 * PhonePe Payment Gateway integration.
 * Docs: https://developer.phonepe.com/v1/reference/pay-api
 *
 * All amounts are in paise (₹1 = 100 paise).
 */
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import createHttpError from "http-errors";
import config from "../config/config";
import * as OrderRepo from "../repositories/orderRepo";
import * as PaymentRepo from "../repositories/paymentRepo";

const BASE_UAT  = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const BASE_PROD = "https://api.phonepe.com/apis/hermes";

function base() {
  return config.phonePeEnv === "PRODUCTION" ? BASE_PROD : BASE_UAT;
}

function sha256Hex(data: string) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function xVerify(b64Payload: string, endpoint: string) {
  return `${sha256Hex(b64Payload + endpoint + config.phonePeSaltKey)}###${config.phonePeSaltIndex}`;
}

// ── POST /api/payment/phonepe/initiate ───────────────────────────────────────
export async function initiatePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { amount, orderId, customerPhone, redirectUrl } = req.body;

    if (!amount || !orderId || !redirectUrl) {
      return next(createHttpError(400, "amount, orderId, and redirectUrl are required"));
    }
    if (!config.phonePeMerchantId || !config.phonePeSaltKey) {
      return next(createHttpError(503, "PhonePe is not configured on this server"));
    }

    const merchantTransactionId = `TXN_${orderId}_${Date.now()}`;
    const amountPaise = Math.round(Number(amount) * 100);

    const payload = {
      merchantId: config.phonePeMerchantId,
      merchantTransactionId,
      merchantUserId: `USER_${customerPhone ?? "guest"}`,
      amount: amountPaise,
      redirectUrl,
      redirectMode: "REDIRECT",
      callbackUrl: `${process.env.SERVER_URL ?? ""}/api/payment/phonepe/callback`,
      mobileNumber: customerPhone ?? undefined,
      paymentInstrument: { type: "PAY_PAGE" },
    };

    const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
    const endpoint = "/pg/v1/pay";

    const resp = await fetch(`${base()}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerify(b64, endpoint),
      },
      body: JSON.stringify({ request: b64 }),
    });

    const json = await resp.json() as Record<string, unknown>;

    if (!json.success) {
      console.error("PhonePe initiate failed:", json);
      return next(createHttpError(502, (json.message as string) ?? "PhonePe payment initiation failed"));
    }

    const instrumentResponse = (json.data as Record<string, unknown>)?.instrumentResponse as Record<string, unknown> | undefined;
    const redirectInfo = instrumentResponse?.redirectInfo as Record<string, unknown> | undefined;

    res.json({
      success: true,
      data: {
        redirectUrl: redirectInfo?.url,
        merchantTransactionId,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/payment/phonepe/callback ───────────────────────────────────────
// PhonePe sends a server-to-server POST with base64-encoded response body.
// Raw body is required for signature verification (registered before json middleware).
export async function handleCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const xVerifyHeader = req.headers["x-verify"] as string | undefined;
    const rawBody = req.body as Buffer;

    if (!xVerifyHeader || !rawBody) {
      return res.status(400).json({ success: false });
    }

    // Verify signature: SHA256(base64Body + saltKey) + "###" + saltIndex
    const b64Body = rawBody.toString();
    const [receivedHash] = xVerifyHeader.split("###");
    const expectedHash = sha256Hex(b64Body + config.phonePeSaltKey);

    if (receivedHash !== expectedHash) {
      console.warn("PhonePe callback: signature mismatch");
      return res.status(401).json({ success: false });
    }

    const decoded = JSON.parse(Buffer.from(b64Body, "base64").toString()) as Record<string, unknown>;
    const txnData = decoded.data as Record<string, unknown> | undefined;

    if (!txnData) {
      return res.status(200).json({ success: true }); // acknowledge but nothing to do
    }

    const state      = txnData.paymentState as string;    // COMPLETED | FAILED | PENDING
    const txnId      = txnData.transactionId as string;
    const merchantTxn = txnData.merchantTransactionId as string; // "TXN_{orderId}_{ts}"

    // Extract internal orderId from merchantTransactionId: "TXN_{orderId}_{ts}"
    const parts   = merchantTxn?.split("_") ?? [];
    const orderId = parts[1];

    if (orderId && state === "COMPLETED") {
      const order = OrderRepo.findById(orderId, false);
      if (order) {
        const bills = order.bills as { totalWithTax?: number };
        const total = bills?.totalWithTax ?? 0;
        OrderRepo.update(orderId, {
          paymentStatus: "Paid",
          paymentMethod: "Online",
          amountPaid: total,
          balanceDueOnOrder: 0,
          paymentData: decoded,
        });
        // Record in payments table
        PaymentRepo.create({
          paymentId: txnId,
          orderId,
          amount: total,
          currency: "INR",
          status: "COMPLETED",
          method: "UPI",
          contact: (order.customerDetails as { phone?: string })?.phone ?? "",
        });
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
    if (!config.phonePeMerchantId || !config.phonePeSaltKey) {
      return next(createHttpError(503, "PhonePe is not configured on this server"));
    }

    const endpoint = `/pg/v1/status/${config.phonePeMerchantId}/${txnId}`;
    const hash = sha256Hex(endpoint + config.phonePeSaltKey);
    const verify = `${hash}###${config.phonePeSaltIndex}`;

    const resp = await fetch(`${base()}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": verify,
        "X-MERCHANT-ID": config.phonePeMerchantId,
      },
    });

    const json = await resp.json() as Record<string, unknown>;
    const txnData = json.data as Record<string, unknown> | undefined;

    res.json({
      success: true,
      data: {
        state:   txnData?.paymentState ?? "PENDING",
        code:    json.code,
        message: json.message,
      },
    });
  } catch (err) {
    next(err);
  }
}
