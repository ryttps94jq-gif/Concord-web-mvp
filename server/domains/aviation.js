export default function registerAviationActions(registerLensAction) {
  registerLensAction("aviation", "currencyCheck", (ctx, artifact, _params) => {
    const certifications = artifact.data?.certifications || [];
    const medicalExpiry = artifact.data?.medicalExpiry ? new Date(artifact.data.medicalExpiry) : null;
    const now = new Date();
    const checks = [];
    if (medicalExpiry) {
      checks.push({ type: 'Medical Certificate', expiry: artifact.data.medicalExpiry, current: medicalExpiry > now, daysRemaining: Math.ceil((medicalExpiry - now) / (1000 * 60 * 60 * 24)) });
    }
    certifications.forEach(cert => {
      const expiry = cert.expiry ? new Date(cert.expiry) : null;
      checks.push({ type: cert.name, expiry: cert.expiry, current: expiry ? expiry > now : true, daysRemaining: expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : null });
    });
    const landingsLast90 = artifact.data?.recentLandings || 0;
    checks.push({ type: 'Passenger Currency (3 landings/90 days)', current: landingsLast90 >= 3, value: landingsLast90 });
    const allCurrent = checks.every(c => c.current);
    return { ok: true, crewMember: artifact.title, checks, allCurrent, expiringSoon: checks.filter(c => c.daysRemaining !== null && c.daysRemaining <= 30 && c.daysRemaining > 0) };
  });

  registerLensAction("aviation", "maintenanceDue", (ctx, artifact, _params) => {
    const totalTime = artifact.data?.totalTime || 0;
    const lastAnnual = artifact.data?.lastAnnual ? new Date(artifact.data.lastAnnual) : null;
    const now = new Date();
    const items = [];
    if (lastAnnual) {
      const daysSinceAnnual = Math.ceil((now - lastAnnual) / (1000 * 60 * 60 * 24));
      items.push({ type: 'Annual Inspection', lastCompleted: artifact.data.lastAnnual, daysSince: daysSinceAnnual, overdue: daysSinceAnnual > 365, dueIn: Math.max(0, 365 - daysSinceAnnual) });
    }
    const oilChangeInterval = artifact.data?.oilChangeInterval || 50;
    const hoursSinceOil = artifact.data?.hoursSinceOilChange || 0;
    items.push({ type: 'Oil Change', hoursSinceLast: hoursSinceOil, interval: oilChangeInterval, overdue: hoursSinceOil >= oilChangeInterval, hoursRemaining: Math.max(0, oilChangeInterval - hoursSinceOil) });
    const adCompliance = artifact.data?.adCompliance || [];
    adCompliance.filter(ad => ad.status !== 'complied').forEach(ad => {
      items.push({ type: `AD: ${ad.number}`, description: ad.description, status: ad.status, overdue: true });
    });
    return { ok: true, aircraft: artifact.title, registration: artifact.data?.registration, totalTime, items, overdueCount: items.filter(i => i.overdue).length };
  });

  registerLensAction("aviation", "hobbsLog", (ctx, artifact, _params) => {
    const flights = artifact.data?.flights || [];
    let totalTime = 0, picTime = 0, nightTime = 0, instrumentTime = 0, crossCountry = 0;
    flights.forEach(f => {
      totalTime += f.hobbsTime || 0;
      if (f.isPIC) picTime += f.hobbsTime || 0;
      nightTime += f.nightTime || 0;
      instrumentTime += f.instrumentTime || 0;
      if (f.crossCountry) crossCountry += f.hobbsTime || 0;
    });
    return {
      ok: true,
      pilot: artifact.title,
      totalTime: Math.round(totalTime * 10) / 10,
      picTime: Math.round(picTime * 10) / 10,
      nightTime: Math.round(nightTime * 10) / 10,
      instrumentTime: Math.round(instrumentTime * 10) / 10,
      crossCountry: Math.round(crossCountry * 10) / 10,
      totalFlights: flights.length,
    };
  });

  registerLensAction("aviation", "slipUtilization", (ctx, artifact, _params) => {
    const slips = artifact.data?.slips || [];
    if (slips.length === 0) return { ok: true, utilization: 0, occupied: 0, vacant: 0, total: 0 };
    const occupied = slips.filter(s => s.assignedVessel || s.status === 'occupied').length;
    const vacant = slips.length - occupied;
    const utilization = Math.round((occupied / slips.length) * 100);
    const revenue = slips.filter(s => s.assignedVessel).reduce((sum, s) => sum + (s.rate || 0), 0);
    return { ok: true, marina: artifact.title, utilization, occupied, vacant, total: slips.length, monthlyRevenue: revenue };
  });
};
