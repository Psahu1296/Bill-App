import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { verifyIdToken } from "../utils/firebaseAdmin";
import { normalizePhone } from "../utils/normalizePhone";

/**
 * POST /api/customer/auth/verify-token
 * Body: { idToken: string }
 *
 * Verifies a Firebase Phone Auth ID token issued by the customer app.
 * Returns the verified phone number so the frontend can proceed with
 * profile fetch / creation.
 */
export async function verifyFirebaseToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken || typeof idToken !== "string") {
      return next(createHttpError(400, "idToken is required"));
    }

    const decoded = await verifyIdToken(idToken);

    if (!decoded.phone_number) {
      return next(createHttpError(400, "Token does not contain a phone number"));
    }

    // Normalize to 10-digit local format (strip country code)
    const phone = normalizePhone(decoded.phone_number);
    if (phone.length !== 10) {
      return next(createHttpError(400, "Invalid phone number in token"));
    }

    return res.json({ success: true, data: { phone } });
  } catch (err: unknown) {
    // Firebase throws with code when token is invalid/expired
    const code = (err as { code?: string }).code ?? "";
    if (code.startsWith("auth/")) {
      return next(createHttpError(401, "Invalid or expired token"));
    }
    next(err);
  }
}
