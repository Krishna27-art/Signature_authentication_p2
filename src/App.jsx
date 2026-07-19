import { useState, useEffect, useRef } from 'react';
import { BDB, readState, enrollSample, verifySample, ENROLL_N } from './lib/biometrics';
import { loadImageModel } from './lib/image_model';
import SignatureCanvas from './components/SignatureCanvas';
import VisualizationDashboard from './components/VisualizationDashboard';
import ForgeryReplayDemo from './components/ForgeryReplayDemo';
import BenchmarkDashboard from './components/BenchmarkDashboard';
import PerformanceProfiler from './components/PerformanceProfiler';
import { getUserProfile } from './lib/user_manager';
import { getDeviceCalibration } from './lib/device_calibration';

/* ─────────────────────────────────────────────────────────────────
   BUG FIX (was: !!appState?.template)
   After the A10 audit fix ns.template was set to null intentionally.
   Enrollment state must be determined by anchorSamples presence.
───────────────────────────────────────────────────────────────── */
const getIsEnrolled = (state) =>
  !!(state?.anchorSamples?.length > 0);

function App() {
  const [activeTab, setActiveTab] = useState('lock');
  const [appState, setAppState]   = useState(null);
  const [partials, setPartials]   = useState([]);
  const [status, setStatus]       = useState({ msg: '✍️ Draw your signature to begin', type: 'info' });
  const [imageModelStatus, setImageModelStatus]   = useState('Loading…');
  const [behaviorModelInfo, setBehaviorModelInfo] = useState('Loading…');
  const [modelsReady, setModelsReady] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [deviceInfo, setDeviceInfo]   = useState('Mouse / Touch');
  const [lastExplanation, setLastExplanation] = useState(null);
  const sigCanvasRef = useRef(null);

  // ── Boot ──────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        await BDB.init();
        const state = await readState();
        setAppState(state);

        const p = await BDB.get('partials', []);
        setPartials(p);

        const profile = getUserProfile('primary_user');
        setUserProfile(profile);

        const cal = getDeviceCalibration();
        if (cal?.profile?.pointerType) {
          setDeviceInfo(
            `${cal.profile.pointerType.toUpperCase()} Pointer (${cal.profile.maxTouchPoints || 1} pts)`
          );
        }

        loadImageModel()
          .then(() => setImageModelStatus('Ready ✓'))
          .catch(() => setImageModelStatus('Unavailable'));

        setBehaviorModelInfo(state?.siameseTrained ? 'Siamese BiLSTM ✓' : 'DTW Active ✓');
        setModelsReady(true);
      } catch (err) {
        setStatus({ msg: `❌ ${err.message}`, type: 'error' });
      }
    };
    init();
  }, []);

  // ── Enroll / Verify ───────────────────────────────────────────
  const handleAction = async () => {
    if (!sigCanvasRef.current) return;
    const raw = sigCanvasRef.current.getRawPoints();
    if (!raw || raw.length < 20) {
      setStatus({ msg: '✍️ Please draw your signature first', type: 'warn' });
      return;
    }

    const isEnrolled = getIsEnrolled(appState);

    try {
      if (!isEnrolled) {
        // ── ENROLL ──────────────────────────────────────────────
        if (partials.length === ENROLL_N - 1) {
          setStatus({ msg: '🧠 Registering biometrics… please wait', type: 'info' });
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
          setBehaviorModelInfo('Siamese BiLSTM ✓');
          setStatus({ msg: '✅ Enrollment complete! Draw to verify.', type: 'ok' });
        } else {
          const p = await BDB.get('partials', []);
          setPartials(p);
          setStatus({
            msg: `✅ Sample ${result.progress} of ${ENROLL_N} saved — sign again!`,
            type: 'info',
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
        setLastExplanation(result.explanation || null);

        if (result.pass) {
          setStatus({ msg: `🔓 Access Granted — ${Math.round(result.score)}% match`, type: 'ok' });
          setBehaviorModelInfo('Verified ✓');
        } else {
          setStatus({ msg: `🔒 Not Matched — ${Math.round(result.score)}% match`, type: 'error' });
        }

        sigCanvasRef.current.clear();
      }
    } catch (e) {
      console.error(e);
      setStatus({ msg: `❌ ${e.message || 'Error processing signature'}`, type: 'error' });
    }
  };

  // ── Reset ─────────────────────────────────────────────────────
  const resetAll = async () => {
    if (!window.confirm('Delete all signature data and start fresh?')) return;
    localStorage.removeItem('p2_salt');
    const req = indexedDB.deleteDatabase('BiometricP2');
    const reload = () => window.location.reload();
    req.onsuccess = reload;
    req.onerror   = reload;
    req.onblocked = reload;
    setTimeout(reload, 1000);
  };

  // ── Loading ───────────────────────────────────────────────────
  if (!appState) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <div className="loading-text">Preparing Secure Environment…</div>
      </div>
    );
  }

  const isEnrolled = getIsEnrolled(appState);
  const enrollStep = partials.length + 1;

  const btnLabel = isEnrolled
    ? '🔓 Verify Signature'
    : `💾 Save Sample ${enrollStep} of ${ENROLL_N}`;

  const TABS = [
    { id: 'lock',          label: '🔐 Lock & Verify' },
    { id: 'visualization', label: '📊 Analytics' },
    { id: 'forgery',       label: '🛡️ Forgery Demo' },
    { id: 'benchmarks',    label: '📈 Benchmarks' },
    { id: 'profiler',      label: '⚡ Profiler' },
  ];

  return (
    <div className="app-shell">

      {/* ── Top Navigation ─────────────────────────────────── */}
      <header className="top-nav">
        <div className="nav-brand">
          <span className="nav-brand-icon">🖋️</span>
          <div>
            <div className="nav-brand-title">BioP2 Signature</div>
            <div className="nav-brand-sub">
              {userProfile?.name || 'Primary User'} · {deviceInfo}
            </div>
          </div>
        </div>

        <nav className="nav-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="main-content">

        {/* ── Lock & Verify Screen ──────────────────────────── */}
        {activeTab === 'lock' && (
          <div className="phone-shell">
            <div className="phone-inner">

              {/* Header */}
              <div className="phone-header">
                <div className="phone-title">
                  {isEnrolled ? '🔐 Signature Lock' : '📝 Set Up Signature'}
                </div>
                <div className="phone-subtitle">
                  {isEnrolled
                    ? 'Draw your signature to authenticate'
                    : 'Sign three times to register your biometric'}
                </div>
              </div>

              {/* Progress dots (only during enrollment) */}
              {!isEnrolled && (
                <div className="enroll-progress">
                  {Array.from({ length: ENROLL_N }).map((_, i) => {
                    const filled = i < partials.length;
                    const active = i === partials.length;
                    return (
                      <div
                        key={i}
                        className={`enroll-dot${filled ? ' filled' : ''}${active ? ' active' : ''}`}
                      />
                    );
                  })}
                </div>
              )}

              {/* Canvas — SignatureCanvas renders its own canvas-wrapper */}
              <SignatureCanvas
                ref={sigCanvasRef}
                onStrokeChange={() => {}}
              />

              {/* Status */}
              <div className={`status-pill ${status.type}`}>{status.msg}</div>

              {/* Biometric Explanation */}
              {lastExplanation?.explanation && (
                <div className="explanation-card">
                  <strong>
                    {typeof lastExplanation.explanation === 'string'
                      ? 'Biometric Breakdown'
                      : (lastExplanation.explanation.title || 'Biometric Breakdown')}
                  </strong>
                  <div style={{ marginTop: '4px' }}>
                    {typeof lastExplanation.explanation === 'string'
                      ? lastExplanation.explanation
                      : lastExplanation.explanation.message}
                  </div>
                  {lastExplanation.explanation.tips && lastExplanation.explanation.tips.length > 0 && (
                    <ul style={{ marginTop: '6px', paddingLeft: '16px', fontSize: '11px' }}>
                      {lastExplanation.explanation.tips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Model Status */}
              <div className="model-status-bar">
                <div title="Xenova/mobilevit-small vision embedding">
                  📸 Vision AI: <strong>{modelsReady ? imageModelStatus : 'Loading…'}</strong>
                </div>
                <div title="Siamese BiLSTM + DTW behavioral model">
                  🧠 Behavior: <strong>{behaviorModelInfo}</strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="btn-row">
                <button className="btn btn-primary" onClick={handleAction}>
                  {btnLabel}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    sigCanvasRef.current?.clear();
                  }}
                >
                  Clear
                </button>
              </div>

              {/* Reset */}
              <div className="reset-row">
                <button className="btn btn-danger" onClick={resetAll}>
                  Reset & Re-enroll
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ── Other Tabs ──────────────────────────────────────── */}
        {activeTab === 'visualization' && (
          <div className="tab-panel"><VisualizationDashboard /></div>
        )}
        {activeTab === 'forgery' && (
          <div className="tab-panel"><ForgeryReplayDemo /></div>
        )}
        {activeTab === 'benchmarks' && (
          <div className="tab-panel"><BenchmarkDashboard /></div>
        )}
        {activeTab === 'profiler' && (
          <div className="tab-panel"><PerformanceProfiler /></div>
        )}

      </main>
    </div>
  );
}

export default App;
