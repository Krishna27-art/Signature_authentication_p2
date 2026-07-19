/**
 * temporal_entropy.js — Temporal entropy and signing cadence profiling
 * 
 * Implements:
 * - Temporal entropy calculation
 * - Signing cadence profiling
 * - Time-series pattern analysis
 * - Rhythm consistency metrics
 */

/**
 * Calculate temporal entropy of signature
 * @param {Array} points - Raw trajectory points
 * @returns {Object} Temporal entropy metrics
 */
export function calculateTemporalEntropy(points) {
    if (!points || points.length < 2) {
        return {
            temporalEntropy: 0,
            velocityEntropy: 0,
            directionEntropy: 0,
            pressureEntropy: 0,
            overallEntropy: 0
        };
    }
    
    // Calculate inter-point intervals
    const intervals = [];
    for (let i = 1; i < points.length; i++) {
        intervals.push(points[i].t - points[i - 1].t);
    }
    
    // Normalize intervals to probabilities
    const intervalHist = histogram(intervals, 10);
    const intervalProbs = intervalHist.map(count => count / intervals.length);
    const temporalEntropy = calculateEntropy(intervalProbs);
    
    // Calculate velocity entropy
    const velocities = [];
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const dt = Math.max(points[i].t - points[i - 1].t, 1);
        velocities.push(Math.sqrt(dx * dx + dy * dy) / dt);
    }
    
    const velHist = histogram(velocities, 10);
    const velProbs = velHist.map(count => count / velocities.length);
    const velocityEntropy = calculateEntropy(velProbs);
    
    // Calculate direction entropy
    const directions = [];
    for (let i = 1; i < points.length; i++) {
        const angle = Math.atan2(
            points[i].y - points[i - 1].y,
            points[i].x - points[i - 1].x
        );
        directions.push(angle);
    }
    
    const dirHist = histogram(directions, 8, -Math.PI, Math.PI);
    const dirProbs = dirHist.map(count => count / directions.length);
    const directionEntropy = calculateEntropy(dirProbs);
    
    // Calculate pressure entropy
    const pressures = points.map(p => p.p || 0.5);
    const pressHist = histogram(pressures, 10, 0, 1);
    const pressProbs = pressHist.map(count => count / pressures.length);
    const pressureEntropy = calculateEntropy(pressProbs);
    
    // Overall entropy (weighted average)
    const overallEntropy = (
        temporalEntropy * 0.3 +
        velocityEntropy * 0.3 +
        directionEntropy * 0.2 +
        pressureEntropy * 0.2
    );
    
    return {
        temporalEntropy,
        velocityEntropy,
        directionEntropy,
        pressureEntropy,
        overallEntropy
    };
}

/**
 * Profile signing cadence
 * @param {Array} points - Raw trajectory points
 * @param {Array} strokes - Stroke segments
 * @returns {Object} Cadence profile
 */
export function profileSigningCadence(points, strokes = null) {
    if (!points || points.length < 2) {
        return {
            cadenceScore: 0,
            cadenceConsistency: 0,
            temporalPattern: [],
            rhythmScore: 0
        };
    }
    
    const strokeSegments = strokes || segmentByGaps(points);
    
    // Calculate cadence for each stroke
    const strokeCadences = strokeSegments.map(stroke => {
        if (stroke.length < 2) return 0;
        const duration = stroke[stroke.length - 1].t - stroke[0].t;
        return duration > 0 ? stroke.length / duration : 0;
    });
    
    // Cadence score (average)
    const cadenceScore = strokeCadences.reduce((a, b) => a + b, 0) / strokeCadences.length;
    
    // Cadence consistency (inverse of variance)
    const avgCadence = cadenceScore;
    const cadenceVariance = calculateVariance(strokeCadences, avgCadence);
    const cadenceConsistency = avgCadence > 0 ? 1 / (1 + cadenceVariance / avgCadence) : 0;
    
    // Temporal pattern (normalized stroke durations)
    const totalDuration = points[points.length - 1].t - points[0].t;
    const temporalPattern = strokeSegments.map(stroke => {
        if (stroke.length < 2) return 0;
        const duration = stroke[stroke.length - 1].t - stroke[0].t;
        return totalDuration > 0 ? duration / totalDuration : 0;
    });
    
    // Rhythm score (combination of consistency and pattern regularity)
    const patternEntropy = calculateEntropy(temporalPattern);
    const rhythmScore = (cadenceConsistency + (1 - patternEntropy)) / 2;
    
    return {
        cadenceScore,
        cadenceConsistency,
        temporalPattern,
        rhythmScore
    };
}

/**
 * Analyze time-series patterns
 * @param {Array} points - Raw trajectory points
 * @returns {Object} Time-series analysis
 */
export function analyzeTimeSeriesPatterns(points) {
    if (!points || points.length < 3) {
        return {
            autocorrelation: [],
            trend: 0,
            seasonality: 0,
            periodicity: 0
        };
    }
    
    // Extract velocity time series
    const velocities = [];
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const dt = Math.max(points[i].t - points[i - 1].t, 1);
        velocities.push(Math.sqrt(dx * dx + dy * dy) / dt);
    }
    
    // Calculate autocorrelation
    const autocorrelation = calculateAutocorrelation(velocities, Math.min(10, velocities.length - 1));
    
    // Calculate trend (linear regression slope)
    const trend = calculateTrend(velocities);
    
    // Calculate seasonality (variance of periodic components)
    const seasonality = calculateSeasonality(velocities);
    
    // Calculate periodicity (dominant frequency)
    const periodicity = calculatePeriodicity(velocities);
    
    return {
        autocorrelation,
        trend,
        seasonality,
        periodicity
    };
}

/**
 * Calculate rhythm consistency metrics
 * @param {Array} points - Raw trajectory points
 * @param {Array} strokes - Stroke segments
 * @returns {Object} Rhythm consistency metrics
 */
export function calculateRhythmConsistency(points, strokes = null) {
    if (!points || points.length < 2) {
        return {
            strokeTimingConsistency: 0,
            velocityConsistency: 0,
            pressureConsistency: 0,
            overallConsistency: 0
        };
    }
    
    const strokeSegments = strokes || segmentByGaps(points);
    
    // Stroke timing consistency
    const strokeDurations = strokeSegments.map(stroke => {
        if (stroke.length < 2) return 0;
        return stroke[stroke.length - 1].t - stroke[0].t;
    });
    
    const avgDuration = strokeDurations.reduce((a, b) => a + b, 0) / strokeDurations.length;
    const durationVariance = calculateVariance(strokeDurations, avgDuration);
    const strokeTimingConsistency = avgDuration > 0 ? 1 / (1 + durationVariance / avgDuration) : 0;
    
    // Velocity consistency
    const velocities = [];
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const dt = Math.max(points[i].t - points[i - 1].t, 1);
        velocities.push(Math.sqrt(dx * dx + dy * dy) / dt);
    }
    
    const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const velVariance = calculateVariance(velocities, avgVel);
    const velocityConsistency = avgVel > 0 ? 1 / (1 + velVariance / avgVel) : 0;
    
    // Pressure consistency
    const pressures = points.map(p => p.p || 0.5);
    const avgPress = pressures.reduce((a, b) => a + b, 0) / pressures.length;
    const pressVariance = calculateVariance(pressures, avgPress);
    const pressureConsistency = 1 / (1 + pressVariance);
    
    // Overall consistency
    const overallConsistency = (
        strokeTimingConsistency * 0.4 +
        velocityConsistency * 0.4 +
        pressureConsistency * 0.2
    );
    
    return {
        strokeTimingConsistency,
        velocityConsistency,
        pressureConsistency,
        overallConsistency
    };
}

/**
 * Comprehensive temporal analysis
 * @param {Array} points - Raw trajectory points
 * @param {Array} strokes - Stroke segments
 * @returns {Object} Complete temporal analysis
 */
export function comprehensiveTemporalAnalysis(points, strokes = null) {
    const temporalEntropy = calculateTemporalEntropy(points);
    const signingCadence = profileSigningCadence(points, strokes);
    const timeSeriesPatterns = analyzeTimeSeriesPatterns(points);
    const rhythmConsistency = calculateRhythmConsistency(points, strokes);
    
    return {
        ...temporalEntropy,
        ...signingCadence,
        ...timeSeriesPatterns,
        ...rhythmConsistency
    };
}

/**
 * Helper: Calculate histogram
 */
function histogram(values, bins, min = null, max = null) {
    if (values.length === 0) return new Array(bins).fill(0);
    
    const actualMin = min !== null ? min : Math.min(...values);
    const actualMax = max !== null ? max : Math.max(...values);
    const range = actualMax - actualMin || 1;
    
    const hist = new Array(bins).fill(0);
    
    for (const value of values) {
        const bin = Math.min(
            Math.floor(((value - actualMin) / range) * bins),
            bins - 1
        );
        hist[Math.max(bin, 0)]++;
    }
    
    return hist;
}

/**
 * Helper: Calculate Shannon entropy
 */
function calculateEntropy(probabilities) {
    return -probabilities.reduce((sum, p) => {
        if (p > 0) return sum + p * Math.log2(p);
        return sum;
    }, 0);
}

/**
 * Helper: Calculate variance
 */
function calculateVariance(values, mean) {
    // A05 fix: guard against empty array to prevent NaN from 0-length division
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

/**
 * Helper: Segment by gaps
 */
function segmentByGaps(points) {
    const segments = [];
    let currentSegment = [points[0]];
    
    for (let i = 1; i < points.length; i++) {
        const gap = points[i].t - points[i - 1].t;
        
        if (gap > 100) {
            segments.push(currentSegment);
            currentSegment = [points[i]];
        } else {
            currentSegment.push(points[i]);
        }
    }
    
    if (currentSegment.length > 0) {
        segments.push(currentSegment);
    }
    
    return segments;
}

/**
 * Helper: Calculate autocorrelation
 */
function calculateAutocorrelation(series, maxLag) {
    const n = series.length;
    const mean = series.reduce((a, b) => a + b, 0) / n;
    const variance = series.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
    
    const autocorr = [];
    for (let lag = 1; lag <= maxLag; lag++) {
        let sum = 0;
        for (let i = 0; i < n - lag; i++) {
            sum += (series[i] - mean) * (series[i + lag] - mean);
        }
        autocorr.push(sum / (n - lag) / variance);
    }
    
    return autocorr;
}

/**
 * Helper: Calculate trend
 */
function calculateTrend(series) {
    const n = series.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += series[i];
        sumXY += i * series[i];
        sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
}

/**
 * Helper: Calculate seasonality
 */
function calculateSeasonality(series) {
    const n = series.length;
    if (n < 4) return 0;
    
    const mean = series.reduce((a, b) => a + b, 0) / n;
    const detrended = series.map(v => v - mean);
    
    // Calculate variance of detrended series
    const variance = detrended.reduce((sum, v) => sum + v ** 2, 0) / n;
    
    return variance;
}

/**
 * Helper: Calculate periodicity
 */
function calculatePeriodicity(series) {
    const n = series.length;
    if (n < 4) return 0;
    
    const autocorr = calculateAutocorrelation(series, Math.min(n / 2, 10));
    
    // Find peak in autocorrelation
    const peakIndex = autocorr.indexOf(Math.max(...autocorr));
    
    return peakIndex + 1;
}
