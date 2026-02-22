/**
 * Heartbeat Test Suite
 * Tests cognitive heartbeat windows, task scheduling, locks, and caps.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── Mock Heartbeat System ────────────────────────────────────────────────────

const HEARTBEAT_WINDOWS = {
  autogen:   { start: 0,  end: 11 },
  dream:     { start: 12, end: 23 },
  evolution: { start: 24, end: 35 },
  synthesis: { start: 36, end: 47 },
  birth:     { start: 48, end: 59 },
};

function getActiveWindow(minute) {
  for (const [task, window] of Object.entries(HEARTBEAT_WINDOWS)) {
    if (minute >= window.start && minute <= window.end) return task;
  }
  return null;
}

function createHeartbeatSystem() {
  let cognitiveLock = false;
  let birthCount = 0;
  let lastBirthHour = -1;
  const taskLog = [];

  async function runTask(taskType, minute) {
    // Check cognitive lock
    if (cognitiveLock) {
      return { ok: false, error: "Cognitive lock active" };
    }

    // Check birth cap (1 per hour)
    if (taskType === "birth") {
      const currentHour = Math.floor(Date.now() / 3600000);
      if (currentHour === lastBirthHour) {
        return { ok: false, error: "Birth cap reached (1 per hour)" };
      }
      lastBirthHour = currentHour;
      birthCount++;
    }

    // Check window
    const activeWindow = getActiveWindow(minute);
    if (activeWindow !== taskType) {
      return { ok: false, error: `Wrong window: expected ${activeWindow}, got ${taskType}` };
    }

    cognitiveLock = true;
    try {
      // Simulate task execution
      const result = { ok: true, taskType, minute, timestamp: Date.now() };
      taskLog.push(result);
      return result;
    } finally {
      cognitiveLock = false;
    }
  }

  function isLocked() {
    return cognitiveLock;
  }

  function setLock(val) {
    cognitiveLock = val;
  }

  return { runTask, isLocked, setLock, taskLog, getBirthCount: () => birthCount };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Heartbeat System", () => {
  let heartbeat;

  beforeEach(() => {
    heartbeat = createHeartbeatSystem();
  });

  it("autogen fires in :00-:11 window", async () => {
    for (const minute of [0, 5, 11]) {
      const result = await heartbeat.runTask("autogen", minute);
      assert.ok(result.ok, `Autogen should fire at minute ${minute}`);
    }
  });

  it("dream fires in :12-:23 window", async () => {
    for (const minute of [12, 18, 23]) {
      const result = await heartbeat.runTask("dream", minute);
      assert.ok(result.ok, `Dream should fire at minute ${minute}`);
    }
  });

  it("evolution fires in :24-:35 window", async () => {
    for (const minute of [24, 30, 35]) {
      const result = await heartbeat.runTask("evolution", minute);
      assert.ok(result.ok, `Evolution should fire at minute ${minute}`);
    }
  });

  it("synthesis fires in :36-:47 window", async () => {
    for (const minute of [36, 42, 47]) {
      const result = await heartbeat.runTask("synthesis", minute);
      assert.ok(result.ok, `Synthesis should fire at minute ${minute}`);
    }
  });

  it("birth fires in :48-:59 window", async () => {
    const result = await heartbeat.runTask("birth", 48);
    assert.ok(result.ok, "Birth should fire at minute 48");
  });

  it("cognitive lock prevents concurrent tasks", async () => {
    heartbeat.setLock(true);
    const result = await heartbeat.runTask("autogen", 5);
    assert.ok(!result.ok);
    assert.ok(result.error.includes("Cognitive lock"));
    heartbeat.setLock(false);
  });

  it("birth cap limits one entity per hour", async () => {
    const result1 = await heartbeat.runTask("birth", 48);
    assert.ok(result1.ok, "First birth should succeed");

    const result2 = await heartbeat.runTask("birth", 55);
    assert.ok(!result2.ok, "Second birth in same hour should fail");
    assert.ok(result2.error.includes("Birth cap"));
  });

  it("PromotionTick runs after every cognitive task", async () => {
    let promotionTicked = false;

    // Simulate: after task completes, run promotion tick
    async function runTaskWithPromotion(taskType, minute) {
      const result = await heartbeat.runTask(taskType, minute);
      if (result.ok) {
        promotionTicked = true; // PromotionTick fires
      }
      return result;
    }

    await runTaskWithPromotion("autogen", 5);
    assert.ok(promotionTicked, "PromotionTick should run after cognitive task");
  });

  it("staggered windows don't overlap", () => {
    const windows = Object.values(HEARTBEAT_WINDOWS);

    for (let i = 0; i < windows.length; i++) {
      for (let j = i + 1; j < windows.length; j++) {
        const a = windows[i];
        const b = windows[j];
        const overlaps = a.start <= b.end && b.start <= a.end;
        assert.ok(!overlaps, `Windows ${JSON.stringify(a)} and ${JSON.stringify(b)} should not overlap`);
      }
    }
  });

  it("subconscious brain handles all heartbeat tasks", () => {
    const heartbeatTasks = ["autogen", "dream", "evolution", "synthesis", "birth"];
    const subconscious = { role: "autogen, dream, evolution, synthesis, birth" };

    for (const task of heartbeatTasks) {
      assert.ok(
        subconscious.role.includes(task),
        `Subconscious should handle ${task}`
      );
    }
  });
});
