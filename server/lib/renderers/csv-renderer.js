/**
 * CSV Renderer — lightweight CSV builder for data-heavy domains.
 * Pure string concatenation, zero dependencies.
 */

function escape(s) {
  s = String(s ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

/**
 * Render headers + rows into a CSV buffer.
 *
 * @param {string[]} headers - Column header names
 * @param {Array[]} rows - Array of row arrays
 * @returns {Buffer} CSV file buffer
 */
export function renderCSV(headers, rows) {
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  return Buffer.from(lines.join("\n"), "utf-8");
}

/**
 * Extract headers and rows from artifact data.
 * Looks for the primary array field (items, entries, transactions, etc.)
 * and maps object fields into a table.
 *
 * @param {Object} data - artifact.data object
 * @returns {{ headers: string[], rows: Array[] }}
 */
export function extractTableFromData(data) {
  if (!data || typeof data !== "object") return { headers: [], rows: [] };

  const arrayKeys = Object.keys(data).filter((k) => Array.isArray(data[k]) && data[k].length > 0);
  const primaryKey =
    arrayKeys.find((k) =>
      [
        "items", "entries", "cards", "events", "records", "rows",
        "transactions", "posts", "tasks", "members", "claims",
        "trades", "orders", "products", "metrics", "results",
        "crops", "tickets", "donors", "policies", "properties",
      ].includes(k)
    ) || arrayKeys[0];

  if (!primaryKey) {
    // Flat scalar export
    const scalarEntries = Object.entries(data).filter(
      ([, v]) => v !== null && v !== undefined && typeof v !== "object"
    );
    if (!scalarEntries.length) return { headers: [], rows: [] };
    return {
      headers: scalarEntries.map(([k]) => k),
      rows: [scalarEntries.map(([, v]) => String(v))],
    };
  }

  const items = data[primaryKey];
  const colSet = new Set();
  items.forEach((item) => {
    if (item && typeof item === "object") Object.keys(item).forEach((k) => colSet.add(k));
  });
  const headers = Array.from(colSet);
  const rows = items
    .filter((item) => item && typeof item === "object")
    .map((item) => headers.map((h) => String(item[h] ?? "")));

  return { headers, rows };
}
