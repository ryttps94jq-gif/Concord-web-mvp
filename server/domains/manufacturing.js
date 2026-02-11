export default function registerManufacturingActions(registerLensAction) {
  registerLensAction("manufacturing", "scheduleOptimize", async (ctx, artifact, params) => {
    const workOrders = artifact.data?.workOrders || [artifact];
    const sorted = [...workOrders].sort((a, b) => {
      const pa = a.priority || 3; const pb = b.priority || 3;
      if (pa !== pb) return pa - pb;
      const da = a.dueDate || '9999'; const db = b.dueDate || '9999';
      return da.localeCompare(db);
    });
    return { ok: true, sequence: sorted.map((wo, i) => ({ position: i + 1, id: wo.id || wo.title, priority: wo.priority, dueDate: wo.dueDate })), count: sorted.length };
  });

  registerLensAction("manufacturing", "bomCost", async (ctx, artifact, params) => {
    const components = artifact.data?.components || [];
    let totalCost = 0;
    const breakdown = components.map(c => {
      const lineCost = (c.quantity || 0) * (c.unitCost || 0);
      totalCost += lineCost;
      return { part: c.name || c.partRef, quantity: c.quantity, unitCost: c.unitCost, lineCost };
    });
    return { ok: true, product: artifact.title, components: breakdown, totalCost: Math.round(totalCost * 100) / 100, componentCount: components.length };
  });

  registerLensAction("manufacturing", "oeeCalculate", async (ctx, artifact, params) => {
    const plannedTime = artifact.data?.plannedTime || params.plannedTime || 480;
    const downtime = artifact.data?.downtime || params.downtime || 0;
    const idealCycleTime = artifact.data?.idealCycleTime || params.idealCycleTime || 1;
    const totalPieces = artifact.data?.totalPieces || params.totalPieces || 0;
    const goodPieces = artifact.data?.goodPieces || params.goodPieces || totalPieces;
    const runTime = plannedTime - downtime;
    const availability = plannedTime > 0 ? runTime / plannedTime : 0;
    const performance = (runTime > 0 && idealCycleTime > 0) ? (idealCycleTime * totalPieces) / runTime : 0;
    const quality = totalPieces > 0 ? goodPieces / totalPieces : 0;
    const oee = availability * performance * quality;
    return {
      ok: true,
      machine: artifact.title,
      availability: Math.round(availability * 100),
      performance: Math.round(performance * 100),
      quality: Math.round(quality * 100),
      oee: Math.round(oee * 100),
      rating: oee >= 0.85 ? 'world_class' : oee >= 0.65 ? 'typical' : 'needs_improvement',
    };
  });

  registerLensAction("manufacturing", "safetyRate", async (ctx, artifact, params) => {
    const incidents = artifact.data?.incidents || [];
    const hoursWorked = artifact.data?.hoursWorked || params.hoursWorked || 200000;
    const recordable = incidents.filter(i => i.oshaRecordable).length;
    const rate = hoursWorked > 0 ? (recordable * 200000) / hoursWorked : 0;
    return { ok: true, incidentRate: Math.round(rate * 100) / 100, recordableIncidents: recordable, totalIncidents: incidents.length, hoursWorked, benchmark: rate <= 3 ? 'below_average' : rate <= 5 ? 'average' : 'above_average' };
  });
};
