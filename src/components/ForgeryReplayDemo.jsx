/**
 * ForgeryReplayDemo.jsx - Forgery replay demonstration
 * 
 * Shows:
 * - Genuine signature
 * - Forged signature
 * - DTW mismatch visualization
 * - Confidence difference
 * - Feature comparison
 */

import React, { useState, useRef } from 'react';

/**
 * Signature Comparison View
 */
function SignatureComparison({ genuine, forged, dtwPath, width = 400, height = 300 }) {
    const canvasRef = useRef(null);
    
    const drawSignature = (points, color, lineWidth = 2) => {
        if (!points || points.length === 0) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Calculate bounds
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const padding = 20;
        const scaleX = (width - 2 * padding) / (maxX - minX || 1);
        const scaleY = (height - 2 * padding) / (maxY - minY || 1);
        
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        
        points.forEach((point, i) => {
            const x = padding + (point.x - minX) * scaleX;
            const y = padding + (point.y - minY) * scaleY;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
    };
    
    const drawDTWPath = (genuinePoints, forgedPoints, path) => {
        if (!path || path.length === 0) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Calculate bounds for both signatures
        const allPoints = [...genuinePoints, ...forgedPoints];
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const padding = 20;
        const scaleX = (width - 2 * padding) / (maxX - minX || 1);
        const scaleY = (height - 2 * padding) / (maxY - minY || 1);
        
        // Draw DTW alignment lines
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 1;
        
        path.forEach(([i, j]) => {
            const p1 = genuinePoints[i];
            const p2 = forgedPoints[j];
            
            const x1 = padding + (p1.x - minX) * scaleX;
            const y1 = padding + (p1.y - minY) * scaleY;
            const x2 = padding + (p2.x - minX) * scaleX;
            const y2 = padding + (p2.y - minY) * scaleY;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        });
    };
    
    React.useEffect(() => {
        if (!canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, width, height);
        
        // Draw genuine signature (green)
        if (genuine) {
            drawSignature(genuine, '#22c55e', 3);
        }
        
        // Draw forged signature (red)
        if (forged) {
            drawSignature(forged, '#ef4444', 2);
        }
        
        // Draw DTW path
        if (genuine && forged && dtwPath) {
            drawDTWPath(genuine, forged, dtwPath);
        }
        
    }, [genuine, forged, dtwPath, width, height]);
    
    return (
        <div className="signature-comparison">
            <h3>Signature Comparison</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <span style={{ color: '#22c55e' }}>● Genuine</span>
                <span style={{ color: '#ef4444' }}>● Forged</span>
                <span style={{ color: '#ef4444', opacity: 0.5 }}>─ DTW Alignment</span>
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
 * Confidence Comparison Meter
 */
function ConfidenceComparison({ genuineScore, forgedScore }) {
    return (
        <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
        }}>
            <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>Confidence Comparison</h3>
            
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ color: '#22c55e', fontWeight: 'bold' }}>Genuine Signature</span>
                    <span style={{ fontWeight: 'bold' }}>{(genuineScore * 100).toFixed(1)}%</span>
                </div>
                <div style={{ 
                    height: '20px', 
                    backgroundColor: '#e5e7eb', 
                    borderRadius: '10px',
                    overflow: 'hidden'
                }}>
                    <div style={{ 
                        height: '100%', 
                        width: `${genuineScore * 100}%`,
                        backgroundColor: '#22c55e',
                        transition: 'width 0.3s'
                    }} />
                </div>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Forged Signature</span>
                    <span style={{ fontWeight: 'bold' }}>{(forgedScore * 100).toFixed(1)}%</span>
                </div>
                <div style={{ 
                    height: '20px', 
                    backgroundColor: '#e5e7eb', 
                    borderRadius: '10px',
                    overflow: 'hidden'
                }}>
                    <div style={{ 
                        height: '100%', 
                        width: `${forgedScore * 100}%`,
                        backgroundColor: '#ef4444',
                        transition: 'width 0.3s'
                    }} />
                </div>
            </div>
            
            <div style={{ 
                padding: '15px', 
                backgroundColor: '#f9fafb', 
                borderRadius: '8px',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Confidence Gap</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>
                    {Math.abs(genuineScore - forgedScore * 100).toFixed(1)}%
                </div>
            </div>
        </div>
    );
}

/**
 * Feature Difference Chart
 */
function FeatureDifference({ genuineFeatures, forgedFeatures }) {
    const canvasRef = useRef(null);
    
    React.useEffect(() => {
        if (!canvasRef.current || !genuineFeatures || !forgedFeatures) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, 300, 200);
        
        const featureNames = ['Velocity', 'Acceleration', 'Pressure', 'Curvature', 'Direction', 'Rhythm'];
        const numFeatures = featureNames.length;
        
        const barWidth = 30;
        const spacing = 15;
        const startX = 40;
        const maxHeight = 150;
        
        // Draw axes
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(startX, 20);
        ctx.lineTo(startX, 180);
        ctx.lineTo(280, 180);
        ctx.stroke();
        
        // Draw bars
        genuineFeatures.forEach((value, i) => {
            const x = startX + i * (barWidth + spacing);
            const height = value * maxHeight;
            
            // Genuine bar (green)
            ctx.fillStyle = 'rgba(34, 197, 94, 0.7)';
            ctx.fillRect(x, 180 - height, barWidth / 2 - 2, height);
            
            // Forged bar (red)
            const forgedValue = forgedFeatures[i] || 0;
            const forgedHeight = forgedValue * maxHeight;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
            ctx.fillRect(x + barWidth / 2, 180 - forgedHeight, barWidth / 2 - 2, forgedHeight);
            
            // Label
            ctx.fillStyle = '#374151';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(featureNames[i].substring(0, 3), x + barWidth / 2, 195);
        });
        
        // Legend
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(200, 10, 10, 10);
        ctx.fillStyle = '#374151';
        ctx.textAlign = 'left';
        ctx.fillText('Genuine', 215, 18);
        
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(200, 25, 10, 10);
        ctx.fillStyle = '#374151';
        ctx.fillText('Forged', 215, 33);
        
    }, [genuineFeatures, forgedFeatures]);
    
    return (
        <div className="feature-difference">
            <h3>Feature Difference</h3>
            <canvas 
                ref={canvasRef} 
                width={300} 
                height={200}
                style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
        </div>
    );
}

/**
 * Forgery Type Selector
 */
function ForgeryTypeSelector({ selectedType, onSelect }) {
    const types = [
        { id: 'traced', name: 'Traced', description: 'Slow, careful tracing of genuine signature' },
        { id: 'fast', name: 'Fast Hasty', description: 'Quick, rushed attempt' },
        { id: 'distorted', name: 'Distorted', description: 'Intentionally deformed signature' },
        { id: 'random', name: 'Random', description: 'Random scribble' }
    ];
    
    return (
        <div style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '10px', color: '#1f2937' }}>Forgery Type</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {types.map(type => (
                    <button
                        key={type.id}
                        onClick={() => onSelect(type.id)}
                        style={{
                            padding: '15px',
                            border: '2px solid',
                            borderColor: selectedType === type.id ? '#3b82f6' : '#e5e7eb',
                            backgroundColor: selectedType === type.id ? '#eff6ff' : 'white',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            textAlign: 'left'
                        }}
                    >
                        <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{type.name}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                            {type.description}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

/**
 * Main Forgery Replay Demo Component
 */
export default function ForgeryReplayDemo() {
    const [selectedForgery, setSelectedForgery] = useState('traced');
    const [genuineScore, setGenuineScore] = useState(0.85);
    const [forgedScore, setForgedScore] = useState(0.45);
    
    // Simulated data for demo
    const genuineSignature = [
        { x: 50, y: 100 }, { x: 70, y: 90 }, { x: 90, y: 85 }, { x: 110, y: 90 },
        { x: 130, y: 100 }, { x: 150, y: 115 }, { x: 170, y: 130 }, { x: 190, y: 145 },
        { x: 210, y: 155 }, { x: 230, y: 160 }, { x: 250, y: 155 }, { x: 270, y: 145 }
    ];
    
    const forgedSignatures = {
        traced: genuineSignature.map(p => ({ ...p, x: p.x + 5, y: p.y + 3 })),
        fast: genuineSignature.map(p => ({ ...p, x: p.x + 10, y: p.y + 8 })),
        distorted: genuineSignature.map((p, i) => ({ 
            ...p, 
            x: p.x + Math.sin(i * 0.5) * 10,
            y: p.y + Math.cos(i * 0.5) * 10
        })),
        random: Array.from({ length: 12 }, (_, i) => ({
            x: 50 + Math.random() * 200,
            y: 80 + Math.random() * 80
        }))
    };
    
    const genuineFeatures = [0.8, 0.7, 0.9, 0.6, 0.8, 0.7];
    const forgedFeatures = [0.4, 0.3, 0.5, 0.2, 0.4, 0.3];
    
    const handleForgerySelect = (type) => {
        setSelectedForgery(type);
        // Simulate different scores for different forgery types
        const scores = {
            traced: 0.55,
            fast: 0.40,
            distorted: 0.35,
            random: 0.20
        };
        setForgedScore(scores[type]);
    };
    
    return (
        <div style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Forgery Replay Demo</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                    <ForgeryTypeSelector 
                        selectedType={selectedForgery} 
                        onSelect={handleForgerySelect}
                    />
                    
                    <SignatureComparison 
                        genuine={genuineSignature}
                        forged={forgedSignatures[selectedForgery]}
                        dtwPath={[]} // Would be computed from DTW
                    />
                </div>
                
                <div>
                    <ConfidenceComparison 
                        genuineScore={genuineScore}
                        forgedScore={forgedScore}
                    />
                    
                    <div style={{ marginTop: '20px' }}>
                        <FeatureDifference 
                            genuineFeatures={genuineFeatures}
                            forgedFeatures={forgedFeatures}
                        />
                    </div>
                    
                    <div style={{ 
                        marginTop: '20px', 
                        padding: '20px', 
                        backgroundColor: 'white', 
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                    }}>
                        <h4 style={{ margin: '0 0 15px 0', color: '#1f2937' }}>Detection Result</h4>
                        <div style={{ 
                            padding: '15px', 
                            backgroundColor: forgedScore < 0.5 ? '#dcfce7' : '#fee2e2',
                            borderRadius: '8px',
                            border: `1px solid ${forgedScore < 0.5 ? '#22c55e' : '#ef4444'}`
                        }}>
                            <div style={{ 
                                fontSize: '20px', 
                                fontWeight: 'bold',
                                color: forgedScore < 0.5 ? '#166534' : '#991b1b'
                            }}>
                                {forgedScore < 0.5 ? '✅ FORGERY DETECTED' : '❌ FORGERY ACCEPTED'}
                            </div>
                            <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '5px' }}>
                                Confidence: {(forgedScore * 100).toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#1f2937' }}>How It Works</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#6b7280', fontSize: '14px' }}>
                    <li>Genuine signatures produce high confidence scores (&gt;80%)</li>
                    <li>Forged signatures produce low confidence scores (&lt;50%)</li>
                    <li>DTW alignment shows mismatch between genuine and forged paths</li>
                    <li>Feature differences highlight behavioral inconsistencies</li>
                    <li>System can detect various forgery types (traced, fast, distorted, random)</li>
                </ul>
            </div>
        </div>
    );
}
