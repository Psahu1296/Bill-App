import { Request, Response, NextFunction } from "express";
import * as SettingsRepo from "../repositories/settingsRepo";
import { Dish } from "../models";

// GET /api/settings/online-orders — PUBLIC (customer app polls this)
export async function getOnlineOrdersStatus(_req: Request, res: Response, next: NextFunction) {
  try {
    const isOnline = await SettingsRepo.isOnlineOrdersEnabled();
    res.json({ success: true, data: { isOnline } });
  } catch (err) {
    next(err);
  }
}

// GET /api/settings/dish-catalog — Returns saved dish catalog snapshot
export async function getDishCatalog(_req: Request, res: Response, next: NextFunction) {
  try {
    const raw = await SettingsRepo.getSetting("dish_catalog");
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
export async function saveDishCatalog(_req: Request, res: Response, next: NextFunction) {
  try {
    const docs = await Dish.find().select("name image type category variants description isAvailable isFrequent").lean();

    const dishes = docs.map((r) => ({
      name: r.name,
      image: r.image,
      type: r.type,
      category: r.category,
      variants: r.variants,
      description: r.description,
      isAvailable: r.isAvailable,
      isFrequent: r.isFrequent,
    }));

    await SettingsRepo.setSetting("dish_catalog", JSON.stringify({ dishes, savedAt: new Date().toISOString() }));
    res.json({ success: true, message: `${dishes.length} dishes saved as default catalog.`, data: { count: dishes.length } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/settings/dish-catalog — Add/remove individual dishes from the saved catalog
export async function patchDishCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const { add, remove } = req.body as {
      add?: { name: string; image: string; type: string; category: string; variants: { size: string; price: number }[]; description: string; isAvailable: boolean; isFrequent: boolean }[];
      remove?: string[];
    };

    const raw = await SettingsRepo.getSetting("dish_catalog");
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
    await SettingsRepo.setSetting("dish_catalog", JSON.stringify({ dishes: existing, savedAt }));
    res.json({ success: true, message: `Catalog updated. ${existing!.length} dishes total.`, data: { count: existing!.length } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/settings/online-orders — Auth required (Admin only via middleware)
export async function setOnlineOrdersStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { isOnline } = req.body;
    if (typeof isOnline !== "boolean") {
      res.status(400).json({ success: false, message: "isOnline must be a boolean" });
      return;
    }
    await SettingsRepo.setSetting("online_orders", String(isOnline));
    res.json({ success: true, data: { isOnline } });
  } catch (err) {
    next(err);
  }
}
