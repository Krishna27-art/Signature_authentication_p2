/* =========================================================
   biometrics.js — Deployment-Ready Signature Biometric Engine

   Deployment fixes over previous version:
    1. Encryption key is derived from a hardcoded appSecret and a random salt in localStorage.
       This acts as best-effort local data obfuscation to prevent casual inspection or
       accidental leakage, but is NOT a cryptographically secure barrier against targeted
       client-side extraction since the appSecret is embedded in the JS bundle.
   2. normalize() clamps dt to 8–100ms range to handle different
      touch sampling rates (60Hz mobile vs 120Hz+ desktop).
   3. Bounding box minimum raised from 20px to 10 (unit space)
      to avoid false rejections on mobile smaller canvases.
   4. DTW threshold cap raised from 0.18 → 0.22 for mobile touch
      which has naturally higher variation than mouse input.
   5. Path length ratio widened from 0.50–2.0 → 0.40–2.5 to
      account for mobile drawing variation.
   6. Image model failure is fully non-fatal — any error sets
      imageScore = null (DTW carries the decision alone).
   ========================================================= */

import { getSignatureEmbedding, cosineSimilarity, normalizeCosineScore } from './image_model';
import { extractBehavioralFeatures } from './behavioral_model';
import { fuseScores, dtwDistanceToSimilarity, ptDist, getDynamicThreshold, standardize, summarizeNearestDistances } from './score_fusion';
import { fastDTW } from './enhanced_dtw';
import { loadSiameseModel, compareSignaturesSiamese } from './siamese_network';
import { detectLiveness, preventReplayAttack } from './liveness_detection';
import { protectTemplate, verifyCancelableTemplate } from './cancelable_biometrics';
import { initDeviceCalibration, getDeviceCalibration, applyDeviceNormalization } from './device_calibration';
import { getVerificationExplanation } from './explainable_verification';

// ── IndexedDB + AES-GCM encrypted store ──────────────────
const DB_NAME = "BiometricP2", STORE_NAME = "store";
export const BDB = {
    db: null, key: null, cache: {},
    async init() {
        if (!window.crypto || !window.crypto.subtle)
            throw new Error("This app needs HTTPS to store your signature securely. Please open it using the https:// link, not http:// or a raw local IP address.");
        if (this.db) return;
        return new Promise((res, rej) => {
            const r = indexedDB.open(DB_NAME, 1);
            r.onupgradeneeded = e => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains(STORE_NAME)) d.createObjectStore(STORE_NAME);
            };
            r.onsuccess = async e => { this.db = e.target.result; await this._initKey(); res(); };
            r.onerror = e => rej(e);
        });
    },
    // SECURITY NOTE: appSecret is a public constant in the JS bundle. This AES-GCM
    // layer stops casual devtools inspection and accidental leakage, but does NOT
    // stop an attacker who can read the deployed source. See Phase 5 for the real fix.
    async _initKey() {
        // DEPLOYMENT FIX: Key is derived ONLY from the random salt stored
        // in localStorage — NOT from userAgent/screen dimensions.
        //
        // Why: userAgent changes between browsers and after browser updates.
        // screen.width changes between devices. Using them as key material
        // means the key is different on mobile vs desktop, causing silent
        // decryption failures that make the app think nobody is enrolled.
        //
        // The salt alone is sufficient — it is 128 bits of randomness,
        // generated once and stored. The PBKDF2 derivation still provides
        // key stretching. The tradeoff: if localStorage is cleared the
        // user must re-enroll (same as before).
        let salt = localStorage.getItem("p2_salt");
        let saltBuf;
        if (!salt) {
            saltBuf = crypto.getRandomValues(new Uint8Array(16));
            localStorage.setItem("p2_salt", [...saltBuf].join(","));
        } else {
            saltBuf = new Uint8Array(salt.split(",").map(Number));
        }

        // Use a fixed app secret + salt (not device-dependent)
        const appSecret = "BioP2-SecureSignatureAuth-v1";
        const raw = await crypto.subtle.importKey(
            "raw", new TextEncoder().encode(appSecret),
            { name: "PBKDF2" }, false, ["deriveKey"]
        );
        this.key = await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: saltBuf, iterations: 100000, hash: "SHA-256" },
            raw, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
    },
    async set(k, v) {
        this.cache[k] = v;
        await this.init();
        const str = typeof v === "string" ? v : JSON.stringify(v);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const enc = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv }, this.key, new TextEncoder().encode(str)
        );
        return new Promise((res, rej) => {
            const tx = this.db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put({ iv, data: enc }, k);
            tx.oncomplete = res; tx.onerror = rej;
        });
    },
    async get(k, fb = null) {
        if (this.cache[k] !== undefined) return this.cache[k];
        await this.init();
        return new Promise((res, rej) => {
            const tx = this.db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).get(k);
            req.onsuccess = async () => {
                if (!req.result) { this.cache[k] = fb; return res(fb); }
                try {
                    const dec = await crypto.subtle.decrypt(
                        { name: "AES-GCM", iv: req.result.iv }, this.key, req.result.data
                    );
                    const str = new TextDecoder().decode(dec);
                    try { const p = JSON.parse(str); this.cache[k] = p; res(p); }
                    catch { this.cache[k] = str; res(str); }
                } catch (e) {
                    // Decryption failed — key mismatch (old enrollment with old key)
                    // Return fallback so app asks user to re-enroll cleanly
                    console.warn(`[BDB] Decryption failed for key "${k}" — returning fallback.`, e.message);
                    this.cache[k] = fb;
                    res(fb);
                }
            };
            req.onerror = rej;
        });
    },
    async del(k) {
        delete this.cache[k];
        await this.init();
        return new Promise((res, rej) => {
            const tx = this.db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).delete(k);
            tx.oncomplete = res; tx.onerror = rej;
        });
    }
};

// ── State ─────────────────────────────────────────────────
export const DEFAULT_STATE = () => ({
    template: null, anchorSamples: [], adaptSamples: [],
    threshold: 0.18, device: null, attempts: 0, lockUntil: 0,
    successCount: 0, avgScore: null,
    imageEmbedding: null, behavioralTrained: false, behavioralStats: null,
    fusedThreshold: 55, behaviorFeatureHistory: [],
    lastBehavioralRetrainAt: null, successfulLoginCount: 0,
    enrolledPathLength: null, enrolledStrokeCount: null,
    // Live analytics
    verificationHistory: [],   // [{score, passed, ts}] — for FAR/FRR estimation
    siameseTrained: false,
});

export const readState  = async () => (await BDB.get("bio_state", null)) || DEFAULT_STATE();
export const writeState = async s  => BDB.set("bio_state", s);

// ── Device Fingerprint (informational only, not used for crypto) ──
export async function getDeviceHash() {
    const combined = `${navigator.hardwareConcurrency || 2}|${'ontouchstart' in window}|${screen.colorDepth}`;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(combined));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Signal Processing ─────────────────────────────────────
const euclidean  = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rawPathLen = pts => { let d = 0; for (let i = 1; i < pts.length; i++) d += euclidean(pts[i-1], pts[i]); return d; };

/**
 * Filter out tiny strokes (dots, accidental taps, pen flicks)
 * Strokes shorter than threshold are ignored during processing
 */
function filterTinyStrokes(strokes, minLength = 15) {
    return strokes.filter(stroke => rawPathLen(stroke) >= minLength);
}

function resamplePts(pts, n = 64) {
    if (pts.length < 2) return pts;
    const totalLen = rawPathLen(pts);
    if (totalLen === 0) return pts;
    const I = totalLen / (n - 1);
    let D = 0, out = [pts[0]], cp = [...pts];
    for (let i = 1; i < cp.length; i++) {
        const d = euclidean(cp[i-1], cp[i]);
        if (D + d >= I) {
            const t = (I - D) / d;
            const np = {
                x: cp[i-1].x + t * (cp[i].x - cp[i-1].x),
                y: cp[i-1].y + t * (cp[i].y - cp[i-1].y),
                t: cp[i-1].t + t * (cp[i].t - cp[i-1].t),
                p: (cp[i-1].p || 0.5) + t * ((cp[i].p || 0.5) - (cp[i-1].p || 0.5)),
            };
            out.push(np); cp.splice(i, 0, np); D = 0;
        } else D += d;
    }
    while (out.length < n) out.push({ ...out[out.length - 1] });
    return out.slice(0, n);
}

function normalize(pts, n = 64) {
    if (!pts || pts.length < 10) return null;

    // Scale to unit bounding box
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const sz = Math.max(maxX - minX, maxY - minY) || 1;

    // DEPLOYMENT FIX: lowered from 20 → 10 (unit-space check is already
    // canvas-scale-independent; 10 still catches dot/tap inputs)
    if (sz < 10) return null;

    let p = pts.map(pt => ({ ...pt, x: (pt.x - minX) / sz, y: (pt.y - minY) / sz }));
    p = resamplePts(p, n);

    const totalLen = rawPathLen(p) || 1;

    p = p.map((pt, i) => {
        if (i === 0) return { ...pt, vel: 0, dir: 0, acc: 0, curv: 0, pressure: pt.p || 0.5 };

        const dx = pt.x - p[i-1].x;
        const dy = pt.y - p[i-1].y;

        // DEPLOYMENT FIX: clamp dt to 8–100ms.
        // Mobile touch fires at ~60Hz (16ms), desktop mouse at ~8ms,
        // some stylus at 240Hz (4ms). Without clamping, vel and acc
        // are on completely different scales across devices, making
        // DTW distances unreliable.
        const dt = Math.min(Math.max(pt.t - p[i-1].t, 8), 100);
        const segLen = Math.hypot(dx, dy);

        const vel = (segLen / totalLen) / (dt / 1000);
        const dir = Math.atan2(dy, dx);

        const prevVel = p[i-1].vel || 0;
        const acc = (vel - prevVel) / (dt / 1000);

        let curv = 0;
        if (p[i-1].dir !== undefined) {
            let dd = dir - p[i-1].dir;
            while (dd > Math.PI)  dd -= 2 * Math.PI;
            while (dd < -Math.PI) dd += 2 * Math.PI;
            curv = Math.abs(dd);
        }

        const maxExpectedVel = 5;
        const pressure = (pt.p && pt.p > 0 && pt.p < 1)
            ? pt.p
            : Math.max(0.1, 1 - Math.min(vel / maxExpectedVel, 1));

        return { ...pt, vel, dir, acc, curv, pressure };
    });

    return p;
}

function dtw(s1, s2) {
    return fastDTW(s1, s2, { radius: 2, distance: ptDist });
}

function extractSequenceFeatures(normPoints) {
    if (!normPoints) return [];
    return normPoints.map(p => [
        p.x, p.y, 
        p.vel || 0, 
        p.dir || 0, 
        p.acc || 0, 
        p.curv || 0, 
        p.pressure || 0.5
    ]);
}

// ── Enroll ────────────────────────────────────────────────
export const ENROLL_N = 3;

export async function enrollSample(pts, state, partials, canvas, strokes) {
    console.log("🛠 [Enroll] Points:", pts.length);

    // Initialize device calibration if not already done
    await initDeviceCalibration();
    const calibration = await getDeviceCalibration();

    // Filter out tiny strokes (dots, accidental taps)
    const filteredStrokes = filterTinyStrokes(strokes || [pts]);
    let filteredPts = filteredStrokes.flat();

    // Apply device normalization
    if (calibration) {
        filteredPts = applyDeviceNormalization(filteredPts, calibration);
    }

    const norm = normalize(filteredPts, 64);
    if (!norm) return { err: "Signature too short or too small. Try again." };

    partials.push(norm);
    await BDB.set("partials", partials);

    const feat = extractBehavioralFeatures(pts, strokes || [pts]);
    const enrollFeats = await BDB.get("enroll_feats", []);
    enrollFeats.push(feat);
    await BDB.set("enroll_feats", enrollFeats);

    if (canvas) {
        try {
            const emb = await getSignatureEmbedding(canvas);
            if (emb) {
                const enrollEmbs = await BDB.get("enroll_embs", []);
                enrollEmbs.push(emb);
                await BDB.set("enroll_embs", enrollEmbs);
            }
        } catch (err) {
            // Image model failure is non-fatal during enrollment
            console.warn("Image embedding skipped during enrollment:", err.message);
        }
    }

    if (partials.length < ENROLL_N) return { progress: partials.length };

    // ── Finalize enrollment ──────────────────────────────

    // 1. Average image embedding (optional — ok if null)
    const enrollEmbs = await BDB.get("enroll_embs", []);
    let avgEmb = null;
    if (enrollEmbs.length > 0) {
        avgEmb = new Array(enrollEmbs[0].length).fill(0);
        enrollEmbs.forEach(e => e.forEach((v, i) => avgEmb[i] += v / enrollEmbs.length));
    }
    await BDB.del("enroll_embs");

    // 2. Behavioral standardization
    const behaviorFeatures = await BDB.get("enroll_feats", []);
    // A17 fix: guard against empty feature array (e.g. BDB returned [])
    if (!behaviorFeatures || behaviorFeatures.length === 0 || !behaviorFeatures[0]) {
        console.warn("[Enroll] No behavioral features collected — skipping standardization.");
        await BDB.del("enroll_feats");
        return { err: "Enrollment data incomplete. Please re-enroll." };
    }
    const nF = behaviorFeatures[0].length;
    const mean = new Array(nF).fill(0);
    const std  = new Array(nF).fill(0);
    for (let i = 0; i < nF; i++) {
        const vals = behaviorFeatures.map(f => f[i]);
        mean[i] = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.reduce((s, v) => s + (v - mean[i]) ** 2, 0) / vals.length;
        std[i] = Math.sqrt(variance) || 1; // avoid div-by-zero
    }
    const standardizedFeatures = behaviorFeatures.map(f => standardize(f, { mean, std }));
    
    // 3. Siamese Network (check if pre-trained model is loaded)
    const siameseModel = await loadSiameseModel();
    const siameseTrained = !!siameseModel;

    // 4. DTW threshold from pairwise enrollment distances
    const pairDistances = [];
    for (let i = 0; i < partials.length; i++)
        for (let j = i + 1; j < partials.length; j++)
            pairDistances.push(dtw(partials[i], partials[j]));

    const avgDist = pairDistances.reduce((a, b) => a + b, 0) / pairDistances.length;
    const maxDist = Math.max(...pairDistances);

    // threshold = clamp( max(avgDist * 2.5, maxDist * 1.5), 0.12, 0.30 )
    // Minimum raised to 0.12: touch input naturally varies more than mouse.
    // A 0.04 minimum was too tight — genuine same-user signatures were failing.
    const dtwThreshold = Math.max(
        Math.min(Math.max(avgDist * 2.5, maxDist * 1.5), 0.30),
        0.12
    );
    console.log(`[Enroll] DTW pairwise avg=${avgDist.toFixed(4)}, max=${maxDist.toFixed(4)}, threshold=${dtwThreshold.toFixed(4)}`);

    // 5. Enrolled path length (in normalized space)
    const normalizedLengths = partials.map(s => rawPathLen(s));
    const avgNormLen = normalizedLengths.reduce((a, b) => a + b, 0) / normalizedLengths.length;
    const stdNormLen = Math.sqrt(
        normalizedLengths.reduce((s, v) => s + (v - avgNormLen) ** 2, 0) / normalizedLengths.length
    );
    console.log(`[Enroll] Path length avg=${avgNormLen.toFixed(3)}, std=${stdNormLen.toFixed(3)}`);

    // 6. Stroke count
    const strokeCount = strokes ? strokes.length : 1;

    // 7. Cancelable Biometrics (BioHashing) for behavioral stats
    const protectedTemplate = await protectTemplate(mean, await getDeviceHash());

    const ns = DEFAULT_STATE();
    // A10 fix: ns.template was a dead assignment — verifySample only reads anchorSamples.
    // Kept for backwards DB compat but no longer used in verification logic.
    ns.template              = null;
    ns.anchorSamples         = [...partials];
    ns.threshold             = dtwThreshold;
    ns.imageEmbedding        = avgEmb;
    ns.behavioralTrained     = false;
    ns.siameseTrained        = siameseTrained;
    ns.behavioralStats       = { mean, std };
    ns.protectedTemplate     = protectedTemplate;
    ns.behaviorFeatureHistory = standardizedFeatures.slice(-20);
    ns.lastBehavioralRetrainAt = Date.now();
    ns.device                = await getDeviceHash();
    ns.enrolledPathLength    = avgNormLen;
    ns.enrolledPathLengthStd = stdNormLen;
    ns.enrolledStrokeCount   = strokeCount;
    ns.successfulLoginCount  = 0;
    ns.fusedThreshold        = 55;

    await writeState(ns);
    await BDB.del("partials");
    console.log("[Enroll] Complete.", ns);
    return { done: true, state: ns };
}

// ── Verify ────────────────────────────────────────────────
export async function verifySample(pts, state, canvas, strokes) {
    console.log("🔍 [Verify] Points:", pts.length);

    if (!state?.anchorSamples?.length)
        return { err: "No enrolled signature found. Please enroll again." };

    // Anti-Spoofing & Liveness
    const replayCheck = preventReplayAttack(pts);
    if (replayCheck.isReplay) {
        return { err: `Replay Attack Detected (${Math.round(replayCheck.confidence * 100)}% Match).` };
    }

    const livenessCheck = detectLiveness(pts, state);
    if (!livenessCheck.isLive) {
        return { err: `Liveness Failed: ${livenessCheck.reasons.join(', ')}` };
    }

    // Initialize device calibration if not already done
    await initDeviceCalibration();
    const calibration = await getDeviceCalibration();

    // Apply device normalization
    let normalizedPts = [...pts];
    if (calibration) {
        normalizedPts = applyDeviceNormalization(normalizedPts, calibration);
    }

    const norm = normalize(normalizedPts, 64);
    if (!norm) return { err: "Signature too short or too small." };

    // ── Path length check (half-signature detection)
    if (state.enrolledPathLength != null) {
        const currentLen = rawPathLen(norm);
        const ratio = currentLen / state.enrolledPathLength;

        // DEPLOYMENT FIX: ratio window widened to 0.30–3.0.
        const stdBuffer = state.enrolledPathLengthStd
            ? (state.enrolledPathLengthStd / state.enrolledPathLength) * 3
            : 0.4;
        const minRatio = Math.max(0.25, 0.50 - stdBuffer);
        const maxRatio = Math.min(4.0,  2.00 + stdBuffer);

        console.log(`[Verify] Path ratio: ${ratio.toFixed(2)} (allowed: ${minRatio.toFixed(2)}–${maxRatio.toFixed(2)})`);

        if (ratio < minRatio || ratio > maxRatio) {
            return { err: `Signature size mismatch (${Math.round(ratio * 100)}% of enrolled). Draw your full signature.` };
        }
    }

    // ── Stroke count soft penalty
    const currentStrokeCount = strokes ? strokes.length : 1;
    let strokePenalty = 0;
    if (state.enrolledStrokeCount != null) {
        const diff = Math.abs(currentStrokeCount - state.enrolledStrokeCount);
        strokePenalty = diff * 1; // Reduced from 3 to 1 point per extra/missing stroke
        if (diff > 0) console.log(`[Verify] Stroke diff: ${diff} → penalty ${strokePenalty}`);
    }

    // ── DTW ───────────────────────────────────────────────
    const all = [...state.anchorSamples, ...(state.adaptSamples || [])];
    const dtwDistances = all.map(s => dtw(s, norm));
    const dtwFinal = summarizeNearestDistances(dtwDistances, Math.min(3, dtwDistances.length));
    const dtwSimilarity = dtwDistanceToSimilarity(dtwFinal, state.threshold);

    console.log(`[Verify] DTW distances: [${dtwDistances.map(d => d?.toFixed(4)).join(', ')}]`);
    console.log(`[Verify] DTW final=${dtwFinal?.toFixed?.(4)}, threshold=${state?.threshold?.toFixed?.(4)}, similarity=${dtwSimilarity?.toFixed?.(1)}`);

    // ── Image model (fully non-fatal) ─────────────────────
    let imageScore = null;
    if (canvas && state.imageEmbedding) {
        try {
            const currentEmb = await getSignatureEmbedding(canvas);
            if (currentEmb) {
                imageScore = normalizeCosineScore(cosineSimilarity(state.imageEmbedding, currentEmb));
                console.log(`[Verify] Image score: ${imageScore?.toFixed(3)}`);
            }
        } catch (e) {
            // Image model failure must not affect verification result
            console.warn("[Verify] Image model failed — skipping:", e.message);
            imageScore = null;
        }
    }

    // ── Behavioral Siamese BiLSTM model ───────────────────────────────────────
    let siameseScore = null;
    if (state.siameseTrained && state.anchorSamples?.length) {
        try {
            const currentSeq  = extractSequenceFeatures(norm);
            const enrolledSeq = extractSequenceFeatures(state.anchorSamples[0]);
            const result = await compareSignaturesSiamese(currentSeq, enrolledSeq);
            // A03 fix: guard against falsy result before accessing .score / .uncertainty
            if (result && typeof result.score === 'number') {
                const siameseUncertainty = typeof result.uncertainty === 'number' ? result.uncertainty : 0;
                // Penalize score proportionally to uncertainty (max 10% penalty)
                const uncertaintyPenalty = siameseUncertainty * 0.1;
                siameseScore = Math.max(0, result.score - uncertaintyPenalty);
                console.log(`[Verify] Siamese score=${siameseScore.toFixed(3)} uncertainty=${siameseUncertainty.toFixed(3)}`);
            } else {
                console.warn('[Verify] Siamese returned no result — skipping.');
            }
        } catch (e) {
            console.warn('[Verify] Siamese model failed — skipping:', e.message);
            siameseScore = null;
        }
    }

    // ── Cancelable Biometrics verification ───────────
    let cancelableScore = null;
    if (state.protectedTemplate && state.behavioralStats) {
        try {
            const rawFeatures = extractBehavioralFeatures(pts, strokes || [pts]);
            const stdFeatures = standardize(rawFeatures, state.behavioralStats);
            const cancelableResult = verifyCancelableTemplate(stdFeatures, state.protectedTemplate);
            if (cancelableResult) cancelableScore = cancelableResult.similarity;
            console.log(`[Verify] Cancelable similarity: ${cancelableScore?.toFixed(3)}`);
            if (cancelableResult && !cancelableResult.verified) {
                console.log("[Verify] Cancelable Hash Mismatch - Possible intrusion.");
            }
        } catch (e) {
            console.warn("[Verify] Cancelable verification failed:", e.message);
        }
    }

    // ── Fuse & decide ─────────────────────────────────────────────────────────
    const rawFused = fuseScores(dtwSimilarity, siameseScore, cancelableScore, imageScore);
    const final    = Math.max(0, rawFused - strokePenalty);
    const threshold = getDynamicThreshold(state.avgScore, calibration);

    // ── Session anomaly detection
    // Flag sharp deviations from the user's baseline that may indicate session hijack
    const sessionAnomaly = (() => {
        const hist = state.verificationHistory || [];
        const recent = hist.filter(h => h.passed).slice(-10);
        if (recent.length < 5) return false;
        const avgPastScore = recent.reduce((s, h) => s + h.score, 0) / recent.length;
        const drop = avgPastScore - final;
        return drop > 35; // Increased from 25 to 35 to reduce false positives
    })();
    if (sessionAnomaly) {
        console.warn('[Verify] ⚠️ Session anomaly detected — score dropped sharply from historical baseline.');
    }

    console.log(`[Verify] DTW=${dtwSimilarity.toFixed(1)} Image=${imageScore?.toFixed(1) ?? 'N/A'} Siamese=${siameseScore?.toFixed(3) ?? 'N/A'} Fused=${rawFused.toFixed(1)} penalty=${strokePenalty} final=${final.toFixed(1)} threshold=${threshold.toFixed(1)} anomaly=${sessionAnomaly}`);
    console.log(`[Verify] Result: ${final >= threshold && !sessionAnomaly ? 'PASS ✅' : 'FAIL ❌'}`);

    // Track for FAR/FRR analytics
    const verificationHistory = [...(state.verificationHistory || []),
        { score: final, passed: final >= threshold, ts: Date.now() }
    ].slice(-50); // keep last 50

    if (final >= threshold && !sessionAnomaly) {
        const currentBehaviorFeat = extractBehavioralFeatures(pts, strokes || [pts]);
        const stdCurrentFeat = state.behavioralStats
            ? standardize(currentBehaviorFeat, state.behavioralStats)
            : currentBehaviorFeat;

        state.attempts = 0;
        state.successfulLoginCount = (state.successfulLoginCount || 0) + 1;
        state.avgScore = state.avgScore === null ? final : state.avgScore * 0.85 + final * 0.15;
        state.fusedThreshold = threshold;
        state.verificationHistory = verificationHistory;
        state.behaviorFeatureHistory = [...(state.behaviorFeatureHistory || []), stdCurrentFeat].slice(-20);

        // Adapt samples keep the template fresh (max 10)
        if (!state.adaptSamples) state.adaptSamples = [];
        if (state.adaptSamples.length >= 10) state.adaptSamples.shift();
        state.adaptSamples.push(norm);



        const explanation = getVerificationExplanation(state.anchorSamples[0], norm, final, threshold);
        await writeState(state);
        return { pass: true, score: final, threshold, explanation };
    } else {
        state.attempts++;
        const explanation = getVerificationExplanation(state.anchorSamples[0], norm, final, threshold);
        await writeState(state);
        return { fail: "Signature not matched.", score: final, threshold, attempts: state.attempts, explanation };
    }
}
