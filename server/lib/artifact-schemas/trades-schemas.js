import { registerSchema } from "../artifact-schemas.js";

registerSchema("trades", "generate-performance", {
  required: ["title", "period", "trades", "summary"],
  properties: {
    title: { type: "string" },
    period: { type: "string" },
    trades: {
      type: "array",
      minItems: 1,
      items: {
        required: ["symbol", "action", "quantity", "price"],
        properties: {
          symbol: { type: "string" },
          action: { type: "string", enum: ["buy", "sell", "short", "cover"] },
          quantity: { type: "number", min: 0 },
          price: { type: "number", min: 0 },
          date: { type: "string" },
          pnl: { type: "number" },
        },
      },
    },
    summary: {
      properties: {
        totalPnl: { type: "number" },
        winRate: { type: "number", min: 0, max: 100 },
        totalTrades: { type: "number" },
        averageReturn: { type: "number" },
      },
    },
  },
});

registerSchema("trades", "analyze-journal", {
  required: ["title", "entries", "insights"],
  properties: {
    title: { type: "string" },
    entries: { type: "array", minItems: 1 },
    insights: { type: "array", minItems: 1 },
  },
});
