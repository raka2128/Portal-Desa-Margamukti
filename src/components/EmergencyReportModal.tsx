import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  MapPin,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';
import { LeafletMap } from './LeafletMap';
import type { MapMarkerItem } from '../types';

interface EmergencyReportModalProps {
  open: boolean;
  onClose: () => void;
  defaultLat?: number;
  defaultLng?: number;
  emergencyContact?: string;
}

const INCIDENT_TYPES = [
  'Banjir / Luapan Air',
  'Tanah Longsor',
  'Pohon Tumbang / Jalan Tertutup',
  'Angin Kencang / Puting Beliung',
  'Kebakaran',
  'Kerusakan Infrastruktur / Jembatan',
  'Keadaan Darurat Medis / Kecelakaan',
  'Insiden Keamanan / Lainnya',
];

export function EmergencyReportModal({
  open,
  onClose,
  defaultLat = -6.8283,
  defaultLng = 107.9,
  emergencyContact = '',
}: EmergencyReportModalProps) {
  const [senderName, setSenderName] = useState('');
  const [senderContact, setSenderContact] = useState('');
  const [incidentType, setIncidentType] = useState(INCIDENT_TYPES[0]);
  const [locationLandmark, setLocationLandmark] = useState('');
  const [description, setDescription] = useState('');

  const [latText, setLatText] = useState(String(defaultLat));
  const [lngText, setLngText] = useState(String(defaultLng));
  const [focusCoords, setFocusCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle');
  const [gpsMessage, setGpsMessage] = useState(
    'Gunakan tombol GPS otomatis atau klik langsung titik kejadian pada peta.'
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedResult, setSubmittedResult] = useState<{
    reportCode: string;
    lat: number;
    lng: number;
    incidentType: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setSubmitError('');
      if (!submittedResult) {
        setLatText((prev) => prev || String(defaultLat));
        setLngText((prev) => prev || String(defaultLng));
      }
    }
  }, [open, defaultLat, defaultLng, submittedResult]);

  if (!open) return null;

  const parsedLat = Number(latText);
  const parsedLng = Number(lngText);
  const hasValidCoords =
    latText.trim() !== '' &&
    lngText.trim() !== '' &&
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng);

  const handleGetGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsMessage('Peramban tidak mendukung GPS otomatis. Silakan klik titik pada peta.');
      return;
    }
    setGpsStatus('locating');
    setGpsMessage('Mengambil koordinat GPS perangkat Anda...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = Number(pos.coords.latitude.toFixed(6));
        const nextLng = Number(pos.coords.longitude.toFixed(6));
        setLatText(String(nextLat));
        setLngText(String(nextLng));
        setFocusCoords({ lat: nextLat, lng: nextLng });
        setGpsStatus('ready');
        setGpsMessage(
          `Koordinat GPS aktif berhasil diambil (akurasi ±${Math.round(pos.coords.accuracy)} m). Anda tetap dapat menggeser pin dengan mengklik peta.`
        );
      },
      (err) => {
        setGpsStatus('error');
        const reason =
          err.code === err.PERMISSION_DENIED
            ? 'Izin lokasi ditolak peramban.'
            : err.code === err.TIMEOUT
              ? 'Waktu pengambilan sinyal GPS habis.'
              : 'Sinyal GPS tidak tersedia.';
        setGpsMessage(`${reason} Silakan klik langsung titik kejadian pada peta di bawah.`);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const handlePickFromMap = (coords: { lat: number; lng: number }) => {
    setLatText(String(coords.lat));
    setLngText(String(coords.lng));
    setGpsStatus('ready');
    setGpsMessage('Titik lokasi dipilih langsung dari peta. Klik titik lain jika perlu menyesuaikan.');
  };

  const handleResetAndClose = () => {
    setSubmittedResult(null);
    setSubmitError('');
    setSenderName('');
    setSenderContact('');
    setLocationLandmark('');
    setDescription('');
    setGpsStatus('idle');
    setGpsMessage('Gunakan tombol GPS otomatis atau klik langsung titik kejadian pada peta.');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!hasValidCoords) {
      setSubmitError('Koordinat lokasi GPS wajib ditentukan terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/emergency-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_name: senderName,
          sender_contact: senderContact,
          incident_type: incidentType,
          location_landmark: locationLandmark,
          description,
          latitude: parsedLat,
          longitude: parsedLng,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || 'Gagal mengirim laporan darurat.');
        return;
      }
      setSubmittedResult({
        reportCode: json.reportCode || `DRT-${json.id}`,
        lat: parsedLat,
        lng: parsedLng,
        incidentType,
      });
    } catch {
      setSubmitError('Koneksi ke server gagal. Periksa jaringan Anda atau hubungi kontak darurat desa.');
    } finally {
      setSubmitting(false);
    }
  };

  const waDigits = emergencyContact.replace(/\D/g, '').replace(/^0/, '62');
  const mapPreviewMarkers: MapMarkerItem[] = [];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 flex items-end sm:items-center justify-center p-0 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-modal-title"
      onClick={handleResetAndClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-xl max-w-4xl w-full max-h-[94dvh] overflow-y-auto shadow-2xl border border-slate-200 pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 z-20 bg-[#0F2744] text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 border-b-2 border-[#C59B27]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-red-600/20 border border-red-400/50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-300" />
            </div>
            <div className="min-w-0">
              <h2 id="emergency-modal-title" className="text-base sm:text-lg font-semibold truncate">
                Panel Laporan Darurat Warga
              </h2>
              <p className="text-xs text-slate-300 truncate">
                Laporan langsung masuk ke Kotak Masuk &amp; Panel Peringatan Pemerintah Desa Margamukti
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
            aria-label="Tutup panel laporan darurat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {submittedResult ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                    Laporan Darurat Diterima Sistem Desa
                  </p>
                  <h3 className="text-xl font-bold text-[#0F2744]">
                    Kode Laporan:{' '}
                    <span className="font-mono-tabular">{submittedResult.reportCode}</span>
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Laporan kejadian <strong>{submittedResult.incidentType}</strong> beserta titik GPS (
                    <span className="font-mono-tabular">
                      {submittedResult.lat}, {submittedResult.lng}
                    </span>
                    ) telah diteruskan ke perangkat piket dan Kotak Masuk Pemerintah Desa Margamukti.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {waDigits && (
                  <a
                    href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                      `[LAPORAN DARURAT ${submittedResult.reportCode}] Jenis: ${submittedResult.incidentType}. Lokasi GPS: https://www.openstreetmap.org/?mlat=${submittedResult.lat}&mlon=${submittedResult.lng}#map=17/${submittedResult.lat}/${submittedResult.lng}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors whitespace-nowrap"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Konfirmasi via WhatsApp Posko Desa
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2.5 text-xs font-semibold text-[#0F2744] bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer whitespace-nowrap"
                >
                  Tutup Panel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
            {submitError && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: GPS + Interactive Map Picker */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0F2744] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#A67F17]" />
                      Titik Lokasi Insiden (GPS) *
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGetGps}
                    disabled={gpsStatus === 'locating'}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-[#E5C158]" />
                    {gpsStatus === 'locating' ? 'Mencari GPS...' : 'Ambil Lokasi GPS Otomatis'}
                  </button>
                </div>

                <p
                  className={`text-xs leading-relaxed px-3 py-2 rounded-lg border ${
                    gpsStatus === 'ready'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : gpsStatus === 'error'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {gpsMessage}
                </p>

                <LeafletMap
                  centerLat={defaultLat}
                  centerLng={defaultLng}
                  locations={mapPreviewMarkers}
                  pickerMode
                  pickedCoords={hasValidCoords ? { lat: parsedLat, lng: parsedLng } : null}
                  onPickCoords={handlePickFromMap}
                  focusCoords={focusCoords}
                  heightClass="h-[290px]"
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Latitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={latText}
                      onChange={(e) => setLatText(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-md focus:outline-none focus:border-[#0F2744]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Longitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={lngText}
                      onChange={(e) => setLngText(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-md focus:outline-none focus:border-[#0F2744]"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Reporter & Incident Form */}
              <div className="lg:col-span-6 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Pelapor *
                    </label>
                    <input
                      type="text"
                      required
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Nama lengkap warga"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[#0F2744]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nomor HP / WhatsApp *
                    </label>
                    <input
                      type="text"
                      required
                      value={senderContact}
                      onChange={(e) => setSenderContact(e.target.value)}
                      placeholder="0812xxxxxxxx"
                      className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md focus:outline-none focus:border-[#0F2744]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Insiden Darurat *
                  </label>
                  <select
                    required
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:border-[#0F2744]"
                  >
                    {INCIDENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Patokan Lokasi / Dusun / RT-RW (Opsional)
                  </label>
                  <input
                    type="text"
                    value={locationLandmark}
                    onChange={(e) => setLocationLandmark(e.target.value)}
                    placeholder="Contoh: Dusun Pawenang RT 02 RW 01, dekat Jembatan Cibeureum"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[#0F2744]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deskripsi Singkat Situasi &amp; Kebutuhan Bantuan *
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Jelaskan kondisi di lokasi saat ini, perkiraan dampak, serta kebutuhan pertolongan segera..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[#0F2744]"
                  />
                </div>

                <div className="pt-2 flex flex-col-reverse sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-2.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    className="px-4 py-2.5 min-h-[44px] text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer whitespace-nowrap"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-60 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? 'Mengirim Laporan...' : 'Kirim Laporan Darurat Sekarang'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
