import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CloudRain,
  Droplets,
  Info,
  MapPin,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Thermometer,
  Wind,
} from 'lucide-react';
import type { BmkgLivePayload, EarlyWarning, EarlyWarningSeverity } from '../types';

interface EarlyWarningSectionProps {
  warnings: EarlyWarning[];
  bmkg: BmkgLivePayload | null;
  emergencyContact?: string;
  onOpenEmergencyModal: () => void;
}

export function getSeverityMeta(severity: EarlyWarningSeverity) {
  switch (severity) {
    case 'darurat':
      return {
        label: 'DARURAT',
        icon: AlertOctagon,
        bannerBg: 'bg-red-950 text-white border-b border-red-700',
        cardBorder: 'border-red-300 bg-red-50/70',
        textAccent: 'text-red-800',
        iconColor: 'text-red-700',
      };
    case 'siaga':
      return {
        label: 'SIAGA',
        icon: ShieldAlert,
        bannerBg: 'bg-orange-950 text-white border-b border-orange-600',
        cardBorder: 'border-orange-300 bg-orange-50/70',
        textAccent: 'text-orange-800',
        iconColor: 'text-orange-700',
      };
    case 'waspada':
      return {
        label: 'WASPADA',
        icon: AlertTriangle,
        bannerBg: 'bg-[var(--theme-primary-deep)] text-white border-b border-[var(--theme-accent)]',
        cardBorder: 'border-amber-300 bg-amber-50/60',
        textAccent: 'text-amber-900',
        iconColor: 'text-amber-700',
      };
    default:
      return {
        label: 'INFO DESA',
        icon: Info,
        bannerBg: 'bg-[var(--theme-primary)] text-white border-b border-[var(--theme-accent)]',
        cardBorder: 'border-slate-200 bg-slate-50',
        textAccent: 'text-[var(--theme-primary)]',
        iconColor: 'text-[var(--theme-primary)]',
      };
  }
}

export function EarlyWarningSection({
  warnings,
  bmkg,
  emergencyContact = '',
  onOpenEmergencyModal,
}: EarlyWarningSectionProps) {
  const waDigits = emergencyContact.replace(/\D/g, '').replace(/^0/, '62');

  return (
    <section
      id="peringatan-dini"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 scroll-mt-20"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
            Kesiapsiagaan &amp; Informasi Kebencanaan
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--theme-primary)] mt-1">
            Peringatan Dini Desa &amp; Info Live BMKG
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {waDigits && (
            <a
              href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                'Halo Posko Siaga Desa Margamukti, saya ingin mengonfirmasi informasi kedaruratan/peringatan dini.'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[var(--theme-primary)] bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
              Posko Siaga Desa
            </a>
          )}
          <button
            type="button"
            onClick={onOpenEmergencyModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <Siren className="w-3.5 h-3.5" />
            Laporkan Kejadian Darurat
          </button>
        </div>
      </div>

      {/* Main Grid: Active Village Warnings + BMKG Weather & Quake */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Peringatan Resmi Pemerintah Desa */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--theme-primary)]">
                  Status Peringatan Pemerintah Desa
                </h3>
                <p className="text-xs text-slate-500">
                  Pemantauan resmi wilayah Dusun, aliran sungai &amp; akses jalan
                </p>
              </div>
              <span className="text-xs font-mono-tabular font-semibold text-[var(--theme-primary)]">
                {warnings.length > 0 ? `${warnings.length} Aktif` : 'Kondisi Normal'}
              </span>
            </div>

            {warnings.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-emerald-900">
                    Situasi Desa Margamukti Terpantau Aman &amp; Kondusif
                  </p>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Saat ini tidak ada peringatan darurat aktif yang diterbitkan Pemerintah Desa.
                    Apabila Anda menemukan kejadian mendesak (longsor, luapan air, pohon tumbang),
                    segera kirim laporan disertai titik GPS melalui tombol darurat.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {warnings.map((w) => {
                  const meta = getSeverityMeta(w.severity);
                  const SevIcon = meta.icon;
                  return (
                    <div
                      key={w.id}
                      className={`rounded-lg border p-4 space-y-2 ${meta.cardBorder}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className={`inline-flex items-center gap-1.5 font-bold ${meta.textAccent}`}>
                          <SevIcon className={`w-4 h-4 shrink-0 ${meta.iconColor}`} />
                          <span>{meta.label}</span>
                          <span aria-hidden="true">·</span>
                          <span>{w.category}</span>
                        </span>
                        <span className="text-slate-600 font-mono-tabular">
                          {w.updated_at?.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>

                      <h4 className="text-sm sm:text-base font-semibold text-[var(--theme-primary)] leading-snug">
                        {w.title}
                      </h4>

                      <p className="text-xs text-slate-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[var(--theme-accent-dark)] shrink-0" />
                        <span>Wilayah terdampak: {w.affected_area}</span>
                      </p>

                      <p className="text-xs text-slate-700 leading-relaxed">{w.description}</p>

                      {w.instruction && (
                        <div className="pt-2 border-t border-black/10 text-xs text-slate-800">
                          <span className="font-semibold text-[var(--theme-primary)]">Arahan Siaga: </span>
                          {w.instruction}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Butuh pertolongan atau melaporkan kondisi lapangan?</span>
            <button
              type="button"
              onClick={onOpenEmergencyModal}
              className="font-semibold text-red-700 hover:text-red-800 underline cursor-pointer"
            >
              Buka Panel Laporan Darurat GPS
            </button>
          </div>
        </div>

        {/* Right: Live BMKG Weather & Earthquake */}
        <div className="lg:col-span-6 grid grid-cols-1 gap-4">
          {/* Card 1: Prakiraan Cuaca BMKG */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <CloudRain className="w-5 h-5 text-[var(--theme-primary)] shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-[var(--theme-primary)]">
                    Prakiraan Cuaca Desa (BMKG)
                  </h3>
                  <p className="text-xs text-slate-500">
                    {bmkg?.weather.locationName || 'Desa Margamukti, Kec. Sumedang Utara'}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono-tabular text-slate-500">
                ADM4 {bmkg?.adm4 || '32.11.18.2008'}
              </span>
            </div>

            {bmkg?.weather.available && bmkg.weather.current ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-slate-500">Kondisi Terdekat</p>
                    <p className="text-lg font-bold text-[var(--theme-primary)] mt-0.5">
                      {bmkg.weather.current.weather_desc}
                    </p>
                    <p className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                      {bmkg.weather.current.local_datetime}
                    </p>
                  </div>
                  <div className="flex items-center gap-5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Thermometer className="w-4 h-4 text-[var(--theme-accent-dark)]" />
                      <div>
                        <p className="text-slate-500 text-[11px]">Suhu</p>
                        <p className="font-mono-tabular font-bold text-base text-[var(--theme-primary)]">
                          {bmkg.weather.current.t}°C
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Droplets className="w-4 h-4 text-[var(--theme-primary)]" />
                      <div>
                        <p className="text-slate-500 text-[11px]">Kelembapan</p>
                        <p className="font-mono-tabular font-bold text-base text-[var(--theme-primary)]">
                          {bmkg.weather.current.hu}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Wind className="w-4 h-4 text-slate-600" />
                      <div>
                        <p className="text-slate-500 text-[11px]">Angin</p>
                        <p className="font-mono-tabular font-bold text-sm text-[var(--theme-primary)]">
                          {bmkg.weather.current.ws} km/j
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {bmkg.weather.upcoming && bmkg.weather.upcoming.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {bmkg.weather.upcoming.slice(0, 4).map((slot, idx) => (
                      <div
                        key={`${slot.local_datetime}-${idx}`}
                        className="border border-slate-200 rounded-lg p-2.5 text-xs bg-white"
                      >
                        <p className="font-mono-tabular text-[11px] text-slate-500">
                          {slot.local_datetime.slice(11, 16) || slot.local_datetime}
                        </p>
                        <p className="font-semibold text-[var(--theme-primary)] truncate mt-0.5">
                          {slot.weather_desc}
                        </p>
                        <p className="font-mono-tabular text-slate-600 mt-0.5">
                          {slot.t}°C · {slot.hu}%
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                {bmkg?.weather.error ||
                  'Data prakiraan cuaca live BMKG sedang disinkronkan atau server BMKG tidak terjangkau.'}
              </div>
            )}
          </div>

          {/* Card 2: Gempabumi Terkini BMKG */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-[var(--theme-accent-dark)] shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-[var(--theme-primary)]">
                    Pemantauan Gempabumi Terkini (BMKG TEWS)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pembaruan otomatis parameter gempa nasional terbaru
                  </p>
                </div>
              </div>
            </div>

            {bmkg?.earthquake.available && bmkg.earthquake.data ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs">
                  <div>
                    <p className="text-slate-500 text-[11px]">Magnitudo</p>
                    <p className="font-mono-tabular text-lg font-bold text-[var(--theme-primary)]">
                      M {bmkg.earthquake.data.magnitude}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[11px]">Kedalaman</p>
                    <p className="font-mono-tabular text-sm font-semibold text-[var(--theme-primary)] mt-1">
                      {bmkg.earthquake.data.kedalaman}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[11px]">Waktu (WIB)</p>
                    <p className="font-mono-tabular text-xs font-semibold text-[var(--theme-primary)] mt-1">
                      {bmkg.earthquake.data.tanggal} · {bmkg.earthquake.data.jam}
                    </p>
                  </div>
                </div>
                <div className="text-xs space-y-1 text-slate-700">
                  <p>
                    <span className="font-semibold text-[var(--theme-primary)]">Pusat Gempa: </span>
                    {bmkg.earthquake.data.wilayah}
                  </p>
                  <p>
                    <span className="font-semibold text-[var(--theme-primary)]">Potensi &amp; Dirasakan: </span>
                    {bmkg.earthquake.data.potensi}
                    {bmkg.earthquake.data.dirasakan
                      ? ` · Dirasakan: ${bmkg.earthquake.data.dirasakan}`
                      : ''}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                {bmkg?.earthquake.error ||
                  'Data parameter gempa terkini dari BMKG sedang tidak terjangkau.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
