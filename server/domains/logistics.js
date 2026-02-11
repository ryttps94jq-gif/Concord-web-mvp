// server/domains/logistics.js
// Domain actions for logistics: route optimization, HOS compliance, vehicle maintenance, inventory audit.

export default function registerLogisticsActions(registerLensAction) {
  /**
   * optimizeRoute
   * Reorder delivery stops for shortest total distance using nearest-neighbor heuristic.
   * artifact.data.stops: [{ stopId, name, lat, lng, timeWindowStart, timeWindowEnd, serviceMins }]
   * artifact.data.origin: { lat, lng } (starting point)
   */
  registerLensAction("logistics", "optimizeRoute", async (ctx, artifact, params) => {
    const stops = artifact.data.stops || [];
    const origin = artifact.data.origin || params.origin || (stops.length > 0 ? { lat: stops[0].lat, lng: stops[0].lng } : null);
    const returnToOrigin = params.returnToOrigin !== false;

    if (stops.length === 0) {
      return { ok: true, result: { error: "No stops provided." } };
    }

    // Haversine distance in miles
    function haversine(lat1, lng1, lat2, lng2) {
      const R = 3958.8; // Earth radius in miles
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Nearest-neighbor greedy algorithm
    const remaining = stops.map((s, i) => ({ ...s, _idx: i }));
    const ordered = [];
    let currentLat = origin ? origin.lat : remaining[0].lat;
    let currentLng = origin ? origin.lng : remaining[0].lng;
    let totalDistance = 0;

    while (remaining.length > 0) {
      let nearest = null;
      let nearestDist = Infinity;
      let nearestIdx = -1;

      for (let i = 0; i < remaining.length; i++) {
        const d = haversine(currentLat, currentLng, remaining[i].lat, remaining[i].lng);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = remaining[i];
          nearestIdx = i;
        }
      }

      totalDistance += nearestDist;
      ordered.push({
        sequence: ordered.length + 1,
        stopId: nearest.stopId,
        name: nearest.name,
        lat: nearest.lat,
        lng: nearest.lng,
        distanceFromPrevious: Math.round(nearestDist * 100) / 100,
        cumulativeDistance: Math.round(totalDistance * 100) / 100,
        serviceMins: nearest.serviceMins || 15,
        timeWindowStart: nearest.timeWindowStart || null,
        timeWindowEnd: nearest.timeWindowEnd || null,
      });

      currentLat = nearest.lat;
      currentLng = nearest.lng;
      remaining.splice(nearestIdx, 1);
    }

    // Return leg
    if (returnToOrigin && origin) {
      const returnDist = haversine(currentLat, currentLng, origin.lat, origin.lng);
      totalDistance += returnDist;
    }

    // Estimate total time: assume 30 mph average speed + service time
    const avgSpeed = params.avgSpeedMph || 30;
    const totalDriveMinutes = Math.round((totalDistance / avgSpeed) * 60);
    const totalServiceMinutes = ordered.reduce((s, stop) => s + (stop.serviceMins || 0), 0);
    const totalMinutes = totalDriveMinutes + totalServiceMinutes;

    const result = {
      generatedAt: new Date().toISOString(),
      origin,
      stopCount: ordered.length,
      totalDistanceMiles: Math.round(totalDistance * 100) / 100,
      estimatedDriveMinutes: totalDriveMinutes,
      estimatedServiceMinutes: totalServiceMinutes,
      estimatedTotalMinutes: totalMinutes,
      returnToOrigin,
      optimizedRoute: ordered,
    };

    artifact.data.optimizedRoute = result;

    return { ok: true, result };
  });

  /**
   * hosCheck
   * Verify driver hours of service against FMCSA regulations.
   * artifact.data.drivers: [{ driverId, name, logs: [{ date, drivingHours, onDutyHours, offDutyHours, sleeperHours }] }]
   * Regulations: 11-hour driving limit, 14-hour on-duty window, 60/70 hour 7/8-day limit
   */
  registerLensAction("logistics", "hosCheck", async (ctx, artifact, params) => {
    const drivers = artifact.data.drivers || [];
    const cycleType = params.cycleType || "70-8"; // "60-7" or "70-8"
    const cycleDays = cycleType === "60-7" ? 7 : 8;
    const cycleLimit = cycleType === "60-7" ? 60 : 70;
    const drivingLimit = 11;
    const onDutyWindow = 14;

    const today = new Date();
    const results = [];

    for (const driver of drivers) {
      const logs = (driver.logs || []).sort((a, b) => new Date(b.date) - new Date(a.date));
      const todayLog = logs[0] || {};

      // Today's check
      const todayDriving = parseFloat(todayLog.drivingHours) || 0;
      const todayOnDuty = parseFloat(todayLog.onDutyHours) || 0;
      const drivingRemaining = Math.max(0, drivingLimit - todayDriving);
      const windowRemaining = Math.max(0, onDutyWindow - todayOnDuty);

      // Cycle check: sum on-duty hours in last N days
      const cycleStart = new Date(today);
      cycleStart.setDate(cycleStart.getDate() - cycleDays);
      const cycleLogs = logs.filter((l) => new Date(l.date) > cycleStart);
      const cycleHours = cycleLogs.reduce((s, l) => s + (parseFloat(l.onDutyHours) || 0), 0);
      const cycleRemaining = Math.max(0, cycleLimit - cycleHours);

      // 34-hour restart check
      let consecutiveOffDuty = 0;
      for (const log of logs) {
        const offDuty = (parseFloat(log.offDutyHours) || 0) + (parseFloat(log.sleeperHours) || 0);
        if (offDuty >= 10) {
          consecutiveOffDuty += offDuty;
        } else {
          break;
        }
      }
      const restartAvailable = consecutiveOffDuty >= 34;

      const violations = [];
      if (todayDriving > drivingLimit) violations.push(`Driving hours exceeded: ${todayDriving}/${drivingLimit}`);
      if (todayOnDuty > onDutyWindow) violations.push(`On-duty window exceeded: ${todayOnDuty}/${onDutyWindow}`);
      if (cycleHours > cycleLimit) violations.push(`Cycle hours exceeded: ${cycleHours}/${cycleLimit}`);

      results.push({
        driverId: driver.driverId,
        name: driver.name,
        today: {
          drivingHours: todayDriving,
          onDutyHours: todayOnDuty,
          drivingRemaining: Math.round(drivingRemaining * 10) / 10,
          windowRemaining: Math.round(windowRemaining * 10) / 10,
        },
        cycle: {
          type: cycleType,
          hoursUsed: Math.round(cycleHours * 10) / 10,
          hoursRemaining: Math.round(cycleRemaining * 10) / 10,
          restartAvailable,
        },
        violations,
        status: violations.length > 0 ? "violation" : drivingRemaining <= 1 || cycleRemaining <= 5 ? "warning" : "compliant",
      });
    }

    const report = {
      checkedAt: new Date().toISOString(),
      cycleType,
      driversChecked: results.length,
      violationCount: results.filter((r) => r.status === "violation").length,
      warningCount: results.filter((r) => r.status === "warning").length,
      drivers: results,
    };

    artifact.data.hosReport = report;

    return { ok: true, result: report };
  });

  /**
   * maintenanceDue
   * Flag vehicles past their service interval (mileage or calendar).
   * artifact.data.vehicles: [{ vehicleId, name, type, currentMileage, lastServiceMileage, serviceIntervalMiles, lastServiceDate, serviceIntervalDays }]
   */
  registerLensAction("logistics", "maintenanceDue", async (ctx, artifact, params) => {
    const vehicles = artifact.data.vehicles || [];
    const now = new Date();

    const overdue = [];
    const upcoming = [];
    const current = [];

    for (const vehicle of vehicles) {
      const curMiles = parseFloat(vehicle.currentMileage) || 0;
      const lastMiles = parseFloat(vehicle.lastServiceMileage) || 0;
      const intervalMiles = parseFloat(vehicle.serviceIntervalMiles) || 5000;
      const milesSinceService = curMiles - lastMiles;
      const milesUntilDue = intervalMiles - milesSinceService;

      const lastDate = vehicle.lastServiceDate ? new Date(vehicle.lastServiceDate) : null;
      const intervalDays = parseInt(vehicle.serviceIntervalDays) || 90;
      const daysSince = lastDate ? Math.floor((now - lastDate) / 86400000) : null;
      const daysUntilDue = daysSince !== null ? intervalDays - daysSince : null;

      const isMileageOverdue = milesUntilDue <= 0;
      const isCalendarOverdue = daysUntilDue !== null && daysUntilDue <= 0;
      const isOverdue = isMileageOverdue || isCalendarOverdue;
      const isUpcoming = !isOverdue && (milesUntilDue <= intervalMiles * 0.1 || (daysUntilDue !== null && daysUntilDue <= 14));

      const entry = {
        vehicleId: vehicle.vehicleId,
        name: vehicle.name,
        type: vehicle.type,
        currentMileage: curMiles,
        milesSinceService: Math.round(milesSinceService),
        milesUntilDue: Math.round(milesUntilDue),
        daysSinceService: daysSince,
        daysUntilDue,
        overdueReason: isOverdue
          ? [isMileageOverdue && "mileage", isCalendarOverdue && "calendar"].filter(Boolean)
          : [],
      };

      if (isOverdue) overdue.push({ ...entry, status: "overdue" });
      else if (isUpcoming) upcoming.push({ ...entry, status: "upcoming" });
      else current.push({ ...entry, status: "current" });
    }

    overdue.sort((a, b) => a.milesUntilDue - b.milesUntilDue);

    const report = {
      checkedAt: new Date().toISOString(),
      totalVehicles: vehicles.length,
      overdueCount: overdue.length,
      upcomingCount: upcoming.length,
      currentCount: current.length,
      overdue,
      upcoming,
    };

    artifact.data.vehicleMaintenanceReport = report;

    return { ok: true, result: report };
  });

  /**
   * inventoryAudit
   * Compare physical count quantities vs system quantities to identify discrepancies.
   * artifact.data.inventoryRecords: [{ sku, name, systemQty, physicalQty, location, unitCost }]
   * params.tolerancePct (default 2) — acceptable variance percentage
   */
  registerLensAction("logistics", "inventoryAudit", async (ctx, artifact, params) => {
    const records = artifact.data.inventoryRecords || [];
    const tolerancePct = params.tolerancePct != null ? params.tolerancePct : 2;

    const discrepancies = [];
    const withinTolerance = [];
    let totalSystemValue = 0;
    let totalPhysicalValue = 0;

    for (const record of records) {
      const systemQty = parseFloat(record.systemQty) || 0;
      const physicalQty = parseFloat(record.physicalQty) || 0;
      const unitCost = parseFloat(record.unitCost) || 0;
      const diff = physicalQty - systemQty;
      const variancePct = systemQty !== 0 ? Math.round((Math.abs(diff) / systemQty) * 10000) / 100 : (diff !== 0 ? 100 : 0);
      const valueDiff = Math.round(diff * unitCost * 100) / 100;

      totalSystemValue += systemQty * unitCost;
      totalPhysicalValue += physicalQty * unitCost;

      const entry = {
        sku: record.sku,
        name: record.name,
        location: record.location,
        systemQty,
        physicalQty,
        difference: diff,
        variancePct,
        valueDifference: valueDiff,
      };

      if (variancePct > tolerancePct) {
        discrepancies.push({ ...entry, status: diff > 0 ? "overage" : "shortage" });
      } else {
        withinTolerance.push({ ...entry, status: "within-tolerance" });
      }
    }

    discrepancies.sort((a, b) => Math.abs(b.valueDifference) - Math.abs(a.valueDifference));

    const totalValueDiscrepancy = discrepancies.reduce((s, d) => s + d.valueDifference, 0);
    const accuracyRate = records.length > 0
      ? Math.round((withinTolerance.length / records.length) * 10000) / 100
      : 100;

    const report = {
      auditedAt: new Date().toISOString(),
      tolerancePct,
      totalSkus: records.length,
      discrepancyCount: discrepancies.length,
      withinToleranceCount: withinTolerance.length,
      accuracyRate,
      totalSystemValue: Math.round(totalSystemValue * 100) / 100,
      totalPhysicalValue: Math.round(totalPhysicalValue * 100) / 100,
      totalValueDiscrepancy: Math.round(totalValueDiscrepancy * 100) / 100,
      discrepancies,
    };

    artifact.data.inventoryAudit = report;

    return { ok: true, result: report };
  });
};
