import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  HardHat,
  MapPin,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';
import { ArticleMediaGallery, PrimaryArticleMedia } from '../../components/ArticleMediaGallery';
import { ArticleShareBar } from '../../components/ArticleShareBar';
import { IndonesianCalendarSection } from '../../components/IndonesianCalendarSection';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import { parseArticleMediaItems } from '../../utils/videoEmbed';
import type {
  Article,
  ArticleComment,
  GalleryItem,
  UmkmProduct,
  VillageDevelopment,
} from '../../types';

const DEFAULT_PORTAL_TITLE = 'Portal Resmi Desa Margamukti — Kecamatan Sumedang Utara';

interface ExplorePageProps {
  initialTab?: string;
  initialArticleSlug?: string;
  onOpenMapLocation?: (markerId: string) => void;
}

export function ExplorePage({
  initialTab = 'berita',
  initialArticleSlug,
  onOpenMapLocation,
}: ExplorePageProps) {
  const [tab, setTab] = useState<'berita' | 'pembangunan' | 'umkm' | 'galeri' | 'kalender'>(
    initialTab === 'umkm' ||
      initialTab === 'galeri' ||
      initialTab === 'pembangunan' ||
      initialTab === 'kalender'
      ? initialTab
      : 'berita'
  );

  // Articles & Citizen Comments
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleCat, setArticleCat] = useState('Semua');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentRegion, setCommentRegion] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentFeedback, setCommentFeedback] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // UMKM
  const [products, setProducts] = useState<UmkmProduct[]>([]);
  const [umkmCat, setUmkmCat] = useState('Semua');
  const [umkmQuery, setUmkmQuery] = useState('');

  // Gallery
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Pembangunan Desa
  const [developments, setDevelopments] = useState<VillageDevelopment[]>([]);
  const [devYearFilter, setDevYearFilter] = useState<string>('Semua');
  const [devSourceFilter, setDevSourceFilter] = useState<string>('Semua');
  const [selectedDev, setSelectedDev] = useState<VillageDevelopment | null>(null);

  useEffect(() => {
    if (
      initialTab === 'berita' ||
      initialTab === 'umkm' ||
      initialTab === 'galeri' ||
      initialTab === 'pembangunan' ||
      initialTab === 'kalender'
    ) {
      setTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    Promise.all([
      fetch('/api/public/articles').then((r) => r.json()),
      fetch('/api/public/umkm').then((r) => r.json()),
      fetch('/api/public/gallery').then((r) => r.json()),
      fetch('/api/public/developments').then((r) => (r.ok ? r.json() : { developments: [] })),
    ]).then(([aJson, uJson, gJson, dJson]) => {
      const aList: Article[] = aJson.articles || [];
      setArticles(aList);
      setProducts(uJson.products || []);
      setGallery(gJson.items || []);
      setDevelopments(dJson?.developments || []);

      if (initialArticleSlug) {
        const found = aList.find((a) => a.slug === initialArticleSlug);
        if (found) setSelectedArticle(found);
      }
    });
  }, [initialArticleSlug]);

  useEffect(() => {
    if (initialArticleSlug && articles.length > 0) {
      const found = articles.find((a) => a.slug === initialArticleSlug);
      if (found) setSelectedArticle(found);
    }
  }, [initialArticleSlug, articles]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedArticle) {
      document.title = `${selectedArticle.title} — Desa Margamukti`;
      const targetQuery = `?berita=${encodeURIComponent(selectedArticle.slug)}`;
      if (window.location.search !== targetQuery || window.location.hash !== '#jelajah') {
        window.history.replaceState(window.history.state, '', `/${targetQuery}#jelajah`);
      }
    } else {
      document.title = DEFAULT_PORTAL_TITLE;
      if (window.location.search.includes('berita=')) {
        window.history.replaceState(window.history.state, '', '/#jelajah');
      }
    }
  }, [selectedArticle]);

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.title = DEFAULT_PORTAL_TITLE;
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedArticle) {
      setComments([]);
      setCommentFeedback(null);
      return;
    }
    setCommentsLoading(true);
    setCommentFeedback(null);
    fetch(`/api/public/articles/${selectedArticle.id}/comments`)
      .then((r) => r.json())
      .then((j) => setComments(j.comments || []))
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [selectedArticle]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedArticle) return;
    setCommentSubmitting(true);
    setCommentFeedback(null);
    try {
      const res = await fetch(`/api/public/articles/${selectedArticle.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: commentAuthor,
          author_region: commentRegion,
          comment_text: commentText,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCommentFeedback({ msg: json.error || 'Gagal mengirim komentar.', type: 'err' });
        return;
      }
      if (json.comment) {
        setComments((prev) => [json.comment, ...prev]);
        setArticles((prev) =>
          prev.map((a) =>
            a.id === selectedArticle.id
              ? { ...a, comment_count: (a.comment_count ?? 0) + 1 }
              : a
          )
        );
      }
      setCommentAuthor('');
      setCommentRegion('');
      setCommentText('');
      setCommentFeedback({ msg: 'Komentar Anda telah diterbitkan.', type: 'ok' });
    } catch {
      setCommentFeedback({ msg: 'Gagal terhubung ke server.', type: 'err' });
    } finally {
      setCommentSubmitting(false);
    }
  };

  const articleCats = ['Semua', ...Array.from(new Set(articles.map((a) => a.category)))];
  const filteredArticles =
    articleCat === 'Semua' ? articles : articles.filter((a) => a.category === articleCat);

  const umkmCats = ['Semua', ...Array.from(new Set(products.map((p) => p.category)))];
  const filteredUmkm = products.filter((p) => {
    const matchCat = umkmCat === 'Semua' || p.category === umkmCat;
    const q = umkmQuery.trim().toLowerCase();
    const matchQ =
      !q ||
      p.product_name.toLowerCase().includes(q) ||
      p.business_name.toLowerCase().includes(q) ||
      p.owner_name.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  const devYears = useMemo(
    () => [
      'Semua',
      ...Array.from(new Set(developments.map((d) => String(d.fiscal_year)))).sort(
        (a, b) => Number(b) - Number(a)
      ),
    ],
    [developments]
  );

  const devSources = useMemo(
    () => [
      'Semua',
      ...Array.from(new Set(developments.map((d) => d.funding_source).filter(Boolean))),
    ],
    [developments]
  );

  const filteredDevs = useMemo(
    () =>
      developments.filter((d) => {
        const okYear = devYearFilter === 'Semua' || String(d.fiscal_year) === devYearFilter;
        const okSource =
          devSourceFilter === 'Semua' || d.funding_source === devSourceFilter;
        return okYear && okSource;
      }),
    [developments, devYearFilter, devSourceFilter]
  );

  const devSummary = useMemo(() => {
    const totalProjects = filteredDevs.length;
    const completedProjects = filteredDevs.filter((d) => d.progress_percent >= 100).length;
    const totalBudget = filteredDevs.reduce((s, d) => s + Number(d.budget_amount || 0), 0);
    const avgProgress =
      totalProjects > 0
        ? Math.round(
            filteredDevs.reduce((s, d) => s + Number(d.progress_percent || 0), 0) /
              totalProjects
          )
        : 0;
    return { totalProjects, completedProjects, totalBudget, avgProgress };
  }, [filteredDevs]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
            Informasi &amp; Potensi Desa Margamukti
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--theme-primary)] mt-1">
            {tab === 'berita' && 'Berita & Artikel Desa'}
            {tab === 'pembangunan' && 'Transparansi Pembangunan Desa'}
            {tab === 'umkm' && 'Katalog UMKM Warga'}
            {tab === 'galeri' && 'Galeri Kegiatan Desa'}
            {tab === 'kalender' && 'Kalender & Hari Besar Indonesia'}
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto no-scrollbar max-w-full w-full md:w-auto self-start">
          <button
            type="button"
            onClick={() => setTab('berita')}
            className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'berita' ? 'bg-white text-[var(--theme-primary)] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Berita Desa ({articles.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('pembangunan')}
            className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'pembangunan' ? 'bg-white text-[var(--theme-primary)] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pembangunan ({developments.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('umkm')}
            className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'umkm' ? 'bg-white text-[var(--theme-primary)] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Katalog UMKM ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('galeri')}
            className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'galeri' ? 'bg-white text-[var(--theme-primary)] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Galeri Kegiatan ({gallery.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('kalender')}
            className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'kalender' ? 'bg-white text-[var(--theme-primary)] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Kalender &amp; Hari Besar
          </button>
        </div>
      </div>

      {/* TAB 1: BERITA DESA */}
      {tab === 'berita' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {articleCats.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setArticleCat(cat)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                  articleCat === cat
                    ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((art) => {
              const mediaList = parseArticleMediaItems(art.media_items);
              const hasVideo = mediaList.some((m) => m.type === 'video' || m.type === 'embed');
              return (
                <article
                  key={art.id}
                  onClick={() => setSelectedArticle(art)}
                  className="bg-white border border-slate-200 rounded-xl hover:border-[var(--theme-primary)] transition-colors cursor-pointer flex flex-col"
                >
                  <div className="aspect-[4/3] bg-slate-100 rounded-t-xl overflow-hidden">
                    <ImageWithFallback src={art.image_url} alt={art.title} fallbackTitle={art.category} />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-[var(--theme-accent-dark)]">{art.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">{art.published_at}</span>
                        {mediaList.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-[var(--theme-primary)]">
                              {hasVideo ? 'Video & Galeri' : `${mediaList.length} Foto`}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 leading-snug">
                        {art.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {art.excerpt}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 truncate">
                          Oleh {art.author_name}
                          {typeof art.comment_count === 'number' && (
                            <>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span className="font-mono-tabular">{art.comment_count} Komentar</span>
                            </>
                          )}
                        </span>
                        <span className="font-semibold text-[var(--theme-primary)] shrink-0">Baca Artikel</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <span className="text-[11px] text-slate-400">Bagikan:</span>
                        <ArticleShareBar article={art} variant="compact" />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: KATALOG UMKM */}
      {tab === 'umkm' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {umkmCats.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setUmkmCat(cat)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                    umkmCat === cat
                      ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={umkmQuery}
                onChange={(e) => setUmkmQuery(e.target.value)}
                placeholder="Cari produk atau usaha..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUmkm.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                    <ImageWithFallback
                      src={item.image_url}
                      alt={item.product_name}
                      fallbackTitle={item.business_name}
                    />
                  </div>
                  <div className="p-5 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-[var(--theme-accent-dark)]">{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.business_name}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{item.product_name}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                  </div>
                </div>
                <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Pemilik: {item.owner_name}</span>
                    <span className="text-base font-bold text-[var(--theme-primary)] font-mono-tabular">
                      Rp {item.price.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <a
                    href={`https://wa.me/${item.whatsapp}?text=${encodeURIComponent(
                      `Halo ${item.owner_name} (${item.business_name}), saya ingin memesan "${item.product_name}" yang tertera di Portal Desa Margamukti.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md transition-colors"
                  >
                    <Store className="w-4 h-4 text-[var(--theme-accent-light)]" />
                    Hubungi Penjual via WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: PEMBANGUNAN DESA */}
      {tab === 'pembangunan' && (
        <div className="space-y-6">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
              <p className="text-xs text-slate-500">Total Proyek</p>
              <p className="text-2xl font-bold text-[var(--theme-primary)] font-mono-tabular mt-1">
                {devSummary.totalProjects} Kegiatan
              </p>
              <p className="text-xs text-emerald-700 font-mono-tabular mt-0.5">
                {devSummary.completedProjects} selesai 100%
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
              <p className="text-xs text-slate-500">Total Pagu Anggaran</p>
              <p className="text-xl sm:text-2xl font-bold text-[var(--theme-primary)] font-mono-tabular mt-1 truncate">
                Rp {devSummary.totalBudget.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Terbuka untuk pengawasan warga</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
              <p className="text-xs text-slate-500">Rata-rata Progress Fisik</p>
              <p className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-1">
                {devSummary.avgProgress}%
              </p>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-emerald-600 rounded-full"
                  style={{ width: `${devSummary.avgProgress}%` }}
                />
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
              <p className="text-xs text-slate-500">Titik Koordinat Peta</p>
              <p className="text-2xl font-bold text-[var(--theme-accent-dark)] font-mono-tabular mt-1">
                {filteredDevs.filter((d) => d.latitude !== null && d.longitude !== null).length} Lokasi
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Dapat ditinjau di Peta Desa</p>
            </div>
          </div>

          {/* Filter Tahun & Sumber Dana */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {devYears.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setDevYearFilter(yr)}
                  className={`px-3 py-1.5 text-xs font-semibold font-mono-tabular rounded-md border transition-colors cursor-pointer ${
                    devYearFilter === yr
                      ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {yr === 'Semua' ? 'Semua Tahun' : `TA ${yr}`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 shrink-0">
                Sumber Dana:
              </label>
              <select
                value={devSourceFilter}
                onChange={(e) => setDevSourceFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
              >
                {devSources.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Daftar Kartu Proyek */}
          {filteredDevs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              Belum ada kegiatan pembangunan untuk filter tahun dan sumber dana yang dipilih.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredDevs.map((dev) => {
                const hasCoords = dev.latitude !== null && dev.longitude !== null;
                return (
                  <article
                    key={dev.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                        <ImageWithFallback
                          src={dev.photo_url}
                          alt={dev.name}
                          fallbackTitle={dev.funding_source}
                        />
                      </div>
                      <div className="p-5 sm:p-6 space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono-tabular font-semibold text-[var(--theme-accent-dark)]">
                            TA {dev.fiscal_year}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[var(--theme-primary)]">
                            {dev.funding_source}
                          </span>
                        </div>

                        <h3 className="text-lg font-semibold text-slate-900 leading-snug">
                          {dev.name}
                        </h3>

                        {dev.description && (
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                            {dev.description}
                          </p>
                        )}

                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                          <div>
                            <dt className="text-slate-500">Anggaran</dt>
                            <dd className="font-mono-tabular font-bold text-[var(--theme-primary)] mt-0.5">
                              Rp {Number(dev.budget_amount || 0).toLocaleString('id-ID')}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Volume</dt>
                            <dd className="font-semibold text-slate-800 mt-0.5">{dev.volume}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Pelaksana</dt>
                            <dd className="font-medium text-slate-800 mt-0.5">{dev.executor}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Lokasi Wilayah</dt>
                            <dd className="font-medium text-slate-800 mt-0.5">
                              {dev.location_region}
                            </dd>
                          </div>
                        </dl>

                        <div className="pt-2 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 font-medium">Progress Pekerjaan</span>
                            <span
                              className={`font-mono-tabular font-bold ${
                                dev.progress_percent >= 100
                                  ? 'text-emerald-700'
                                  : 'text-[var(--theme-primary)]'
                              }`}
                            >
                              {dev.progress_percent}%{' '}
                              {dev.progress_percent >= 100 ? '(Selesai)' : '(Berjalan)'}
                            </span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                dev.progress_percent >= 100
                                  ? 'bg-emerald-600'
                                  : 'bg-[var(--theme-primary)]'
                              }`}
                              style={{ width: `${dev.progress_percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 sm:px-6 pb-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDev(dev)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[var(--theme-primary)] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                      >
                        <HardHat className="w-3.5 h-3.5 text-[var(--theme-accent-dark)]" />
                        <span>Rincian Proyek</span>
                      </button>

                      {hasCoords && onOpenMapLocation ? (
                        <button
                          type="button"
                          onClick={() => onOpenMapLocation(`dev-${dev.id}`)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-[var(--theme-accent-light)]" />
                          <span>Lihat di Peta</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Koordinat peta belum ditandai
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GALERI KEGIATAN */}
      {tab === 'galeri' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {gallery.map((g, idx) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setLightboxIdx(idx)}
              className="text-left bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-[var(--theme-primary)] transition-colors group cursor-pointer"
            >
              <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                <ImageWithFallback
                  src={g.image_url}
                  alt={g.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  fallbackTitle={g.title}
                />
              </div>
              <div className="p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[var(--theme-accent-dark)]">{g.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{g.event_date}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{g.title}</h3>
                <p className="text-xs text-slate-600 line-clamp-2">{g.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* TAB 4: KALENDER & HARI BESAR INDONESIA */}
      {tab === 'kalender' && <IndonesianCalendarSection mode="full" />}

      {/* Article Reader Modal */}
      {selectedArticle && (() => {
        const articleMedia = parseArticleMediaItems(selectedArticle.media_items);
        const primaryVideo = articleMedia.find((m) => m.type === 'video' || m.type === 'embed');
        return (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedArticle(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-xl max-w-3xl w-full h-[94dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto shadow-2xl pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4 z-10">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-[var(--theme-accent-dark)]">{selectedArticle.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{selectedArticle.published_at}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Tutup artikel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 sm:p-8 space-y-6">
              <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--theme-primary)] leading-snug">
                {selectedArticle.title}
              </h2>
              <p className="text-xs text-slate-500">Ditulis oleh {selectedArticle.author_name}</p>
              <ArticleShareBar article={selectedArticle} variant="full" />
              <PrimaryArticleMedia
                coverImage={selectedArticle.image_url}
                mediaItems={articleMedia}
                articleTitle={selectedArticle.title}
              />
              <div
                className="prose prose-slate max-w-none text-sm sm:text-base leading-relaxed text-slate-700 [&_p]:mb-4 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_blockquote]:py-2 [&_blockquote]:my-4 [&_blockquote]:border-y [&_blockquote]:border-slate-200"
                dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
              />

              <ArticleMediaGallery
                items={articleMedia}
                articleTitle={selectedArticle.title}
                excludeMediaId={primaryVideo?.id}
              />

              {/* Section Komentar Warga */}
              <div className="pt-6 border-t border-slate-200 space-y-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[var(--theme-primary)]" />
                    <h3 className="text-lg font-semibold text-[var(--theme-primary)]">
                      Komentar &amp; Tanggapan Warga ({comments.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">Langsung tampil · Dimoderasi Admin</span>
                </div>

                {/* Form Kirim Komentar */}
                <form
                  onSubmit={handleSubmitComment}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Warga *
                      </label>
                      <input
                        type="text"
                        required
                        value={commentAuthor}
                        onChange={(e) => setCommentAuthor(e.target.value)}
                        placeholder="Contoh: Deden Kurniawan"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Wilayah Dusun / RT-RW (Opsional)
                      </label>
                      <input
                        type="text"
                        value={commentRegion}
                        onChange={(e) => setCommentRegion(e.target.value)}
                        placeholder="Contoh: Dusun Pawenang RT 02 / RW 01"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Komentar atau Pertanyaan Anda *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Tuliskan tanggapan, pertanyaan, atau saran yang membangun..."
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs">
                      {commentFeedback && (
                        <span
                          className={
                            commentFeedback.type === 'err'
                              ? 'text-red-700 font-medium'
                              : 'text-emerald-700 font-medium'
                          }
                        >
                          {commentFeedback.msg}
                        </span>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={commentSubmitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] disabled:opacity-60 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5 text-[var(--theme-accent-light)]" />
                      {commentSubmitting ? 'Mengirim...' : 'Kirim Komentar'}
                    </button>
                  </div>
                </form>

                {/* Daftar Komentar */}
                {commentsLoading ? (
                  <p className="text-xs text-slate-500">Memuat komentar warga...</p>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">
                    Belum ada komentar pada berita ini. Jadilah warga pertama yang memberikan tanggapan.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-[var(--theme-primary)]">{c.author_name}</span>
                            {c.author_region && (
                              <>
                                <span className="text-slate-400" aria-hidden="true">·</span>
                                <span className="text-slate-600">{c.author_region}</span>
                              </>
                            )}
                          </div>
                          <span className="font-mono-tabular text-slate-400">
                            {c.created_at?.slice(0, 16).replace('T', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{c.comment_text}</p>

                        {c.admin_reply && (
                          <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                            <p className="text-[11px] font-semibold text-[var(--theme-primary)] flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-[var(--theme-accent-dark)]" />
                              Tanggapan Pemerintah Desa Margamukti
                            </p>
                            <p className="text-xs text-slate-700 leading-relaxed">{c.admin_reply}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Gallery Lightbox Modal */}
      {lightboxIdx !== null && gallery[lightboxIdx] && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <div
            className="max-w-4xl w-full bg-white rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[16/10] bg-slate-900">
              <ImageWithFallback
                src={gallery[lightboxIdx].image_url}
                alt={gallery[lightboxIdx].title}
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={() => setLightboxIdx(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                aria-label="Tutup galeri"
              >
                <X className="w-5 h-5" />
              </button>
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIdx((lightboxIdx - 1 + gallery.length) % gallery.length)
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                    aria-label="Foto sebelumnya"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxIdx((lightboxIdx + 1) % gallery.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                    aria-label="Foto berikutnya"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-[var(--theme-primary)]">
                  {gallery[lightboxIdx].title}
                </h3>
                <p className="text-xs text-slate-600 mt-1">{gallery[lightboxIdx].description}</p>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500 shrink-0">
                {gallery[lightboxIdx].event_date}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rincian Proyek Pembangunan */}
      {selectedDev && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedDev(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-xl max-w-2xl w-full max-h-[92dvh] overflow-y-auto shadow-2xl pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between gap-4 z-10">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-mono-tabular font-semibold text-[var(--theme-accent-dark)]">
                  TA {selectedDev.fiscal_year}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-[var(--theme-primary)]">
                  {selectedDev.funding_source}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDev(null)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Tutup rincian pembangunan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <div className="aspect-[16/10] bg-slate-100 rounded-xl overflow-hidden">
                <ImageWithFallback
                  src={selectedDev.photo_url}
                  alt={selectedDev.name}
                  fallbackTitle={selectedDev.funding_source}
                />
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-[var(--theme-primary)] leading-snug">
                  {selectedDev.name}
                </h2>
                {selectedDev.description && (
                  <p className="text-sm text-slate-700 leading-relaxed mt-2">
                    {selectedDev.description}
                  </p>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Capaian Progress Lapangan</span>
                  <span className="font-mono-tabular font-bold text-[var(--theme-primary)]">
                    {selectedDev.progress_percent}%
                  </span>
                </div>
                <div className="h-2.5 bg-white border border-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      selectedDev.progress_percent >= 100
                        ? 'bg-emerald-600'
                        : 'bg-[var(--theme-primary)]'
                    }`}
                    style={{ width: `${selectedDev.progress_percent}%` }}
                  />
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white border border-slate-200 rounded-xl p-4">
                <div>
                  <dt className="text-slate-500">Pagu Anggaran</dt>
                  <dd className="font-mono-tabular font-bold text-sm text-[var(--theme-primary)] mt-0.5">
                    Rp {Number(selectedDev.budget_amount || 0).toLocaleString('id-ID')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Sumber Dana</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">
                    {selectedDev.funding_source}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Volume Pekerjaan</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">{selectedDev.volume}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Pelaksana</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">{selectedDev.executor}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Lokasi Wilayah</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">
                    {selectedDev.location_region}
                  </dd>
                </div>
                {selectedDev.latitude !== null && selectedDev.longitude !== null && (
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Koordinat Geografis</dt>
                    <dd className="font-mono-tabular text-slate-800 mt-0.5">
                      {Number(selectedDev.latitude).toFixed(6)},{' '}
                      {Number(selectedDev.longitude).toFixed(6)}
                    </dd>
                  </div>
                )}
              </dl>

              {selectedDev.latitude !== null &&
                selectedDev.longitude !== null &&
                onOpenMapLocation && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const markerId = `dev-${selectedDev.id}`;
                        setSelectedDev(null);
                        onOpenMapLocation(markerId);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-[var(--theme-accent-light)]" />
                      <span>Sorot Lokasi Proyek di Peta Desa</span>
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
