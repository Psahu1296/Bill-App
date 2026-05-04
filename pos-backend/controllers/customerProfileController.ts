import { Request, Response, NextFunction } from "express";
import * as ProfileRepo from "../repositories/customerProfileRepo";
import { CustomerLedger } from "../models";
import { normalizePhone } from "../utils/normalizePhone";

// GET /api/profiles/search?name=... — PROTECTED POS
// Also accepts ?phone=<10-digit> for exact-match phone lookup (returns at most 1 result).
// Returns a merged list of customer_profiles + customer_ledger so that
// ledger-only customers (older records without a profile) are never lost.
export async function searchCustomerProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    const name  = String(req.query["name"]  ?? "").trim();
    const phone = String(req.query["phone"] ?? "").trim();

    // Exact phone lookup — used for the "is this number already registered?" check
    if (phone) {
      type LedgerHit = { customerPhone: string; customerName: string; balanceDue?: number } | null;
      const [profileDoc, ledgerDoc] = await Promise.all([
        ProfileRepo.getProfile(phone),
        CustomerLedger.findOne(
          { customerPhone: phone },
          { customerPhone: 1, customerName: 1, balanceDue: 1 }
        ).lean() as unknown as LedgerHit,
      ]);

      if (profileDoc) {
        return res.json({ success: true, data: [{ ...profileDoc, balanceDue: ledgerDoc?.balanceDue ?? 0, isLedgerOnly: false }] });
      }
      if (ledgerDoc) {
        return res.json({ success: true, data: [{
          phone: ledgerDoc.customerPhone,
          name: ledgerDoc.customerName,
          preferredArea: "", totalOrders: 0, lastOrderedAt: null,
          balanceDue: ledgerDoc.balanceDue ?? 0, isLedgerOnly: true,
          createdAt: null, updatedAt: null,
        }] });
      }
      return res.json({ success: true, data: [] });
    }

    const nameFilter = name ? { $regex: name, $options: "i" } : undefined;

    const [profiles, ledgerDocs] = await Promise.all([
      ProfileRepo.searchProfiles(name),
      CustomerLedger.find(
        nameFilter ? { customerName: nameFilter } : {},
        { customerPhone: 1, customerName: 1, balanceDue: 1, lastActivity: 1 }
      )
        .sort({ lastActivity: -1 })
        .limit(100)
        .lean() as unknown as { customerPhone: string; customerName: string; balanceDue?: number; lastActivity?: Date }[],
    ]);

    // Merge: phone is the dedup key.
    // Profiles are source of truth; ledger fills in balance and adds ledger-only entries.
    const merged = new Map<string, Record<string, unknown>>();

    for (const p of profiles) {
      merged.set(p.phone, { ...p, balanceDue: 0, isLedgerOnly: false });
    }

    for (const l of ledgerDocs) {
      const lPhone = l.customerPhone;
      if (merged.has(lPhone)) {
        (merged.get(lPhone) as Record<string, unknown>).balanceDue = l.balanceDue ?? 0;
      } else {
        merged.set(lPhone, {
          phone: lPhone,
          name: l.customerName,
          preferredArea: "",
          totalOrders: 0,
          lastOrderedAt: l.lastActivity ?? null,
          balanceDue: l.balanceDue ?? 0,
          isLedgerOnly: true,
          createdAt: null,
          updatedAt: null,
        });
      }
    }

    const data = Array.from(merged.values()).sort((a, b) => {
      const balanceDiff = ((b.balanceDue as number) ?? 0) - ((a.balanceDue as number) ?? 0);
      if (balanceDiff !== 0) return balanceDiff;
      return ((a.name as string) ?? "").localeCompare((b.name as string) ?? "");
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

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
