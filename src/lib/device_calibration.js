/* =========================================================
   device_calibration.js — Cross-Device Calibration System
   Handles device profiling, sampling normalization, and hardware adaptation
   ========================================================= */

import { BDB } from './biometrics';

const DEVICE_CALIBRATION_KEY = 'device_calibration';

/**
 * Get comprehensive device profile
 */
export function getDeviceProfile() {
    const profile = {
        // Basic hardware info
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || 2,
        deviceMemory: navigator.deviceMemory || 4,
        
        // Touch capabilities
        touchSupport: 'ontouchstart' in window,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        
        // Screen info
        screen: {
            width: screen.width,
            height: screen.height,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
            colorDepth: screen.colorDepth,
            pixelRatio: window.devicePixelRatio || 1
        },
        
        // Pointer capabilities
        pointerType: getPointerType(),
        
        // Estimated touch sampling rate (Hz)
        estimatedSamplingRate: estimateSamplingRate(),
        
        // Pressure sensitivity
        pressureSupport: checkPressureSupport(),
        
        // Canvas rendering info
        canvasInfo: getCanvasCapabilities()
    };
    
    return profile;
}

/**
 * Get pointer type (mouse, pen, touch)
 */
function getPointerType() {
    if (window.matchMedia('(pointer: fine)').matches) {
        return 'fine'; // mouse or pen
    } else if (window.matchMedia('(pointer: coarse)').matches) {
        return 'coarse'; // touch
    }
    return 'unknown';
}

/**
 * Estimate touch sampling rate based on device characteristics
 */
function estimateSamplingRate() {
    // Different devices have different touch sampling rates:
    // - High-end phones/tablets: 120-240Hz
    // - Mid-range phones: 60-90Hz
    // - Low-end phones: 30-60Hz
    // - Desktop mouse: 1000Hz+ (but browser caps at ~60-120Hz)
    
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
    const isHighEnd = navigator.hardwareConcurrency >= 8 || navigator.deviceMemory >= 8;
    const isLowEnd = navigator.hardwareConcurrency <= 2 || navigator.deviceMemory <= 2;
    
    if (!isMobile) {
        return 120; // Desktop mouse typically high rate
    }
    
    if (isHighEnd) {
        return 120; // High-end mobile
    } else if (isLowEnd) {
        return 50; // Low-end mobile
    }
    
    return 60; // Mid-range mobile
}

/**
 * Check pressure support
 */
function checkPressureSupport() {
    // Check if pointer events support pressure
    const testCanvas = document.createElement('canvas');
    const ctx = testCanvas.getContext('2d');
    
    // Try to detect pressure support
    let hasPressure = false;
    let pressureRange = { min: 0, max: 1 };
    
    // Most modern browsers support pressure via PointerEvent
    if (window.PointerEvent) {
        hasPressure = true;
        // Pressure typically ranges from 0 to 1, but some devices may differ
        pressureRange = { min: 0, max: 1 };
    }
    
    return {
        supported: hasPressure,
        range: pressureRange,
        normalized: true // Most browsers normalize to 0-1
    };
}

/**
 * Get canvas rendering capabilities
 */
function getCanvasCapabilities() {
    const testCanvas = document.createElement('canvas');
    const ctx = testCanvas.getContext('2d');
    
    return {
        contextType: ctx ? '2d' : 'none',
        hardwareAcceleration: !!ctx,
        maxCanvasSize: getMaxCanvasSize()
    };
}

/**
 * Get maximum canvas size
 */
function getMaxCanvasSize() {
    // Most browsers limit canvas size to 4096x4096 or similar
    const testCanvas = document.createElement('canvas');
    try {
        testCanvas.width = 10000;
        testCanvas.height = 10000;
        if (testCanvas.width === 10000 && testCanvas.height === 10000) {
            return { width: 10000, height: 10000 };
        }
    } catch (e) {
        // Canvas size limit reached
    }
    
    // Conservative default
    return { width: 4096, height: 4096 };
}

/**
 * Initialize device calibration
 */
export async function initDeviceCalibration() {
    const existing = await BDB.get(DEVICE_CALIBRATION_KEY, null);
    
    if (!existing) {
        const profile = getDeviceProfile();
        const calibration = {
            profile,
            calibrationData: {
                // Sampling rate normalization factor
                samplingNormalizationFactor: calculateSamplingNormalizationFactor(profile),
                
                // Pressure scaling factors
                pressureScaling: calculatePressureScaling(profile),
                
                // Canvas size normalization
                canvasNormalization: calculateCanvasNormalization(profile),
                
                // Timing normalization
                timingNormalization: calculateTimingNormalization(profile)
            },
            createdAt: Date.now(),
            lastCalibrated: Date.now()
        };
        
        await BDB.set(DEVICE_CALIBRATION_KEY, calibration);
        return calibration;
    }
    
    return existing;
}

/**
 * Calculate sampling normalization factor
 * Normalizes different sampling rates to a standard 60Hz baseline
 */
function calculateSamplingNormalizationFactor(profile) {
    const estimatedRate = profile.estimatedSamplingRate;
    const baselineRate = 60; // Standard baseline
    
    // Factor to multiply time deltas by to normalize to baseline
    return baselineRate / estimatedRate;
}

/**
 * Calculate pressure scaling for device
 */
function calculatePressureScaling(profile) {
    if (!profile.pressureSupport.supported) {
        return {
            enabled: false,
            min: 0.5,
            max: 0.5
        };
    }
    
    // Most devices normalize pressure to 0-1, but some may have different ranges
    // This allows for device-specific adjustments if needed
    return {
        enabled: true,
        min: profile.pressureSupport.range.min,
        max: profile.pressureSupport.range.max,
        // Scaling factor to normalize to 0-1 range
        scaleFactor: 1 / (profile.pressureSupport.range.max - profile.pressureSupport.range.min)
    };
}

/**
 * Calculate canvas normalization factors
 */
function calculateCanvasNormalization(profile) {
    const screen = profile.screen;
    
    // Normalize to a standard reference canvas size (e.g., 330x330 as used in app)
    const referenceWidth = 330;
    const referenceHeight = 330;
    
    return {
        referenceSize: { width: referenceWidth, height: referenceHeight },
        actualSize: { width: screen.width, height: screen.height },
        scaleX: referenceWidth / screen.width,
        scaleY: referenceHeight / screen.height
    };
}

/**
 * Calculate timing normalization
 */
function calculateTimingNormalization(profile) {
    // Different devices have different timing precision
    // This helps normalize time-based features
    
    return {
        // Minimum time delta to consider valid (ms)
        minDelta: profile.touchSupport ? 8 : 4, // Touch is slower than mouse
        
        // Maximum time delta to consider valid (ms)
        maxDelta: profile.touchSupport ? 100 : 50,
        
        // Expected average time delta (ms)
        expectedDelta: 1000 / profile.estimatedSamplingRate
    };
}

/**
 * Get current device calibration
 */
export async function getDeviceCalibration() {
    return await BDB.get(DEVICE_CALIBRATION_KEY, null);
}

/**
 * Normalize sampling rate for points
 */
export function normalizeSamplingRate(points, calibration) {
    if (!calibration || !calibration.calibrationData) {
        return points;
    }
    
    const { samplingNormalizationFactor, timingNormalization } = calibration.calibrationData;
    
    return points.map((point, index) => {
        if (index === 0) return point;
        
        const prevPoint = points[index - 1];
        const rawDelta = point.t - prevPoint.t;
        
        // Apply sampling normalization
        const normalizedDelta = rawDelta * samplingNormalizationFactor;
        
        // Clamp to valid range
        const clampedDelta = Math.max(
            timingNormalization.minDelta,
            Math.min(timingNormalization.maxDelta, normalizedDelta)
        );
        
        // Return new point with normalized time
        return {
            ...point,
            t: prevPoint.t + clampedDelta
        };
    });
}

/**
 * Normalize pressure values
 */
export function normalizePressure(points, calibration) {
    if (!calibration || !calibration.calibrationData) {
        return points;
    }
    
    const { pressureScaling } = calibration.calibrationData;
    
    if (!pressureScaling.enabled) {
        // If pressure not supported, set default
        return points.map(point => ({
            ...point,
            p: 0.5
        }));
    }
    
    return points.map(point => {
        const rawPressure = point.p || 0.5;
        
        // Normalize to 0-1 range
        let normalized = (rawPressure - pressureScaling.min) * pressureScaling.scaleFactor;
        
        // Clamp to valid range
        normalized = Math.max(0, Math.min(1, normalized));
        
        return {
            ...point,
            p: normalized
        };
    });
}

/**
 * Normalize canvas coordinates
 */
export function normalizeCanvasCoordinates(points, calibration) {
    if (!calibration || !calibration.calibrationData) {
        return points;
    }
    
    const { canvasNormalization } = calibration.calibrationData;
    
    return points.map(point => ({
        ...point,
        x: point.x * canvasNormalization.scaleX,
        y: point.y * canvasNormalization.scaleY
    }));
}

/**
 * Apply full device normalization pipeline
 */
export function applyDeviceNormalization(points, calibration) {
    let normalized = [...points];
    
    // Apply sampling rate normalization
    normalized = normalizeSamplingRate(normalized, calibration);
    
    // Apply pressure normalization
    normalized = normalizePressure(normalized, calibration);
    
    // Apply canvas coordinate normalization
    normalized = normalizeCanvasCoordinates(normalized, calibration);
    
    return normalized;
}

/**
 * Compare device profiles for compatibility
 */
export function compareDeviceProfiles(profile1, profile2) {
    const differences = {
        samplingRateDiff: Math.abs(profile1.estimatedSamplingRate - profile2.estimatedSamplingRate),
        pressureSupportDiff: profile1.pressureSupport.supported !== profile2.pressureSupport.supported,
        pointerTypeDiff: profile1.pointerType !== profile2.pointerType,
        screenSizeDiff: Math.abs(profile1.screen.width - profile2.screen.width) +
                         Math.abs(profile1.screen.height - profile2.screen.height),
        pixelRatioDiff: Math.abs(profile1.screen.pixelRatio - profile2.screen.pixelRatio)
    };
    
    // Calculate overall compatibility score (0-1, where 1 is identical)
    const maxSamplingDiff = 100;
    const maxScreenDiff = 2000;
    const maxPixelRatioDiff = 2;
    
    const samplingScore = 1 - Math.min(differences.samplingRateDiff / maxSamplingDiff, 1);
    const screenScore = 1 - Math.min(differences.screenSizeDiff / maxScreenDiff, 1);
    const pixelRatioScore = 1 - Math.min(differences.pixelRatioDiff / maxPixelRatioDiff, 1);
    const pressureScore = differences.pressureSupportDiff ? 0 : 1;
    const pointerScore = differences.pointerTypeDiff ? 0.5 : 1;
    
    const overallScore = (samplingScore * 0.3 + screenScore * 0.3 + 
                          pixelRatioScore * 0.2 + pressureScore * 0.1 + pointerScore * 0.1);
    
    return {
        differences,
        compatibilityScore: overallScore,
        isCompatible: overallScore > 0.7
    };
}

/**
 * Get device calibration statistics
 */
export async function getCalibrationStatistics() {
    const calibration = await getDeviceCalibration();
    
    if (!calibration) {
        return null;
    }
    
    return {
        deviceProfile: calibration.profile,
        samplingRate: calibration.profile.estimatedSamplingRate,
        pressureEnabled: calibration.calibrationData.pressureScaling.enabled,
        canvasScale: calibration.calibrationData.canvasNormalization,
        calibrationDate: new Date(calibration.createdAt).toLocaleString(),
        lastCalibrated: new Date(calibration.lastCalibrated).toLocaleString()
    };
}

/**
 * Recalibrate device (call when device characteristics may have changed)
 */
export async function recalibrateDevice() {
    const profile = getDeviceProfile();
    const calibration = await getDeviceCalibration();
    
    if (calibration) {
        calibration.profile = profile;
        calibration.calibrationData = {
            samplingNormalizationFactor: calculateSamplingNormalizationFactor(profile),
            pressureScaling: calculatePressureScaling(profile),
            canvasNormalization: calculateCanvasNormalization(profile),
            timingNormalization: calculateTimingNormalization(profile)
        };
        calibration.lastCalibrated = Date.now();
        
        await BDB.set(DEVICE_CALIBRATION_KEY, calibration);
        return calibration;
    }
    
    return await initDeviceCalibration();
}
