/**
 * score_fusion.js — Fixed scoring pipeline with configuration constants
 */

// ── Configuration Constants ──────────────────────────────────────────────────
export const DTW_SCALE_MULTIPLIER = 3.0;
export const DTW_MIN_THRESHOLD = 0.08;

// Model Fusion Weights
export const BASE_DTW_WEIGHT = 0.80;
export const BASE_IMAGE_WEIGHT = 0.10;
export const BASE_BEHAVIOR_WEIGHT = 0.10;

// Dynamic Threshold Settings
export const COLD_START_THRESHOLD = 62;
export const THRESHOLD_OFFSET = 8;
export const MIN_DYNAMIC_THRESHOLD = 60;
export const MAX_DYNAMIC_THRESHOLD = 80;

// PT Distance Normalization Weights & Scales
export const MAX_VELOCITY_SCALE = 5.0;
export const PT_DIST_X_WEIGHT = 1.0;
export const PT_DIST_Y_WEIGHT = 1.0;
export const PT_DIST_VEL_WEIGHT = 0.3;
export const PT_DIST_DIR_WEIGHT = 0.2;
export const PT_DIST_CURV_WEIGHT = 0.1;
export const PT_DIST_PRESSURE_WEIGHT = 0.15;

/**
 * Standardize features using stored mean and std.
 */
export function standardize(features, stats) {
    if (!stats) return features;
    return features.map((v, i) => (v - stats.mean[i]) / (stats.std[i] || 1));
}

/**
 * Convert DTW distance → 0–100 similarity score.
 */
export function dtwDistanceToSimilarity(distance, threshold = 0.12) {
    // Clamp threshold to a sane range
    const t = Math.max(threshold, DTW_MIN_THRESHOLD);
    // scale = threshold * DTW_SCALE_MULTIPLIER so bad signatures score lower.
    const scale = t * DTW_SCALE_MULTIPLIER;
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
 */
export function fuseScores(dtwSim, imageSim, behaviorSim) {
    const dtwScore = Math.max(0, Math.min(100, dtwSim)) / 100;
    const imageScore = confidenceAdjustedScore(imageSim);
    const behavioralScore = confidenceAdjustedScore(behaviorSim);

    // DTW is the most robust signal.
    let dtwWeight = BASE_DTW_WEIGHT;
    const imageWeight = imageScore !== null ? BASE_IMAGE_WEIGHT : 0;
    const behaviorWeight = behavioralScore !== null ? BASE_BEHAVIOR_WEIGHT : 0;
    
    // absorb unused weight
    dtwWeight += ((BASE_IMAGE_WEIGHT + BASE_BEHAVIOR_WEIGHT) - imageWeight - behaviorWeight);

    const fused = weightedAverage([
        { score: dtwScore,       weight: dtwWeight },
        { score: imageScore,     weight: imageWeight },
        { score: behavioralScore, weight: behaviorWeight },
    ]);

    return Math.max(0, Math.min(100, fused * 100));
}

/**
 * Point distance for DTW.
 */
export function ptDist(a, b) {
    const dx = (a.x - b.x) ** 2;
    const dy = (a.y - b.y) ** 2;

    const velA = Math.min((a.vel || 0) / MAX_VELOCITY_SCALE, 1);
    const velB = Math.min((b.vel || 0) / MAX_VELOCITY_SCALE, 1);
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
        dx * PT_DIST_X_WEIGHT +
        dy * PT_DIST_Y_WEIGHT +
        dv * PT_DIST_VEL_WEIGHT +
        dd * PT_DIST_DIR_WEIGHT +
        dc * PT_DIST_CURV_WEIGHT +
        dp * PT_DIST_PRESSURE_WEIGHT
    );
}

/**
 * Dynamic threshold — adapts as the user builds a score history.
 */
export function getDynamicThreshold(avgScore) {
    if (avgScore === null || avgScore === undefined) return COLD_START_THRESHOLD;
    return Math.max(MIN_DYNAMIC_THRESHOLD, Math.min(MAX_DYNAMIC_THRESHOLD, avgScore - THRESHOLD_OFFSET));
}