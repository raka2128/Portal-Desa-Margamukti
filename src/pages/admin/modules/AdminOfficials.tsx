import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Network,
  Pencil,
  Plus,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { ImageWithFallback } from '../../../components/ImageWithFallback';
import { OrganizationChart } from '../../../components/OrganizationChart';
import { uploadImageFile } from '../../../utils/uploadImage';
import { adminFetch } from '../../../utils/adminApi';
import type { Official, User } from '../../../types';

interface AdminOfficialsProps {
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
  currentUser: User;
}

export function AdminOfficialsModule({ onNotify, currentUser }: AdminOfficialsProps) {
  const [officials, setOfficials] = useState<Official[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [orgChartModalOpen, setOrgChartModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyTteId, setBusyTteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    position: '',
    nip: '',
    sort_order: 1,
    photo_url: '',
    phone: '',
    bio: '',
    can_sign_letters: false,
  });

  const isSuperAdmin = currentUser.role === 'super_admin';

  const load = () => {
    adminFetch('/api/admin/officials')
      .then((r) => r.json())
      .then((j) => setOfficials(j.officials || []));
  };

  useEffect(load, []);

  const openNew = () => {
    setEditingId(null);
    setForm({
      name: '',
      position: '',
      nip: 'NIAP. ',
      sort_order: officials.length + 1,
      photo_url: '',
      phone: '',
      bio: '',
      can_sign_letters: false,
    });
    setModalOpen(true);
  };

  const openEdit = (o: Official) => {
    setEditingId(o.id);
    setForm({
      name: o.name,
      position: o.position,
      nip: o.nip,
      sort_order: o.sort_order,
      photo_url: o.photo_url,
      phone: o.phone,
      bio: o.bio,
      can_sign_letters: o.can_sign_letters === 1,
    });
    setModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      setForm((prev) => ({ ...prev, photo_url: url }));
      onNotify('Foto perangkat berhasil diunggah.');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Gagal unggah foto.', 'err');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/admin/officials/${editingId}` : '/api/admin/officials';
    const method = editingId ? 'PUT' : 'POST';
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      onNotify('Gagal menyimpan data perangkat desa.', 'err');
      return;
    }
    setModalOpen(false);
    load();
    onNotify('Data perangkat desa tersimpan.');
  };

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= officials.length) return;
    const reordered = [...officials];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(target, 0, moved);
    const items = reordered.map((item, i) => ({ id: item.id, sort_order: i + 1 }));
    await adminFetch('/api/admin/officials/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    load();
    onNotify('Urutan jabatan perangkat diperbarui.');
  };

  const handleDelete = async (id: number) => {
    await adminFetch(`/api/admin/officials/${id}`, { method: 'DELETE' });
    load();
    onNotify('Perangkat desa dihapus.');
  };

  const handleRequestTte = async (off: Official) => {
    setBusyTteId(off.id);
    try {
      const res = await adminFetch(`/api/admin/officials/${off.id}/tte/request`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onNotify(json.error || 'Gagal mengajukan aktivasi TTE.', 'err');
        return;
      }
      load();
      onNotify(`Pengajuan TTE untuk ${off.name} dikirim ke Super Admin.`);
    } finally {
      setBusyTteId(null);
    }
  };

  const handleVerifyTte = async (off: Official, decision: 'approved' | 'revoked') => {
    setBusyTteId(off.id);
    try {
      const res = await adminFetch(`/api/admin/officials/${off.id}/tte/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: decision === 'approved' ? 'approve' : 'revoke' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onNotify(json.error || 'Gagal memperbarui status TTE.', 'err');
        return;
      }
      load();
      onNotify(
        decision === 'approved'
          ? `TTE Digital ${off.name} disetujui (${json.tte_code}).`
          : `TTE Digital ${off.name} dicabut/dinonaktifkan.`
      );
    } finally {
      setBusyTteId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">
            Manajemen Perangkat Desa &amp; Tanda Tangan Digital (TTE)
          </h2>
          <p className="text-xs text-slate-500">
            Atur urutan jabatan (otomatis membentuk bagan organisasi), kewenangan penandatanganan surat, dan persetujuan TTE QR resmi oleh Super Admin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setOrgChartModalOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 py-2 text-xs font-semibold text-[#0F2744] bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
          >
            <Network className="w-4 h-4 text-[#A67F17]" /> Pratinjau &amp; Cetak Bagan
          </button>
          <button
            type="button"
            onClick={openNew}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Tambah Perangkat
          </button>
        </div>
      </div>

      <div className="no-print bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {officials.map((off, idx) => {
          const tteStatus = off.tte_status || 'none';
          const isBusy = busyTteId === off.id;
          return (
            <div key={off.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <span className="text-xs font-mono-tabular text-slate-400 w-6 pt-1 sm:pt-0 shrink-0">
                  #{idx + 1}
                </span>
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#0F2744] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {off.photo_url ? (
                    <ImageWithFallback src={off.photo_url} alt={off.name} className="w-full h-full object-cover" />
                  ) : (
                    off.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{off.name}</p>
                    {off.can_sign_letters === 1 && (
                      <span className="text-[11px] font-semibold text-[#0F2744] bg-slate-100 px-2 py-0.5 rounded">
                        Penanda Tangan Surat
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-[#A67F17]">{off.position}</p>
                  <p className="text-[11px] font-mono-tabular text-slate-500">
                    {off.nip}
                    {off.phone ? ` · WA: ${off.phone}` : ' · WA belum diisi'}
                  </p>

                  {/* TTE Status Strip */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                    {tteStatus === 'approved' && (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <QrCode className="w-3.5 h-3.5" />
                        TTE Aktif · {off.tte_code}
                      </span>
                    )}
                    {tteStatus === 'pending' && (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Menunggu Verifikasi Super Admin
                      </span>
                    )}
                    {tteStatus === 'revoked' && (
                      <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                        <XCircle className="w-3.5 h-3.5" />
                        TTE Dicabut
                      </span>
                    )}
                    {tteStatus === 'none' && (
                      <span className="text-slate-400">TTE belum diaktifkan</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                {/* TTE Workflow Buttons */}
                {(tteStatus === 'none' || tteStatus === 'revoked') && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleRequestTte(off)}
                    className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md disabled:opacity-50 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#A67F17]" />
                    {tteStatus === 'revoked' ? 'Ajukan Ulang TTE' : 'Ajukan TTE'}
                  </button>
                )}

                {isSuperAdmin && (tteStatus === 'pending' || tteStatus === 'none' || tteStatus === 'revoked') && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleVerifyTte(off, 'approved')}
                    className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Setujui TTE
                  </button>
                )}

                {isSuperAdmin && (tteStatus === 'approved' || tteStatus === 'pending') && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleVerifyTte(off, 'revoked')}
                    className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-md disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" /> {tteStatus === 'approved' ? 'Cabut TTE' : 'Tolak'}
                  </button>
                )}

                <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, -1)}
                    className="p-1.5 text-slate-500 hover:text-[#0F2744] disabled:opacity-30 cursor-pointer"
                    title="Naikkan Urutan"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === officials.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    className="p-1.5 text-slate-500 hover:text-[#0F2744] disabled:opacity-30 cursor-pointer"
                    title="Turunkan Urutan"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(off)}
                    className="p-1.5 text-slate-600 hover:text-[#0F2744] ml-1 cursor-pointer"
                    title="Edit Perangkat"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(off.id)}
                    className="p-1.5 text-slate-600 hover:text-red-600 cursor-pointer"
                    title="Hapus Perangkat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Official Modal */}
      {modalOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[92dvh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-[#0F2744]">
                {editingId ? 'Edit Perangkat Desa' : 'Tambah Perangkat Desa'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-slate-500 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jabatan *</label>
                  <input
                    required
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    placeholder="Contoh: Kaur Umum dan TU"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIAP</label>
                  <input
                    value={form.nip}
                    onChange={(e) => setForm({ ...form, nip: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">No. Telepon / WhatsApp</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="Contoh: 081220458801"
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.can_sign_letters}
                  onChange={(e) => setForm({ ...form, can_sign_letters: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <span>Berwenang menandatangani surat keterangan resmi (muncul di pilihan penanda tangan)</span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Foto Profil</label>
                <div className="flex items-center gap-3">
                  <input
                    value={form.photo_url}
                    onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                    placeholder="URL foto atau unggah file..."
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-md"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 border border-slate-300 rounded-md cursor-pointer hover:bg-slate-200">
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? 'Mengunggah...' : 'Unggah'}
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tugas Pokok / Profil Singkat</label>
                <textarea
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Organization Chart Preview & Print Modal */}
      {orgChartModalOpen && (
        <div className="print-modal-root fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="print-modal-card bg-white rounded-xl max-w-6xl w-full max-h-[94dvh] overflow-y-auto shadow-2xl">
            <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-[#0F2744]" />
                <h3 className="text-sm font-bold text-[#0F2744]">
                  Struktur Organisasi Pemerintah Desa Otomatis
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOrgChartModalOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 print:p-0">
              <OrganizationChart officials={officials} showPrintButton />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
