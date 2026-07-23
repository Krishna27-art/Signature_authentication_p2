/**
 * liveness_detection.js — Basic liveness detection and replay attack prevention
 * 
 * Implements:
 * - Liveness detection based on temporal dynamics
 * - Replay attack prevention with timestamp validation
 * - Device consistency checks
 * - Behavioral anomaly detection
 * - Session consistency analysis
 */

// Store recent verification attempts for replay detection
const verificationHistory = new Map();
const MAX_HISTORY_SIZE = 100;
const REPLAY_WINDOW_MS = 5000; // 5 seconds

/**
 * Detect liveness from signature dynamics
 * @param {Array} points - Raw trajectory points
 * @param {Object} state - User state with historical data
 * @returns {Object} Liveness analysis results
 */
export function detectLiveness(points, state = null) {
    if (!points || points.length < 10) {
        return {
            isLive: false,
            confidence: 0,
            reasons: ['Insufficient data points']
        };
    }
    
    const reasons = [];
    let livenessScore = 1.0;
    
    // Check 1: Natural velocity variation
    const velocityVariation = checkVelocityVariation(points);
    if (velocityVariation < 0.15) {
        livenessScore *= 0.85;
        reasons.push('Low velocity variation (possible static image)');
    }
    
    // Check 2: Natural pressure variation
    const pressureVariation = checkPressureVariation(points);
    if (pressureVariation < 0.10) {
        livenessScore *= 0.85;
        reasons.push('Low pressure variation');
    }
    
    // Check 3: Natural timing variation
    const timingVariation = checkTimingVariation(points);
    if (timingVariation < 0.10) {
        livenessScore *= 0.85;
        reasons.push('Unnatural timing pattern');
    }
    
    // Check 4: Direction changes
    const directionChanges = countDirectionChanges(points);
    if (directionChanges < 1) {
        livenessScore *= 0.80;
        reasons.push('Too few direction changes');
    }
    
    // Check 5: Stroke count consistency with historical data
    if (state && state.enrolledStrokeCount) {
        const strokeConsistency = checkStrokeConsistency(points, state.enrolledStrokeCount);
        if (strokeConsistency < 0.3) {
            livenessScore *= 0.80;
            reasons.push('Stroke count mismatch with enrollment');
        }
    }
    
    const isLive = livenessScore >= 0.35;
    const confidence = livenessScore;
    
    return {
        isLive,
        confidence,
        livenessScore,
        reasons: reasons.length > 0 ? reasons : ['Natural signature dynamics detected']
    };
}

/**
 * Prevent replay attacks
 * @param {Array} points - Raw trajectory points
 * @param {string} sessionId - Current session ID
 * @returns {Object} Replay attack analysis
 */
export function preventReplayAttack(points, sessionId = null) {
    if (!points || points.length < 2) {
        return {
            isReplay: false,
            confidence: 0,
            message: 'Insufficient data'
        };
    }
    
    const timestamp = Date.now();
    const signatureHash = computeSignatureHash(points);
    
    // Check for recent identical signatures
    const recentAttempts = verificationHistory.get(sessionId || 'default') || [];
    
    for (const attempt of recentAttempts) {
        const timeDiff = timestamp - attempt.timestamp;
        
        // Check if signature is an exact/near-exact programmatic replay within window
        if (timeDiff < REPLAY_WINDOW_MS) {
            const similarity = compareSignatures(signatureHash, attempt.hash);
            if (similarity >= 0.995) {
                return {
                    isReplay: true,
                    confidence: similarity,
                    message: 'Possible replay attack detected',
                    timeSinceOriginal: timeDiff
                };
            }
        }
    }
    
    // Store this attempt
    recentAttempts.push({ timestamp, hash: signatureHash });
    if (recentAttempts.length > MAX_HISTORY_SIZE) {
        recentAttempts.shift();
    }
    verificationHistory.set(sessionId || 'default', recentAttempts);
    
    return {
        isReplay: false,
        confidence: 1.0,
        message: 'No replay attack detected'
    };
}

/**
 * Check device consistency
 * @param {Object} currentState - Current device state
 * @param {Object} enrolledState - Enrolled device state
 * @returns {Promise<Object>} Device consistency analysis
 */
export async function checkDeviceConsistency(currentState, enrolledState) {
    if (!enrolledState || !enrolledState.device) {
        return {
            isConsistent: true,
            confidence: 1.0,
            message: 'No enrolled device to compare'
        };
    }
    
    const currentDevice = currentState.device || await getDeviceHash();
    const enrolledDevice = enrolledState.device;
    
    // Allow device change with warning (for legitimate device upgrades)
    if (currentDevice !== enrolledDevice) {
        return {
            isConsistent: false,
            confidence: 0.3,
            message: 'Device changed since enrollment',
            requiresReEnrollment: true
        };
    }
    
    return {
        isConsistent: true,
        confidence: 1.0,
        message: 'Device consistent with enrollment'
    };
}

/**
 * Detect behavioral anomalies
 * @param {Array} points - Raw trajectory points
 * @param {Object} state - User state with historical data
 * @returns {Object} Anomaly detection results
 */
export function detectBehavioralAnomaly(points, state = null) {
    if (!points || points.length < 10) {
        return {
            hasAnomaly: false,
            anomalyScore: 0,
            anomalies: []
        };
    }
    
    const anomalies = [];
    let anomalyScore = 0;
    
    // Check 1: Unusual speed
    const avgSpeed = calculateAverageSpeed(points);
    if (state && state.behavioralStats) {
        const expectedSpeed = state.behavioralStats.mean[1] || 1.0;
        const speedRatio = avgSpeed / expectedSpeed;
        
        if (speedRatio > 3.0) {
            anomalyScore += 0.3;
            anomalies.push('Unusually fast signature');
        } else if (speedRatio < 0.3) {
            anomalyScore += 0.3;
            anomalies.push('Unusually slow signature');
        }
    }
    
    // Check 2: Unusual duration
    const duration = points[points.length - 1].t - points[0].t;
    if (duration < 500) {
        anomalyScore += 0.2;
        anomalies.push('Signature too quick (possible bot)');
    } else if (duration > 10000) {
        anomalyScore += 0.2;
        anomalies.push('Signature too slow (possible tracing)');
    }
    
    // Check 3: Unusual pressure pattern
    const pressurePattern = analyzePressurePattern(points);
    if (pressurePattern.isUnusual) {
        anomalyScore += 0.2;
        anomalies.push('Unusual pressure pattern');
    }
    
    // Check 4: Check against historical behavior
    if (state && state.behaviorFeatureHistory && state.behaviorFeatureHistory.length > 5) {
        // A01 fix: extractBasicFeatures returns Array<Array<number>> (2D).
        // cosineSimilarity expects flat 1D arrays. Flatten before comparison.
        const currentFeatures = extractBasicFeatures(points).flat();
        const historicalFeatures = state.behaviorFeatureHistory;

        const maxSimilarity = Math.max(
            ...historicalFeatures.map(hist =>
                cosineSimilarity(currentFeatures, Array.isArray(hist[0]) ? hist.flat() : hist)
            )
        );
        
        if (maxSimilarity < 0.5) {
            anomalyScore += 0.3;
            anomalies.push('Behavior differs significantly from history');
        }
    }
    
    return {
        hasAnomaly: anomalyScore > 0.5,
        anomalyScore,
        anomalies
    };
}

/**
 * Analyze session consistency
 * @param {Array} recentAttempts - Recent verification attempts
 * @returns {Object} Session consistency analysis
 */
export function analyzeSessionConsistency(recentAttempts) {
    if (!recentAttempts || recentAttempts.length < 3) {
        return {
            isConsistent: true,
            confidence: 1.0,
            message: 'Insufficient session data'
        };
    }
    
    const scores = recentAttempts.map(a => a.score || 0);
    const timestamps = recentAttempts.map(a => a.timestamp || 0);
    
    // Check score consistency
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const scoreVariance = calculateVariance(scores, avgScore);
    const scoreConsistency = 1 / (1 + scoreVariance);
    
    // Check timing pattern (prevent rapid-fire attacks)
    const timeIntervals = [];
    for (let i = 1; i < timestamps.length; i++) {
        timeIntervals.push(timestamps[i] - timestamps[i - 1]);
    }
    
    const avgInterval = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
    const rapidFireCount = timeIntervals.filter(t => t < 1000).length; // Less than 1 second
    
    if (rapidFireCount > 3) {
        return {
            isConsistent: false,
            confidence: 0.2,
            message: 'Rapid-fire attempts detected (possible attack)',
            scoreConsistency,
            avgInterval
        };
    }
    
    return {
        isConsistent: scoreConsistency > 0.5,
        confidence: scoreConsistency,
        message: scoreConsistency > 0.5 ? 'Session consistent' : 'Session inconsistent',
        scoreConsistency,
        avgInterval
    };
}

/**
 * Helper: Check velocity variation
 */
function checkVelocityVariation(points) {
    const velocities = [];
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const dt = Math.max(points[i].t - points[i - 1].t, 1);
        velocities.push(Math.sqrt(dx * dx + dy * dy) / dt);
    }
    
    if (velocities.length === 0) return 0;
    
    const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const variance = velocities.reduce((sum, v) => sum + (v - mean) ** 2, 0) / velocities.length;
    const std = Math.sqrt(variance);
    
    return mean > 0 ? std / mean : 0;
}

/**
 * Helper: Check pressure variation
 */
function checkPressureVariation(points) {
    const pressures = points.map(p => p.p || 0.5);
    
    const mean = pressures.reduce((a, b) => a + b, 0) / pressures.length;
    const variance = pressures.reduce((sum, p) => sum + (p - mean) ** 2, 0) / pressures.length;
    const std = Math.sqrt(variance);
    
    return mean > 0 ? std / mean : 0;
}

/**
 * Helper: Check timing variation
 */
function checkTimingVariation(points) {
    const intervals = [];
    for (let i = 1; i < points.length; i++) {
        intervals.push(points[i].t - points[i - 1].t);
    }
    
    if (intervals.length === 0) return 0;
    
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, t) => sum + (t - mean) ** 2, 0) / intervals.length;
    const std = Math.sqrt(variance);
    
    return mean > 0 ? std / mean : 0;
}

/**
 * Helper: Count direction changes
 */
function countDirectionChanges(points) {
    let count = 0;
    let prevDir = null;
    
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const dir = Math.atan2(dy, dx);
        
        if (prevDir !== null) {
            const delta = Math.abs(dir - prevDir);
            if (delta > Math.PI / 4) count++; // 45 degree threshold
        }
        
        prevDir = dir;
    }
    
    return count;
}

/**
 * Helper: Check stroke consistency
 */
function checkStrokeConsistency(points, enrolledStrokeCount) {
    // Estimate stroke count from pen lifts (temporal gaps)
    let strokeCount = 1;
    for (let i = 1; i < points.length; i++) {
        if (points[i].t - points[i - 1].t > 150) {
            strokeCount++;
        }
    }
    
    const diff = Math.abs(strokeCount - enrolledStrokeCount);
    return 1 / (1 + diff);
}

/**
 * Helper: Compute signature hash
 */
function computeSignatureHash(points) {
    const simplified = points.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join('|');
    let hash = 0;
    for (let i = 0; i < simplified.length; i++) {
        const char = simplified.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

/**
 * Helper: Compare signatures
 */
function compareSignatures(hash1, hash2) {
    if (hash1 === hash2) return 1.0;
    
    // Simple similarity based on hash length and character overlap
    const len1 = hash1.length;
    const len2 = hash2.length;
    const maxLen = Math.max(len1, len2);
    
    let matches = 0;
    for (let i = 0; i < Math.min(len1, len2); i++) {
        if (hash1[i] === hash2[i]) matches++;
    }
    
    return matches / maxLen;
}

/**
 * Helper: Get device hash
 */
async function getDeviceHash() {
    const hasTouch = typeof window !== 'undefined' && 'ontouchstart' in window;
    const depth = typeof screen !== 'undefined' ? screen.colorDepth : 24;
    const hc = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 2) : 2;
    const combined = `${hc}|${hasTouch}|${depth}`;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(combined));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Helper: Calculate average speed
 */
function calculateAverageSpeed(points) {
    let totalSpeed = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const dt = Math.max(points[i].t - points[i - 1].t, 1);
        totalSpeed += Math.sqrt(dx * dx + dy * dy) / dt;
    }
    return totalSpeed / (points.length - 1);
}

/**
 * Helper: Analyze pressure pattern
 */
function analyzePressurePattern(points) {
    const pressures = points.map(p => p.p || 0.5);
    
    // Check for constant pressure (unusual for human signing)
    const variance = calculateVariance(pressures, pressures.reduce((a, b) => a + b, 0) / pressures.length);
    
    return {
        isUnusual: variance < 0.01,
        variance
    };
}

/**
 * Helper: Extract basic features
 */
function extractBasicFeatures(points) {
    const features = [];
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const dt = Math.max(points[i].t - points[i - 1].t, 1);
        features.push([
            Math.sqrt(dx * dx + dy * dy) / dt, // speed
            Math.atan2(dy, dx), // direction
            points[i].p || 0.5 // pressure
        ]);
    }
    return features;
}

/**
 * Helper: Cosine similarity
 */
function cosineSimilarity(a, b) {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return normA * normB > 0 ? dot / (normA * normB) : 0;
}

/**
 * Helper: Calculate variance
 */
function calculateVariance(values, mean) {
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}
