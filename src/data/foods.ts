import type { BaseUnit } from "@/lib/domain";

export type BuiltinFood = {
  key: string;
  name: string;
  nameEl: string;
  unit?: BaseUnit;
  /** Per 100 g / ml */
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber?: number;
  sugar?: number;
  servings?: { id: string; label: string; labelEl: string; amount: number }[];
  defaultServing?: string;
};

/**
 * Starter food catalog with typical values per 100 g (or 100 ml), based on
 * USDA FoodData Central reference values and common Greek products.
 * Values are averages — packaged products vary, so users can create their own
 * foods (or scan barcodes) for exact label values. Keys are permanent.
 */
export const BUILTIN_FOODS: BuiltinFood[] = [
  // Meat, fish & eggs
  { key: "chicken-breast-raw", name: "Chicken breast, raw", nameEl: "Στήθος κοτόπουλο, ωμό", kcal: 120, p: 22.5, c: 0, f: 2.6 },
  { key: "chicken-breast-cooked", name: "Chicken breast, grilled", nameEl: "Στήθος κοτόπουλο, ψητό", kcal: 165, p: 31, c: 0, f: 3.6 },
  { key: "chicken-thigh-cooked", name: "Chicken thigh, roasted (skinless)", nameEl: "Μπούτι κοτόπουλο, ψητό (χωρίς πέτσα)", kcal: 209, p: 26, c: 0, f: 10.9 },
  { key: "turkey-breast-deli", name: "Turkey breast, sliced", nameEl: "Γαλοπούλα φιλέτο σε φέτες", kcal: 104, p: 17.1, c: 4.2, f: 1.7, servings: [{ id: "slice", label: "1 slice", labelEl: "1 φέτα", amount: 20 }] },
  { key: "beef-mince-5", name: "Beef mince 5% fat, raw", nameEl: "Μοσχαρίσιος κιμάς 5%, ωμός", kcal: 137, p: 21.4, c: 0, f: 5 },
  { key: "beef-mince-10", name: "Beef mince 10% fat, raw", nameEl: "Μοσχαρίσιος κιμάς 10%, ωμός", kcal: 176, p: 20, c: 0, f: 10 },
  { key: "beef-sirloin-raw", name: "Beef sirloin steak, raw", nameEl: "Μοσχαρίσια μπριζόλα (κόντρα), ωμή", kcal: 160, p: 21, c: 0, f: 8 },
  { key: "pork-tenderloin-raw", name: "Pork tenderloin, raw", nameEl: "Χοιρινό φιλέτο, ωμό", kcal: 120, p: 21, c: 0, f: 3.5 },
  { key: "pork-souvlaki", name: "Pork souvlaki (grilled meat)", nameEl: "Σουβλάκι χοιρινό (ψητό κρέας)", kcal: 212, p: 26, c: 1, f: 11.5, servings: [{ id: "skewer", label: "1 skewer", labelEl: "1 καλαμάκι", amount: 70 }], defaultServing: "skewer" },
  { key: "gyros-pork", name: "Gyros, pork (meat only)", nameEl: "Γύρος χοιρινός (μόνο κρέας)", kcal: 255, p: 19, c: 4, f: 18 },
  { key: "salmon-raw", name: "Salmon, raw", nameEl: "Σολομός, ωμός", kcal: 208, p: 20.4, c: 0, f: 13.4 },
  { key: "tuna-water", name: "Tuna in water, drained", nameEl: "Τόνος σε νερό, στραγγισμένος", kcal: 116, p: 25.5, c: 0, f: 0.8, servings: [{ id: "can", label: "1 can (drained)", labelEl: "1 κονσέρβα (στραγγισμένη)", amount: 112 }] },
  { key: "tuna-oil", name: "Tuna in olive oil, drained", nameEl: "Τόνος σε ελαιόλαδο, στραγγισμένος", kcal: 198, p: 29, c: 0, f: 8.2, servings: [{ id: "can", label: "1 can (drained)", labelEl: "1 κονσέρβα (στραγγισμένη)", amount: 112 }] },
  { key: "cod-raw", name: "Cod, raw", nameEl: "Μπακαλιάρος, ωμός", kcal: 82, p: 18, c: 0, f: 0.7 },
  { key: "shrimp-raw", name: "Shrimp, raw", nameEl: "Γαρίδες, ωμές", kcal: 85, p: 20.1, c: 0, f: 0.5 },
  { key: "sardines-oil", name: "Sardines in oil, drained", nameEl: "Σαρδέλες σε λάδι, στραγγισμένες", kcal: 208, p: 24.6, c: 0, f: 11.5 },
  { key: "egg-whole", name: "Egg, whole", nameEl: "Αυγό, ολόκληρο", kcal: 143, p: 12.6, c: 0.7, f: 9.5, servings: [{ id: "large", label: "1 large egg", labelEl: "1 μεγάλο αυγό", amount: 50 }], defaultServing: "large" },
  { key: "egg-white", name: "Egg white", nameEl: "Ασπράδι αυγού", kcal: 52, p: 10.9, c: 0.7, f: 0.2, servings: [{ id: "large", label: "1 large egg white", labelEl: "1 ασπράδι", amount: 33 }] },

  // Dairy & protein
  { key: "greek-yogurt-0", name: "Greek yogurt 0%", nameEl: "Γιαούρτι στραγγιστό 0%", kcal: 54, p: 10.3, c: 3.6, f: 0, sugar: 3.6, servings: [{ id: "pot", label: "1 pot (170 g)", labelEl: "1 κεσεδάκι (170 g)", amount: 170 }] },
  { key: "greek-yogurt-2", name: "Greek yogurt 2%", nameEl: "Γιαούρτι στραγγιστό 2%", kcal: 73, p: 9.9, c: 3.9, f: 2, sugar: 3.9, servings: [{ id: "pot", label: "1 pot (170 g)", labelEl: "1 κεσεδάκι (170 g)", amount: 170 }] },
  { key: "greek-yogurt-10", name: "Greek yogurt 10% (traditional)", nameEl: "Γιαούρτι στραγγιστό 10%", kcal: 121, p: 6.4, c: 3.7, f: 10, sugar: 3.7 },
  { key: "skyr", name: "Skyr, plain", nameEl: "Skyr, σκέτο", kcal: 63, p: 11, c: 4, f: 0.2, sugar: 4 },
  { key: "cottage-cheese", name: "Cottage cheese, low fat", nameEl: "Τυρί cottage, χαμηλά λιπαρά", kcal: 81, p: 10.5, c: 4.8, f: 2.3 },
  { key: "feta", name: "Feta cheese", nameEl: "Φέτα", kcal: 264, p: 14.2, c: 4.1, f: 21.3, servings: [{ id: "portion", label: "1 portion", labelEl: "1 μερίδα", amount: 40 }] },
  { key: "graviera", name: "Graviera cheese", nameEl: "Γραβιέρα", kcal: 400, p: 26, c: 0.5, f: 32.5, servings: [{ id: "slice", label: "1 slice", labelEl: "1 φέτα", amount: 25 }] },
  { key: "kasseri", name: "Kasseri cheese", nameEl: "Κασέρι", kcal: 375, p: 24, c: 1, f: 30, servings: [{ id: "slice", label: "1 slice", labelEl: "1 φέτα", amount: 20 }] },
  { key: "halloumi", name: "Halloumi", nameEl: "Χαλούμι", kcal: 316, p: 22, c: 1.6, f: 25 },
  { key: "mozzarella", name: "Mozzarella", nameEl: "Μοτσαρέλα", kcal: 299, p: 22.2, c: 2.2, f: 22.4 },
  { key: "parmesan", name: "Parmesan", nameEl: "Παρμεζάνα", kcal: 392, p: 35.8, c: 3.2, f: 25.8 },
  { key: "cheddar", name: "Cheddar", nameEl: "Τσένταρ", kcal: 403, p: 24.9, c: 1.3, f: 33.1 },
  { key: "milk-whole", name: "Milk, whole 3.5%", nameEl: "Γάλα πλήρες 3,5%", unit: "ml", kcal: 63, p: 3.3, c: 4.8, f: 3.5, sugar: 4.8, servings: [{ id: "glass", label: "1 glass (250 ml)", labelEl: "1 ποτήρι (250 ml)", amount: 250 }] },
  { key: "milk-semi", name: "Milk, semi-skimmed 1.5%", nameEl: "Γάλα ελαφρύ 1,5%", unit: "ml", kcal: 46, p: 3.3, c: 4.8, f: 1.5, sugar: 4.8, servings: [{ id: "glass", label: "1 glass (250 ml)", labelEl: "1 ποτήρι (250 ml)", amount: 250 }] },
  { key: "milk-skimmed", name: "Milk, skimmed", nameEl: "Γάλα άπαχο", unit: "ml", kcal: 35, p: 3.4, c: 5, f: 0.1, sugar: 5, servings: [{ id: "glass", label: "1 glass (250 ml)", labelEl: "1 ποτήρι (250 ml)", amount: 250 }] },
  { key: "almond-milk", name: "Almond drink, unsweetened", nameEl: "Ρόφημα αμυγδάλου, χωρίς ζάχαρη", unit: "ml", kcal: 13, p: 0.4, c: 0.3, f: 1.1, servings: [{ id: "glass", label: "1 glass (250 ml)", labelEl: "1 ποτήρι (250 ml)", amount: 250 }] },
  { key: "whey-protein", name: "Whey protein powder", nameEl: "Πρωτεΐνη ορού γάλακτος (whey)", kcal: 400, p: 78, c: 8, f: 6, sugar: 5, servings: [{ id: "scoop", label: "1 scoop (30 g)", labelEl: "1 μεζούρα (30 g)", amount: 30 }], defaultServing: "scoop" },
  { key: "casein-protein", name: "Casein protein powder", nameEl: "Πρωτεΐνη καζεΐνης", kcal: 370, p: 78, c: 6, f: 2.5, servings: [{ id: "scoop", label: "1 scoop (30 g)", labelEl: "1 μεζούρα (30 g)", amount: 30 }], defaultServing: "scoop" },
  { key: "protein-bar", name: "Protein bar (typical)", nameEl: "Μπάρα πρωτεΐνης (τυπική)", kcal: 360, p: 33, c: 35, f: 11, fiber: 8, servings: [{ id: "bar", label: "1 bar (60 g)", labelEl: "1 μπάρα (60 g)", amount: 60 }], defaultServing: "bar" },
  { key: "tofu-firm", name: "Tofu, firm", nameEl: "Τόφου, σκληρό", kcal: 144, p: 17.3, c: 2.8, f: 8.7, fiber: 2.3 },

  // Legumes
  { key: "lentils-cooked", name: "Lentils, cooked", nameEl: "Φακές, βρασμένες", kcal: 116, p: 9, c: 20.1, f: 0.4, fiber: 7.9 },
  { key: "chickpeas-cooked", name: "Chickpeas, cooked", nameEl: "Ρεβίθια, βρασμένα", kcal: 164, p: 8.9, c: 27.4, f: 2.6, fiber: 7.6 },
  { key: "white-beans-cooked", name: "White beans, cooked", nameEl: "Φασόλια μέτρια, βρασμένα", kcal: 139, p: 9.7, c: 25.1, f: 0.4, fiber: 6.3 },
  { key: "hummus", name: "Hummus", nameEl: "Χούμους", kcal: 166, p: 7.9, c: 14.3, f: 9.6, fiber: 6 },
  { key: "fasolada", name: "Fasolada (bean soup)", nameEl: "Φασολάδα", kcal: 95, p: 4.5, c: 13, f: 3, fiber: 4, servings: [{ id: "bowl", label: "1 bowl (350 g)", labelEl: "1 πιάτο (350 g)", amount: 350 }] },

  // Grains & starches
  { key: "rice-white-cooked", name: "White rice, cooked", nameEl: "Ρύζι λευκό, βρασμένο", kcal: 130, p: 2.7, c: 28.2, f: 0.3, fiber: 0.4 },
  { key: "rice-white-raw", name: "White rice, uncooked", nameEl: "Ρύζι λευκό, ωμό", kcal: 365, p: 7.1, c: 80, f: 0.7, fiber: 1.3 },
  { key: "rice-brown-cooked", name: "Brown rice, cooked", nameEl: "Ρύζι καστανό, βρασμένο", kcal: 123, p: 2.7, c: 25.6, f: 1, fiber: 1.6 },
  { key: "pasta-dry", name: "Pasta, dry", nameEl: "Ζυμαρικά, ωμά", kcal: 371, p: 13, c: 74.7, f: 1.5, fiber: 3.2 },
  { key: "pasta-cooked", name: "Pasta, cooked", nameEl: "Ζυμαρικά, βρασμένα", kcal: 158, p: 5.8, c: 30.9, f: 0.9, fiber: 1.8 },
  { key: "pasta-wholewheat-dry", name: "Whole-wheat pasta, dry", nameEl: "Ζυμαρικά ολικής, ωμά", kcal: 352, p: 13.9, c: 72, f: 2.5, fiber: 9 },
  { key: "oats", name: "Rolled oats", nameEl: "Βρώμη νιφάδες", kcal: 379, p: 13.2, c: 67.7, f: 6.5, fiber: 10.1, servings: [{ id: "portion", label: "1 portion (50 g)", labelEl: "1 μερίδα (50 g)", amount: 50 }] },
  { key: "granola", name: "Granola", nameEl: "Γκρανόλα", kcal: 471, p: 10, c: 64, f: 20, fiber: 7, sugar: 20 },
  { key: "bread-white", name: "White bread", nameEl: "Ψωμί λευκό", kcal: 266, p: 7.6, c: 50.6, f: 3.3, fiber: 2.4, servings: [{ id: "slice", label: "1 slice", labelEl: "1 φέτα", amount: 30 }], defaultServing: "slice" },
  { key: "bread-wholewheat", name: "Whole-wheat bread", nameEl: "Ψωμί ολικής άλεσης", kcal: 252, p: 12.4, c: 42.7, f: 3.5, fiber: 6, servings: [{ id: "slice", label: "1 slice", labelEl: "1 φέτα", amount: 30 }], defaultServing: "slice" },
  { key: "pita-bread", name: "Pita bread", nameEl: "Πίτα για σουβλάκι", kcal: 275, p: 9.1, c: 55.7, f: 1.2, fiber: 2.2, servings: [{ id: "pita", label: "1 pita", labelEl: "1 πίτα", amount: 80 }], defaultServing: "pita" },
  { key: "barley-rusk", name: "Barley rusk (paximadi)", nameEl: "Παξιμάδι κριθαρένιο", kcal: 365, p: 11, c: 69, f: 3.5, fiber: 9, servings: [{ id: "piece", label: "1 rusk", labelEl: "1 παξιμάδι", amount: 30 }] },
  { key: "koulouri", name: "Sesame bread ring (koulouri)", nameEl: "Κουλούρι Θεσσαλονίκης", kcal: 360, p: 11, c: 60, f: 9, fiber: 3.5, servings: [{ id: "piece", label: "1 koulouri", labelEl: "1 κουλούρι", amount: 90 }], defaultServing: "piece" },
  { key: "tortilla-wrap", name: "Wheat tortilla wrap", nameEl: "Τορτίγια σιταριού", kcal: 310, p: 8.2, c: 50.4, f: 7.9, fiber: 3.5, servings: [{ id: "wrap", label: "1 wrap", labelEl: "1 τορτίγια", amount: 60 }], defaultServing: "wrap" },
  { key: "rice-cakes", name: "Rice cakes", nameEl: "Ρυζογκοφρέτες", kcal: 387, p: 8.2, c: 81.5, f: 2.8, fiber: 4.2, servings: [{ id: "cake", label: "1 cake", labelEl: "1 γκοφρέτα", amount: 9 }], defaultServing: "cake" },
  { key: "potato-raw", name: "Potato, raw", nameEl: "Πατάτα, ωμή", kcal: 77, p: 2, c: 17.5, f: 0.1, fiber: 2.2 },
  { key: "potato-boiled", name: "Potato, boiled", nameEl: "Πατάτα, βραστή", kcal: 87, p: 1.9, c: 20.1, f: 0.1, fiber: 1.8 },
  { key: "sweet-potato-baked", name: "Sweet potato, baked", nameEl: "Γλυκοπατάτα, ψητή", kcal: 90, p: 2, c: 20.7, f: 0.2, fiber: 3.3 },
  { key: "quinoa-cooked", name: "Quinoa, cooked", nameEl: "Κινόα, βρασμένη", kcal: 120, p: 4.4, c: 21.3, f: 1.9, fiber: 2.8 },
  { key: "couscous-cooked", name: "Couscous, cooked", nameEl: "Κουσκούς, βρασμένο", kcal: 112, p: 3.8, c: 23.2, f: 0.2, fiber: 1.4 },
  { key: "bulgur-cooked", name: "Bulgur, cooked", nameEl: "Πλιγούρι, βρασμένο", kcal: 83, p: 3.1, c: 18.6, f: 0.2, fiber: 4.5 },

  // Fruit
  { key: "banana", name: "Banana", nameEl: "Μπανάνα", kcal: 89, p: 1.1, c: 22.8, f: 0.3, fiber: 2.6, sugar: 12.2, servings: [{ id: "medium", label: "1 medium", labelEl: "1 μέτρια", amount: 118 }], defaultServing: "medium" },
  { key: "apple", name: "Apple", nameEl: "Μήλο", kcal: 52, p: 0.3, c: 13.8, f: 0.2, fiber: 2.4, sugar: 10.4, servings: [{ id: "medium", label: "1 medium", labelEl: "1 μέτριο", amount: 182 }], defaultServing: "medium" },
  { key: "orange", name: "Orange", nameEl: "Πορτοκάλι", kcal: 47, p: 0.9, c: 11.8, f: 0.1, fiber: 2.4, sugar: 9.4, servings: [{ id: "medium", label: "1 medium", labelEl: "1 μέτριο", amount: 131 }], defaultServing: "medium" },
  { key: "strawberries", name: "Strawberries", nameEl: "Φράουλες", kcal: 32, p: 0.7, c: 7.7, f: 0.3, fiber: 2, sugar: 4.9 },
  { key: "blueberries", name: "Blueberries", nameEl: "Μύρτιλα", kcal: 57, p: 0.7, c: 14.5, f: 0.3, fiber: 2.4, sugar: 10 },
  { key: "grapes", name: "Grapes", nameEl: "Σταφύλια", kcal: 69, p: 0.7, c: 18.1, f: 0.2, fiber: 0.9, sugar: 15.5 },
  { key: "watermelon", name: "Watermelon", nameEl: "Καρπούζι", kcal: 30, p: 0.6, c: 7.6, f: 0.2, fiber: 0.4, sugar: 6.2 },
  { key: "peach", name: "Peach", nameEl: "Ροδάκινο", kcal: 39, p: 0.9, c: 9.5, f: 0.3, fiber: 1.5, sugar: 8.4, servings: [{ id: "medium", label: "1 medium", labelEl: "1 μέτριο", amount: 150 }] },
  { key: "pear", name: "Pear", nameEl: "Αχλάδι", kcal: 57, p: 0.4, c: 15.2, f: 0.1, fiber: 3.1, sugar: 9.8, servings: [{ id: "medium", label: "1 medium", labelEl: "1 μέτριο", amount: 178 }] },
  { key: "kiwi", name: "Kiwi", nameEl: "Ακτινίδιο", kcal: 61, p: 1.1, c: 14.7, f: 0.5, fiber: 3, sugar: 9, servings: [{ id: "piece", label: "1 kiwi", labelEl: "1 ακτινίδιο", amount: 75 }] },
  { key: "dates", name: "Dates (Medjool)", nameEl: "Χουρμάδες (Medjool)", kcal: 277, p: 1.8, c: 75, f: 0.2, fiber: 6.7, sugar: 66.5, servings: [{ id: "piece", label: "1 date", labelEl: "1 χουρμάς", amount: 24 }] },
  { key: "raisins", name: "Raisins", nameEl: "Σταφίδες", kcal: 299, p: 3.1, c: 79.2, f: 0.5, fiber: 3.7, sugar: 59.2 },
  { key: "dried-figs", name: "Dried figs", nameEl: "Ξερά σύκα", kcal: 249, p: 3.3, c: 63.9, f: 0.9, fiber: 9.8, sugar: 47.9 },
  { key: "avocado", name: "Avocado", nameEl: "Αβοκάντο", kcal: 160, p: 2, c: 8.5, f: 14.7, fiber: 6.7, sugar: 0.7 },

  // Vegetables
  { key: "broccoli", name: "Broccoli", nameEl: "Μπρόκολο", kcal: 34, p: 2.8, c: 6.6, f: 0.4, fiber: 2.6 },
  { key: "spinach", name: "Spinach", nameEl: "Σπανάκι", kcal: 23, p: 2.9, c: 3.6, f: 0.4, fiber: 2.2 },
  { key: "tomato", name: "Tomato", nameEl: "Ντομάτα", kcal: 18, p: 0.9, c: 3.9, f: 0.2, fiber: 1.2, servings: [{ id: "medium", label: "1 medium", labelEl: "1 μέτρια", amount: 123 }] },
  { key: "cucumber", name: "Cucumber", nameEl: "Αγγούρι", kcal: 15, p: 0.7, c: 3.6, f: 0.1, fiber: 0.5 },
  { key: "lettuce", name: "Lettuce (romaine)", nameEl: "Μαρούλι", kcal: 17, p: 1.2, c: 3.3, f: 0.3, fiber: 2.1 },
  { key: "bell-pepper", name: "Bell pepper", nameEl: "Πιπεριά", kcal: 31, p: 1, c: 6, f: 0.3, fiber: 2.1 },
  { key: "onion", name: "Onion", nameEl: "Κρεμμύδι", kcal: 40, p: 1.1, c: 9.3, f: 0.1, fiber: 1.7 },
  { key: "carrot", name: "Carrot", nameEl: "Καρότο", kcal: 41, p: 0.9, c: 9.6, f: 0.2, fiber: 2.8 },
  { key: "zucchini", name: "Zucchini", nameEl: "Κολοκυθάκι", kcal: 17, p: 1.2, c: 3.1, f: 0.3, fiber: 1 },
  { key: "mushrooms", name: "Mushrooms", nameEl: "Μανιτάρια", kcal: 22, p: 3.1, c: 3.3, f: 0.3, fiber: 1 },
  { key: "green-beans", name: "Green beans", nameEl: "Φασολάκια", kcal: 31, p: 1.8, c: 7, f: 0.2, fiber: 2.7 },
  { key: "cauliflower", name: "Cauliflower", nameEl: "Κουνουπίδι", kcal: 25, p: 1.9, c: 5, f: 0.3, fiber: 2 },
  { key: "eggplant", name: "Eggplant", nameEl: "Μελιτζάνα", kcal: 25, p: 1, c: 5.9, f: 0.2, fiber: 3 },
  { key: "kalamata-olives", name: "Kalamata olives", nameEl: "Ελιές Καλαμών", kcal: 239, p: 1.6, c: 6.1, f: 23.6, fiber: 3.2, servings: [{ id: "piece", label: "1 olive", labelEl: "1 ελιά", amount: 5 }] },

  // Fats, nuts & seeds
  { key: "olive-oil", name: "Olive oil", nameEl: "Ελαιόλαδο", kcal: 884, p: 0, c: 0, f: 100, servings: [{ id: "tbsp", label: "1 tbsp", labelEl: "1 κουταλιά σούπας", amount: 13.5 }, { id: "tsp", label: "1 tsp", labelEl: "1 κουταλάκι", amount: 4.5 }], defaultServing: "tbsp" },
  { key: "butter", name: "Butter", nameEl: "Βούτυρο", kcal: 717, p: 0.9, c: 0.1, f: 81.1, servings: [{ id: "tbsp", label: "1 tbsp", labelEl: "1 κουταλιά σούπας", amount: 14 }] },
  { key: "peanut-butter", name: "Peanut butter", nameEl: "Φυστικοβούτυρο", kcal: 588, p: 25, c: 20, f: 50, fiber: 6, sugar: 9, servings: [{ id: "tbsp", label: "1 tbsp", labelEl: "1 κουταλιά σούπας", amount: 16 }], defaultServing: "tbsp" },
  { key: "tahini", name: "Tahini", nameEl: "Ταχίνι", kcal: 595, p: 17, c: 21.2, f: 53.8, fiber: 9.3, servings: [{ id: "tbsp", label: "1 tbsp", labelEl: "1 κουταλιά σούπας", amount: 15 }] },
  { key: "almonds", name: "Almonds", nameEl: "Αμύγδαλα", kcal: 579, p: 21.2, c: 21.6, f: 49.9, fiber: 12.5, servings: [{ id: "handful", label: "1 handful (28 g)", labelEl: "1 χούφτα (28 g)", amount: 28 }] },
  { key: "walnuts", name: "Walnuts", nameEl: "Καρύδια", kcal: 654, p: 15.2, c: 13.7, f: 65.2, fiber: 6.7, servings: [{ id: "handful", label: "1 handful (28 g)", labelEl: "1 χούφτα (28 g)", amount: 28 }] },
  { key: "cashews", name: "Cashews", nameEl: "Κάσιους", kcal: 553, p: 18.2, c: 30.2, f: 43.9, fiber: 3.3 },
  { key: "pistachios", name: "Pistachios", nameEl: "Φιστίκια Αιγίνης", kcal: 560, p: 20.2, c: 27.2, f: 45.3, fiber: 10.6 },
  { key: "peanuts", name: "Peanuts", nameEl: "Αράπικα φιστίκια", kcal: 567, p: 25.8, c: 16.1, f: 49.2, fiber: 8.5 },
  { key: "chia-seeds", name: "Chia seeds", nameEl: "Σπόροι chia", kcal: 486, p: 16.5, c: 42.1, f: 30.7, fiber: 34.4, servings: [{ id: "tbsp", label: "1 tbsp", labelEl: "1 κουταλιά σούπας", amount: 12 }] },
  { key: "dark-chocolate", name: "Dark chocolate 70–85%", nameEl: "Μαύρη σοκολάτα 70–85%", kcal: 598, p: 7.8, c: 45.9, f: 42.6, fiber: 10.9, sugar: 24, servings: [{ id: "square", label: "1 square (10 g)", labelEl: "1 κομμάτι (10 g)", amount: 10 }] },

  // Greek dishes & meals
  { key: "pita-gyros", name: "Pita gyros (complete wrap)", nameEl: "Πίτα γύρος (πλήρης)", kcal: 230, p: 10, c: 25, f: 10, fiber: 2, servings: [{ id: "wrap", label: "1 wrap", labelEl: "1 τυλιχτό", amount: 280 }], defaultServing: "wrap" },
  { key: "tzatziki", name: "Tzatziki", nameEl: "Τζατζίκι", kcal: 100, p: 4, c: 4, f: 8, servings: [{ id: "tbsp", label: "1 tbsp", labelEl: "1 κουταλιά σούπας", amount: 20 }] },
  { key: "greek-salad", name: "Greek salad (with feta & olive oil)", nameEl: "Χωριάτικη σαλάτα", kcal: 120, p: 3, c: 4, f: 10.5, fiber: 1.3, servings: [{ id: "plate", label: "1 plate (300 g)", labelEl: "1 πιάτο (300 g)", amount: 300 }] },
  { key: "spanakopita", name: "Spanakopita", nameEl: "Σπανακόπιτα", kcal: 280, p: 8, c: 25, f: 17, fiber: 2.5, servings: [{ id: "piece", label: "1 piece", labelEl: "1 κομμάτι", amount: 150 }] },
  { key: "moussaka", name: "Moussaka", nameEl: "Μουσακάς", kcal: 155, p: 7.5, c: 9, f: 10, fiber: 2, servings: [{ id: "portion", label: "1 portion", labelEl: "1 μερίδα", amount: 350 }] },
  { key: "pastitsio", name: "Pastitsio", nameEl: "Παστίτσιο", kcal: 180, p: 9, c: 16, f: 9, fiber: 1, servings: [{ id: "portion", label: "1 portion", labelEl: "1 μερίδα", amount: 350 }] },
  { key: "gemista", name: "Gemista (stuffed vegetables)", nameEl: "Γεμιστά", kcal: 110, p: 2, c: 15, f: 5, fiber: 2.2, servings: [{ id: "portion", label: "1 portion", labelEl: "1 μερίδα", amount: 350 }] },
  { key: "pizza-margherita", name: "Pizza margherita", nameEl: "Πίτσα μαργαρίτα", kcal: 266, p: 11.4, c: 33, f: 10.4, fiber: 2.3, servings: [{ id: "slice", label: "1 slice", labelEl: "1 κομμάτι", amount: 107 }] },

  // Sweets, snacks & condiments
  { key: "honey", name: "Honey", nameEl: "Μέλι", kcal: 304, p: 0.3, c: 82.4, f: 0, sugar: 82.1, servings: [{ id: "tbsp", label: "1 tbsp", labelEl: "1 κουταλιά σούπας", amount: 21 }, { id: "tsp", label: "1 tsp", labelEl: "1 κουταλάκι", amount: 7 }] },
  { key: "sugar", name: "Sugar", nameEl: "Ζάχαρη", kcal: 387, p: 0, c: 100, f: 0, sugar: 100, servings: [{ id: "tsp", label: "1 tsp", labelEl: "1 κουταλάκι", amount: 4 }] },
  { key: "jam", name: "Jam", nameEl: "Μαρμελάδα", kcal: 278, p: 0.4, c: 68.9, f: 0.1, sugar: 48.5, servings: [{ id: "tbsp", label: "1 tbsp", labelEl: "1 κουταλιά σούπας", amount: 20 }] },
  { key: "ketchup", name: "Ketchup", nameEl: "Κέτσαπ", kcal: 101, p: 1, c: 27.4, f: 0.1, sugar: 22.8, servings: [{ id: "tbsp", label: "1 tbsp", labelEl: "1 κουταλιά σούπας", amount: 17 }] },
  { key: "mayonnaise", name: "Mayonnaise", nameEl: "Μαγιονέζα", kcal: 680, p: 1, c: 0.6, f: 75, servings: [{ id: "tbsp", label: "1 tbsp", labelEl: "1 κουταλιά σούπας", amount: 14 }] },
  { key: "popcorn", name: "Popcorn, air-popped", nameEl: "Ποπ κορν (χωρίς λάδι)", kcal: 387, p: 12.9, c: 77.8, f: 4.5, fiber: 14.5 },
  { key: "potato-chips", name: "Potato chips", nameEl: "Πατατάκια", kcal: 536, p: 7, c: 52.9, f: 34.6, fiber: 4.8 },
  { key: "ice-cream-vanilla", name: "Ice cream, vanilla", nameEl: "Παγωτό βανίλια", kcal: 207, p: 3.5, c: 23.6, f: 11, sugar: 21.2, servings: [{ id: "scoop", label: "1 scoop", labelEl: "1 μπάλα", amount: 66 }] },

  // Drinks
  { key: "orange-juice", name: "Orange juice", nameEl: "Χυμός πορτοκάλι", unit: "ml", kcal: 45, p: 0.7, c: 10.4, f: 0.2, fiber: 0.2, sugar: 8.4, servings: [{ id: "glass", label: "1 glass (250 ml)", labelEl: "1 ποτήρι (250 ml)", amount: 250 }] },
  { key: "cola", name: "Cola", nameEl: "Αναψυκτικό τύπου cola", unit: "ml", kcal: 42, p: 0, c: 10.6, f: 0, sugar: 10.6, servings: [{ id: "can", label: "1 can (330 ml)", labelEl: "1 κουτάκι (330 ml)", amount: 330 }] },
  { key: "cola-zero", name: "Cola zero", nameEl: "Cola χωρίς ζάχαρη", unit: "ml", kcal: 0.3, p: 0, c: 0, f: 0, servings: [{ id: "can", label: "1 can (330 ml)", labelEl: "1 κουτάκι (330 ml)", amount: 330 }] },
  { key: "beer", name: "Beer, regular", nameEl: "Μπύρα", unit: "ml", kcal: 43, p: 0.5, c: 3.6, f: 0, servings: [{ id: "bottle", label: "1 bottle (330 ml)", labelEl: "1 μπουκάλι (330 ml)", amount: 330 }, { id: "pint", label: "1 pint (500 ml)", labelEl: "1 ποτήρι (500 ml)", amount: 500 }] },
  { key: "red-wine", name: "Red wine", nameEl: "Κρασί κόκκινο", unit: "ml", kcal: 85, p: 0.1, c: 2.6, f: 0, servings: [{ id: "glass", label: "1 glass (150 ml)", labelEl: "1 ποτήρι (150 ml)", amount: 150 }] },
  { key: "coffee-black", name: "Coffee, black (espresso / filter)", nameEl: "Καφές σκέτος (espresso / φίλτρου)", unit: "ml", kcal: 2, p: 0.1, c: 0, f: 0, servings: [{ id: "cup", label: "1 cup", labelEl: "1 φλιτζάνι", amount: 200 }] },
];
