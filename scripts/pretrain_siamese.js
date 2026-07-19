/**
 * scripts/pretrain_siamese.js
 * Pretrains the global Siamese BiLSTM model on a multi-user dataset and exports it.
 * Run with: node scripts/pretrain_siamese.js
 */

import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import * as path from 'path';

// Import generation helper function
import { generateGenuine, generateImpostor } from '../tests/synthetic_gen.js';

// Custom L2 Norm Layer (registered so TFJS knows how to serialize it)
class L2NormLayer extends tf.layers.Layer {
    call(inputs) {
        const x = Array.isArray(inputs) ? inputs[0] : inputs;
        const norm = tf.norm(x, 2, 1, true);
        return tf.div(x, tf.maximum(norm, tf.scalar(1e-8)));
    }
    computeOutputShape(inputShape) { return inputShape; }
    getClassName() { return 'L2NormLayer'; }
    static get className() { return 'L2NormLayer'; }
}
tf.serialization.registerClass(L2NormLayer);

// Sequence encoder construction helper
function createSequenceEncoder() {
    const input = tf.input({ shape: [64, 7], name: 'seq_input' });

    let x = tf.layers.conv1d({
        filters: 32, kernelSize: 3, activation: 'relu',
        padding: 'same', name: 'conv1d'
    }).apply(input);
    x = tf.layers.batchNormalization({ name: 'bn' }).apply(x);
    x = tf.layers.maxPooling1d({ poolSize: 2, name: 'pool' }).apply(x);

    x = tf.layers.bidirectional({
        layer: tf.layers.lstm({ units: 64, returnSequences: true }),
        name: 'bilstm'
    }).apply(x);
    x = tf.layers.dropout({ rate: 0.3, name: 'drop1' }).apply(x);

    const attnWeights = tf.layers.dense({
        units: 1, activation: 'softmax', name: 'attn_weights'
    }).apply(x);
    x = tf.layers.multiply({ name: 'attn_apply' }).apply([x, attnWeights]);

    x = tf.layers.lstm({ units: 32, returnSequences: false, name: 'lstm2' }).apply(x);
    x = tf.layers.dropout({ rate: 0.2, name: 'drop2' }).apply(x);

    x = tf.layers.dense({ units: 32, name: 'embed' }).apply(x);
    const output = new L2NormLayer({ name: 'l2_norm' }).apply(x);

    return tf.model({ inputs: input, outputs: output, name: 'siamese_encoder' });
}

// Triplet loss
function tripletLoss(embA, embP, embN, margin = 0.5) {
    return tf.tidy(() => {
        const dAP = tf.sum(tf.square(tf.sub(embA, embP)), 1);
        const dAN = tf.sum(tf.square(tf.sub(embA, embN)), 1);
        return tf.mean(tf.maximum(tf.add(tf.sub(dAP, dAN), margin), 0));
    });
}

// Bounding-box normalization + 64-point resampling + feature extraction helper
function normalizeAndExtract(pts) {
    if (!pts || pts.length < 10) return Array(64).fill([0, 0, 0, 0, 0, 0, 0.5]);
    
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const sz = Math.max(maxX - minX, maxY - minY) || 1;
    
    // Scale coordinates
    let p = pts.map(pt => ({ ...pt, x: (pt.x - minX) / sz, y: (pt.y - minY) / sz }));
    
    // Resample to 64 points
    const n = 64;
    const totalLen = p.reduce((acc, curr, idx) => {
        if (idx === 0) return acc;
        return acc + Math.hypot(curr.x - p[idx-1].x, curr.y - p[idx-1].y);
    }, 0) || 1;
    
    const resampled = [p[0]];
    const I = totalLen / (n - 1);
    let D = 0, cp = [...p];
    for (let i = 1; i < cp.length; i++) {
        const d = Math.hypot(cp[i].x - cp[i-1].x, cp[i].y - cp[i-1].y);
        if (D + d >= I) {
            const t = (I - D) / d;
            const np = {
                x: cp[i-1].x + t * (cp[i].x - cp[i-1].x),
                y: cp[i-1].y + t * (cp[i].y - cp[i-1].y),
                t: cp[i-1].t + t * (cp[i].t - cp[i-1].t),
                p: (cp[i-1].p || 0.5) + t * ((cp[i].p || 0.5) - (cp[i-1].p || 0.5)),
            };
            resampled.push(np); cp.splice(i, 0, np); D = 0;
        } else D += d;
    }
    while (resampled.length < n) resampled.push({ ...resampled[resampled.length - 1] });
    const finalPoints = resampled.slice(0, n);
    
    // Extract features
    return finalPoints.map((pt, i) => {
        if (i === 0) return [pt.x, pt.y, 0, 0, 0, 0, pt.p || 0.5];
        const dx = pt.x - finalPoints[i-1].x;
        const dy = pt.y - finalPoints[i-1].y;
        const dt = Math.min(Math.max(pt.t - finalPoints[i-1].t, 8), 100);
        const segLen = Math.hypot(dx, dy);
        
        const vel = (segLen / totalLen) / (dt / 1000);
        const dir = Math.atan2(dy, dx);
        
        const prevVel = finalPoints[i-1].vel || 0;
        const acc = (vel - prevVel) / (dt / 1000);
        
        let curv = 0;
        if (finalPoints[i-1].dir !== undefined) {
            let dd = dir - finalPoints[i-1].dir;
            while (dd > Math.PI)  dd -= 2 * Math.PI;
            while (dd < -Math.PI) dd += 2 * Math.PI;
            curv = Math.abs(dd);
        }
        
        return [pt.x, pt.y, vel, dir, acc, curv, pt.p || 0.5];
    });
}

async function main() {
    console.log("🚀 Pre-training Siamese model offline...");
    
    // Generate synthetic dataset representing 20 users
    const userNames = Array.from({ length: 20 }, (_, i) => `user_${i}`);
    const anchors = [];
    const positives = [];
    const negatives = [];
    
    console.log("Generating multi-user training triplets...");
    const blueprintKeys = ['userA', 'userB', 'userC'];
    for (let u = 0; u < userNames.length; u++) {
        const userBlueprint = blueprintKeys[u % blueprintKeys.length];
        const otherBlueprint = blueprintKeys[(u + 1) % blueprintKeys.length];

        // Generate 15 genuine signatures with user-specific scaling
        const genuines = [];
        const userScale = 0.7 + (u % 5) * 0.15;
        for (let i = 0; i < 15; i++) {
            const raw = generateGenuine(userBlueprint, 2 + Math.random() * 3, userScale);
            genuines.push(normalizeAndExtract(raw));
        }

        // Generate positive/negative pairs
        for (let i = 0; i < genuines.length; i++) {
            const anchor = genuines[i];
            const positive = genuines[(i + 1) % genuines.length];

            // Use combination of hard impostor forgery and distinct user blueprint for negative
            const negativeRaw = (i % 2 === 0)
                ? generateImpostor(userBlueprint)
                : generateGenuine(otherBlueprint, 6 + Math.random() * 4);
            const negative = normalizeAndExtract(negativeRaw);

            anchors.push(anchor);
            positives.push(positive);
            negatives.push(negative);
        }
    }
    
    const N = anchors.length;
    console.log(`Generated ${N} training triplets. Standardizing tensors...`);
    
    const xA = tf.tensor3d(anchors);
    const xP = tf.tensor3d(positives);
    const xN = tf.tensor3d(negatives);
    
    const model = createSequenceEncoder();
    const optimizer = tf.train.adam(0.001);
    const MARGIN = 0.5;
    const BATCH = 16;
    const epochs = 15; // Fast training for offline model prototype
    
    console.log(`Training global Siamese BiLSTM model for ${epochs} epochs...`);
    for (let e = 0; e < epochs; e++) {
        let eLoss = 0;
        const nBatch = Math.ceil(N / BATCH);
        
        for (let b = 0; b < nBatch; b++) {
            const start = b * BATCH;
            const len = Math.min(BATCH, N - start);
            
            const bA = xA.slice([start, 0, 0], [len, 64, 7]);
            const bP = xP.slice([start, 0, 0], [len, 64, 7]);
            const bN = xN.slice([start, 0, 0], [len, 64, 7]);
            
            const loss = optimizer.minimize(() => {
                const eA = model.predict(bA);
                const eP = model.predict(bP);
                const eN = model.predict(bN);
                return tripletLoss(eA, eP, eN, MARGIN);
            }, true);
            
            eLoss += loss.dataSync()[0];
            loss.dispose();
            bA.dispose(); bP.dispose(); bN.dispose();
        }
        
        console.log(`  Epoch ${e + 1}/${epochs}: loss=${(eLoss / nBatch).toFixed(4)}`);
    }
    
    // Save directory path
    const saveDir = path.resolve('./public/models/siamese');
    if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
    }
    
    console.log(`Saving pretrained model to ${saveDir}`);
    await model.save(tf.io.withSaveHandler(async (artifacts) => {
        const modelJson = {
            modelTopology: artifacts.modelTopology,
            weightsManifest: [{
                paths: ['./group1-shard1of1.bin'],
                weights: artifacts.weightSpecs
            }]
        };
        fs.writeFileSync(path.join(saveDir, 'model.json'), JSON.stringify(modelJson, null, 2));
        if (artifacts.weightData) {
            fs.writeFileSync(path.join(saveDir, 'group1-shard1of1.bin'), Buffer.from(artifacts.weightData));
        }
        return {
            modelArtifactsInfo: {
                dateSaved: new Date(),
                modelTopologyType: 'JSON',
                weightDataBytes: artifacts.weightData ? artifacts.weightData.byteLength : 0
            }
        };
    }));
    console.log("✅ Siamese model pretrained and exported successfully!");
    
    xA.dispose(); xP.dispose(); xN.dispose();
}

main().catch(err => {
    console.error("❌ Pretraining failed:", err);
});
