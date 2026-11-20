import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { adminFetch } from '../../../utils/adminApi';
import type { InstitutionMember, InstitutionSlug, VillageInstitution } from '../../../types';

interface AdminInstitutionsProps {
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

const SLUG_ORDER: InstitutionSlug[] = ['bpd', 'bumdesa', 'lpm', 'pkk'];

export function AdminInstitutionsModule({ onNotify }: AdminInstitutionsProps) {
  const [institutions, setInstitutions] = useState<VillageInstitution[]>([]);
  const [activeSlug, setActiveSlug] = useState<InstitutionSlug>('bpd');
  const [loading, setLoading] = useState(true);
  const [savingInfo, setSavingInfo] = useState(false);

  // Editable form for selected institution
  const [infoForm, setInfoForm] = useState({
    name: '',
    short_name: '',
    tagline: '',
    legal_basis: '',
    description: '',
    office_location: '',
    contact_phone: '',
    tupoksi: [] as string[],
  });
  const [newTupoksiItem, setNewTupoksiItem] = useState('');

  // Member modal state
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [confirmDeleteMemberId, setConfirmDeleteMemberId] = useState<number | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: '',
    position: '',
    sort_order: 1,
    phone: '',
    notes: '',
  });

  const loadInstitutions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/institutions');
      if (!res.ok) {
        onNotify('Gagal memuat data lembaga desa.', 'err');
        return;
      }
      const json = await res.json();
      const list: VillageInstitution[] = json.institutions || [];
      setInstitutions(list);
    } catch {
      onNotify('Terjadi gangguan saat memuat data lembaga desa.', 'err');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadInstitutions();
  }, [loadInstitutions]);

  const currentInst = institutions.find((i) => i.slug === activeSlug) || institutions[0] || null;

  useEffect(() => {
    if (!currentInst) return;
    setInfoForm({
      name: currentInst.name || '',
      short_name: currentInst.short_name || '',
      tagline: currentInst.tagline || '',
      legal_basis: currentInst.legal_basis || '',
      description: currentInst.description || '',
      office_location: currentInst.office_location || '',
      contact_phone: currentInst.contact_phone || '',
      tupoksi: Array.isArray(currentInst.tupoksi) ? [...currentInst.tupoksi] : [],
    });
    setNewTupoksiItem('');
    setConfirmDeleteMemberId(null);
  }, [currentInst]);

  const handleSaveInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInst) return;
    setSavingInfo(true);
    try {
      const cleanTupoksi = infoForm.tupoksi.map((t) => t.trim()).filter(Boolean);
      const res = await adminFetch(`/api/admin/institutions/${currentInst.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...infoForm,
          tupoksi: cleanTupoksi,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onNotify(json.error || 'Gagal menyimpan profil lembaga desa.', 'err');
        return;
      }
      await loadInstitutions();
      onNotify(`Profil & Tupoksi ${infoForm.short_name || currentInst.short_name} tersimpan.`);
    } finally {
      setSavingInfo(false);
    }
  };

  const addTupoksiItem = () => {
    const val = newTupoksiItem.trim();
    if (!val) return;
    setInfoForm((prev) => ({ ...prev, tupoksi: [...prev.tupoksi, val] }));
    setNewTupoksiItem('');
  };

  const updateTupoksiItem = (idx: number, val: string) => {
    setInfoForm((prev) => ({
      ...prev,
      tupoksi: prev.tupoksi.map((item, i) => (i === idx ? val : item)),
    }));
  };

  const moveTupoksiItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= infoForm.tupoksi.length) return;
    const copy = [...infoForm.tupoksi];
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    setInfoForm((prev) => ({ ...prev, tupoksi: copy }));
  };

  const removeTupoksiItem = (idx: number) => {
    setInfoForm((prev) => ({
      ...prev,
      tupoksi: prev.tupoksi.filter((_, i) => i !== idx),
    }));
  };

  // Member CRUD
  const openNewMember = () => {
    if (!currentInst) return;
    setEditingMemberId(null);
    setMemberForm({
      name: '',
      position: '',
      sort_order: (currentInst.members?.length || 0) + 1,
      phone: '',
      notes: '',
    });
    setMemberModalOpen(true);
  };

  const openEditMember = (m: InstitutionMember) => {
    setEditingMemberId(m.id);
    setMemberForm({
      name: m.name,
      position: m.position,
      sort_order: m.sort_order,
      phone: m.phone || '',
      notes: m.notes || '',
    });
    setMemberModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInst) return;
    const url = editingMemberId
      ? `/api/admin/institution-members/${editingMemberId}`
      : '/api/admin/institution-members';
    const method = editingMemberId ? 'PUT' : 'POST';
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institution_id: currentInst.id,
        ...memberForm,
        sort_order: Number(memberForm.sort_order) || 1,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      onNotify(json.error || 'Gagal menyimpan data anggota lembaga.', 'err');
      return;
    }
    setMemberModalOpen(false);
    await loadInstitutions();
    onNotify(editingMemberId ? 'Data anggota lembaga diperbarui.' : 'Anggota lembaga ditambahkan.');
  };

  const handleDeleteMember = async (id: number) => {
    const res = await adminFetch(`/api/admin/institution-members/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      onNotify('Gagal menghapus anggota lembaga.', 'err');
      return;
    }
    setConfirmDeleteMemberId(null);
    await loadInstitutions();
    onNotify('Anggota lembaga dihapus.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">
            Manajemen Lembaga Desa (BPD, BUMDesa, LPM, PKK)
          </h2>
          <p className="text-xs text-slate-500">
            Kelola profil kelembagaan, rincian Tupoksi, dan susunan anggota setiap lembaga kemasyarakatan &amp; perwakilan desa.
          </p>
        </div>

        {/* Sub-tab Selector */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto no-scrollbar max-w-full">
          {SLUG_ORDER.map((slug) => {
            const inst = institutions.find((i) => i.slug === slug);
            const active = activeSlug === slug;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => setActiveSlug(slug)}
                className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active ? 'bg-white text-[#0F2744] shadow-sm' : 'text-slate-600 hover:text-[#0F2744]'
                }`}
              >
                {inst?.short_name || slug.toUpperCase()}
                {inst ? ` (${inst.members?.length || 0})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
          Memuat data lembaga desa...
        </div>
      )}

      {!loading && currentInst && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Column: Institution Profile & Tupoksi Editor */}
          <form
            onSubmit={handleSaveInstitution}
            className="xl:col-span-6 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#C59B27]" />
                <h3 className="text-sm font-semibold text-[#0F2744]">
                  Profil &amp; Tupoksi {currentInst.short_name}
                </h3>
              </div>
              <span className="text-[11px] font-mono-tabular text-slate-400 uppercase">
                /{currentInst.slug}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Resmi Lembaga *
                </label>
                <input
                  required
                  value={infoForm.name}
                  onChange={(e) => setInfoForm({ ...infoForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Singkatan *</label>
                <input
                  required
                  value={infoForm.short_name}
                  onChange={(e) => setInfoForm({ ...infoForm, short_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tagline / Peran Singkat
              </label>
              <input
                value={infoForm.tagline}
                onChange={(e) => setInfoForm({ ...infoForm, tagline: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dasar Hukum Pembentukan
              </label>
              <input
                value={infoForm.legal_basis}
                onChange={(e) => setInfoForm({ ...infoForm, legal_basis: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lokasi Sekretariat
                </label>
                <input
                  value={infoForm.office_location}
                  onChange={(e) => setInfoForm({ ...infoForm, office_location: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telepon / WA Sekretariat
                </label>
                <input
                  value={infoForm.contact_phone}
                  onChange={(e) => setInfoForm({ ...infoForm, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deskripsi Kelembagaan
              </label>
              <textarea
                rows={3}
                value={infoForm.description}
                onChange={(e) => setInfoForm({ ...infoForm, description: e.target.value })}
                className="w-full px-3 py-2 text-xs leading-relaxed border border-slate-300 rounded-md"
              />
            </div>

            {/* Tupoksi Dynamic List */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0F2744]">
                  Tugas Pokok &amp; Fungsi (Tupoksi) ({infoForm.tupoksi.length})
                </label>
              </div>

              <div className="space-y-2">
                {infoForm.tupoksi.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="font-mono-tabular text-xs font-semibold text-slate-500 pt-2 w-5 shrink-0">
                      {idx + 1}.
                    </span>
                    <input
                      value={item}
                      onChange={(e) => updateTupoksiItem(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                    />
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveTupoksiItem(idx, -1)}
                        className="p-1.5 text-slate-500 hover:text-[#0F2744] disabled:opacity-30 cursor-pointer"
                        title="Naikkan"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === infoForm.tupoksi.length - 1}
                        onClick={() => moveTupoksiItem(idx, 1)}
                        className="p-1.5 text-slate-500 hover:text-[#0F2744] disabled:opacity-30 cursor-pointer"
                        title="Turunkan"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTupoksiItem(idx)}
                        className="p-1.5 text-slate-500 hover:text-red-600 cursor-pointer"
                        title="Hapus poin Tupoksi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  value={newTupoksiItem}
                  onChange={(e) => setNewTupoksiItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTupoksiItem();
                    }
                  }}
                  placeholder="Tambah poin tugas pokok / fungsi baru..."
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
                <button
                  type="button"
                  onClick={addTupoksiItem}
                  className="inline-flex items-center gap-1 min-h-[38px] px-3 py-1.5 text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Poin
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={savingInfo}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {savingInfo ? 'Menyimpan...' : `Simpan Profil & Tupoksi ${currentInst.short_name}`}
              </button>
            </div>
          </form>

          {/* Right Column: Member Management */}
          <div className="xl:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#0F2744]" />
                <div>
                  <h3 className="text-sm font-semibold text-[#0F2744]">
                    Daftar Pengurus &amp; Anggota {currentInst.short_name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Total {currentInst.members?.length || 0} anggota terdaftar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={openNewMember}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Anggota
              </button>
            </div>

            {!currentInst.members || currentInst.members.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Belum ada anggota terdaftar pada {currentInst.short_name}. Klik &quot;Tambah Anggota&quot; untuk menambahkan.
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {currentInst.members.map((m, idx) => (
                    <div key={m.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-mono-tabular text-slate-400">#{m.sort_order || idx + 1}</p>
                          <p className="text-sm font-semibold text-[#0F2744]">{m.name}</p>
                          <p className="text-xs font-medium text-[#A67F17]">{m.position}</p>
                        </div>
                      </div>
                      {(m.phone || m.notes) && (
                        <div className="text-xs text-slate-600 space-y-0.5">
                          {m.phone && <p className="font-mono-tabular">WA/HP: {m.phone}</p>}
                          {m.notes && <p>{m.notes}</p>}
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openEditMember(m)}
                          className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        {confirmDeleteMemberId === m.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(m.id)}
                              className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-md cursor-pointer"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteMemberId(null)}
                              className="min-h-[40px] px-2.5 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteMemberId(m.id)}
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-500 hover:text-red-600 border border-slate-200 rounded-md cursor-pointer"
                            aria-label="Hapus anggota"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                        <th className="py-2.5 px-3 w-10">No</th>
                        <th className="py-2.5 px-3">Nama &amp; Jabatan</th>
                        <th className="py-2.5 px-3">Keterangan / Kontak</th>
                        <th className="py-2.5 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {currentInst.members.map((m, idx) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-mono-tabular text-slate-500">
                            {m.sort_order || idx + 1}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-semibold text-[#0F2744]">{m.name}</p>
                            <p className="text-[11px] font-medium text-[#A67F17]">{m.position}</p>
                          </td>
                          <td className="py-3 px-3">
                            {m.notes && <p className="text-slate-700">{m.notes}</p>}
                            <p className="font-mono-tabular text-[11px] text-slate-500">
                              {m.phone || (m.notes ? '' : '-')}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEditMember(m)}
                              className="p-1.5 text-slate-600 hover:text-[#0F2744] cursor-pointer"
                              title="Edit anggota"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteMemberId === m.id ? (
                              <span className="inline-flex items-center gap-1 ml-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMember(m.id)}
                                  className="px-2 py-1 text-[11px] font-semibold text-white bg-red-600 rounded cursor-pointer"
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteMemberId(null)}
                                  className="px-2 py-1 text-[11px] text-slate-600 border border-slate-300 rounded cursor-pointer"
                                >
                                  Batal
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteMemberId(m.id)}
                                className="p-1.5 text-slate-500 hover:text-red-600 ml-1 cursor-pointer"
                                title="Hapus anggota"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Member Modal */}
      {memberModalOpen && currentInst && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-lg w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-[#0F2744]">
                {editingMemberId
                  ? `Edit Anggota ${currentInst.short_name}`
                  : `Tambah Anggota ${currentInst.short_name}`}
              </h3>
              <button
                type="button"
                onClick={() => setMemberModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  required
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  placeholder="Contoh: H. Tatang Suhendar, S.Pd."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jabatan di {currentInst.short_name} *
                  </label>
                  <input
                    required
                    value={memberForm.position}
                    onChange={(e) => setMemberForm({ ...memberForm, position: e.target.value })}
                    placeholder="Contoh: Ketua / Sekretaris / Anggota"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Urutan</label>
                  <input
                    type="number"
                    min={1}
                    value={memberForm.sort_order}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, sort_order: Number(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  No. HP / WhatsApp
                </label>
                <input
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                  placeholder="0812xxxxxxxx"
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bidang / Wilayah Keterwakilan / Catatan
                </label>
                <input
                  value={memberForm.notes}
                  onChange={(e) => setMemberForm({ ...memberForm, notes: e.target.value })}
                  placeholder="Contoh: Keterwakilan Dusun Pawenang / Pokja II"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMemberModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
                >
                  Simpan Anggota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
