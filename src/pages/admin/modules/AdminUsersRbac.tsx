import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, KeyRound, MapPin, Pencil, Plus, ShieldCheck, Square, Trash2, UserCheck, X } from 'lucide-react';
import { adminFetch } from '../../../utils/adminApi';
import type { AdminPermission, ManagedUser, UserRole } from '../../../types';

interface NotifyProps {
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

interface OfficialOption {
  id: number;
  name: string;
  position: string;
}

interface RegionOption {
  id: number;
  dusun: string;
  blok: string;
  rw: string;
  rt: string;
  ketua_rw: string;
  ketua_rt: string;
}

const RT_RW_FIXED_PERMS: AdminPermission[] = ['penduduk', 'umkm', 'galeri'];
const SECRETARY_PRESET_PERMS: AdminPermission[] = [
  'overview',
  'surat',
  'penduduk',
  'agenda',
  'berita',
  'perangkat',
  'portofolio',
];

const PERMISSION_META: Array<{ key: AdminPermission; label: string; desc: string }> = [
  { key: 'overview', label: 'Dashboard Ringkasan', desc: 'Statistik utama & ringkasan aktivitas' },
  { key: 'surat', label: 'Surat & Kop Resmi', desc: 'Verifikasi surat warga, template & kop' },
  { key: 'penduduk', label: 'Data Penduduk', desc: 'CRUD penduduk, mutasi warga & impor Excel' },
  { key: 'wilayah', label: 'Wilayah Dusun/RT/RW', desc: 'Kelola daftar Dusun, Blok, RW & RT' },
  { key: 'perangkat', label: 'Perangkat Desa', desc: 'Struktur organisasi, profil aparatur & pengajuan TTE' },
  { key: 'lembaga', label: 'Lembaga Desa', desc: 'Kelola Tupoksi & anggota BPD, BUMDesa, LPM, dan PKK' },
  { key: 'apbdes', label: 'Transparansi APBDes', desc: 'Isi & edit pendapatan, belanja, pembiayaan & realisasi' },
  { key: 'agenda', label: 'Agenda, Ucapan & Kalender', desc: 'Kelola banner ucapan resmi Pemerintah Desa, kalender hari besar & agenda berjalan' },
  { key: 'berita', label: 'Berita & Komentar', desc: 'Publikasi artikel desa & moderasi komentar warga' },
  { key: 'umkm', label: 'Katalog UMKM', desc: 'Kelola produk & nomor WhatsApp UMKM' },
  { key: 'galeri', label: 'Galeri Kegiatan', desc: 'Upload dokumentasi kegiatan desa' },
  { key: 'peta', label: 'Peta & Lokasi', desc: 'Pin lokasi fasilitas desa di peta Leaflet' },
  { key: 'pengaduan', label: 'Kotak Masuk Warga', desc: 'Balas & tindak lanjuti pengaduan warga' },
  { key: 'peringatan', label: 'Peringatan Dini & Darurat', desc: 'Terbitkan banner siaga desa, pantau BMKG & tangani laporan darurat GPS' },
  { key: 'wa_blaster', label: 'WhatsApp Blaster', desc: 'Kirim siaran pesan WhatsApp ke Perangkat Desa, Kadus, Ketua RW & Ketua RT' },
  { key: 'ai_knowledge', label: 'Basis Pengetahuan AI', desc: 'Kelola materi juknis DTSEN, Bansos, Adminduk & Pemda untuk Asisten AI Warga' },
  { key: 'portofolio', label: 'Portofolio Desa', desc: 'Susun profil resmi, program unggulan, penghargaan & sinergi desa' },
  { key: 'pembangunan', label: 'Pembangunan Desa', desc: 'Input & pantau proyek pembangunan, anggaran, progress, foto & peta' },
  { key: 'pengaturan', label: 'Profil & Beranda Desa', desc: 'Visi misi, kontak & pengaturan beranda' },
];

function slugUsernamePart(text: string): string {
  return text
    .toLowerCase()
    .replace(/^dusun\s+/i, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12);
}

export function AdminUsersRbacModule({ onNotify }: NotifyProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [officials, setOfficials] = useState<OfficialOption[]>([]);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState({
    role: 'sub_admin' as Exclude<UserRole, 'super_admin'>,
    username: '',
    password: '',
    full_name: '',
    official_id: '' as string | number,
    scope_dusun: '',
    scope_rw: '',
    scope_rt: '',
    is_active: true,
    permissions: ['overview', 'surat'] as AdminPermission[],
  });

  const load = () => {
    adminFetch('/api/admin/users')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Gagal memuat daftar akun.');
        setUsers(json.users || []);
        setOfficials(json.officials || []);
        setRegions(json.regions || []);
      })
      .catch((err: unknown) => {
        onNotify(err instanceof Error ? err.message : 'Gagal memuat data akun.', 'err');
      });
  };

  useEffect(load, []);

  // Distinct RW groups from existing regions
  const rwOptions = useMemo(() => {
    const map = new Map<
      string,
      { key: string; dusun: string; rw: string; ketua_rw: string; rts: string[] }
    >();
    for (const rg of regions) {
      const key = `${rg.dusun}|||${rg.rw}`;
      const existing = map.get(key);
      if (existing) {
        if (!existing.rts.includes(rg.rt)) existing.rts.push(rg.rt);
      } else {
        map.set(key, {
          key,
          dusun: rg.dusun,
          rw: rg.rw,
          ketua_rw: rg.ketua_rw,
          rts: [rg.rt],
        });
      }
    }
    return Array.from(map.values());
  }, [regions]);

  const openNew = (presetRole: Exclude<UserRole, 'super_admin'> = 'sub_admin') => {
    setEditingUser(null);
    const firstRw = rwOptions[0];
    const firstRt = regions[0];
    if (presetRole === 'ketua_rw') {
      setForm({
        role: 'ketua_rw',
        username: firstRw ? `ketua_rw${firstRw.rw}_${slugUsernamePart(firstRw.dusun)}` : '',
        password: '',
        full_name: firstRw && firstRw.ketua_rw !== '-' ? firstRw.ketua_rw : '',
        official_id: '',
        scope_dusun: firstRw?.dusun || '',
        scope_rw: firstRw?.rw || '',
        scope_rt: '',
        is_active: true,
        permissions: [...RT_RW_FIXED_PERMS],
      });
    } else if (presetRole === 'ketua_rt') {
      setForm({
        role: 'ketua_rt',
        username: firstRt ? `ketua_rt${firstRt.rt}_rw${firstRt.rw}` : '',
        password: '',
        full_name: firstRt && firstRt.ketua_rt !== '-' ? firstRt.ketua_rt : '',
        official_id: '',
        scope_dusun: firstRt?.dusun || '',
        scope_rw: firstRt?.rw || '',
        scope_rt: firstRt?.rt || '',
        is_active: true,
        permissions: [...RT_RW_FIXED_PERMS],
      });
    } else {
      setForm({
        role: 'sub_admin',
        username: '',
        password: '',
        full_name: '',
        official_id: '',
        scope_dusun: '',
        scope_rw: '',
        scope_rt: '',
        is_active: true,
        permissions: ['overview', 'surat'],
      });
    }
    setModalOpen(true);
  };

  const openEdit = (u: ManagedUser) => {
    setEditingUser(u);
    const roleVal: Exclude<UserRole, 'super_admin'> =
      u.role === 'ketua_rw' || u.role === 'ketua_rt' ? u.role : 'sub_admin';
    setForm({
      role: roleVal,
      username: u.username,
      password: '',
      full_name: u.full_name,
      official_id: u.official_id ?? '',
      scope_dusun: u.scope_dusun || '',
      scope_rw: u.scope_rw || '',
      scope_rt: u.scope_rt || '',
      is_active: u.is_active === 1,
      permissions: roleVal === 'sub_admin' ? [...u.permissions] : [...RT_RW_FIXED_PERMS],
    });
    setModalOpen(true);
  };

  const handleChangeRole = (nextRole: Exclude<UserRole, 'super_admin'>) => {
    if (nextRole === 'ketua_rw') {
      const selectedRw =
        rwOptions.find((o) => o.dusun === form.scope_dusun && o.rw === form.scope_rw) || rwOptions[0];
      setForm((prev) => ({
        ...prev,
        role: 'ketua_rw',
        official_id: '',
        scope_dusun: selectedRw?.dusun || '',
        scope_rw: selectedRw?.rw || '',
        scope_rt: '',
        permissions: [...RT_RW_FIXED_PERMS],
        full_name:
          !editingUser && selectedRw && selectedRw.ketua_rw !== '-'
            ? selectedRw.ketua_rw
            : prev.full_name,
        username:
          !editingUser && selectedRw
            ? `ketua_rw${selectedRw.rw}_${slugUsernamePart(selectedRw.dusun)}`
            : prev.username,
      }));
    } else if (nextRole === 'ketua_rt') {
      const selectedRt =
        regions.find(
          (r) => r.dusun === form.scope_dusun && r.rw === form.scope_rw && r.rt === form.scope_rt
        ) || regions[0];
      setForm((prev) => ({
        ...prev,
        role: 'ketua_rt',
        official_id: '',
        scope_dusun: selectedRt?.dusun || '',
        scope_rw: selectedRt?.rw || '',
        scope_rt: selectedRt?.rt || '',
        permissions: [...RT_RW_FIXED_PERMS],
        full_name:
          !editingUser && selectedRt && selectedRt.ketua_rt !== '-'
            ? selectedRt.ketua_rt
            : prev.full_name,
        username:
          !editingUser && selectedRt
            ? `ketua_rt${selectedRt.rt}_rw${selectedRt.rw}`
            : prev.username,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        role: 'sub_admin',
        scope_dusun: '',
        scope_rw: '',
        scope_rt: '',
        permissions: prev.permissions.length > 0 ? prev.permissions : ['overview', 'surat'],
      }));
    }
  };

  const handleSelectRwScope = (key: string) => {
    const [dusun, rw] = key.split('|||');
    const found = rwOptions.find((o) => o.dusun === dusun && o.rw === rw);
    setForm((prev) => ({
      ...prev,
      scope_dusun: dusun || '',
      scope_rw: rw || '',
      scope_rt: '',
      full_name: !editingUser && found && found.ketua_rw !== '-' ? found.ketua_rw : prev.full_name,
      username:
        !editingUser && found
          ? `ketua_rw${found.rw}_${slugUsernamePart(found.dusun)}`
          : prev.username,
    }));
  };

  const handleSelectRtScope = (regionIdStr: string) => {
    const found = regions.find((r) => String(r.id) === regionIdStr);
    if (!found) return;
    setForm((prev) => ({
      ...prev,
      scope_dusun: found.dusun,
      scope_rw: found.rw,
      scope_rt: found.rt,
      full_name: !editingUser && found.ketua_rt !== '-' ? found.ketua_rt : prev.full_name,
      username: !editingUser ? `ketua_rt${found.rt}_rw${found.rw}` : prev.username,
    }));
  };

  const togglePerm = (perm: AdminPermission) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const handleSelectOfficial = (val: string) => {
    const idNum = val ? Number(val) : '';
    const found = officials.find((o) => o.id === idNum);
    const isSecretary = Boolean(found && /sekretaris/i.test(found.position));
    setForm((prev) => ({
      ...prev,
      official_id: idNum,
      full_name: !editingUser && found ? found.name : prev.full_name || found?.name || '',
      permissions:
        !editingUser && isSecretary ? [...SECRETARY_PRESET_PERMS] : prev.permissions,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
    const method = editingUser ? 'PUT' : 'POST';
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        official_id: form.role === 'sub_admin' && form.official_id ? Number(form.official_id) : null,
        permissions: form.role === 'sub_admin' ? form.permissions : [...RT_RW_FIXED_PERMS],
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      onNotify(json.error || 'Gagal menyimpan akun.', 'err');
      return;
    }
    setModalOpen(false);
    load();
    onNotify(editingUser ? 'Akun dan wewenang berhasil diperbarui.' : 'Akun baru berhasil dibuat.');
  };

  const handleDelete = async (u: ManagedUser) => {
    const res = await adminFetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) {
      onNotify(json.error || 'Gagal menghapus akun.', 'err');
      return;
    }
    load();
    onNotify(`Akun @${u.username} telah dihapus.`);
  };

  const isEditingPrimarySuperAdmin = editingUser?.role === 'super_admin' || editingUser?.username === 'admin';
  const selectedRtRegionId =
    regions.find(
      (r) => r.dusun === form.scope_dusun && r.rw === form.scope_rw && r.rt === form.scope_rt
    )?.id ?? '';
  const selectedRwKey = form.scope_dusun && form.scope_rw ? `${form.scope_dusun}|||${form.scope_rw}` : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">
            Manajemen Akun Perangkat, Ketua RT/RW & Wewenang (RBAC)
          </h2>
          <p className="text-xs text-slate-500">
            Super Admin dapat membuat akun Sub-Admin Perangkat Desa maupun akun Ketua RT dan Ketua RW berbasis wilayah tugas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => openNew('ketua_rt')}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[44px] text-xs font-semibold text-[#0F2744] bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5 text-[#A67F17]" /> Akun Ketua RT/RW
          </button>
          <button
            type="button"
            onClick={() => openNew('sub_admin')}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Akun Sub-Admin
          </button>
        </div>
      </div>

      {/* Mobile Cards (< md) */}
      <div className="md:hidden space-y-3">
        {users.map((u) => {
          const isSuper = u.role === 'super_admin';
          const isRw = u.role === 'ketua_rw';
          const isRt = u.role === 'ketua_rt';
          const roleLabel = isSuper
            ? 'Super Admin'
            : isRw
            ? 'Ketua RW'
            : isRt
            ? 'Ketua RT'
            : 'Sub-Admin Perangkat';

          return (
            <div key={u.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-[#0F2744]">{u.full_name}</div>
                  <div className="text-xs font-mono-tabular text-slate-500">
                    @{u.username}
                    {u.official_position ? ` · ${u.official_position}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`block text-xs font-semibold ${
                      isSuper ? 'text-[#A67F17]' : isRw || isRt ? 'text-emerald-800' : 'text-[#0F2744]'
                    }`}
                  >
                    {roleLabel}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      u.is_active === 1 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {u.is_active === 1 ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                {isSuper ? (
                  <span className="font-medium text-slate-600">
                    Akses Penuh (Seluruh Modul + Kelola Akun)
                  </span>
                ) : isRt || isRw ? (
                  <div className="space-y-1">
                    <div className="font-semibold text-[#0F2744] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#C59B27] shrink-0" />
                      <span>
                        {isRt
                          ? `Penduduk RT ${u.scope_rt} / RW ${u.scope_rw} (${u.scope_dusun})`
                          : `Penduduk Seluruh RT di RW ${u.scope_rw} (${u.scope_dusun})`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Data Penduduk &amp; Mutasi (wilayah tugas) · UMKM · Galeri
                    </p>
                  </div>
                ) : u.permissions.length === 0 ? (
                  <span className="text-red-600">Belum ada izin modul</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {u.permissions.map((permKey) => {
                      const meta = PERMISSION_META.find((m) => m.key === permKey);
                      return (
                        <span
                          key={permKey}
                          className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-medium text-slate-700"
                        >
                          {meta?.label || permKey}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => openEdit(u)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" /> Atur Wewenang / Edit
                </button>
                {!isSuper && (
                  <button
                    type="button"
                    onClick={() => handleDelete(u)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-red-600 border border-slate-200 rounded-md cursor-pointer"
                    aria-label="Hapus Akun"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Accounts Table (>= md) */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Akun & Penugasan</th>
                <th className="py-3 px-4">Peran</th>
                <th className="py-3 px-4">Wewenang & Isolasi Wilayah</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {users.map((u) => {
                const isSuper = u.role === 'super_admin';
                const isRw = u.role === 'ketua_rw';
                const isRt = u.role === 'ketua_rt';
                const roleLabel = isSuper
                  ? 'Super Admin'
                  : isRw
                  ? 'Ketua RW'
                  : isRt
                  ? 'Ketua RT'
                  : 'Sub-Admin Perangkat';

                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#0F2744]">{u.full_name}</div>
                      <div className="text-xs font-mono-tabular text-slate-500">
                        @{u.username}
                        {u.official_position ? ` · ${u.official_position}` : ''}
                        {isRt && u.scope_dusun
                          ? ` · RT ${u.scope_rt} / RW ${u.scope_rw}, ${u.scope_dusun}`
                          : ''}
                        {isRw && u.scope_dusun ? ` · RW ${u.scope_rw}, ${u.scope_dusun}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold ${
                          isSuper ? 'text-[#A67F17]' : isRw || isRt ? 'text-emerald-800' : 'text-[#0F2744]'
                        }`}
                      >
                        {roleLabel}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700 max-w-md">
                      {isSuper ? (
                        <span className="font-medium text-slate-600">
                          Akses Penuh (Semua 14 Modul + Kelola Akun)
                        </span>
                      ) : isRt || isRw ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-[#0F2744] flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#C59B27] shrink-0" />
                            <span>
                              {isRt
                                ? `Penduduk RT ${u.scope_rt} / RW ${u.scope_rw} (${u.scope_dusun})`
                                : `Penduduk Seluruh RT di RW ${u.scope_rw} (${u.scope_dusun})`}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Data Penduduk & Mutasi (khusus wilayah tugas) · Katalog UMKM (Penuh) · Galeri Kegiatan (Penuh)
                          </p>
                        </div>
                      ) : u.permissions.length === 0 ? (
                        <span className="text-red-600">Belum ada izin modul</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {u.permissions.map((permKey) => {
                            const meta = PERMISSION_META.find((m) => m.key === permKey);
                            return (
                              <span
                                key={permKey}
                                className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-medium text-slate-700"
                              >
                                {meta?.label || permKey}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs font-semibold">
                      {u.is_active === 1 ? (
                        <span className="text-emerald-700">Aktif</span>
                      ) : (
                        <span className="text-red-600">Nonaktif</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                        title="Atur Wewenang / Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      {!isSuper && (
                        <button
                          type="button"
                          onClick={() => handleDelete(u)}
                          className="p-1.5 text-slate-500 hover:text-red-600 ml-1.5 cursor-pointer"
                          title="Hapus Akun"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Create / Edit User */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-2xl w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 space-y-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-5 h-5 text-[#C59B27] shrink-0" />
                <h3 className="text-base font-semibold text-[#0F2744] truncate">
                  {editingUser
                    ? `Edit Akun & Wewenang (@${editingUser.username})`
                    : 'Buat Akun Pengurus Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
                aria-label="Tutup modal akun"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {!isEditingPrimarySuperAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tipe Peran Akun *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'sub_admin', label: 'Sub-Admin Perangkat', sub: 'Izin modul fleksibel' },
                      { id: 'ketua_rw', label: 'Ketua RW', sub: 'Cakupan seluruh RT di RW' },
                      { id: 'ketua_rt', label: 'Ketua RT', sub: 'Cakupan khusus 1 RT' },
                    ].map((opt) => {
                      const active = form.role === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleChangeRole(opt.id as Exclude<UserRole, 'super_admin'>)}
                          className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#0F2744] text-white border-[#0F2744]'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <p className="text-xs font-semibold">{opt.label}</p>
                          <p className={`text-[11px] mt-0.5 ${active ? 'text-slate-200' : 'text-slate-500'}`}>
                            {opt.sub}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!isEditingPrimarySuperAdmin && form.role === 'sub_admin' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tautkan ke Perangkat Desa (Opsional)
                    </label>
                    <select
                      value={form.official_id}
                      onChange={(e) => handleSelectOfficial(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      <option value="">-- Tidak ditautkan / Operator Umum --</option>
                      {officials.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.position})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!isEditingPrimarySuperAdmin && form.role === 'ketua_rw' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pilih Wilayah RW yang Dikepalai (dari Daftar Wilayah Desa) *
                    </label>
                    <select
                      required
                      value={selectedRwKey}
                      onChange={(e) => handleSelectRwScope(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      <option value="">-- Pilih Dusun & RW --</option>
                      {rwOptions.map((rwOpt) => (
                        <option key={rwOpt.key} value={rwOpt.key}>
                          {rwOpt.dusun} · RW {rwOpt.rw} (Mencakup RT {rwOpt.rts.join(', ')})
                          {rwOpt.ketua_rw && rwOpt.ketua_rw !== '-' ? ` — Ketua RW: ${rwOpt.ketua_rw}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!isEditingPrimarySuperAdmin && form.role === 'ketua_rt' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pilih Wilayah RT yang Dikepalai (dari Daftar Wilayah Desa) *
                    </label>
                    <select
                      required
                      value={selectedRtRegionId}
                      onChange={(e) => handleSelectRtScope(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      <option value="">-- Pilih Dusun, RW & RT --</option>
                      {regions.map((rg) => (
                        <option key={rg.id} value={rg.id}>
                          {rg.dusun} · {rg.blok} (RT {rg.rt} / RW {rg.rw})
                          {rg.ketua_rt && rg.ketua_rt !== '-' ? ` — Ketua RT: ${rg.ketua_rt}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap Pemilik Akun *
                  </label>
                  <input
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder={
                      form.role === 'ketua_rt'
                        ? 'Contoh: Bapak Endang (Ketua RT 01)'
                        : form.role === 'ketua_rw'
                        ? 'Contoh: Bapak Ujang Suryana (Ketua RW 01)'
                        : 'Contoh: Dadan Ramdani, S.E.'
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Username Login *</label>
                  <input
                    required
                    disabled={Boolean(editingUser)}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder={form.role === 'ketua_rt' ? 'ketua_rt01_rw01' : 'kaur_keuangan'}
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md disabled:bg-slate-100"
                  />
                </div>

                <div className={form.role === 'sub_admin' ? '' : 'sm:col-span-2'}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-[#C59B27]" />
                    {editingUser ? 'Password Baru (opsional)' : 'Password Akun *'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editingUser ? 'Kosongkan jika tidak diganti' : 'Minimal 4 karakter'}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              {!isEditingPrimarySuperAdmin && (form.role === 'ketua_rt' || form.role === 'ketua_rw') && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-[#0F2744]">
                    Hak Akses Otomatis Akun {form.role === 'ketua_rt' ? 'Ketua RT' : 'Ketua RW'}
                  </p>
                  <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                    <li>
                      <strong>Data Penduduk &amp; Mutasi Warga:</strong> Hanya dapat melihat, menambah, dan mencatat mutasi (pindah masuk, pindah keluar, meninggal, bayi baru lahir) untuk penduduk{' '}
                      <span className="font-semibold text-[#0F2744]">
                        {form.role === 'ketua_rt'
                          ? `RT ${form.scope_rt || '-'} / RW ${form.scope_rw || '-'}, ${form.scope_dusun || '-'}`
                          : `seluruh RT di RW ${form.scope_rw || '-'}, ${form.scope_dusun || '-'}`}
                      </span>
                      .
                    </li>
                    <li>
                      <strong>Katalog UMKM &amp; Galeri Kegiatan:</strong> Akses kelola penuh (lihat, tambah, edit, hapus) untuk promosi UMKM warga dan dokumentasi kegiatan.
                    </li>
                    <li className="text-slate-500">
                      Modul pemerintahan lainnya (APBDes, Surat Resmi, Pengaturan, RBAC) tetap terkunci.
                    </li>
                  </ul>
                </div>
              )}

              {!isEditingPrimarySuperAdmin && form.role === 'sub_admin' && (
                <>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <p className="text-xs font-semibold text-[#0F2744]">
                        Checklist Izin Spesifik per Modul Menu Dashboard
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Hanya modul yang dicentang yang muncul di sidebar &amp; dapat diakses akun ini.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, permissions: [...SECRETARY_PRESET_PERMS] })
                        }
                        className="px-2.5 py-1 text-[11px] font-semibold text-[#0F2744] bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded cursor-pointer"
                        title="Terapkan paket wewenang Sekretaris Desa termasuk pengelolaan Ucapan Resmi & Kalender"
                      >
                        Preset Sekretaris Desa
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, permissions: PERMISSION_META.map((m) => m.key) })
                        }
                        className="text-xs font-semibold text-[#0F2744] hover:underline cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, permissions: ['overview'] })}
                        className="text-xs font-semibold text-slate-600 hover:underline cursor-pointer"
                      >
                        Reset Minimal
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PERMISSION_META.map((perm) => {
                      const checked = form.permissions.includes(perm.key);
                      return (
                        <button
                          key={perm.key}
                          type="button"
                          onClick={() => togglePerm(perm.key)}
                          className={`text-left p-3 rounded-lg border transition-colors flex items-start gap-2.5 cursor-pointer ${
                            checked
                              ? 'bg-[#0F2744]/5 border-[#0F2744]'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-[#0F2744] shrink-0 mt-0.5" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900">{perm.label}</p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{perm.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {!isEditingPrimarySuperAdmin && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <UserCheck className="w-4 h-4 text-emerald-700" />
                    Status Akun Aktif (diizinkan login ke dashboard)
                  </label>
                </div>
              )}

              {isEditingPrimarySuperAdmin && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  Akun Super Admin utama selalu memiliki seluruh wewenang modul dan status aktif.
                </div>
              )}

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
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer"
                >
                  Simpan Akun &amp; Wewenang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

