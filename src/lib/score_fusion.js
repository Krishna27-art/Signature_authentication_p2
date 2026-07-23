/**
 * score_fusion.js — Precision scoring pipeline with strict accuracy thresholds
 */

// ── Configuration Constants ──────────────────────────────────────────────────
export const DTW_SCALE_MULTIPLIER = 1.5; // Steeper exponential decay for clear separation
export const DTW_MIN_THRESHOLD = 0.08;

// Model Fusion Weights (DTW + Spatial Image model take priority for spatial accuracy)
export const BASE_DTW_WEIGHT      = 0.55;
export const BASE_IMAGE_WEIGHT    = 0.25;
export const BASE_BEHAVIOR_WEIGHT = 0.10;
export const BASE_SIAMESE_WEIGHT  = 0.10;

// Dynamic Threshold Settings
export const COLD_START_THRESHOLD = 68;
export const THRESHOLD_OFFSET = 6;
export const MIN_DYNAMIC_THRESHOLD = 68;
export const MAX_DYNAMIC_THRESHOLD = 85;

export const FINE_POINTER_OFFSET = 5;
export const FINE_MIN_THRESHOLD = 72;
export const FINE_MAX_THRESHOLD = 88;

export const COARSE_POINTER_OFFSET = 8;
export const COARSE_MIN_THRESHOLD = 68;
export const COARSE_MAX_THRESHOLD = 82;

// PT Distance Normalization Weights & Scales
export const MAX_VELOCITY_SCALE = 5.0;
export const PT_DIST_X_WEIGHT = 1.2;
export const PT_DIST_Y_WEIGHT = 1.2;
export const PT_DIST_VEL_WEIGHT = 0.3;
export const PT_DIST_DIR_WEIGHT = 0.2;
export const PT_DIST_CURV_WEIGHT = 0.15;
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
    const t = Math.max(threshold, DTW_MIN_THRESHOLD);
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
    // No artificial 10% inflation — return strict normalized score
    return normalized;
}

/**
 * Mean of nearest distances for robust representation.
 */
export function summarizeNearestDistances(distances, take = 3) {
    const clean = distances
        .filter((d) => Number.isFinite(d))
        .sort((a, b) => a - b)
        .slice(0, take);
    if (clean.length === 0) return Infinity;
    return clean.reduce((a, b) => a + b, 0) / clean.length;
}

export function scoreFromDistanceBand(bestDistance, referenceThreshold) {
    const ratio = bestDistance / Math.max(referenceThreshold, 0.01);
    if (ratio <= 0.75) return 1;
    if (ratio >= 1.5) return 0;
    return 1 - (ratio - 0.75) / 0.75;
}

/**
 * Fuse DTW, Siamese, behavioral, and spatial image scores.
 */
export function fuseScores(dtwSim, siameseSim, behaviorSim, imageSim = null) {
    const dtwScore = Math.max(0, Math.min(100, dtwSim)) / 100;
    const imageScore = imageSim !== null ? Math.max(0, Math.min(100, imageSim)) / 100 : null;
    const siameseScore = confidenceAdjustedScore(siameseSim);
    const behavioralScore = confidenceAdjustedScore(behaviorSim);

    const activeEntries = [
        { score: dtwScore, weight: BASE_DTW_WEIGHT }
    ];

    if (imageScore !== null) {
        activeEntries.push({ score: imageScore, weight: BASE_IMAGE_WEIGHT });
    }
    if (siameseScore !== null) {
        activeEntries.push({ score: siameseScore, weight: BASE_SIAMESE_WEIGHT });
    }
    if (behavioralScore !== null) {
        activeEntries.push({ score: behavioralScore, weight: BASE_BEHAVIOR_WEIGHT });
    }

    const fused = weightedAverage(activeEntries);
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
export function getDynamicThreshold(avgScore, calibration = null) {
    let offset = THRESHOLD_OFFSET;
    let minThreshold = MIN_DYNAMIC_THRESHOLD;
    let maxThreshold = MAX_DYNAMIC_THRESHOLD;

    if (calibration && calibration.profile) {
        const { pointerType } = calibration.profile;
        if (pointerType === 'fine') {
            offset = FINE_POINTER_OFFSET;
            minThreshold = FINE_MIN_THRESHOLD;
            maxThreshold = FINE_MAX_THRESHOLD;
        } else if (pointerType === 'coarse') {
            offset = COARSE_POINTER_OFFSET;
            minThreshold = COARSE_MIN_THRESHOLD;
            maxThreshold = COARSE_MAX_THRESHOLD;
        }
    }

    if (avgScore === null || avgScore === undefined) return COLD_START_THRESHOLD;
    return Math.max(minThreshold, Math.min(maxThreshold, avgScore - offset));
}