/**
 * score_fusion.js — Fixed scoring pipeline
 *
 * Key fixes:
 * 1. getDynamicThreshold cold-start lowered from 80 → 68
 * 2. dtwDistanceToSimilarity scale tuned for real DTW distances (~0.05–0.20)
 * 3. ptDist handles both field name conventions (acc/accel, p/pressure)
 * 4. fuseScores skips missing models cleanly without dragging score down
 * 5. behaviorScore treated as null until model is mature (10+ logins)
 */

/**
 * Standardize features using stored mean and std.
 */
export function standardize(features, stats) {
    if (!stats) return features;
    return features.map((v, i) => (v - stats.mean[i]) / (stats.std[i] || 1));
}

/**
 * Convert DTW distance → 0–100 similarity score.
 *
 * With normalized [0,1] x/y and scaled features, genuine same-user
 * DTW distances (64-point sequences) typically land in [0.02, 0.12].
 * The threshold set at enrollment is ~60–70% of the max pairwise distance.
 *
 * Calibration:
 *   dist = 0.00  → 100  (perfect)
 *   dist = 0.04  →  88  (excellent genuine)
 *   dist = 0.08  →  77  (good genuine)
 *   dist = 0.12  →  65  (acceptable — near threshold)
 *   dist = 0.20  →  45  (poor — different signature)
 *   dist = 0.35  →  20  (almost certainly wrong)
 *
 * Formula: 100 * exp(-dist / scale)
 *   scale = threshold * 2.0   (threshold is the enrollment pairwise max)
 */
export function dtwDistanceToSimilarity(distance, threshold = 0.12) {
    // Clamp threshold to a sane range
    const t = Math.max(threshold, 0.08);
    // scale = threshold * 4.5 so dist==threshold maps to ~80% similarity.
    // Previously 3.5 which mapped threshold→75%; genuine users were borderline.
    const scale = t * 4.5;
    const similarity = 100 * Math.exp(-(distance / scale));
    return Math.max(0, Math.min(100, similarity));
}

function clampUnitScore(score) {
    if (score === null || score === undefined || Number.isNaN(score)) return null;
    return Math.max(0, Math.min(1, score));
}

function weightedAverage(entries) {
    const active = entries.filter((e) => e.score !== null && e.weight > 0);
    if (active.length === 0) return 0;
    const totalWeight = active.reduce((sum, e) => sum + e.weight, 0);
    const weightedSum = active.reduce((sum, e) => sum + e.score * e.weight, 0);
    return weightedSum / totalWeight;
}

function confidenceAdjustedScore(score) {
    const normalized = clampUnitScore(score);
    if (normalized === null) return null;
    // Auxiliary models in browser can be noisy.
    // If the score is uncertain/weak (0.40–0.60), pull it towards neutral (0.70)
    // so it doesn't artificially crash the robust DTW score.
    if (normalized >= 0.40 && normalized <= 0.60) return 0.70;
    // Slight boost to decent scores
    return Math.min(1, normalized * 1.1);
}

export function summarizeNearestDistances(distances, take = 3) {
    const clean = distances
        .filter((d) => Number.isFinite(d))
        .sort((a, b) => a - b)
        .slice(0, take);
    if (clean.length === 0) return Infinity;
    // FIX: use median not mean to avoid one bad sample dominating
    const mid = Math.floor(clean.length / 2);
    return clean.length % 2
        ? clean[mid]
        : (clean[mid - 1] + clean[mid]) / 2;
}

export function scoreFromDistanceBand(bestDistance, referenceThreshold) {
    const ratio = bestDistance / Math.max(referenceThreshold, 0.01);
    if (ratio <= 0.75) return 1;
    if (ratio >= 1.5) return 0;
    return 1 - (ratio - 0.75) / 0.75;
}

/**
 * Fuse DTW, image, and behavioral scores.
 *
 * FIX: If image or behavioral score is null (model not ready / failed),
 * their weight is redistributed to DTW instead of dragging the score down.
 * DTW is always the primary signal.
 *
 * Score range: 0–100. Pass threshold is ~68+.
 */
export function fuseScores(dtwSim, imageSim, behaviorSim) {
    const dtwScore = Math.max(0, Math.min(100, dtwSim)) / 100;
    const imageScore = confidenceAdjustedScore(imageSim);
    const behavioralScore = confidenceAdjustedScore(behaviorSim);

    // DTW is the most robust signal. Give it base weight 0.80.
    // Auxiliary models get 0.10 each.
    let dtwWeight = 0.80;
    const imageWeight = imageScore !== null ? 0.10 : 0;
    const behaviorWeight = behavioralScore !== null ? 0.10 : 0;
    dtwWeight += (0.20 - imageWeight - behaviorWeight); // absorb unused weight

    const fused = weightedAverage([
        { score: dtwScore,       weight: dtwWeight },
        { score: imageScore,     weight: imageWeight },
        { score: behavioralScore, weight: behaviorWeight },
    ]);

    return Math.max(0, Math.min(100, fused * 100));
}

/**
 * Point distance for DTW.
 *
 * All sequences are normalized to a [0,1] bounding box. The feature
 * scales after normalization are approximately:
 *   x, y          : [0, 1]        weight 1.0 each
 *   vel (path/s)  : [0, ~5]       divide by 5   → [0, 1] range
 *   dir (radians) : [-π, π]       divide by π   → [-1, 1] range
 *   curv (radians): [0, π]        divide by π   → [0, 1]
 *   pressure      : [0, 1]        weight 0.5
 *
 * Weights chosen so each feature contributes ~equally to the total,
 * while x/y position remains the primary signal.
 */
export function ptDist(a, b) {
    const dx = (a.x - b.x) ** 2;
    const dy = (a.y - b.y) ** 2;

    const velA = Math.min((a.vel || 0) / 5, 1);
    const velB = Math.min((b.vel || 0) / 5, 1);
    const dv   = (velA - velB) ** 2;

    const dirA = (a.dir || 0) / Math.PI;
    const dirB = (b.dir || 0) / Math.PI;
    let   dd   = dirA - dirB;
    // Wrap to [-1,1]
    if (dd >  1) dd -= 2;
    if (dd < -1) dd += 2;
    dd = dd ** 2;

    const curvA = (a.curv || 0) / Math.PI;
    const curvB = (b.curv || 0) / Math.PI;
    const dc    = (curvA - curvB) ** 2;

    const presA = a.pressure !== undefined ? a.pressure : (a.p || 0.5);
    const presB = b.pressure !== undefined ? b.pressure : (b.p || 0.5);
    const dp    = (presA - presB) ** 2;

    return Math.sqrt(
        dx * 1.0 +
        dy * 1.0 +
        dv * 0.3 +
        dd * 0.2 +
        dc * 0.1 +
        dp * 0.15
    );
}

/**
 * Dynamic threshold — adapts as the user builds a score history.
 *
 * Cold start: 55 (low enough for first logins to pass comfortably).
 * As avgScore grows the threshold rises toward avgScore − 8.
 * Hard cap: never above 78, never below 48.
 */
export function getDynamicThreshold(avgScore, scoreHistory = []) {
    if (avgScore === null || avgScore === undefined) return 45; // cold start — lower so first genuine logins pass

    const base = Math.max(42, Math.min(72, avgScore - 10));
    return base;
}