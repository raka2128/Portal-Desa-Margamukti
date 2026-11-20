import { useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Link2,
  Play,
  Star,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { MAX_VIDEO_SIZE_BYTES, uploadMediaFile } from '../utils/uploadImage';
import { parseVideoEmbed } from '../utils/videoEmbed';
import type { ArticleMediaItem } from '../types';

interface ArticleMediaUploadFormProps {
  coverImage: string;
  onChangeCoverImage: (url: string) => void;
  mediaItems: ArticleMediaItem[];
  onChangeMediaItems: (items: ArticleMediaItem[]) => void;
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

export function ArticleMediaUploadForm({
  coverImage,
  onChangeCoverImage,
  mediaItems,
  onChangeMediaItems,
  onNotify,
}: ArticleMediaUploadFormProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [dropError, setDropError] = useState<string | null>(null);

  const [directMediaType, setDirectMediaType] = useState<'image' | 'video'>('image');
  const [directMediaUrl, setDirectMediaUrl] = useState('');

  const [embedUrlInput, setEmbedUrlInput] = useState('');
  const [embedCaptionInput, setEmbedCaptionInput] = useState('');
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);

  const parsedEmbedPreview = embedUrlInput.trim() ? parseVideoEmbed(embedUrlInput) : null;
  const firstVideoId = mediaItems.find((m) => m.type === 'video' || m.type === 'embed')?.id;

  const processFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setDropError(null);
    setUploading(true);

    const added: ArticleMediaItem[] = [];
    let nextCover = coverImage;

    try {
      for (const file of fileList) {
        const lower = file.name.toLowerCase();
        const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(lower);
        const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(lower);

        if (!isVideo && !isImage) {
          const msg = `Format "${file.name}" tidak didukung. Gunakan gambar (PNG/JPG/WEBP) atau video (MP4/WEBM/MOV).`;
          setDropError(msg);
          onNotify(msg, 'err');
          continue;
        }

        if (isVideo && file.size > MAX_VIDEO_SIZE_BYTES) {
          const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
          const msg = `Video "${file.name}" (${sizeMb} MB) melebihi batas maksimal 10.0 MB.`;
          setDropError(msg);
          onNotify(msg, 'err');
          continue;
        }

        setUploadStatusText(`Mengunggah ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`);
        const uploaded = await uploadMediaFile(file, isVideo ? 'video' : 'image');

        const newItem: ArticleMediaItem = {
          id: `${uploaded.mediaType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: uploaded.mediaType,
          platform: 'upload',
          url: uploaded.url,
          caption: '',
        };
        added.push(newItem);

        if (uploaded.mediaType === 'image' && !nextCover) {
          nextCover = uploaded.url;
        }
      }

      if (added.length > 0) {
        if (nextCover !== coverImage) {
          onChangeCoverImage(nextCover);
        }
        onChangeMediaItems([...mediaItems, ...added]);
        onNotify(`${added.length} berkas media berhasil diunggah ke artikel.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah berkas media.';
      setDropError(msg);
      onNotify(msg, 'err');
    } finally {
      setUploading(false);
      setUploadStatusText('');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (uploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void processFiles(e.dataTransfer.files);
    }
  };

  const handleAddDirectMedia = () => {
    const clean = directMediaUrl.trim();
    if (!clean) return;
    const item: ArticleMediaItem = {
      id: `${directMediaType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: directMediaType,
      platform: 'upload',
      url: clean,
      caption: '',
    };
    if (directMediaType === 'image' && !coverImage) {
      onChangeCoverImage(clean);
    }
    onChangeMediaItems([...mediaItems, item]);
    setDirectMediaUrl('');
    onNotify(directMediaType === 'video' ? 'Tautan file video ditambahkan.' : 'Tautan gambar ditambahkan.');
  };

  const handleAddEmbed = () => {
    const parsed = parseVideoEmbed(embedUrlInput);
    if (!parsed.valid || !parsed.platform) {
      onNotify('Masukkan URL video YouTube, TikTok, atau Instagram yang valid.', 'err');
      return;
    }
    const item: ArticleMediaItem = {
      id: `embed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'embed',
      platform: parsed.platform,
      url: parsed.originalUrl,
      caption: embedCaptionInput.trim(),
    };
    onChangeMediaItems([...mediaItems, item]);
    setEmbedUrlInput('');
    setEmbedCaptionInput('');
    onNotify(`Video ${parsed.label || parsed.platform} ditambahkan ke artikel.`);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= mediaItems.length) return;
    const next = [...mediaItems];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    onChangeMediaItems(next);
  };

  const promoteAsTopMedia = (idx: number) => {
    if (idx === 0) return;
    const next = [...mediaItems];
    const [picked] = next.splice(idx, 1);
    next.unshift(picked);
    onChangeMediaItems(next);
    onNotify('Video dipilih sebagai tayangan utama di bagian atas artikel.');
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h4 className="text-sm font-semibold text-[#0F2744]">
            Formulir Media Artikel: Gambar, Video (Maks. 10 MB) &amp; Embed Video
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Jika artikel memiliki video atau embed, tayangan utama akan dimainkan langsung di bagian atas artikel menggantikan gambar sampul statis.
          </p>
        </div>
        <span className="text-xs font-mono-tabular font-semibold text-[#0F2744]">
          {mediaItems.length} Media
        </span>
      </div>

      {/* 1. Drag & Drop Upload Zone */}
      <div className="space-y-3">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
            isDragging
              ? 'border-[#0F2744] bg-[#0F2744]/5'
              : 'border-slate-300 bg-white hover:border-[#0F2744]/60'
          }`}
        >
          <div className="flex flex-col items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0F2744]">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-semibold text-[#0F2744]">
                {uploading
                  ? uploadStatusText || 'Mengunggah media...'
                  : isDragging
                  ? 'Lepaskan berkas untuk mengunggah ke artikel'
                  : 'Seret & lepas file Gambar atau Video ke area ini'}
              </p>
              <p className="text-[11px] text-slate-500 font-mono-tabular">
                Gambar: PNG, JPG, WEBP · Video: MP4, WEBM, OGG, MOV (Maksimal 10.0 MB per video)
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer whitespace-nowrap">
                <ImageIcon className="w-3.5 h-3.5" />
                Pilih File Gambar
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading}
                  onChange={(e) => {
                    if (e.target.files) void processFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F2744] bg-[#C59B27] hover:bg-[#D4AB38] rounded-md cursor-pointer whitespace-nowrap">
                <Film className="w-3.5 h-3.5" />
                Pilih Video (Maks. 10 MB)
                <input
                  type="file"
                  multiple
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  disabled={uploading}
                  onChange={(e) => {
                    if (e.target.files) void processFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {dropError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{dropError}</span>
          </div>
        )}

        {/* Direct URL option for image/video */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={directMediaType}
            onChange={(e) => setDirectMediaType(e.target.value as 'image' | 'video')}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium text-slate-700"
          >
            <option value="image">Link Gambar</option>
            <option value="video">Link Video (.mp4)</option>
          </select>
          <input
            type="text"
            value={directMediaUrl}
            onChange={(e) => setDirectMediaUrl(e.target.value)}
            placeholder={
              directMediaType === 'image'
                ? 'Tempel link langsung file gambar (https://... atau /uploads/...)'
                : 'Tempel link langsung file video (.mp4 / .webm)'
            }
            className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
          />
          <button
            type="button"
            onClick={handleAddDirectMedia}
            className="px-3 py-1.5 text-xs font-semibold text-[#0F2744] bg-white border border-slate-300 rounded-md hover:bg-slate-100 cursor-pointer whitespace-nowrap"
          >
            + Tambah Link
          </button>
        </div>
      </div>

      {/* 2. Dedicated URL Embed Input + Playable Live Preview (YouTube / TikTok / Instagram) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-semibold text-[#0F2744] inline-flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-[#A67F17]" />
            Input URL Embed Video (YouTube / TikTok / Instagram)
          </label>
          <span className="text-[11px] text-slate-500">
            Mendukung YouTube, Shorts, TikTok, dan Instagram Reels/Post
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input
            type="url"
            value={embedUrlInput}
            onChange={(e) => setEmbedUrlInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... | tiktok.com/@.../video/... | instagram.com/reel/..."
            className="sm:col-span-7 px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-[#0F2744]"
          />
          <input
            type="text"
            value={embedCaptionInput}
            onChange={(e) => setEmbedCaptionInput(e.target.value)}
            placeholder="Keterangan video (opsional)"
            className="sm:col-span-3 px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-[#0F2744]"
          />
          <button
            type="button"
            onClick={handleAddEmbed}
            disabled={!parsedEmbedPreview?.valid}
            className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] disabled:opacity-45 rounded-md cursor-pointer whitespace-nowrap"
          >
            Tambahkan
          </button>
        </div>

        {/* Playable Live Embed Preview inside Admin Form */}
        {parsedEmbedPreview && (
          <div className="pt-2 space-y-2.5">
            {parsedEmbedPreview.valid ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Pratinjau Langsung: {parsedEmbedPreview.label}
                  </span>
                  <a
                    href={parsedEmbedPreview.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-[#0F2744]"
                  >
                    Uji di tab baru <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {parsedEmbedPreview.embedUrl ? (
                  <div
                    className={`rounded-lg overflow-hidden border border-slate-200 ${
                      parsedEmbedPreview.isVertical ? 'bg-slate-100 py-3 px-3 flex justify-center' : 'bg-slate-950'
                    }`}
                  >
                    <div
                      className={
                        parsedEmbedPreview.isVertical
                          ? 'w-full max-w-[260px] aspect-[9/16] rounded-md overflow-hidden bg-black'
                          : 'w-full aspect-video max-h-[300px]'
                      }
                    >
                      <iframe
                        src={parsedEmbedPreview.embedUrl}
                        title={`Pratinjau ${parsedEmbedPreview.label}`}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2.5">
                    {parsedEmbedPreview.note}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-amber-700 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Tautan belum dikenali sebagai URL YouTube, TikTok, atau Instagram yang valid.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3. Live Preview List of Attached Media Items */}
      {mediaItems.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-[#0F2744]">
            Daftar Media Terlampir ({mediaItems.length})
          </p>
          <div className="space-y-2.5">
            {mediaItems.map((m, idx) => {
              const isPrimaryVideo = m.id === firstVideoId;
              const embedMeta = m.type === 'embed' ? parseVideoEmbed(m.url) : null;
              const isExpanded = expandedPreviewId === m.id;

              return (
                <div
                  key={m.id}
                  className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Media Thumbnail / Mini Video Player */}
                    {m.type === 'image' ? (
                      <img
                        src={m.url}
                        alt={m.caption || 'Foto berita'}
                        className="w-24 h-16 object-cover rounded-lg border border-slate-200 shrink-0 bg-slate-100"
                        referrerPolicy="no-referrer"
                      />
                    ) : m.type === 'video' ? (
                      <div className="w-32 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-950 shrink-0">
                        <video
                          src={m.url}
                          controls
                          preload="metadata"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setExpandedPreviewId(isExpanded ? null : m.id)}
                        className="w-28 h-16 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200/70 flex flex-col items-center justify-center gap-1 shrink-0 text-[#0F2744] cursor-pointer"
                        title="Klik untuk uji putar video embed"
                      >
                        <Play className="w-4 h-4 text-[#A67F17]" />
                        <span className="text-[10px] font-semibold">
                          {isExpanded ? 'Tutup Player' : 'Uji Putar'}
                        </span>
                      </button>
                    )}

                    {/* Info + Caption */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[#0F2744]">
                          {m.type === 'image'
                            ? 'Foto Dokumentasi'
                            : m.type === 'video'
                            ? 'Video Unggahan'
                            : embedMeta?.label || 'Video Embed'}
                        </span>
                        {isPrimaryVideo && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="font-semibold text-[#A67F17]">
                              Tayangan Utama Atas Artikel
                            </span>
                          </>
                        )}
                        {m.type === 'image' && coverImage === m.url && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="font-semibold text-emerald-700">Sampul Kartu</span>
                          </>
                        )}
                      </div>

                      <p className="text-[11px] font-mono-tabular text-slate-400 truncate">
                        {m.url}
                      </p>

                      <input
                        value={m.caption || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          onChangeMediaItems(
                            mediaItems.map((it) => (it.id === m.id ? { ...it, caption: val } : it))
                          );
                        }}
                        placeholder="Keterangan gambar/video (opsional)..."
                        className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded bg-slate-50 focus:outline-none focus:border-[#0F2744]"
                      />
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-1 self-end sm:self-center shrink-0">
                      {(m.type === 'video' || m.type === 'embed') && idx !== 0 && (
                        <button
                          type="button"
                          onClick={() => promoteAsTopMedia(idx)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#0F2744] border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                          title="Jadikan video utama di atas artikel"
                        >
                          <Star className="w-3 h-3 text-[#A67F17]" /> Utama
                        </button>
                      )}
                      {m.type === 'image' && coverImage !== m.url && (
                        <button
                          type="button"
                          onClick={() => {
                            onChangeCoverImage(m.url);
                            onNotify('Foto dijadikan gambar thumbnail utama artikel.');
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-700 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                        >
                          Jadikan Sampul
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, -1)}
                        className="p-1.5 text-slate-500 hover:text-[#0F2744] disabled:opacity-30 cursor-pointer"
                        title="Geser ke atas"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === mediaItems.length - 1}
                        onClick={() => moveItem(idx, 1)}
                        className="p-1.5 text-slate-500 hover:text-[#0F2744] disabled:opacity-30 cursor-pointer"
                        title="Geser ke bawah"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeMediaItems(mediaItems.filter((it) => it.id !== m.id))}
                        className="p-1.5 text-slate-500 hover:text-red-600 cursor-pointer"
                        title="Hapus media"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Inline Player for Embed Item */}
                  {isExpanded && embedMeta?.embedUrl && (
                    <div
                      className={`rounded-lg overflow-hidden border border-slate-200 ${
                        embedMeta.isVertical ? 'bg-slate-100 py-3 px-3 flex justify-center' : 'bg-slate-950'
                      }`}
                    >
                      <div
                        className={
                          embedMeta.isVertical
                            ? 'w-full max-w-[260px] aspect-[9/16] rounded-md overflow-hidden bg-black'
                            : 'w-full aspect-video max-h-[300px]'
                        }
                      >
                        <iframe
                          src={embedMeta.embedUrl}
                          title={m.caption || embedMeta.label || 'Video Embed'}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
