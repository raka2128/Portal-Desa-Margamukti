import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { adminFetch } from '../utils/adminApi';
import { downloadBlobFile } from '../utils/mobileDownload';
import type { BackupArchive, BackupOverviewResponse } from '../types';

interface BackupArchiveModalProps {
  open: boolean;
  onClose: () => void;
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

function formatWibDateTime(sqliteUtcStr: string | null): string {
  if (!sqliteUtcStr) return 'Belum tersedia';
  const normalized = sqliteUtcStr.includes('T')
    ? sqliteUtcStr
    : `${sqliteUtcStr.replace(' ', 'T')}Z`;
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return sqliteUtcStr;
  const datePart = dt.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timePart = dt.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart} · ${timePart} WIB`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function extractFilenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(header);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

export function BackupArchiveModal({ open, onClose, onNotify }: BackupArchiveModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | 'live' | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [overview, setOverview] = useState<BackupOverviewResponse | null>(null);

  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await adminFetch('/api/admin/backups');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal memuat riwayat cadangan data.');
      }
      setOverview(json as BackupOverviewResponse);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat riwayat cadangan data.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadOverview();
    }
  }, [open, loadOverview]);

  if (!open) return null;

  const triggerBlobDownload = async (endpoint: string, fallbackName: string, key: number | 'live') => {
    setDownloadingId(key);
    try {
      const res = await adminFetch(endpoint);
      if (!res.ok) {
        let errText = 'Gagal mengunduh berkas JSON cadangan.';
        try {
          const errJson = await res.json();
          if (errJson?.error) errText = errJson.error;
        } catch {
          // Gunakan pesan bawaan
        }
        onNotifyRef.current(errText, 'err');
        return;
      }
      const blob = await res.blob();
      const filename = extractFilenameFromDisposition(
        res.headers.get('Content-Disposition'),
        fallbackName
      );
      await downloadBlobFile(blob, filename);
      onNotifyRef.current(`Berkas cadangan ${filename} berhasil diunduh.`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCreateServerSnapshot = async () => {
    setCreating(true);
    try {
      const res = await adminFetch('/api/admin/backups', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        onNotifyRef.current(json.error || 'Gagal menyimpan snapshot cadangan di server.', 'err');
        return;
      }
      onNotifyRef.current('Snapshot cadangan JSON berhasil disimpan ke riwayat server.');
      await loadOverview();
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteManualArchive = async (item: BackupArchive) => {
    setDeletingId(item.id);
    try {
      const res = await adminFetch(`/api/admin/backups/${item.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        onNotifyRef.current(json.error || 'Gagal menghapus arsip cadangan.', 'err');
        return;
      }
      onNotifyRef.current(`Arsip manual ${item.filename} dihapus dari server.`);
      await loadOverview();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-950/70 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-5xl w-full max-h-[92dvh] overflow-y-auto border border-slate-200 shadow-2xl pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#0F2744] text-[#E5C158] flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-[#0F2744] leading-snug">
                Cadangan Otomatis Mingguan &amp; Unduh JSON
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 sm:line-clamp-none">
                Cakupan penuh: Data Penduduk, Log Mutasi, Wilayah Dusun/RT/RW, Template Surat, dan Arsip Permohonan Surat.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-md cursor-pointer shrink-0"
            aria-label="Tutup dialog cadangan data"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Jadwal Otomatis & Aksi Cepat */}
          <div className="border border-slate-200 rounded-lg bg-slate-50/70 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0F2744]">
                  <CalendarClock className="w-4 h-4 text-[#A67F17] shrink-0" />
                  <span>
                    Jadwal Otomatis: {overview?.schedule.scheduleLabel || 'Setiap Minggu pukul 02.00 WIB'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span>
                    Retensi server:{' '}
                    <strong className="font-mono-tabular text-[#0F2744]">
                      {overview?.schedule.retentionLimit ?? 8}
                    </strong>{' '}
                    arsip mingguan terbaru
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Otomatis terakhir:{' '}
                    <span className="font-mono-tabular font-medium text-slate-800">
                      {formatWibDateTime(overview?.schedule.lastAutoBackupAt || null)}
                    </span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Jadwal berikutnya:{' '}
                    <span className="font-mono-tabular font-medium text-slate-800">
                      {overview?.schedule.nextScheduledLabel || '-'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={creating || loading}
                  onClick={handleCreateServerSnapshot}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] text-xs font-semibold text-[#0F2744] bg-white border border-slate-300 hover:bg-slate-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {creating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Archive className="w-3.5 h-3.5" />
                  )}
                  {creating ? 'Menyimpan...' : 'Simpan Snapshot ke Server'}
                </button>
                <button
                  type="button"
                  disabled={downloadingId !== null}
                  onClick={() =>
                    triggerBlobDownload(
                      '/api/admin/backups/download-live',
                      `backup-penduduk-surat-margamukti-${new Date().toISOString().slice(0, 10)}.json`,
                      'live'
                    )
                  }
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {downloadingId === 'live' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {downloadingId === 'live' ? 'Menyusun JSON...' : 'Unduh JSON Langsung'}
                </button>
              </div>
            </div>

            {/* Ringkasan Hitungan Data Live */}
            <div className="pt-3 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Penduduk</span>
                <span className="font-mono-tabular text-sm font-bold text-[#0F2744]">
                  {overview?.liveCounts.residents ?? '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Log Mutasi</span>
                <span className="font-mono-tabular text-sm font-bold text-[#0F2744]">
                  {overview?.liveCounts.mutations ?? '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Wilayah RT/RW</span>
                <span className="font-mono-tabular text-sm font-bold text-[#0F2744]">
                  {overview?.liveCounts.regions ?? '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Template Surat</span>
                <span className="font-mono-tabular text-sm font-bold text-[#0F2744]">
                  {overview?.liveCounts.templates ?? '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Arsip Surat Warga</span>
                <span className="font-mono-tabular text-sm font-bold text-[#0F2744]">
                  {overview?.liveCounts.letters ?? '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Riwayat Arsip Server */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-[#0F2744]">
                  Riwayat Arsip Cadangan Server
                </h4>
                <p className="text-xs text-slate-500">
                  Arsip mingguan tersimpan otomatis di server (maks. {overview?.schedule.retentionLimit ?? 8} minggu terakhir) dan dapat diunduh ulang kapan saja dalam format JSON.
                </p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={loadOverview}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
              </button>
            </div>

            {errorMsg && (
              <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-xs text-red-800">
                {errorMsg}
              </div>
            )}

            {/* Mobile Cards (< md) */}
            <div className="md:hidden space-y-3">
              {loading && !overview ? (
                <div className="border border-slate-200 rounded-lg p-6 text-center text-xs text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#0F2744]" />
                    Memuat daftar arsip cadangan...
                  </span>
                </div>
              ) : overview && overview.archives.length > 0 ? (
                overview.archives.map((item) => {
                  const isAuto = item.trigger_type === 'auto_weekly';
                  return (
                    <div key={item.id} className="border border-slate-200 rounded-lg p-4 space-y-2.5 bg-white text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono-tabular font-semibold text-[#0F2744]">
                            {formatWibDateTime(item.created_at)}
                          </div>
                          <div className="font-mono-tabular text-[11px] text-slate-500 truncate mt-0.5">
                            {item.filename}
                          </div>
                        </div>
                        <span className="font-mono-tabular font-semibold text-slate-700 shrink-0">
                          {formatBytes(item.file_size)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className={`font-semibold inline-flex items-center gap-1 ${isAuto ? 'text-emerald-800' : 'text-[#0F2744]'}`}>
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          {isAuto ? 'Otomatis Mingguan' : 'Snapshot Manual'} ({item.created_by})
                        </span>
                        <span className="font-mono-tabular text-slate-500">
                          sha256:{item.checksum.slice(0, 8)}
                        </span>
                      </div>

                      <p className="text-[11px] font-mono-tabular text-slate-600 bg-slate-50 border border-slate-100 rounded px-2.5 py-1.5">
                        {item.residents_count} penduduk · {item.letters_count} surat · {item.mutations_count} mutasi · {item.regions_count} wilayah
                      </p>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={!item.file_exists || downloadingId !== null}
                          onClick={() =>
                            triggerBlobDownload(
                              `/api/admin/backups/${item.id}/download`,
                              item.filename,
                              item.id
                            )
                          }
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-[#0F2744] bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer disabled:opacity-50"
                        >
                          {downloadingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          Unduh JSON
                        </button>
                        {!isAuto && (
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => handleDeleteManualArchive(item)}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-red-600 border border-slate-200 rounded-md cursor-pointer disabled:opacity-50"
                            title="Hapus Arsip Manual"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="border border-slate-200 rounded-lg p-6 text-center text-xs text-slate-500">
                  Belum ada arsip cadangan yang tersimpan di server. Klik &ldquo;Simpan Snapshot ke Server&rdquo; untuk membuat cadangan pertama.
                </div>
              )}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Waktu &amp; Berkas</th>
                      <th className="py-2.5 px-4">Jenis &amp; Pembuat</th>
                      <th className="py-2.5 px-4">Cakupan Data</th>
                      <th className="py-2.5 px-4 text-right">Ukuran &amp; Checksum</th>
                      <th className="py-2.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {loading && !overview ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-[#0F2744]" />
                            Memuat daftar arsip cadangan...
                          </span>
                        </td>
                      </tr>
                    ) : overview && overview.archives.length > 0 ? (
                      overview.archives.map((item) => {
                        const isAuto = item.trigger_type === 'auto_weekly';
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <div className="font-mono-tabular font-semibold text-[#0F2744]">
                                {formatWibDateTime(item.created_at)}
                              </div>
                              <div className="font-mono-tabular text-[11px] text-slate-500 mt-0.5">
                                {item.filename}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div
                                className={`font-semibold inline-flex items-center gap-1 ${
                                  isAuto ? 'text-emerald-800' : 'text-[#0F2744]'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>{isAuto ? 'Otomatis Mingguan' : 'Snapshot Manual'}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {item.created_by}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-700 font-mono-tabular">
                              <div>
                                {item.residents_count} penduduk · {item.letters_count} surat
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {item.mutations_count} mutasi · {item.regions_count} wilayah ·{' '}
                                {item.templates_count} template
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular">
                              <div className="font-semibold text-slate-800">
                                {formatBytes(item.file_size)}
                              </div>
                              <div
                                className="text-[11px] text-slate-500 mt-0.5"
                                title={`SHA-256: ${item.checksum}`}
                              >
                                sha256:{item.checksum.slice(0, 10)}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                disabled={!item.file_exists || downloadingId !== null}
                                onClick={() =>
                                  triggerBlobDownload(
                                    `/api/admin/backups/${item.id}/download`,
                                    item.filename,
                                    item.id
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F2744] bg-white border border-slate-300 hover:bg-slate-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                              >
                                {downloadingId === item.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                Unduh JSON
                              </button>
                              {!isAuto && (
                                <button
                                  type="button"
                                  disabled={deletingId === item.id}
                                  onClick={() => handleDeleteManualArchive(item)}
                                  className="p-1.5 text-slate-500 hover:text-red-600 ml-1 cursor-pointer disabled:opacity-50"
                                  title="Hapus Arsip Manual"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Belum ada arsip cadangan yang tersimpan di server. Klik &ldquo;Simpan Snapshot ke Server&rdquo; untuk membuat cadangan pertama.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
