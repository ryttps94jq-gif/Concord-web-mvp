// server/domains/household.js
// Domain actions for household management: grocery lists, maintenance, chore rotation.

module.exports = function registerHouseholdActions(registerLensAction) {
  /**
   * generateGroceryList
   * Aggregate ingredients from a meal plan into a consolidated grocery list,
   * combining duplicates and subtracting what is already on hand.
   * artifact.data.mealPlan: [{ day, meal, recipe, ingredients: [{ name, quantity, unit }] }]
   * artifact.data.pantry: [{ name, quantity, unit }] (optional)
   */
  registerLensAction("household", "generateGroceryList", async (ctx, artifact, params) => {
    const mealPlan = artifact.data.mealPlan || [];
    const pantry = artifact.data.pantry || [];
    const categorize = params.categorize !== false;

    // Aggregate all ingredients from the meal plan
    const aggregated = {};
    for (const meal of mealPlan) {
      for (const ing of (meal.ingredients || [])) {
        const key = `${(ing.name || "").toLowerCase()}|${(ing.unit || "").toLowerCase()}`;
        if (!aggregated[key]) {
          aggregated[key] = {
            name: ing.name,
            quantity: 0,
            unit: ing.unit || "",
            category: ing.category || "other",
            usedIn: [],
          };
        }
        aggregated[key].quantity += parseFloat(ing.quantity) || 0;
        const mealLabel = `${meal.day || ""} ${meal.meal || ""}`.trim();
        if (mealLabel && !aggregated[key].usedIn.includes(mealLabel)) {
          aggregated[key].usedIn.push(mealLabel);
        }
      }
    }

    // Subtract pantry quantities
    const pantryMap = {};
    for (const item of pantry) {
      const key = `${(item.name || "").toLowerCase()}|${(item.unit || "").toLowerCase()}`;
      pantryMap[key] = (pantryMap[key] || 0) + (parseFloat(item.quantity) || 0);
    }

    const groceryList = [];
    for (const [key, item] of Object.entries(aggregated)) {
      const onHand = pantryMap[key] || 0;
      const needed = Math.round((item.quantity - onHand) * 100) / 100;
      if (needed > 0) {
        groceryList.push({
          name: item.name,
          quantity: needed,
          unit: item.unit,
          category: item.category,
          usedIn: item.usedIn,
          hadOnHand: onHand > 0 ? onHand : 0,
        });
      }
    }

    // Group by category if requested
    let byCategory = null;
    if (categorize) {
      byCategory = {};
      for (const item of groceryList) {
        const cat = item.category || "other";
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
      }
    }

    // Sort alphabetically within categories
    groceryList.sort((a, b) => {
      if (a.category !== b.category) return (a.category || "").localeCompare(b.category || "");
      return (a.name || "").localeCompare(b.name || "");
    });

    const result = {
      generatedAt: new Date().toISOString(),
      mealsPlanned: mealPlan.length,
      uniqueItems: groceryList.length,
      pantryItemsSubtracted: Object.keys(pantryMap).length,
      list: groceryList,
      byCategory,
    };

    artifact.data.groceryList = result;

    return { ok: true, result };
  });

  /**
   * maintenanceDue
   * Flag household items or systems past their service date.
   * artifact.data.maintenanceItems: [{ name, lastServiceDate, intervalDays, category, notes }]
   * params.lookaheadDays (default 30) — also flag items due soon
   */
  registerLensAction("household", "maintenanceDue", async (ctx, artifact, params) => {
    const items = artifact.data.maintenanceItems || [];
    const lookaheadDays = params.lookaheadDays != null ? params.lookaheadDays : 30;
    const now = new Date();

    const overdue = [];
    const upcoming = [];
    const current = [];

    for (const item of items) {
      const lastService = item.lastServiceDate ? new Date(item.lastServiceDate) : null;
      const interval = parseInt(item.intervalDays) || 365;

      if (!lastService) {
        overdue.push({
          ...item,
          status: "never-serviced",
          daysOverdue: null,
          nextDueDate: null,
        });
        continue;
      }

      const nextDue = new Date(lastService.getTime() + interval * 86400000);
      const daysUntilDue = Math.ceil((nextDue - now) / 86400000);

      if (daysUntilDue < 0) {
        overdue.push({
          name: item.name,
          category: item.category || "general",
          lastServiceDate: item.lastServiceDate,
          intervalDays: interval,
          nextDueDate: nextDue.toISOString().split("T")[0],
          daysOverdue: Math.abs(daysUntilDue),
          status: "overdue",
          notes: item.notes || "",
        });
      } else if (daysUntilDue <= lookaheadDays) {
        upcoming.push({
          name: item.name,
          category: item.category || "general",
          lastServiceDate: item.lastServiceDate,
          intervalDays: interval,
          nextDueDate: nextDue.toISOString().split("T")[0],
          daysUntilDue,
          status: "upcoming",
          notes: item.notes || "",
        });
      } else {
        current.push({
          name: item.name,
          category: item.category || "general",
          nextDueDate: nextDue.toISOString().split("T")[0],
          daysUntilDue,
          status: "current",
        });
      }
    }

    // Sort overdue by most overdue first, upcoming by soonest first
    overdue.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
    upcoming.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    const report = {
      checkedAt: new Date().toISOString(),
      lookaheadDays,
      totalItems: items.length,
      overdueCount: overdue.length,
      upcomingCount: upcoming.length,
      currentCount: current.length,
      overdue,
      upcoming,
    };

    artifact.data.maintenanceReport = report;

    return { ok: true, result: report };
  });

  /**
   * choreRotation
   * Rotate chore assignments among household members.
   * artifact.data.chores: [{ name, currentAssignee, frequency }]
   * artifact.data.members: [{ name, preferences }] or string[]
   * params.strategy — "round-robin" (default) or "random"
   */
  registerLensAction("household", "choreRotation", async (ctx, artifact, params) => {
    const chores = artifact.data.chores || [];
    const rawMembers = artifact.data.members || [];
    const strategy = params.strategy || "round-robin";

    const members = rawMembers.map((m) => (typeof m === "string" ? m : m.name));

    if (members.length === 0) {
      return { ok: true, result: { error: "No household members defined." } };
    }
    if (chores.length === 0) {
      return { ok: true, result: { error: "No chores defined." } };
    }

    const previousAssignments = chores.map((c) => ({
      chore: c.name,
      previousAssignee: c.currentAssignee || null,
    }));

    const newAssignments = [];

    if (strategy === "random") {
      // Shuffle members and assign chores round-robin from shuffled list
      const shuffled = members.slice().sort(() => Math.random() - 0.5);
      chores.forEach((chore, idx) => {
        const assignee = shuffled[idx % shuffled.length];
        newAssignments.push({
          chore: chore.name,
          frequency: chore.frequency || "weekly",
          assignee,
          previousAssignee: chore.currentAssignee || null,
        });
        chore.currentAssignee = assignee;
      });
    } else {
      // Round-robin: shift each chore's assignee to the next member in the list
      for (const chore of chores) {
        const currentIdx = members.indexOf(chore.currentAssignee);
        let nextIdx;
        if (currentIdx === -1) {
          // Assign to the member with the fewest current assignments
          const counts = {};
          members.forEach((m) => (counts[m] = 0));
          for (const a of newAssignments) counts[a.assignee] = (counts[a.assignee] || 0) + 1;
          nextIdx = members.indexOf(
            members.reduce((min, m) => ((counts[m] || 0) < (counts[min] || 0) ? m : min), members[0])
          );
        } else {
          nextIdx = (currentIdx + 1) % members.length;
        }

        const assignee = members[nextIdx];
        newAssignments.push({
          chore: chore.name,
          frequency: chore.frequency || "weekly",
          assignee,
          previousAssignee: chore.currentAssignee || null,
        });
        chore.currentAssignee = assignee;
      }
    }

    // Summary: how many chores per person
    const choreCounts = {};
    for (const a of newAssignments) {
      choreCounts[a.assignee] = (choreCounts[a.assignee] || 0) + 1;
    }

    const result = {
      rotatedAt: new Date().toISOString(),
      strategy,
      totalChores: chores.length,
      members: members.length,
      assignments: newAssignments,
      choresPerMember: choreCounts,
      previousAssignments,
    };

    artifact.data.lastRotation = result;

    return { ok: true, result };
  });
};
