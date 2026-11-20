import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BookOpen,
  Check,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { adminFetch } from '../../../utils/adminApi';
import type { AiKnowledgeCategory, AiKnowledgeEntry } from '../../../types';

interface AdminAiKnowledgeProps {
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

const CATEGORIES: AiKnowledgeCategory[] = [
  'DTSEN',
  'Bansos',
  'Adminduk',
  'Pemerintahan Daerah',
  'Pemerintahan Desa',
];

const ROUTE_PRESETS: Array<{
  key: string;
  label: string;
  route: string;
  subtab: string;
  defaultButtonLabel: string;
}> = [
  { key: 'none', label: 'Tanpa Tautan Layanan', route: '', subtab: '', defaultButtonLabel: '' },
  { key: 'bansos', label: 'Halaman Cek Bansos & DTSEN', route: 'bansos', subtab: '', defaultButtonLabel: 'Buka Halaman Cek Bansos & DTSEN' },
  { key: 'surat_form', label: 'Layanan Surat Mandiri (Formulir)', route: 'surat', subtab: 'form', defaultButtonLabel: 'Ajukan Surat Mandiri Online' },
  { key: 'surat_track', label: 'Pelacakan Status Surat', route: 'surat', subtab: 'track', defaultButtonLabel: 'Lacak Status Pengajuan Surat' },
  { key: 'profil_apbdes', label: 'Transparansi APBDes', route: 'profil', subtab: 'apbdes', defaultButtonLabel: 'Lihat Transparansi APBDes' },
  { key: 'profil_perangkat', label: 'Profil & Perangkat Desa', route: 'profil', subtab: 'perangkat', defaultButtonLabel: 'Lihat Struktur Perangkat Desa' },
  { key: 'lembaga', label: 'Lembaga Desa (BPD/BUMDesa/LPM/PKK)', route: 'lembaga', subtab: 'bpd', defaultButtonLabel: 'Lihat Profil Lembaga Desa' },
  { key: 'peta_kontak', label: 'Peta Fasilitas & Kontak Resmi', route: 'peta-kontak', subtab: '', defaultButtonLabel: 'Lihat Peta & Kontak Pengaduan' },
];

function findPresetKey(route: string, subtab: string): string {
  const matched = ROUTE_PRESETS.find((p) => p.route === (route || '') && p.subtab === (subtab || ''));
  return matched ? matched.key : 'none';
}

export function AdminAiKnowledgeModule({ onNotify }: AdminAiKnowledgeProps) {
  const [entries, setEntries] = useState<AiKnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Semua' | AiKnowledgeCategory>('Semua');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AiKnowledgeEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AiKnowledgeEntry | null>(null);

  const [form, setForm] = useState({
    category: 'DTSEN' as AiKnowledgeCategory,
    title: '',
    keywords: '',
    summary: '',
    content: '',
    official_source: '',
    presetKey: 'bansos',
    related_label: 'Buka Halaman Cek Bansos & DTSEN',
    is_active: true,
    sort_order: 10,
  });

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/ai-knowledge');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat basis pengetahuan AI.');
      setEntries(json.entries || []);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal memuat basis pengetahuan AI.', 'err');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const counts = useMemo(() => {
    const active = entries.filter((e) => e.is_active === 1).length;
    return {
      total: entries.length,
      active,
      inactive: entries.length - active,
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (categoryFilter !== 'Semua' && e.category !== categoryFilter) return false;
      if (statusFilter === 'active' && e.is_active !== 1) return false;
      if (statusFilter === 'inactive' && e.is_active === 1) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.keywords.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.official_source.toLowerCase().includes(q)
      );
    });
  }, [entries, search, categoryFilter, statusFilter]);

  const openCreateModal = () => {
    setEditing(null);
    setForm({
      category: 'DTSEN',
      title: '',
      keywords: '',
      summary: '',
      content: '',
      official_source: '',
      presetKey: 'bansos',
      related_label: 'Buka Halaman Cek Bansos & DTSEN',
      is_active: true,
      sort_order: entries.length + 1,
    });
    setModalOpen(true);
  };

  const openEditModal = (entry: AiKnowledgeEntry) => {
    setEditing(entry);
    const presetKey = findPresetKey(entry.related_route, entry.related_subtab);
    setForm({
      category: entry.category,
      title: entry.title,
      keywords: entry.keywords || '',
      summary: entry.summary || '',
      content: entry.content,
      official_source: entry.official_source || '',
      presetKey,
      related_label: entry.related_label || '',
      is_active: entry.is_active === 1,
      sort_order: entry.sort_order || 1,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      onNotify('Judul panduan dan isi materi juknis wajib diisi.', 'err');
      return;
    }

    const preset = ROUTE_PRESETS.find((p) => p.key === form.presetKey) || ROUTE_PRESETS[0];
    const payload = {
      category: form.category,
      title: form.title.trim(),
      keywords: form.keywords.trim(),
      summary: form.summary.trim(),
      content: form.content.trim(),
      official_source: form.official_source.trim(),
      related_route: preset.route,
      related_subtab: preset.subtab,
      related_label: preset.route ? (form.related_label.trim() || preset.defaultButtonLabel) : '',
      is_active: form.is_active ? 1 : 0,
      sort_order: Number(form.sort_order || 1),
    };

    setSaving(true);
    try {
      const res = await adminFetch(
        editing ? `/api/admin/ai-knowledge/${editing.id}` : '/api/admin/ai-knowledge',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan basis pengetahuan AI.');
      onNotify(editing ? 'Panduan AI berhasil diperbarui.' : 'Panduan AI baru berhasil ditambahkan.');
      setModalOpen(false);
      await loadEntries();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menyimpan panduan AI.', 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (entry: AiKnowledgeEntry) => {
    try {
      const res = await adminFetch(`/api/admin/ai-knowledge/${entry.id}/toggle`, {
        method: 'PATCH',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengubah status entri.');
      setEntries((prev) =>
        prev.map((item) => (item.id === entry.id ? { ...item, is_active: json.is_active } : item))
      );
      onNotify(json.is_active === 1 ? 'Panduan diaktifkan untuk dibaca AI.' : 'Panduan dinonaktifkan sementara.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal mengubah status.', 'err');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await adminFetch(`/api/admin/ai-knowledge/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus panduan.');
      setEntries((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      onNotify('Panduan basis pengetahuan AI berhasil dihapus.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menghapus panduan.', 'err');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & CTA */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#0F2744]">
            <BookOpen className="w-5 h-5 text-[#C59B27]" />
            <h2 className="text-lg font-bold">Basis Pengetahuan Asisten AI Warga</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
            Kelola materi juknis lokal seputar <strong>DTSEN</strong>, syarat <strong>Bansos</strong> (PKH, BPNT, PBI, KIP), layanan <strong>Adminduk</strong> (KTP, KK, NA, KIA), dan informasi <strong>Pemdes / Pemda Sumedang</strong> yang dijadikan rujukan utama oleh fitur Tanya AI Desa.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-lg transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#F3D578]" />
          <span>Tambah Panduan Juknis</span>
        </button>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total Panduan</p>
          <p className="text-2xl font-bold text-[#0F2744] font-mono-tabular mt-1">{counts.total}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Aktif Dibaca AI</p>
          <p className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-1">{counts.active}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Arsip / Nonaktif</p>
          <p className="text-2xl font-bold text-slate-600 font-mono-tabular mt-1">{counts.inactive}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul, kata kunci (dtsen, ktp, nikah, pkh...), atau isi juknis..."
              className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F2744]"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'active', label: 'Aktif' },
              { id: 'inactive', label: 'Nonaktif' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id as 'all' | 'active' | 'inactive')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === st.id
                    ? 'bg-white text-[#0F2744] shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-[#0F2744]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {(['Semua', ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-[#0F2744] text-white border-[#0F2744]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content List: Mobile Cards + Desktop Table */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          Memuat basis pengetahuan AI...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            Tidak ada panduan yang sesuai filter pencarian.
          </p>
          <p className="text-xs text-slate-500">
            Tambahkan entri panduan baru atau ubah filter kategori di atas.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredEntries.map((entry) => (
              <article key={entry.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#9A7410]">
                      {entry.category} · Urutan #{entry.sort_order}
                    </p>
                    <h3 className="text-sm font-bold text-[#0F2744] mt-0.5">{entry.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(entry)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border shrink-0 cursor-pointer ${
                      entry.is_active === 1
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {entry.is_active === 1 ? 'Aktif' : 'Nonaktif'}
                  </button>
                </div>

                {entry.summary && (
                  <p className="text-xs text-slate-600 leading-relaxed">{entry.summary}</p>
                )}

                {entry.official_source && (
                  <p className="text-[11px] text-slate-500">Rujukan: {entry.official_source}</p>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(entry)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(entry)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-md cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 w-16 text-center">Urut</th>
                    <th className="py-3 px-4">Materi Panduan &amp; Ringkasan</th>
                    <th className="py-3 px-4 w-44">Kategori &amp; Tautan</th>
                    <th className="py-3 px-4 w-28">Status</th>
                    <th className="py-3 px-4 w-36 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/60 align-top">
                      <td className="py-3.5 px-4 text-center font-mono-tabular text-slate-600">
                        {entry.sort_order}
                      </td>
                      <td className="py-3.5 px-4 space-y-1 max-w-xl">
                        <p className="font-semibold text-[#0F2744]">{entry.title}</p>
                        {entry.summary && (
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                            {entry.summary}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400">
                          {entry.official_source || 'Sumber lokal'} · Diperbarui {entry.updated_by}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 space-y-1 text-xs">
                        <p className="font-semibold text-slate-800">{entry.category}</p>
                        {entry.related_label && (
                          <p className="text-[11px] text-slate-500">{entry.related_label}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(entry)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                            entry.is_active === 1
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {entry.is_active === 1 && <Check className="w-3 h-3" />}
                          <span>{entry.is_active === 1 ? 'Aktif' : 'Nonaktif'}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(entry)}
                            className="p-2 text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                            title="Edit Panduan"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(entry)}
                            className="p-2 text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors cursor-pointer"
                            title="Hapus Panduan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3 sm:p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#0F2744] text-white flex items-center justify-between border-b-2 border-[#C59B27]">
              <h3 className="text-sm sm:text-base font-bold">
                {editing ? 'Edit Panduan Basis Pengetahuan AI' : 'Tambah Panduan Basis Pengetahuan AI'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-200 hover:text-white rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Topik *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as AiKnowledgeCategory }))}
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Urutan Prioritas
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.sort_order}
                    onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 1 }))}
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Panduan / Juknis *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Contoh: Jadwal Pelayanan Adminduk Keliling Kecamatan Sumedang Utara"
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kata Kunci Pencarian (pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={form.keywords}
                  onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                  placeholder="Contoh: dtsen, bansos, pkh, bpnt, desil, perlinsos"
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ringkasan Singkat (tampil pada direktori topik publik)
                </label>
                <input
                  type="text"
                  value={form.summary}
                  onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="Ringkasan 1–2 kalimat mengenai isi panduan ini..."
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Isi Lengkap Juknis, Syarat Berkas &amp; Alur Layanan *
                </label>
                <textarea
                  required
                  rows={8}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Tuliskan rincian persyaratan, alur pengurusan di RT/RW/Desa/Kecamatan/Dinas, serta catatan penting bagi warga..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instansi / Sumber Acuan Resmi
                </label>
                <input
                  type="text"
                  value={form.official_source}
                  onChange={(e) => setForm((f) => ({ ...f, official_source: e.target.value }))}
                  placeholder="Contoh: Disdukcapil Kab. Sumedang · Permendagri No. 108 Tahun 2019"
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tautan Layanan Portal Terkait
                  </label>
                  <select
                    value={form.presetKey}
                    onChange={(e) => {
                      const nextKey = e.target.value;
                      const preset = ROUTE_PRESETS.find((p) => p.key === nextKey);
                      setForm((f) => ({
                        ...f,
                        presetKey: nextKey,
                        related_label: preset?.defaultButtonLabel || '',
                      }));
                    }}
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {ROUTE_PRESETS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teks Tombol Tautan
                  </label>
                  <input
                    type="text"
                    disabled={form.presetKey === 'none'}
                    value={form.related_label}
                    onChange={(e) => setForm((f) => ({ ...f, related_label: e.target.value }))}
                    placeholder="Label tombol layanan..."
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-100"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-[#0F2744]"
                />
                <span className="text-xs font-medium text-slate-700">
                  Aktifkan agar materi ini dibaca oleh Asisten AI saat menjawab pertanyaan warga
                </span>
              </label>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Simpan Panduan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900">Hapus Panduan AI?</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Anda yakin ingin menghapus panduan <strong>{deleteTarget.title}</strong>? Materi ini tidak akan lagi menjadi referensi Asisten AI.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Hapus Panduan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
