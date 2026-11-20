import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  Compass,
  Facebook,
  FileText,
  Home,
  Instagram,
  Landmark,
  MapPin,
  Menu,
  MessageCircle,
  Palette,
  Pause,
  Play,
  Search,
  SearchCheck,
  ShieldCheck,
  Siren,
  Wallet,
  X,
} from 'lucide-react';
import { SumedangCrest } from './components/SumedangCrest';
import { GlobalSearchModal, type GlobalSearchResult } from './components/GlobalSearchModal';
import { LetterVerificationPage } from './components/LetterVerificationPage';
import { EmergencyReportModal } from './components/EmergencyReportModal';
import { getSeverityMeta } from './components/EarlyWarningSection';
import { VillageGreetingBanner } from './components/VillageGreetingBanner';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { FloatingAiChatWidget } from './components/FloatingAiChatWidget';
import { HomePage, type PublicRoute } from './pages/public/HomePage';
import { ProfilePage } from './pages/public/ProfilePage';
import { LembagaPage } from './pages/public/LembagaPage';
import { LettersPage } from './pages/public/LettersPage';
import { ExplorePage } from './pages/public/ExplorePage';
import { BansosPage } from './pages/public/BansosPage';
import { AiAssistantPage } from './pages/public/AiAssistantPage';
import { MapContactPage } from './pages/public/MapContactPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { adminFetch, setAdminToken } from './utils/adminApi';
import {
  applyPortalTheme,
  getStoredPortalThemeId,
  PORTAL_THEME_PRESETS,
} from './utils/themePresets';
import type {
  ActiveGreetingItem,
  Article,
  BmkgLivePayload,
  EarlyWarning,
  InstitutionSlug,
  LetterTemplate,
  Official,
  PopulationStats,
  UmkmProduct,
  User,
  VillageEvent,
  VillageSettings,
} from './types';

interface OverviewResponse {
  settings: VillageSettings;
  stats: PopulationStats;
  officials: Official[];
  articles: Article[];
  umkm: UmkmProduct[];
  templates: LetterTemplate[];
  events: VillageEvent[];
}

interface EarlyWarningResponse {
  warnings: EarlyWarning[];
  bmkg: BmkgLivePayload | null;
  emergencyContact: string;
  mapCenter: { lat: number; lng: number };
}

interface AppHistoryState {
  mode: 'public' | 'admin';
  route?: PublicRoute;
  subTab?: string;
  routeParam?: string | number;
}

const VALID_PUBLIC_ROUTES: PublicRoute[] = [
  'beranda',
  'profil',
  'lembaga',
  'surat',
  'jelajah',
  'bansos',
  'asisten-ai',
  'peta-kontak',
];

const LEMBAGA_SUBMENUS: Array<{ slug: InstitutionSlug; label: string; desc: string }> = [
  { slug: 'bpd', label: 'BPD', desc: 'Badan Permusyawaratan Desa' },
  { slug: 'bumdesa', label: 'BUMDesa', desc: 'Badan Usaha Milik Desa' },
  { slug: 'lpm', label: 'LPM', desc: 'Lembaga Pemberdayaan Masyarakat' },
  { slug: 'pkk', label: 'PKK', desc: 'Tim Penggerak PKK Desa' },
];

function getInitialBeritaSlug(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const params = new URLSearchParams(window.location.search);
  if (params.get('verifikasi')) return undefined;
  const slug = params.get('berita')?.trim();
  return slug || undefined;
}

function getInitialTabParam(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const params = new URLSearchParams(window.location.search);
  if (params.get('verifikasi')) return undefined;
  const tab = params.get('tab')?.trim();
  return tab || undefined;
}

function getInitialRouteFromLocation(): PublicRoute {
  if (typeof window === 'undefined') return 'beranda';
  if (getInitialBeritaSlug()) return 'jelajah';
  if (getInitialTabParam() === 'kalender') return 'jelajah';
  if (getInitialTabParam() === 'portofolio') return 'profil';
  const hash = window.location.hash.replace(/^#/, '') as PublicRoute;
  return VALID_PUBLIC_ROUTES.includes(hash) ? hash : 'beranda';
}

export default function App() {
  const [mode, setMode] = useState<'public' | 'admin'>(() =>
    window.location.pathname.startsWith('/admin') ? 'admin' : 'public'
  );
  const [route, setRoute] = useState<PublicRoute>(getInitialRouteFromLocation);
  const [subTab, setSubTab] = useState<string | undefined>(() => {
    if (getInitialBeritaSlug()) return 'berita';
    return getInitialTabParam();
  });
  const [routeParam, setRouteParam] = useState<string | number | undefined>(() =>
    getInitialBeritaSlug()
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lembagaMenuOpen, setLembagaMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<string>(() => getStoredPortalThemeId());
  const [tickerPaused, setTickerPaused] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('verifikasi');
    return code ? code.trim() : null;
  });

  const lembagaRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [earlyWarningData, setEarlyWarningData] = useState<EarlyWarningResponse | null>(null);
  const [activeGreetings, setActiveGreetings] = useState<ActiveGreetingItem[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    applyPortalTheme(activeThemeId);
  }, [activeThemeId]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (lembagaRef.current && !lembagaRef.current.contains(e.target as Node)) {
        setLembagaMenuOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const fetchOverview = () => {
    fetch('/api/public/overview')
      .then((r) => r.json())
      .then((json) => setOverview(json))
      .catch(() => {
        // Ignore transient offline errors; cached response may apply
      });
  };

  const fetchEarlyWarning = () => {
    fetch('/api/public/early-warning')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) setEarlyWarningData(json);
      })
      .catch(() => {
        // Keep existing state if transient error occurs
      });
  };

  const fetchActiveGreetings = () => {
    fetch('/api/public/greetings/active')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json && Array.isArray(json.activeGreetings)) {
          setActiveGreetings(json.activeGreetings);
        }
      })
      .catch(() => {
        // Keep existing state if transient error occurs
      });
  };

  useEffect(() => {
    fetchOverview();
    fetchEarlyWarning();
    fetchActiveGreetings();
    adminFetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((json) => setAdminUser(json.user || null))
      .catch(() => setAdminUser(null))
      .finally(() => setAuthChecked(true));

    const initialBerita = getInitialBeritaSlug();
    const initialTab = getInitialTabParam();
    const initialState: AppHistoryState = {
      mode: window.location.pathname.startsWith('/admin') ? 'admin' : 'public',
      route: getInitialRouteFromLocation(),
      subTab: initialBerita ? 'berita' : initialTab,
      routeParam: initialBerita,
    };
    window.history.replaceState(initialState, '', window.location.href);

    const onPopState = (e: PopStateEvent) => {
      setMobileMenuOpen(false);
      setSearchOpen(false);
      setEmergencyModalOpen(false);

      const st = (e.state || {}) as Partial<AppHistoryState>;
      if (st.mode === 'admin' || window.location.pathname.startsWith('/admin')) {
        setMode('admin');
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const code = params.get('verifikasi');
      const beritaSlug = !code ? params.get('berita')?.trim() || undefined : undefined;
      const tabParam = !code ? params.get('tab')?.trim() || undefined : undefined;
      setVerifyCode(code ? code.trim() : null);
      setMode('public');
      if (beritaSlug) {
        setRoute('jelajah');
        setSubTab('berita');
        setRouteParam(beritaSlug);
      } else if (tabParam === 'portofolio') {
        setRoute('profil');
        setSubTab('portofolio');
        setRouteParam(undefined);
      } else if (tabParam === 'kalender') {
        setRoute('jelajah');
        setSubTab('kalender');
        setRouteParam(undefined);
      } else {
        const fallbackRoute = getInitialRouteFromLocation();
        setRoute(
          st.route && VALID_PUBLIC_ROUTES.includes(st.route) ? st.route : fallbackRoute
        );
        setSubTab(st.subTab ?? tabParam);
        setRouteParam(st.routeParam);
      }
    };

    const onUnauthorized = () => {
      setAdminUser(null);
    };
    const onShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('margamukti:unauthorized', onUnauthorized);
    window.addEventListener('keydown', onShortcut);

    const onGreetingSync = () => {
      fetchActiveGreetings();
    };
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchActiveGreetings();
      }
    };
    window.addEventListener('margamukti:greetings-updated', onGreetingSync);
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    let greetingChannel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        greetingChannel = new BroadcastChannel('margamukti_greetings_sync');
        greetingChannel.onmessage = onGreetingSync;
      }
    } catch {
      greetingChannel = null;
    }

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchActiveGreetings();
      }
    }, 45000);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('margamukti:unauthorized', onUnauthorized);
      window.removeEventListener('keydown', onShortcut);
      window.removeEventListener('margamukti:greetings-updated', onGreetingSync);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.clearInterval(pollInterval);
      if (greetingChannel) {
        greetingChannel.close();
      }
    };
  }, []);

  const navigatePublic = (nextRoute: PublicRoute, nextSubTab?: string, param?: string | number) => {
    setMode('public');
    setVerifyCode(null);
    setRoute(nextRoute);
    setSubTab(nextSubTab);
    setRouteParam(param);
    setMobileMenuOpen(false);
    setLembagaMenuOpen(false);
    setThemeMenuOpen(false);
    const nextUrl =
      nextRoute === 'beranda'
        ? '/'
        : nextRoute === 'profil' && nextSubTab === 'portofolio'
          ? '/?tab=portofolio#profil'
          : nextRoute === 'jelajah' && nextSubTab === 'kalender'
            ? '/?tab=kalender#jelajah'
            : nextRoute === 'jelajah' &&
                nextSubTab === 'berita' &&
                typeof param === 'string' &&
                param.trim()
              ? `/?berita=${encodeURIComponent(param.trim())}#jelajah`
              : `/#${nextRoute}`;
    window.history.pushState(
      { mode: 'public', route: nextRoute, subTab: nextSubTab, routeParam: param } satisfies AppHistoryState,
      '',
      nextUrl
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchOverview();
    fetchEarlyWarning();
    fetchActiveGreetings();
  };

  const scrollToEarlyWarningInfo = () => {
    if (route !== 'beranda' || verifyCode) {
      setMode('public');
      setVerifyCode(null);
      setRoute('beranda');
      window.history.pushState({ mode: 'public', route: 'beranda' } satisfies AppHistoryState, '', '/');
      window.setTimeout(() => {
        document.getElementById('peringatan-dini')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      document.getElementById('peringatan-dini')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const openAdminPortal = () => {
    setMode('admin');
    setMobileMenuOpen(false);
    window.history.pushState({ mode: 'admin' } satisfies AppHistoryState, '', '/admin');
    window.scrollTo({ top: 0 });
  };

  const handleLogout = async () => {
    await adminFetch('/api/auth/logout', { method: 'POST' });
    setAdminToken(null);
    setAdminUser(null);
    navigatePublic('beranda');
  };

  if (mode === 'admin') {
    if (!authChecked) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
          Memeriksa sesi admin...
        </div>
      );
    }
    if (!adminUser) {
      return (
        <AdminLoginPage
          onSuccess={(u) => setAdminUser(u)}
          onBackToPublic={() => navigatePublic('beranda')}
        />
      );
    }
    return (
      <AdminDashboard
        user={adminUser}
        onLogout={handleLogout}
        onBackToPublic={() => navigatePublic('beranda')}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract (Sticky + Safe-Area Top) */}
      <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-2 md:gap-4">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigatePublic('beranda')}
            className="inline-flex items-center gap-2 sm:gap-2.5 text-base sm:text-lg font-bold tracking-tight text-[var(--theme-primary)] whitespace-nowrap shrink-0 min-h-[44px] cursor-pointer"
          >
            <SumedangCrest className="w-7 h-8 shrink-0" />
            <span>Desa Margamukti</span>
          </button>

          {/* Zone 2: Concise Single-Line Nav Links + Lembaga Desa Submenu */}
          <nav className="hidden lg:flex items-center gap-3 xl:gap-4 text-xs xl:text-[13px] font-medium text-slate-600">
            <button
              type="button"
              onClick={() => navigatePublic('beranda')}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                route === 'beranda'
                  ? 'text-[var(--theme-primary)] font-semibold border-b-2 border-[var(--theme-accent)]'
                  : 'hover:text-[var(--theme-primary)]'
              }`}
            >
              Beranda
            </button>
            <button
              type="button"
              onClick={() => navigatePublic('profil')}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                route === 'profil'
                  ? 'text-[var(--theme-primary)] font-semibold border-b-2 border-[var(--theme-accent)]'
                  : 'hover:text-[var(--theme-primary)]'
              }`}
            >
              Profil
            </button>

            {/* Lembaga Desa Dropdown (BPD, BUMDesa, LPM, PKK) */}
            <div ref={lembagaRef} className="relative">
              <button
                type="button"
                onClick={() => setLembagaMenuOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1 py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  route === 'lembaga'
                    ? 'text-[var(--theme-primary)] font-semibold border-b-2 border-[var(--theme-accent)]'
                    : 'hover:text-[var(--theme-primary)]'
                }`}
              >
                <span>Lembaga Desa</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${lembagaMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {lembagaMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-50">
                  {LEMBAGA_SUBMENUS.map((lm) => {
                    const isActiveSub = route === 'lembaga' && (subTab || 'bpd') === lm.slug;
                    return (
                      <button
                        key={lm.slug}
                        type="button"
                        onClick={() => navigatePublic('lembaga', lm.slug)}
                        className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isActiveSub
                            ? 'bg-slate-100 text-[var(--theme-primary)] font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-[var(--theme-primary)]">{lm.label}</p>
                          <p className="text-[11px] text-slate-500">{lm.desc}</p>
                        </div>
                        {isActiveSub && <Check className="w-3.5 h-3.5 text-[var(--theme-accent-dark)] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {[
              { id: 'surat', label: 'Layanan Surat' },
              { id: 'jelajah', label: 'Jelajah Desa' },
              { id: 'bansos', label: 'Cek Bansos' },
              { id: 'asisten-ai', label: 'Tanya AI' },
              { id: 'peta-kontak', label: 'Peta & Kontak' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigatePublic(item.id as PublicRoute)}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  route === item.id
                    ? 'text-[var(--theme-primary)] font-semibold border-b-2 border-[var(--theme-accent)]'
                    : 'hover:text-[var(--theme-primary)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Theme Picker + Install Prompt + Search + Admin CTA + Mobile Drawer Trigger */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div ref={themeRef} className="relative">
              <button
                type="button"
                onClick={() => setThemeMenuOpen((prev) => !prev)}
                className="inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                aria-label="Pilih tema warna portal"
                title="Pilih Tema Warna Portal"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white shadow-xs shrink-0"
                  style={{ backgroundColor: PORTAL_THEME_PRESETS.find((t) => t.id === activeThemeId)?.primary || '#0F2744' }}
                />
                <Palette className="w-3.5 h-3.5 text-[var(--theme-primary)] hidden sm:inline" />
                <span className="hidden xl:inline">Tema</span>
              </button>
              {themeMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 space-y-1">
                  <p className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Tema Warna Website
                  </p>
                  {PORTAL_THEME_PRESETS.map((preset) => {
                    const selected = preset.id === activeThemeId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setActiveThemeId(preset.id);
                          setThemeMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                          selected ? 'bg-slate-100 font-semibold text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex items-center shrink-0">
                            <span
                              className="w-4 h-4 rounded-l-full border border-slate-200"
                              style={{ backgroundColor: preset.primary }}
                            />
                            <span
                              className="w-2.5 h-4 rounded-r-full border-y border-r border-slate-200"
                              style={{ backgroundColor: preset.accent }}
                            />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs leading-tight truncate">{preset.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{preset.subtitle}</p>
                          </div>
                        </div>
                        {selected && <Check className="w-3.5 h-3.5 text-[var(--theme-primary)] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <PWAInstallButton variant="compact" />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-2.5 md:px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              aria-label="Cari di portal"
              title="Cari di Portal (Ctrl+K)"
            >
              <Search className="w-4 h-4 md:w-3.5 md:h-3.5 text-[var(--theme-primary)]" />
              <span className="hidden sm:inline">Cari</span>
            </button>
            <button
              type="button"
              onClick={openAdminPortal}
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--theme-accent-light)]" />
              Portal Admin
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md border border-slate-200 text-[var(--theme-primary)] hover:bg-slate-50 cursor-pointer"
              aria-label={mobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over / Sheet Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="no-print lg:hidden fixed inset-0 z-50 bg-slate-950/60 flex justify-end"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-[86vw] max-w-sm bg-white h-full flex flex-col shadow-2xl border-l border-slate-200 pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3.5 bg-[var(--theme-primary)] text-white flex items-center justify-between border-b-2 border-[var(--theme-accent)]">
              <div className="flex items-center gap-2.5">
                <SumedangCrest className="w-7 h-8 shrink-0" />
                <div>
                  <p className="text-sm font-bold leading-tight">Menu Portal Desa</p>
                  <p className="text-[11px] text-[var(--theme-accent-light)]">Margamukti · Sumedang Utara</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-200 hover:text-white rounded-md cursor-pointer"
                aria-label="Tutup laci menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSearchOpen(true);
                }}
                className="w-full min-h-[44px] text-left px-3.5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2.5 cursor-pointer"
              >
                <Search className="w-4 h-4 text-[var(--theme-primary)] shrink-0" />
                <span>Cari Berita, Layanan, atau UMKM...</span>
              </button>

              <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Halaman Portal Warga
              </p>

              {[
                { id: 'beranda', label: 'Beranda Utama', icon: Home },
                { id: 'profil', label: 'Profil & Wilayah Desa', icon: Building2 },
                { id: 'surat', label: 'Layanan Surat Mandiri', icon: FileText },
                { id: 'jelajah', label: 'Berita, UMKM & Galeri', icon: Compass },
                { id: 'bansos', label: 'Cek Bansos & DTSEN', icon: SearchCheck },
                { id: 'asisten-ai', label: 'Asisten AI Layanan Warga', icon: Bot },
                { id: 'peta-kontak', label: 'Peta & Pengaduan Warga', icon: MapPin },
              ].map((item) => {
                const Icon = item.icon;
                const active = route === item.id && !subTab;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigatePublic(item.id as PublicRoute)}
                    className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors text-left cursor-pointer ${
                      active ? 'bg-[var(--theme-primary)] text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[var(--theme-accent-light)]' : 'text-[var(--theme-primary)]'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {/* Sub-menu Lembaga Desa di Mobile Drawer */}
              <div className="pt-2 space-y-1.5">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-[var(--theme-accent-dark)]" />
                  <span>Lembaga Desa</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {LEMBAGA_SUBMENUS.map((lm) => {
                    const activeLm = route === 'lembaga' && (subTab || 'bpd') === lm.slug;
                    return (
                      <button
                        key={lm.slug}
                        type="button"
                        onClick={() => navigatePublic('lembaga', lm.slug)}
                        className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-colors cursor-pointer ${
                          activeLm
                            ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)]'
                            : 'bg-slate-50 text-[var(--theme-primary)] border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <p className="font-bold">{lm.label}</p>
                        <p className={`text-[10px] truncate ${activeLm ? 'text-slate-200' : 'text-slate-500'}`}>
                          {lm.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigatePublic('profil', 'portofolio')}
                  className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--theme-primary)] bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-[var(--theme-accent-dark)] shrink-0" />
                  <span>Portofolio</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigatePublic('jelajah', 'pembangunan')}
                  className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--theme-primary)] bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-[var(--theme-accent-dark)] shrink-0" />
                  <span>Pembangunan</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigatePublic('profil', 'apbdes')}
                  className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--theme-primary)] bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5 text-[var(--theme-accent-dark)] shrink-0" />
                  <span>APBDes</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigatePublic('profil', 'statistik')}
                  className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--theme-primary)] bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-[var(--theme-accent-dark)] shrink-0" />
                  <span>Statistik</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigatePublic('jelajah', 'kalender')}
                  className="col-span-2 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--theme-primary)] bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-[var(--theme-accent-dark)] shrink-0" />
                  <span>Kalender &amp; Hari Besar Indonesia</span>
                </button>
              </div>

              {/* Pemilih Tema Warna di Mobile Drawer */}
              <div className="pt-2 space-y-1.5 border-t border-slate-100">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Tema Warna Portal
                </p>
                <div className="flex flex-wrap gap-2 px-1">
                  {PORTAL_THEME_PRESETS.map((preset) => {
                    const selected = preset.id === activeThemeId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setActiveThemeId(preset.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-md border transition-colors cursor-pointer ${
                          selected
                            ? 'border-[var(--theme-primary)] bg-slate-100 font-semibold text-slate-900'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <span>{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 space-y-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setEmergencyModalOpen(true);
                  }}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                >
                  <Siren className="w-4 h-4 shrink-0" />
                  <span>Laporkan Darurat GPS</span>
                </button>

                <PWAInstallButton variant="drawer" onAfterTrigger={() => setMobileMenuOpen(false)} />

                <button
                  type="button"
                  onClick={openAdminPortal}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-lg cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-[var(--theme-accent-light)] shrink-0" />
                  <span>Masuk Portal Admin Desa</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline Status Banner (High Contrast, Non-Sticky) */}
      <OfflineIndicator />

      {/* Running Text Agenda Kegiatan Desa (Mengalir di bawah header agar viewport HP tetap lega) */}
      {overview?.events && overview.events.length > 0 && (
        <div
          className="no-print bg-[var(--theme-primary-deep)] text-slate-100 border-b border-[var(--theme-accent)]/40"
          role="region"
          aria-label="Agenda Kegiatan Desa Margamukti"
        >
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-10 flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 pr-3 border-r border-white/15 shrink-0 text-xs font-semibold text-[var(--theme-accent-light)] whitespace-nowrap">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span>Agenda Desa</span>
            </div>

            <div className="marquee-viewport flex-1 min-w-0">
              <div className={`marquee-track text-xs ${tickerPaused ? 'is-paused' : ''}`}>
                {[0, 1].map((dupIdx) => (
                  <div key={dupIdx} className="flex items-center shrink-0 pr-10" aria-hidden={dupIdx === 1}>
                    {overview.events.map((ev) => (
                      <span key={`${dupIdx}-${ev.id}`} className="inline-flex items-center gap-2 mr-8 whitespace-nowrap">
                        <span className="font-semibold text-white">{ev.title}</span>
                        <span className="text-slate-400" aria-hidden="true">·</span>
                        <span className="font-mono-tabular text-[var(--theme-accent-light)]">{ev.event_time}</span>
                        <span className="text-slate-400" aria-hidden="true">·</span>
                        <span className="text-slate-300">{ev.location}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTickerPaused((p) => !p)}
              className="inline-flex items-center justify-center w-8 h-8 rounded border border-white/15 text-slate-300 hover:text-white hover:border-[var(--theme-accent)] shrink-0 cursor-pointer"
              aria-label={tickerPaused ? 'Putar running text agenda' : 'Jeda running text agenda'}
              title={tickerPaused ? 'Putar agenda' : 'Jeda untuk membaca'}
            >
              {tickerPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </button>
          </div>
        </div>
      )}

      {/* Kolom Khusus Ucapan Resmi Pemerintah Desa sesuai Momen/Hari Besar */}
      <VillageGreetingBanner
        greetings={activeGreetings}
        onOpenCalendar={() => navigatePublic('jelajah', 'kalender')}
      />

      {/* Banner Siaga Peringatan Dini (Mengalir alami, tidak menutup layar HP) */}
      {earlyWarningData?.warnings &&
        earlyWarningData.warnings.length > 0 &&
        !bannerDismissed &&
        (() => {
          const topWarning = earlyWarningData.warnings[0];
          const meta = getSeverityMeta(topWarning.severity);
          const SevIcon = meta.icon;
          return (
            <div
              className={`no-print ${meta.bannerBg}`}
              role="region"
              aria-label="Peringatan Dini Desa Margamukti"
            >
              <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-bold text-[var(--theme-accent-light)] shrink-0 whitespace-nowrap">
                    <SevIcon className="w-4 h-4 shrink-0" />
                    <span>{meta.label}</span>
                  </span>
                  <span className="text-white/40 hidden sm:inline" aria-hidden="true">|</span>
                  <div className="min-w-0 truncate">
                    <span className="font-semibold text-white">{topWarning.title}</span>
                    {topWarning.affected_area && (
                      <span className="text-slate-200 ml-1.5">
                        · {topWarning.affected_area}
                      </span>
                    )}
                    {earlyWarningData.warnings.length > 1 && (
                      <span className="text-[var(--theme-accent-light)] ml-1.5 font-mono-tabular">
                        (+{earlyWarningData.warnings.length - 1} info lainnya)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={scrollToEarlyWarningInfo}
                    className="min-h-[36px] sm:min-h-0 px-3 py-1.5 text-[11px] font-semibold text-white border border-white/25 hover:bg-white/10 rounded-md whitespace-nowrap cursor-pointer"
                  >
                    Info &amp; BMKG
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmergencyModalOpen(true)}
                    className="min-h-[36px] sm:min-h-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md whitespace-nowrap cursor-pointer"
                  >
                    <Siren className="w-3.5 h-3.5 shrink-0" />
                    Laporkan Darurat
                  </button>
                  <button
                    type="button"
                    onClick={() => setBannerDismissed(true)}
                    className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1 text-slate-300 hover:text-white cursor-pointer"
                    aria-label="Tutup banner peringatan"
                    title="Tutup banner sementara"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Main Content */}
      <main className="flex-1">
        {verifyCode ? (
          <LetterVerificationPage
            initialCode={verifyCode}
            onOpenLetterTrack={(code) => {
              navigatePublic('surat', 'track', code);
            }}
            onBackHome={() => navigatePublic('beranda')}
          />
        ) : (
          <>
            {route === 'beranda' && overview && (
              <HomePage
                settings={overview.settings}
                stats={overview.stats}
                officials={overview.officials}
                articles={overview.articles}
                umkm={overview.umkm}
                templates={overview.templates}
                earlyWarningData={earlyWarningData}
                onOpenEmergencyModal={() => setEmergencyModalOpen(true)}
                onNavigate={navigatePublic}
              />
            )}
            {route === 'beranda' && !overview && (
              <div className="max-w-7xl mx-auto px-4 py-12 space-y-6">
                <div className="h-64 bg-slate-200 rounded-xl" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl" />
                  ))}
                </div>
              </div>
            )}

            {route === 'profil' && (
              <ProfilePage
                initialTab={subTab}
                onOpenMapLocation={(markerId) => navigatePublic('peta-kontak', undefined, markerId)}
                onOpenDevelopments={() => navigatePublic('jelajah', 'pembangunan')}
                onOpenInstitution={(slug) => navigatePublic('lembaga', slug)}
              />
            )}
            {route === 'lembaga' && (
              <LembagaPage
                initialSlug={(subTab as InstitutionSlug) || 'bpd'}
                onSelectSlug={(slug) => navigatePublic('lembaga', slug)}
              />
            )}
            {route === 'surat' && (
              <LettersPage
                initialTab={subTab}
                initialTemplateId={typeof routeParam === 'number' ? routeParam : undefined}
                initialTrackCode={typeof routeParam === 'string' ? routeParam : undefined}
              />
            )}
            {route === 'jelajah' && (
              <ExplorePage
                initialTab={subTab}
                initialArticleSlug={typeof routeParam === 'string' ? routeParam : undefined}
                onOpenMapLocation={(markerId) => navigatePublic('peta-kontak', undefined, markerId)}
              />
            )}
            {route === 'bansos' && <BansosPage onNavigate={navigatePublic} />}
            {route === 'asisten-ai' && <AiAssistantPage onNavigate={navigatePublic} />}
            {route === 'peta-kontak' && (
              <MapContactPage initialMarkerId={typeof routeParam === 'string' ? routeParam : null} />
            )}
          </>
        )}
      </main>

      {/* Clean Institutional Footer (Extra bottom spacing on mobile for Bottom Nav Bar) */}
      <footer className="no-print bg-[var(--theme-primary-deep)] text-slate-300 border-t-4 border-[var(--theme-accent)] mt-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-3 text-white">
              <SumedangCrest className="w-9 h-10 shrink-0" />
              <div>
                <p className="font-bold text-base">Pemerintah Desa Margamukti</p>
                <p className="text-xs text-[var(--theme-accent-light)]">
                  Kecamatan Sumedang Utara, Kabupaten Sumedang
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              {overview?.settings.office_address ||
                'Jl. Raya Kebonkalapa No. 12, Desa Margamukti, Kec. Sumedang Utara, Kab. Sumedang 45321'}
            </p>
          </div>

          <div className="md:col-span-4 space-y-2 text-xs">
            <p className="font-semibold text-white uppercase tracking-wider mb-3">Akses Cepat</p>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-3">
              <button type="button" onClick={() => navigatePublic('profil', 'portofolio')} className="text-left py-1 hover:text-white cursor-pointer">
                Portofolio Desa
              </button>
              <button type="button" onClick={() => navigatePublic('jelajah', 'pembangunan')} className="text-left py-1 hover:text-white cursor-pointer">
                Pembangunan Desa
              </button>
              <button type="button" onClick={() => navigatePublic('profil', 'perangkat')} className="text-left py-1 hover:text-white cursor-pointer">
                Perangkat Desa
              </button>
              <button type="button" onClick={() => navigatePublic('lembaga', 'bpd')} className="text-left py-1 hover:text-white cursor-pointer">
                Lembaga Desa
              </button>
              <button type="button" onClick={() => navigatePublic('surat', 'form')} className="text-left py-1 hover:text-white cursor-pointer">
                Ajukan Surat
              </button>
              <button type="button" onClick={() => navigatePublic('profil', 'statistik')} className="text-left py-1 hover:text-white cursor-pointer">
                Statistik Penduduk
              </button>
              <button type="button" onClick={() => navigatePublic('profil', 'apbdes')} className="text-left py-1 hover:text-white cursor-pointer">
                Transparansi APBDes
              </button>
              <button type="button" onClick={() => navigatePublic('profil', 'wilayah')} className="text-left py-1 hover:text-white cursor-pointer">
                Dusun &amp; RT/RW
              </button>
              <button type="button" onClick={() => navigatePublic('jelajah', 'umkm')} className="text-left py-1 hover:text-white cursor-pointer">
                Katalog UMKM
              </button>
              <button type="button" onClick={() => navigatePublic('jelajah', 'galeri')} className="text-left py-1 hover:text-white cursor-pointer">
                Galeri Kegiatan
              </button>
              <button type="button" onClick={() => navigatePublic('jelajah', 'kalender')} className="text-left py-1 hover:text-white cursor-pointer">
                Kalender &amp; Hari Besar
              </button>
              <button type="button" onClick={() => navigatePublic('bansos')} className="text-left py-1 hover:text-white cursor-pointer">
                Cek Bansos &amp; DTSEN
              </button>
              <button type="button" onClick={() => navigatePublic('asisten-ai')} className="text-left py-1 hover:text-white cursor-pointer">
                Asisten AI Warga
              </button>
              <button type="button" onClick={() => navigatePublic('peta-kontak')} className="text-left py-1 hover:text-white cursor-pointer">
                Peta &amp; Pengaduan
              </button>
            </div>
          </div>

          <div className="md:col-span-3 space-y-2 text-xs">
            <p className="font-semibold text-white uppercase tracking-wider mb-3">Layanan Kantor &amp; Media Sosial</p>
            <p>{overview?.settings.service_hours || 'Senin - Jumat, 08.00 - 15.30 WIB'}</p>
            <p className="font-mono-tabular">{overview?.settings.phone || '(0261) 204512'}</p>
            <p className="break-all">{overview?.settings.email || 'pemdes@margamukti-sumedang.desa.id'}</p>

            <div className="pt-3 flex flex-wrap items-center gap-2">
              {overview?.settings.facebook_url && (
                <a
                  href={overview.settings.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded border border-white/15 text-slate-200 hover:text-white hover:border-[var(--theme-accent)] transition-colors"
                >
                  <Facebook className="w-3.5 h-3.5 text-[var(--theme-accent-light)]" />
                  <span>Facebook</span>
                </a>
              )}
              {overview?.settings.instagram_url && (
                <a
                  href={overview.settings.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded border border-white/15 text-slate-200 hover:text-white hover:border-[var(--theme-accent)] transition-colors"
                >
                  <Instagram className="w-3.5 h-3.5 text-[var(--theme-accent-light)]" />
                  <span>Instagram</span>
                </a>
              )}
              {(overview?.settings.whatsapp || '6281220458899') && (
                <a
                  href={`https://wa.me/${(overview?.settings.whatsapp || '6281220458899').replace(/\D/g, '').replace(/^0/, '62')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded border border-white/15 text-slate-200 hover:text-white hover:border-[var(--theme-accent)] transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[var(--theme-accent-light)]" />
                  <span>WhatsApp Center</span>
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Pemerintah Desa Margamukti, Kec. Sumedang Utara, Kab. Sumedang.
        </div>
      </footer>

      {/* Fixed Smartphone Bottom Navigation Bar (Thumb-Zone Ergonomics) */}
      <nav
        aria-label="Navigasi utama seluler"
        className="no-print md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(15,39,68,0.06)]"
      >
        <div className="grid grid-cols-5 h-16">
          {[
            { id: 'beranda', label: 'Beranda', icon: Home },
            { id: 'surat', label: 'Surat', icon: FileText },
            { id: 'jelajah', label: 'Jelajah', icon: Compass },
            { id: 'bansos', label: 'Bansos', icon: SearchCheck },
          ].map((tabItem) => {
            const Icon = tabItem.icon;
            const isActive = !mobileMenuOpen && !verifyCode && route === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => navigatePublic(tabItem.id as PublicRoute)}
                className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] text-[11px] font-medium transition-colors cursor-pointer ${
                  isActive ? 'text-[var(--theme-primary)] font-semibold' : 'text-slate-500 hover:text-[var(--theme-primary)]'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 inset-x-3 h-0.5 bg-[var(--theme-accent)] rounded-b-full" />
                )}
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[var(--theme-primary)]' : 'text-slate-500'}`} />
                <span className="truncate max-w-full px-1">{tabItem.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] text-[11px] font-medium transition-colors cursor-pointer ${
              mobileMenuOpen || route === 'profil' || route === 'lembaga' || route === 'peta-kontak'
                ? 'text-[var(--theme-primary)] font-semibold'
                : 'text-slate-500 hover:text-[var(--theme-primary)]'
            }`}
            aria-label="Menu lainnya"
          >
            {(mobileMenuOpen || route === 'profil' || route === 'lembaga' || route === 'peta-kontak') && (
              <span className="absolute top-0 inset-x-3 h-0.5 bg-[var(--theme-accent)] rounded-b-full" />
            )}
            {mobileMenuOpen ? (
              <X className="w-5 h-5 shrink-0 text-[var(--theme-primary)]" />
            ) : (
              <Menu className="w-5 h-5 shrink-0" />
            )}
            <span>Menu</span>
          </button>
        </div>
      </nav>

      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectResult={(item: GlobalSearchResult) => {
          navigatePublic(item.route, item.subTab, item.param);
        }}
      />

      <EmergencyReportModal
        open={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        defaultLat={earlyWarningData?.mapCenter?.lat ?? overview?.settings.map_center_lat ?? -6.8283}
        defaultLng={earlyWarningData?.mapCenter?.lng ?? overview?.settings.map_center_lng ?? 107.9}
        emergencyContact={earlyWarningData?.emergencyContact || overview?.settings.whatsapp || overview?.settings.phone || ''}
      />

      {!verifyCode && (
        <FloatingAiChatWidget currentRoute={route} onNavigate={navigatePublic} />
      )}
    </div>
  );
}
