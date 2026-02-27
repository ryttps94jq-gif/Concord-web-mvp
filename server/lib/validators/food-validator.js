import { registerValidator } from "../quality-gate.js";

registerValidator("food", (data, action) => {
  const issues = [];
  const allItems = JSON.stringify(data).toLowerCase();

  if (action === "generate-meal-plan" || action === "build-meal-plan" || action === "generate-grocery-list") {
    // Must contain actual food words
    const foodWords = allItems.match(
      /\b(chicken|beef|fish|salmon|rice|pasta|bread|egg|milk|cheese|tomato|onion|garlic|pepper|salt|olive oil|butter|potato|broccoli|spinach|lettuce|carrot|apple|banana|oat|yogurt|bean|lentil|avocado|mushroom|shrimp|tofu|turkey|pork|corn|wheat|flour|sugar|honey|vinegar|soy sauce|lemon|lime|ginger|basil|oregano|cilantro|cinnamon|cumin|paprika|quinoa|almond|walnut|blueberry|strawberry|mango|cucumber|zucchini|kale|sweet potato|coconut|tuna|shrimp|steak|lamb|duck|celery|asparagus|cauliflower|eggplant|peach|grape|orange|watermelon|pineapple|raspberry)\b/gi
    ) || [];

    if (foodWords.length < 3) {
      issues.push({ issue: "Insufficient food-related content", severity: "critical" });
    }

    // Calorie sanity check
    if (data.targetCalories && (data.targetCalories < 500 || data.targetCalories > 10000)) {
      issues.push({ issue: `Unrealistic calorie target: ${data.targetCalories}`, severity: "warning" });
    }
  }

  return { pass: issues.filter((i) => i.severity === "critical").length === 0, issues };
});
