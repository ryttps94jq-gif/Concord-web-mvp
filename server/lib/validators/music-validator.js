import { registerValidator } from "../quality-gate.js";

registerValidator("studio", (data, action) => {
  const issues = [];

  if (action === "generate-pattern" || action === "suggest-chords" || action === "auto-arrange") {
    if (data.notes) {
      for (const note of data.notes) {
        if (note.pitch !== undefined && (note.pitch < 0 || note.pitch > 127)) {
          issues.push({ issue: `Invalid MIDI pitch: ${note.pitch}`, severity: "critical" });
        }
        if (note.duration !== undefined && note.duration <= 0) {
          issues.push({ issue: `Invalid note duration: ${note.duration}`, severity: "critical" });
        }
      }
    }
    if (data.bpm && (data.bpm < 20 || data.bpm > 400)) {
      issues.push({ issue: `Unrealistic BPM: ${data.bpm}`, severity: "warning" });
    }
  }

  return { pass: issues.filter((i) => i.severity === "critical").length === 0, issues };
});

registerValidator("music", (data, action) => {
  const issues = [];

  if (action === "generate-lyrics" && data.lyrics) {
    if (data.lyrics.length < 50) {
      issues.push({ issue: "Lyrics too short", severity: "warning" });
    }
  }

  return { pass: issues.filter((i) => i.severity === "critical").length === 0, issues };
});
