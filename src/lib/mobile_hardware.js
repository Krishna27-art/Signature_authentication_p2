/**
 * mobile_hardware.js — Mobile hardware integration (gyroscope, accelerometer)
 * 
 * Implements:
 * - Gyroscope data capture and processing
 * - Accelerometer data capture and processing
 * - Device motion sensor fusion
 * - Hand tremor detection
 * - Device orientation tracking
 * - Motion-based liveness detection
 * - Kalman filtering for sensor noise reduction
 * - Advanced sensor filtering
 * - Fallback mode for sensor-unavailable scenarios
 */

/**
 * Check if device supports motion sensors
 */
export function supportsMotionSensors() {
    return {
        accelerometer: 'Accelerometer' in window,
        gyroscope: 'Gyroscope' in window,
        deviceMotion: 'DeviceMotionEvent' in window,
        deviceOrientation: 'DeviceOrientationEvent' in window
    };
}

/**
 * Kalman Filter for sensor noise reduction
 * Implements a 1D Kalman filter for smoothing sensor data
 */
export class KalmanFilter {
    constructor(processNoise = 0.01, measurementNoise = 0.1, estimatedError = 1) {
        this.processNoise = processNoise; // Q: Process noise variance
        this.measurementNoise = measurementNoise; // R: Measurement noise variance
        this.estimatedError = estimatedError; // P: Estimation error
        this.value = 0; // x: Current estimate
    }
    
    filter(measurement) {
        // Prediction step
        this.estimatedError += this.processNoise;
        
        // Update step
        const kalmanGain = this.estimatedError / (this.estimatedError + this.measurementNoise);
        this.value += kalmanGain * (measurement - this.value);
        this.estimatedError *= (1 - kalmanGain);
        
        return this.value;
    }
    
    reset() {
        this.value = 0;
        this.estimatedError = 1;
    }
}

/**
 * 3D Kalman Filter for vector sensor data (accelerometer, gyroscope)
 */
export class KalmanFilter3D {
    constructor(processNoise = 0.01, measurementNoise = 0.1) {
        this.x = new KalmanFilter(processNoise, measurementNoise);
        this.y = new KalmanFilter(processNoise, measurementNoise);
        this.z = new KalmanFilter(processNoise, measurementNoise);
    }
    
    filter(vector) {
        return {
            x: this.x.filter(vector.x),
            y: this.y.filter(vector.y),
            z: this.z.filter(vector.z)
        };
    }
    
    reset() {
        this.x.reset();
        this.y.reset();
        this.z.reset();
    }
}

/**
 * Moving Average Filter for sensor smoothing
 */
export class MovingAverageFilter {
    constructor(windowSize = 5) {
        this.windowSize = windowSize;
        this.buffer = [];
    }
    
    filter(value) {
        this.buffer.push(value);
        if (this.buffer.length > this.windowSize) {
            this.buffer.shift();
        }
        
        const sum = this.buffer.reduce((a, b) => a + b, 0);
        return sum / this.buffer.length;
    }
    
    reset() {
        this.buffer = [];
    }
}

/**
 * 3D Moving Average Filter
 */
export class MovingAverageFilter3D {
    constructor(windowSize = 5) {
        this.windowSize = windowSize;
        this.xBuffer = [];
        this.yBuffer = [];
        this.zBuffer = [];
    }
    
    filter(vector) {
        this.xBuffer.push(vector.x);
        this.yBuffer.push(vector.y);
        this.zBuffer.push(vector.z);
        
        if (this.xBuffer.length > this.windowSize) {
            this.xBuffer.shift();
            this.yBuffer.shift();
            this.zBuffer.shift();
        }
        
        const avg = (buffer) => buffer.reduce((a, b) => a + b, 0) / buffer.length;
        
        return {
            x: avg(this.xBuffer),
            y: avg(this.yBuffer),
            z: avg(this.zBuffer)
        };
    }
    
    reset() {
        this.xBuffer = [];
        this.yBuffer = [];
        this.zBuffer = [];
    }
}

/**
 * Median Filter for removing outliers
 */
export class MedianFilter {
    constructor(windowSize = 5) {
        this.windowSize = windowSize;
        this.buffer = [];
    }
    
    filter(value) {
        this.buffer.push(value);
        if (this.buffer.length > this.windowSize) {
            this.buffer.shift();
        }
        
        const sorted = [...this.buffer].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }
    
    reset() {
        this.buffer = [];
    }
}

/**
 * Sensor Data Quality Checker
 */
export class SensorQualityChecker {
    constructor() {
        this.history = [];
        this.maxHistory = 100;
    }
    
    checkQuality(data) {
        const quality = {
            isValid: true,
            confidence: 1.0,
            issues: []
        };
        
        // Check for NaN or Infinity
        if (isNaN(data.x) || isNaN(data.y) || isNaN(data.z) ||
            !isFinite(data.x) || !isFinite(data.y) || !isFinite(data.z)) {
            quality.isValid = false;
            quality.confidence = 0;
            quality.issues.push('Invalid values (NaN/Infinity)');
            return quality;
        }
        
        // Check for zero values (sensor not working)
        if (data.x === 0 && data.y === 0 && data.z === 0) {
            quality.isValid = false;
            quality.confidence = 0;
            quality.issues.push('All zeros - sensor may be inactive');
            return quality;
        }
        
        // Check for extreme values
        const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
        if (magnitude > 100) {
            quality.confidence *= 0.5;
            quality.issues.push('Extreme magnitude detected');
        }
        
        // Check for sudden jumps (noise)
        if (this.history.length > 0) {
            const last = this.history[this.history.length - 1];
            const jump = Math.abs(magnitude - Math.sqrt(last.x * last.x + last.y * last.y + last.z * last.z));
            if (jump > 10) {
                quality.confidence *= 0.7;
                quality.issues.push('Sudden jump detected');
            }
        }
        
        // Add to history
        this.history.push(data);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        
        return quality;
    }
    
    reset() {
        this.history = [];
    }
}

/**
 * Initialize accelerometer
 */
export async function initAccelerometer(options = {}) {
    if (!('Accelerometer' in window)) {
        return { supported: false, error: 'Accelerometer not supported' };
    }
    
    try {
        const accelerometer = new Accelerometer(options);
        await accelerometer.start();
        
        return {
            supported: true,
            sensor: accelerometer,
            reading: null
        };
    } catch (error) {
        return { supported: false, error: error.message };
    }
}

/**
 * Initialize gyroscope
 */
export async function initGyroscope(options = {}) {
    if (!('Gyroscope' in window)) {
        return { supported: false, error: 'Gyroscope not supported' };
    }
    
    try {
        const gyroscope = new Gyroscope(options);
        await gyroscope.start();
        
        return {
            supported: true,
            sensor: gyroscope,
            reading: null
        };
    } catch (error) {
        return { supported: false, error: error.message };
    }
}

/**
 * Initialize device motion listener (legacy API)
 */
export function initDeviceMotion(callback) {
    if (!('DeviceMotionEvent' in window)) {
        return { supported: false, error: 'DeviceMotionEvent not supported' };
    }
    
    window.addEventListener('devicemotion', (event) => {
        const motionData = {
            acceleration: {
                x: event.acceleration?.x || 0,
                y: event.acceleration?.y || 0,
                z: event.acceleration?.z || 0
            },
            accelerationIncludingGravity: {
                x: event.accelerationIncludingGravity?.x || 0,
                y: event.accelerationIncludingGravity?.y || 0,
                z: event.accelerationIncludingGravity?.z || 0
            },
            rotationRate: {
                alpha: event.rotationRate?.alpha || 0,
                beta: event.rotationRate?.beta || 0,
                gamma: event.rotationRate?.gamma || 0
            },
            interval: event.interval
        };
        
        if (callback) callback(motionData);
    });
    
    return { supported: true };
}

/**
 * Initialize device orientation listener
 */
export function initDeviceOrientation(callback) {
    if (!('DeviceOrientationEvent' in window)) {
        return { supported: false, error: 'DeviceOrientationEvent not supported' };
    }
    
    window.addEventListener('deviceorientation', (event) => {
        const orientationData = {
            alpha: event.alpha || 0, // Z-axis rotation [0, 360]
            beta: event.beta || 0,   // X-axis rotation [-180, 180]
            gamma: event.gamma || 0, // Y-axis rotation [-90, 90]
            absolute: event.absolute || false
        };
        
        if (callback) callback(orientationData);
    });
    
    return { supported: true };
}

/**
 * Sensor fusion for enhanced motion tracking
 */
export class SensorFusion {
    constructor() {
        this.accelerometerData = [];
        this.gyroscopeData = [];
        this.orientationData = [];
        this.fusedData = [];
        this.maxBufferSize = 100;
    }
    
    addAccelerometer(data) {
        this.accelerometerData.push({
            ...data,
            timestamp: Date.now()
        });
        
        if (this.accelerometerData.length > this.maxBufferSize) {
            this.accelerometerData.shift();
        }
        
        this.fuseData();
    }
    
    addGyroscope(data) {
        this.gyroscopeData.push({
            ...data,
            timestamp: Date.now()
        });
        
        if (this.gyroscopeData.length > this.maxBufferSize) {
            this.gyroscopeData.shift();
        }
        
        this.fuseData();
    }
    
    addOrientation(data) {
        this.orientationData.push({
            ...data,
            timestamp: Date.now()
        });
        
        if (this.orientationData.length > this.maxBufferSize) {
            this.orientationData.shift();
        }
        
        this.fuseData();
    }
    
    fuseData() {
        // Find most recent data from all sensors
        const now = Date.now();
        const timeWindow = 100; // 100ms window
        
        const recentAccel = this.accelerometerData.filter(
            d => now - d.timestamp < timeWindow
        );
        const recentGyro = this.gyroscopeData.filter(
            d => now - d.timestamp < timeWindow
        );
        const recentOrient = this.orientationData.filter(
            d => now - d.timestamp < timeWindow
        );
        
        if (recentAccel.length > 0 && recentGyro.length > 0) {
            const latestAccel = recentAccel[recentAccel.length - 1];
            const latestGyro = recentGyro[recentGyro.length - 1];
            const latestOrient = recentOrient.length > 0 ? recentOrient[recentOrient.length - 1] : null;
            
            const fused = {
                timestamp: now,
                acceleration: latestAccel,
                gyroscope: latestGyro,
                orientation: latestOrient,
                // Calculate derived metrics
                totalAcceleration: Math.sqrt(
                    latestAccel.x ** 2 + latestAccel.y ** 2 + latestAccel.z ** 2
                ),
                totalRotation: Math.sqrt(
                    latestGyro.x ** 2 + latestGyro.y ** 2 + latestGyro.z ** 2
                ),
                deviceTilt: latestOrient ? {
                    pitch: latestOrient.beta,
                    roll: latestOrient.gamma,
                    yaw: latestOrient.alpha
                } : null
            };
            
            this.fusedData.push(fused);
            
            if (this.fusedData.length > this.maxBufferSize) {
                this.fusedData.shift();
            }
            
            return fused;
        }
        
        return null;
    }
    
    getRecentFusedData(windowMs = 1000) {
        const now = Date.now();
        return this.fusedData.filter(d => now - d.timestamp < windowMs);
    }
    
    getMotionStatistics(windowMs = 1000) {
        const data = this.getRecentFusedData(windowMs);
        
        if (data.length === 0) {
            return null;
        }
        
        const accelerations = data.map(d => d.totalAcceleration);
        const rotations = data.map(d => d.totalRotation);
        
        return {
            avgAcceleration: accelerations.reduce((a, b) => a + b, 0) / accelerations.length,
            maxAcceleration: Math.max(...accelerations),
            minAcceleration: Math.min(...accelerations),
            avgRotation: rotations.reduce((a, b) => a + b, 0) / rotations.length,
            maxRotation: Math.max(...rotations),
            minRotation: Math.min(...rotations),
            sampleCount: data.length
        };
    }
}

/**
 * Detect hand tremor from gyroscope data
 */
export function detectHandTremor(gyroscopeData, threshold = 0.5) {
    if (!gyroscopeData || gyroscopeData.length < 10) {
        return { hasTremor: false, confidence: 0, magnitude: 0 };
    }
    
    // Calculate high-frequency component
    const highFreqComponent = [];
    
    for (let i = 1; i < gyroscopeData.length; i++) {
        const prev = gyroscopeData[i - 1];
        const curr = gyroscopeData[i];
        
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const dz = curr.z - prev.z;
        
        const magnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);
        highFreqComponent.push(magnitude);
    }
    
    // Calculate RMS of high-frequency component
    const rms = Math.sqrt(
        highFreqComponent.reduce((sum, val) => sum + val * val, 0) / highFreqComponent.length
    );
    
    const hasTremor = rms > threshold;
    const confidence = Math.min(1, rms / threshold);
    
    return {
        hasTremor,
        confidence,
        magnitude: rms,
        threshold
    };
}

/**
 * Detect device motion during signature
 */
export function detectSignatureMotion(motionData, signatureStartTime, signatureEndTime) {
    if (!motionData || motionData.length === 0) {
        return {
            hasMotion: false,
            motionLevel: 0,
            motionType: 'none'
        };
    }
    
    // Filter motion data during signature
    const signatureMotion = motionData.filter(
        d => d.timestamp >= signatureStartTime && d.timestamp <= signatureEndTime
    );
    
    if (signatureMotion.length === 0) {
        return {
            hasMotion: false,
            motionLevel: 0,
            motionType: 'none'
        };
    }
    
    // Calculate motion statistics
    const accelerations = signatureMotion.map(d => d.totalAcceleration || 0);
    const rotations = signatureMotion.map(d => d.totalRotation || 0);
    
    const avgAccel = accelerations.reduce((a, b) => a + b, 0) / accelerations.length;
    const avgRotation = rotations.reduce((a, b) => a + b, 0) / rotations.length;
    const maxAccel = Math.max(...accelerations);
    const maxRotation = Math.max(...rotations);
    
    // Classify motion type
    let motionType = 'stable';
    if (avgAccel > 2 || avgRotation > 1) {
        motionType = 'high';
    } else if (avgAccel > 1 || avgRotation > 0.5) {
        motionType = 'moderate';
    }
    
    // Calculate overall motion level
    const motionLevel = (avgAccel / 10) + (avgRotation / 5);
    
    return {
        hasMotion: motionLevel > 0.2,
        motionLevel: Math.min(1, motionLevel),
        motionType,
        avgAccel,
        avgRotation,
        maxAccel,
        maxRotation
    };
}

/**
 * Motion-based liveness detection
 */
export function motionBasedLivenessDetection(motionData, expectedMotionProfile = null) {
    if (!motionData || motionData.length < 20) {
        return {
            isLive: true,
            confidence: 0.5,
            reason: 'Insufficient motion data'
        };
    }
    
    const stats = calculateMotionStatistics(motionData);
    
    // Check for natural motion patterns
    let isLive = true;
    let confidence = 0.8;
    const reasons = [];
    
    // Check for too little motion (possible static image)
    if (stats.avgAcceleration < 0.1 && stats.avgRotation < 0.05) {
        isLive = false;
        confidence = 0.3;
        reasons.push('Insufficient motion - possible static input');
    }
    
    // Check for too uniform motion (possible synthetic)
    const accelVariance = calculateVariance(
        motionData.map(d => d.totalAcceleration || 0)
    );
    if (accelVariance < 0.01) {
        isLive = false;
        confidence = 0.4;
        reasons.push('Too uniform motion - possible synthetic input');
    }
    
    // Check for unrealistic motion patterns
    if (stats.maxAcceleration > 50 || stats.maxRotation > 20) {
        isLive = false;
        confidence = 0.3;
        reasons.push('Unrealistic motion magnitude');
    }
    
    // Compare with expected profile if available
    if (expectedMotionProfile) {
        const accelDiff = Math.abs(stats.avgAcceleration - expectedMotionProfile.avgAcceleration);
        const rotationDiff = Math.abs(stats.avgRotation - expectedMotionProfile.avgRotation);
        
        if (accelDiff > expectedMotionProfile.avgAcceleration * 2) {
            isLive = false;
            confidence = 0.5;
            reasons.push('Motion profile mismatch');
        }
    }
    
    return {
        isLive,
        confidence,
        reasons: reasons.length > 0 ? reasons : ['Natural motion detected'],
        motionStats: stats
    };
}

/**
 * Calculate motion statistics
 */
function calculateMotionStatistics(motionData) {
    if (!motionData || motionData.length === 0) {
        return null;
    }
    
    const accelerations = motionData.map(d => d.totalAcceleration || 0);
    const rotations = motionData.map(d => d.totalRotation || 0);
    
    return {
        avgAcceleration: accelerations.reduce((a, b) => a + b, 0) / accelerations.length,
        maxAcceleration: Math.max(...accelerations),
        minAcceleration: Math.min(...accelerations),
        avgRotation: rotations.reduce((a, b) => a + b, 0) / rotations.length,
        maxRotation: Math.max(...rotations),
        minRotation: Math.min(...rotations),
        sampleCount: motionData.length
    };
}

/**
 * Calculate variance
 */
function calculateVariance(values) {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
}

/**
 * Extract motion features for ML model
 */
export function extractMotionFeatures(motionData, signatureData) {
    if (!motionData || motionData.length === 0) {
        return new Array(16).fill(0);
    }
    
    const stats = calculateMotionStatistics(motionData);
    const signatureDuration = signatureData 
        ? signatureData[signatureData.length - 1].t - signatureData[0].t 
        : 1000;
    
    // Calculate motion during signature
    const signatureStartTime = signatureData ? signatureData[0].t : 0;
    const signatureEndTime = signatureData ? signatureData[signatureData.length - 1].t : 1000;
    
    const signatureMotion = motionData.filter(
        d => d.timestamp >= signatureStartTime && d.timestamp <= signatureEndTime
    );
    
    const signatureStats = signatureMotion.length > 0 
        ? calculateMotionStatistics(signatureMotion)
        : stats;
    
    // Extract features
    return [
        stats.avgAcceleration || 0,
        stats.maxAcceleration || 0,
        stats.minAcceleration || 0,
        stats.avgRotation || 0,
        stats.maxRotation || 0,
        stats.minRotation || 0,
        signatureStats.avgAcceleration || 0,
        signatureStats.maxAcceleration || 0,
        signatureStats.avgRotation || 0,
        signatureStats.maxRotation || 0,
        signatureMotion.length / (motionData.length || 1), // Motion concentration
        stats.sampleCount / (signatureDuration / 100), // Motion frequency
        calculateVariance(motionData.map(d => d.totalAcceleration || 0)),
        calculateVariance(motionData.map(d => d.totalRotation || 0)),
        stats.maxAcceleration / (stats.avgAcceleration || 1), // Peak-to-average ratio
        stats.maxRotation / (stats.avgRotation || 1)
    ];
}

/**
 * Get device orientation for signature normalization
 */
export function getDeviceOrientationForSignature() {
    return new Promise((resolve) => {
        if (!('DeviceOrientationEvent' in window)) {
            resolve({ supported: false, orientation: null });
            return;
        }
        
        const handler = (event) => {
            window.removeEventListener('deviceorientation', handler);
            resolve({
                supported: true,
                orientation: {
                    alpha: event.alpha || 0,
                    beta: event.beta || 0,
                    gamma: event.gamma || 0,
                    absolute: event.absolute || false
                }
            });
        };
        
        window.addEventListener('deviceorientation', handler);
        
        // Timeout if no event received
        setTimeout(() => {
            window.removeEventListener('deviceorientation', handler);
            resolve({ supported: true, orientation: null });
        }, 100);
    });
}

/**
 * Normalize signature based on device orientation
 */
export function normalizeForDeviceOrientation(points, orientation) {
    if (!orientation || !points) {
        return points;
    }
    
    // Apply rotation compensation based on device orientation
    const beta = orientation.beta * (Math.PI / 180); // X-axis rotation
    const gamma = orientation.gamma * (Math.PI / 180); // Y-axis rotation
    
    return points.map(point => {
        // Rotate point to compensate for device tilt
        const x = point.x;
        const y = point.y;
        
        // Simple rotation compensation
        const cosBeta = Math.cos(beta);
        const sinBeta = Math.sin(beta);
        const cosGamma = Math.cos(gamma);
        const sinGamma = Math.sin(gamma);
        
        const rotatedX = x * cosBeta - y * sinBeta;
        const rotatedY = x * sinBeta + y * cosBeta;
        
        return {
            ...point,
            x: rotatedX,
            y: rotatedY
        };
    });
}

/**
 * Complete mobile hardware integration with filtering and fallback
 */
export class MobileHardwareIntegration {
    constructor(options = {}) {
        this.sensorFusion = new SensorFusion();
        this.accelerometer = null;
        this.gyroscope = null;
        this.isInitialized = false;
        
        // Sensor filters
        this.accelKalmanFilter = new KalmanFilter3D(0.01, 0.1);
        this.gyroKalmanFilter = new KalmanFilter3D(0.01, 0.1);
        this.accelMovingAvg = new MovingAverageFilter3D(5);
        this.gyroMovingAvg = new MovingAverageFilter3D(5);
        this.qualityChecker = new SensorQualityChecker();
        
        // Fallback mode
        this.fallbackMode = false;
        this.useFallback = options.useFallback !== false; // Default to true
        
        // Filter settings
        this.enableKalman = options.enableKalman !== false;
        this.enableMovingAvg = options.enableMovingAvg !== false;
        this.enableQualityCheck = options.enableQualityCheck !== false;
    }
    
    async initialize() {
        if (this.isInitialized) return true;
        
        // Try modern sensors first
        const accelResult = await initAccelerometer({ frequency: 60 });
        const gyroResult = await initGyroscope({ frequency: 60 });
        
        if (accelResult.supported) {
            this.accelerometer = accelResult.sensor;
            this.accelerometer.addEventListener('reading', (event) => {
                let data = { x: event.x, y: event.y, z: event.z };
                
                // Apply quality check
                if (this.enableQualityCheck) {
                    const quality = this.qualityChecker.checkQuality(data);
                    if (!quality.isValid || quality.confidence < 0.3) {
                        return; // Skip low-quality readings
                    }
                }
                
                // Apply filters
                if (this.enableKalman) {
                    data = this.accelKalmanFilter.filter(data);
                }
                if (this.enableMovingAvg) {
                    data = this.accelMovingAvg.filter(data);
                }
                
                this.sensorFusion.addAccelerometer(data);
            });
        }
        
        if (gyroResult.supported) {
            this.gyroscope = gyroResult.sensor;
            this.gyroscope.addEventListener('reading', (event) => {
                let data = { x: event.x, y: event.y, z: event.z };
                
                // Apply quality check
                if (this.enableQualityCheck) {
                    const quality = this.qualityChecker.checkQuality(data);
                    if (!quality.isValid || quality.confidence < 0.3) {
                        return; // Skip low-quality readings
                    }
                }
                
                // Apply filters
                if (this.enableKalman) {
                    data = this.gyroKalmanFilter.filter(data);
                }
                if (this.enableMovingAvg) {
                    data = this.gyroMovingAvg.filter(data);
                }
                
                this.sensorFusion.addGyroscope(data);
            });
        }
        
        // Fall back to legacy APIs if modern sensors not available
        if (!accelResult.supported || !gyroResult.supported) {
            if (this.useFallback) {
                this.fallbackMode = true;
                console.log('🔄 Using fallback sensor mode (legacy APIs)');
                
                initDeviceMotion((data) => {
                    let accelData = data.acceleration;
                    let gyroData = {
                        x: data.rotationRate.alpha,
                        y: data.rotationRate.beta,
                        z: data.rotationRate.gamma
                    };
                    
                    // Apply filters in fallback mode too
                    if (this.enableKalman) {
                        accelData = this.accelKalmanFilter.filter(accelData);
                        gyroData = this.gyroKalmanFilter.filter(gyroData);
                    }
                    if (this.enableMovingAvg) {
                        accelData = this.accelMovingAvg.filter(accelData);
                        gyroData = this.gyroMovingAvg.filter(gyroData);
                    }
                    
                    this.sensorFusion.addAccelerometer(accelData);
                    this.sensorFusion.addGyroscope(gyroData);
                });
                
                initDeviceOrientation((data) => {
                    this.sensorFusion.addOrientation(data);
                });
            } else {
                console.warn('⚠️ Sensors not available and fallback disabled');
            }
        }
        
        this.isInitialized = true;
        return true;
    }
    
    getMotionData() {
        return this.sensorFusion.getRecentFusedData(1000);
    }
    
    detectTremor(threshold = 0.5) {
        const gyroData = this.sensorFusion.gyroscopeData;
        return detectHandTremor(gyroData, threshold);
    }
    
    extractFeatures(signatureData) {
        const motionData = this.getMotionData();
        return extractMotionFeatures(motionData, signatureData);
    }
    
    getSensorStatus() {
        return {
            isInitialized: this.isInitialized,
            fallbackMode: this.fallbackMode,
            accelerometerAvailable: !!this.accelerometer,
            gyroscopeAvailable: !!this.gyroscope,
            filtersEnabled: {
                kalman: this.enableKalman,
                movingAverage: this.enableMovingAvg,
                qualityCheck: this.enableQualityCheck
            },
            dataQuality: this.qualityChecker.history.length > 0 ? 
                this.qualityChecker.checkQuality(this.qualityChecker.history[this.qualityChecker.history.length - 1]) : 
                null
        };
    }
    
    resetFilters() {
        this.accelKalmanFilter.reset();
        this.gyroKalmanFilter.reset();
        this.accelMovingAvg.reset();
        this.gyroMovingAvg.reset();
        this.qualityChecker.reset();
    }
    
    async stop() {
        if (this.accelerometer) {
            await this.accelerometer.stop();
        }
        if (this.gyroscope) {
            await this.gyroscope.stop();
        }
        this.isInitialized = false;
    }
}

/**
 * Fallback mode for signature verification without sensors
 * Uses only touch/canvas data when sensors are unavailable
 */
export class FallbackVerificationMode {
    constructor() {
        this.isActive = false;
        this.touchData = [];
        this.timingData = [];
    }
    
    activate() {
        this.isActive = true;
        this.touchData = [];
        this.timingData = [];
        console.log('🔄 Fallback verification mode activated (sensors unavailable)');
    }
    
    deactivate() {
        this.isActive = false;
    }
    
    recordTouchPoint(point) {
        if (!this.isActive) return;
        
        this.touchData.push({
            x: point.x,
            y: point.y,
            t: point.t,
            p: point.p || 0.5
        });
        
        if (this.touchData.length > 1) {
            const prev = this.touchData[this.touchData.length - 2];
            const dt = point.t - prev.t;
            const dx = point.x - prev.x;
            const dy = point.y - prev.y;
            const velocity = Math.sqrt(dx * dx + dy * dy) / dt;
            
            this.timingData.push({
                dt,
                velocity,
                timestamp: point.t
            });
        }
    }
    
    getFallbackFeatures() {
        if (this.touchData.length === 0) return null;
        
        // Extract basic timing features from touch data
        const velocities = this.timingData.map(t => t.velocity);
        const deltas = this.timingData.map(t => t.dt);
        
        return {
            avgVelocity: velocities.length > 0 ? velocities.reduce((a, b) => a + b, 0) / velocities.length : 0,
            maxVelocity: velocities.length > 0 ? Math.max(...velocities) : 0,
            avgTimeInterval: deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0,
            totalDuration: this.touchData[this.touchData.length - 1].t - this.touchData[0].t,
            pointCount: this.touchData.length,
            mode: 'fallback'
        };
    }
    
    reset() {
        this.touchData = [];
        this.timingData = [];
    }
}
