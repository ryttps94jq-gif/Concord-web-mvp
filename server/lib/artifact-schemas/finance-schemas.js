import { registerSchema } from "../artifact-schemas.js";

registerSchema("accounting", "generate-invoice", {
  required: ["invoiceNumber", "billTo", "lineItems", "subtotal", "total"],
  properties: {
    invoiceNumber: { type: "string" },
    issueDate: { type: "string" },
    dueDate: { type: "string" },
    billTo: {
      required: ["name"],
      properties: {
        name: { type: "string" },
        address: { type: "string" },
        email: { type: "string" },
      },
    },
    billFrom: {
      properties: {
        name: { type: "string" },
        address: { type: "string" },
      },
    },
    lineItems: {
      type: "array",
      minItems: 1,
      items: {
        required: ["description", "quantity", "unitPrice", "amount"],
        properties: {
          description: { type: "string", minLength: 3 },
          quantity: { type: "number", min: 0.01 },
          unitPrice: { type: "number", min: 0 },
          amount: { type: "number", min: 0 },
        },
      },
    },
    subtotal: { type: "number", min: 0 },
    taxRate: { type: "number", min: 0, max: 1 },
    taxAmount: { type: "number", min: 0 },
    total: { type: "number", min: 0 },
    notes: { type: "string" },
    paymentTerms: { type: "string" },
  },
});

registerSchema("accounting", "generate-statements", {
  required: ["title", "period", "incomeStatement"],
  properties: {
    title: { type: "string" },
    period: { type: "string" },
    incomeStatement: {
      required: ["revenue", "expenses", "netIncome"],
      properties: {
        revenue: { type: "array" },
        totalRevenue: { type: "number" },
        expenses: { type: "array" },
        totalExpenses: { type: "number" },
        netIncome: { type: "number" },
      },
    },
    balanceSheet: {
      properties: {
        assets: { type: "array" },
        liabilities: { type: "array" },
        equity: { type: "number" },
      },
    },
  },
});

registerSchema("finance", "build-model", {
  required: ["title", "assumptions", "projections"],
  properties: {
    title: { type: "string", minLength: 5 },
    assumptions: { type: "object" },
    projections: { type: "array", minItems: 1 },
    period: { type: "string" },
  },
});

registerSchema("finance", "generate-invoice", {
  required: ["invoiceNumber", "billTo", "lineItems", "total"],
  properties: {
    invoiceNumber: { type: "string" },
    billTo: { required: ["name"], properties: { name: { type: "string" } } },
    lineItems: { type: "array", minItems: 1 },
    total: { type: "number", min: 0 },
  },
});

registerSchema("finance", "forecast-revenue", {
  required: ["title", "periods", "totalProjected"],
  properties: {
    title: { type: "string" },
    periods: { type: "array", minItems: 1 },
    totalProjected: { type: "number" },
  },
});

registerSchema("billing", "generate-statement", {
  required: ["title", "entries", "totalDue"],
  properties: {
    title: { type: "string" },
    entries: { type: "array", minItems: 1 },
    totalDue: { type: "number", min: 0 },
  },
});
