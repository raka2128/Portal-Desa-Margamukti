import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Film, Image as ImageIcon, PlayCircle, X } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { parseVideoEmbed } from '../utils/videoEmbed';
import type { ArticleMediaItem } from '../types';

interface PrimaryArticleMediaProps {
  coverImage: string;
  mediaItems: ArticleMediaItem[];
  articleTitle: string;
}

export function PrimaryArticleMedia({ coverImage, mediaItems, articleTitle }: PrimaryArticleMediaProps) {
  const primaryVideo = mediaItems.find((m) => m.type === 'video' || m.type === 'embed');

  if (!primaryVideo) {
    return (
      <div className="aspect-[16/9] rounded-xl overflow-hidden bg-slate-100">
        <ImageWithFallback src={coverImage} alt={articleTitle} />
      </div>
    );
  }

  if (primaryVideo.type === 'video') {
    return (
      <figure className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
        <div className="aspect-video bg-slate-950">
          <video
            src={primaryVideo.url}
            controls
            preload="metadata"
            playsInline
            poster={coverImage || undefined}
            className="w-full h-full object-contain"
          >
            Browser Anda tidak mendukung pemutaran video HTML5.
          </video>
        </div>
        {primaryVideo.caption && (
          <figcaption className="px-4 py-2.5 text-xs text-slate-600 border-t border-slate-200 bg-white">
            {primaryVideo.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  const parsed = parseVideoEmbed(primaryVideo.url);
  if (!parsed.valid) {
    return (
      <div className="aspect-[16/9] rounded-xl overflow-hidden bg-slate-100">
        <ImageWithFallback src={coverImage} alt={articleTitle} />
      </div>
    );
  }

  return (
    <figure className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F2744]">
          <PlayCircle className="w-4 h-4 text-[#A67F17]" />
          {parsed.label || 'Tayangan Video Utama'}
        </span>
        <a
          href={parsed.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-[#0F2744] whitespace-nowrap"
        >
          Buka di {parsed.platform === 'youtube' ? 'YouTube' : parsed.platform === 'tiktok' ? 'TikTok' : 'Instagram'}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {parsed.embedUrl ? (
        <div className={parsed.isVertical ? 'py-5 px-4 flex justify-center bg-slate-100/70' : 'bg-slate-950'}>
          <div
            className={
              parsed.isVertical
                ? 'w-full max-w-[340px] aspect-[9/16] rounded-lg overflow-hidden bg-black border border-slate-200 shadow-sm'
                : 'w-full aspect-video'
            }
          >
            <iframe
              src={parsed.embedUrl}
              title={primaryVideo.caption || `${parsed.label} — ${articleTitle}`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      ) : (
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            {parsed.note || 'Klik tautan untuk memutar video langsung pada platform sumber.'}
          </p>
          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md shrink-0 whitespace-nowrap"
          >
            Putar di {parsed.label} <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {primaryVideo.caption && (
        <figcaption className="px-4 py-2.5 text-xs text-slate-600 border-t border-slate-200 bg-white">
          {primaryVideo.caption}
        </figcaption>
      )}
    </figure>
  );
}

interface ArticleMediaGalleryProps {
  items: ArticleMediaItem[];
  articleTitle: string;
  excludeMediaId?: string;
}

export function ArticleMediaGallery({ items, articleTitle, excludeMediaId }: ArticleMediaGalleryProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const visibleItems = excludeMediaId ? items.filter((m) => m.id !== excludeMediaId) : items;
  const imageItems = visibleItems.filter((m) => m.type === 'image');
  const videoItems = visibleItems.filter((m) => m.type === 'video' || m.type === 'embed');

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (e.key === 'ArrowRight' && imageItems.length > 1) {
        setLightboxIdx((prev) => (prev === null ? null : (prev + 1) % imageItems.length));
      }
      if (e.key === 'ArrowLeft' && imageItems.length > 1) {
        setLightboxIdx((prev) => (prev === null ? null : (prev - 1 + imageItems.length) % imageItems.length));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, imageItems.length]);

  if (visibleItems.length === 0) return null;

  return (
    <div className="pt-6 border-t border-slate-200 space-y-6">
      {/* Secondary Videos & Embeds Section */}
      {videoItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-[#0F2744] inline-flex items-center gap-2">
              <Film className="w-4 h-4 text-[#A67F17]" />
              Tayangan Video Lainnya ({videoItems.length})
            </h3>
          </div>

          <div className="space-y-5">
            {videoItems.map((item) => {
              if (item.type === 'video') {
                return (
                  <figure
                    key={item.id}
                    className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden"
                  >
                    <div className="aspect-video bg-slate-950">
                      <video
                        src={item.url}
                        controls
                        preload="metadata"
                        playsInline
                        className="w-full h-full object-contain"
                      >
                        Browser Anda tidak mendukung pemutaran video HTML5.
                      </video>
                    </div>
                    {item.caption && (
                      <figcaption className="px-4 py-2.5 text-xs text-slate-600 border-t border-slate-200">
                        {item.caption}
                      </figcaption>
                    )}
                  </figure>
                );
              }

              const parsed = parseVideoEmbed(item.url);
              if (!parsed.valid) {
                return (
                  <div
                    key={item.id}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="text-xs text-slate-700 min-w-0">
                      <p className="font-semibold text-[#0F2744]">Tautan Video</p>
                      <p className="truncate text-slate-500 mt-0.5">{item.caption || item.url}</p>
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md shrink-0"
                    >
                      Tonton Video <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                );
              }

              return (
                <figure
                  key={item.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden"
                >
                  <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F2744]">
                      <PlayCircle className="w-4 h-4 text-[#A67F17]" />
                      {parsed.label || 'Video Tersemat'}
                    </span>
                    <a
                      href={parsed.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-[#0F2744] whitespace-nowrap"
                    >
                      Buka di {parsed.platform === 'youtube' ? 'YouTube' : parsed.platform === 'tiktok' ? 'TikTok' : 'Instagram'}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {parsed.embedUrl ? (
                    <div className={parsed.isVertical ? 'py-4 px-4 flex justify-center bg-slate-100/70' : 'bg-slate-950'}>
                      <div
                        className={
                          parsed.isVertical
                            ? 'w-full max-w-[340px] aspect-[9/16] rounded-lg overflow-hidden bg-black border border-slate-200 shadow-sm'
                            : 'w-full aspect-video'
                        }
                      >
                        <iframe
                          src={parsed.embedUrl}
                          title={item.caption || `${parsed.label} — ${articleTitle}`}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="strict-origin-when-cross-origin"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs text-slate-600">
                        {parsed.note || 'Klik tautan untuk memutar video langsung pada platform sumber.'}
                      </p>
                      <a
                        href={parsed.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md shrink-0 whitespace-nowrap"
                      >
                        Putar di {parsed.label} <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  {item.caption && (
                    <figcaption className="px-4 py-2.5 text-xs text-slate-600 border-t border-slate-200 bg-white">
                      {item.caption}
                    </figcaption>
                  )}
                </figure>
              );
            })}
          </div>
        </div>
      )}

      {/* Photo Gallery Section */}
      {imageItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-[#0F2744] inline-flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#A67F17]" />
            Galeri Foto Dokumentasi ({imageItems.length})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {imageItems.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setLightboxIdx(idx)}
                className="text-left group bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-[#0F2744] transition-colors cursor-pointer"
              >
                <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                  <ImageWithFallback
                    src={img.url}
                    alt={img.caption || `${articleTitle} - Foto ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                    fallbackTitle={articleTitle}
                  />
                </div>
                {img.caption && (
                  <p className="px-3.5 py-2.5 text-xs text-slate-600 border-t border-slate-100">
                    {img.caption}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox for Article Photos */}
      {lightboxIdx !== null && imageItems[lightboxIdx] && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <div
            className="max-w-4xl w-full bg-white rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[16/10] bg-slate-950">
              <ImageWithFallback
                src={imageItems[lightboxIdx].url}
                alt={imageItems[lightboxIdx].caption || articleTitle}
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={() => setLightboxIdx(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                aria-label="Tutup pratinjau foto"
              >
                <X className="w-5 h-5" />
              </button>
              {imageItems.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIdx((lightboxIdx - 1 + imageItems.length) % imageItems.length)
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                    aria-label="Foto sebelumnya"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxIdx((lightboxIdx + 1) % imageItems.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                    aria-label="Foto berikutnya"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            <div className="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-700 font-medium">
                {imageItems[lightboxIdx].caption || articleTitle}
              </span>
              <span className="font-mono-tabular text-slate-400 shrink-0">
                {lightboxIdx + 1} / {imageItems.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
