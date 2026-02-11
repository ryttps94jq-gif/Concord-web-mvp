// server/domains/trades.js
// Domain actions for trades/contracting: estimates, inspections, materials costs.

export default function registerTradesActions(registerLensAction) {
  /**
   * calculateEstimate
   * Sum line items with markup and tax to produce a customer-facing estimate.
   * artifact.data.lineItems: [{ description, quantity, unitCost, category }]
   * params.markupPct (default 20), params.taxRate (default 0.08)
   */
  registerLensAction("trades", "calculateEstimate", async (ctx, artifact, params) => {
    const lineItems = artifact.data.lineItems || [];
    const markupPct = params.markupPct != null ? params.markupPct : 20;
    const taxRate = params.taxRate != null ? params.taxRate : 0.08;
    const discountPct = params.discountPct || 0;

    if (lineItems.length === 0) {
      return { ok: true, result: { error: "No line items provided." } };
    }

    let subtotal = 0;
    const detailed = lineItems.map((item, idx) => {
      const qty = parseFloat(item.quantity) || 0;
      const unit = parseFloat(item.unitCost) || 0;
      const lineTotal = Math.round(qty * unit * 100) / 100;
      subtotal += lineTotal;
      return {
        line: idx + 1,
        description: item.description || "",
        category: item.category || "general",
        quantity: qty,
        unitCost: unit,
        lineTotal,
      };
    });

    const markupAmount = Math.round(subtotal * (markupPct / 100) * 100) / 100;
    const afterMarkup = Math.round((subtotal + markupAmount) * 100) / 100;
    const discountAmount = Math.round(afterMarkup * (discountPct / 100) * 100) / 100;
    const afterDiscount = Math.round((afterMarkup - discountAmount) * 100) / 100;
    const taxAmount = Math.round(afterDiscount * taxRate * 100) / 100;
    const grandTotal = Math.round((afterDiscount + taxAmount) * 100) / 100;

    // Category breakdown
    const byCategory = {};
    for (const item of detailed) {
      if (!byCategory[item.category]) byCategory[item.category] = 0;
      byCategory[item.category] = Math.round((byCategory[item.category] + item.lineTotal) * 100) / 100;
    }

    const estimate = {
      generatedAt: new Date().toISOString(),
      lineItems: detailed,
      subtotal,
      markupPct,
      markupAmount,
      discountPct,
      discountAmount,
      taxRate,
      taxAmount,
      grandTotal,
      byCategory,
    };

    artifact.data.currentEstimate = estimate;

    return { ok: true, result: estimate };
  });

  /**
   * scheduleInspection
   * Create an inspection checkpoint linked to a permit.
   * artifact.data.permits: [{ permitId, type, stages: [{ name, inspectionRequired }] }]
   * params.permitId — which permit to schedule for
   * params.stageName — the stage to schedule
   * params.requestedDate — preferred date (ISO)
   */
  registerLensAction("trades", "scheduleInspection", async (ctx, artifact, params) => {
    const permits = artifact.data.permits || [];
    const permitId = params.permitId;
    const stageName = params.stageName;
    const requestedDate = params.requestedDate || null;

    const permit = permits.find((p) => p.permitId === permitId);
    if (!permit) {
      return { ok: true, result: { error: `Permit ${permitId} not found.` } };
    }

    const stage = (permit.stages || []).find(
      (s) => s.name.toLowerCase() === (stageName || "").toLowerCase()
    );
    if (!stage) {
      return { ok: true, result: { error: `Stage '${stageName}' not found on permit ${permitId}.` } };
    }

    if (!stage.inspectionRequired) {
      return { ok: true, result: { error: `Stage '${stageName}' does not require inspection.` } };
    }

    // Determine inspection date: requested date or 3 business days from now
    let inspectionDate;
    if (requestedDate) {
      inspectionDate = new Date(requestedDate);
    } else {
      inspectionDate = new Date();
      let businessDays = 0;
      while (businessDays < 3) {
        inspectionDate.setDate(inspectionDate.getDate() + 1);
        const dow = inspectionDate.getDay();
        if (dow !== 0 && dow !== 6) businessDays++;
      }
    }

    const inspection = {
      inspectionId: `INS-${permitId}-${Date.now().toString(36).toUpperCase()}`,
      permitId,
      permitType: permit.type,
      stageName: stage.name,
      requestedDate: inspectionDate.toISOString().split("T")[0],
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };

    if (!artifact.data.inspections) artifact.data.inspections = [];
    artifact.data.inspections.push(inspection);

    // Mark the stage as having a scheduled inspection
    stage.inspectionStatus = "scheduled";
    stage.inspectionId = inspection.inspectionId;

    return { ok: true, result: inspection };
  });

  /**
   * materialsCost
   * Aggregate materials costs across active jobs.
   * artifact.data.jobs: [{ jobId, name, status, materials: [{ item, quantity, unitCost }] }]
   * params.statusFilter (default "active") — which job statuses to include
   */
  registerLensAction("trades", "materialsCost", async (ctx, artifact, params) => {
    const jobs = artifact.data.jobs || [];
    const statusFilter = params.statusFilter || "active";

    const activeJobs = jobs.filter(
      (j) => j.status && j.status.toLowerCase() === statusFilter.toLowerCase()
    );

    let grandTotal = 0;
    const perJob = [];
    const materialTotals = {};

    for (const job of activeJobs) {
      let jobTotal = 0;
      const materials = job.materials || [];

      for (const mat of materials) {
        const qty = parseFloat(mat.quantity) || 0;
        const cost = parseFloat(mat.unitCost) || 0;
        const lineCost = Math.round(qty * cost * 100) / 100;
        jobTotal += lineCost;

        const key = (mat.item || "unknown").toLowerCase();
        if (!materialTotals[key]) {
          materialTotals[key] = { item: mat.item, totalQuantity: 0, totalCost: 0 };
        }
        materialTotals[key].totalQuantity += qty;
        materialTotals[key].totalCost = Math.round((materialTotals[key].totalCost + lineCost) * 100) / 100;
      }

      jobTotal = Math.round(jobTotal * 100) / 100;
      grandTotal += jobTotal;

      perJob.push({
        jobId: job.jobId,
        name: job.name,
        materialLineCount: materials.length,
        jobMaterialCost: jobTotal,
      });
    }

    grandTotal = Math.round(grandTotal * 100) / 100;

    // Sort materials by total cost descending
    const sortedMaterials = Object.values(materialTotals).sort(
      (a, b) => b.totalCost - a.totalCost
    );

    const report = {
      generatedAt: new Date().toISOString(),
      statusFilter,
      jobsIncluded: activeJobs.length,
      grandTotal,
      perJob,
      materialBreakdown: sortedMaterials,
      topMaterial: sortedMaterials[0] || null,
    };

    artifact.data.materialsCostReport = report;

    return { ok: true, result: report };
  });
};
