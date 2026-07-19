# AUDIT LEDGER — Signature Authentication System
**Repo:** `/Users/pandu/Desktop/signature_new`
**Auditor:** Antigravity Engineering Audit
**Date:** 2026-07-19
**ESLint (post-fix):** ✅ Zero warnings/errors
**Unit Tests (post-fix):** ✅ 26/26 pass

> Re-read before starting each new phase.

---

## Legend
`found` → identified, not yet fixed  
`fixed` → code changed  
`verified` → fix confirmed (build/test passes)  
`wontfix` → intentional design with documented reason

---

## Issues

| ID | File : Line | Category | Description | Status |
|----|-------------|----------|-------------|--------|
| **A01** | `liveness_detection.js:221–234` | **Logic Bug** | `cosineSimilarity()` was called on a **nested 2D array** returned by `extractBasicFeatures`. `a[i]*b[i]` where `b[i]` is itself an array always produces 0, so historical-behavior deviation checks never fired. Fixed by calling `.flat()` before comparison. | **verified** |
| **A02** | `liveness_detection.js:402–415` | **Logic Bug / Minor** | `compareSignatures` uses prefix char overlap of a 32-bit hash's base-36 string — fragile metric, but only reachable in the `> 0.95` replay branch which effectively requires exact hash equality anyway. Latent risk, not a live bug path. | wontfix — latent only |
| **A03** | `biometrics.js:485–501` | **Undefined Ref / Throw** | `siameseUncertainty` declared without value; `result.score/.uncertainty` accessed before null-checking `result`. If `compareSignaturesSiamese` resolved to null, both would throw TypeError. Fixed with explicit null-check and scoped `const`. | **verified** |
| **A04** | `score_fusion.js` | **Design** | DTW similarity round-trips ×100 then ÷100 — not a bug, just confusing. Documented. | wontfix — correct |
| **A05** | `temporal_entropy.js:301–304` | **Divide-by-zero** | `calculateVariance()` divided by `values.length` without guarding against an empty array, producing NaN. | **verified** |
| **A06** | `rhythm_analysis.js:304–308` | **Divide-by-zero** | Same `calculateVariance` zero-length bug as A05. | **verified** |
| **A07** | `explainable_verification.js:29–34` | **Off-by-one / NaN** | `velocities[velocities.length - 2]` was `undefined` when `i===1` (array had one element → index -1). `velocity - undefined = NaN` propagated into accelerations. Fixed by guarding `if (velocities.length >= 2)`. | **verified** |
| **A08** | `mobile_hardware.js:929–936` | **API Misuse** | `await this.accelerometer.stop()` — Generic Sensor API `stop()` is **synchronous**. Spurious `await` misled readers. Method converted from `async` to synchronous. | **verified** |
| **A09** | `forgery_collection.js:294` | **Magic Number** | Minimum point count `20` was a bare literal in `validateForgeryData`. Extracted to named constant `MIN_FORGERY_POINTS`. | **verified** |
| **A10** | `biometrics.js:375` | **Dead Assignment** | `ns.template = partials[…]` was never read — verification only uses `state.anchorSamples`. Assignment set to `null` with explanatory comment (key kept for DB compat). | **verified** |
| **A11** | `score_fusion.js:10–13` | **Misleading Constants** | Weight constants summed to 1.10 not 1.0, misleadingly implying normalization. Adjusted to `0.41+0.36+0.14+0.09=1.00` preserving ratios; added doc comment explaining `weightedAverage()` renormalises at runtime regardless. | **verified** |
| **A12** | `user_manager.js:206` | False alarm | `BDB.del()` is properly exported. | wontfix — no issue |
| **A13** | `siamese_network.js` | Design | `tf.serialization.registerClass` at module load — acceptable since TF.js always loads first. | wontfix — by design |
| **A14** | `behavioral_model.js` | Docs | No type docs on `extractBehavioralFeatures` return dimensionality. | wontfix — docs only |
| **A15** | `device_calibration.js` | False alarm | `calibration.profile` null-check present in caller. | wontfix — no issue |
| **A16** | `liveness_detection.js:37` | Threshold | CoV < 0.3 may be tight for short touch sigs — by design / tunable. | wontfix — by design |
| **A17** | `biometrics.js:327` | **Potential Crash** | `behaviorFeatures[0].length` on potentially empty array throws TypeError. Fixed with early-return + user-facing error message. | **verified** |

---

## Phase Summary

### Phase 1 — Static Audit
- ESLint: **0 errors, 0 warnings** ✅
- Unit Tests: **26/26 pass** ✅
- Actionable bugs: **10 found**

### Phase 2 — Fix Loop
All 10 actionable issues fixed. Zero regressions introduced.

| Metric | Before | After |
|--------|--------|-------|
| ESLint errors | 0 | 0 |
| Unit tests passing | 26/26 | 26/26 |
| Undefined-ref crashes (potential) | 2 (A03, A17) | 0 |
| NaN propagation paths | 3 (A05, A06, A07) | 0 |
| Logic bugs (wrong-type input) | 1 (A01) | 0 |
| API misuse | 1 (A08) | 0 |
| Magic numbers | 1 (A09) | 0 |
| Dead assignments | 1 (A10) | 0 |
| Misleading constants | 1 (A11) | 0 |

### Phase 3 — Re-Audit (Clean Pass)
- `npx eslint .` → **0 warnings, 0 errors**
- `npx jest tests/unit.test.js` → **26/26 PASS**
- No new findings introduced by any fix

---

## Limitations of This Audit
- **No runtime testing** — browser code (IndexedDB, Web Crypto, Canvas, Generic Sensor API) cannot be exercised in the Node test environment.
- **No model accuracy evaluation** — DTW thresholds, Siamese model weights, FAR/FRR on real user data are out of scope.
- **No security penetration testing** — AES-GCM client-side encryption is best-effort obfuscation only (documented in biometrics.js:49–83); server-side key store is the correct long-term fix.
- **No accessibility audit** — `SignatureCanvas.jsx` and `App.jsx` use raw DOM event handlers without ARIA roles.


> Update this file after every phase. Re-read before starting each new phase.

---

## Legend
`found` → identified, not yet fixed  
`fixed` → code changed  
`verified` → fix confirmed (build/test passes)  
`wontfix` → intentional design with documented reason

---

## Issues

| ID | File : Line | Category | Description | Status |
|----|-------------|----------|-------------|--------|
| A01 | `liveness_detection.js:477-481` | **Logic Bug** | `cosineSimilarity()` at module-scope calls `a.reduce(…)` on a **nested array** (`extractBasicFeatures` returns `Array<Array<number>>`, not `Array<number>`). The inner `b[i]` would be undefined → always returns 0 for the `detectBehavioralAnomaly` check at line 227. | found |
| A02 | `liveness_detection.js:402-415` | **Logic Bug** | `compareSignatures(hash1, hash2)` measures prefix character overlap of the *string* representation of a 32-bit integer hash. Hash collisions or sign changes make this unreliable. E.g., two very different signatures could produce hashes with similar leading characters. Function is never called from outside the module; replay detection works via the exact-match branch only (similarity > 0.95 of this flawed metric), which over-relies on exact hash equality. | found |
| A03 | `biometrics.js:484` | **Undefined Ref** | `siameseUncertainty` is declared with `let siameseUncertainty;` but then referenced on line 496 before being assigned if `compareSignaturesSiamese` does not return a truthy `result`. If `result` is falsy (null/undefined), `siameseUncertainty` is `undefined` and `result.score` throws. However, the `await` result is directly destructured without null-check. `result.score` / `result.uncertainty` would throw if the function resolves to null. | found |
| A04 | `score_fusion.js:63-69` | **Logic / Precision** | `weightedAverage()` normalises active weights on the fly, which is correct. However `fuseScores()` then multiplies the 0–1 result by 100 (line 126), while `dtwDistanceToSimilarity` already returns 0–100 (line 55). The DTW score is then divided by 100 again at line 106 before entering `weightedAverage`. This round-trip is correct but adds needless numeric instability. Not a bug, but a confusing design worth documenting. | wontfix — correct, just confusing |
| A05 | `temporal_entropy.js:303-304` | **Missing Guard** | `calculateVariance(values, mean)` divides by `values.length` unconditionally. If `values` is empty, this produces `NaN`. Callers guard with `if (!points \|\| points.length < 2)` but partial paths through `profileSigningCadence` can produce an empty `strokeCadences` array when all strokes have length < 2. | found |
| A06 | `rhythm_analysis.js:307-308` | **Missing Guard** | Identical to A05: `calculateVariance` divides by `values.length` without zero-length guard. Empty arrays can occur if all strokes have length < 2. | found |
| A07 | `explainable_verification.js:31` | **Off-by-one / Minor** | `velocities[velocities.length - 2]` at line 31 references the second-to-last element of `velocities` inside the same loop that is still populating it. When `i === 1`, `velocities` has one element; `velocities.length - 2 === -1`, returning `undefined`. `velocity - undefined = NaN` propagates into `accelerations`. | found |
| A08 | `mobile_hardware.js:929-936` | **API Misuse** | `this.accelerometer.stop()` / `this.gyroscope.stop()` are awaited but the Generic Sensor API `stop()` is **synchronous** (returns `undefined`, not a Promise). This silently swallows errors and misleads maintainers about async behaviour. | found |
| A09 | `forgery_collection.js:294` | **Hardcoded Magic Number** | Minimum point count `20` is hardcoded in `validateForgeryData`. Should be a named constant. | found |
| A10 | `biometrics.js:375` | **Logic / Comment Mismatch** | Comment says `// We still keep a single anchor for DTW` but `ns.anchorSamples = [...partials]` stores all samples. The single-anchor line (`ns.template = partials[Math.floor(partials.length / 2)]`) stores the *median* sample in `ns.template`, which is never read in `verifySample` (verification uses `state.anchorSamples`). Dead assignment to `ns.template`. | found |
| A11 | `score_fusion.js:10-13` | **Weights Don't Sum to 1** | `BASE_DTW_WEIGHT (0.45) + BASE_SIAMESE_WEIGHT (0.40) + BASE_BEHAVIOR_WEIGHT (0.15) + BASE_IMAGE_WEIGHT (0.10) = 1.10`. Weights exceed 1.0. Since `weightedAverage` renormalizes at runtime, this doesn't cause an arithmetic error — but the constants are misleading and could confuse future maintainers who assume the weights are normalised. | found |
| A12 | `user_manager.js:206` | **Missing method** | `BDB.del(userKey)` is called but `BDB` (imported from `biometrics`) does export `del`. Verified exported. ✅ — not a bug. | wontfix — no issue |
| A13 | `siamese_network.js` (L2NormLayer) | **Dead Class Registration** | `tf.serialization.registerClass(L2NormLayer)` is called at module load. If TF.js is not available at parse time this would throw, but in practice TF.js is always imported before this file. Acceptable. | wontfix — by design |
| A14 | `behavioral_model.js` | **No Export of `extractBehavioralFeatures` type docs** | The function is the integration point between `biometrics.js` and `cancelable_biometrics.js`. Its return value dimensionality must match `cancelable_biometrics` expectations. Not a bug but a maintainability concern. | wontfix — docs issue only |
| A15 | `device_calibration.js` | **Missing null guard on `calibration.profile`** | `getDynamicThreshold` checks `calibration && calibration.profile` correctly. ✅ No bug. | wontfix — no issue |
| A16 | `liveness_detection.js:37` | **Threshold too aggressive** | `checkVelocityVariation` returns CoV. Threshold `< 0.3` triggers a liveness penalty. On touch devices with 60 Hz sampling and short signatures, CoV can legitimately be below 0.3. However this is by design (configurable threshold question, not a code bug). | wontfix — by design |
| A17 | `biometrics.js:327` | **Potential undefined index** | `behaviorFeatures[0].length` — if `behaviorFeatures` is an empty array (BDB returned []), `.length` throws. Guards needed. | found |

---

## Phase Summary

### Phase 1 — Static Audit
- ESLint: **0 errors, 0 warnings** ✅
- Unit Tests: **26/26 pass** ✅
- Actionable bugs found: **A01, A03, A05, A06, A07, A08, A09, A10, A11, A17**

### Fixes to Apply (Phase 2)
Priority order:
1. **A03** — undefined-before-use / potential throw (`biometrics.js`)
2. **A17** — index on potentially empty array (`biometrics.js`)
3. **A01** — cosine similarity called on wrong type (`liveness_detection.js`)
4. **A07** — off-by-one, NaN propagation (`explainable_verification.js`)
5. **A05, A06** — divide-by-zero in `calculateVariance` (`temporal_entropy.js`, `rhythm_analysis.js`)
6. **A08** — misleading `await` on sync method (`mobile_hardware.js`)
7. **A09** — magic number → named constant (`forgery_collection.js`)
8. **A10** — dead `ns.template` assignment (`biometrics.js`)
9. **A11** — weight constants that don't sum to 1 (`score_fusion.js`)
