/**
 * BenchmarkDashboard.jsx - Real benchmark evaluation dashboard
 * 
 * Shows:
 * - Genuine vs forged scores
 * - DTW paths
 * - Feature comparison
 * - ROC/DET curves
 * - Accuracy metrics
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Genuine vs Forged Score Distribution
 */
function ScoreDistribution({ genuineScores, forgedScores, width = 400, height = 300 }) {
    const canvasRef = useRef(null);
    
    useEffect(() => {
        if (!canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, width, height);
        
        const padding = 40;
        const graphWidth = width - 2 * padding;
        const graphHeight = height - 2 * padding;
        
        // Create bins
        const numBins = 20;
        const genuineBins = new Array(numBins).fill(0);
        const forgedBins = new Array(numBins).fill(0);
        
        genuineScores.forEach(score => {
            const bin = Math.min(Math.floor(score * numBins), numBins - 1);
            genuineBins[bin]++;
        });
        
        forgedScores.forEach(score => {
            const bin = Math.min(Math.floor(score * numBins), numBins - 1);
            forgedBins[bin]++;
        });
        
        const maxCount = Math.max(...genuineBins, ...forgedBins, 1);
        
        // Draw axes
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
        // Draw genuine scores (green)
        ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
        genuineBins.forEach((count, i) => {
            const barHeight = (count / maxCount) * graphHeight;
            const x = padding + (i / numBins) * graphWidth;
            const y = height - padding - barHeight;
            const barWidth = graphWidth / numBins - 2;
            
            ctx.fillRect(x, y, barWidth, barHeight);
        });
        
        // Draw forged scores (red)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
        forgedBins.forEach((count, i) => {
            const barHeight = (count / maxCount) * graphHeight;
            const x = padding + (i / numBins) * graphWidth;
            const y = height - padding - barHeight;
            const barWidth = graphWidth / numBins - 2;
            
            ctx.fillRect(x, y, barWidth, barHeight);
        });
        
        // Draw labels
        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        
        for (let i = 0; i <= 4; i++) {
            const x = padding + (i / 4) * graphWidth;
            ctx.fillText((i * 25).toString(), x, height - padding + 15);
        }
        
        ctx.textAlign = 'right';
        ctx.fillText('Count', padding - 10, padding + 10);
        
    }, [genuineScores, forgedScores, width, height]);
    
    return (
        <div className="score-distribution">
            <h3>Score Distribution</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <span style={{ color: '#22c55e' }}>● Genuine</span>
                <span style={{ color: '#ef4444' }}>● Forged</span>
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
 * ROC Curve Visualization
 */
function ROCCurve({ rocData, width = 400, height = 300 }) {
    const canvasRef = useRef(null);
    
    useEffect(() => {
        if (!canvasRef.current || !rocData) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, width, height);
        
        const padding = 40;
        const graphWidth = width - 2 * padding;
        const graphHeight = height - 2 * padding;
        
        // Draw axes
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
        // Draw diagonal (random classifier)
        ctx.strokeStyle = '#d1d5db';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(width - padding, padding);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw ROC curve
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        rocData.points.forEach((point, i) => {
            const x = padding + point.fpr * graphWidth;
            const y = height - padding - point.tpr * graphHeight;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
        
        // Draw AUC annotation
        ctx.fillStyle = '#3b82f6';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`AUC: ${rocData.auc.toFixed(3)}`, width - padding, padding - 10);
        
        // Draw labels
        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('False Positive Rate', width / 2, height - 5);
        
        ctx.save();
        ctx.translate(15, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('True Positive Rate', 0, 0);
        ctx.restore();
        
    }, [rocData, width, height]);
    
    return (
        <div className="roc-curve">
            <h3>ROC Curve</h3>
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
 * DET Curve Visualization
 */
function DETCurve({ detData, width = 400, height = 300 }) {
    const canvasRef = useRef(null);
    
    useEffect(() => {
        if (!canvasRef.current || !detData) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, width, height);
        
        const padding = 40;
        const graphWidth = width - 2 * padding;
        const graphHeight = height - 2 * padding;
        
        // Draw axes
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
        // Draw DET curve
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        detData.points.forEach((point, i) => {
            const x = padding + point.far * graphWidth;
            const y = height - padding - point.frr * graphHeight;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
        
        // Draw EER point
        const eerPoint = detData.points.find(p => Math.abs(p.far - p.frr) < 0.01);
        if (eerPoint) {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            const x = padding + eerPoint.far * graphWidth;
            const y = height - padding - eerPoint.frr * graphHeight;
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#ef4444';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('EER', x + 10, y);
        }
        
        // Draw labels
        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('False Accept Rate (%)', width / 2, height - 5);
        
        ctx.save();
        ctx.translate(15, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('False Reject Rate (%)', 0, 0);
        ctx.restore();
        
    }, [detData, width, height]);
    
    return (
        <div className="det-curve">
            <h3>DET Curve</h3>
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
 * Feature Comparison Chart
 */
function FeatureComparison({ genuineFeatures, forgedFeatures, width = 400, height = 300 }) {
    const canvasRef = useRef(null);
    
    useEffect(() => {
        if (!canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, width, height);
        
        const featureNames = ['Velocity', 'Acceleration', 'Pressure', 'Curvature', 'Direction', 'Rhythm'];
        const numFeatures = featureNames.length;
        
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 60;
        
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
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        
        for (let i = 0; i < numFeatures; i++) {
            const angle = (i / numFeatures) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();
            
            const labelX = centerX + (radius + 25) * Math.cos(angle);
            const labelY = centerY + (radius + 25) * Math.sin(angle);
            ctx.fillText(featureNames[i], labelX, labelY + 4);
        }
        
        // Draw genuine features (green)
        if (genuineFeatures && genuineFeatures.length >= numFeatures) {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            
            for (let i = 0; i < numFeatures; i++) {
                const angle = (i / numFeatures) * Math.PI * 2 - Math.PI / 2;
                const value = Math.min(genuineFeatures[i], 1);
                const x = centerX + radius * value * Math.cos(angle);
                const y = centerY + radius * value * Math.sin(angle);
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        
        // Draw forged features (red)
        if (forgedFeatures && forgedFeatures.length >= numFeatures) {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            
            for (let i = 0; i < numFeatures; i++) {
                const angle = (i / numFeatures) * Math.PI * 2 - Math.PI / 2;
                const value = Math.min(forgedFeatures[i], 1);
                const x = centerX + radius * value * Math.cos(angle);
                const y = centerY + radius * value * Math.sin(angle);
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        
    }, [genuineFeatures, forgedFeatures, width, height]);
    
    return (
        <div className="feature-comparison">
            <h3>Feature Comparison</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <span style={{ color: '#22c55e' }}>● Genuine</span>
                <span style={{ color: '#ef4444' }}>● Forged</span>
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
 * Accuracy Metrics Display
 */
function AccuracyMetricsDisplay({ metrics }) {
    if (!metrics) return null;
    
    return (
        <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
        }}>
            <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>Accuracy Metrics</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Accuracy</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                        {(metrics.accuracy * 100).toFixed(2)}%
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>FAR</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                        {(metrics.far * 100).toFixed(2)}%
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>FRR</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                        {(metrics.frr * 100).toFixed(2)}%
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>EER</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>
                        {metrics.eer ? (metrics.eer * 100).toFixed(2) + '%' : 'N/A'}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Precision</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                        {(metrics.precision * 100).toFixed(2)}%
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Recall</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                        {(metrics.recall * 100).toFixed(2)}%
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>F1 Score</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                        {metrics.f1Score.toFixed(3)}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>ROC AUC</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                        {metrics.rocAuc ? metrics.rocAuc.toFixed(3) : 'N/A'}
                    </div>
                </div>
            </div>
            
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Sample Counts</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '5px' }}>
                    <div>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Genuine: </span>
                        <span style={{ fontWeight: 'bold' }}>{metrics.totalGenuine || 0}</span>
                    </div>
                    <div>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Forged: </span>
                        <span style={{ fontWeight: 'bold' }}>{metrics.totalForgeries || 0}</span>
                    </div>
                    <div>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Total: </span>
                        <span style={{ fontWeight: 'bold' }}>{(metrics.totalGenuine || 0) + (metrics.totalForgeries || 0)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Main Benchmark Dashboard Component
 */
export default function BenchmarkDashboard({ evaluationResults }) {
    const [activeTab, setActiveTab] = useState('metrics');
    
    if (!evaluationResults) {
        return (
            <div style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                <h2>Benchmark Dashboard</h2>
                <p style={{ color: '#6b7280' }}>No evaluation data available</p>
            </div>
        );
    }
    
    const { summary, eer, roc, det } = evaluationResults;
    
    // Extract scores for distribution
    const genuineScores = evaluationResults.genuineScores || [];
    const forgedScores = evaluationResults.forgedScores || [];
    
    // Extract average features
    const genuineFeatures = evaluationResults.avgGenuineFeatures;
    const forgedFeatures = evaluationResults.avgForgedFeatures;
    
    return (
        <div style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Benchmark Evaluation Dashboard</h2>
            
            {/* Tab Navigation */}
            <div style={{ 
                display: 'flex', 
                gap: '10px', 
                marginBottom: '20px',
                borderBottom: '2px solid #e5e7eb',
                paddingBottom: '10px'
            }}>
                {['metrics', 'distribution', 'roc', 'det', 'features'].map(tab => (
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
            <div>
                {activeTab === 'metrics' && (
                    <AccuracyMetricsDisplay 
                        metrics={{
                            ...summary,
                            eer: eer?.eer,
                            rocAuc: roc?.auc
                        }}
                    />
                )}
                
                {activeTab === 'distribution' && (
                    <ScoreDistribution 
                        genuineScores={genuineScores}
                        forgedScores={forgedScores}
                    />
                )}
                
                {activeTab === 'roc' && roc && (
                    <ROCCurve rocData={roc} />
                )}
                
                {activeTab === 'det' && det && (
                    <DETCurve detData={det} />
                )}
                
                {activeTab === 'features' && (
                    <FeatureComparison 
                        genuineFeatures={genuineFeatures}
                        forgedFeatures={forgedFeatures}
                    />
                )}
            </div>
        </div>
    );
}
