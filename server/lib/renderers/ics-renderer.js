/**
 * ICS Renderer — iCalendar file builder for calendar/event domains.
 * Pure string concatenation, zero dependencies.
 */

/**
 * Format a Date or ISO string into ICS date format (YYYYMMDDTHHMMSSZ).
 */
function formatICSDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "19700101T000000Z";
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Fold long lines per RFC 5545 (max 75 octets per line).
 */
function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [];
  parts.push(line.slice(0, 75));
  let i = 75;
  while (i < line.length) {
    parts.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return parts.join("\r\n");
}

/**
 * Escape text values per RFC 5545.
 */
function escapeText(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Render an array of events into an ICS buffer.
 *
 * @param {Object[]} events - Array of event objects
 * @param {string} events[].title - Event summary
 * @param {string|Date} events[].start - Start date/time
 * @param {string|Date} events[].end - End date/time
 * @param {string} [events[].location] - Location
 * @param {string} [events[].description] - Description
 * @param {string} [events[].id] - UID
 * @returns {Buffer} ICS file buffer
 */
export function renderICS(events) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Concord Cognitive Engine//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`DTSTART:${formatICSDate(e.start)}`));
    if (e.end) {
      lines.push(foldLine(`DTEND:${formatICSDate(e.end)}`));
    }
    lines.push(foldLine(`SUMMARY:${escapeText(e.title || e.summary || "Untitled")}`));
    if (e.location) lines.push(foldLine(`LOCATION:${escapeText(e.location)}`));
    if (e.description) lines.push(foldLine(`DESCRIPTION:${escapeText(e.description)}`));
    lines.push(`UID:${e.id || crypto.randomUUID?.() || Date.now() + "-" + Math.random().toString(36).slice(2)}`);
    lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return Buffer.from(lines.join("\r\n"), "utf-8");
}

/**
 * Extract events from artifact data for ICS rendering.
 */
export function extractEvents(data) {
  if (!data || typeof data !== "object") return [];

  // Look for common event array fields
  const eventKeys = ["events", "schedule", "appointments", "deadlines", "reminders", "renewals", "sessions", "milestones"];
  for (const key of eventKeys) {
    if (Array.isArray(data[key]) && data[key].length > 0) {
      return data[key].map((e) => ({
        title: e.title || e.summary || e.name || e.event || "Event",
        start: e.start || e.startDate || e.date || e.dueDate || e.scheduledAt || new Date().toISOString(),
        end: e.end || e.endDate || null,
        location: e.location || e.venue || null,
        description: e.description || e.notes || null,
        id: e.id || null,
      }));
    }
  }

  return [];
}
