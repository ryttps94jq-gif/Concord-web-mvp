/**
 * Render Registry — registers all domain/action → renderer mappings.
 *
 * Called once during init with helper functions from server.js to avoid
 * circular imports. Covers 70 of 106 lens domains:
 *   - 18 PDF domains (finance, accounting, law, healthcare, etc.)
 *   - 26 Markdown domains (paper, research, science, etc.)
 *   - 13 JSON domains (code, database, schema, ml, etc.)
 *   - 8 CSV domains (accounting/reconcile, trades, retail, etc.)
 *   - 4 ICS domains (calendar, events, insurance, law)
 *   - 4 SVG domains (art, whiteboard, math, graph)
 *   - 4 HTML domains (board, collab, feed, export)
 *   - 2 MIDI domains (studio, music)
 */

import { registerRenderer, slugify } from "./render-engine.js";
import { renderPDF } from "./renderers/pdf-renderer.js";
import { renderCSV, extractTableFromData } from "./renderers/csv-renderer.js";
import { renderICS, extractEvents } from "./renderers/ics-renderer.js";
import { renderPaletteSVG, renderClusterSVG, renderBarChartSVG } from "./renderers/svg-renderer.js";
import { renderMIDI } from "./renderers/midi-renderer.js";
import { renderHTML, buildRetroHTML, buildTeamPulseHTML } from "./renderers/html-renderer.js";

// PDF section builders for specialized templates
import { buildInvoiceSections } from "./render-templates/invoice.js";
import { buildCarePlanSections } from "./render-templates/care-plan.js";
import { buildContractSections } from "./render-templates/contract.js";
import { buildWorkoutSections } from "./render-templates/workout-program.js";
import { buildMealPlanSections } from "./render-templates/meal-plan.js";

/**
 * Register all renderers. Must be called with helper functions from server.js.
 *
 * @param {Object} helpers
 * @param {Function} helpers.exportPDFMarkup - _lensExportPDFMarkup(artifact) → { sections, pageInfo }
 * @param {Function} helpers.exportMarkdown - _lensExportMarkdown(artifact) → { markdown, charCount }
 * @param {Function} helpers.exportCSV - _lensExportCSV(artifact) → { csv, rowCount, arrayField }
 */
export function registerAllRenderers(helpers) {
  const { exportPDFMarkup, exportMarkdown, exportCSV } = helpers;

  // ── PDF Domains ──────────────────────────────────────────────────────────────
  // Generic PDF renderer: uses _lensExportPDFMarkup sections format

  function pdfFromMarkup(domain) {
    return async (artifact) => {
      const { sections, pageInfo } = exportPDFMarkup(artifact);
      const buffer = await renderPDF(sections, pageInfo);
      return { buffer, mimeType: "application/pdf", filename: `${slugify(artifact.title)}.pdf` };
    };
  }

  // Specialized PDF templates
  registerRenderer("accounting", "generate-invoice", async (artifact) => {
    const sections = buildInvoiceSections(artifact.data || {});
    const buffer = await renderPDF(sections, { title: `Invoice-${artifact.data?.invoiceNumber || artifact.id}`, domain: "accounting", generatedAt: new Date().toISOString() });
    return { buffer, mimeType: "application/pdf", filename: `invoice-${slugify(artifact.data?.invoiceNumber || artifact.id)}.pdf` };
  });

  registerRenderer("finance", "generate-invoice", async (artifact) => {
    const sections = buildInvoiceSections(artifact.data || {});
    const buffer = await renderPDF(sections, { title: `Invoice-${artifact.data?.invoiceNumber || artifact.id}`, domain: "finance", generatedAt: new Date().toISOString() });
    return { buffer, mimeType: "application/pdf", filename: `invoice-${slugify(artifact.data?.invoiceNumber || artifact.id)}.pdf` };
  });

  registerRenderer("healthcare", "build-care-plan", async (artifact) => {
    const sections = buildCarePlanSections(artifact.data || {});
    const buffer = await renderPDF(sections, { title: artifact.title || "Care Plan", domain: "healthcare", generatedAt: new Date().toISOString() });
    return { buffer, mimeType: "application/pdf", filename: `care-plan-${slugify(artifact.title || artifact.id)}.pdf` };
  });

  registerRenderer("healthcare", "generateSummary", async (artifact) => {
    const { sections, pageInfo } = exportPDFMarkup(artifact);
    const buffer = await renderPDF(sections, pageInfo);
    return { buffer, mimeType: "application/pdf", filename: `patient-summary-${slugify(artifact.title || artifact.id)}.pdf` };
  });

  registerRenderer("law", "draft-contract", async (artifact) => {
    const sections = buildContractSections(artifact.data || {});
    const buffer = await renderPDF(sections, { title: artifact.title || "Contract", domain: "law", generatedAt: new Date().toISOString() });
    return { buffer, mimeType: "application/pdf", filename: `contract-${slugify(artifact.title || artifact.id)}.pdf` };
  });

  registerRenderer("legal", "draft-contract", async (artifact) => {
    const sections = buildContractSections(artifact.data || {});
    const buffer = await renderPDF(sections, { title: artifact.title || "Contract", domain: "legal", generatedAt: new Date().toISOString() });
    return { buffer, mimeType: "application/pdf", filename: `contract-${slugify(artifact.title || artifact.id)}.pdf` };
  });

  registerRenderer("fitness", "build-program", async (artifact) => {
    const sections = buildWorkoutSections(artifact.data || {});
    const buffer = await renderPDF(sections, { title: artifact.title || "Workout Program", domain: "fitness", generatedAt: new Date().toISOString() });
    return { buffer, mimeType: "application/pdf", filename: `workout-${slugify(artifact.title || artifact.id)}.pdf` };
  });

  registerRenderer("food", "build-meal-plan", async (artifact) => {
    const sections = buildMealPlanSections(artifact.data || {});
    const buffer = await renderPDF(sections, { title: artifact.title || "Meal Plan", domain: "food", generatedAt: new Date().toISOString() });
    return { buffer, mimeType: "application/pdf", filename: `meal-plan-${slugify(artifact.title || artifact.id)}.pdf` };
  });

  // Generic PDF fallbacks — these domains use _lensExportPDFMarkup directly
  const pdfFallbackDomains = [
    "finance", "accounting", "billing", "insurance", "realestate",
    "law", "legal", "healthcare", "fitness", "food",
    "nonprofit", "government", "aviation", "household", "events",
    "trades", "education", "suffering",
  ];
  for (const domain of pdfFallbackDomains) {
    registerRenderer(domain, "*", pdfFromMarkup(domain));
  }

  // ── Markdown Domains ─────────────────────────────────────────────────────────
  // Knowledge-heavy domains where the deliverable is a readable document

  function mdRenderer() {
    return async (artifact) => {
      const { markdown } = exportMarkdown(artifact);
      return {
        buffer: Buffer.from(markdown, "utf-8"),
        mimeType: "text/markdown",
        filename: `${slugify(artifact.title)}.md`,
      };
    };
  }

  const markdownDomains = [
    "paper", "research", "hypothesis", "science", "math", "physics",
    "chem", "bio", "neuro", "quantum", "metacognition", "reasoning",
    "inference", "reflection", "ethics", "daily", "goals", "news",
    "docs", "commonsense", "experience", "metalearning", "grounding",
    "temporal", "transfer", "attention",
  ];
  for (const domain of markdownDomains) {
    registerRenderer(domain, "*", mdRenderer());
  }

  // ── JSON Domains ─────────────────────────────────────────────────────────────
  // Structured data domains where JSON is the natural format

  function jsonRenderer() {
    return async (artifact) => {
      const json = JSON.stringify(artifact.data || {}, null, 2);
      return {
        buffer: Buffer.from(json, "utf-8"),
        mimeType: "application/json",
        filename: `${slugify(artifact.title)}.json`,
      };
    };
  }

  const jsonDomains = [
    "code", "database", "schema", "ml", "game", "app-maker",
    "debug", "admin", "integrations", "security", "repos",
    "crypto", "marketplace",
  ];
  for (const domain of jsonDomains) {
    registerRenderer(domain, "*", jsonRenderer());
  }

  // ── CSV Domains ──────────────────────────────────────────────────────────────
  // Data-heavy domains with tabular output

  function csvRenderer() {
    return async (artifact) => {
      const { headers, rows } = extractTableFromData(artifact.data || {});
      if (!headers.length) {
        // Fall back to the server.js CSV exporter
        const { csv } = exportCSV(artifact);
        return {
          buffer: Buffer.from(csv, "utf-8"),
          mimeType: "text/csv",
          filename: `${slugify(artifact.title)}.csv`,
        };
      }
      return {
        buffer: renderCSV(headers, rows),
        mimeType: "text/plain",
        filename: `${slugify(artifact.title)}.csv`,
      };
    };
  }

  // CSV-specific action registrations (these override the domain-level fallback)
  const csvActions = [
    ["accounting", "reconcile"],
    ["trades", "generate-performance"],
    ["retail", "analyze-sales"],
    ["agriculture", "predict-yield"],
    ["board", "export-metrics"],
    ["queue", "generate-performance"],
    ["logistics", "track-shipments"],
    ["manufacturing", "quality-report"],
  ];
  for (const [domain, action] of csvActions) {
    registerRenderer(domain, action, csvRenderer());
  }

  // ── ICS Domains ──────────────────────────────────────────────────────────────
  // Calendar/event domains that produce downloadable calendar files

  function icsRenderer() {
    return async (artifact) => {
      const events = extractEvents(artifact.data || {});
      if (!events.length) return { buffer: null, mimeType: null, filename: null };
      return {
        buffer: renderICS(events),
        mimeType: "text/calendar",
        filename: `${slugify(artifact.title)}.ics`,
      };
    };
  }

  registerRenderer("calendar", "optimize-schedule", icsRenderer());
  registerRenderer("calendar", "plan_day", icsRenderer());
  registerRenderer("calendar", "plan_week", icsRenderer());
  registerRenderer("events", "suggest-template", icsRenderer());
  registerRenderer("insurance", "track-renewal", icsRenderer());
  registerRenderer("law", "alert-deadlines", icsRenderer());
  registerRenderer("legal", "alert-deadlines", icsRenderer());

  // ── SVG Domains ──────────────────────────────────────────────────────────────
  // Visual domains with lightweight scalable output

  registerRenderer("art", "extract-palette", async (artifact) => {
    const colors = artifact.data?.colors || artifact.data?.palette || [];
    if (!colors.length) return { buffer: null, mimeType: null, filename: null };
    return {
      buffer: renderPaletteSVG(colors),
      mimeType: "image/svg+xml",
      filename: `palette-${slugify(artifact.title)}.svg`,
    };
  });

  registerRenderer("whiteboard", "detect-clusters", async (artifact) => {
    const clusters = artifact.data?.clusters || [];
    if (!clusters.length) return { buffer: null, mimeType: null, filename: null };
    return {
      buffer: renderClusterSVG(clusters),
      mimeType: "image/svg+xml",
      filename: `clusters-${slugify(artifact.title)}.svg`,
    };
  });

  registerRenderer("math", "describe-visualization", async (artifact) => {
    const labels = artifact.data?.labels || artifact.data?.categories || [];
    const values = artifact.data?.values || artifact.data?.data || [];
    if (!labels.length) return { buffer: null, mimeType: null, filename: null };
    return {
      buffer: renderBarChartSVG({ title: artifact.title, labels, values }),
      mimeType: "image/svg+xml",
      filename: `chart-${slugify(artifact.title)}.svg`,
    };
  });

  registerRenderer("graph", "*", async (artifact) => {
    const clusters = artifact.data?.nodes || artifact.data?.clusters || [];
    if (!clusters.length) return { buffer: null, mimeType: null, filename: null };
    return {
      buffer: renderClusterSVG(clusters),
      mimeType: "image/svg+xml",
      filename: `graph-${slugify(artifact.title)}.svg`,
    };
  });

  // ── MIDI Domains ─────────────────────────────────────────────────────────────
  // Music domains that produce downloadable MIDI files

  function midiRenderer() {
    return async (artifact) => {
      const patterns = artifact.data?.patterns || artifact.data || {};
      const notes = patterns.notes || artifact.data?.notes || [];
      if (!notes.length) return { buffer: null, mimeType: null, filename: null };
      const buffer = await renderMIDI({ notes, bpm: patterns.bpm || artifact.data?.bpm });
      return {
        buffer,
        mimeType: "audio/midi",
        filename: `${slugify(artifact.title)}.mid`,
      };
    };
  }

  registerRenderer("studio", "generate-pattern", midiRenderer());
  registerRenderer("studio", "suggest-chords", midiRenderer());
  registerRenderer("studio", "auto-arrange", midiRenderer());
  registerRenderer("music", "*", midiRenderer());

  // ── HTML Domains ─────────────────────────────────────────────────────────────
  // Rich interactive domains

  registerRenderer("board", "generate-retro", async (artifact) => {
    const body = buildRetroHTML(artifact.data || {});
    return {
      buffer: renderHTML(artifact.title || "Sprint Retrospective", body),
      mimeType: "text/html",
      filename: `retro-${slugify(artifact.title || artifact.id)}.html`,
    };
  });

  registerRenderer("collab", "generate-team-pulse", async (artifact) => {
    const body = buildTeamPulseHTML(artifact.data || {});
    return {
      buffer: renderHTML(artifact.title || "Team Pulse", body),
      mimeType: "text/html",
      filename: `team-pulse-${slugify(artifact.title || artifact.id)}.html`,
    };
  });

  registerRenderer("feed", "*", async (artifact) => {
    const { markdown } = exportMarkdown(artifact);
    // Wrap markdown in simple HTML for feed items
    const body = `<h1>${escHTML(artifact.title || "Feed")}</h1><pre style="white-space:pre-wrap;font-family:inherit;">${escHTML(markdown)}</pre>`;
    return {
      buffer: renderHTML(artifact.title || "Feed", body),
      mimeType: "text/html",
      filename: `feed-${slugify(artifact.title || artifact.id)}.html`,
    };
  });

  registerRenderer("export", "*", async (artifact) => {
    const { markdown } = exportMarkdown(artifact);
    const body = `<h1>${escHTML(artifact.title || "Export")}</h1><pre style="white-space:pre-wrap;font-family:inherit;">${escHTML(markdown)}</pre>`;
    return {
      buffer: renderHTML(artifact.title || "Export", body),
      mimeType: "text/html",
      filename: `export-${slugify(artifact.title || artifact.id)}.html`,
    };
  });
}

function escHTML(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
