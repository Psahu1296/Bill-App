import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import createHttpError from "http-errors";
import * as dishRepo from "../repositories/dishRepo";
import { SEED_DISHES } from "../scripts/dishSeedData";
import { Dish, Order } from "../models";
import { getZonedStartOfDayUtc, getZonedEndOfDayUtc } from "./earningController";

const addDish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { image, name, type, category, variants, description, isAvailable, isFrequent, isOnlineAvailable } = req.body;

    if (!name || !type || !category || !variants || !Array.isArray(variants) || variants.length === 0) {
      return next(createHttpError(400, "Missing required dish fields (name, type, category, variants) or variants is empty!"));
    }
    for (const v of variants) {
      if (!v.size || v.price === undefined || v.price === null || v.price < 0) {
        return next(createHttpError(400, "Each dish variant must have a valid size and non-negative price."));
      }
      if (v.markedPrice !== undefined && v.markedPrice !== null) {
        if (typeof v.markedPrice !== "number" || v.markedPrice <= v.price) {
          return next(createHttpError(400, "Variant markedPrice must be a number greater than price."));
        }
      }
    }

    if (await dishRepo.findByName(name)) {
      return next(createHttpError(409, "Dish with this name already exists!"));
    }

    const dish = await dishRepo.create({ image, name, type, category, variants, description, isAvailable, isFrequent, isOnlineAvailable });
    res.status(201).json({ success: true, message: "Dish added successfully!", data: dish });
  } catch (error) {
    next(error);
  }
};

const getDishes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, category, minPrice, maxPrice, search } = req.query;
    const filters: dishRepo.DishFilters = {};
    if (type)     filters.type     = type     as string;
    if (category) filters.category = category as string;
    if (search)   filters.search   = search   as string;
    if (minPrice) filters.minPrice = Number(minPrice);
    if (maxPrice) filters.maxPrice = Number(maxPrice);
    res.status(200).json({ success: true, data: await dishRepo.findAll(filters) });
  } catch (error) {
    next(error);
  }
};

const getOnlineDishes = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, data: await dishRepo.findOnlineAvailable() });
  } catch (error) {
    next(error);
  }
};

const getFrequentDishes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const minOrders = parseInt(req.query.minOrders as string) || 1;
    res.status(200).json({ success: true, data: await dishRepo.findFrequent(minOrders, limit) });
  } catch (error) {
    next(error);
  }
};

const getDishById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.isValidObjectId(id)) {
      return next(createHttpError(400, "Invalid Dish ID format!"));
    }
    const dish = await dishRepo.findById(id);
    if (!dish) return next(createHttpError(404, "Dish not found!"));
    res.status(200).json({ success: true, data: dish });
  } catch (error) {
    next(error);
  }
};

const updateDish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.isValidObjectId(id)) {
      return next(createHttpError(400, "Invalid Dish ID format!"));
    }

    const { _id, __v, ...updates } = req.body;

    if (updates.variants !== undefined) {
      if (!Array.isArray(updates.variants) || updates.variants.length === 0) {
        return next(createHttpError(400, "Variants must be a non-empty array if provided for update."));
      }
      for (const v of updates.variants) {
        if (!v.size || v.price === undefined || v.price === null || v.price < 0) {
          return next(createHttpError(400, "Each updated dish variant must have a valid size and non-negative price."));
        }
        if (v.markedPrice !== undefined && v.markedPrice !== null) {
          if (typeof v.markedPrice !== "number" || v.markedPrice <= v.price) {
            return next(createHttpError(400, "Variant markedPrice must be a number greater than price."));
          }
        }
      }
    }

    const dish = await dishRepo.update(id, updates);
    if (!dish) return next(createHttpError(404, "Dish not found!"));
    res.status(200).json({ success: true, message: "Dish updated successfully!", data: dish });
  } catch (error) {
    next(error);
  }
};

const deleteDish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.isValidObjectId(id)) {
      return next(createHttpError(400, "Invalid Dish ID format!"));
    }
    const dish = await dishRepo.remove(id);
    if (!dish) return next(createHttpError(404, "Dish not found!"));
    res.status(200).json({ success: true, message: "Dish deleted successfully!", data: dish });
  } catch (error) {
    next(error);
  }
};

const bulkAddDishes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dishes = req.body;
    if (!Array.isArray(dishes) || dishes.length === 0) {
      return next(createHttpError(400, "Request body must be a non-empty array of dishes."));
    }

    for (const [index, d] of dishes.entries()) {
      if (!d.name || !d.type || !d.category || !Array.isArray(d.variants) || d.variants.length === 0) {
        return next(createHttpError(400, `Dish at index ${index} is missing required fields.`));
      }
      for (const v of d.variants) {
        if (!v.size || v.price === undefined || v.price === null || v.price < 0) {
          return next(createHttpError(400, `Dish at index ${index} has an invalid variant.`));
        }
        if (v.markedPrice !== undefined && v.markedPrice !== null) {
          if (typeof v.markedPrice !== "number" || v.markedPrice <= v.price) {
            return next(createHttpError(400, `Dish at index ${index}: variant markedPrice must be a number greater than price.`));
          }
        }
      }
    }

    try {
      const saved = await dishRepo.bulkCreate(dishes);
      res.status(201).json({ success: true, message: `${saved.length} dishes added successfully!`, data: saved });
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes("duplicate key") || err.message.includes("UNIQUE"))) {
        return next(createHttpError(409, "Duplicate value: one of the dish names might already exist."));
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

const seedDishes = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    let added = 0;
    let skipped = 0;

    for (const d of SEED_DISHES) {
      const exists = await Dish.findOne({ name: d.name }).select("_id").lean();
      if (exists) { skipped++; continue; }
      await Dish.create({
        image: "",
        name: d.name,
        type: d.type,
        category: d.category,
        variants: d.variants,
        description: d.description ?? "",
        isAvailable: true,
        isFrequent: false,
      });
      added++;
    }

    res.json({
      success: true,
      message: `Seeded ${added} dish(es). ${skipped} already existed.`,
      data: { added, skipped },
    });
  } catch (error) {
    next(error);
  }
};

const getTopRevenueDishes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const from = req.query.from as string | undefined;
    const to   = req.query.to   as string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchStage: Record<string, any> = { orderStatus: { $ne: "Cancelled" } };
    if (from || to) {
      matchStage.orderDate = {};
      if (from) matchStage.orderDate.$gte = getZonedStartOfDayUtc(new Date(from));
      if (to)   matchStage.orderDate.$lte = getZonedEndOfDayUtc(new Date(to));
    }

    const results = await Order.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          totalRevenue:  { $sum: { $multiply: ["$items.quantity", "$items.pricePerQuantity"] } },
          totalQuantity: { $sum: "$items.quantity" },
          orderCount:    { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit },
      { $project: { _id: 0, name: "$_id", totalRevenue: 1, totalQuantity: 1, orderCount: 1 } },
    ]);

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
};

export { addDish, getDishes, getOnlineDishes, getFrequentDishes, getDishById, updateDish, deleteDish, bulkAddDishes, seedDishes, getTopRevenueDishes };
