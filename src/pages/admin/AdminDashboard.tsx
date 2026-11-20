import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  FileText,
  HardHat,
  Image as ImageIcon,
  Landmark,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  MapPin,
  Menu,
  MessageSquare,
  Newspaper,
  Send,
  Settings,
  ShieldCheck,
  Store,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { SumedangCrest } from '../../components/SumedangCrest';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { PWAInstallButton } from '../../components/PWAInstallButton';
import { AdminOverview } from './modules/AdminOverview';
import { AdminOfficialsModule } from './modules/AdminOfficials';
import { AdminRegionsModule, AdminResidentsModule } from './modules/AdminResidentsRegions';
import { AdminLettersModule } from './modules/AdminLetters';
import { AdminApbdesModule } from './modules/AdminApbdes';
import { AdminAgendaModule } from './modules/AdminAgenda';
import { AdminEarlyWarningModule } from './modules/AdminEarlyWarning';
import { AdminUsersRbacModule } from './modules/AdminUsersRbac';
import { AdminWaBlasterModule } from './modules/AdminWaBlaster';
import { AdminInstitutionsModule } from './modules/AdminInstitutions';
import { AdminAiKnowledgeModule } from './modules/AdminAiKnowledge';
import { AdminPortfolioModule } from './modules/AdminPortfolio';
import { AdminDevelopmentsModule } from './modules/AdminDevelopments';
import {
  AdminArticlesModule,
  AdminComplaintsModule,
  AdminGalleryModule,
  AdminMapModule,
  AdminSettingsModule,
  AdminUmkmModule,
} from './modules/AdminContentModules';
import { adminFetch } from '../../utils/adminApi';
import type { AdminPermission, ResidentMutationLog, User } from '../../types';

const MUTATION_STATUS_LABELS: Record<string, string> = {
  aktif: 'Warga Aktif',
  lahir: 'Bayi Baru Lahir',
  pindah_masuk: 'Pindah Masuk',
  pindah_keluar: 'Pindah Keluar',
  meninggal: 'Meninggal Dunia',
};

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  onBackToPublic: () => void;
}

const MENU_ITEMS: Array<{
  id: AdminPermission | 'users';
  label: string;
  shortLabel: string;
  icon: typeof LayoutDashboard;
  superAdminOnly?: boolean;
}> = [
  { id: 'overview', label: 'Dashboard Ringkasan', shortLabel: 'Ringkas', icon: LayoutDashboard },
  { id: 'surat', label: 'Surat & Kop Resmi', shortLabel: 'Surat', icon: FileText },
  { id: 'penduduk', label: 'Data Penduduk', shortLabel: 'Penduduk', icon: Users },
  { id: 'wilayah', label: 'Wilayah Dusun/RT/RW', shortLabel: 'Wilayah', icon: MapPin },
  { id: 'perangkat', label: 'Perangkat Desa', shortLabel: 'Perangkat', icon: Building2 },
  { id: 'lembaga', label: 'Lembaga Desa', shortLabel: 'Lembaga', icon: Landmark },
  { id: 'portofolio', label: 'Portofolio Desa', shortLabel: 'Portofolio', icon: Briefcase },
  { id: 'pembangunan', label: 'Pembangunan Desa', shortLabel: 'Proyek', icon: HardHat },
  { id: 'apbdes', label: 'Transparansi APBDes', shortLabel: 'APBDes', icon: Wallet },
  { id: 'agenda', label: 'Agenda, Ucapan & Kalender', shortLabel: 'Agenda', icon: CalendarDays },
  { id: 'berita', label: 'Berita & Komentar', shortLabel: 'Berita', icon: Newspaper },
  { id: 'umkm', label: 'Katalog UMKM', shortLabel: 'UMKM', icon: Store },
  { id: 'galeri', label: 'Galeri Kegiatan', shortLabel: 'Galeri', icon: ImageIcon },
  { id: 'peta', label: 'Peta & Lokasi', shortLabel: 'Peta', icon: MapIcon },
  { id: 'pengaduan', label: 'Kotak Masuk Warga', shortLabel: 'Masukan', icon: MessageSquare },
  { id: 'peringatan', label: 'Peringatan Dini & Darurat', shortLabel: 'Siaga', icon: AlertTriangle },
  { id: 'wa_blaster', label: 'WhatsApp Blaster', shortLabel: 'WA Blast', icon: Send },
  { id: 'ai_knowledge', label: 'Basis Pengetahuan AI', shortLabel: 'AI Juknis', icon: Bot },
  { id: 'pengaturan', label: 'Profil & Beranda Desa', shortLabel: 'Profil', icon: Settings },
  { id: 'users', label: 'Akun & Wewenang', shortLabel: 'Akun', icon: ShieldCheck, superAdminOnly: true },
];

export function AdminDashboard({ user, onLogout, onBackToPublic }: AdminDashboardProps) {
  const visibleMenus = useMemo(() => {
    const isSuper = user.role === 'super_admin';
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    return MENU_ITEMS.filter((item) => {
      if (item.superAdminOnly) return isSuper;
      return isSuper || perms.includes(item.id as AdminPermission);
    });
  }, [user]);

  const isSuperAdmin = user.role === 'super_admin';
  const [activeMenu, setActiveMenu] = useState<string>(() => visibleMenus[0]?.id || 'overview');
  const [residentsTab, setResidentsTab] = useState<'list' | 'verification'>('list');
  const [mutationSyncKey, setMutationSyncKey] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pendingLogs, setPendingLogs] = useState<ResidentMutationLog[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [busyNotifId, setBusyNotifId] = useState<number | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    if (visibleMenus.length > 0 && !visibleMenus.some((m) => m.id === activeMenu)) {
      setActiveMenu(visibleMenus[0].id);
    }
  }, [visibleMenus, activeMenu]);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      setSidebarOpen(false);
      setNotifOpen(false);
      const st = e.state as { mode?: string; activeMenu?: string; residentsTab?: 'list' | 'verification' } | null;
      if (st?.mode === 'admin' && st.activeMenu && visibleMenus.some((m) => m.id === st.activeMenu)) {
        setActiveMenu(st.activeMenu);
        if (st.residentsTab) setResidentsTab(st.residentsTab);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [visibleMenus]);

  const loadMutationNotifications = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await adminFetch('/api/admin/resident-mutations?status=pending');
      if (!res.ok) return;
      const json = await res.json();
      setPendingLogs(json.logs || []);
      setPendingCount(typeof json.pendingCount === 'number' ? json.pendingCount : 0);
    } catch {
      // Abaikan gangguan jaringan sementara saat polling background
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    loadMutationNotifications();
  }, [loadMutationNotifications, mutationSyncKey]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const timer = setInterval(loadMutationNotifications, 25000);
    return () => clearInterval(timer);
  }, [isSuperAdmin, loadMutationNotifications]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [notifOpen]);

  const notify = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3600);
  };

  const handleSelectMenu = (menuId: string) => {
    if (visibleMenus.some((m) => m.id === menuId)) {
      if (menuId === 'penduduk') {
        setResidentsTab('list');
      }
      setActiveMenu(menuId);
      setSidebarOpen(false);
      window.history.pushState(
        { mode: 'admin', activeMenu: menuId, residentsTab: 'list' },
        '',
        `/admin#${menuId}`
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      notify('Anda tidak memiliki wewenang untuk membuka modul tersebut.', 'err');
    }
  };

  const handleOpenVerificationQueue = () => {
    setResidentsTab('verification');
    setActiveMenu('penduduk');
    setNotifOpen(false);
    setSidebarOpen(false);
    window.history.pushState(
      { mode: 'admin', activeMenu: 'penduduk', residentsTab: 'verification' },
      '',
      '/admin#penduduk'
    );
  };

  const handleQuickApprove = async (log: ResidentMutationLog) => {
    setBusyNotifId(log.id);
    try {
      const res = await adminFetch(`/api/admin/resident-mutations/${log.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'approved' }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error || 'Gagal menyetujui mutasi.', 'err');
        return;
      }
      notify(`Mutasi ${log.resident_name} disetujui permanen.`);
      setMutationSyncKey((k) => k + 1);
    } finally {
      setBusyNotifId(null);
    }
  };

  const mobileBottomTabs = useMemo(() => {
    const priorityOrder = ['overview', 'penduduk', 'surat', 'peringatan', 'umkm', 'galeri', 'apbdes'];
    const sorted = [...visibleMenus].sort((a, b) => {
      const ia = priorityOrder.indexOf(a.id);
      const ib = priorityOrder.indexOf(b.id);
      const wa = ia === -1 ? 99 : ia;
      const wb = ib === -1 ? 99 : ib;
      return wa - wb;
    });
    return sorted.slice(0, 4);
  }, [visibleMenus]);

  const activeLabel = visibleMenus.find((m) => m.id === activeMenu)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`no-print fixed lg:static inset-y-0 left-0 z-50 w-72 lg:w-64 bg-[#0F2744] text-white flex flex-col transition-transform duration-200 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:pt-0 lg:pb-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-4 lg:py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <SumedangCrest className="w-9 h-10 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">Desa Margamukti</p>
              <p className="text-[11px] text-[#E5C158] truncate">Panel Pemerintahan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-300 hover:text-white rounded-md cursor-pointer"
            aria-label="Tutup menu admin"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleMenus.map((item) => {
            const Icon = item.icon;
            const active = activeMenu === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectMenu(item.id)}
                className={`w-full min-h-[44px] lg:min-h-0 flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors text-left cursor-pointer ${
                  active
                    ? 'bg-[#C59B27] text-[#0F2744] font-semibold'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{item.label}</span>
                {isSuperAdmin && item.id === 'penduduk' && pendingCount > 0 && (
                  <span
                    className={`font-mono-tabular text-[11px] font-bold shrink-0 ${
                      active ? 'text-[#0F2744]' : 'text-[#E5C158]'
                    }`}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
          {visibleMenus.length === 0 && (
            <div className="px-3 py-4 text-xs text-slate-300">
              Akun Anda belum memiliki akses modul. Hubungi Super Admin.
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="px-2 py-1 text-xs">
            <p className="font-semibold text-white truncate">{user.fullName}</p>
            <p className="text-slate-400 font-mono-tabular">@{user.username}</p>
            <p className="text-[11px] text-[#E5C158] mt-0.5 leading-snug">
              {user.role === 'super_admin'
                ? 'Super Admin'
                : user.role === 'ketua_rw'
                ? `Ketua RW ${user.scopeRw || '-'} · ${user.scopeDusun || '-'}`
                : user.role === 'ketua_rt'
                ? `Ketua RT ${user.scopeRt || '-'} / RW ${user.scopeRw || '-'} · ${user.scopeDusun || '-'}`
                : 'Sub-Admin Perangkat'}
            </p>
          </div>
          <div className="bg-white rounded-lg p-0.5 lg:hidden">
            <PWAInstallButton variant="drawer" onAfterTrigger={() => setSidebarOpen(false)} />
          </div>
          <button
            type="button"
            onClick={onBackToPublic}
            className="lg:hidden w-full min-h-[44px] flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <ExternalLink className="w-4 h-4 text-[#E5C158]" />
            Lihat Portal Publik
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full min-h-[44px] lg:min-h-0 flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Keluar dari Admin
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print bg-white border-b border-slate-200 px-3 sm:px-8 py-2.5 sm:py-4 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 pt-[max(0.625rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md border border-slate-200 text-[#0F2744] hover:bg-slate-50 cursor-pointer shrink-0"
              aria-label="Buka menu modul admin"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs sm:text-sm text-slate-500 flex items-center gap-2 truncate">
              <span className="hidden sm:inline">Admin Desa Margamukti</span>
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <span className="font-semibold text-[#0F2744] truncate">{activeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {isSuperAdmin && (
              <div className="relative" ref={bellRef}>
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((prev) => !prev);
                    loadMutationNotifications();
                  }}
                  aria-label="Notifikasi verifikasi mutasi RT/RW"
                  className={`relative inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-2.5 sm:px-3 py-2 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    notifOpen
                      ? 'bg-[#0F2744] text-white border-[#0F2744]'
                      : pendingCount > 0
                      ? 'bg-amber-50 text-[#0F2744] border-amber-300 hover:bg-amber-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Bell className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Verifikasi</span>
                  <span
                    className={`font-mono-tabular font-bold px-1.5 py-0.5 rounded text-[11px] leading-none ${
                      notifOpen
                        ? 'bg-[#C59B27] text-[#0F2744]'
                        : pendingCount > 0
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {pendingCount}
                  </span>
                </button>

                {notifOpen && (
                  <div className="fixed sm:absolute right-3 sm:right-0 top-[4.25rem] sm:top-full sm:mt-2 w-[calc(100vw-1.5rem)] sm:w-[400px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-[#0F2744]">
                          Antrean Verifikasi Mutasi RT/RW
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono-tabular">
                          {pendingCount} perubahan menunggu tinjauan akhir
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenVerificationQueue}
                        className="text-[11px] font-semibold text-[#0F2744] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Lihat Semua
                      </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {pendingLogs.slice(0, 5).map((log) => {
                        const busy = busyNotifId === log.id;
                        return (
                          <div key={log.id} className="p-3.5 space-y-2 hover:bg-slate-50/70">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#0F2744] truncate">
                                  {log.resident_name}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {log.actor_name} · {log.actor_scope || log.actor_role}
                                </p>
                              </div>
                              <span className="text-[10px] font-mono-tabular text-slate-400 shrink-0">
                                {log.new_mutation_date || log.created_at.slice(0, 10)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-slate-500">
                                {log.action_type === 'create'
                                  ? 'Baru'
                                  : MUTATION_STATUS_LABELS[log.prev_status || 'aktif'] || log.prev_status}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="font-semibold text-[#0F2744]">
                                {MUTATION_STATUS_LABELS[log.new_status] || log.new_status}
                              </span>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleOpenVerificationQueue}
                                className="min-h-[36px] px-2.5 py-1 text-[11px] font-semibold text-slate-700 border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                              >
                                Tinjau / Tolak
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleQuickApprove(log)}
                                className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded disabled:opacity-50 cursor-pointer"
                              >
                                <Check className="w-3 h-3" /> Setujui
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {pendingLogs.length === 0 && (
                        <div className="py-8 px-4 text-center text-xs text-slate-500 flex flex-col items-center gap-1.5">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>Semua mutasi kependudukan RT/RW sudah diverifikasi.</span>
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={handleOpenVerificationQueue}
                        className="w-full min-h-[40px] py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer"
                      >
                        Buka Panel Verifikasi Mutasi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onBackToPublic}
              className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lihat Portal Publik</span>
              <span className="sm:hidden">Portal</span>
            </button>
          </div>
        </header>

        <OfflineIndicator />

        <main className="flex-1 p-3.5 sm:p-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8 max-w-7xl w-full mx-auto">
          {activeMenu === 'overview' && <AdminOverview onSelectMenu={handleSelectMenu} />}
          {activeMenu === 'surat' && <AdminLettersModule onNotify={notify} />}
          {activeMenu === 'penduduk' && (
            <AdminResidentsModule
              onNotify={notify}
              currentUser={user}
              initialTab={residentsTab}
              refreshTrigger={mutationSyncKey}
              onMutationQueueChange={loadMutationNotifications}
            />
          )}
          {activeMenu === 'wilayah' && <AdminRegionsModule onNotify={notify} />}
          {activeMenu === 'perangkat' && (
            <AdminOfficialsModule onNotify={notify} currentUser={user} />
          )}
          {activeMenu === 'lembaga' && <AdminInstitutionsModule onNotify={notify} />}
          {activeMenu === 'portofolio' && <AdminPortfolioModule onNotify={notify} />}
          {activeMenu === 'pembangunan' && <AdminDevelopmentsModule onNotify={notify} />}
          {activeMenu === 'apbdes' && <AdminApbdesModule onNotify={notify} />}
          {activeMenu === 'agenda' && <AdminAgendaModule onNotify={notify} />}
          {activeMenu === 'berita' && <AdminArticlesModule onNotify={notify} />}
          {activeMenu === 'umkm' && <AdminUmkmModule onNotify={notify} />}
          {activeMenu === 'galeri' && <AdminGalleryModule onNotify={notify} />}
          {activeMenu === 'peta' && <AdminMapModule onNotify={notify} />}
          {activeMenu === 'pengaduan' && <AdminComplaintsModule onNotify={notify} />}
          {activeMenu === 'peringatan' && <AdminEarlyWarningModule onNotify={notify} />}
          {activeMenu === 'wa_blaster' && (
            <AdminWaBlasterModule onNotify={notify} onOpenMenu={handleSelectMenu} />
          )}
          {activeMenu === 'ai_knowledge' && <AdminAiKnowledgeModule onNotify={notify} />}
          {activeMenu === 'pengaturan' && <AdminSettingsModule onNotify={notify} />}
          {activeMenu === 'users' && user.role === 'super_admin' && (
            <AdminUsersRbacModule onNotify={notify} />
          )}
        </main>
      </div>

      {/* Smartphone Fixed Bottom Navigation Bar for Admin */}
      <nav
        aria-label="Navigasi cepat admin seluler"
        className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(15,39,68,0.06)]"
      >
        <div
          className="grid h-16"
          style={{ gridTemplateColumns: `repeat(${mobileBottomTabs.length + 1}, minmax(0, 1fr))` }}
        >
          {mobileBottomTabs.map((item) => {
            const Icon = item.icon;
            const active = !sidebarOpen && activeMenu === item.id;
            const showPending = isSuperAdmin && item.id === 'penduduk' && pendingCount > 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectMenu(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] text-[11px] font-medium transition-colors cursor-pointer ${
                  active ? 'text-[#0F2744] font-semibold' : 'text-slate-500 hover:text-[#0F2744]'
                }`}
              >
                {active && (
                  <span className="absolute top-0 inset-x-3 h-0.5 bg-[#C59B27] rounded-b-full" />
                )}
                <div className="relative">
                  <Icon className="w-5 h-5 shrink-0" />
                  {showPending && (
                    <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[16px] h-4 rounded-full bg-amber-600 text-white text-[10px] font-mono-tabular font-bold flex items-center justify-center leading-none">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </div>
                <span className="truncate max-w-full px-1">{item.shortLabel}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] text-[11px] font-medium transition-colors cursor-pointer ${
              sidebarOpen || !mobileBottomTabs.some((t) => t.id === activeMenu)
                ? 'text-[#0F2744] font-semibold'
                : 'text-slate-500 hover:text-[#0F2744]'
            }`}
            aria-label="Semua modul admin"
          >
            {(sidebarOpen || !mobileBottomTabs.some((t) => t.id === activeMenu)) && (
              <span className="absolute top-0 inset-x-3 h-0.5 bg-[#C59B27] rounded-b-full" />
            )}
            <Menu className="w-5 h-5 shrink-0" />
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {/* Toast Notification (Adjusted above mobile bottom nav) */}
      {toast && (
        <div
          className={`no-print fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-xs font-semibold text-white text-center sm:text-left ${
            toast.type === 'err' ? 'bg-red-700' : 'bg-[#0F2744] border border-[#C59B27]'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
