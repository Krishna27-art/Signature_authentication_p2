/**
 * rhythm_analysis.js — Micro-pause detection and stroke rhythm analysis
 * 
 * Implements:
 * - Micro-pause detection between strokes
 * - Stroke rhythm profiling
 * - Temporal pattern analysis
 * - Pen-lift behavior analysis
 * - Signing cadence extraction
 */

/**
 * Detect micro-pauses in signature trajectory
 * @param {Array} points - Raw trajectory points
 * @param {Array} strokes - Stroke segments
 * @returns {Object} Micro-pause analysis results
 */
export function detectMicroPauses(points, strokes = null) {
    if (!points || points.length < 2) {
        return {
            microPauses: [],
            totalPauseCount: 0,
            avgPauseDuration: 0,
            maxPauseDuration: 0,
            pausePattern: []
        };
    }
    
    const strokeSegments = strokes || segmentByGaps(points);
    const microPauses = [];
    const pausePattern = [];
    
    for (let i = 1; i < strokeSegments.length; i++) {
        const prevStrokeEnd = strokeSegments[i - 1][strokeSegments[i - 1].length - 1];
        const currStrokeStart = strokeSegments[i][0];
        
        const pauseDuration = currStrokeStart.t - prevStrokeEnd.t;
        
        // Classify pause type
        let pauseType = 'none';
        if (pauseDuration > 50 && pauseDuration <= 150) {
            pauseType = 'micro';
        } else if (pauseDuration > 150 && pauseDuration <= 500) {
            pauseType = 'short';
        } else if (pauseDuration > 500) {
            pauseType = 'long';
        }
        
        if (pauseType !== 'none') {
            microPauses.push({
                index: i - 1,
                duration: pauseDuration,
                type: pauseType
            });
            pausePattern.push(pauseType);
        }
    }
    
    const totalPauseCount = microPauses.length;
    const avgPauseDuration = totalPauseCount > 0 
        ? microPauses.reduce((sum, p) => sum + p.duration, 0) / totalPauseCount 
        : 0;
    const maxPauseDuration = totalPauseCount > 0 
        ? Math.max(...microPauses.map(p => p.duration)) 
        : 0;
    
    return {
        microPauses,
        totalPauseCount,
        avgPauseDuration,
        maxPauseDuration,
        pausePattern
    };
}

/**
 * Analyze stroke rhythm patterns
 * @param {Array} strokes - Stroke segments
 * @returns {Object} Rhythm analysis results
 */
export function analyzeStrokeRhythm(strokes) {
    if (!strokes || strokes.length < 2) {
        return {
            strokeDurations: [],
            avgStrokeDuration: 0,
            strokeDurationVariance: 0,
            rhythmRegularity: 0,
            strokeSpeedProfile: []
        };
    }
    
    const strokeDurations = strokes.map(s => {
        if (s.length < 2) return 0;
        return s[s.length - 1].t - s[0].t;
    });
    
    const avgStrokeDuration = strokeDurations.reduce((a, b) => a + b, 0) / strokeDurations.length;
    const strokeDurationVariance = calculateVariance(strokeDurations, avgStrokeDuration);
    
    // Calculate rhythm regularity (inverse of variance normalized by mean)
    const rhythmRegularity = avgStrokeDuration > 0 
        ? 1 / (1 + strokeDurationVariance / avgStrokeDuration) 
        : 0;
    
    // Speed profile for each stroke
    const strokeSpeedProfile = strokes.map(stroke => {
        if (stroke.length < 2) return { avgSpeed: 0, speedVariance: 0 };
        
        const speeds = [];
        for (let i = 1; i < stroke.length; i++) {
            const dx = stroke[i].x - stroke[i - 1].x;
            const dy = stroke[i].y - stroke[i - 1].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const dt = Math.max(stroke[i].t - stroke[i - 1].t, 1);
            speeds.push(dist / dt);
        }
        
        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        const speedVariance = calculateVariance(speeds, avgSpeed);
        
        return { avgSpeed, speedVariance };
    });
    
    return {
        strokeDurations,
        avgStrokeDuration,
        strokeDurationVariance,
        rhythmRegularity,
        strokeSpeedProfile
    };
}

/**
 * Analyze pen-lift behavior
 * @param {Array} strokes - Stroke segments
 * @returns {Object} Pen-lift analysis results
 */
export function analyzePenLiftBehavior(strokes) {
    if (!strokes || strokes.length < 2) {
        return {
            liftCount: 0,
            avgLiftDuration: 0,
            liftPattern: [],
            liftPositionDistribution: []
        };
    }
    
    const liftDurations = [];
    const liftPattern = [];
    const liftPositionDistribution = [];
    
    for (let i = 1; i < strokes.length; i++) {
        const prevStrokeEnd = strokes[i - 1][strokes[i - 1].length - 1];
        const currStrokeStart = strokes[i][0];
        
        const liftDuration = currStrokeStart.t - prevStrokeEnd.t;
        
        if (liftDuration > 30) { // Minimum lift threshold
            liftDurations.push(liftDuration);
            
            // Classify lift pattern
            if (liftDuration < 100) liftPattern.push('quick');
            else if (liftDuration < 300) liftPattern.push('normal');
            else liftPattern.push('deliberate');
            
            // Track lift position (normalized along signature)
            const totalPoints = strokes.reduce((sum, s) => sum + s.length, 0);
            const pointsBefore = strokes.slice(0, i).reduce((sum, s) => sum + s.length, 0);
            liftPositionDistribution.push(pointsBefore / totalPoints);
        }
    }
    
    const liftCount = liftDurations.length;
    const avgLiftDuration = liftCount > 0 
        ? liftDurations.reduce((a, b) => a + b, 0) / liftCount 
        : 0;
    
    return {
        liftCount,
        avgLiftDuration,
        liftPattern,
        liftPositionDistribution
    };
}

/**
 * Extract signing cadence profile
 * @param {Array} points - Raw trajectory points
 * @param {Array} strokes - Stroke segments
 * @returns {Object} Cadence profile
 */
export function extractSigningCadence(points, strokes = null) {
    if (!points || points.length < 2) {
        return {
            overallCadence: 0,
            cadenceVariance: 0,
            accelerationProfile: [],
            decelerationPoints: []
        };
    }
    
    const strokeSegments = strokes || segmentByGaps(points);
    
    // Calculate overall cadence (strokes per second)
    const totalDuration = points[points.length - 1].t - points[0].t;
    const overallCadence = totalDuration > 0 ? strokeSegments.length / (totalDuration / 1000) : 0;
    
    // Calculate cadence variance across strokes
    const strokeCadences = strokeSegments.map(stroke => {
        if (stroke.length < 2) return 0;
        const duration = stroke[stroke.length - 1].t - stroke[0].t;
        return duration > 0 ? stroke.length / (duration / 1000) : 0;
    });
    
    const avgCadence = strokeCadences.reduce((a, b) => a + b, 0) / strokeCadences.length;
    const cadenceVariance = calculateVariance(strokeCadences, avgCadence);
    
    // Acceleration profile
    const accelerationProfile = [];
    const decelerationPoints = [];
    
    for (let i = 2; i < points.length; i++) {
        const v1 = calculateVelocity(points[i - 2], points[i - 1]);
        const v2 = calculateVelocity(points[i - 1], points[i]);
        const acceleration = (v2 - v1) / Math.max(points[i].t - points[i - 1].t, 1);
        
        accelerationProfile.push(acceleration);
        
        if (acceleration < -0.5) {
            decelerationPoints.push({
                index: i,
                position: { x: points[i].x, y: points[i].y },
                magnitude: acceleration
            });
        }
    }
    
    return {
        overallCadence,
        cadenceVariance,
        accelerationProfile,
        decelerationPoints
    };
}

/**
 * Comprehensive rhythm analysis
 * @param {Array} points - Raw trajectory points
 * @param {Array} strokes - Stroke segments
 * @returns {Object} Complete rhythm analysis
 */
export function comprehensiveRhythmAnalysis(points, strokes = null) {
    const strokeSegments = strokes || segmentByGaps(points);
    
    const microPauses = detectMicroPauses(points, strokeSegments);
    const strokeRhythm = analyzeStrokeRhythm(strokeSegments);
    const penLiftBehavior = analyzePenLiftBehavior(strokeSegments);
    const signingCadence = extractSigningCadence(points, strokeSegments);
    
    return {
        ...microPauses,
        ...strokeRhythm,
        ...penLiftBehavior,
        ...signingCadence
    };
}

/**
 * Helper: Segment by temporal gaps
 */
function segmentByGaps(points) {
    const segments = [];
    let currentSegment = [points[0]];
    
    for (let i = 1; i < points.length; i++) {
        const gap = points[i].t - points[i - 1].t;
        
        if (gap > 100) { // 100ms gap threshold
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
 * Helper: Calculate velocity between two points
 */
function calculateVelocity(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dt = Math.max(p2.t - p1.t, 1);
    return dist / dt;
}

/**
 * Helper: Calculate variance
 */
function calculateVariance(values, mean) {
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}
