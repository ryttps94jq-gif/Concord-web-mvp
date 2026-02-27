import { registerSchema } from "../artifact-schemas.js";

registerSchema("food", "generate-meal-plan", {
  required: ["title", "targetCalories", "mealsPerDay", "days"],
  properties: {
    title: { type: "string", minLength: 5 },
    targetCalories: { type: "number", min: 800, max: 8000 },
    mealsPerDay: { type: "number", min: 2, max: 8 },
    dietaryRestrictions: { type: "array", items: "string" },
    days: {
      type: "array",
      minItems: 1,
      maxItems: 30,
      items: {
        required: ["dayNumber", "meals"],
        properties: {
          dayNumber: { type: "number" },
          meals: {
            type: "array",
            minItems: 2,
            items: {
              required: ["name", "ingredients", "calories"],
              properties: {
                name: { type: "string" },
                ingredients: {
                  type: "array",
                  minItems: 2,
                  items: {
                    required: ["item", "amount"],
                    properties: {
                      item: { type: "string", vocabulary: "food_items" },
                      amount: { type: "string" },
                    },
                  },
                },
                calories: { type: "number", min: 50, max: 3000 },
                protein: { type: "number", min: 0 },
                prepTime: { type: "string" },
              },
            },
          },
          totalCalories: { type: "number" },
        },
      },
    },
  },
});

registerSchema("food", "generate-grocery-list", {
  required: ["title", "items", "estimatedTotal"],
  properties: {
    title: { type: "string" },
    items: {
      type: "array",
      minItems: 3,
      items: {
        required: ["name", "quantity", "category"],
        properties: {
          name: { type: "string", vocabulary: "food_items" },
          quantity: { type: "string" },
          category: { type: "string", enum: ["produce", "dairy", "meat", "seafood", "grains", "canned", "frozen", "snacks", "beverages", "condiments", "spices", "bakery", "other"] },
          estimatedPrice: { type: "number" },
        },
      },
    },
    estimatedTotal: { type: "number" },
  },
});

registerSchema("food", "build-meal-plan", {
  required: ["title", "days"],
  properties: {
    title: { type: "string", minLength: 5 },
    days: { type: "array", minItems: 1 },
  },
});

registerSchema("food", "analyze-nutrition", {
  required: ["title", "analysis"],
  properties: {
    title: { type: "string" },
    analysis: { type: "object" },
  },
});
