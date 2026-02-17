export default function registerEnvironmentActions(registerLensAction) {
  registerLensAction("environment", "populationTrend", (ctx, artifact, _params) => {
    const surveys = artifact.data?.surveyData || [];
    if (surveys.length < 2) return { ok: true, trend: 'insufficient_data', surveys: surveys.length };
    const sorted = [...surveys].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const first = sorted[0].count || 0;
    const last = sorted[sorted.length - 1].count || 0;
    const change = first > 0 ? ((last - first) / first) * 100 : 0;
    const trend = change > 5 ? 'increasing' : change < -5 ? 'declining' : 'stable';
    return { ok: true, species: artifact.title, trend, changePercent: Math.round(change * 10) / 10, firstCount: first, lastCount: last, dataPoints: surveys.length };
  });

  registerLensAction("environment", "complianceCheck", (ctx, artifact, params) => {
    const parameters = artifact.data?.parameters || [];
    const thresholds = params.thresholds || artifact.data?.thresholds || {};
    const results = parameters.map(p => {
      const threshold = thresholds[p.name] || p.threshold;
      const compliant = threshold ? p.value <= threshold.max && p.value >= (threshold.min || 0) : true;
      return { parameter: p.name, value: p.value, unit: p.unit, threshold, compliant };
    });
    const allCompliant = results.every(r => r.compliant);
    return { ok: true, siteId: artifact.id, results, overallCompliant: allCompliant, violations: results.filter(r => !r.compliant).length, checkedAt: new Date().toISOString() };
  });

  registerLensAction("environment", "trailCondition", (ctx, artifact, _params) => {
    const trails = artifact.data?.trails || [artifact.data];
    const prioritized = trails.map(t => {
      const condition = t.condition || 3;
      const usage = t.usage || 'medium';
      const usageScore = usage === 'high' ? 3 : usage === 'medium' ? 2 : 1;
      const priority = (5 - condition) * usageScore;
      return { name: t.name || artifact.title, condition, usage, priorityScore: priority, maintenanceNeeded: t.maintenanceNeeded || '' };
    }).sort((a, b) => b.priorityScore - a.priorityScore);
    return { ok: true, prioritized, total: prioritized.length };
  });

  registerLensAction("environment", "diversionRate", (ctx, artifact, params) => {
    const totalWaste = artifact.data?.totalVolume || params.totalWaste || 0;
    const diverted = artifact.data?.divertedVolume || params.diverted || 0;
    const rate = totalWaste > 0 ? Math.round((diverted / totalWaste) * 100) : 0;
    const byStream = artifact.data?.streams || [];
    return { ok: true, diversionRate: rate, totalWaste, diverted, landfilled: totalWaste - diverted, streams: byStream, target: params.target || 50, meetsTarget: rate >= (params.target || 50) };
  });
};
