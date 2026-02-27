import { registerValidator } from "../quality-gate.js";

registerValidator("healthcare", (data, action) => {
  const issues = [];

  // Care plans MUST include disclaimer — auto-inject if missing
  if (action === "build-care-plan") {
    if (!data.disclaimer || data.disclaimer.length < 20) {
      data.disclaimer =
        "This care plan is generated for informational purposes only and does not constitute medical advice. Always consult with a qualified healthcare provider before making medical decisions.";
    }

    if (!data.goals?.length) {
      issues.push({ issue: "Care plan has no goals", severity: "critical" });
    }
    if (!data.interventions?.length) {
      issues.push({ issue: "Care plan has no interventions", severity: "critical" });
    }
  }

  // All healthcare artifacts need disclaimers
  if (!data.disclaimer || data.disclaimer.length < 20) {
    data.disclaimer =
      "This information is generated for educational purposes only and does not constitute medical advice. Consult a qualified healthcare provider for medical guidance.";
  }

  return { pass: issues.filter((i) => i.severity === "critical").length === 0, issues };
});
