/**
 * Workout Program Section Builder — transforms fitness workout/program data
 * into the structured section format consumed by the PDF renderer.
 */

/**
 * Build workout program sections from artifact data.
 *
 * @param {Object} data - artifact.data containing workout/program fields
 * @returns {Array} sections array for renderPDF
 */
export function buildWorkoutSections(data) {
  const sections = [];

  // Program overview
  sections.push({
    type: "meta",
    fields: [
      { label: "Program", value: data.programName || data.name || "Workout Program" },
      { label: "Duration", value: data.duration || data.weeks ? `${data.weeks} weeks` : "—" },
      { label: "Level", value: data.level || data.difficulty || "intermediate" },
      { label: "Goal", value: data.goal || data.objective || "general fitness" },
      { label: "Days/Week", value: String(data.daysPerWeek || data.frequency || "—") },
    ].filter((f) => f.value !== "—"),
  });

  // Schedule / Weekly plan
  const schedule = data.schedule || data.weeks || data.days || data.sessions || [];
  if (schedule.length) {
    for (const day of schedule) {
      const dayLabel = day.day || day.name || day.label || day.title || `Session`;
      sections.push({ type: "heading", text: dayLabel });

      if (day.focus || day.muscleGroup) {
        sections.push({ type: "text", text: `Focus: ${day.focus || day.muscleGroup}` });
      }

      const exercises = day.exercises || day.movements || day.items || [];
      if (exercises.length) {
        if (typeof exercises[0] === "object") {
          sections.push({
            type: "table",
            headers: ["Exercise", "Sets", "Reps", "Weight/Load", "Rest", "Notes"],
            rows: exercises.map((e) => [
              e.name || e.exercise || "—",
              String(e.sets || "—"),
              String(e.reps || e.time || "—"),
              e.weight || e.load || e.intensity || "—",
              e.rest || e.restPeriod || "—",
              e.notes || e.cues || "—",
            ]),
          });
        } else {
          sections.push({ type: "list", items: exercises.map(String) });
        }
      }

      if (day.warmup) {
        sections.push({ type: "text", text: `Warm-up: ${typeof day.warmup === "string" ? day.warmup : JSON.stringify(day.warmup)}` });
      }
      if (day.cooldown) {
        sections.push({ type: "text", text: `Cool-down: ${typeof day.cooldown === "string" ? day.cooldown : JSON.stringify(day.cooldown)}` });
      }
    }
  }

  // Individual exercises list (if no schedule structure)
  const exercises = data.exercises || [];
  if (!schedule.length && exercises.length) {
    sections.push({ type: "heading", text: "Exercises" });
    if (typeof exercises[0] === "object") {
      sections.push({
        type: "table",
        headers: ["Exercise", "Sets", "Reps", "Weight", "Rest"],
        rows: exercises.map((e) => [
          e.name || e.exercise || "—",
          String(e.sets || "—"),
          String(e.reps || "—"),
          e.weight || e.load || "—",
          e.rest || "—",
        ]),
      });
    } else {
      sections.push({ type: "list", items: exercises.map(String) });
    }
  }

  // Progression notes
  if (data.progression || data.progressionNotes) {
    sections.push({ type: "heading", text: "Progression" });
    const prog = data.progression || data.progressionNotes;
    if (Array.isArray(prog)) {
      sections.push({ type: "list", items: prog.map(String) });
    } else {
      sections.push({ type: "text", text: String(prog) });
    }
  }

  // Nutrition guidelines
  if (data.nutrition || data.diet) {
    sections.push({ type: "heading", text: "Nutrition Guidelines" });
    const nutr = data.nutrition || data.diet;
    if (typeof nutr === "object" && !Array.isArray(nutr)) {
      const fields = Object.entries(nutr)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => ({ label: k, value: String(v) }));
      sections.push({ type: "meta", fields });
    } else {
      sections.push({ type: "text", text: String(nutr) });
    }
  }

  // Notes
  if (data.notes) {
    sections.push({ type: "heading", text: "Notes" });
    sections.push({ type: "text", text: String(data.notes) });
  }

  return sections;
}
