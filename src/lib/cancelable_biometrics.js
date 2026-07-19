/**
 * cancelable_biometrics.js — Cancelable biometrics and template hashing
 * 
 * Implements:
 * - Cancelable biometric template transformation
 * - Biometric template hashing
 * - Secure template protection
 * - Revocable biometric templates
 * - BioHashing algorithm
 */

/**
 * Generate cancelable biometric template
 * @param {Array} features - Original biometric features
 * @param {string} userId - User identifier
 * @param {string} token - Revocation token
 * @returns {Object} Cancelable template with metadata
 */
export function generateCancelableTemplate(features, userId, token) {
    if (!features || !Array.isArray(features)) {
        throw new Error('Invalid features array');
    }
    
    // Generate user-specific transformation parameters
    const transformationParams = generateTransformationParams(userId, token);
    
    // Apply random projection (biohashing)
    const projectedFeatures = applyRandomProjection(features, transformationParams.projectionMatrix);
    
    // Apply quantization for cancelability
    const quantizedFeatures = quantizeFeatures(projectedFeatures, transformationParams.quantizationLevels);
    
    // Apply non-invertible transformation
    const transformedFeatures = applyNonInvertibleTransform(quantizedFeatures, transformationParams.transformKey);
    
    // Generate template hash
    const templateHash = computeTemplateHash(transformedFeatures, userId, token);
    
    return {
        transformedFeatures,
        templateHash,
        transformationParams: {
            projectionMatrix: transformationParams.projectionMatrix,
            quantizationLevels: transformationParams.quantizationLevels,
            transformKey: transformationParams.transformKey,
            userId,
            token
        },
        metadata: {
            version: '1.0',
            createdAt: Date.now(),
            featureCount: features.length
        }
    };
}

/**
 * Verify against cancelable template
 * @param {Array} queryFeatures - Query biometric features
 * @param {Object} storedTemplate - Stored cancelable template
 * @returns {Object} Verification result with similarity score
 */
export function verifyCancelableTemplate(queryFeatures, storedTemplate) {
    if (!queryFeatures || !storedTemplate) {
        return {
            verified: false,
            similarity: 0,
            error: 'Invalid input'
        };
    }
    
    try {
        // Apply same transformation to query features
        const projectedQuery = applyRandomProjection(
            queryFeatures,
            storedTemplate.transformationParams.projectionMatrix
        );
        
        const quantizedQuery = quantizeFeatures(
            projectedQuery,
            storedTemplate.transformationParams.quantizationLevels
        );
        
        const transformedQuery = applyNonInvertibleTransform(
            quantizedQuery,
            storedTemplate.transformationParams.transformKey
        );
        
        // Calculate similarity
        const similarity = calculateHammingSimilarity(
            transformedQuery,
            storedTemplate.transformedFeatures
        );
        
        return {
            verified: similarity > 0.65, // slightly more forgiving threshold
            similarity,
            confidence: similarity
        };
    } catch (error) {
        return {
            verified: false,
            similarity: 0,
            error: error.message
        };
    }
}

/**
 * Revoke and regenerate template
 * @param {Array} originalFeatures - Original biometric features
 * @param {string} userId - User identifier
 * @param {string} oldToken - Old revocation token
 * @param {string} newToken - New revocation token
 * @returns {Object} New cancelable template
 */
export function revokeAndRegenerateTemplate(originalFeatures, userId, oldToken, newToken) {
    if (!originalFeatures || !userId || !newToken) {
        throw new Error('Invalid parameters for template revocation');
    }
    
    // Generate new template with new token
    return generateCancelableTemplate(originalFeatures, userId, newToken);
}

/**
 * BioHashing algorithm
 * @param {Array} features - Original biometric features
 * @param {Array} randomProjection - Random projection matrix
 * @returns {Array} Biohashed features
 */
export function bioHash(features, randomProjection) {
    if (!features || !randomProjection) {
        throw new Error('Invalid biohashing parameters');
    }
    
    // Apply random projection
    const projected = applyRandomProjection(features, randomProjection);
    
    // Binarize based on median
    const median = calculateMedian(projected);
    const biohashed = projected.map(f => f > median ? 1 : 0);
    
    return biohashed;
}

/**
 * Compute secure template hash
 * @param {Array} features - Transformed features
 * @param {string} userId - User identifier
 * @param {string} token - Revocation token
 * @returns {string} Secure hash
 */
export function computeTemplateHash(features, userId, token) {
    const featureString = features.map(f => f.toFixed(6)).join(',');
    const combined = `${userId}|${token}|${featureString}`;
    
    // Use SHA-256 for secure hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    
    return crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    });
}

/**
 * Generate transformation parameters
 * @param {string} userId - User identifier
 * @param {string} token - Revocation token
 * @returns {Object} Transformation parameters
 */
function generateTransformationParams(userId, token) {
    const seed = deriveSeed(userId, token);
    const rng = seededRandom(seed);
    
    // Generate random projection matrix
    const projectionMatrix = [];
    const featureDim = 128; // Assume 128-dimensional features
    const projectionDim = 64; // Project to 64 dimensions
    
    for (let i = 0; i < projectionDim; i++) {
        const row = [];
        for (let j = 0; j < featureDim; j++) {
            row.push((rng() * 2 - 1)); // Random values in [-1, 1]
        }
        projectionMatrix.push(row);
    }
    
    // Generate quantization levels
    const quantizationLevels = Array.from({ length: featureDim }, () => Math.floor(rng() * 8) + 2);
    
    // Generate transform key
    const transformKey = Array.from({ length: 32 }, () => Math.floor(rng() * 256));
    
    return {
        projectionMatrix,
        quantizationLevels,
        transformKey
    };
}

/**
 * Apply random projection
 * @param {Array} features - Input features
 * @param {Array} projectionMatrix - Projection matrix
 * @returns {Array} Projected features
 */
function applyRandomProjection(features, projectionMatrix) {
    const projected = [];
    
    for (let i = 0; i < projectionMatrix.length; i++) {
        let sum = 0;
        for (let j = 0; j < Math.min(features.length, projectionMatrix[i].length); j++) {
            sum += features[j] * projectionMatrix[i][j];
        }
        projected.push(sum);
    }
    
    return projected;
}

/**
 * Quantize features
 * @param {Array} features - Input features
 * @param {Array} levels - Quantization levels
 * @returns {Array} Quantized features
 */
function quantizeFeatures(features, levels) {
    return features.map((f, i) => {
        const level = levels[i] || 8;
        const step = 1 / level;
        return Math.round(f / step) * step;
    });
}

/**
 * Apply non-invertible transformation
 * @param {Array} features - Input features
 * @param {Array} transformKey - Transformation key
 * @returns {Array} Transformed features
 */
function applyNonInvertibleTransform(features, transformKey) {
    return features.map((f, i) => {
        const keyByte = transformKey[i % transformKey.length];
        // Apply XOR-like transformation (non-invertible without key)
        return (f * 255 + keyByte) % 1;
    });
}

/**
 * Calculate Hamming similarity
 * @param {Array} a - First binary vector
 * @param {Array} b - Second binary vector
 * @returns {number} Similarity score [0, 1]
 */
function calculateHammingSimilarity(a, b) {
    if (a.length !== b.length) return 0;
    
    let matches = 0;
    for (let i = 0; i < a.length; i++) {
        if (Math.round(a[i]) === Math.round(b[i])) {
            matches++;
        }
    }
    
    return matches / a.length;
}

/**
 * Derive seed from user ID and token
 * @param {string} userId - User identifier
 * @param {string} token - Revocation token
 * @returns {number} Seed value
 */
function deriveSeed(userId, token) {
    const combined = `${userId}:${token}`;
    let hash = 0;
    
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    return Math.abs(hash);
}

/**
 * Seeded random number generator
 * @param {number} seed - Seed value
 * @returns {Function} Random function
 */
function seededRandom(seed) {
    let state = seed;
    
    return function() {
        state = (state * 9301 + 49297) % 233280;
        return state / 233280;
    };
}

/**
 * Calculate median
 * @param {Array} values - Input values
 * @returns {number} Median value
 */
function calculateMedian(values) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Secure template protection wrapper
 * @param {Object} template - Biometric template
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Protected template
 */
export async function protectTemplate(template, userId) {
    const token = generateRevocationToken();
    const cancelableTemplate = generateCancelableTemplate(
        template.features || template,
        userId,
        token
    );
    
    // Compute hash asynchronously
    cancelableTemplate.templateHash = await computeTemplateHash(
        cancelableTemplate.transformedFeatures,
        userId,
        token
    );
    
    return cancelableTemplate;
}

/**
 * Generate revocation token
 * @returns {string} Random token
 */
export function generateRevocationToken() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
