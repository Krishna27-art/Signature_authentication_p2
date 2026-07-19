import { pipeline, env } from '@xenova/transformers';

// Configure Transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;
env.remoteHost = 'https://huggingface.co';
env.remotePathTemplate = '{model}/resolve/{revision}/';

let extractor = null;
const MODEL_ID = 'Xenova/mobilevit-small';
const EMBEDDING_SIZE = 640;

export async function loadImageModel() {
    if (!extractor) {
        console.log('📥 Loading image model:', MODEL_ID);
        try {
            extractor = await pipeline(
                'image-feature-extraction',
                MODEL_ID
            );
            console.log('✅ Image model loaded and ready.');
        } catch (err) {
            console.error('❌ Model load failed:', err);
            throw new Error('Failed to load AI image model. Check the initial download connection.', { cause: err });
        }
    }
    return extractor;
}

/**
 * L2 Normalization for embeddings
 */
function l2Normalize(v) {
    const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return mag > 0 ? v.map(x => x / mag) : v;
}

export async function getSignatureEmbedding(canvas) {
    if (!canvas) return null;

    const model = await loadImageModel();

    const offscreen = document.createElement('canvas');
    offscreen.width = 224;
    offscreen.height = 224;
    const octx = offscreen.getContext('2d');
    octx.fillStyle = 'white';
    octx.fillRect(0, 0, 224, 224);
    octx.drawImage(canvas, 0, 0, 224, 224);

    const output = await model(offscreen.toDataURL('image/png'));
    const emb = Array.from(output?.data || []).slice(0, EMBEDDING_SIZE);
    return l2Normalize(emb);
}

export function cosineSimilarity(v1, v2) {
    if (!v1 || !v2 || v1.length !== v2.length) return 0;
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < v1.length; i++) {
        dot += v1[i] * v2[i];
        magA += v1[i] * v1[i];
        magB += v2[i] * v2[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    if (!denom) return 0;
    return Math.max(-1, Math.min(1, dot / denom));
}

export function normalizeCosineScore(score) {
    if (score === null || score === undefined || Number.isNaN(score)) return null;
    return Math.max(0, Math.min(1, (score + 1) / 2));
}
