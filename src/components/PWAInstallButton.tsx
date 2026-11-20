import { useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'drawer';
  onAfterTrigger?: () => void;
}

export function PWAInstallButton({ variant = 'compact', onAfterTrigger }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled || (!isInstallable && !isIOS)) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      onAfterTrigger?.();
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  return (
    <>
      {variant === 'drawer' ? (
        <button
          type="button"
          onClick={handleClick}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[var(--theme-primary)] bg-[var(--theme-accent)]/20 border border-[var(--theme-accent)]/60 hover:bg-[var(--theme-accent)]/30 rounded-lg transition-colors cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-[var(--theme-primary)] shrink-0" />
          <span>Pasang Aplikasi ke Layar Utama</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 text-xs font-semibold text-[var(--theme-primary)] bg-[var(--theme-accent)] hover:bg-[var(--theme-accent-light)] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          aria-label="Pasang aplikasi Desa Margamukti"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Pasang Aplikasi</span>
          <span className="sm:hidden">Pasang</span>
        </button>
      )}

      {showIOSModal && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-6 space-y-4 shadow-2xl border-t sm:border border-slate-200 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary)] text-[var(--theme-accent-light)] flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-[var(--theme-primary)]">
                  Pasang di Layar Utama iPhone / iPad
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-md cursor-pointer"
                aria-label="Tutup panduan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <span className="font-mono-tabular font-bold text-[var(--theme-primary)] shrink-0">1.</span>
                <span>
                  Ketuk ikon{' '}
                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--theme-primary)]">
                    Bagikan <Share className="w-4 h-4 inline text-[var(--theme-accent-dark)]" />
                  </span>{' '}
                  pada bilah bawah Safari.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-mono-tabular font-bold text-[var(--theme-primary)] shrink-0">2.</span>
                <span>
                  Gulir ke bawah lalu pilih{' '}
                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--theme-primary)]">
                    <PlusSquare className="w-4 h-4 inline text-[var(--theme-accent-dark)]" /> Tambah ke Layar Utama
                  </span>
                  .
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-mono-tabular font-bold text-[var(--theme-primary)] shrink-0">3.</span>
                <span>
                  Ketuk <strong>Tambah</strong> di pojok kanan atas untuk menjalankan Portal Desa Margamukti seperti aplikasi penuh.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => {
                setShowIOSModal(false);
                onAfterTrigger?.();
              }}
              className="w-full min-h-[44px] py-2.5 text-sm font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-lg cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
