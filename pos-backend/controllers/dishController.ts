import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import * as dishRepo from "../repositories/dishRepo";
import { SEED_DISHES } from "../scripts/dishSeedData";
import { getDb } from "../db";

const addDish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { image, name, type, category, variants, description, isAvailable, isFrequent } = req.body;

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

    if (dishRepo.findByName(name)) {
      return next(createHttpError(409, "Dish with this name already exists!"));
    }

    const dish = dishRepo.create({ image, name, type, category, variants, description, isAvailable, isFrequent });
    res.status(201).json({ success: true, message: "Dish added successfully!", data: dish });
  } catch (error) {
    next(error);
  }
};

const getDishes = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, data: dishRepo.findAll() });
  } catch (error) {
    next(error);
  }
};

const getFrequentDishes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const minOrders = parseInt(req.query.minOrders as string) || 1;
    res.status(200).json({ success: true, data: dishRepo.findFrequent(minOrders, limit) });
  } catch (error) {
    next(error);
  }
};

const getDishById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || isNaN(Number(id))) {
      return next(createHttpError(400, "Invalid Dish ID format!"));
    }
    const dish = dishRepo.findById(id);
    if (!dish) return next(createHttpError(404, "Dish not found!"));
    res.status(200).json({ success: true, data: dish });
  } catch (error) {
    next(error);
  }
};

const updateDish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || isNaN(Number(id))) {
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

    const dish = dishRepo.update(id, updates);
    if (!dish) return next(createHttpError(404, "Dish not found!"));
    res.status(200).json({ success: true, message: "Dish updated successfully!", data: dish });
  } catch (error) {
    next(error);
  }
};

const deleteDish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || isNaN(Number(id))) {
      return next(createHttpError(400, "Invalid Dish ID format!"));
    }
    const dish = dishRepo.remove(id);
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
      const saved = dishRepo.bulkCreate(dishes);
      res.status(201).json({ success: true, message: `${saved.length} dishes added successfully!`, data: saved });
    } catch (err: unknown) {
      // SQLite UNIQUE constraint violation
      if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
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
    const db = getDb();

    const insert = db.prepare(`
      INSERT OR IGNORE INTO dishes (image, name, type, category, variants, description, is_available, is_frequent)
      VALUES (@image, @name, @type, @category, @variants, @description, @isAvailable, @isFrequent)
    `);

    let added = 0;
    let skipped = 0;

    const run = db.transaction(() => {
      for (const d of SEED_DISHES) {
        const result = insert.run({
          image: "",
          name: d.name,
          type: d.type,
          category: d.category,
          variants: JSON.stringify(d.variants),
          description: d.description ?? "",
          isAvailable: 1,
          isFrequent: 0,
        }) as { changes: number };
        result.changes > 0 ? added++ : skipped++;
      }
    });

    run();

    res.json({
      success: true,
      message: `Seeded ${added} dish(es). ${skipped} already existed.`,
      data: { added, skipped },
    });
  } catch (error) {
    next(error);
  }
};

export { addDish, getDishes, getFrequentDishes, getDishById, updateDish, deleteDish, bulkAddDishes, seedDishes };
