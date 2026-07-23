export async function loadImageModel() {
  return true;
}

/**
 * Extracts a spatial grid density vector (8x8 grid = 64 dimensions)
 * from the signature bounding box.
 */
function getSpatialGridDensity(canvas, gridSize = 8) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  if (!width || !height) return null;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Find ink bounding box
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let hasInk = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
      // Dark ink check (non-white & visible)
      if (a > 30 && (r < 220 || g < 220 || b < 220)) {
        hasInk = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasInk || maxX <= minX || maxY <= minY) {
    return new Float32Array(gridSize * gridSize).fill(0);
  }

  // 2. Render bounding-box cropped ink into a normalized 128x128 canvas
  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  const targetSize = 128;

  const offscreen = document.createElement('canvas');
  offscreen.width = targetSize;
  offscreen.height = targetSize;
  const offCtx = offscreen.getContext('2d');

  offCtx.fillStyle = 'white';
  offCtx.fillRect(0, 0, targetSize, targetSize);

  // Preserve aspect ratio with padding
  const scale = Math.min((targetSize - 16) / boxW, (targetSize - 16) / boxH);
  const drawW = boxW * scale;
  const drawH = boxH * scale;
  const offsetX = (targetSize - drawW) / 2;
  const offsetY = (targetSize - drawH) / 2;

  offCtx.drawImage(canvas, minX, minY, boxW, boxH, offsetX, offsetY, drawW, drawH);

  // 3. Compute 8x8 cell densities
  const normData = offCtx.getImageData(0, 0, targetSize, targetSize).data;
  const cellSize = targetSize / gridSize; // 16px per cell
  const grid = new Float32Array(gridSize * gridSize);

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const startX = Math.floor(gx * cellSize);
      const startY = Math.floor(gy * cellSize);
      let inkCount = 0;

      for (let y = startY; y < startY + cellSize; y++) {
        for (let x = startX; x < startX + cellSize; x++) {
          const idx = (y * targetSize + x) * 4;
          const r = normData[idx], g = normData[idx + 1], b = normData[idx + 2];
          if (r < 220 || g < 220 || b < 220) {
            inkCount++;
          }
        }
      }
      grid[gy * gridSize + gx] = inkCount / (cellSize * cellSize);
    }
  }

  // 4. L2 Normalize grid vector
  const mag = Math.sqrt(grid.reduce((s, v) => s + v * v, 0)) || 1;
  return grid.map(v => v / mag);
}

export async function getSignatureEmbedding(canvas) {
  if (!canvas) return null;
  try {
    const gridVec = getSpatialGridDensity(canvas, 8);
    return gridVec ? Array.from(gridVec) : null;
  } catch (err) {
    console.warn('[ImageModel] Embedding error:', err);
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
