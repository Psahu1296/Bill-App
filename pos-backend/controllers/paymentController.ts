import createHttpError from "http-errors";
import { Request, Response, NextFunction } from "express";
import Razorpay from "razorpay";
import config from "../config/config";
import crypto from "crypto";
import Payment from "../models/paymentModel";

const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  const razorpay = new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: (config.razorpaySecretKey as string),
  });

  try {
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
        const error = createHttpError(400, "A valid positive amount is required!");
        return next(error);
    }
    const options = {
      amount: amount * 100, // Amount in paisa (1 INR = 100 paisa)
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

const verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        const error = createHttpError(400, "Missing required payment verification fields!");
        return next(error);
    }

    const expectedSignature = crypto
      .createHmac("sha256", (config.razorpaySecretKey as string))
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      res.json({ success: true, message: "Payment verified successfully!" });
    } else {
      const error = createHttpError(400, "Payment verification failed!");
      return next(error);
    }
  } catch (error) {
    next(error);
  }
};

const webHookVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = config.razorpyWebhookSecret;
    const signature = req.headers["x-razorpay-signature"];

    // req.body is a raw Buffer here (set by express.raw in paymentRoute)
    const rawBody = (req.body as Buffer).toString("utf8");

    const expectedSignature = crypto
      .createHmac("sha256", secret as string)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      const error = createHttpError(400, "Invalid Signature!");
      return next(error);
    }

    const payload = JSON.parse(rawBody);

    if (payload.event === "payment.captured") {
      const payment = payload.payload.payment.entity;

      const newPayment = new Payment({
        paymentId: payment.id,
        orderId: payment.order_id,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        createdAt: new Date(payment.created_at * 1000)
      });

      await newPayment.save();
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export { createOrder, verifyPayment, webHookVerification };
