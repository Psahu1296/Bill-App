/**
 * Seed the dishes table with a typical dhaba menu.
 *
 * Usage (from pos-backend/):
 *   npx tsx scripts/seedDishes.ts
 *
 * - Skips dishes that already exist (by name).
 * - Images are left empty ("") — edit them later via the UI.
 * - DATABASE_PATH is read from .env or defaults to ./dhaba-pos.db
 */

import "./patch-node25";
import path from "path";
import fs from "fs";

// Load .env if present
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const [k, ...rest] = line.split("=");
    if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
  }
}

import { connectMongo } from "../db/mongo";
import { Dish } from "../models";
import { SEED_DISHES } from "./dishSeedData";

async function seed() {
  await connectMongo();

  let added = 0;
  let skipped = 0;

  for (const d of SEED_DISHES) {
    const existing = await Dish.findOne({ name: d.name });
    if (existing) {
      skipped++;
    } else {
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
  }

  console.log(`✅  Seed complete — ${added} added, ${skipped} already existed.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
