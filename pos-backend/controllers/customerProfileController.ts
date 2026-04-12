import { Request, Response, NextFunction } from "express";
import * as ProfileRepo from "../repositories/customerProfileRepo";
import { normalizePhone } from "../utils/normalizePhone";

// GET /api/customer/profile/:phone — PUBLIC
export async function getCustomerProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const phone = normalizePhone(String(req.params["phone"] ?? ""));
    if (phone.length < 10) {
      res.status(400).json({ success: false, message: "Invalid phone number" });
      return;
    }
    const data = await ProfileRepo.getProfile(phone);
    res.json({ success: true, data: data ?? null });
  } catch (err) {
    next(err);
  }
}

// POST /api/customer/profile — PUBLIC
export async function upsertCustomerProfile(req: Request, res: Response, next: NextFunction) {
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

    const data = await ProfileRepo.upsertProfile({
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
export async function updateCustomerProfile(req: Request, res: Response, next: NextFunction) {
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

    const data = await ProfileRepo.updateProfile(phone, {
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
