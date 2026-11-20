import { ArrowRight, BarChart3, ChevronRight, Clock, FileText, MapPin, Phone, Store, Users, Wallet } from 'lucide-react';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import { DemographicCharts } from '../../components/DemographicCharts';
import { EarlyWarningSection } from '../../components/EarlyWarningSection';
import { IndonesianCalendarSection } from '../../components/IndonesianCalendarSection';
import { ArticleShareBar } from '../../components/ArticleShareBar';
import { parseArticleMediaItems } from '../../utils/videoEmbed';
import type {
  Article,
  BmkgLivePayload,
  EarlyWarning,
  LetterTemplate,
  Official,
  PopulationStats,
  UmkmProduct,
  VillageSettings,
} from '../../types';

export type PublicRoute = 'beranda' | 'profil' | 'lembaga' | 'surat' | 'jelajah' | 'bansos' | 'asisten-ai' | 'peta-kontak';

interface HomePageProps {
  settings: VillageSettings;
  stats: PopulationStats;
  officials: Official[];
  articles: Article[];
  umkm: UmkmProduct[];
  templates: LetterTemplate[];
  earlyWarningData?: {
    warnings: EarlyWarning[];
    bmkg: BmkgLivePayload | null;
    emergencyContact?: string;
  } | null;
  onOpenEmergencyModal?: () => void;
  onNavigate: (route: PublicRoute, subTab?: string, param?: string | number) => void;
}

export function HomePage({
  settings,
  stats,
  officials,
  articles,
  umkm,
  templates,
  earlyWarningData,
  onOpenEmergencyModal,
  onNavigate,
}: HomePageProps) {
  const malePct = stats.totalResidents > 0 ? Math.round((stats.maleCount / stats.totalResidents) * 100) : 50;
  const femalePct = stats.totalResidents > 0 ? 100 - malePct : 50;

  return (
    <div className="space-y-16 pb-16">
      {/* 1. Hero Section (2-Column Balanced Split + Operational Ribbon) */}
      <section className="bg-[var(--theme-primary)] text-white border-b-4 border-[var(--theme-accent)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <div className="flex flex-wrap items-center gap-2 text-xs tracking-wider uppercase text-[var(--theme-accent-light)] font-medium">
                <span>{settings.district_name}</span>
                <span aria-hidden="true">·</span>
                <span>{settings.regency_name}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">Kode {settings.village_code}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight text-white [text-wrap:balance]">
                {settings.hero_title}
              </h1>

              <p className="text-base text-slate-200 leading-relaxed max-w-2xl">
                {settings.hero_subtitle}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('surat')}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 text-sm font-semibold text-[var(--theme-primary)] bg-[var(--theme-accent)] hover:bg-[#D4AB38] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Ajukan Surat Keterangan
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('profil')}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 text-sm font-medium text-white border border-white/25 hover:bg-white/10 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Profil & Perangkat Desa
                </button>
              </div>

              <div className="pt-4 border-t border-white/15 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--theme-accent-light)]" />
                  {settings.service_hours}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[var(--theme-accent-light)]" />
                  Kode Pos {settings.postal_code}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[var(--theme-accent-light)]" />
                  {settings.phone}
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 min-h-[280px] lg:min-h-[380px] rounded-xl overflow-hidden border border-white/15 shadow-lg">
              <ImageWithFallback
                src={settings.hero_image}
                alt="Balai Desa Margamukti Sumedang Utara"
                className="w-full h-full object-cover"
                fallbackTitle="Balai Desa Margamukti"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Live Population KPI Strip (4 Columns directly below Hero) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 lg:-mt-20 relative z-10">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          <div className="p-4 sm:p-6">
            <p className="text-xs font-medium text-slate-500">Total Penduduk Terdata</p>
            <p className="text-2xl sm:text-3xl font-bold text-[var(--theme-primary)] font-mono-tabular mt-1.5">
              {stats.totalResidents.toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-mono-tabular">
              {stats.totalFamilies.toLocaleString('id-ID')} Kepala Keluarga
            </p>
          </div>
          <div className="p-4 sm:p-6">
            <p className="text-xs font-medium text-slate-500">Penduduk Laki-laki</p>
            <p className="text-2xl sm:text-3xl font-bold text-[var(--theme-primary)] font-mono-tabular mt-1.5">
              {stats.maleCount.toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-mono-tabular">{malePct}% dari populasi</p>
          </div>
          <div className="p-4 sm:p-6">
            <p className="text-xs font-medium text-slate-500">Penduduk Perempuan</p>
            <p className="text-2xl sm:text-3xl font-bold text-[var(--theme-primary)] font-mono-tabular mt-1.5">
              {stats.femaleCount.toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-mono-tabular">{femalePct}% dari populasi</p>
          </div>
          <div className="p-4 sm:p-6">
            <p className="text-xs font-medium text-slate-500">Wilayah Administratif</p>
            <p className="text-2xl sm:text-3xl font-bold text-[var(--theme-primary)] font-mono-tabular mt-1.5">
              {stats.totalDusun} Dusun
            </p>
            <p className="text-xs text-slate-500 mt-1 font-mono-tabular">
              {stats.totalRw} RW · {stats.totalRt} RT
            </p>
          </div>
        </div>
      </section>

      {/* 3. Dynamic Demographic Breakdown + Quick Letter Shortcuts */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Pintasan Layanan Surat Mandiri */}
          <div className="lg:col-span-7 space-y-5">
            <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                  Layanan Administrasi Warga
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--theme-primary)] mt-1">
                  Surat Keterangan Mandiri
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('surat', 'track')}
                className="text-xs font-semibold text-[var(--theme-primary)] hover:text-[var(--theme-accent-dark)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Lacak & Unduh PDF
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {templates.slice(0, 4).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onNavigate('surat', 'form', tpl.id)}
                  className="text-left p-5 bg-white border border-slate-200 rounded-xl hover:border-[var(--theme-primary)] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-2">
                    <span className="font-mono-tabular font-semibold text-[var(--theme-primary)]">
                      Kode {tpl.classification_code}
                    </span>
                    <FileText className="w-4 h-4 text-[var(--theme-accent)] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-[var(--theme-primary)]">
                    {tpl.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                    {tpl.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Grafik Distribusi Penduduk Dinamis per Dusun */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--theme-primary)]">Sebaran Wilayah & Penduduk</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dihitung otomatis dari basis data kependudukan
                </p>
              </div>
              <Users className="w-5 h-5 text-[var(--theme-accent)]" />
            </div>

            <div className="space-y-4">
              {stats.dusunBreakdown.map((d) => {
                const pct = stats.totalResidents > 0
                  ? Math.round((d.residentCount / stats.totalResidents) * 100)
                  : 0;
                return (
                  <div key={d.dusun} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{d.dusun}</span>
                      <span className="font-mono-tabular text-slate-600">
                        {d.residentCount} jiwa ({d.rwCount} RW · {d.rtCount} RT)
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--theme-primary)] rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(pct, 6)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>Rasio Gender (L / P)</span>
              <span className="font-mono-tabular font-semibold text-[var(--theme-primary)]">
                {malePct}% / {femalePct}%
              </span>
            </div>
          </div>
        </div>

        {/* Grafik Ringkas Kependudukan + Pintasan Transparansi APBDes */}
        <div className="mt-8 space-y-5">
          <DemographicCharts
            stats={stats}
            mode="compact"
            onOpenFullStats={() => onNavigate('profil', 'statistik')}
          />

          <div className="bg-[var(--theme-primary)] text-white rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-4 border-[var(--theme-accent)]">
            <div className="flex items-start gap-3.5">
              <Wallet className="w-6 h-6 text-[var(--theme-accent-light)] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--theme-accent-light)] font-semibold">
                  Transparansi Keuangan Desa
                </p>
                <h3 className="text-lg font-semibold mt-0.5">
                  Laporan Anggaran & Realisasi APBDes {settings.village_name}
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Pantau ringkasan Pendapatan, Belanja per Bidang, serta Pembiayaan Desa secara terbuka.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('profil', 'portofolio')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white border border-white/25 hover:bg-white/10 rounded-md whitespace-nowrap cursor-pointer"
              >
                Portofolio Desa
              </button>
              <button
                type="button"
                onClick={() => onNavigate('jelajah', 'pembangunan')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white border border-white/25 hover:bg-white/10 rounded-md whitespace-nowrap cursor-pointer"
              >
                Pembangunan Desa
              </button>
              <button
                type="button"
                onClick={() => onNavigate('profil', 'statistik')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white border border-white/25 hover:bg-white/10 rounded-md whitespace-nowrap cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5 text-[var(--theme-accent-light)]" />
                Statistik Penduduk
              </button>
              <button
                type="button"
                onClick={() => onNavigate('profil', 'apbdes')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-[var(--theme-primary)] bg-[var(--theme-accent)] hover:bg-[#D4AB38] rounded-md whitespace-nowrap cursor-pointer"
              >
                Buka Transparansi APBDes
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3b. Pusat Peringatan Dini Desa & Live BMKG */}
      <EarlyWarningSection
        warnings={earlyWarningData?.warnings || []}
        bmkg={earlyWarningData?.bmkg || null}
        emergencyContact={earlyWarningData?.emergencyContact || settings.whatsapp || settings.phone}
        onOpenEmergencyModal={() => onOpenEmergencyModal?.()}
      />

      {/* 4. Berita Terbaru Desa Margamukti */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
              Kabar Pemerintahan & Warga
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--theme-primary)] mt-1">
              Berita & Pengumuman Terbaru
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('jelajah', 'berita')}
            className="text-xs font-semibold text-[var(--theme-primary)] hover:text-[var(--theme-accent-dark)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Semua Berita
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {articles.map((art) => {
            const mediaList = parseArticleMediaItems(art.media_items);
            const hasVideo = mediaList.some((m) => m.type === 'video' || m.type === 'embed');
            return (
              <article
                key={art.id}
                onClick={() => onNavigate('jelajah', 'berita', art.slug)}
                className="bg-white border border-slate-200 rounded-xl hover:border-[var(--theme-primary)] transition-colors cursor-pointer flex flex-col"
              >
                <div className="aspect-[4/3] rounded-t-xl overflow-hidden bg-slate-100">
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
                    <h3 className="text-base font-semibold text-slate-900 leading-snug line-clamp-2">
                      {art.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {art.excerpt}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--theme-primary)] inline-flex items-center gap-1 whitespace-nowrap">
                      Baca selengkapnya <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                    <ArticleShareBar article={art} variant="compact" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4b. Widget Kalender & Hari Besar Indonesia */}
      <IndonesianCalendarSection
        mode="compact"
        onOpenFullCalendar={() => onNavigate('jelajah', 'kalender')}
      />

      {/* 5. Etalase UMKM Warga & Perangkat Desa */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
              Ekonomi Lokal Margamukti
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--theme-primary)] mt-1">
              Produk UMKM Unggulan Warga
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('jelajah', 'umkm')}
            className="text-xs font-semibold text-[var(--theme-primary)] hover:text-[var(--theme-accent-dark)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Lihat Katalog Lengkap
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {umkm.map((item) => (
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
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-[var(--theme-accent-dark)]">{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{item.business_name}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">
                    {item.product_name}
                  </h3>
                  <p className="text-sm font-bold text-[var(--theme-primary)] font-mono-tabular">
                    Rp {item.price.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
              <div className="px-4 pb-4">
                <a
                  href={`https://wa.me/${item.whatsapp}?text=${encodeURIComponent(
                    `Halo ${item.owner_name}, saya tertarik dengan produk "${item.product_name}" dari katalog UMKM Desa Margamukti.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md transition-colors whitespace-nowrap"
                >
                  <Store className="w-3.5 h-3.5 text-[var(--theme-accent-light)]" />
                  Pesan via WhatsApp
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Ringkasan Perangkat Desa */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                Pemerintahan Desa
              </p>
              <h2 className="text-2xl font-semibold text-[var(--theme-primary)] mt-1">
                Pimpinan & Perangkat Desa
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('profil', 'perangkat')}
              className="text-xs font-semibold text-[var(--theme-primary)] hover:text-[var(--theme-accent-dark)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Struktur Lengkap
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {officials.map((off) => (
              <div key={off.id} className="flex items-center gap-3.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-[var(--theme-primary)] text-white flex items-center justify-center font-semibold text-sm">
                  {off.photo_url ? (
                    <ImageWithFallback src={off.photo_url} alt={off.name} className="w-full h-full object-cover" />
                  ) : (
                    off.name
                      .split(' ')
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{off.name}</p>
                  <p className="text-xs text-[var(--theme-accent-dark)] font-medium truncate">{off.position}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
