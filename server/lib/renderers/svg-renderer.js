/**
 * SVG Renderer — lightweight SVG generators for visual domains.
 * Pure string concatenation, zero dependencies.
 */

/**
 * Escape XML special characters.
 */
function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Render a color palette as an SVG with labeled swatches.
 *
 * @param {Object[]} colors - Array of { hex, name } objects
 * @returns {Buffer} SVG file buffer
 */
export function renderPaletteSVG(colors) {
  if (!colors?.length) return Buffer.from("<svg/>", "utf-8");

  const w = 80, h = 120, gap = 10, padBottom = 40;
  const totalW = colors.length * (w + gap) - gap;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${h + padBottom}" viewBox="0 0 ${totalW} ${h + padBottom}">`;
  svg += `<rect width="100%" height="100%" fill="#ffffff"/>`;

  colors.forEach((c, i) => {
    const x = i * (w + gap);
    const hex = c.hex || c.color || "#cccccc";
    const name = c.name || c.label || hex;
    svg += `<rect x="${x}" y="0" width="${w}" height="${h}" fill="${esc(hex)}" rx="8"/>`;
    svg += `<text x="${x + w / 2}" y="${h + 16}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#333">${esc(name)}</text>`;
    svg += `<text x="${x + w / 2}" y="${h + 30}" text-anchor="middle" font-family="monospace" font-size="9" fill="#888">${esc(hex)}</text>`;
  });

  svg += "</svg>";
  return Buffer.from(svg, "utf-8");
}

/**
 * Render a cluster visualization as SVG.
 *
 * @param {Object[]} clusters - Array of { label, size, x?, y?, color? } objects
 * @returns {Buffer} SVG file buffer
 */
export function renderClusterSVG(clusters) {
  if (!clusters?.length) return Buffer.from("<svg/>", "utf-8");

  const canvasW = 600, canvasH = 400;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">`;
  svg += `<rect width="100%" height="100%" fill="#fafafa"/>`;

  const maxSize = Math.max(...clusters.map((c) => c.size || 1));
  const defaultColors = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7"];

  clusters.forEach((c, i) => {
    const radius = Math.max(15, Math.min(80, ((c.size || 1) / maxSize) * 80));
    const cx = c.x != null ? c.x : 80 + (i % 5) * 110;
    const cy = c.y != null ? c.y : 80 + Math.floor(i / 5) * 120;
    const fill = c.color || defaultColors[i % defaultColors.length];

    svg += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${esc(fill)}" opacity="0.7"/>`;
    svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#333">${esc(c.label || `Cluster ${i + 1}`)}</text>`;
    svg += `<text x="${cx}" y="${cy + 18}" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#666">(${c.size || 0})</text>`;
  });

  svg += "</svg>";
  return Buffer.from(svg, "utf-8");
}

/**
 * Render a simple bar chart as SVG.
 *
 * @param {Object} opts - { title, labels: string[], values: number[], color? }
 * @returns {Buffer} SVG file buffer
 */
export function renderBarChartSVG({ title, labels, values, color }) {
  if (!labels?.length || !values?.length) return Buffer.from("<svg/>", "utf-8");

  const barW = 40, gap = 20, padL = 60, padT = 50, padB = 60;
  const chartH = 250;
  const canvasW = padL + labels.length * (barW + gap) + 20;
  const canvasH = padT + chartH + padB;
  const maxVal = Math.max(...values, 1);
  const fill = color || "#4e79a7";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">`;
  svg += `<rect width="100%" height="100%" fill="#ffffff"/>`;

  if (title) {
    svg += `<text x="${canvasW / 2}" y="24" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="#333">${esc(title)}</text>`;
  }

  // Axis
  svg += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="#ccc" stroke-width="1"/>`;
  svg += `<line x1="${padL}" y1="${padT + chartH}" x2="${canvasW - 10}" y2="${padT + chartH}" stroke="#ccc" stroke-width="1"/>`;

  labels.forEach((label, i) => {
    const barH = (values[i] / maxVal) * chartH;
    const x = padL + i * (barW + gap) + gap;
    const y = padT + chartH - barH;

    svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${esc(fill)}" rx="2"/>`;
    svg += `<text x="${x + barW / 2}" y="${padT + chartH + 16}" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#666">${esc(label)}</text>`;
    svg += `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#333">${values[i]}</text>`;
  });

  svg += "</svg>";
  return Buffer.from(svg, "utf-8");
}
