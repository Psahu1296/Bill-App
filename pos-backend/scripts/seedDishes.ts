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

if (!process.env["DATABASE_PATH"]) {
  process.env["DATABASE_PATH"] = path.join(process.cwd(), "dhaba-pos.db");
}

import { getDb } from "../db";
import { SEED_DISHES } from "./dishSeedData";

function seed() {
  const db = getDb();

  const insert = db.prepare(`
    INSERT OR IGNORE INTO dishes (image, name, type, category, variants, description, is_available, is_frequent)
    VALUES (@image, @name, @type, @category, @variants, @description, @isAvailable, @isFrequent)
  `);

  const run = db.transaction(() => {
    let added = 0;
    let skipped = 0;
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
    return { added, skipped };
  });

  const { added, skipped } = run();
  console.log(`✅  Seed complete — ${added} added, ${skipped} already existed.`);
}

seed();
