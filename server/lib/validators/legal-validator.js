import { registerValidator } from "../quality-gate.js";

registerValidator("law", (data, action) => {
  const issues = [];

  // Legal documents MUST include disclaimer — auto-inject if missing
  if (!data.disclaimer || data.disclaimer.length < 20) {
    data.disclaimer =
      "This document is generated for informational purposes only and does not constitute legal advice. Consult a licensed attorney for legal guidance.";
  }

  if (action === "analyze-contract") {
    if (!data.parties?.length || data.parties.length < 2) {
      issues.push({ issue: "Contract analysis has fewer than 2 parties", severity: "critical" });
    }
    if (!data.keyTerms?.length) {
      issues.push({ issue: "No key terms identified", severity: "critical" });
    }
  }

  if (action === "draft-contract") {
    if (!data.parties?.length || data.parties.length < 2) {
      issues.push({ issue: "Contract needs at least 2 parties", severity: "critical" });
    }
    if (!data.clauses?.length) {
      issues.push({ issue: "Contract has no clauses", severity: "critical" });
    }
  }

  return { pass: issues.filter((i) => i.severity === "critical").length === 0, issues };
});

registerValidator("legal", (data) => {
  if (!data.disclaimer || data.disclaimer.length < 20) {
    data.disclaimer =
      "This document is generated for informational purposes only and does not constitute legal advice. Consult a licensed attorney for legal guidance.";
  }
  return { pass: true, issues: [] };
});
