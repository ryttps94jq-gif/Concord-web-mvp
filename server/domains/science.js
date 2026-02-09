module.exports = function registerScienceActions(registerLensAction) {
  registerLensAction("science", "chainOfCustody", async (ctx, artifact, params) => {
    const custodyLog = artifact.data?.chainOfCustody || [];
    let intact = true;
    const gaps = [];
    for (let i = 1; i < custodyLog.length; i++) {
      const prev = custodyLog[i - 1];
      const curr = custodyLog[i];
      if (prev.transferredTo !== curr.receivedBy) {
        intact = false;
        gaps.push({ position: i, expected: prev.transferredTo, actual: curr.receivedBy, date: curr.date });
      }
    }
    return { ok: true, sampleId: artifact.id, sample: artifact.title, intact, transfers: custodyLog.length, gaps, verifiedAt: new Date().toISOString() };
  });

  registerLensAction("science", "calibrationCheck", async (ctx, artifact, params) => {
    const calibrationDate = artifact.data?.calibrationDate ? new Date(artifact.data.calibrationDate) : null;
    const nextCalibration = artifact.data?.nextCalibration ? new Date(artifact.data.nextCalibration) : null;
    const now = new Date();
    let status = 'unknown';
    let daysUntilDue = null;
    if (nextCalibration) {
      daysUntilDue = Math.ceil((nextCalibration - now) / (1000 * 60 * 60 * 24));
      status = daysUntilDue < 0 ? 'overdue' : daysUntilDue <= 14 ? 'due_soon' : 'current';
    }
    return { ok: true, equipment: artifact.title, serial: artifact.data?.serial, lastCalibration: artifact.data?.calibrationDate, nextCalibration: artifact.data?.nextCalibration, status, daysUntilDue };
  });

  registerLensAction("science", "dataExport", async (ctx, artifact, params) => {
    const observations = artifact.data?.observations || [];
    const format = params.format || 'csv';
    let exportData;
    if (format === 'geojson') {
      exportData = {
        type: 'FeatureCollection',
        features: observations.filter(o => o.gps).map(o => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [o.gps.lon || o.gps.lng, o.gps.lat] },
          properties: { date: o.date, observer: o.observer, type: o.type, notes: o.notes },
        })),
      };
    } else {
      exportData = observations;
    }
    return { ok: true, format, records: observations.length, data: exportData, exportedAt: new Date().toISOString() };
  });

  registerLensAction("science", "spatialCluster", async (ctx, artifact, params) => {
    const observations = artifact.data?.observations || [];
    const radius = params.radiusKm || 1;
    const geoObs = observations.filter(o => o.gps);
    const clusters = [];
    const assigned = new Set();
    for (let i = 0; i < geoObs.length; i++) {
      if (assigned.has(i)) continue;
      const cluster = [i];
      assigned.add(i);
      for (let j = i + 1; j < geoObs.length; j++) {
        if (assigned.has(j)) continue;
        const dLat = (geoObs[j].gps.lat - geoObs[i].gps.lat) * 111;
        const dLon = (geoObs[j].gps.lon - geoObs[i].gps.lon) * 111 * Math.cos(geoObs[i].gps.lat * Math.PI / 180);
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        if (dist <= radius) { cluster.push(j); assigned.add(j); }
      }
      clusters.push({ id: clusters.length + 1, observations: cluster.length, center: geoObs[i].gps });
    }
    return { ok: true, clusters, totalObservations: geoObs.length, radiusKm: radius };
  });
};
