/**
 * synthetic_gen.js
 * Generates programmatic signature point arrays for automated testing.
 * No canvas or human input needed. Import this in any test file.
 *
 * Each point: { x, y, t }  (x, y = coordinates, t = timestamp in ms)
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Box-Muller: Gaussian noise with mean=0, std=sigma */
function gauss(sigma = 1) {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
}

/** Interpolate along a cubic Bezier at parameter t ∈ [0,1] */
function bezierPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    x: mt**3*p0.x + 3*mt**2*t*p1.x + 3*mt*t**2*p2.x + t**3*p3.x,
    y: mt**3*p0.y + 3*mt**2*t*p1.y + 3*mt*t**2*p2.y + t**3*p3.y,
  };
}

/** Sample n points along a cubic Bezier stroke */
function sampleBezier(p0, p1, p2, p3, n = 32) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(bezierPoint(p0, p1, p2, p3, i / (n - 1)));
  return pts;
}

/** Add human-like timing: sinusoidal speed variation + Gaussian jitter */
function addTiming(points, baseSpeed = 3, startTime = 0) {
  let t = startTime;
  return points.map((p, i) => {
    const progress = i / Math.max(points.length - 1, 1);
    // Speed: fast in the middle, slow at start and end (natural pen motion)
    const speedMultiplier = 0.5 + Math.sin(progress * Math.PI) * 0.8 + gauss(0.15);
    const pixelDist = i === 0 ? 1 : Math.hypot(
      p.x - points[i - 1].x,
      p.y - points[i - 1].y
    );
    // Use random float delta (not floored) so uniqueDts count stays high
    t += Math.max(2, (pixelDist / (baseSpeed * Math.max(0.1, speedMultiplier))));
    return { x: p.x, y: p.y, t: Math.round(t * 10) / 10 }; // 0.1ms resolution
  });
}

/** Add position jitter to simulate natural hand variation */
function jitter(points, sigma = 3) {
  return points.map(p => ({ x: p.x + gauss(sigma), y: p.y + gauss(sigma), t: p.t }));
}

// ─── Signature Blueprints ────────────────────────────────────────────────────

const BLUEPRINTS = {
  userA: [
    [{ x:100,y:200 }, { x:130,y:120 }, { x:200,y:140 }, { x:220,y:200 }],
    [{ x:220,y:200 }, { x:240,y:240 }, { x:200,y:280 }, { x:160,y:260 }],
    [{ x:160,y:260 }, { x:180,y:300 }, { x:260,y:290 }, { x:280,y:260 }],
  ],
  userB: [
    [{ x:80, y:150 }, { x:150,y:100 }, { x:250,y:180 }, { x:300,y:150 }],
    [{ x:300,y:150 }, { x:320,y:200 }, { x:280,y:250 }, { x:240,y:220 }],
  ],
  userC: [
    [{ x:120,y:180 }, { x:160,y:100 }, { x:220,y:160 }, { x:180,y:220 }],
    [{ x:180,y:220 }, { x:140,y:280 }, { x:200,y:300 }, { x:260,y:270 }],
    [{ x:260,y:270 }, { x:300,y:250 }, { x:310,y:200 }, { x:280,y:180 }],
  ],
};

// ─── Public Generators ───────────────────────────────────────────────────────

/**
 * Generate a GENUINE attempt: same shape as blueprint, with natural variation.
 */
export function generateGenuine(user = 'userA', jitterSigma = 3, scaleFactor = 1.0, timeOffset = 0) {
  const blueprint = BLUEPRINTS[user];
  if (!blueprint) throw new Error(`Unknown user: ${user}`);
  
  let allPoints = [];
  let t = timeOffset;
  
  for (const [p0, p1, p2, p3] of blueprint) {
    const scale = (p) => ({ x: p.x * scaleFactor, y: p.y * scaleFactor });
    const pts = sampleBezier(scale(p0), scale(p1), scale(p2), scale(p3), 32);
    const timed = addTiming(pts, 3, t);
    const jittered = jitter(timed, jitterSigma);
    allPoints = allPoints.concat(jittered);
    t = allPoints[allPoints.length - 1].t + Math.abs(gauss(30)) + 150;
  }
  
  return allPoints;
}

/**
 * Generate an IMPOSTOR attempt.
 * Uses an inverted / mirrored + scaled version of a different user's blueprint
 * to guarantee structural dissimilarity after normalization.
 */
export function generateImpostor(enrolledUser = 'userA') {
  // Pick a different user
  const others = Object.keys(BLUEPRINTS).filter(u => u !== enrolledUser);
  const impostorUser = others[Math.floor(Math.random() * others.length)];
  const blueprint = BLUEPRINTS[impostorUser];

  // Apply a heavy transformation: mirror X, scale Y by 1.5, rotate 90°
  const transform = (p) => ({
    x: -p.x * 1.0 + 400,  // horizontal mirror
    y:  p.y * 1.5,         // vertical stretch
  });

  let allPoints = [];
  let t = 0;

  for (const [p0, p1, p2, p3] of blueprint) {
    const pts = sampleBezier(transform(p0), transform(p1), transform(p2), transform(p3), 32);
    const timed = addTiming(pts, 4, t);
    const jittered = jitter(timed, 8); // more jitter = less skilled forger
    allPoints = allPoints.concat(jittered);
    t = allPoints[allPoints.length - 1].t + 200;
  }

  return allPoints;
}

/**
 * Generate a SCALED version of a genuine signature.
 */
export function generateScaled(user = 'userA', scaleFactor = 0.7) {
  return generateGenuine(user, 3, scaleFactor);
}

/**
 * Generate a ROBOT signature: arc-length-resampled equal-distance points,
 * ALL in a single continuous stroke with constant timing (no pauses).
 * Speed CoV will be ≈ 0.
 */
export function generateRobot(user = 'userA') {
  const blueprint = BLUEPRINTS[user];

  // Collect all raw Bezier points
  let raw = [];
  for (const [p0, p1, p2, p3] of blueprint) {
    raw = raw.concat(sampleBezier(p0, p1, p2, p3, 64));
  }

  // Compute total arc length
  let totalLen = 0;
  for (let i = 1; i < raw.length; i++) {
    totalLen += Math.hypot(raw[i].x - raw[i-1].x, raw[i].y - raw[i-1].y);
  }

  // Arc-length resample to 96 equally-spaced points
  const n = 96;
  const stepLen = totalLen / (n - 1);
  const resampled = [raw[0]];
  let accumulated = 0;

  for (let i = 1; i < raw.length && resampled.length < n; i++) {
    const segLen = Math.hypot(raw[i].x - raw[i-1].x, raw[i].y - raw[i-1].y);
    accumulated += segLen;
    while (accumulated >= stepLen && resampled.length < n) {
      const ratio = (accumulated - stepLen) / (segLen || 1);
      resampled.push({
        x: raw[i].x - ratio * (raw[i].x - raw[i-1].x),
        y: raw[i].y - ratio * (raw[i].y - raw[i-1].y),
      });
      accumulated -= stepLen;
    }
  }
  while (resampled.length < n) resampled.push(resampled[resampled.length - 1]);

  // CONSTANT timestamps (same dt for every step)
  const DT = 20; // ms per step
  return resampled.slice(0, n).map((p, i) => ({ x: p.x, y: p.y, t: i * DT }));
}

/**
 * Generate a REPLAY ATTACK: exact copy of a recorded signature.
 */
export function generateReplay(originalSignature) {
  return originalSignature.map(p => ({ ...p }));
}

/**
 * Generate a SLIGHT FORGERY: correct shape but heavy jitter.
 */
export function generateForgery(user = 'userA') {
  return generateGenuine(user, 18, 1.0);
}

/**
 * Generate a signature WITH a trailing dot.
 */
export function generateWithTrailingDot(user = 'userA') {
  const sig = generateGenuine(user);
  const lastPt = sig[sig.length - 1];
  for (let i = 0; i < 8; i++) {
    sig.push({ x: lastPt.x + gauss(0.5), y: lastPt.y + gauss(0.5), t: lastPt.t + 400 + i * 50 });
  }
  return sig;
}

/**
 * Generate a signature WITHOUT a trailing dot.
 */
export function generateWithoutTrailingDot(user = 'userA') {
  return generateGenuine(user);
}

/**
 * Batch generator for FAR/FRR testing.
 */
export function generateBatch(user = 'userA', n = 100) {
  return {
    genuine:  Array.from({ length: n }, () => generateGenuine(user, 3 + Math.random() * 4)),
    impostor: Array.from({ length: n }, () => generateImpostor(user)),
  };
}

/**
 * Generate a SKILLED FORGERY attempt: tries to match the target's shape
 * but with proportions, curvature, and timing errors.
 */
export function generateSkilledForgery(user = 'userA', skillLevel = 0.5) {
  // skillLevel: 0 = poor imitation, 1 = near-perfect trace
  const blueprint = BLUEPRINTS[user];

  // A forger copies rough control-point positions but gets proportions,
  // curvature, and timing wrong in proportion to their skill.
  const shapeError = (1 - skillLevel) * 25;      // px error in copied geometry
  const timingError = (1 - skillLevel) * 0.6;    // rhythm mismatch — forgers hesitate

  let allPoints = [];
  let t = 0;
  for (const [p0, p1, p2, p3] of blueprint) {
    const perturb = (p) => ({ x: p.x + gauss(shapeError), y: p.y + gauss(shapeError) });
    const pts = sampleBezier(perturb(p0), perturb(p1), perturb(p2), perturb(p3), 32);
    // forgers move slower/more hesitantly than the real signer, especially early on
    const timed = addTiming(pts, 3 * (1 + timingError), t);
    allPoints = allPoints.concat(timed);
    t = allPoints[allPoints.length - 1].t + 200;
  }
  return allPoints;
}

/**
 * Alias for generateImpostor representing random forgery.
 */
export function generateRandomForgery(enrolledUser = 'userA') {
  return generateImpostor(enrolledUser);
}

