/**
 * Default dhaba menu seed data.
 * Shared between the CLI seed script and the POST /api/dishes/seed endpoint.
 * Images have been added from free web sources mapped by dish category and type.
 */

export interface SeedDish {
  name: string;
  type: "veg" | "non-veg";
  category: string;
  variants: { size: string; price: number }[];
  description?: string;
  image?: string;
}

export const SEED_DISHES: SeedDish[] = [
  // ── Roti ────────────────────────────────────────────────────────────────────
  {
    name: "Roti",
    type: "veg",
    category: "roti",
    variants: [{ size: "Single", price: 10 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Roti-Indian_Breads.jpg/600px-Roti-Indian_Breads.jpg",
  },
  {
    name: "Butter Roti",
    type: "veg",
    category: "roti",
    variants: [{ size: "Single", price: 15 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Roti-Indian_Breads.jpg/600px-Roti-Indian_Breads.jpg",
  },
  {
    name: "Plain Paratha",
    type: "veg",
    category: "roti",
    variants: [{ size: "Half", price: 25 }, { size: "Full", price: 45 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Aloo_Paratha_also_known_as_Batatay_Jo_Phulko.jpg/600px-Aloo_Paratha_also_known_as_Batatay_Jo_Phulko.jpg",
  },
  {
    name: "Butter Paratha",
    type: "veg",
    category: "roti",
    variants: [{ size: "Half", price: 30 }, { size: "Full", price: 55 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Aloo_Paratha_also_known_as_Batatay_Jo_Phulko.jpg/600px-Aloo_Paratha_also_known_as_Batatay_Jo_Phulko.jpg",
  },
  {
    name: "Puri",
    type: "veg",
    category: "roti",
    variants: [{ size: "Half", price: 30 }, { size: "Full", price: 55 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Puri-an_indian_food.jpg/600px-Puri-an_indian_food.jpg",
  },
  {
    name: "Naan",
    type: "veg",
    category: "roti",
    variants: [{ size: "Single", price: 20 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Naan_baked_in_Tandoor.png/600px-Naan_baked_in_Tandoor.png",
  },
  {
    name: "Butter Naan",
    type: "veg",
    category: "roti",
    variants: [{ size: "Single", price: 25 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Naan_baked_in_Tandoor.png/600px-Naan_baked_in_Tandoor.png",
  },

  // ── Rice ────────────────────────────────────────────────────────────────────
  {
    name: "Plain Rice",
    type: "veg",
    category: "rice",
    variants: [{ size: "Half", price: 40 }, { size: "Full", price: 70 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Rice_2011.jpg/600px-Rice_2011.jpg",
  },
  {
    name: "Jeera Rice",
    type: "veg",
    category: "rice",
    variants: [{ size: "Half", price: 60 }, { size: "Full", price: 100 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Jeera_Rice.jpg/600px-Jeera_Rice.jpg",
  },
  {
    name: "Veg Fried Rice",
    type: "veg",
    category: "rice",
    variants: [{ size: "Half", price: 80 }, { size: "Full", price: 140 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Fried_Rice_.jpg/600px-Fried_Rice_.jpg",
  },
  {
    name: "Chicken Fried Rice",
    type: "non-veg",
    category: "rice",
    variants: [{ size: "Half", price: 100 }, { size: "Full", price: 180 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Fried_Rice_.jpg/600px-Fried_Rice_.jpg",
  },
  {
    name: "Veg Biryani",
    type: "veg",
    category: "rice",
    variants: [{ size: "Half", price: 100 }, { size: "Full", price: 180 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Chicken_biryani%2C_Hyderabad.jpg/600px-Chicken_biryani%2C_Hyderabad.jpg",
  },
  {
    name: "Chicken Biryani",
    type: "non-veg",
    category: "rice",
    variants: [{ size: "Half", price: 130 }, { size: "Full", price: 230 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Chicken_biryani%2C_Hyderabad.jpg/600px-Chicken_biryani%2C_Hyderabad.jpg",
  },
  {
    name: "Mutton Biryani",
    type: "non-veg",
    category: "rice",
    variants: [{ size: "Half", price: 160 }, { size: "Full", price: 280 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Mutton_Biryani.jpg/600px-Mutton_Biryani.jpg",
  },

  // ── Sabji ───────────────────────────────────────────────────────────────────
  {
    name: "Dal Fry",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 60 }, { size: "Full", price: 100 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Tarka_dal_with_rice.jpg/600px-Tarka_dal_with_rice.jpg",
  },
  {
    name: "Dal Tadka",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 70 }, { size: "Full", price: 120 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Tarka_dal_with_rice.jpg/600px-Tarka_dal_with_rice.jpg",
  },
  {
    name: "Dal Makhani",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 90 }, { size: "Full", price: 160 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Dal_Makhni%2C_an_Indian_delicacy.jpg/600px-Dal_Makhni%2C_an_Indian_delicacy.jpg",
  },
  {
    name: "Paneer Butter Masala",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 130 }, { size: "Full", price: 230 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Paneer_Butter_Masala.jpg/600px-Paneer_Butter_Masala.jpg",
  },
  {
    name: "Shahi Paneer",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 140 }, { size: "Full", price: 250 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Paneer_Butter_Masala.jpg/600px-Paneer_Butter_Masala.jpg",
  },
  {
    name: "Mix Veg",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 90 }, { size: "Full", price: 160 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Mix_veggies-_Healthy_Food.jpg/600px-Mix_veggies-_Healthy_Food.jpg",
  },
  {
    name: "Aloo Gobi",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 80 }, { size: "Full", price: 140 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Aloo_gobi.png/600px-Aloo_gobi.png",
  },
  {
    name: "Aloo Matar",
    type: "veg",
    category: "sabji",
    variants: [{ size: "Half", price: 80 }, { size: "Full", price: 140 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Aloo_gobi.png/600px-Aloo_gobi.png",
  },
  {
    name: "Chicken Curry",
    type: "non-veg",
    category: "sabji",
    variants: [{ size: "Half", price: 120 }, { size: "Full", price: 220 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Chicken_makhani_with_rice.jpg/600px-Chicken_makhani_with_rice.jpg",
  },
  {
    name: "Butter Chicken",
    type: "non-veg",
    category: "sabji",
    variants: [{ size: "Half", price: 140 }, { size: "Full", price: 250 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Chicken_makhani_with_rice.jpg/600px-Chicken_makhani_with_rice.jpg",
  },
  {
    name: "Egg Curry",
    type: "non-veg",
    category: "sabji",
    variants: [{ size: "Half", price: 80 }, { size: "Full", price: 140 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Egg_Curry.jpg/600px-Egg_Curry.jpg",
  },
  {
    name: "Mutton Curry",
    type: "non-veg",
    category: "sabji",
    variants: [{ size: "Half", price: 160 }, { size: "Full", price: 290 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Mutton_curry_with_rice.jpg/600px-Mutton_curry_with_rice.jpg",
  },

  // ── Drinks ──────────────────────────────────────────────────────────────────
  {
    name: "Chai",
    type: "veg",
    category: "drinks",
    variants: [{ size: "Regular", price: 10 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Masala_Chai.JPG/600px-Masala_Chai.JPG",
  },
  {
    name: "Lassi",
    type: "veg",
    category: "drinks",
    variants: [{ size: "Small", price: 30 }, { size: "Large", price: 60 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Lassi_in_clay_cup.jpg/600px-Lassi_in_clay_cup.jpg",
  },
  {
    name: "Sweet Lassi",
    type: "veg",
    category: "drinks",
    variants: [{ size: "Small", price: 35 }, { size: "Large", price: 70 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Lassi_in_clay_cup.jpg/600px-Lassi_in_clay_cup.jpg",
  },
  {
    name: "Nimbu Pani",
    type: "veg",
    category: "drinks",
    variants: [{ size: "Regular", price: 25 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Lemonade_in_pitcher.jpg/600px-Lemonade_in_pitcher.jpg",
  },
  {
    name: "Cold Drink",
    type: "veg",
    category: "drinks",
    variants: [{ size: "Regular", price: 30 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Lemonade_in_pitcher.jpg/600px-Lemonade_in_pitcher.jpg",
  },
  {
    name: "Water Bottle",
    type: "veg",
    category: "drinks",
    variants: [{ size: "Regular", price: 20 }],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Water_Bottle_-_Clear.jpg/600px-Water_Bottle_-_Clear.jpg",
  },
];
