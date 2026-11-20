import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  Landmark,
  Megaphone,
  Pause,
  Play,
  Sparkles,
  X,
} from 'lucide-react';
import type { ActiveGreetingItem, GreetingTone } from '../types';

export function getGreetingToneMeta(tone: GreetingTone) {
  switch (tone) {
    case 'nasional':
      return {
        bg: 'bg-[#FDF6F5]',
        border: 'border-b border-[#E5C7C4]',
        kicker: 'text-[#991B1B]',
        title: 'text-[#0F2744]',
        body: 'text-slate-700',
        sender: 'text-[#991B1B]',
        btn: 'border-[#D9AAA5] text-[#7F1D1D] hover:bg-[#F9E8E6]',
        label: 'Hari Nasional',
        Icon: Flag,
      };
    case 'religius':
      return {
        bg: 'bg-[#F2F9F5]',
        border: 'border-b border-[#C6E3D2]',
        kicker: 'text-[#166534]',
        title: 'text-[#0F2744]',
        body: 'text-slate-700',
        sender: 'text-[#166534]',
        btn: 'border-[#A7D7BA] text-[#14532D] hover:bg-[#E2F3E9]',
        label: 'Hari Besar Keagamaan',
        Icon: Sparkles,
      };
    case 'daerah':
      return {
        bg: 'bg-[#FCF8EC]',
        border: 'border-b border-[#E6D39A]',
        kicker: 'text-[#926B0E]',
        title: 'text-[#0F2744]',
        body: 'text-slate-700',
        sender: 'text-[#926B0E]',
        btn: 'border-[#D9BF75] text-[#78570A] hover:bg-[#F7EED3]',
        label: 'Daerah & Sumedang',
        Icon: Landmark,
      };
    case 'duka':
      return {
        bg: 'bg-[#F4F5F7]',
        border: 'border-b border-slate-300',
        kicker: 'text-slate-600',
        title: 'text-slate-900',
        body: 'text-slate-700',
        sender: 'text-slate-700',
        btn: 'border-slate-300 text-slate-700 hover:bg-slate-200/70',
        label: 'Belasungkawa Resmi',
        Icon: Megaphone,
      };
    case 'resmi':
    default:
      return {
        bg: 'bg-[#FAF7EE]',
        border: 'border-b border-[var(--theme-accent)]/40',
        kicker: 'text-[var(--theme-accent-dark)]',
        title: 'text-[var(--theme-primary)]',
        body: 'text-slate-700',
        sender: 'text-[var(--theme-primary)]',
        btn: 'border-slate-300 text-[var(--theme-primary)] hover:bg-white',
        label: 'Ucapan Resmi Desa',
        Icon: Megaphone,
      };
  }
}

interface VillageGreetingBannerProps {
  greetings: ActiveGreetingItem[];
  onOpenCalendar: () => void;
}

export function VillageGreetingBanner({
  greetings,
  onOpenCalendar,
}: VillageGreetingBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [isAutoPaused, setIsAutoPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const greetingsSignature = useMemo(
    () =>
      (greetings || [])
        .map(
          (g) =>
            `${g.key}:${g.momentTitle}:${g.greetingText}:${g.senderLabel}:${g.themeTone}:${g.isPinned ? 1 : 0}`
        )
        .join('|'),
    [greetings]
  );

  // Reset dismissed state & clamp active slide whenever dynamic greeting content updates
  useEffect(() => {
    setDismissed(false);
    setActiveIndex(0);
  }, [greetingsSignature]);

  // Automatic slide rotation when multiple greetings are active
  useEffect(() => {
    if (dismissed || isAutoPaused || isHovered || !greetings || greetings.length <= 1) {
      return;
    }
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % greetings.length);
    }, 7000);

    return () => window.clearInterval(timer);
  }, [dismissed, isAutoPaused, isHovered, greetings]);

  if (dismissed || !greetings || greetings.length === 0) {
    return null;
  }

  const safeIndex = activeIndex % greetings.length;
  const current = greetings[safeIndex];
  const meta = getGreetingToneMeta(current.themeTone);
  const ToneIcon = meta.Icon;

  return (
    <section
      className={`no-print transition-colors duration-150 ${meta.bg} ${meta.border}`}
      role="region"
      aria-label="Ucapan Resmi Pemerintah Desa Margamukti"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsHovered(true)}
      onBlurCapture={() => setIsHovered(false)}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div key={current.key} className="flex items-start gap-3 min-w-0 transition-opacity duration-150">
          <div className="w-9 h-9 rounded-lg bg-white/90 border border-slate-200/80 flex items-center justify-center shrink-0 mt-0.5">
            <ToneIcon className={`w-4 h-4 ${meta.kicker}`} />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold">
              <span className={`uppercase tracking-wider ${meta.kicker}`}>
                {current.categoryLabel}
              </span>
              <span className="text-slate-400" aria-hidden="true">
                ·
              </span>
              <span className="font-mono-tabular text-slate-600">{current.dateLabel}</span>
              {current.isPinned && (
                <>
                  <span className="text-slate-400" aria-hidden="true">
                    ·
                  </span>
                  <span className={meta.kicker}>Sematan Pemerintah Desa</span>
                </>
              )}
            </div>

            <p className={`text-sm font-semibold leading-snug ${meta.title}`}>
              {current.momentTitle}
            </p>

            <p className={`text-xs sm:text-[13px] leading-relaxed ${meta.body}`}>
              &ldquo;{current.greetingText}&rdquo;{' '}
              <span className={`font-semibold whitespace-nowrap ${meta.sender}`}>
                — {current.senderLabel}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-2 shrink-0 pl-12 lg:pl-0">
          {greetings.length > 1 && (
            <div className="inline-flex items-center gap-1 mr-1">
              <button
                type="button"
                onClick={() =>
                  setActiveIndex((prev) => (prev - 1 + greetings.length) % greetings.length)
                }
                className={`w-8 h-8 rounded border flex items-center justify-center cursor-pointer ${meta.btn}`}
                aria-label="Ucapan sebelumnya"
                title="Ucapan sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono-tabular font-semibold text-slate-600 px-1.5">
                {safeIndex + 1}/{greetings.length}
              </span>
              <button
                type="button"
                onClick={() => setActiveIndex((prev) => (prev + 1) % greetings.length)}
                className={`w-8 h-8 rounded border flex items-center justify-center cursor-pointer ${meta.btn}`}
                aria-label="Ucapan berikutnya"
                title="Ucapan berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsAutoPaused((p) => !p)}
                className={`w-8 h-8 rounded border flex items-center justify-center cursor-pointer ${meta.btn}`}
                aria-label={isAutoPaused ? 'Putar rotasi ucapan otomatis' : 'Jeda rotasi ucapan otomatis'}
                title={isAutoPaused ? 'Putar slide otomatis' : 'Jeda slide otomatis'}
              >
                {isAutoPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onOpenCalendar}
            className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md border bg-white/80 transition-colors whitespace-nowrap cursor-pointer ${meta.btn}`}
          >
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            <span>Kalender Hari Besar</span>
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-black/5 cursor-pointer"
            aria-label="Tutup kolom ucapan pemerintah desa"
            title="Tutup sementara"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
