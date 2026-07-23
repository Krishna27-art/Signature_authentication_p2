import * as tf from '@tensorflow/tfjs';

let mobilenetModel = null;
let featureModel = null;

/**
 * Loads the MobileNet v1 model from TensorFlow Storage CDN and creates
 * a feature extractor using its penultimate activation layer.
 */
export async function loadImageModel() {
  if (featureModel) return featureModel;
  try {
    mobilenetModel = await tf.loadLayersModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json');
    // Penultimate feature layer conv_pw_13_relu has shape [batch, 7, 7, 256]
    const layer = mobilenetModel.getLayer('conv_pw_13_relu') || mobilenetModel.layers[mobilenetModel.layers.length - 2];
    featureModel = tf.model({ inputs: mobilenetModel.inputs, outputs: layer.output });
    console.log("✅ MobileNet feature extractor loaded successfully.");
    return featureModel;
  } catch (err) {
    console.warn("⚠️ Failed to load MobileNet feature extractor:", err.message);
    return null;
  }
}

/**
 * Extracts a 256-dimensional L2-normalized visual feature vector from canvas
 * using MobileNet feature extractor.
 */
export async function getSignatureEmbedding(canvas) {
  if (!canvas) return null;
  const model = await loadImageModel();
  if (!model) return null;

  try {
    return tf.tidy(() => {
      // 1. Convert canvas to tensor [height, width, 3]
      let img = tf.browser.fromPixels(canvas);
      
      // 2. Resize to 224x224
      img = tf.image.resizeBilinear(img, [224, 224]);
      
      // 3. Preprocess pixels from [0, 255] to [-1, 1] range
      const offset = tf.scalar(127.5);
      const normalized = img.toFloat().sub(offset).div(offset);
      
      // 4. Add batch dimension [1, 224, 224, 3]
      const inputTensor = normalized.expandDims(0);
      
      // 5. Predict to get feature map of shape [1, 7, 7, 256]
      const features = model.predict(inputTensor);
      
      // 6. Global Average Pooling to get 256-dimensional vector [1, 256]
      const pooled = tf.mean(features, [1, 2]);
      
      // 7. L2 Normalize the vector
      const norm = tf.norm(pooled, 2, 1, true);
      const l2Normalized = tf.div(pooled, tf.maximum(norm, tf.scalar(1e-8)));
      
      return Array.from(l2Normalized.dataSync());
    });
  } catch (err) {
    console.warn('[ImageModel] MobileNet embedding error:', err);
    return null;
  }
}

export function cosineSimilarity(v1, v2) {
  if (!v1 || !v2 || v1.length !== v2.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    magA += v1[i] ** 2;
    magB += v2[i] ** 2;
  }
  const d = Math.sqrt(magA) * Math.sqrt(magB);
  return d ? Math.max(-1, Math.min(1, dot / d)) : 0;
}

export function normalizeCosineScore(score) {
  if (score == null || isNaN(score)) return null;
  // Convert [-1, 1] cosine similarity to [0, 100] percentage score
  const unit = Math.max(0, Math.min(1, (score + 1) / 2));
  return Math.round(unit * 100);
}
