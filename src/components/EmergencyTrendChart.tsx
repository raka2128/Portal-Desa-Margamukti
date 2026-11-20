import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { BarChart3, CheckCircle2, Clock, Filter, Siren, TrendingUp } from 'lucide-react';
import type { Complaint } from '../types';

interface EmergencyTrendChartProps {
  reports: Complaint[];
}

interface MonthlyBucket {
  monthKey: string; // YYYY-MM
  shortLabel: string; // e.g., "Nov 26"
  fullLabel: string; // e.g., "November 2026"
  total: number;
  baru: number;
  diproses: number;
  selesai: number;
  topIncident: string;
}

const MONTH_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_FULL_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function normalizeIncidentCategory(raw: string): string {
  return String(raw || 'Lainnya')
    .replace(/^Darurat:\s*/i, '')
    .trim() || 'Lainnya';
}

function extractMonthKey(createdAt: string): string | null {
  const m = String(createdAt || '').trim().match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

export function EmergencyTrendChart({ reports }: EmergencyTrendChartProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [hoveredMonth, setHoveredMonth] = useState<{
    bucket: MonthlyBucket;
    x: number;
    y: number;
    containerWidth: number;
  } | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(820);

  // Measure responsive container width
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const updateWidth = () => {
      const next = Math.max(320, Math.floor(el.clientWidth));
      setContainerWidth(next);
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Extract distinct incident categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports) {
      set.add(normalizeIncidentCategory(r.category));
    }
    return ['Semua', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'id'))];
  }, [reports]);

  // Reset filter if selected category disappears
  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
      setSelectedCategory('Semua');
    }
  }, [categories, selectedCategory]);

  // Build exact 12-month window ending on current month
  const { monthlyData, filteredReports, categoryBreakdown } = useMemo(() => {
    const now = new Date();
    const slots: MonthlyBucket[] = [];
    const slotMap = new Map<string, MonthlyBucket>();
    const incidentCounterByMonth = new Map<string, Map<string, number>>();

    for (let offset = 11; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const y = d.getFullYear();
      const mIdx = d.getMonth();
      const monthKey = `${y}-${String(mIdx + 1).padStart(2, '0')}`;
      const bucket: MonthlyBucket = {
        monthKey,
        shortLabel: `${MONTH_SHORT_ID[mIdx]} ${String(y).slice(-2)}`,
        fullLabel: `${MONTH_FULL_ID[mIdx]} ${y}`,
        total: 0,
        baru: 0,
        diproses: 0,
        selesai: 0,
        topIncident: '-',
      };
      slots.push(bucket);
      slotMap.set(monthKey, bucket);
      incidentCounterByMonth.set(monthKey, new Map());
    }

    const windowReports: Complaint[] = [];
    const catMap = new Map<
      string,
      { category: string; total: number; active: number; selesai: number }
    >();

    for (const r of reports) {
      const key = extractMonthKey(r.created_at);
      if (!key || !slotMap.has(key)) continue;
      windowReports.push(r);

      const catName = normalizeIncidentCategory(r.category);
      const catEntry = catMap.get(catName) || {
        category: catName,
        total: 0,
        active: 0,
        selesai: 0,
      };
      catEntry.total += 1;
      if (r.status === 'selesai') catEntry.selesai += 1;
      else catEntry.active += 1;
      catMap.set(catName, catEntry);
    }

    const activeList =
      selectedCategory === 'Semua'
        ? windowReports
        : windowReports.filter(
            (r) => normalizeIncidentCategory(r.category) === selectedCategory
          );

    for (const r of activeList) {
      const key = extractMonthKey(r.created_at);
      if (!key) continue;
      const bucket = slotMap.get(key);
      if (!bucket) continue;

      bucket.total += 1;
      if (r.status === 'baru') bucket.baru += 1;
      else if (r.status === 'diproses') bucket.diproses += 1;
      else if (r.status === 'selesai') bucket.selesai += 1;

      const incMap = incidentCounterByMonth.get(key)!;
      const incName = normalizeIncidentCategory(r.category);
      incMap.set(incName, (incMap.get(incName) || 0) + 1);
    }

    for (const bucket of slots) {
      const incMap = incidentCounterByMonth.get(bucket.monthKey);
      if (incMap && incMap.size > 0) {
        let bestName = '-';
        let bestCount = -1;
        for (const [name, cnt] of incMap.entries()) {
          if (cnt > bestCount) {
            bestCount = cnt;
            bestName = name;
          }
        }
        bucket.topIncident = bestName;
      }
    }

    const breakdown = Array.from(catMap.values()).sort(
      (a, b) => b.total - a.total || a.category.localeCompare(b.category, 'id')
    );

    return {
      monthlyData: slots,
      filteredReports: activeList,
      categoryBreakdown: breakdown,
    };
  }, [reports, selectedCategory]);

  // Summary metrics
  const summary = useMemo(() => {
    const total12m = monthlyData.reduce((acc, m) => acc + m.total, 0);
    const avgPerMonth = total12m / 12;
    const selesaiCount = monthlyData.reduce((acc, m) => acc + m.selesai, 0);
    const completionRate = total12m > 0 ? Math.round((selesaiCount / total12m) * 100) : 0;

    let peakBucket = monthlyData[0];
    for (const b of monthlyData) {
      if (b.total >= (peakBucket?.total ?? 0)) {
        peakBucket = b;
      }
    }

    return {
      total12m,
      avgPerMonth,
      completionRate,
      selesaiCount,
      peakLabel: total12m > 0 && peakBucket ? peakBucket.fullLabel : 'Belum ada insiden',
      peakCount: total12m > 0 && peakBucket ? peakBucket.total : 0,
    };
  }, [monthlyData]);

  // D3.js SVG rendering & animated updates
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const width = containerWidth;
    const height = 330;
    const margin = { top: 28, right: 20, bottom: 42, left: 42 };
    const innerWidth = Math.max(180, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', width)
      .attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxVal = d3.max(monthlyData, (d) => d.total) || 0;
    const yMax = Math.max(4, maxVal + 1);

    const xScale = d3
      .scaleBand<string>()
      .domain(monthlyData.map((d) => d.monthKey))
      .range([0, innerWidth])
      .padding(0.32);

    const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

    const integerTicks = yScale
      .ticks(Math.min(6, yMax))
      .filter((t) => Number.isInteger(t));

    // Horizontal grid lines
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(integerTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#E2E8F0')
      .attr('stroke-dasharray', (d) => (d === 0 ? 'none' : '3,3'))
      .attr('stroke-width', 1);

    // Y axis
    const yAxis = d3
      .axisLeft(yScale)
      .tickValues(integerTicks)
      .tickFormat((d) => String(d))
      .tickSize(0)
      .tickPadding(10);

    const yAxisG = g.append('g').call(yAxis);
    yAxisG.select('.domain').remove();
    yAxisG
      .selectAll('text')
      .attr('fill', '#64748B')
      .attr('font-size', '11px')
      .style('font-variant-numeric', 'tabular-nums');

    // X axis
    const labelMap = new Map(monthlyData.map((d) => [d.monthKey, d.shortLabel]));
    const compactX = innerWidth < 560;
    const xAxis = d3
      .axisBottom(xScale)
      .tickFormat((key, i) => {
        if (compactX && i % 2 === 1) return '';
        return labelMap.get(key) || key;
      })
      .tickSize(0)
      .tickPadding(12);

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);
    xAxisG.select('.domain').attr('stroke', '#CBD5E1');
    xAxisG
      .selectAll('text')
      .attr('fill', '#475569')
      .attr('font-size', '11px')
      .attr('font-weight', '500');

    // Bars (Monthly emergency report frequency)
    const bars = g
      .selectAll('rect.freq-bar')
      .data(monthlyData, (d) => (d as MonthlyBucket).monthKey)
      .join('rect')
      .attr('class', 'freq-bar')
      .attr('x', (d) => xScale(d.monthKey) ?? 0)
      .attr('width', xScale.bandwidth())
      .attr('y', innerHeight)
      .attr('height', 0)
      .attr('rx', 4)
      .attr('fill', '#0F2744')
      .attr('fill-opacity', 0.88);

    bars
      .transition()
      .duration(200)
      .ease(d3.easeCubicOut)
      .attr('y', (d) => yScale(d.total))
      .attr('height', (d) => Math.max(0, innerHeight - yScale(d.total)));

    // Value labels above non-zero bars
    g.selectAll('text.bar-value')
      .data(monthlyData.filter((d) => d.total > 0))
      .join('text')
      .attr('class', 'bar-value')
      .attr('x', (d) => (xScale(d.monthKey) ?? 0) + xScale.bandwidth() / 2)
      .attr('y', (d) => yScale(d.total) - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', '#0F2744')
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .style('font-variant-numeric', 'tabular-nums')
      .text((d) => String(d.total));

    // Smooth trend line overlay
    const lineGenerator = d3
      .line<MonthlyBucket>()
      .x((d) => (xScale(d.monthKey) ?? 0) + xScale.bandwidth() / 2)
      .y((d) => yScale(d.total))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(monthlyData)
      .attr('fill', 'none')
      .attr('stroke', '#C59B27')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
      .attr('d', lineGenerator);

    // Trend line vertex dots
    const dots = g
      .selectAll('circle.trend-dot')
      .data(monthlyData)
      .join('circle')
      .attr('class', 'trend-dot')
      .attr('cx', (d) => (xScale(d.monthKey) ?? 0) + xScale.bandwidth() / 2)
      .attr('cy', (d) => yScale(d.total))
      .attr('r', 4)
      .attr('fill', '#C59B27')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2);

    // Transparent full-column hover targets for smooth tooltip & bar/dot focus
    g.selectAll('rect.hover-target')
      .data(monthlyData)
      .join('rect')
      .attr('class', 'hover-target')
      .attr('x', (d) => (xScale(d.monthKey) ?? 0) - xScale.step() * 0.14)
      .attr('y', 0)
      .attr('width', xScale.step())
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseenter', function (_event, d) {
        bars
          .attr('fill', (b) => (b.monthKey === d.monthKey ? '#16355C' : '#0F2744'))
          .attr('fill-opacity', (b) => (b.monthKey === d.monthKey ? 1 : 0.45));
        dots
          .attr('r', (b) => (b.monthKey === d.monthKey ? 6 : 3.5))
          .attr('fill', (b) => (b.monthKey === d.monthKey ? '#A67F17' : '#C59B27'));

        const barCenterX =
          margin.left + (xScale(d.monthKey) ?? 0) + xScale.bandwidth() / 2;
        const barTopY = margin.top + yScale(d.total);
        setHoveredMonth({
          bucket: d,
          x: barCenterX,
          y: barTopY,
          containerWidth: width,
        });
      })
      .on('mouseleave', function () {
        bars.attr('fill', '#0F2744').attr('fill-opacity', 0.88);
        dots.attr('r', 4).attr('fill', '#C59B27');
        setHoveredMonth(null);
      });
  }, [monthlyData, containerWidth]);

  return (
    <div className="space-y-6">
      {/* 4-Column Summary KPI Strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Siren className="w-3.5 h-3.5 text-red-700 shrink-0" />
            Total Laporan (12 Bulan)
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-[#0F2744] font-mono-tabular mt-1.5">
            {summary.total12m}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {selectedCategory === 'Semua' ? 'Semua kategori insiden' : selectedCategory}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#A67F17] shrink-0" />
            Rata-Rata per Bulan
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-[#0F2744] font-mono-tabular mt-1.5">
            {summary.avgPerMonth.toFixed(1)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Laporan / bulan dalam 1 tahun</p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[#0F2744] shrink-0" />
            Bulan Puncak Insiden
          </p>
          <p className="text-lg sm:text-xl font-bold text-[#0F2744] mt-2 truncate">
            {summary.peakLabel}
          </p>
          <p className="text-[11px] font-mono-tabular text-slate-500 mt-1">
            {summary.peakCount} laporan tercatat
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            Rasio Penyelesaian
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-700 font-mono-tabular mt-1.5">
            {summary.completionRate}%
          </p>
          <p className="text-[11px] font-mono-tabular text-slate-500 mt-1">
            {summary.selesaiCount} dari {summary.total12m} laporan selesai
          </p>
        </div>
      </div>

      {/* Main D3.js Interactive Combo Chart Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-semibold text-[#0F2744]">
              Tren Frekuensi Laporan Darurat 12 Bulan Terakhir (D3.js)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Kombinasi batang jumlah kejadian dan garis kurva tren dari {monthlyData[0]?.fullLabel} hingga{' '}
              {monthlyData[monthlyData.length - 1]?.fullLabel}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 shrink-0">
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-[#0F2744] inline-block" />
              Jumlah Laporan Bulanan
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-0.5 bg-[#C59B27] inline-block" />
              Garis Kurva Tren
            </span>
          </div>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 inline-flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Filter Jenis Insiden:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#0F2744] text-white border-[#0F2744]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              {cat === 'Semua' ? 'Semua Insiden' : cat}
            </button>
          ))}
        </div>

        {/* Responsive D3 Container + Floating Tooltip */}
        <div ref={wrapperRef} className="relative w-full overflow-hidden">
          <svg
            ref={svgRef}
            className="w-full h-[330px] block select-none"
            role="img"
            aria-label="Grafik D3.js tren frekuensi laporan darurat 12 bulan terakhir"
          />

          {hoveredMonth && (
            <div
              className="pointer-events-none absolute z-20 w-60 bg-[#0F2744] text-white rounded-lg shadow-xl border border-[#C59B27]/50 p-3 text-xs space-y-1.5 transition-opacity duration-100"
              style={{
                left: Math.min(
                  Math.max(8, hoveredMonth.x > hoveredMonth.containerWidth * 0.62 ? hoveredMonth.x - 248 : hoveredMonth.x + 12),
                  Math.max(8, hoveredMonth.containerWidth - 248)
                ),
                top: Math.max(8, Math.min(180, hoveredMonth.y - 16)),
              }}
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-1.5">
                <span className="font-semibold text-[#E5C158]">{hoveredMonth.bucket.fullLabel}</span>
                <span className="font-mono-tabular font-bold text-white">
                  {hoveredMonth.bucket.total} Laporan
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono-tabular">
                <div className="text-red-300">Baru: {hoveredMonth.bucket.baru}</div>
                <div className="text-amber-300">Proses: {hoveredMonth.bucket.diproses}</div>
                <div className="text-emerald-300">Selesai: {hoveredMonth.bucket.selesai}</div>
              </div>
              <p className="text-[11px] text-slate-300 pt-0.5 truncate">
                Dominan: <span className="text-white">{hoveredMonth.bucket.topIncident}</span>
              </p>
            </div>
          )}
        </div>

        {filteredReports.length === 0 && (
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#A67F17] shrink-0" />
            <span>
              Tidak terdapat laporan darurat untuk filter <strong>{selectedCategory}</strong> dalam 12 bulan terakhir.
            </span>
          </div>
        )}
      </div>

      {/* Category Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[#0F2744]">
              Distribusi Jenis Insiden Darurat (12 Bulan Terakhir)
            </h3>
            <p className="text-xs text-slate-500">
              Klik baris kategori untuk memfilter grafik tren bulanan di atas.
            </p>
          </div>
          {selectedCategory !== 'Semua' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('Semua')}
              className="text-xs font-semibold text-[#0F2744] hover:underline cursor-pointer"
            >
              Tampilkan Semua Kategori
            </button>
          )}
        </div>

        {categoryBreakdown.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Belum ada catatan laporan darurat dalam 12 bulan terakhir.
          </div>
        ) : (
          <>
            {/* Mobile Cards (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {categoryBreakdown.map((item) => {
                const pct = item.total > 0 ? Math.round((item.selesai / item.total) * 100) : 0;
                const isActive = selectedCategory === item.category;
                return (
                  <button
                    key={item.category}
                    type="button"
                    onClick={() =>
                      setSelectedCategory((prev) =>
                        prev === item.category ? 'Semua' : item.category
                      )
                    }
                    className={`w-full text-left p-4 space-y-2 transition-colors cursor-pointer ${
                      isActive ? 'bg-[#0F2744]/5' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#0F2744]">{item.category}</span>
                      <span className="font-mono-tabular font-bold text-[#0F2744]">
                        {item.total} total
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                      <span className="text-amber-800">{item.active} dalam penanganan</span>
                      <span className="text-emerald-700">{item.selesai} selesai ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0F2744] rounded-full transition-all duration-200"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Jenis Insiden</th>
                    <th className="py-3 px-4 text-right">Total Laporan</th>
                    <th className="py-3 px-4 text-right">Dalam Penanganan</th>
                    <th className="py-3 px-4 text-right">Selesai</th>
                    <th className="py-3 px-4 w-48">Rasio Penyelesaian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {categoryBreakdown.map((item) => {
                    const pct = item.total > 0 ? Math.round((item.selesai / item.total) * 100) : 0;
                    const isActive = selectedCategory === item.category;
                    return (
                      <tr
                        key={item.category}
                        onClick={() =>
                          setSelectedCategory((prev) =>
                            prev === item.category ? 'Semua' : item.category
                          )
                        }
                        className={`cursor-pointer transition-colors ${
                          isActive ? 'bg-[#0F2744]/5 font-semibold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4 text-[#0F2744] font-medium">{item.category}</td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#0F2744]">
                          {item.total}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-amber-800">
                          {item.active}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-emerald-700">
                          {item.selesai}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#0F2744] rounded-full transition-all duration-200"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono-tabular text-slate-600 w-9 text-right">
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
