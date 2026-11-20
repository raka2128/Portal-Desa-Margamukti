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
import type { PopulationStats } from '../types';

interface DemographicChartsProps {
  stats: PopulationStats;
  mode?: 'compact' | 'full';
  onOpenFullStats?: () => void;
}

const CHART_COLORS = ['#0F2744', '#C59B27', '#1E5B88', '#2E7D5B', '#D97706', '#64748B'];

interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  payload?: Record<string, unknown>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  total?: number;
  unit?: string;
}

function DemographicTooltip({ active, payload, label, total = 0, unit = 'jiwa' }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-xs">
      {label && <p className="font-semibold text-[#0F2744] mb-1">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const val = Number(entry.value || 0);
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          const displayName = entry.name || String(entry.payload?.name || '');
          return (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: entry.color || '#0F2744' }}
                />
                {displayName}
              </span>
              <span className="font-mono-tabular font-semibold text-[#0F2744]">
                {val.toLocaleString('id-ID')} {unit}
                {total > 0 ? ` (${pct}%)` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DemographicCharts({ stats, mode = 'full', onOpenFullStats }: DemographicChartsProps) {
  const total = stats.totalResidents || 0;
  const malePct = total > 0 ? Math.round((stats.maleCount / total) * 100) : 0;
  const femalePct = total > 0 ? 100 - malePct : 0;

  const genderData = [
    { name: 'Laki-laki', value: stats.maleCount || 0, color: '#0F2744' },
    { name: 'Perempuan', value: stats.femaleCount || 0, color: '#C59B27' },
  ];

  const ageData = (stats.ageBreakdown || []).map((a) => ({
    label: a.group.replace(' Tahun', ' th'),
    fullLabel: a.group,
    jumlah: a.count,
  }));

  const rwData = (stats.rwBreakdown || []).map((r) => ({
    label: `RW ${r.rw}`,
    dusun: r.dusun,
    LakiLaki: r.maleCount,
    Perempuan: r.femaleCount,
    Total: r.residentCount,
  }));

  const occupationData = (stats.occupationBreakdown || []).map((o) => ({
    name: o.occupation,
    jumlah: o.count,
  }));

  const religionData = (stats.religionBreakdown || []).map((rel, idx) => ({
    name: rel.religion,
    value: rel.count,
    color: CHART_COLORS[idx % CHART_COLORS.length],
  }));

  if (mode === 'compact') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#A67F17]">
              Demografi Terkini
            </p>
            <h3 className="text-xl font-semibold text-[#0F2744] mt-0.5">
              Visualisasi Data Penduduk Desa
            </h3>
          </div>
          {onOpenFullStats && (
            <button
              type="button"
              onClick={onOpenFullStats}
              className="text-xs font-semibold text-[#0F2744] hover:text-[#A67F17] cursor-pointer"
            >
              Lihat 5 Grafik Lengkap →
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 1. Bar Chart Kelompok Usia */}
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#0F2744] uppercase tracking-wider">
                Kelompok Usia (Batang)
              </p>
              <span className="text-[11px] text-slate-500 font-mono-tabular">{total} jiwa</span>
            </div>
            <div className="h-52 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={ageData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DemographicTooltip total={total} />} />
                  <Bar dataKey="jumlah" name="Penduduk" fill="#0F2744" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Bar Chart Sebaran RW */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#0F2744] uppercase tracking-wider">
                Sebaran per RW (Batang)
              </p>
              <span className="text-[11px] text-slate-500 font-mono-tabular">{stats.totalRw} RW</span>
            </div>
            <div className="h-52 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={rwData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DemographicTooltip total={total} />} />
                  <Bar dataKey="LakiLaki" name="Laki-laki" stackId="rw" fill="#0F2744" maxBarSize={34} />
                  <Bar dataKey="Perempuan" name="Perempuan" stackId="rw" fill="#C59B27" radius={[4, 4, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Pie Chart Jenis Kelamin */}
          <div className="lg:col-span-3 space-y-2">
            <p className="text-xs font-semibold text-[#0F2744] uppercase tracking-wider">
              Jenis Kelamin (Pie)
            </p>
            <div className="h-40 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={58}
                    paddingAngle={2}
                  >
                    {genderData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DemographicTooltip total={total} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#0F2744] shrink-0" />
                <span className="text-slate-700 truncate">L: <strong className="font-mono-tabular">{malePct}%</strong></span>
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#C59B27] shrink-0" />
                <span className="text-slate-700 truncate">P: <strong className="font-mono-tabular">{femalePct}%</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2 Ringkas: Pekerjaan (Batang) & Agama (Pie) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 border-t border-slate-100 items-start">
          <div className="lg:col-span-8 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#0F2744] uppercase tracking-wider">
                Pekerjaan Warga Teratas (Batang)
              </p>
              <span className="text-[11px] text-slate-500 font-mono-tabular">
                {occupationData.length} Kategori
              </span>
            </div>
            <div className="h-44 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={occupationData.slice(0, 6)}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    tick={{ fontSize: 11, fill: '#334155' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DemographicTooltip total={total} unit="org" />} />
                  <Bar dataKey="jumlah" name="Warga" fill="#C59B27" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-2">
            <p className="text-xs font-semibold text-[#0F2744] uppercase tracking-wider">
              Komposisi Agama (Pie)
            </p>
            <div className="grid grid-cols-2 gap-3 items-center">
              <div className="h-36 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={religionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={52}
                      paddingAngle={religionData.length > 1 ? 2 : 0}
                    >
                      {religionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DemographicTooltip total={total} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 text-xs">
                {religionData.map((rel) => {
                  const pct = total > 0 ? Math.round((rel.value / total) * 100) : 0;
                  return (
                    <div key={rel.name} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-slate-700 truncate">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: rel.color }} />
                        {rel.name}
                      </span>
                      <span className="font-mono-tabular font-semibold text-[#0F2744] shrink-0">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full 5-Chart Mode (Tab Statistik Penduduk)
  const occupationChartHeight = Math.max(240, occupationData.length * 32);

  return (
    <div className="space-y-6">
      {/* KPI Header Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Total Penduduk</p>
          <p className="text-2xl font-bold text-[#0F2744] font-mono-tabular mt-1">
            {total.toLocaleString('id-ID')} Jiwa
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Kepala Keluarga</p>
          <p className="text-2xl font-bold text-[#0F2744] font-mono-tabular mt-1">
            {stats.totalFamilies.toLocaleString('id-ID')} KK
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Ragam Pekerjaan</p>
          <p className="text-2xl font-bold text-[#0F2744] font-mono-tabular mt-1">
            {occupationData.length} Kategori
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Cakupan Wilayah</p>
          <p className="text-2xl font-bold text-[#0F2744] font-mono-tabular mt-1">
            {stats.totalRw} RW · {stats.totalRt} RT
          </p>
        </div>
      </div>

      {/* Row 1: Pie Jenis Kelamin + Bar Kelompok Usia */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-[#0F2744]">Komposisi Jenis Kelamin</h3>
            <p className="text-xs text-slate-500">Diagram lingkaran perbandingan penduduk laki-laki dan perempuan</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {genderData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DemographicTooltip total={total} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-sm bg-[#0F2744] shrink-0" />
                  <span className="text-sm font-medium text-slate-700">Laki-laki</span>
                </div>
                <div className="text-right font-mono-tabular">
                  <p className="text-sm font-bold text-[#0F2744]">{stats.maleCount} jiwa</p>
                  <p className="text-xs text-slate-500">{malePct}%</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-sm bg-[#C59B27] shrink-0" />
                  <span className="text-sm font-medium text-slate-700">Perempuan</span>
                </div>
                <div className="text-right font-mono-tabular">
                  <p className="text-sm font-bold text-[#0F2744]">{stats.femaleCount} jiwa</p>
                  <p className="text-xs text-slate-500">{femalePct}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-[#0F2744]">Distribusi Kelompok Usia</h3>
            <p className="text-xs text-slate-500">Grafik batang klasifikasi usia penduduk Desa Margamukti</p>
          </div>

          <div className="h-60 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={ageData} margin={{ top: 12, right: 12, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip content={<DemographicTooltip total={total} />} />
                <Bar dataKey="jumlah" name="Jumlah Penduduk" fill="#0F2744" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Bar Sebaran per RW + Pie Agama */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-[#0F2744]">Sebaran Penduduk per Wilayah RW</h3>
            <p className="text-xs text-slate-500">Perbandingan penduduk Laki-laki dan Perempuan di setiap RW</p>
          </div>

          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={rwData} margin={{ top: 12, right: 12, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip content={<DemographicTooltip total={total} />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="LakiLaki" name="Laki-laki" fill="#0F2744" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Perempuan" name="Perempuan" fill="#C59B27" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-[#0F2744]">Komposisi Agama</h3>
            <p className="text-xs text-slate-500">Diagram lingkaran berdasarkan agama yang dianut warga</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={religionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={76}
                    paddingAngle={religionData.length > 1 ? 2 : 0}
                  >
                    {religionData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DemographicTooltip total={total} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2.5">
              {religionData.map((rel) => {
                const pct = total > 0 ? Math.round((rel.value / total) * 100) : 0;
                return (
                  <div key={rel.name} className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 last:border-0">
                    <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: rel.color }}
                      />
                      {rel.name}
                    </span>
                    <span className="font-mono-tabular font-semibold text-[#0F2744]">
                      {rel.value} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Horizontal Bar Klasifikasi Pekerjaan */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-[#0F2744]">Klasifikasi Pekerjaan Warga</h3>
            <p className="text-xs text-slate-500">Grafik batang horizontal mata pencaharian penduduk terdaftar</p>
          </div>
          <span className="text-xs font-mono-tabular text-slate-500">
            {occupationData.length} Jenis Pekerjaan
          </span>
        </div>

        <div className="w-full min-w-0" style={{ height: `${occupationChartHeight}px` }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={occupationData}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 16, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tick={{ fontSize: 12, fill: '#1E293B' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<DemographicTooltip total={total} unit="org" />} />
              <Bar dataKey="jumlah" name="Jumlah Warga" fill="#0F2744" radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
