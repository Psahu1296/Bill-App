import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import crypto from "crypto";
import { normalizePhone } from "../utils/normalizePhone";
import * as OtpRepo from "../repositories/customerOtpRepo";
import { sendOtpSms } from "../utils/smsService";
import config from "../config/config";

// ── POST /api/customer/otp/send  { phone } ───────────────────────────────────
export async function sendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const phone = normalizePhone(String(req.body.phone ?? ""));
    if (phone.length !== 10) {
      return next(createHttpError(400, "Invalid phone number"));
    }

    OtpRepo.cleanup();

    const otp = String(crypto.randomInt(100000, 999999)); // 6-digit random
    OtpRepo.createOtp(phone, otp, config.otpExpirySeconds);

    await sendOtpSms(phone, otp);

    res.json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/customer/otp/verify  { phone, otp } ───────────────────────────
export function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const phone = normalizePhone(String(req.body.phone ?? ""));
    const otp   = String(req.body.otp ?? "").trim();

    if (phone.length !== 10) {
      return next(createHttpError(400, "Invalid phone number"));
    }
    if (!/^\d{6}$/.test(otp)) {
      return next(createHttpError(400, "OTP must be 6 digits"));
    }

    const result = OtpRepo.verifyOtp(phone, otp);

    if (result === "verified")     return res.json({ success: true, data: { verified: true } });
    if (result === "expired")      return next(createHttpError(410, "OTP expired. Please request a new one."));
    if (result === "max_attempts") return next(createHttpError(429, "Too many incorrect attempts. Please request a new OTP."));
    return next(createHttpError(400, "Invalid OTP"));
  } catch (err) {
    next(err);
  }
}
