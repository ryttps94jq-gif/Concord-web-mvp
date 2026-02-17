// server/domains/food.js
// Domain actions for food service: recipe scaling, plate costing, spoilage, pour cost.

export default function registerFoodActions(registerLensAction) {
  /**
   * scaleRecipe
   * Recalculate ingredients for a different yield.
   * artifact.data.recipe: { name, baseYield, yieldUnit, ingredients: [{ name, quantity, unit }] }
   * params.targetYield — the desired new yield
   */
  registerLensAction("food", "scaleRecipe", (ctx, artifact, params) => {
    const recipe = artifact.data.recipe || artifact.data;
    const baseYield = parseFloat(recipe.baseYield || recipe.yield) || 1;
    const targetYield = parseFloat(params.targetYield);

    if (!targetYield || targetYield <= 0) {
      return { ok: true, result: { error: "targetYield must be a positive number." } };
    }

    const scaleFactor = targetYield / baseYield;
    const ingredients = recipe.ingredients || [];

    const scaled = ingredients.map((ing) => {
      const origQty = parseFloat(ing.quantity) || 0;
      let newQty = origQty * scaleFactor;

      // Friendly rounding: round to nearest 0.25 for quantities > 1, nearest 0.125 for smaller
      if (newQty >= 1) {
        newQty = Math.round(newQty * 4) / 4;
      } else {
        newQty = Math.round(newQty * 8) / 8;
      }

      return {
        name: ing.name,
        originalQuantity: origQty,
        scaledQuantity: newQty,
        unit: ing.unit || "",
      };
    });

    const result = {
      recipeName: recipe.name || artifact.title,
      baseYield,
      targetYield,
      yieldUnit: recipe.yieldUnit || "servings",
      scaleFactor: Math.round(scaleFactor * 1000) / 1000,
      ingredients: scaled,
    };

    artifact.data.lastScaled = result;

    return { ok: true, result };
  });

  /**
   * costPlate
   * Calculate food cost percentage for a menu item.
   * artifact.data.menuItems: [{ name, ingredients: [{ name, quantity, unit, costPerUnit }], menuPrice }]
   * params.itemName — which menu item to cost (or cost all if omitted)
   */
  registerLensAction("food", "costPlate", (ctx, artifact, params) => {
    const menuItems = artifact.data.menuItems || [];
    const targetName = params.itemName || null;

    const items = targetName
      ? menuItems.filter((m) => m.name.toLowerCase() === targetName.toLowerCase())
      : menuItems;

    if (items.length === 0) {
      return { ok: true, result: { error: "No matching menu items found." } };
    }

    const targetPct = params.targetFoodCostPct || 30;

    const costed = items.map((item) => {
      let totalIngredientCost = 0;
      const ingredientCosts = (item.ingredients || []).map((ing) => {
        const qty = parseFloat(ing.quantity) || 0;
        const cpu = parseFloat(ing.costPerUnit) || 0;
        const cost = Math.round(qty * cpu * 100) / 100;
        totalIngredientCost += cost;
        return { name: ing.name, quantity: qty, unit: ing.unit, costPerUnit: cpu, totalCost: cost };
      });

      totalIngredientCost = Math.round(totalIngredientCost * 100) / 100;
      const menuPrice = parseFloat(item.menuPrice) || 0;
      const foodCostPct = menuPrice > 0 ? Math.round((totalIngredientCost / menuPrice) * 10000) / 100 : 0;
      const suggestedPrice = totalIngredientCost > 0
        ? Math.round((totalIngredientCost / (targetPct / 100)) * 100) / 100
        : 0;

      return {
        name: item.name,
        menuPrice,
        ingredientCost: totalIngredientCost,
        foodCostPct,
        targetFoodCostPct: targetPct,
        suggestedPriceAtTarget: suggestedPrice,
        margin: Math.round((menuPrice - totalIngredientCost) * 100) / 100,
        ingredients: ingredientCosts,
        status: foodCostPct <= targetPct ? "on-target" : "over-target",
      };
    });

    const avgFoodCost =
      costed.length > 0
        ? Math.round((costed.reduce((s, c) => s + c.foodCostPct, 0) / costed.length) * 100) / 100
        : 0;

    artifact.data.plateCostReport = { generatedAt: new Date().toISOString(), items: costed, avgFoodCostPct: avgFoodCost };

    return { ok: true, result: { items: costed, avgFoodCostPct: avgFoodCost } };
  });

  /**
   * spoilageCheck
   * Flag inventory items approaching their expiry date.
   * artifact.data.inventory: [{ item, quantity, unit, expiryDate, location }]
   * params.warningDays (default 3) — days before expiry to flag
   */
  registerLensAction("food", "spoilageCheck", (ctx, artifact, params) => {
    const inventory = artifact.data.inventory || [];
    const warningDays = params.warningDays != null ? params.warningDays : 3;
    const now = new Date();
    const warningCutoff = new Date(now.getTime() + warningDays * 86400000);

    const expired = [];
    const expiringSoon = [];
    const ok = [];

    for (const item of inventory) {
      if (!item.expiryDate) {
        ok.push({ ...item, status: "no-expiry-date" });
        continue;
      }

      const expiry = new Date(item.expiryDate);
      const daysUntil = Math.ceil((expiry - now) / 86400000);

      if (expiry < now) {
        expired.push({ ...item, daysUntilExpiry: daysUntil, status: "expired" });
      } else if (expiry <= warningCutoff) {
        expiringSoon.push({ ...item, daysUntilExpiry: daysUntil, status: "expiring-soon" });
      } else {
        ok.push({ ...item, daysUntilExpiry: daysUntil, status: "ok" });
      }
    }

    // Estimate spoilage cost
    let estimatedLoss = 0;
    for (const item of expired) {
      estimatedLoss += (parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0);
    }
    estimatedLoss = Math.round(estimatedLoss * 100) / 100;

    const report = {
      checkedAt: new Date().toISOString(),
      warningDays,
      totalItems: inventory.length,
      expiredCount: expired.length,
      expiringSoonCount: expiringSoon.length,
      okCount: ok.length,
      estimatedSpoilageLoss: estimatedLoss,
      expired: expired.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
      expiringSoon: expiringSoon.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
    };

    artifact.data.spoilageReport = report;

    return { ok: true, result: report };
  });

  /**
   * pourCost
   * Calculate beverage cost percentage.
   * artifact.data.beverages: [{ name, costPerOz, pourOz, menuPrice }]
   * params.itemName — optional filter
   */
  registerLensAction("food", "pourCost", (ctx, artifact, params) => {
    const beverages = artifact.data.beverages || [];
    const targetName = params.itemName || null;

    const items = targetName
      ? beverages.filter((b) => b.name.toLowerCase() === targetName.toLowerCase())
      : beverages;

    if (items.length === 0) {
      return { ok: true, result: { error: "No matching beverages found." } };
    }

    const targetPourCost = params.targetPourCostPct || 20;

    const costed = items.map((bev) => {
      const costPerOz = parseFloat(bev.costPerOz) || 0;
      const pourOz = parseFloat(bev.pourOz) || 0;
      const menuPrice = parseFloat(bev.menuPrice) || 0;
      const drinkCost = Math.round(costPerOz * pourOz * 100) / 100;
      const pourCostPct = menuPrice > 0 ? Math.round((drinkCost / menuPrice) * 10000) / 100 : 0;
      const suggestedPrice =
        drinkCost > 0 ? Math.round((drinkCost / (targetPourCost / 100)) * 100) / 100 : 0;

      return {
        name: bev.name,
        costPerOz,
        pourOz,
        drinkCost,
        menuPrice,
        pourCostPct,
        targetPourCostPct: targetPourCost,
        suggestedPriceAtTarget: suggestedPrice,
        profit: Math.round((menuPrice - drinkCost) * 100) / 100,
        status: pourCostPct <= targetPourCost ? "on-target" : "over-target",
      };
    });

    const avgPourCost =
      costed.length > 0
        ? Math.round((costed.reduce((s, c) => s + c.pourCostPct, 0) / costed.length) * 100) / 100
        : 0;

    artifact.data.pourCostReport = { generatedAt: new Date().toISOString(), items: costed, avgPourCostPct: avgPourCost };

    return { ok: true, result: { items: costed, avgPourCostPct: avgPourCost } };
  });
};
