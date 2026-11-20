import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer, X } from 'lucide-react';
import { SumedangCrest } from './SumedangCrest';
import { formatIndonesianDate } from '../utils/pdfGenerator';
import {
  computeResidentSummary,
  exportResidentsToCsv,
  exportResidentsToExcel,
  generateResidentsReportPdf,
} from '../utils/residentExport';
import type { Resident, VillageSettings } from '../types';

interface ResidentExportPrintModalProps {
  open: boolean;
  onClose: () => void;
  allResidents: Resident[];
  filteredResidents: Resident[];
  hasActiveFilter: boolean;
  filterDescription: string;
  settings: VillageSettings | null;
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

export function ResidentExportPrintModal({
  open,
  onClose,
  allResidents,
  filteredResidents,
  hasActiveFilter,
  filterDescription,
  settings,
  onNotify,
}: ResidentExportPrintModalProps) {
  const [scope, setScope] = useState<'filtered' | 'all'>(hasActiveFilter ? 'filtered' : 'all');
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setScope(hasActiveFilter ? 'filtered' : 'all');
    }
  }, [open, hasActiveFilter]);

  if (!open) return null;

  const targetResidents = scope === 'filtered' ? filteredResidents : allResidents;
  const scopeDesc = scope === 'filtered' && hasActiveFilter ? filterDescription : 'Seluruh Penduduk Desa Margamukti';
  const fileSuffix = scope === 'filtered' && hasActiveFilter ? 'terfilter' : 'semua';
  const summary = computeResidentSummary(targetResidents);

  const handleExcel = () => {
    if (targetResidents.length === 0) {
      onNotify('Tidak ada data penduduk untuk diekspor.', 'err');
      return;
    }
    exportResidentsToExcel(targetResidents, fileSuffix);
    onNotify(`Berhasil mengekspor ${targetResidents.length} data penduduk ke Excel (.xlsx).`);
  };

  const handleCsv = () => {
    if (targetResidents.length === 0) {
      onNotify('Tidak ada data penduduk untuk diekspor.', 'err');
      return;
    }
    exportResidentsToCsv(targetResidents, fileSuffix);
    onNotify(`Berhasil mengekspor ${targetResidents.length} data penduduk ke CSV.`);
  };

  const handlePdf = async () => {
    if (targetResidents.length === 0) {
      onNotify('Tidak ada data penduduk untuk dibuat PDF.', 'err');
      return;
    }
    setPdfLoading(true);
    try {
      await generateResidentsReportPdf(targetResidents, settings, {
        filterDescription: scopeDesc,
        fileSuffix,
      });
      onNotify(`Dokumen PDF resmi (${targetResidents.length} penduduk) berhasil diunduh.`);
    } catch {
      onNotify('Gagal membuat dokumen PDF penduduk.', 'err');
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrint = () => {
    if (targetResidents.length === 0) {
      onNotify('Tidak ada data penduduk untuk dicetak.', 'err');
      return;
    }
    window.print();
  };

  return (
    <div className="print-modal-root fixed inset-0 z-50 bg-slate-950/65 flex items-start justify-center p-4 overflow-y-auto">
      <div className="print-modal-card bg-white rounded-xl max-w-6xl w-full my-4 overflow-hidden border border-slate-200 shadow-2xl">
        {/* Top Modal Controls (hidden on print) */}
        <div className="no-print bg-slate-50 border-b border-slate-200 px-6 py-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-[#0F2744]">
                Ekspor &amp; Pratinjau Cetak Data Penduduk
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Seluruh atribut biodata (termasuk Hubungan Keluarga, Nama Orang Tua, Pendidikan Terakhir, dan Kelainan Fisik) disinkronkan untuk Excel, CSV, PDF, dan cetak.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md cursor-pointer"
              aria-label="Tutup dialog ekspor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg">
                <button
                  type="button"
                  onClick={() => setScope('filtered')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    scope === 'filtered'
                      ? 'bg-white text-[#0F2744] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Filter Aktif ({filteredResidents.length} Jiwa)
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    scope === 'all'
                      ? 'bg-white text-[#0F2744] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua Data ({allResidents.length} Jiwa)
                </button>
              </div>
              <span className="text-xs text-slate-600">
                Cakupan: <strong className="text-[#0F2744]">{scopeDesc}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={handleCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> CSV (.csv)
              </button>
              <button
                type="button"
                disabled={pdfLoading}
                onClick={handlePdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F2744] bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <FileText className="w-3.5 h-3.5" /> {pdfLoading ? 'Menyusun PDF...' : 'PDF Kop Resmi'}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Langsung
              </button>
            </div>
          </div>
        </div>

        {/* Official Printable Sheet Preview */}
        <div className="p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0">
          <div className="print-only-sheet print-landscape-sheet bg-white border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5 text-slate-900">
            <div className="relative flex items-center justify-center pb-3 border-b-4 border-double border-[#0F2744]">
              <div className="hidden sm:block sm:absolute sm:left-2">
                <SumedangCrest className="w-16 h-18" />
              </div>
              <div className="text-center font-serif leading-tight px-4 sm:px-20">
                <p className="text-sm font-bold tracking-wide uppercase">
                  {settings?.kop_line1 || 'PEMERINTAH KABUPATEN SUMEDANG'}
                </p>
                <p className="text-sm font-bold tracking-wide uppercase">
                  {settings?.kop_line2 || 'KECAMATAN SUMEDANG UTARA'}
                </p>
                <p className="text-base sm:text-lg font-bold tracking-wider uppercase text-[#0F2744]">
                  {settings?.kop_line3 || 'KEPALA DESA MARGAMUKTI'}
                </p>
                <p className="text-[11px] text-slate-600 mt-1 font-sans">
                  {settings?.kop_address ||
                    'Jalan Raya Kebonkalapa No. 12, Desa Margamukti, Kec. Sumedang Utara, Kab. Sumedang 45321'}
                </p>
              </div>
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-sm sm:text-base font-bold uppercase tracking-wide text-[#0F2744]">
                Daftar Data Kependudukan Desa Margamukti
              </h4>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600">
                <span>Cakupan: {scopeDesc}</span>
                <span aria-hidden="true">·</span>
                <span>Dicetak: {formatIndonesianDate()}</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-[#0F2744] font-mono-tabular pt-1">
                <span>Total: {summary.total} Jiwa</span>
                <span aria-hidden="true">·</span>
                <span>Laki-laki: {summary.male} Jiwa</span>
                <span aria-hidden="true">·</span>
                <span>Perempuan: {summary.female} Jiwa</span>
                <span aria-hidden="true">·</span>
                <span>Jumlah KK: {summary.families}</span>
              </div>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                <thead>
                  <tr className="bg-[#0F2744] text-white">
                    <th className="py-2 px-1.5 border border-slate-300 text-center w-7">No</th>
                    <th className="py-2 px-1.5 border border-slate-300">NIK / No. KK</th>
                    <th className="py-2 px-1.5 border border-slate-300">Nama &amp; Hub. Keluarga</th>
                    <th className="py-2 px-1.5 border border-slate-300 text-center">L/P</th>
                    <th className="py-2 px-1.5 border border-slate-300">TTL &amp; Kawin</th>
                    <th className="py-2 px-1.5 border border-slate-300">Pendidikan</th>
                    <th className="py-2 px-1.5 border border-slate-300">Pekerjaan &amp; Agama</th>
                    <th className="py-2 px-1.5 border border-slate-300">Orang Tua (Ayah / Ibu)</th>
                    <th className="py-2 px-1.5 border border-slate-300 text-center">Kelainan Fisik</th>
                    <th className="py-2 px-1.5 border border-slate-300">Wilayah</th>
                  </tr>
                </thead>
                <tbody>
                  {targetResidents.map((r, idx) => (
                    <tr key={r.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="py-1.5 px-1.5 border border-slate-300 text-center font-mono-tabular">{idx + 1}</td>
                      <td className="py-1.5 px-1.5 border border-slate-300 font-mono-tabular whitespace-nowrap">
                        <div className="font-semibold">{r.nik}</div>
                        <div className="text-[10px] text-slate-500">KK: {r.no_kk}</div>
                      </td>
                      <td className="py-1.5 px-1.5 border border-slate-300">
                        <div className="font-semibold text-slate-900">{r.full_name}</div>
                        <div className="text-[10px] text-slate-600">{r.family_relationship || 'Kepala keluarga'}</div>
                      </td>
                      <td className="py-1.5 px-1.5 border border-slate-300 text-center">
                        {r.gender === 'Laki-laki' ? 'L' : 'P'}
                      </td>
                      <td className="py-1.5 px-1.5 border border-slate-300 whitespace-nowrap">
                        <div>
                          {r.birth_place}, <span className="font-mono-tabular">{r.birth_date}</span>
                        </div>
                        <div className="text-[10px] text-slate-600">{r.marital_status}</div>
                      </td>
                      <td className="py-1.5 px-1.5 border border-slate-300">{r.education || 'SLTA/Sederajat'}</td>
                      <td className="py-1.5 px-1.5 border border-slate-300">
                        <div>{r.occupation}</div>
                        <div className="text-[10px] text-slate-600">{r.religion}</div>
                      </td>
                      <td className="py-1.5 px-1.5 border border-slate-300">
                        <div>A: {r.father_name || '-'}</div>
                        <div className="text-[10px] text-slate-600">I: {r.mother_name || '-'}</div>
                      </td>
                      <td className="py-1.5 px-1.5 border border-slate-300 text-center">
                        {r.physical_disability || 'Tidak Ada'}
                      </td>
                      <td className="py-1.5 px-1.5 border border-slate-300">
                        {r.dusun ? `${r.dusun} · RT ${r.rt || '-'} / RW ${r.rw || '-'}` : r.address}
                      </td>
                    </tr>
                  ))}
                  {targetResidents.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500 border border-slate-300">
                        Tidak ada data penduduk pada cakupan pilihan ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4">
              <div className="w-64 text-xs font-serif text-slate-900 space-y-1">
                <p>Margamukti, {formatIndonesianDate()}</p>
                <p>Mengetahui,</p>
                <p>Kepala Desa Margamukti,</p>
                <div className="h-14" />
                <p className="font-bold underline">{settings?.head_name || 'H. Asep Kurniawan, S.Sos.'}</p>
                <p className="text-[11px] font-mono-tabular text-slate-700">{settings?.head_nip || ''}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
