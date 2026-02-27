/**
 * MIDI Renderer — lightweight MIDI file builder for music/studio domains.
 * Uses jsmidgen (15KB, pure JS, zero dependencies) when available,
 * falls back to manual MIDI byte construction.
 */

let Midi = null;

async function ensureMidi() {
  if (Midi) return;
  try {
    const mod = await import("jsmidgen");
    Midi = mod.default || mod;
  } catch {
    // Fall back to manual MIDI construction
    Midi = null;
  }
}

/**
 * Write a variable-length quantity (VLQ) for MIDI encoding.
 */
function writeVLQ(value) {
  const bytes = [];
  bytes.push(value & 0x7f);
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }
  return bytes;
}

/**
 * Build a MIDI file from scratch (fallback when jsmidgen not available).
 */
function buildMIDIManual(patterns) {
  const notes = patterns.notes || [];
  if (!notes.length) return Buffer.alloc(0);

  const ticksPerBeat = 480;
  const trackData = [];

  // Set tempo (120 BPM default)
  const bpm = patterns.bpm || 120;
  const microsPerBeat = Math.round(60000000 / bpm);
  trackData.push(
    ...writeVLQ(0), 0xff, 0x51, 0x03,
    (microsPerBeat >> 16) & 0xff,
    (microsPerBeat >> 8) & 0xff,
    microsPerBeat & 0xff
  );

  // Sort notes by time
  const sorted = [...notes].sort((a, b) => (a.time || 0) - (b.time || 0));

  // Build note events
  const events = [];
  for (const note of sorted) {
    const pitch = Math.max(0, Math.min(127, note.pitch || note.midi || 60));
    const velocity = Math.max(1, Math.min(127, Math.round((note.velocity || 0.8) * 127)));
    const startTick = Math.round((note.time || 0) * ticksPerBeat);
    const durTicks = Math.max(1, Math.round((note.duration || 0.5) * ticksPerBeat));
    const channel = Math.min(15, note.channel || 0);

    events.push({ tick: startTick, data: [0x90 | channel, pitch, velocity] });
    events.push({ tick: startTick + durTicks, data: [0x80 | channel, pitch, 0] });
  }

  // Sort events by tick
  events.sort((a, b) => a.tick - b.tick);

  // Convert to delta times
  let lastTick = 0;
  for (const evt of events) {
    const delta = evt.tick - lastTick;
    trackData.push(...writeVLQ(delta), ...evt.data);
    lastTick = evt.tick;
  }

  // End of track
  trackData.push(0x00, 0xff, 0x2f, 0x00);

  // Build file
  const header = Buffer.alloc(14);
  header.write("MThd", 0);
  header.writeUInt32BE(6, 4);       // header length
  header.writeUInt16BE(0, 8);       // format 0 (single track)
  header.writeUInt16BE(1, 10);      // 1 track
  header.writeUInt16BE(ticksPerBeat, 12);

  const trackHeader = Buffer.alloc(8);
  trackHeader.write("MTrk", 0);
  trackHeader.writeUInt32BE(trackData.length, 4);

  return Buffer.concat([header, trackHeader, Buffer.from(trackData)]);
}

/**
 * Render note patterns into a MIDI file buffer.
 *
 * @param {Object} patterns - { notes: [{pitch, time, duration, velocity?, channel?}], bpm? }
 * @returns {Promise<Buffer>} MIDI file buffer
 */
export async function renderMIDI(patterns) {
  await ensureMidi();

  if (!patterns?.notes?.length) return Buffer.alloc(0);

  // Use jsmidgen if available
  if (Midi?.File) {
    const file = new Midi.File();
    const track = new Midi.Track();
    file.addTrack(track);

    if (patterns.bpm) {
      track.setTempo(patterns.bpm);
    }

    for (const note of patterns.notes) {
      const pitch = Math.max(0, Math.min(127, note.pitch || note.midi || 60));
      const dur = Math.max(1, Math.round((note.duration || 0.5) * 128));
      const channel = note.channel || 0;
      track.addNote(channel, pitch, dur, 0, Math.round((note.velocity || 0.8) * 127));
    }

    return Buffer.from(file.toBytes(), "binary");
  }

  // Fallback to manual MIDI construction
  return buildMIDIManual(patterns);
}
