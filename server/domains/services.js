module.exports = function registerServicesActions(registerLensAction) {
  registerLensAction("services", "scheduleOptimize", async (ctx, artifact, params) => {
    const appointments = artifact.data?.appointments || [artifact.data];
    const sorted = [...appointments].sort((a, b) => {
      const ta = a.time || a.date || '';
      const tb = b.time || b.date || '';
      return ta.localeCompare(tb);
    });
    let totalGap = 0;
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = new Date(sorted[i - 1].endTime || sorted[i - 1].time || 0);
      const nextStart = new Date(sorted[i].time || sorted[i].date || 0);
      const gapMinutes = (nextStart - prevEnd) / (1000 * 60);
      if (gapMinutes > 0) { totalGap += gapMinutes; gaps.push({ after: sorted[i - 1].client || i - 1, before: sorted[i].client || i, gapMinutes }); }
    }
    return { ok: true, optimizedOrder: sorted.map(a => ({ client: a.client, time: a.time, service: a.serviceType })), totalGapMinutes: totalGap, gaps };
  });

  registerLensAction("services", "reminderGenerate", async (ctx, artifact, params) => {
    const appointments = artifact.data?.appointments || [artifact.data];
    const now = new Date();
    const hoursAhead = params.hoursAhead || 24;
    const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    const upcoming = appointments.filter(a => {
      const apptDate = new Date(a.date || a.time || 0);
      return apptDate >= now && apptDate <= cutoff;
    });
    const reminders = upcoming.map(a => ({
      client: a.client || 'Unknown',
      service: a.serviceType || a.service || 'Appointment',
      date: a.date || a.time,
      provider: a.provider || '',
      message: `Reminder: Your ${a.serviceType || 'appointment'} is scheduled for ${a.date || a.time}`,
    }));
    return { ok: true, reminders, count: reminders.length };
  });

  registerLensAction("services", "revenueByProvider", async (ctx, artifact, params) => {
    const appointments = artifact.data?.appointments || [];
    const period = params.period || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    const recent = appointments.filter(a => {
      const d = new Date(a.date || a.completedAt || 0);
      return d >= cutoff && (a.status === 'completed' || a.status === 'paid');
    });
    const byProvider = {};
    recent.forEach(a => {
      const provider = a.provider || 'Unknown';
      if (!byProvider[provider]) byProvider[provider] = { appointments: 0, revenue: 0 };
      byProvider[provider].appointments++;
      byProvider[provider].revenue += a.price || 0;
    });
    const summary = Object.entries(byProvider).map(([name, data]) => ({ provider: name, ...data })).sort((a, b) => b.revenue - a.revenue);
    return { ok: true, period, summary, totalRevenue: summary.reduce((s, p) => s + p.revenue, 0) };
  });

  registerLensAction("services", "supplyCheck", async (ctx, artifact, params) => {
    const supplies = artifact.data?.materials || artifact.data?.supplies || [];
    const lowStock = supplies.filter(s => {
      const current = s.currentStock || s.quantity || 0;
      const reorder = s.reorderPoint || s.minStock || 5;
      return current <= reorder;
    }).map(s => ({
      name: s.name,
      currentStock: s.currentStock || s.quantity || 0,
      reorderPoint: s.reorderPoint || s.minStock || 5,
      supplier: s.supplier || '',
    }));
    return { ok: true, lowStock, count: lowStock.length, totalItems: supplies.length, needsOrder: lowStock.length > 0 };
  });
};
