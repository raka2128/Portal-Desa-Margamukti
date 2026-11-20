import { useEffect, useState } from 'react';
import { Building2, LayoutGrid, MapPin, Network, Phone, ShieldCheck, Users } from 'lucide-react';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import { DemographicCharts } from '../../components/DemographicCharts';
import { ApbdesPublicSection } from '../../components/ApbdesPublicSection';
import { OrganizationChart } from '../../components/OrganizationChart';
import { VillagePortfolioSection } from '../../components/VillagePortfolioSection';
import type { Official, PopulationStats, Region, VillageSettings } from '../../types';

interface ProfilePageProps {
  initialTab?: string;
  onOpenMapLocation?: (markerId: string) => void;
  onOpenDevelopments?: () => void;
  onOpenInstitution?: (slug: string) => void;
}

type ProfileTab = 'tentang' | 'portofolio' | 'perangkat' | 'wilayah' | 'statistik' | 'apbdes';

const VALID_TABS: ProfileTab[] = ['tentang', 'portofolio', 'perangkat', 'wilayah', 'statistik', 'apbdes'];

export function ProfilePage({
  initialTab = 'tentang',
  onOpenMapLocation,
  onOpenDevelopments,
  onOpenInstitution,
}: ProfilePageProps) {
  const [tab, setTab] = useState<ProfileTab>(
    VALID_TABS.includes(initialTab as ProfileTab) ? (initialTab as ProfileTab) : 'tentang'
  );
  const [perangkatView, setPerangkatView] = useState<'bagan' | 'kartu'>('bagan');
  const [dusunFilter, setDusunFilter] = useState<string>('Semua');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    settings: VillageSettings;
    officials: Official[];
    regions: Region[];
    stats: PopulationStats;
  } | null>(null);

  useEffect(() => {
    if (VALID_TABS.includes(initialTab as ProfileTab)) {
      setTab(initialTab as ProfileTab);
    }
  }, [initialTab]);

  useEffect(() => {
    fetch('/api/public/profile')
      .then((r) => r.json())
      .then((json) => setData(json))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="h-10 w-64 bg-slate-200 rounded" />
        <div className="h-64 bg-white border border-slate-200 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const { settings, officials, regions, stats } = data;
  const dusunNames = ['Semua', ...Array.from(new Set(regions.map((r) => r.dusun)))];
  const filteredRegions =
    dusunFilter === 'Semua' ? regions : regions.filter((r) => r.dusun === dusunFilter);

  const missionLines = settings.mission
    .split('\n')
    .map((m) => m.trim())
    .filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header & Segmented Tabs */}
      <div className="no-print flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
            {settings.district_name} · {settings.regency_name}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--theme-primary)] mt-1">
            Profil &amp; Pemerintahan {settings.village_name}
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto no-scrollbar max-w-full w-full md:w-auto self-start">
          <button
            type="button"
            onClick={() => setTab('tentang')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'tentang' ? 'bg-white text-[var(--theme-primary)] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Visi, Misi & Sejarah
          </button>
          <button
            type="button"
            onClick={() => setTab('portofolio')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'portofolio' ? 'bg-white text-[var(--theme-primary)] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Portofolio Desa
          </button>
          <button
            type="button"
            onClick={() => setTab('perangkat')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'perangkat' ? 'bg-white text-[var(--theme-primary)] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Perangkat Desa ({officials.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('wilayah')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'wilayah' ? 'bg-white text-[var(--theme-primary)] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Wilayah Dusun & RT/RW
          </button>
          <button
            type="button"
            onClick={() => setTab('statistik')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'statistik' ? 'bg-white text-[var(--theme-primary)] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Statistik Penduduk
          </button>
          <button
            type="button"
            onClick={() => setTab('apbdes')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'apbdes' ? 'bg-white text-[var(--theme-primary)] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Transparansi APBDes
          </button>
        </div>
      </div>

      {/* Tab 1: Visi, Misi, Sejarah */}
      {tab === 'tentang' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                Visi Pemerintahan Desa
              </p>
              <blockquote className="text-xl sm:text-2xl font-display text-[var(--theme-primary)] leading-relaxed">
                “{settings.vision}”
              </blockquote>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                Misi Pembangunan Desa
              </p>
              <ul className="space-y-3 text-sm sm:text-base text-slate-700 leading-relaxed">
                {missionLines.map((line, i) => (
                  <li key={i} className="pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                Gambaran Umum & Sejarah Singkat
              </p>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line">
                {settings.history}
              </p>
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-5">
            <div className="bg-[var(--theme-primary)] text-white rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-white/15">
                <Building2 className="w-5 h-5 text-[var(--theme-accent-light)]" />
                <h3 className="text-base font-semibold">Identitas Administratif</h3>
              </div>
              <dl className="space-y-3 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-300">Kode Kemendagri</dt>
                  <dd className="font-mono-tabular font-semibold">{settings.village_code}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-300">Kode Pos</dt>
                  <dd className="font-mono-tabular font-semibold">{settings.postal_code}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-300">Kecamatan</dt>
                  <dd className="font-medium text-right">{settings.district_name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-300">Kabupaten</dt>
                  <dd className="font-medium text-right">{settings.regency_name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-300">Provinsi</dt>
                  <dd className="font-medium text-right">{settings.province_name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-300">Jumlah Penduduk</dt>
                  <dd className="font-mono-tabular font-semibold text-[var(--theme-accent-light)]">
                    {stats.totalResidents} Jiwa
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--theme-primary)]">Alamat Kantor Desa</h3>
              <p className="text-xs text-slate-600 leading-relaxed flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[var(--theme-accent)] shrink-0 mt-0.5" />
                <span>{settings.office_address}</span>
              </p>
              <p className="text-xs text-slate-600 flex items-center gap-2">
                <Phone className="w-4 h-4 text-[var(--theme-accent)] shrink-0" />
                <span>{settings.phone}</span>
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* Tab 2: Struktur Organisasi & Profil Perangkat Desa */}
      {tab === 'perangkat' && (
        <div className="space-y-6">
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setPerangkatView('bagan')}
                className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  perangkatView === 'bagan'
                    ? 'bg-[var(--theme-primary)] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[var(--theme-primary)]'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                Bagan Struktur Organisasi
              </button>
              <button
                type="button"
                onClick={() => setPerangkatView('kartu')}
                className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  perangkatView === 'kartu'
                    ? 'bg-[var(--theme-primary)] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[var(--theme-primary)]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Profil &amp; Tupoksi Aparatur ({officials.length})
              </button>
            </div>
          </div>

          {perangkatView === 'bagan' ? (
            <OrganizationChart
              officials={officials}
              villageName={settings.village_name}
              districtName={settings.district_name}
              regencyName={settings.regency_name}
              showPrintButton
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {officials.map((off) => (
                <div
                  key={off.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="p-6 flex items-start gap-4">
                    <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[var(--theme-primary)] text-white flex items-center justify-center text-xl font-bold border border-slate-200">
                      {off.photo_url ? (
                        <ImageWithFallback
                          src={off.photo_url}
                          alt={off.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        off.name
                          .split(' ')
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join('')
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-semibold text-[var(--theme-accent-dark)]">{off.position}</p>
                      <h3 className="text-base font-bold text-[var(--theme-primary)] leading-snug">{off.name}</h3>
                      <p className="text-xs font-mono-tabular text-slate-500">{off.nip}</p>
                      {off.tte_status === 'approved' && (
                        <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 pt-0.5">
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                          TTE Resmi Terverifikasi
                        </p>
                      )}
                    </div>
                  </div>
                  {off.bio && (
                    <div className="px-6 pb-5 pt-3 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
                      {off.bio}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Wilayah Administratif (Dusun, Blok, RW, RT + Pengurus & Peta) */}
      {tab === 'wilayah' && (
        <div className="space-y-6">
          {/* Ringkasan Dusun & Kepala Dusun */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dusunNames
              .filter((d) => d !== 'Semua')
              .map((dusunName) => {
                const dusunRows = regions.filter((r) => r.dusun === dusunName);
                const kepalaDusun =
                  dusunRows.find((r) => r.kepala_dusun && r.kepala_dusun !== '-')?.kepala_dusun || '-';
                const rwCount = new Set(dusunRows.map((r) => r.rw)).size;
                const mappedCount = dusunRows.filter(
                  (r) => r.latitude !== null && r.longitude !== null
                ).length;
                const isSelected = dusunFilter === dusunName;
                return (
                  <button
                    key={dusunName}
                    type="button"
                    onClick={() => setDusunFilter(isSelected ? 'Semua' : dusunName)}
                    className={`text-left bg-white rounded-xl p-5 border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[var(--theme-primary)] ring-1 ring-[var(--theme-primary)]/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[var(--theme-accent-dark)]">Wilayah Dusun</p>
                    <h3 className="text-base font-bold text-[var(--theme-primary)] mt-0.5">{dusunName}</h3>
                    <p className="text-sm text-slate-700 mt-2">
                      Kepala Dusun: <span className="font-semibold text-slate-900">{kepalaDusun}</span>
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 font-mono-tabular">
                      <span>{rwCount} RW</span>
                      <span aria-hidden="true">·</span>
                      <span>{dusunRows.length} RT</span>
                      <span aria-hidden="true">·</span>
                      <span>{mappedCount} Titik Peta</span>
                    </div>
                  </button>
                );
              })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {dusunNames.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDusunFilter(d)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dusunFilter === d
                      ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-2 text-xs text-slate-600 font-mono-tabular">
              <Users className="w-4 h-4 text-[var(--theme-accent)]" />
              <span>Total: {filteredRegions.length} Wilayah RT</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Mobile Compact Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredRegions.map((reg) => {
                const hasCoords = reg.latitude !== null && reg.longitude !== null;
                return (
                  <div key={reg.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--theme-accent-dark)]">{reg.dusun}</p>
                        <h4 className="text-sm font-bold text-[var(--theme-primary)]">{reg.blok}</h4>
                      </div>
                      <span className="font-mono-tabular text-xs font-semibold text-[var(--theme-primary)] shrink-0">
                        RT {reg.rt} / RW {reg.rw}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      <p>Kadus: <span className="font-medium text-slate-800">{reg.kepala_dusun || '-'}</span></p>
                      <p>
                        Ketua RW: <span className="font-medium text-slate-800">{reg.ketua_rw || '-'}</span>
                        {' · '}
                        Ketua RT: <span className="font-medium text-slate-800">{reg.ketua_rt || '-'}</span>
                      </p>
                    </div>
                    <div className="pt-1">
                      {hasCoords && onOpenMapLocation ? (
                        <button
                          type="button"
                          onClick={() => onOpenMapLocation(`region-${reg.id}`)}
                          className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--theme-primary)] bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <MapPin className="w-4 h-4 text-[var(--theme-accent-dark)] shrink-0" />
                          <span>Lihat Titik Wilayah di Peta</span>
                        </button>
                      ) : (
                        <p className="text-xs text-slate-400">Koordinat peta belum ditandai</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-4">Dusun</th>
                    <th className="py-3.5 px-4">Kepala Dusun</th>
                    <th className="py-3.5 px-4">Blok / Kampung</th>
                    <th className="py-3.5 px-4">RW</th>
                    <th className="py-3.5 px-4">Ketua RW</th>
                    <th className="py-3.5 px-4">RT</th>
                    <th className="py-3.5 px-4">Ketua RT</th>
                    <th className="py-3.5 px-4 text-right">Lokasi Peta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredRegions.map((reg) => {
                    const hasCoords = reg.latitude !== null && reg.longitude !== null;
                    return (
                      <tr key={reg.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4 font-medium text-[var(--theme-primary)]">{reg.dusun}</td>
                        <td className="py-3.5 px-4 text-slate-700">{reg.kepala_dusun || '-'}</td>
                        <td className="py-3.5 px-4 text-slate-700">{reg.blok}</td>
                        <td className="py-3.5 px-4 font-mono-tabular text-slate-700">RW {reg.rw}</td>
                        <td className="py-3.5 px-4 text-slate-700">{reg.ketua_rw}</td>
                        <td className="py-3.5 px-4 font-mono-tabular text-slate-700">RT {reg.rt}</td>
                        <td className="py-3.5 px-4 text-slate-700">{reg.ketua_rt}</td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {hasCoords && onOpenMapLocation ? (
                            <button
                              type="button"
                              onClick={() => onOpenMapLocation(`region-${reg.id}`)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--theme-primary)] hover:text-[var(--theme-accent-dark)] cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span>Lihat di Peta</span>
                            </button>
                          ) : hasCoords ? (
                            <span className="text-xs font-mono-tabular text-slate-500">
                              {Number(reg.latitude).toFixed(4)}, {Number(reg.longitude).toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Belum ditandai</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Portofolio Pemerintah Desa */}
      {tab === 'portofolio' && (
        <VillagePortfolioSection
          onOpenDevelopments={onOpenDevelopments}
          onOpenInstitution={onOpenInstitution}
        />
      )}

      {/* Tab 4: Statistik Penduduk Lengkap */}
      {tab === 'statistik' && <DemographicCharts stats={stats} mode="full" />}

      {/* Tab 5: Transparansi APBDes */}
      {tab === 'apbdes' && <ApbdesPublicSection />}
    </div>
  );
}
