export default function registerFitnessActions(registerLensAction) {
  registerLensAction("fitness", "progressionCalc", async (ctx, artifact, params) => {
    const exercises = artifact.data?.exercises || [];
    const recommendations = exercises.map(ex => {
      const weight = ex.weight || 0;
      const reps = ex.reps || 0;
      const rpe = ex.rpe || 7;
      let increment = 0;
      if (rpe <= 6) increment = weight * 0.05;
      else if (rpe <= 7) increment = weight * 0.025;
      else if (rpe >= 9) increment = -weight * 0.05;
      return {
        exercise: ex.name,
        currentWeight: weight,
        currentReps: reps,
        currentRPE: rpe,
        recommendedWeight: Math.round((weight + increment) * 2) / 2,
        recommendation: rpe <= 6 ? 'increase_weight' : rpe <= 8 ? 'maintain' : 'reduce_weight',
      };
    });
    return { ok: true, recommendations };
  });

  registerLensAction("fitness", "classUtilization", async (ctx, artifact, params) => {
    const capacity = artifact.data?.capacity || 0;
    const enrolled = artifact.data?.enrolled || 0;
    const attendanceLog = artifact.data?.attendanceLog || [];
    const period = params.period || 30;
    const recentAttendance = attendanceLog.filter(a => {
      const d = new Date(a.date);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - period);
      return d >= cutoff;
    });
    const avgAttendance = recentAttendance.length > 0
      ? Math.round(recentAttendance.reduce((s, a) => s + (a.count || 0), 0) / recentAttendance.length)
      : enrolled;
    const utilization = capacity > 0 ? Math.round((avgAttendance / capacity) * 100) : 0;
    return { ok: true, className: artifact.title, capacity, enrolled, avgAttendance, utilization, period, sessions: recentAttendance.length };
  });

  registerLensAction("fitness", "periodization", async (ctx, artifact, params) => {
    const weeks = params.weeks || artifact.data?.weeks || 12;
    const goal = params.goal || artifact.data?.goal || 'general_fitness';
    const phases = [];
    if (goal === 'strength') {
      phases.push({ name: 'Hypertrophy', weeks: Math.ceil(weeks * 0.33), sets: '3-4', reps: '8-12', intensity: '65-75%' });
      phases.push({ name: 'Strength', weeks: Math.ceil(weeks * 0.33), sets: '4-5', reps: '3-5', intensity: '80-90%' });
      phases.push({ name: 'Peaking', weeks: Math.ceil(weeks * 0.25), sets: '3-5', reps: '1-3', intensity: '90-100%' });
      phases.push({ name: 'Deload', weeks: Math.max(1, weeks - phases.reduce((s, p) => s + p.weeks, 0)), sets: '2-3', reps: '8-10', intensity: '50-60%' });
    } else {
      phases.push({ name: 'Foundation', weeks: Math.ceil(weeks * 0.25), sets: '2-3', reps: '12-15', intensity: '50-65%' });
      phases.push({ name: 'Build', weeks: Math.ceil(weeks * 0.33), sets: '3-4', reps: '8-12', intensity: '65-80%' });
      phases.push({ name: 'Peak', weeks: Math.ceil(weeks * 0.25), sets: '3-4', reps: '6-10', intensity: '75-85%' });
      phases.push({ name: 'Recovery', weeks: Math.max(1, weeks - phases.reduce((s, p) => s + p.weeks, 0)), sets: '2', reps: '10-12', intensity: '50-60%' });
    }
    return { ok: true, program: artifact.title, goal, totalWeeks: weeks, phases };
  });

  registerLensAction("fitness", "recruitProfile", async (ctx, artifact, params) => {
    const profile = {
      name: artifact.title,
      sport: artifact.data?.sport || 'Unknown',
      position: artifact.data?.position || '',
      stats: artifact.data?.stats || {},
      academic: artifact.data?.academicInfo || {},
      highlights: artifact.data?.highlights || [],
      contact: artifact.data?.contacts || {},
      recruitingStatus: artifact.data?.recruitingStatus || 'prospect',
      compiledAt: new Date().toISOString(),
    };
    return { ok: true, profile };
  });
};
