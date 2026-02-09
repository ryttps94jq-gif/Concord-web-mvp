module.exports = function registerNonprofitActions(registerLensAction) {
  registerLensAction("nonprofit", "donorRetention", async (ctx, artifact, params) => {
    const givingHistory = artifact.data?.givingHistory || [];
    const currentYear = params.year || new Date().getFullYear();
    const priorYear = currentYear - 1;
    const currentDonors = new Set(givingHistory.filter(g => new Date(g.date).getFullYear() === currentYear).map(g => g.donorId || g.name));
    const priorDonors = new Set(givingHistory.filter(g => new Date(g.date).getFullYear() === priorYear).map(g => g.donorId || g.name));
    const retained = [...priorDonors].filter(d => currentDonors.has(d)).length;
    const rate = priorDonors.size > 0 ? Math.round((retained / priorDonors.size) * 100) : 0;
    return { ok: true, retentionRate: rate, retained, priorTotal: priorDonors.size, currentTotal: currentDonors.size, period: `${priorYear}-${currentYear}` };
  });

  registerLensAction("nonprofit", "grantReporting", async (ctx, artifact, params) => {
    const deliverables = artifact.data?.deliverables || [];
    const metrics = artifact.data?.impactMetrics || [];
    const completed = deliverables.filter(d => d.status === 'completed').length;
    const report = {
      grantId: artifact.id,
      grantName: artifact.title,
      funder: artifact.data?.funder || 'Unknown',
      amount: artifact.data?.amount || 0,
      deliverableProgress: deliverables.length > 0 ? Math.round((completed / deliverables.length) * 100) : 0,
      completedDeliverables: completed,
      totalDeliverables: deliverables.length,
      impactSummary: metrics.map(m => ({ name: m.name, target: m.target, actual: m.actual, achieved: m.actual >= m.target })),
      generatedAt: new Date().toISOString(),
    };
    return { ok: true, report };
  });

  registerLensAction("nonprofit", "volunteerMatch", async (ctx, artifact, params) => {
    const skills = artifact.data?.skills || [];
    const availability = artifact.data?.availability || [];
    const needs = params.programNeeds || [];
    const matches = needs.map(need => ({
      program: need.program,
      requiredSkill: need.skill,
      matched: skills.some(s => s.toLowerCase().includes(need.skill.toLowerCase())),
      availabilityMatch: !need.schedule || availability.some(a => a === need.schedule),
    }));
    const matchScore = matches.length > 0 ? Math.round((matches.filter(m => m.matched && m.availabilityMatch).length / matches.length) * 100) : 0;
    return { ok: true, volunteer: artifact.title, matches, matchScore };
  });

  registerLensAction("nonprofit", "campaignProgress", async (ctx, artifact, params) => {
    const goal = artifact.data?.goalAmount || 0;
    const raised = artifact.data?.raisedAmount || 0;
    const donorCount = artifact.data?.donorCount || 0;
    const startDate = artifact.data?.startDate ? new Date(artifact.data.startDate) : new Date();
    const endDate = artifact.data?.endDate ? new Date(artifact.data.endDate) : new Date();
    const now = new Date();
    const totalDays = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.max(0, (now - startDate) / (1000 * 60 * 60 * 24));
    const percentComplete = goal > 0 ? Math.round((raised / goal) * 100) : 0;
    const dailyRate = elapsedDays > 0 ? raised / elapsedDays : 0;
    const projected = Math.round(dailyRate * totalDays);
    return { ok: true, campaign: artifact.title, goal, raised, percentComplete, donorCount, dailyRate: Math.round(dailyRate), projected, onTrack: projected >= goal };
  });
};
