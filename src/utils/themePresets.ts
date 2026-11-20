export interface PortalThemePreset {
  id: string;
  name: string;
  subtitle: string;
  primary: string;
  primaryHover: string;
  primaryDeep: string;
  accent: string;
  accentDark: string;
  accentLight: string;
}

export const PORTAL_THEME_PRESETS: PortalThemePreset[] = [
  {
    id: 'navy-gold',
    name: 'Biru Praja',
    subtitle: 'Resmi Navy & Emas',
    primary: '#0F2744',
    primaryHover: '#16355C',
    primaryDeep: '#091A30',
    accent: '#C59B27',
    accentDark: '#A67F17',
    accentLight: '#E5C158',
  },
  {
    id: 'emerald-gold',
    name: 'Hijau Priangan',
    subtitle: 'Zamrud & Emas',
    primary: '#0B3B2E',
    primaryHover: '#115241',
    primaryDeep: '#06261D',
    accent: '#C59B27',
    accentDark: '#9A7412',
    accentLight: '#E5C158',
  },
  {
    id: 'teal-amber',
    name: 'Biru Samudra',
    subtitle: 'Teal & Kuning Madu',
    primary: '#0E3A4D',
    primaryHover: '#154F69',
    primaryDeep: '#082431',
    accent: '#D49A2A',
    accentDark: '#A97616',
    accentLight: '#ECC15F',
  },
  {
    id: 'crimson-gold',
    name: 'Merah Marwah',
    subtitle: 'Merah Tua & Emas',
    primary: '#5A1822',
    primaryHover: '#73222F',
    primaryDeep: '#3D0E16',
    accent: '#C59B27',
    accentDark: '#9E7614',
    accentLight: '#E7C460',
  },
  {
    id: 'charcoal-amber',
    name: 'Arang Modern',
    subtitle: 'Slate Gelap & Amber',
    primary: '#1E293B',
    primaryHover: '#2C3B52',
    primaryDeep: '#0F172A',
    accent: '#D97706',
    accentDark: '#B45309',
    accentLight: '#FBBF24',
  },
];

const THEME_STORAGE_KEY = 'margamukti_portal_theme';

export function getStoredPortalThemeId(): string {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && PORTAL_THEME_PRESETS.some((p) => p.id === saved)) {
      return saved;
    }
  } catch {
    // ignore storage restriction
  }
  return PORTAL_THEME_PRESETS[0].id;
}

export function applyPortalTheme(themeId: string): PortalThemePreset {
  const preset = PORTAL_THEME_PRESETS.find((p) => p.id === themeId) || PORTAL_THEME_PRESETS[0];
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', preset.primary);
    root.style.setProperty('--theme-primary-hover', preset.primaryHover);
    root.style.setProperty('--theme-primary-deep', preset.primaryDeep);
    root.style.setProperty('--theme-accent', preset.accent);
    root.style.setProperty('--theme-accent-dark', preset.accentDark);
    root.style.setProperty('--theme-accent-light', preset.accentLight);
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preset.id);
  } catch {
    // ignore storage restriction
  }
  return preset;
}
