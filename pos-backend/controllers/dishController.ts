import { Request, Response, NextFunction } from "express";
// controllers/dishController.js
import createHttpError from "http-errors";
import Dish from "../models/dishModel";
import mongoose from "mongoose";

// @desc    Add a new dish
// @route   POST /api/dishes
// @access  Private (e.g., Admin)
const addDish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // UPDATED: 'price' removed, 'variants' added to destructuring
    const { image, name, type, category, variants, description, isAvailable, isFrequent } = req.body;

    // UPDATED VALIDATION: Check for 'variants' array and its content
    if (!image || !name || !type || !category || !variants || !Array.isArray(variants) || variants.length === 0) {
      const error = createHttpError(400, "Missing required dish fields (image, name, type, category, variants) or variants is empty!");
      return next(error);
    }
    // Further validate each variant
    for (const variant of variants) {
      if (!variant.size || variant.price === undefined || variant.price === null || variant.price < 0) {
        const error = createHttpError(400, "Each dish variant must have a valid size and non-negative price.");
        return next(error);
      }
    }

    const existingDish = await Dish.findOne({ name });
    if (existingDish) {
      const error = createHttpError(409, "Dish with this name already exists!");
      return next(error);
    }

    const dish = new Dish({
      image,
      name,
      type,
      category,
      variants, // UPDATED: Pass variants to the constructor
      description,
      isAvailable,
      isFrequent
    });

    await dish.save();
    res
      .status(201)
      .json({ success: true, message: "Dish added successfully!", data: dish });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all dishes (No change needed here, as it fetches the new schema structure)
// @route   GET /api/dishes
// @access  Public
const getDishes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dishes = await Dish.find({});
    res.status(200).json({ success: true, data: dishes });
  } catch (error) {
    next(error);
  }
};

// @desc    Get only frequently ordered dishes (No change needed here, as it fetches the new schema structure)
// @route   GET /api/dishes/frequent
// @access  Public
const getFrequentDishes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const minOrders = parseInt(req.query.minOrders as string) || 1;

    const frequentDishes = await Dish.find({ numberOfOrders: { $gte: minOrders } })
                                     .sort({ numberOfOrders: -1, name: 1 })
                                     .limit(limit);

    res.status(200).json({ success: true, data: frequentDishes });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dish by ID (No change needed here)
// @route   GET /api/dishes/:id
// @access  Public
const getDishById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      const error = createHttpError(400, "Invalid Dish ID format!");
      return next(error);
    }

    const dish = await Dish.findById(id);
    if (!dish) {
      const error = createHttpError(404, "Dish not found!");
      return next(error);
    }

    res.status(200).json({ success: true, data: dish });
  } catch (error) {
    next(error);
  }
};


// @desc    Update an existing dish
// @route   PUT /api/dishes/:id
// @access  Private (e.g., Admin)
const updateDish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { _id, __v, ...updates } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      const error = createHttpError(400, "Invalid Dish ID format!");
      return next(error);
    }

    // UPDATED VALIDATION (optional, but good if variants can be updated):
    if (updates.variants !== undefined) {
      if (!Array.isArray(updates.variants) || updates.variants.length === 0) {
        const error = createHttpError(400, "Variants must be a non-empty array if provided for update.");
        return next(error);
      }
      for (const variant of updates.variants) {
        if (!variant.size || variant.price === undefined || variant.price === null || variant.price < 0) {
          const error = createHttpError(400, "Each updated dish variant must have a valid size and non-negative price.");
          return next(error);
        }
      }
    }

    const dish = await Dish.findByIdAndUpdate(
      id,
      { $set: updates }, // $set will update only the fields provided in 'updates', including 'variants'
      { new: true, runValidators: true } // runValidators is crucial here for variants array
    );

    if (!dish) {
      const error = createHttpError(404, "Dish not found!");
      return next(error);
    }

    res
      .status(200)
      .json({ success: true, message: "Dish updated successfully!", data: dish });
  }
  catch (error) {
    next(error);
  }
};

// @desc    Delete a dish (No change needed here)
// @route   DELETE /api/dishes/:id
// @access  Private (e.g., Admin)
const deleteDish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      const error = createHttpError(400, "Invalid Dish ID format!");
      return next(error);
    }

    const dish = await Dish.findByIdAndDelete(id);

    if (!dish) {
      const error = createHttpError(404, "Dish not found!");
      return next(error);
    }

    res.status(200).json({ success: true, message: "Dish deleted successfully!", data: dish });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk add dishes
// @route   POST /api/dishes/bulk
// @access  Private (e.g., Admin)
const bulkAddDishes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dishes = req.body;

    if (!Array.isArray(dishes) || dishes.length === 0) {
      const error = createHttpError(400, "Request body must be a non-empty array of dishes.");
      return next(error);
    }

    // Validate each dish in the array
    for (const [index, dishData] of dishes.entries()) {
      const { image, name, type, category, variants } = dishData;
      if (!image || !name || !type || !category || !variants || !Array.isArray(variants) || variants.length === 0) {
        const error = createHttpError(400, `Dish at index ${index} is missing required fields (image, name, type, category, variants).`);
        return next(error);
      }
      for (const variant of variants) {
        if (!variant.size || variant.price === undefined || variant.price === null || variant.price < 0) {
          const error = createHttpError(400, `Dish at index ${index} has an invalid variant.`);
          return next(error);
        }
      }
    }

    // Use insertMany to save all dishes. 
    // ordered: true means it will stop at the first error (e.g. duplicate name)
    const savedDishes = await Dish.insertMany(dishes);

    res.status(201).json({
      success: true,
      message: `${savedDishes.length} dishes added successfully!`,
      data: savedDishes,
    });
  } catch (error: any) {
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        const msg = `Duplicate value for field: ${field}. One of the dish names might already exist.`;
        return next(createHttpError(409, msg));
    }
    next(error);
  }
};

export {  addDish, getDishes, getFrequentDishes, getDishById, updateDish, deleteDish, bulkAddDishes  };