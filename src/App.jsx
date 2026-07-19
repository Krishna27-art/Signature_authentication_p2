import { useState, useEffect, useRef } from 'react';
import { BDB, readState, enrollSample, verifySample, ENROLL_N } from './lib/biometrics';
import { loadImageModel } from './lib/image_model';
import SignatureCanvas from './components/SignatureCanvas';

function App() {
  const [appState,          setAppState]          = useState(null);
  const [partials,          setPartials]           = useState([]);
  const [status,            setStatus]             = useState({ msg: '✏️ Draw your signature', type: 'info' });
  const [imageModelStatus,  setImageModelStatus]   = useState('Loading…');
  const [behaviorModelInfo, setBehaviorModelInfo]  = useState('Loading…');
  const [modelsReady,       setModelsReady]        = useState(false);
  const [verifyCount,       setVerifyCount]        = useState(0); // tracks successful verifications for display
  const sigCanvasRef = useRef(null);

  // ── Boot ────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        await BDB.init();
        const state = await readState();
        setAppState(state);

        const p = await BDB.get('partials', []);
        setPartials(p);

        // Pre-load both AI models in background
        loadImageModel()
          .then(() => setImageModelStatus('Ready ✓'))
          .catch(() => setImageModelStatus('Unavailable'));

        if (state?.siameseTrained) {
          setBehaviorModelInfo('Ready ✓');
        } else {
          setBehaviorModelInfo('Will train on enrollment');
        }

        setModelsReady(true);
      } catch (err) {
        setStatus({ msg: `❌ ${err.message}`, type: 'error' });
      }
    };
    init();
  }, []);

  // ── Core action: Enroll or Verify ──────────────────────────────
  const handleAction = async () => {
    if (!sigCanvasRef.current) return;
    const raw = sigCanvasRef.current.getRawPoints();
    if (raw.length < 20) {
      setStatus({ msg: '✍️ Draw your signature first', type: 'warn' });
      return;
    }

    try {
      const isEnrolled = !!appState?.template;

      if (!isEnrolled) {
        // ── ENROLL ──────────────────────────────────────────────
        if (partials.length === ENROLL_N - 1) {
          setStatus({ msg: '🧠 Training AI models… please wait', type: 'info' });
          await new Promise(r => setTimeout(r, 50));
        }

        const canvas  = sigCanvasRef.current.getCanvas();
        const strokes = sigCanvasRef.current.getStrokes();
        const result  = await enrollSample(raw, appState, partials, canvas, strokes);

        if (result.err) {
          setStatus({ msg: `❌ ${result.err}`, type: 'error' });
          return;
        }

        if (result.done) {
          const newState = await readState();
          setAppState(newState);
          setPartials([]);
          setBehaviorModelInfo(
            newState.siameseTrained
              ? `Trained on ${newState.anchorSamples?.length ?? ENROLL_N} samples ✓`
              : 'Trained ✓'
          );
          setStatus({ msg: '✅ Enrollment complete! Now draw to verify.', type: 'ok' });
        } else {
          const p = await BDB.get('partials', []);
          setPartials(p);
          setStatus({
            msg: `Sample ${result.progress} of ${ENROLL_N} saved. Sign again!`,
            type: 'info'
          });
          sigCanvasRef.current.clear();
        }

      } else {
        // ── VERIFY ──────────────────────────────────────────────
        const canvas  = sigCanvasRef.current.getCanvas();
        const strokes = sigCanvasRef.current.getStrokes();
        const result  = await verifySample(raw, appState, canvas, strokes);

        if (result.err) {
          setStatus({ msg: `❌ ${result.err}`, type: 'error' });
          sigCanvasRef.current.clear();
          return;
        }

        const newState = await readState();
        setAppState(newState);

        if (result.pass) {
          const newCount = verifyCount + 1;
          setVerifyCount(newCount);
          setStatus({ msg: `🔓 Access Granted  (${Math.round(result.score)}% confidence)`, type: 'ok' });

          // Updated status count for UI display
          setBehaviorModelInfo(`Protected with Siamese BiLSTM ✓`);

        } else {
          setStatus({ msg: `🔒 Access Denied  (${Math.round(result.score)}% confidence)`, type: 'error' });
        }

        sigCanvasRef.current.clear();
      }
    } catch (e) {
      console.error(e);
      setStatus({ msg: `❌ ${e.message || 'Error processing signature'}`, type: 'error' });
    }
  };

  // ── Reset ──────────────────────────────────────────────────────
  const resetAll = async () => {
    if (!window.confirm('Delete all signature data and start fresh?')) return;
    localStorage.removeItem('p2_salt');
    const req = indexedDB.deleteDatabase('BiometricP2');
    const reload = () => window.location.reload();
    req.onsuccess = reload; req.onerror = reload; req.onblocked = reload;
    setTimeout(reload, 1000);
  };

  // ── Loading splash ─────────────────────────────────────────────
  if (!appState) {
    return (
      <div className="phone">
        <div className="loading-screen">⚡ Preparing Secure Environment…</div>
      </div>
    );
  }

  const isEnrolled = !!appState?.template;
  const btnLabel   = isEnrolled ? '🔓 Verify Signature' : `💾 Save (${partials.length + 1} of ${ENROLL_N})`;

  return (
    <div className="phone">
      {/* iOS-style status bar */}
      <div className="status-bar">
        <span>9:41</span>
        <div className="notch"></div>
        <div className="icons">
          <i className="fa-solid fa-signal"></i>
          <i className="fa-solid fa-wifi"></i>
          <i className="fa-solid fa-battery-full"></i>
        </div>
      </div>

      <div className="app-container">
        <div className="screen">

          {/* Header */}
          <div className="header">
            <h1>{isEnrolled ? '🔐 Signature Lock' : '📝 Set Up Signature'}</h1>
          </div>

          {/* Sub-instruction */}
          <div className={`status-pill ${isEnrolled ? 'info' : 'warn'}`}>
            {isEnrolled
              ? 'Draw your signature to unlock'
              : `Step ${partials.length + 1} of ${ENROLL_N} — sign your name`}
          </div>

          {/* Signature Canvas */}
          <div className="canvas-wrapper">
            <SignatureCanvas ref={sigCanvasRef} />
            <div className="canvas-hint" style={{ opacity: 0.3, fontSize: '12px', textAlign: 'center', marginTop: '4px' }}>
              Sign above
            </div>
          </div>

          {/* Result status */}
          <div className={`status-pill ${status.type}`}>{status.msg}</div>

          {/* AI Model status — both engines visible */}
          <div className="model-status-bar">
            <div title="Xenova/mobilevit-small — image embedding comparison">
              📸 Vision AI: <strong>{modelsReady ? imageModelStatus : 'Loading…'}</strong>
            </div>
            <div title="Behavioral BiLSTM — adapts to your signing style over time">
              🧠 Behavior NN: <strong>{behaviorModelInfo}</strong>
            </div>
            {verifyCount > 0 && (
              <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '2px' }}>
                🔄 Model has self-improved {verifyCount} time{verifyCount > 1 ? 's' : ''} from your verifications
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="btn-row">
            <button className="btn btn-primary" onClick={handleAction}>
              {btnLabel}
            </button>
            <button className="btn btn-secondary" onClick={() => sigCanvasRef.current?.clear()}>
              Clear
            </button>
          </div>

          {/* Reset — small and subtle */}
          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <button
              className="btn btn-danger"
              style={{ fontSize: '11px', padding: '8px 16px', opacity: 0.4 }}
              onClick={resetAll}
            >
              Reset &amp; Re-enroll
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
