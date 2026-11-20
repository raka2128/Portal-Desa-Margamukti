import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Copy, FileCheck2, Search, Send, XCircle } from 'lucide-react';
import { LetterDocumentPreview } from '../../components/LetterDocumentPreview';
import type { LetterRequest, LetterTemplate, RequiredFieldDef, VillageSettings } from '../../types';

interface LettersPageProps {
  initialTab?: string;
  initialTemplateId?: number;
  initialTrackCode?: string;
}

export function LettersPage({ initialTab = 'form', initialTemplateId, initialTrackCode }: LettersPageProps) {
  const [tab, setTab] = useState<'form' | 'track'>(initialTab === 'track' ? 'track' : 'form');
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(initialTemplateId || 1);

  // Form state
  const [nikLookup, setNikLookup] = useState('');
  const [lookupFeedback, setLookupFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [form, setForm] = useState({
    applicant_nik: '',
    applicant_name: '',
    birth_place: '',
    birth_date: '',
    gender: 'Laki-laki',
    religion: 'Islam',
    occupation: '',
    marital_status: 'Kawin',
    address: '',
    phone: '',
    purpose: '',
  });
  const [extraData, setExtraData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdTrackingCode, setCreatedTrackingCode] = useState('');

  // Track state
  const [trackCodeInput, setTrackCodeInput] = useState(initialTrackCode || 'SRT-2026-0001');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState('');
  const [trackResult, setTrackResult] = useState<{
    request: LetterRequest;
    renderedBody: string | null;
    settings: VillageSettings;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialTab === 'track' || initialTab === 'form') {
      setTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialTemplateId) {
      setSelectedTemplateId(initialTemplateId);
    }
  }, [initialTemplateId]);

  useEffect(() => {
    fetch('/api/public/letters/templates')
      .then((r) => r.json())
      .then((json) => {
        const list: LetterTemplate[] = json.templates || [];
        setTemplates(list);
        if (list.length > 0 && !initialTemplateId) {
          setSelectedTemplateId(list[0].id);
        }
      });
  }, [initialTemplateId]);

  const activeTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];
  let parsedExtraFields: RequiredFieldDef[] = [];
  if (activeTemplate?.required_fields) {
    try {
      parsedExtraFields = JSON.parse(activeTemplate.required_fields);
    } catch {
      parsedExtraFields = [];
    }
  }

  const handleNikLookup = async () => {
    setLookupFeedback(null);
    if (!nikLookup.trim()) return;
    const res = await fetch(`/api/public/residents/lookup?nik=${encodeURIComponent(nikLookup.trim())}`);
    const json = await res.json();
    if (!res.ok) {
      setLookupFeedback({ type: 'err', msg: json.error || 'NIK tidak ditemukan.' });
      setForm((prev) => ({ ...prev, applicant_nik: nikLookup.trim() }));
      return;
    }
    const r = json.resident;
    setForm((prev) => ({
      ...prev,
      applicant_nik: r.nik,
      applicant_name: r.full_name,
      birth_place: r.birth_place,
      birth_date: r.birth_date,
      gender: r.gender,
      religion: r.religion,
      occupation: r.occupation,
      marital_status: r.marital_status,
      address: r.address,
    }));
    setLookupFeedback({
      type: 'ok',
      msg: `Biodata atas nama ${r.full_name} berhasil dimuat otomatis dari database desa.`,
    });
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/public/letters/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: activeTemplate.id,
          ...form,
          extra_data: extraData,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || 'Gagal mengirim permohonan surat.');
        return;
      }
      setCreatedTrackingCode(json.tracking_code);
      setTrackCodeInput(json.tracking_code);
    } catch {
      setSubmitError('Terjadi gangguan jaringan. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackSearch = async (codeOverride?: string) => {
    const queryCode = (codeOverride ?? trackCodeInput).trim();
    if (!queryCode) return;
    setTrackLoading(true);
    setTrackError('');
    setTrackResult(null);
    try {
      const res = await fetch(`/api/public/letters/track?code=${encodeURIComponent(queryCode)}`);
      const json = await res.json();
      if (!res.ok) {
        setTrackError(json.error || 'Kode pelacakan tidak ditemukan.');
        return;
      }
      setTrackResult(json);
    } finally {
      setTrackLoading(false);
    }
  };

  useEffect(() => {
    if (initialTrackCode) {
      setTrackCodeInput(initialTrackCode);
      handleTrackSearch(initialTrackCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTrackCode]);

  useEffect(() => {
    if (tab === 'track' && trackCodeInput && !trackResult && !initialTrackCode) {
      handleTrackSearch(trackCodeInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const copyTrackingCode = () => {
    if (!createdTrackingCode) return;
    navigator.clipboard.writeText(createdTrackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header & Tabs */}
      <div className="no-print flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
            Pelayanan Administrasi Mandiri
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--theme-primary)] mt-1">
            Layanan Surat Keterangan Desa
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto no-scrollbar max-w-full w-full md:w-auto self-start">
          <button
            type="button"
            onClick={() => setTab('form')}
            className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'form' ? 'bg-white text-[var(--theme-primary)] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ajukan Surat Baru
          </button>
          <button
            type="button"
            onClick={() => setTab('track')}
            className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'track' ? 'bg-white text-[var(--theme-primary)] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lacak Status & Unduh PDF
          </button>
        </div>
      </div>

      {/* TAB 1: AJUKAN SURAT BARU */}
      {tab === 'form' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Pilihan Jenis Surat */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              1. Pilih Jenis Surat
            </h2>
            <div className="space-y-2.5">
              {templates.map((tpl) => {
                const active = tpl.id === activeTemplate?.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(tpl.id);
                      setExtraData({});
                      setCreatedTrackingCode('');
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)]'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-[var(--theme-primary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`font-mono-tabular font-semibold ${active ? 'text-[var(--theme-accent-light)]' : 'text-[var(--theme-accent-dark)]'}`}>
                        Klasifikasi {tpl.classification_code}
                      </span>
                      <span className={`font-mono-tabular ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                        {tpl.code}
                      </span>
                    </div>
                    <p className="text-sm font-semibold">{tpl.name}</p>
                    <p className={`text-xs mt-1 leading-relaxed ${active ? 'text-slate-200' : 'text-slate-500'}`}>
                      {tpl.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Biodata & Lookup NIK */}
          <div className="lg:col-span-8 space-y-6">
            {createdTrackingCode ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-5">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold text-[var(--theme-primary)]">
                    Permohonan Surat Berhasil Dikirim
                  </h2>
                  <p className="text-sm text-slate-600 max-w-lg mx-auto">
                    Permohonan <strong className="text-slate-900">{activeTemplate?.name}</strong> Anda telah masuk ke antrean verifikasi operator Desa Margamukti. Simpan kode pelacakan di bawah ini untuk memantau persetujuan dan mengunduh PDF resmi:
                  </p>
                </div>

                <div className="inline-flex items-center gap-3 px-5 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-xl font-bold font-mono-tabular text-[var(--theme-primary)]">
                    {createdTrackingCode}
                  </span>
                  <button
                    type="button"
                    onClick={copyTrackingCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--theme-primary)] bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'Tersalin' : 'Salin'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTab('track');
                      handleTrackSearch(createdTrackingCode);
                    }}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md cursor-pointer"
                  >
                    Lacak Status Permohonan
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatedTrackingCode('')}
                    className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                  >
                    Ajukan Surat Lainnya
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
                {/* Pencarian NIK Otomatis */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--theme-primary)]">
                        Isi Otomatis via NIK Penduduk
                      </h3>
                      <p className="text-xs text-slate-500">
                        Masukkan 16 digit NIK terdaftar (contoh uji: <span className="font-mono-tabular">3211181205850001</span>)
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={nikLookup}
                      onChange={(e) => setNikLookup(e.target.value)}
                      placeholder="Masukkan NIK 16 digit..."
                      className="flex-1 min-h-[44px] px-3.5 py-2 text-sm font-mono-tabular bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                    />
                    <button
                      type="button"
                      onClick={handleNikLookup}
                      className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Cari NIK
                    </button>
                  </div>
                  {lookupFeedback && (
                    <p
                      className={`text-xs font-medium ${
                        lookupFeedback.type === 'ok' ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {lookupFeedback.msg}
                    </p>
                  )}
                </div>

                {/* Form Permohonan */}
                <form onSubmit={handleSubmitRequest} className="space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-base font-semibold text-[var(--theme-primary)]">
                      2. Lengkapi Formulir: {activeTemplate?.name}
                    </h2>
                  </div>

                  {submitError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-medium">
                      {submitError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        NIK Pemohon *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.applicant_nik}
                        onChange={(e) => setForm({ ...form, applicant_nik: e.target.value })}
                        placeholder="16 digit NIK"
                        className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Lengkap *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.applicant_name}
                        onChange={(e) => setForm({ ...form, applicant_name: e.target.value })}
                        placeholder="Sesuai KTP"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tempat Lahir *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.birth_place}
                        onChange={(e) => setForm({ ...form, birth_place: e.target.value })}
                        placeholder="Contoh: Sumedang"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tanggal Lahir *
                      </label>
                      <input
                        type="date"
                        required
                        value={form.birth_date}
                        onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                        className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Jenis Kelamin *
                      </label>
                      <select
                        value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:border-[var(--theme-primary)]"
                      >
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Agama
                      </label>
                      <select
                        value={form.religion}
                        onChange={(e) => setForm({ ...form, religion: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:border-[var(--theme-primary)]"
                      >
                        <option value="Islam">Islam</option>
                        <option value="Kristen">Kristen</option>
                        <option value="Katolik">Katolik</option>
                        <option value="Hindu">Hindu</option>
                        <option value="Buddha">Buddha</option>
                        <option value="Konghucu">Konghucu</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Pekerjaan
                      </label>
                      <input
                        type="text"
                        value={form.occupation}
                        onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                        placeholder="Contoh: Wiraswasta"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Status Perkawinan
                      </label>
                      <select
                        value={form.marital_status}
                        onChange={(e) => setForm({ ...form, marital_status: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:border-[var(--theme-primary)]"
                      >
                        <option value="Belum Kawin">Belum Kawin</option>
                        <option value="Kawin">Kawin</option>
                        <option value="Cerai Hidup">Cerai Hidup</option>
                        <option value="Cerai Mati">Cerai Mati</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Alamat Lengkap (Dusun / Blok / RT / RW) *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Contoh: Blok Kebonkalapa RT 01 RW 01, Dusun Pawenang, Desa Margamukti"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                    />
                  </div>

                  {/* Dynamic extra fields per template */}
                  {parsedExtraFields.length > 0 && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                      <p className="text-xs font-semibold text-[var(--theme-primary)]">
                        Keterangan Khusus ({activeTemplate?.name})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {parsedExtraFields.map((fld) => {
                          const isOptional = fld.key === 'judul_surat_khusus';
                          return (
                            <div key={fld.key} className={fld.type === 'textarea' ? 'sm:col-span-2' : ''}>
                              <label className="block text-xs font-medium text-slate-700 mb-1">
                                {fld.label} {!isOptional && '*'}
                              </label>
                              {fld.type === 'textarea' ? (
                                <textarea
                                  rows={4}
                                  required={!isOptional}
                                  value={extraData[fld.key] || ''}
                                  onChange={(e) =>
                                    setExtraData({ ...extraData, [fld.key]: e.target.value })
                                  }
                                  placeholder={fld.placeholder}
                                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                                />
                              ) : (
                                <input
                                  type="text"
                                  required={!isOptional}
                                  value={extraData[fld.key] || ''}
                                  onChange={(e) =>
                                    setExtraData({ ...extraData, [fld.key]: e.target.value })
                                  }
                                  placeholder={fld.placeholder}
                                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nomor Telepon / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="08xxxxxxxxxx"
                        className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Keperluan Surat *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.purpose}
                        onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                        placeholder="Contoh: Persyaratan melamar pekerjaan"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      <Send className="w-4 h-4 text-[var(--theme-accent-light)]" />
                      {submitting ? 'Mengirim Permohonan...' : 'Kirim Permohonan Surat'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LACAK STATUS & CETAK PDF RESMI */}
      {tab === 'track' && (
        <div className="space-y-6">
          <div className="no-print bg-white border border-slate-200 rounded-xl p-6 max-w-2xl">
            <h2 className="text-base font-semibold text-[var(--theme-primary)]">
              Cek Status & Unduh Surat Keterangan Resmi
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Masukkan kode pelacakan yang diberikan setelah pengajuan (contoh surat disetujui:{' '}
              <button
                type="button"
                onClick={() => {
                  setTrackCodeInput('SRT-2026-0001');
                  handleTrackSearch('SRT-2026-0001');
                }}
                className="font-mono-tabular font-semibold text-[var(--theme-primary)] underline cursor-pointer"
              >
                SRT-2026-0001
              </button>
              ).
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <input
                type="text"
                value={trackCodeInput}
                onChange={(e) => setTrackCodeInput(e.target.value)}
                placeholder="Contoh: SRT-2026-0001"
                className="flex-1 min-h-[44px] px-3.5 py-2.5 text-sm font-mono-tabular uppercase border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
              />
              <button
                type="button"
                onClick={() => handleTrackSearch()}
                disabled={trackLoading}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                {trackLoading ? 'Mencari...' : 'Lacak Surat'}
              </button>
            </div>
            {trackError && <p className="text-xs text-red-600 font-medium mt-3">{trackError}</p>}
          </div>

          {trackResult && (
            <div className="space-y-6">
              {/* Status Card */}
              <div className="no-print bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono-tabular font-semibold text-[var(--theme-primary)]">
                      {trackResult.request.tracking_code}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{trackResult.request.template_name}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Pemohon: {trackResult.request.applicant_name}
                  </h3>
                  <p className="text-xs text-slate-600">
                    Keperluan: {trackResult.request.purpose}
                  </p>
                  {trackResult.request.admin_notes && (
                    <p className="text-xs text-slate-600 pt-1">
                      Catatan Petugas: <span className="font-medium text-slate-800">{trackResult.request.admin_notes}</span>
                    </p>
                  )}
                </div>

                <div className="shrink-0">
                  {trackResult.request.status === 'approved' && (
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                      <FileCheck2 className="w-4 h-4" />
                      Disetujui & Siap Cetak PDF
                    </div>
                  )}
                  {trackResult.request.status === 'pending' && (
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                      <Clock className="w-4 h-4" />
                      Menunggu Verifikasi Admin
                    </div>
                  )}
                  {trackResult.request.status === 'rejected' && (
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
                      <XCircle className="w-4 h-4" />
                      Ditolak / Perlu Perbaikan
                    </div>
                  )}
                </div>
              </div>

              {/* Official Letter Preview & PDF Download if Approved */}
              {trackResult.request.status === 'approved' && trackResult.renderedBody && (() => {
                let customTitle = '';
                try {
                  const parsedExtra = JSON.parse(trackResult.request.extra_data || '{}') as Record<string, string>;
                  customTitle = (parsedExtra.judul_surat_khusus || '').trim();
                } catch {
                  customTitle = '';
                }
                const resolvedTitle =
                  customTitle || trackResult.request.template_name || 'SURAT KETERANGAN';
                return (
                  <LetterDocumentPreview
                    settings={trackResult.settings}
                    letterTitle={resolvedTitle}
                    letterNumber={trackResult.request.letter_number}
                    trackingCode={trackResult.request.tracking_code}
                    bodyText={trackResult.renderedBody}
                    issuedDate={trackResult.request.approved_at}
                    signerName={trackResult.request.signer_name}
                    signerPosition={trackResult.request.signer_position}
                    signerNip={trackResult.request.signer_nip}
                    signerTteCode={trackResult.request.signer_tte_code}
                    useDigitalSignature={Boolean(trackResult.request.use_digital_signature)}
                    showActions={true}
                  />
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
