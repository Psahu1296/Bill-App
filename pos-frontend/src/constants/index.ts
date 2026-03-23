// Dummy image placeholders (user will add real items via the UI)
const placeholderImg = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=300&auto=format&fit=crop";

import type { MetricItem, PopularDishItem, StaticMenuItem, MenuCategory, StaticOrder, StaticTable } from '../types';

export const popularDishes: PopularDishItem[] = [
  { id: 1, image: placeholderImg, name: 'Butter Chicken', numberOfOrders: 250 },
  { id: 2, image: placeholderImg, name: 'Palak Paneer', numberOfOrders: 190 },
  { id: 3, image: placeholderImg, name: 'Hyderabadi Biryani', numberOfOrders: 300 },
  { id: 4, image: placeholderImg, name: 'Masala Dosa', numberOfOrders: 220 },
  { id: 5, image: placeholderImg, name: 'Chole Bhature', numberOfOrders: 270 },
  { id: 6, image: placeholderImg, name: 'Rajma Chawal', numberOfOrders: 180 },
  { id: 7, image: placeholderImg, name: 'Paneer Tikka', numberOfOrders: 210 },
  { id: 8, image: placeholderImg, name: 'Gulab Jamun', numberOfOrders: 310 },
  { id: 9, image: placeholderImg, name: 'Poori Sabji', numberOfOrders: 140 },
  { id: 10, image: placeholderImg, name: 'Rogan Josh', numberOfOrders: 160 },
];

export const tables: StaticTable[] = [
  { id: 1, name: "Table 1", status: "Booked", initial: "AM", seats: 4 },
  { id: 2, name: "Table 2", status: "Available", initial: "MB", seats: 6 },
  { id: 3, name: "Table 3", status: "Booked", initial: "JS", seats: 2 },
  { id: 4, name: "Table 4", status: "Available", initial: "HR", seats: 4 },
  { id: 5, name: "Table 5", status: "Booked", initial: "PL", seats: 3 },
  { id: 6, name: "Table 6", status: "Available", initial: "RT", seats: 4 },
  { id: 7, name: "Table 7", status: "Booked", initial: "LC", seats: 5 },
  { id: 8, name: "Table 8", status: "Available", initial: "DP", seats: 5 },
  { id: 9, name: "Table 9", status: "Booked", initial: "NK", seats: 6 },
  { id: 10, name: "Table 10", status: "Available", initial: "SB", seats: 6 },
  { id: 11, name: "Table 11", status: "Booked", initial: "GT", seats: 4 },
  { id: 12, name: "Table 12", status: "Available", initial: "JS", seats: 6 },
  { id: 13, name: "Table 13", status: "Booked", initial: "EK", seats: 2 },
  { id: 14, name: "Table 14", status: "Available", initial: "QN", seats: 6 },
  { id: 15, name: "Table 15", status: "Booked", initial: "TW", seats: 3 },
];

const startersItem: StaticMenuItem[] = [
  { id: 1, name: "Paneer Tikka", price: 250, category: "Vegetarian" },
  { id: 2, name: "Chicken Tikka", price: 300, category: "Non-Vegetarian" },
  { id: 3, name: "Tandoori Chicken", price: 350, category: "Non-Vegetarian" },
  { id: 4, name: "Samosa", price: 100, category: "Vegetarian" },
  { id: 5, name: "Aloo Tikki", price: 120, category: "Vegetarian" },
  { id: 6, name: "Hara Bhara Kebab", price: 220, category: "Vegetarian" },
];

const mainCourse: StaticMenuItem[] = [
  { id: 1, name: "Butter Chicken", price: 400, category: "Non-Vegetarian" },
  { id: 2, name: "Paneer Butter Masala", price: 350, category: "Vegetarian" },
  { id: 3, name: "Chicken Biryani", price: 450, category: "Non-Vegetarian" },
  { id: 4, name: "Dal Makhani", price: 180, category: "Vegetarian" },
  { id: 5, name: "Kadai Paneer", price: 300, category: "Vegetarian" },
  { id: 6, name: "Rogan Josh", price: 500, category: "Non-Vegetarian" },
];

export const menus: MenuCategory[] = [
  { id: 2, name: "Main Course", bgColor: "#5b45b0", icon: "🍛", items: mainCourse },
];

export const metricsData: MetricItem[] = [
  { title: "Revenue", value: "₹50,846.90", percentage: "12%", color: "#025cca", isIncrease: false },
  { title: "Outbound Clicks", value: "10,342", percentage: "16%", color: "#02ca3a", isIncrease: true },
  { title: "Total Customer", value: "19,720", percentage: "10%", color: "#f6b100", isIncrease: true },
  { title: "Event Count", value: "20,000", percentage: "10%", color: "#be3e3f", isIncrease: false },
];

export const itemsData: MetricItem[] = [
  { title: "Total Categories", value: "8", percentage: "12%", color: "#5b45b0", isIncrease: false },
  { title: "Total Dishes", value: "50", percentage: "12%", color: "#285430", isIncrease: true },
  { title: "Active Orders", value: "12", percentage: "12%", color: "#735f32", isIncrease: true },
  { title: "Total Tables", value: "10", color: "#7f167f" },
];

export const orders: StaticOrder[] = [
  { id: "101", customer: "Amrit Raj", status: "Ready", dateTime: "January 18, 2025 08:32 PM", items: 8, tableNo: 3, total: 250.0 },
  { id: "102", customer: "John Doe", status: "In Progress", dateTime: "January 18, 2025 08:45 PM", items: 5, tableNo: 4, total: 180.0 },
  { id: "103", customer: "Emma Smith", status: "Ready", dateTime: "January 18, 2025 09:00 PM", items: 3, tableNo: 5, total: 120.0 },
  { id: "104", customer: "Chris Brown", status: "In Progress", dateTime: "January 18, 2025 09:15 PM", items: 6, tableNo: 6, total: 220.0 },
];

/**
 * @deprecated Use getDishImage() from utils instead.
 * Kept for backwards compatibility with callers that haven't migrated yet.
 * Entries with local assets are intentionally left empty so getDishImage()
 * takes priority via its LOCAL_DISH_IMAGES map.
 */
export const DISH_FALLBACK_IMAGES: Record<string, string> = {
  // No local asset — keep external URL as last-resort fallback
  "Plain Paratha":  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Aloo_Paratha_also_known_as_Batatay_Jo_Phulko.jpg/600px-Aloo_Paratha_also_known_as_Batatay_Jo_Phulko.jpg",
  "Butter Paratha": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Aloo_Paratha_also_known_as_Batatay_Jo_Phulko.jpg/600px-Aloo_Paratha_also_known_as_Batatay_Jo_Phulko.jpg",
  "Puri":           "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Puri-an_indian_food.jpg/600px-Puri-an_indian_food.jpg",
  "Naan":           "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Naan_baked_in_Tandoor.png/600px-Naan_baked_in_Tandoor.png",
  "Butter Naan":    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Naan_baked_in_Tandoor.png/600px-Naan_baked_in_Tandoor.png",
  "Dal Makhani":    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Dal_Makhni%2C_an_Indian_delicacy.jpg/600px-Dal_Makhni%2C_an_Indian_delicacy.jpg",
  "Chicken Curry":  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Chicken_makhani_with_rice.jpg/600px-Chicken_makhani_with_rice.jpg",
  "Butter Chicken": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Chicken_makhani_with_rice.jpg/600px-Chicken_makhani_with_rice.jpg",
  "Mutton Curry":   "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Mutton_curry_with_rice.jpg/600px-Mutton_curry_with_rice.jpg",
  "Nimbu Pani":     "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Lemonade_in_pitcher.jpg/600px-Lemonade_in_pitcher.jpg",
  "Cold Drink":     "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Lemonade_in_pitcher.jpg/600px-Lemonade_in_pitcher.jpg",
  "Water Bottle":   "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Water_Bottle_-_Clear.jpg/600px-Water_Bottle_-_Clear.jpg",
};

export const TOP_50_DHABA_DISHES = [
  { name: "Butter Chicken", category: "Non-Veg", image: "https://image.pollinations.ai/prompt/Butter%20Chicken%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Dal Makhani", category: "Veg", image: "https://image.pollinations.ai/prompt/Dal%20Makhani%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Paneer Butter Masala", category: "Veg", image: "https://image.pollinations.ai/prompt/Paneer%20Butter%20Masala%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Kadai Paneer", category: "Veg", image: "https://image.pollinations.ai/prompt/Kadai%20Paneer%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Shahi Paneer", category: "Veg", image: "https://image.pollinations.ai/prompt/Shahi%20Paneer%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Dal Tadka", category: "Veg", image: "https://image.pollinations.ai/prompt/Dal%20Tadka%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Mix Veg", category: "Veg", image: "https://image.pollinations.ai/prompt/Mix%20Veg%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Aloo Gobi", category: "Veg", image: "https://image.pollinations.ai/prompt/Aloo%20Gobi%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Jeera Aloo", category: "Veg", image: "https://image.pollinations.ai/prompt/Jeera%20Aloo%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Bhindi Masala", category: "Veg", image: "https://image.pollinations.ai/prompt/Bhindi%20Masala%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Chana Masala", category: "Veg", image: "https://image.pollinations.ai/prompt/Chana%20Masala%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Rajma Masala", category: "Veg", image: "https://image.pollinations.ai/prompt/Rajma%20Masala%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Baingan Bharta", category: "Veg", image: "https://image.pollinations.ai/prompt/Baingan%20Bharta%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Dum Aloo", category: "Veg", image: "https://image.pollinations.ai/prompt/Dum%20Aloo%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Malai Kofta", category: "Veg", image: "https://image.pollinations.ai/prompt/Malai%20Kofta%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },

  { name: "Tandoori Roti", category: "Bread", image: "https://image.pollinations.ai/prompt/Tandoori%20Roti%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Butter Roti", category: "Bread", image: "https://image.pollinations.ai/prompt/Butter%20Roti%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Plain Naan", category: "Bread", image: "https://image.pollinations.ai/prompt/Plain%20Naan%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Butter Naan", category: "Bread", image: "https://image.pollinations.ai/prompt/Butter%20Naan%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Garlic Naan", category: "Bread", image: "https://image.pollinations.ai/prompt/Garlic%20Naan%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Lachha Paratha", category: "Bread", image: "https://image.pollinations.ai/prompt/Lachha%20Paratha%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Aloo Paratha", category: "Bread", image: "https://image.pollinations.ai/prompt/Aloo%20Paratha%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Paneer Paratha", category: "Bread", image: "https://image.pollinations.ai/prompt/Paneer%20Paratha%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Pudina Paratha", category: "Bread", image: "https://image.pollinations.ai/prompt/Pudina%20Paratha%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Missi Roti", category: "Bread", image: "https://image.pollinations.ai/prompt/Missi%20Roti%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },

  { name: "Plain Rice", category: "Rice", image: "https://image.pollinations.ai/prompt/Plain%20Rice%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Jeera Rice", category: "Rice", image: "https://image.pollinations.ai/prompt/Jeera%20Rice%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Peas Pulao", category: "Rice", image: "https://image.pollinations.ai/prompt/Peas%20Pulao%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Veg Pulao", category: "Rice", image: "https://image.pollinations.ai/prompt/Veg%20Pulao%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Veg Biryani", category: "Rice", image: "https://image.pollinations.ai/prompt/Veg%20Biryani%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Chicken Biryani", category: "Rice", image: "https://image.pollinations.ai/prompt/Chicken%20Biryani%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Mutton Biryani", category: "Rice", image: "https://image.pollinations.ai/prompt/Mutton%20Biryani%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Egg Biryani", category: "Rice", image: "https://image.pollinations.ai/prompt/Egg%20Biryani%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },

  { name: "Chicken Curry", category: "Non-Veg", image: "https://image.pollinations.ai/prompt/Chicken%20Curry%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Kadai Chicken", category: "Non-Veg", image: "https://image.pollinations.ai/prompt/Kadai%20Chicken%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Chicken Tikka Masala", category: "Non-Veg", image: "https://image.pollinations.ai/prompt/Chicken%20Tikka%20Masala%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Handi Chicken", category: "Non-Veg", image: "https://image.pollinations.ai/prompt/Handi%20Chicken%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Mutton Curry", category: "Non-Veg", image: "https://image.pollinations.ai/prompt/Mutton%20Curry%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Mutton Rogan Josh", category: "Non-Veg", image: "https://image.pollinations.ai/prompt/Mutton%20Rogan%20Josh%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Egg Curry", category: "Non-Veg", image: "https://image.pollinations.ai/prompt/Egg%20Curry%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Egg Bhurji", category: "Non-Veg", image: "https://image.pollinations.ai/prompt/Egg%20Bhurji%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },

  { name: "Samosa", category: "Snacks", image: "https://image.pollinations.ai/prompt/Samosa%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Onion Pakoda", category: "Snacks", image: "https://image.pollinations.ai/prompt/Onion%20Pakoda%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Paneer Tikka", category: "Snacks", image: "https://image.pollinations.ai/prompt/Paneer%20Tikka%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Chicken Tikka", category: "Snacks", image: "https://image.pollinations.ai/prompt/Chicken%20Tikka%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },

  { name: "Gulab Jamun", category: "Dessert", image: "https://image.pollinations.ai/prompt/Gulab%20Jamun%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Rasgulla", category: "Dessert", image: "https://image.pollinations.ai/prompt/Rasgulla%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Gajar Ka Halwa", category: "Dessert", image: "https://image.pollinations.ai/prompt/Gajar%20Ka%20Halwa%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Sweet Lassi", category: "Drinks", image: "https://image.pollinations.ai/prompt/Sweet%20Lassi%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" },
  { name: "Masala Chai", category: "Drinks", image: "https://image.pollinations.ai/prompt/Masala%20Chai%20Indian%20high-quality%20food%20photography%20dhaba?width=600&height=400&nologo=true" }
];
