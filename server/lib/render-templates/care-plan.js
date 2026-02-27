/**
 * Care Plan Section Builder — transforms healthcare care plan data
 * into the structured section format consumed by the PDF renderer.
 */

/**
 * Build care plan sections from artifact data.
 *
 * @param {Object} data - artifact.data containing care plan fields
 * @returns {Array} sections array for renderPDF
 */
export function buildCarePlanSections(data) {
  const sections = [];

  // Patient info
  const patient = data.patient || {};
  if (patient.name || patient.id) {
    sections.push({ type: "heading", text: "Patient Information" });
    const fields = [];
    if (patient.name) fields.push({ label: "Name", value: patient.name });
    if (patient.id || patient.mrn) fields.push({ label: "MRN", value: patient.id || patient.mrn });
    if (patient.dob || patient.dateOfBirth) fields.push({ label: "DOB", value: patient.dob || patient.dateOfBirth });
    if (patient.age) fields.push({ label: "Age", value: String(patient.age) });
    if (patient.gender) fields.push({ label: "Gender", value: patient.gender });
    if (patient.allergies?.length) fields.push({ label: "Allergies", value: patient.allergies.join(", ") });
    sections.push({ type: "meta", fields });
  }

  // Diagnoses / Conditions
  const conditions = data.conditions || data.diagnoses || data.problems || [];
  if (conditions.length) {
    sections.push({ type: "heading", text: "Diagnoses / Conditions" });
    if (typeof conditions[0] === "object") {
      sections.push({
        type: "table",
        headers: ["Condition", "ICD Code", "Status", "Onset"],
        rows: conditions.map((c) => [
          c.name || c.condition || c.diagnosis || "—",
          c.icdCode || c.code || "—",
          c.status || "active",
          c.onset || c.onsetDate || "—",
        ]),
      });
    } else {
      sections.push({ type: "list", items: conditions.map(String) });
    }
  }

  // Goals
  const goals = data.goals || data.objectives || [];
  if (goals.length) {
    sections.push({ type: "heading", text: "Goals & Objectives" });
    if (typeof goals[0] === "object") {
      sections.push({
        type: "table",
        headers: ["Goal", "Target Date", "Status", "Priority"],
        rows: goals.map((g) => [
          g.description || g.goal || g.text || "—",
          g.targetDate || g.deadline || "—",
          g.status || "in progress",
          g.priority || "medium",
        ]),
      });
    } else {
      sections.push({ type: "list", items: goals.map(String) });
    }
  }

  // Interventions / Treatments
  const interventions = data.interventions || data.treatments || data.actions || [];
  if (interventions.length) {
    sections.push({ type: "heading", text: "Interventions" });
    if (typeof interventions[0] === "object") {
      sections.push({
        type: "table",
        headers: ["Intervention", "Frequency", "Responsible", "Notes"],
        rows: interventions.map((i) => [
          i.description || i.intervention || i.name || "—",
          i.frequency || i.schedule || "—",
          i.responsible || i.provider || "—",
          i.notes || "—",
        ]),
      });
    } else {
      sections.push({ type: "list", items: interventions.map(String) });
    }
  }

  // Medications
  const meds = data.medications || data.prescriptions || [];
  if (meds.length) {
    sections.push({ type: "heading", text: "Medications" });
    sections.push({
      type: "table",
      headers: ["Medication", "Dose", "Route", "Frequency", "Notes"],
      rows: meds.map((m) => [
        m.drug || m.name || m.medication || "—",
        m.dose || m.dosage || "—",
        m.route || "oral",
        m.frequency || "—",
        m.notes || m.instructions || "—",
      ]),
    });
  }

  // Milestones / Checkpoints
  const milestones = data.milestones || data.checkpoints || [];
  if (milestones.length) {
    sections.push({ type: "heading", text: "Milestones" });
    sections.push({
      type: "table",
      headers: ["Milestone", "Date", "Status"],
      rows: milestones.map((m) => [
        m.description || m.name || m.milestone || "—",
        m.date || m.targetDate || "—",
        m.status || "pending",
      ]),
    });
  }

  // Follow-up
  if (data.followUp || data.nextSteps) {
    sections.push({ type: "heading", text: "Follow-up" });
    const fu = data.followUp || data.nextSteps;
    if (Array.isArray(fu)) {
      sections.push({ type: "list", items: fu.map((f) => (typeof f === "string" ? f : f.description || f.text || JSON.stringify(f))) });
    } else {
      sections.push({ type: "text", text: String(fu) });
    }
  }

  // Notes
  if (data.notes || data.clinicalNotes) {
    sections.push({ type: "heading", text: "Clinical Notes" });
    sections.push({ type: "text", text: data.notes || data.clinicalNotes });
  }

  return sections;
}
