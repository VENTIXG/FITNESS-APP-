import type { Equipment, ExerciseCategory, MuscleGroup, TrackingType } from "@/lib/domain";

export type BuiltinExercise = {
  key: string;
  name: string;
  nameEl: string;
  muscle: MuscleGroup;
  secondary?: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  tracking?: TrackingType;
};

const c = "compound" as const;
const i = "isolation" as const;

/**
 * Built-in exercise catalog. Keys are permanent identifiers (used to derive stable
 * UUIDs) — never rename a key; add a new entry instead.
 */
export const BUILTIN_EXERCISES: BuiltinExercise[] = [
  // Chest
  { key: "barbell-bench-press", name: "Bench Press (Barbell)", nameEl: "Πιέσεις πάγκου (μπάρα)", muscle: "chest", secondary: ["triceps", "shoulders"], equipment: "barbell", category: c },
  { key: "incline-barbell-bench-press", name: "Incline Bench Press (Barbell)", nameEl: "Πιέσεις επικλινούς πάγκου (μπάρα)", muscle: "chest", secondary: ["shoulders", "triceps"], equipment: "barbell", category: c },
  { key: "decline-barbell-bench-press", name: "Decline Bench Press (Barbell)", nameEl: "Πιέσεις αρνητικού πάγκου (μπάρα)", muscle: "chest", secondary: ["triceps"], equipment: "barbell", category: c },
  { key: "dumbbell-bench-press", name: "Bench Press (Dumbbell)", nameEl: "Πιέσεις πάγκου (αλτήρες)", muscle: "chest", secondary: ["triceps", "shoulders"], equipment: "dumbbell", category: c },
  { key: "incline-dumbbell-bench-press", name: "Incline Bench Press (Dumbbell)", nameEl: "Πιέσεις επικλινούς πάγκου (αλτήρες)", muscle: "chest", secondary: ["shoulders", "triceps"], equipment: "dumbbell", category: c },
  { key: "smith-bench-press", name: "Bench Press (Smith Machine)", nameEl: "Πιέσεις πάγκου (Smith)", muscle: "chest", secondary: ["triceps"], equipment: "smith_machine", category: c },
  { key: "smith-incline-bench-press", name: "Incline Bench Press (Smith Machine)", nameEl: "Πιέσεις επικλινούς πάγκου (Smith)", muscle: "chest", secondary: ["shoulders", "triceps"], equipment: "smith_machine", category: c },
  { key: "machine-chest-press", name: "Chest Press (Machine)", nameEl: "Πιέσεις στήθους (μηχάνημα)", muscle: "chest", secondary: ["triceps"], equipment: "machine", category: c },
  { key: "incline-machine-chest-press", name: "Incline Chest Press (Machine)", nameEl: "Επικλινείς πιέσεις στήθους (μηχάνημα)", muscle: "chest", secondary: ["shoulders"], equipment: "machine", category: c },
  { key: "dumbbell-fly", name: "Chest Fly (Dumbbell)", nameEl: "Ανοίγματα στήθους (αλτήρες)", muscle: "chest", equipment: "dumbbell", category: i },
  { key: "cable-fly", name: "Cable Fly", nameEl: "Ανοίγματα στήθους (τροχαλία)", muscle: "chest", equipment: "cable", category: i },
  { key: "low-to-high-cable-fly", name: "Low-to-High Cable Fly", nameEl: "Ανοίγματα τροχαλίας από χαμηλά", muscle: "chest", equipment: "cable", category: i },
  { key: "pec-deck", name: "Pec Deck (Machine)", nameEl: "Πεταλούδα (μηχάνημα)", muscle: "chest", equipment: "machine", category: i },
  { key: "push-up", name: "Push-up", nameEl: "Κάμψεις", muscle: "chest", secondary: ["triceps", "shoulders"], equipment: "bodyweight", category: c, tracking: "bodyweight_reps" },
  { key: "chest-dip", name: "Chest Dip", nameEl: "Βυθίσεις στήθους", muscle: "chest", secondary: ["triceps"], equipment: "bodyweight", category: c, tracking: "bodyweight_reps" },

  // Back
  { key: "deadlift", name: "Deadlift (Barbell)", nameEl: "Άρσεις θανάτου (μπάρα)", muscle: "back", secondary: ["hamstrings", "glutes", "forearms"], equipment: "barbell", category: c },
  { key: "barbell-row", name: "Bent-over Row (Barbell)", nameEl: "Κωπηλατική με μπάρα", muscle: "back", secondary: ["biceps"], equipment: "barbell", category: c },
  { key: "pendlay-row", name: "Pendlay Row (Barbell)", nameEl: "Κωπηλατική Pendlay", muscle: "back", secondary: ["biceps"], equipment: "barbell", category: c },
  { key: "t-bar-row", name: "T-Bar Row", nameEl: "Κωπηλατική T-bar", muscle: "back", secondary: ["biceps"], equipment: "barbell", category: c },
  { key: "dumbbell-row", name: "One-arm Row (Dumbbell)", nameEl: "Κωπηλατική με αλτήρα", muscle: "back", secondary: ["biceps"], equipment: "dumbbell", category: c },
  { key: "chest-supported-row", name: "Chest-supported Row (Dumbbell)", nameEl: "Κωπηλατική με στήριξη στήθους", muscle: "back", secondary: ["biceps"], equipment: "dumbbell", category: c },
  { key: "seated-cable-row", name: "Seated Cable Row", nameEl: "Κωπηλατική καθιστή (τροχαλία)", muscle: "back", secondary: ["biceps"], equipment: "cable", category: c },
  { key: "machine-row", name: "Seated Row (Machine)", nameEl: "Κωπηλατική (μηχάνημα)", muscle: "back", secondary: ["biceps"], equipment: "machine", category: c },
  { key: "lat-pulldown", name: "Lat Pulldown (Cable)", nameEl: "Έλξεις τροχαλίας", muscle: "back", secondary: ["biceps"], equipment: "cable", category: c },
  { key: "close-grip-lat-pulldown", name: "Close-grip Lat Pulldown", nameEl: "Έλξεις τροχαλίας κλειστή λαβή", muscle: "back", secondary: ["biceps"], equipment: "cable", category: c },
  { key: "pull-up", name: "Pull-up", nameEl: "Έλξεις μονόζυγου", muscle: "back", secondary: ["biceps"], equipment: "bodyweight", category: c, tracking: "bodyweight_reps" },
  { key: "chin-up", name: "Chin-up", nameEl: "Έλξεις με ανάποδη λαβή", muscle: "back", secondary: ["biceps"], equipment: "bodyweight", category: c, tracking: "bodyweight_reps" },
  { key: "straight-arm-pulldown", name: "Straight-arm Pulldown (Cable)", nameEl: "Pullover τροχαλίας με τεντωμένα χέρια", muscle: "back", equipment: "cable", category: i },
  { key: "rack-pull", name: "Rack Pull (Barbell)", nameEl: "Rack pull (μπάρα)", muscle: "back", secondary: ["glutes", "forearms"], equipment: "barbell", category: c },
  { key: "back-extension", name: "Back Extension", nameEl: "Εκτάσεις ραχιαίων", muscle: "back", secondary: ["glutes", "hamstrings"], equipment: "bodyweight", category: i, tracking: "bodyweight_reps" },
  { key: "barbell-shrug", name: "Shrug (Barbell)", nameEl: "Ανασηκώσεις ώμων (μπάρα)", muscle: "back", secondary: ["forearms"], equipment: "barbell", category: i },
  { key: "dumbbell-shrug", name: "Shrug (Dumbbell)", nameEl: "Ανασηκώσεις ώμων (αλτήρες)", muscle: "back", secondary: ["forearms"], equipment: "dumbbell", category: i },

  // Shoulders
  { key: "overhead-press", name: "Overhead Press (Barbell)", nameEl: "Πιέσεις ώμων όρθιος (μπάρα)", muscle: "shoulders", secondary: ["triceps"], equipment: "barbell", category: c },
  { key: "seated-dumbbell-press", name: "Shoulder Press (Dumbbell)", nameEl: "Πιέσεις ώμων (αλτήρες)", muscle: "shoulders", secondary: ["triceps"], equipment: "dumbbell", category: c },
  { key: "machine-shoulder-press", name: "Shoulder Press (Machine)", nameEl: "Πιέσεις ώμων (μηχάνημα)", muscle: "shoulders", secondary: ["triceps"], equipment: "machine", category: c },
  { key: "smith-shoulder-press", name: "Shoulder Press (Smith Machine)", nameEl: "Πιέσεις ώμων (Smith)", muscle: "shoulders", secondary: ["triceps"], equipment: "smith_machine", category: c },
  { key: "arnold-press", name: "Arnold Press (Dumbbell)", nameEl: "Πιέσεις Arnold", muscle: "shoulders", secondary: ["triceps"], equipment: "dumbbell", category: c },
  { key: "lateral-raise", name: "Lateral Raise (Dumbbell)", nameEl: "Πλάγιες εκτάσεις (αλτήρες)", muscle: "shoulders", equipment: "dumbbell", category: i },
  { key: "cable-lateral-raise", name: "Lateral Raise (Cable)", nameEl: "Πλάγιες εκτάσεις (τροχαλία)", muscle: "shoulders", equipment: "cable", category: i },
  { key: "machine-lateral-raise", name: "Lateral Raise (Machine)", nameEl: "Πλάγιες εκτάσεις (μηχάνημα)", muscle: "shoulders", equipment: "machine", category: i },
  { key: "front-raise", name: "Front Raise (Dumbbell)", nameEl: "Εμπρός εκτάσεις (αλτήρες)", muscle: "shoulders", equipment: "dumbbell", category: i },
  { key: "rear-delt-fly", name: "Rear Delt Fly (Dumbbell)", nameEl: "Ανοίγματα οπίσθιων ώμων (αλτήρες)", muscle: "shoulders", secondary: ["back"], equipment: "dumbbell", category: i },
  { key: "reverse-pec-deck", name: "Reverse Fly (Machine)", nameEl: "Ανάποδη πεταλούδα (μηχάνημα)", muscle: "shoulders", secondary: ["back"], equipment: "machine", category: i },
  { key: "face-pull", name: "Face Pull (Cable)", nameEl: "Face pull (τροχαλία)", muscle: "shoulders", secondary: ["back"], equipment: "cable", category: i },
  { key: "upright-row", name: "Upright Row (Barbell)", nameEl: "Όρθια κωπηλατική (μπάρα)", muscle: "shoulders", secondary: ["back"], equipment: "barbell", category: c },

  // Biceps
  { key: "barbell-curl", name: "Bicep Curl (Barbell)", nameEl: "Κάμψεις δικεφάλων (μπάρα)", muscle: "biceps", secondary: ["forearms"], equipment: "barbell", category: i },
  { key: "ez-bar-curl", name: "EZ-Bar Curl", nameEl: "Κάμψεις δικεφάλων (EZ μπάρα)", muscle: "biceps", secondary: ["forearms"], equipment: "barbell", category: i },
  { key: "dumbbell-curl", name: "Bicep Curl (Dumbbell)", nameEl: "Κάμψεις δικεφάλων (αλτήρες)", muscle: "biceps", secondary: ["forearms"], equipment: "dumbbell", category: i },
  { key: "hammer-curl", name: "Hammer Curl (Dumbbell)", nameEl: "Σφυριά (αλτήρες)", muscle: "biceps", secondary: ["forearms"], equipment: "dumbbell", category: i },
  { key: "incline-dumbbell-curl", name: "Incline Curl (Dumbbell)", nameEl: "Κάμψεις δικεφάλων σε επικλινή πάγκο", muscle: "biceps", equipment: "dumbbell", category: i },
  { key: "preacher-curl", name: "Preacher Curl (Machine)", nameEl: "Κάμψεις στον πάγκο Scott (μηχάνημα)", muscle: "biceps", equipment: "machine", category: i },
  { key: "cable-curl", name: "Bicep Curl (Cable)", nameEl: "Κάμψεις δικεφάλων (τροχαλία)", muscle: "biceps", equipment: "cable", category: i },
  { key: "concentration-curl", name: "Concentration Curl (Dumbbell)", nameEl: "Κάμψεις συγκέντρωσης", muscle: "biceps", equipment: "dumbbell", category: i },

  // Triceps
  { key: "triceps-pushdown", name: "Triceps Pushdown (Cable)", nameEl: "Εκτάσεις τρικεφάλων τροχαλίας", muscle: "triceps", equipment: "cable", category: i },
  { key: "rope-pushdown", name: "Rope Pushdown (Cable)", nameEl: "Εκτάσεις τρικεφάλων με σχοινί", muscle: "triceps", equipment: "cable", category: i },
  { key: "overhead-cable-extension", name: "Overhead Triceps Extension (Cable)", nameEl: "Εκτάσεις τρικεφάλων πάνω από το κεφάλι (τροχαλία)", muscle: "triceps", equipment: "cable", category: i },
  { key: "dumbbell-overhead-extension", name: "Overhead Triceps Extension (Dumbbell)", nameEl: "Εκτάσεις τρικεφάλων πάνω από το κεφάλι (αλτήρας)", muscle: "triceps", equipment: "dumbbell", category: i },
  { key: "skull-crusher", name: "Skull Crusher (EZ-Bar)", nameEl: "Μετωπιαίες εκτάσεις (EZ μπάρα)", muscle: "triceps", equipment: "barbell", category: i },
  { key: "close-grip-bench-press", name: "Close-grip Bench Press (Barbell)", nameEl: "Πιέσεις πάγκου κλειστή λαβή", muscle: "triceps", secondary: ["chest", "shoulders"], equipment: "barbell", category: c },
  { key: "triceps-dip", name: "Triceps Dip", nameEl: "Βυθίσεις τρικεφάλων", muscle: "triceps", secondary: ["chest", "shoulders"], equipment: "bodyweight", category: c, tracking: "bodyweight_reps" },
  { key: "machine-dip", name: "Seated Dip (Machine)", nameEl: "Βυθίσεις (μηχάνημα)", muscle: "triceps", secondary: ["chest"], equipment: "machine", category: c },

  // Quads
  { key: "back-squat", name: "Squat (Barbell)", nameEl: "Καθίσματα (μπάρα)", muscle: "quads", secondary: ["glutes", "hamstrings"], equipment: "barbell", category: c },
  { key: "front-squat", name: "Front Squat (Barbell)", nameEl: "Μπροστινά καθίσματα (μπάρα)", muscle: "quads", secondary: ["glutes", "abs"], equipment: "barbell", category: c },
  { key: "smith-squat", name: "Squat (Smith Machine)", nameEl: "Καθίσματα (Smith)", muscle: "quads", secondary: ["glutes"], equipment: "smith_machine", category: c },
  { key: "hack-squat", name: "Hack Squat (Machine)", nameEl: "Hack squat (μηχάνημα)", muscle: "quads", secondary: ["glutes"], equipment: "machine", category: c },
  { key: "leg-press", name: "Leg Press (Machine)", nameEl: "Πιέσεις ποδιών (πρέσα)", muscle: "quads", secondary: ["glutes", "hamstrings"], equipment: "machine", category: c },
  { key: "goblet-squat", name: "Goblet Squat (Dumbbell)", nameEl: "Goblet squat (αλτήρας)", muscle: "quads", secondary: ["glutes"], equipment: "dumbbell", category: c },
  { key: "bulgarian-split-squat", name: "Bulgarian Split Squat (Dumbbell)", nameEl: "Βουλγαρικά καθίσματα (αλτήρες)", muscle: "quads", secondary: ["glutes"], equipment: "dumbbell", category: c },
  { key: "walking-lunge", name: "Walking Lunge (Dumbbell)", nameEl: "Προβολές με βάδισμα (αλτήρες)", muscle: "quads", secondary: ["glutes", "hamstrings"], equipment: "dumbbell", category: c },
  { key: "reverse-lunge", name: "Reverse Lunge (Dumbbell)", nameEl: "Ανάποδες προβολές (αλτήρες)", muscle: "quads", secondary: ["glutes"], equipment: "dumbbell", category: c },
  { key: "step-up", name: "Step-up (Dumbbell)", nameEl: "Ανεβάσματα σε πάγκο (αλτήρες)", muscle: "quads", secondary: ["glutes"], equipment: "dumbbell", category: c },
  { key: "leg-extension", name: "Leg Extension (Machine)", nameEl: "Εκτάσεις ποδιών (μηχάνημα)", muscle: "quads", equipment: "machine", category: i },

  // Hamstrings
  { key: "romanian-deadlift", name: "Romanian Deadlift (Barbell)", nameEl: "Ρουμανικές άρσεις (μπάρα)", muscle: "hamstrings", secondary: ["glutes", "back"], equipment: "barbell", category: c },
  { key: "dumbbell-romanian-deadlift", name: "Romanian Deadlift (Dumbbell)", nameEl: "Ρουμανικές άρσεις (αλτήρες)", muscle: "hamstrings", secondary: ["glutes", "back"], equipment: "dumbbell", category: c },
  { key: "stiff-leg-deadlift", name: "Stiff-leg Deadlift (Barbell)", nameEl: "Άρσεις με τεντωμένα πόδια", muscle: "hamstrings", secondary: ["glutes", "back"], equipment: "barbell", category: c },
  { key: "good-morning", name: "Good Morning (Barbell)", nameEl: "Good morning (μπάρα)", muscle: "hamstrings", secondary: ["back", "glutes"], equipment: "barbell", category: c },
  { key: "lying-leg-curl", name: "Lying Leg Curl (Machine)", nameEl: "Κάμψεις ποδιών πρηνηδόν (μηχάνημα)", muscle: "hamstrings", equipment: "machine", category: i },
  { key: "seated-leg-curl", name: "Seated Leg Curl (Machine)", nameEl: "Κάμψεις ποδιών καθιστός (μηχάνημα)", muscle: "hamstrings", equipment: "machine", category: i },
  { key: "nordic-curl", name: "Nordic Hamstring Curl", nameEl: "Nordic curl", muscle: "hamstrings", equipment: "bodyweight", category: i, tracking: "bodyweight_reps" },

  // Glutes
  { key: "hip-thrust", name: "Hip Thrust (Barbell)", nameEl: "Hip thrust (μπάρα)", muscle: "glutes", secondary: ["hamstrings"], equipment: "barbell", category: c },
  { key: "machine-hip-thrust", name: "Hip Thrust (Machine)", nameEl: "Hip thrust (μηχάνημα)", muscle: "glutes", secondary: ["hamstrings"], equipment: "machine", category: c },
  { key: "glute-bridge", name: "Glute Bridge", nameEl: "Γέφυρα γλουτών", muscle: "glutes", secondary: ["hamstrings"], equipment: "bodyweight", category: i, tracking: "bodyweight_reps" },
  { key: "sumo-deadlift", name: "Sumo Deadlift (Barbell)", nameEl: "Άρσεις θανάτου σούμο", muscle: "glutes", secondary: ["quads", "back", "hamstrings"], equipment: "barbell", category: c },
  { key: "cable-kickback", name: "Glute Kickback (Cable)", nameEl: "Λακτίσματα γλουτών (τροχαλία)", muscle: "glutes", equipment: "cable", category: i },
  { key: "hip-abduction", name: "Hip Abduction (Machine)", nameEl: "Απαγωγοί (μηχάνημα)", muscle: "glutes", equipment: "machine", category: i },
  { key: "hip-adduction", name: "Hip Adduction (Machine)", nameEl: "Προσαγωγοί (μηχάνημα)", muscle: "other", equipment: "machine", category: i },

  // Calves
  { key: "standing-calf-raise", name: "Standing Calf Raise (Machine)", nameEl: "Γάμπες όρθιος (μηχάνημα)", muscle: "calves", equipment: "machine", category: i },
  { key: "seated-calf-raise", name: "Seated Calf Raise (Machine)", nameEl: "Γάμπες καθιστός (μηχάνημα)", muscle: "calves", equipment: "machine", category: i },
  { key: "leg-press-calf-raise", name: "Calf Press (Leg Press)", nameEl: "Γάμπες στην πρέσα", muscle: "calves", equipment: "machine", category: i },
  { key: "smith-calf-raise", name: "Calf Raise (Smith Machine)", nameEl: "Γάμπες (Smith)", muscle: "calves", equipment: "smith_machine", category: i },

  // Abs
  { key: "crunch", name: "Crunch", nameEl: "Κοιλιακοί (crunch)", muscle: "abs", equipment: "bodyweight", category: i, tracking: "bodyweight_reps" },
  { key: "cable-crunch", name: "Cable Crunch", nameEl: "Κοιλιακοί τροχαλίας", muscle: "abs", equipment: "cable", category: i },
  { key: "hanging-leg-raise", name: "Hanging Leg Raise", nameEl: "Ανυψώσεις ποδιών σε κρέμαση", muscle: "abs", equipment: "bodyweight", category: i, tracking: "bodyweight_reps" },
  { key: "decline-sit-up", name: "Decline Sit-up", nameEl: "Ανακάμψεις σε αρνητικό πάγκο", muscle: "abs", equipment: "bodyweight", category: i, tracking: "bodyweight_reps" },
  { key: "ab-wheel", name: "Ab Wheel Rollout", nameEl: "Ρόδα κοιλιακών", muscle: "abs", equipment: "other", category: i, tracking: "bodyweight_reps" },
  { key: "plank", name: "Plank", nameEl: "Σανίδα", muscle: "abs", equipment: "bodyweight", category: i, tracking: "duration" },
  { key: "side-plank", name: "Side Plank", nameEl: "Πλάγια σανίδα", muscle: "abs", equipment: "bodyweight", category: i, tracking: "duration" },
  { key: "pallof-press", name: "Pallof Press (Cable)", nameEl: "Pallof press (τροχαλία)", muscle: "abs", equipment: "cable", category: i },
  { key: "russian-twist", name: "Russian Twist", nameEl: "Ρώσικες περιστροφές", muscle: "abs", equipment: "bodyweight", category: i, tracking: "bodyweight_reps" },

  // Forearms
  { key: "wrist-curl", name: "Wrist Curl (Dumbbell)", nameEl: "Κάμψεις καρπών (αλτήρες)", muscle: "forearms", equipment: "dumbbell", category: i },
  { key: "reverse-wrist-curl", name: "Reverse Wrist Curl (Dumbbell)", nameEl: "Ανάποδες κάμψεις καρπών", muscle: "forearms", equipment: "dumbbell", category: i },
  { key: "farmers-carry", name: "Farmer's Carry", nameEl: "Μεταφορά αγρότη", muscle: "forearms", secondary: ["back", "abs"], equipment: "dumbbell", category: c, tracking: "distance" },
  { key: "dead-hang", name: "Dead Hang", nameEl: "Κρέμαση από μονόζυγο", muscle: "forearms", secondary: ["back"], equipment: "bodyweight", category: i, tracking: "duration" },

  // Other / conditioning
  { key: "kettlebell-swing", name: "Kettlebell Swing", nameEl: "Αιωρήσεις kettlebell", muscle: "glutes", secondary: ["hamstrings", "back"], equipment: "other", category: c },
  { key: "sled-push", name: "Sled Push", nameEl: "Ώθηση έλκηθρου", muscle: "quads", secondary: ["glutes", "calves"], equipment: "other", category: c, tracking: "distance" },
  { key: "burpee", name: "Burpee", nameEl: "Burpees", muscle: "other", equipment: "bodyweight", category: c, tracking: "bodyweight_reps" },
  { key: "box-jump", name: "Box Jump", nameEl: "Άλματα σε κουτί", muscle: "quads", secondary: ["glutes", "calves"], equipment: "bodyweight", category: c, tracking: "bodyweight_reps" },
  { key: "battle-ropes", name: "Battle Ropes", nameEl: "Σχοινιά battle ropes", muscle: "other", secondary: ["shoulders"], equipment: "other", category: c, tracking: "duration" },
];
