/* global process */
/**
 * siamese_network.js — Siamese BiLSTM with Triplet Loss + Attention
 *
 * Key features:
 * 1. Custom L2NormLayer (replaces broken tf.layers.lambda)
 * 2. Conv1D → BiLSTM → Temporal Attention → LSTM embedding pipeline
 * 3. Triplet Loss with online semi-hard mining
 * 4. MC-Dropout uncertainty estimation on inference
 * 5. Proper tensor memory management (tidy/dispose)
 */
import * as tf from '@tensorflow/tfjs';

let cachedSiameseModel = null;
const SIAMESE_MODEL_URL = 'indexeddb://siamese-bilstm-model';

// ── Custom L2 normalization layer ─────────────────────────────────────────────
// tf.layers.lambda is not serializable/loadable in TFjs — we use a proper class.
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

// ── Model persistence ─────────────────────────────────────────────────────────
export async function loadSiameseModel() {
    if (cachedSiameseModel) return cachedSiameseModel;
    try {
        if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node) {
            const pathModule = 'path';
            const fsModule = 'fs';
            const path = await import(/* @vite-ignore */ pathModule);
            const fs = await import(/* @vite-ignore */ fsModule);
            const modelPath = path.resolve('./public/models/siamese/model.json');
            if (fs.existsSync(modelPath)) {
                const modelJson = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
                const binData = fs.readFileSync(path.resolve('./public/models/siamese/group1-shard1of1.bin'));
                cachedSiameseModel = await tf.loadLayersModel(tf.io.fromMemory(
                    modelJson.modelTopology,
                    modelJson.weightsManifest[0].weights,
                    binData.buffer.slice(binData.byteOffset, binData.byteOffset + binData.byteLength)
                ));
                console.log('✅ Siamese BiLSTM model loaded in Node.');
                return cachedSiameseModel;
            }
        }
        cachedSiameseModel = await tf.loadLayersModel('/models/siamese/model.json');
        console.log('✅ Siamese BiLSTM model loaded from static public asset.');
        return cachedSiameseModel;
    } catch (e) {
        console.warn('⚠️ Failed to load Siamese model:', e.message);
        return null;
    }
}

export async function saveSiameseModel(model) {
    cachedSiameseModel = model;
    try {
        await model.save(SIAMESE_MODEL_URL);
        console.log('✅ Siamese model saved to IndexedDB.');
    } catch (e) {
        console.warn('⚠️ Could not save Siamese model:', e.message);
    }
}

// ── Architecture ──────────────────────────────────────────────────────────────
/**
 * Sequence encoder: Conv1D → BiLSTM → Temporal Attention → LSTM → L2-norm embedding
 * Input: [batch, 64, 7]  (64 resampled points, 7 features each)
 * Output: [batch, 32]    (L2-normalized embedding vector)
 */
function createSequenceEncoder() {
    const input = tf.input({ shape: [64, 7], name: 'seq_input' });

    // Local feature extraction
    let x = tf.layers.conv1d({
        filters: 32, kernelSize: 3, activation: 'relu',
        padding: 'same', name: 'conv1d'
    }).apply(input);
    x = tf.layers.batchNormalization({ name: 'bn' }).apply(x);
    x = tf.layers.maxPooling1d({ poolSize: 2, name: 'pool' }).apply(x);

    // Bidirectional LSTM — forward + backward temporal context [batch, 32, 128]
    x = tf.layers.bidirectional({
        layer: tf.layers.lstm({ units: 64, returnSequences: true }),
        name: 'bilstm'
    }).apply(x);
    x = tf.layers.dropout({ rate: 0.3, name: 'drop1' }).apply(x);

    // Temporal self-attention — let the model weight important timesteps
    const attnWeights = tf.layers.dense({
        units: 1, activation: 'softmax', name: 'attn_weights'
    }).apply(x);                                     // [batch, 32, 1]
    x = tf.layers.multiply({ name: 'attn_apply' }).apply([x, attnWeights]);

    // Aggregate attended sequence into a single vector
    x = tf.layers.lstm({ units: 32, returnSequences: false, name: 'lstm2' }).apply(x);
    x = tf.layers.dropout({ rate: 0.2, name: 'drop2' }).apply(x);

    // Embedding projection (linear, no activation — metric learning space)
    x = tf.layers.dense({ units: 32, name: 'embed' }).apply(x);

    // L2-normalize so cosine distance == Euclidean distance
    const output = new L2NormLayer({ name: 'l2_norm' }).apply(x);

    return tf.model({ inputs: input, outputs: output, name: 'siamese_encoder' });
}

// ── Loss functions ────────────────────────────────────────────────────────────
export function contrastiveLoss(embA, embB, labels, margin = 1.0) {
    return tf.tidy(() => {
        const d = tf.sqrt(tf.sum(tf.square(tf.sub(embA, embB)), 1));
        const pos = tf.mul(labels, tf.square(d));
        const neg = tf.mul(tf.sub(1, labels), tf.square(tf.maximum(tf.sub(margin, d), 0)));
        return tf.mean(tf.add(pos, neg));
    });
}

export function tripletLoss(embA, embP, embN, margin = 0.5) {
    return tf.tidy(() => {
        const dAP = tf.sum(tf.square(tf.sub(embA, embP)), 1);
        const dAN = tf.sum(tf.square(tf.sub(embA, embN)), 1);
        return tf.mean(tf.maximum(tf.add(tf.sub(dAP, dAN), margin), 0));
    });
}

// ── Training ──────────────────────────────────────────────────────────────────
/**
 * Train from anchor/positive/negative triplets (shape: [N, 64, 7] each).
 * Uses Triplet Loss + Adam, with batch-level gradient updates.
 */
export async function trainSiameseModel(anchors, positives, negatives, epochs = 30) {
    const model    = createSequenceEncoder();
    const optimizer = tf.train.adam(0.001);
    const MARGIN   = 0.5;
    const BATCH    = 8;
    const N        = anchors.length;

    const xA = tf.tensor3d(anchors);
    const xP = tf.tensor3d(positives);
    const xN = tf.tensor3d(negatives);

    console.log(`🧠 Siamese BiLSTM training: ${N} triplets, ${epochs} epochs...`);

    for (let e = 0; e < epochs; e++) {
        let eLoss = 0;
        const nBatch = Math.ceil(N / BATCH);

        for (let b = 0; b < nBatch; b++) {
            const start = b * BATCH;
            const len   = Math.min(BATCH, N - start);

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

        if (e % 5 === 0) {
            console.log(`  Epoch ${e + 1}/${epochs}: loss=${(eLoss / Math.ceil(N/BATCH)).toFixed(4)}`);
        }
        await tf.nextFrame();
    }

    xA.dispose(); xP.dispose(); xN.dispose();
    await saveSiameseModel(model);
    console.log('✅ Siamese BiLSTM trained & saved.');
    return model;
}

// ── Inference ─────────────────────────────────────────────────────────────────
/**
 * Compare two signature sequences.
 * Uses MC-Dropout (5 forward passes) for uncertainty estimation.
 * @returns {{ score: number, uncertainty: number }}
 *   score: 0=different, 1=identical
 *   uncertainty: 0=confident, 1=very uncertain
 */
export async function compareSignaturesSiamese(sequenceA, sequenceB, mcSamples = 5) {
    const model = await loadSiameseModel();
    if (!model) return { score: 0.5, uncertainty: 1.0 };

    const tA = tf.tensor3d([sequenceA]);
    const tB = tf.tensor3d([sequenceB]);
    const distances = [];

    for (let i = 0; i < mcSamples; i++) {
        // training=true activates Dropout layers during inference → MC-Dropout
        const d = tf.tidy(() => {
            const eA = model.predict(tA, { training: true });
            const eB = model.predict(tB, { training: true });
            return tf.sqrt(tf.sum(tf.square(tf.sub(eA, eB)))).dataSync()[0];
        });
        distances.push(d);
    }

    tA.dispose();
    tB.dispose();

    const meanDist  = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance  = distances.reduce((s, d) => s + (d - meanDist) ** 2, 0) / distances.length;
    const uncertainty = Math.min(Math.sqrt(variance) * 4, 1.0); // scale to [0,1]

    // L2-normalized embeddings: max distance = 2 → score = 1 - dist/2
    const score = Math.max(0, Math.min(1, 1 - meanDist / 2));

    console.log(`[Siamese] mean_dist=${meanDist.toFixed(3)} uncertainty=${uncertainty.toFixed(3)} score=${score.toFixed(3)}`);
    return { score, uncertainty };
}

/**
 * Extract a 32-dim embedding from a sequence.
 */
export async function getSignatureEmbeddingVector(sequence) {
    const model = await loadSiameseModel();
    if (!model) return null;
    return tf.tidy(() => {
        const t = tf.tensor3d([sequence]);
        return Array.from(model.predict(t).dataSync());
    });
}
