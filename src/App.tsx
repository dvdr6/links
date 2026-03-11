import { useState, useEffect, useRef, useCallback } from 'react';
import LZString from 'lz-string';
import { renderQRToCanvas } from './qr';

type AppMode = 'loading' | 'main' | 'redirect' | 'error';

interface Toast {
  id: number;
  msg: string;
}

export default function App() {
  const [mode, setMode] = useState<AppMode>('loading');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [error, setError] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [originalLen, setOriginalLen] = useState(0);
  const [shortLen, setShortLen] = useState(0);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);

  // On mount: check for hash-based redirect
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (!hash) {
      setMode('main');
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }

    try {
      const decoded = LZString.decompressFromEncodedURIComponent(hash);
      if (decoded && /^https?:\/\//i.test(decoded)) {
        setRedirectUrl(decoded);
        setMode('redirect');
        setTimeout(() => {
          window.location.replace(decoded);
        }, 700);
      } else {
        setMode('error');
      }
    } catch {
      setMode('error');
    }
  }, []);

  // Generate QR when shortUrl changes
  useEffect(() => {
    if (shortUrl && qrCanvasRef.current) {
      try {
        renderQRToCanvas(qrCanvasRef.current, shortUrl, 140, '#360077', '#ffffff');
      } catch (e) {
        console.error('QR generation failed:', e);
      }
    }
  }, [shortUrl]);

  const addToast = useCallback((msg: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2500);
  }, []);

  const handleShrink = useCallback(() => {
    let raw = inputUrl.trim();
    if (!raw) {
      setError('Please enter a URL to shrink.');
      return;
    }

    if (!/^https?:\/\//i.test(raw)) {
      raw = 'https://' + raw;
      setInputUrl(raw);
    }

    try {
      const u = new URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
    } catch {
      setError("That doesn't look like a valid URL. Try again.");
      return;
    }

    setError('');

    const compressed = LZString.compressToEncodedURIComponent(raw);
    const base = window.location.origin + window.location.pathname;
    const result = base + '#' + compressed;

    setShortUrl(result);
    setOriginalLen(raw.length);
    setShortLen(result.length);
    setCopied(false);

    addToast('✨ Link shrunk successfully!');
  }, [inputUrl, addToast]);

  const handleCopy = useCallback(async () => {
    if (!shortUrl) return;
    try {
      await navigator.clipboard.writeText(shortUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shortUrl;
      ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    addToast('📋 Copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  }, [shortUrl, addToast]);

  const downloadQR = useCallback(() => {
    if (!qrCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'shrinkly-qr.png';
    link.href = qrCanvasRef.current.toDataURL('image/png');
    link.click();
    addToast('⬇️ QR code downloaded!');
  }, [addToast]);

  // === REDIRECT OVERLAY ===
  if (mode === 'redirect') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center z-[10000] text-white p-5" style={{ background: '#08001a' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-extrabold mb-6 animate-glow-pulse" style={{ background: '#8000ff', boxShadow: '0 0 20px rgba(128,0,255,0.4)' }}>
          S←
        </div>
        <p className="text-lg font-medium mb-2">Redirecting you…</p>
        <p className="font-mono text-sm max-w-[500px] text-center break-all opacity-80" style={{ color: '#c5a6ff' }}>
          {redirectUrl}
        </p>
        <div className="w-7 h-7 rounded-full animate-spin mt-5" style={{ border: '3px solid #5903af', borderTopColor: '#943bff' }} />
      </div>
    );
  }

  // === ERROR STATE ===
  if (mode === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-white p-5" style={{ background: '#08001a' }}>
        <div className="text-5xl mb-4">😵</div>
        <h2 className="text-2xl font-bold mb-2">Invalid Link</h2>
        <p className="text-base mb-6" style={{ color: '#ddcdff' }}>This shortened link appears to be corrupted or invalid.</p>
        <a
          href="./"
          className="px-7 py-3 text-white rounded-xl font-semibold transition-colors min-h-11 inline-block no-underline"
          style={{ background: '#8c14ff' }}
        >
          Create a new link
        </a>
      </div>
    );
  }

  // === LOADING ===
  if (mode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#08001a' }}>
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid #5903af', borderTopColor: '#943bff' }} />
      </div>
    );
  }

  // === MAIN UI ===
  return (
    <div className="min-h-screen flex flex-col text-white" style={{ background: '#08001a' }}>
      {/* Navbar */}
      <nav className="px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-50" style={{ background: '#360077', boxShadow: '0 2px 20px rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <a href="./" className="flex items-center gap-3 no-underline">
          <div className="w-10 h-10 rounded-[10px] flex items-center justify-center font-extrabold text-lg text-white tracking-tighter shrink-0" style={{ background: '#8000ff', boxShadow: '0 2px 8px rgba(128,0,255,0.4)' }}>
            S←
          </div>
          <span className="text-xl sm:text-[22px] font-bold text-white tracking-tight">Shrinkly</span>
        </a>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener"
          className="text-white opacity-70 hover:opacity-100 transition-opacity p-2 -mr-2"
          title="View on GitHub"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </a>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-4 sm:px-5 py-10 sm:py-16 relative">
        {/* Glow accent */}
        <div className="absolute w-[400px] h-[400px] rounded-full -top-24 left-1/2 -translate-x-1/2 pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(128,0,255,0.15) 0%, transparent 70%)' }} />

        {/* Hero */}
        <div className="text-center mb-8 sm:mb-11 max-w-xl relative z-10">
          <span className="text-[40px] sm:text-5xl mb-3 block animate-snip">✂️</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-2 tracking-tight leading-tight">
            Make your links{' '}
            <span style={{ background: 'linear-gradient(135deg, #943bff, #ab73ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              tiny.
            </span>
          </h1>
          <p className="text-base sm:text-lg leading-relaxed" style={{ color: '#ddcdff' }}>
            Stateless link shortening. No servers. No tracking. Just math.
          </p>
        </div>

        {/* Input Area */}
        <div className="w-full max-w-[680px] mb-8 relative z-10">
          <div className="flex flex-col sm:flex-row overflow-hidden rounded-2xl transition-shadow" style={{ boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1.5px #360077` }} id="inputWrapper">
            <input
              ref={inputRef}
              type="url"
              value={inputUrl}
              onChange={e => {
                setInputUrl(e.target.value);
                setError('');
              }}
              onKeyDown={e => e.key === 'Enter' && handleShrink()}
              onFocus={() => {
                const el = document.getElementById('inputWrapper');
                if (el) el.style.boxShadow = '0 4px 32px rgba(128,0,255,0.2), 0 0 0 2px #8000ff';
              }}
              onBlur={() => {
                const el = document.getElementById('inputWrapper');
                if (el) el.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3), 0 0 0 1.5px #360077';
              }}
              placeholder="Paste your long URL here…"
              className="flex-1 px-5 py-4 text-white outline-none text-base border-none min-w-0"
              style={{ background: '#360077', color: '#fff' }}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
            />
            <button
              onClick={handleShrink}
              className="px-7 py-4 text-white font-bold text-base transition-all cursor-pointer whitespace-nowrap min-h-[52px] active:scale-[0.97] hover:brightness-110"
              style={{ background: '#8c14ff' }}
            >
              Shrink it ✨
            </button>
          </div>
          {error && (
            <div className="mt-2.5 text-sm font-medium flex items-center gap-1.5" style={{ color: '#e05c4d' }}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Result Card */}
        {shortUrl && (
          <div className="w-full max-w-[680px] rounded-2xl p-5 sm:p-7 animate-slide-up relative z-10" style={{ background: '#360077', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-xs font-semibold uppercase tracking-[1.2px] mb-3" style={{ color: '#c5a6ff' }}>
              Your shrunk link
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-xl p-1 pl-4 mb-5" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex-1 font-mono text-xs sm:text-sm text-white break-all py-2.5 min-w-0 leading-relaxed" style={{ userSelect: 'all' }}>
                {shortUrl}
              </div>
              <button
                onClick={handleCopy}
                className="px-5 py-2.5 rounded-lg font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 min-h-11 hover:-translate-y-0.5"
                style={{ background: copied ? '#5a9a6e' : '#8c14ff' }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4 sm:gap-6 text-sm justify-center sm:justify-start" style={{ color: '#ab73ff' }}>
              <div className="flex items-center gap-1.5">
                📏 Original:{' '}
                <strong className="text-white font-semibold">{originalLen}</strong> chars
              </div>
              <div className="flex items-center gap-1.5">
                📐 Shrunk:{' '}
                <strong className="text-white font-semibold">{shortLen}</strong> chars
              </div>
              <div className="flex items-center gap-1.5">
                {shortLen < originalLen ? (
                  <span className="font-semibold" style={{ color: '#5a9a6e' }}>
                    🎉 {Math.round((1 - shortLen / originalLen) * 100)}% shorter!
                  </span>
                ) : (
                  <span style={{ color: '#ab73ff' }}>ℹ️ Encoded (self-contained)</span>
                )}
              </div>
            </div>

            {/* QR Section */}
            <div className="mt-5 pt-5 flex flex-col sm:flex-row items-center sm:items-start gap-5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="p-3 rounded-xl shrink-0" style={{ background: '#fff' }}>
                <canvas ref={qrCanvasRef} width={140} height={140} className="block rounded" />
              </div>
              <div className="flex-1 text-center sm:text-left min-w-[180px]">
                <p className="text-sm leading-relaxed mb-3" style={{ color: '#ab73ff' }}>
                  Scan this QR code to open your shortened link on any device.
                </p>
                <button
                  onClick={downloadQR}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer min-h-10 hover:brightness-125"
                  style={{ border: '1.5px solid #c5a6ff', color: '#c5a6ff', background: 'transparent' }}
                >
                  ⬇ Download QR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="w-full max-w-[680px] mt-12 sm:mt-14 relative z-10">
          <h2 className="text-xl font-bold text-white text-center mb-7">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { step: 1, title: 'Paste', desc: 'Drop in any long URL you want to shrink.' },
              { step: 2, title: 'Compress', desc: 'Your URL is LZ-compressed & encoded into the link itself.' },
              { step: 3, title: 'Share', desc: 'Copy your link or QR code. It works forever.' },
            ].map(item => (
              <div
                key={item.step}
                className="rounded-2xl p-5 sm:p-6 text-center hover:-translate-y-1 transition-all"
                style={{ background: 'rgba(54,0,119,0.8)', border: '1.5px solid rgba(255,255,255,0.08)' }}
              >
                <div className="w-9 h-9 text-white rounded-full inline-flex items-center justify-center font-bold text-base mb-3" style={{ background: '#8c14ff' }}>
                  {item.step}
                </div>
                <h3 className="text-[15px] font-bold text-white mb-1.5">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#ab73ff' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Good to know */}
        <div className="w-full max-w-[680px] mt-9 rounded-2xl px-5 sm:px-6 py-5 relative z-10" style={{ background: 'rgba(54,0,119,0.8)', border: '1.5px solid rgba(255,255,255,0.08)' }}>
          <h4 className="text-sm font-bold mb-3 flex items-center gap-1.5" style={{ color: '#c5a6ff' }}>
            💡 Good to know
          </h4>
          <ul className="space-y-1.5">
            {[
              'Links are as permanent as the hosted page itself',
              'Uses LZ compression — long URLs compress well, short URLs stay similar',
              'No analytics, no custom slugs — pure simplicity',
              'Self-contained links — the destination is encoded in the URL itself',
            ].map((text, i) => (
              <li key={i} className="text-sm pl-6 relative" style={{ color: '#ab73ff' }}>
                <span className="absolute left-0 text-xs">⚠️</span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-5 text-center text-sm" style={{ color: '#ab73ff', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(54,0,119,0.5)' }}>
        Made with <span style={{ color: '#943bff' }}>♥</span> · No tracking · 100% static
        <div className="mt-1.5 text-xs italic" style={{ color: '#5903af' }}>
          Shrinkly — Stateless link shortening. No servers. No tracking. Just math.
        </div>
      </footer>

      {/* Toast Container */}
      <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="toast-anim text-white px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2"
            style={{ background: '#360077', boxShadow: '0 8px 28px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
