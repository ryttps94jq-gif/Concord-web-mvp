export default function registerLegalActions(registerLensAction) {
  registerLensAction("legal", "deadlineCheck", async (ctx, artifact, params) => {
    const now = new Date();
    const items = artifact.data?.items || [];
    const upcoming = items.filter(i => {
      if (!i.deadline) return false;
      const dl = new Date(i.deadline);
      const daysUntil = (dl - now) / (1000 * 60 * 60 * 24);
      return daysUntil >= 0 && daysUntil <= (params.daysAhead || 30);
    }).map(i => ({
      ...i,
      daysUntil: Math.ceil((new Date(i.deadline) - now) / (1000 * 60 * 60 * 24)),
    })).sort((a, b) => a.daysUntil - b.daysUntil);
    return { ok: true, upcoming, count: upcoming.length };
  });

  registerLensAction("legal", "contractRenewal", async (ctx, artifact, params) => {
    const expiryDate = artifact.data?.expiryDate ? new Date(artifact.data.expiryDate) : null;
    if (!expiryDate) return { ok: true, status: "no_expiry", message: "No expiry date set" };
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    const autoRenewal = artifact.data?.renewalType === 'auto';
    return {
      ok: true,
      contractId: artifact.id,
      title: artifact.title,
      expiryDate: artifact.data.expiryDate,
      daysUntilExpiry,
      autoRenewal,
      actionRequired: daysUntilExpiry <= 60,
      urgency: daysUntilExpiry <= 14 ? 'critical' : daysUntilExpiry <= 30 ? 'high' : daysUntilExpiry <= 60 ? 'medium' : 'low',
    };
  });

  registerLensAction("legal", "conflictCheck", async (ctx, artifact, params) => {
    const parties = artifact.data?.parties || [];
    const client = artifact.data?.client || '';
    const opposingParty = artifact.data?.opposingParty || '';
    const conflicts = [];
    if (params.checkAgainst) {
      for (const name of params.checkAgainst) {
        if (parties.includes(name) || client === name || opposingParty === name) {
          conflicts.push({ name, conflictType: 'direct_party', caseId: artifact.id });
        }
      }
    }
    return { ok: true, conflicts, hasConflict: conflicts.length > 0, checkedAt: new Date().toISOString() };
  });

  registerLensAction("legal", "complianceScore", async (ctx, artifact, params) => {
    const items = artifact.data?.requirements || [];
    if (items.length === 0) return { ok: true, score: 100, compliant: 0, overdue: 0, total: 0 };
    const now = new Date();
    const compliant = items.filter(i => i.status === 'compliant').length;
    const overdue = items.filter(i => i.status === 'overdue' || (i.deadline && new Date(i.deadline) < now && i.status !== 'compliant')).length;
    const score = Math.round((compliant / items.length) * 100);
    return { ok: true, score, compliant, overdue, total: items.length, rating: score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor' };
  });
};
