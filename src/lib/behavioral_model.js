import { calculateTemporalEntropy, profileSigningCadence } from './temporal_entropy';
import { analyzeStrokeRhythm, detectMicroPauses, extractSigningCadence } from './rhythm_analysis';

const FEATURE_DIM = 20;

/**
 * Extract 20-dimensional enhanced behavioral features from raw trajectory points.
 */
export function extractBehavioralFeatures(points, strokes) {
  if (!points || points.length < 2) return new Array(FEATURE_DIM).fill(0);

  const allStrokes   = strokes && strokes.length ? strokes : [points];
  const strokeCount  = allStrokes.length;
  const totalTime    = Math.max(points[points.length - 1].t - points[0].t, 1);

  const speeds = [];
  const pressures = [];
  const angularVelocities = [];
  let pathLength       = 0;
  let directionChanges = 0;
  let curvatureAccum   = 0;
  let curvatureCount   = 0;
  let prevDir          = null;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], curr = points[i];
    const dt   = Math.max(curr.t - prev.t, 1);
    const dx   = curr.x - prev.x, dy = curr.y - prev.y;
    const dist = Math.hypot(dx, dy);
    const dir  = Math.atan2(dy, dx);
    const spd  = dist / dt;
    const pressure = curr.p || 0.5;

    pathLength += dist;
    speeds.push(spd);
    pressures.push(pressure);

    if (prevDir !== null) {
      const delta = Math.atan2(Math.sin(dir - prevDir), Math.cos(dir - prevDir));
      angularVelocities.push(Math.abs(delta) / dt);
      curvatureAccum += Math.abs(delta);
      curvatureCount++;
      if (Math.abs(delta) > Math.PI / 6) directionChanges++;
    }
    prevDir = dir;
  }

  const meanSpeed    = speeds.reduce((s, v) => s + v, 0) / Math.max(speeds.length, 1);
  const avgSpeed     = pathLength / totalTime;
  const speedVar     = Math.sqrt(speeds.reduce((s, v) => s + (v - meanSpeed) ** 2, 0) / Math.max(speeds.length, 1));
  const avgCurvature = curvatureAccum / Math.max(curvatureCount, 1);
  const penLiftCount = Math.max(strokeCount - 1, 0);

  const meanPressure = pressures.reduce((s, v) => s + v, 0) / Math.max(pressures.length, 1);
  const pressureVar  = Math.sqrt(pressures.reduce((s, v) => s + (v - meanPressure) ** 2, 0) / Math.max(pressures.length, 1));

  const meanAngularVel = angularVelocities.length > 0
    ? angularVelocities.reduce((s, v) => s + v, 0) / angularVelocities.length
    : 0;

  const strokeDuration = allStrokes.reduce((sum, stroke) => {
    if (stroke.length < 2) return sum;
    return sum + (stroke[stroke.length - 1].t - stroke[0].t);
  }, 0) / Math.max(allStrokes.length, 1);

  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const width  = Math.max(...xs) - Math.min(...xs) || 1;
  const height = Math.max(...ys) - Math.min(...ys) || 1;
  const aspectRatio = width / height;

  let overallEntropy = 0, velocityEntropy = 0;
  try {
    const entropy = calculateTemporalEntropy(points);
    overallEntropy = entropy.overallEntropy || 0;
    velocityEntropy = entropy.velocityEntropy || 0;
  } catch { /* non-fatal */ }

  let rhythmRegularity = 0, cadenceVariance = 0;
  try {
    const rhythm = analyzeStrokeRhythm(allStrokes);
    rhythmRegularity = rhythm.rhythmRegularity || 0;
    const cadence = extractSigningCadence(points, allStrokes);
    cadenceVariance = cadence.cadenceVariance || 0;
  } catch { /* non-fatal */ }

  let rhythmScore = 0, cadenceConsistency = 0;
  try {
    const profile = profileSigningCadence(points, allStrokes);
    rhythmScore = profile.rhythmScore || 0;
    cadenceConsistency = profile.cadenceConsistency || 0;
  } catch { /* non-fatal */ }

  let totalPauseCount = 0, avgPauseDuration = 0;
  try {
    const pauseInfo = detectMicroPauses(points, allStrokes);
    totalPauseCount = pauseInfo.totalPauseCount || 0;
    avgPauseDuration = pauseInfo.avgPauseDuration || 0;
  } catch { /* non-fatal */ }

  return [
    strokeCount,
    avgSpeed,
    speedVar,
    totalTime / 1000,
    directionChanges,
    avgCurvature,
    aspectRatio,
    penLiftCount,
    meanPressure,
    pressureVar,
    strokeDuration / 1000,
    meanAngularVel,
    overallEntropy,
    velocityEntropy,
    rhythmRegularity,
    cadenceVariance,
    rhythmScore,
    cadenceConsistency,
    totalPauseCount,
    avgPauseDuration / 1000
  ];
}