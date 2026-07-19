/**
 * enhanced_dtw.js — Correct FastDTW implementation
 *
 * The previous implementation had a critical bug:
 *   fastDTW() returned a scalar (distance), but projectPath() expected
 *   a path array of [i,j] pairs. This caused constrainedDTW to run with
 *   an empty window (every cell skipped), always returning Infinity.
 *   The fallback dtw() ran instead but with a radius=2 band that was
 *   too tight for 64-point sequences, producing inflated distances.
 *
 * This rewrite:
 *   1. fastDTW returns { dist, path } — path is an array of [i,j] pairs.
 *   2. constrainedDTW correctly receives the projected window Set.
 *   3. Classic Sakoe-Chiba DTW is a clean, correct fallback.
 *   4. All distance normalization is done by (n + m) path length.
 */

// ─── Classic DTW with Sakoe-Chiba band ────────────────────────────────────────
/**
 * @param {Array} s1
 * @param {Array} s2
 * @param {Object} opts  { bandwidth: 0..1, distance: fn }
 * @returns {number}     normalized distance
 */
export function dtw(s1, s2, opts = {}) {
    const { bandwidth = 0.2, distance = euclidean } = opts;
    const n = s1.length, m = s2.length;
    if (n === 0 || m === 0) return Infinity;

    const w = Math.max(Math.floor(Math.max(n, m) * bandwidth), Math.abs(n - m), 1);
    const C = new Float32Array(n * m).fill(Infinity);
    const idx = (i, j) => i * m + j;

    C[0] = distance(s1[0], s2[0]);

    for (let i = 1; i < n; i++) {
        if (i <= w) C[idx(i, 0)] = C[idx(i - 1, 0)] + distance(s1[i], s2[0]);
    }
    for (let j = 1; j < m; j++) {
        if (j <= w) C[idx(0, j)] = C[idx(0, j - 1)] + distance(s1[0], s2[j]);
    }

    for (let i = 1; i < n; i++) {
        const jLo = Math.max(1, i - w);
        const jHi = Math.min(m - 1, i + w);
        for (let j = jLo; j <= jHi; j++) {
            const cost = distance(s1[i], s2[j]);
            C[idx(i, j)] = cost + Math.min(
                C[idx(i - 1, j)],
                C[idx(i, j - 1)],
                C[idx(i - 1, j - 1)]
            );
        }
    }

    const result = C[idx(n - 1, m - 1)];
    return isFinite(result) ? result / (n + m) : Infinity;
}

// ─── FastDTW — correct recursive implementation ───────────────────────────────
/**
 * FastDTW: O(n) approximation using coarsening + path projection.
 *
 * @param {Array}  s1
 * @param {Array}  s2
 * @param {Object} opts  { radius: number, distance: fn }
 * @returns {number}     normalized distance
 */
export function fastDTW(s1, s2, opts = {}) {
    const { radius = 2, distance = euclidean } = opts;
    return _fastDTW(s1, s2, radius, distance).dist;
}

function _fastDTW(s1, s2, radius, distance) {
    const n = s1.length, m = s2.length;
    const minSize = radius + 2;

    // Base case: sequences are small enough for exact DTW
    if (n <= minSize || m <= minSize) {
        return dtwWithPath(s1, s2, { bandwidth: 1.0, distance });
    }

    // Coarsen both sequences
    const s1c = coarsen(s1);
    const s2c = coarsen(s2);

    // Recursively solve the coarse problem — gets the ALIGNMENT PATH
    const { path: coarsePath } = _fastDTW(s1c, s2c, radius, distance);

    // Project the coarse path back to original resolution
    const window = expandWindow(coarsePath, n, m, radius);

    // Run DTW constrained to the expanded window
    return dtwConstrained(s1, s2, window, distance);
}

/**
 * Standard DTW that also returns the optimal alignment path.
 */
function dtwWithPath(s1, s2, opts = {}) {
    const { bandwidth = 1.0, distance = euclidean } = opts;
    const n = s1.length, m = s2.length;
    if (n === 0 || m === 0) return { dist: Infinity, path: [] };

    const w = Math.max(Math.floor(Math.max(n, m) * bandwidth), Math.abs(n - m), 1);
    const INF = Infinity;
    const C = [];
    for (let i = 0; i < n; i++) C.push(new Float32Array(m).fill(INF));

    C[0][0] = distance(s1[0], s2[0]);
    for (let i = 1; i < n; i++) {
        if (i <= w) C[i][0] = C[i - 1][0] + distance(s1[i], s2[0]);
    }
    for (let j = 1; j < m; j++) {
        if (j <= w) C[0][j] = C[0][j - 1] + distance(s1[0], s2[j]);
    }
    for (let i = 1; i < n; i++) {
        const jLo = Math.max(1, i - w);
        const jHi = Math.min(m - 1, i + w);
        for (let j = jLo; j <= jHi; j++) {
            C[i][j] = distance(s1[i], s2[j]) + Math.min(
                C[i - 1][j], C[i][j - 1], C[i - 1][j - 1]
            );
        }
    }

    // Traceback the optimal path
    const path = [];
    let i = n - 1, j = m - 1;
    while (i > 0 || j > 0) {
        path.push([i, j]);
        if (i === 0) { j--; }
        else if (j === 0) { i--; }
        else {
            const best = Math.min(C[i - 1][j - 1], C[i - 1][j], C[i][j - 1]);
            if (best === C[i - 1][j - 1]) { i--; j--; }
            else if (best === C[i - 1][j])  { i--; }
            else                              { j--; }
        }
    }
    path.push([0, 0]);
    path.reverse();

    const raw = C[n - 1][m - 1];
    return {
        dist: isFinite(raw) ? raw / (n + m) : Infinity,
        path
    };
}

/**
 * DTW constrained to a window (Set of "i,j" strings).
 */
function dtwConstrained(s1, s2, window, distance) {
    const n = s1.length, m = s2.length;
    const INF = Infinity;
    const C = [];
    for (let i = 0; i < n; i++) C.push(new Float32Array(m).fill(INF));

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) {
            if (!window.has(`${i},${j}`)) continue;
            const cost = distance(s1[i], s2[j]);
            const prev = Math.min(
                i > 0 && isFinite(C[i - 1][j])     ? C[i - 1][j]     : INF,
                j > 0 && isFinite(C[i][j - 1])     ? C[i][j - 1]     : INF,
                i > 0 && j > 0 && isFinite(C[i-1][j-1]) ? C[i-1][j-1] : INF
            );
            C[i][j] = (i === 0 && j === 0) ? cost : (isFinite(prev) ? cost + prev : INF);
        }
    }

    // Traceback to get path
    const path = [];
    let i = n - 1, j = m - 1;
    while (i > 0 || j > 0) {
        path.push([i, j]);
        if (i === 0) { j--; }
        else if (j === 0) { i--; }
        else {
            const best = Math.min(
                C[i-1][j-1], C[i-1][j], C[i][j-1]
            );
            if (best === C[i-1][j-1]) { i--; j--; }
            else if (best === C[i-1][j]) { i--; }
            else { j--; }
        }
    }
    path.push([0, 0]);
    path.reverse();

    const raw = C[n - 1][m - 1];
    return {
        dist: isFinite(raw) ? raw / (n + m) : Infinity,
        path
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Coarsen a sequence by averaging adjacent pairs */
function coarsen(seq) {
    const out = [];
    for (let i = 0; i < seq.length - 1; i += 2) {
        const a = seq[i], b = seq[i + 1];
        // Produce a merged point (average of each field)
        const merged = {};
        for (const k of Object.keys(a)) {
            merged[k] = typeof a[k] === 'number' ? (a[k] + (b[k] || 0)) / 2 : a[k];
        }
        out.push(merged);
    }
    if (seq.length % 2 === 1) out.push(seq[seq.length - 1]);
    return out;
}

/**
 * Expand a coarse path back to the original resolution with a radius buffer.
 * Returns a Set of "i,j" strings.
 */
function expandWindow(coarsePath, n, m, radius) {
    const window = new Set();
    for (const [ci, cj] of coarsePath) {
        for (let di = -radius; di <= radius + 1; di++) {
            for (let dj = -radius; dj <= radius + 1; dj++) {
                const ni = ci * 2 + di;
                const nj = cj * 2 + dj;
                if (ni >= 0 && ni < n && nj >= 0 && nj < m) {
                    window.add(`${ni},${nj}`);
                }
            }
        }
    }
    // Always include endpoints
    window.add('0,0');
    window.add(`${n-1},${m-1}`);
    return window;
}

/** Simple Euclidean distance between two points (only x,y) */
function euclidean(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ─── Derivative DTW ───────────────────────────────────────────────────────────
export function ddtw(s1, s2, opts = {}) {
    return dtw(derivative(s1), derivative(s2), { ...opts, distance: euclidean });
}

function derivative(seq) {
    return seq.map((p, i) => {
        if (i === 0 || i === seq.length - 1) return { ...p, dx: 0, dy: 0 };
        return {
            ...p,
            x: ((p.x - seq[i-1].x) + (seq[i+1].x - seq[i-1].x) / 2) / 2,
            y: ((p.y - seq[i-1].y) + (seq[i+1].y - seq[i-1].y) / 2) / 2,
        };
    });
}
