import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Printer,
  Trash2,
  UserMinus,
  X,
} from 'lucide-react';
import { SumedangCrest } from './SumedangCrest';
import {
  DEATH_CAUSE_OPTIONS,
  DEATH_LOCATION_OPTIONS,
  INDONESIAN_DAYS,
  getIndonesianDayFromDate,
} from '../constants/residentOptions';
import { adminFetch } from '../utils/adminApi';
import { formatIndonesianDate } from '../utils/pdfGenerator';
import { generateDeathCertificatePdf } from '../utils/residentExport';
import type { Resident, VillageSettings } from '../types';

export type DeleteDeathModalMode = 'choose' | 'death_form' | 'certificate';

interface ResidentDeleteDeathModalProps {
  open: boolean;
  resident: Resident | null;
  initialMode?: DeleteDeathModalMode;
  isRtRw?: boolean;
  settings: VillageSettings | null;
  onClose: () => void;
  onDeleted: () => void;
  onDeathRecorded: (updated: Resident) => void;
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

type DeleteReasonOption = 'kesalahan_data' | 'data_ganda' | 'meninggal';

export function ResidentDeleteDeathModal({
  open,
  resident,
  initialMode = 'choose',
  isRtRw = false,
  settings,
  onClose,
  onDeleted,
  onDeathRecorded,
  onNotify,
}: ResidentDeleteDeathModalProps) {
  const [step, setStep] = useState<'choose' | 'confirm_delete' | 'death_form' | 'certificate'>('choose');
  const [reason, setReason] = useState<DeleteReasonOption>('kesalahan_data');
  const [busy, setBusy] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [certResident, setCertResident] = useState<Resident | null>(null);

  const [deathForm, setDeathForm] = useState({
    death_date: '',
    death_day: 'Senin',
    death_time: '08:00',
    death_cause: 'Sakit',
    death_location: 'Rumah',
    death_reporter_name: '',
    death_reporter_nik: '',
  });

  useEffect(() => {
    if (!open || !resident) return;
    const today = new Date().toISOString().slice(0, 10);
    const defaultDate = resident.mutation_date || today;
    setCertResident(resident);
    setReason(isRtRw ? 'meninggal' : 'kesalahan_data');
    setDeathForm({
      death_date: defaultDate,
      death_day: resident.death_day || getIndonesianDayFromDate(defaultDate),
      death_time: resident.death_time || '08:00',
      death_cause: resident.death_cause || 'Sakit',
      death_location: resident.death_location || 'Rumah',
      death_reporter_name: resident.death_reporter_name || '',
      death_reporter_nik: resident.death_reporter_nik || '',
    });

    if (initialMode === 'certificate') {
      setStep('certificate');
    } else if (initialMode === 'death_form') {
      setReason('meninggal');
      setStep('death_form');
    } else {
      setStep('choose');
    }
  }, [open, resident, initialMode, isRtRw]);

  if (!open || !resident) return null;

  const activeCert = certResident || resident;

  const handleProceedReason = () => {
    if (reason === 'meninggal') {
      setStep('death_form');
      return;
    }
    if (isRtRw) {
      onNotify('Hapus permanen hanya dapat dilakukan oleh Admin Desa.', 'err');
      return;
    }
    setStep('confirm_delete');
  };

  const handleConfirmPermanentDelete = async () => {
    if (reason !== 'kesalahan_data' && reason !== 'data_ganda') return;
    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/residents/${resident.id}?reason=${reason}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || 'Gagal menghapus data penduduk.', 'err');
        return;
      }
      onNotify(
        reason === 'data_ganda'
          ? `Data ganda atas nama ${resident.full_name} berhasil dihapus permanen.`
          : `Data dengan kesalahan input atas nama ${resident.full_name} berhasil dihapus permanen.`
      );
      onDeleted();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitDeath = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/residents/${resident.id}/record-death`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deathForm),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || 'Gagal mencatat data penduduk meninggal.', 'err');
        return;
      }
      const updated = (json.resident || {
        ...resident,
        resident_status: 'meninggal',
        mutation_date: deathForm.death_date,
        death_time: deathForm.death_time,
        death_day: deathForm.death_day,
        death_cause: deathForm.death_cause,
        death_location: deathForm.death_location,
        death_reporter_name: deathForm.death_reporter_name,
        death_reporter_nik: deathForm.death_reporter_nik,
      }) as Resident;

      setCertResident(updated);
      onDeathRecorded(updated);
      setStep('certificate');
      onNotify(`Data meninggal atas nama ${updated.full_name} diarsipkan dan Form Keterangan siap dicetak.`);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadCertificatePdf = async () => {
    setPdfLoading(true);
    try {
      await generateDeathCertificatePdf(activeCert, settings);
      onNotify(`PDF Form Keterangan Meninggal (${activeCert.full_name}) berhasil diunduh.`);
    } catch {
      onNotify('Gagal membuat PDF Form Keterangan Meninggal.', 'err');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="print-modal-root fixed inset-0 z-50 bg-slate-950/70 flex items-start justify-center p-4 overflow-y-auto">
      <div
        className={`print-modal-card bg-white rounded-xl w-full my-6 overflow-hidden border border-slate-200 shadow-2xl ${
          step === 'certificate' ? 'max-w-4xl' : 'max-w-2xl'
        }`}
      >
        {/* Top Modal Header */}
        <div className="no-print bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                step === 'certificate'
                  ? 'bg-[#0F2744] text-[#E5C158]'
                  : step === 'death_form'
                  ? 'bg-slate-800 text-amber-300'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {step === 'certificate' ? (
                <FileText className="w-4 h-4" />
              ) : step === 'death_form' ? (
                <UserMinus className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#0F2744]">
                {step === 'choose' && 'Konfirmasi Hapus / Perubahan Status Penduduk'}
                {step === 'confirm_delete' && 'Konfirmasi Akhir Hapus Permanen'}
                {step === 'death_form' && 'Formulir Pencatatan Penduduk Meninggal Dunia'}
                {step === 'certificate' && 'Form Surat Keterangan Meninggal Dunia'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeCert.full_name} · NIK{' '}
                <span className="font-mono-tabular font-semibold">{activeCert.nik}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {step === 'certificate' && (
              <>
                <button
                  type="button"
                  disabled={pdfLoading}
                  onClick={handleDownloadCertificatePdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F2744] bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {pdfLoading ? 'Menyusun PDF...' : 'Unduh PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak Form Meninggal
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md cursor-pointer"
              aria-label="Tutup dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* STEP 1: CHOOSE REASON SAFEGUARD */}
        {step === 'choose' && (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                Peringatan Sebelum Menghapus Data Penduduk
              </p>
              <p className="text-amber-900 leading-relaxed">
                Untuk menghindari kesalahan penghapusan data kependudukan, pilih alasan penghapusan terlebih dahulu. Jika penduduk <strong>Meninggal Dunia</strong>, data tidak dihapus permanen melainkan diarsipkan agar statistik berkurang dan Form Keterangan Meninggal dapat dicetak ulang kapan saja.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Nama Lengkap:</span>{' '}
                <span className="font-semibold text-[#0F2744]">{resident.full_name}</span>
              </div>
              <div>
                <span className="text-slate-500">NIK:</span>{' '}
                <span className="font-mono-tabular font-semibold text-slate-800">{resident.nik}</span>
              </div>
              <div>
                <span className="text-slate-500">No. KK:</span>{' '}
                <span className="font-mono-tabular text-slate-700">{resident.no_kk}</span>
              </div>
              <div>
                <span className="text-slate-500">Wilayah:</span>{' '}
                <span className="text-slate-700">
                  {resident.dusun ? `${resident.dusun} (RT ${resident.rt}/RW ${resident.rw})` : resident.address}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-slate-700">Pilih Alasan Penghapusan Data:</p>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-lg border transition-colors ${
                  isRtRw
                    ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                    : reason === 'kesalahan_data'
                    ? 'bg-[#0F2744]/5 border-[#0F2744] cursor-pointer'
                    : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                }`}
              >
                <input
                  type="radio"
                  name="deleteReason"
                  disabled={isRtRw}
                  checked={reason === 'kesalahan_data'}
                  onChange={() => setReason('kesalahan_data')}
                  className="mt-1"
                />
                <div className="text-xs">
                  <div className="font-semibold text-[#0F2744]">
                    Kesalahan Input Data {isRtRw && '(Khusus Admin Desa)'}
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    Menghapus data secara permanen karena salah ketik identitas atau entri uji coba yang tidak valid.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-lg border transition-colors ${
                  isRtRw
                    ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                    : reason === 'data_ganda'
                    ? 'bg-[#0F2744]/5 border-[#0F2744] cursor-pointer'
                    : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                }`}
              >
                <input
                  type="radio"
                  name="deleteReason"
                  disabled={isRtRw}
                  checked={reason === 'data_ganda'}
                  onChange={() => setReason('data_ganda')}
                  className="mt-1"
                />
                <div className="text-xs">
                  <div className="font-semibold text-[#0F2744]">
                    Data Ganda / Duplikat {isRtRw && '(Khusus Admin Desa)'}
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    Menghapus entri duplikat secara permanen agar tidak terjadi penghitungan ganda pada rekapitulasi desa.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-lg border transition-colors cursor-pointer ${
                  reason === 'meninggal'
                    ? 'bg-[#0F2744]/5 border-[#0F2744]'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="deleteReason"
                  checked={reason === 'meninggal'}
                  onChange={() => setReason('meninggal')}
                  className="mt-1"
                />
                <div className="text-xs">
                  <div className="font-semibold text-[#0F2744]">Meninggal Dunia</div>
                  <p className="text-slate-500 mt-0.5">
                    Membuka formulir pencatatan wafat (jam, hari, sebab, lokasi, pelapor) dan membuat Form Keterangan Meninggal resmi dari Desa Margamukti.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProceedReason}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-md cursor-pointer ${
                  reason === 'meninggal'
                    ? 'bg-[#0F2744] hover:bg-[#16355C]'
                    : 'bg-red-700 hover:bg-red-800'
                }`}
              >
                {reason === 'meninggal' ? (
                  <>
                    <UserMinus className="w-3.5 h-3.5" /> Lanjut ke Form Meninggal
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Lanjut Hapus Permanen
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2A: CONFIRM PERMANENT DELETE */}
        {step === 'confirm_delete' && (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 space-y-2">
              <p className="font-bold text-sm text-red-800">
                Konfirmasi Penghapusan Permanen ({reason === 'data_ganda' ? 'Data Ganda' : 'Kesalahan Data'})
              </p>
              <p className="leading-relaxed">
                Anda akan menghapus data penduduk atas nama <strong>{resident.full_name}</strong> (NIK{' '}
                <span className="font-mono-tabular font-semibold">{resident.nik}</span>) secara permanen dari basis data Desa Margamukti. Tindakan ini tidak dapat dipulihkan.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('choose')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmPermanentDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-md disabled:opacity-60 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {busy ? 'Menghapus...' : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2B: DEATH RECORDING FORM */}
        {step === 'death_form' && (
          <form onSubmit={handleSubmitDeath} className="p-6 space-y-5">
            {/* Identitas Penduduk yang Dicatatkan Meninggal */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-[#0F2744]">
                Identitas Penduduk yang Dicatatkan Meninggal
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-700">
                <div>
                  <span className="text-slate-500">Nama Lengkap:</span>{' '}
                  <span className="font-semibold text-slate-900">{resident.full_name}</span>
                </div>
                <div>
                  <span className="text-slate-500">NIK:</span>{' '}
                  <span className="font-mono-tabular font-semibold">{resident.nik}</span>
                </div>
                <div>
                  <span className="text-slate-500">No. KK:</span>{' '}
                  <span className="font-mono-tabular">{resident.no_kk}</span>
                </div>
                <div>
                  <span className="text-slate-500">TTL / Kelamin:</span>{' '}
                  <span>
                    {resident.birth_place}, {resident.birth_date} ({resident.gender})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Agama / Pekerjaan:</span>{' '}
                  <span>
                    {resident.religion} · {resident.occupation}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Nama Ayah / Ibu:</span>{' '}
                  <span>
                    {resident.father_name || '-'} / {resident.mother_name || '-'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500">Alamat:</span>{' '}
                  <span>
                    {resident.dusun
                      ? `${resident.address} (${resident.dusun}, RT ${resident.rt}/RW ${resident.rw})`
                      : resident.address}
                  </span>
                </div>
              </div>
            </div>

            {/* Rincian Data Kematian */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Meninggal *
                </label>
                <input
                  type="date"
                  required
                  value={deathForm.death_date}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setDeathForm((prev) => ({
                      ...prev,
                      death_date: nextDate,
                      death_day: getIndonesianDayFromDate(nextDate),
                    }));
                  }}
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hari Meninggal *
                </label>
                <select
                  required
                  value={deathForm.death_day}
                  onChange={(e) => setDeathForm({ ...deathForm, death_day: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {INDONESIAN_DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jam Meninggal (WIB) *
                </label>
                <input
                  type="time"
                  required
                  value={deathForm.death_time}
                  onChange={(e) => setDeathForm({ ...deathForm, death_time: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sebab Meninggal *
                </label>
                <select
                  required
                  value={deathForm.death_cause}
                  onChange={(e) => setDeathForm({ ...deathForm, death_cause: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {DEATH_CAUSE_OPTIONS.map((cause) => (
                    <option key={cause} value={cause}>
                      {cause}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lokasi Meninggal *
                </label>
                <select
                  required
                  value={deathForm.death_location}
                  onChange={(e) => setDeathForm({ ...deathForm, death_location: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {DEATH_LOCATION_OPTIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Pelapor *
                </label>
                <input
                  type="text"
                  required
                  value={deathForm.death_reporter_name}
                  onChange={(e) => setDeathForm({ ...deathForm, death_reporter_name: e.target.value })}
                  placeholder="Nama lengkap keluarga / pelapor"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NIK Pelapor (16 Digit) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  value={deathForm.death_reporter_nik}
                  onChange={(e) => setDeathForm({ ...deathForm, death_reporter_nik: e.target.value })}
                  placeholder="Contoh: 3211051203900001"
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-slate-100">
              {initialMode === 'choose' ? (
                <button
                  type="button"
                  onClick={() => setStep('choose')}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Kembali ke Pilihan
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md disabled:opacity-60 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#E5C158]" />
                  {busy ? 'Menyimpan...' : 'Simpan & Buat Form Keterangan Meninggal'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 3: PRINTABLE OFFICIAL FORM KETERANGAN MENINGGAL */}
        {step === 'certificate' && (
          <div className="p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0">
            <div className="print-only-sheet bg-white border border-slate-300 shadow-sm p-8 sm:p-10 space-y-6 font-serif text-slate-900">
              {/* Kop Surat Resmi */}
              <div className="relative flex items-center justify-center pb-4 border-b-4 border-double border-[#0F2744]">
                <div className="hidden sm:block sm:absolute sm:left-2">
                  <SumedangCrest className="w-16 h-18" />
                </div>
                <div className="text-center leading-tight px-4 sm:px-20">
                  <p className="text-sm font-bold tracking-wider uppercase text-slate-800">
                    {settings?.kop_line1 || 'PEMERINTAH KABUPATEN SUMEDANG'}
                  </p>
                  <p className="text-sm font-bold tracking-wider uppercase text-slate-800">
                    {settings?.kop_line2 || 'KECAMATAN SUMEDANG UTARA'}
                  </p>
                  <p className="text-lg font-bold tracking-wider uppercase text-[#0F2744] mt-0.5">
                    {settings?.kop_line3 || 'KEPALA DESA MARGAMUKTI'}
                  </p>
                  <p className="text-[11px] font-sans text-slate-600 mt-1">
                    {settings?.kop_address ||
                      'Jalan Raya Kebonkalapa No. 12, Desa Margamukti, Kec. Sumedang Utara, Kab. Sumedang 45321'}
                  </p>
                </div>
              </div>

              {/* Judul Surat */}
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold tracking-wide uppercase underline text-[#0F2744]">
                  FORM SURAT KETERANGAN MENINGGAL DUNIA
                </h2>
                <p className="text-xs font-mono-tabular text-slate-700">
                  Nomor: 474.3 / {String(activeCert.id).padStart(3, '0')}-Pemdes / {new Date().getFullYear()}
                </p>
              </div>

              {/* Pembuka */}
              <p className="text-sm leading-relaxed">
                Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:
              </p>

              {/* Tabel Biodata Almarhum/Almarhumah */}
              <div className="space-y-1.5 pl-2 sm:pl-6 text-sm">
                {[
                  ['Nama Lengkap', activeCert.full_name, true],
                  ['NIK', activeCert.nik, true],
                  ['No. Kartu Keluarga', activeCert.no_kk, false],
                  ['Jenis Kelamin', activeCert.gender, false],
                  [
                    'Tempat / Tanggal Lahir',
                    `${activeCert.birth_place}, ${formatIndonesianDate(activeCert.birth_date)}`,
                    false,
                  ],
                  ['Agama', activeCert.religion, false],
                  ['Pekerjaan', activeCert.occupation, false],
                  [
                    'Nama Ayah / Ibu',
                    `${activeCert.father_name || '-'} / ${activeCert.mother_name || '-'}`,
                    false,
                  ],
                  [
                    'Alamat Terakhir',
                    activeCert.dusun
                      ? `${activeCert.address} (${activeCert.dusun}, RT ${activeCert.rt || '-'} / RW ${activeCert.rw || '-'})`
                      : activeCert.address,
                    false,
                  ],
                ].map(([label, val, bold]) => (
                  <div key={String(label)} className="grid grid-cols-12 items-start">
                    <span className="col-span-5 sm:col-span-4 text-slate-700">{label}</span>
                    <span className="col-span-7 sm:col-span-8">
                      : <span className={bold ? 'font-bold' : ''}>{val || '-'}</span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Keterangan Kematian */}
              <p className="text-sm leading-relaxed">Telah meninggal dunia pada:</p>
              <div className="space-y-1.5 pl-2 sm:pl-6 text-sm">
                {[
                  [
                    'Hari / Tanggal',
                    `${activeCert.death_day || '-'}, ${formatIndonesianDate(activeCert.mutation_date)}`,
                  ],
                  ['Jam Meninggal', activeCert.death_time ? `${activeCert.death_time} WIB` : '-'],
                  ['Sebab Meninggal', activeCert.death_cause || '-'],
                  ['Lokasi Meninggal', activeCert.death_location || '-'],
                ].map(([label, val]) => (
                  <div key={label} className="grid grid-cols-12 items-start">
                    <span className="col-span-5 sm:col-span-4 text-slate-700">{label}</span>
                    <span className="col-span-7 sm:col-span-8 font-bold">: {val}</span>
                  </div>
                ))}
              </div>

              {/* Identitas Pelapor */}
              <p className="text-sm leading-relaxed">Berdasarkan laporan resmi yang disampaikan oleh:</p>
              <div className="space-y-1.5 pl-2 sm:pl-6 text-sm">
                <div className="grid grid-cols-12 items-start">
                  <span className="col-span-5 sm:col-span-4 text-slate-700">Nama Pelapor</span>
                  <span className="col-span-7 sm:col-span-8 font-semibold">
                    : {activeCert.death_reporter_name || '-'}
                  </span>
                </div>
                <div className="grid grid-cols-12 items-start">
                  <span className="col-span-5 sm:col-span-4 text-slate-700">NIK Pelapor</span>
                  <span className="col-span-7 sm:col-span-8 font-mono-tabular">
                    : {activeCert.death_reporter_nik || '-'}
                  </span>
                </div>
              </div>

              {/* Penutup */}
              <p className="text-sm leading-relaxed">
                Demikian Surat Keterangan Meninggal Dunia ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya dalam pengurusan administrasi kependudukan, pencatatan sipil (Akta Kematian), maupun keperluan keluarga lainnya.
              </p>

              {/* Tanda Tangan */}
              <div className="grid grid-cols-2 gap-8 pt-6 text-sm">
                <div className="pl-2 space-y-1">
                  <p>Pelapor,</p>
                  <div className="h-16" />
                  <p className="font-bold underline">{activeCert.death_reporter_name || '-'}</p>
                </div>
                <div className="flex justify-end pr-2">
                  <div className="w-64 space-y-1">
                    <p>Margamukti, {formatIndonesianDate()}</p>
                    <p>Kepala Desa Margamukti,</p>
                    <div className="h-16" />
                    <p className="font-bold underline">
                      {settings?.head_name || 'H. Asep Kurniawan, S.Sos.'}
                    </p>
                    <p className="text-xs font-mono-tabular text-slate-700">
                      {settings?.head_nip || ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer edit option */}
            <div className="no-print flex justify-between items-center pt-4">
              <button
                type="button"
                onClick={() => setStep('death_form')}
                className="text-xs font-semibold text-[#0F2744] hover:underline cursor-pointer"
              >
                Ubah Data Kematian / Pelapor
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
