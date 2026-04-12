import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import * as OnlineConfigRepo from "../repositories/onlineConfigRepo";

// ── Config Flags ──────────────────────────────────────────────────────────────

export async function getFlags(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await OnlineConfigRepo.getFlags();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateFlags(req: Request, res: Response, next: NextFunction) {
  try {
    const { isOnline, deliveryEnabled, availableTimeStart, availableTimeEnd } = req.body as {
      isOnline?: boolean;
      deliveryEnabled?: boolean;
      availableTimeStart?: string;
      availableTimeEnd?: string;
    };

    if (isOnline !== undefined && typeof isOnline !== "boolean") {
      res.status(400).json({ success: false, message: "isOnline must be a boolean" });
      return;
    }
    if (deliveryEnabled !== undefined && typeof deliveryEnabled !== "boolean") {
      res.status(400).json({ success: false, message: "deliveryEnabled must be a boolean" });
      return;
    }

    const timeRe = /^\d{2}:\d{2}$/;
    if (availableTimeStart !== undefined && !timeRe.test(availableTimeStart)) {
      res.status(400).json({ success: false, message: "availableTimeStart must be HH:MM" });
      return;
    }
    if (availableTimeEnd !== undefined && !timeRe.test(availableTimeEnd)) {
      res.status(400).json({ success: false, message: "availableTimeEnd must be HH:MM" });
      return;
    }

    const data = await OnlineConfigRepo.setFlags({ isOnline, deliveryEnabled, availableTimeStart, availableTimeEnd });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── Delivery Areas ────────────────────────────────────────────────────────────

export async function getDeliveryAreas(req: Request, res: Response, next: NextFunction) {
  try {
    const { all } = req.query;
    const data = all === "true"
      ? await OnlineConfigRepo.getAllAreas()
      : await OnlineConfigRepo.getActiveAreas();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function addDeliveryArea(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, deliveryFee, minOrderAmount } = req.body as {
      name?: string;
      deliveryFee?: number;
      minOrderAmount?: number;
    };
    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: "name is required" });
      return;
    }
    const data = await OnlineConfigRepo.addArea(name, deliveryFee ?? 0, minOrderAmount ?? 0);
    res.status(201).json({ success: true, data });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("duplicate key") || err.message.includes("UNIQUE"))) {
      res.status(409).json({ success: false, message: "Area already exists" });
      return;
    }
    next(err);
  }
}

export async function deleteDeliveryArea(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params["id"]);
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }
    const deleted = await OnlineConfigRepo.deleteArea(id);
    if (!deleted) {
      res.status(404).json({ success: false, message: "Area not found" });
      return;
    }
    res.json({ success: true, message: "Area deleted" });
  } catch (err) {
    next(err);
  }
}

export async function updateDeliveryArea(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params["id"]);
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }
    const { isActive, deliveryFee, minOrderAmount } = req.body as {
      isActive?: boolean;
      deliveryFee?: number;
      minOrderAmount?: number;
    };

    let data: Awaited<ReturnType<typeof OnlineConfigRepo.toggleArea>> = null;

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        res.status(400).json({ success: false, message: "isActive must be a boolean" });
        return;
      }
      data = await OnlineConfigRepo.toggleArea(id, isActive);
    }

    if (deliveryFee !== undefined || minOrderAmount !== undefined) {
      data = await OnlineConfigRepo.updateArea(id, { deliveryFee, minOrderAmount });
    }

    if (!data) {
      res.status(404).json({ success: false, message: "Area not found" });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
