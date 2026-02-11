export default function registerRealEstateActions(registerLensAction) {
  registerLensAction("realestate", "capRate", async (ctx, artifact, params) => {
    const noi = artifact.data?.netOperatingIncome || params.noi || 0;
    const purchasePrice = artifact.data?.purchasePrice || params.purchasePrice || 0;
    if (purchasePrice === 0) return { ok: true, capRate: 0, error: "Purchase price cannot be zero" };
    const capRate = (noi / purchasePrice) * 100;
    return { ok: true, capRate: Math.round(capRate * 100) / 100, noi, purchasePrice, rating: capRate >= 8 ? 'excellent' : capRate >= 6 ? 'good' : capRate >= 4 ? 'fair' : 'low' };
  });

  registerLensAction("realestate", "cashFlow", async (ctx, artifact, params) => {
    const rent = artifact.data?.rentAmount || params.monthlyRent || 0;
    const expenses = artifact.data?.monthlyExpenses || params.expenses || 0;
    const mortgage = artifact.data?.mortgagePayment || params.mortgage || 0;
    const vacancy = artifact.data?.vacancyRate || params.vacancyRate || 5;
    const effectiveRent = rent * (1 - vacancy / 100);
    const monthlyCashFlow = effectiveRent - expenses - mortgage;
    const annualCashFlow = monthlyCashFlow * 12;
    return {
      ok: true,
      monthly: { grossRent: rent, effectiveRent: Math.round(effectiveRent), expenses, mortgage, cashFlow: Math.round(monthlyCashFlow) },
      annual: { cashFlow: Math.round(annualCashFlow) },
      positive: monthlyCashFlow > 0,
    };
  });

  registerLensAction("realestate", "closingTimeline", async (ctx, artifact, params) => {
    const contractDate = artifact.data?.contractDate || params.contractDate || new Date().toISOString().split('T')[0];
    const base = new Date(contractDate);
    const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0]; };
    const timeline = [
      { milestone: 'Contract Executed', date: contractDate, status: 'completed' },
      { milestone: 'Earnest Money Due', date: addDays(base, 3), status: 'pending' },
      { milestone: 'Home Inspection', date: addDays(base, 10), status: 'pending' },
      { milestone: 'Inspection Response', date: addDays(base, 14), status: 'pending' },
      { milestone: 'Appraisal Ordered', date: addDays(base, 7), status: 'pending' },
      { milestone: 'Appraisal Received', date: addDays(base, 21), status: 'pending' },
      { milestone: 'Loan Approval', date: addDays(base, 25), status: 'pending' },
      { milestone: 'Clear to Close', date: addDays(base, 28), status: 'pending' },
      { milestone: 'Final Walkthrough', date: addDays(base, 29), status: 'pending' },
      { milestone: 'Closing', date: addDays(base, 30), status: 'pending' },
    ];
    return { ok: true, timeline, totalDays: 30 };
  });

  registerLensAction("realestate", "vacancyRate", async (ctx, artifact, params) => {
    const units = artifact.data?.units || [];
    if (units.length === 0) return { ok: true, vacancyRate: 0, occupied: 0, vacant: 0, total: 0 };
    const vacant = units.filter(u => u.status === 'vacant' || !u.tenant).length;
    const occupied = units.length - vacant;
    const rate = Math.round((vacant / units.length) * 100);
    const totalRent = units.filter(u => u.tenant).reduce((sum, u) => sum + (u.rentAmount || 0), 0);
    return { ok: true, vacancyRate: rate, occupied, vacant, total: units.length, monthlyRentCollected: totalRent };
  });
};
