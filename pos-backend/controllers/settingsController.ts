import { Request, Response, NextFunction } from "express";
import * as SettingsRepo from "../repositories/settingsRepo";

// GET /api/settings/online-orders — PUBLIC (customer app polls this)
export function getOnlineOrdersStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const isOnline = SettingsRepo.isOnlineOrdersEnabled();
    res.json({ success: true, data: { isOnline } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/settings/online-orders — Auth required (Admin only via middleware)
export function setOnlineOrdersStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { isOnline } = req.body;
    if (typeof isOnline !== "boolean") {
      res.status(400).json({ success: false, message: "isOnline must be a boolean" });
      return;
    }
    SettingsRepo.setSetting("online_orders", String(isOnline));
    res.json({ success: true, data: { isOnline } });
  } catch (err) {
    next(err);
  }
}
