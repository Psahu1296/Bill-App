// controllers/dishController.js
const createHttpError = require("http-errors");
const Dish = require("../models/dishModel");
const { default: mongoose } = require("mongoose");

// @desc    Add a new dish
// @route   POST /api/dishes
// @access  Private (e.g., Admin)
const addDish = async (req, res, next) => {
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
const getDishes = async (req, res, next) => {
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
const getFrequentDishes = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const minOrders = parseInt(req.query.minOrders) || 1;

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
const getDishById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
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
const updateDish = async (req, res, next) => {
  try {
    const { id } = req.params;
    // UPDATED: Ensure 'variants' is part of updates and is valid if present
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
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
const deleteDish = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
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

module.exports = { addDish, getDishes, getFrequentDishes, getDishById, updateDish, deleteDish };