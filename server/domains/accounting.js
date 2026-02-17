// server/domains/accounting.js
// Domain actions for accounting: trial balance, P&L, invoice aging, budget variance, rent roll.

export default function registerAccountingActions(registerLensAction) {
  /**
   * trialBalance
   * Generate a trial balance from the chart of accounts.
   * artifact.data.accounts: [{ accountNumber, name, type, normalBalance, entries: [{ date, debit, credit, memo }] }]
   * params.asOfDate — optional cutoff date (ISO string)
   */
  registerLensAction("accounting", "trialBalance", (ctx, artifact, params) => {
    const accounts = artifact.data.accounts || [];
    const asOfDate = params.asOfDate ? new Date(params.asOfDate) : null;

    let totalDebits = 0;
    let totalCredits = 0;
    const rows = [];

    for (const acct of accounts) {
      let debitSum = 0;
      let creditSum = 0;

      for (const entry of (acct.entries || [])) {
        if (asOfDate && new Date(entry.date) > asOfDate) continue;
        debitSum += parseFloat(entry.debit) || 0;
        creditSum += parseFloat(entry.credit) || 0;
      }

      const netDebit = Math.round((debitSum - creditSum) * 100) / 100;
      const balanceDebit = netDebit > 0 ? Math.abs(netDebit) : 0;
      const balanceCredit = netDebit < 0 ? Math.abs(netDebit) : 0;

      totalDebits += balanceDebit;
      totalCredits += balanceCredit;

      rows.push({
        accountNumber: acct.accountNumber,
        name: acct.name,
        type: acct.type,
        debit: Math.round(balanceDebit * 100) / 100,
        credit: Math.round(balanceCredit * 100) / 100,
      });
    }

    totalDebits = Math.round(totalDebits * 100) / 100;
    totalCredits = Math.round(totalCredits * 100) / 100;
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    const result = {
      generatedAt: new Date().toISOString(),
      asOfDate: asOfDate ? asOfDate.toISOString().split("T")[0] : "current",
      accounts: rows.sort((a, b) => (a.accountNumber || "").localeCompare(b.accountNumber || "")),
      totalDebits,
      totalCredits,
      difference: Math.round((totalDebits - totalCredits) * 100) / 100,
      isBalanced,
    };

    artifact.data.trialBalance = result;

    return { ok: true, result };
  });

  /**
   * profitLoss
   * Generate a P&L statement for a given period.
   * artifact.data.accounts: same as trialBalance
   * params.startDate, params.endDate — period boundaries
   */
  registerLensAction("accounting", "profitLoss", (ctx, artifact, params) => {
    const accounts = artifact.data.accounts || [];
    const startDate = params.startDate ? new Date(params.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = params.endDate ? new Date(params.endDate) : new Date();

    const revenueAccounts = accounts.filter((a) => a.type === "revenue" || a.type === "income");
    const expenseAccounts = accounts.filter((a) => a.type === "expense");
    const cogsAccounts = accounts.filter((a) => a.type === "cogs" || a.type === "cost-of-goods-sold");

    const sumEntries = (acctList) => {
      const lines = [];
      let total = 0;
      for (const acct of acctList) {
        let acctTotal = 0;
        for (const entry of (acct.entries || [])) {
          const entryDate = new Date(entry.date);
          if (entryDate >= startDate && entryDate <= endDate) {
            const credit = parseFloat(entry.credit) || 0;
            const debit = parseFloat(entry.debit) || 0;
            acctTotal += credit - debit;
          }
        }
        acctTotal = Math.round(acctTotal * 100) / 100;
        total += acctTotal;
        lines.push({ accountNumber: acct.accountNumber, name: acct.name, amount: acctTotal });
      }
      return { lines, total: Math.round(total * 100) / 100 };
    };

    const sumExpenses = (acctList) => {
      const lines = [];
      let total = 0;
      for (const acct of acctList) {
        let acctTotal = 0;
        for (const entry of (acct.entries || [])) {
          const entryDate = new Date(entry.date);
          if (entryDate >= startDate && entryDate <= endDate) {
            const debit = parseFloat(entry.debit) || 0;
            const credit = parseFloat(entry.credit) || 0;
            acctTotal += debit - credit;
          }
        }
        acctTotal = Math.round(acctTotal * 100) / 100;
        total += acctTotal;
        lines.push({ accountNumber: acct.accountNumber, name: acct.name, amount: acctTotal });
      }
      return { lines, total: Math.round(total * 100) / 100 };
    };

    const revenue = sumEntries(revenueAccounts);
    const cogs = sumExpenses(cogsAccounts);
    const expenses = sumExpenses(expenseAccounts);

    const grossProfit = Math.round((revenue.total - cogs.total) * 100) / 100;
    const grossMarginPct = revenue.total > 0 ? Math.round((grossProfit / revenue.total) * 10000) / 100 : 0;
    const netIncome = Math.round((grossProfit - expenses.total) * 100) / 100;
    const netMarginPct = revenue.total > 0 ? Math.round((netIncome / revenue.total) * 10000) / 100 : 0;

    const result = {
      generatedAt: new Date().toISOString(),
      period: { start: startDate.toISOString().split("T")[0], end: endDate.toISOString().split("T")[0] },
      revenue: { lines: revenue.lines, total: revenue.total },
      costOfGoodsSold: { lines: cogs.lines, total: cogs.total },
      grossProfit,
      grossMarginPct,
      operatingExpenses: { lines: expenses.lines, total: expenses.total },
      netIncome,
      netMarginPct,
    };

    artifact.data.profitLoss = result;

    return { ok: true, result };
  });

  /**
   * invoiceAging
   * Categorize unpaid invoices by age buckets: current, 1-30, 31-60, 61-90, 90+.
   * artifact.data.invoices: [{ invoiceId, customer, amount, issueDate, dueDate, paidDate }]
   */
  registerLensAction("accounting", "invoiceAging", (ctx, artifact, params) => {
    const invoices = artifact.data.invoices || [];
    const now = params.asOfDate ? new Date(params.asOfDate) : new Date();

    const unpaid = invoices.filter((inv) => !inv.paidDate);

    const buckets = {
      current: { invoices: [], total: 0 },
      "1-30": { invoices: [], total: 0 },
      "31-60": { invoices: [], total: 0 },
      "61-90": { invoices: [], total: 0 },
      "90+": { invoices: [], total: 0 },
    };

    for (const inv of unpaid) {
      const dueDate = new Date(inv.dueDate);
      const daysOverdue = Math.floor((now - dueDate) / 86400000);
      const amount = parseFloat(inv.amount) || 0;

      const entry = {
        invoiceId: inv.invoiceId,
        customer: inv.customer,
        amount,
        dueDate: inv.dueDate,
        daysOverdue: Math.max(0, daysOverdue),
      };

      let bucket;
      if (daysOverdue <= 0) bucket = "current";
      else if (daysOverdue <= 30) bucket = "1-30";
      else if (daysOverdue <= 60) bucket = "31-60";
      else if (daysOverdue <= 90) bucket = "61-90";
      else bucket = "90+";

      buckets[bucket].invoices.push(entry);
      buckets[bucket].total = Math.round((buckets[bucket].total + amount) * 100) / 100;
    }

    const totalOutstanding = Object.values(buckets).reduce((s, b) => s + b.total, 0);
    const totalOverdue = totalOutstanding - buckets.current.total;

    // Weighted average days outstanding
    let weightedDays = 0;
    for (const inv of unpaid) {
      const dueDate = new Date(inv.dueDate);
      const daysOut = Math.max(0, Math.floor((now - dueDate) / 86400000));
      const amount = parseFloat(inv.amount) || 0;
      weightedDays += daysOut * amount;
    }
    const avgDaysOutstanding = totalOutstanding > 0 ? Math.round(weightedDays / totalOutstanding) : 0;

    const result = {
      generatedAt: new Date().toISOString(),
      asOfDate: now.toISOString().split("T")[0],
      totalInvoices: invoices.length,
      unpaidCount: unpaid.length,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      avgDaysOutstanding,
      buckets,
    };

    artifact.data.invoiceAging = result;

    return { ok: true, result };
  });

  /**
   * budgetVariance
   * Compare actual vs planned amounts for budget line items.
   * artifact.data.budget: [{ category, planned, actual }]
   * params.period — label for the period
   */
  registerLensAction("accounting", "budgetVariance", (ctx, artifact, params) => {
    const budget = artifact.data.budget || [];
    const period = params.period || "current";

    let totalPlanned = 0;
    let totalActual = 0;

    const lines = budget.map((item) => {
      const planned = parseFloat(item.planned) || 0;
      const actual = parseFloat(item.actual) || 0;
      const variance = Math.round((actual - planned) * 100) / 100;
      const variancePct = planned !== 0 ? Math.round((variance / Math.abs(planned)) * 10000) / 100 : 0;

      totalPlanned += planned;
      totalActual += actual;

      return {
        category: item.category,
        planned,
        actual,
        variance,
        variancePct,
        status: variance > 0 ? "over-budget" : variance < 0 ? "under-budget" : "on-budget",
      };
    });

    const totalVariance = Math.round((totalActual - totalPlanned) * 100) / 100;
    const totalVariancePct = totalPlanned !== 0
      ? Math.round((totalVariance / Math.abs(totalPlanned)) * 10000) / 100
      : 0;

    const overBudgetItems = lines.filter((l) => l.status === "over-budget");
    const largestOverrun = overBudgetItems.length > 0
      ? overBudgetItems.reduce((max, l) => (l.variance > max.variance ? l : max), overBudgetItems[0])
      : null;

    const result = {
      generatedAt: new Date().toISOString(),
      period,
      lineItems: lines,
      totalPlanned: Math.round(totalPlanned * 100) / 100,
      totalActual: Math.round(totalActual * 100) / 100,
      totalVariance,
      totalVariancePct,
      overBudgetCount: overBudgetItems.length,
      largestOverrun,
    };

    artifact.data.budgetVariance = result;

    return { ok: true, result };
  });

  /**
   * rentRoll
   * Aggregate properties and their rent payment status.
   * artifact.data.properties: [{ propertyId, address, units: [{ unitId, tenant, monthlyRent, leaseEnd, paidThrough }] }]
   * params.asOfMonth — "YYYY-MM" to check (defaults to current month)
   */
  registerLensAction("accounting", "rentRoll", (ctx, artifact, params) => {
    const properties = artifact.data.properties || [];
    const now = new Date();
    const asOfMonth = params.asOfMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [year, month] = asOfMonth.split("-").map(Number);

    let totalExpectedRent = 0;
    let totalCollected = 0;
    let occupiedUnits = 0;
    let vacantUnits = 0;
    let totalUnits = 0;

    const propertyDetails = properties.map((prop) => {
      const units = prop.units || [];
      let propExpected = 0;
      let propCollected = 0;
      let propOccupied = 0;
      let propVacant = 0;

      const unitDetails = units.map((unit) => {
        totalUnits++;
        const rent = parseFloat(unit.monthlyRent) || 0;
        const isVacant = !unit.tenant;
        const leaseExpired = unit.leaseEnd ? new Date(unit.leaseEnd) < now : false;

        let paid = false;
        if (unit.paidThrough) {
          const paidDate = new Date(unit.paidThrough);
          paid = paidDate.getFullYear() > year ||
            (paidDate.getFullYear() === year && paidDate.getMonth() + 1 >= month);
        }

        if (isVacant) {
          propVacant++;
          vacantUnits++;
        } else {
          propOccupied++;
          occupiedUnits++;
          propExpected += rent;
          if (paid) propCollected += rent;
        }

        return {
          unitId: unit.unitId,
          tenant: unit.tenant || "VACANT",
          monthlyRent: rent,
          leaseEnd: unit.leaseEnd || null,
          leaseExpired,
          paidForMonth: paid,
          status: isVacant ? "vacant" : paid ? "paid" : "unpaid",
        };
      });

      totalExpectedRent += propExpected;
      totalCollected += propCollected;

      return {
        propertyId: prop.propertyId,
        address: prop.address,
        totalUnits: units.length,
        occupied: propOccupied,
        vacant: propVacant,
        expectedRent: Math.round(propExpected * 100) / 100,
        collected: Math.round(propCollected * 100) / 100,
        outstanding: Math.round((propExpected - propCollected) * 100) / 100,
        collectionRate: propExpected > 0 ? Math.round((propCollected / propExpected) * 10000) / 100 : 100,
        units: unitDetails,
      };
    });

    const result = {
      generatedAt: new Date().toISOString(),
      asOfMonth,
      totalProperties: properties.length,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 10000) / 100 : 0,
      totalExpectedRent: Math.round(totalExpectedRent * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalOutstanding: Math.round((totalExpectedRent - totalCollected) * 100) / 100,
      collectionRate: totalExpectedRent > 0 ? Math.round((totalCollected / totalExpectedRent) * 10000) / 100 : 100,
      properties: propertyDetails,
    };

    artifact.data.rentRoll = result;

    return { ok: true, result };
  });
};
