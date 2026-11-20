import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  HardHat,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ImageWithFallback } from '../../../components/ImageWithFallback';
import { LeafletMap } from '../../../components/LeafletMap';
import { adminFetch } from '../../../utils/adminApi';
import { uploadImageFile } from '../../../utils/uploadImage';
import type { Region, VillageDevelopment } from '../../../types';

interface NotifyProps {
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

const FUNDING_PRESETS = [
  'Dana Desa (DD)',
  'Alokasi Dana Desa (ADD)',
  'Bantuan Provinsi Jawa Barat (Banprov)',
  'BKK Kabupaten Sumedang',
  'PADes (Pendapatan Asli Desa)',
  'Swadaya Masyarakat & CSR',
];

function formatRupiah(amount: number): string {
  return `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;
}

export function AdminDevelopmentsModule({ onNotify }: NotifyProps) {
  const [developments, setDevelopments] = useState<VillageDevelopment[]>([]);
  const [totals, setTotals] = useState({
    totalProjects: 0,
    completedProjects: 0,
    ongoingProjects: 0,
    totalBudget: 0,
    avgProgress: 0,
  });
  const [regions, setRegions] = useState<Region[]>([]);
  const [mapCenter, setMapCenter] = useState({ lat: -6.8283, lng: 107.9 });
  const [loading, setLoading] = useState(true);

  const [yearFilter, setYearFilter] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: '',
    budget_amount: 0,
    funding_source: 'Dana Desa (DD)',
    volume: '',
    progress_percent: 0,
    fiscal_year: new Date().getFullYear(),
    executor: 'TPK Desa Margamukti',
    location_region: '',
    latitude: '' as string | number,
    longitude: '' as string | number,
    photo_url: '',
    description: '',
    is_published: true,
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      adminFetch('/api/admin/developments').then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Gagal memuat data pembangunan.');
        return j;
      }),
      fetch('/api/public/profile').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/public/map').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([devJson, profJson, mapJson]) => {
        setDevelopments(Array.isArray(devJson.developments) ? devJson.developments : []);
        if (devJson.totals) setTotals(devJson.totals);
        if (profJson?.regions) setRegions(profJson.regions);
        if (mapJson?.settings) {
          setMapCenter({
            lat: Number(mapJson.settings.map_center_lat) || -6.8283,
            lng: Number(mapJson.settings.map_center_lng) || 107.9,
          });
        }
      })
      .catch((err: unknown) => {
        onNotify(err instanceof Error ? err.message : 'Gagal memuat data pembangunan.', 'err');
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadData, []);

  const regionSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const r of regions) {
      set.add(`${r.dusun} · ${r.blok} (RT ${r.rt} / RW ${r.rw})`);
    }
    return Array.from(set);
  }, [regions]);

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(developments.map((d) => Number(d.fiscal_year)))).sort(
      (a, b) => b - a
    );
    return years;
  }, [developments]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return developments.filter((d) => {
      const okYear = yearFilter === 'Semua' || String(d.fiscal_year) === yearFilter;
      const okQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.funding_source.toLowerCase().includes(q) ||
        d.location_region.toLowerCase().includes(q) ||
        d.executor.toLowerCase().includes(q);
      return okYear && okQuery;
    });
  }, [developments, yearFilter, searchQuery]);

  const openNew = () => {
    setEditingId(null);
    setForm({
      name: '',
      budget_amount: 0,
      funding_source: 'Dana Desa (DD)',
      volume: '',
      progress_percent: 0,
      fiscal_year: new Date().getFullYear(),
      executor: 'TPK Desa Margamukti',
      location_region: regionSuggestions[0] || '',
      latitude: mapCenter.lat,
      longitude: mapCenter.lng,
      photo_url: '',
      description: '',
      is_published: true,
    });
    setModalOpen(true);
  };

  const openEdit = (d: VillageDevelopment) => {
    setEditingId(d.id);
    setForm({
      name: d.name,
      budget_amount: d.budget_amount,
      funding_source: d.funding_source,
      volume: d.volume,
      progress_percent: d.progress_percent,
      fiscal_year: d.fiscal_year,
      executor: d.executor,
      location_region: d.location_region,
      latitude: d.latitude ?? '',
      longitude: d.longitude ?? '',
      photo_url: d.photo_url || '',
      description: d.description || '',
      is_published: d.is_published === 1,
    });
    setModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadImageFile(file);
      setForm((prev) => ({ ...prev, photo_url: url }));
      onNotify('Foto pembangunan berhasil diunggah.');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Gagal mengunggah foto.', 'err');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/developments/${editingId}` : '/api/admin/developments';
      const method = editingId ? 'PUT' : 'POST';
      const payload = {
        ...form,
        budget_amount: Math.max(0, Number(form.budget_amount) || 0),
        progress_percent: Math.min(100, Math.max(0, Number(form.progress_percent) || 0)),
        fiscal_year: Number(form.fiscal_year) || new Date().getFullYear(),
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
      };
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || 'Gagal menyimpan data pembangunan.', 'err');
        return;
      }
      setModalOpen(false);
      loadData();
      onNotify(
        editingId
          ? 'Data pembangunan berhasil diperbarui.'
          : 'Proyek pembangunan baru berhasil ditambahkan.'
      );
    } catch {
      onNotify('Gagal terhubung ke server.', 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await adminFetch(`/api/admin/developments/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || 'Gagal menghapus proyek pembangunan.', 'err');
        return;
      }
      setConfirmDeleteId(null);
      loadData();
      onNotify('Data proyek pembangunan telah dihapus.');
    } catch {
      onNotify('Gagal menghapus data pembangunan.', 'err');
    }
  };

  const parsedLat = form.latitude !== '' ? Number(form.latitude) : NaN;
  const parsedLng = form.longitude !== '' ? Number(form.longitude) : NaN;
  const pickedCoords =
    Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
      ? { lat: parsedLat, lng: parsedLng }
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">
            Manajemen Pembangunan Desa &amp; Lokasi Peta
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Input dan perbarui kegiatan pembangunan fisik/non-fisik. Data terpublikasi otomatis
            tampil di Portofolio Pemerintah Desa, halaman Pembangunan publik, dan pin Peta Desa.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#E5C158]" />
          Tambah Pembangunan
        </button>
      </div>

      {/* KPI Ringkas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500">Total Kegiatan</p>
          <p className="text-2xl font-bold text-[#0F2744] font-mono-tabular mt-1">
            {totals.totalProjects}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
            {totals.completedProjects} selesai 100% · {totals.ongoingProjects} berjalan
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500">Total Anggaran</p>
          <p className="text-xl sm:text-2xl font-bold text-[#0F2744] font-mono-tabular mt-1 truncate">
            {formatRupiah(totals.totalBudget)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Akumulasi lintas sumber dana</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500">Rata-rata Progress</p>
          <p className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-1">
            {totals.avgProgress}%
          </p>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-emerald-600 rounded-full"
              style={{ width: `${Math.min(100, totals.avgProgress)}%` }}
            />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500">Titik Peta Terpasang</p>
          <p className="text-2xl font-bold text-[#A67F17] font-mono-tabular mt-1">
            {developments.filter((d) => d.latitude !== null && d.longitude !== null).length}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Dari {developments.length} kegiatan</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setYearFilter('Semua')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border cursor-pointer ${
              yearFilter === 'Semua'
                ? 'bg-[#0F2744] text-white border-[#0F2744]'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            Semua Tahun
          </button>
          {availableYears.map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => setYearFilter(String(yr))}
              className={`px-3 py-1.5 text-xs font-semibold font-mono-tabular rounded-md border cursor-pointer ${
                yearFilter === String(yr)
                  ? 'bg-[#0F2744] text-white border-[#0F2744]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama proyek, sumber dana, pelaksana..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#0F2744]"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
          Memuat daftar kegiatan pembangunan...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
          Belum ada data pembangunan yang cocok dengan filter.
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredList.map((dev) => {
              const isDeleting = confirmDeleteId === dev.id;
              return (
                <div
                  key={dev.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                >
                  <div className="flex gap-3 p-4">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                      <ImageWithFallback
                        src={dev.photo_url}
                        alt={dev.name}
                        fallbackTitle={dev.funding_source}
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono-tabular font-semibold text-[#A67F17]">
                          TA {dev.fiscal_year}
                        </span>
                        <span className="font-mono-tabular font-bold text-[#0F2744]">
                          {dev.progress_percent}%
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{dev.name}</h3>
                      <p className="text-xs font-mono-tabular font-semibold text-[#0F2744]">
                        {formatRupiah(dev.budget_amount)}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {dev.funding_source} · {dev.volume}
                      </p>
                    </div>
                  </div>
                  <div className="px-4 pb-3 space-y-2">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          dev.progress_percent >= 100 ? 'bg-emerald-600' : 'bg-[#0F2744]'
                        }`}
                        style={{ width: `${dev.progress_percent}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Pelaksana: <strong>{dev.executor}</strong> · {dev.location_region}
                    </p>
                    {isDeleting ? (
                      <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-md p-2 text-xs">
                        <span className="text-red-800 font-medium">Hapus proyek ini?</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDelete(dev.id)}
                            className="px-2.5 py-1 bg-red-700 text-white font-semibold rounded cursor-pointer"
                          >
                            Ya
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 font-semibold rounded cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openEdit(dev)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(dev.id)}
                          className="p-2 text-slate-500 hover:text-red-600 border border-slate-200 rounded-md cursor-pointer"
                          aria-label="Hapus pembangunan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Kegiatan Pembangunan</th>
                    <th className="py-3 px-4">Sumber Dana &amp; Anggaran</th>
                    <th className="py-3 px-4">Volume &amp; Pelaksana</th>
                    <th className="py-3 px-4">Lokasi &amp; Peta</th>
                    <th className="py-3 px-4 w-36">Progress</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredList.map((dev) => {
                    const isDeleting = confirmDeleteId === dev.id;
                    const hasCoords = dev.latitude !== null && dev.longitude !== null;
                    return (
                      <tr key={dev.id} className="hover:bg-slate-50/70 align-top">
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-3">
                            <div className="w-16 h-12 rounded-md overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                              <ImageWithFallback
                                src={dev.photo_url}
                                alt={dev.name}
                                fallbackTitle={dev.funding_source}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-[11px]">
                                <span className="font-mono-tabular font-bold text-[#A67F17]">
                                  TA {dev.fiscal_year}
                                </span>
                                {dev.is_published === 0 && (
                                  <span className="inline-flex items-center gap-1 text-slate-500">
                                    <EyeOff className="w-3 h-3" /> Draft
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-[#0F2744] mt-0.5">
                                {dev.name}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="font-bold text-slate-900 font-mono-tabular">
                            {formatRupiah(dev.budget_amount)}
                          </p>
                          <p className="text-slate-500 mt-0.5">{dev.funding_source}</p>
                        </td>
                        <td className="py-3.5 px-4 max-w-[220px]">
                          <p className="font-medium text-slate-800">{dev.volume}</p>
                          <p className="text-slate-500 mt-0.5">Pelaksana: {dev.executor}</p>
                        </td>
                        <td className="py-3.5 px-4 max-w-[220px]">
                          <p className="text-slate-800">{dev.location_region}</p>
                          {hasCoords ? (
                            <p className="font-mono-tabular text-[11px] text-emerald-700 mt-0.5 inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {Number(dev.latitude).toFixed(4)}, {Number(dev.longitude).toFixed(4)}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-0.5">Belum dipin di peta</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-between font-mono-tabular mb-1">
                            <span
                              className={`font-bold ${
                                dev.progress_percent >= 100
                                  ? 'text-emerald-700'
                                  : 'text-[#0F2744]'
                              }`}
                            >
                              {dev.progress_percent}%
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {dev.progress_percent >= 100 ? 'Selesai' : 'Berjalan'}
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                dev.progress_percent >= 100 ? 'bg-emerald-600' : 'bg-[#0F2744]'
                              }`}
                              style={{ width: `${dev.progress_percent}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isDeleting ? (
                            <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded px-2 py-1">
                              <button
                                type="button"
                                onClick={() => handleDelete(dev.id)}
                                className="px-2 py-0.5 bg-red-700 text-white font-semibold rounded cursor-pointer"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-0.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEdit(dev)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(dev.id)}
                                className="p-1.5 text-slate-500 hover:text-red-600 border border-slate-200 rounded-md cursor-pointer"
                                aria-label="Hapus pembangunan"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Tambah / Edit Pembangunan */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-3xl w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 space-y-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <HardHat className="w-5 h-5 text-[#C59B27]" />
                <h3 className="text-base font-semibold text-[#0F2744]">
                  {editingId ? 'Edit Kegiatan Pembangunan Desa' : 'Tambah Kegiatan Pembangunan Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-500 cursor-pointer"
                aria-label="Tutup form pembangunan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Pembangunan *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: Peningkatan Jalan Lingkungan Rabat Beton Blok Cikalapa"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Anggaran (Rp) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.budget_amount}
                    onChange={(e) =>
                      setForm({ ...form, budget_amount: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                  <p className="text-[11px] text-slate-500 font-mono-tabular mt-0.5">
                    {formatRupiah(form.budget_amount)}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sumber Dana *
                  </label>
                  <input
                    type="text"
                    required
                    list="funding-sources-presets"
                    value={form.funding_source}
                    onChange={(e) => setForm({ ...form, funding_source: e.target.value })}
                    placeholder="Pilih atau ketik sumber dana"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                  <datalist id="funding-sources-presets">
                    {FUNDING_PRESETS.map((fs) => (
                      <option key={fs} value={fs} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tahun Anggaran *
                  </label>
                  <input
                    type="number"
                    min={2015}
                    max={2100}
                    required
                    value={form.fiscal_year}
                    onChange={(e) =>
                      setForm({ ...form, fiscal_year: Number(e.target.value) || 2025 })
                    }
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Volume Pekerjaan *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.volume}
                    onChange={(e) => setForm({ ...form, volume: e.target.value })}
                    placeholder="Contoh: Panjang 480 m × Lebar 3 m · Tebal 15 cm"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pelaksana Pekerjaan *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.executor}
                    onChange={(e) => setForm({ ...form, executor: e.target.value })}
                    placeholder="Contoh: TPK Desa Margamukti"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              {/* Prosentase Progress */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Prosentase Progress Pekerjaan *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.progress_percent}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          progress_percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                        })
                      }
                      className="w-16 px-2 py-1 text-xs text-right font-mono-tabular font-bold border border-slate-300 rounded bg-white"
                    />
                    <span className="text-xs font-bold text-[#0F2744]">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={form.progress_percent}
                  onChange={(e) =>
                    setForm({ ...form, progress_percent: Number(e.target.value) || 0 })
                  }
                  className="w-full accent-[#0F2744] cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>0% (Persiapan)</span>
                  <span>50% (Sedang Dikerjakan)</span>
                  <span>100% (Selesai / Serah Terima)</span>
                </div>
              </div>

              {/* Lokasi Wilayah & Picker Koordinat Peta */}
              <div className="space-y-3 border border-slate-200 rounded-lg p-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lokasi Wilayah (Dusun / Blok / RT-RW) *
                  </label>
                  <input
                    type="text"
                    required
                    list="region-suggestions-list"
                    value={form.location_region}
                    onChange={(e) => setForm({ ...form, location_region: e.target.value })}
                    placeholder="Contoh: Dusun Sukamaju · Blok Cikalapa (RT 01 / RW 03)"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                  <datalist id="region-suggestions-list">
                    {regionSuggestions.map((reg) => (
                      <option key={reg} value={reg} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Latitude (Garis Lintang)
                    </label>
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Longitude (Garis Bujur)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                      placeholder="107.9000"
                      className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-md"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, latitude: '', longitude: '' })}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                  >
                    Kosongkan Koordinat
                  </button>
                </div>

                <LeafletMap
                  centerLat={pickedCoords?.lat ?? mapCenter.lat}
                  centerLng={pickedCoords?.lng ?? mapCenter.lng}
                  locations={[]}
                  pickerMode
                  pickedCoords={pickedCoords}
                  onPickCoords={(coords) =>
                    setForm((prev) => ({
                      ...prev,
                      latitude: coords.lat,
                      longitude: coords.lng,
                    }))
                  }
                  heightClass="h-[240px]"
                  showLegend={false}
                />
              </div>

              {/* Photo Pembangunan */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Foto Dokumentasi Pembangunan
                </label>
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <div className="w-full sm:w-40 aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    <ImageWithFallback
                      src={form.photo_url}
                      alt={form.name || 'Preview foto pembangunan'}
                      fallbackTitle="Foto Pembangunan"
                    />
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingPhoto ? 'Mengunggah...' : 'Unggah Foto dari Perangkat'}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                      {form.photo_url && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, photo_url: '' })}
                          className="text-xs text-red-700 hover:underline cursor-pointer"
                        >
                          Hapus Foto
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={form.photo_url}
                      onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                      placeholder="Atau tempel URL / path foto..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan / Catatan Teknis Pekerjaan
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Jelaskan manfaat bagi warga, sasaran lokasi, atau kondisi pekerjaan di lapangan..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                  className="rounded border-slate-300"
                />
                {form.is_published ? (
                  <Eye className="w-4 h-4 text-emerald-700" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                )}
                <span>Publikasikan di Portal Warga, Portofolio Desa &amp; Pin Peta</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] disabled:opacity-60 rounded-md cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-[#E5C158]" />
                  {saving ? 'Menyimpan...' : 'Simpan Pembangunan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
