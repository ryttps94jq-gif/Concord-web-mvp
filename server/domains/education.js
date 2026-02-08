// server/domains/education.js
// Domain actions for education: grading, attendance, progress tracking, schedule conflicts.

module.exports = function registerEducationActions(registerLensAction) {
  /**
   * gradeCalculation
   * Compute weighted grades from assignment categories and scores.
   * artifact.data.students: [{ studentId, name, grades: [{ category, name, score, maxScore }] }]
   * artifact.data.weightScheme: [{ category, weight }] — weights should sum to 100
   * params.studentId — optional single student filter
   */
  registerLensAction("education", "gradeCalculation", async (ctx, artifact, params) => {
    const students = artifact.data.students || [];
    const weightScheme = artifact.data.weightScheme || params.weightScheme || [];
    const targetId = params.studentId || null;
    const gradeScale = params.gradeScale || [
      { min: 93, letter: "A" }, { min: 90, letter: "A-" },
      { min: 87, letter: "B+" }, { min: 83, letter: "B" }, { min: 80, letter: "B-" },
      { min: 77, letter: "C+" }, { min: 73, letter: "C" }, { min: 70, letter: "C-" },
      { min: 67, letter: "D+" }, { min: 63, letter: "D" }, { min: 60, letter: "D-" },
      { min: 0, letter: "F" },
    ];

    const subset = targetId
      ? students.filter((s) => s.studentId === targetId)
      : students;

    // Build weight map, defaulting to equal weights if not provided
    const weightMap = {};
    if (weightScheme.length > 0) {
      for (const w of weightScheme) weightMap[w.category] = parseFloat(w.weight) || 0;
    } else {
      const categories = [...new Set(subset.flatMap((s) => (s.grades || []).map((g) => g.category)))];
      const equalWeight = categories.length > 0 ? 100 / categories.length : 100;
      for (const cat of categories) weightMap[cat] = equalWeight;
    }

    function toLetter(pct) {
      for (const g of gradeScale) {
        if (pct >= g.min) return g.letter;
      }
      return "F";
    }

    const results = subset.map((student) => {
      const grades = student.grades || [];
      const byCategory = {};

      for (const grade of grades) {
        const cat = grade.category || "uncategorized";
        if (!byCategory[cat]) byCategory[cat] = { scores: [], maxScores: [] };
        byCategory[cat].scores.push(parseFloat(grade.score) || 0);
        byCategory[cat].maxScores.push(parseFloat(grade.maxScore) || 100);
      }

      let weightedTotal = 0;
      let totalWeight = 0;
      const categoryBreakdown = [];

      for (const [cat, data] of Object.entries(byCategory)) {
        const totalScore = data.scores.reduce((s, v) => s + v, 0);
        const totalMax = data.maxScores.reduce((s, v) => s + v, 0);
        const pct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        const weight = weightMap[cat] || 0;

        weightedTotal += pct * (weight / 100);
        totalWeight += weight;

        categoryBreakdown.push({
          category: cat,
          assignmentCount: data.scores.length,
          earnedPoints: Math.round(totalScore * 100) / 100,
          possiblePoints: Math.round(totalMax * 100) / 100,
          categoryPct: Math.round(pct * 100) / 100,
          weight,
        });
      }

      // Normalize if weights don't sum to 100
      const finalPct = totalWeight > 0 ? (weightedTotal / totalWeight) * 100 : weightedTotal;
      const roundedPct = Math.round(finalPct * 100) / 100;

      return {
        studentId: student.studentId,
        name: student.name,
        weightedPct: roundedPct,
        letterGrade: toLetter(roundedPct),
        totalAssignments: grades.length,
        categoryBreakdown,
      };
    });

    // Class statistics
    const pcts = results.map((r) => r.weightedPct);
    const classAvg = pcts.length > 0 ? Math.round((pcts.reduce((s, v) => s + v, 0) / pcts.length) * 100) / 100 : 0;
    const classMedian = pcts.length > 0
      ? (() => {
          const sorted = pcts.slice().sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 !== 0 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
        })()
      : 0;
    const classHigh = pcts.length > 0 ? Math.max(...pcts) : 0;
    const classLow = pcts.length > 0 ? Math.min(...pcts) : 0;

    const report = {
      generatedAt: new Date().toISOString(),
      studentsGraded: results.length,
      weightScheme: Object.entries(weightMap).map(([cat, w]) => ({ category: cat, weight: w })),
      classStats: { average: classAvg, median: classMedian, high: classHigh, low: classLow },
      students: results.sort((a, b) => b.weightedPct - a.weightedPct),
    };

    artifact.data.gradeReport = report;

    return { ok: true, result: report };
  });

  /**
   * attendanceReport
   * Generate an attendance summary.
   * artifact.data.attendance: [{ studentId, name, records: [{ date, status }] }]
   * status: "present", "absent", "tardy", "excused"
   * params.startDate, params.endDate — optional period filter
   */
  registerLensAction("education", "attendanceReport", async (ctx, artifact, params) => {
    const attendance = artifact.data.attendance || [];
    const startDate = params.startDate ? new Date(params.startDate) : null;
    const endDate = params.endDate ? new Date(params.endDate) : null;

    const studentSummaries = attendance.map((student) => {
      let records = student.records || [];
      if (startDate || endDate) {
        records = records.filter((r) => {
          const d = new Date(r.date);
          if (startDate && d < startDate) return false;
          if (endDate && d > endDate) return false;
          return true;
        });
      }

      const counts = { present: 0, absent: 0, tardy: 0, excused: 0 };
      for (const r of records) {
        const s = (r.status || "present").toLowerCase();
        if (counts[s] !== undefined) counts[s]++;
        else counts.present++;
      }

      const totalDays = records.length;
      const attendancePct = totalDays > 0
        ? Math.round(((counts.present + counts.tardy) / totalDays) * 10000) / 100
        : 100;

      // Consecutive absences
      let maxConsecutiveAbsent = 0;
      let currentStreak = 0;
      const sorted = records.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
      for (const r of sorted) {
        if (r.status === "absent") {
          currentStreak++;
          maxConsecutiveAbsent = Math.max(maxConsecutiveAbsent, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      return {
        studentId: student.studentId,
        name: student.name,
        totalDays,
        ...counts,
        attendancePct,
        maxConsecutiveAbsent,
        atRisk: attendancePct < 90 || maxConsecutiveAbsent >= 3,
      };
    });

    const totalStudents = studentSummaries.length;
    const atRiskStudents = studentSummaries.filter((s) => s.atRisk);
    const overallRate = totalStudents > 0
      ? Math.round((studentSummaries.reduce((s, st) => s + st.attendancePct, 0) / totalStudents) * 100) / 100
      : 100;

    const report = {
      generatedAt: new Date().toISOString(),
      period: {
        start: startDate ? startDate.toISOString().split("T")[0] : "all-time",
        end: endDate ? endDate.toISOString().split("T")[0] : "current",
      },
      totalStudents,
      overallAttendanceRate: overallRate,
      atRiskCount: atRiskStudents.length,
      students: studentSummaries.sort((a, b) => a.attendancePct - b.attendancePct),
      atRiskStudents: atRiskStudents.map((s) => ({ studentId: s.studentId, name: s.name, attendancePct: s.attendancePct })),
    };

    artifact.data.attendanceReport = report;

    return { ok: true, result: report };
  });

  /**
   * progressTrack
   * Calculate percentage completion toward a certification or program goal.
   * artifact.data.requirements: [{ requirementId, name, type, requiredUnits }]
   * artifact.data.completions: [{ requirementId, completedUnits, completedDate }]
   */
  registerLensAction("education", "progressTrack", async (ctx, artifact, params) => {
    const requirements = artifact.data.requirements || [];
    const completions = artifact.data.completions || [];

    // Build completions map
    const completionMap = {};
    for (const c of completions) {
      if (!completionMap[c.requirementId]) completionMap[c.requirementId] = 0;
      completionMap[c.requirementId] += parseFloat(c.completedUnits) || 0;
    }

    let totalRequired = 0;
    let totalCompleted = 0;

    const details = requirements.map((req) => {
      const required = parseFloat(req.requiredUnits) || 1;
      const completed = Math.min(completionMap[req.requirementId] || 0, required);
      const pct = Math.round((completed / required) * 10000) / 100;

      totalRequired += required;
      totalCompleted += completed;

      return {
        requirementId: req.requirementId,
        name: req.name,
        type: req.type || "general",
        requiredUnits: required,
        completedUnits: Math.round(completed * 100) / 100,
        remainingUnits: Math.round((required - completed) * 100) / 100,
        completionPct: pct,
        complete: pct >= 100,
      };
    });

    const overallPct = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 10000) / 100 : 0;
    const completedReqs = details.filter((d) => d.complete).length;
    const incompleteReqs = details.filter((d) => !d.complete);

    // Estimated completion: if we know a start date and current progress
    let estimatedCompletionDate = null;
    if (params.startDate && overallPct > 0 && overallPct < 100) {
      const start = new Date(params.startDate);
      const elapsed = Date.now() - start.getTime();
      const totalEstimated = elapsed / (overallPct / 100);
      estimatedCompletionDate = new Date(start.getTime() + totalEstimated).toISOString().split("T")[0];
    }

    const result = {
      generatedAt: new Date().toISOString(),
      overallCompletionPct: overallPct,
      totalRequirements: requirements.length,
      completedRequirements: completedReqs,
      remainingRequirements: incompleteReqs.length,
      estimatedCompletionDate,
      details: details.sort((a, b) => a.completionPct - b.completionPct),
    };

    artifact.data.progressReport = result;

    return { ok: true, result };
  });

  /**
   * scheduleConflict
   * Detect overlapping schedule entries.
   * artifact.data.schedules: [{ id, title, day, startTime, endTime, room, instructor }]
   * startTime/endTime in "HH:MM" 24-hour format
   */
  registerLensAction("education", "scheduleConflict", async (ctx, artifact, params) => {
    const schedules = artifact.data.schedules || [];

    function timeToMinutes(t) {
      const [h, m] = (t || "0:00").split(":").map(Number);
      return h * 60 + (m || 0);
    }

    function overlaps(a, b) {
      return a.startMin < b.endMin && b.startMin < a.endMin;
    }

    // Prepare entries
    const entries = schedules.map((s) => ({
      ...s,
      startMin: timeToMinutes(s.startTime),
      endMin: timeToMinutes(s.endTime),
    }));

    const conflicts = [];
    const seen = new Set();

    // Group by day, then check each pair
    const byDay = {};
    for (const entry of entries) {
      const day = entry.day || "unknown";
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(entry);
    }

    for (const [day, dayEntries] of Object.entries(byDay)) {
      for (let i = 0; i < dayEntries.length; i++) {
        for (let j = i + 1; j < dayEntries.length; j++) {
          const a = dayEntries[i];
          const b = dayEntries[j];

          if (!overlaps(a, b)) continue;

          // Determine conflict type
          const conflictTypes = [];
          if (a.room && b.room && a.room === b.room) conflictTypes.push("room");
          if (a.instructor && b.instructor && a.instructor === b.instructor) conflictTypes.push("instructor");
          if (conflictTypes.length === 0) conflictTypes.push("time-overlap");

          const key = [a.id, b.id].sort().join("-");
          if (seen.has(key)) continue;
          seen.add(key);

          conflicts.push({
            day,
            conflictType: conflictTypes,
            entryA: { id: a.id, title: a.title, startTime: a.startTime, endTime: a.endTime, room: a.room, instructor: a.instructor },
            entryB: { id: b.id, title: b.title, startTime: b.startTime, endTime: b.endTime, room: b.room, instructor: b.instructor },
            overlapMinutes: Math.min(a.endMin, b.endMin) - Math.max(a.startMin, b.startMin),
          });
        }
      }
    }

    const result = {
      checkedAt: new Date().toISOString(),
      totalEntries: schedules.length,
      conflictsFound: conflicts.length,
      conflicts: conflicts.sort((a, b) => b.overlapMinutes - a.overlapMinutes),
      conflictFree: conflicts.length === 0,
    };

    artifact.data.scheduleConflicts = result;

    return { ok: true, result };
  });
};
