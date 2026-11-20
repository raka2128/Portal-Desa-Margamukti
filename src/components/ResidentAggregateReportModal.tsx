import { useEffect, useRef, useState } from 'react';
import { BarChart3, Download, Loader2, Printer, X } from 'lucide-react';
import { SumedangCrest } from './SumedangCrest';
import { INDONESIAN_MONTHS } from '../constants/residentOptions';
import { adminFetch } from '../utils/adminApi';
import { formatIndonesianDate } from '../utils/pdfGenerator';
import { exportAggregateReportToExcel } from '../utils/residentExport';
import type {
  ResidentAggregateCategoryRow,
  ResidentAggregateReport,
  VillageSettings,
} from '../types';

interface ResidentAggregateReportModalProps {
  open: boolean;
  onClose: () => void;
  settings: VillageSettings | null;
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

function AggregateCategoryTable({
  title,
  rows,
  grandTotal,
  fullWidth = false,
}: {
  title: string;
  rows: ResidentAggregateCategoryRow[];
  grandTotal: number;
  fullWidth?: boolean;
}) {
  const sumMale = rows.reduce((s, r) => s + r.male, 0);
  const sumFemale = rows.reduce((s, r) => s + r.female, 0);
  const sumTotal = rows.reduce((s, r) => s + r.total, 0);
  const denom = Math.max(1, grandTotal || sumTotal);

  return (
    <div
      className={`border border-slate-300 rounded-lg overflow-hidden bg-white break-inside-avoid ${
        fullWidth ? 'md:col-span-2' : ''
      }`}
    >
      <div className="bg-slate-100 border-b border-slate-300 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#0F2744]">
        {title}
      </div>
      <table className="w-full text-left border-collapse text-[11px]">
        <thead>
          <tr className="bg-[#0F2744] text-white">
            <th className="py-1.5 px-2.5 border-b border-slate-400">Kategori</th>
            <th className="py-1.5 px-2 border-b border-slate-400 text-right w-12">L</th>
            <th className="py-1.5 px-2 border-b border-slate-400 text-right w-12">P</th>
            <th className="py-1.5 px-2 border-b border-slate-400 text-right w-14">Jumlah</th>
            <th className="py-1.5 px-2.5 border-b border-slate-400 text-right w-14">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const pct = ((row.total / denom) * 100).toFixed(1);
            return (
              <tr key={row.label} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                <td className="py-1.5 px-2.5 border-b border-slate-200 font-medium text-slate-800">
                  {row.label}
                </td>
                <td className="py-1.5 px-2 border-b border-slate-200 text-right font-mono-tabular text-slate-700">
                  {row.male}
                </td>
                <td className="py-1.5 px-2 border-b border-slate-200 text-right font-mono-tabular text-slate-700">
                  {row.female}
                </td>
                <td className="py-1.5 px-2 border-b border-slate-200 text-right font-mono-tabular font-semibold text-[#0F2744]">
                  {row.total}
                </td>
                <td className="py-1.5 px-2.5 border-b border-slate-200 text-right font-mono-tabular text-slate-500">
                  {pct}%
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-slate-500">
                Tidak ada data pada periode ini.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold text-[#0F2744]">
            <td className="py-1.5 px-2.5">Total</td>
            <td className="py-1.5 px-2 text-right font-mono-tabular">{sumMale}</td>
            <td className="py-1.5 px-2 text-right font-mono-tabular">{sumFemale}</td>
            <td className="py-1.5 px-2 text-right font-mono-tabular">{sumTotal}</td>
            <td className="py-1.5 px-2.5 text-right font-mono-tabular">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function ResidentAggregateReportModal({
  open,
  onClose,
  settings,
  onNotify,
}: ResidentAggregateReportModalProps) {
  const now = new Date();
  const [periodType, setPeriodType] = useState<'monthly' | 'annual'>('monthly');
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [showPyramid, setShowPyramid] = useState(true);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ResidentAggregateReport | null>(null);
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      periodType,
      year: String(year),
      month: String(month),
    });
    adminFetch(`/api/admin/residents/aggregate-report?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Gagal memuat laporan agregat.');
        if (!cancelled) setReport(json as ResidentAggregateReport);
      })
      .catch((err) => {
        if (!cancelled) {
          onNotifyRef.current(err instanceof Error ? err.message : 'Gagal memuat laporan.', 'err');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, periodType, year, month]);

  if (!open) return null;

  const yearOptions = Array.from({ length: 8 }, (_, i) => now.getFullYear() + 1 - i);
  const maxPyramidSide = report
    ? Math.max(1, ...report.pyramid.flatMap((row) => [row.male, row.female]))
    : 1;
  const pyramidRowsDesc = report ? [...report.pyramid].reverse() : [];

  return (
    <div className="print-modal-root fixed inset-0 z-50 bg-slate-950/70 flex items-start justify-center p-4 overflow-y-auto">
      <div className="print-modal-card bg-white rounded-xl max-w-6xl w-full my-4 overflow-hidden border border-slate-200 shadow-2xl">
        {/* Top Controls */}
        <div className="no-print bg-slate-50 border-b border-slate-200 px-6 py-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#0F2744] text-[#E5C158] flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#0F2744]">
                  Laporan Agregat Kependudukan (Bulanan &amp; Tahunan)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rekapitulasi penduduk aktif, mutasi periode, 7 kategori demografi, dan grafik piramida penduduk.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md cursor-pointer"
              aria-label="Tutup laporan agregat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              {/* Toggle Bulanan vs Tahunan */}
              <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setPeriodType('monthly')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    periodType === 'monthly'
                      ? 'bg-[#0F2744] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Laporan Bulanan
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType('annual')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    periodType === 'annual'
                      ? 'bg-[#0F2744] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Laporan Tahunan
                </button>
              </div>

              {periodType === 'monthly' && (
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-md"
                >
                  {INDONESIAN_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-3 py-1.5 text-xs font-semibold font-mono-tabular bg-white border border-slate-300 rounded-md"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPyramid}
                  onChange={(e) => setShowPyramid(e.target.checked)}
                />
                Sertakan Grafik Piramida Penduduk
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!report}
                onClick={() => {
                  if (!report) return;
                  exportAggregateReportToExcel(report);
                  onNotify(`File Excel Laporan ${report.periodLabel} berhasil diunduh.`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> Ekspor Excel (.xlsx)
              </button>
              <button
                type="button"
                disabled={!report}
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak / Simpan PDF
              </button>
            </div>
          </div>
        </div>

        {/* Printable Sheet */}
        <div className="p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 bg-white rounded-lg border border-slate-200">
              <Loader2 className="w-6 h-6 animate-spin text-[#0F2744]" />
              <span>Menyusun laporan agregat kependudukan...</span>
            </div>
          )}

          {!loading && report && (
            <div className="print-only-sheet bg-white border border-slate-300 shadow-sm p-6 sm:p-9 space-y-6 text-slate-900">
              {/* Official Kop Surat */}
              <div className="relative flex items-center justify-center pb-4 border-b-4 border-double border-[#0F2744]">
                <div className="hidden sm:block sm:absolute sm:left-2">
                  <SumedangCrest className="w-16 h-18" />
                </div>
                <div className="text-center font-serif leading-tight px-4 sm:px-20">
                  <p className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-800">
                    {settings?.kop_line1 || 'PEMERINTAH KABUPATEN SUMEDANG'}
                  </p>
                  <p className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-800">
                    {settings?.kop_line2 || 'KECAMATAN SUMEDANG UTARA'}
                  </p>
                  <p className="text-base sm:text-lg font-bold tracking-wider uppercase text-[#0F2744] mt-0.5">
                    {settings?.kop_line3 || 'KEPALA DESA MARGAMUKTI'}
                  </p>
                  <p className="text-[11px] font-sans text-slate-600 mt-1">
                    {settings?.kop_address ||
                      'Jalan Raya Kebonkalapa No. 12, Desa Margamukti, Kec. Sumedang Utara, Kab. Sumedang 45321'}
                  </p>
                </div>
              </div>

              {/* Report Heading */}
              <div className="text-center space-y-1">
                <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase text-[#0F2744]">
                  LAPORAN AGREGAT DATA KEPENDUDUKAN — {report.periodLabel.toUpperCase()}
                </h2>
                <p className="text-xs text-slate-600">
                  Posisi Data Aktif s.d.{' '}
                  <span className="font-semibold">{formatIndonesianDate(report.cutoffDate)}</span> ·
                  Dicetak pada <span className="font-semibold">{formatIndonesianDate()}</span>
                </p>
              </div>

              {/* Total Penduduk & Mutasi Periode */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                  <p className="text-[11px] font-medium text-slate-600">Total Jumlah Penduduk</p>
                  <p className="text-xl font-bold font-mono-tabular text-[#0F2744] mt-0.5">
                    {report.totals.totalResidents}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                  <p className="text-[11px] font-medium text-slate-600">Penduduk Laki-laki</p>
                  <p className="text-xl font-bold font-mono-tabular text-[#0F2744] mt-0.5">
                    {report.totals.maleCount}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                  <p className="text-[11px] font-medium text-slate-600">Penduduk Perempuan</p>
                  <p className="text-xl font-bold font-mono-tabular text-[#A67F17] mt-0.5">
                    {report.totals.femaleCount}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                  <p className="text-[11px] font-medium text-slate-600">Jumlah Kepala Keluarga</p>
                  <p className="text-xl font-bold font-mono-tabular text-slate-800 mt-0.5">
                    {report.totals.totalFamilies}
                  </p>
                </div>
              </div>

              {/* Ringkasan Mutasi Pada Periode Terpilih */}
              <div className="border border-slate-300 rounded-lg p-3.5 bg-white">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#0F2744] mb-2">
                  Ringkasan Mutasi Penduduk pada {report.periodLabel}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-600">Bayi Baru Lahir</span>
                    <span className="font-mono-tabular font-bold text-sky-800">
                      +{report.periodMutations.lahir}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-600">Pindah Masuk</span>
                    <span className="font-mono-tabular font-bold text-indigo-800">
                      +{report.periodMutations.pindah_masuk}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-600">Pindah Keluar</span>
                    <span className="font-mono-tabular font-bold text-amber-800">
                      -{report.periodMutations.pindah_keluar}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-600">Meninggal Dunia</span>
                    <span className="font-mono-tabular font-bold text-slate-800">
                      -{report.periodMutations.meninggal}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grafik Piramida Penduduk */}
              {showPyramid && (
                <div className="border border-slate-300 rounded-lg p-4 bg-white break-inside-avoid">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F2744]">
                        Grafik Piramida Penduduk ({report.periodLabel})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Distribusi struktur umur 5 tahunan menurut jenis kelamin
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] font-semibold">
                      <span className="inline-flex items-center gap-1.5 text-[#0F2744]">
                        <span className="w-3 h-3 rounded-sm bg-[#0F2744] inline-block" /> Laki-laki (
                        {report.totals.maleCount})
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[#8A6914]">
                        <span className="w-3 h-3 rounded-sm bg-[#C59B27] inline-block" /> Perempuan (
                        {report.totals.femaleCount})
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {pyramidRowsDesc.map((row) => {
                      const malePct = Math.round((row.male / maxPyramidSide) * 100);
                      const femalePct = Math.round((row.female / maxPyramidSide) * 100);
                      return (
                        <div key={row.bracket} className="grid grid-cols-11 items-center gap-1.5 text-[11px]">
                          {/* Left: Male Bar */}
                          <div className="col-span-5 flex items-center justify-end gap-1.5">
                            <span className="font-mono-tabular text-slate-700 w-7 text-right shrink-0">
                              {row.male}
                            </span>
                            <div className="flex-1 h-4 bg-slate-100 rounded-l overflow-hidden flex justify-end">
                              <div
                                className="h-full bg-[#0F2744]"
                                style={{ width: `${row.male > 0 ? Math.max(4, malePct) : 0}%` }}
                              />
                            </div>
                          </div>

                          {/* Center: Age Bracket */}
                          <div className="col-span-1 text-center font-mono-tabular font-bold text-[#0F2744] text-[10px]">
                            {row.bracket}
                          </div>

                          {/* Right: Female Bar */}
                          <div className="col-span-5 flex items-center justify-start gap-1.5">
                            <div className="flex-1 h-4 bg-slate-100 rounded-r overflow-hidden flex justify-start">
                              <div
                                className="h-full bg-[#C59B27]"
                                style={{ width: `${row.female > 0 ? Math.max(4, femalePct) : 0}%` }}
                              />
                            </div>
                            <span className="font-mono-tabular text-slate-700 w-7 text-left shrink-0">
                              {row.female}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 7 Tabel Agregat Demografi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AggregateCategoryTable
                  title="1. Menurut Jenis Kelamin"
                  rows={report.byGender}
                  grandTotal={report.totals.totalResidents}
                />
                <AggregateCategoryTable
                  title="2. Menurut Kelompok Usia"
                  rows={report.byAgeGroup}
                  grandTotal={report.totals.totalResidents}
                />
                <AggregateCategoryTable
                  title="3. Menurut Agama"
                  rows={report.byReligion}
                  grandTotal={report.totals.totalResidents}
                />
                <AggregateCategoryTable
                  title="4. Menurut Status Perkawinan"
                  rows={report.byMaritalStatus}
                  grandTotal={report.totals.totalResidents}
                />
                <AggregateCategoryTable
                  title="5. Menurut Pendidikan Terakhir"
                  rows={report.byEducation}
                  grandTotal={report.totals.totalResidents}
                  fullWidth
                />
                <AggregateCategoryTable
                  title="6. Menurut Pekerjaan"
                  rows={report.byOccupation}
                  grandTotal={report.totals.totalResidents}
                  fullWidth
                />
                <AggregateCategoryTable
                  title="7. Menurut Kondisi / Kelainan Fisik"
                  rows={report.byPhysicalDisability}
                  grandTotal={report.totals.totalResidents}
                  fullWidth
                />
              </div>

              {/* Tanda Tangan Kepala Desa */}
              <div className="flex justify-end pt-6 pr-4 font-serif text-xs text-slate-900 break-inside-avoid">
                <div className="w-64 space-y-1">
                  <p>Margamukti, {formatIndonesianDate()}</p>
                  <p>Mengetahui,</p>
                  <p>Kepala Desa Margamukti,</p>
                  <div className="h-14" />
                  <p className="font-bold underline">{settings?.head_name || 'H. Asep Kurniawan, S.Sos.'}</p>
                  <p className="text-[11px] font-mono-tabular text-slate-700">{settings?.head_nip || ''}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
