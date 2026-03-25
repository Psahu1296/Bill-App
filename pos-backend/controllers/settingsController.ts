import { Request, Response, NextFunction } from "express";
import * as SettingsRepo from "../repositories/settingsRepo";
import { getDb } from "../db";

// GET /api/settings/online-orders — PUBLIC (customer app polls this)
export function getOnlineOrdersStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const isOnline = SettingsRepo.isOnlineOrdersEnabled();
    res.json({ success: true, data: { isOnline } });
  } catch (err) {
    next(err);
  }
}

// GET /api/settings/dish-catalog — Returns saved dish catalog snapshot
export function getDishCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = SettingsRepo.getSetting("dish_catalog");
    if (!raw) {
      res.json({ success: true, data: null });
      return;
    }
    const { dishes, savedAt } = JSON.parse(raw) as { dishes: unknown[]; savedAt: string };
    res.json({ success: true, data: { dishes, savedAt } });
  } catch (err) {
    next(err);
  }
}

// POST /api/settings/dish-catalog — Snapshots current DB dishes into store_settings
export function saveDishCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = getDb()
      .prepare("SELECT name, image, type, category, variants, description, is_available, is_frequent FROM dishes")
      .all() as Record<string, unknown>[];

    const dishes = rows.map((r) => ({
      name: r["name"],
      image: r["image"],
      type: r["type"],
      category: r["category"],
      variants: typeof r["variants"] === "string" ? JSON.parse(r["variants"] as string) : r["variants"],
      description: r["description"],
      isAvailable: r["is_available"] !== 0,
      isFrequent: r["is_frequent"] !== 0,
    }));

    SettingsRepo.setSetting("dish_catalog", JSON.stringify({ dishes, savedAt: new Date().toISOString() }));
    res.json({ success: true, message: `${dishes.length} dishes saved as default catalog.`, data: { count: dishes.length } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/settings/dish-catalog — Add/remove individual dishes from the saved catalog
export function patchDishCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const { add, remove } = req.body as {
      add?: { name: string; image: string; type: string; category: string; variants: { size: string; price: number }[]; description: string; isAvailable: boolean; isFrequent: boolean }[];
      remove?: string[]; // dish names to remove
    };

    const raw = SettingsRepo.getSetting("dish_catalog");
    let existing: typeof add = raw ? JSON.parse(raw).dishes : [];

    if (Array.isArray(remove) && remove.length > 0) {
      const removeSet = new Set(remove.map((n) => n.trim().toLowerCase()));
      existing = existing!.filter((d) => !removeSet.has(d.name.trim().toLowerCase()));
    }

    if (Array.isArray(add) && add.length > 0) {
      const existingNames = new Set(existing!.map((d) => d.name.trim().toLowerCase()));
      for (const dish of add) {
        if (!existingNames.has(dish.name.trim().toLowerCase())) {
          existing!.push(dish);
          existingNames.add(dish.name.trim().toLowerCase());
        }
      }
    }

    const savedAt = raw ? JSON.parse(raw).savedAt : new Date().toISOString();
    SettingsRepo.setSetting("dish_catalog", JSON.stringify({ dishes: existing, savedAt }));
    res.json({ success: true, message: `Catalog updated. ${existing!.length} dishes total.`, data: { count: existing!.length } });
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
