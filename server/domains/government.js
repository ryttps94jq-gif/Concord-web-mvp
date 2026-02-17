export default function registerGovernmentActions(registerLensAction) {
  registerLensAction("government", "permitTimeline", (ctx, artifact, _params) => {
    const applicationDate = artifact.data?.applicationDate ? new Date(artifact.data.applicationDate) : null;
    const approvalDate = artifact.data?.approvalDate ? new Date(artifact.data.approvalDate) : null;
    let processingDays = null;
    if (applicationDate && approvalDate) {
      processingDays = Math.ceil((approvalDate - applicationDate) / (1000 * 60 * 60 * 24));
    }
    const permitType = artifact.data?.type || 'general';
    const benchmarks = { building: 30, electrical: 14, plumbing: 14, grading: 21, business: 10, general: 21 };
    const benchmark = benchmarks[permitType] || 21;
    return { ok: true, permitId: artifact.id, permitType, processingDays, benchmark, onTime: processingDays !== null ? processingDays <= benchmark : null };
  });

  registerLensAction("government", "violationEscalation", (ctx, artifact, _params) => {
    const deadline = artifact.data?.complianceDeadline ? new Date(artifact.data.complianceDeadline) : null;
    const now = new Date();
    if (!deadline) return { ok: true, escalated: false, message: "No compliance deadline set" };
    const pastDeadline = now > deadline;
    const daysPast = pastDeadline ? Math.ceil((now - deadline) / (1000 * 60 * 60 * 24)) : 0;
    if (pastDeadline && artifact.meta?.status !== 'escalated') {
      artifact.meta = { ...artifact.meta, status: 'escalated' };
      artifact.data = { ...artifact.data, escalatedAt: now.toISOString(), daysPastDeadline: daysPast };
      artifact.updatedAt = now.toISOString();
    }
    return { ok: true, violationId: artifact.id, escalated: pastDeadline, daysPast, currentStatus: artifact.meta?.status };
  });

  registerLensAction("government", "resourceStaging", (ctx, artifact, params) => {
    const zones = artifact.data?.zones || [];
    const resources = artifact.data?.resources || [];
    const threatType = artifact.data?.type || params.threatType || 'general';
    const staging = zones.map(zone => {
      const assignedResources = resources.filter(r => r.zone === zone.id || !r.zone).map(r => ({
        name: r.name, type: r.type, quantity: r.quantity || 1,
      }));
      return { zone: zone.name || zone.id, population: zone.population || 0, riskLevel: zone.riskLevel || 'medium', resources: assignedResources };
    });
    return { ok: true, threatType, staging, totalZones: zones.length, totalResources: resources.length, activationLevel: artifact.data?.activationLevel || 'standby' };
  });

  registerLensAction("government", "retentionCheck", (ctx, artifact, _params) => {
    const retentionPeriod = artifact.data?.retentionPeriod || 7;
    const createdDate = artifact.data?.date ? new Date(artifact.data.date) : new Date(artifact.createdAt);
    const now = new Date();
    const yearsHeld = (now - createdDate) / (1000 * 60 * 60 * 24 * 365);
    const pastRetention = yearsHeld >= retentionPeriod;
    const classification = artifact.data?.classification || 'public';
    return {
      ok: true,
      recordId: artifact.id,
      retentionPeriod,
      yearsHeld: Math.round(yearsHeld * 10) / 10,
      pastRetention,
      classification,
      recommendation: pastRetention ? 'eligible_for_disposition' : 'retain',
      yearsRemaining: Math.max(0, Math.round((retentionPeriod - yearsHeld) * 10) / 10),
    };
  });
};
