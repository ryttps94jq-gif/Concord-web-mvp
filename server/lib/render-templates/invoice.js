/**
 * Invoice Section Builder — transforms accounting/finance invoice data
 * into the structured section format consumed by the PDF renderer.
 */

/**
 * Build invoice sections from artifact data.
 *
 * @param {Object} data - artifact.data containing invoice fields
 * @returns {Array} sections array for renderPDF
 */
export function buildInvoiceSections(data) {
  const sections = [];

  // Invoice header metadata
  sections.push({
    type: "meta",
    fields: [
      { label: "Invoice #", value: data.invoiceNumber || data.id || "—" },
      { label: "Date", value: data.date || data.invoiceDate || data.createdAt || "—" },
      { label: "Due Date", value: data.dueDate || "—" },
      { label: "Status", value: data.status || "draft" },
    ],
  });

  // Bill-to / Client info
  const client = data.client || data.customer || data.billTo || {};
  if (client.name || client.company) {
    sections.push({ type: "heading", text: "Bill To" });
    const clientFields = [];
    if (client.company) clientFields.push({ label: "Company", value: client.company });
    if (client.name) clientFields.push({ label: "Name", value: client.name });
    if (client.email) clientFields.push({ label: "Email", value: client.email });
    if (client.address) clientFields.push({ label: "Address", value: client.address });
    if (client.phone) clientFields.push({ label: "Phone", value: client.phone });
    sections.push({ type: "meta", fields: clientFields });
  }

  // Line items
  const items = data.items || data.lineItems || data.entries || [];
  if (items.length) {
    sections.push({ type: "heading", text: "Line Items" });

    const headers = ["Description", "Qty", "Unit Price", "Amount"];
    const rows = items.map((item) => {
      const qty = item.quantity || item.qty || 1;
      const price = item.unitPrice || item.unitCost || item.price || item.rate || 0;
      const amount = item.amount || item.total || qty * price;
      return [
        item.description || item.name || item.item || "—",
        String(qty),
        formatCurrency(price, data.currency),
        formatCurrency(amount, data.currency),
      ];
    });

    sections.push({ type: "table", headers, rows });
  }

  // Totals
  sections.push({ type: "heading", text: "Summary" });
  const subtotal = data.subtotal || items.reduce((sum, i) => {
    const qty = i.quantity || i.qty || 1;
    const price = i.unitPrice || i.unitCost || i.price || i.rate || 0;
    return sum + (i.amount || i.total || qty * price);
  }, 0);

  const taxRate = data.taxRate || data.tax_rate || 0;
  const taxAmount = data.taxAmount || data.tax || (subtotal * taxRate / 100);
  const discount = data.discount || 0;
  const total = data.total || data.grandTotal || (subtotal + taxAmount - discount);

  const summaryRows = [["Subtotal", formatCurrency(subtotal, data.currency)]];
  if (taxRate || taxAmount) summaryRows.push(["Tax" + (taxRate ? ` (${taxRate}%)` : ""), formatCurrency(taxAmount, data.currency)]);
  if (discount) summaryRows.push(["Discount", "-" + formatCurrency(discount, data.currency)]);
  summaryRows.push(["Total", formatCurrency(total, data.currency)]);

  sections.push({ type: "table", headers: ["", "Amount"], rows: summaryRows });

  // Notes / Terms
  if (data.notes || data.terms) {
    sections.push({ type: "heading", text: "Notes & Terms" });
    if (data.notes) sections.push({ type: "text", text: data.notes });
    if (data.terms) sections.push({ type: "text", text: data.terms });
  }

  // Payment info
  if (data.paymentMethod || data.bankDetails) {
    sections.push({ type: "heading", text: "Payment Information" });
    if (data.paymentMethod) sections.push({ type: "text", text: `Method: ${data.paymentMethod}` });
    if (data.bankDetails) sections.push({ type: "text", text: data.bankDetails });
  }

  return sections;
}

function formatCurrency(amount, currency) {
  const symbol = { USD: "$", EUR: "\u20AC", GBP: "\u00A3", CAD: "CA$", AUD: "AU$" }[currency] || "$";
  return `${symbol}${Number(amount || 0).toFixed(2)}`;
}
