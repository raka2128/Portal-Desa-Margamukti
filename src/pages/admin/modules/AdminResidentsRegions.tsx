import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileText,
  MapPin,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  UserMinus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { BackupArchiveModal } from '../../../components/BackupArchiveModal';
import { KartuKeluargaModal } from '../../../components/KartuKeluargaModal';
import { LeafletMap } from '../../../components/LeafletMap';
import { ResidentAggregateReportModal } from '../../../components/ResidentAggregateReportModal';
import {
  ResidentDeleteDeathModal,
  type DeleteDeathModalMode,
} from '../../../components/ResidentDeleteDeathModal';
import { ResidentExportPrintModal } from '../../../components/ResidentExportPrintModal';
import {
  EDUCATION_OPTIONS,
  FAMILY_RELATIONSHIP_OPTIONS,
  PHYSICAL_DISABILITY_OPTIONS,
  sortFamilyMembers,
} from '../../../constants/residentOptions';
import { adminFetch } from '../../../utils/adminApi';
import { downloadBlobFile } from '../../../utils/mobileDownload';
import type {
  MapMarkerItem,
  Region,
  Resident,
  ResidentMutationLog,
  ResidentMutationStatus,
  User,
  VillageSettings,
} from '../../../types';

interface NotifyProps {
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

// ============================================================================
// 1. MANAJEMEN WILAYAH (DUSUN, BLOK, RW, RT + PENGURUS & KOORDINAT PETA)
// ============================================================================

export function AdminRegionsModule({ onNotify }: NotifyProps) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [dusunFilter, setDusunFilter] = useState('Semua');
  const [mapCenter, setMapCenter] = useState({ lat: -6.8283, lng: 107.9 });
  const [facilityMarkers, setFacilityMarkers] = useState<MapMarkerItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    dusun: 'Dusun Pawenang',
    kepala_dusun: 'Oman Abdurahman',
    kepala_dusun_phone: '',
    blok: '',
    rw: '01',
    rt: '01',
    ketua_rw: '',
    ketua_rw_phone: '',
    ketua_rt: '',
    ketua_rt_phone: '',
    latitude: '-6.8283',
    longitude: '107.9000',
  });

  const load = () => {
    adminFetch('/api/admin/regions')
      .then((r) => r.json())
      .then((j) => setRegions(j.regions || []));
  };

  useEffect(() => {
    load();
    fetch('/api/public/map')
      .then((r) => r.json())
      .then((j) => {
        if (j.settings?.map_center_lat && j.settings?.map_center_lng) {
          setMapCenter({
            lat: Number(j.settings.map_center_lat),
            lng: Number(j.settings.map_center_lng),
          });
        }
        const locs = Array.isArray(j.locations) ? j.locations : [];
        setFacilityMarkers(
          locs.map((l: MapMarkerItem) => ({
            ...l,
            id: `fac-${l.id}`,
          }))
        );
      })
      .catch(() => {});
  }, []);

  const existingDusunList = useMemo(
    () => Array.from(new Set(regions.map((r) => r.dusun).filter(Boolean))),
    [regions]
  );

  const dusunFilterOptions = ['Semua', ...existingDusunList];
  const filteredRegions =
    dusunFilter === 'Semua' ? regions : regions.filter((r) => r.dusun === dusunFilter);

  const openNew = () => {
    setEditingId(null);
    const defaultDusun = existingDusunList[0] || 'Dusun Pawenang';
    const matchDusun = regions.find((r) => r.dusun === defaultDusun);
    setForm({
      dusun: defaultDusun,
      kepala_dusun: matchDusun?.kepala_dusun || '',
      kepala_dusun_phone: matchDusun?.kepala_dusun_phone || '',
      blok: '',
      rw: '01',
      rt: '01',
      ketua_rw: '',
      ketua_rw_phone: '',
      ketua_rt: '',
      ketua_rt_phone: '',
      latitude: String(mapCenter.lat),
      longitude: String(mapCenter.lng),
    });
    setModalOpen(true);
  };

  const openEdit = (r: Region) => {
    setEditingId(r.id);
    setForm({
      dusun: r.dusun,
      kepala_dusun: r.kepala_dusun || '',
      kepala_dusun_phone: r.kepala_dusun_phone || '',
      blok: r.blok,
      rw: r.rw,
      rt: r.rt,
      ketua_rw: r.ketua_rw,
      ketua_rw_phone: r.ketua_rw_phone || '',
      ketua_rt: r.ketua_rt,
      ketua_rt_phone: r.ketua_rt_phone || '',
      latitude: r.latitude !== null && r.latitude !== undefined ? String(r.latitude) : '',
      longitude: r.longitude !== null && r.longitude !== undefined ? String(r.longitude) : '',
    });
    setModalOpen(true);
  };

  const handleDusunChange = (nextDusun: string) => {
    const matchedDusun = regions.find(
      (r) => r.dusun.toLowerCase() === nextDusun.trim().toLowerCase() && r.kepala_dusun && r.kepala_dusun !== '-'
    );
    setForm((prev) => ({
      ...prev,
      dusun: nextDusun,
      kepala_dusun: matchedDusun ? matchedDusun.kepala_dusun : prev.kepala_dusun,
      kepala_dusun_phone: matchedDusun?.kepala_dusun_phone || prev.kepala_dusun_phone,
    }));
  };

  const handleRwChange = (nextRw: string) => {
    const matchedRw = regions.find(
      (r) =>
        r.dusun.toLowerCase() === form.dusun.trim().toLowerCase() &&
        r.rw.trim() === nextRw.trim() &&
        r.ketua_rw &&
        r.ketua_rw !== '-'
    );
    setForm((prev) => ({
      ...prev,
      rw: nextRw,
      ketua_rw: matchedRw ? matchedRw.ketua_rw : prev.ketua_rw,
      ketua_rw_phone: matchedRw?.ketua_rw_phone || prev.ketua_rw_phone,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasLat = form.latitude.trim() !== '';
    const hasLng = form.longitude.trim() !== '';
    if (hasLat !== hasLng) {
      onNotify('Latitude dan Longitude harus diisi keduanya atau dikosongkan keduanya.', 'err');
      return;
    }

    const payload = {
      dusun: form.dusun.trim(),
      kepala_dusun: form.kepala_dusun.trim() || '-',
      kepala_dusun_phone: form.kepala_dusun_phone.trim(),
      blok: form.blok.trim(),
      rw: form.rw.trim(),
      rt: form.rt.trim(),
      ketua_rw: form.ketua_rw.trim() || '-',
      ketua_rw_phone: form.ketua_rw_phone.trim(),
      ketua_rt: form.ketua_rt.trim() || '-',
      ketua_rt_phone: form.ketua_rt_phone.trim(),
      latitude: hasLat ? Number(form.latitude) : null,
      longitude: hasLng ? Number(form.longitude) : null,
    };

    const url = editingId ? `/api/admin/regions/${editingId}` : '/api/admin/regions';
    const method = editingId ? 'PUT' : 'POST';
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      onNotify(json.error || 'Gagal menyimpan data wilayah.', 'err');
      return;
    }
    setModalOpen(false);
    load();
    onNotify('Data wilayah, pengurus, dan koordinat berhasil disimpan.');
  };

  const handleDelete = async (id: number) => {
    await adminFetch(`/api/admin/regions/${id}`, { method: 'DELETE' });
    load();
    onNotify('Data wilayah dihapus.');
  };

  const parsedPickedCoords = (() => {
    if (!form.latitude.trim() || !form.longitude.trim()) return null;
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  })();

  const existingRegionMarkers: MapMarkerItem[] = useMemo(
    () =>
      regions
        .filter((r) => r.latitude !== null && r.longitude !== null && r.id !== editingId)
        .map((r) => ({
          id: `reg-${r.id}`,
          name: `${r.blok} (RT ${r.rt} / RW ${r.rw})`,
          category: 'Wilayah Dusun / RT / RW',
          description: r.dusun,
          address: `${r.dusun}, Desa Margamukti`,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          sourceType: 'region',
          leaders: {
            kepala_dusun: r.kepala_dusun,
            ketua_rw: r.ketua_rw,
            ketua_rt: r.ketua_rt,
          },
        })),
    [regions, editingId]
  );

  const combinedPickerMarkers = useMemo(
    () => [...facilityMarkers, ...existingRegionMarkers],
    [facilityMarkers, existingRegionMarkers]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">Manajemen Wilayah, Pengurus & Koordinat Peta</h2>
          <p className="text-xs text-slate-500">
            Kelola hierarki Dusun, Blok/Kampung, RW, RT, pengurus (Kepala Dusun, Ketua RW, Ketua RT), serta titik koordinat peta.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" /> Tambah Wilayah &amp; Pengurus
        </button>
      </div>

      {existingDusunList.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {dusunFilterOptions.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDusunFilter(d)}
              className={`px-3 py-2 min-h-[40px] text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                dusunFilter === d
                  ? 'bg-[#0F2744] text-white border-[#0F2744]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Mobile Cards (< md) */}
      <div className="md:hidden space-y-3">
        {filteredRegions.map((r) => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-[#0F2744]">{r.dusun}</p>
                <p className="text-xs text-slate-600">{r.blok}</p>
              </div>
              <span className="font-mono-tabular text-xs font-bold text-[#0F2744] bg-slate-100 px-2.5 py-1 rounded shrink-0">
                RT {r.rt} / RW {r.rw}
              </span>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2.5 space-y-1">
              <p>
                <span className="text-slate-500">Kadus:</span>{' '}
                <span className="font-medium text-slate-800">{r.kepala_dusun || '-'}</span>
                {r.kepala_dusun_phone && (
                  <span className="font-mono-tabular text-[11px] text-slate-500"> · {r.kepala_dusun_phone}</span>
                )}
              </p>
              <p>
                <span className="text-slate-500">Ketua RW:</span>{' '}
                <span className="font-medium text-slate-800">{r.ketua_rw || '-'}</span>
                {r.ketua_rw_phone && (
                  <span className="font-mono-tabular text-[11px] text-slate-500"> ({r.ketua_rw_phone})</span>
                )}
              </p>
              <p>
                <span className="text-slate-500">Ketua RT:</span>{' '}
                <span className="font-medium text-slate-800">{r.ketua_rt || '-'}</span>
                {r.ketua_rt_phone && (
                  <span className="font-mono-tabular text-[11px] text-slate-500"> ({r.ketua_rt_phone})</span>
                )}
              </p>
              <p className="font-mono-tabular text-[11px]">
                {r.latitude !== null && r.longitude !== null ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}
                  </span>
                ) : (
                  <span className="text-slate-400">Koordinat belum ditandai</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => openEdit(r)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Wilayah
              </button>
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-600 hover:text-red-600 border border-slate-200 rounded-md cursor-pointer"
                aria-label="Hapus Wilayah"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {filteredRegions.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
            Belum ada data wilayah untuk filter ini.
          </div>
        )}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Dusun & Kepala Dusun</th>
                <th className="py-3 px-4">Blok / Kampung</th>
                <th className="py-3 px-4">RW & Ketua RW</th>
                <th className="py-3 px-4">RT & Ketua RT</th>
                <th className="py-3 px-4">Koordinat Maps</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredRegions.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <p className="font-medium text-[#0F2744]">{r.dusun}</p>
                    <p className="text-xs text-slate-500">Kadus: {r.kepala_dusun || '-'}</p>
                    <p className="text-[11px] font-mono-tabular text-slate-400">
                      {r.kepala_dusun_phone ? `WA: ${r.kepala_dusun_phone}` : 'WA Kadus belum diisi'}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{r.blok}</td>
                  <td className="py-3 px-4">
                    <p className="font-mono-tabular font-semibold text-[#0F2744]">RW {r.rw}</p>
                    <p className="text-xs text-slate-600">{r.ketua_rw || '-'}</p>
                    <p className="text-[11px] font-mono-tabular text-slate-400">
                      {r.ketua_rw_phone ? `WA: ${r.ketua_rw_phone}` : 'WA belum diisi'}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono-tabular font-semibold text-[#0F2744]">RT {r.rt}</p>
                    <p className="text-xs text-slate-600">{r.ketua_rt || '-'}</p>
                    <p className="text-[11px] font-mono-tabular text-slate-400">
                      {r.ketua_rt_phone ? `WA: ${r.ketua_rt_phone}` : 'WA belum diisi'}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {r.latitude !== null && r.longitude !== null ? (
                      <span className="inline-flex items-center gap-1 font-mono-tabular text-emerald-700">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-slate-400">Belum ditandai</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="p-1.5 text-slate-600 hover:text-[#0F2744] cursor-pointer"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="p-1.5 text-slate-600 hover:text-red-600 ml-1 cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRegions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    Belum ada data wilayah untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-5xl w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 space-y-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="min-w-0 pr-2">
                <h3 className="text-base font-semibold text-[#0F2744]">
                  {editingId ? 'Edit Wilayah, Pengurus & Koordinat Peta' : 'Tambah Wilayah Dusun / RW / RT'}
                </h3>
                <p className="text-xs text-slate-500">
                  Lengkapi data Kepala Dusun, Ketua RW, Ketua RT, lalu klik peta atau ketik koordinat lokasi wilayah.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
                aria-label="Tutup modal wilayah"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Dusun *</label>
                    <input
                      required
                      list="dusun-suggestions"
                      value={form.dusun}
                      onChange={(e) => handleDusunChange(e.target.value)}
                      placeholder="Contoh: Dusun Pawenang"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                    <datalist id="dusun-suggestions">
                      {existingDusunList.map((d) => (
                        <option key={d} value={d} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Kepala Dusun *</label>
                    <input
                      required
                      value={form.kepala_dusun}
                      onChange={(e) => setForm({ ...form, kepala_dusun: e.target.value })}
                      placeholder="Contoh: Oman Abdurahman"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      No. WhatsApp Kepala Dusun <span className="font-normal text-slate-400">(Sinkron se-Dusun)</span>
                    </label>
                    <input
                      value={form.kepala_dusun_phone}
                      onChange={(e) => setForm({ ...form, kepala_dusun_phone: e.target.value })}
                      placeholder="Contoh: 081220458806"
                      className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Blok / Kampung *</label>
                  <input
                    required
                    value={form.blok}
                    onChange={(e) => setForm({ ...form, blok: e.target.value })}
                    placeholder="Contoh: Blok Kebonkalapa"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor RW *</label>
                    <input
                      required
                      value={form.rw}
                      onChange={(e) => handleRwChange(e.target.value)}
                      placeholder="01"
                      className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Ketua RW *</label>
                    <input
                      required
                      value={form.ketua_rw}
                      onChange={(e) => setForm({ ...form, ketua_rw: e.target.value })}
                      placeholder="Nama Ketua RW"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">No. WA Ketua RW</label>
                    <input
                      value={form.ketua_rw_phone}
                      onChange={(e) => setForm({ ...form, ketua_rw_phone: e.target.value })}
                      placeholder="0812..."
                      className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor RT *</label>
                    <input
                      required
                      value={form.rt}
                      onChange={(e) => setForm({ ...form, rt: e.target.value })}
                      placeholder="01"
                      className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Ketua RT *</label>
                    <input
                      required
                      value={form.ketua_rt}
                      onChange={(e) => setForm({ ...form, ketua_rt: e.target.value })}
                      placeholder="Nama Ketua RT"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">No. WA Ketua RT</label>
                    <input
                      value={form.ketua_rt_phone}
                      onChange={(e) => setForm({ ...form, ketua_rt_phone: e.target.value })}
                      placeholder="0812..."
                      className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#0F2744]">Koordinat Maps (Opsional / Klik Peta)</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            latitude: String(mapCenter.lat),
                            longitude: String(mapCenter.lng),
                          }))
                        }
                        className="text-xs font-semibold text-[#0F2744] hover:underline cursor-pointer"
                      >
                        Pusat Desa
                      </button>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, latitude: '', longitude: '' }))}
                        className="text-xs text-slate-500 hover:text-red-600 cursor-pointer"
                      >
                        Kosongkan
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={form.latitude}
                        onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                        placeholder="-6.8283"
                        className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={form.longitude}
                        onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                        placeholder="107.9000"
                        className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
                  >
                    Simpan Wilayah & Koordinat
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 space-y-2">
                <LeafletMap
                  centerLat={parsedPickedCoords?.lat ?? mapCenter.lat}
                  centerLng={parsedPickedCoords?.lng ?? mapCenter.lng}
                  locations={combinedPickerMarkers}
                  pickerMode={true}
                  pickedCoords={parsedPickedCoords}
                  onPickCoords={(c) =>
                    setForm((prev) => ({
                      ...prev,
                      latitude: String(c.lat),
                      longitude: String(c.lng),
                    }))
                  }
                  heightClass="h-[360px]"
                />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Titik wilayah dan fasilitas yang sudah terdaftar turut tampil sebagai panduan letak geografis saat Anda menandai koordinat RT/RW/Dusun baru.
                </p>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. MANAJEMEN PENDUDUK & MUTASI WARGA (+ EKSPOR & IMPOR EXCEL)
// ============================================================================

const RESIDENT_STATUS_META: Array<{
  key: ResidentMutationStatus;
  label: string;
  shortLabel: string;
  dotColor: string;
  textColor: string;
}> = [
  { key: 'aktif', label: 'Penduduk Aktif', shortLabel: 'Aktif', dotColor: 'bg-emerald-600', textColor: 'text-emerald-800' },
  { key: 'lahir', label: 'Bayi Baru Lahir', shortLabel: 'Baru Lahir', dotColor: 'bg-sky-600', textColor: 'text-sky-800' },
  { key: 'pindah_masuk', label: 'Pindah Masuk ke Desa', shortLabel: 'Pindah Masuk', dotColor: 'bg-indigo-600', textColor: 'text-indigo-800' },
  { key: 'pindah_keluar', label: 'Pindah ke Luar Desa', shortLabel: 'Pindah Keluar', dotColor: 'bg-amber-600', textColor: 'text-amber-800' },
  { key: 'meninggal', label: 'Meninggal Dunia', shortLabel: 'Meninggal', dotColor: 'bg-slate-600', textColor: 'text-slate-700' },
];

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdminResidentsModule({
  onNotify,
  currentUser,
  initialTab,
  refreshTrigger,
  onMutationQueueChange,
}: NotifyProps & {
  currentUser?: User;
  initialTab?: 'list' | 'verification';
  refreshTrigger?: number;
  onMutationQueueChange?: () => void;
}) {
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isRtRw = currentUser?.role === 'ketua_rt' || currentUser?.role === 'ketua_rw';

  const [activeTab, setActiveTab] = useState<'list' | 'kk' | 'verification'>(
    isSuperAdmin && initialTab === 'verification' ? 'verification' : 'list'
  );
  const [residents, setResidents] = useState<Resident[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [mutationLogs, setMutationLogs] = useState<ResidentMutationLog[]>([]);
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const [logStatusFilter, setLogStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [rejectTarget, setRejectTarget] = useState<ResidentMutationLog | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [verifyingLogId, setVerifyingLogId] = useState<number | null>(null);
  const [settings, setSettings] = useState<VillageSettings | null>(null);
  const [query, setQuery] = useState('');
  const [kkSearch, setKkSearch] = useState('');
  const [dusunFilter, setDusunFilter] = useState('Semua');
  const [statusFilter, setStatusFilter] = useState<'Semua' | ResidentMutationStatus>('Semua');
  const [modalOpen, setModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [aggregateModalOpen, setAggregateModalOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [kkModalNoKk, setKkModalNoKk] = useState<string | null>(null);
  const [deleteModalState, setDeleteModalState] = useState<{
    resident: Resident;
    mode: DeleteDeathModalMode;
  } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    nik: '',
    no_kk: '',
    full_name: '',
    family_relationship: 'Kepala keluarga',
    birth_place: 'Sumedang',
    birth_date: '1990-01-01',
    gender: 'Laki-laki' as 'Laki-laki' | 'Perempuan',
    address: '',
    region_id: '' as string | number,
    religion: 'Islam',
    education: 'SLTA/Sederajat',
    occupation: '',
    marital_status: 'Kawin',
    physical_disability: 'Tidak Ada',
    father_name: '',
    mother_name: '',
    resident_status: 'aktif' as ResidentMutationStatus,
    mutation_date: '',
    mutation_notes: '',
  });

  useEffect(() => {
    if (isSuperAdmin && initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isSuperAdmin]);

  const load = () => {
    const requests: Promise<unknown>[] = [
      adminFetch('/api/admin/residents').then((r) => r.json()),
      adminFetch('/api/admin/regions').then((r) => r.json()),
      fetch('/api/public/profile').then((r) => r.json()),
    ];
    if (isSuperAdmin) {
      requests.push(adminFetch('/api/admin/resident-mutations?status=all').then((r) => r.json()));
    }
    Promise.all(requests).then(([resJson, regJson, profJson, mutJson]) => {
      const rData = resJson as { residents?: Resident[] };
      const gData = regJson as { regions?: Region[] };
      const pData = profJson as { settings?: VillageSettings };
      setResidents(rData.residents || []);
      setRegions(gData.regions || []);
      if (pData?.settings) {
        setSettings(pData.settings);
      }
      if (isSuperAdmin && mutJson) {
        const mData = mutJson as { logs?: ResidentMutationLog[]; pendingCount?: number };
        setMutationLogs(mData.logs || []);
        setPendingMutationCount(typeof mData.pendingCount === 'number' ? mData.pendingCount : 0);
      }
    });
  };

  useEffect(load, [isSuperAdmin, refreshTrigger]);

  const openNew = (presetStatus: ResidentMutationStatus = 'aktif') => {
    const today = getTodayIso();
    const defaultRegion = regions[0];
    setEditingId(null);
    setForm({
      nik: '',
      no_kk: '',
      full_name: '',
      family_relationship: presetStatus === 'lahir' ? 'Anak' : 'Kepala keluarga',
      birth_place: 'Sumedang',
      birth_date: presetStatus === 'lahir' ? today : '1990-01-01',
      gender: 'Laki-laki',
      address: defaultRegion
        ? `${defaultRegion.blok} RT ${defaultRegion.rt} RW ${defaultRegion.rw}, ${defaultRegion.dusun}`
        : '',
      region_id: defaultRegion?.id || '',
      religion: 'Islam',
      education: presetStatus === 'lahir' ? 'Belum tamat SD/Sederajat' : 'SLTA/Sederajat',
      occupation: presetStatus === 'lahir' ? 'Belum Bekerja' : '',
      marital_status: presetStatus === 'lahir' ? 'Belum Kawin' : 'Kawin',
      physical_disability: 'Tidak Ada',
      father_name: '',
      mother_name: '',
      resident_status: presetStatus,
      mutation_date: presetStatus === 'aktif' ? '' : today,
      mutation_notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (r: Resident) => {
    setEditingId(r.id);
    setForm({
      nik: r.nik,
      no_kk: r.no_kk,
      full_name: r.full_name,
      family_relationship: r.family_relationship || 'Kepala keluarga',
      birth_place: r.birth_place,
      birth_date: r.birth_date,
      gender: r.gender,
      address: r.address,
      region_id: r.region_id || regions[0]?.id || '',
      religion: r.religion,
      education: r.education || 'SLTA/Sederajat',
      occupation: r.occupation,
      marital_status: r.marital_status,
      physical_disability: r.physical_disability || 'Tidak Ada',
      father_name: r.father_name || '',
      mother_name: r.mother_name || '',
      resident_status: r.resident_status || 'aktif',
      mutation_date: r.mutation_date || '',
      mutation_notes: r.mutation_notes || '',
    });
    setModalOpen(true);
  };

  const handleStatusChange = (nextStatus: ResidentMutationStatus) => {
    const today = getTodayIso();
    setForm((prev) => ({
      ...prev,
      resident_status: nextStatus,
      mutation_date: nextStatus === 'aktif' ? '' : prev.mutation_date || today,
      birth_date: !editingId && nextStatus === 'lahir' ? today : prev.birth_date,
      marital_status: !editingId && nextStatus === 'lahir' ? 'Belum Kawin' : prev.marital_status,
      occupation: !editingId && nextStatus === 'lahir' ? 'Belum Bekerja' : prev.occupation,
      family_relationship: !editingId && nextStatus === 'lahir' ? 'Anak' : prev.family_relationship,
      education: !editingId && nextStatus === 'lahir' ? 'Belum tamat SD/Sederajat' : prev.education,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/admin/residents/${editingId}` : '/api/admin/residents';
    const method = editingId ? 'PUT' : 'POST';
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      onNotify(json.error || 'Gagal menyimpan data penduduk.', 'err');
      return;
    }
    setModalOpen(false);
    load();
    onMutationQueueChange?.();
    onNotify(
      isRtRw
        ? 'Data & status kependudukan disimpan dan dikirim ke antrean verifikasi Superadmin.'
        : editingId
        ? 'Data & status kependudukan diperbarui.'
        : 'Data penduduk / mutasi berhasil disimpan.'
    );
  };

  const handleVerifyMutation = async (
    log: ResidentMutationLog,
    decision: 'approved' | 'rejected',
    note = ''
  ) => {
    setVerifyingLogId(log.id);
    try {
      const res = await adminFetch(`/api/admin/resident-mutations/${log.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || 'Gagal memproses verifikasi mutasi.', 'err');
        return;
      }
      setRejectTarget(null);
      setRejectNote('');
      load();
      onMutationQueueChange?.();
      onNotify(
        decision === 'approved'
          ? `Perubahan data ${log.resident_name} disetujui permanen.`
          : `Mutasi ${log.resident_name} ditolak dan data dikembalikan.`
      );
    } finally {
      setVerifyingLogId(null);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const fileBase64 = typeof reader.result === 'string' ? reader.result : '';
      const res = await adminFetch('/api/admin/residents/import-xlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64 }),
      });
      const json = await res.json();
      e.target.value = '';
      if (!res.ok) {
        onNotify(json.error || 'Gagal mengimpor file Excel (.xlsx).', 'err');
        return;
      }
      load();
      onNotify(
        `Impor Excel selesai: ${json.inserted} data baru, ${json.updated} diperbarui (NIK sama), ${json.skipped} dilewati.`
      );
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadBlob = async (endpoint: string, filename: string, errMsg: string) => {
    const res = await adminFetch(endpoint);
    if (!res.ok) {
      onNotify(errMsg, 'err');
      return;
    }
    const blob = await res.blob();
    await downloadBlobFile(blob, filename);
  };

  type GroupMode =
    | 'semua'
    | 'pekerjaan'
    | 'usia'
    | 'rw'
    | 'kelamin'
    | 'agama'
    | 'pendidikan'
    | 'kawin'
    | 'kelainan'
    | 'hubungan';
  const [groupBy, setGroupBy] = useState<GroupMode>('semua');
  const [selectedGroupVal, setSelectedGroupVal] = useState<string>('Semua');

  const getAgeGroup = (birthDate: string): string => {
    const dob = new Date(birthDate);
    if (Number.isNaN(dob.getTime())) return 'Tidak Diketahui';
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    if (age <= 12) return '0-12 Tahun';
    if (age <= 17) return '13-17 Tahun';
    if (age <= 30) return '18-30 Tahun';
    if (age <= 45) return '31-45 Tahun';
    if (age <= 60) return '46-60 Tahun';
    return '>60 Tahun';
  };

  const getResidentGroupValue = (r: Resident, mode: GroupMode): string => {
    if (mode === 'pekerjaan') return r.occupation || 'Lainnya';
    if (mode === 'usia') return getAgeGroup(r.birth_date);
    if (mode === 'rw') return r.rw ? `RW ${r.rw}${r.dusun ? ` (${r.dusun})` : ''}` : 'Belum Ada Wilayah';
    if (mode === 'kelamin') return r.gender;
    if (mode === 'agama') return r.religion || 'Islam';
    if (mode === 'pendidikan') return r.education || 'SLTA/Sederajat';
    if (mode === 'kawin') return r.marital_status || 'Kawin';
    if (mode === 'kelainan') return r.physical_disability || 'Tidak Ada';
    if (mode === 'hubungan') return r.family_relationship || 'Kepala keluarga';
    return 'Semua';
  };

  const statusCounts = useMemo(() => {
    const map: Record<ResidentMutationStatus, number> = {
      aktif: 0,
      lahir: 0,
      pindah_masuk: 0,
      pindah_keluar: 0,
      meninggal: 0,
    };
    for (const r of residents) {
      const st = (r.resident_status || 'aktif') as ResidentMutationStatus;
      if (st in map) map[st]++;
      else map.aktif++;
    }
    return map;
  }, [residents]);

  const groupSummaries = (() => {
    if (groupBy === 'semua') return [];
    const counts = new Map<string, number>();
    for (const r of residents) {
      const key = getResidentGroupValue(r, groupBy);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
    if (groupBy === 'usia') {
      const order = ['0-12 Tahun', '13-17 Tahun', '18-30 Tahun', '31-45 Tahun', '46-60 Tahun', '>60 Tahun', 'Tidak Diketahui'];
      return entries.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
    }
    if (groupBy === 'pendidikan') {
      const order = [...EDUCATION_OPTIONS] as string[];
      return entries.sort((a, b) => {
        const ia = order.indexOf(a.label);
        const ib = order.indexOf(b.label);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    }
    if (groupBy === 'hubungan') {
      const order = [...FAMILY_RELATIONSHIP_OPTIONS] as string[];
      return entries.sort((a, b) => {
        const ia = order.indexOf(a.label);
        const ib = order.indexOf(b.label);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    }
    if (groupBy === 'rw') {
      return entries.sort((a, b) => a.label.localeCompare(b.label));
    }
    return entries.sort((a, b) => b.count - a.count);
  })();

  const dusunList = ['Semua', ...Array.from(new Set(regions.map((r) => r.dusun)))];
  const filtered = residents.filter((r) => {
    const rStatus = (r.resident_status || 'aktif') as ResidentMutationStatus;
    const matchStatus = statusFilter === 'Semua' || rStatus === statusFilter;
    const matchDusun = dusunFilter === 'Semua' || r.dusun === dusunFilter;
    const matchGroup =
      groupBy === 'semua' ||
      selectedGroupVal === 'Semua' ||
      getResidentGroupValue(r, groupBy) === selectedGroupVal;
    const q = query.trim().toLowerCase();
    const matchQ =
      !q ||
      r.nik.toLowerCase().includes(q) ||
      r.no_kk.toLowerCase().includes(q) ||
      r.full_name.toLowerCase().includes(q) ||
      (r.family_relationship || '').toLowerCase().includes(q) ||
      (r.father_name || '').toLowerCase().includes(q) ||
      (r.mother_name || '').toLowerCase().includes(q) ||
      (r.education || '').toLowerCase().includes(q) ||
      (r.occupation || '').toLowerCase().includes(q) ||
      (r.mutation_notes || '').toLowerCase().includes(q);
    return matchStatus && matchDusun && matchGroup && matchQ;
  });

  const familyGroups = useMemo(() => {
    const map = new Map<string, Resident[]>();
    for (const r of residents) {
      const kk = String(r.no_kk || '').trim();
      if (!kk) continue;
      const list = map.get(kk) || [];
      list.push(r);
      map.set(kk, list);
    }
    return Array.from(map.entries())
      .map(([noKk, list]) => {
        const members = sortFamilyMembers(list);
        const head =
          members.find((m) => (m.family_relationship || '').toLowerCase() === 'kepala keluarga') ||
          members[0];
        return {
          noKk,
          members,
          head,
          activeCount: members.filter(
            (m) => m.resident_status !== 'meninggal' && m.resident_status !== 'pindah_keluar'
          ).length,
        };
      })
      .sort((a, b) => (a.head?.full_name || a.noKk).localeCompare(b.head?.full_name || b.noKk));
  }, [residents]);

  const filteredFamilyGroups = useMemo(() => {
    const q = kkSearch.trim().toLowerCase();
    if (!q) return familyGroups;
    return familyGroups.filter(
      (fg) =>
        fg.noKk.toLowerCase().includes(q) ||
        fg.members.some(
          (m) =>
            m.full_name.toLowerCase().includes(q) ||
            (m.dusun || '').toLowerCase().includes(q)
        )
    );
  }, [familyGroups, kkSearch]);

  const activeKkMembers = useMemo(() => {
    if (!kkModalNoKk) return [];
    return residents.filter((r) => String(r.no_kk || '').trim() === kkModalNoKk);
  }, [residents, kkModalNoKk]);

  const hasActiveFilter =
    statusFilter !== 'Semua' ||
    dusunFilter !== 'Semua' ||
    (groupBy !== 'semua' && selectedGroupVal !== 'Semua') ||
    query.trim().length > 0;

  const filterDescription = (() => {
    const parts: string[] = [];
    if (isRtRw) {
      parts.push(
        currentUser?.role === 'ketua_rt'
          ? `RT ${currentUser.scopeRt} / RW ${currentUser.scopeRw} (${currentUser.scopeDusun})`
          : `RW ${currentUser?.scopeRw} (${currentUser?.scopeDusun})`
      );
    }
    if (statusFilter !== 'Semua') {
      const stMeta = RESIDENT_STATUS_META.find((s) => s.key === statusFilter);
      if (stMeta) parts.push(`Status: ${stMeta.label}`);
    }
    if (!isRtRw && dusunFilter !== 'Semua') parts.push(dusunFilter);
    if (groupBy !== 'semua' && selectedGroupVal !== 'Semua') {
      const groupLabels: Record<GroupMode, string> = {
        semua: '',
        pekerjaan: 'Pekerjaan',
        usia: 'Usia',
        rw: 'Wilayah',
        kelamin: 'Jenis Kelamin',
        agama: 'Agama',
        pendidikan: 'Pendidikan',
        kawin: 'Status Kawin',
        kelainan: 'Kelainan Fisik',
        hubungan: 'Hubungan Keluarga',
      };
      parts.push(`${groupLabels[groupBy]}: ${selectedGroupVal}`);
    }
    if (query.trim()) parts.push(`Pencarian: "${query.trim()}"`);
    return parts.length > 0 ? parts.join(' · ') : 'Seluruh Penduduk Desa Margamukti';
  })();

  const rtRwPendingCount = useMemo(
    () => residents.filter((r) => r.verification_status === 'pending').length,
    [residents]
  );
  const rtRwRejectedCount = useMemo(
    () => residents.filter((r) => r.verification_status === 'rejected').length,
    [residents]
  );

  const mutationCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const log of mutationLogs) {
      if (log.verification_status === 'pending') pending++;
      else if (log.verification_status === 'approved') approved++;
      else if (log.verification_status === 'rejected') rejected++;
    }
    return { pending, approved, rejected, all: mutationLogs.length };
  }, [mutationLogs]);

  const filteredLogs = useMemo(() => {
    if (logStatusFilter === 'all') return mutationLogs;
    return mutationLogs.filter((l) => l.verification_status === logStatusFilter);
  }, [mutationLogs, logStatusFilter]);

  const getStatusLabel = (st?: string) => {
    if (!st) return 'Warga Aktif';
    return RESIDENT_STATUS_META.find((s) => s.key === st)?.label || st;
  };

  const hasPrintableModalOpen =
    exportModalOpen || Boolean(kkModalNoKk) || Boolean(deleteModalState) || aggregateModalOpen;

  return (
    <div className="space-y-5">
      <div className={hasPrintableModalOpen ? 'no-print space-y-5' : 'space-y-5'}>
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'list'
                ? 'bg-[#0F2744] text-white border-[#0F2744]'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Daftar Penduduk &amp; Mutasi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kk')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'kk'
                ? 'bg-[#0F2744] text-white border-[#0F2744]'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Daftar Kartu Keluarga</span>
            <span
              className={`font-mono-tabular font-bold ${
                activeTab === 'kk' ? 'text-[#E5C158]' : 'text-slate-500'
              }`}
            >
              ({familyGroups.length})
            </span>
          </button>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('verification')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'verification'
                  ? 'bg-[#0F2744] text-white border-[#0F2744]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Verifikasi Mutasi RT/RW</span>
              <span
                className={`font-mono-tabular font-bold ${
                  activeTab === 'verification'
                    ? 'text-[#E5C158]'
                    : pendingMutationCount > 0
                    ? 'text-amber-700'
                    : 'text-slate-400'
                }`}
              >
                ({pendingMutationCount})
              </span>
            </button>
          )}
        </div>

        {isRtRw && (
          <div className="bg-white border border-[#C59B27]/50 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#A67F17] shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700">
                <span className="font-semibold text-[#0F2744]">
                  Wilayah Tugas{' '}
                  {currentUser?.role === 'ketua_rt'
                    ? `Ketua RT ${currentUser.scopeRt} / RW ${currentUser.scopeRw}`
                    : `Ketua RW ${currentUser?.scopeRw}`}{' '}
                  ({currentUser?.scopeDusun}):
                </span>{' '}
                Anda hanya dapat melihat, menambah, dan mencatat mutasi penduduk (lahir, pindah masuk, pindah keluar, meninggal) di wilayah ini. Setiap mutasi langsung tercatat dan menunggu verifikasi akhir Superadmin.
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono-tabular">
              {rtRwPendingCount > 0 && (
                <span className="font-semibold text-amber-700">
                  {rtRwPendingCount} Menunggu Verifikasi
                </span>
              )}
              {rtRwRejectedCount > 0 && (
                <span className="font-semibold text-red-700">
                  {rtRwRejectedCount} Ditolak
                </span>
              )}
              <span className="font-semibold text-[#0F2744]">
                {residents.length} Catatan Warga
              </span>
            </div>
          </div>
        )}

        {isSuperAdmin && activeTab === 'verification' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#0F2744]">
                  Verifikasi Mutasi Penduduk dari Ketua RT &amp; RW
                </h2>
                <p className="text-xs text-slate-500">
                  Perubahan oleh Ketua RT/RW langsung berlaku pada statistik desa. Tinjau untuk menyetujui permanen atau menolak &amp; mengembalikan data sebelumnya.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'pending', label: 'Menunggu Verifikasi', count: mutationCounts.pending },
                  { id: 'approved', label: 'Disetujui Permanen', count: mutationCounts.approved },
                  { id: 'rejected', label: 'Ditolak', count: mutationCounts.rejected },
                  { id: 'all', label: 'Semua Riwayat', count: mutationCounts.all },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLogStatusFilter(f.id as typeof logStatusFilter)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      logStatusFilter === f.id
                        ? 'bg-[#0F2744] text-white border-[#0F2744]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}{' '}
                    <span className="font-mono-tabular opacity-85">({f.count})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const isBusy = verifyingLogId === log.id;
                return (
                  <div
                    key={log.id}
                    className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-sm font-semibold text-[#0F2744]">
                          {log.resident_name}
                        </span>
                        <span className="text-xs font-mono-tabular text-slate-500">
                          NIK {log.resident_nik}
                        </span>
                        {log.region_label && (
                          <span className="text-xs text-slate-600">
                            · {log.region_label}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium text-slate-500">
                          {log.action_type === 'create'
                            ? 'Pendaftaran Baru'
                            : getStatusLabel(log.prev_status)}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-[#0F2744]">
                          {getStatusLabel(log.new_status)}
                        </span>
                        {log.new_mutation_date && (
                          <span className="font-mono-tabular text-slate-500">
                            · Tgl Mutasi: {log.new_mutation_date}
                          </span>
                        )}
                      </div>

                      {log.new_mutation_notes && (
                        <p className="text-xs text-slate-600">
                          Keterangan: {log.new_mutation_notes}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-[11px] text-slate-500">
                        <span>
                          Dilaporkan oleh{' '}
                          <span className="font-semibold text-slate-700">{log.actor_name}</span>{' '}
                          ({log.actor_scope || log.actor_role}) ·{' '}
                          <span className="font-mono-tabular">{log.created_at}</span>
                        </span>
                        {log.verification_status === 'pending' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <Clock className="w-3 h-3" /> Menunggu Verifikasi
                          </span>
                        )}
                        {log.verification_status === 'approved' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" /> Disetujui Permanen oleh{' '}
                            {log.verified_by_name || 'Superadmin'} ({log.verified_at})
                          </span>
                        )}
                        {log.verification_status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                            <XCircle className="w-3 h-3" /> Ditolak &amp; Dikembalikan oleh{' '}
                            {log.verified_by_name || 'Superadmin'} ({log.verified_at})
                            {log.verification_note ? ` — "${log.verification_note}"` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {log.verification_status === 'pending' && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setRejectTarget(log);
                            setRejectNote('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Tolak &amp; Kembalikan
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleVerifyMutation(log, 'approved')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md disabled:opacity-50 whitespace-nowrap cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Setujui Permanen
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredLogs.length === 0 && (
                <div className="py-10 px-4 text-center text-xs text-slate-500">
                  {logStatusFilter === 'pending'
                    ? 'Tidak ada mutasi kependudukan RT/RW yang menunggu verifikasi saat ini.'
                    : 'Belum ada riwayat log verifikasi mutasi untuk filter ini.'}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'kk' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#0F2744]">
                  Daftar Kartu Keluarga (KK) Desa Margamukti
                </h2>
                <p className="text-xs text-slate-500">
                  Penduduk dengan Nomor KK yang sama otomatis dikelompokkan ke dalam 1 Kartu Keluarga. Klik{' '}
                  <strong>Lihat &amp; Cetak KK</strong> untuk membuka dan mencetak salinan resmi Kartu Keluarga.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAggregateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F2744] bg-amber-50 border border-amber-300 rounded-md hover:bg-amber-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5" /> Laporan Agregat &amp; Piramida
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={kkSearch}
                onChange={(e) => setKkSearch(e.target.value)}
                placeholder="Cari No. KK, Nama Kepala Keluarga, Nama Anggota, atau Dusun..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#0F2744]"
              />
            </div>

            {/* Mobile KK Cards (< md) */}
            <div className="md:hidden space-y-3">
              {filteredFamilyGroups.map((fg) => (
                <div key={fg.noKk} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setKkModalNoKk(fg.noKk)}
                        className="font-mono-tabular text-xs font-bold text-[#0F2744] hover:underline text-left"
                      >
                        KK: {fg.noKk}
                      </button>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">
                        {fg.head?.full_name || '-'}
                      </p>
                      <p className="text-xs text-slate-600">
                        {fg.head?.dusun
                          ? `${fg.head.dusun} (RT ${fg.head.rt}/RW ${fg.head.rw})`
                          : fg.head?.address || '-'}
                      </p>
                    </div>
                    <span className="font-mono-tabular text-xs font-bold text-[#0F2744] bg-slate-100 px-2.5 py-1 rounded shrink-0">
                      {fg.members.length} ({fg.activeCount} aktif)
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex flex-wrap gap-x-2.5 gap-y-1">
                    {fg.members.map((m) => (
                      <span key={m.id}>
                        <span className="font-medium text-slate-800">{m.full_name}</span>{' '}
                        <span className="text-[11px] text-slate-500">
                          ({m.family_relationship || 'Kepala keluarga'})
                        </span>
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setKkModalNoKk(fg.noKk)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Lihat &amp; Cetak Kartu Keluarga
                  </button>
                </div>
              ))}
              {filteredFamilyGroups.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                  Tidak ada Kartu Keluarga yang sesuai dengan pencarian.
                </div>
              )}
            </div>

            {/* Desktop KK Table (>= md) */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Nomor KK</th>
                      <th className="py-3 px-4">Kepala Keluarga</th>
                      <th className="py-3 px-4">Wilayah</th>
                      <th className="py-3 px-4">Anggota Keluarga Terdaftar</th>
                      <th className="py-3 px-4 text-center">Jiwa</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredFamilyGroups.map((fg) => (
                      <tr key={fg.noKk} className="hover:bg-slate-50">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setKkModalNoKk(fg.noKk)}
                            className="font-mono-tabular text-xs font-bold text-[#0F2744] hover:text-[#A67F17] hover:underline cursor-pointer"
                            title="Buka Format Kartu Keluarga"
                          >
                            {fg.noKk}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{fg.head?.full_name || '-'}</div>
                          <div className="text-[11px] text-slate-500">
                            {fg.head?.family_relationship || 'Kepala keluarga'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          {fg.head?.dusun
                            ? `${fg.head.dusun} (RT ${fg.head.rt}/RW ${fg.head.rw})`
                            : fg.head?.address || '-'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {fg.members.map((m) => (
                              <span key={m.id} className="inline-block">
                                <span className="font-medium text-slate-800">{m.full_name}</span>{' '}
                                <span className="text-[11px] text-slate-500">
                                  ({m.family_relationship || 'Kepala keluarga'})
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono-tabular text-xs font-bold text-[#0F2744] whitespace-nowrap">
                          {fg.members.length} ({fg.activeCount} aktif)
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setKkModalNoKk(fg.noKk)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md whitespace-nowrap cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" /> Lihat &amp; Cetak KK
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredFamilyGroups.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                          Tidak ada Kartu Keluarga yang sesuai dengan pencarian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#0F2744]">
              Manajemen Data Penduduk &amp; Mutasi Warga
            </h2>
            <p className="text-xs text-slate-500">
              {isRtRw
                ? 'Catat warga baru lahir, pindah masuk, pindah keluar, atau meninggal dunia di wilayah Anda.'
                : 'Kelola biodata lengkap, Kartu Keluarga otomatis, pencatatan kematian, laporan agregat & piramida penduduk.'}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
            {!isRtRw && (
              <button
                type="button"
                onClick={() => setBackupModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-[#0F2744] bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-[#A67F17]" /> Cadangan JSON
              </button>
            )}
            <button
              type="button"
              onClick={() => setAggregateModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-[#0F2744] bg-amber-50 border border-amber-300 rounded-md hover:bg-amber-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" /> Laporan &amp; Piramida
            </button>
            {!isRtRw && (
              <button
                type="button"
                onClick={() =>
                  handleDownloadBlob(
                    '/api/admin/residents/excel-template',
                    'template-penduduk-margamukti.xlsx',
                    'Gagal mengunduh template Excel.'
                  )
                }
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Template Excel
              </button>
            )}
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-[#0F2744] bg-white border border-[#0F2744]/40 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Ekspor &amp; Cetak
            </button>
            {!isRtRw && (
              <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Impor Excel
                <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" />
              </label>
            )}
            <button
              type="button"
              onClick={() => openNew('aktif')}
              className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tambah Penduduk / Mutasi
            </button>
          </div>
        </div>

        {/* Filter Status Kependudukan & Mutasi */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600 mr-1">Status Kependudukan:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('Semua')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === 'Semua'
                    ? 'bg-[#0F2744] text-white border-[#0F2744]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Semua ({residents.length})
              </button>
              {RESIDENT_STATUS_META.map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStatusFilter(st.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === st.key
                      ? 'bg-[#0F2744] text-white border-[#0F2744]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      statusFilter === st.key ? 'bg-[#E5C158]' : st.dotColor
                    }`}
                  />
                  {st.shortLabel} ({statusCounts[st.key]})
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openNew('lahir')}
                className="px-2.5 py-1 text-[11px] font-semibold text-sky-900 bg-sky-50 border border-sky-200 rounded hover:bg-sky-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                + Bayi Lahir
              </button>
              <button
                type="button"
                onClick={() => openNew('pindah_masuk')}
                className="px-2.5 py-1 text-[11px] font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                + Pindah Masuk
              </button>
            </div>
          </div>

          {/* Pengelompokan Penduduk (Pekerjaan, Usia, RW, Kelamin, Agama, Pendidikan, Kawin, Kelainan, Hub. Keluarga) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600 mr-1">Kelompokkan Menurut:</span>
              {[
                { id: 'semua', label: 'Semua Data' },
                { id: 'pekerjaan', label: 'Pekerjaan' },
                { id: 'usia', label: 'Usia' },
                { id: 'rw', label: 'RW' },
                { id: 'kelamin', label: 'Jenis Kelamin' },
                { id: 'agama', label: 'Agama' },
                { id: 'pendidikan', label: 'Pendidikan' },
                { id: 'kawin', label: 'Status Kawin' },
                { id: 'kelainan', label: 'Kelainan Fisik' },
                { id: 'hubungan', label: 'Hub. Keluarga' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setGroupBy(tab.id as GroupMode);
                    setSelectedGroupVal('Semua');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    groupBy === tab.id
                      ? 'bg-[#0F2744] text-white border-[#0F2744]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="text-xs font-mono-tabular text-slate-500">
              Menampilkan {filtered.length} dari {residents.length} penduduk
            </span>
          </div>

          {groupBy !== 'semua' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedGroupVal('Semua')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  selectedGroupVal === 'Semua'
                    ? 'bg-[#0F2744] text-white border-[#0F2744]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-[11px] opacity-80">Semua Kelompok</p>
                <p className="text-base font-bold font-mono-tabular mt-0.5">{residents.length} jiwa</p>
              </button>
              {groupSummaries.map((g) => {
                const active = selectedGroupVal === g.label;
                const pct = residents.length > 0 ? Math.round((g.count / residents.length) * 100) : 0;
                return (
                  <button
                    key={g.label}
                    type="button"
                    onClick={() => setSelectedGroupVal(active ? 'Semua' : g.label)}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#C59B27]/15 border-[#C59B27] text-[#0F2744]'
                        : 'bg-white border-slate-200 hover:border-[#0F2744]'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-800 truncate" title={g.label}>
                      {g.label}
                    </p>
                    <p className="text-sm font-bold font-mono-tabular text-[#0F2744] mt-1">
                      {g.count} <span className="text-[11px] font-normal text-slate-500">({pct}%)</span>
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari berdasarkan NIK, No. KK, Nama Lengkap, Pekerjaan, atau Keterangan Mutasi..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#0F2744]"
            />
          </div>
          {!isRtRw && (
            <select
              value={dusunFilter}
              onChange={(e) => setDusunFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
            >
              {dusunList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Mobile Resident Cards (< md) */}
        <div className="md:hidden space-y-3">
          {filtered.map((r) => {
            const stKey = (r.resident_status || 'aktif') as ResidentMutationStatus;
            const stMeta =
              RESIDENT_STATUS_META.find((s) => s.key === stKey) || RESIDENT_STATUS_META[0];
            return (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-[#0F2744]">{r.full_name}</div>
                    <div className="text-xs font-medium text-slate-700">
                      {r.family_relationship || 'Kepala keluarga'}
                    </div>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 ${stMeta.textColor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${stMeta.dotColor} shrink-0`} />
                    <span>{stMeta.shortLabel}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  <span className="text-[#0F2744] font-semibold">NIK: {r.nik}</span>
                  <button
                    type="button"
                    onClick={() => setKkModalNoKk(r.no_kk)}
                    className="font-semibold text-[#0F2744] underline cursor-pointer"
                  >
                    KK: {r.no_kk}
                  </button>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p>
                    {r.birth_place}, <span className="font-mono-tabular">{r.birth_date}</span> · {r.gender} · {r.marital_status}
                  </p>
                  <p className="text-slate-700">
                    {r.dusun ? `${r.dusun} (RT ${r.rt}/RW ${r.rw})` : r.address}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {r.occupation} · {r.education || 'SLTA/Sederajat'} · Fisik: {r.physical_disability || 'Tidak Ada'}
                  </p>
                  {r.verification_status === 'pending' && (
                    <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                      <Clock className="w-3 h-3 shrink-0" /> Menunggu Verifikasi Superadmin
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setKkModalNoKk(r.no_kk)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" /> KK
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit / Mutasi
                  </button>
                  {stKey === 'meninggal' && (
                    <button
                      type="button"
                      onClick={() => setDeleteModalState({ resident: r, mode: 'certificate' })}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#0F2744] border border-slate-200 rounded-md cursor-pointer"
                      title="Cetak Form Keterangan Meninggal"
                      aria-label="Cetak Form Keterangan Meninggal"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  )}
                  {isRtRw ? (
                    stKey !== 'meninggal' && (
                      <button
                        type="button"
                        onClick={() => setDeleteModalState({ resident: r, mode: 'death_form' })}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-amber-700 border border-amber-200 rounded-md cursor-pointer"
                        title="Catat Meninggal & Buat Form Keterangan"
                        aria-label="Catat Meninggal"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteModalState({ resident: r, mode: 'choose' })}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-600 border border-slate-200 rounded-md cursor-pointer"
                      title="Hapus Data / Catat Meninggal"
                      aria-label="Hapus Data Penduduk"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
              Tidak ada data penduduk yang sesuai dengan kriteria pengelompokan/pencarian.
            </div>
          )}
        </div>

        {/* Desktop Residents Table (>= md) */}
        <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">NIK / No. KK</th>
                  <th className="py-3 px-4">Nama &amp; Hubungan Kel.</th>
                  <th className="py-3 px-4">TTL &amp; Gender</th>
                  <th className="py-3 px-4">Wilayah</th>
                  <th className="py-3 px-4">Status &amp; Mutasi</th>
                  <th className="py-3 px-4">Pendidikan, Kerja &amp; Fisik</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((r) => {
                  const stKey = (r.resident_status || 'aktif') as ResidentMutationStatus;
                  const stMeta =
                    RESIDENT_STATUS_META.find((s) => s.key === stKey) || RESIDENT_STATUS_META[0];
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-mono-tabular text-xs font-semibold text-[#0F2744]">{r.nik}</div>
                        <button
                          type="button"
                          onClick={() => setKkModalNoKk(r.no_kk)}
                          className="font-mono-tabular text-[11px] font-semibold text-slate-600 hover:text-[#0F2744] hover:underline cursor-pointer text-left"
                          title="Klik untuk membuka & mencetak Kartu Keluarga (KK)"
                        >
                          KK: {r.no_kk}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{r.full_name}</div>
                        <div className="text-[11px] font-semibold text-[#0F2744]">
                          {r.family_relationship || 'Kepala keluarga'}
                        </div>
                        {(r.father_name || r.mother_name) && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Ayah: {r.father_name || '-'} · Ibu: {r.mother_name || '-'}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        <div>
                          {r.birth_place}, <span className="font-mono-tabular">{r.birth_date}</span>
                        </div>
                        <div>
                          {r.gender} · {r.marital_status} · {r.religion}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {r.dusun ? `${r.dusun} (RT ${r.rt}/RW ${r.rw})` : r.address}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className={`inline-flex items-center gap-1.5 font-semibold ${stMeta.textColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${stMeta.dotColor} shrink-0`} />
                          <span>{stMeta.label}</span>
                        </div>
                        {r.mutation_date && (
                          <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                            Tgl: {r.mutation_date}
                          </div>
                        )}
                        {r.mutation_notes && (
                          <div className="text-[11px] text-slate-500 max-w-[180px] truncate" title={r.mutation_notes}>
                            {r.mutation_notes}
                          </div>
                        )}
                        {r.verification_status === 'pending' && (
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 mt-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>Menunggu Verifikasi Superadmin</span>
                          </div>
                        )}
                        {r.verification_status === 'rejected' && (
                          <div className="text-[11px] text-red-700 mt-1 max-w-[200px]">
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <XCircle className="w-3 h-3 shrink-0" /> Mutasi Ditolak
                            </span>
                            {r.verification_note ? ` · ${r.verification_note}` : ''}
                          </div>
                        )}
                        {(!r.verification_status || r.verification_status === 'verified') &&
                          (isRtRw || stKey !== 'aktif') && (
                            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 mt-1">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>Terverifikasi</span>
                            </div>
                          )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        <div className="font-medium text-slate-800">{r.occupation}</div>
                        <div className="text-[11px] text-slate-500">{r.education || 'SLTA/Sederajat'}</div>
                        <div
                          className={`text-[11px] ${
                            r.physical_disability === 'Ada'
                              ? 'font-semibold text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          Kelainan Fisik: {r.physical_disability || 'Tidak Ada'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setKkModalNoKk(r.no_kk)}
                          className="p-1.5 text-slate-600 hover:text-[#0F2744] cursor-pointer"
                          title="Lihat & Cetak Kartu Keluarga (KK)"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="p-1.5 text-slate-600 hover:text-[#0F2744] ml-0.5 cursor-pointer"
                          title="Edit Data / Catat Mutasi"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {stKey === 'meninggal' && (
                          <button
                            type="button"
                            onClick={() => setDeleteModalState({ resident: r, mode: 'certificate' })}
                            className="p-1.5 text-[#0F2744] hover:text-[#A67F17] ml-0.5 cursor-pointer"
                            title="Cetak Form Keterangan Meninggal"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                        {isRtRw ? (
                          stKey !== 'meninggal' && (
                            <button
                              type="button"
                              onClick={() => setDeleteModalState({ resident: r, mode: 'death_form' })}
                              className="p-1.5 text-slate-600 hover:text-amber-700 ml-0.5 cursor-pointer"
                              title="Catat Meninggal & Buat Form Keterangan"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteModalState({ resident: r, mode: 'choose' })}
                            className="p-1.5 text-slate-600 hover:text-red-600 ml-0.5 cursor-pointer"
                            title="Hapus Data / Catat Meninggal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                      Tidak ada data penduduk yang sesuai dengan kriteria pengelompokan/pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}

        {rejectTarget && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-semibold text-[#0F2744]">
                  Tolak &amp; Kembalikan Mutasi Warga
                </h3>
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="p-1 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-slate-600 space-y-2">
                <p>
                  Warga: <span className="font-semibold text-[#0F2744]">{rejectTarget.resident_name}</span>{' '}
                  (<span className="font-mono-tabular">{rejectTarget.resident_nik}</span>)
                </p>
                <p className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                  {rejectTarget.action_type === 'create'
                    ? 'Karena ini merupakan pendaftaran penduduk baru dari Ketua RT/RW, penolakan akan menghapus data baru tersebut dari daftar penduduk aktif sambil menyimpan log penolakan.'
                    : `Status kependudukan warga akan dikembalikan ke "${getStatusLabel(
                        rejectTarget.prev_status
                      )}" secara otomatis.`}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Penolakan (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Contoh: Warga masih berdomisili aktif atau dokumen surat pindah belum lengkap..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-[#0F2744]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={verifyingLogId === rejectTarget.id}
                  onClick={() => handleVerifyMutation(rejectTarget, 'rejected', rejectNote)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-md disabled:opacity-50 cursor-pointer"
                >
                  Konfirmasi Tolak &amp; Kembalikan
                </button>
              </div>
            </div>
          </div>
        )}

        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-2xl w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-semibold text-[#0F2744]">
                  {editingId ? 'Edit Data & Catat Mutasi Penduduk' : 'Tambah Data Penduduk / Mutasi Warga'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
                  aria-label="Tutup modal data penduduk"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                {/* Status Kependudukan & Mutasi Section */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F2744] mb-1">
                        Status Kependudukan / Mutasi *
                      </label>
                      <select
                        value={form.resident_status}
                        onChange={(e) => handleStatusChange(e.target.value as ResidentMutationStatus)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white font-medium"
                      >
                        {RESIDENT_STATUS_META.map((st) => (
                          <option key={st.key} value={st.key}>
                            {st.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tanggal Mutasi {form.resident_status !== 'aktif' ? '*' : '(Opsional)'}
                      </label>
                      <input
                        type="date"
                        required={form.resident_status !== 'aktif'}
                        value={form.mutation_date}
                        onChange={(e) => setForm({ ...form, mutation_date: e.target.value })}
                        className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Keterangan Mutasi (Asal/Tujuan Pindah, Akta Lahir, atau Catatan)
                    </label>
                    <input
                      value={form.mutation_notes}
                      onChange={(e) => setForm({ ...form, mutation_notes: e.target.value })}
                      placeholder={
                        form.resident_status === 'pindah_keluar'
                          ? 'Contoh: Pindah domisili ke Kec. Cimalaka sesuai surat pindah'
                          : form.resident_status === 'pindah_masuk'
                          ? 'Contoh: Pindah datang dari Kab. Bandung'
                          : form.resident_status === 'lahir'
                          ? 'Contoh: Lahir di RSUD Sumedang, anak ke-2'
                          : form.resident_status === 'meninggal'
                          ? 'Contoh: Wafat karena sakit di rumah duka'
                          : 'Opsional'
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">NIK (16 Digit) *</label>
                    <input
                      required
                      value={form.nik}
                      onChange={(e) => setForm({ ...form, nik: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">No. KK (16 Digit) *</label>
                    <input
                      required
                      value={form.no_kk}
                      onChange={(e) => setForm({ ...form, no_kk: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
                    <input
                      required
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hubungan Keluarga *</label>
                    <select
                      value={form.family_relationship}
                      onChange={(e) => setForm({ ...form, family_relationship: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {FAMILY_RELATIONSHIP_OPTIONS.map((rel) => (
                        <option key={rel} value={rel}>
                          {rel}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                    <select
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value as 'Laki-laki' | 'Perempuan' })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tempat Lahir</label>
                    <input
                      value={form.birth_place}
                      onChange={(e) => setForm({ ...form, birth_place: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Lahir</label>
                    <input
                      type="date"
                      value={form.birth_date}
                      onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Wilayah RT/RW {isRtRw ? '*' : ''}
                    </label>
                    <select
                      required={isRtRw}
                      value={form.region_id}
                      onChange={(e) => setForm({ ...form, region_id: Number(e.target.value) })}
                      disabled={isRtRw && regions.length === 1}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white disabled:bg-slate-100"
                    >
                      {!isRtRw && <option value="">-- Pilih Wilayah --</option>}
                      {regions.map((rg) => (
                        <option key={rg.id} value={rg.id}>
                          {rg.dusun} · {rg.blok} (RT {rg.rt}/RW {rg.rw})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Agama</label>
                    <select
                      value={form.religion}
                      onChange={(e) => setForm({ ...form, religion: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      <option value="Islam">Islam</option>
                      <option value="Kristen">Kristen</option>
                      <option value="Katolik">Katolik</option>
                      <option value="Hindu">Hindu</option>
                      <option value="Buddha">Buddha</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pendidikan Terakhir *</label>
                    <select
                      value={form.education}
                      onChange={(e) => setForm({ ...form, education: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {EDUCATION_OPTIONS.map((edu) => (
                        <option key={edu} value={edu}>
                          {edu}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pekerjaan</label>
                    <input
                      value={form.occupation}
                      onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Status Perkawinan</label>
                    <select
                      value={form.marital_status}
                      onChange={(e) => setForm({ ...form, marital_status: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      <option value="Belum Kawin">Belum Kawin</option>
                      <option value="Kawin">Kawin</option>
                      <option value="Cerai Hidup">Cerai Hidup</option>
                      <option value="Cerai Mati">Cerai Mati</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Kelainan Fisik *</label>
                    <select
                      value={form.physical_disability}
                      onChange={(e) => setForm({ ...form, physical_disability: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {PHYSICAL_DISABILITY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Ayah</label>
                    <input
                      value={form.father_name}
                      onChange={(e) => setForm({ ...form, father_name: e.target.value })}
                      placeholder="Nama lengkap ayah kandung"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Ibu</label>
                    <input
                      value={form.mother_name}
                      onChange={(e) => setForm({ ...form, mother_name: e.target.value })}
                      placeholder="Nama lengkap ibu kandung"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
                  <input
                    required
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer"
                  >
                    Simpan Data Penduduk
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <ResidentExportPrintModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        allResidents={residents}
        filteredResidents={filtered}
        hasActiveFilter={hasActiveFilter}
        filterDescription={filterDescription}
        settings={settings}
        onNotify={onNotify}
      />

      <KartuKeluargaModal
        open={Boolean(kkModalNoKk)}
        noKk={kkModalNoKk || ''}
        members={activeKkMembers}
        settings={settings}
        onClose={() => setKkModalNoKk(null)}
        onNotify={onNotify}
      />

      <ResidentDeleteDeathModal
        open={Boolean(deleteModalState)}
        resident={deleteModalState?.resident || null}
        initialMode={deleteModalState?.mode || 'choose'}
        isRtRw={isRtRw}
        settings={settings}
        onClose={() => setDeleteModalState(null)}
        onDeleted={() => {
          load();
          onMutationQueueChange?.();
        }}
        onDeathRecorded={() => {
          load();
          onMutationQueueChange?.();
        }}
        onNotify={onNotify}
      />

      <ResidentAggregateReportModal
        open={aggregateModalOpen}
        onClose={() => setAggregateModalOpen(false)}
        settings={settings}
        onNotify={onNotify}
      />

      {!isRtRw && (
        <BackupArchiveModal
          open={backupModalOpen}
          onClose={() => setBackupModalOpen(false)}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}

