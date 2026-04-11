import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { verifyIdToken } from "../utils/firebaseAdmin";
import { normalizePhone } from "../utils/normalizePhone";

/**
 * POST /api/customer/auth/verify-token
 * Body: { idToken: string }
 *
 * Verifies a Firebase ID token (Phone Auth or Google Sign-In).
 * - Phone token  → returns { phone }
 * - Google token → returns { email, name }
 */
export async function verifyFirebaseToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken || typeof idToken !== "string") {
      return next(createHttpError(400, "idToken is required"));
    }

    const decoded = await verifyIdToken(idToken);

    if (decoded.phone_number) {
      const phone = normalizePhone(decoded.phone_number);
      if (phone.length !== 10) {
        return next(createHttpError(400, "Invalid phone number in token"));
      }
      return res.json({ success: true, data: { phone } });
    }

    if (decoded.email) {
      return res.json({ success: true, data: { email: decoded.email, name: decoded.name ?? "" } });
    }

    return next(createHttpError(400, "Token contains no identifiable credential"));
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";
    if (code.startsWith("auth/")) {
      return next(createHttpError(401, "Invalid or expired token"));
    }
    next(err);
  }
}
