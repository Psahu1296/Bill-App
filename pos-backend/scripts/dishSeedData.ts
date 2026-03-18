/**
 * Default dhaba menu seed data.
 * Shared between the CLI seed script and the POST /api/dishes/seed endpoint.
 * Images are intentionally empty — update them via the UI later.
 */

export interface SeedDish {
  name: string;
  type: "veg" | "non-veg";
  category: string;
  variants: { size: string; price: number }[];
  description?: string;
}

export const SEED_DISHES: SeedDish[] = [
  // ── Roti ────────────────────────────────────────────────────────────────────
  {
    name: "Roti",
    type: "veg",
    category: "roti",
    variants: [{ size: "Single", price: 10 }],
  },
  {
    name: "Butter Roti",
    type: "veg",
    category: "roti",
    variants: [{ size: "Single", price: 15 }],
  },
  {
    name: "Plain Paratha",
    type: "veg",
    category: "roti",
    variants: [{ size: "Half", price: 25 }, { size: "Full", price: 45 }],
  },
  {
    name: "Butter Paratha",
    type: "veg",
    category: "roti",
    variants: [{ size: "Half", price: 30 }, { size: "Full", price: 55 }],
  },
  {
    name: "Puri",
    type: "veg",
    category: "roti",
    variants: [{ size: "Half", price: 30 }, { size: "Full", price: 55 }],
  },
  {
    name: "Naan",
    type: "veg",
    category: "roti",
    variants: [{ size: "Single", price: 20 }],
  },
  {
    name: "Butter Naan",
    type: "veg",
    category: "roti",
    variants: [{ size: "Single", price: 25 }],
  },

  // ── Rice ────────────────────────────────────────────────────────────────────
  {
    name: "Plain Rice",
    type: "veg",
    category: "rice",
    variants: [{ size: "Half", price: 40 }, { size: "Full", price: 70 }],
  },
  {
    name: "Jeera Rice",
    type: "veg",
    category: "rice",
    variants: [{ size: "Half", price: 60 }, { size: "Full", price: 100 }],
  },
  {
    name: "Veg Fried Rice",
    type: "veg",
    category: "rice",
    variants: [{ size: "Half", price: 80 }, { size: "Full", price: 140 }],
  },
  {
    name: "Chicken Fried Rice",
    type: "non-veg",
    category: "rice",
    variants: [{ size: "Half", price: 100 }, { size: "Full", price: 180 }],
  },
  {
    name: "Veg Biryani",
    type: "veg",
    category: "rice",
    variants: [{ size: "Half", price: 100 }, { size: "Full", price: 180 }],
  },
  {
    name: "Chicken Biryani",
    type: "non-veg",
    category: "rice",
    variants: [{ size: "Half", price: 130 }, { size: "Full", price: 230 }],
  },
  {
    name: "Mutton Biryani",
    type: "non-veg",
    category: "rice",
    variants: [{ size: "Half", price: 160 }, { size: "Full", price: 280 }],
  },

  // ── Sabji ───────────────────────────────────────────────────────────────────
  {
    name: "Dal Fry",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 60 }, { size: "Full", price: 100 }],
  },
  {
    name: "Dal Tadka",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 70 }, { size: "Full", price: 120 }],
  },
  {
    name: "Dal Makhani",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 90 }, { size: "Full", price: 160 }],
  },
  {
    name: "Paneer Butter Masala",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 130 }, { size: "Full", price: 230 }],
  },
  {
    name: "Shahi Paneer",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 140 }, { size: "Full", price: 250 }],
  },
  {
    name: "Mix Veg",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 90 }, { size: "Full", price: 160 }],
  },
  {
    name: "Aloo Gobi",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 80 }, { size: "Full", price: 140 }],
  },
  {
    name: "Aloo Matar",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 80 }, { size: "Full", price: 140 }],
  },
  {
    name: "Chicken Curry",
    type: "non-veg",
    category: "sabji",
    variants: [{ size: "Half", price: 120 }, { size: "Full", price: 220 }],
  },
  {
    name: "Butter Chicken",
    type: "non-veg",
    category: "sabji",
    variants: [{ size: "Half", price: 140 }, { size: "Full", price: 250 }],
  },
  {
    name: "Egg Curry",
    type: "non-veg",
    category: "sabji",
    variants: [{ size: "Half", price: 80 }, { size: "Full", price: 140 }],
  },
  {
    name: "Mutton Curry",
    type: "non-veg",
    category: "sabji",
    variants: [{ size: "Half", price: 160 }, { size: "Full", price: 290 }],
  },

  // ── Drinks ──────────────────────────────────────────────────────────────────
  {
    name: "Chai",
    type: "veg",
    category: "drinks",
    variants: [{ size: "Regular", price: 10 }],
  },
  {
    name: "Lassi",
    type: "veg",
    category: "drinks",
    variants: [{ size: "Small", price: 30 }, { size: "Large", price: 60 }],
  },
  {
    name: "Sweet Lassi",
    type: "veg",
    category: "drinks",
    variants: [{ size: "Small", price: 35 }, { size: "Large", price: 70 }],
  },
  {
    name: "Nimbu Pani",
    type: "veg",
    category: "drinks",
    variants: [{ size: "Regular", price: 25 }],
  },
  {
    name: "Cold Drink",
    type: "veg",
    category: "drinks",
    variants: [{ size: "Regular", price: 30 }],
  },
  {
    name: "Water Bottle",
    type: "veg",
    category: "drinks",
    variants: [{ size: "Regular", price: 20 }],
  },
];
