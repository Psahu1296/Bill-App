// ── Local dish image imports ──────────────────────────────────────────────────
import imgChai            from "../assets/images/chai.jpg";
import imgJeeraRice       from "../assets/images/jeera_rice.webp";
import imgRice            from "../assets/images/rice.jpg";
import imgDaalFry         from "../assets/images/Daal Fry.jpg";
import imgDaalTadka       from "../assets/images/daal_tadka.webp";
import imgMixVeg          from "../assets/images/mix_veg.webp";
import imgLassi           from "../assets/images/lassi.webp";
import imgMuttonBiryani   from "../assets/images/mutton_biryani.jpg";
import imgChickenBiryani  from "../assets/images/chiken_biryani.jpg";
import imgPaneerButterMasala from "../assets/images/paneer_butter_masala.jpg";
import imgShahiPaneer     from "../assets/images/sahi_paneer.webp";
import imgFriedRice       from "../assets/images/fried_rice.jpg";
import imgTandooriRoti    from "../assets/images/tandoori_roti.jpg";
import imgMatarPaneer     from "../assets/images/matar_paneer.webp";
import imgPaneerChilly    from "../assets/images/paneer_chilly.webp";
import imgPaneerMasala    from "../assets/images/paneer_masala.webp";
import imgEggBhurji       from "../assets/images/egg_bhurji.webp";
import imgEggBhurjiCurry  from "../assets/images/egg_bhurji_curry.webp";
import imgFishCurry       from "../assets/images/fish_curry.jpg";
import imgRajmaChawal     from "../assets/images/rajma-chawal-1.jpg";
import imgGobhiMatar      from "../assets/images/gobhi_matar.webp";
import imgDaalRice        from "../assets/images/daal_rice.webp";
import imgChickenRoast    from "../assets/images/chiken_roast.webp";
import imgMasalaRice      from "../assets/images/masala_rice.webp";
import imgMatarRice       from "../assets/images/matar-rice.webp";
import imgRoti            from "../assets/images/roti.webp";
import imgVegBiryani      from "../assets/images/veg_biryani.jpg";
/** Maps dish names (and common aliases) to local asset images. */
const LOCAL_DISH_IMAGES: Record<string, string> = {
  // Roti
  "Roti":              imgRoti,
  "Butter Roti":       imgTandooriRoti,
  "Tandoori Roti":     imgTandooriRoti,

  // Rice
  "Plain Rice":        imgRice,
  "Jeera Rice":        imgJeeraRice,
  "Veg Fried Rice":    imgFriedRice,
  "Chicken Fried Rice": imgFriedRice,
  "Veg Biryani":       imgVegBiryani,
  "Chicken Biryani":   imgChickenBiryani,
  "Mutton Biryani":    imgMuttonBiryani,
  "Masala Rice":       imgMasalaRice,
  "Matar Rice":        imgMatarRice,
  "Dal Rice":          imgDaalRice,
  "Rajma Chawal":      imgRajmaChawal,

  // Sabji
  "Dal Fry":           imgDaalFry,
  "Dal Tadka":         imgDaalTadka,
  "Dal Makhani":       imgDaalRice,
  "Paneer Butter Masala": imgPaneerButterMasala,
  "Shahi Paneer":      imgShahiPaneer,
  "Matar Paneer":      imgMatarPaneer,
  "Paneer Masala":     imgPaneerMasala,
  "Paneer Chilly":     imgPaneerChilly,
  "Paneer Chilli":     imgPaneerChilly,
  "Mix Veg":           imgMixVeg,
  "Aloo Gobi":         imgGobhiMatar,
  "Gobhi Matar":       imgGobhiMatar,
  "Aloo Matar":        imgGobhiMatar,
  "Egg Bhurji":        imgEggBhurji,
  "Egg Curry":         imgEggBhurjiCurry,
  "Egg Bhurji Curry":  imgEggBhurjiCurry,
  "Fish Curry":        imgFishCurry,
  "Chicken Roast":     imgChickenRoast,

  // Drinks
  "Chai":              imgChai,
  "Lassi":             imgLassi,
  "Sweet Lassi":       imgLassi,
};

/**
 * Returns the best available image for a dish.
 * Priority: remote/DB image → local asset match → undefined
 */
export const getDishImage = (name: string, remoteImage?: string): string | undefined => {
  if (remoteImage) return remoteImage;
  // Exact match
  if (LOCAL_DISH_IMAGES[name]) return LOCAL_DISH_IMAGES[name];
  // Case-insensitive fuzzy match
  const lower = name.toLowerCase();
  const key = Object.keys(LOCAL_DISH_IMAGES).find((k) => k.toLowerCase() === lower);
  return key ? LOCAL_DISH_IMAGES[key] : undefined;
};

export const getBgColor = (): string => {
  const bgarr = [
    "#b73e3e",
    "#5b45b0",
    "#7f167f",
    "#735f32",
    "#1d2569",
    "#285430",
    "#f6b100",
    "#025cca",
    "#be3e3f",
    "#02ca3a",
  ];
  const randomBg = Math.floor(Math.random() * bgarr.length);
  return bgarr[randomBg];
};

export const getAvatarName = (name: string | undefined | null): string => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase();
};

export const formatDate = (date: Date): string => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")}, ${date.getFullYear()}`;
};

export const formatDateAndTime = (date: string | Date): string => {
  return new Date(date).toLocaleString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
};
