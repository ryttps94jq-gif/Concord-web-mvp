/**
 * Domain Vocabularies — word sets that quality gate uses for signal checks.
 *
 * These don't need to be exhaustive — they catch obvious garbage.
 * An entity producing a meal plan with "quantum" as an ingredient fails.
 * An entity producing a meal plan with "jicama" (not in list) passes because
 * the vocabulary check is severity: "info", not "critical".
 */

import { registerVocabulary } from "./quality-gate.js";

// ── Food ────────────────────────────────────────────────────────────────────

registerVocabulary("food_items", [
  // Proteins
  "chicken", "beef", "pork", "turkey", "salmon", "tuna", "shrimp", "cod", "tilapia",
  "tofu", "tempeh", "seitan", "eggs", "egg whites", "lamb", "duck", "steak",
  // Dairy
  "milk", "cheese", "yogurt", "butter", "cream", "cream cheese", "mozzarella",
  "parmesan", "cheddar", "feta", "ricotta", "greek yogurt",
  // Grains
  "rice", "pasta", "bread", "oats", "quinoa", "barley", "couscous", "tortilla",
  "flour", "cornmeal", "brown rice", "wild rice", "whole wheat",
  // Vegetables
  "broccoli", "spinach", "kale", "lettuce", "tomato", "onion", "garlic", "pepper",
  "carrot", "potato", "sweet potato", "corn", "peas", "green beans", "zucchini",
  "cucumber", "celery", "mushroom", "avocado", "cauliflower", "asparagus", "eggplant",
  "bell pepper", "jalapeno", "beet", "radish", "artichoke", "cabbage", "bok choy",
  // Fruits
  "apple", "banana", "orange", "strawberry", "blueberry", "raspberry", "mango",
  "pineapple", "grape", "lemon", "lime", "watermelon", "peach", "cherry", "pear",
  "kiwi", "coconut", "pomegranate", "fig", "date",
  // Pantry
  "olive oil", "coconut oil", "soy sauce", "vinegar", "honey", "maple syrup",
  "salt", "pepper", "cumin", "paprika", "oregano", "basil", "thyme", "cinnamon",
  "ginger", "turmeric", "chili powder", "garlic powder", "onion powder",
  "baking powder", "baking soda", "vanilla", "cocoa powder",
  // Nuts & Seeds
  "almond", "walnut", "peanut", "cashew", "pecan", "pistachio",
  "chia seeds", "flax seeds", "sunflower seeds", "pumpkin seeds", "sesame",
  // Common
  "water", "broth", "stock", "sugar", "brown sugar",
]);

// ── Exercises ───────────────────────────────────────────────────────────────

registerVocabulary("exercises", [
  // Compound
  "squat", "back squat", "front squat", "goblet squat", "deadlift", "romanian deadlift",
  "bench press", "incline bench press", "overhead press", "military press",
  "barbell row", "bent over row", "pull-up", "chin-up", "dip",
  "clean", "snatch", "clean and jerk", "thruster", "sumo deadlift",
  // Isolation
  "bicep curl", "hammer curl", "tricep extension", "tricep pushdown",
  "lateral raise", "front raise", "rear delt fly", "face pull",
  "leg extension", "leg curl", "calf raise", "hip thrust",
  "preacher curl", "concentration curl", "skull crusher",
  // Bodyweight
  "push-up", "plank", "side plank", "lunge", "walking lunge", "step-up",
  "burpee", "mountain climber", "sit-up", "crunch", "russian twist",
  "pike push-up", "diamond push-up", "bodyweight squat", "glute bridge",
  // Machines
  "leg press", "chest press", "lat pulldown", "cable row", "cable fly",
  "smith machine squat", "hack squat", "pec deck",
  // Cardio
  "running", "jogging", "cycling", "swimming", "rowing", "jump rope",
  "elliptical", "stair climber", "sprinting", "walking",
  // Flexibility
  "stretch", "foam roll", "yoga", "mobility drill",
]);

// ── Medical Conditions ──────────────────────────────────────────────────────

registerVocabulary("medical_conditions", [
  "diabetes", "type 1 diabetes", "type 2 diabetes", "hypertension",
  "asthma", "copd", "arthritis", "osteoarthritis", "rheumatoid arthritis",
  "depression", "anxiety", "heart disease", "stroke", "cancer",
  "chronic pain", "fibromyalgia", "migraine", "obesity",
  "hypothyroidism", "hyperthyroidism", "anemia", "celiac disease",
  "crohn's disease", "ulcerative colitis", "ibs", "gerd",
  "osteoporosis", "eczema", "psoriasis", "sleep apnea",
  "adhd", "ptsd", "bipolar disorder", "schizophrenia",
  "kidney disease", "liver disease", "hepatitis", "hiv",
  "pneumonia", "bronchitis", "sinusitis", "allergies",
]);
