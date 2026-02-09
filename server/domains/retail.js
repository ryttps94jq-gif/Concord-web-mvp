// server/domains/retail.js
// Domain actions for retail/CRM: reorder, pipeline, LTV, SLA checks.

module.exports = function registerRetailActions(registerLensAction) {
  /**
   * reorderCheck
   * Flag products that have fallen below their reorder point.
   * artifact.data.products: [{ sku, name, onHand, reorderPoint, reorderQty, leadTimeDays, dailyUsage }]
   */
  registerLensAction("retail", "reorderCheck", async (ctx, artifact, params) => {
    const products = artifact.data.products || artifact.data.inventory || [];

    const needsReorder = [];
    const critical = [];
    const sufficient = [];

    for (const product of products) {
      const onHand = parseFloat(product.onHand) || 0;
      const reorderPoint = parseFloat(product.reorderPoint) || 0;
      const dailyUsage = parseFloat(product.dailyUsage) || 0;
      const leadTimeDays = parseFloat(product.leadTimeDays) || 7;
      const daysOfStock = dailyUsage > 0 ? Math.floor(onHand / dailyUsage) : Infinity;
      const willStockOutBeforeDelivery = daysOfStock < leadTimeDays;

      const entry = {
        sku: product.sku,
        name: product.name,
        onHand,
        reorderPoint,
        reorderQty: product.reorderQty || 0,
        daysOfStock: daysOfStock === Infinity ? "N/A" : daysOfStock,
        leadTimeDays,
      };

      if (onHand <= 0) {
        critical.push({ ...entry, status: "out-of-stock" });
      } else if (onHand <= reorderPoint && willStockOutBeforeDelivery) {
        critical.push({ ...entry, status: "critical-low" });
      } else if (onHand <= reorderPoint) {
        needsReorder.push({ ...entry, status: "below-reorder-point" });
      } else {
        sufficient.push({ ...entry, status: "sufficient" });
      }
    }

    const report = {
      checkedAt: new Date().toISOString(),
      totalProducts: products.length,
      criticalCount: critical.length,
      reorderCount: needsReorder.length,
      sufficientCount: sufficient.length,
      critical,
      needsReorder,
    };

    artifact.data.reorderReport = report;

    return { ok: true, result: report };
  });

  /**
   * pipelineValue
   * Calculate weighted pipeline value from deals/opportunities.
   * artifact.data.deals: [{ name, value, probability, stage, expectedCloseDate }]
   */
  registerLensAction("retail", "pipelineValue", async (ctx, artifact, params) => {
    const deals = artifact.data.deals || artifact.data.opportunities || [];
    const includeClosed = params.includeClosed || false;

    const activeDealsList = includeClosed
      ? deals
      : deals.filter((d) => d.stage !== "closed-won" && d.stage !== "closed-lost");

    let totalUnweighted = 0;
    let totalWeighted = 0;

    const byStage = {};

    const detailed = activeDealsList.map((deal) => {
      const value = parseFloat(deal.value) || 0;
      const probability = parseFloat(deal.probability) || 0;
      const weighted = Math.round(value * (probability / 100) * 100) / 100;
      const stage = deal.stage || "unknown";

      totalUnweighted += value;
      totalWeighted += weighted;

      if (!byStage[stage]) {
        byStage[stage] = { count: 0, totalValue: 0, weightedValue: 0 };
      }
      byStage[stage].count++;
      byStage[stage].totalValue = Math.round((byStage[stage].totalValue + value) * 100) / 100;
      byStage[stage].weightedValue = Math.round((byStage[stage].weightedValue + weighted) * 100) / 100;

      return {
        name: deal.name,
        stage,
        value,
        probability,
        weightedValue: weighted,
        expectedCloseDate: deal.expectedCloseDate || null,
      };
    });

    // Deals closing this month
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const closingThisMonth = detailed.filter((d) => {
      if (!d.expectedCloseDate) return false;
      const close = new Date(d.expectedCloseDate);
      return close >= now && close <= monthEnd;
    });

    const result = {
      generatedAt: new Date().toISOString(),
      dealCount: activeDealsList.length,
      totalUnweightedValue: Math.round(totalUnweighted * 100) / 100,
      totalWeightedValue: Math.round(totalWeighted * 100) / 100,
      avgDealSize: activeDealsList.length > 0 ? Math.round((totalUnweighted / activeDealsList.length) * 100) / 100 : 0,
      byStage,
      closingThisMonth: {
        count: closingThisMonth.length,
        weightedValue: Math.round(closingThisMonth.reduce((s, d) => s + d.weightedValue, 0) * 100) / 100,
      },
    };

    artifact.data.pipelineReport = result;

    return { ok: true, result };
  });

  /**
   * customerLTV
   * Compute lifetime value from order history.
   * artifact.data.customers: [{ customerId, name, orders: [{ date, total }], acquisitionDate }]
   * params.customerId — compute for one customer (or all if omitted)
   */
  registerLensAction("retail", "customerLTV", async (ctx, artifact, params) => {
    const customers = artifact.data.customers || [];
    const targetId = params.customerId || null;

    const subset = targetId
      ? customers.filter((c) => c.customerId === targetId)
      : customers;

    if (subset.length === 0) {
      return { ok: true, result: { error: "No matching customers found." } };
    }

    const now = new Date();
    const ltvData = subset.map((cust) => {
      const orders = cust.orders || [];
      const totalRevenue = orders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
      const orderCount = orders.length;
      const avgOrderValue = orderCount > 0 ? Math.round((totalRevenue / orderCount) * 100) / 100 : 0;

      // Compute lifespan in months
      const acqDate = cust.acquisitionDate ? new Date(cust.acquisitionDate) : null;
      let lifespanMonths = null;
      if (acqDate) {
        lifespanMonths = Math.max(1,
          (now.getFullYear() - acqDate.getFullYear()) * 12 + (now.getMonth() - acqDate.getMonth())
        );
      }

      // Purchase frequency: orders per month
      const purchaseFrequency = lifespanMonths ? Math.round((orderCount / lifespanMonths) * 100) / 100 : null;

      // Simple LTV = avg order value x purchase frequency x projected lifespan (default 24 months)
      const projectedMonths = params.projectedMonths || 24;
      const ltv = purchaseFrequency != null
        ? Math.round(avgOrderValue * purchaseFrequency * projectedMonths * 100) / 100
        : Math.round(totalRevenue * 100) / 100;

      // Days since last order
      let daysSinceLastOrder = null;
      if (orders.length > 0) {
        const sorted = orders.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
        daysSinceLastOrder = Math.floor((now - new Date(sorted[0].date)) / 86400000);
      }

      return {
        customerId: cust.customerId,
        name: cust.name,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        orderCount,
        avgOrderValue,
        lifespanMonths,
        purchaseFrequency,
        projectedLTV: ltv,
        daysSinceLastOrder,
        atRisk: daysSinceLastOrder != null && daysSinceLastOrder > (params.atRiskDays || 90),
      };
    });

    // Summary stats
    const totalLTV = ltvData.reduce((s, c) => s + c.projectedLTV, 0);
    const avgLTV = ltvData.length > 0 ? Math.round((totalLTV / ltvData.length) * 100) / 100 : 0;
    const atRiskCount = ltvData.filter((c) => c.atRisk).length;

    // Sort by LTV descending
    ltvData.sort((a, b) => b.projectedLTV - a.projectedLTV);

    const report = {
      generatedAt: new Date().toISOString(),
      customersAnalyzed: ltvData.length,
      totalProjectedLTV: Math.round(totalLTV * 100) / 100,
      avgProjectedLTV: avgLTV,
      atRiskCount,
      customers: ltvData,
    };

    artifact.data.ltvReport = report;

    return { ok: true, result: report };
  });

  /**
   * slaStatus
   * Check support tickets against SLA deadlines.
   * artifact.data.tickets: [{ ticketId, subject, priority, createdAt, resolvedAt, slaHours }]
   * params.defaultSlaHours — default SLA if not per-ticket (default 24)
   */
  registerLensAction("retail", "slaStatus", async (ctx, artifact, params) => {
    const tickets = artifact.data.tickets || [];
    const defaultSlaHours = params.defaultSlaHours || 24;
    const now = new Date();

    const slaByPriority = params.slaByPriority || {
      critical: 4,
      high: 8,
      medium: 24,
      low: 48,
    };

    const analyzed = tickets.map((ticket) => {
      const created = new Date(ticket.createdAt);
      const slaHours = ticket.slaHours || slaByPriority[ticket.priority] || defaultSlaHours;
      const deadline = new Date(created.getTime() + slaHours * 3600000);

      const resolved = ticket.resolvedAt ? new Date(ticket.resolvedAt) : null;
      const isOpen = !resolved;

      let status;
      let timeToResolutionHours = null;
      let remainingHours = null;

      if (resolved) {
        timeToResolutionHours = Math.round(((resolved - created) / 3600000) * 100) / 100;
        status = timeToResolutionHours <= slaHours ? "met" : "breached";
      } else {
        remainingHours = Math.round(((deadline - now) / 3600000) * 100) / 100;
        if (remainingHours < 0) {
          status = "breached";
        } else if (remainingHours < slaHours * 0.25) {
          status = "at-risk";
        } else {
          status = "on-track";
        }
      }

      return {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        priority: ticket.priority,
        slaHours,
        createdAt: ticket.createdAt,
        deadline: deadline.toISOString(),
        isOpen,
        status,
        timeToResolutionHours,
        remainingHours,
      };
    });

    const breached = analyzed.filter((t) => t.status === "breached");
    const atRisk = analyzed.filter((t) => t.status === "at-risk");
    const met = analyzed.filter((t) => t.status === "met");
    const onTrack = analyzed.filter((t) => t.status === "on-track");

    const closedTickets = analyzed.filter((t) => !t.isOpen);
    const slaComplianceRate = closedTickets.length > 0
      ? Math.round((met.length / closedTickets.length) * 10000) / 100
      : 100;

    const report = {
      checkedAt: new Date().toISOString(),
      totalTickets: tickets.length,
      breachedCount: breached.length,
      atRiskCount: atRisk.length,
      onTrackCount: onTrack.length,
      metCount: met.length,
      slaComplianceRate,
      breached,
      atRisk,
    };

    artifact.data.slaReport = report;

    return { ok: true, result: report };
  });
};
