/* =========================================================
   explainable_verification.js — Explainable Verification System
   Provides detailed feedback on why verification failed:
   - Speed mismatch
   - Shape mismatch
   - Rhythm mismatch
   - Pressure inconsistency
   ========================================================= */

/**
 * Analyze signature speed characteristics
 */
export function analyzeSpeed(signature) {
    if (!signature || signature.length < 2) return null;
    
    const velocities = [];
    const accelerations = [];
    
    for (let i = 1; i < signature.length; i++) {
        const prev = signature[i - 1];
        const curr = signature[i];
        
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const dt = Math.max(curr.t - prev.t, 1);
        
        const velocity = Math.sqrt(dx * dx + dy * dy) / dt;
        velocities.push(velocity);
        
        if (i > 1) {
            const prevVel = velocities[velocities.length - 2];
            const acceleration = (velocity - prevVel) / dt;
            accelerations.push(acceleration);
        }
    }
    
    return {
        avgVelocity: velocities.reduce((a, b) => a + b, 0) / velocities.length,
        maxVelocity: Math.max(...velocities),
        minVelocity: Math.min(...velocities),
        velocityStd: calculateStd(velocities),
        avgAcceleration: accelerations.length > 0 ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length : 0,
        maxAcceleration: accelerations.length > 0 ? Math.max(...accelerations) : 0,
        minAcceleration: accelerations.length > 0 ? Math.min(...accelerations) : 0
    };
}

/**
 * Analyze signature shape characteristics
 */
export function analyzeShape(signature) {
    if (!signature || signature.length < 2) return null;
    
    // Calculate bounding box
    const xs = signature.map(p => p.x);
    const ys = signature.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    const width = maxX - minX;
    const height = maxY - minY;
    const aspectRatio = width / (height || 1);
    
    // Calculate path length
    let pathLength = 0;
    for (let i = 1; i < signature.length; i++) {
        const dx = signature[i].x - signature[i - 1].x;
        const dy = signature[i].y - signature[i - 1].y;
        pathLength += Math.sqrt(dx * dx + dy * dy);
    }
    
    // Calculate curvature
    const curvatures = [];
    for (let i = 2; i < signature.length; i++) {
        const p1 = signature[i - 2];
        const p2 = signature[i - 1];
        const p3 = signature[i];
        
        const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
        
        let angleDiff = angle2 - angle1;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        curvatures.push(Math.abs(angleDiff));
    }
    
    // Calculate stroke count (detect pen lifts)
    let strokeCount = 1;
    for (let i = 1; i < signature.length; i++) {
        if (signature[i]._strokeGap !== undefined && signature[i]._strokeGap > 100) {
            strokeCount++;
        }
    }
    
    return {
        width,
        height,
        aspectRatio,
        pathLength,
        avgCurvature: curvatures.length > 0 ? curvatures.reduce((a, b) => a + b, 0) / curvatures.length : 0,
        maxCurvature: curvatures.length > 0 ? Math.max(...curvatures) : 0,
        strokeCount
    };
}

/**
 * Analyze signature rhythm characteristics
 */
export function analyzeRhythm(signature) {
    if (!signature || signature.length < 2) return null;
    
    const timeIntervals = [];
    for (let i = 1; i < signature.length; i++) {
        const dt = signature[i].t - signature[i - 1].t;
        timeIntervals.push(dt);
    }
    
    // Calculate rhythm regularity (coefficient of variation)
    const avgInterval = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
    const intervalStd = calculateStd(timeIntervals);
    const rhythmRegularity = intervalStd / (avgInterval || 1);
    
    // Detect pauses
    const pauses = timeIntervals.filter(dt => dt > avgInterval * 3).length;
    
    // Calculate total duration
    const totalDuration = signature[signature.length - 1].t - signature[0].t;
    
    return {
        avgInterval,
        intervalStd,
        rhythmRegularity,
        pauseCount: pauses,
        totalDuration,
        pointsPerSecond: signature.length / (totalDuration / 1000)
    };
}

/**
 * Analyze signature pressure characteristics
 */
export function analyzePressure(signature) {
    if (!signature || signature.length === 0) return null;
    
    const pressures = signature.map(p => p.p || 0.5);
    
    // Calculate pressure statistics
    const avgPressure = pressures.reduce((a, b) => a + b, 0) / pressures.length;
    const maxPressure = Math.max(...pressures);
    const minPressure = Math.min(...pressures);
    const pressureStd = calculateStd(pressures);
    
    // Detect pressure variations
    const pressureVariations = [];
    for (let i = 1; i < pressures.length; i++) {
        pressureVariations.push(Math.abs(pressures[i] - pressures[i - 1]));
    }
    
    const avgPressureVariation = pressureVariations.reduce((a, b) => a + b, 0) / pressureVariations.length;
    
    return {
        avgPressure,
        maxPressure,
        minPressure,
        pressureStd,
        avgPressureVariation,
        pressureRange: maxPressure - minPressure
    };
}

/**
 * Compare two signatures and generate mismatch feedback
 */
export function generateMismatchFeedback(genuineSignature, testSignature) {
    const feedback = {
        overallMatch: 0,
        mismatches: [],
        details: {}
    };
    
    // Analyze both signatures
    const genuineSpeed = analyzeSpeed(genuineSignature);
    const testSpeed = analyzeSpeed(testSignature);
    
    const genuineShape = analyzeShape(genuineSignature);
    const testShape = analyzeShape(testSignature);
    
    const genuineRhythm = analyzeRhythm(genuineSignature);
    const testRhythm = analyzeRhythm(testSignature);
    
    const genuinePressure = analyzePressure(genuineSignature);
    const testPressure = analyzePressure(testSignature);
    
    // Compare speed
    if (genuineSpeed && testSpeed) {
        const speedDiff = Math.abs(genuineSpeed.avgVelocity - testSpeed.avgVelocity);
        const speedThreshold = genuineSpeed.avgVelocity * 0.4; // 40% tolerance
        
        if (speedDiff > speedThreshold) {
            const severity = speedDiff > speedThreshold * 2 ? 'high' : 'moderate';
            feedback.mismatches.push({
                type: 'speed',
                severity,
                message: `Speed mismatch: Your signing speed is ${severity === 'high' ? 'much' : 'somewhat'} ${testSpeed.avgVelocity > genuineSpeed.avgVelocity ? 'faster' : 'slower'} than usual`,
                genuine: genuineSpeed.avgVelocity.toFixed(3),
                test: testSpeed.avgVelocity.toFixed(3),
                difference: speedDiff.toFixed(3)
            });
        }
        
        feedback.details.speed = {
            match: 1 - Math.min(speedDiff / speedThreshold, 1),
            genuine: genuineSpeed,
            test: testSpeed
        };
    }
    
    // Compare shape
    if (genuineShape && testShape) {
        const aspectRatioDiff = Math.abs(genuineShape.aspectRatio - testShape.aspectRatio);
        const pathLengthDiff = Math.abs(genuineShape.pathLength - testShape.pathLength) / genuineShape.pathLength;
        const strokeCountDiff = Math.abs(genuineShape.strokeCount - testShape.strokeCount);
        
        if (aspectRatioDiff > 0.3 || pathLengthDiff > 0.3 || strokeCountDiff > 0) {
            const issues = [];
            if (aspectRatioDiff > 0.3) issues.push('aspect ratio');
            if (pathLengthDiff > 0.3) issues.push('size');
            if (strokeCountDiff > 0) issues.push('number of strokes');
            
            feedback.mismatches.push({
                type: 'shape',
                severity: pathLengthDiff > 0.5 ? 'high' : 'moderate',
                message: `Shape mismatch: ${issues.join(', ')} differs from your usual signature`,
                issues
            });
        }
        
        feedback.details.shape = {
            match: 1 - Math.max(aspectRatioDiff, pathLengthDiff, strokeCountDiff > 0 ? 0.5 : 0),
            genuine: genuineShape,
            test: testShape
        };
    }
    
    // Compare rhythm
    if (genuineRhythm && testRhythm) {
        const rhythmDiff = Math.abs(genuineRhythm.rhythmRegularity - testRhythm.rhythmRegularity);
        const durationDiff = Math.abs(genuineRhythm.totalDuration - testRhythm.totalDuration) / genuineRhythm.totalDuration;
        
        if (rhythmDiff > 0.3 || durationDiff > 0.3) {
            const issues = [];
            if (rhythmDiff > 0.3) issues.push('timing pattern');
            if (durationDiff > 0.3) issues.push('overall duration');
            
            feedback.mismatches.push({
                type: 'rhythm',
                severity: durationDiff > 0.5 ? 'high' : 'moderate',
                message: `Rhythm mismatch: ${issues.join(', ')} differs from your usual pattern`,
                issues
            });
        }
        
        feedback.details.rhythm = {
            match: 1 - Math.max(rhythmDiff, durationDiff),
            genuine: genuineRhythm,
            test: testRhythm
        };
    }
    
    // Compare pressure
    if (genuinePressure && testPressure) {
        const pressureDiff = Math.abs(genuinePressure.avgPressure - testPressure.avgPressure);
        const pressureThreshold = 0.2;
        
        if (pressureDiff > pressureThreshold) {
            feedback.mismatches.push({
                type: 'pressure',
                severity: pressureDiff > 0.4 ? 'high' : 'moderate',
                message: `Pressure inconsistency: Your pen pressure is ${testPressure.avgPressure > genuinePressure.avgPressure ? 'heavier' : 'lighter'} than usual`,
                genuine: genuinePressure.avgPressure.toFixed(3),
                test: testPressure.avgPressure.toFixed(3),
                difference: pressureDiff.toFixed(3)
            });
        }
        
        feedback.details.pressure = {
            match: 1 - Math.min(pressureDiff / pressureThreshold, 1),
            genuine: genuinePressure,
            test: testPressure
        };
    }
    
    // Calculate overall match score
    const matches = Object.values(feedback.details).map(d => d.match);
    feedback.overallMatch = matches.length > 0 ? matches.reduce((a, b) => a + b, 0) / matches.length : 0;
    
    return feedback;
}

/**
 * Generate user-friendly explanation
 */
export function generateUserExplanation(feedback) {
    if (feedback.mismatches.length === 0) {
        return {
            title: 'Signature matched well',
            message: 'Your signature characteristics are consistent with your enrolled template.',
            tips: []
        };
    }
    
    const tips = [];
    const issues = feedback.mismatches.map(m => m.type);
    
    if (issues.includes('speed')) {
        tips.push('Try to sign at your natural pace - not too fast or too slow');
    }
    if (issues.includes('shape')) {
        tips.push('Focus on maintaining the same size and proportions as your usual signature');
    }
    if (issues.includes('rhythm')) {
        tips.push('Pay attention to the timing and flow of your signature');
    }
    if (issues.includes('pressure')) {
        tips.push('Apply consistent pressure throughout your signature');
    }
    
    const highSeverity = feedback.mismatches.some(m => m.severity === 'high');
    
    return {
        title: highSeverity ? 'Significant differences detected' : 'Minor differences detected',
        message: feedback.mismatches.map(m => m.message).join('. '),
        tips,
        severity: highSeverity ? 'high' : 'moderate'
    };
}

/**
 * Calculate standard deviation
 */
function calculateStd(values) {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    
    return Math.sqrt(variance);
}

/**
 * Get verification explanation with confidence scores
 */
export function getVerificationExplanation(genuineSignature, testSignature, dtwScore, threshold) {
    const feedback = generateMismatchFeedback(genuineSignature, testSignature);
    const explanation = generateUserExplanation(feedback);
    
    const isMatch = dtwScore >= threshold;
    
    return {
        isMatch,
        confidence: dtwScore,
        threshold,
        overallMatch: feedback.overallMatch,
        explanation,
        detailedFeedback: feedback,
        recommendations: generateRecommendations(feedback)
    };
}

/**
 * Generate actionable recommendations
 */
export function generateRecommendations(feedback) {
    const recommendations = [];
    
    feedback.mismatches.forEach(mismatch => {
        switch (mismatch.type) {
            case 'speed':
                if (mismatch.severity === 'high') {
                    recommendations.push({
                        priority: 'high',
                        action: 'Slow down and sign at a comfortable pace',
                        reason: 'Speed is significantly different from your enrolled signature'
                    });
                } else {
                    recommendations.push({
                        priority: 'medium',
                        action: 'Try to maintain a consistent signing speed',
                        reason: 'Minor speed variation detected'
                    });
                }
                break;
                
            case 'shape':
                if (mismatch.severity === 'high') {
                    recommendations.push({
                        priority: 'high',
                        action: 'Pay close attention to the size and proportions of your signature',
                        reason: 'Shape characteristics differ significantly'
                    });
                } else {
                    recommendations.push({
                        priority: 'medium',
                        action: 'Ensure your signature maintains its usual shape',
                        reason: 'Minor shape variation detected'
                    });
                }
                break;
                
            case 'rhythm':
                recommendations.push({
                    priority: 'medium',
                    action: 'Focus on the natural flow and timing of your signature',
                    reason: 'Rhythm pattern differs from usual'
                });
                break;
                
            case 'pressure':
                recommendations.push({
                    priority: 'low',
                    action: 'Apply consistent pressure while signing',
                    reason: 'Pressure variation detected'
                });
                break;
        }
    });
    
    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    return recommendations;
}
