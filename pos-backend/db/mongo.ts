import mongoose from "mongoose";
import { StoreSetting, Table } from "../models";

let connected = false;

export async function connectMongo(): Promise<void> {
  if (connected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is not set");

  await mongoose.connect(uri, { dbName: "dhaba-pos" });
  connected = true;
  console.log("✅ MongoDB connected");

  // ── Seed defaults ────────────────────────────────────────────────────────────
  await seedDefaults();
}

async function seedDefaults() {
  // Store settings defaults
  const settingDefaults: { key: string; value: string }[] = [
    { key: "online_orders",       value: "true"  },
    { key: "available_time_start", value: "09:00" },
    { key: "available_time_end",   value: "22:00" },
    { key: "delivery_enabled",     value: "true"  },
  ];
  for (const s of settingDefaults) {
    await StoreSetting.updateOne({ key: s.key }, { $setOnInsert: s }, { upsert: true });
  }

  // Virtual takeaway table (tableNo = 0)
  await Table.updateOne(
    { tableNo: 0 },
    { $setOnInsert: { tableNo: 0, seats: 0, status: "Available", isVirtual: true } },
    { upsert: true }
  );

  console.log("✅ MongoDB defaults seeded");
}

export default mongoose;
