import createHttpError from "http-errors";
import { Request, Response, NextFunction } from "express";
import Razorpay from "razorpay";
import config from "../config/config";
import crypto from "crypto";
import * as paymentRepo from "../repositories/paymentRepo";

const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  const razorpay = new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpaySecretKey as string,
  });

  try {
    const { amount } = req.body;
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return next(createHttpError(400, "A valid positive amount is required!"));
    }
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });
    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

const verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return next(createHttpError(400, "Missing required payment verification fields!"));
    }

    const expectedSignature = crypto
      .createHmac("sha256", config.razorpaySecretKey as string)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      res.json({ success: true, message: "Payment verified successfully!" });
    } else {
      return next(createHttpError(400, "Payment verification failed!"));
    }
  } catch (error) {
    next(error);
  }
};

const webHookVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = config.razorpyWebhookSecret;
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = (req.body as Buffer).toString("utf8");

    const expectedSignature = crypto
      .createHmac("sha256", secret as string)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      return next(createHttpError(400, "Invalid Signature!"));
    }

    const payload = JSON.parse(rawBody);

    if (payload.event === "payment.captured") {
      const payment = payload.payload.payment.entity;
      paymentRepo.create({
        paymentId: payment.id,
        orderId: payment.order_id,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        createdAt: new Date(payment.created_at * 1000),
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export { createOrder, verifyPayment, webHookVerification };
