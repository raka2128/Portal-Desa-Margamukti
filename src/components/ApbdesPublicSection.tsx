import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp, Wallet } from 'lucide-react';
import type { ApbdesPublicSummary } from '../types';

function formatRupiah(amount: number): string {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

function formatShortMillions(amount: number): string {
  const num = Number(amount || 0);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)} M`;
  if (num >= 1_000_000) return `${Math.round(num / 1_000_000)} Jt`;
  return num.toLocaleString('id-ID');
}

function calcPct(realized: number, budget: number): number {
  if (!budget || budget <= 0) return 0;
  return Math.min(100, Math.round((realized / budget) * 100));
}

const PIE_COLORS = ['#0F2744', '#C59B27', '#1E6B52', '#2563EB', '#D97706', '#64748B'];

interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
}

function ApbdesTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-xs">
      {label && <p className="font-semibold text-[#0F2744] mb-1">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: entry.color || '#0F2744' }}
              />
              {entry.name}
            </span>
            <span className="font-mono-tabular font-semibold text-[#0F2744]">
              {formatRupiah(Number(entry.value || 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApbdesPublicSection() {
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [ledgerFilter, setLedgerFilter] = useState<'Semua' | 'Pendapatan' | 'Belanja' | 'Pembiayaan'>('Semua');
  const [data, setData] = useState<ApbdesPublicSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = selectedYear ? `/api/public/apbdes?year=${selectedYear}` : '/api/public/apbdes';
    fetch(url)
      .then((r) => r.json())
      .then((json: ApbdesPublicSummary) => {
        setData(json);
        if (!selectedYear && json.year) {
          setSelectedYear(json.year);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedYear]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { totals, pendapatanByCategory, belanjaByCategory, pembiayaanByCategory, items, years, year } = data;
  const pendapatanPct = calcPct(totals.pendapatanRealized, totals.pendapatanBudget);
  const belanjaPct = calcPct(totals.belanjaRealized, totals.belanjaBudget);
  const pembiayaanPct = calcPct(totals.pembiayaanRealized, totals.pembiayaanBudget);
  const surplusRealized = totals.pendapatanRealized - totals.belanjaRealized;

  const overviewChartData = [
    {
      name: 'Pendapatan',
      Anggaran: totals.pendapatanBudget,
      Realisasi: totals.pendapatanRealized,
    },
    {
      name: 'Belanja',
      Anggaran: totals.belanjaBudget,
      Realisasi: totals.belanjaRealized,
    },
    {
      name: 'Pembiayaan',
      Anggaran: totals.pembiayaanBudget,
      Realisasi: totals.pembiayaanRealized,
    },
  ];

  const belanjaPieData = belanjaByCategory.map((b, idx) => ({
    name: b.category,
    value: b.budget,
    realized: b.realized,
    color: PIE_COLORS[idx % PIE_COLORS.length],
  }));

  const filteredItems =
    ledgerFilter === 'Semua' ? items : items.filter((item) => item.type === ledgerFilter);

  return (
    <div className="space-y-8">
      {/* Header & Year Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Wallet className="w-6 h-6 text-[#C59B27] shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-[#0F2744]">
              Transparansi Anggaran Pendapatan & Belanja Desa (APBDes)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Ringkasan visual anggaran, pendapatan, belanja per bidang, pembiayaan, dan realisasi Desa Margamukti Tahun Anggaran {year}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Tahun Anggaran:</span>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setSelectedYear(y)}
              className={`px-3.5 py-1.5 text-xs font-mono-tabular font-semibold rounded-md border cursor-pointer ${
                year === y
                  ? 'bg-[#0F2744] text-white border-[#0F2744]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* 3 Primary APBDes Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-emerald-700">Pendapatan Desa</span>
            <span className="font-mono-tabular font-semibold text-emerald-700">{pendapatanPct}% tersalur</span>
          </div>
          <div>
            <p className="text-xs text-slate-500">Anggaran Ditetapkan</p>
            <p className="text-xl font-bold text-[#0F2744] font-mono-tabular">
              {formatRupiah(totals.pendapatanBudget)}
            </p>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pendapatanPct}%` }} />
          </div>
          <p className="text-xs text-slate-600 font-mono-tabular">
            Realisasi: <span className="font-semibold text-slate-900">{formatRupiah(totals.pendapatanRealized)}</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-[#0F2744]">Belanja Desa</span>
            <span className="font-mono-tabular font-semibold text-[#0F2744]">{belanjaPct}% terserap</span>
          </div>
          <div>
            <p className="text-xs text-slate-500">Pagu Belanja</p>
            <p className="text-xl font-bold text-[#0F2744] font-mono-tabular">
              {formatRupiah(totals.belanjaBudget)}
            </p>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#0F2744] rounded-full" style={{ width: `${belanjaPct}%` }} />
          </div>
          <p className="text-xs text-slate-600 font-mono-tabular">
            Realisasi: <span className="font-semibold text-slate-900">{formatRupiah(totals.belanjaRealized)}</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-[#A67F17]">Pembiayaan & Saldo</span>
            <span className="font-mono-tabular font-semibold text-[#A67F17]">{pembiayaanPct}% terealisasi</span>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Pembiayaan</p>
            <p className="text-xl font-bold text-[#0F2744] font-mono-tabular">
              {formatRupiah(totals.pembiayaanBudget)}
            </p>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#C59B27] rounded-full" style={{ width: `${pembiayaanPct}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-slate-600 font-mono-tabular">
            <span>Realisasi: {formatRupiah(totals.pembiayaanRealized)}</span>
            <span className={surplusRealized >= 0 ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
              Selisih: {formatRupiah(surplusRealized)}
            </span>
          </div>
        </div>
      </div>

      {/* Visualisasi Grafik Recharts: Anggaran vs Realisasi & Proporsi Bidang Belanja */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-semibold text-[#0F2744]">
                Grafik Perbandingan Anggaran vs Realisasi ({year})
              </h3>
              <p className="text-xs text-slate-500">
                Visualisasi target anggaran dibandingkan capaian realisasi Pendapatan, Belanja, dan Pembiayaan
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-[#C59B27] shrink-0" />
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overviewChartData} margin={{ top: 10, right: 16, left: 6, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} />
                <YAxis
                  tickFormatter={(v) => formatShortMillions(Number(v))}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  width={56}
                />
                <Tooltip content={<ApbdesTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Anggaran" name="Pagu Anggaran" fill="#0F2744" radius={[4, 4, 0, 0]} maxBarSize={52} />
                <Bar dataKey="Realisasi" name="Realisasi" fill="#C59B27" radius={[4, 4, 0, 0]} maxBarSize={52} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-[#0F2744]">Proporsi Pagu Belanja per Bidang</h3>
            <p className="text-xs text-slate-500">Distribusi alokasi belanja pembangunan & pelayanan desa</p>
          </div>
          {belanjaPieData.length > 0 ? (
            <div className="space-y-3">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={belanjaPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={82}
                      paddingAngle={2}
                    >
                      {belanjaPieData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ApbdesTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 text-xs">
                {belanjaPieData.map((entry) => {
                  const share =
                    totals.belanjaBudget > 0 ? Math.round((entry.value / totals.belanjaBudget) * 100) : 0;
                  return (
                    <div key={entry.name} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-slate-700 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="truncate">{entry.name}</span>
                      </span>
                      <span className="font-mono-tabular font-semibold text-[#0F2744] shrink-0">
                        {share}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-12 text-center">
              Belum ada data belanja untuk ditampilkan pada grafik.
            </p>
          )}
        </div>
      </div>

      {/* Realisasi Belanja per Bidang + Sumber Pendapatan & Pembiayaan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-[#0F2744]">Detail Realisasi Belanja per Bidang</h3>
            <p className="text-xs text-slate-500">Persentase serapan pagu anggaran dan realisasi tiap bidang</p>
          </div>
          <div className="space-y-4">
            {belanjaByCategory.map((b) => {
              const pct = calcPct(b.realized, b.budget);
              return (
                <div key={b.category} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800">{b.category}</span>
                    <span className="font-mono-tabular text-slate-600">
                      {formatRupiah(b.realized)} / {formatRupiah(b.budget)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0F2744] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {belanjaByCategory.length === 0 && (
              <p className="text-xs text-slate-500 py-4 text-center">Belum ada data belanja untuk tahun {year}.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-[#0F2744]">Sumber Pendapatan & Pembiayaan</h3>
            <p className="text-xs text-slate-500">Rincian penerimaan dana transfer dan pembiayaan desa</p>
          </div>
          <div className="space-y-4">
            {pendapatanByCategory.map((p) => {
              const pct = calcPct(p.realized, p.budget);
              return (
                <div key={p.category} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-800">{p.category}</span>
                    <span className="font-mono-tabular text-emerald-700 font-semibold">{pct}%</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-tabular">
                    <span>Realisasi: {formatRupiah(p.realized)}</span>
                    <span>Target: {formatRupiah(p.budget)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {pembiayaanByCategory.map((pm) => {
              const pct = calcPct(pm.realized, pm.budget);
              return (
                <div key={pm.category} className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-800">{pm.category}</span>
                    <span className="font-mono-tabular text-[#A67F17] font-semibold">{pct}%</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-tabular">
                    <span>Realisasi: {formatRupiah(pm.realized)}</span>
                    <span>Pagu: {formatRupiah(pm.budget)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#C59B27] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Itemized APBDes Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-[#0F2744]">
            Rincian Pos Anggaran APBDes Tahun {year}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['Semua', 'Pendapatan', 'Belanja', 'Pembiayaan'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setLedgerFilter(t)}
                className={`px-3 py-1 text-xs font-semibold rounded border cursor-pointer ${
                  ledgerFilter === t
                    ? 'bg-[#0F2744] text-white border-[#0F2744]'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-[#0F2744]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {/* Mobile Compact Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredItems.map((item) => {
            const pct = calcPct(item.realized_amount, item.budget_amount);
            return (
              <div key={item.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#A67F17]">
                    {item.type} · {item.category}
                  </span>
                  <span className="font-mono-tabular font-semibold text-[#0F2744] shrink-0">
                    {pct}%
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  {item.notes && <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>}
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0F2744] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between gap-2 text-xs font-mono-tabular">
                  <span className="text-slate-500">
                    Pagu: <span className="text-slate-800">{formatRupiah(item.budget_amount)}</span>
                  </span>
                  <span className="font-semibold text-[#0F2744]">
                    Realisasi: {formatRupiah(item.realized_amount)}
                  </span>
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
                <th className="py-3 px-4">Jenis</th>
                <th className="py-3 px-4">Bidang / Kategori</th>
                <th className="py-3 px-4">Uraian Kegiatan / Pos</th>
                <th className="py-3 px-4 text-right">Anggaran</th>
                <th className="py-3 px-4 text-right">Realisasi</th>
                <th className="py-3 px-4 text-right">Serapan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {filteredItems.map((item) => {
                const pct = calcPct(item.realized_amount, item.budget_amount);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-[#0F2744] whitespace-nowrap">{item.type}</td>
                    <td className="py-3 px-4 text-slate-700">{item.category}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      {item.notes && <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular whitespace-nowrap">
                      {formatRupiah(item.budget_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular whitespace-nowrap font-semibold text-[#0F2744]">
                      {formatRupiah(item.realized_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular whitespace-nowrap text-slate-700">
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
