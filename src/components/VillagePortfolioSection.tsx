import { useEffect, useState } from 'react';
import {
  Award,
  Building2,
  Check,
  Compass,
  Copy,
  FileCheck2,
  Handshake,
  HardHat,
  Landmark,
  Printer,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { SumedangCrest } from './SumedangCrest';
import { copyTextToClipboard } from '../utils/articleShare';
import type { PortfolioPublicPayload } from '../types';

interface VillagePortfolioSectionProps {
  onOpenDevelopments?: () => void;
  onOpenInstitution?: (slug: string) => void;
}

function formatRupiah(num: number): string {
  return `Rp ${Number(num || 0).toLocaleString('id-ID')}`;
}

export function VillagePortfolioSection({
  onOpenDevelopments,
  onOpenInstitution,
}: VillagePortfolioSectionProps) {
  const [data, setData] = useState<PortfolioPublicPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/public/portfolio')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Gagal memuat portofolio pemerintah desa.');
        return json as PortfolioPublicPayload;
      })
      .then((json) => setData(json))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Gagal memuat portofolio.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCopyShareLink = async () => {
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/?tab=portofolio#profil`
        : '/?tab=portofolio#profil';
    const ok = await copyTextToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-44 bg-white border border-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-800">
        {error || 'Data portofolio tidak tersedia.'}
      </div>
    );
  }

  const {
    settings,
    portfolioSettings: pf,
    stats,
    officials,
    institutions,
    apbdesSummary,
    itemsBySection,
    developments,
    developmentTotals,
  } = data;

  const missionLines = settings.mission
    .split('\n')
    .map((m) => m.trim())
    .filter(Boolean);

  const partnerList = (pf.strategic_partners || '')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  const malePct =
    stats.totalResidents > 0 ? Math.round((stats.maleCount / stats.totalResidents) * 100) : 50;
  const femalePct = stats.totalResidents > 0 ? 100 - malePct : 50;
  const belanjaPct =
    apbdesSummary.belanjaBudget > 0
      ? Math.round((apbdesSummary.belanjaRealized / apbdesSummary.belanjaBudget) * 100)
      : 0;
  const pendapatanPct =
    apbdesSummary.pendapatanBudget > 0
      ? Math.round((apbdesSummary.pendapatanRealized / apbdesSummary.pendapatanBudget) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Action Bar (Hidden when printing) */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
            Dokumen Profil &amp; Kinerja Kelembagaan Resmi
          </p>
          <p className="text-xs text-slate-600">
            Siap dipresentasikan ke instansi pemerintah, mitra pembangunan, akademisi, dan masyarakat.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--theme-primary)] bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-emerald-700">Tautan Disalin</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 shrink-0" />
                <span>Salin Tautan Portofolio</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[var(--theme-accent-light)] shrink-0" />
            <span>Cetak / Unduh PDF Resmi (A4)</span>
          </button>
        </div>
      </div>

      {/* Main Institutional Portfolio Sheet */}
      <div className="print-only-sheet bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
        {/* MASTHEAD & RINGKASAN EKSEKUTIF */}
        <section className="bg-[var(--theme-primary)] text-white p-6 sm:p-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/15 pb-6">
            <div className="flex items-center gap-4">
              <SumedangCrest className="w-12 h-14 shrink-0" />
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--theme-accent-light)] font-semibold">
                  {settings.kop_line1} · {settings.kop_line2}
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mt-1 [text-wrap:balance]">
                  {pf.portfolio_title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-200 mt-1.5 max-w-3xl leading-relaxed">
                  {pf.portfolio_subtitle}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-left sm:text-right text-xs text-slate-300 space-y-0.5 font-mono-tabular">
              <p className="text-[var(--theme-accent-light)] font-semibold">Kode Wilayah {settings.village_code}</p>
              <p>Kode Pos {settings.postal_code}</p>
              <p>{settings.phone}</p>
            </div>
          </div>

          <p className="text-sm sm:text-base text-slate-100 leading-relaxed max-w-4xl">
            {pf.executive_summary}
          </p>

          {/* 4 Indikator Strategis */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <div className="bg-white/10 border border-white/15 rounded-lg p-4">
              <p className="text-[11px] text-slate-300">Status &amp; Skor IDM</p>
              <p className="text-xl font-bold text-white font-mono-tabular mt-1">{pf.idm_score}</p>
              <p className="text-xs text-[var(--theme-accent-light)] font-medium mt-0.5">{pf.idm_status}</p>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-lg p-4">
              <p className="text-[11px] text-slate-300">Indeks SDGs Desa</p>
              <p className="text-xl font-bold text-white font-mono-tabular mt-1">{pf.sdgs_score}</p>
              <p className="text-xs text-slate-200 mt-0.5">Capaian Terukur</p>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-lg p-4">
              <p className="text-[11px] text-slate-300">Luas &amp; Kewilayahan</p>
              <p className="text-xl font-bold text-white font-mono-tabular mt-1">{pf.area_size}</p>
              <p className="text-xs text-slate-200 font-mono-tabular mt-0.5">
                {stats.totalDusun} Dusun · {stats.totalRw} RW · {stats.totalRt} RT
              </p>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-lg p-4">
              <p className="text-[11px] text-slate-300">Pembangunan Aktif</p>
              <p className="text-xl font-bold text-white font-mono-tabular mt-1">
                {developmentTotals.totalProjects} Paket
              </p>
              <p className="text-xs text-[var(--theme-accent-light)] font-mono-tabular mt-0.5">
                Rata-rata Progress {developmentTotals.avgProgress}%
              </p>
            </div>
          </div>
        </section>

        {/* 01. PROFIL DESA & TATA BATAS GEOGRAFIS */}
        <section className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Building2 className="w-5 h-5 text-[var(--theme-primary)] shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                Bagian 01
              </p>
              <h3 className="text-xl font-semibold text-[var(--theme-primary)]">
                Profil Pemerintahan &amp; Kondisi Geografis Desa
              </h3>
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed max-w-4xl">{pf.profile_narrative}</p>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-6 border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs sm:text-sm">
              <div className="px-4 py-2.5 bg-slate-50 font-semibold text-[var(--theme-primary)]">
                Identitas &amp; Batas Administratif
              </div>
              <div className="px-4 py-2.5 flex justify-between gap-4">
                <span className="text-slate-500">Nama Desa / Kode</span>
                <span className="font-semibold text-slate-900 text-right font-mono-tabular">
                  {settings.village_name} ({settings.village_code})
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between gap-4">
                <span className="text-slate-500">Kecamatan / Kabupaten</span>
                <span className="font-medium text-slate-900 text-right">
                  {settings.district_name}, {settings.regency_name}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between gap-4">
                <span className="text-slate-500">Kepala Desa &amp; Aparatur</span>
                <span className="font-medium text-slate-900 text-right">
                  {settings.head_name} ({officials.length} Perangkat Aktif)
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between gap-4">
                <span className="text-slate-500">Batas Sebelah Utara</span>
                <span className="font-medium text-slate-900 text-right">{pf.boundaries_north}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between gap-4">
                <span className="text-slate-500">Batas Sebelah Timur</span>
                <span className="font-medium text-slate-900 text-right">{pf.boundaries_east}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between gap-4">
                <span className="text-slate-500">Batas Sebelah Selatan</span>
                <span className="font-medium text-slate-900 text-right">{pf.boundaries_south}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between gap-4">
                <span className="text-slate-500">Batas Sebelah Barat</span>
                <span className="font-medium text-slate-900 text-right">{pf.boundaries_west}</span>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                  Visi Pembangunan Desa
                </p>
                <p className="text-base font-medium italic text-[var(--theme-primary)] leading-relaxed">
                  &ldquo;{settings.vision}&rdquo;
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-5 space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                  Misi Strategis
                </p>
                <ol className="space-y-2 text-xs sm:text-sm text-slate-700 list-decimal pl-4">
                  {missionLines.map((line, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {line.replace(/^\d+\.\s*/, '')}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* 02. KEPENDUDUKAN & DEMOGRAFI DESA */}
        <section className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Users className="w-5 h-5 text-[var(--theme-primary)] shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                Bagian 02
              </p>
              <h3 className="text-xl font-semibold text-[var(--theme-primary)]">
                Profil Kependudukan &amp; Sumber Daya Manusia
              </h3>
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed max-w-4xl">{pf.demographic_narrative}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Total Penduduk Aktif</p>
              <p className="text-2xl font-bold text-[var(--theme-primary)] font-mono-tabular mt-1">
                {stats.totalResidents.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-slate-500 font-mono-tabular mt-0.5">
                {stats.totalFamilies.toLocaleString('id-ID')} Kepala Keluarga
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Laki-laki</p>
              <p className="text-2xl font-bold text-[var(--theme-primary)] font-mono-tabular mt-1">
                {stats.maleCount.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-slate-500 font-mono-tabular mt-0.5">{malePct}% populasi</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Perempuan</p>
              <p className="text-2xl font-bold text-[var(--theme-primary)] font-mono-tabular mt-1">
                {stats.femaleCount.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-slate-500 font-mono-tabular mt-0.5">{femalePct}% populasi</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Mata Pencaharian Utama</p>
              <p className="text-sm font-bold text-[var(--theme-primary)] mt-1.5 line-clamp-1">
                {stats.occupationBreakdown[0]?.occupation || 'Wiraswasta & Pertanian'}
              </p>
              <p className="text-xs text-slate-500 font-mono-tabular mt-0.5">
                {stats.occupationBreakdown[0]?.count || 0} jiwa tercatat
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-[var(--theme-primary)]">
                Sebaran Penduduk per Dusun (Data Langsung)
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-white border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Wilayah Dusun</th>
                    <th className="px-3 py-2.5 font-semibold text-right">RW / RT</th>
                    <th className="px-3 py-2.5 font-semibold text-right">L</th>
                    <th className="px-3 py-2.5 font-semibold text-right">P</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Total Jiwa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.dusunBreakdown.map((d) => (
                    <tr key={d.dusun}>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{d.dusun}</td>
                      <td className="px-3 py-2.5 text-right font-mono-tabular text-slate-600">
                        {d.rwCount} / {d.rtCount}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-tabular text-slate-700">
                        {d.maleCount}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-tabular text-slate-700">
                        {d.femaleCount}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono-tabular font-semibold text-[var(--theme-primary)]">
                        {d.residentCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:col-span-5 border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-[var(--theme-primary)]">
                Komposisi Kelompok Usia &amp; Profesi Teratas
              </p>
              <div className="space-y-2 text-xs">
                {stats.ageBreakdown.map((bucket) => {
                  const pct =
                    stats.totalResidents > 0
                      ? Math.round((bucket.count / stats.totalResidents) * 100)
                      : 0;
                  return (
                    <div key={bucket.group} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-700">{bucket.group}</span>
                        <span className="font-mono-tabular text-slate-600">
                          {bucket.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--theme-primary)] rounded-full"
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 03. PROGRAM UNGGULAN DESA */}
        <section className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Sparkles className="w-5 h-5 text-[var(--theme-primary)] shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                Bagian 03
              </p>
              <h3 className="text-xl font-semibold text-[var(--theme-primary)]">
                Program Unggulan Pemerintah Desa
              </h3>
            </div>
          </div>

          {itemsBySection.program_unggulan.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada program unggulan yang diterbitkan.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {itemsBySection.program_unggulan.map((prog) => (
                <div
                  key={prog.id}
                  className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="font-semibold text-[var(--theme-accent-dark)]">{prog.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">{prog.year_label}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-emerald-700">{prog.status_label}</span>
                    </div>
                    <h4 className="text-base font-semibold text-[var(--theme-primary)] leading-snug">
                      {prog.title}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{prog.description}</p>
                  </div>
                  {prog.impact_summary && (
                    <div className="pt-3 border-t border-slate-100 text-xs text-slate-700">
                      <span className="font-semibold text-slate-900">Dampak Utama: </span>
                      {prog.impact_summary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 04. KINERJA, TRANSPARANSI APBDES & PENGHARGAAN DESA */}
        <section className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Award className="w-5 h-5 text-[var(--theme-primary)] shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                Bagian 04
              </p>
              <h3 className="text-xl font-semibold text-[var(--theme-primary)]">
                Capaian Kinerja, Transparansi APBDes &amp; Penghargaan
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold text-[var(--theme-primary)] inline-flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-[var(--theme-accent-dark)]" />
                  Realisasi Pendapatan Desa ({apbdesSummary.year})
                </span>
                <span className="font-mono-tabular font-bold text-emerald-700">{pendapatanPct}%</span>
              </div>
              <p className="text-lg font-bold text-slate-900 font-mono-tabular">
                {formatRupiah(apbdesSummary.pendapatanRealized)}
              </p>
              <p className="text-xs text-slate-500 font-mono-tabular">
                Target Anggaran: {formatRupiah(apbdesSummary.pendapatanBudget)}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold text-[var(--theme-primary)] inline-flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-[var(--theme-accent-dark)]" />
                  Serapan Belanja Desa ({apbdesSummary.year})
                </span>
                <span className="font-mono-tabular font-bold text-[var(--theme-primary)]">{belanjaPct}%</span>
              </div>
              <p className="text-lg font-bold text-slate-900 font-mono-tabular">
                {formatRupiah(apbdesSummary.belanjaRealized)}
              </p>
              <p className="text-xs text-slate-500 font-mono-tabular">
                Pagu Belanja: {formatRupiah(apbdesSummary.belanjaBudget)}
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
            {itemsBySection.penghargaan.map((aw) => (
              <div key={aw.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono-tabular font-semibold text-[var(--theme-accent-dark)]">
                      {aw.year_label}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{aw.issuer_or_partner}</span>
                    {aw.status_label && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[var(--theme-primary)]">{aw.status_label}</span>
                      </>
                    )}
                  </div>
                  <h4 className="text-base font-semibold text-slate-900">{aw.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{aw.description}</p>
                </div>
                {aw.impact_summary && (
                  <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 sm:max-w-xs shrink-0 leading-relaxed">
                    {aw.impact_summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 05. SINERGI PEMERINTAH DESA, LEMBAGA DESA & MASYARAKAT */}
        <section className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Handshake className="w-5 h-5 text-[var(--theme-primary)] shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                Bagian 05
              </p>
              <h3 className="text-xl font-semibold text-[var(--theme-primary)]">
                Sinergi Pemerintah Desa, Lembaga Desa &amp; Masyarakat
              </h3>
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed max-w-4xl">{pf.synergy_narrative}</p>

          {/* Lembaga Desa Pilar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {institutions.map((inst) => (
              <div
                key={inst.id}
                className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-2.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-bold text-[var(--theme-primary)]">{inst.short_name}</span>
                    <span className="font-mono-tabular">
                      {(inst.members || []).length} Pengurus
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 mt-1">{inst.name}</h4>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{inst.tagline}</p>
                </div>
                {onOpenInstitution && (
                  <button
                    type="button"
                    onClick={() => onOpenInstitution(inst.slug)}
                    className="no-print text-left text-xs font-semibold text-[var(--theme-primary)] hover:text-[var(--theme-accent-dark)] cursor-pointer"
                  >
                    Lihat Profil {inst.short_name} →
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Daftar Inisiatif Sinergi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {itemsBySection.sinergi.map((syn) => (
              <div key={syn.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-[var(--theme-accent-dark)]">{syn.category}</span>
                  <span className="font-mono-tabular">{syn.year_label}</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900">{syn.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{syn.description}</p>
                {syn.impact_summary && (
                  <p className="text-[11px] font-medium text-[var(--theme-primary)] pt-1">
                    Capaian: {syn.impact_summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 06. REALISASI PEMBANGUNAN, POTENSI UNGGULAN & MITRA STRATEGIS */}
        <section className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <HardHat className="w-5 h-5 text-[var(--theme-primary)] shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                  Bagian 06
                </p>
                <h3 className="text-xl font-semibold text-[var(--theme-primary)]">
                  Realisasi Pembangunan, Potensi Unggulan &amp; Kemitraan
                </h3>
              </div>
            </div>
            {onOpenDevelopments && (
              <button
                type="button"
                onClick={onOpenDevelopments}
                className="no-print text-xs font-semibold text-[var(--theme-primary)] hover:text-[var(--theme-accent-dark)] cursor-pointer"
              >
                Buka Galeri &amp; Detail Pembangunan ({developments.length}) →
              </button>
            )}
          </div>

          {developments.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Nama Pembangunan</th>
                    <th className="px-3 py-2.5 font-semibold">Wilayah &amp; Volume</th>
                    <th className="px-3 py-2.5 font-semibold">Sumber Dana &amp; Pelaksana</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Anggaran</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Progres</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {developments.map((dev) => (
                    <tr key={dev.id}>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-slate-900">{dev.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono-tabular">Tahun {dev.fiscal_year}</p>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        <p>{dev.location_region}</p>
                        <p className="text-[11px] text-slate-500">{dev.volume}</p>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        <p className="font-medium">{dev.funding_source}</p>
                        <p className="text-[11px] text-slate-500">{dev.executor}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-tabular font-semibold text-[var(--theme-primary)] whitespace-nowrap">
                        {formatRupiah(dev.budget_amount)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono-tabular font-bold whitespace-nowrap">
                        <span
                          className={
                            dev.progress_percent >= 100 ? 'text-emerald-700' : 'text-[var(--theme-primary)]'
                          }
                        >
                          {dev.progress_percent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Potensi Unggulan & Mitra Strategis */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                Potensi Unggulan &amp; Peluang Kemitraan Desa
              </p>
              <div className="space-y-2.5">
                {itemsBySection.potensi_unggulan.map((pot) => (
                  <div key={pot.id} className="border border-slate-200 rounded-xl p-4 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[var(--theme-primary)]">{pot.title}</span>
                      <span className="text-[11px] font-medium text-emerald-700 shrink-0">
                        {pot.status_label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{pot.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)] flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" />
                Mitra Kelembagaan &amp; Kolaborasi Eksternal
              </p>
              <ul className="space-y-2 text-xs text-slate-700">
                {partnerList.map((partner, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <FileCheck2 className="w-3.5 h-3.5 text-[var(--theme-primary)] shrink-0 mt-0.5" />
                    <span>{partner}</span>
                  </li>
                ))}
              </ul>
              {pf.closing_statement && (
                <p className="pt-3 border-t border-slate-200 text-xs text-slate-600 leading-relaxed">
                  {pf.closing_statement}
                </p>
              )}
            </div>
          </div>

          {/* Lembar Pengesahan Cetak A4 */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-6 text-xs text-slate-700">
            <div className="space-y-1">
              <p className="font-semibold text-[var(--theme-primary)]">Kontak Resmi Kemitraan &amp; Investasi Desa</p>
              <p>{settings.office_address}</p>
              <p className="font-mono-tabular">
                Telp: {settings.phone} · Email: {settings.email}
              </p>
            </div>
            <div className="text-left sm:text-center min-w-[220px] space-y-12">
              <div>
                <p>Sumedang, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="font-semibold text-slate-900">Kepala Desa {settings.village_name}</p>
              </div>
              <div>
                <p className="font-bold text-[var(--theme-primary)] underline underline-offset-4">
                  {settings.head_name}
                </p>
                {settings.head_nip && (
                  <p className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">{settings.head_nip}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
