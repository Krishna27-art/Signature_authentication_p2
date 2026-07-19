import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';

const SignatureCanvas = forwardRef(({ onStrokeChange }, ref) => {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const activePointerId = useRef(null);
  const strokes = useRef([]);
  const livePoints = useRef([]);
  const [strokeCount, setStrokeCount] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1a2e';
  }, []);

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      strokes.current = [];
      livePoints.current = [];
      isDrawing.current = false;
      activePointerId.current = null;
      setStrokeCount(0);
      if (onStrokeChange) onStrokeChange(0);
    },
    getRawPoints: () => {
      const all = [...strokes.current];
      if (livePoints.current.length > 0) all.push([...livePoints.current]);
      if (!all.length) return [];
      
      const merged = [];
      all.forEach((st, si) => {
        st.forEach((p, pi) => {
          const prevStroke = all[si - 1];
          if (pi === 0 && prevStroke?.length) {
            const gap = p.t - prevStroke[prevStroke.length - 1].t;
            merged.push({ ...p, _strokeGap: gap });
            return;
          }
          merged.push({ ...p });
        });
      });
      return merged;
    },
    getCanvas: () => canvasRef.current,
    getStrokes: () => {
      const all = [...strokes.current];
      if (livePoints.current.length > 0) all.push([...livePoints.current]);
      return all.map((stroke) => stroke.map((p) => ({ ...p })));
    },
  }));

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
      p: e.pressure || (e.touches ? 0.5 : 0.5),
      t: now,
      tx: e.tiltX || 0,
      ty: e.tiltY || 0,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    if (isDrawing.current) return;
    isDrawing.current = true;
    activePointerId.current = e.pointerId ?? null;
    const pos = getPos(e);
    livePoints.current = [pos];
    if (canvasRef.current?.setPointerCapture && e.pointerId != null) {
      try {
        canvasRef.current.setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture is a best-effort mobile stability improvement.
      }
    }
    
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setStrokeCount(strokes.current.length + 1);
    if (onStrokeChange) onStrokeChange(strokes.current.length + 1);
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    if (activePointerId.current != null && e.pointerId != null && e.pointerId !== activePointerId.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const prev = livePoints.current[livePoints.current.length - 1];
    livePoints.current.push(pos);
    
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (canvasRef.current?.releasePointerCapture && activePointerId.current != null) {
      try {
        canvasRef.current.releasePointerCapture(activePointerId.current);
      } catch {
        // Safe to ignore if the pointer was already released by the browser.
      }
    }
    activePointerId.current = null;
    if (livePoints.current.length > 0) {
      strokes.current.push([...livePoints.current]);
      setStrokeCount(strokes.current.length);
      if (onStrokeChange) onStrokeChange(strokes.current.length);
    }
    livePoints.current = [];
  };

  return (
    <div className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        width={330}
        height={330}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        onPointerCancel={stopDrawing}
        style={{ touchAction: 'none', width: '100%', height: 'auto' }}
      />
      {strokeCount === 0 && !isDrawing.current && <div className="canvas-hint">✍ Draw here</div>}
    </div>
  );
});

export default SignatureCanvas;
