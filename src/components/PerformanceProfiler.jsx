/**
 * PerformanceProfiler.jsx - Performance profiling panel
 * 
 * Shows:
 * - Inference time
 * - Memory usage
 * - FPS
 * - Worker execution time
 * - TensorFlow.js backend info
 */

import React, { useState, useEffect, useRef } from 'react';

/**
 * Performance Metrics Display
 */
function PerformanceMetrics({ metrics }) {
    if (!metrics) return null;
    
    return (
        <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
        }}>
            <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>Performance Metrics</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Inference Time</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                        {metrics.inferenceTime?.toFixed(2) || 'N/A'} ms
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Memory Usage</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                        {metrics.memoryUsage?.toFixed(2) || 'N/A'} MB
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>FPS</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                        {metrics.fps?.toFixed(1) || 'N/A'}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Worker Time</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                        {metrics.workerTime?.toFixed(2) || 'N/A'} ms
                    </div>
                </div>
            </div>
            
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>TensorFlow.js Backend</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
                    {metrics.backend || 'Unknown'}
                </div>
            </div>
        </div>
    );
}

/**
 * Real-time Performance Monitor
 */
function RealTimeMonitor({ isMonitoring, onToggle }) {
    const [fps, setFps] = useState(0);
    const [memory, setMemory] = useState(0);
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(performance.now());
    const animationFrameRef = useRef(null);
    
    useEffect(() => {
        if (!isMonitoring) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            return;
        }
        
        const updateMetrics = () => {
            const now = performance.now();
            frameCountRef.current++;
            
            // Update FPS every second
            if (now - lastTimeRef.current >= 1000) {
                const fps = frameCountRef.current / ((now - lastTimeRef.current) / 1000);
                setFps(fps);
                frameCountRef.current = 0;
                lastTimeRef.current = now;
                
                // Get memory usage if available
                if (performance.memory) {
                    setMemory(performance.memory.usedJSHeapSize / 1048576); // Convert to MB
                }
            }
            
            animationFrameRef.current = requestAnimationFrame(updateMetrics);
        };
        
        animationFrameRef.current = requestAnimationFrame(updateMetrics);
        
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isMonitoring]);
    
    return (
        <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#1f2937' }}>Real-Time Monitor</h3>
                <button
                    onClick={onToggle}
                    style={{
                        padding: '8px 16px',
                        border: 'none',
                        backgroundColor: isMonitoring ? '#ef4444' : '#22c55e',
                        color: 'white',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    {isMonitoring ? 'Stop' : 'Start'}
                </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Current FPS</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>
                        {fps.toFixed(1)}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Memory (MB)</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>
                        {memory.toFixed(1)}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Performance History Chart
 */
function PerformanceHistory({ history }) {
    const canvasRef = useRef(null);
    
    useEffect(() => {
        if (!canvasRef.current || !history || history.length === 0) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, 400, 200);
        
        const padding = 30;
        const graphWidth = 400 - 2 * padding;
        const graphHeight = 200 - 2 * padding;
        
        const times = history.map(h => h.inferenceTime);
        const maxTime = Math.max(...times, 1);
        
        // Draw axes
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, 200 - padding);
        ctx.lineTo(400 - padding, 200 - padding);
        ctx.stroke();
        
        // Draw line
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        times.forEach((time, i) => {
            const x = padding + (i / (times.length - 1)) * graphWidth;
            const y = 200 - padding - (time / maxTime) * graphHeight;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
        
        // Draw points
        ctx.fillStyle = '#3b82f6';
        times.forEach((time, i) => {
            const x = padding + (i / (times.length - 1)) * graphWidth;
            const y = 200 - padding - (time / maxTime) * graphHeight;
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Draw labels
        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Time (ms)', 400 / 2, 200 - 5);
        
    }, [history]);
    
    return (
        <div>
            <h3>Inference Time History</h3>
            <canvas 
                ref={canvasRef} 
                width={400} 
                height={200}
                style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
        </div>
    );
}

/**
 * TensorFlow.js Backend Info
 */
function BackendInfo() {
    const [backend, setBackend] = useState('Unknown');
    const [tensorCount, setTensorCount] = useState(0);
    
    useEffect(() => {
        async function getBackendInfo() {
            try {
                const tf = await import('@tensorflow/tfjs');
                setBackend(tf.getBackend());
                
                // Get tensor count if available
                if (tf.memory) {
                    const mem = tf.memory();
                    setTensorCount(mem.numTensors || 0);
                }
            } catch (e) {
                console.error('Failed to get backend info:', e);
            }
        }
        
        getBackendInfo();
        const interval = setInterval(getBackendInfo, 1000);
        
        return () => clearInterval(interval);
    }, []);
    
    return (
        <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
        }}>
            <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>TensorFlow.js Backend</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Backend</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                        {backend}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Active Tensors</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                        {tensorCount}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Main Performance Profiler Component
 */
export default function PerformanceProfiler() {
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [performanceHistory, setPerformanceHistory] = useState([]);
    const [currentMetrics, setCurrentMetrics] = useState(null);
    
    const addMetric = (metric) => {
        setPerformanceHistory(prev => [...prev.slice(-19), metric]);
        setCurrentMetrics(metric);
    };
    
    return (
        <div style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Performance Profiler</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                    <RealTimeMonitor 
                        isMonitoring={isMonitoring} 
                        onToggle={() => setIsMonitoring(!isMonitoring)}
                    />
                    
                    <div style={{ marginTop: '20px' }}>
                        <BackendInfo />
                    </div>
                </div>
                
                <div>
                    <PerformanceMetrics metrics={currentMetrics} />
                    
                    {performanceHistory.length > 0 && (
                        <div style={{ marginTop: '20px' }}>
                            <PerformanceHistory history={performanceHistory} />
                        </div>
                    )}
                </div>
            </div>
            
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#1f2937' }}>Performance Tips</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#6b7280', fontSize: '14px' }}>
                    <li>Use WebGL backend for better performance</li>
                    <li>Enable tensor disposal to prevent memory leaks</li>
                    <li>Use Web Workers for off-main-thread processing</li>
                    <li>Cache model inference results</li>
                    <li>Lazy load models when needed</li>
                </ul>
            </div>
        </div>
    );
}
