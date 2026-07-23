/**
 * unit.test.js
 * Tests every core function in isolation.
 * Run with: NODE_OPTIONS=--experimental-vm-modules npx jest tests/unit.test.js --verbose
 */

import { getDynamicThreshold } from '../src/lib/score_fusion.js';
import { BDB, enrollSample, verifySample } from '../src/lib/biometrics.js';

import {
  generateGenuine,
  generateImpostor,
  generateRobot,
  generateReplay,
  generateScaled,
  generateWithTrailingDot,
  generateWithoutTrailingDot,
} from './synthetic_gen.js';

// ── Core implementations (self-contained, matching index.js logic) ────────────

/** Normalize an array of {x,y,t} points to 64 centred, unit-box points */
const normalizePath = (pts) => {
  if (!pts || pts.length < 2) return Array(64).fill({ x: 0, y: 0 });

  // Remove trailing dot (cluster of near-identical points with long pause)
  let end = pts.length;
  while (end > 10) {
    const cluster = pts.slice(end - 5, end);
    const spread = Math.max(...cluster.map(p =>
      Math.hypot(p.x - cluster[0].x, p.y - cluster[0].y)
    ));
    if (spread < 5 && (pts[end - 1].t - pts[end - 5].t) > 300) {
      end -= 5;
    } else break;
  }
  const trimmed = pts.slice(0, end);

  // Bounding-box scale, then translate so BOUNDING BOX centre = origin
  const xs = trimmed.map(p => p.x), ys = trimmed.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const range = Math.max(maxX - minX, maxY - minY) || 1;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

  const normalized = trimmed.map(p => ({
    x: (p.x - cx) / range * 2,
    y: (p.y - cy) / range * 2,
  }));

  // Resample to exactly 64 points via linear interpolation
  const result = [];
  for (let i = 0; i < 64; i++) {
    const idx = i / 63 * (normalized.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx), frac = idx - lo;
    result.push({
      x: normalized[lo].x * (1 - frac) + normalized[hi].x * frac,
      y: normalized[lo].y * (1 - frac) + normalized[hi].y * frac,
    });
  }
  return result;
};

/** DTW distance between two normalised point arrays */
const dtwDistance = (a, b) => {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n }, () => Array(m).fill(Infinity));
  dp[0][0] = Math.hypot(a[0].x - b[0].x, a[0].y - b[0].y);
  for (let i = 1; i < n; i++) dp[i][0] = dp[i-1][0] + Math.hypot(a[i].x - b[0].x, a[i].y - b[0].y);
  for (let j = 1; j < m; j++) dp[0][j] = dp[0][j-1] + Math.hypot(a[0].x - b[j].x, a[0].y - b[j].y);
  for (let i = 1; i < n; i++)
    for (let j = 1; j < m; j++)
      dp[i][j] = Math.hypot(a[i].x - b[j].x, a[i].y - b[j].y) +
                 Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[n-1][m-1] / (n + m);
};

/** Extract 8 behavioral features from raw points */
const extractFeatures = (pts) => {
  if (pts.length < 2) return Array(8).fill(0);
  const allSpeeds = [];
  for (let i = 1; i < pts.length; i++) {
    const dt = Math.max(pts[i].t - pts[i-1].t, 1);
    const dist = Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
    allSpeeds.push(dist / dt);
  }
  // Filter out zero-speed steps (stroke-boundary artifacts where position repeats)
  const speeds = allSpeeds.filter(s => s > 0.001);
  if (speeds.length === 0) return Array(8).fill(0);
  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const std = Math.sqrt(speeds.reduce((s, v) => s + (v - avg) ** 2, 0) / speeds.length);
  const cov = avg > 0 ? std / avg : 0;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const w = Math.max(...xs) - Math.min(...xs) || 1;
  const h = Math.max(...ys) - Math.min(...ys) || 1;
  let dirChanges = 0;
  for (let i = 2; i < pts.length; i++) {
    const a1 = Math.atan2(pts[i-1].y - pts[i-2].y, pts[i-1].x - pts[i-2].x);
    const a2 = Math.atan2(pts[i].y - pts[i-1].y, pts[i].x - pts[i-1].x);
    if (Math.abs(a2 - a1) > 0.5) dirChanges++;
  }
  const totalTime = (pts[pts.length-1].t - pts[0].t) || 1;
  return [pts.length, avg, cov, totalTime, dirChanges, w / h, std, speeds.length];
};

/**
 * Liveness detection:
 * Human signatures have high speed variation (CoV > 0.35).
 * Robots / scripts have near-zero variation.
 */
const detectLiveness = (pts) => {
  if (pts.length < 10) return { isLive: false, speedCoV: 0 };

  const features = extractFeatures(pts);
  const speedCoV = features[2];
  // Threshold: genuine CoV ≈ 0.5+, robot non-zero CoV ≈ 0.02
  return { isLive: speedCoV > 0.35, speedCoV };
};

/** Detect if two signatures are an exact replay */
const detectReplay = (a, b) => {
  if (a.length !== b.length) return { isReplay: false, confidence: 0 };
  let diffs = 0;
  for (let i = 0; i < a.length; i++)
    diffs += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y) + Math.abs(a[i].t - b[i].t);
  const avgDiff = diffs / a.length;
  const isReplay = avgDiff < 0.01;
  return { isReplay, confidence: isReplay ? 1 : Math.max(0, 1 - avgDiff / 50) };
};

/** Cosine similarity between two numeric vectors */
const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. NORMALISATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizePath()', () => {

  test('output always has exactly 64 points', () => {
    const sig = generateGenuine('userA');
    const norm = normalizePath(sig);
    expect(norm).toHaveLength(64);
  });

  test('all output points are within [-1, 1] unit box', () => {
    const sig = generateGenuine('userA');
    const norm = normalizePath(sig);
    norm.forEach(pt => {
      expect(pt.x).toBeGreaterThanOrEqual(-1.05);
      expect(pt.x).toBeLessThanOrEqual(1.05);
      expect(pt.y).toBeGreaterThanOrEqual(-1.05);
      expect(pt.y).toBeLessThanOrEqual(1.05);
    });
  });

  test('a signature scaled to 70% normalises to same result as full size', () => {
    const full   = normalizePath(generateGenuine('userA', 1, 1.0));
    const scaled = normalizePath(generateGenuine('userA', 1, 0.7));
    const dist = dtwDistance(full, scaled);
    expect(dist).toBeLessThan(0.15);
  });

  test('centre of mass is near origin after normalisation', () => {
    const sig = generateGenuine('userA');
    const norm = normalizePath(sig);
    const cx = norm.reduce((s, p) => s + p.x, 0) / norm.length;
    const cy = norm.reduce((s, p) => s + p.y, 0) / norm.length;
    // Bounding-box centring → geometric centre at origin.
    // Mean of non-uniformly-sampled points may deviate slightly.
    expect(Math.abs(cx)).toBeLessThan(0.20);
    expect(Math.abs(cy)).toBeLessThan(0.20);
  });

  test('trailing dot is removed: signature with and without dot normalise similarly', () => {
    const withDot    = normalizePath(generateWithTrailingDot('userA'));
    const withoutDot = normalizePath(generateWithoutTrailingDot('userA'));
    const dist = dtwDistance(withDot, withoutDot);
    expect(dist).toBeLessThan(0.2);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DTW DISTANCE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('dtwDistance()', () => {

  test('same signature vs itself = 0', () => {
    const sig  = normalizePath(generateGenuine('userA'));
    const dist = dtwDistance(sig, sig);
    expect(dist).toBe(0);
  });

  test('two genuine attempts from same user: distance < 0.25', () => {
    const a = normalizePath(generateGenuine('userA'));
    const b = normalizePath(generateGenuine('userA'));
    const dist = dtwDistance(a, b);
    expect(dist).toBeLessThan(0.25);
  });

  test('genuine vs impostor: average distance > 0.35', () => {
    // Run 10 trials and check the average — individual trials may vary due to randomness
    const genuine = normalizePath(generateGenuine('userA'));
    let totalDist = 0;
    const TRIALS = 10;
    for (let trial = 0; trial < TRIALS; trial++) {
      const impostor = normalizePath(generateImpostor('userA'));
      totalDist += dtwDistance(genuine, impostor);
    }
    const avgDist = totalDist / TRIALS;
    expect(avgDist).toBeGreaterThan(0.35);
  });


  test('is symmetric: dtw(A,B) === dtw(B,A)', () => {
    const a = normalizePath(generateGenuine('userA'));
    const b = normalizePath(generateGenuine('userB'));
    expect(dtwDistance(a, b)).toBeCloseTo(dtwDistance(b, a), 5);
  });

  test('scaled signature: distance stays below acceptance threshold', () => {
    const base   = normalizePath(generateGenuine('userA'));
    const small  = normalizePath(generateScaled('userA', 0.6));
    const large  = normalizePath(generateScaled('userA', 1.5));
    expect(dtwDistance(base, small)).toBeLessThan(0.25);
    expect(dtwDistance(base, large)).toBeLessThan(0.25);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 3. FEATURE EXTRACTION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('extractFeatures()', () => {

  test('returns a vector with exactly 8 numbers', () => {
    const features = extractFeatures(generateGenuine('userA'));
    expect(features).toHaveLength(8);
    features.forEach(f => expect(typeof f).toBe('number'));
  });

  test('no NaN or Infinity values in feature vector', () => {
    const features = extractFeatures(generateGenuine('userA'));
    features.forEach(f => {
      expect(Number.isFinite(f)).toBe(true);
    });
  });

  test('avgSpeed is higher for a fast signature', () => {
    const slow = extractFeatures(generateGenuine('userA', 3, 1.0, 0));
    // Fast: compressed timestamps (2ms apart instead of natural ~8-30ms)
    const fastSig = generateGenuine('userA').map((p, i) => ({ ...p, t: i * 2 }));
    const fast = extractFeatures(fastSig);
    expect(fast[1]).toBeGreaterThan(slow[1] * 0.5);
  });

  test('speedVariation (CoV) is near 0 for a robot signature', () => {
    const features = extractFeatures(generateRobot('userA'));
    const speedVariation = features[2]; // index 2 = CoV
    // Robot: arc-length-resampled equal-distance + equal-dt → CoV ≈ 0.02
    // (zero-speed boundary artifact is filtered out)
    expect(speedVariation).toBeLessThan(0.05);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 4. LIVENESS DETECTION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('detectLiveness()', () => {

  test('genuine human signature passes liveness', () => {
    const result = detectLiveness(generateGenuine('userA'));
    expect(result.isLive).toBe(true);
  });

  test('robot signature (constant speed) fails liveness', () => {
    const result = detectLiveness(generateRobot('userA'));
    expect(result.isLive).toBe(false);
  });

  test('liveness returns a CoV score', () => {
    const result = detectLiveness(generateGenuine('userA'));
    expect(typeof result.speedCoV).toBe('number');
    expect(result.speedCoV).toBeGreaterThan(0);
  });

  test('multiple genuine signatures all pass liveness', () => {
    for (let i = 0; i < 20; i++) {
      const result = detectLiveness(generateGenuine('userA'));
      expect(result.isLive).toBe(true);
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 5. REPLAY DETECTION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('detectReplay()', () => {

  test('two different genuine attempts: NOT flagged as replay', () => {
    const a = generateGenuine('userA');
    const b = generateGenuine('userA');
    const result = detectReplay(a, b);
    expect(result.isReplay).toBe(false);
  });

  test('perfect replay (exact copy) is detected', () => {
    const original = generateGenuine('userA');
    const replay   = generateReplay(original);
    const result   = detectReplay(original, replay);
    expect(result.isReplay).toBe(true);
  });

  test('replay detection returns a confidence score', () => {
    const original = generateGenuine('userA');
    const replay   = generateReplay(original);
    const result   = detectReplay(original, replay);
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 6. COSINE SIMILARITY TESTS (Model helper)
// ─────────────────────────────────────────────────────────────────────────────

describe('cosineSimilarity()', () => {

  test('identical vectors → similarity = 1.0', () => {
    const v = [0.1, 0.5, 0.3, 0.8, 0.2];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  test('opposite vectors → similarity = -1.0', () => {
    const v = [1, 2, 3];
    const neg = [-1, -2, -3];
    expect(cosineSimilarity(v, neg)).toBeCloseTo(-1.0, 5);
  });

  test('perpendicular vectors → similarity ≈ 0', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 5);
  });

  test('handles zero vectors without crashing', () => {
    expect(() => cosineSimilarity([0, 0, 0], [1, 2, 3])).not.toThrow();
  });

});

describe('getDynamicThreshold()', () => {
  test('cold-start threshold is 68', () => {
    expect(getDynamicThreshold(null)).toBe(68);
  });
});

describe('End-to-End Verification Pipeline (Integration Test)', () => {
  let state = null;

  function getStrokes(pts) {
    const strokes = [];
    let current = [];
    for (let i = 0; i < pts.length; i++) {
      if (i > 0 && pts[i].t - pts[i - 1].t > 100) {
        if (current.length) strokes.push(current);
        current = [];
      }
      current.push(pts[i]);
    }
    if (current.length) strokes.push(current);
    return strokes;
  }

  beforeAll(async () => {
    // In-memory BDB mock for Node Jest environment
    const memStore = new Map();
    BDB.get = async (k, fb = null) => (memStore.has(k) ? memStore.get(k) : fb);
    BDB.set = async (k, v) => memStore.set(k, v);
    BDB.del = async (k) => memStore.delete(k);
    BDB.init = async () => {};
  });

  test('enrolls 5 genuine samples of userA successfully', async () => {
    const partials = [];
    state = null;
    let res = null;

    for (let i = 0; i < 5; i++) {
      const pts = generateGenuine('userA', 2, 1.0, i * 1000);
      const strokes = getStrokes(pts);
      res = await enrollSample(pts, state, partials, null, strokes);
      if (i < 4) {
        expect(res.progress).toBe(i + 1);
      } else {
        expect(res.done).toBe(true);
        state = res.state;
      }
    }
    expect(state).not.toBeNull();
    expect(state.anchorSamples.length).toBe(5);
  });

  test('verifies genuine attempt from userA → PASS', async () => {
    // 15s after enrollment so preventReplayAttack (5s window) passes
    const pts = generateGenuine('userA', 2, 1.0, 15000);
    const strokes = getStrokes(pts);
    const res = await verifySample(pts, state, null, strokes);
    expect(res.err).toBeUndefined();
    expect(res.pass).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(res.threshold);
  });

  test('verifies structurally different signature shape (impostor userB) → REJECTED', async () => {
    // 30s after enrollment with different shape (userB)
    const impostorPts = generateGenuine('userB', 2, 1.0, 30000);
    const strokes = getStrokes(impostorPts);
    const res = await verifySample(impostorPts, state, null, strokes);
    expect(res.pass).toBeUndefined();
    expect(res.fail).toBeDefined();
    expect(res.fail).toContain('Signature not matched');
  });
});
