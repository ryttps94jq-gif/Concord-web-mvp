export default function registerEventsActions(registerLensAction) {
  registerLensAction("events", "budgetReconcile", (ctx, artifact, _params) => {
    const projectedBudget = artifact.data?.budget || 0;
    const expenses = artifact.data?.expenses || [];
    const revenue = artifact.data?.revenue || [];
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalRevenue = revenue.reduce((s, r) => s + (r.amount || 0), 0);
    const variance = projectedBudget - totalExpenses;
    const byCategory = {};
    expenses.forEach(e => { byCategory[e.category || 'Other'] = (byCategory[e.category || 'Other'] || 0) + (e.amount || 0); });
    return { ok: true, event: artifact.title, projectedBudget, totalExpenses, totalRevenue, netProfit: totalRevenue - totalExpenses, variance, overBudget: variance < 0, byCategory };
  });

  registerLensAction("events", "advanceSheet", (ctx, artifact, _params) => {
    const venue = artifact.data?.venue || {};
    const sheet = {
      event: artifact.title,
      date: artifact.data?.date || 'TBD',
      venue: { name: venue.name || 'TBD', address: venue.address || '', capacity: venue.capacity || 0, contact: venue.contact || '' },
      schedule: {
        loadIn: artifact.data?.loadIn || 'TBD',
        soundcheck: artifact.data?.soundcheck || 'TBD',
        doors: artifact.data?.doors || 'TBD',
        showTime: artifact.data?.showTime || 'TBD',
        curfew: artifact.data?.curfew || 'TBD',
      },
      production: { stage: venue.stageSize || 'TBD', sound: venue.soundSystem || 'House', lighting: venue.lighting || 'House', backline: venue.backline || 'None' },
      hospitality: artifact.data?.hospitality || { catering: 'TBD', greenRoom: 'TBD', parking: 'TBD' },
      generatedAt: new Date().toISOString(),
    };
    return { ok: true, advanceSheet: sheet };
  });

  registerLensAction("events", "techRiderMatch", (ctx, artifact, params) => {
    const riderRequirements = artifact.data?.riderRequirements || params.requirements || [];
    const venueEquipment = artifact.data?.venueEquipment || params.venueEquipment || [];
    const venueSet = new Set(venueEquipment.map(e => (e.name || e).toLowerCase()));
    const matches = riderRequirements.map(req => {
      const reqName = (req.name || req).toLowerCase();
      const available = venueSet.has(reqName) || [...venueSet].some(v => v.includes(reqName));
      return { requirement: req.name || req, quantity: req.quantity || 1, available, notes: available ? 'Provided by venue' : 'Must be rented' };
    });
    const fulfilled = matches.filter(m => m.available).length;
    return { ok: true, performer: artifact.title, matches, fulfilled, total: matches.length, fulfillmentRate: matches.length > 0 ? Math.round((fulfilled / matches.length) * 100) : 0 };
  });

  registerLensAction("events", "settlementCalc", (ctx, artifact, params) => {
    const guarantee = artifact.data?.guarantee || params.guarantee || 0;
    const doorSplit = artifact.data?.doorSplit || params.doorSplit || 80;
    const ticketsSold = artifact.data?.ticketsSold || params.ticketsSold || 0;
    const ticketPrice = artifact.data?.ticketPrice || params.ticketPrice || 0;
    const grossDoor = ticketsSold * ticketPrice;
    const artistDoorShare = grossDoor * (doorSplit / 100);
    const settlement = Math.max(guarantee, artistDoorShare);
    const method = artistDoorShare > guarantee ? 'door_split' : 'guarantee';
    return { ok: true, performer: artifact.title, guarantee, doorSplit: `${doorSplit}%`, grossDoor, artistDoorShare, settlement, method, ticketsSold };
  });
};
