import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Mail, MapPin, Navigation, Phone, Search, Send } from 'lucide-react';
import { LeafletMap } from '../../components/LeafletMap';
import type {
  MapLocation,
  MapMarkerItem,
  Region,
  VillageDevelopment,
  VillageSettings,
} from '../../types';

interface MapContactPageProps {
  initialMarkerId?: string | null;
}

export function MapContactPage({ initialMarkerId = null }: MapContactPageProps) {
  const [settings, setSettings] = useState<VillageSettings | null>(null);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [developments, setDevelopments] = useState<VillageDevelopment[]>([]);
  const [catFilter, setCatFilter] = useState('Semua');
  const [listQuery, setListQuery] = useState('');
  const [selectedLocId, setSelectedLocId] = useState<string | null>(initialMarkerId);

  const [form, setForm] = useState({
    sender_name: '',
    sender_contact: '',
    category: 'Pengaduan',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [sendErr, setSendErr] = useState('');

  useEffect(() => {
    fetch('/api/public/map')
      .then((r) => r.json())
      .then((json) => {
        setSettings(json.settings);
        setLocations(json.locations || []);
        setRegions(json.regions || []);
        setDevelopments(json.developments || []);
      });
  }, []);

  useEffect(() => {
    if (initialMarkerId) {
      setCatFilter('Semua');
      setSelectedLocId(initialMarkerId);
    }
  }, [initialMarkerId]);

  const allMarkers: MapMarkerItem[] = useMemo(() => {
    const locMarkers: MapMarkerItem[] = locations.map((l) => ({
      ...l,
      id: `loc-${l.id}`,
      sourceType: 'location',
    }));

    const regMarkers: MapMarkerItem[] = regions
      .filter((r) => r.latitude !== null && r.longitude !== null)
      .map((r) => ({
        id: `region-${r.id}`,
        name: `${r.blok} · RT ${r.rt} / RW ${r.rw}`,
        category: 'Wilayah Dusun / RT / RW',
        description: `${r.dusun}`,
        address: `${r.dusun}, Desa Margamukti`,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        sourceType: 'region',
        leaders: {
          kepala_dusun: r.kepala_dusun || '-',
          ketua_rw: r.ketua_rw || '-',
          ketua_rt: r.ketua_rt || '-',
        },
      }));

    const devMarkers: MapMarkerItem[] = developments
      .filter((d) => d.latitude !== null && d.longitude !== null)
      .map((d) => ({
        id: `dev-${d.id}`,
        name: `${d.name} (${d.progress_percent}%)`,
        category: 'Pembangunan Desa',
        description: `TA ${d.fiscal_year} · ${d.funding_source} · Anggaran Rp ${Number(
          d.budget_amount || 0
        ).toLocaleString('id-ID')} · Vol: ${d.volume} · Pelaksana: ${d.executor}`,
        address: d.location_region,
        latitude: Number(d.latitude),
        longitude: Number(d.longitude),
        sourceType: 'location',
      }));

    return [...locMarkers, ...devMarkers, ...regMarkers];
  }, [locations, developments, regions]);

  const categories = useMemo(
    () => ['Semua', ...Array.from(new Set(allMarkers.map((l) => l.category)))],
    [allMarkers]
  );

  const filteredLocations = useMemo(() => {
    const byCategory =
      catFilter === 'Semua' ? allMarkers : allMarkers.filter((l) => l.category === catFilter);
    const q = listQuery.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory.filter((l) => {
      const hay = [
        l.name,
        l.category,
        l.description,
        l.address,
        l.leaders?.kepala_dusun || '',
        l.leaders?.ketua_rw || '',
        l.leaders?.ketua_rt || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [allMarkers, catFilter, listQuery]);

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendErr('');
    setSentOk(false);
    try {
      const res = await fetch('/api/public/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setSendErr(json.error || 'Gagal mengirim pesan.');
        return;
      }
      setSentOk(true);
      setForm({ sender_name: '', sender_contact: '', category: 'Pengaduan', subject: '', message: '' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Section 1: Peta Wilayah Interaktif */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
              Geografis, Wilayah & Fasilitas Umum
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--theme-primary)] mt-1">
              Peta Interaktif Desa Margamukti
            </h1>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 max-w-full">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCatFilter(cat);
                  setSelectedLocId(null);
                }}
                className={`px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  catFilter === cat
                    ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8">
            <LeafletMap
              centerLat={settings?.map_center_lat || -6.8283}
              centerLng={settings?.map_center_lng || 107.9}
              locations={filteredLocations}
              selectedLocationId={selectedLocId}
              onSelectLocation={(loc) => setSelectedLocId(String(loc.id))}
              onResetView={() => {
                setSelectedLocId(null);
                setListQuery('');
                setCatFilter('Semua');
              }}
              heightClass="h-[340px] sm:h-[460px]"
            />
          </div>

          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[420px] lg:max-h-[560px] overflow-y-auto">
            <div className="p-4 bg-slate-50 border-b border-slate-200 sticky top-0 space-y-2.5 z-10">
              <div>
                <h2 className="text-sm font-semibold text-[var(--theme-primary)]">
                  Daftar Titik Lokasi &amp; Wilayah ({filteredLocations.length})
                </h2>
                <p className="text-xs text-slate-500">Klik item untuk menyorot titik &amp; membuka tombol rute</p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                  placeholder="Saring nama fasilitas, dusun, RT/RW..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                />
              </div>
            </div>
            {filteredLocations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Tidak ada titik lokasi desa yang cocok dengan kata kunci &ldquo;{listQuery}&rdquo;.
              </div>
            ) : (
              filteredLocations.map((loc) => {
                const active = selectedLocId === String(loc.id);
                return (
                  <div
                    key={String(loc.id)}
                    onClick={() => setSelectedLocId(String(loc.id))}
                    className={`w-full text-left p-4 transition-colors cursor-pointer ${
                      active ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs mb-1">
                      <span className="font-semibold text-[var(--theme-accent-dark)] truncate">{loc.category}</span>
                      <span className="font-mono-tabular text-slate-400 shrink-0">
                        {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{loc.name}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{loc.address}</p>
                    {loc.leaders && (
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        Kadus: {loc.leaders.kepala_dusun} · RW: {loc.leaders.ketua_rw} · RT: {loc.leaders.ketua_rt}
                      </p>
                    )}
                    {active && (
                      <div
                        className="mt-2.5 pt-2 border-t border-slate-200 flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={`https://www.openstreetmap.org/directions?to=${loc.latitude.toFixed(6)}%2C${loc.longitude.toFixed(6)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md whitespace-nowrap"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Rute OSM</span>
                        </a>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude.toFixed(6)},${loc.longitude.toFixed(6)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[var(--theme-primary)] bg-white border border-slate-300 hover:border-[var(--theme-primary)] rounded-md whitespace-nowrap"
                        >
                          <span>Google Maps</span>
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Section 2: Kontak Kantor Desa & Formulir Pengaduan Warga */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4 border-t border-slate-200">
        <div className="lg:col-span-5 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
              Kontak Resmi
            </p>
            <h2 className="text-2xl font-semibold text-[var(--theme-primary)] mt-1">
              Kantor Pemerintah Desa Margamukti
            </h2>
          </div>

          {settings && (
            <div className="bg-[var(--theme-primary)] text-white rounded-xl p-6 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[var(--theme-accent-light)] shrink-0 mt-1" />
                <div>
                  <p className="text-xs text-slate-300">Alamat Kantor</p>
                  <p className="font-medium mt-0.5 leading-relaxed">{settings.office_address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[var(--theme-accent-light)] shrink-0 mt-1" />
                <div>
                  <p className="text-xs text-slate-300">Telepon & WhatsApp Layanan</p>
                  <p className="font-mono-tabular font-medium mt-0.5">{settings.phone}</p>
                  <a
                    href={`https://wa.me/${settings.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-[var(--theme-accent-light)] underline mt-1"
                  >
                    Chat WhatsApp Kantor Desa
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[var(--theme-accent-light)] shrink-0 mt-1" />
                <div>
                  <p className="text-xs text-slate-300">Email Resmi</p>
                  <p className="font-medium mt-0.5">{settings.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[var(--theme-accent-light)] shrink-0 mt-1" />
                <div>
                  <p className="text-xs text-slate-300">Jam Operasional Pelayanan</p>
                  <p className="font-medium mt-0.5">{settings.service_hours}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-[var(--theme-primary)]">
              Layanan Aspirasi & Pengaduan Warga
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Sampaikan masukan, pertanyaan, atau laporan infrastruktur langsung ke kotak masuk Pemerintah Desa.
            </p>
          </div>

          {sentOk && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-xs text-emerald-800 font-medium">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Terima kasih! Pesan/pengaduan Anda telah diterima dan tercatat di sistem desa.</span>
            </div>
          )}

          {sendErr && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
              {sendErr}
            </div>
          )}

          <form onSubmit={handleComplaintSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={form.sender_name}
                  onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                  placeholder="Nama Anda"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  No. HP / WhatsApp / Email *
                </label>
                <input
                  type="text"
                  required
                  value={form.sender_contact}
                  onChange={(e) => setForm({ ...form, sender_contact: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori Pesan
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:border-[var(--theme-primary)]"
                >
                  <option value="Pengaduan">Pengaduan</option>
                  <option value="Infrastruktur">Infrastruktur</option>
                  <option value="Layanan Publik">Layanan Publik</option>
                  <option value="Aspirasi">Aspirasi & Usulan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subjek / Judul Pesan *
                </label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Ringkasan topik pesan"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Isi Pesan / Pengaduan *
              </label>
              <textarea
                rows={4}
                required
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Tuliskan lokasi RT/RW serta detail aspirasi atau pengaduan Anda..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md transition-colors disabled:opacity-60 cursor-pointer"
              >
                <Send className="w-4 h-4 text-[var(--theme-accent-light)]" />
                {sending ? 'Mengirim...' : 'Kirim Pesan Warga'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
