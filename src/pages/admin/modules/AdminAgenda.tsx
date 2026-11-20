import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  MapPin,
  Megaphone,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { adminFetch } from '../../../utils/adminApi';
import { getGreetingToneMeta } from '../../../components/VillageGreetingBanner';
import { getHolidayCategoryMeta } from '../../../components/IndonesianCalendarSection';
import type {
  ActiveGreetingItem,
  GreetingTone,
  HolidayCategory,
  NationalHoliday,
  VillageEvent,
  VillageGreeting,
} from '../../../types';

interface NotifyProps {
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

const TONE_OPTIONS: Array<{ value: GreetingTone; label: string }> = [
  { value: 'resmi', label: 'Resmi Desa (Emas & Navy)' },
  { value: 'nasional', label: 'Hari Nasional (Merah Putih)' },
  { value: 'religius', label: 'Hari Besar Keagamaan (Hijau Teduh)' },
  { value: 'daerah', label: 'Daerah & Budaya Sunda (Krem Hangat)' },
  { value: 'duka', label: 'Belasungkawa Resmi (Abu Tenang)' },
];

const CATEGORY_OPTIONS: Array<{ value: HolidayCategory; label: string }> = [
  { value: 'libur_nasional', label: 'Libur Nasional (SKB 3 Menteri)' },
  { value: 'cuti_bersama', label: 'Cuti Bersama Pemerintah' },
  { value: 'peringatan_nasional', label: 'Hari Peringatan Nasional' },
  { value: 'daerah_desa', label: 'Hari Jadi Daerah / Desa' },
];

const SENDER_PRESETS = [
  'Pemerintah Desa Margamukti',
  'Sekretaris Desa a.n. Kepala Desa Margamukti',
  'Sekretaris Desa Margamukti',
  'Kepala Desa & Perangkat Desa Margamukti',
  'Pemerintah & TP PKK Desa Margamukti',
];

function broadcastGreetingUpdate() {
  try {
    window.dispatchEvent(new CustomEvent('margamukti:greetings-updated'));
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('margamukti_greetings_sync');
      ch.postMessage('updated');
      ch.close();
    }
  } catch {
    // Ignore broadcast errors in restricted contexts
  }
}

const INDO_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function formatDateShort(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return iso || '-';
  return `${Number(m[3])} ${INDO_MONTHS_SHORT[Number(m[2]) - 1] || m[2]} ${m[1]}`;
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function inferTone(category: HolidayCategory, name: string): GreetingTone {
  if (category === 'daerah_desa') return 'daerah';
  if (/(idul|isra|maulid|muharam|natal|yesus|paskah|nyepi|waisak|imlek|santri|amal bakti)/i.test(name)) {
    return 'religius';
  }
  if (category === 'libur_nasional' || category === 'peringatan_nasional') return 'nasional';
  return 'resmi';
}

export function AdminAgendaModule({ onNotify }: NotifyProps) {
  const [subTab, setSubTab] = useState<'ucapan' | 'kalender' | 'agenda'>('ucapan');

  // Running text agenda events
  const [events, setEvents] = useState<VillageEvent[]>([]);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<VillageEvent | null>(null);
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState<number | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    event_time: '',
    location: '',
    sort_order: 1,
    is_active: true,
  });

  // Village Greetings
  const [greetings, setGreetings] = useState<VillageGreeting[]>([]);
  const [activeLiveGreetings, setActiveLiveGreetings] = useState<ActiveGreetingItem[]>([]);
  const [todayIso, setTodayIso] = useState<string>(new Date().toISOString().slice(0, 10));
  const [greetingModalOpen, setGreetingModalOpen] = useState(false);
  const [editingGreeting, setEditingGreeting] = useState<VillageGreeting | null>(null);
  const [confirmDeleteGreetingId, setConfirmDeleteGreetingId] = useState<number | null>(null);
  const [greetingForm, setGreetingForm] = useState<{
    holiday_id: string;
    moment_title: string;
    greeting_text: string;
    sender_label: string;
    theme_tone: GreetingTone;
    start_date: string;
    end_date: string;
    is_pinned: boolean;
    is_active: boolean;
  }>({
    holiday_id: '',
    moment_title: '',
    greeting_text: '',
    sender_label: 'Pemerintah Desa Margamukti',
    theme_tone: 'resmi',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    is_pinned: false,
    is_active: true,
  });

  // National Holidays
  const [holidays, setHolidays] = useState<NationalHoliday[]>([]);
  const [holidayFilterCat, setHolidayFilterCat] = useState<'all' | HolidayCategory>('all');
  const [holidayQuery, setHolidayQuery] = useState('');
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<NationalHoliday | null>(null);
  const [confirmDeleteHolidayId, setConfirmDeleteHolidayId] = useState<number | null>(null);
  const [holidayForm, setHolidayForm] = useState<{
    holiday_date: string;
    name: string;
    category: HolidayCategory;
    is_annual: boolean;
    is_official_holiday: boolean;
    description: string;
    default_greeting: string;
    is_active: boolean;
  }>({
    holiday_date: new Date().toISOString().slice(0, 10),
    name: '',
    category: 'peringatan_nasional',
    is_annual: true,
    is_official_holiday: false,
    description: '',
    default_greeting: '',
    is_active: true,
  });

  const loadAll = () => {
    adminFetch('/api/admin/events')
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((j) => setEvents(j.events || []));

    adminFetch('/api/admin/greetings')
      .then((r) => (r.ok ? r.json() : { greetings: [] }))
      .then((j) => {
        setGreetings(j.greetings || []);
        if (j.today) setTodayIso(j.today);
      });

    adminFetch('/api/admin/holidays')
      .then((r) => (r.ok ? r.json() : { holidays: [] }))
      .then((j) => setHolidays(j.holidays || []));

    fetch('/api/public/greetings/active')
      .then((r) => (r.ok ? r.json() : { activeGreetings: [] }))
      .then((j) => setActiveLiveGreetings(j.activeGreetings || []))
      .catch(() => {});
  };

  useEffect(loadAll, []);

  // === EVENT HANDLERS ===
  const openNewEvent = () => {
    setEditingEvent(null);
    setEventForm({
      title: '',
      event_time: '',
      location: '',
      sort_order: events.length + 1,
      is_active: true,
    });
    setEventModalOpen(true);
  };

  const openEditEvent = (ev: VillageEvent) => {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title,
      event_time: ev.event_time,
      location: ev.location,
      sort_order: ev.sort_order,
      is_active: ev.is_active === 1,
    });
    setEventModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingEvent ? `/api/admin/events/${editingEvent.id}` : '/api/admin/events';
    const method = editingEvent ? 'PUT' : 'POST';
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventForm),
    });
    const json = await res.json();
    if (!res.ok) {
      onNotify(json.error || 'Gagal menyimpan agenda desa.', 'err');
      return;
    }
    setEventModalOpen(false);
    loadAll();
    onNotify(editingEvent ? 'Agenda kegiatan berhasil diperbarui.' : 'Agenda kegiatan baru ditambahkan.');
  };

  const handleToggleEvent = async (ev: VillageEvent) => {
    const res = await adminFetch(`/api/admin/events/${ev.id}/toggle`, { method: 'PATCH' });
    if (!res.ok) {
      onNotify('Gagal mengubah status agenda.', 'err');
      return;
    }
    loadAll();
    onNotify(
      ev.is_active === 1
        ? 'Agenda disembunyikan dari pita berjalan.'
        : 'Agenda ditampilkan di pita berjalan.'
    );
  };

  const handleDeleteEvent = async (id: number) => {
    const res = await adminFetch(`/api/admin/events/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      onNotify('Gagal menghapus agenda.', 'err');
      return;
    }
    setConfirmDeleteEventId(null);
    loadAll();
    onNotify('Agenda kegiatan dihapus.');
  };

  // === GREETING HANDLERS ===
  const applyHolidayTemplate = (holidayIdStr: string) => {
    if (!holidayIdStr) {
      setGreetingForm((prev) => ({ ...prev, holiday_id: '' }));
      return;
    }
    const found = holidays.find((h) => String(h.id) === holidayIdStr);
    if (!found) return;
    const baseYear = todayIso.slice(0, 4) || '2026';
    const targetDate = found.is_annual === 1 ? `${baseYear}-${found.month_day}` : found.holiday_date;
    setGreetingForm((prev) => ({
      ...prev,
      holiday_id: String(found.id),
      moment_title: `Memperingati ${found.name}`,
      greeting_text:
        found.default_greeting ||
        `Pemerintah Desa Margamukti mengucapkan Selamat Memperingati ${found.name}.`,
      theme_tone: inferTone(found.category, found.name),
      start_date: shiftIsoDate(targetDate, -2),
      end_date: shiftIsoDate(targetDate, 1),
    }));
  };

  const openNewGreeting = (prefillHoliday?: NationalHoliday) => {
    setEditingGreeting(null);
    if (prefillHoliday) {
      const baseYear = todayIso.slice(0, 4) || '2026';
      const targetDate =
        prefillHoliday.is_annual === 1
          ? `${baseYear}-${prefillHoliday.month_day}`
          : prefillHoliday.holiday_date;
      setGreetingForm({
        holiday_id: String(prefillHoliday.id),
        moment_title: `Memperingati ${prefillHoliday.name}`,
        greeting_text:
          prefillHoliday.default_greeting ||
          `Pemerintah Desa Margamukti mengucapkan Selamat Memperingati ${prefillHoliday.name}.`,
        sender_label: 'Pemerintah Desa Margamukti',
        theme_tone: inferTone(prefillHoliday.category, prefillHoliday.name),
        start_date: shiftIsoDate(targetDate, -2),
        end_date: shiftIsoDate(targetDate, 1),
        is_pinned: false,
        is_active: true,
      });
    } else {
      setGreetingForm({
        holiday_id: '',
        moment_title: '',
        greeting_text: '',
        sender_label: 'Pemerintah Desa Margamukti',
        theme_tone: 'resmi',
        start_date: todayIso,
        end_date: shiftIsoDate(todayIso, 3),
        is_pinned: false,
        is_active: true,
      });
    }
    setGreetingModalOpen(true);
  };

  const openEditGreeting = (g: VillageGreeting) => {
    setEditingGreeting(g);
    setGreetingForm({
      holiday_id: g.holiday_id ? String(g.holiday_id) : '',
      moment_title: g.moment_title,
      greeting_text: g.greeting_text,
      sender_label: g.sender_label,
      theme_tone: g.theme_tone,
      start_date: g.start_date,
      end_date: g.end_date,
      is_pinned: g.is_pinned === 1,
      is_active: g.is_active === 1,
    });
    setGreetingModalOpen(true);
  };

  const handleSaveGreeting = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingGreeting
      ? `/api/admin/greetings/${editingGreeting.id}`
      : '/api/admin/greetings';
    const method = editingGreeting ? 'PUT' : 'POST';
    const payload = {
      ...greetingForm,
      holiday_id: greetingForm.holiday_id ? Number(greetingForm.holiday_id) : null,
    };
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      onNotify(json.error || 'Gagal menyimpan ucapan Pemerintah Desa.', 'err');
      return;
    }
    setGreetingModalOpen(false);
    loadAll();
    broadcastGreetingUpdate();
    onNotify(
      editingGreeting
        ? 'Kalimat ucapan Pemerintah Desa diperbarui.'
        : 'Ucapan Pemerintah Desa baru ditambahkan.'
    );
  };

  const handleToggleGreeting = async (g: VillageGreeting) => {
    const res = await adminFetch(`/api/admin/greetings/${g.id}/toggle`, { method: 'PATCH' });
    if (!res.ok) {
      onNotify('Gagal mengubah status tampil ucapan.', 'err');
      return;
    }
    loadAll();
    broadcastGreetingUpdate();
    onNotify(
      g.is_active === 1
        ? 'Ucapan dinonaktifkan dari banner atas.'
        : 'Ucapan diaktifkan untuk penayangan.'
    );
  };

  const handlePinGreeting = async (g: VillageGreeting) => {
    const res = await adminFetch(`/api/admin/greetings/${g.id}/pin`, { method: 'PATCH' });
    if (!res.ok) {
      onNotify('Gagal menyematkan ucapan.', 'err');
      return;
    }
    loadAll();
    broadcastGreetingUpdate();
    onNotify(
      g.is_pinned === 1
        ? 'Sematan banner dilepas (kembali mengikuti jadwal tanggal).'
        : 'Ucapan disematkan di banner paling atas Portal Publik!'
    );
  };

  const handleDeleteGreeting = async (id: number) => {
    const res = await adminFetch(`/api/admin/greetings/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      onNotify('Gagal menghapus ucapan Pemerintah Desa.', 'err');
      return;
    }
    setConfirmDeleteGreetingId(null);
    loadAll();
    broadcastGreetingUpdate();
    onNotify('Ucapan Pemerintah Desa dihapus.');
  };

  // === HOLIDAY HANDLERS ===
  const openNewHoliday = () => {
    setEditingHoliday(null);
    setHolidayForm({
      holiday_date: todayIso,
      name: '',
      category: 'peringatan_nasional',
      is_annual: true,
      is_official_holiday: false,
      description: '',
      default_greeting: '',
      is_active: true,
    });
    setHolidayModalOpen(true);
  };

  const openEditHoliday = (h: NationalHoliday) => {
    setEditingHoliday(h);
    setHolidayForm({
      holiday_date: h.holiday_date,
      name: h.name,
      category: h.category,
      is_annual: h.is_annual === 1,
      is_official_holiday: h.is_official_holiday === 1,
      description: h.description,
      default_greeting: h.default_greeting,
      is_active: h.is_active === 1,
    });
    setHolidayModalOpen(true);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingHoliday
      ? `/api/admin/holidays/${editingHoliday.id}`
      : '/api/admin/holidays';
    const method = editingHoliday ? 'PUT' : 'POST';
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holidayForm),
    });
    const json = await res.json();
    if (!res.ok) {
      onNotify(json.error || 'Gagal menyimpan data hari besar.', 'err');
      return;
    }
    setHolidayModalOpen(false);
    loadAll();
    broadcastGreetingUpdate();
    onNotify(
      editingHoliday
        ? 'Data hari besar & ucapan default diperbarui.'
        : 'Hari besar baru ditambahkan ke kalender desa.'
    );
  };

  const handleToggleHoliday = async (h: NationalHoliday) => {
    const res = await adminFetch(`/api/admin/holidays/${h.id}/toggle`, { method: 'PATCH' });
    if (!res.ok) {
      onNotify('Gagal mengubah status hari besar.', 'err');
      return;
    }
    loadAll();
    broadcastGreetingUpdate();
    onNotify(
      h.is_active === 1
        ? 'Hari besar disembunyikan dari kalender publik.'
        : 'Hari besar ditampilkan kembali di kalender publik.'
    );
  };

  const handleDeleteHoliday = async (id: number) => {
    const res = await adminFetch(`/api/admin/holidays/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      onNotify('Gagal menghapus data hari besar.', 'err');
      return;
    }
    setConfirmDeleteHolidayId(null);
    loadAll();
    broadcastGreetingUpdate();
    onNotify('Data hari besar dihapus dari kalender.');
  };

  const activeEvents = events.filter((e) => e.is_active === 1);

  const filteredHolidays = useMemo(() => {
    const q = holidayQuery.trim().toLowerCase();
    return holidays.filter((h) => {
      const catOk = holidayFilterCat === 'all' || h.category === holidayFilterCat;
      const qOk =
        !q ||
        h.name.toLowerCase().includes(q) ||
        h.holiday_date.includes(q) ||
        h.default_greeting.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [holidays, holidayFilterCat, holidayQuery]);

  const modalPreviewMeta = getGreetingToneMeta(greetingForm.theme_tone);

  return (
    <div className="space-y-6">
      {/* Header + Sub-tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">
            Agenda, Ucapan Pemerintah Desa &amp; Kalender Hari Besar
          </h2>
          <p className="text-xs text-slate-500">
            Kelola banner kalimat ucapan resmi di atas website, kalender hari besar Indonesia baku,
            serta pita running text Agenda Desa.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto no-scrollbar max-w-full self-start">
          <button
            type="button"
            onClick={() => setSubTab('ucapan')}
            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'ucapan'
                ? 'bg-white text-[#0F2744] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ucapan Pemerintah Desa ({greetings.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('kalender')}
            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'kalender'
                ? 'bg-white text-[#0F2744] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Kalender Hari Besar ({holidays.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('agenda')}
            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'agenda'
                ? 'bg-white text-[#0F2744] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Agenda Running Text ({events.length})
          </button>
        </div>
      </div>

      {/* ===================================================================
          SUB-TAB 1: UCAPAN RESMI PEMERINTAH DESA (BANNER ATAS PORTAL PUBLIK)
          =================================================================== */}
      {subTab === 'ucapan' && (
        <div className="space-y-6">
          {/* Live Top-Banner Preview */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#0F2744] flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-[#A67F17]" />
                Pratinjau Kolom Ucapan yang Sedang Tayang di Atas Website (Hari Ini:{' '}
                <span className="font-mono-tabular">{formatDateShort(todayIso)}</span>)
              </span>
              <span className="text-[11px] font-mono-tabular text-slate-500">
                {activeLiveGreetings.length} ucapan aktif otomatis/terjadwal
              </span>
            </div>

            {activeLiveGreetings.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {activeLiveGreetings.map((item) => {
                  const meta = getGreetingToneMeta(item.themeTone);
                  const ToneIcon = meta.Icon;
                  return (
                    <div key={item.key} className={`${meta.bg} px-4 py-3.5 space-y-1`}>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                        <ToneIcon className={`w-3.5 h-3.5 ${meta.kicker}`} />
                        <span className={`uppercase tracking-wider ${meta.kicker}`}>
                          {item.categoryLabel}
                        </span>
                        <span className="text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono-tabular text-slate-600">{item.dateLabel}</span>
                        {item.isPinned && (
                          <>
                            <span className="text-slate-400" aria-hidden="true">
                              ·
                            </span>
                            <span className={meta.kicker}>Disematkan Admin</span>
                          </>
                        )}
                      </div>
                      <p className={`text-sm font-semibold ${meta.title}`}>{item.momentTitle}</p>
                      <p className={`text-xs leading-relaxed ${meta.body}`}>
                        &ldquo;{item.greetingText}&rdquo;{' '}
                        <span className={`font-semibold ${meta.sender}`}>
                          — {item.senderLabel}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-5 text-xs text-slate-500">
                Belum ada ucapan terjadwal maupun momen hari besar dalam rentang 7 hari ke depan.
                Klik &ldquo;Tambah Ucapan Baru&rdquo; atau sematkan salah satu ucapan di bawah.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600 max-w-2xl">
              Sistem otomatis menampilkan ucapan sesuai jadwal tanggal atau kalender hari besar
              Indonesia. Anda juga dapat <strong>Menyematkan</strong> ucapan agar langsung tampil
              di bagian atas website tanpa menunggu tanggal.
            </p>
            <button
              type="button"
              onClick={() => openNewGreeting()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" /> Tambah Ucapan Pemerintah Desa
            </button>
          </div>

          {/* Greetings Cards / Table */}
          <div className="space-y-3">
            {greetings.map((g) => {
              const toneMeta = getGreetingToneMeta(g.theme_tone);
              const inDateWindow = g.start_date <= todayIso && g.end_date >= todayIso;
              const isLiveNow = g.is_active === 1 && (g.is_pinned === 1 || inDateWindow);

              return (
                <div
                  key={g.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className={`font-semibold ${toneMeta.kicker}`}>
                          {toneMeta.label}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono-tabular text-slate-600">
                          {formatDateShort(g.start_date)} – {formatDateShort(g.end_date)}
                        </span>
                        {g.holiday_name && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-slate-600">Kalender: {g.holiday_name}</span>
                          </>
                        )}
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span
                          className={`font-semibold ${
                            isLiveNow ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {isLiveNow
                            ? 'Sedang Tayang di Atas Web'
                            : g.is_active === 1
                              ? 'Terjadwal'
                              : 'Nonaktif'}
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-[#0F2744]">{g.moment_title}</h3>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        &ldquo;{g.greeting_text}&rdquo;
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="font-semibold text-[#A67F17]">— {g.sender_label}</span>
                        {g.updated_by && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-slate-500">Diperbarui: {g.updated_by}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePinGreeting(g)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded border cursor-pointer ${
                          g.is_pinned === 1
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                        title="Sematkan langsung di banner atas website"
                      >
                        {g.is_pinned === 1 ? (
                          <Pin className="w-3.5 h-3.5" />
                        ) : (
                          <PinOff className="w-3.5 h-3.5" />
                        )}
                        {g.is_pinned === 1 ? 'Disematkan' : 'Sematkan'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleGreeting(g)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded border cursor-pointer ${
                          g.is_active === 1
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {g.is_active === 1 ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                        {g.is_active === 1 ? 'Aktif' : 'Nonaktif'}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditGreeting(g)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>

                      {confirmDeleteGreetingId === g.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteGreeting(g.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Ya, Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteGreetingId(null)}
                            className="px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-slate-600 border border-slate-200 rounded cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteGreetingId(g.id)}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-500 hover:text-red-600 border border-slate-200 rounded cursor-pointer"
                          title="Hapus ucapan"
                          aria-label="Hapus ucapan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {greetings.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
                Belum ada ucapan terjadwal. Saat ini website menggunakan kalimat ucapan bawaan
                Kalender Hari Besar Indonesia secara otomatis.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================
          SUB-TAB 2: KALENDER HARI BESAR INDONESIA BAKU
          =================================================================== */}
      {subTab === 'kalender' && (
        <div className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'Semua Kategori' },
                { id: 'libur_nasional', label: 'Libur Nasional' },
                { id: 'cuti_bersama', label: 'Cuti Bersama' },
                { id: 'peringatan_nasional', label: 'Hari Peringatan' },
                { id: 'daerah_desa', label: 'Sumedang & Jabar' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setHolidayFilterCat(cat.id as 'all' | HolidayCategory)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                    holidayFilterCat === cat.id
                      ? 'bg-[#0F2744] text-white border-[#0F2744]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={holidayQuery}
                  onChange={(e) => setHolidayQuery(e.target.value)}
                  placeholder="Cari hari besar atau tanggal..."
                  className="w-full sm:w-64 pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                />
              </div>
              <button
                type="button"
                onClick={openNewHoliday}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Tambah Hari Besar
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Tanggal &amp; Siklus</th>
                    <th className="py-3 px-4">Nama Hari Besar &amp; Ucapan Bawaan</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredHolidays.map((h) => {
                    const meta = getHolidayCategoryMeta(h.category);
                    return (
                      <tr key={h.id} className="hover:bg-slate-50/80 align-top">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p
                            className={`font-mono-tabular font-bold ${
                              h.is_official_holiday === 1 ? 'text-red-700' : 'text-[#0F2744]'
                            }`}
                          >
                            {h.is_annual === 1
                              ? `Setiap ${h.month_day.slice(3, 5)}/${h.month_day.slice(0, 2)}`
                              : formatDateShort(h.holiday_date)}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {h.is_official_holiday === 1 ? 'Tanggal Merah SKB' : 'Hari Peringatan'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 max-w-lg space-y-1">
                          <p className="text-sm font-semibold text-slate-900">{h.name}</p>
                          {h.default_greeting && (
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              Ucapan bawaan: &ldquo;{h.default_greeting}&rdquo;
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`font-semibold ${meta.textClass}`}>
                            {meta.shortLabel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleHoliday(h)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded border cursor-pointer ${
                              h.is_active === 1
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {h.is_active === 1 ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSubTab('ucapan');
                              openNewGreeting(h);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#0F2744] bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded cursor-pointer"
                            title="Buat ucapan banner dari hari besar ini"
                          >
                            <Sparkles className="w-3 h-3 text-[#A67F17]" /> Jadikan Banner
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditHoliday(h)}
                            className="p-1.5 text-slate-600 hover:text-[#0F2744] cursor-pointer"
                            title="Edit hari besar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {confirmDeleteHolidayId === h.id ? (
                            <span className="inline-flex items-center gap-1 ml-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteHoliday(h.id)}
                                className="px-2 py-1 text-[11px] font-semibold text-white bg-red-600 rounded cursor-pointer"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteHolidayId(null)}
                                className="px-2 py-1 text-[11px] text-slate-600 border border-slate-200 rounded cursor-pointer"
                              >
                                Batal
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteHolidayId(h.id)}
                              className="p-1.5 text-slate-500 hover:text-red-600 cursor-pointer"
                              title="Hapus hari besar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredHolidays.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                        Tidak ditemukan hari besar yang cocok dengan pencarian Anda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          SUB-TAB 3: AGENDA KEGIATAN DESA & RUNNING TEXT
          =================================================================== */}
      {subTab === 'agenda' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              Kelola nama acara, waktu, dan tempat yang tampil di pita teks berjalan di bawah
              navigasi Portal Publik.
            </p>
            <button
              type="button"
              onClick={openNewEvent}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" /> Tambah Agenda
            </button>
          </div>

          {/* Live Preview Banner */}
          <div className="bg-[#091A30] text-slate-100 rounded-xl border border-[#C59B27]/40 overflow-hidden">
            <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between text-[11px] text-[#E5C158] font-semibold uppercase tracking-wider">
              <span>Pratinjau Pita Agenda Portal Publik ({activeEvents.length} Acara Aktif)</span>
            </div>
            {activeEvents.length > 0 ? (
              <div className="px-4 py-2.5 text-xs flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {activeEvents.map((ev, idx) => (
                  <span key={ev.id} className="inline-flex items-center gap-1.5">
                    {idx > 0 && (
                      <span className="text-slate-500 mr-2" aria-hidden="true">
                        |
                      </span>
                    )}
                    <span className="font-semibold text-white">{ev.title}</span>
                    <span className="text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono-tabular text-[#E5C158]">{ev.event_time}</span>
                    <span className="text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-300">{ev.location}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="px-4 py-3 text-xs text-slate-400">
                Tidak ada agenda aktif saat ini. Pita running text otomatis disembunyikan di portal
                publik.
              </div>
            )}
          </div>

          {/* Mobile Cards (< md) */}
          <div className="md:hidden space-y-3">
            {events.map((ev) => (
              <div key={ev.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono-tabular text-xs font-bold text-slate-500">
                    #{ev.sort_order}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleEvent(ev)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold rounded border cursor-pointer ${
                      ev.is_active === 1
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {ev.is_active === 1 ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                    {ev.is_active === 1 ? 'Tampil Aktif' : 'Disembunyikan'}
                  </button>
                </div>

                <h3 className="text-sm font-semibold text-[#0F2744]">{ev.title}</h3>

                <div className="text-xs text-slate-600 space-y-1">
                  <p className="inline-flex items-center gap-1.5 font-mono-tabular text-slate-700">
                    <CalendarDays className="w-3.5 h-3.5 text-[#A67F17] shrink-0" />
                    {ev.event_time}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{ev.location}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openEditEvent(ev)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit Agenda
                  </button>
                  {confirmDeleteEventId === ev.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="min-h-[44px] px-3 text-xs font-semibold text-white bg-red-600 rounded-md cursor-pointer"
                      >
                        Ya, Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteEventId(null)}
                        className="min-h-[44px] px-2.5 text-xs text-slate-600 border border-slate-200 rounded-md cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteEventId(ev.id)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-600 hover:text-red-600 border border-slate-200 rounded-md cursor-pointer"
                      aria-label="Hapus Agenda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                Belum ada agenda kegiatan desa. Klik &ldquo;Tambah Agenda&rdquo; untuk memulai.
              </div>
            )}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4 w-16">Urut</th>
                    <th className="py-3 px-4">Nama Acara / Kegiatan</th>
                    <th className="py-3 px-4">Waktu Pelaksanaan</th>
                    <th className="py-3 px-4">Tempat / Lokasi</th>
                    <th className="py-3 px-4">Status Tampil</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono-tabular text-xs font-semibold text-slate-500">
                        #{ev.sort_order}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#0F2744]">{ev.title}</td>
                      <td className="py-3.5 px-4 text-xs font-mono-tabular text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-[#A67F17]" />
                          {ev.event_time}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {ev.location}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleEvent(ev)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer ${
                            ev.is_active === 1
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {ev.is_active === 1 ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                          {ev.is_active === 1 ? 'Tampil Aktif' : 'Disembunyikan'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditEvent(ev)}
                          className="p-1.5 text-slate-600 hover:text-[#0F2744] cursor-pointer"
                          title="Edit Agenda"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {confirmDeleteEventId === ev.id ? (
                          <span className="inline-flex items-center gap-1 ml-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(ev.id)}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-red-600 rounded cursor-pointer"
                            >
                              Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteEventId(null)}
                              className="px-2 py-1 text-[11px] text-slate-600 border border-slate-200 rounded cursor-pointer"
                            >
                              Batal
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteEventId(ev.id)}
                            className="p-1.5 text-slate-600 hover:text-red-600 ml-1 cursor-pointer"
                            title="Hapus Agenda"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                        Belum ada agenda kegiatan desa. Klik &ldquo;Tambah Agenda&rdquo; untuk
                        memulai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: TAMBAH / EDIT UCAPAN RESMI PEMERINTAH DESA
          =================================================================== */}
      {greetingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-2xl w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-[#0F2744]">
                {editingGreeting
                  ? 'Edit Ucapan Resmi Pemerintah Desa'
                  : 'Tambah Ucapan Resmi Pemerintah Desa'}
              </h3>
              <button
                type="button"
                onClick={() => setGreetingModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 cursor-pointer"
                aria-label="Tutup modal ucapan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGreeting} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                <label className="block text-xs font-semibold text-[#0F2744]">
                  Gunakan Template dari Kalender Hari Besar Indonesia (Opsional)
                </label>
                <select
                  value={greetingForm.holiday_id}
                  onChange={(e) => applyHolidayTemplate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                >
                  <option value="">— Ucapan Bebas / Momen Khusus Desa —</option>
                  {holidays.map((h) => (
                    <option key={h.id} value={String(h.id)}>
                      {h.is_annual === 1 ? `[Tahunan ${h.month_day}]` : `[${h.holiday_date}]`}{' '}
                      {h.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Memilih hari besar akan mengisi otomatis judul momen, kalimat ucapan, serta rentang
                  tanggal tayang—tetap bisa Anda ubah bebas.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Momen / Peringatan *
                </label>
                <input
                  required
                  value={greetingForm.moment_title}
                  onChange={(e) =>
                    setGreetingForm({ ...greetingForm, moment_title: e.target.value })
                  }
                  placeholder="Contoh: Selamat Hari Jadi Kabupaten Sumedang ke-448"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kalimat Ucapan Resmi Pemerintah Desa *
                </label>
                <textarea
                  required
                  rows={3}
                  value={greetingForm.greeting_text}
                  onChange={(e) =>
                    setGreetingForm({ ...greetingForm, greeting_text: e.target.value })
                  }
                  placeholder="Contoh: Pemerintah Desa Margamukti mengucapkan Selamat Memperingati..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Atas Nama / Pengirim *
                  </label>
                  <input
                    required
                    value={greetingForm.sender_label}
                    onChange={(e) =>
                      setGreetingForm({ ...greetingForm, sender_label: e.target.value })
                    }
                    placeholder="Pemerintah Desa Margamukti"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nuansa Tampilan Banner
                  </label>
                  <select
                    value={greetingForm.theme_tone}
                    onChange={(e) =>
                      setGreetingForm({
                        ...greetingForm,
                        theme_tone: e.target.value as GreetingTone,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                  >
                    {TONE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">
                  Pilih Cepat Atribusi Penandatangan Resmi:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SENDER_PRESETS.map((preset) => {
                    const selected = greetingForm.sender_label === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setGreetingForm({ ...greetingForm, sender_label: preset })}
                        className={`px-2.5 py-1 text-[11px] rounded border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#0F2744] text-white border-[#0F2744] font-semibold'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Mulai Tayang *
                  </label>
                  <input
                    type="date"
                    required
                    value={greetingForm.start_date}
                    onChange={(e) =>
                      setGreetingForm({ ...greetingForm, start_date: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Selesai Tayang *
                  </label>
                  <input
                    type="date"
                    required
                    value={greetingForm.end_date}
                    onChange={(e) =>
                      setGreetingForm({ ...greetingForm, end_date: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={greetingForm.is_pinned}
                    onChange={(e) =>
                      setGreetingForm({ ...greetingForm, is_pinned: e.target.checked })
                    }
                  />
                  Sematkan langsung di banner paling atas (tampil seketika)
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={greetingForm.is_active}
                    onChange={(e) =>
                      setGreetingForm({ ...greetingForm, is_active: e.target.checked })
                    }
                  />
                  Status Aktif
                </label>
              </div>

              {/* Miniature Preview inside modal */}
              <div className={`rounded-lg border border-slate-200 p-3.5 ${modalPreviewMeta.bg} space-y-1`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${modalPreviewMeta.kicker}`}>
                  Pratinjau Tampilan Banner Atas Web
                </p>
                <p className={`text-sm font-semibold ${modalPreviewMeta.title}`}>
                  {greetingForm.moment_title || 'Judul Momen / Peringatan'}
                </p>
                <p className={`text-xs ${modalPreviewMeta.body}`}>
                  &ldquo;{greetingForm.greeting_text || 'Kalimat ucapan resmi Pemerintah Desa akan tampil di sini.'}&rdquo;{' '}
                  <span className={`font-semibold ${modalPreviewMeta.sender}`}>
                    — {greetingForm.sender_label || 'Pemerintah Desa Margamukti'}
                  </span>
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGreetingModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
                >
                  Simpan Ucapan Desa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: TAMBAH / EDIT HARI BESAR KALENDER INDONESIA
          =================================================================== */}
      {holidayModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-lg w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-[#0F2744]">
                {editingHoliday ? 'Edit Data Hari Besar Kalender' : 'Tambah Hari Besar / Peringatan'}
              </h3>
              <button
                type="button"
                onClick={() => setHolidayModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 cursor-pointer"
                aria-label="Tutup modal hari besar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Peringatan *
                  </label>
                  <input
                    type="date"
                    required
                    value={holidayForm.holiday_date}
                    onChange={(e) =>
                      setHolidayForm({ ...holidayForm, holiday_date: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Hari Besar *
                  </label>
                  <select
                    value={holidayForm.category}
                    onChange={(e) => {
                      const nextCat = e.target.value as HolidayCategory;
                      setHolidayForm({
                        ...holidayForm,
                        category: nextCat,
                        is_official_holiday:
                          nextCat === 'libur_nasional' || nextCat === 'cuti_bersama',
                      });
                    }}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Hari Besar / Peringatan *
                </label>
                <input
                  required
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  placeholder="Contoh: Milangkala Desa Margamukti / Cuti Bersama Tambahan"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan Singkat / Dasar Ketetapan
                </label>
                <textarea
                  rows={2}
                  value={holidayForm.description}
                  onChange={(e) =>
                    setHolidayForm({ ...holidayForm, description: e.target.value })
                  }
                  placeholder="Contoh: Berdasarkan SKB 3 Menteri atau Peraturan Daerah Kabupaten Sumedang."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ucapan Bawaan Pemerintah Desa (Otomatis Muncul Saat Hari-H)
                </label>
                <textarea
                  rows={3}
                  value={holidayForm.default_greeting}
                  onChange={(e) =>
                    setHolidayForm({ ...holidayForm, default_greeting: e.target.value })
                  }
                  placeholder="Contoh: Pemerintah Desa Margamukti mengucapkan Selamat..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={holidayForm.is_annual}
                    onChange={(e) =>
                      setHolidayForm({ ...holidayForm, is_annual: e.target.checked })
                    }
                  />
                  Berulang setiap tahun pada tanggal &amp; bulan yang sama (Tanggal Tetap Masehi)
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={holidayForm.is_official_holiday}
                    onChange={(e) =>
                      setHolidayForm({ ...holidayForm, is_official_holiday: e.target.checked })
                    }
                  />
                  Tandai sebagai Tanggal Merah / Libur Nasional Resmi di Kalender
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={holidayForm.is_active}
                    onChange={(e) =>
                      setHolidayForm({ ...holidayForm, is_active: e.target.checked })
                    }
                  />
                  Tampilkan di Kalender Publik
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setHolidayModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
                >
                  Simpan Hari Besar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: TAMBAH / EDIT AGENDA RUNNING TEXT
          =================================================================== */}
      {eventModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-lg w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-[#0F2744]">
                {editingEvent ? 'Edit Agenda Kegiatan Desa' : 'Tambah Agenda Kegiatan Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 cursor-pointer"
                aria-label="Tutup modal agenda"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Acara / Kegiatan *
                </label>
                <input
                  required
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="Contoh: Musrenbangdes Penyusunan RKPDes 2027"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Waktu Pelaksanaan (Hari, Tanggal &amp; Jam) *
                </label>
                <input
                  required
                  value={eventForm.event_time}
                  onChange={(e) => setEventForm({ ...eventForm, event_time: e.target.value })}
                  placeholder="Contoh: Kamis, 21 Nov 2026 · 09.00 WIB"
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tempat / Lokasi Kegiatan *
                </label>
                <input
                  required
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  placeholder="Contoh: Aula Balai Desa Margamukti"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Urutan Tampil
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={eventForm.sort_order}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, sort_order: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 pt-5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventForm.is_active}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, is_active: e.target.checked })
                    }
                  />
                  Tampilkan di Running Text
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
                >
                  Simpan Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
