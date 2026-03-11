import { useState, useEffect, useRef, useCallback } from 'react';
import LZString from 'lz-string';
import QRCode from 'qrcode';

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
      QRCode.toCanvas(qrCanvasRef.current, shortUrl, {
        width: 140,
        margin: 2,
        color: {
          dark: '#360077',
          light: '#ffffff',
        },
      });
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
      <div className="fixed inset-0 bg-bg-deep flex flex-col items-center justify-center z-[10000] text-white p-5">
        <div className="w-16 h-16 bg-ev-700 rounded-2xl flex items-center justify-center text-3xl font-extrabold mb-6 animate-glow-pulse shadow-lg shadow-ev-700/40">
          S←
        </div>
        <p className="text-lg font-medium mb-2">Redirecting you…</p>
        <p className="font-mono text-sm text-ev-300 max-w-[500px] text-center break-all opacity-80">
          {redirectUrl}
        </p>
        <div className="w-7 h-7 border-[3px] border-ev-900 border-t-ev-500 rounded-full animate-spin mt-5" />
      </div>
    );
  }

  // === ERROR STATE ===
  if (mode === 'error') {
    return (
      <div className="min-h-screen min-h-dvh bg-bg-deep flex flex-col items-center justify-center text-white p-5">
        <div className="text-5xl mb-4">😵</div>
        <h2 className="text-2xl font-bold mb-2">Invalid Link</h2>
        <p className="text-ev-200 text-base mb-6">This shortened link appears to be corrupted or invalid.</p>
        <a
          href="./"
          className="px-7 py-3 bg-ev-600 hover:bg-ev-500 text-white rounded-xl font-semibold transition-colors min-h-11"
        >
          Create a new link
        </a>
      </div>
    );
  }

  // === LOADING ===
  if (mode === 'loading') {
    return (
      <div className="min-h-screen min-h-dvh bg-bg-deep flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-ev-900 border-t-ev-500 rounded-full animate-spin" />
      </div>
    );
  }

  // === MAIN UI ===
  return (
    <div className="min-h-screen min-h-dvh flex flex-col bg-bg-deep text-white">
      {/* Navbar */}
      <nav className="bg-ev-950 px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-50 shadow-lg shadow-black/30 border-b border-white/[0.08]">
        <a href="./" className="flex items-center gap-3 no-underline">
          <div className="w-10 h-10 bg-ev-700 rounded-[10px] flex items-center justify-center font-extrabold text-lg text-white tracking-tighter shadow-md shadow-ev-700/40 shrink-0">
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
        <div className="absolute w-[400px] h-[400px] rounded-full -top-24 left-1/2 -translate-x-1/2 pointer-events-none z-0 bg-[radial-gradient(circle,rgba(128,0,255,0.15)_0%,transparent_70%)]" />

        {/* Hero */}
        <div className="text-center mb-8 sm:mb-11 max-w-xl relative z-10">
          <span className="text-[40px] sm:text-5xl mb-3 block animate-snip">✂️</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-2 tracking-tight leading-tight">
            Make your links{' '}
            <span className="bg-gradient-to-br from-ev-500 to-ev-400 bg-clip-text text-transparent">
              tiny.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-ev-200 leading-relaxed">
            Stateless link shortening. No servers. No tracking. Just math.
          </p>
        </div>

        {/* Input Area */}
        <div className="w-full max-w-[680px] mb-8 relative z-10">
          <div className="flex flex-col sm:flex-row overflow-hidden rounded-2xl shadow-xl shadow-black/30 ring-2 ring-ev-900 focus-within:ring-ev-600 transition-shadow">
            <input
              ref={inputRef}
              type="url"
              value={inputUrl}
              onChange={e => {
                setInputUrl(e.target.value);
                setError('');
              }}
              onKeyDown={e => e.key === 'Enter' && handleShrink()}
              placeholder="Paste your long URL here…"
              className="flex-1 px-5 py-4 bg-ev-950 text-white placeholder-ev-400 outline-none text-base border-none min-w-0 appearance-none"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
            />
            <button
              onClick={handleShrink}
              className="px-7 py-4 bg-ev-600 hover:bg-ev-500 active:scale-[0.97] text-white font-bold text-base transition-all cursor-pointer whitespace-nowrap min-h-[52px]"
            >
              Shrink it ✨
            </button>
          </div>
          {error && (
            <div className="mt-2.5 text-red-400 text-sm font-medium flex items-center gap-1.5">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Result Card */}
        {shortUrl && (
          <div className="w-full max-w-[680px] bg-ev-950 rounded-2xl p-5 sm:p-7 animate-slide-up shadow-xl shadow-black/30 border border-white/[0.08] relative z-10">
            <div className="text-xs font-semibold text-ev-300 uppercase tracking-[1.2px] mb-3">
              Your shrunk link
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-black/25 rounded-xl p-1 pl-4 mb-5 border border-white/[0.06]">
              <div className="flex-1 font-mono text-xs sm:text-sm text-white break-all py-2.5 select-all min-w-0 leading-relaxed">
                {shortUrl}
              </div>
              <button
                onClick={handleCopy}
                className={`px-5 py-2.5 rounded-lg font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 min-h-11 ${
                  copied
                    ? 'bg-green-600'
                    : 'bg-ev-600 hover:bg-ev-500 hover:-translate-y-0.5'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4 sm:gap-6 text-sm text-ev-400 justify-center sm:justify-start">
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
                  <span className="text-green-400 font-semibold">
                    🎉 {Math.round((1 - shortLen / originalLen) * 100)}% shorter!
                  </span>
                ) : (
                  <span className="text-ev-400">ℹ️ Encoded (self-contained)</span>
                )}
              </div>
            </div>

            {/* QR Section */}
            <div className="mt-5 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row items-center sm:items-start gap-5">
              <div className="bg-white p-3 rounded-xl shrink-0">
                <canvas ref={qrCanvasRef} width={140} height={140} className="block rounded" />
              </div>
              <div className="flex-1 text-center sm:text-left min-w-[180px]">
                <p className="text-sm text-ev-400 leading-relaxed mb-3">
                  Scan this QR code to open your shortened link on any device.
                </p>
                <button
                  onClick={downloadQR}
                  className="px-4 py-2 border-[1.5px] border-ev-400 text-ev-300 hover:bg-ev-400 hover:text-ev-950 rounded-lg text-sm font-semibold transition-all cursor-pointer min-h-10"
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
              {
                step: 1,
                title: 'Paste',
                desc: 'Drop in any long URL you want to shrink.',
              },
              {
                step: 2,
                title: 'Compress',
                desc: 'Your URL is LZ-compressed & encoded into the link itself.',
              },
              {
                step: 3,
                title: 'Share',
                desc: 'Copy your link or QR code. It works forever.',
              },
            ].map(item => (
              <div
                key={item.step}
                className="bg-ev-950/80 border border-white/[0.08] rounded-2xl p-5 sm:p-6 text-center hover:-translate-y-1 hover:shadow-lg hover:shadow-ev-700/10 hover:border-ev-800 transition-all"
              >
                <div className="w-9 h-9 bg-ev-600 text-white rounded-full inline-flex items-center justify-center font-bold text-base mb-3">
                  {item.step}
                </div>
                <h3 className="text-[15px] font-bold text-white mb-1.5">{item.title}</h3>
                <p className="text-sm text-ev-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Good to know */}
        <div className="w-full max-w-[680px] mt-9 bg-ev-950/80 border border-white/[0.08] rounded-2xl px-5 sm:px-6 py-5 relative z-10">
          <h4 className="text-sm font-bold text-ev-300 mb-3 flex items-center gap-1.5">
            💡 Good to know
          </h4>
          <ul className="space-y-1.5">
            {[
              'Links are as permanent as the hosted page itself',
              'Uses LZ compression — long URLs compress well, short URLs stay similar',
              'No analytics, no custom slugs — pure simplicity',
              'Self-contained links — the destination is encoded in the URL itself',
            ].map((text, i) => (
              <li
                key={i}
                className="text-sm text-ev-400 pl-6 relative"
              >
                <span className="absolute left-0 text-xs">⚠️</span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-5 text-center text-ev-400 text-sm border-t border-white/[0.06] bg-ev-950/50">
        Made with <span className="text-ev-500">♥</span> · No tracking · 100% static
        <div className="mt-1.5 text-xs text-ev-900 italic">
          Shrinkly — Stateless link shortening. No servers. No tracking. Just math.
        </div>
      </footer>

      {/* Toast Container */}
      <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="toast-anim bg-ev-950 text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-xl shadow-black/40 border border-white/10 flex items-center gap-2"
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
