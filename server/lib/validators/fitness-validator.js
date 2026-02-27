import { registerValidator } from "../quality-gate.js";

registerValidator("fitness", (data, action) => {
  const issues = [];
  const allText = JSON.stringify(data).toLowerCase();

  if (action === "generate-program" || action === "suggest-workout" || action === "build-program") {
    // Must contain actual exercise names
    const exerciseWords = allText.match(
      /\b(squat|deadlift|bench press|overhead press|barbell row|pull.?up|chin.?up|push.?up|plank|lunge|curl|tricep|lateral raise|leg press|leg curl|leg extension|calf raise|hip thrust|romanian deadlift|front squat|incline press|dumbbell fly|face pull|cable|dip|crunch|sit.?up|burpee|jump|sprint|run|bike|swim|row|step.?up|goblet|farmer|shrug|clean|snatch|press|stretch|foam roll)\b/gi
    ) || [];

    if (exerciseWords.length < 3) {
      issues.push({ issue: "Insufficient exercise-related content", severity: "critical" });
    }

    // Sets/reps sanity for structured programs
    if (data.weeks) {
      for (const week of data.weeks) {
        for (const day of week.days || []) {
          for (const ex of day.exercises || []) {
            if (ex.sets && (ex.sets < 1 || ex.sets > 20)) {
              issues.push({ issue: `Unrealistic sets: ${ex.sets} for ${ex.name}`, severity: "warning" });
            }
          }
        }
      }
    }
  }

  return { pass: issues.filter((i) => i.severity === "critical").length === 0, issues };
});
