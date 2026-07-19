/* =========================================================
   forgery_collection.js — Real Forgery Collection System
   Supports random, skilled, traced, and pressure-copy forgery types
   ========================================================= */

import { BDB } from './biometrics';

/** Local minimal normalize — resample to n points in [0,1] bounding box */
function normalize(pts, n = 64) {
    if (!pts || pts.length < 2) return null;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const sz = Math.max(maxX - minX, maxY - minY) || 1;
    if (sz < 5) return null;
    // Simple uniform resample
    const scaled = pts.map(p => ({ ...p, x: (p.x - minX) / sz, y: (p.y - minY) / sz }));
    const step = Math.floor(scaled.length / n);
    return step < 1 ? scaled.slice(0, n) : scaled.filter((_, i) => i % step === 0).slice(0, n);
}

const FORGERY_DB_KEY = 'forgery_registry';
// A09 fix: was hardcoded magic number 20 inside validateForgeryData
const MIN_FORGERY_POINTS = 20;

/**
 * Initialize forgery registry
 */
export async function initForgeryRegistry() {
    const registry = await BDB.get(FORGERY_DB_KEY, null);
    if (!registry) {
        await BDB.set(FORGERY_DB_KEY, {
            forgeries: [],
            createdAt: Date.now()
        });
    }
}

/**
 * Get all forgeries
 */
export async function getAllForgeries() {
    await initForgeryRegistry();
    const registry = await BDB.get(FORGERY_DB_KEY);
    return registry.forgeries || [];
}

/**
 * Get forgeries for a specific target user
 */
export async function getForgeriesForTarget(targetUserId) {
    const allForgeries = await getAllForgeries();
    return allForgeries.filter(f => f.targetUserId === targetUserId);
}

/**
 * Get forgeries by type
 */
export async function getForgeriesByType(forgeryType) {
    const allForgeries = await getAllForgeries();
    return allForgeries.filter(f => f.forgeryType === forgeryType);
}

/**
 * Record a forgery attempt
 */
export async function recordForgery(forgeryData) {
    await initForgeryRegistry();
    const registry = await BDB.get(FORGERY_DB_KEY);
    
    const forgery = {
        id: `forgery_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        timestamp: Date.now(),
        targetUserId: forgeryData.targetUserId,
        forgerId: forgeryData.forgerId || 'unknown',
        forgerMetadata: forgeryData.forgerMetadata || {},
        forgeryType: forgeryData.forgeryType, // 'random', 'skilled', 'traced', 'pressure_copy'
        rawPoints: forgeryData.rawPoints,
        normalizedPoints: forgeryData.normalizedPoints || normalize(forgeryData.rawPoints, 64),
        canvas: forgeryData.canvas, // Image data
        strokes: forgeryData.strokes,
        attempts: forgeryData.attempts || 1,
        practiceTime: forgeryData.practiceTime || 0, // For skilled forgeries
        visibility: forgeryData.visibility || 'none', // 'none', 'brief', 'full' - how much they saw the original
        device: forgeryData.device || await getDeviceInfo(),
        notes: forgeryData.notes || ''
    };
    
    registry.forgeries.push(forgery);
    await BDB.set(FORGERY_DB_KEY, registry);
    
    return forgery;
}

/**
 * Delete a forgery
 */
export async function deleteForgery(forgeryId) {
    await initForgeryRegistry();
    const registry = await BDB.get(FORGERY_DB_KEY);
    
    registry.forgeries = registry.forgeries.filter(f => f.id !== forgeryId);
    await BDB.set(FORGERY_DB_KEY, registry);
}

/**
 * Get forgery statistics
 */
export async function getForgeryStatistics() {
    const allForgeries = await getAllForgeries();
    
    const stats = {
        totalForgeries: allForgeries.length,
        byType: {
            random: 0,
            skilled: 0,
            traced: 0,
            pressure_copy: 0
        },
        byTarget: {},
        byForger: {},
        avgAttemptsPerForgery: 0,
        totalPracticeTime: 0
    };
    
    if (allForgeries.length > 0) {
        stats.avgAttemptsPerForgery = allForgeries.reduce((sum, f) => sum + (f.attempts || 1), 0) / allForgeries.length;
        stats.totalPracticeTime = allForgeries.reduce((sum, f) => sum + (f.practiceTime || 0), 0);
    }
    
    allForgeries.forEach(forgery => {
        // Count by type
        if (stats.byType[forgery.forgeryType] !== undefined) {
            stats.byType[forgery.forgeryType]++;
        }
        
        // Count by target user
        const target = forgery.targetUserId;
        stats.byTarget[target] = (stats.byTarget[target] || 0) + 1;
        
        // Count by forger
        const forger = forgery.forgerId;
        stats.byForger[forger] = (stats.byForger[forger] || 0) + 1;
    });
    
    return stats;
}

/**
 * Export forgery data for research
 */
export async function exportForgeryData() {
    const allForgeries = await getAllForgeries();
    
    return {
        exportDate: Date.now(),
        totalForgeries: allForgeries.length,
        forgeries: allForgeries
    };
}

/**
 * Import forgery data
 */
export async function importForgeryData(importData) {
    await initForgeryRegistry();
    const registry = await BDB.get(FORGERY_DB_KEY);
    
    // Merge imported forgeries
    registry.forgeries = [...registry.forgeries, ...importData.forgeries];
    await BDB.set(FORGERY_DB_KEY, registry);
}

/**
 * Get device information
 */
async function getDeviceInfo() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency,
        touchSupport: 'ontouchstart' in window,
        screen: {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth
        }
    };
}

/**
 * Forgery type definitions and instructions
 */
export const FORGERY_TYPES = {
    random: {
        name: 'Random Forgery',
        description: 'Forger attempts to forge without seeing the original signature',
        instructions: [
            'Do NOT look at the genuine signature',
            'Try to guess what the signature might look like',
            'Sign naturally as you would your own name',
            'No practice attempts allowed'
        ],
        visibility: 'none',
        allowPractice: false
    },
    skilled: {
        name: 'Skilled Forgery',
        description: 'Forger practices and attempts to imitate the signature',
        instructions: [
            'Study the genuine signature carefully',
            'Practice signing it multiple times',
            'Try to match the shape, rhythm, and flow',
            'Record your practice time'
        ],
        visibility: 'full',
        allowPractice: true
    },
    traced: {
        name: 'Traced Forgery',
        description: 'Forger traces directly over the original signature',
        instructions: [
            'Display the genuine signature on screen',
            'Place a transparent surface or use tracing mode',
            'Trace directly over the signature lines',
            'Try to follow the exact path'
        ],
        visibility: 'full',
        allowPractice: false
    },
    pressure_copy: {
        name: 'Pressure-Copy Forgery',
        description: 'Forger attempts to copy the pressure patterns of the signature',
        instructions: [
            'Study the genuine signature',
            'Pay attention to where pressure increases/decreases',
            'Try to match the pressure dynamics',
            'Focus on the "feel" of the signature'
        ],
        visibility: 'full',
        allowPractice: true
    }
};

/**
 * Get forgery collection protocol for a study
 */
export function getForgeryCollectionProtocol(targetUserId, forgerId) {
    return {
        targetUserId,
        forgerId,
        startTime: Date.now(),
        protocol: [
            {
                type: 'random',
                count: 5,
                order: 1
            },
            {
                type: 'skilled',
                count: 5,
                order: 2,
                practiceTimeMin: 5, // minutes
                practiceTimeMax: 10
            },
            {
                type: 'traced',
                count: 3,
                order: 3
            },
            {
                type: 'pressure_copy',
                count: 5,
                order: 4,
                practiceTimeMin: 3,
                practiceTimeMax: 5
            }
        ]
    };
}

/**
 * Validate forgery data before recording
 */
export function validateForgeryData(forgeryData) {
    const errors = [];
    
    if (!forgeryData.targetUserId) {
        errors.push('Target user ID is required');
    }
    
    if (!forgeryData.forgeryType) {
        errors.push('Forgery type is required');
    }
    
    if (!forgeryData.rawPoints || forgeryData.rawPoints.length < MIN_FORGERY_POINTS) {
        errors.push(`Signature must have at least ${MIN_FORGERY_POINTS} points`);
    }
    
    if (!['random', 'skilled', 'traced', 'pressure_copy'].includes(forgeryData.forgeryType)) {
        errors.push('Invalid forgery type');
    }
    
    if (forgeryData.forgeryType === 'skilled' && (!forgeryData.practiceTime || forgeryData.practiceTime < 0)) {
        errors.push('Skilled forgery requires practice time');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}
