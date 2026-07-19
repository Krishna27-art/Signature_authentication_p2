/**
 * evaluation_metrics.js — FAR/FRR/EER calculation and ROC curve generation
 * 
 * Implements:
 * - False Acceptance Rate (FAR) calculation
 * - False Rejection Rate (FRR) calculation
 * - Equal Error Rate (EER) calculation
 * - ROC curve generation
 * - DET curve generation
 * - Threshold optimization
 */

/**
 * Calculate FAR, FRR, and EER from verification results
 * @param {Array} genuineScores - Scores from genuine attempts
 * @param {Array} impostorScores - Scores from impostor attempts
 * @param {number} threshold - Decision threshold
 * @returns {Object} Performance metrics
 */
export function calculatePerformanceMetrics(genuineScores, impostorScores, threshold = 0.5) {
    if (!genuineScores || !impostorScores || genuineScores.length === 0 || impostorScores.length === 0) {
        return {
            far: 0,
            frr: 0,
            eer: 0,
            threshold,
            error: 'Insufficient data'
        };
    }
    
    // Calculate FAR: proportion of impostor scores above threshold
    const falseAccepts = impostorScores.filter(s => s >= threshold).length;
    const far = falseAccepts / impostorScores.length;
    
    // Calculate FRR: proportion of genuine scores below threshold
    const falseRejects = genuineScores.filter(s => s < threshold).length;
    const frr = falseRejects / genuineScores.length;
    
    // Calculate EER: threshold where FAR = FRR
    const eer = calculateEER(genuineScores, impostorScores);
    
    return {
        far,
        frr,
        eer,
        threshold,
        genuineCount: genuineScores.length,
        impostorCount: impostorScores.length,
        falseAccepts,
        falseRejects,
        genuineAccepts: genuineScores.length - falseRejects,
        impostorRejects: impostorScores.length - falseAccepts
    };
}

/**
 * Calculate Equal Error Rate (EER)
 * @param {Array} genuineScores - Scores from genuine attempts
 * @param {Array} impostorScores - Scores from impostor attempts
 * @returns {number} EER value
 */
export function calculateEER(genuineScores, impostorScores) {
    if (!genuineScores || !impostorScores || genuineScores.length === 0 || impostorScores.length === 0) {
        return 0;
    }
    
    // Generate ROC curve points
    const rocPoints = generateROCPoints(genuineScores, impostorScores);
    
    // Find point closest to diagonal (FAR = FRR)
    let minDistance = Infinity;
    let eer = 0;
    
    for (const point of rocPoints) {
        const distance = Math.abs(point.far - point.frr);
        if (distance < minDistance) {
            minDistance = distance;
            eer = (point.far + point.frr) / 2;
        }
    }
    
    return eer;
}

/**
 * Generate ROC curve points
 * @param {Array} genuineScores - Scores from genuine attempts
 * @param {Array} impostorScores - Scores from impostor attempts
 * @param {number} numPoints - Number of points to generate
 * @returns {Array} ROC curve points
 */
export function generateROCPoints(genuineScores, impostorScores, numPoints = 100) {
    if (!genuineScores || !impostorScores || genuineScores.length === 0 || impostorScores.length === 0) {
        return [];
    }
    
    const allScores = [...genuineScores, ...impostorScores];
    const minScore = Math.min(...allScores);
    const maxScore = Math.max(...allScores);
    
    const rocPoints = [];
    
    for (let i = 0; i <= numPoints; i++) {
        const threshold = minScore + (maxScore - minScore) * (i / numPoints);
        
        const far = impostorScores.filter(s => s >= threshold).length / impostorScores.length;
        const frr = genuineScores.filter(s => s < threshold).length / genuineScores.length;
        const tpr = 1 - frr; // True Positive Rate
        const fpr = far; // False Positive Rate
        
        rocPoints.push({
            threshold,
            far,
            frr,
            tpr,
            fpr
        });
    }
    
    return rocPoints;
}

/**
 * Calculate Area Under ROC Curve (AUC)
 * @param {Array} rocPoints - ROC curve points
 * @returns {number} AUC value
 */
export function calculateAUC(rocPoints) {
    if (!rocPoints || rocPoints.length < 2) return 0.5;
    
    let auc = 0;
    
    for (let i = 1; i < rocPoints.length; i++) {
        const x1 = rocPoints[i - 1].fpr;
        const y1 = rocPoints[i - 1].tpr;
        const x2 = rocPoints[i].fpr;
        const y2 = rocPoints[i].tpr;
        
        // Trapezoidal rule
        auc += (x2 - x1) * (y1 + y2) / 2;
    }
    
    return auc;
}

/**
 * Generate DET (Detection Error Tradeoff) curve points
 * @param {Array} genuineScores - Scores from genuine attempts
 * @param {Array} impostorScores - Scores from impostor attempts
 * @param {number} numPoints - Number of points to generate
 * @returns {Array} DET curve points
 */
export function generateDETPoints(genuineScores, impostorScores, numPoints = 100) {
    if (!genuineScores || !impostorScores || genuineScores.length === 0 || impostorScores.length === 0) {
        return [];
    }
    
    const allScores = [...genuineScores, ...impostorScores];
    const minScore = Math.min(...allScores);
    const maxScore = Math.max(...allScores);
    
    const detPoints = [];
    
    for (let i = 0; i <= numPoints; i++) {
        const threshold = minScore + (maxScore - minScore) * (i / numPoints);
        
        const far = impostorScores.filter(s => s >= threshold).length / impostorScores.length;
        const frr = genuineScores.filter(s => s < threshold).length / genuineScores.length;
        
        // Convert to normal deviate scale for DET plot
        const farNorm = far > 0 && far < 1 ? inverseNormalCDF(far) : far === 0 ? -7 : 7;
        const frrNorm = frr > 0 && frr < 1 ? inverseNormalCDF(frr) : frr === 0 ? -7 : 7;
        
        detPoints.push({
            threshold,
            far,
            frr,
            farNorm,
            frrNorm
        });
    }
    
    return detPoints;
}

/**
 * Optimize threshold based on cost function
 * @param {Array} genuineScores - Scores from genuine attempts
 * @param {Array} impostorScores - Scores from impostor attempts
 * @param {number} costFalseAccept - Cost of false acceptance
 * @param {number} costFalseReject - Cost of false rejection
 * @param {number} priorGenuine - Prior probability of genuine attempt
 * @returns {Object} Optimal threshold and metrics
 */
export function optimizeThreshold(genuineScores, impostorScores, costFalseAccept = 1, costFalseReject = 1, priorGenuine = 0.5) {
    if (!genuineScores || !impostorScores || genuineScores.length === 0 || impostorScores.length === 0) {
        return {
            optimalThreshold: 0.5,
            minCost: Infinity,
            error: 'Insufficient data'
        };
    }
    
    const allScores = [...genuineScores, ...impostorScores];
    const minScore = Math.min(...allScores);
    const maxScore = Math.max(...allScores);
    
    let minCost = Infinity;
    let optimalThreshold = 0.5;
    let optimalMetrics = null;
    
    // Search for optimal threshold
    for (let i = 0; i <= 100; i++) {
        const threshold = minScore + (maxScore - minScore) * (i / 100);
        
        const far = impostorScores.filter(s => s >= threshold).length / impostorScores.length;
        const frr = genuineScores.filter(s => s < threshold).length / genuineScores.length;
        
        // Calculate expected cost
        const cost = priorGenuine * costFalseReject * frr + 
                    (1 - priorGenuine) * costFalseAccept * far;
        
        if (cost < minCost) {
            minCost = cost;
            optimalThreshold = threshold;
            optimalMetrics = { far, frr, cost };
        }
    }
    
    return {
        optimalThreshold,
        minCost,
        ...optimalMetrics
    };
}

/**
 * Calculate precision and recall
 * @param {Array} genuineScores - Scores from genuine attempts
 * @param {Array} impostorScores - Scores from impostor attempts
 * @param {number} threshold - Decision threshold
 * @returns {Object} Precision and recall metrics
 */
export function calculatePrecisionRecall(genuineScores, impostorScores, threshold = 0.5) {
    if (!genuineScores || !impostorScores || genuineScores.length === 0 || impostorScores.length === 0) {
        return {
            precision: 0,
            recall: 0,
            f1Score: 0,
            error: 'Insufficient data'
        };
    }
    
    const truePositives = genuineScores.filter(s => s >= threshold).length;
    const falsePositives = impostorScores.filter(s => s >= threshold).length;
    const falseNegatives = genuineScores.filter(s => s < threshold).length;
    const trueNegatives = impostorScores.filter(s => s < threshold).length;
    
    const precision = truePositives + falsePositives > 0 
        ? truePositives / (truePositives + falsePositives) 
        : 0;
    
    const recall = truePositives + falseNegatives > 0 
        ? truePositives / (truePositives + falseNegatives) 
        : 0;
    
    const f1Score = precision + recall > 0 
        ? 2 * (precision * recall) / (precision + recall) 
        : 0;
    
    return {
        precision,
        recall,
        f1Score,
        truePositives,
        falsePositives,
        falseNegatives,
        trueNegatives
    };
}

/**
 * Generate confusion matrix
 * @param {Array} genuineScores - Scores from genuine attempts
 * @param {Array} impostorScores - Scores from impostor attempts
 * @param {number} threshold - Decision threshold
 * @returns {Object} Confusion matrix
 */
export function generateConfusionMatrix(genuineScores, impostorScores, threshold = 0.5) {
    if (!genuineScores || !impostorScores) {
        return {
            truePositives: 0,
            falsePositives: 0,
            falseNegatives: 0,
            trueNegatives: 0
        };
    }
    
    const truePositives = genuineScores.filter(s => s >= threshold).length;
    const falsePositives = impostorScores.filter(s => s >= threshold).length;
    const falseNegatives = genuineScores.filter(s => s < threshold).length;
    const trueNegatives = impostorScores.filter(s => s < threshold).length;
    
    return {
        truePositives,
        falsePositives,
        falseNegatives,
        trueNegatives,
        accuracy: (truePositives + trueNegatives) / (genuineScores.length + impostorScores.length)
    };
}

/**
 * Calculate authentication accuracy
 * @param {Array} genuineScores - Scores from genuine attempts
 * @param {Array} impostorScores - Scores from impostor attempts
 * @param {number} threshold - Decision threshold
 * @returns {number} Accuracy value
 */
export function calculateAccuracy(genuineScores, impostorScores, threshold = 0.5) {
    if (!genuineScores || !impostorScores || genuineScores.length === 0 || impostorScores.length === 0) {
        return 0;
    }
    
    const correctGenuine = genuineScores.filter(s => s >= threshold).length;
    const correctImpostor = impostorScores.filter(s => s < threshold).length;
    
    return (correctGenuine + correctImpostor) / (genuineScores.length + impostorScores.length);
}

/**
 * Generate comprehensive evaluation report
 * @param {Array} genuineScores - Scores from genuine attempts
 * @param {Array} impostorScores - Scores from impostor attempts
 * @param {number} threshold - Decision threshold
 * @returns {Object} Comprehensive evaluation report
 */
export function generateEvaluationReport(genuineScores, impostorScores, threshold = 0.5) {
    const performanceMetrics = calculatePerformanceMetrics(genuineScores, impostorScores, threshold);
    const rocPoints = generateROCPoints(genuineScores, impostorScores);
    const auc = calculateAUC(rocPoints);
    const detPoints = generateDETPoints(genuineScores, impostorScores);
    const precisionRecall = calculatePrecisionRecall(genuineScores, impostorScores, threshold);
    const confusionMatrix = generateConfusionMatrix(genuineScores, impostorScores, threshold);
    const accuracy = calculateAccuracy(genuineScores, impostorScores, threshold);
    const optimalThreshold = optimizeThreshold(genuineScores, impostorScores);
    
    return {
        performanceMetrics,
        rocPoints,
        auc,
        detPoints,
        precisionRecall,
        confusionMatrix,
        accuracy,
        optimalThreshold,
        summary: {
            eer: performanceMetrics.eer,
            auc,
            accuracy,
            optimalThreshold: optimalThreshold.optimalThreshold,
            far: performanceMetrics.far,
            frr: performanceMetrics.frr
        }
    };
}

/**
 * Helper: Inverse normal CDF (probit function)
 * Approximation using Abramowitz and Stegun formula
 */
function inverseNormalCDF(p) {
    if (p <= 0) return -7;
    if (p >= 1) return 7;
    
    if (p === 0.5) return 0;
    
    const a = [-3.969683028665376e+01, 2.209460984245205e+02,
               -2.759285104469687e+02, 1.383577518672690e+02,
               -3.066479806614716e+01, 2.506628277459239e+00];
    
    const b = [-5.447609879822406e+01, 1.615858368580409e+02,
               -1.556989798598866e+02, 6.680131188771972e+01,
               -1.328068155288572e+01];
    
    const c = [-7.784894002430293e-03, -3.223964580411365e-01,
               -2.400758277161838e+00, -2.549732539343734e+00,
                4.374664141464968e+00, 2.938163982698783e+00];
    
    const d = [7.784695709041462e-03, 3.224671290700398e-01,
               2.445134137142996e+00, 3.754408661907416e+00];
    
    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q, r;
    
    if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
               ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    } else if (p <= pHigh) {
        q = p - 0.5;
        r = q * q;
        return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
               (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
    } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
               ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    }
}
