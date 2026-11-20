import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookmarkPlus,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  SkipForward,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { adminFetch } from '../../../utils/adminApi';
import type {
  WaBlastRecipientItem,
  WaBlastSession,
  WaGatewayStatus,
  WaRecipientContact,
  WaRoleGroup,
  WaTemplate,
} from '../../../types';

interface AdminWaBlasterProps {
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
  onOpenMenu?: (menuId: string) => void;
}

type RoleFilter = 'all' | WaRoleGroup;

const ROLE_FILTER_OPTIONS: Array<{ id: RoleFilter; label: string }> = [
  { id: 'all', label: 'Semua' },
  { id: 'perangkat', label: 'Perangkat Desa' },
  { id: 'kepala_dusun', label: 'Kepala Dusun' },
  { id: 'ketua_rw', label: 'Ketua RW' },
  { id: 'ketua_rt', label: 'Ketua RT' },
];

const VARIABLE_TOKENS: Array<{ token: string; label: string }> = [
  { token: '{{nama_penerima}}', label: 'Nama Penerima' },
  { token: '{{jabatan}}', label: 'Jabatan' },
  { token: '{{wilayah}}', label: 'Wilayah' },
  { token: '{{dusun}}', label: 'Dusun' },
  { token: '{{tanggal}}', label: 'Tanggal' },
];

function renderClientPreview(
  template: string,
  contact: Partial<WaRecipientContact> | undefined,
  todayLabel: string
): string {
  if (!template.trim()) return '';
  const target = contact || {
    name: 'Oman Abdurahman',
    jabatan: 'Kepala Dusun Pawenang',
    wilayah: 'Dusun Pawenang',
    dusun: 'Dusun Pawenang',
  };
  return template
    .replace(/\{\{\s*nama_penerima\s*\}\}|\{\{\s*nama\s*\}\}|\{\s*nama_penerima\s*\}|\{\s*nama\s*\}/gi, target.name || '-')
    .replace(/\{\{\s*jabatan\s*\}\}|\{\s*jabatan\s*\}/gi, target.jabatan || '-')
    .replace(/\{\{\s*wilayah\s*\}\}|\{\s*wilayah\s*\}/gi, target.wilayah || 'Desa Margamukti')
    .replace(/\{\{\s*dusun\s*\}\}|\{\s*dusun\s*\}/gi, target.dusun || 'Desa Margamukti')
    .replace(/\{\{\s*tanggal\s*\}\}|\{\s*tanggal\s*\}/gi, todayLabel || 'Hari ini');
}

function buildWaMeHref(phone: string, text: string): string {
  const cleanDigits = phone.replace(/\D/g, '');
  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(text)}`;
}

const RECIPIENT_STATUS_LABEL: Record<WaBlastRecipientItem['status'], string> = {
  pending: 'Menunggu',
  sent: 'Terkirim',
  skipped: 'Dilewati',
  failed: 'Gagal',
};

export function AdminWaBlasterModule({ onNotify, onOpenMenu }: AdminWaBlasterProps) {
  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'templates'>('compose');

  // Directory & gateway state
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState<WaRecipientContact[]>([]);
  const [gatewayStatus, setGatewayStatus] = useState<WaGatewayStatus>({
    configured: false,
    provider: 'fonnte',
    providerLabel: 'Fonnte API',
  });
  const [todayLabel, setTodayLabel] = useState('');

  // Templates & blasts state
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [blasts, setBlasts] = useState<WaBlastSession[]>([]);

  // Composer & filters
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [dusunFilter, setDusunFilter] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyValidPhone, setOnlyValidPhone] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const [blastTitle, setBlastTitle] = useState('');
  const [messageText, setMessageText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [deliveryMode, setDeliveryMode] = useState<'wa_me_queue' | 'gateway_api'>('wa_me_queue');
  const [submitting, setSubmitting] = useState(false);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Active blast queue / detail inspector
  const [activeBlast, setActiveBlast] = useState<WaBlastSession | null>(null);
  const [activeBlastRecipients, setActiveBlastRecipients] = useState<WaBlastRecipientItem[]>([]);
  const [updatingRecipientId, setUpdatingRecipientId] = useState<number | null>(null);
  const [confirmDeleteBlastId, setConfirmDeleteBlastId] = useState<number | null>(null);

  // Template modal & filters
  const [tplSearch, setTplSearch] = useState('');
  const [tplCategoryFilter, setTplCategoryFilter] = useState('Semua');
  const [tplStatusFilter, setTplStatusFilter] = useState<'all' | 'active' | 'draft'>('all');
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateForm, setTemplateForm] = useState<{
    title: string;
    category: string;
    content: string;
    status: 'draft' | 'active';
  }>({
    title: '',
    category: 'Rapat & Agenda',
    content: '',
    status: 'active',
  });
  const [tplPreviewContactKey, setTplPreviewContactKey] = useState<string>('');
  const tplTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [confirmDeleteTplId, setConfirmDeleteTplId] = useState<number | null>(null);
  const [duplicatingTplId, setDuplicatingTplId] = useState<number | null>(null);

  // Save draft from Compose quick modal
  const [saveDraftModalOpen, setSaveDraftModalOpen] = useState(false);
  const [quickDraftForm, setQuickDraftForm] = useState({
    title: '',
    category: 'Rapat & Agenda',
  });
  const [savingDraft, setSavingDraft] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, tplRes, blastRes] = await Promise.all([
        adminFetch('/api/admin/wa-blaster/recipients'),
        adminFetch('/api/admin/wa-blaster/templates'),
        adminFetch('/api/admin/wa-blaster/blasts'),
      ]);
      if (recRes.ok) {
        const recJson = await recRes.json();
        const list: WaRecipientContact[] = recJson.recipients || [];
        setRecipients(list);
        if (recJson.gatewayStatus) setGatewayStatus(recJson.gatewayStatus);
        if (recJson.todayLabel) setTodayLabel(recJson.todayLabel);
      }
      if (tplRes.ok) {
        const tplJson = await tplRes.json();
        const tpls: WaTemplate[] = tplJson.templates || [];
        setTemplates(tpls);
        const firstActive = tpls.find((t) => (t.status || 'active') === 'active') || tpls[0];
        setMessageText((prev) => (prev ? prev : firstActive?.content || ''));
        setSelectedTemplateId((prev) => (prev ? prev : firstActive ? String(firstActive.id) : ''));
      }
      if (blastRes.ok) {
        const blastJson = await blastRes.json();
        setBlasts(blastJson.blasts || []);
      }
    } catch {
      onNotify('Gagal memuat data WhatsApp Blaster.', 'err');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const dusunOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipients) {
      if (r.dusun) set.add(r.dusun);
    }
    return ['Semua', ...Array.from(set)];
  }, [recipients]);

  const missingPhoneCount = useMemo(
    () => recipients.filter((r) => !r.hasValidPhone).length,
    [recipients]
  );

  const validRecipientsCount = useMemo(
    () => recipients.filter((r) => r.hasValidPhone).length,
    [recipients]
  );

  const filteredRecipients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return recipients.filter((r) => {
      if (roleFilter !== 'all' && r.roleGroup !== roleFilter) return false;
      if (dusunFilter !== 'Semua' && r.dusun !== dusunFilter) return false;
      if (onlyValidPhone && !r.hasValidPhone) return false;
      if (q) {
        const hay = `${r.name} ${r.jabatan} ${r.wilayah} ${r.rawPhone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [recipients, roleFilter, dusunFilter, onlyValidPhone, searchQuery]);

  const selectedValidContacts = useMemo(
    () => recipients.filter((r) => r.hasValidPhone && selectedKeys.has(r.key)),
    [recipients, selectedKeys]
  );

  const previewContact = selectedValidContacts[0] || filteredRecipients.find((r) => r.hasValidPhone) || recipients[0];
  const renderedPreview = useMemo(
    () => renderClientPreview(messageText, previewContact, todayLabel),
    [messageText, previewContact, todayLabel]
  );

  const toggleSelectKey = (contact: WaRecipientContact) => {
    if (!contact.hasValidPhone) {
      onNotify(`Nomor WhatsApp ${contact.name} belum valid/belum diisi.`, 'err');
      return;
    }
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(contact.key)) next.delete(contact.key);
      else next.add(contact.key);
      return next;
    });
  };

  const selectAllFilteredValid = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const r of filteredRecipients) {
        if (r.hasValidPhone) next.add(r.key);
      }
      return next;
    });
  };

  const clearSelectedFiltered = () => {
    const filteredSet = new Set(filteredRecipients.map((r) => r.key));
    setSelectedKeys((prev) => {
      const next = new Set<string>();
      for (const k of prev) {
        if (!filteredSet.has(k)) next.add(k);
      }
      return next;
    });
  };

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = templates.find((t) => String(t.id) === tplId);
    if (tpl) {
      setMessageText(tpl.content);
      if (!blastTitle.trim()) {
        setBlastTitle(tpl.title);
      }
    }
  };

  const insertVariableToken = (token: string) => {
    const el = messageTextareaRef.current;
    if (!el) {
      setMessageText((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${token}`);
      return;
    }
    const start = el.selectionStart ?? messageText.length;
    const end = el.selectionEnd ?? messageText.length;
    const nextVal = `${messageText.slice(0, start)}${token}${messageText.slice(end)}`;
    setMessageText(nextVal);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleCreateBlast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedValidContacts.length === 0) {
      onNotify('Pilih minimal 1 penerima dengan nomor WhatsApp aktif.', 'err');
      return;
    }
    if (!messageText.trim()) {
      onNotify('Isi pesan siaran WhatsApp tidak boleh kosong.', 'err');
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminFetch('/api/admin/wa-blaster/blasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: blastTitle.trim() || `Siaran Desa · ${todayLabel}`,
          message_template: messageText.trim(),
          delivery_mode: deliveryMode,
          recipient_keys: selectedValidContacts.map((c) => c.key),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || 'Gagal membuat sesi siaran WhatsApp.', 'err');
        return;
      }

      setActiveBlast(json.blast);
      setActiveBlastRecipients(json.recipients || []);
      setActiveTab('history');

      const listRes = await adminFetch('/api/admin/wa-blaster/blasts');
      if (listRes.ok) {
        const listJson = await listRes.json();
        setBlasts(listJson.blasts || []);
      }

      if (deliveryMode === 'gateway_api') {
        onNotify(
          `Siaran Gateway selesai: ${json.blast.sent_count} terkirim, ${json.blast.failed_count} gagal.`
        );
      } else {
        onNotify(
          `Antrean siaran dibuat untuk ${json.blast.total_recipients} penerima. Silakan kirim bertahap.`
        );
      }
    } catch {
      onNotify('Terjadi gangguan jaringan saat membuat sesi siaran.', 'err');
    } finally {
      setSubmitting(false);
    }
  };

  const openBlastDetail = async (blastId: number) => {
    const res = await adminFetch(`/api/admin/wa-blaster/blasts/${blastId}`);
    if (!res.ok) {
      onNotify('Gagal memuat detail antrean siaran.', 'err');
      return;
    }
    const json = await res.json();
    setActiveBlast(json.blast);
    setActiveBlastRecipients(json.recipients || []);
    setActiveTab('history');
  };

  const updateRecipientStatus = async (
    recipientId: number,
    status: 'pending' | 'sent' | 'skipped' | 'failed'
  ) => {
    if (!activeBlast) return;
    setUpdatingRecipientId(recipientId);
    try {
      const res = await adminFetch(
        `/api/admin/wa-blaster/blasts/${activeBlast.id}/recipients/${recipientId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        onNotify(json.error || 'Gagal memperbarui status penerima.', 'err');
        return;
      }
      setActiveBlast(json.blast);
      setActiveBlastRecipients(json.recipients || []);
      setBlasts((prev) => prev.map((b) => (b.id === json.blast.id ? json.blast : b)));
    } finally {
      setUpdatingRecipientId(null);
    }
  };

  const handleDeleteBlast = async (id: number) => {
    const res = await adminFetch(`/api/admin/wa-blaster/blasts/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      onNotify('Gagal menghapus riwayat siaran.', 'err');
      return;
    }
    setConfirmDeleteBlastId(null);
    if (activeBlast?.id === id) {
      setActiveBlast(null);
      setActiveBlastRecipients([]);
    }
    setBlasts((prev) => prev.filter((b) => b.id !== id));
    onNotify('Riwayat siaran dihapus.');
  };

  // Template CRUD & Filters
  const templateCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const t of templates) {
      if (t.category) cats.add(t.category);
    }
    return ['Semua', ...Array.from(cats)];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const q = tplSearch.trim().toLowerCase();
    return templates.filter((t) => {
      const st = t.status === 'draft' ? 'draft' : 'active';
      if (tplStatusFilter !== 'all' && st !== tplStatusFilter) return false;
      if (tplCategoryFilter !== 'Semua' && t.category !== tplCategoryFilter) return false;
      if (q) {
        const hay = `${t.title} ${t.category} ${t.content}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [templates, tplSearch, tplCategoryFilter, tplStatusFilter]);

  const tplPreviewContact = useMemo(() => {
    if (tplPreviewContactKey) {
      const found = recipients.find((r) => r.key === tplPreviewContactKey);
      if (found) return found;
    }
    return recipients[0];
  }, [recipients, tplPreviewContactKey]);

  const tplModalRenderedPreview = useMemo(
    () => renderClientPreview(templateForm.content, tplPreviewContact, todayLabel),
    [templateForm.content, tplPreviewContact, todayLabel]
  );

  const insertTokenIntoTemplateModal = (token: string) => {
    const el = tplTextareaRef.current;
    if (!el) {
      setTemplateForm((prev) => ({
        ...prev,
        content: `${prev.content}${prev.content && !prev.content.endsWith(' ') ? ' ' : ''}${token}`,
      }));
      return;
    }
    const start = el.selectionStart ?? templateForm.content.length;
    const end = el.selectionEnd ?? templateForm.content.length;
    const nextVal = `${templateForm.content.slice(0, start)}${token}${templateForm.content.slice(end)}`;
    setTemplateForm((prev) => ({ ...prev, content: nextVal }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const openNewTemplate = (defaultStatus: 'draft' | 'active' = 'active') => {
    setEditingTemplateId(null);
    setTemplateForm({
      title: '',
      category: 'Rapat & Agenda',
      content:
        `Assalamu'alaikum Wr. Wb.\nYth. Bapak/Ibu *{{nama_penerima}}* ({{jabatan}} - {{wilayah}}),\n\n`,
      status: defaultStatus,
    });
    setTemplateModalOpen(true);
  };

  const openEditTemplate = (tpl: WaTemplate) => {
    setEditingTemplateId(tpl.id);
    setTemplateForm({
      title: tpl.title,
      category: tpl.category,
      content: tpl.content,
      status: tpl.status === 'draft' ? 'draft' : 'active',
    });
    setTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingTemplateId
      ? `/api/admin/wa-blaster/templates/${editingTemplateId}`
      : '/api/admin/wa-blaster/templates';
    const method = editingTemplateId ? 'PUT' : 'POST';
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateForm),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      onNotify(json.error || 'Gagal menyimpan template pesan.', 'err');
      return;
    }
    setTemplateModalOpen(false);
    const tplRes = await adminFetch('/api/admin/wa-blaster/templates');
    if (tplRes.ok) {
      const tplJson = await tplRes.json();
      setTemplates(tplJson.templates || []);
    }
    onNotify(
      templateForm.status === 'draft'
        ? 'Draft template pesan WhatsApp disimpan.'
        : 'Template pesan WhatsApp aktif tersimpan.'
    );
  };

  const handleOpenSaveComposeDraft = () => {
    if (!messageText.trim()) {
      onNotify('Tulis isi pesan terlebih dahulu sebelum menyimpan ke draft.', 'err');
      return;
    }
    setQuickDraftForm({
      title: blastTitle.trim() || `Draft Pesan · ${todayLabel || 'Baru'}`,
      category: 'Rapat & Agenda',
    });
    setSaveDraftModalOpen(true);
  };

  const handleConfirmSaveComposeDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDraft(true);
    try {
      const res = await adminFetch('/api/admin/wa-blaster/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quickDraftForm.title.trim(),
          category: quickDraftForm.category.trim() || 'Umum',
          content: messageText.trim(),
          status: 'draft',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onNotify(json.error || 'Gagal menyimpan draft pesan.', 'err');
        return;
      }
      setSaveDraftModalOpen(false);
      const tplRes = await adminFetch('/api/admin/wa-blaster/templates');
      if (tplRes.ok) {
        const tplJson = await tplRes.json();
        setTemplates(tplJson.templates || []);
      }
      onNotify(`Draft "${quickDraftForm.title.trim()}" tersimpan di Manajemen Template.`);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleDuplicateTemplate = async (tpl: WaTemplate) => {
    setDuplicatingTplId(tpl.id);
    try {
      const res = await adminFetch(`/api/admin/wa-blaster/templates/${tpl.id}/duplicate`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onNotify(json.error || 'Gagal menduplikat template.', 'err');
        return;
      }
      const tplRes = await adminFetch('/api/admin/wa-blaster/templates');
      if (tplRes.ok) {
        const tplJson = await tplRes.json();
        setTemplates(tplJson.templates || []);
      }
      onNotify(`Template "${tpl.title}" diduplikat sebagai Draft.`);
    } finally {
      setDuplicatingTplId(null);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    const res = await adminFetch(`/api/admin/wa-blaster/templates/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      onNotify('Gagal menghapus template.', 'err');
      return;
    }
    setConfirmDeleteTplId(null);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    onNotify('Template pesan dihapus.');
  };

  const nextPendingRecipient = useMemo(
    () => activeBlastRecipients.find((r) => r.status === 'pending') || null,
    [activeBlastRecipients]
  );

  return (
    <div className="space-y-5">
      {/* Header + Segmented Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">
            WhatsApp Blaster Aparatur &amp; Wilayah
          </h2>
          <p className="text-xs text-slate-500">
            Siarkan informasi resmi kepada Perangkat Desa, Kepala Dusun, Ketua RW, dan Ketua RT dari direktori sistem.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'compose'
                ? 'bg-white text-[#0F2744] shadow-sm'
                : 'text-slate-600 hover:text-[#0F2744]'
            }`}
          >
            <Send className="w-3.5 h-3.5" /> Tulis &amp; Kirim
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-[#0F2744] shadow-sm'
                : 'text-slate-600 hover:text-[#0F2744]'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Antrean &amp; Log
            {blasts.length > 0 && (
              <span className="font-mono-tabular text-[11px] text-slate-500">({blasts.length})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'templates'
                ? 'bg-white text-[#0F2744] shadow-sm'
                : 'text-slate-600 hover:text-[#0F2744]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Template ({templates.length})
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <div>
            <span className="text-slate-500 block">Kontak Siap WA</span>
            <span className="text-base font-bold text-[#0F2744] font-mono-tabular">
              {validRecipientsCount} / {recipients.length}
            </span>
          </div>
          <div className="hidden sm:block h-7 w-px bg-slate-200" />
          <div>
            <span className="text-slate-500 block">Perangkat Desa</span>
            <span className="text-sm font-semibold text-slate-800 font-mono-tabular">
              {recipients.filter((r) => r.roleGroup === 'perangkat' && r.hasValidPhone).length} aktif
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Kadus · RW · RT</span>
            <span className="text-sm font-semibold text-slate-800 font-mono-tabular">
              {recipients.filter((r) => r.roleGroup === 'kepala_dusun' && r.hasValidPhone).length} ·{' '}
              {recipients.filter((r) => r.roleGroup === 'ketua_rw' && r.hasValidPhone).length} ·{' '}
              {recipients.filter((r) => r.roleGroup === 'ketua_rt' && r.hasValidPhone).length} aktif
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {missingPhoneCount > 0 && onOpenMenu && (
            <button
              type="button"
              onClick={() => onOpenMenu('wilayah')}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-md cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {missingPhoneCount} kontak belum bernomor WA · Lengkapi di Wilayah
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: TULIS & KIRIM */}
      {activeTab === 'compose' && (
        <form onSubmit={handleCreateBlast} className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Left Panel: Recipient Selection */}
          <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#0F2744]" />
                <h3 className="text-sm font-semibold text-[#0F2744]">1. Pilih Penerima Siaran</h3>
              </div>
              <span className="text-xs font-semibold font-mono-tabular text-[#0F2744]">
                {selectedValidContacts.length} dipilih
              </span>
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {ROLE_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRoleFilter(opt.id)}
                  className={`min-h-[38px] px-2.5 py-1.5 text-xs font-semibold rounded-md border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    roleFilter === opt.id
                      ? 'bg-[#0F2744] text-white border-[#0F2744]'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Search & Dusun Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, RT/RW, nomor..."
                  className="w-full pl-9 pr-3 py-2 min-h-[42px] text-xs border border-slate-300 rounded-md"
                />
              </div>
              <select
                value={dusunFilter}
                onChange={(e) => setDusunFilter(e.target.value)}
                className="w-full px-3 py-2 min-h-[42px] text-xs border border-slate-300 rounded-md bg-white"
              >
                {dusunOptions.map((d) => (
                  <option key={d} value={d}>
                    {d === 'Semua' ? 'Semua Wilayah / Dusun' : d}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-y border-slate-100 py-2">
              <label className="inline-flex items-center gap-2 text-slate-600 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={onlyValidPhone}
                  onChange={(e) => setOnlyValidPhone(e.target.checked)}
                  className="rounded border-slate-300 text-[#0F2744]"
                />
                <span>Hanya yang memiliki nomor WA</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={selectAllFilteredValid}
                  className="font-semibold text-[#0F2744] hover:underline cursor-pointer min-h-[36px]"
                >
                  Pilih Semua ({filteredRecipients.filter((r) => r.hasValidPhone).length})
                </button>
                <button
                  type="button"
                  onClick={clearSelectedFiltered}
                  className="text-slate-500 hover:text-red-600 cursor-pointer min-h-[36px]"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            {/* Contacts Checklist */}
            <div className="max-h-[430px] overflow-y-auto divide-y divide-slate-100 -mx-1 px-1">
              {loading && (
                <div className="py-10 text-center text-xs text-slate-400">Memuat daftar kontak...</div>
              )}

              {!loading && filteredRecipients.length === 0 && (
                <div className="py-10 text-center text-xs text-slate-500 space-y-2">
                  <p>Tidak ada kontak yang sesuai dengan filter saat ini.</p>
                  {onlyValidPhone && missingPhoneCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setOnlyValidPhone(false)}
                      className="text-[#0F2744] font-semibold hover:underline cursor-pointer"
                    >
                      Tampilkan juga kontak tanpa nomor WA
                    </button>
                  )}
                </div>
              )}

              {!loading &&
                filteredRecipients.map((contact) => {
                  const checked = selectedKeys.has(contact.key);
                  return (
                    <label
                      key={contact.key}
                      className={`flex items-start gap-3 py-2.5 px-2 rounded-lg transition-colors min-h-[52px] ${
                        contact.hasValidPhone
                          ? 'hover:bg-slate-50 cursor-pointer'
                          : 'opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!contact.hasValidPhone}
                        onChange={() => toggleSelectKey(contact)}
                        className="mt-1 w-4 h-4 rounded border-slate-300 text-[#0F2744] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[#0F2744] truncate">
                            {contact.name}
                          </p>
                          <span className="text-[11px] font-mono-tabular text-slate-600 shrink-0">
                            {contact.hasValidPhone ? `+${contact.normalizedPhone}` : 'Belum ada WA'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {contact.jabatan} · {contact.wilayah}
                        </p>
                      </div>
                    </label>
                  );
                })}
            </div>
          </div>

          {/* Right Panel: Message Composer + Live Preview + Send Mode */}
          <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#0F2744]">2. Tulis Pesan &amp; Pratinjau</h3>
              <span className="text-[11px] text-slate-500">Tanggal sistem: {todayLabel}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Sesi Siaran
                </label>
                <input
                  value={blastTitle}
                  onChange={(e) => setBlastTitle(e.target.value)}
                  placeholder="Contoh: Undangan Minggon Desa"
                  className="w-full px-3 py-2 min-h-[42px] text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gunakan Template Pesan
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="w-full px-3 py-2 min-h-[42px] text-sm border border-slate-300 rounded-md bg-white"
                >
                  <option value="">-- Pilih Template --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.status === 'draft' ? '[Draft] ' : ''}
                      {t.title} ({t.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-semibold text-slate-700">Isi Pesan WhatsApp *</label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Sisip variabel:</span>
                  {VARIABLE_TOKENS.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => insertVariableToken(v.token)}
                      className="px-2 py-1 text-[11px] font-mono-tabular font-semibold bg-slate-100 hover:bg-slate-200 text-[#0F2744] rounded cursor-pointer"
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                ref={messageTextareaRef}
                required
                rows={7}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Ketik pesan siaran atau pilih dari template..."
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md leading-relaxed"
              />
            </div>

            {/* Live Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-600">
                Pratinjau Pesan ({previewContact ? `${previewContact.name} · ${previewContact.jabatan}` : 'Contoh Penerima'})
              </p>
              <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {renderedPreview || 'Pratinjau pesan akan tampil di sini.'}
              </p>
            </div>

            {/* Delivery Mode Switch */}
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-slate-700">3. Mekanisme Pengiriman</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryMode('wa_me_queue')}
                  className={`text-left p-3.5 rounded-lg border transition-colors min-h-[76px] cursor-pointer ${
                    deliveryMode === 'wa_me_queue'
                      ? 'border-[#0F2744] bg-[#0F2744]/5'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-semibold text-[#0F2744]">
                    Antrean Kirim Cepat (wa.me Gratis)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Langsung siap pakai tanpa API berbayar. Kirim satu per satu lewat WhatsApp Anda dengan pelacak progres otomatis.
                  </p>
                </button>

                <button
                  type="button"
                  disabled={!gatewayStatus.configured}
                  onClick={() => setDeliveryMode('gateway_api')}
                  className={`text-left p-3.5 rounded-lg border transition-colors min-h-[76px] ${
                    !gatewayStatus.configured
                      ? 'border-slate-200 bg-slate-50 opacity-65 cursor-not-allowed'
                      : deliveryMode === 'gateway_api'
                      ? 'border-[#0F2744] bg-[#0F2744]/5 cursor-pointer'
                      : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                  }`}
                >
                  <p className="text-xs font-semibold text-[#0F2744]">
                    Otomatis via Gateway API Server
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {gatewayStatus.configured
                      ? `Terhubung ke ${gatewayStatus.providerLabel}. Pesan dikirim serentak dari server.`
                      : 'Siap diaktifkan melalui konfigurasi WA_GATEWAY_URL & WA_GATEWAY_TOKEN pada environment server.'}
                  </p>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Target aktif terpilih:{' '}
                <span className="font-bold font-mono-tabular text-[#0F2744]">
                  {selectedValidContacts.length} penerima
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleOpenSaveComposeDraft}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 text-xs font-semibold text-[#0F2744] bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  <BookmarkPlus className="w-4 h-4 text-[#A67F17]" />
                  Simpan ke Draft Template
                </button>
                <button
                  type="submit"
                  disabled={submitting || selectedValidContacts.length === 0}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {submitting
                    ? 'Memproses Siaran...'
                    : deliveryMode === 'gateway_api'
                    ? `Kirim Otomatis (${selectedValidContacts.length})`
                    : `Buat Antrean Kirim (${selectedValidContacts.length})`}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: ANTREAN & LOG RIWAYAT */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          {activeBlast && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    {activeBlast.delivery_mode === 'gateway_api'
                      ? 'Gateway API Otomatis'
                      : 'Antrean wa.me Interaktif'}{' '}
                    · Oleh {activeBlast.created_by} · {activeBlast.created_at.slice(0, 16).replace('T', ' ')}
                  </p>
                  <h3 className="text-base font-semibold text-[#0F2744]">{activeBlast.title}</h3>
                  <p className="text-xs text-slate-600">{activeBlast.target_summary}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveBlast(null);
                    setActiveBlastRecipients([]);
                  }}
                  className="inline-flex items-center gap-1 min-h-[40px] px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  <X className="w-4 h-4" /> Tutup Detail
                </button>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0F2744]">
                    Progres Pengiriman: {activeBlast.sent_count} / {activeBlast.total_recipients} terkirim
                    {activeBlast.failed_count > 0 ? ` · ${activeBlast.failed_count} gagal` : ''}
                  </span>
                  <span className="font-mono-tabular font-bold text-[#0F2744]">
                    {activeBlast.total_recipients > 0
                      ? Math.round((activeBlast.sent_count / activeBlast.total_recipients) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#C59B27] transition-all duration-200"
                    style={{
                      width: `${
                        activeBlast.total_recipients > 0
                          ? Math.round((activeBlast.sent_count / activeBlast.total_recipients) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Next Queue Spotlight for wa.me mode */}
              {activeBlast.delivery_mode === 'wa_me_queue' && nextPendingRecipient && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] font-semibold text-[#A67F17]">
                      Antrean Berikutnya Siap Dikirim
                    </p>
                    <p className="text-sm font-bold text-[#0F2744] truncate">
                      {nextPendingRecipient.name}
                    </p>
                    <p className="text-xs text-slate-600">
                      {nextPendingRecipient.role_label} · {nextPendingRecipient.wilayah_label} ·{' '}
                      <span className="font-mono-tabular">+{nextPendingRecipient.phone}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={buildWaMeHref(
                        nextPendingRecipient.phone,
                        nextPendingRecipient.rendered_message
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => updateRecipientStatus(nextPendingRecipient.id, 'sent')}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md whitespace-nowrap"
                    >
                      <ExternalLink className="w-4 h-4" /> Buka WhatsApp &amp; Tandai Terkirim
                    </a>
                    <button
                      type="button"
                      disabled={updatingRecipientId === nextPendingRecipient.id}
                      onClick={() => updateRecipientStatus(nextPendingRecipient.id, 'skipped')}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer"
                    >
                      <SkipForward className="w-3.5 h-3.5" /> Lewati
                    </button>
                  </div>
                </div>
              )}

              {activeBlast.status === 'completed' && (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Seluruh antrean pada sesi ini telah selesai diproses.</span>
                </div>
              )}

              {/* Mobile Recipient Cards */}
              <div className="md:hidden space-y-2.5">
                {activeBlastRecipients.map((rec) => (
                  <div
                    key={rec.id}
                    className="border border-slate-200 rounded-lg p-3.5 space-y-2.5 bg-white"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#0F2744] truncate">{rec.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {rec.role_label} · {rec.wilayah_label}
                        </p>
                        <p className="text-[11px] font-mono-tabular text-slate-600">
                          +{rec.phone}
                        </p>
                      </div>
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${
                          rec.status === 'sent'
                            ? 'text-emerald-700'
                            : rec.status === 'failed'
                            ? 'text-red-700'
                            : rec.status === 'skipped'
                            ? 'text-slate-500'
                            : 'text-amber-700'
                        }`}
                      >
                        {RECIPIENT_STATUS_LABEL[rec.status]}
                      </span>
                    </div>

                    {rec.gateway_response && (
                      <p className="text-[11px] text-slate-500">{rec.gateway_response}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <a
                        href={buildWaMeHref(rec.phone, rec.rendered_message)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => updateRecipientStatus(rec.id, 'sent')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Kirim WA
                      </a>
                      {rec.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => updateRecipientStatus(rec.id, 'skipped')}
                          className="min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                        >
                          Lewati
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateRecipientStatus(rec.id, 'pending')}
                          className="min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Recipient Table */}
              <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                        <th className="py-2.5 px-3">Penerima &amp; Jabatan</th>
                        <th className="py-2.5 px-3">Wilayah</th>
                        <th className="py-2.5 px-3">Nomor WA</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Aksi Antrean</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {activeBlastRecipients.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-[#0F2744]">{rec.name}</p>
                            <p className="text-[11px] text-slate-500">{rec.role_label}</p>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{rec.wilayah_label}</td>
                          <td className="py-2.5 px-3 font-mono-tabular text-slate-700">
                            +{rec.phone}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`font-semibold ${
                                rec.status === 'sent'
                                  ? 'text-emerald-700'
                                  : rec.status === 'failed'
                                  ? 'text-red-700'
                                  : rec.status === 'skipped'
                                  ? 'text-slate-500'
                                  : 'text-amber-700'
                              }`}
                            >
                              {RECIPIENT_STATUS_LABEL[rec.status]}
                            </span>
                            {rec.gateway_response && (
                              <p className="text-[11px] text-slate-400">{rec.gateway_response}</p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <a
                                href={buildWaMeHref(rec.phone, rec.rendered_message)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => updateRecipientStatus(rec.id, 'sent')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded"
                              >
                                <ExternalLink className="w-3 h-3" /> Kirim WA
                              </a>
                              {rec.status !== 'sent' && (
                                <button
                                  type="button"
                                  disabled={updatingRecipientId === rec.id}
                                  onClick={() => updateRecipientStatus(rec.id, 'sent')}
                                  className="px-2 py-1.5 text-[11px] font-semibold text-[#0F2744] border border-slate-300 hover:bg-slate-100 rounded cursor-pointer"
                                  title="Tandai Terkirim"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              )}
                              {rec.status === 'pending' ? (
                                <button
                                  type="button"
                                  disabled={updatingRecipientId === rec.id}
                                  onClick={() => updateRecipientStatus(rec.id, 'skipped')}
                                  className="px-2 py-1.5 text-[11px] text-slate-600 border border-slate-300 hover:bg-slate-100 rounded cursor-pointer"
                                  title="Lewati"
                                >
                                  <SkipForward className="w-3 h-3" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={updatingRecipientId === rec.id}
                                  onClick={() => updateRecipientStatus(rec.id, 'pending')}
                                  className="px-2 py-1.5 text-[11px] text-slate-600 border border-slate-300 hover:bg-slate-100 rounded cursor-pointer"
                                  title="Kembalikan ke Menunggu"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sessions History List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#0F2744]">Riwayat Sesi WhatsApp Blaster</h3>
              <span className="text-xs font-mono-tabular text-slate-500">{blasts.length} sesi</span>
            </div>

            {blasts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <Clock className="w-5 h-5 text-slate-400 mx-auto" />
                <p>Belum ada riwayat siaran WhatsApp.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('compose')}
                  className="text-[#0F2744] font-semibold hover:underline cursor-pointer"
                >
                  Buat Siaran Pertama
                </button>
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {blasts.map((b) => (
                    <div key={b.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#0F2744] truncate">{b.title}</p>
                          <p className="text-[11px] text-slate-500">
                            {b.created_at.slice(0, 16).replace('T', ' ')} · {b.created_by}
                          </p>
                        </div>
                        <span className="font-mono-tabular text-xs font-bold text-[#0F2744] shrink-0">
                          {b.sent_count}/{b.total_recipients}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{b.target_summary}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openBlastDetail(b.id)}
                          className="flex-1 min-h-[44px] px-3 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
                        >
                          {b.status === 'completed' ? 'Lihat Log' : 'Lanjutkan Antrean'}
                        </button>
                        {confirmDeleteBlastId === b.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteBlast(b.id)}
                              className="min-h-[44px] px-3 py-2 text-xs font-semibold text-white bg-red-600 rounded-md cursor-pointer"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteBlastId(null)}
                              className="min-h-[44px] px-2.5 py-2 text-xs text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteBlastId(b.id)}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-red-600 border border-slate-200 rounded-md cursor-pointer"
                            aria-label="Hapus riwayat siaran"
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
                        <th className="py-3 px-4">Waktu &amp; Pengirim</th>
                        <th className="py-3 px-4">Judul &amp; Target</th>
                        <th className="py-3 px-4">Mode</th>
                        <th className="py-3 px-4">Progres</th>
                        <th className="py-3 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {blasts.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <p className="font-mono-tabular text-slate-700">
                              {b.created_at.slice(0, 16).replace('T', ' ')}
                            </p>
                            <p className="text-[11px] text-slate-500">{b.created_by}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-[#0F2744]">{b.title}</p>
                            <p className="text-[11px] text-slate-500">{b.target_summary}</p>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {b.delivery_mode === 'gateway_api' ? 'Gateway API' : 'Antrean wa.me'}
                          </td>
                          <td className="py-3 px-4 font-mono-tabular">
                            <span className="font-bold text-[#0F2744]">
                              {b.sent_count}/{b.total_recipients}
                            </span>{' '}
                            <span className="text-slate-500">
                              · {b.status === 'completed' ? 'Selesai' : 'Berjalan'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openBlastDetail(b.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded mr-2 cursor-pointer"
                            >
                              {b.status === 'completed' ? 'Lihat Log' : 'Lanjutkan'}
                            </button>
                            {confirmDeleteBlastId === b.id ? (
                              <span className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBlast(b.id)}
                                  className="px-2 py-1 text-[11px] font-semibold text-white bg-red-600 rounded cursor-pointer"
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteBlastId(null)}
                                  className="px-2 py-1 text-[11px] text-slate-600 border border-slate-300 rounded cursor-pointer"
                                >
                                  Batal
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteBlastId(b.id)}
                                className="p-1.5 text-slate-500 hover:text-red-600 cursor-pointer"
                                title="Hapus Riwayat"
                              >
                                <Trash2 className="w-4 h-4" />
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

      {/* TAB 3: MANAJEMEN TEMPLATE & DRAFT PESAN */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              Kelola template resmi &amp; konsep draft dengan variabel otomatis{' '}
              <span className="font-mono-tabular font-semibold">{'{{nama_penerima}}'}</span>,{' '}
              <span className="font-mono-tabular font-semibold">{'{{jabatan}}'}</span>,{' '}
              <span className="font-mono-tabular font-semibold">{'{{wilayah}}'}</span>, dan{' '}
              <span className="font-mono-tabular font-semibold">{'{{tanggal}}'}</span>.
            </p>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => openNewTemplate('draft')}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 text-xs font-semibold text-[#0F2744] bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                <BookmarkPlus className="w-4 h-4 text-[#A67F17]" /> Buat Draft
              </button>
              <button
                type="button"
                onClick={() => openNewTemplate('active')}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Tambah Template Aktif
              </button>
            </div>
          </div>

          {/* Search & Filters Strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={tplSearch}
                  onChange={(e) => setTplSearch(e.target.value)}
                  placeholder="Cari judul, kategori, atau isi pesan..."
                  className="w-full pl-9 pr-3 py-2 min-h-[40px] text-xs border border-slate-300 rounded-md"
                />
              </div>
              <select
                value={tplCategoryFilter}
                onChange={(e) => setTplCategoryFilter(e.target.value)}
                className="px-3 py-2 min-h-[40px] text-xs border border-slate-300 rounded-md bg-white sm:w-52"
              >
                {templateCategories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'Semua' ? 'Semua Kategori' : c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: `Semua (${templates.length})` },
                {
                  id: 'active',
                  label: `Aktif (${templates.filter((t) => (t.status || 'active') === 'active').length})`,
                },
                {
                  id: 'draft',
                  label: `Draft (${templates.filter((t) => t.status === 'draft').length})`,
                },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setTplStatusFilter(st.id as 'all' | 'active' | 'draft')}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md border whitespace-nowrap shrink-0 cursor-pointer ${
                    tplStatusFilter === st.id
                      ? 'bg-[#0F2744] text-white border-[#0F2744]'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              Tidak ada template pesan yang sesuai dengan pencarian atau filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((tpl) => {
                const isDraft = tpl.status === 'draft';
                return (
                  <div
                    key={tpl.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold text-[#A67F17]">{tpl.category}</p>
                          <h4 className="text-sm font-semibold text-[#0F2744]">{tpl.title}</h4>
                        </div>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                            isDraft
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isDraft ? 'Draft' : 'Aktif'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-5 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg p-3">
                        {tpl.content}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectTemplate(String(tpl.id));
                          setActiveTab('compose');
                          onNotify(`Template "${tpl.title}" dimuat ke editor pesan.`);
                        }}
                        className="flex-1 sm:flex-none min-h-[40px] px-3 py-1.5 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
                      >
                        Gunakan ke Editor
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={duplicatingTplId === tpl.id}
                          onClick={() => handleDuplicateTemplate(tpl)}
                          className="min-h-[40px] px-2.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#0F2744] border border-slate-200 rounded-md cursor-pointer disabled:opacity-50"
                          title="Duplikat sebagai Draft baru"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Duplikat</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditTemplate(tpl)}
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-600 hover:text-[#0F2744] border border-slate-200 rounded-md cursor-pointer"
                          aria-label="Edit template"
                          title="Edit template"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {confirmDeleteTplId === tpl.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(tpl.id)}
                              className="min-h-[40px] px-2.5 text-xs font-semibold text-white bg-red-600 rounded-md cursor-pointer"
                            >
                              Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTplId(null)}
                              className="min-h-[40px] px-2 text-xs text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTplId(tpl.id)}
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-600 hover:text-red-600 border border-slate-200 rounded-md cursor-pointer"
                            aria-label="Hapus template"
                            title="Hapus template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Quick Save Compose Message to Draft Modal */}
      {saveDraftModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-[#0F2744]">Simpan ke Draft Template</h3>
              <button
                type="button"
                onClick={() => setSaveDraftModalOpen(false)}
                className="p-1 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmSaveComposeDraft} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Draft Template *
                </label>
                <input
                  required
                  value={quickDraftForm.title}
                  onChange={(e) => setQuickDraftForm({ ...quickDraftForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                <input
                  value={quickDraftForm.category}
                  onChange={(e) => setQuickDraftForm({ ...quickDraftForm, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 line-clamp-4 whitespace-pre-wrap">
                {messageText}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSaveDraftModalOpen(false)}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingDraft}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer disabled:opacity-50"
                >
                  {savingDraft ? 'Menyimpan...' : 'Simpan Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Create/Edit Modal with Variable Insertion & Live Recipient Preview */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-2xl w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-[#0F2744]">
                {editingTemplateId ? 'Edit Template / Draft Pesan' : 'Buat Template / Draft Pesan'}
              </h3>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 cursor-pointer"
                aria-label="Tutup modal template"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Judul Template *
                  </label>
                  <input
                    required
                    value={templateForm.title}
                    onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                    placeholder="Contoh: Undangan Kerja Bakti"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={templateForm.status}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        status: e.target.value as 'draft' | 'active',
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white font-semibold"
                  >
                    <option value="active">Aktif (Siap Pakai)</option>
                    <option value="draft">Draft (Konsep)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                <input
                  value={templateForm.category}
                  onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                  placeholder="Contoh: Rapat & Agenda"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Isi Pesan Template *
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">Sisip variabel:</span>
                    {VARIABLE_TOKENS.map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onClick={() => insertTokenIntoTemplateModal(v.token)}
                        className="px-2 py-1 text-[11px] font-mono-tabular font-semibold bg-slate-100 hover:bg-slate-200 text-[#0F2744] rounded cursor-pointer"
                      >
                        {v.token}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  ref={tplTextareaRef}
                  required
                  rows={6}
                  value={templateForm.content}
                  onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md leading-relaxed"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Mendukung format baru ({'{{nama_penerima}}'}, {'{{jabatan}}'}) maupun format lama ({'{nama}'}, {'{jabatan}'}).
                </p>
              </div>

              {/* Live Recipient Preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-[#0F2744]">
                    Pratinjau Langsung pada Penerima:
                  </label>
                  <select
                    value={tplPreviewContact?.key || ''}
                    onChange={(e) => setTplPreviewContactKey(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white sm:max-w-xs"
                  >
                    {recipients.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.name} ({r.jabatan})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {tplModalRenderedPreview || 'Pratinjau pesan tampil di sini.'}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
                >
                  {templateForm.status === 'draft' ? 'Simpan Draft' : 'Simpan Template Aktif'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
