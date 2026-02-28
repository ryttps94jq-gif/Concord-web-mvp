// server/routes/universal-export.js
// DTU export/import API routes for the universal DTU bridge.

import { Router } from "express";
import { lensDataToDTU, wrapFormatAsDTU, exportDTUAs, inspectDTU } from "../lib/universal-dtu-bridge.js";

export default function createUniversalExportRouter(STATE, runMacro, makeCtx) {
  const router = Router();

  // POST /api/lens/:domain/export-dtu — Export lens artifact as .dtu file
  router.post("/api/lens/:domain/export-dtu", async (req, res) => {
    try {
      const { domain } = req.params;
      const { data, title, tags, format } = req.body || {};
      if (!data) return res.status(400).json({ ok: false, error: "Missing 'data' field" });

      const result = lensDataToDTU(domain, data, { title, tags, format });
      res.set("Content-Type", "application/octet-stream");
      res.set("Content-Disposition", `attachment; filename="${domain}-export.dtu"`);
      res.send(Buffer.from(result.buffer));
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/lens/:domain/import-dtu — Import .dtu file into lens
  router.post("/api/lens/:domain/import-dtu", async (req, res) => {
    try {
      const { domain } = req.params;

      // Accept raw binary body (Content-Type: application/octet-stream)
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      if (buffer.length < 48) return res.status(400).json({ ok: false, error: "Invalid DTU file (too small)" });

      const inspection = inspectDTU(buffer);
      if (!inspection.ok) return res.status(400).json({ ok: false, error: `Invalid DTU: ${inspection.error}` });

      // Create a DTU in the system from the imported file
      const ctx = makeCtx(req);
      const dtu = await runMacro("dtu", "create", {
        title: inspection.metadata.title || `Import into ${domain}`,
        tags: [...(inspection.metadata.tags || []), domain, "imported"],
        source: "dtu-import",
        meta: {
          importedFrom: "dtu-file",
          importedAt: new Date().toISOString(),
          originalDomain: inspection.metadata.domain,
          fileSize: buffer.length,
        },
      }, ctx);

      res.json({ ok: true, imported: true, dtuId: dtu?.id, metadata: inspection.metadata });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/convert/to-dtu — Convert any format to DTU
  router.post("/api/convert/to-dtu", async (req, res) => {
    try {
      const { format, data, title, domain, tags } = req.body || {};
      if (!format || !data) return res.status(400).json({ ok: false, error: "Missing 'format' and 'data' fields" });

      const result = wrapFormatAsDTU(format, data, { title, domain, tags });
      res.set("Content-Type", "application/octet-stream");
      res.set("Content-Disposition", `attachment; filename="converted.dtu"`);
      res.send(Buffer.from(result.buffer));
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/convert/from-dtu — Convert DTU to any format
  router.post("/api/convert/from-dtu", async (req, res) => {
    try {
      const { targetFormat } = req.body || {};
      if (!targetFormat) return res.status(400).json({ ok: false, error: "Missing 'targetFormat' field" });

      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      if (buffer.length < 48) return res.status(400).json({ ok: false, error: "Invalid DTU file" });

      const result = exportDTUAs(buffer, targetFormat);
      res.set("Content-Type", result.mimeType || "application/json");
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /api/realtime/status — Get real-time feed status
  router.get("/api/realtime/status", async (req, res) => {
    try {
      const { getRealtimeFeedStatus } = await import("../emergent/realtime-feeds.js");
      res.json({ ok: true, ...getRealtimeFeedStatus() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /api/realtime/feed/:feed — Get cached data for a specific feed
  router.get("/api/realtime/feed/:feed", async (req, res) => {
    try {
      const { getRealtimeFeedData } = await import("../emergent/realtime-feeds.js");
      const data = getRealtimeFeedData(req.params.feed);
      if (data) {
        res.json({ ok: true, feed: req.params.feed, data });
      } else {
        res.json({ ok: true, feed: req.params.feed, data: null, message: "No cached data yet — waiting for next heartbeat tick" });
      }
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}
