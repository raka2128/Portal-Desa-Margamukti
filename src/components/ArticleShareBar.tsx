import { useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  Check,
  Copy,
  Facebook,
  Instagram,
  Mail,
  MessageCircle,
  Share2,
} from 'lucide-react';
import {
  buildArticleShareLinks,
  copyTextToClipboard,
  type ShareableArticleMeta,
} from '../utils/articleShare';

interface ArticleShareBarProps {
  article: ShareableArticleMeta;
  variant?: 'compact' | 'full';
  align?: 'left' | 'right';
}

export function ArticleShareBar({
  article,
  variant = 'full',
  align = 'right',
}: ArticleShareBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const links = buildArticleShareLinks(article);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: globalThis.MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const handleCopyLink = async (e: MouseEvent) => {
    e.stopPropagation();
    const ok = await copyTextToClipboard(links.url);
    setFeedback(
      ok
        ? 'Tautan berita berhasil disalin!'
        : `Salin manual tautan ini: ${links.url}`
    );
  };

  const handleInstagramShare = async (e: MouseEvent) => {
    e.stopPropagation();
    const ok = await copyTextToClipboard(links.instagramCaption);
    setFeedback(
      ok
        ? 'Tautan & ringkasan disalin! Tempel (paste) di Story, DM, atau Bio Instagram.'
        : 'Buka Instagram lalu tempel tautan artikel secara manual.'
    );
  };

  if (variant === 'compact') {
    return (
      <div
        ref={containerRef}
        className="relative inline-flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleCopyLink}
          className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-[var(--theme-primary)] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          title="Salin tautan unik berita"
          aria-label={`Salin tautan berita ${article.title}`}
        >
          {feedback && feedback.includes('Tautan berita') ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-emerald-700 font-semibold">Disalin</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span>Salin Link</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[var(--theme-primary)] bg-white hover:bg-slate-50 border border-slate-200 hover:border-[var(--theme-primary)] rounded-md transition-colors cursor-pointer whitespace-nowrap"
          title="Bagikan ke Media Sosial"
          aria-expanded={menuOpen}
          aria-label={`Bagikan berita ${article.title}`}
        >
          <Share2 className="w-3.5 h-3.5 text-[var(--theme-accent-dark)] shrink-0" />
          <span>Bagikan</span>
        </button>

        {menuOpen && (
          <div
            className={`absolute bottom-full mb-2 w-60 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-30 space-y-1 ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Bagikan Berita Ini
            </p>

            <a
              href={links.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
              }}
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2.5 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>WhatsApp</span>
            </a>

            <a
              href={links.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
              }}
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-800 flex items-center gap-2.5 transition-colors"
            >
              <Facebook className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Facebook</span>
            </a>

            <a
              href={links.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleInstagramShare}
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-pink-50 hover:text-pink-800 flex items-center gap-2.5 transition-colors"
            >
              <Instagram className="w-4 h-4 text-pink-600 shrink-0" />
              <span>Instagram (Salin &amp; Buka)</span>
            </a>

            <a
              href={links.gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
              }}
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-800 flex items-center gap-2.5 transition-colors"
            >
              <Mail className="w-4 h-4 text-red-600 shrink-0" />
              <span>Gmail</span>
            </a>

            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--theme-primary)] bg-slate-50 hover:bg-slate-100 flex items-center gap-2.5 transition-colors cursor-pointer text-left"
            >
              <Copy className="w-4 h-4 text-[var(--theme-primary)] shrink-0" />
              <span>Salin Tautan Artikel</span>
            </button>

            {feedback && (
              <p className="px-2.5 py-1.5 text-[11px] leading-snug text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md">
                {feedback}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--theme-primary)]">
          <Share2 className="w-4 h-4 text-[var(--theme-accent-dark)] shrink-0" />
          <span>Bagikan Berita &amp; Artikel Desa</span>
        </div>
        <span className="text-[11px] font-mono-tabular text-slate-500 truncate max-w-full sm:max-w-xs">
          {links.url}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopyLink}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[var(--theme-primary)] bg-white border border-slate-300 hover:border-[var(--theme-primary)] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          {feedback && feedback.includes('Tautan berita') ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <Copy className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback && feedback.includes('Tautan berita') ? 'Tautan Disalin' : 'Salin Link'}</span>
        </button>

        <a
          href={links.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
        >
          <MessageCircle className="w-4 h-4 shrink-0" />
          <span>WhatsApp</span>
        </a>

        <a
          href={links.facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
        >
          <Facebook className="w-4 h-4 shrink-0" />
          <span>Facebook</span>
        </a>

        <a
          href={links.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleInstagramShare}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-pink-700 hover:bg-pink-800 rounded-lg transition-colors whitespace-nowrap"
        >
          <Instagram className="w-4 h-4 shrink-0" />
          <span>Instagram</span>
        </a>

        <a
          href={links.gmailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:border-red-500 hover:text-red-700 rounded-lg transition-colors whitespace-nowrap"
        >
          <Mail className="w-4 h-4 text-red-600 shrink-0" />
          <span>Gmail</span>
        </a>
      </div>

      {feedback && (
        <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {feedback}
        </p>
      )}
    </div>
  );
}
