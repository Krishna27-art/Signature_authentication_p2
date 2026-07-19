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

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

/**
 * Signature Comparison View
 */
function SignatureComparison({ genuine, forged, dtwPath, width = 400, height = 300 }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, width, height);

        const drawSignature = (points, color, lineWidth = 2) => {
            if (!points || points.length === 0) return;
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

        if (genuine) drawSignature(genuine, '#22c55e', 3);
        if (forged) drawSignature(forged, '#ef4444', 2);
        if (genuine && forged && dtwPath) drawDTWPath(genuine, forged, dtwPath);
        
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
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr', 
            gap: '15px',
            margin: '20px 0',
            alignItems: 'center'
        }}>
            <div style={{ 
                padding: '15px', 
                backgroundColor: '#f0fdf4', 
                borderRadius: '8px',
                border: '1px solid #bbf7d0'
            }}>
                <div style={{ fontSize: '12px', color: '#166534' }}>Genuine Confidence</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#15803d' }}>
                    {(genuineScore * 100).toFixed(1)}%
                </div>
                <div style={{ 
                    height: '8px', 
                    backgroundColor: '#e5e7eb', 
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginTop: '8px'
                }}>
                    <div style={{ 
                        height: '100%', 
                        width: `${genuineScore * 100}%`,
                        backgroundColor: '#22c55e',
                        transition: 'width 0.3s'
                    }} />
                </div>
            </div>
            
            <div style={{ 
                padding: '15px', 
                backgroundColor: '#fef2f2', 
                borderRadius: '8px',
                border: '1px solid #fecaca'
            }}>
                <div style={{ fontSize: '12px', color: '#991b1b' }}>Forged Confidence</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#b91c1c' }}>
                    {(forgedScore * 100).toFixed(1)}%
                </div>
                <div style={{ 
                    height: '8px', 
                    backgroundColor: '#e5e7eb', 
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginTop: '8px'
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
                    {(Math.abs(genuineScore - forgedScore) * 100).toFixed(1)}%
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
    
    useEffect(() => {
        if (!canvasRef.current || !genuineFeatures || !forgedFeatures) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        const featureNames = ['Speed', 'Pressure', 'Curvature', 'Rhythm', 'Entropy', 'Cadence'];
        const barWidth = 30;
        const gap = 20;
        const startX = 60;
        
        // Draw axes
        ctx.beginPath();
        ctx.strokeStyle = '#e5e7eb';
        ctx.moveTo(startX, 20);
        ctx.lineTo(startX, height - 40);
        ctx.lineTo(width - 20, height - 40);
        ctx.stroke();
        
        // Draw grid lines
        for (let i = 0; i <= 5; i++) {
            const y = height - 40 - (i / 5) * (height - 60);
            ctx.beginPath();
            ctx.strokeStyle = '#f3f4f6';
            ctx.moveTo(startX, y);
            ctx.lineTo(width - 20, y);
            ctx.stroke();
            
            ctx.fillStyle = '#9ca3af';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${(i * 20)}%`, startX - 10, y + 3);
        }
        
        // Draw bars
        featureNames.forEach((name, i) => {
            const x = startX + i * (barWidth * 2 + gap) + 10;
            
            const gVal = genuineFeatures[i] || 0;
            const gHeight = gVal * (height - 60);
            const gY = height - 40 - gHeight;
            
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(x, gY, barWidth, gHeight);
            
            const fVal = forgedFeatures[i] || 0;
            const fHeight = fVal * (height - 60);
            const fY = height - 40 - fHeight;
            
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(x + barWidth, fY, barWidth, fHeight);
            
            ctx.fillStyle = '#4b5563';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(name, x + barWidth, height - 20);
        });
        
    }, [genuineFeatures, forgedFeatures]);
    
    return (
        <div>
            <h4>Biometric Feature Comparison</h4>
            <canvas 
                ref={canvasRef} 
                width={500} 
                height={250}
                style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
        </div>
    );
}

/**
 * Main Forgery Replay Demo Component
 */
export default function ForgeryReplayDemo() {
    const [selectedForgery, setSelectedForgery] = useState('traced');
    const [genuineScore] = useState(0.85);
    const [forgedScore, setForgedScore] = useState(0.45);
    
    // Simulated data for demo
    const genuineSignature = useMemo(() => [
        { x: 50, y: 100 }, { x: 70, y: 90 }, { x: 90, y: 85 }, { x: 110, y: 90 },
        { x: 130, y: 100 }, { x: 150, y: 115 }, { x: 170, y: 130 }, { x: 190, y: 145 },
        { x: 210, y: 155 }, { x: 230, y: 160 }, { x: 250, y: 155 }, { x: 270, y: 145 }
    ], []);
    
    const forgedSignatures = useMemo(() => ({
        traced: genuineSignature.map(p => ({ ...p, x: p.x + 5, y: p.y + 3 })),
        fast: genuineSignature.map(p => ({ ...p, x: p.x + 10, y: p.y + 8 })),
        distorted: genuineSignature.map((p, i) => ({ 
            ...p, 
            x: p.x + Math.sin(i * 0.5) * 10,
            y: p.y + Math.cos(i * 0.5) * 10
        })),
        random: [
            { x: 50, y: 85 }, { x: 80, y: 110 }, { x: 110, y: 95 }, { x: 140, y: 130 },
            { x: 170, y: 105 }, { x: 200, y: 140 }, { x: 230, y: 115 }, { x: 250, y: 90 }
        ]
    }), [genuineSignature]);
    
    const genuineFeatures = useMemo(() => [0.8, 0.7, 0.9, 0.6, 0.8, 0.7], []);
    const forgedFeatures = useMemo(() => [0.4, 0.3, 0.5, 0.2, 0.4, 0.3], []);
    
    const handleForgerySelect = useCallback((type) => {
        setSelectedForgery(type);
        const scores = {
            traced: 0.55,
            fast: 0.40,
            distorted: 0.30,
            random: 0.15
        };
        setForgedScore(scores[type] || 0.45);
    }, []);
    
    const mockDTWPath = useMemo(() => [
        [0,0], [1,1], [2,2], [3,3], [4,4], [5,5],
        [6,6], [7,7], [8,8], [9,9], [10,10], [11,11]
    ], []);
    
    return (
        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10px', color: '#1f2937' }}>
                🛡️ Forgery &amp; Replay Detection Visualizer
            </h2>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
                Simulate how BioP2 detects various signature forgery types using hybrid DTW, Siamese neural network embeddings, and behavioral dynamics.
            </p>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                {['traced', 'fast', 'distorted', 'random'].map(type => (
                    <button
                        key={type}
                        onClick={() => handleForgerySelect(type)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: selectedForgery === type ? '#3b82f6' : '#fff',
                            color: selectedForgery === type ? '#fff' : '#374151',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            fontWeight: '500'
                        }}
                    >
                        {type} Forgery
                    </button>
                ))}
            </div>
            
            <SignatureComparison 
                genuine={genuineSignature}
                forged={forgedSignatures[selectedForgery]}
                dtwPath={mockDTWPath}
            />
            
            <ConfidenceComparison 
                genuineScore={genuineScore}
                forgedScore={forgedScore}
            />
            
            <FeatureDifference 
                genuineFeatures={genuineFeatures}
                forgedFeatures={forgedFeatures}
            />
        </div>
    );
}
