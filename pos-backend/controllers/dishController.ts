import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import fs from "fs";
import createHttpError from "http-errors";
import Fuse from "fuse.js";
import * as dishRepo from "../repositories/dishRepo";
import { SEED_DISHES } from "../scripts/dishSeedData";
import { Dish, Order } from "../models";
import { getZonedStartOfDayUtc, getZonedEndOfDayUtc } from "./earningController";

const SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text";

// ── Voice parse helpers ────────────────────────────────────────────────────────

const WORD_TO_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const KNOWN_VARIANT_SIZES = new Set([
  "full", "half", "regular", "small", "large", "medium", "quarter",
]);

// Maps common Sarvam translate-mode English outputs → actual menu names
// Needed when mode:"translate" converts Indian dish names to English equivalents.
const PHRASE_ALIASES: Record<string, string> = {
  "tea":       "chai",
  "teas":      "chai",
  "milk tea":  "chai",
  "omelet":    "aamlate",
  "omelette":  "aamlate",
  "bread":     "roti",
  "lentil":    "dal fry",
  "lentils":   "dal fry",
  "rice water":"chawal dal",
};

interface VoiceToken {
  phrase: string;
  quantity: number;
  variantHint: string | null;
}

function parseTranscript(transcript: string): VoiceToken[] {
  const chunks = transcript
    .toLowerCase()
    .replace(/[.!?]+/g, "")          // strip sentence-ending punctuation
    .split(/,|\band\b/)
    .map((c) => c.trim())
    .filter(Boolean);

  return chunks.map((chunk) => {
    const words = chunk.split(/\s+/);
    let quantity = 1;
    let start = 0;

    // leading digit or word-number
    if (/^\d+$/.test(words[0])) {
      quantity = parseInt(words[0], 10);
      start = 1;
    } else if (WORD_TO_NUM[words[0]]) {
      quantity = WORD_TO_NUM[words[0]];
      start = 1;
    }

    const remaining = words.slice(start);

    // variant hint: check leading first ("half chicken"), then trailing ("chicken half")
    let variantHint: string | null = null;
    if (remaining.length > 1 && KNOWN_VARIANT_SIZES.has(remaining[0])) {
      variantHint = remaining.shift()!;
    } else if (remaining.length > 1 && KNOWN_VARIANT_SIZES.has(remaining[remaining.length - 1])) {
      variantHint = remaining.pop()!;
    }

    return { phrase: remaining.join(" "), quantity, variantHint };
  }).filter((t) => t.phrase.length > 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveVariant(dish: any, hint: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vs: any[] = dish.variants;
  if (hint) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match = vs.find((v: any) => v.size.toLowerCase() === hint.toLowerCase());
    if (match) return match;
  }
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vs.find((v: any) => v.size === "Full") ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vs.find((v: any) => v.size === "Regular") ??
    vs[0]
  );
}

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

const voiceParseDishes = async (req: Request, res: Response, next: NextFunction) => {
  let audioPath: string | null = null;
  try {
    let transcript: string;

    if (req.file) {
      audioPath = req.file.path + ".webm";
      fs.renameSync(req.file.path, audioPath);

      // Transcribe with Sarvam saaras:v3 — translate mode converts any Indic/Hindi speech to English
      const buffer = fs.readFileSync(audioPath);
      const audioBlob = new Blob([buffer], { type: "audio/webm" });
      const form = new FormData();
      form.append("file", audioBlob, "voice.webm");
      form.append("model", "saaras:v3");
      form.append("mode", "translate");  // Hindi/mix in → English out

      const sarvamRes = await fetch(SARVAM_STT_URL, {
        method: "POST",
        headers: { "api-subscription-key": process.env.SARVAM_API_KEY ?? "" },
        body: form,
      });

      if (!sarvamRes.ok) {
        const errText = await sarvamRes.text();
        throw new Error(`Sarvam STT error ${sarvamRes.status}: ${errText}`);
      }

      const sarvamData = await sarvamRes.json() as { transcript: string };
      transcript = sarvamData.transcript;
    } else {
      // Fallback: raw transcript text sent directly (useful for testing)
      transcript = req.body?.transcript ?? "";
    }

    if (!transcript.trim()) {
      return next(createHttpError(400, "No speech detected or transcript is empty"));
    }

    const dishes = await Dish.find({ isAvailable: true }).lean();

    const fuse = new Fuse(dishes, {
      keys: ["name"],
      threshold: 0.5,
      includeScore: true,
      ignoreLocation: true,
    });

    const tokens = parseTranscript(transcript);
    const resolved: { dish: object; variant: object; quantity: number }[] = [];
    const ambiguous: { query: string; quantity: number; candidates: object[] }[] = [];
    const unmatched: string[] = [];

    const CONFIDENT_SCORE = 0.35;
    const CANDIDATE_MAX   = 0.5;
    const GAP_MIN         = 0.15;

    for (const token of tokens) {
      // 1. Alias lookup (e.g. "tea" → "chai" when Sarvam translates Indian dish names)
      const aliased  = PHRASE_ALIASES[token.phrase] ?? token.phrase;
      // 2. Singular fallback: "teas" → "tea" → then alias again if needed
      const singular = aliased.endsWith("s") ? aliased.slice(0, -1) : aliased;

      let results = fuse.search(aliased);
      if (results.length === 0 && singular !== aliased) {
        results = fuse.search(singular);
      }
      const candidates = results.filter((r) => (r.score ?? 1) < CANDIDATE_MAX);

      if (candidates.length === 0) {
        unmatched.push(token.phrase);
        continue;
      }

      const top = candidates[0];
      const topScore = top.score ?? 1;
      const secondScore = candidates[1]?.score ?? 1;
      const isConfident = topScore < CONFIDENT_SCORE && secondScore - topScore >= GAP_MIN;

      if (isConfident) {
        resolved.push({
          dish: top.item,
          variant: resolveVariant(top.item, token.variantHint),
          quantity: token.quantity,
        });
      } else {
        ambiguous.push({
          query: token.phrase,
          quantity: token.quantity,
          candidates: candidates.slice(0, 4).map((r) => r.item),
        });
      }
    }

    if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    res.status(200).json({ success: true, data: { resolved, ambiguous, unmatched } });
  } catch (error) {
    if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    next(error);
  }
};

export { addDish, getDishes, getOnlineDishes, getFrequentDishes, getDishById, updateDish, deleteDish, bulkAddDishes, seedDishes, getTopRevenueDishes, voiceParseDishes };
