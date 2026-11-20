import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Search,
  Sparkles,
} from 'lucide-react';
import type { HolidayCategory, NationalHoliday } from '../types';

const INDO_MONTHS = [
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

const WEEKDAYS_MON_FIRST = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export function getHolidayCategoryMeta(category: HolidayCategory) {
  switch (category) {
    case 'libur_nasional':
      return {
        label: 'Libur Nasional (SKB)',
        shortLabel: 'Libur Nasional',
        textClass: 'text-red-700',
        cellBg: 'bg-red-50/80 border-red-200',
        dotClass: 'bg-red-600',
      };
    case 'cuti_bersama':
      return {
        label: 'Cuti Bersama Pemerintah',
        shortLabel: 'Cuti Bersama',
        textClass: 'text-rose-700',
        cellBg: 'bg-rose-50/70 border-rose-200',
        dotClass: 'bg-rose-500',
      };
    case 'daerah_desa':
      return {
        label: 'Daerah Sumedang & Desa',
        shortLabel: 'Daerah & Desa',
        textClass: 'text-emerald-700',
        cellBg: 'bg-emerald-50/70 border-emerald-200',
        dotClass: 'bg-emerald-600',
      };
    case 'peringatan_nasional':
    default:
      return {
        label: 'Hari Peringatan Nasional',
        shortLabel: 'Peringatan Nasional',
        textClass: 'text-[var(--theme-accent-dark)]',
        cellBg: 'bg-amber-50/70 border-amber-200',
        dotClass: 'bg-[var(--theme-accent-dark)]',
      };
  }
}

function formatIsoToIndo(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  return `${Number(m[3])} ${INDO_MONTHS[Number(m[2]) - 1] || m[2]} ${m[1]}`;
}

function buildCalendarCells(year: number, month: number): Array<{ dateIso: string | null; day: number | null; weekdayIdx: number }> {
  const firstDay = new Date(year, month - 1, 1);
  // JS getDay(): 0 = Sun, 1 = Mon ... 6 = Sat -> convert to Mon=0 .. Sun=6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: Array<{ dateIso: string | null; day: number | null; weekdayIdx: number }> = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ dateIso: null, day: null, weekdayIdx: i % 7 });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const idx = (startOffset + d - 1) % 7;
    cells.push({ dateIso, day: d, weekdayIdx: idx });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ dateIso: null, day: null, weekdayIdx: cells.length % 7 });
  }
  return cells;
}

interface CalendarPayload {
  year: number;
  month: number | null;
  today: string;
  holidays: NationalHoliday[];
  yearHolidays: NationalHoliday[];
  summary: {
    liburNasional: number;
    cutiBersama: number;
    peringatanNasional: number;
    daerahDesa: number;
  };
}

interface IndonesianCalendarSectionProps {
  mode: 'compact' | 'full';
  onOpenFullCalendar?: () => void;
}

export function IndonesianCalendarSection({
  mode,
  onOpenFullCalendar,
}: IndonesianCalendarSectionProps) {
  const nowFallback = new Date();
  const [year, setYear] = useState<number>(nowFallback.getFullYear());
  const [month, setMonth] = useState<number>(nowFallback.getMonth() + 1);
  const [todayIso, setTodayIso] = useState<string>('');
  const [yearHolidays, setYearHolidays] = useState<NationalHoliday[]>([]);
  const [summary, setSummary] = useState<CalendarPayload['summary']>({
    liburNasional: 0,
    cutiBersama: 0,
    peringatanNasional: 0,
    daerahDesa: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(null);
  const [hasInitializedCurrent, setHasInitializedCurrent] = useState(false);

  // Full mode filters
  const [listScope, setListScope] = useState<'month' | 'year'>('month');
  const [categoryFilter, setCategoryFilter] = useState<'all' | HolidayCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/public/calendar?year=${year}&month=all`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CalendarPayload | null) => {
        if (!data) return;
        setTodayIso(data.today);
        setYearHolidays(data.yearHolidays || []);
        setSummary(
          data.summary || {
            liburNasional: 0,
            cutiBersama: 0,
            peringatanNasional: 0,
            daerahDesa: 0,
          }
        );

        if (!hasInitializedCurrent && data.today) {
          const [ty, tm] = data.today.split('-').map(Number);
          if (ty && tm) {
            setYear(ty);
            setMonth(tm);
            setSelectedDateIso(data.today);
          }
          setHasInitializedCurrent(true);
        }
      })
      .catch(() => {
        // Ignore transient offline error
      })
      .finally(() => setLoading(false));
  }, [year, hasInitializedCurrent]);

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;

  const monthHolidays = useMemo(
    () =>
      yearHolidays.filter((h) => (h.projected_date || h.holiday_date).startsWith(monthPrefix)),
    [yearHolidays, monthPrefix]
  );

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, NationalHoliday[]>();
    for (const h of monthHolidays) {
      const key = h.projected_date || h.holiday_date;
      const prev = map.get(key) || [];
      prev.push(h);
      map.set(key, prev);
    }
    return map;
  }, [monthHolidays]);

  const calendarCells = useMemo(() => buildCalendarCells(year, month), [year, month]);

  const activeDateIso = useMemo(() => {
    if (selectedDateIso && selectedDateIso.startsWith(monthPrefix)) {
      return selectedDateIso;
    }
    if (todayIso && todayIso.startsWith(monthPrefix)) {
      return todayIso;
    }
    if (monthHolidays.length > 0) {
      return monthHolidays[0].projected_date || monthHolidays[0].holiday_date;
    }
    return `${monthPrefix}01`;
  }, [selectedDateIso, monthPrefix, todayIso, monthHolidays]);

  const selectedDateHolidays = holidaysByDate.get(activeDateIso) || [];

  const filteredListHolidays = useMemo(() => {
    const base = listScope === 'month' ? monthHolidays : yearHolidays;
    const q = searchQuery.trim().toLowerCase();
    return base.filter((h) => {
      const catOk = categoryFilter === 'all' || h.category === categoryFilter;
      const qOk =
        !q ||
        h.name.toLowerCase().includes(q) ||
        h.description.toLowerCase().includes(q) ||
        (h.projected_date || h.holiday_date).includes(q);
      return catOk && qOk;
    });
  }, [listScope, monthHolidays, yearHolidays, categoryFilter, searchQuery]);

  const goPrevMonth = () => {
    if (month === 1) {
      setYear((y) => Math.max(2024, y - 1));
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (month === 12) {
      setYear((y) => Math.min(2030, y + 1));
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const jumpToToday = () => {
    const ref = todayIso || new Date().toISOString().slice(0, 10);
    const [y, m] = ref.split('-').map(Number);
    if (y && m) {
      setYear(y);
      setMonth(m);
      setSelectedDateIso(ref);
    }
  };

  const renderDateDetailPanel = () => {
    const isSunday =
      activeDateIso && /^\d{4}-\d{2}-\d{2}$/.test(activeDateIso)
        ? new Date(`${activeDateIso}T00:00:00`).getDay() === 0
        : false;

    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
              Keterangan Tanggal Dipilih
            </p>
            <h3 className="text-base font-semibold text-[var(--theme-primary)] font-mono-tabular mt-0.5">
              {formatIsoToIndo(activeDateIso)}
            </h3>
          </div>
          {activeDateIso === todayIso && (
            <span className="text-[11px] font-semibold text-[var(--theme-primary)] bg-white border border-[var(--theme-primary)]/30 px-2.5 py-1 rounded">
              Hari Ini
            </span>
          )}
        </div>

        {selectedDateHolidays.length > 0 ? (
          <div className="space-y-3">
            {selectedDateHolidays.map((item) => {
              const meta = getHolidayCategoryMeta(item.category);
              const greetingToShow =
                item.custom_greeting?.greeting_text || item.default_greeting;
              const senderToShow =
                item.custom_greeting?.sender_label || 'Pemerintah Desa Margamukti';
              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`font-semibold ${meta.textClass}`}>
                      {meta.label}
                    </span>
                    {item.is_official_holiday === 1 && (
                      <>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-semibold text-red-700">Tanggal Merah Resmi</span>
                      </>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">{item.name}</h4>
                  {item.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                  )}
                  {greetingToShow && (
                    <div className="pt-2 border-t border-slate-100 text-xs text-slate-700 leading-relaxed">
                      <span className="font-semibold text-[var(--theme-primary)]">
                        Ucapan Pemerintah Desa:{' '}
                      </span>
                      &ldquo;{greetingToShow}&rdquo;{' '}
                      <span className="text-slate-500">— {senderToShow}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 leading-relaxed">
            {isSunday ? (
              <p>
                <span className="font-semibold text-red-700">Hari Minggu (Akhir Pekan)</span> — Tidak
                tercatat hari libur nasional atau peringatan khusus pada tanggal ini. Layanan mandiri
                online dan pelaporan darurat desa tetap siaga 24 jam.
              </p>
            ) : (
              <p>
                Hari kerja biasa. Kantor Pelayanan Balai Desa Margamukti beroperasi sesuai jam kerja
                resmi (Senin–Jumat, 08.00–15.30 WIB). Klik tanggal bertanda warna untuk melihat
                keterangan hari besar Indonesia.
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCalendarGrid = () => (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-[148px] text-center">
            <p className="text-sm sm:text-base font-semibold text-[var(--theme-primary)] font-mono-tabular">
              {INDO_MONTHS[month - 1]} {year}
            </p>
          </div>
          <button
            type="button"
            onClick={goNextMonth}
            className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'full' && (
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs font-mono-tabular font-semibold bg-slate-50 border border-slate-300 rounded-md text-slate-700"
              aria-label="Pilih tahun kalender"
            >
              {[2025, 2026, 2027, 2028].map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={jumpToToday}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--theme-primary)] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer"
          >
            Hari Ini
          </button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS_MON_FIRST.map((wd, idx) => (
          <div
            key={wd}
            className={`py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
              idx === 6 ? 'text-red-600' : 'text-slate-500'
            }`}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Date Cells */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarCells.map((cell, idx) => {
          if (!cell.dateIso || cell.day === null) {
            return <div key={`empty-${idx}`} className="min-h-[46px] sm:min-h-[56px]" />;
          }

          const dayHolidays = holidaysByDate.get(cell.dateIso) || [];
          const hasOfficialRed = dayHolidays.some((h) => h.is_official_holiday === 1);
          const isSunday = cell.weekdayIdx === 6;
          const isToday = cell.dateIso === todayIso;
          const isSelected = cell.dateIso === activeDateIso;

          return (
            <button
              key={cell.dateIso}
              type="button"
              onClick={() => setSelectedDateIso(cell.dateIso)}
              title={
                dayHolidays.length > 0
                  ? dayHolidays.map((h) => h.name).join(' · ')
                  : formatIsoToIndo(cell.dateIso)
              }
              className={`relative min-h-[46px] sm:min-h-[56px] p-1.5 rounded-lg border text-left transition-colors flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/5 ring-1 ring-[var(--theme-primary)]'
                  : hasOfficialRed
                    ? 'bg-red-50/70 border-red-200 hover:border-red-300'
                    : dayHolidays.length > 0
                      ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xs sm:text-sm font-mono-tabular font-semibold ${
                    hasOfficialRed || isSunday
                      ? 'text-red-700'
                      : dayHolidays.length > 0
                        ? 'text-[var(--theme-primary)]'
                        : 'text-slate-800'
                  }`}
                >
                  {cell.day}
                </span>
                {isToday && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[var(--theme-primary)]"
                    aria-label="Hari ini"
                  />
                )}
              </div>

              {dayHolidays.length > 0 && (
                <div className="space-y-0.5 w-full">
                  <div className="flex items-center gap-1">
                    {dayHolidays.slice(0, 3).map((h) => {
                      const meta = getHolidayCategoryMeta(h.category);
                      return (
                        <span
                          key={h.id}
                          className={`h-1.5 flex-1 rounded-full ${meta.dotClass}`}
                        />
                      );
                    })}
                  </div>
                  {mode === 'full' && (
                    <p className="hidden sm:block text-[10px] leading-tight text-slate-700 truncate font-medium">
                      {dayHolidays[0].name}
                    </p>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
          Libur Nasional SKB
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          Cuti Bersama
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--theme-accent-dark)]" />
          Hari Peringatan Nasional
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          Daerah &amp; Sumedang
        </span>
      </div>
    </div>
  );

  // COMPACT WIDGET (BERANDA)
  if (mode === 'compact') {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
              Penanggalan Resmi Republik Indonesia &amp; Daerah
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--theme-primary)] mt-1">
              Kalender &amp; Hari Besar Indonesia
            </h2>
          </div>
          {onOpenFullCalendar && (
            <button
              type="button"
              onClick={onOpenFullCalendar}
              className="text-xs font-semibold text-[var(--theme-primary)] hover:text-[var(--theme-accent-dark)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Lihat Kalender Lengkap &amp; Daftar Tahunan
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">{renderCalendarGrid()}</div>

          <div className="lg:col-span-5 space-y-4">
            {renderDateDetailPanel()}

            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-semibold text-[var(--theme-primary)] flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[var(--theme-accent-dark)]" />
                  <span>
                    Daftar Hari Besar {INDO_MONTHS[month - 1]} {year}
                  </span>
                </h3>
                <span className="text-xs font-mono-tabular font-semibold text-slate-500">
                  {monthHolidays.length} momen
                </span>
              </div>

              {loading && monthHolidays.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">Memuat daftar hari besar...</p>
              ) : monthHolidays.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  Tidak ada hari libur nasional atau peringatan baku tercatat pada bulan{' '}
                  {INDO_MONTHS[month - 1]} {year}.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {monthHolidays.map((h) => {
                    const meta = getHolidayCategoryMeta(h.category);
                    const dateKey = h.projected_date || h.holiday_date;
                    const isFocused = dateKey === activeDateIso;
                    return (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedDateIso(dateKey)}
                          className={`w-full text-left py-2.5 px-2 rounded-lg transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                            isFocused ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {h.name}
                            </p>
                            <p className={`text-[11px] font-medium ${meta.textClass}`}>
                              {meta.shortLabel}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-mono-tabular font-bold shrink-0 ${
                              h.is_official_holiday === 1 ? 'text-red-700' : 'text-slate-700'
                            }`}
                          >
                            {Number(dateKey.slice(8, 10))} {INDO_MONTHS[month - 1].slice(0, 3)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {onOpenFullCalendar && (
                <button
                  type="button"
                  onClick={onOpenFullCalendar}
                  className="w-full min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Buka Kalender Tahunan &amp; SKB 3 Menteri</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // FULL TAB MODE (JELAJAH DESA -> KALENDER & HARI BESAR)
  return (
    <div className="space-y-6">
      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Libur Nasional Baku</p>
          <p className="text-2xl font-bold text-red-700 font-mono-tabular mt-1">
            {summary.liburNasional} Hari
          </p>
          <p className="text-xs text-slate-500 mt-0.5">SKB 3 Menteri Tahun {year}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Cuti Bersama Pemerintah</p>
          <p className="text-2xl font-bold text-rose-700 font-mono-tabular mt-1">
            {summary.cutiBersama} Hari
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Ketetapan resmi tahun {year}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Hari Peringatan Nasional</p>
          <p className="text-2xl font-bold text-[var(--theme-primary)] font-mono-tabular mt-1">
            {summary.peringatanNasional} Momen
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Peringatan baku kenegaraan</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Daerah Sumedang &amp; Jabar</p>
          <p className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-1">
            {summary.daerahDesa} Momen
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Termasuk 22 April Sumedang</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-5">
          {renderCalendarGrid()}
          {renderDateDetailPanel()}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-semibold text-[var(--theme-primary)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--theme-accent-dark)]" />
                <span>Daftar Hari Besar Indonesia</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik salah satu momen untuk menyorot tanggal pada kalender.
              </p>
            </div>
            <div className="inline-flex p-0.5 bg-slate-100 rounded-md text-xs font-semibold">
              <button
                type="button"
                onClick={() => setListScope('month')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  listScope === 'month'
                    ? 'bg-white text-[var(--theme-primary)] shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                {INDO_MONTHS[month - 1]}
              </button>
              <button
                type="button"
                onClick={() => setListScope('year')}
                className={`px-2.5 py-1 rounded font-mono-tabular cursor-pointer ${
                  listScope === 'year'
                    ? 'bg-white text-[var(--theme-primary)] shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                Semua {year}
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama hari besar, misalnya Sumedang, Guru, Idulfitri..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'Semua' },
                { id: 'libur_nasional', label: 'Libur Nasional' },
                { id: 'cuti_bersama', label: 'Cuti Bersama' },
                { id: 'peringatan_nasional', label: 'Peringatan Nasional' },
                { id: 'daerah_desa', label: 'Sumedang & Jabar' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id as 'all' | HolidayCategory)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100 pr-1">
            {filteredListHolidays.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Tidak ada hari besar yang sesuai dengan filter{' '}
                {listScope === 'month' ? `bulan ${INDO_MONTHS[month - 1]} ${year}` : `tahun ${year}`}.
              </div>
            ) : (
              filteredListHolidays.map((h) => {
                const meta = getHolidayCategoryMeta(h.category);
                const dateKey = h.projected_date || h.holiday_date;
                const isSelected = dateKey === activeDateIso;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      const [, mNum] = dateKey.split('-').map(Number);
                      if (mNum && mNum !== month) setMonth(mNum);
                      setSelectedDateIso(dateKey);
                    }}
                    className={`w-full text-left py-3 px-2.5 rounded-lg transition-colors space-y-1 cursor-pointer ${
                      isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-mono-tabular font-bold ${
                          h.is_official_holiday === 1 ? 'text-red-700' : 'text-[var(--theme-primary)]'
                        }`}
                      >
                        {formatIsoToIndo(dateKey)}
                      </span>
                      <span className={`text-[11px] font-semibold ${meta.textClass}`}>
                        {meta.shortLabel}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{h.name}</p>
                    {h.description && (
                      <p className="text-xs text-slate-600 line-clamp-2">{h.description}</p>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
            <Landmark className="w-3.5 h-3.5 text-[var(--theme-accent-dark)] shrink-0 mt-0.5" />
            <span>
              Mengacu pada SKB 3 Menteri RI (2026–2027), Keputusan Presiden RI tentang Hari Peringatan
              Nasional, serta Hari Jadi Kabupaten Sumedang (22 April) &amp; Provinsi Jawa Barat.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
