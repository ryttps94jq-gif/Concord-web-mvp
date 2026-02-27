/**
 * Meal Plan Section Builder — transforms food/nutrition meal plan data
 * into the structured section format consumed by the PDF renderer.
 */

/**
 * Build meal plan sections from artifact data.
 *
 * @param {Object} data - artifact.data containing meal plan fields
 * @returns {Array} sections array for renderPDF
 */
export function buildMealPlanSections(data) {
  const sections = [];

  // Plan overview
  sections.push({
    type: "meta",
    fields: [
      { label: "Plan", value: data.planName || data.name || "Meal Plan" },
      { label: "Duration", value: data.duration || (data.days?.length ? `${data.days.length} days` : "—") },
      { label: "Calories/Day", value: data.dailyCalories || data.targetCalories ? String(data.dailyCalories || data.targetCalories) : "—" },
      { label: "Diet Type", value: data.dietType || data.type || "—" },
      { label: "Restrictions", value: (data.restrictions || data.allergies || []).join(", ") || "none" },
    ].filter((f) => f.value !== "—"),
  });

  // Macros summary
  const macros = data.macros || data.macroTargets || {};
  if (macros.protein || macros.carbs || macros.fat) {
    sections.push({ type: "heading", text: "Daily Macro Targets" });
    sections.push({
      type: "table",
      headers: ["Macro", "Target", "% of Calories"],
      rows: [
        ["Protein", macros.protein ? `${macros.protein}g` : "—", macros.proteinPct ? `${macros.proteinPct}%` : "—"],
        ["Carbohydrates", macros.carbs ? `${macros.carbs}g` : "—", macros.carbsPct ? `${macros.carbsPct}%` : "—"],
        ["Fat", macros.fat ? `${macros.fat}g` : "—", macros.fatPct ? `${macros.fatPct}%` : "—"],
        ...(macros.fiber ? [["Fiber", `${macros.fiber}g`, "—"]] : []),
      ],
    });
  }

  // Daily meals
  const days = data.days || data.schedule || data.meals ? [{ meals: data.meals }] : [];
  for (const day of days) {
    const dayLabel = day.day || day.name || day.label || "";
    if (dayLabel) sections.push({ type: "heading", text: dayLabel });

    const meals = day.meals || [];
    for (const meal of meals) {
      const mealLabel = meal.name || meal.type || meal.label || "Meal";
      sections.push({ type: "heading", text: `  ${mealLabel}` });

      // Recipe / items
      const items = meal.items || meal.foods || meal.ingredients || meal.recipes || [];
      if (items.length) {
        if (typeof items[0] === "object") {
          sections.push({
            type: "table",
            headers: ["Food", "Serving", "Calories", "Protein", "Carbs", "Fat"],
            rows: items.map((item) => [
              item.name || item.food || "—",
              item.serving || item.portion || item.amount || "—",
              item.calories ? String(item.calories) : "—",
              item.protein ? `${item.protein}g` : "—",
              item.carbs ? `${item.carbs}g` : "—",
              item.fat ? `${item.fat}g` : "—",
            ]),
          });
        } else {
          sections.push({ type: "list", items: items.map(String) });
        }
      }

      // Recipe instructions
      if (meal.recipe || meal.instructions) {
        sections.push({ type: "text", text: `Instructions: ${meal.recipe || meal.instructions}` });
      }

      // Prep time
      if (meal.prepTime || meal.cookTime) {
        const times = [];
        if (meal.prepTime) times.push(`Prep: ${meal.prepTime}`);
        if (meal.cookTime) times.push(`Cook: ${meal.cookTime}`);
        sections.push({ type: "text", text: times.join(" | ") });
      }
    }
  }

  // Grocery list
  const grocery = data.groceryList || data.shoppingList || data.ingredients || [];
  if (grocery.length) {
    sections.push({ type: "heading", text: "Grocery List" });
    if (typeof grocery[0] === "object") {
      // Group by category if available
      const byCategory = {};
      for (const item of grocery) {
        const cat = item.category || item.aisle || "Other";
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
      }
      for (const [cat, items] of Object.entries(byCategory)) {
        sections.push({ type: "text", text: cat });
        sections.push({
          type: "list",
          items: items.map((i) => {
            const name = i.name || i.item || "—";
            const qty = i.quantity || i.amount || "";
            return qty ? `${name} — ${qty}` : name;
          }),
        });
      }
    } else {
      sections.push({ type: "list", items: grocery.map(String) });
    }
  }

  // Nutrition summary
  if (data.nutritionSummary || data.summary) {
    sections.push({ type: "heading", text: "Nutrition Summary" });
    const summary = data.nutritionSummary || data.summary;
    if (typeof summary === "object" && !Array.isArray(summary)) {
      const fields = Object.entries(summary)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => ({ label: k, value: String(v) }));
      sections.push({ type: "meta", fields });
    } else {
      sections.push({ type: "text", text: String(summary) });
    }
  }

  // Notes
  if (data.notes || data.tips) {
    sections.push({ type: "heading", text: "Notes & Tips" });
    const notes = data.notes || data.tips;
    if (Array.isArray(notes)) {
      sections.push({ type: "list", items: notes.map(String) });
    } else {
      sections.push({ type: "text", text: String(notes) });
    }
  }

  return sections;
}
