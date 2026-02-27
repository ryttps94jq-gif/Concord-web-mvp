import { registerValidator } from "../quality-gate.js";

registerValidator("accounting", (data, action) => {
  const issues = [];

  if (action === "generate-invoice") {
    // Line items must add up to subtotal
    if (data.lineItems && data.subtotal) {
      const computed = data.lineItems.reduce((s, li) => s + (li.amount || 0), 0);
      const diff = Math.abs(computed - data.subtotal);
      if (diff > 0.02) {
        issues.push({ issue: `Line items sum (${computed.toFixed(2)}) != subtotal (${data.subtotal})`, severity: "critical" });
      }
    }

    // Total must equal subtotal + tax
    if (data.subtotal && data.total && data.taxAmount !== undefined) {
      const expectedTotal = data.subtotal + (data.taxAmount || 0);
      if (Math.abs(expectedTotal - data.total) > 0.02) {
        issues.push({ issue: `Subtotal + tax (${expectedTotal.toFixed(2)}) != total (${data.total})`, severity: "critical" });
      }
    }

    // Each line item: quantity * unitPrice should equal amount
    for (const li of data.lineItems || []) {
      if (li.quantity && li.unitPrice && li.amount) {
        const expected = Math.round(li.quantity * li.unitPrice * 100) / 100;
        if (Math.abs(expected - li.amount) > 0.02) {
          issues.push({ issue: `Line item math: ${li.quantity} x ${li.unitPrice} = ${expected}, not ${li.amount}`, severity: "warning" });
        }
      }
    }
  }

  if (action === "generate-statements") {
    // Revenue - Expenses should equal Net Income
    const is = data.incomeStatement;
    if (is && is.totalRevenue !== undefined && is.totalExpenses !== undefined && is.netIncome !== undefined) {
      const expected = is.totalRevenue - is.totalExpenses;
      if (Math.abs(expected - is.netIncome) > 0.02) {
        issues.push({ issue: "Revenue - Expenses != Net Income", severity: "critical" });
      }
    }
  }

  return { pass: issues.filter((i) => i.severity === "critical").length === 0, issues };
});

registerValidator("finance", (data, action) => {
  const issues = [];

  if (action === "generate-invoice") {
    if (data.lineItems && data.total) {
      const computed = data.lineItems.reduce((s, li) => s + (li.amount || 0), 0);
      if (computed > 0 && Math.abs(computed - data.total) / data.total > 0.2) {
        issues.push({ issue: "Line items don't sum close to total", severity: "warning" });
      }
    }
  }

  return { pass: issues.filter((i) => i.severity === "critical").length === 0, issues };
});
