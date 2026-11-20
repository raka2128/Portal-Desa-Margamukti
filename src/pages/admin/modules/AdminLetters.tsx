import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Eye,
  FileText,
  Pencil,
  Plus,
  QrCode,
  ShieldAlert,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { BackupArchiveModal } from '../../../components/BackupArchiveModal';
import { LetterDocumentPreview } from '../../../components/LetterDocumentPreview';
import { adminFetch } from '../../../utils/adminApi';
import type { LetterRequest, LetterTemplate, Official, VillageSettings } from '../../../types';

interface AdminLettersProps {
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

const VARIABLE_CHIPS = [
  '{{nama}}',
  '{{nik}}',
  '{{ttl}}',
  '{{jenis_kelamin}}',
  '{{agama}}',
  '{{pekerjaan}}',
  '{{status_perkawinan}}',
  '{{alamat}}',
  '{{keperluan}}',
];

export function AdminLettersModule({ onNotify }: AdminLettersProps) {
  const [subTab, setSubTab] = useState<'requests' | 'templates' | 'kop'>('requests');
  const [backupModalOpen, setBackupModalOpen] = useState(false);

  // Requests state
  const [requests, setRequests] = useState<LetterRequest[]>([]);
  const [signers, setSigners] = useState<Official[]>([]);
  const [settings, setSettings] = useState<VillageSettings | null>(null);
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [activeRequest, setActiveRequest] = useState<LetterRequest | null>(null);
  const [verifyNumber, setVerifyNumber] = useState('');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [signerOfficialId, setSignerOfficialId] = useState<number | ''>('');
  const [useDigitalSignature, setUseDigitalSignature] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [editingTpl, setEditingTpl] = useState<LetterTemplate | null>(null);
  const [tplForm, setTplForm] = useState({
    code: '',
    name: '',
    classification_code: '470',
    description: '',
    body_template: '',
    is_active: true,
  });

  // Kop Surat state
  const [kopForm, setKopForm] = useState({
    kop_line1: '',
    kop_line2: '',
    kop_line3: '',
    kop_address: '',
    head_name: '',
    head_nip: '',
  });

  const loadAll = () => {
    Promise.all([
      adminFetch('/api/admin/letter-requests').then((r) => r.json()),
      adminFetch('/api/admin/letter-templates').then((r) => r.json()),
      adminFetch('/api/admin/settings').then((r) => r.json()),
    ]).then(([reqJson, tplJson, setJson]) => {
      setRequests(reqJson.requests || []);
      setSigners(reqJson.signers || []);
      setTemplates(tplJson.templates || []);
      const s: VillageSettings = setJson.settings;
      setSettings(s);
      if (s) {
        setKopForm({
          kop_line1: s.kop_line1,
          kop_line2: s.kop_line2,
          kop_line3: s.kop_line3,
          kop_address: s.kop_address,
          head_name: s.head_name,
          head_nip: s.head_nip,
        });
      }
    });
  };

  useEffect(loadAll, []);

  const authorizedSigners = signers.filter((s) => s.can_sign_letters === 1);
  const selectableSigners = authorizedSigners.length > 0 ? authorizedSigners : signers;

  const openRequestDetail = (req: LetterRequest) => {
    setActiveRequest(req);
    setVerifyNumber(req.letter_number || '');
    setVerifyNotes(req.admin_notes || '');

    const defaultSigner =
      (req.signer_official_id
        ? selectableSigners.find((s) => s.id === req.signer_official_id)
        : undefined) ||
      selectableSigners.find((s) => s.position.toLowerCase().includes('kepala desa')) ||
      selectableSigners[0];

    setSignerOfficialId(defaultSigner ? defaultSigner.id : '');
    setUseDigitalSignature(
      req.use_digital_signature === 1 && defaultSigner?.tte_status === 'approved'
    );
  };

  const selectedSigner =
    selectableSigners.find((s) => s.id === Number(signerOfficialId)) || null;

  const handleSelectSigner = (val: string) => {
    const idNum = val ? Number(val) : '';
    setSignerOfficialId(idNum);
    const found = selectableSigners.find((s) => s.id === idNum);
    if (!found || found.tte_status !== 'approved') {
      setUseDigitalSignature(false);
    }
  };

  const handleVerify = async (status: 'approved' | 'rejected' | 'pending') => {
    if (!activeRequest) return;
    const res = await adminFetch(`/api/admin/letter-requests/${activeRequest.id}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        letter_number: verifyNumber,
        admin_notes: verifyNotes,
        signer_official_id: signerOfficialId || null,
        use_digital_signature: useDigitalSignature,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      onNotify(json.error || 'Gagal memperbarui status surat.', 'err');
      return;
    }
    onNotify(
      status === 'approved'
        ? `Surat disetujui dengan nomor ${json.letter_number}`
        : 'Status permohonan surat diperbarui.'
    );
    loadAll();
    setActiveRequest((prev) =>
      prev
        ? {
            ...prev,
            status,
            letter_number: json.letter_number || prev.letter_number,
            admin_notes: verifyNotes,
            signer_official_id: signerOfficialId ? Number(signerOfficialId) : prev.signer_official_id,
            signer_name: json.signer_name ?? prev.signer_name,
            signer_position: json.signer_position ?? prev.signer_position,
            signer_nip: json.signer_nip ?? prev.signer_nip,
            signer_tte_code: json.signer_tte_code ?? prev.signer_tte_code,
            use_digital_signature: json.use_digital_signature ?? (useDigitalSignature ? 1 : 0),
            approved_at: status === 'approved' ? new Date().toISOString() : prev.approved_at,
          }
        : null
    );
    if (json.letter_number) setVerifyNumber(json.letter_number);
  };

  const handleDeleteRequest = async (id: number) => {
    await adminFetch(`/api/admin/letter-requests/${id}`, { method: 'DELETE' });
    loadAll();
    onNotify('Permohonan surat dihapus.');
  };

  // Template actions
  const startNewTemplate = () => {
    setEditingTpl({
      id: 0,
      code: '',
      name: '',
      classification_code: '470',
      description: '',
      body_template:
        'Yang bertanda tangan di bawah ini Kepala Desa Margamukti, menerangkan bahwa:\n\nNama Lengkap : {{nama}}\nNIK : {{nik}}\nTempat/Tanggal Lahir : {{ttl}}\nAlamat : {{alamat}}\n\nAdalah benar warga Desa Margamukti untuk keperluan {{keperluan}}.',
      required_fields: '[]',
      is_active: 1,
    });
    setTplForm({
      code: '',
      name: '',
      classification_code: '470',
      description: '',
      body_template:
        'Yang bertanda tangan di bawah ini Kepala Desa Margamukti, menerangkan bahwa:\n\nNama Lengkap : {{nama}}\nNIK : {{nik}}\nTempat/Tanggal Lahir : {{ttl}}\nAlamat : {{alamat}}\n\nAdalah benar warga Desa Margamukti untuk keperluan {{keperluan}}.',
      is_active: true,
    });
  };

  const startEditTemplate = (tpl: LetterTemplate) => {
    setEditingTpl(tpl);
    setTplForm({
      code: tpl.code,
      name: tpl.name,
      classification_code: tpl.classification_code,
      description: tpl.description,
      body_template: tpl.body_template,
      is_active: tpl.is_active === 1,
    });
  };

  const insertVariable = (token: string) => {
    setTplForm((prev) => ({
      ...prev,
      body_template: `${prev.body_template}${prev.body_template.endsWith(' ') || prev.body_template.endsWith('\n') ? '' : ' '}${token}`,
    }));
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTpl) return;
    const isNew = editingTpl.id === 0;
    const url = isNew ? '/api/admin/letter-templates' : `/api/admin/letter-templates/${editingTpl.id}`;
    const method = isNew ? 'POST' : 'PUT';
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...tplForm,
        required_fields: editingTpl.required_fields || '[]',
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      onNotify(json.error || 'Gagal menyimpan template.', 'err');
      return;
    }
    setEditingTpl(null);
    loadAll();
    onNotify('Template surat berhasil disimpan.');
  };

  const handleSaveKop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    const res = await adminFetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, ...kopForm }),
    });
    if (!res.ok) {
      onNotify('Gagal menyimpan pengaturan Kop Surat.', 'err');
      return;
    }
    loadAll();
    onNotify('Kop Surat & pejabat penandatangan diperbarui.');
  };

  const filteredRequests =
    statusFilter === 'Semua'
      ? requests
      : requests.filter((r) => r.status === statusFilter);

  const sampleRenderedPreview = tplForm.body_template
    .replace(/{{nama}}/g, 'Ahmad Fauzi')
    .replace(/{{nik}}/g, '3211181205850001')
    .replace(/{{ttl}}/g, 'Sumedang, 12 Mei 1985')
    .replace(/{{jenis_kelamin}}/g, 'Laki-laki')
    .replace(/{{agama}}/g, 'Islam')
    .replace(/{{pekerjaan}}/g, 'Wiraswasta')
    .replace(/{{status_perkawinan}}/g, 'Kawin')
    .replace(/{{alamat}}/g, 'Blok Kebonkalapa RT 01 RW 01, Dusun Pawenang')
    .replace(/{{keperluan}}/g, 'Administrasi Perbankan');

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">Manajemen & Cetak Surat Keterangan</h2>
          <p className="text-xs text-slate-500">
            Verifikasi pengajuan warga, atur template surat dinamis, dan cetak PDF ber-Kop Kabupaten Sumedang.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setBackupModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] text-xs font-semibold text-[#0F2744] bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-[#A67F17]" /> Cadangan JSON
          </button>
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto no-scrollbar max-w-full">
            <button
              type="button"
              onClick={() => setSubTab('requests')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'requests' ? 'bg-white text-[#0F2744] shadow-sm' : 'text-slate-600'
              }`}
            >
              Antrean Surat ({requests.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('templates')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'templates' ? 'bg-white text-[#0F2744] shadow-sm' : 'text-slate-600'
              }`}
            >
              Editor Template ({templates.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('kop')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'kop' ? 'bg-white text-[#0F2744] shadow-sm' : 'text-slate-600'
              }`}
            >
              Kop Surat &amp; Kepala Desa
            </button>
          </div>
        </div>
      </div>

      {/* SUBTAB 1: ANTREAN PERMOHONAN SURAT */}
      {subTab === 'requests' && (
        <div className="space-y-4">
          <div className="no-print flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { key: 'Semua', label: 'Semua' },
              { key: 'pending', label: 'Menunggu Verifikasi' },
              { key: 'approved', label: 'Disetujui' },
              { key: 'rejected', label: 'Ditolak' },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setStatusFilter(st.key)}
                className={`px-3 py-2 min-h-[40px] text-xs font-semibold rounded-md border whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === st.key
                    ? 'bg-[#0F2744] text-white border-[#0F2744]'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Mobile Cards (< md) */}
          <div className="no-print md:hidden space-y-3">
            {filteredRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono-tabular text-xs font-bold text-[#0F2744]">
                      {req.tracking_code}
                    </p>
                    <p className="font-mono-tabular text-[11px] text-slate-500">
                      {req.letter_number || 'Belum bernomor'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold shrink-0">
                    {req.status === 'approved' && <span className="text-emerald-700">Disetujui</span>}
                    {req.status === 'pending' && <span className="text-amber-700">Menunggu</span>}
                    {req.status === 'rejected' && <span className="text-red-700">Ditolak</span>}
                  </span>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">{req.applicant_name}</p>
                  <p className="font-mono-tabular text-xs text-slate-500">{req.applicant_nik}</p>
                </div>

                <div className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 space-y-1">
                  <p className="font-semibold text-[#0F2744]">{req.template_name}</p>
                  <p className="text-slate-600 line-clamp-2">{req.purpose}</p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openRequestDetail(req)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> Tinjau &amp; Cetak
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRequest(req.id)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-red-600 border border-slate-200 rounded-md cursor-pointer"
                    aria-label="Hapus permohonan surat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {filteredRequests.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                Belum ada permohonan surat pada status ini.
              </div>
            )}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="no-print hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Kode Lacak & Nomor</th>
                    <th className="py-3 px-4">Jenis Surat</th>
                    <th className="py-3 px-4">Pemohon</th>
                    <th className="py-3 px-4">Keperluan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-mono-tabular text-xs font-semibold text-[#0F2744]">
                          {req.tracking_code}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-slate-500">
                          {req.letter_number || 'Belum bernomor'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-800">{req.template_name}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{req.applicant_name}</div>
                        <div className="font-mono-tabular text-xs text-slate-500">{req.applicant_nik}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">{req.purpose}</td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        {req.status === 'approved' && <span className="text-emerald-700">Disetujui</span>}
                        {req.status === 'pending' && <span className="text-amber-700">Menunggu</span>}
                        {req.status === 'rejected' && <span className="text-red-700">Ditolak</span>}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openRequestDetail(req)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Tinjau & Cetak
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(req.id)}
                          className="p-1.5 text-slate-500 hover:text-red-600 ml-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: EDITOR VISUAL TEMPLATE SURAT */}
      {subTab === 'templates' && (
        <div className="space-y-5">
          {!editingTpl ? (
            <>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={startNewTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Buat Template Surat Baru
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span className="font-mono-tabular font-semibold text-[#A67F17]">
                          {tpl.code} · Klasifikasi {tpl.classification_code}
                        </span>
                        <span>{tpl.is_active ? 'Aktif' : 'Nonaktif'}</span>
                      </div>
                      <h3 className="text-base font-semibold text-[#0F2744]">{tpl.name}</h3>
                      <p className="text-xs text-slate-600 mt-1">{tpl.description}</p>
                    </div>
                    <div className="flex justify-end pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => startEditTemplate(tpl)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F2744] border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit Template Visual
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSaveTemplate}
                className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-semibold text-[#0F2744]">
                    {editingTpl.id === 0 ? 'Template Surat Baru' : `Edit: ${editingTpl.name}`}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingTpl(null)}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Kembali
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Singkat</label>
                    <input
                      required
                      value={tplForm.code}
                      onChange={(e) => setTplForm({ ...tplForm, code: e.target.value.toUpperCase() })}
                      placeholder="SKD"
                      className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Klasifikasi</label>
                    <input
                      required
                      value={tplForm.classification_code}
                      onChange={(e) => setTplForm({ ...tplForm, classification_code: e.target.value })}
                      placeholder="470"
                      className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Jenis Surat</label>
                  <input
                    required
                    value={tplForm.name}
                    onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi Singkat</label>
                  <input
                    value={tplForm.description}
                    onChange={(e) => setTplForm({ ...tplForm, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Sisipkan Variabel Data Penduduk
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {VARIABLE_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => insertVariable(chip)}
                        className="px-2 py-1 text-[11px] font-mono-tabular bg-slate-100 hover:bg-[#0F2744] hover:text-white border border-slate-200 rounded transition-colors cursor-pointer"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={12}
                    required
                    value={tplForm.body_template}
                    onChange={(e) => setTplForm({ ...tplForm, body_template: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono-tabular leading-relaxed border border-slate-300 rounded-md"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={tplForm.is_active}
                    onChange={(e) => setTplForm({ ...tplForm, is_active: e.target.checked })}
                  />
                  Tampilkan di portal warga
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingTpl(null)}
                    className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-md cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer"
                  >
                    Simpan Template
                  </button>
                </div>
              </form>

              {/* Live Split Preview */}
              <div className="lg:col-span-6 space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Pratinjau Langsung Dokumen Surat
                </p>
                {settings && (
                  <LetterDocumentPreview
                    settings={settings}
                    letterTitle={tplForm.name || 'SURAT KETERANGAN'}
                    letterNumber={`${tplForm.classification_code || '470'} / 001 / DS-MGM / XI / 2026`}
                    trackingCode="PREVIEW-TEMPLATE"
                    bodyText={sampleRenderedPreview}
                    showActions={false}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: PENGATURAN KOP SURAT & PENANDATANGAN */}
      {subTab === 'kop' && settings && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveKop}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-[#0F2744] border-b border-slate-100 pb-3">
              Pengaturan Kop Surat & Penandatangan
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Baris 1 (Pemerintah Kabupaten)</label>
              <input
                required
                value={kopForm.kop_line1}
                onChange={(e) => setKopForm({ ...kopForm, kop_line1: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Baris 2 (Kecamatan)</label>
              <input
                required
                value={kopForm.kop_line2}
                onChange={(e) => setKopForm({ ...kopForm, kop_line2: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Baris 3 (Jabatan / Nama Desa)</label>
              <input
                required
                value={kopForm.kop_line3}
                onChange={(e) => setKopForm({ ...kopForm, kop_line3: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat & Kode Pos Kop</label>
              <input
                required
                value={kopForm.kop_address}
                onChange={(e) => setKopForm({ ...kopForm, kop_address: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div className="pt-2 border-t border-slate-100 grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Kepala Desa Penandatangan</label>
                <input
                  required
                  value={kopForm.head_name}
                  onChange={(e) => setKopForm({ ...kopForm, head_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIAP Kepala Desa</label>
                <input
                  value={kopForm.head_nip}
                  onChange={(e) => setKopForm({ ...kopForm, head_nip: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
            >
              Simpan Pengaturan Kop Surat
            </button>
          </form>

          <div className="lg:col-span-7">
            <LetterDocumentPreview
              settings={{ ...settings, ...kopForm }}
              letterTitle="CONTOH KOP SURAT RESMI"
              letterNumber="470 / 001 / DS-MGM / XI / 2026"
              trackingCode="PREVIEW-KOP"
              bodyText="Pratinjau ini menampilkan Kop Surat Resmi Pemerintah Kabupaten Sumedang, Kecamatan Sumedang Utara, Kepala Desa Margamukti beserta kolom tanda tangan pejabat desa."
              showActions={false}
            />
          </div>
        </div>
      )}

      {/* VERIFY & PRINT MODAL */}
      {activeRequest && settings && (() => {
        let customTitle = activeRequest.template_name || 'SURAT KETERANGAN';
        try {
          const parsedExtra = activeRequest.extra_data ? JSON.parse(activeRequest.extra_data) : {};
          if (activeRequest.template_code === 'SKSG' && parsedExtra?.judul_surat_khusus) {
            customTitle = String(parsedExtra.judul_surat_khusus).toUpperCase();
          }
        } catch {
          // Abaikan error parse extra_data
        }
        const effectiveTte =
          useDigitalSignature && selectedSigner?.tte_status === 'approved';
        const displaySignerName =
          selectedSigner?.name || activeRequest.signer_name || settings.head_name;
        const displaySignerPosition =
          selectedSigner?.position || activeRequest.signer_position || 'Kepala Desa Margamukti';
        const displaySignerNip =
          selectedSigner?.nip !== undefined
            ? selectedSigner.nip
            : activeRequest.signer_nip !== undefined
            ? activeRequest.signer_nip
            : settings.head_nip;
        const displaySignerTteCode = effectiveTte
          ? selectedSigner?.tte_code || activeRequest.signer_tte_code || ''
          : '';

        return (
        <div className="print-modal-root fixed inset-0 z-50 bg-slate-950/75 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="print-modal-card bg-slate-100 rounded-t-2xl sm:rounded-xl max-w-5xl w-full max-h-[94dvh] overflow-y-auto print:max-h-none print:overflow-visible print:bg-white print:shadow-none print:rounded-none shadow-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-[#0F2744] shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#0F2744] truncate">
                    Verifikasi &amp; Cetak: {customTitle}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono-tabular truncate">
                    {activeRequest.tracking_code} · Pemohon: {activeRequest.applicant_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveRequest(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-md cursor-pointer shrink-0"
                aria-label="Tutup modal verifikasi surat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 print:p-0 space-y-6 print:space-y-0">
              {/* Verification Controls */}
              <div className="no-print bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nomor Surat Resmi (Kosongkan untuk otomatis)
                    </label>
                    <input
                      value={verifyNumber}
                      onChange={(e) => setVerifyNumber(e.target.value)}
                      placeholder="Otomatis: 470 / 001 / DS-MGM / ..."
                      className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-md"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pejabat Penanda Tangan Surat
                    </label>
                    <select
                      value={signerOfficialId}
                      onChange={(e) => handleSelectSigner(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                    >
                      {selectableSigners.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.position} — {s.name}
                          {s.tte_status === 'approved' ? ' (TTE Aktif)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Catatan Verifikasi Admin
                    </label>
                    <input
                      value={verifyNotes}
                      onChange={(e) => setVerifyNotes(e.target.value)}
                      placeholder="Catatan untuk warga..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                {/* TTE Toggle + Approve/Reject Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="space-y-1">
                    <label
                      className={`inline-flex items-center gap-2 text-xs font-semibold ${
                        selectedSigner?.tte_status === 'approved'
                          ? 'text-[#0F2744] cursor-pointer'
                          : 'text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={selectedSigner?.tte_status !== 'approved'}
                        checked={effectiveTte}
                        onChange={(e) => setUseDigitalSignature(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <QrCode className="w-4 h-4 text-[#A67F17] shrink-0" />
                      <span>
                        Gunakan Tanda Tangan Digital (QR Verifikasi Resmi tanpa tanda tangan manual &amp; cap basah)
                      </span>
                    </label>
                    {selectedSigner && selectedSigner.tte_status !== 'approved' && (
                      <p className="text-[11px] text-amber-700 flex items-center gap-1 pl-6">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          TTE {selectedSigner.position} belum disetujui Super Admin (status: {selectedSigner.tte_status}). Aktifkan di menu Perangkat Desa.
                        </span>
                      </p>
                    )}
                    {effectiveTte && displaySignerTteCode && (
                      <p className="text-[11px] text-emerald-700 font-mono-tabular pl-6">
                        Kode Verifikasi TTE: {displaySignerTteCode}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleVerify('rejected')}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Tolak
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerify('approved')}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Setujui &amp; Terbitkan Nomor
                    </button>
                  </div>
                </div>
              </div>

              {/* Official Letter Preview & PDF Print */}
              <LetterDocumentPreview
                settings={settings}
                letterTitle={customTitle}
                letterNumber={verifyNumber || activeRequest.letter_number}
                trackingCode={activeRequest.tracking_code}
                bodyText={activeRequest.rendered_body || ''}
                issuedDate={activeRequest.approved_at}
                signerName={displaySignerName}
                signerPosition={displaySignerPosition}
                signerNip={displaySignerNip}
                signerTteCode={displaySignerTteCode}
                useDigitalSignature={effectiveTte}
                showActions={true}
              />
            </div>
          </div>
        </div>
        );
      })()}

      <BackupArchiveModal
        open={backupModalOpen}
        onClose={() => setBackupModalOpen(false)}
        onNotify={onNotify}
      />
    </div>
  );
}
