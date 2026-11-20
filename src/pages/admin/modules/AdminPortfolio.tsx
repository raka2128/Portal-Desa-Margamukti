import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  Compass,
  Eye,
  EyeOff,
  Handshake,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { adminFetch } from '../../../utils/adminApi';
import type { PortfolioItem, PortfolioSectionType, PortfolioSettings } from '../../../types';

interface NotifyProps {
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

const SECTION_META: Array<{
  type: PortfolioSectionType;
  label: string;
  shortLabel: string;
  desc: string;
  issuerLabel: string;
  issuerPlaceholder: string;
  impactPlaceholder: string;
  icon: typeof Sparkles;
}> = [
  {
    type: 'program_unggulan',
    label: 'Program Unggulan Desa',
    shortLabel: 'Program Unggulan',
    desc: 'Program prioritas dan inovasi pelayanan publik Pemerintah Desa.',
    issuerLabel: 'Pelaksana / Unit Penanggung Jawab',
    issuerPlaceholder: 'Contoh: Pemdes Margamukti · Pokja Posyandu',
    impactPlaceholder: 'Contoh: Layanan selesai di hari yang sama',
    icon: Sparkles,
  },
  {
    type: 'penghargaan',
    label: 'Kinerja & Penghargaan',
    shortLabel: 'Penghargaan',
    desc: 'Prestasi, penghargaan resmi, dan capaian kinerja pemerintahan desa.',
    issuerLabel: 'Lembaga Pemberi Penghargaan',
    issuerPlaceholder: 'Contoh: Kementerian Desa PDTT / Bupati Sumedang',
    impactPlaceholder: 'Contoh: Peringkat 1 Tingkat Kabupaten',
    icon: Award,
  },
  {
    type: 'sinergi',
    label: 'Sinergi Pemdes, Lembaga & Warga',
    shortLabel: 'Sinergi Lembaga',
    desc: 'Kolaborasi nyata bersama BPD, BUMDesa, LPM, PKK, karang taruna, dan mitra.',
    issuerLabel: 'Pihak / Lembaga yang Bersinergi',
    issuerPlaceholder: 'Contoh: BPD, LPM & Karang Taruna',
    impactPlaceholder: 'Contoh: Partisipasi gotong royong > 250 warga',
    icon: Handshake,
  },
  {
    type: 'potensi_unggulan',
    label: 'Potensi & Peluang Kemitraan',
    shortLabel: 'Potensi Unggulan',
    desc: 'Potensi ekonomi, UMKM, agrowisata, dan sektor unggulan untuk mitra eksternal.',
    issuerLabel: 'Penggerak / Mitra Potensial',
    issuerPlaceholder: 'Contoh: BUMDesa Mukti Mandiri & Kelompok Tani',
    impactPlaceholder: 'Contoh: Nilai tambah omzet UMKM +35%',
    icon: Compass,
  },
];

const EMPTY_SETTINGS: PortfolioSettings = {
  id: 1,
  portfolio_title: 'Portofolio Resmi Pemerintah Desa Margamukti',
  portfolio_subtitle: 'Dokumen Profil Kinerja, Potensi & Sinergi Pembangunan Desa',
  executive_summary: '',
  profile_narrative: '',
  demographic_narrative: '',
  synergy_narrative: '',
  idm_score: '',
  idm_status: 'Mandiri',
  sdgs_score: '',
  area_size: '',
  boundaries_north: '',
  boundaries_east: '',
  boundaries_south: '',
  boundaries_west: '',
  strategic_partners: '',
  closing_statement: '',
  updated_by: '',
  updated_at: '',
};

export function AdminPortfolioModule({ onNotify }: NotifyProps) {
  const [subTab, setSubTab] = useState<'narasi' | 'items'>('narasi');
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<PortfolioSettings>(EMPTY_SETTINGS);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [sectionFilter, setSectionFilter] = useState<PortfolioSectionType | 'all'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState({
    section_type: 'program_unggulan' as PortfolioSectionType,
    title: '',
    category: '',
    year_label: String(new Date().getFullYear()),
    issuer_or_partner: '',
    status_label: 'Berjalan',
    impact_summary: '',
    description: '',
    sort_order: 1,
    is_published: true,
  });

  const loadPortfolio = () => {
    setLoading(true);
    adminFetch('/api/admin/portfolio')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Gagal memuat data portofolio.');
        return json;
      })
      .then((json) => {
        if (json.settings) setSettingsForm(json.settings);
        setItems(Array.isArray(json.items) ? json.items : []);
      })
      .catch((err: unknown) => {
        onNotify(err instanceof Error ? err.message : 'Gagal memuat portofolio.', 'err');
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadPortfolio, []);

  const countsBySection = useMemo(() => {
    const counts: Record<PortfolioSectionType, number> = {
      program_unggulan: 0,
      penghargaan: 0,
      sinergi: 0,
      potensi_unggulan: 0,
    };
    for (const item of items) {
      if (counts[item.section_type] !== undefined) {
        counts[item.section_type] += 1;
      }
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (sectionFilter === 'all') return items;
    return items.filter((i) => i.section_type === sectionFilter);
  }, [items, sectionFilter]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await adminFetch('/api/admin/portfolio/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || 'Gagal menyimpan narasi portofolio.', 'err');
        return;
      }
      if (json.settings) setSettingsForm(json.settings);
      onNotify('Narasi & identitas portofolio pemerintah desa berhasil diperbarui.');
    } catch {
      onNotify('Gagal terhubung ke server saat menyimpan portofolio.', 'err');
    } finally {
      setSavingSettings(false);
    }
  };

  const openNewItem = (presetSection: PortfolioSectionType = 'program_unggulan') => {
    const nextSort = items.filter((i) => i.section_type === presetSection).length + 1;
    setEditingItemId(null);
    setItemForm({
      section_type: presetSection,
      title: '',
      category: '',
      year_label: String(new Date().getFullYear()),
      issuer_or_partner: '',
      status_label: presetSection === 'penghargaan' ? 'Diraih' : 'Aktif',
      impact_summary: '',
      description: '',
      sort_order: nextSort,
      is_published: true,
    });
    setModalOpen(true);
  };

  const openEditItem = (item: PortfolioItem) => {
    setEditingItemId(item.id);
    setItemForm({
      section_type: item.section_type,
      title: item.title,
      category: item.category || '',
      year_label: item.year_label || '',
      issuer_or_partner: item.issuer_or_partner || '',
      status_label: item.status_label || '',
      impact_summary: item.impact_summary || '',
      description: item.description || '',
      sort_order: item.sort_order || 1,
      is_published: item.is_published === 1,
    });
    setModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingItem(true);
    try {
      const url = editingItemId
        ? `/api/admin/portfolio/items/${editingItemId}`
        : '/api/admin/portfolio/items';
      const method = editingItemId ? 'PUT' : 'POST';
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemForm),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || 'Gagal menyimpan item portofolio.', 'err');
        return;
      }
      setModalOpen(false);
      loadPortfolio();
      onNotify(
        editingItemId
          ? 'Entri portofolio berhasil diperbarui.'
          : 'Entri baru portofolio berhasil ditambahkan.'
      );
    } catch {
      onNotify('Gagal terhubung ke server.', 'err');
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (id: number) => {
    try {
      const res = await adminFetch(`/api/admin/portfolio/items/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || 'Gagal menghapus entri portofolio.', 'err');
        return;
      }
      setConfirmDeleteId(null);
      loadPortfolio();
      onNotify('Entri portofolio telah dihapus.');
    } catch {
      onNotify('Gagal menghapus entri portofolio.', 'err');
    }
  };

  const activeSectionMeta =
    SECTION_META.find((s) => s.type === itemForm.section_type) || SECTION_META[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">
            Manajemen Portofolio Pemerintah Desa
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Susun dan perbarui dokumen portofolio resmi Desa Margamukti untuk pihak mitra, investor,
            atau instansi pemerintah (siap tayang web &amp; cetak A4/PDF).
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubTab('narasi')}
            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'narasi'
                ? 'bg-white text-[#0F2744] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Narasi, IDM &amp; Mitra
          </button>
          <button
            type="button"
            onClick={() => setSubTab('items')}
            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'items'
                ? 'bg-white text-[#0F2744] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Program, Penghargaan &amp; Sinergi ({items.length})
          </button>
        </div>
      </div>

      {/* Info sinkronisasi otomatis */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-start gap-2.5">
          <BookOpen className="w-4 h-4 text-[#0F2744] shrink-0 mt-0.5" />
          <span>
            Data <strong>Profil Desa</strong>, <strong>Statistik Kependudukan</strong>,{' '}
            <strong>Realisasi APBDes</strong>, <strong>Lembaga Desa (BPD/BUMDesa/LPM/PKK)</strong>,
            dan <strong>Proyek Pembangunan</strong> otomatis ditarik langsung ke tab{' '}
            <em>Portofolio Desa</em> di Portal Publik. Gunakan halaman ini untuk mengatur pengantar
            eksekutif, indikator IDM/SDGs, dan entri program unggulan/penghargaan.
          </span>
        </div>
        <a
          href="/?tab=portofolio#profil"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0F2744] bg-white border border-slate-300 hover:border-[#0F2744] rounded-md whitespace-nowrap shrink-0"
        >
          Pratinjau Portofolio Publik
        </a>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
          Memuat data portofolio pemerintah desa...
        </div>
      ) : subTab === 'narasi' ? (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6"
        >
          {/* Judul & Ringkasan Eksekutif */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0F2744] border-b border-slate-100 pb-2">
              1. Tajuk Dokumen &amp; Ringkasan Eksekutif
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Utama Portofolio *
                </label>
                <input
                  type="text"
                  required
                  value={settingsForm.portfolio_title}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, portfolio_title: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subjudul / Deskripsi Singkat
                </label>
                <input
                  type="text"
                  value={settingsForm.portfolio_subtitle}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, portfolio_subtitle: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ringkasan Eksekutif (Executive Summary) *
              </label>
              <textarea
                rows={3}
                required
                value={settingsForm.executive_summary}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, executive_summary: e.target.value })
                }
                placeholder="Sambutan singkat mengenai kesiapan tata kelola pemerintahan dan arah pembangunan desa..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
          </div>

          {/* Indikator Kemajuan & Wilayah */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0F2744] border-b border-slate-100 pb-2">
              2. Indikator Kemajuan (IDM &amp; SDGs) dan Batas Wilayah
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nilai IDM
                </label>
                <input
                  type="text"
                  value={settingsForm.idm_score}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, idm_score: e.target.value })
                  }
                  placeholder="Contoh: 0,8420"
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status IDM
                </label>
                <select
                  value={settingsForm.idm_status}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, idm_status: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  <option value="Mandiri">Desa Mandiri</option>
                  <option value="Maju">Desa Maju</option>
                  <option value="Berkembang">Desa Berkembang</option>
                  <option value="Tertinggal">Desa Tertinggal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Skor SDGs Desa
                </label>
                <input
                  type="text"
                  value={settingsForm.sdgs_score}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, sdgs_score: e.target.value })
                  }
                  placeholder="Contoh: 76,4 / 100"
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Luas Wilayah Administratif
                </label>
                <input
                  type="text"
                  value={settingsForm.area_size}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, area_size: e.target.value })
                  }
                  placeholder="Contoh: 412,6 Ha (4,12 km²)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Batas Utara
                </label>
                <input
                  type="text"
                  value={settingsForm.boundaries_north}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, boundaries_north: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Batas Timur
                </label>
                <input
                  type="text"
                  value={settingsForm.boundaries_east}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, boundaries_east: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Batas Selatan
                </label>
                <input
                  type="text"
                  value={settingsForm.boundaries_south}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, boundaries_south: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Batas Barat
                </label>
                <input
                  type="text"
                  value={settingsForm.boundaries_west}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, boundaries_west: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Narasi Pengantar */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0F2744] border-b border-slate-100 pb-2">
              3. Narasi Pengantar Per Bagian Portofolio
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pengantar Bagian Profil Desa
                </label>
                <textarea
                  rows={4}
                  value={settingsForm.profile_narrative}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, profile_narrative: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs leading-relaxed border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pengantar Bagian Kependudukan
                </label>
                <textarea
                  rows={4}
                  value={settingsForm.demographic_narrative}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, demographic_narrative: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs leading-relaxed border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pengantar Bagian Sinergi Kelembagaan
                </label>
                <textarea
                  rows={4}
                  value={settingsForm.synergy_narrative}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, synergy_narrative: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs leading-relaxed border border-slate-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Mitra Strategis & Penutup */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0F2744] border-b border-slate-100 pb-2">
              4. Jejaring Mitra Strategis &amp; Pernyataan Penutup Dokumen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Daftar Mitra Strategis (1 lembaga/instansi per baris)
                </label>
                <textarea
                  rows={5}
                  value={settingsForm.strategic_partners}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, strategic_partners: e.target.value })
                  }
                  placeholder="Pemerintah Kabupaten Sumedang&#10;Dinas PMD Kabupaten Sumedang&#10;..."
                  className="w-full px-3 py-2 text-xs leading-relaxed border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pernyataan Penutup &amp; Komitmen Kemitraan
                </label>
                <textarea
                  rows={5}
                  value={settingsForm.closing_statement}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, closing_statement: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs leading-relaxed border border-slate-300 rounded-md"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <span className="text-[11px] text-slate-500 font-mono-tabular">
              {settingsForm.updated_by
                ? `Terakhir diperbarui oleh ${settingsForm.updated_by} (${settingsForm.updated_at?.slice(0, 16) || ''})`
                : 'Belum ada perubahan tersimpan'}
            </span>
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] disabled:opacity-60 rounded-md cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#E5C158]" />
              {savingSettings ? 'Menyimpan...' : 'Simpan Narasi Portofolio'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          {/* Ringkasan 4 Bagian Item */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SECTION_META.map((sec) => {
              const Icon = sec.icon;
              const active = sectionFilter === sec.type;
              return (
                <button
                  key={sec.type}
                  type="button"
                  onClick={() => setSectionFilter(active ? 'all' : sec.type)}
                  className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0F2744] text-white border-[#0F2744]'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-[#0F2744]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-[#E5C158]' : 'text-[#A67F17]'
                      }`}
                    />
                    <span
                      className={`text-xs font-bold font-mono-tabular ${
                        active ? 'text-[#E5C158]' : 'text-[#0F2744]'
                      }`}
                    >
                      {countsBySection[sec.type]} Entri
                    </span>
                  </div>
                  <p className="text-xs font-bold mt-2">{sec.shortLabel}</p>
                  <p
                    className={`text-[11px] mt-1 line-clamp-2 ${
                      active ? 'text-slate-200' : 'text-slate-500'
                    }`}
                  >
                    {sec.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSectionFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border cursor-pointer ${
                  sectionFilter === 'all'
                    ? 'bg-[#0F2744] text-white border-[#0F2744]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                Semua Bagian ({items.length})
              </button>
              {SECTION_META.map((sec) => (
                <button
                  key={sec.type}
                  type="button"
                  onClick={() => setSectionFilter(sec.type)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border cursor-pointer ${
                    sectionFilter === sec.type
                      ? 'bg-[#0F2744] text-white border-[#0F2744]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {sec.shortLabel} ({countsBySection[sec.type]})
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                openNewItem(sectionFilter === 'all' ? 'program_unggulan' : sectionFilter)
              }
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#E5C158]" />
              Tambah Entri Portofolio
            </button>
          </div>

          {/* Daftar Entri */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Belum ada entri portofolio pada bagian ini. Klik &ldquo;Tambah Entri Portofolio&rdquo; untuk menambahkan.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const secMeta =
                    SECTION_META.find((s) => s.type === item.section_type) || SECTION_META[0];
                  const isDeleting = confirmDeleteId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-slate-50/70"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-semibold text-[#0F2744]">
                            {secMeta.shortLabel}
                          </span>
                          {item.category && (
                            <>
                              <span className="text-slate-400" aria-hidden="true">·</span>
                              <span className="text-[#A67F17] font-semibold">{item.category}</span>
                            </>
                          )}
                          {item.year_label && (
                            <>
                              <span className="text-slate-400" aria-hidden="true">·</span>
                              <span className="font-mono-tabular text-slate-500">
                                {item.year_label}
                              </span>
                            </>
                          )}
                          {item.status_label && (
                            <>
                              <span className="text-slate-400" aria-hidden="true">·</span>
                              <span className="text-emerald-700 font-semibold">
                                {item.status_label}
                              </span>
                            </>
                          )}
                          {item.is_published === 0 && (
                            <>
                              <span className="text-slate-400" aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                                <EyeOff className="w-3 h-3" /> Disembunyikan
                              </span>
                            </>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                        {item.description && (
                          <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1">
                          {item.issuer_or_partner && (
                            <span>
                              Mitra/Pemberi: <strong className="text-slate-700">{item.issuer_or_partner}</strong>
                            </span>
                          )}
                          {item.impact_summary && (
                            <span>
                              Capaian: <strong className="text-[#0F2744]">{item.impact_summary}</strong>
                            </span>
                          )}
                          <span className="font-mono-tabular">Urutan #{item.sort_order}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isDeleting ? (
                          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5 text-xs">
                            <span className="text-red-800 font-medium">Hapus entri ini?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="px-2 py-1 bg-red-700 text-white font-semibold rounded cursor-pointer"
                            >
                              Ya
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 bg-white border border-slate-300 text-slate-700 font-semibold rounded cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditItem(item)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="p-1.5 text-slate-500 hover:text-red-600 border border-slate-200 rounded-md cursor-pointer"
                              aria-label="Hapus entri portofolio"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Item Portofolio */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-2xl w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 space-y-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-[#0F2744]">
                {editingItemId ? 'Edit Entri Portofolio' : 'Tambah Entri Portofolio'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-500 cursor-pointer"
                aria-label="Tutup form portofolio"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bagian Portofolio *
                  </label>
                  <select
                    value={itemForm.section_type}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        section_type: e.target.value as PortfolioSectionType,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    {SECTION_META.map((s) => (
                      <option key={s.type} value={s.type}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tahun / Periode
                  </label>
                  <input
                    type="text"
                    value={itemForm.year_label}
                    onChange={(e) => setItemForm({ ...itemForm, year_label: e.target.value })}
                    placeholder="Contoh: 2025 atau 2024–2026"
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Program / Penghargaan / Sinergi / Potensi *
                </label>
                <input
                  type="text"
                  required
                  value={itemForm.title}
                  onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                  placeholder="Contoh: Margamukti Satu Pintu Digital (SIPANDU)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori / Bidang
                  </label>
                  <input
                    type="text"
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    placeholder="Contoh: Layanan Publik / Tata Kelola"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status / Tingkat
                  </label>
                  <input
                    type="text"
                    value={itemForm.status_label}
                    onChange={(e) => setItemForm({ ...itemForm, status_label: e.target.value })}
                    placeholder="Contoh: Berjalan / Tingkat Provinsi"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Urutan Tampil
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={itemForm.sort_order}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, sort_order: Number(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {activeSectionMeta.issuerLabel}
                  </label>
                  <input
                    type="text"
                    value={itemForm.issuer_or_partner}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, issuer_or_partner: e.target.value })
                    }
                    placeholder={activeSectionMeta.issuerPlaceholder}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ringkasan Dampak / Capaian
                  </label>
                  <input
                    type="text"
                    value={itemForm.impact_summary}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, impact_summary: e.target.value })
                    }
                    placeholder={activeSectionMeta.impactPlaceholder}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Detail
                </label>
                <textarea
                  rows={3}
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="Jelaskan mekanisme, sasaran penerima manfaat, dan hasil yang telah dicapai..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={itemForm.is_published}
                  onChange={(e) => setItemForm({ ...itemForm, is_published: e.target.checked })}
                  className="rounded border-slate-300"
                />
                {itemForm.is_published ? (
                  <Eye className="w-4 h-4 text-emerald-700" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                )}
                <span>Tampilkan pada Portofolio Publik &amp; Cetak A4</span>
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
                  disabled={savingItem}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] disabled:opacity-60 rounded-md cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-[#E5C158]" />
                  {savingItem ? 'Menyimpan...' : 'Simpan Entri'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
