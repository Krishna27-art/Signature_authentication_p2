
export async function loadImageModel() {
  return true; // no network model needed
}

function getHistogram(canvas, bins = 32) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const hist = new Float32Array(bins);
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114) / 255;
    const bin = Math.min(Math.floor(gray * bins), bins - 1);
    hist[bin]++;
  }
  // L2 normalize
  const mag = Math.sqrt(hist.reduce((s, v) => s + v * v, 0)) || 1;
  return hist.map(v => v / mag);
}

export async function getSignatureEmbedding(canvas) {
  if (!canvas) return null;
  try {
    const off = document.createElement('canvas');
    off.width = 128; off.height = 128;
    const ctx = off.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 128, 128);
    ctx.drawImage(canvas, 0, 0, 128, 128);
    return Array.from(getHistogram(off, 64));
  } catch { return null; }
}

export function cosineSimilarity(v1, v2) {
  if (!v1 || !v2 || v1.length !== v2.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i]; magA += v1[i]**2; magB += v2[i]**2;
  }
  const d = Math.sqrt(magA) * Math.sqrt(magB);
  return d ? Math.max(-1, Math.min(1, dot / d)) : 0;
}

export function normalizeCosineScore(score) {
  if (score == null || isNaN(score)) return null;
  return Math.max(0, Math.min(1, (score + 1) / 2));
}
