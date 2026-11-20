import { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CloudRain,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Siren,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { getSeverityMeta } from '../../../components/EarlyWarningSection';
import { EmergencyTrendChart } from '../../../components/EmergencyTrendChart';
import { adminFetch } from '../../../utils/adminApi';
import type {
  BmkgLivePayload,
  Complaint,
  EarlyWarning,
  EarlyWarningSeverity,
} from '../../../types';

interface NotifyProps {
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

const WARNING_CATEGORIES = [
  'Cuaca Ekstrem',
  'Banjir & Luapan Sungai',
  'Tanah Longsor',
  'Gempabumi',
  'Kebakaran Lahan / Permukiman',
  'Gangguan Akses Jalan / Infrastruktur',
  'Informasi Kedaruratan Desa',
];

export function AdminEarlyWarningModule({ onNotify }: NotifyProps) {
  const [tab, setTab] = useState<'warnings' | 'reports' | 'analytics'>('warnings');
  const [warnings, setWarnings] = useState<EarlyWarning[]>([]);
  const [emergencyReports, setEmergencyReports] = useState<Complaint[]>([]);
  const [bmkg, setBmkg] = useState<BmkgLivePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: '',
    category: 'Cuaca Ekstrem',
    severity: 'waspada' as EarlyWarningSeverity,
    affected_area: 'Seluruh Wilayah Desa Margamukti',
    description: '',
    instruction: '',
    emergency_contact: '',
    is_active: true,
  });

  const load = () => {
    setLoading(true);
    adminFetch('/api/admin/early-warnings')
      .then((r) => r.json())
      .then((j) => {
        setWarnings(j.warnings || []);
        setEmergencyReports(j.emergencyReports || []);
        setBmkg(j.bmkg || null);
      })
      .catch(() => onNotify('Gagal memuat data peringatan dini.', 'err'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openNew = () => {
    setEditingId(null);
    setForm({
      title: '',
      category: 'Cuaca Ekstrem',
      severity: 'waspada',
      affected_area: 'Seluruh Wilayah Desa Margamukti',
      description: '',
      instruction: '',
      emergency_contact: '',
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (w: EarlyWarning) => {
    setEditingId(w.id);
    setForm({
      title: w.title,
      category: w.category,
      severity: w.severity,
      affected_area: w.affected_area,
      description: w.description,
      instruction: w.instruction,
      emergency_contact: w.emergency_contact,
      is_active: w.is_active === 1,
    });
    setModalOpen(true);
  };

  const openPromoteFromReport = (r: Complaint) => {
    const cleanSubject = r.subject.replace(/^\[DARURAT\]\s*/i, '');
    setEditingId(null);
    setForm({
      title: `Peringatan ${cleanSubject}`,
      category: 'Informasi Kedaruratan Desa',
      severity: 'siaga',
      affected_area:
        r.latitude !== null && r.latitude !== undefined && r.longitude !== null && r.longitude !== undefined
          ? `Sekitar Koordinat ${r.latitude}, ${r.longitude}`
          : 'Wilayah Desa Margamukti',
      description: r.message,
      instruction: 'Warga di sekitar lokasi diimbau waspada dan mengikuti arahan petugas posko desa.',
      emergency_contact: '',
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/admin/early-warnings/${editingId}` : '/api/admin/early-warnings';
    const method = editingId ? 'PUT' : 'POST';
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      onNotify(json.error || 'Gagal menyimpan peringatan dini.', 'err');
      return;
    }
    setModalOpen(false);
    load();
    onNotify(editingId ? 'Peringatan dini diperbarui.' : 'Peringatan dini baru diterbitkan.');
  };

  const handleToggle = async (w: EarlyWarning) => {
    const res = await adminFetch(`/api/admin/early-warnings/${w.id}/toggle`, { method: 'PATCH' });
    if (res.ok) {
      load();
      onNotify(w.is_active === 1 ? 'Peringatan dinonaktifkan.' : 'Peringatan diaktifkan pada portal warga.');
    }
  };

  const handleDelete = async (id: number) => {
    await adminFetch(`/api/admin/early-warnings/${id}`, { method: 'DELETE' });
    load();
    onNotify('Peringatan dini dihapus.');
  };

  const updateReportStatus = async (c: Complaint, status: Complaint['status'], admin_reply: string) => {
    const res = await adminFetch(`/api/admin/complaints/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_reply }),
    });
    if (res.ok) {
      load();
      onNotify('Status laporan darurat diperbarui.');
    } else {
      onNotify('Gagal memperbarui status laporan darurat.', 'err');
    }
  };

  const newEmergencyCount = emergencyReports.filter((r) => r.status === 'baru').length;

  return (
    <div className="space-y-6">
      {/* Header + Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">
            Peringatan Dini Desa, BMKG &amp; Laporan Darurat Warga
          </h2>
          <p className="text-xs text-slate-500">
            Kelola banner siaga portal publik, pantau data live BMKG, serta tindak lanjuti laporan darurat GPS warga.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('warnings')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'warnings'
                  ? 'bg-white text-[#0F2744] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Peringatan Dini &amp; BMKG ({warnings.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('reports')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'reports'
                  ? 'bg-white text-[#0F2744] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Laporan Darurat Warga ({emergencyReports.length}
              {newEmergencyCount > 0 ? ` · ${newEmergencyCount} Baru` : ''})
            </button>
            <button
              type="button"
              onClick={() => setTab('analytics')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'analytics'
                  ? 'bg-white text-[#0F2744] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#A67F17]" />
              Analitik &amp; Tren
            </button>
          </div>

          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Terbitkan Peringatan
          </button>
        </div>
      </div>

      {/* TAB 1: Peringatan Dini & BMKG */}
      {tab === 'warnings' && (
        <div className="space-y-6">
          {/* Live BMKG Monitor Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#0F2744]">
                  Ringkasan Data Live BMKG (Cache 5 Menit)
                </h3>
                <p className="text-xs text-slate-500">
                  Sumber: API Prakiraan Cuaca ADM4 ({bmkg?.adm4 || '32.11.18.2008'}) &amp; TEWS Gempabumi
                </p>
              </div>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Muat Ulang
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <p className="font-semibold text-[#0F2744] flex items-center gap-1.5">
                  <CloudRain className="w-4 h-4 text-[#0F2744]" />
                  Cuaca Desa Margamukti
                </p>
                {bmkg?.weather.available && bmkg.weather.current ? (
                  <>
                    <p className="text-sm font-bold text-slate-900">
                      {bmkg.weather.current.weather_desc} ·{' '}
                      <span className="font-mono-tabular">{bmkg.weather.current.t}°C</span>
                    </p>
                    <p className="text-slate-600 font-mono-tabular">
                      Kelembapan {bmkg.weather.current.hu}% · Angin {bmkg.weather.current.ws} km/j (
                      {bmkg.weather.current.wd}) · {bmkg.weather.current.local_datetime}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-600">
                    {bmkg?.weather.error || 'Prakiraan cuaca BMKG tidak tersedia.'}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <p className="font-semibold text-[#0F2744] flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[#A67F17]" />
                  Gempabumi Terkini BMKG
                </p>
                {bmkg?.earthquake.available && bmkg.earthquake.data ? (
                  <>
                    <p className="text-sm font-bold text-slate-900 font-mono-tabular">
                      M {bmkg.earthquake.data.magnitude} · {bmkg.earthquake.data.kedalaman} ·{' '}
                      {bmkg.earthquake.data.tanggal} {bmkg.earthquake.data.jam}
                    </p>
                    <p className="text-slate-600">
                      {bmkg.earthquake.data.wilayah} — {bmkg.earthquake.data.potensi}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-600">
                    {bmkg?.earthquake.error || 'Data gempa BMKG tidak tersedia.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Village Early Warning List */}
          <div className="space-y-3">
            {warnings.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
                Belum ada data peringatan dini desa. Klik &ldquo;Terbitkan Peringatan&rdquo; jika terdapat situasi siaga.
              </div>
            ) : (
              warnings.map((w) => {
                const meta = getSeverityMeta(w.severity);
                const SevIcon = meta.icon;
                return (
                  <div
                    key={w.id}
                    className={`bg-white border rounded-xl p-5 space-y-3 ${
                      w.is_active === 1 ? 'border-slate-300' : 'border-slate-200 opacity-75'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`inline-flex items-center gap-1 font-bold ${meta.textAccent}`}>
                            <SevIcon className={`w-4 h-4 ${meta.iconColor}`} />
                            {meta.label}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">|</span>
                          <span className="font-medium text-slate-700">{w.category}</span>
                          <span className="text-slate-300" aria-hidden="true">|</span>
                          <span
                            className={`font-semibold ${
                              w.is_active === 1 ? 'text-emerald-700' : 'text-slate-500'
                            }`}
                          >
                            {w.is_active === 1 ? 'Aktif di Banner Publik' : 'Nonaktif (Arsip)'}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-[#0F2744]">{w.title}</h3>
                        <p className="text-xs text-slate-600 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#A67F17]" />
                          {w.affected_area}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggle(w)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                          title={w.is_active === 1 ? 'Nonaktifkan dari banner' : 'Aktifkan ke banner publik'}
                        >
                          {w.is_active === 1 ? (
                            <>
                              <ToggleRight className="w-4 h-4 text-emerald-700" />
                              Aktif
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4 text-slate-400" />
                              Nonaktif
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(w)}
                          className="p-1.5 text-slate-600 hover:text-[#0F2744] cursor-pointer"
                          title="Edit peringatan"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(w.id)}
                          className="p-1.5 text-slate-600 hover:text-red-600 cursor-pointer"
                          title="Hapus peringatan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-slate-700 leading-relaxed">{w.description}</p>
                    {w.instruction && (
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <strong className="text-[#0F2744]">Arahan Warga:</strong> {w.instruction}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Laporan Darurat Warga */}
      {tab === 'reports' && (
        <div className="space-y-4">
          {emergencyReports.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              Belum ada laporan darurat warga yang masuk melalui Panel Laporan Darurat.
            </div>
          ) : (
            emergencyReports.map((r) => {
              const hasCoords =
                r.latitude !== null &&
                r.latitude !== undefined &&
                r.longitude !== null &&
                r.longitude !== undefined;
              return (
                <div
                  key={r.id}
                  className="bg-white border border-red-200 rounded-xl p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 font-bold text-red-700">
                          <Siren className="w-3.5 h-3.5" />
                          LAPORAN DARURAT · DRT-{String(r.id).padStart(4, '0')}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">|</span>
                        <span className="font-medium text-slate-700">
                          {r.sender_name} ({r.sender_contact})
                        </span>
                        <span className="text-slate-300" aria-hidden="true">|</span>
                        <span className="font-mono-tabular text-slate-500">{r.created_at}</span>
                      </div>
                      <h3 className="text-base font-semibold text-[#0F2744]">{r.subject}</h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openPromoteFromReport(r)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-[#0F2744] bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md cursor-pointer whitespace-nowrap"
                      >
                        Terbitkan Jadi Peringatan Dini
                      </button>
                      <select
                        value={r.status}
                        onChange={(e) =>
                          updateReportStatus(
                            r,
                            e.target.value as Complaint['status'],
                            r.admin_reply
                          )
                        }
                        className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-md bg-white"
                      >
                        <option value="baru">Baru</option>
                        <option value="diproses">Diproses / Ditangani</option>
                        <option value="selesai">Selesai</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed">{r.message}</p>

                  {hasCoords && (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs">
                      <span className="font-mono-tabular text-slate-700 inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-red-700 shrink-0" />
                        Koordinat GPS: {r.latitude}, {r.longitude}
                      </span>
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=17/${r.latitude}/${r.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#0F2744] hover:underline"
                      >
                        Buka Lokasi di Peta
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  <div>
                    <input
                      defaultValue={r.admin_reply}
                      onBlur={(e) => {
                        if (e.target.value !== r.admin_reply) {
                          updateReportStatus(r, r.status, e.target.value);
                        }
                      }}
                      placeholder="Catat langkah penanganan posko / perangkat piket lalu klik di luar kotak..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: Analitik & Tren Laporan Darurat (D3.js) */}
      {tab === 'analytics' && <EmergencyTrendChart reports={emergencyReports} />}

      {/* Modal Create / Edit Early Warning */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-[#0F2744]">
                {editingId ? 'Edit Peringatan Dini Desa' : 'Terbitkan Peringatan Dini Desa'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Peringatan *
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Contoh: Waspada Hujan Lebat & Kenaikan Debit Sungai Cibeureum"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tingkat Kesiagaan *
                  </label>
                  <select
                    value={form.severity}
                    onChange={(e) =>
                      setForm({ ...form, severity: e.target.value as EarlyWarningSeverity })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="darurat">DARURAT (Bahaya Tinggi / Evakuasi)</option>
                    <option value="siaga">SIAGA (Ancaman Dekat / Akses Terganggu)</option>
                    <option value="waspada">WASPADA (Pemantauan Cuaca / Potensi)</option>
                    <option value="info">INFO DESA (Pemberitahuan Umum)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Kejadian *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    {WARNING_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Wilayah / Dusun Terdampak *
                </label>
                <input
                  required
                  value={form.affected_area}
                  onChange={(e) => setForm({ ...form, affected_area: e.target.value })}
                  placeholder="Contoh: Dusun Pawenang & Dusun Cikondang"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Uraian Situasi *
                </label>
                <textarea
                  rows={3}
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Jelaskan kondisi terkini agar warga memahami potensi risiko..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Arahan &amp; Langkah Kesiagaan Warga
                </label>
                <textarea
                  rows={2}
                  value={form.instruction}
                  onChange={(e) => setForm({ ...form, instruction: e.target.value })}
                  placeholder="Contoh: Warga di bantaran sungai diminta mengawasi tinggi air dan segera lapor jika terjadi luapan..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Tampilkan aktif pada Banner Siaga Atas &amp; Beranda Publik
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer"
                >
                  Simpan Peringatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
