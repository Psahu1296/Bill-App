export interface CatalogDish {
  name: string;
  image: string;
  type: string;
  category: string;
  variants: { size: string; price: number }[];
  description: string;
  isAvailable: boolean;
  isFrequent: boolean;
}

export const DEFAULT_DISH_CATALOG: CatalogDish[] = [
  { name: "Roti", image: "https://media.istockphoto.com/id/1126849659/photo/chapati-tava-roti-also-known-as-indian-bread-or-fulka-phulka-main-ingredient-of-lunch-dinner.jpg?s=1024x1024&w=is&k=20&c=LgzSBLSCMva2K3viP1zctQNVNeZRRb7AeyGauPE1FdU=", type: "veg", category: "roti", variants: [{ size: "Regular", price: 7 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Plain Rice", image: "", type: "veg", category: "rice", variants: [{ size: "Half", price: 30 }, { size: "Full", price: 60 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Jeera Rice", image: "", type: "main_course", category: "veg", variants: [{ size: "Half", price: 40 }, { size: "Full", price: 80 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Veg Fried Rice", image: "", type: "veg", category: "rice", variants: [{ size: "Half", price: 80 }, { size: "Full", price: 140 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Veg Biryani", image: "", type: "veg", category: "rice", variants: [{ size: "Half", price: 100 }, { size: "Full", price: 180 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Chicken Biryani", image: "", type: "main_course", category: "non_veg", variants: [{ size: "Half", price: 130 }, { size: "Full", price: 240 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Dal Fry", image: "https://media.istockphoto.com/id/1059166928/photo/indian-cooked-toor-dal.jpg?s=1024x1024&w=is&k=20&c=9qjjxXaLMfRl-Obh58abpSdnWMCkAdUi0KinhDOyIlg=", type: "veg", category: "sabji", variants: [{ size: "Half", price: 70 }, { size: "Full", price: 140 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Dal Tadka", image: "", type: "main_course", category: "veg", variants: [{ size: "Half", price: 80 }, { size: "Full", price: 160 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Shahi Paneer", image: "", type: "veg", category: "sabji", variants: [{ size: "Half", price: 140 }, { size: "Full", price: 250 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Mix Veg", image: "", type: "veg", category: "sabji", variants: [{ size: "Half", price: 80 }, { size: "Full", price: 160 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Egg Curry", image: "", type: "non-veg", category: "other", variants: [{ size: "Half", price: 70 }, { size: "Full", price: 140 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Cold Drink", image: "", type: "beverage", category: "veg", variants: [{ size: "Regular", price: 25 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Water Bottle", image: "", type: "veg", category: "drinks", variants: [{ size: "Regular", price: 20 }], description: "", isAvailable: true, isFrequent: false },
  { name: "chana masala", image: "", type: "veg", category: "sabji", variants: [{ size: "Half", price: 70 }, { size: "Full", price: 140 }], description: "", isAvailable: true, isFrequent: false },
  { name: "papad dry", image: "", type: "veg", category: "snacks", variants: [{ size: "Regular", price: 10 }], description: "", isAvailable: true, isFrequent: false },
  { name: "papad fry", image: "", type: "veg", category: "snacks", variants: [{ size: "Regular", price: 20 }], description: "", isAvailable: true, isFrequent: false },
  { name: "masala papad", image: "", type: "veg", category: "snacks", variants: [{ size: "Regular", price: 30 }], description: "", isAvailable: true, isFrequent: false },
  { name: "chana roast", image: "", type: "veg", category: "snacks", variants: [{ size: "Half", price: 100 }, { size: "Full", price: 200 }], description: "", isAvailable: true, isFrequent: false },
  { name: "paneer chilly", image: "", type: "veg", category: "sabji", variants: [{ size: "Half", price: 120 }, { size: "Full", price: 200 }], description: "", isAvailable: true, isFrequent: false },
  { name: "making charge", image: "", type: "non-veg", category: "sabji", variants: [{ size: "Half", price: 100 }, { size: "Full", price: 200 }, { size: "Small", price: 50 }], description: "", isAvailable: true, isFrequent: false },
  { name: "chicken masala", image: "", type: "non-veg", category: "sabji", variants: [{ size: "Half", price: 100 }, { size: "Full", price: 200 }], description: "", isAvailable: true, isFrequent: false },
  { name: "chicken roast", image: "", type: "non-veg", category: "sabji", variants: [{ size: "Half", price: 120 }, { size: "Full", price: 240 }], description: "", isAvailable: true, isFrequent: false },
  { name: "shev bhaji (Doodh)", image: "", type: "veg", category: "sabji", variants: [{ size: "Half", price: 70 }, { size: "Full", price: 140 }], description: "", isAvailable: true, isFrequent: false },
  { name: "shev bhaji (masala)", image: "", type: "veg", category: "sabji", variants: [{ size: "Half", price: 70 }, { size: "Full", price: 140 }], description: "", isAvailable: true, isFrequent: false },
  { name: "gutka", image: "", type: "veg", category: "other", variants: [{ size: "Regular", price: 5 }], description: "", isAvailable: true, isFrequent: false },
  { name: "gobhi matar", image: "https://media.istockphoto.com/id/1126849659/photo/chapati-tava-roti-also-known-as-indian-bread-or-fulka-phulka-main-ingredient-of-lunch-dinner.jpg?s=1024x1024&w=is&k=20&c=LgzSBLSCMva2K3viP1zctQNVNeZRRb7AeyGauPE1FdU=", type: "veg", category: "sabji", variants: [{ size: "Half", price: 70 }, { size: "Full", price: 140 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Gold flake cigarette", image: "", type: "veg", category: "other", variants: [{ size: "Large", price: 20 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Flake cigarette", image: "", type: "veg", category: "other", variants: [{ size: "Regular", price: 10 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Total", image: "", type: "veg", category: "other", variants: [{ size: "Regular", price: 10 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Star liberty cigarette", image: "", type: "veg", category: "other", variants: [{ size: "Regular", price: 5 }], description: "", isAvailable: true, isFrequent: false },
  { name: "fish masala", image: "", type: "non-veg", category: "sabji", variants: [{ size: "Half", price: 100 }, { size: "Full", price: 200 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Fish Roast", image: "", type: "non-veg", category: "sabji", variants: [{ size: "Single", price: 50 }, { size: "Half", price: 100 }, { size: "Full", price: 200 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Egg bhurji (2 pc)", image: "", type: "non-veg", category: "sabji", variants: [{ size: "Regular", price: 50 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Masala rice", image: "", type: "veg", category: "rice", variants: [{ size: "Half", price: 50 }, { size: "Full", price: 100 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Egg Rice", image: "", type: "non-veg", category: "rice", variants: [{ size: "Half", price: 80 }], description: "", isAvailable: true, isFrequent: false },
  { name: "Chai", image: "https://media.istockphoto.com/id/1010500418/photo/image-of-a-glass-of-tea-with-green-natural-background.jpg?s=1024x1024&w=is&k=20&c=h3mttRrBOw8eIbsj7wNGG0P5RduEXWZ0i4ryrkfU5KA=", type: "veg", category: "drinks", variants: [{ size: "Half", price: 10 }, { size: "Full", price: 20 }], description: "", isAvailable: true, isFrequent: false },
  { name: "aamlate", image: "", type: "veg", category: "sabji", variants: [{ size: "Half", price: 50 }, { size: "Full", price: 100 }], description: "", isAvailable: true, isFrequent: false },
  { name: "paratha", image: "", type: "veg", category: "sabji", variants: [{ size: "Single", price: 40 }], description: "", isAvailable: true, isFrequent: false },
  { name: "disposal", image: "", type: "veg", category: "sabji", variants: [{ size: "Single", price: 2 }], description: "", isAvailable: true, isFrequent: false },
  { name: "egg bhuji curry", image: "", type: "non-veg", category: "sabji", variants: [{ size: "Half", price: 70 }, { size: "Full", price: 140 }], description: "", isAvailable: true, isFrequent: false },
  { name: "dal chawal", image: "", type: "veg", category: "sabji", variants: [{ size: "Half", price: 40 }, { size: "Full", price: 80 }], description: "", isAvailable: true, isFrequent: false },
];
