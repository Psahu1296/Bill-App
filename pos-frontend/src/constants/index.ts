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
