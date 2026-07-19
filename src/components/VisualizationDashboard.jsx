/**
 * VisualizationDashboard.jsx - Visual analytics for signature verification
 * 
 * Provides:
 * - DTW alignment visualization
 * - Signature overlap display
 * - Velocity/acceleration graphs
 * - Confidence meter
 * - Feature radar chart
 * - Real-time verification metrics
 */

import React, { useState, useEffect, useRef } from 'react';

/**
 * DTW Alignment Visualization Component
 */
function DTWAlignmentView({ path, width = 400, height = 400 }) {
    const canvasRef = useRef(null);
    
    useEffect(() => {
        if (!canvasRef.current || !path || path.length === 0) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Find bounds
        const xs = path.map(p => p.x);
        const ys = path.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const padding = 20;
        const scaleX = (width - 2 * padding) / (maxX - minX || 1);
        const scaleY = (height - 2 * padding) / (maxY - minY || 1);
        
        // Draw DTW path
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        
        path.forEach((point, i) => {
            const x = padding + (point.x - minX) * scaleX;
            const y = padding + (point.y - minY) * scaleY;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw points
        ctx.fillStyle = '#ef4444';
        path.forEach((point, i) => {
            if (i % 5 === 0) { // Draw every 5th point
                const x = padding + (point.x - minX) * scaleX;
                const y = padding + (point.y - minY) * scaleY;
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        // Draw start and end markers
        if (path.length > 0) {
            const startX = padding + (path[0].x - minX) * scaleX;
            const startY = padding + (path[0].y - minY) * scaleY;
            const endX = padding + (path[path.length - 1].x - minX) * scaleX;
            const endY = padding + (path[path.length - 1].y - minY) * scaleY;
            
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(startX, startY, 5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(endX, endY, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        
    }, [path, width, height]);
    
    return (
        <div className="dtw-view">
            <h3>DTW Alignment</h3>
            <canvas 
                ref={canvasRef} 
                width={width} 
                height={height}
                style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
        </div>
    );
}

/**
 * Signature Overlap Component
 */
function SignatureOverlapView({ signatureA, signatureB, width = 400, height = 400 }) {
    const canvasRef = useRef(null);
    
    useEffect(() => {
        if (!canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, width, height);
        
        // Calculate bounds for both signatures
        const allPoints = [...(signatureA || []), ...(signatureB || [])];
        if (allPoints.length === 0) return;
        
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const padding = 20;
        const scaleX = (width - 2 * padding) / (maxX - minX || 1);
        const scaleY = (height - 2 * padding) / (maxY - minY || 1);
        
        const transform = (point) => ({
            x: padding + (point.x - minX) * scaleX,
            y: padding + (point.y - minY) * scaleY
        });
        
        // Draw signature A (blue)
        if (signatureA && signatureA.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
            ctx.lineWidth = 3;
            
            signatureA.forEach((point, i) => {
                const t = transform(point);
                if (i === 0) ctx.moveTo(t.x, t.y);
                else ctx.lineTo(t.x, t.y);
            });
            
            ctx.stroke();
        }
        
        // Draw signature B (red)
        if (signatureB && signatureB.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
            ctx.lineWidth = 3;
            
            signatureB.forEach((point, i) => {
                const t = transform(point);
                if (i === 0) ctx.moveTo(t.x, t.y);
                else ctx.lineTo(t.x, t.y);
            });
            
            ctx.stroke();
        }
        
        // Draw overlap (purple)
        if (signatureA && signatureB && signatureA.length > 0 && signatureB.length > 0) {
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 2;
            
            signatureA.forEach((point, i) => {
                const t = transform(point);
                if (i === 0) ctx.moveTo(t.x, t.y);
                else ctx.lineTo(t.x, t.y);
            });
            
            signatureB.forEach((point, i) => {
                const t = transform(point);
                if (i === 0) ctx.moveTo(t.x, t.y);
                else ctx.lineTo(t.x, t.y);
            });
            
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }
        
    }, [signatureA, signatureB, width, height]);
    
    return (
        <div className="overlap-view">
            <h3>Signature Overlap</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <span style={{ color: '#3b82f6' }}>● Reference</span>
                <span style={{ color: '#ef4444' }}>● Test</span>
                <span style={{ color: '#8b5cf6' }}>● Overlap</span>
            </div>
            <canvas 
                ref={canvasRef} 
                width={width} 
                height={height}
                style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
        </div>
    );
}

/**
 * Velocity/Acceleration Graph Component
 */
function VelocityGraph({ points, width = 400, height = 200 }) {
    const canvasRef = useRef(null);
    
    useEffect(() => {
        if (!canvasRef.current || !points || points.length === 0) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, width, height);
        
        // Calculate velocity and acceleration
        const velocities = [];
        const accelerations = [];
        
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            const dt = Math.max(points[i].t - points[i - 1].t, 1);
            
            velocities.push(Math.sqrt(dx * dx + dy * dy) / dt);
        }
        
        for (let i = 1; i < velocities.length; i++) {
            accelerations.push(velocities[i] - velocities[i - 1]);
        }
        
        const padding = 30;
        const graphWidth = width - 2 * padding;
        const graphHeight = height - 2 * padding;
        
        const maxVel = Math.max(...velocities, 1);
        const maxAcc = Math.max(...accelerations.map(Math.abs), 1);
        
        // Draw velocity
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        
        velocities.forEach((vel, i) => {
            const x = padding + (i / (velocities.length - 1)) * graphWidth;
            const y = padding + graphHeight - (vel / maxVel) * graphHeight;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
        
        // Draw acceleration
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        
        accelerations.forEach((acc, i) => {
            const x = padding + (i / (accelerations.length - 1)) * graphWidth;
            const y = padding + graphHeight / 2 - (acc / maxAcc) * (graphHeight / 2);
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
        
        // Draw axes
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
    }, [points, width, height]);
    
    return (
        <div className="velocity-graph">
            <h3>Velocity & Acceleration</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <span style={{ color: '#3b82f6' }}>● Velocity</span>
                <span style={{ color: '#ef4444' }}>● Acceleration</span>
            </div>
            <canvas 
                ref={canvasRef} 
                width={width} 
                height={height}
                style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
        </div>
    );
}

/**
 * Confidence Meter Component
 */
function ConfidenceMeter({ score, uncertainty = 0 }) {
    const percentage = Math.round(score * 100);
    const color = score > 0.7 ? '#22c55e' : score > 0.5 ? '#f59e0b' : '#ef4444';
    
    return (
        <div className="confidence-meter">
            <h3>Confidence Score</h3>
            <div style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto' }}>
                <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="10"
                    />
                    <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={color}
                        strokeWidth="10"
                        strokeDasharray={`${2 * Math.PI * 45}`}
                        strokeDashoffset={`${2 * Math.PI * 45 * (1 - score)}`}
                        strokeLinecap="round"
                    />
                </svg>
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color }}>{percentage}%</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        Uncertainty: {(uncertainty * 100).toFixed(0)}%
                    </div>
                </div>
            </div>
            <div style={{ marginTop: '10px', textAlign: 'center' }}>
                <span style={{ 
                    padding: '4px 12px', 
                    borderRadius: '12px', 
                    backgroundColor: color + '20',
                    color: color,
                    fontWeight: 'bold'
                }}>
                    {score > 0.7 ? 'ACCEPTED' : score > 0.5 ? 'UNCERTAIN' : 'REJECTED'}
                </span>
            </div>
        </div>
    );
}

/**
 * Feature Radar Chart Component
 */
function FeatureRadar({ features }) {
    const canvasRef = useRef(null);
    
    useEffect(() => {
        if (!canvasRef.current || !features) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, 300, 300);
        
        const featureNames = [
            'Velocity',
            'Acceleration',
            'Pressure',
            'Curvature',
            'Direction',
            'Rhythm'
        ];
        
        const numFeatures = featureNames.length;
        const centerX = 150;
        const centerY = 150;
        const radius = 100;
        
        // Draw background
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            const r = radius * (i + 1) / 5;
            for (let j = 0; j <= numFeatures; j++) {
                const angle = (j / numFeatures) * Math.PI * 2 - Math.PI / 2;
                const x = centerX + r * Math.cos(angle);
                const y = centerY + r * Math.sin(angle);
                
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }
        
        // Draw axes and labels
        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        
        for (let i = 0; i < numFeatures; i++) {
            const angle = (i / numFeatures) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();
            
            const labelX = centerX + (radius + 20) * Math.cos(angle);
            const labelY = centerY + (radius + 20) * Math.sin(angle);
            ctx.fillText(featureNames[i], labelX, labelY + 4);
        }
        
        // Draw feature polygon
        if (features && features.length >= numFeatures) {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            
            for (let i = 0; i < numFeatures; i++) {
                const angle = (i / numFeatures) * Math.PI * 2 - Math.PI / 2;
                const value = Math.min(features[i], 1);
                const x = centerX + radius * value * Math.cos(angle);
                const y = centerY + radius * value * Math.sin(angle);
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        
    }, [features]);
    
    return (
        <div className="feature-radar">
            <h3>Feature Profile</h3>
            <canvas 
                ref={canvasRef} 
                width={300} 
                height={300}
                style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
        </div>
    );
}

/**
 * Main Visualization Dashboard Component
 */
export default function VisualizationDashboard({ 
    verificationResult, 
    signatureA, 
    signatureB,
    features 
}) {
    const [activeTab, setActiveTab] = useState('alignment');
    
    return (
        <div style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Verification Analytics</h2>
            
            {/* Tab Navigation */}
            <div style={{ 
                display: 'flex', 
                gap: '10px', 
                marginBottom: '20px',
                borderBottom: '2px solid #e5e7eb',
                paddingBottom: '10px'
            }}>
                {['alignment', 'overlap', 'velocity', 'features'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            backgroundColor: activeTab === tab ? '#3b82f6' : 'transparent',
                            color: activeTab === tab ? 'white' : '#6b7280',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: activeTab === tab ? 'bold' : 'normal'
                        }}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>
            
            {/* Content Area */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Left Column - Visualization */}
                <div>
                    {activeTab === 'alignment' && signatureA && (
                        <DTWAlignmentView path={signatureA} />
                    )}
                    {activeTab === 'overlap' && signatureA && signatureB && (
                        <SignatureOverlapView signatureA={signatureA} signatureB={signatureB} />
                    )}
                    {activeTab === 'velocity' && signatureA && (
                        <VelocityGraph points={signatureA} />
                    )}
                    {activeTab === 'features' && features && (
                        <FeatureRadar features={features} />
                    )}
                </div>
                
                {/* Right Column - Metrics */}
                <div>
                    <ConfidenceMeter 
                        score={verificationResult?.score || 0.5} 
                        uncertainty={verificationResult?.uncertainty || 0}
                    />
                    
                    {/* Additional Metrics */}
                    {verificationResult && (
                        <div style={{ 
                            marginTop: '20px', 
                            padding: '15px', 
                            backgroundColor: 'white', 
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb'
                        }}>
                            <h4 style={{ marginBottom: '10px', color: '#1f2937' }}>Detailed Metrics</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>DTW Distance</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                                        {verificationResult.dtwDistance?.toFixed(3) || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Behavior Score</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                                        {verificationResult.behaviorScore?.toFixed(3) || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Processing Time</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                                        {verificationResult.processingTime?.toFixed(0) || 'N/A'} ms
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Threshold</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                                        {verificationResult.threshold?.toFixed(1) || 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
