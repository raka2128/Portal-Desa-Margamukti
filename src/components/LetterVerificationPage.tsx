import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, FileCheck2, Search, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { SumedangCrest } from './SumedangCrest';
import { formatIndonesianDate } from '../utils/pdfGenerator';

interface VerifyResponse {
  valid: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  tracking_code?: string;
  letter_number?: string;
  template_name?: string;
  template_code?: string;
  classification_code?: string;
  applicant_name?: string;
  masked_nik?: string;
  purpose?: string;
  approved_at?: string | null;
  created_at?: string;
  signer_name?: string;
  signer_position?: string;
  signer_nip?: string;
  signer_tte_code?: string;
  use_digital_signature?: boolean;
  issuer?: {
    village_name: string;
    district_name: string;
    regency_name: string;
    head_name: string;
    head_nip: string;
  };
  error?: string;
}

interface LetterVerificationPageProps {
  initialCode: string;
  onOpenLetterTrack: (trackingCode: string) => void;
  onBackHome: () => void;
}

export function LetterVerificationPage({
  initialCode,
  onOpenLetterTrack,
  onBackHome,
}: LetterVerificationPageProps) {
  const [codeInput, setCodeInput] = useState(initialCode);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyResponse | null>(null);

  const runVerify = (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    setLoading(true);
    fetch(`/api/public/letters/verify?code=${encodeURIComponent(clean)}`)
      .then((r) => r.json())
      .then((json: VerifyResponse) => setResult(json))
      .catch(() =>
        setResult({
          valid: false,
          error: 'Terjadi gangguan jaringan saat memeriksa keaslian dokumen.',
        })
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setCodeInput(initialCode);
    runVerify(initialCode);
  }, [initialCode]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F2744] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda Portal
        </button>
      </div>

      {/* Institutional Verification Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-[var(--theme-primary)] text-white px-6 py-5 flex items-center gap-4 border-b-2 border-[var(--theme-accent)]">
          <SumedangCrest className="w-11 h-12 shrink-0" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-accent-light)]">
              Sistem Autentifikasi Dokumen Elektronik
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">
              Verifikasi Keaslian Surat Resmi Desa Margamukti
            </h1>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Manual Search Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runVerify(codeInput);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Masukkan kode verifikasi / pelacakan (contoh: SRT-2026-0001)"
              className="flex-1 px-3.5 py-2.5 text-sm font-mono-tabular uppercase border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md whitespace-nowrap cursor-pointer"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Memeriksa...' : 'Verifikasi Surat'}
            </button>
          </form>

          {loading ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Memeriksa keabsahan dokumen pada arsip resmi Pemerintah Desa Margamukti...
            </div>
          ) : result?.valid ? (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-bold text-emerald-900">
                    Dokumen Terverifikasi Sah &amp; Resmi
                  </h2>
                  <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                    Surat keterangan ini benar terdaftar dan telah disahkan oleh Pemerintah{' '}
                    {result.issuer?.village_name}, {result.issuer?.district_name},{' '}
                    {result.issuer?.regency_name}.
                  </p>
                </div>
              </div>

              <dl className="divide-y divide-slate-100 border border-slate-200 rounded-lg text-sm">
                <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-1">
                  <dt className="text-xs font-semibold text-slate-500">Nomor Surat Resmi</dt>
                  <dd className="sm:col-span-2 font-mono-tabular font-bold text-[var(--theme-primary)]">
                    {result.letter_number || '-'}
                  </dd>
                </div>
                <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-1">
                  <dt className="text-xs font-semibold text-slate-500">Kode Verifikasi</dt>
                  <dd className="sm:col-span-2 font-mono-tabular font-semibold text-slate-800">
                    {result.tracking_code}
                  </dd>
                </div>
                <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-1">
                  <dt className="text-xs font-semibold text-slate-500">Jenis Surat</dt>
                  <dd className="sm:col-span-2 font-semibold text-slate-900">
                    {result.template_name} ({result.template_code})
                  </dd>
                </div>
                <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-1">
                  <dt className="text-xs font-semibold text-slate-500">Nama Pemohon</dt>
                  <dd className="sm:col-span-2 font-medium text-slate-900">{result.applicant_name}</dd>
                </div>
                <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-1">
                  <dt className="text-xs font-semibold text-slate-500">NIK (Tersamar)</dt>
                  <dd className="sm:col-span-2 font-mono-tabular text-slate-700">{result.masked_nik}</dd>
                </div>
                <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-1">
                  <dt className="text-xs font-semibold text-slate-500">Keperluan</dt>
                  <dd className="sm:col-span-2 text-slate-700">{result.purpose}</dd>
                </div>
                <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-1">
                  <dt className="text-xs font-semibold text-slate-500">Tanggal Pengesahan</dt>
                  <dd className="sm:col-span-2 font-mono-tabular text-slate-700">
                    {formatIndonesianDate(result.approved_at)}
                  </dd>
                </div>
                <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-1">
                  <dt className="text-xs font-semibold text-slate-500">Pejabat Penandatangan</dt>
                  <dd className="sm:col-span-2 space-y-1">
                    <p className="text-xs font-semibold text-[var(--theme-accent-dark)]">
                      {result.signer_position || `Kepala ${result.issuer?.village_name}`}
                    </p>
                    <p className="font-semibold text-[var(--theme-primary)]">
                      {result.signer_name || result.issuer?.head_name}
                    </p>
                    <p className="text-xs font-mono-tabular text-slate-500">
                      {result.signer_nip || result.issuer?.head_nip}
                    </p>
                    {result.use_digital_signature && (
                      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 pt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        Tanda Tangan Digital (TTE QR Resmi)
                        {result.signer_tte_code ? ` · ${result.signer_tte_code}` : ''}
                      </p>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Data diverifikasi langsung dari database Pemerintah Desa Margamukti
                </span>
                {result.tracking_code && (
                  <button
                    type="button"
                    onClick={() => onOpenLetterTrack(result.tracking_code!)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md cursor-pointer"
                  >
                    <FileCheck2 className="w-4 h-4 text-[var(--theme-accent-light)]" />
                    Lihat Salinan Surat A4
                  </button>
                )}
              </div>
            </div>
          ) : result?.status === 'pending' ? (
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <Clock className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-amber-900">
                  Surat Masih Menunggu Pengesahan Admin Desa
                </h2>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Permohonan dengan kode <strong className="font-mono-tabular">{result.tracking_code}</strong>{' '}
                  atas nama <strong>{result.applicant_name}</strong> ({result.template_name}) masih berstatus
                  antrean verifikasi dan belum disahkan sebagai surat resmi.
                </p>
              </div>
            </div>
          ) : result?.status === 'rejected' ? (
            <div className="p-5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-red-900">
                  Permohonan Surat Ditolak / Tidak Berlaku
                </h2>
                <p className="text-xs text-red-800 leading-relaxed">
                  Kode <strong className="font-mono-tabular">{result.tracking_code}</strong> tidak berlaku sebagai
                  dokumen resmi karena permohonan ditolak oleh operator desa.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-red-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-red-900">
                  Dokumen Tidak Terdaftar / Tidak Valid
                </h2>
                <p className="text-xs text-red-800 leading-relaxed">
                  {result?.error ||
                    'Kode verifikasi tidak ditemukan dalam sistem arsip Pemerintah Desa Margamukti.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
