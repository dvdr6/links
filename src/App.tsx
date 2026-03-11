import { useState, useEffect, useRef, useCallback } from 'react';
import { compressURL, decompressURL } from './compress';
import { drawQR } from './qr';

function App() {
  const [mode, setMode] = useState<string>('loading');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [error, setError] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [originalLen, setOriginalLen] = useState(0);
  const [shortLen, setShortLen] = useState(0);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string }>>([]);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastId = useRef(0);

  useEffect(function () {
    const hash = window.location.hash.substring(1);
    if (!hash) {
      setMode('main');
      return;
    }
    const decoded = decompressURL(hash);
    if (decoded && (decoded.indexOf('http://') === 0 || decoded.indexOf('https://') === 0)) {
      setRedirectUrl(decoded);
      setMode('redirect');
      setTimeout(function () {
        window.location.replace(decoded);
      }, 700);
    } else {
      setMode('error');
    }
  }, []);

  useEffect(function () {
    if (shortUrl && qrRef.current) {
      try {
        drawQR(qrRef.current, shortUrl, 140, '#360077', '#ffffff');
      } catch (e) {
        console.warn('QR error', e);
      }
    }
  }, [shortUrl]);

  const addToast = useCallback(function (msg: string) {
    const id = ++toastId.current;
    setToasts(function (prev) { return prev.concat([{ id: id, msg: msg }]); });
    setTimeout(function () {
      setToasts(function (prev) { return prev.filter(function (t) { return t.id !== id; }); });
    }, 2500);
  }, []);

  function handleShrink() {
    let raw = inputUrl.trim();
    if (!raw) {
      setError('Please enter a URL to shrink.');
      return;
    }
    if (raw.indexOf('http://') !== 0 && raw.indexOf('https://') !== 0) {
      raw = 'https://' + raw;
      setInputUrl(raw);
    }
    try {
      const u = new URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        setError("That doesn't look like a valid URL.");
        return;
      }
    } catch {
      setError("That doesn't look like a valid URL.");
      return;
    }
    setError('');
    const compressed = compressURL(raw);
    if (!compressed) {
      setError('Failed to encode the URL.');
      return;
    }
    const base = window.location.origin + window.location.pathname;
    const result = base + '#' + compressed;
    setShortUrl(result);
    setOriginalLen(raw.length);
    setShortLen(result.length);
    setCopied(false);
    addToast('✨ Link created successfully!');
  }

  function handleCopy() {
    if (!shortUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shortUrl).then(function () {
          doCopied();
        }).catch(function () {
          fallbackCopy();
        });
      } else {
        fallbackCopy();
      }
    } catch {
      fallbackCopy();
    }
  }

  function fallbackCopy() {
    const ta = document.createElement('textarea');
    ta.value = shortUrl;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    document.body.removeChild(ta);
    doCopied();
  }

  function doCopied() {
    setCopied(true);
    addToast('📋 Copied to clipboard!');
    setTimeout(function () { setCopied(false); }, 2500);
  }

  function downloadQR() {
    if (!qrRef.current) return;
    const link = document.createElement('a');
    link.download = 'shrinkly-qr.png';
    link.href = qrRef.current.toDataURL('image/png');
    link.click();
    addToast('⬇️ QR code downloaded!');
  }

  // Redirect overlay
  if (mode === 'redirect') {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#08001a',
        color: '#fff', padding: 20, zIndex: 10000, fontFamily: 'Inter, sans-serif'
      }}>
        <div className="animate-pulse-logo" style={{
          width: 64, height: 64, borderRadius: 16, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 28,
          fontWeight: 800, background: '#8000ff', marginBottom: 24,
          boxShadow: '0 0 20px rgba(128,0,255,0.4)', color: '#fff'
        }}>S←</div>
        <p style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Redirecting you…</p>
        <p style={{
          fontFamily: 'monospace', fontSize: 13, color: '#c5a6ff',
          maxWidth: 500, textAlign: 'center', wordBreak: 'break-all', opacity: 0.8
        }}>{redirectUrl}</p>
        <div className="animate-spin-custom" style={{
          width: 28, height: 28, borderRadius: '50%', marginTop: 20,
          border: '3px solid #5903af', borderTopColor: '#943bff'
        }} />
      </div>
    );
  }

  // Error state
  if (mode === 'error') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#08001a',
        color: '#fff', padding: 20, fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😵</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Invalid Link</h2>
        <p style={{ color: '#ddcdff', fontSize: 15, marginBottom: 24 }}>
          This shortened link appears to be corrupted or invalid.
        </p>
        <a href="./" style={{
          padding: '12px 28px', background: '#8c14ff', color: '#fff',
          textDecoration: 'none', borderRadius: 10, fontWeight: 600, fontSize: 15
        }}>Create a new link</a>
      </div>
    );
  }

  // Loading
  if (mode === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#08001a'
      }}>
        <div className="animate-spin-custom" style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid #5903af', borderTopColor: '#943bff'
        }} />
      </div>
    );
  }

  // Main UI
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: '#08001a', color: '#fff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      {/* Navbar */}
      <nav style={{
        padding: '0 24px', height: 64, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
        background: '#360077', boxShadow: '0 2px 20px rgba(0,0,0,0.35)',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <a href="./" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <div style={{
            width: 40, height: 40, background: '#8000ff', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: -1,
            boxShadow: '0 2px 8px rgba(128,0,255,0.4)'
          }}>S←</div>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: -0.5 }}>Shrinkly</span>
        </a>
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{
          color: '#fff', opacity: 0.7, display: 'flex', alignItems: 'center',
          padding: 8, textDecoration: 'none'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </a>
      </nav>

      {/* Main */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '60px 20px 80px', position: 'relative'
      }}>
        {/* Glow */}
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          top: -100, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(128,0,255,0.12) 0%, transparent 70%)'
        }} />

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 44, maxWidth: 600, position: 'relative', zIndex: 1 }}>
          <span className="animate-snip" style={{ fontSize: 48, marginBottom: 12, display: 'block' }}>✂️</span>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 800, color: '#fff', marginBottom: 8, letterSpacing: -1, lineHeight: 1.1 }}>
            Make your links{' '}
            <span style={{
              background: 'linear-gradient(135deg, #943bff, #ab73ff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>tiny.</span>
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2.5vw, 19px)', color: '#ddcdff', lineHeight: 1.5 }}>
            Stateless link shortening. No servers. No tracking. Just math.
          </p>
        </div>

        {/* Input */}
        <div style={{ width: '100%', maxWidth: 680, marginBottom: 32, position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'flex', flexWrap: 'wrap', borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3), 0 0 0 1.5px #360077'
          }}>
            <input
              ref={inputRef}
              type="url"
              value={inputUrl}
              onChange={function (e) { setInputUrl(e.target.value); setError(''); }}
              onKeyDown={function (e) { if (e.key === 'Enter') handleShrink(); }}
              placeholder="Paste your long URL here…"
              autoComplete="off"
              spellCheck={false}
              style={{
                flex: '1 1 200px', padding: '16px 20px', border: 'none', outline: 'none',
                fontSize: 16, fontFamily: 'Inter, sans-serif', background: '#360077',
                color: '#fff', minWidth: 0, borderRadius: 0
              }}
            />
            <button
              onClick={handleShrink}
              style={{
                padding: '16px 28px', background: '#8c14ff', color: '#fff', border: 'none',
                fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: 0.3,
                minHeight: 52, flex: '0 0 auto'
              }}
            >Shrink it ✨</button>
          </div>
          {error && (
            <div style={{ marginTop: 10, color: '#e05c4d', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠</span><span>{error}</span>
            </div>
          )}
        </div>

        {/* Result */}
        {shortUrl && (
          <div className="animate-slide-up" style={{
            width: '100%', maxWidth: 680, background: '#360077', borderRadius: 16,
            padding: '28px 28px 24px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.08)', position: 'relative', zIndex: 1
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#c5a6ff', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>
              Your shrunk link
            </div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
              background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '4px 4px 4px 16px',
              marginBottom: 20, border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div style={{
                flex: '1 1 200px', fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
                color: '#fff', wordBreak: 'break-all', padding: '10px 0', lineHeight: 1.5, minWidth: 0
              }}>{shortUrl}</div>
              <button onClick={handleCopy} style={{
                padding: '10px 18px', background: copied ? '#5a9a6e' : '#8c14ff', color: '#fff',
                border: 'none', borderRadius: 8, fontFamily: 'Inter, sans-serif', fontSize: 14,
                fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex',
                alignItems: 'center', gap: 6, minHeight: 44, flex: '0 0 auto'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: '#ab73ff', display: 'flex', alignItems: 'center', gap: 6 }}>
                📏 Original: <strong style={{ color: '#fff', fontWeight: 600 }}>{originalLen}</strong> chars
              </div>
              <div style={{ fontSize: 13, color: '#ab73ff', display: 'flex', alignItems: 'center', gap: 6 }}>
                📐 Shrunk: <strong style={{ color: '#fff', fontWeight: 600 }}>{shortLen}</strong> chars
              </div>
            </div>

            {/* QR */}
            <div style={{
              marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap'
            }}>
              <div style={{ background: '#fff', padding: 12, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <canvas ref={qrRef} width={140} height={140} style={{ display: 'block', borderRadius: 4 }} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <p style={{ fontSize: 13, color: '#ab73ff', lineHeight: 1.5, marginBottom: 10 }}>
                  Scan this QR code to open your link on any device.
                </p>
                <button onClick={downloadQR} style={{
                  padding: '8px 16px', background: 'transparent', color: '#c5a6ff',
                  border: '1.5px solid #c5a6ff', borderRadius: 8, fontFamily: 'Inter, sans-serif',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 40
                }}>⬇ Download QR</button>
              </div>
            </div>
          </div>
        )}

        {/* How it works */}
        <div style={{ width: '100%', maxWidth: 680, marginTop: 56, position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 28 }}>How it works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {[
              { n: 1, t: 'Paste', d: 'Drop in any long URL you want to shrink.' },
              { n: 2, t: 'Encode', d: 'Your URL is encoded into the link itself. No database needed.' },
              { n: 3, t: 'Share', d: 'Copy your link or QR code. It works forever.' }
            ].map(function (item) {
              return (
                <div key={item.n} style={{
                  background: '#1e0050', border: '1.5px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: '24px 18px', textAlign: 'center'
                }}>
                  <div style={{
                    width: 36, height: 36, background: '#8c14ff', color: '#fff', borderRadius: '50%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 16, marginBottom: 12
                  }}>{item.n}</div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{item.t}</h3>
                  <p style={{ fontSize: 13, color: '#ab73ff', lineHeight: 1.5 }}>{item.d}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Good to know */}
        <div style={{
          width: '100%', maxWidth: 680, marginTop: 36, background: '#1e0050',
          border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 24px',
          position: 'relative', zIndex: 1
        }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: '#c5a6ff', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            💡 Good to know
          </h4>
          <ul style={{ listStyle: 'none', display: 'grid', gap: 6 }}>
            {[
              'Links are only as permanent as the hosted page',
              'Encoded URLs may be longer than the original for short URLs',
              'No analytics, no custom slugs — pure simplicity',
              'Self-contained — the destination is encoded in the URL itself'
            ].map(function (text, i) {
              return (
                <li key={i} style={{ fontSize: 13, color: '#ab73ff', paddingLeft: 20, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, fontSize: 12 }}>⚠️</span>
                  {text}
                </li>
              );
            })}
          </ul>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '24px 20px', textAlign: 'center', color: '#ab73ff', fontSize: 14,
        borderTop: '1px solid rgba(255,255,255,0.06)', background: '#1e0050'
      }}>
        Made with <span style={{ color: '#943bff' }}>♥</span> · No tracking · 100% static
        <div style={{ marginTop: 6, fontSize: 12, color: '#5903af', fontStyle: 'italic' }}>
          Shrinkly — Stateless link shortening. No servers. No tracking. Just math.
        </div>
      </footer>

      {/* Toasts */}
      <div style={{
        position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
        alignItems: 'center', pointerEvents: 'none'
      }}>
        {toasts.map(function (t) {
          return (
            <div key={t.id} className="animate-toast" style={{
              background: '#360077', color: '#fff', padding: '12px 24px', borderRadius: 10,
              fontSize: 14, fontWeight: 600, boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', gap: 8,
              border: '1px solid rgba(255,255,255,0.1)'
            }}>{t.msg}</div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
