import { Printer, ShieldCheck } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { SumedangCrest } from './SumedangCrest';
import type { Official } from '../types';

interface OrganizationChartProps {
  officials: Official[];
  villageName?: string;
  districtName?: string;
  regencyName?: string;
  showPrintButton?: boolean;
}

function classifyOfficial(off: Official): 'kades' | 'sekdes' | 'kaur' | 'kasi' | 'kadus' | 'other' {
  const pos = off.position.toLowerCase();
  if (pos.includes('kepala desa') && !pos.includes('dusun')) return 'kades';
  if (pos.includes('sekretaris desa') || pos.includes('sekdes')) return 'sekdes';
  if (pos.includes('kaur') || pos.includes('urusan')) return 'kaur';
  if (pos.includes('kasi') || pos.includes('seksi')) return 'kasi';
  if (pos.includes('dusun') || pos.includes('kadus')) return 'kadus';
  return 'other';
}

function OrgNodeCard({
  official,
  variant = 'standard',
}: {
  official: Official;
  variant?: 'kades' | 'sekdes' | 'standard';
}) {
  const isKades = variant === 'kades';
  const isSekdes = variant === 'sekdes';
  const initials = official.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={`rounded-xl border text-center transition-shadow break-inside-avoid ${
        isKades
          ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-accent)] shadow-md px-5 py-4 w-full sm:w-72 mx-auto'
          : isSekdes
          ? 'bg-slate-50 text-slate-900 border-[var(--theme-primary)]/40 shadow-sm px-4 py-3.5 w-full sm:w-68 mx-auto'
          : 'bg-white text-slate-900 border-slate-200 shadow-xs px-3.5 py-3 w-full'
      }`}
    >
      <div className="flex flex-col items-center gap-2">
        <div
          className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center font-bold text-base border-2 shrink-0 ${
            isKades
              ? 'bg-white/10 text-[var(--theme-accent-light)] border-[var(--theme-accent)]'
              : 'bg-[var(--theme-primary)] text-white border-[var(--theme-accent)]/60'
          }`}
        >
          {official.photo_url ? (
            <ImageWithFallback
              src={official.photo_url}
              alt={official.name}
              className="w-full h-full object-cover"
            />
          ) : (
            initials || 'PD'
          )}
        </div>
        <div className="min-w-0 w-full">
          <p
            className={`text-[11px] font-bold uppercase tracking-wider ${
              isKades ? 'text-[var(--theme-accent-light)]' : 'text-[var(--theme-accent-dark)]'
            }`}
          >
            {official.position}
          </p>
          <p
            className={`text-sm font-bold leading-snug mt-0.5 ${
              isKades ? 'text-white' : 'text-[var(--theme-primary)]'
            }`}
          >
            {official.name}
          </p>
          {official.nip && official.nip !== '-' && (
            <p
              className={`text-[10px] font-mono-tabular mt-0.5 ${
                isKades ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {official.nip}
            </p>
          )}
          {official.tte_status === 'approved' && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold mt-1.5 ${
                isKades ? 'text-emerald-300' : 'text-emerald-700'
              }`}
            >
              <ShieldCheck className="w-3 h-3 shrink-0" />
              TTE Aktif Terverifikasi
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function OrganizationChart({
  officials,
  villageName = 'Desa Margamukti',
  districtName = 'Kecamatan Sumedang Utara',
  regencyName = 'Kabupaten Sumedang',
  showPrintButton = true,
}: OrganizationChartProps) {
  const sorted = [...officials].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const kades = sorted.filter((o) => classifyOfficial(o) === 'kades');
  const sekdes = sorted.filter((o) => classifyOfficial(o) === 'sekdes');
  const kaurs = sorted.filter((o) => classifyOfficial(o) === 'kaur');
  const kasis = sorted.filter((o) => classifyOfficial(o) === 'kasi');
  const kadus = sorted.filter((o) => classifyOfficial(o) === 'kadus');
  const others = sorted.filter((o) => classifyOfficial(o) === 'other');

  const staffGroups = [...kaurs, ...kasis, ...others];

  return (
    <div className="space-y-4">
      {showPrintButton && (
        <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--theme-primary)]">
              Struktur Organisasi Pemerintahan Desa (SOTK Otomatis)
            </h3>
            <p className="text-xs text-slate-500">
              Disusun otomatis berdasarkan urutan hierarki & jabatan perangkat desa pada sistem.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[var(--theme-accent-light)]" />
            Cetak Bagan Struktur (A4)
          </button>
        </div>
      )}

      <div className="print-only-sheet bg-white border border-slate-200 rounded-xl p-5 sm:p-8 space-y-6">
        {/* Kop Bagan untuk Cetak */}
        <div className="flex items-center justify-center gap-3 pb-4 border-b-2 border-[var(--theme-primary)]/20 text-center">
          <SumedangCrest className="w-10 h-11 shrink-0" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Pemerintah {regencyName} · {districtName}
            </p>
            <h4 className="text-base sm:text-lg font-bold uppercase tracking-wide text-[var(--theme-primary)]">
              Struktur Organisasi Tata Kerja Pemerintah {villageName}
            </h4>
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">
            Belum ada data perangkat desa terdaftar.
          </p>
        ) : (
          <div className="space-y-0">
            {/* Tier 1: Kepala Desa */}
            {kades.length > 0 && (
              <div className="flex flex-col items-center">
                <div className="w-full flex flex-wrap justify-center gap-4">
                  {kades.map((k) => (
                    <OrgNodeCard key={k.id} official={k} variant="kades" />
                  ))}
                </div>
                {(sekdes.length > 0 || staffGroups.length > 0 || kadus.length > 0) && (
                  <div className="w-0.5 h-7 bg-slate-300" aria-hidden="true" />
                )}
              </div>
            )}

            {/* Tier 2: Sekretaris Desa */}
            {sekdes.length > 0 && (
              <div className="flex flex-col items-center">
                <div className="w-full flex flex-wrap justify-center gap-4">
                  {sekdes.map((s) => (
                    <OrgNodeCard key={s.id} official={s} variant="sekdes" />
                  ))}
                </div>
                {(staffGroups.length > 0 || kadus.length > 0) && (
                  <div className="w-0.5 h-7 bg-slate-300" aria-hidden="true" />
                )}
              </div>
            )}

            {/* Tier 3: Unsur Staf (Kaur & Kasi) */}
            {staffGroups.length > 0 && (
              <div className="space-y-3">
                <div className="hidden md:block mx-12 border-t-2 border-slate-300 h-4" aria-hidden="true" />
                <div className="text-center">
                  <span className="inline-block px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-primary)] bg-slate-100 rounded">
                    Unsur Sekretariat (Kepala Urusan) &amp; Pelaksana Teknis (Kepala Seksi)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 pt-1">
                  {staffGroups.map((st) => (
                    <OrgNodeCard key={st.id} official={st} />
                  ))}
                </div>
              </div>
            )}

            {/* Connector to Kadus */}
            {kadus.length > 0 && staffGroups.length > 0 && (
              <div className="flex justify-center">
                <div className="w-0.5 h-7 bg-slate-300" aria-hidden="true" />
              </div>
            )}

            {/* Tier 4: Unsur Kewilayahan (Kepala Dusun) */}
            {kadus.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="hidden md:block mx-24 border-t-2 border-slate-300 h-4" aria-hidden="true" />
                <div className="text-center">
                  <span className="inline-block px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-accent-dark)] bg-amber-50 border border-amber-200 rounded">
                    Pelaksana Kewilayahan (Kepala Dusun)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto pt-1">
                  {kadus.map((kd) => (
                    <OrgNodeCard key={kd.id} official={kd} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
