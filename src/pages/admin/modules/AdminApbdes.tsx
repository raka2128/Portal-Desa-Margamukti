import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Wallet, X } from 'lucide-react';
import { adminFetch } from '../../../utils/adminApi';
import type { ApbdesItem } from '../../../types';

interface NotifyProps {
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

const PRESET_CATEGORIES: Record<'Pendapatan' | 'Belanja' | 'Pembiayaan', string[]> = {
  Pendapatan: [
    'Pendapatan Asli Desa (PADes)',
    'Dana Desa (APBN)',
    'Alokasi Dana Desa (ADD)',
    'Bagi Hasil Pajak & Retribusi',
    'Bantuan Keuangan Provinsi/Kabupaten',
    'Lain-lain Pendapatan Desa yang Sah',
  ],
  Belanja: [
    'Penyelenggaraan Pemerintahan Desa',
    'Pelaksanaan Pembangunan Desa',
    'Pembinaan Kemasyarakatan',
    'Pemberdayaan Masyarakat',
    'Penanggulangan Bencana & Darurat',
  ],
  Pembiayaan: [
    'Penerimaan Pembiayaan',
    'Pengeluaran Pembiayaan',
  ],
};

function formatRupiah(amount: number): string {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

export function AdminApbdesModule({ onNotify }: NotifyProps) {
  const [items, setItems] = useState<ApbdesItem[]>([]);
  const [yearFilter, setYearFilter] = useState<string>('2026');
  const [typeFilter, setTypeFilter] = useState<string>('Semua');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    fiscal_year: 2026,
    type: 'Belanja' as 'Pendapatan' | 'Belanja' | 'Pembiayaan',
    category: PRESET_CATEGORIES.Belanja[0],
    title: '',
    budget_amount: 0,
    realized_amount: 0,
    notes: '',
  });

  const load = () => {
    adminFetch('/api/admin/apbdes')
      .then((r) => r.json())
      .then((j) => {
        const list: ApbdesItem[] = j.items || [];
        setItems(list);
        if (list.length > 0 && !list.some((it) => String(it.fiscal_year) === yearFilter) && yearFilter !== 'Semua') {
          setYearFilter(String(list[0].fiscal_year));
        }
      });
  };

  useEffect(load, []);

  const availableYears = Array.from(new Set(items.map((i) => i.fiscal_year))).sort((a, b) => b - a);
  const filteredItems = items.filter((item) => {
    const matchYear = yearFilter === 'Semua' || String(item.fiscal_year) === yearFilter;
    const matchType = typeFilter === 'Semua' || item.type === typeFilter;
    return matchYear && matchType;
  });

  const summaryItems = yearFilter === 'Semua' ? items : items.filter((i) => String(i.fiscal_year) === yearFilter);
  const sumByType = (t: 'Pendapatan' | 'Belanja' | 'Pembiayaan') =>
    summaryItems
      .filter((i) => i.type === t)
      .reduce(
        (acc, cur) => ({
          budget: acc.budget + Number(cur.budget_amount || 0),
          realized: acc.realized + Number(cur.realized_amount || 0),
        }),
        { budget: 0, realized: 0 }
      );

  const pendapatanSum = sumByType('Pendapatan');
  const belanjaSum = sumByType('Belanja');
  const pembiayaanSum = sumByType('Pembiayaan');

  const openNew = () => {
    setEditingId(null);
    const defaultYear = yearFilter !== 'Semua' ? Number(yearFilter) : availableYears[0] || 2026;
    setForm({
      fiscal_year: defaultYear,
      type: 'Belanja',
      category: PRESET_CATEGORIES.Belanja[0],
      title: '',
      budget_amount: 0,
      realized_amount: 0,
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (item: ApbdesItem) => {
    setEditingId(item.id);
    setForm({
      fiscal_year: item.fiscal_year,
      type: item.type,
      category: item.category,
      title: item.title,
      budget_amount: item.budget_amount,
      realized_amount: item.realized_amount,
      notes: item.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/admin/apbdes/${editingId}` : '/api/admin/apbdes';
    const method = editingId ? 'PUT' : 'POST';
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      onNotify(json.error || 'Gagal menyimpan pos anggaran APBDes.', 'err');
      return;
    }
    setModalOpen(false);
    setYearFilter(String(form.fiscal_year));
    load();
    onNotify('Data APBDes berhasil disimpan dan diperbarui di portal publik.');
  };

  const handleDelete = async (id: number) => {
    const res = await adminFetch(`/api/admin/apbdes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      onNotify('Gagal menghapus item APBDes.', 'err');
      return;
    }
    load();
    onNotify('Pos anggaran APBDes dihapus.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">Pengelolaan Anggaran Desa (APBDes)</h2>
          <p className="text-xs text-slate-500">
            Kelola pos Pendapatan, Belanja per Bidang, dan Pembiayaan Desa untuk transparansi publik.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> Tambah Pos Anggaran
        </button>
      </div>

      {/* Ringkasan Anggaran Tahun Terpilih */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-700">Total Pendapatan ({yearFilter})</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg font-bold text-[#0F2744] font-mono-tabular">
            {formatRupiah(pendapatanSum.budget)}
          </p>
          <p className="text-xs text-slate-500 font-mono-tabular">
            Realisasi: {formatRupiah(pendapatanSum.realized)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#0F2744]">Total Belanja ({yearFilter})</span>
            <Wallet className="w-4 h-4 text-[#0F2744]" />
          </div>
          <p className="text-lg font-bold text-[#0F2744] font-mono-tabular">
            {formatRupiah(belanjaSum.budget)}
          </p>
          <p className="text-xs text-slate-500 font-mono-tabular">
            Realisasi: {formatRupiah(belanjaSum.realized)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#A67F17]">Pembiayaan ({yearFilter})</span>
            <Wallet className="w-4 h-4 text-[#C59B27]" />
          </div>
          <p className="text-lg font-bold text-[#0F2744] font-mono-tabular">
            {formatRupiah(pembiayaanSum.budget)}
          </p>
          <p className="text-xs text-slate-500 font-mono-tabular">
            Realisasi: {formatRupiah(pembiayaanSum.realized)}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setYearFilter('Semua')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border cursor-pointer ${
              yearFilter === 'Semua'
                ? 'bg-[#0F2744] text-white border-[#0F2744]'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            Semua Tahun
          </button>
          {availableYears.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYearFilter(String(y))}
              className={`px-3 py-1.5 text-xs font-mono-tabular font-semibold rounded-md border cursor-pointer ${
                yearFilter === String(y)
                  ? 'bg-[#0F2744] text-white border-[#0F2744]'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              TA {y}
            </button>
          ))}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
        >
          <option value="Semua">Semua Jenis Pos</option>
          <option value="Pendapatan">Pendapatan</option>
          <option value="Belanja">Belanja</option>
          <option value="Pembiayaan">Pembiayaan</option>
        </select>
      </div>

      {/* Mobile Cards (< md) */}
      <div className="md:hidden space-y-3">
        {filteredItems.map((item) => {
          const pct =
            item.budget_amount > 0
              ? Math.min(100, Math.round((item.realized_amount / item.budget_amount) * 100))
              : 0;
          return (
            <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-mono-tabular text-xs font-bold text-[#0F2744]">
                    TA {item.fiscal_year}
                  </span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="text-xs font-semibold text-slate-700">{item.type}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">{item.category}</p>
                </div>
                <span className="font-mono-tabular text-xs font-semibold text-[#0F2744] shrink-0">
                  {pct}%
                </span>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                {item.notes && <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-mono-tabular">
                <div>
                  <span className="block text-[11px] text-slate-500 font-sans">Anggaran</span>
                  <span className="font-semibold text-slate-800">{formatRupiah(item.budget_amount)}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 font-sans">Realisasi</span>
                  <span className="font-semibold text-[#0F2744]">{formatRupiah(item.realized_amount)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit Pos
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-600 hover:text-red-600 border border-slate-200 rounded-md cursor-pointer"
                  aria-label="Hapus Pos Anggaran"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
            Belum ada data pos anggaran APBDes untuk filter ini.
          </div>
        )}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Tahun</th>
                <th className="py-3 px-4">Jenis</th>
                <th className="py-3 px-4">Bidang / Kategori</th>
                <th className="py-3 px-4">Uraian Pos Anggaran</th>
                <th className="py-3 px-4 text-right">Anggaran</th>
                <th className="py-3 px-4 text-right">Realisasi</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredItems.map((item) => {
                const pct =
                  item.budget_amount > 0
                    ? Math.min(100, Math.round((item.realized_amount / item.budget_amount) * 100))
                    : 0;
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono-tabular font-semibold text-[#0F2744]">
                      {item.fiscal_year}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-700">{item.type}</td>
                    <td className="py-3 px-4 text-xs text-slate-700">{item.category}</td>
                    <td className="py-3 px-4">
                      <p className="text-xs sm:text-sm font-medium text-slate-900">{item.title}</p>
                      {item.notes && <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-xs whitespace-nowrap">
                      {formatRupiah(item.budget_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-xs whitespace-nowrap">
                      <div className="font-semibold text-[#0F2744]">{formatRupiah(item.realized_amount)}</div>
                      <div className="text-[11px] text-slate-500">{pct}% terserap</div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-slate-600 hover:text-[#0F2744] cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-600 hover:text-red-600 ml-1 cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    Belum ada data pos anggaran APBDes untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-xl w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-[#0F2744]">
                {editingId ? 'Edit Pos Anggaran APBDes' : 'Tambah Pos Anggaran APBDes'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 cursor-pointer"
                aria-label="Tutup modal APBDes"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Anggaran *</label>
                  <input
                    type="number"
                    required
                    min={2020}
                    max={2035}
                    value={form.fiscal_year}
                    onChange={(e) => setForm({ ...form, fiscal_year: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Pos *</label>
                  <select
                    value={form.type}
                    onChange={(e) => {
                      const nextType = e.target.value as 'Pendapatan' | 'Belanja' | 'Pembiayaan';
                      setForm({
                        ...form,
                        type: nextType,
                        category: PRESET_CATEGORIES[nextType][0],
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Pendapatan">Pendapatan</option>
                    <option value="Belanja">Belanja</option>
                    <option value="Pembiayaan">Pembiayaan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bidang / Kategori *</label>
                <input
                  required
                  list="apbdes-categories"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Pilih atau ketik nama bidang..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
                <datalist id="apbdes-categories">
                  {PRESET_CATEGORIES[form.type].map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Uraian Kegiatan / Pos *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Contoh: Peningkatan Jalan Lingkungan Blok Kebonkalapa"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pagu Anggaran (Rp) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.budget_amount}
                    onChange={(e) => setForm({ ...form, budget_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Realisasi (Rp) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.realized_amount}
                    onChange={(e) => setForm({ ...form, realized_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan / Keterangan</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Contoh: Tahap I & II tersalur / Progres fisik 85%"
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
                  Simpan Pos APBDes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
