// seedDishes.js
// require('dotenv').config(); // Load environment variables from .env
import mongoose from 'mongoose';
import Dish from '../models/dishModel'; // Adjust path if your models folder is elsewhere

const dishesData = [
  // --- Existing Dishes (UPDATED to use 'variants') ---
  {
    image: "https://as2.ftcdn.net/v2/jpg/10/81/27/49/1000_F_1081274972_deuLZtjPkhULFHChrUXS8bsYTqQSeLQj.webp",
    name: "Butter Chicken",
    numberOfOrders: 120, // Initial order count
    type: "main_course",
    category: "non_veg",
    // UPDATED: Use variants instead of price
    variants: [
      { size: "Half", price: 210.00 }, // ~60% of Full
      { size: "Full", price: 350.00 }
    ],
    description: "Classic Indian dish with tender chicken pieces cooked in a creamy tomato sauce.",
    isAvailable: true,
    isFrequent: true
  },
  {
    image: "https://as1.ftcdn.net/v2/jpg/08/94/61/84/1000_F_894618409_kmAgScHb1svnmUN1m8dedjc666CdJffk.webp",
    name: "Paneer Butter Masala",
    numberOfOrders: 95,
    type: "main_course",
    category: "veg",
    variants: [
      { size: "Half", price: 180.00 }, // ~60% of Full
      { size: "Full", price: 300.00 }
    ],
    description: "Cubes of paneer (Indian cheese) cooked in a rich, creamy, and spicy tomato gravy.",
    isAvailable: true,
    isFrequent: true
  },
  {
    image: "https://as2.ftcdn.net/v2/jpg/12/26/49/81/1000_F_1226498190_CsKxa7vDTUomJIYqrbGIpMjl7sqhCUBl.jpg",
    name: "Dal Makhani",
    numberOfOrders: 80,
    type: "main_course",
    category: "veg",
    variants: [
      { size: "Half", price: 170.00 }, // ~60% of Full
      { size: "Full", price: 280.00 }
    ],
    description: "A popular lentil dish made with black lentils and kidney beans, slow-cooked with butter and cream.",
    isAvailable: true,
    isFrequent: false
  },
  {
    image: "https://as2.ftcdn.net/v2/jpg/10/32/55/47/1000_F_1032554744_2K9oC2HoAlUMSyPKx8CIa9wXBJ67Ln3S.webp",
    name: "Chicken Biryani",
    numberOfOrders: 150,
    type: "main_course",
    category: "non_veg",
    variants: [
      { size: "Regular", price: 400.00 },
      { size: "Large", price: 550.00 }
    ],
    description: "A fragrant rice dish cooked with marinated chicken, aromatic spices, and herbs.",
    isAvailable: true,
    isFrequent: true
  },
  {
    image: "https://as1.ftcdn.net/v2/jpg/14/80/41/38/1000_F_1480413868_LdZUf7GQjB11lQbjP6Dmg7hqEDdJSADu.jpg",
    name: "Mix Vegetable Curry",
    numberOfOrders: 60,
    type: "main_course",
    category: "veg",
    variants: [
      { size: "Half", price: 160.00 },
      { size: "Full", price: 270.00 }
    ],
    description: "Assorted fresh vegetables cooked in a rich, flavorful Indian curry sauce.",
    isAvailable: true,
    isFrequent: false
  },
  {
    image: "https://as2.ftcdn.net/v2/jpg/06/94/78/93/1000_F_694789334_HMcV4xhfBvFB6k0Ua6gYAZkSjD1vzPji.webp",
    name: "Naan (Plain)",
    numberOfOrders: 200,
    type: "bread",
    category: "veg",
    variants: [{ size: "Regular", price: 40.00 }],
    description: "Soft, leavened Indian flatbread, traditionally cooked in a tandoor.",
    isAvailable: true,
    isFrequent: true
  },
  {
    image: "https://as1.ftcdn.net/v2/jpg/14/69/70/50/1000_F_1469705095_T7WwaGD6JG5h0IFX91QSEbruarkFPj0A.webp",
    name: "Gulab Jamun",
    numberOfOrders: 75,
    type: "dessert",
    category: "veg",
    variants: [{ size: "Regular", price: 90.00 }],
    description: "Deep-fried milk-solids balls soaked in rose-flavored sugar syrup.",
    isAvailable: true,
    isFrequent: false
  },

  // --- NEW DISHES (UPDATED to use 'variants') ---

  // Breads
  {
    image: "https://as1.ftcdn.net/v2/jpg/06/67/96/24/1000_F_667962451_XaHW1aZybVbBMdS8G4kvo4hYo2rulh9H.jpg",
    name: "Tawa Roti",
    numberOfOrders: 0,
    type: "bread",
    category: "veg",
    variants: [{ size: "Regular", price: 20.00 }],
    description: "Whole wheat unleavened Indian flatbread, cooked on a griddle.",
    isAvailable: true,
    isFrequent: false
  },
  {
    image: "https://as2.ftcdn.net/v2/jpg/08/99/37/95/1000_F_899379516_d2jMcGeZAlvUzf8vitvRKAuFyx1xx6UR.jpg",
    name: "Tandoori Roti",
    numberOfOrders: 0,
    type: "bread",
    category: "veg",
    variants: [{ size: "Regular", price: 25.00 }],
    description: "Whole wheat flatbread cooked in a tandoor (clay oven).",
    isAvailable: true,
    isFrequent: false
  },
  {
    image: "https://as1.ftcdn.net/v2/jpg/09/45/46/72/1000_F_945467264_13rCx2nGR9wb9wrVt2g2FEFB4tE4b8sW.jpg",
    name: "Aaloo Paratha",
    numberOfOrders: 0,
    type: "bread",
    category: "veg",
    variants: [{ size: "Regular", price: 50.00 }],
    description: "Multi-layered flaky whole wheat bread, stuffed with spiced potato.",
    isAvailable: true,
    isFrequent: false
  },

  // Rice
  {
    image: "https://as2.ftcdn.net/v2/jpg/11/43/87/99/1000_F_1143879950_OGGtViNR7DfSLWyudZZecoCCd3yQlh5Z.jpg",
    name: "Plain Rice",
    numberOfOrders: 0,
    type: "main_course",
    category: "veg",
    variants: [{ size: "Regular", price: 100.00 }],
    description: "Steamed plain Basmati rice.",
    isAvailable: true,
    isFrequent: false
  },
  {
    image: "https://as1.ftcdn.net/v2/jpg/14/95/93/16/1000_F_1495931614_6VM4hCK6pA3rZ4SV8muA4HzKLtKlfEp9.jpg",
    name: "Jeera Rice",
    numberOfOrders: 0,
    type: "main_course",
    category: "veg",
    variants: [{ size: "Regular", price: 120.00 }],
    description: "Aromatic Basmati rice flavored with cumin seeds.",
    isAvailable: true,
    isFrequent: false
  },
  {
    image: "https://as2.ftcdn.net/v2/jpg/14/64/33/55/1000_F_1464335580_Kx8PtDCyZBLgDQxmDSWyHoo2436X3C1i.webp",
    name: "Veg Pulao",
    numberOfOrders: 0,
    type: "main_course",
    category: "veg",
    variants: [{ size: "Regular", price: 180.00 }],
    description: "Fragrant Basmati rice cooked with mixed vegetables and mild spices.",
    isAvailable: true,
    isFrequent: false
  },

  // Daal (Lentils)
  {
    image: "https://as2.ftcdn.net/v2/jpg/09/52/34/99/1000_F_952349974_NUCgjUFpBn8GrDPs7WUtGhsvFRh3sTJO.jpg",
    name: "Dal Fry",
    numberOfOrders: 0,
    type: "main_course",
    category: "veg",
    variants: [
      { size: "Half", price: 130.00 },
      { size: "Full", price: 220.00 }
    ],
    description: "Classic Indian lentil dish, tempered with spices.",
    isAvailable: true,
    isFrequent: false
  },
  {
    image: "https://as2.ftcdn.net/v2/jpg/14/71/32/69/1000_F_1471326972_bjfORhmwmYZxJ5CYIZRruj6bTwEJKwcG.jpg",
    name: "Dal Tadka",
    numberOfOrders: 0,
    type: "main_course",
    category: "veg",
    variants: [
      { size: "Half", price: 140.00 },
      { size: "Full", price: 230.00 }
    ],
    description: "Yellow lentils cooked with aromatic spices and a smoky tempering.",
    isAvailable: true,
    isFrequent: false
  },
  {
    image: "https://as2.ftcdn.net/v2/jpg/07/64/50/89/1000_F_764508941_vUSeL3bJthIdCZ1I5qqppCbi2G1sojv4.jpg",
    name: "Chana Masala",
    numberOfOrders: 0,
    type: "main_course",
    category: "veg",
    variants: [
      { size: "Half", price: 150.00 },
      { size: "Full", price: 250.00 }
    ],
    description: "Spicy and tangy chickpea curry, a popular North Indian dish.",
    isAvailable: true,
    isFrequent: false
  },
  // Egg Dishes
  {
    image: "https://as1.ftcdn.net/v2/jpg/15/19/03/92/1000_F_1519039240_mNEMCcCzz0gK7DNt9oAU7cKDvHyJEQwg.jpg",
    name: "Egg Curry",
    numberOfOrders: 0,
    type: "main_course",
    category: "egg",
    variants: [
      { size: "Half", price: 170.00 },
      { size: "Full", price: 280.00 }
    ],
    description: "Boiled eggs cooked in a rich, spicy, and aromatic onion-tomato gravy.",
    isAvailable: true,
    isFrequent: false
  },
  {
    image: "https://as2.ftcdn.net/v2/jpg/06/83/65/33/1000_F_683653385_wasXuQ4qzXbh2nUp4JZQthmikRtFSTCB.jpg",
    name: "Egg Bhurji",
    numberOfOrders: 0,
    type: "starter",
    category: "egg",
    variants: [{ size: "Regular", price: 180.00 }],
    description: "Scrambled eggs cooked with chopped onions, tomatoes, green chilies, and spices.",
    isAvailable: true,
    isFrequent: false
  },
  {
    image: "https://as2.ftcdn.net/v2/jpg/11/69/12/47/1000_F_1169124718_DykGQDwjAPuKOUWNyOWPVFSQKSdgJ4bm.webp",
    name: "Boiled Egg (2 Pcs)",
    numberOfOrders: 0,
    type: "starter",
    category: "egg",
    variants: [{ size: "Regular", price: 60.00 }],
    description: "Two simple boiled eggs, served with a sprinkle of salt and pepper.",
    isAvailable: true,
    isFrequent: false
  }
];

// Connect to MongoDB
mongoose
  .connect("mongodb://127.0.0.1:27017/posdb", {})
  .then(() => console.log('MongoDB connected for seeding!'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Function to import data
const importData = async () => {
  try {
    // IMPORTANT: Use with caution! This deletes all existing dishes.
    // If you want to add without deleting, comment out the line below.
    await Dish.deleteMany({});
    console.log('Existing dishes cleared!');

    await Dish.insertMany(dishesData);
    console.log('Data Imported Successfully!');
    process.exit();
  } catch (error) {
    console.error('Error with data import:', error);
    process.exit(1);
  }
};

// Function to destroy data (optional, for cleanup)
const destroyData = async () => {
  try {
    await Dish.deleteMany({});
    console.log('Data Destroyed!');
    process.exit();
  } catch (error) {
    console.error('Error with data destroy:', error);
    process.exit(1);
  }
};

// Check command line arguments to decide action
if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}