export default function registerSecurityActions(registerLensAction) {
  registerLensAction("security", "incidentTrend", async (ctx, artifact, params) => {
    const incidents = artifact.data?.incidents || [artifact.data];
    const byType = {};
    const byLocation = {};
    const byMonth = {};
    incidents.forEach(inc => {
      const type = inc.type || 'unknown';
      const location = inc.location || 'unknown';
      const month = (inc.date || '').substring(0, 7) || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
      byLocation[location] = (byLocation[location] || 0) + 1;
      byMonth[month] = (byMonth[month] || 0) + 1;
    });
    return { ok: true, byType, byLocation, byMonth, totalIncidents: incidents.length, analyzedAt: new Date().toISOString() };
  });

  registerLensAction("security", "patrolCoverage", async (ctx, artifact, params) => {
    const checkpoints = artifact.data?.checkpoints || [];
    if (checkpoints.length === 0) return { ok: true, coverage: 0, completed: 0, total: 0 };
    const completed = checkpoints.filter(cp => cp.status === 'completed' || cp.checkedAt).length;
    const coverage = Math.round((completed / checkpoints.length) * 100);
    const missed = checkpoints.filter(cp => cp.status !== 'completed' && !cp.checkedAt).map(cp => ({ location: cp.location, scheduledTime: cp.time }));
    return { ok: true, patrol: artifact.title, coverage, completed, total: checkpoints.length, missed };
  });

  registerLensAction("security", "threatMatrix", async (ctx, artifact, params) => {
    const threats = artifact.data?.threats || [artifact.data];
    const matrix = threats.map(t => {
      const severity = t.severity || 3;
      const likelihood = t.probability || t.likelihood || 3;
      const riskScore = severity * likelihood;
      return {
        name: t.name || artifact.title,
        type: t.type || 'unknown',
        severity,
        likelihood,
        riskScore,
        riskLevel: riskScore >= 15 ? 'critical' : riskScore >= 10 ? 'high' : riskScore >= 5 ? 'medium' : 'low',
        mitigations: t.mitigations || [],
      };
    }).sort((a, b) => b.riskScore - a.riskScore);
    return { ok: true, matrix, totalThreats: matrix.length, criticalCount: matrix.filter(m => m.riskLevel === 'critical').length };
  });

  registerLensAction("security", "evidenceChain", async (ctx, artifact, params) => {
    const evidenceLog = artifact.data?.evidenceLog || [];
    let intact = true;
    const issues = [];
    for (let i = 0; i < evidenceLog.length; i++) {
      const entry = evidenceLog[i];
      if (!entry.handler || !entry.date) {
        intact = false;
        issues.push({ position: i, issue: 'Missing handler or date', entry });
      }
      if (i > 0 && entry.date < evidenceLog[i - 1].date) {
        intact = false;
        issues.push({ position: i, issue: 'Date out of sequence', entry });
      }
    }
    return { ok: true, investigationId: artifact.id, intact, transfers: evidenceLog.length, issues, verifiedAt: new Date().toISOString() };
  });
};
