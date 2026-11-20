import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import { SumedangCrest } from '../../components/SumedangCrest';
import { setAdminToken } from '../../utils/adminApi';
import type { User } from '../../types';

interface AdminLoginPageProps {
  onSuccess: (user: User) => void;
  onBackToPublic: () => void;
}

export function AdminLoginPage({ onSuccess, onBackToPublic }: AdminLoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const res = await fetch('/api/auth/captcha');
      const json = await res.json();
      if (res.ok && json.question && json.challengeToken) {
        setCaptchaQuestion(json.question);
        setCaptchaToken(json.challengeToken);
        setCaptchaAnswer('');
      }
    } catch {
      setCaptchaQuestion('Gagal memuat soal');
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken || !captchaAnswer.trim()) {
      setError('Harap isi jawaban verifikasi keamanan (Captcha) terlebih dahulu.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          password,
          captchaToken,
          captchaAnswer: captchaAnswer.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Login gagal. Periksa kembali kredensial dan jawaban Captcha.');
        void loadCaptcha();
        return;
      }
      if (json.token) {
        setAdminToken(json.token);
      }
      onSuccess(json.user);
    } catch {
      setError('Gagal terhubung ke server autentikasi.');
      void loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-[var(--theme-primary)] text-white px-6 sm:px-8 py-6 border-b-4 border-[var(--theme-accent)] flex items-center gap-4">
          <SumedangCrest className="w-12 h-14 shrink-0" />
          <div>
            <p className="text-xs text-[var(--theme-accent-light)] font-semibold uppercase tracking-wider">
              Pemerintah Desa Margamukti
            </p>
            <h1 className="text-xl font-semibold mt-0.5">Portal Admin Pemerintahan</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5" autoComplete="off">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-medium flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Username Operator
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username operator"
              className="w-full px-3.5 py-2.5 min-h-[44px] text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password akun"
              className="w-full px-3.5 py-2.5 min-h-[44px] text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
            />
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700">
                Verifikasi Keamanan (Captcha)
              </label>
              <button
                type="button"
                onClick={() => void loadCaptcha()}
                disabled={captchaLoading}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--theme-primary)] hover:underline cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${captchaLoading ? 'animate-spin' : ''}`} />
                Ganti Soal
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              <div
                aria-label="Soal Captcha"
                className="shrink-0 px-3.5 py-2 min-h-[44px] flex items-center justify-center rounded-md bg-[var(--theme-primary)] text-white font-mono-tabular font-bold text-sm tracking-wider select-none"
              >
                {captchaLoading ? '...' : captchaQuestion || '—'}
              </div>
              <input
                type="number"
                inputMode="numeric"
                required
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                placeholder="Hasil hitungan"
                className="flex-1 min-w-0 px-3.5 py-2 min-h-[44px] text-sm font-mono-tabular border border-slate-300 bg-white rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] text-sm font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md transition-colors disabled:opacity-60 cursor-pointer"
          >
            <Lock className="w-4 h-4 text-[var(--theme-accent-light)]" />
            {loading ? 'Memverifikasi...' : 'Masuk ke Dashboard Admin'}
          </button>

          <button
            type="button"
            onClick={onBackToPublic}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-xs font-medium text-slate-600 hover:text-[var(--theme-primary)] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Portal Publik Warga
          </button>
        </form>
      </div>
    </div>
  );
}
