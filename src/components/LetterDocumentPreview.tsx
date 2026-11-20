import { Download, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SumedangCrest } from './SumedangCrest';
import { generateLetterQrDataUrl } from '../utils/letterVerification';
import { formatIndonesianDate, generateOfficialLetterPdf } from '../utils/pdfGenerator';
import type { VillageSettings } from '../types';

interface LetterDocumentPreviewProps {
  settings: VillageSettings;
  letterTitle: string;
  letterNumber: string;
  trackingCode: string;
  bodyText: string;
  issuedDate?: string | null;
  showActions?: boolean;
  signerName?: string;
  signerPosition?: string;
  signerNip?: string;
  signerTteCode?: string;
  useDigitalSignature?: boolean;
}

export function LetterDocumentPreview({
  settings,
  letterTitle,
  letterNumber,
  trackingCode,
  bodyText,
  issuedDate,
  showActions = true,
  signerName,
  signerPosition,
  signerNip,
  signerTteCode,
  useDigitalSignature = false,
}: LetterDocumentPreviewProps) {
  const [downloading, setDownloading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const finalSignerName = (signerName || '').trim() || settings.head_name;
  const finalSignerPosition = (signerPosition || '').trim() || `Kepala ${settings.village_name || 'Desa Margamukti'}`;
  const finalSignerNip = signerNip !== undefined ? signerNip : settings.head_nip;
  const isKades =
    finalSignerPosition.toLowerCase().includes('kepala desa') &&
    !finalSignerPosition.toLowerCase().includes('dusun');

  useEffect(() => {
    let active = true;
    generateLetterQrDataUrl(trackingCode, 200).then((url) => {
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [trackingCode]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await generateOfficialLetterPdf({
        settings,
        letterTitle,
        letterNumber,
        trackingCode,
        bodyText,
        issuedDate,
        signerName: finalSignerName,
        signerPosition: finalSignerPosition,
        signerNip: finalSignerNip,
        signerTteCode,
        useDigitalSignature,
      });
    } finally {
      setDownloading(false);
    }
  };

  const lines = bodyText.split('\n');

  return (
    <div className="space-y-4">
      {showActions && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <div className="text-xs text-slate-600">
            Format Dokumen Resmi A4 <span className="mx-1.5">·</span>{' '}
            <span className="font-mono-tabular font-medium text-[#0F2744]">{trackingCode}</span>
            {useDigitalSignature && (
              <>
                <span className="mx-1.5">·</span>
                <span className="font-semibold text-emerald-700">TTE QR Resmi Aktif</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[44px] text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Kertas A4
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] text-xs font-semibold text-white bg-[#0F2744] rounded-md hover:bg-[#16355C] transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Menyiapkan PDF...' : 'Unduh PDF Resmi'}
            </button>
          </div>
        </div>
      )}

      {/* A4 Sheet Preview */}
      <div className="overflow-x-auto print:overflow-visible pb-2 print:pb-0">
        <div
          className="print-only-sheet bg-white border border-slate-200 shadow-sm mx-auto p-6 sm:p-12 text-slate-950 min-w-[600px] sm:min-w-0 print:min-w-0"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', maxWidth: '794px' }}
        >
          {/* Kop Surat Resmi */}
          <div className="flex items-center gap-4 pb-3 border-b-4 border-double border-[#0F2744]">
            <SumedangCrest className="w-16 h-18 sm:w-20 sm:h-22 shrink-0" />
            <div className="flex-1 text-center leading-tight">
              <p className="text-xs sm:text-sm font-bold tracking-wide uppercase text-slate-900">
                {settings.kop_line1}
              </p>
              <p className="text-xs sm:text-sm font-bold tracking-wide uppercase text-slate-900 mt-0.5">
                {settings.kop_line2}
              </p>
              <p className="text-base sm:text-lg font-bold tracking-wider uppercase text-[#0F2744] mt-0.5">
                {settings.kop_line3}
              </p>
              <p className="text-[11px] sm:text-xs text-slate-600 mt-1" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                {settings.kop_address}
              </p>
            </div>
          </div>

          {/* Judul & Nomor Surat */}
          <div className="text-center mt-7 mb-6">
            <h3 className="text-base sm:text-lg font-bold uppercase underline underline-offset-4 tracking-wide text-slate-950">
              {letterTitle}
            </h3>
            <p className="text-xs sm:text-sm mt-1.5 text-slate-800">
              Nomor: <span className="font-mono-tabular font-medium">{letterNumber || '--- / --- / DS-MGM / --- / ----'}</span>
            </p>
          </div>

          {/* Isi Surat */}
          <div className="text-sm leading-relaxed space-y-2 text-slate-900">
            {lines.map((line, idx) => {
              if (!line.trim()) {
                return <div key={idx} className="h-2" />;
              }
              if (line.includes(':') && line.indexOf(':') < 28) {
                const colonIndex = line.indexOf(':');
                const label = line.slice(0, colonIndex).trim();
                const val = line.slice(colonIndex + 1).trim();
                return (
                  <div key={idx} className="grid grid-cols-[175px_14px_1fr] pl-4 text-sm">
                    <span>{label}</span>
                    <span>:</span>
                    <span className="font-medium">{val}</span>
                  </div>
                );
              }
              return (
                <p key={idx} className="text-justify">
                  {line}
                </p>
              );
            })}
          </div>

          {/* Blok Autentifikasi QR (Kiri Bawah) & Tanda Tangan Pejabat (Kanan Bawah) */}
          <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
            {/* QR Code Autentifikasi Dokumen (jika manual, tetap tampil di kiri; jika TTE, tetap tampil ringkasan arsip) */}
            <div
              className="flex items-center gap-3 border border-slate-200 rounded-md p-2.5 bg-white max-w-[305px]"
              style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code Verifikasi Surat ${trackingCode}`}
                  className="w-20 h-20 shrink-0"
                />
              ) : (
                <div className="w-20 h-20 shrink-0 bg-slate-100 border border-slate-200" />
              )}
              <div className="min-w-0 text-left space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#0F2744]">
                  Autentifikasi Resmi
                </p>
                <p className="text-[10px] text-slate-600 leading-snug">
                  Dikeluarkan sah oleh Pemerintah {settings.village_name}
                </p>
                <p className="text-[10px] font-mono-tabular font-semibold text-[#0F2744] pt-0.5 truncate">
                  {trackingCode}
                </p>
                <p className="text-[9px] text-slate-500">
                  {trackingCode.startsWith('PREVIEW-')
                    ? 'Pratinjau posisi QR verifikasi'
                    : 'Pindai QR untuk cek keaslian'}
                </p>
              </div>
            </div>

            {/* Blok Penanda Tangan Resmi (Tanpa Gambar TTD/Cap Basah jika TTE QR aktif) */}
            <div className="w-72 text-sm text-slate-900 shrink-0">
              <p>Margamukti, {formatIndonesianDate(issuedDate)}</p>
              {!isKades && (
                <p className="mt-0.5 text-slate-800">a.n. Kepala {settings.village_name || 'Desa Margamukti'}</p>
              )}
              <p className="mt-0.5 font-medium">{finalSignerPosition},</p>

              {useDigitalSignature ? (
                <div
                  className="my-2.5 flex items-center gap-2.5 border border-slate-300 rounded-md p-2 bg-slate-50/70"
                  style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                >
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR TTE ${signerTteCode || trackingCode}`}
                      className="w-16 h-16 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 shrink-0 bg-slate-100 border border-slate-200" />
                  )}
                  <div className="min-w-0 text-[10px] leading-snug text-slate-700">
                    <p className="font-bold uppercase tracking-wide text-[#0F2744]">
                      Ditandatangani Secara Elektronik
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      Sah tanpa tanda tangan manual &amp; cap basah
                    </p>
                    {signerTteCode && (
                      <p className="font-mono-tabular font-semibold text-[#0F2744] mt-0.5 truncate">
                        {signerTteCode}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-20 flex items-end pb-1">
                  <span className="text-[10px] text-slate-400 italic no-print">
                    [Tanda tangan &amp; stempel basah pejabat]
                  </span>
                </div>
              )}

              <p className="font-bold underline underline-offset-2">{finalSignerName}</p>
              {finalSignerNip && finalSignerNip !== '-' && (
                <p className="text-xs text-slate-600 mt-0.5">{finalSignerNip}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
