/**
 * Contract Section Builder — transforms legal contract/brief data
 * into the structured section format consumed by the PDF renderer.
 */

/**
 * Build contract sections from artifact data.
 *
 * @param {Object} data - artifact.data containing contract fields
 * @returns {Array} sections array for renderPDF
 */
export function buildContractSections(data) {
  const sections = [];

  // Contract metadata
  sections.push({
    type: "meta",
    fields: [
      { label: "Contract #", value: data.contractNumber || data.id || "—" },
      { label: "Type", value: data.contractType || data.type || "General Agreement" },
      { label: "Effective Date", value: data.effectiveDate || data.startDate || "—" },
      { label: "Expiration", value: data.expirationDate || data.endDate || "—" },
      { label: "Status", value: data.status || "draft" },
      { label: "Jurisdiction", value: data.jurisdiction || "—" },
    ],
  });

  // Parties
  const parties = data.parties || [];
  if (parties.length) {
    sections.push({ type: "heading", text: "Parties" });
    sections.push({
      type: "table",
      headers: ["Role", "Name", "Entity", "Contact"],
      rows: parties.map((p) => [
        p.role || "Party",
        p.name || "—",
        p.entity || p.organization || "—",
        p.email || p.contact || "—",
      ]),
    });
  }

  // Recitals / Background
  if (data.recitals || data.background) {
    sections.push({ type: "heading", text: "Recitals" });
    const text = data.recitals || data.background;
    if (Array.isArray(text)) {
      sections.push({ type: "list", items: text.map(String) });
    } else {
      sections.push({ type: "text", text: String(text) });
    }
  }

  // Clauses / Terms
  const clauses = data.clauses || data.terms || data.sections || [];
  if (clauses.length) {
    sections.push({ type: "heading", text: "Terms & Conditions" });
    for (const clause of clauses) {
      if (typeof clause === "string") {
        sections.push({ type: "text", text: clause });
      } else {
        if (clause.title || clause.heading) {
          sections.push({ type: "heading", text: clause.title || clause.heading });
        }
        if (clause.text || clause.body || clause.content) {
          sections.push({ type: "text", text: clause.text || clause.body || clause.content });
        }
        if (clause.subclauses?.length) {
          sections.push({ type: "list", items: clause.subclauses.map((s) => (typeof s === "string" ? s : s.text || JSON.stringify(s))) });
        }
      }
    }
  }

  // Obligations
  const obligations = data.obligations || [];
  if (obligations.length) {
    sections.push({ type: "heading", text: "Obligations" });
    sections.push({
      type: "table",
      headers: ["Party", "Obligation", "Deadline", "Status"],
      rows: obligations.map((o) => [
        o.party || "—",
        o.description || o.obligation || "—",
        o.deadline || o.dueDate || "—",
        o.status || "pending",
      ]),
    });
  }

  // Compensation / Payment terms
  if (data.compensation || data.paymentTerms || data.consideration) {
    sections.push({ type: "heading", text: "Compensation" });
    const comp = data.compensation || data.paymentTerms || data.consideration;
    if (typeof comp === "object" && !Array.isArray(comp)) {
      const fields = Object.entries(comp)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => ({ label: k, value: String(v) }));
      sections.push({ type: "meta", fields });
    } else {
      sections.push({ type: "text", text: String(comp) });
    }
  }

  // Confidentiality / Special clauses
  if (data.confidentiality) {
    sections.push({ type: "heading", text: "Confidentiality" });
    sections.push({ type: "text", text: String(data.confidentiality) });
  }

  // Termination
  if (data.termination) {
    sections.push({ type: "heading", text: "Termination" });
    sections.push({ type: "text", text: String(data.termination) });
  }

  // Signatures placeholder
  sections.push({ type: "heading", text: "Signatures" });
  const sigParties = parties.length ? parties : [{ name: "Party A" }, { name: "Party B" }];
  for (const p of sigParties) {
    sections.push({ type: "text", text: `\n____________________________\n${p.name || p.role || "Party"}\nDate: _______________` });
  }

  return sections;
}
