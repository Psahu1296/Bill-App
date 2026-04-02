import { Request, Response, NextFunction } from "express";
import * as ProfileRepo from "../repositories/customerProfileRepo";
import { normalizePhone } from "../utils/normalizePhone";

// GET /api/customer/profile/:phone — PUBLIC
// Returns saved profile or { data: null } — never 404
export function getCustomerProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const phone = normalizePhone(String(req.params["phone"] ?? ""));
    if (phone.length < 10) {
      res.status(400).json({ success: false, message: "Invalid phone number" });
      return;
    }
    const data = ProfileRepo.getProfile(phone);
    res.json({ success: true, data: data ?? null });
  } catch (err) {
    next(err);
  }
}

// POST /api/customer/profile — PUBLIC
// Upserts profile; increments total_orders counter
export function upsertCustomerProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone, name, preferredArea } = req.body as {
      phone?: string;
      name?: string;
      preferredArea?: string;
    };

    if (!phone || normalizePhone(phone).length < 10) {
      res.status(400).json({ success: false, message: "A valid 10-digit phone number is required" });
      return;
    }
    if (!name?.trim()) {
      res.status(400).json({ success: false, message: "name is required" });
      return;
    }

    const data = ProfileRepo.upsertProfile({
      phone,
      name,
      preferred_area: preferredArea,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/customer/profile/:phone — PUBLIC
// Updates only the fields provided (name and/or preferredArea)
export function updateCustomerProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const phone = normalizePhone(String(req.params["phone"] ?? ""));
    if (phone.length < 10) {
      res.status(400).json({ success: false, message: "Invalid phone number" });
      return;
    }

    const { name, preferredArea } = req.body as {
      name?: string;
      preferredArea?: string;
    };

    const data = ProfileRepo.updateProfile(phone, {
      name,
      preferred_area: preferredArea,
    });

    if (!data) {
      res.status(404).json({ success: false, message: "Profile not found" });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
