/**
 * behavioral_model.js — Enhanced Behavioral Model
 *
 * Key improvements:
 * 1. Negative samples are clearly different from real samples (3 impostor types)
 * 2. Training epochs: 40 for initial training, 20 for retraining
 * 3. Model upgraded: 12 → 16 input features including temporal entropy & rhythm
 * 4. Temporal Entropy (overallEntropy, velocityEntropy) from temporal_entropy.js
 * 5. Rhythm features (rhythmRegularity, avgPauseDuration, liftCount, cadenceVariance)
 *    from rhythm_analysis.js — capture the unique cadence of each signer
 * 6. predictBehavior returns 0.5 (neutral) if model not loaded
 */

import * as tf from '@tensorflow/tfjs';
import { calculateTemporalEntropy, profileSigningCadence } from './temporal_entropy';
import { analyzeStrokeRhythm, detectMicroPauses, extractSigningCadence } from './rhythm_analysis';

let cachedBehaviorModel = null;
const MODEL_URL = 'indexeddb://behavioral-model';

export async function loadModel() {
    if (cachedBehaviorModel) return cachedBehaviorModel;
    try {
        cachedBehaviorModel = await tf.loadLayersModel(MODEL_URL);
        return cachedBehaviorModel;
    } catch {
        return null;
    }
}

export async function saveModel(model) {
    cachedBehaviorModel = model;
    await model.save(MODEL_URL);
}

const FEATURE_DIM = 20;

function createModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 32, activation: 'relu', inputShape: [FEATURE_DIM] }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.dropout({ rate: 0.25 }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.1 }));
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
    });
    return model;
}

/**
 * Extract enhanced behavioral features from raw points.
 *
 * 16 features (up from 12):
 *  [0]  strokeCount
 *  [1]  avgSpeed
 *  [2]  speedVariation
 *  [3]  totalTime (s)
 *  [4]  directionChanges
 *  [5]  avgCurvature
 *  [6]  aspectRatio
 *  [7]  penLiftCount
 *  [8]  avgPressure
 *  [9]  pressureVariance
 *  [10] avgStrokeDuration (s)
 *  [11] meanAngularVelocity
 *  [12] overallTemporalEntropy  (from temporal_entropy.js)
 *  [13] velocityEntropy          (from temporal_entropy.js)
 *  [14] rhythmRegularity         (from rhythm_analysis.js)
 *  [15] signingCadenceVariance   (from rhythm_analysis.js)
 */
export function extractBehavioralFeatures(points, strokes) {
    if (!points || points.length < 2) return new Array(FEATURE_DIM).fill(0);

    const allStrokes   = strokes && strokes.length ? strokes : [points];
    const strokeCount  = allStrokes.length;
    const totalTime    = Math.max(points[points.length - 1].t - points[0].t, 1);

    const speeds = [];
    const pressures = [];
    const angularVelocities = [];
    let pathLength       = 0;
    let directionChanges = 0;
    let curvatureAccum   = 0;
    let curvatureCount   = 0;
    let prevDir          = null;

    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1], curr = points[i];
        const dt   = Math.max(curr.t - prev.t, 1);
        const dx   = curr.x - prev.x, dy = curr.y - prev.y;
        const dist = Math.hypot(dx, dy);
        const dir  = Math.atan2(dy, dx);
        const spd  = dist / dt;
        const pressure = curr.p || 0.5;

        pathLength += dist;
        speeds.push(spd);
        pressures.push(pressure);

        if (prevDir !== null) {
            const delta = Math.atan2(Math.sin(dir - prevDir), Math.cos(dir - prevDir));
            angularVelocities.push(Math.abs(delta) / dt);
            curvatureAccum += Math.abs(delta);
            curvatureCount++;
            if (Math.abs(delta) > Math.PI / 6) directionChanges++;
        }
        prevDir = dir;
    }

    const meanSpeed    = speeds.reduce((s, v) => s + v, 0) / Math.max(speeds.length, 1);
    const avgSpeed     = pathLength / totalTime;
    const speedVar     = Math.sqrt(speeds.reduce((s, v) => s + (v - meanSpeed) ** 2, 0) / Math.max(speeds.length, 1));
    const avgCurvature = curvatureAccum / Math.max(curvatureCount, 1);
    const penLiftCount = Math.max(strokeCount - 1, 0);

    const meanPressure = pressures.reduce((s, v) => s + v, 0) / Math.max(pressures.length, 1);
    const pressureVar  = Math.sqrt(pressures.reduce((s, v) => s + (v - meanPressure) ** 2, 0) / Math.max(pressures.length, 1));

    const meanAngularVel = angularVelocities.length > 0
        ? angularVelocities.reduce((s, v) => s + v, 0) / angularVelocities.length
        : 0;

    const strokeDuration = allStrokes.reduce((sum, stroke) => {
        if (stroke.length < 2) return sum;
        return sum + (stroke[stroke.length - 1].t - stroke[0].t);
    }, 0) / Math.max(allStrokes.length, 1);

    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const width  = Math.max(...xs) - Math.min(...xs) || 1;
    const height = Math.max(...ys) - Math.min(...ys) || 1;
    const aspectRatio = width / height;

    // ── Temporal entropy features (features 12–13) ──────────────
    let overallEntropy = 0, velocityEntropy = 0;
    try {
        const entropy = calculateTemporalEntropy(points);
        overallEntropy = entropy.overallEntropy || 0;
        velocityEntropy = entropy.velocityEntropy || 0;
    } catch { /* non-fatal */ }

    // ── Rhythm features (features 14–15) ────────────────────────
    let rhythmRegularity = 0, cadenceVariance = 0;
    try {
        const rhythm = analyzeStrokeRhythm(allStrokes);
        rhythmRegularity = rhythm.rhythmRegularity || 0;
        const cadence = extractSigningCadence(points, allStrokes);
        cadenceVariance = cadence.cadenceVariance || 0;
    } catch { /* non-fatal */ }

    // ── Cadence profile & rhythm score features (features 16–17) ──────────────
    let rhythmScore = 0, cadenceConsistency = 0;
    try {
        const profile = profileSigningCadence(points, allStrokes);
        rhythmScore = profile.rhythmScore || 0;
        cadenceConsistency = profile.cadenceConsistency || 0;
    } catch { /* non-fatal */ }

    // ── Micro pause features (features 18–19) ──────────────────────────────────
    let totalPauseCount = 0, avgPauseDuration = 0;
    try {
        const pauseInfo = detectMicroPauses(points, allStrokes);
        totalPauseCount = pauseInfo.totalPauseCount || 0;
        avgPauseDuration = pauseInfo.avgPauseDuration || 0;
    } catch { /* non-fatal */ }

    return [
        strokeCount,
        avgSpeed,
        speedVar,
        totalTime / 1000,
        directionChanges,
        avgCurvature,
        aspectRatio,
        penLiftCount,
        meanPressure,
        pressureVar,
        strokeDuration / 1000,
        meanAngularVel,
        overallEntropy,
        velocityEntropy,
        rhythmRegularity,
        cadenceVariance,
        rhythmScore,
        cadenceConsistency,
        totalPauseCount,
        avgPauseDuration / 1000 // normalized to seconds
    ];
}

/**
 * FIX: Generate negative samples that are clearly different from real ones.
 *
 * Old code used multipliers of 0.55–1.45 which kept negatives too close to
 * real samples. The model couldn't separate them well, so genuine users
 * scored 0.3–0.45 (near-impostor territory).
 *
 * New approach: three types of impostors —
 *   Type A: wrong speed (way too fast or too slow)
 *   Type B: wrong stroke count (completely different structure)
 *   Type C: random (no resemblance)
 */
// Feature Indices Mapping for documentation & safe maintenance:
// 0: strokeCount, 1: avgSpeed, 2: speedVar, 3: totalTime, 4: dirChanges, 5: avgCurvature,
// 6: aspectRatio, 7: penLiftCount, 8: meanPressure, 9: pressureVar, 10: strokeDuration,
// 11: meanAngularVel, 12: overallEntropy, 13: velocityEntropy, 14: rhythmRegularity,
// 15: cadenceVariance, 16: rhythmScore, 17: cadenceConsistency, 18: totalPauseCount, 19: avgPauseDuration

function generateNegativeSample(base) {
    const type = Math.floor(Math.random() * 3);
    const d = base.length;

    if (type === 0) {
        // Type A: wrong timing/speed — perturb speed, time, direction dims significantly
        const speedFactor = Math.random() > 0.5 ? 3.0 + Math.random() * 2 : 0.1 + Math.random() * 0.3;
        const neg = [...base];
        neg[1] = base[1] * speedFactor;                              // [1] avgSpeed
        neg[2] = base[2] * (0.2 + Math.random());                   // [2] speedVar
        neg[3] = base[3] * speedFactor;                             // [3] totalTime
        neg[4] = Math.max(0, base[4] + Math.round((Math.random() - 0.5) * 15)); // [4] dirChanges
        neg[5] = base[5] * (0.2 + Math.random() * 2);             // [5] avgCurvature
        // Entropy & rhythm dimensions
        if (d > 12) { neg[12] = Math.random() * 3.5; neg[13] = Math.random() * 3.5; } // [12] overallEntropy, [13] velocityEntropy
        if (d > 14) { neg[14] = Math.random(); neg[15] = Math.random() * 500; }        // [14] rhythmRegularity, [15] cadenceVariance
        if (d > 16) { neg[16] = Math.random(); neg[17] = Math.random(); }             // [16] rhythmScore, [17] cadenceConsistency
        if (d > 18) { neg[18] = Math.max(0, base[18] + Math.round((Math.random() - 0.5) * 5)); neg[19] = Math.random() * 2.0; } // [18] totalPauseCount, [19] avgPauseDuration
        return neg;
    } else if (type === 1) {
        // Type B: wrong stroke structure
        const extraStrokes = Math.floor(Math.random() * 4) + 1;
        const neg = [...base];
        neg[0] = Math.max(1, base[0] + (Math.random() > 0.5 ? extraStrokes : -Math.min(extraStrokes, base[0] - 1))); // [0] strokeCount
        neg[1] = base[1] * (0.7 + Math.random() * 0.6);             // [1] avgSpeed
        neg[2] = base[2] * (0.5 + Math.random());                  // [2] speedVar
        neg[3] = base[3] * (0.6 + Math.random() * 0.8);            // [3] totalTime
        neg[6] = base[6] * (0.4 + Math.random() * 1.2);            // [6] aspectRatio
        neg[7] = Math.max(0, base[7] + (Math.random() > 0.5 ? extraStrokes : -1)); // [7] penLiftCount
        if (d > 14) { neg[14] = Math.random() * 0.3; neg[15] = base[15] * (2 + Math.random()); }
        if (d > 16) { neg[16] = Math.random() * 0.4; neg[17] = Math.random() * 0.4; }
        if (d > 18) { neg[18] = Math.max(0, base[18] + 2); neg[19] = base[19] * (1.5 + Math.random()); }
        return neg;
    } else {
        // Type C: fully random (simulates a completely different person)
        const neg = new Array(d).fill(0).map(() => Math.random());
        neg[0] = Math.max(1, Math.round(1 + Math.random() * 5));
        neg[1] = Math.random() * 2.0;
        neg[2] = Math.random() * 0.8;
        neg[3] = 0.5 + Math.random() * 5;
        neg[4] = Math.floor(Math.random() * 40);
        neg[5] = Math.random() * 1.5;
        neg[6] = 0.3 + Math.random() * 2.5;
        neg[7] = Math.floor(Math.random() * 4);
        if (d > 12) { neg[12] = Math.random() * 3.5; neg[13] = Math.random() * 3.5; }
        if (d > 14) { neg[14] = Math.random(); neg[15] = Math.random() * 500; }
        if (d > 16) { neg[16] = Math.random(); neg[17] = Math.random(); }
        if (d > 18) { neg[18] = Math.floor(Math.random() * 8); neg[19] = Math.random() * 3.0; }
        return neg;
    }
}

function createTrainingSet(enrollmentFeatures) {
    // Accept any feature vector that matches our expected dimension
    const xPos = enrollmentFeatures.filter(f => Array.isArray(f) && f.length === FEATURE_DIM);
    if (xPos.length === 0) {
        console.warn('[BehaviorModel] No valid feature vectors for training (expected dim', FEATURE_DIM, '). Got dims:', enrollmentFeatures.map(f => f?.length));
        return { xPos: [], xNeg: [], yPos: [], yNeg: [] };
    }
    const xNeg = [];
    // 6× negative ratio — enough contrast for the model to learn a clean boundary
    for (let i = 0; i < xPos.length * 6; i++) {
        xNeg.push(generateNegativeSample(xPos[i % xPos.length]));
    }
    return {
        xPos, xNeg,
        yPos: new Array(xPos.length).fill(1),
        yNeg: new Array(xNeg.length).fill(0)
    };
}

async function fitModel(model, features, epochs) {
    const { xPos, xNeg, yPos, yNeg } = createTrainingSet(features);
    const xTrain = tf.tensor2d([...xPos, ...xNeg]);
    const yTrain = tf.tensor2d([...yPos, ...yNeg], [yPos.length + yNeg.length, 1]);

    console.log(`🧠 Training behavioral model (${xPos.length} real, ${xNeg.length} negative, ${epochs} epochs)...`);
    await model.fit(xTrain, yTrain, {
        epochs,
        batchSize: 8,
        shuffle: true,
        verbose: 0,
        callbacks: { onEpochEnd: async () => { await tf.nextFrame(); } }
    });

    xTrain.dispose();
    yTrain.dispose();
}

export async function trainBehavioralModel(enrollmentFeatures, epochs = 40) {
    const model = createModel();
    await fitModel(model, enrollmentFeatures, epochs);
    return model;
}

export async function retrainBehavioralModel(model, successfulFeatures, historicalFeatures = [], epochs = 20) {
    if (!model) return null;
    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
    });
    const corpus = [...historicalFeatures, successfulFeatures].filter(Boolean);
    if (!corpus.length) return model;
    await fitModel(model, corpus, epochs);
    return model;
}

/**
 * FIX: Return 0.5 (neutral) instead of 0 when model is not loaded.
 * Returning 0 caused fuseScores to treat missing model as "definite impostor"
 * which dragged the fused score below threshold for genuine users.
 */
export async function predictBehavior(model, features) {
    if (!model) return 0.5; // neutral — don't penalize when model unavailable
    try {
        return tf.tidy(() => {
            const input = tf.tensor2d([features]);
            const pred  = model.predict(input);
            return pred.dataSync()[0];
        });
    } catch {
        return 0.5;
    }
}