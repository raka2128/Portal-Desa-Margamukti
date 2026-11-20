import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import { ALL_ADMIN_PERMISSIONS, db, initializeDatabase, getPopulationStats } from './server/db.ts';
import {
  buildVillageBackupPayload,
  createAndStoreBackupSnapshot,
  getBackupOverview,
  resolveSafeBackupPath,
  startWeeklyBackupScheduler,
  type BackupArchiveRow,
} from './server/backup.ts';
import {
  cleanPhoneInput,
  collectWaRecipientsDirectory,
  formatIndonesianTodayLabel,
  getWaGatewayStatus,
  recomputeBlastSummary,
  renderWaMessageTemplate,
  runGatewayBlastSession,
} from './server/waBlaster.ts';
import {
  AiServiceError,
  askVillageAiAssistant,
  getPublicAiTopics,
} from './server/aiAssistant.ts';

dotenv.config();
initializeDatabase();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'margamukti-sumedang-utara-secret-2026';

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadsDir));

interface AuthPayload {
  id: number;
  username: string;
  fullName: string;
  role: string;
  permissions: string[];
  officialId?: number | null;
  scopeDusun?: string;
  scopeRw?: string;
  scopeRt?: string;
}

type AuthenticatedRequest = express.Request & { user?: AuthPayload };

const RT_RW_DEFAULT_PERMISSIONS = ['penduduk', 'umkm', 'galeri'] as const;
const VALID_RESIDENT_STATUSES = ['aktif', 'lahir', 'pindah_masuk', 'pindah_keluar', 'meninggal'] as const;

function normalizeResidentStatus(raw: unknown): (typeof VALID_RESIDENT_STATUSES)[number] {
  const s = String(raw || 'aktif').trim().toLowerCase();
  return (VALID_RESIDENT_STATUSES as readonly string[]).includes(s)
    ? (s as (typeof VALID_RESIDENT_STATUSES)[number])
    : 'aktif';
}

function isRtRwRole(role: string | undefined): boolean {
  return role === 'ketua_rt' || role === 'ketua_rw';
}

function getUserRegionScopeClause(
  user: AuthPayload | undefined,
  alias = 'rg'
): { sql: string; params: string[] } {
  if (!user || !isRtRwRole(user.role)) {
    return { sql: '', params: [] };
  }
  const dusun = String(user.scopeDusun || '').trim();
  const rw = String(user.scopeRw || '').trim();
  const rt = String(user.scopeRt || '').trim();
  if (!dusun || !rw) {
    return { sql: '1 = 0', params: [] };
  }
  if (user.role === 'ketua_rt') {
    if (!rt) return { sql: '1 = 0', params: [] };
    return {
      sql: `LOWER(TRIM(${alias}.dusun)) = LOWER(TRIM(?)) AND TRIM(${alias}.rw) = TRIM(?) AND TRIM(${alias}.rt) = TRIM(?)`,
      params: [dusun, rw, rt],
    };
  }
  return {
    sql: `LOWER(TRIM(${alias}.dusun)) = LOWER(TRIM(?)) AND TRIM(${alias}.rw) = TRIM(?)`,
    params: [dusun, rw],
  };
}

function isRegionAllowedForUser(
  user: AuthPayload | undefined,
  region: { dusun: string; rw: string; rt: string } | null | undefined
): boolean {
  if (!user || !isRtRwRole(user.role)) return true;
  if (!region) return false;
  const scopeDusun = String(user.scopeDusun || '').trim().toLowerCase();
  const scopeRw = String(user.scopeRw || '').trim();
  const scopeRt = String(user.scopeRt || '').trim();
  if (!scopeDusun || !scopeRw) return false;
  const matchDusunRw =
    region.dusun.trim().toLowerCase() === scopeDusun && region.rw.trim() === scopeRw;
  if (!matchDusunRw) return false;
  if (user.role === 'ketua_rt') {
    return Boolean(scopeRt) && region.rt.trim() === scopeRt;
  }
  return true;
}

function parseUserPermissions(role: string, rawPermissions: unknown): string[] {
  if (role === 'super_admin') {
    return [...ALL_ADMIN_PERMISSIONS];
  }
  if (isRtRwRole(role)) {
    return [...RT_RW_DEFAULT_PERMISSIONS];
  }
  if (Array.isArray(rawPermissions)) {
    return rawPermissions.filter((p): p is string => typeof p === 'string');
  }
  try {
    const parsed = JSON.parse(String(rawPermissions || '[]'));
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === 'string')
      : [];
  } catch {
    return [];
  }
}

function extractAuthToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.cookies?.margamukti_token) {
    return String(req.cookies.margamukti_token);
  }
  return null;
}

function loadActiveUserById(userId: number): AuthPayload | null {
  const row = db
    .prepare(
      'SELECT id, username, full_name, role, permissions, official_id, scope_dusun, scope_rw, scope_rt, is_active FROM users WHERE id = ?'
    )
    .get(userId) as
    | {
        id: number;
        username: string;
        full_name: string;
        role: string;
        permissions: string;
        official_id: number | null;
        scope_dusun: string;
        scope_rw: string;
        scope_rt: string;
        is_active: number;
      }
    | undefined;
  if (!row || row.is_active !== 1) {
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    permissions: parseUserPermissions(row.role, row.permissions),
    officialId: row.official_id,
    scopeDusun: row.scope_dusun || '',
    scopeRw: row.scope_rw || '',
    scopeRt: row.scope_rt || '',
  };
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = extractAuthToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sesi admin berakhir. Silakan login kembali.' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    const activeUser = loadActiveUserById(decoded.id);
    if (!activeUser) {
      res.status(401).json({ error: 'Akun tidak aktif atau sudah dihapus.' });
      return;
    }
    (req as AuthenticatedRequest).user = activeUser;
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid atau telah kedaluwarsa.' });
  }
}

function requireSuperAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (!user || user.role !== 'super_admin') {
    res.status(403).json({ error: 'Akses ditolak. Fitur ini khusus untuk Super Admin.' });
    return;
  }
  next();
}

function requireAnyPermission(...allowedPerms: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ error: 'Sesi admin berakhir.' });
      return;
    }
    if (user.role === 'super_admin') {
      next();
      return;
    }
    const hasAccess = allowedPerms.some((p) => user.permissions.includes(p));
    if (!hasAccess) {
      res.status(403).json({ error: 'Anda tidak memiliki wewenang untuk mengakses modul ini.' });
      return;
    }
    next();
  };
}

const requirePermission = (perm: string) => requireAnyPermission(perm);

function requireVillageBackupAccess(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({ error: 'Sesi admin berakhir.' });
    return;
  }
  if (isRtRwRole(user.role)) {
    res.status(403).json({
      error: 'Akses ditolak. Fitur cadangan data desa hanya untuk Admin / Perangkat Desa.',
    });
    return;
  }
  if (
    user.role === 'super_admin' ||
    user.permissions.includes('penduduk') ||
    user.permissions.includes('surat')
  ) {
    next();
    return;
  }
  res.status(403).json({ error: 'Anda tidak memiliki wewenang mengakses cadangan data.' });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function formatDateIndonesian(dateStr: string): string {
  if (!dateStr) return '-';
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return `${parsed.getDate()} ${months[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

function renderLetterBody(templateBody: string, reqRow: Record<string, unknown>): string {
  let extra: Record<string, string> = {};
  try {
    extra = JSON.parse(String(reqRow.extra_data || '{}'));
  } catch {
    extra = {};
  }
  const ttl = `${reqRow.birth_place || ''}, ${formatDateIndonesian(String(reqRow.birth_date || ''))}`;
  const replacements: Record<string, string> = {
    nama: String(reqRow.applicant_name || ''),
    nik: String(reqRow.applicant_nik || ''),
    ttl,
    jenis_kelamin: String(reqRow.gender || ''),
    agama: String(reqRow.religion || ''),
    pekerjaan: String(reqRow.occupation || ''),
    status_perkawinan: String(reqRow.marital_status || ''),
    alamat: String(reqRow.address || ''),
    keperluan: String(reqRow.purpose || ''),
    ...extra,
  };

  let output = templateBody;
  for (const [key, val] of Object.entries(replacements)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    output = output.replace(regex, val || '-');
  }
  output = output.replace(/{{[^}]+}}/g, '-');
  return output;
}

// ============================================================================
// BMKG LIVE DATA PROXY + 5-MINUTE IN-MEMORY CACHE
// ============================================================================

interface BmkgCacheEntry {
  key: string;
  expiresAt: number;
  payload: Record<string, unknown>;
}

let bmkgCache: BmkgCacheEntry | null = null;

async function fetchJsonWithTimeout(url: string, timeoutMs = 4000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PortalDesaMargamukti/1.0 (+https://margamukti.desa.id)',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBmkgLiveData(rawAdm4: string) {
  const adm4 = String(rawAdm4 || '32.11.18.2008').trim() || '32.11.18.2008';
  const now = Date.now();
  if (bmkgCache && bmkgCache.key === adm4 && bmkgCache.expiresAt > now) {
    return bmkgCache.payload;
  }

  const weatherUrl = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(adm4)}`;
  const quakeUrl = 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json';

  const [weatherRes, quakeRes] = await Promise.allSettled([
    fetchJsonWithTimeout(weatherUrl, 4000),
    fetchJsonWithTimeout(quakeUrl, 4000),
  ]);

  let weather: {
    available: boolean;
    locationName?: string;
    current?: Record<string, unknown> | null;
    upcoming?: Array<Record<string, unknown>>;
    error?: string;
  } = {
    available: false,
    error: 'Prakiraan cuaca BMKG sedang tidak tersedia.',
  };

  if (weatherRes.status === 'fulfilled' && weatherRes.value && typeof weatherRes.value === 'object') {
    const root = weatherRes.value as {
      lokasi?: { desa?: string; kecamatan?: string; kotkab?: string };
      data?: Array<{
        lokasi?: { desa?: string; kecamatan?: string; kotkab?: string };
        cuaca?: Array<Array<Record<string, unknown>>>;
      }>;
    };
    const firstEntry = Array.isArray(root.data) ? root.data[0] : undefined;
    const locObj = firstEntry?.lokasi || root.lokasi;
    const locationName = [locObj?.desa, locObj?.kecamatan, locObj?.kotkab]
      .filter(Boolean)
      .join(', ');
    const rawCuaca = Array.isArray(firstEntry?.cuaca) ? firstEntry.cuaca : [];
    const flatSlots = rawCuaca
      .flat()
      .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
      .map((s) => ({
        local_datetime: String(s.local_datetime || s.utc_datetime || ''),
        t: Number(s.t ?? 0),
        hu: Number(s.hu ?? 0),
        weather_desc: String(s.weather_desc || s.weather_desc_en || 'Cerah Berawan'),
        ws: Number(s.ws ?? 0),
        wd: String(s.wd || '-'),
      }));

    if (flatSlots.length > 0) {
      weather = {
        available: true,
        locationName: locationName || 'Desa Margamukti, Sumedang Utara',
        current: flatSlots[0],
        upcoming: flatSlots.slice(1, 5),
      };
    }
  }

  let earthquake: {
    available: boolean;
    data?: Record<string, unknown> | null;
    error?: string;
  } = {
    available: false,
    error: 'Data gempa bumi BMKG sedang tidak tersedia.',
  };

  if (quakeRes.status === 'fulfilled' && quakeRes.value && typeof quakeRes.value === 'object') {
    const qRoot = quakeRes.value as {
      Infogempa?: { gempa?: Record<string, unknown> };
    };
    const g = qRoot?.Infogempa?.gempa;
    if (g && typeof g === 'object') {
      earthquake = {
        available: true,
        data: {
          tanggal: String(g.Tanggal || ''),
          jam: String(g.Jam || ''),
          dateTime: String(g.DateTime || ''),
          coordinates: String(g.Coordinates || ''),
          lintang: String(g.Lintang || ''),
          bujur: String(g.Bujur || ''),
          magnitude: String(g.Magnitude || ''),
          kedalaman: String(g.Kedalaman || ''),
          wilayah: String(g.Wilayah || ''),
          potensi: String(g.Potensi || ''),
          dirasakan: String(g.Dirasakan || ''),
        },
      };
    }
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    adm4,
    weather,
    earthquake,
  };

  const ttlMs = weather.available || earthquake.available ? 5 * 60 * 1000 : 45 * 1000;
  bmkgCache = {
    key: adm4,
    expiresAt: now + ttlMs,
    payload,
  };

  return payload;
}

// ============================================================================
// AUTH ROUTES & MATH CAPTCHA
// ============================================================================

app.get('/api/auth/captcha', (_req, res) => {
  const useSubtraction = Math.random() < 0.35;
  let a = Math.floor(Math.random() * 12) + 3; // 3..14
  let b = Math.floor(Math.random() * 9) + 1;  // 1..9
  if (useSubtraction && b > a) {
    const tmp = a;
    a = b;
    b = tmp;
  }
  const answer = useSubtraction ? a - b : a + b;
  const question = useSubtraction ? `${a} - ${b} = ?` : `${a} + ${b} = ?`;
  const challengeToken = jwt.sign(
    { kind: 'math_captcha', answer, nonce: Math.random().toString(36).slice(2, 10) },
    JWT_SECRET,
    { expiresIn: '10m' }
  );
  res.json({ question, challengeToken });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password, captchaToken, captchaAnswer } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: 'Username dan password wajib diisi.' });
    return;
  }

  if (!captchaToken || captchaAnswer === undefined || captchaAnswer === null || String(captchaAnswer).trim() === '') {
    res.status(400).json({ error: 'Harap selesaikan verifikasi Captcha terlebih dahulu.' });
    return;
  }

  try {
    const decodedCaptcha = jwt.verify(String(captchaToken), JWT_SECRET) as {
      kind?: string;
      answer?: number;
    };
    const numericAnswer = Number(String(captchaAnswer).trim());
    if (
      decodedCaptcha.kind !== 'math_captcha' ||
      typeof decodedCaptcha.answer !== 'number' ||
      !Number.isFinite(numericAnswer) ||
      numericAnswer !== decodedCaptcha.answer
    ) {
      res.status(400).json({ error: 'Jawaban Captcha salah. Silakan hitung kembali atau muat ulang Captcha.' });
      return;
    }
  } catch {
    res.status(400).json({ error: 'Sesi Captcha telah kedaluwarsa. Silakan muat ulang Captcha.' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim()) as
    | {
        id: number;
        username: string;
        password_hash: string;
        full_name: string;
        role: string;
        permissions: string;
        official_id: number | null;
        scope_dusun: string;
        scope_rw: string;
        scope_rt: string;
        is_active: number;
      }
    | undefined;

  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    res.status(401).json({ error: 'Username atau password salah.' });
    return;
  }

  if (user.is_active !== 1) {
    res.status(403).json({ error: 'Akun Anda sedang dinonaktifkan oleh Super Admin.' });
    return;
  }

  const payload: AuthPayload = {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    permissions: parseUserPermissions(user.role, user.permissions),
    officialId: user.official_id,
    scopeDusun: user.scope_dusun || '',
    scopeRw: user.scope_rw || '',
    scopeRt: user.scope_rt || '',
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie('margamukti_token', token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
  res.json({ user: payload, token });
});

app.post('/api/auth/logout', (req, res) => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie('margamukti_token', {
    path: '/',
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const token = extractAuthToken(req);
  if (!token) {
    res.status(401).json({ user: null });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    const activeUser = loadActiveUserById(decoded.id);
    if (!activeUser) {
      res.status(401).json({ user: null });
      return;
    }
    res.json({ user: activeUser });
  } catch {
    res.status(401).json({ user: null });
  }
});

// ============================================================================
// PUBLIC ROUTES (/api/public/*)
// ============================================================================

app.get('/api/public/overview', (_req, res) => {
  const settings = db.prepare('SELECT * FROM village_settings WHERE id = 1').get();
  const stats = getPopulationStats();
  const officials = db.prepare('SELECT * FROM officials ORDER BY sort_order ASC, id ASC LIMIT 4').all();
  const articles = db
    .prepare('SELECT * FROM articles WHERE is_published = 1 ORDER BY published_at DESC, id DESC LIMIT 3')
    .all();
  const umkm = db
    .prepare('SELECT * FROM umkm_products WHERE is_verified = 1 ORDER BY id DESC LIMIT 4')
    .all();
  const templates = db
    .prepare('SELECT id, code, name, classification_code, description FROM letter_templates WHERE is_active = 1 ORDER BY id ASC')
    .all();
  const events = db
    .prepare('SELECT * FROM village_events WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
    .all();

  res.json({ settings, stats, officials, articles, umkm, templates, events });
});

app.get('/api/public/search', (req, res) => {
  const rawQuery = String(req.query.q || '').trim();
  if (!rawQuery) {
    res.json({ query: '', total: 0, results: [] });
    return;
  }

  const pattern = `%${rawQuery}%`;
  type SearchItem = {
    id: string;
    category: 'surat' | 'berita' | 'agenda' | 'umkm' | 'peta' | 'profil' | 'apbdes' | 'bansos';
    categoryLabel: string;
    title: string;
    subtitle: string;
    route: 'beranda' | 'profil' | 'surat' | 'jelajah' | 'bansos' | 'peta-kontak';
    subTab?: string;
    param?: string | number;
  };

  const results: SearchItem[] = [];

  const lowerQ = rawQuery.toLowerCase();
  if (
    ['bansos', 'pkh', 'bpnt', 'dtsen', 'perlinsos', 'ikd', 'kemensos', 'bantuan', 'sosial'].some((kw) =>
      lowerQ.includes(kw)
    )
  ) {
    results.push(
      {
        id: 'bansos-cek',
        category: 'bansos',
        categoryLabel: 'Layanan Bansos',
        title: 'Cek Bansos Kemensos (cekbansos.kemensos.go.id)',
        subtitle: 'Cek status kepesertaan PKH, BPNT / Sembako, dan PBI-JK resmi Kementerian Sosial RI',
        route: 'bansos',
      },
      {
        id: 'bansos-perlinsos',
        category: 'bansos',
        categoryLabel: 'Pemutakhiran DTSEN',
        title: 'Perlinsos Digital — Pembaruan Data DTSEN (perlinsos.kemensos.go.id)',
        subtitle: 'Pemutakhiran data kepesertaan bansos ke Data Tunggal Sosial dan Ekonomi Nasional via IKD',
        route: 'bansos',
      }
    );
  }

  const letterRows = db
    .prepare(
      `SELECT id, code, name, classification_code, description
       FROM letter_templates
       WHERE is_active = 1 AND (name LIKE ? OR code LIKE ? OR classification_code LIKE ? OR description LIKE ?)
       ORDER BY id ASC LIMIT 8`
    )
    .all(pattern, pattern, pattern, pattern) as Array<{
    id: number;
    code: string;
    name: string;
    classification_code: string;
    description: string;
  }>;
  for (const r of letterRows) {
    results.push({
      id: `surat-${r.id}`,
      category: 'surat',
      categoryLabel: 'Layanan Surat',
      title: r.name,
      subtitle: `${r.code} · Klasifikasi ${r.classification_code} · ${r.description}`,
      route: 'surat',
      subTab: 'form',
      param: r.id,
    });
  }

  const articleRows = db
    .prepare(
      `SELECT id, title, slug, category, excerpt, published_at
       FROM articles
       WHERE is_published = 1 AND (title LIKE ? OR excerpt LIKE ? OR category LIKE ? OR content LIKE ?)
       ORDER BY published_at DESC, id DESC LIMIT 6`
    )
    .all(pattern, pattern, pattern, pattern) as Array<{
    id: number;
    title: string;
    slug: string;
    category: string;
    excerpt: string;
    published_at: string;
  }>;
  for (const a of articleRows) {
    results.push({
      id: `berita-${a.id}`,
      category: 'berita',
      categoryLabel: 'Berita Desa',
      title: a.title,
      subtitle: `${a.category} · ${a.published_at} · ${a.excerpt}`,
      route: 'jelajah',
      subTab: 'berita',
      param: a.slug,
    });
  }

  const eventRows = db
    .prepare(
      `SELECT id, title, event_time, location
       FROM village_events
       WHERE is_active = 1 AND (title LIKE ? OR event_time LIKE ? OR location LIKE ?)
       ORDER BY sort_order ASC, id ASC LIMIT 5`
    )
    .all(pattern, pattern, pattern) as Array<{
    id: number;
    title: string;
    event_time: string;
    location: string;
  }>;
  for (const ev of eventRows) {
    results.push({
      id: `agenda-${ev.id}`,
      category: 'agenda',
      categoryLabel: 'Agenda Desa',
      title: ev.title,
      subtitle: `${ev.event_time} · ${ev.location}`,
      route: 'beranda',
    });
  }

  const umkmRows = db
    .prepare(
      `SELECT id, business_name, product_name, category, owner_name, price
       FROM umkm_products
       WHERE is_verified = 1 AND (business_name LIKE ? OR product_name LIKE ? OR category LIKE ? OR owner_name LIKE ? OR description LIKE ?)
       ORDER BY id DESC LIMIT 6`
    )
    .all(pattern, pattern, pattern, pattern, pattern) as Array<{
    id: number;
    business_name: string;
    product_name: string;
    category: string;
    owner_name: string;
    price: number;
  }>;
  for (const u of umkmRows) {
    results.push({
      id: `umkm-${u.id}`,
      category: 'umkm',
      categoryLabel: 'Katalog UMKM',
      title: `${u.product_name} — ${u.business_name}`,
      subtitle: `${u.category} · Pemilik: ${u.owner_name} · Rp ${Number(u.price || 0).toLocaleString('id-ID')}`,
      route: 'jelajah',
      subTab: 'umkm',
    });
  }

  const mapRows = db
    .prepare(
      `SELECT id, name, category, address
       FROM map_locations
       WHERE name LIKE ? OR category LIKE ? OR address LIKE ? OR description LIKE ?
       ORDER BY id ASC LIMIT 5`
    )
    .all(pattern, pattern, pattern, pattern) as Array<{
    id: number;
    name: string;
    category: string;
    address: string;
  }>;
  for (const m of mapRows) {
    results.push({
      id: `peta-${m.id}`,
      category: 'peta',
      categoryLabel: 'Peta & Lokasi',
      title: m.name,
      subtitle: `${m.category} · ${m.address}`,
      route: 'peta-kontak',
    });
  }

  const officialRows = db
    .prepare(
      `SELECT id, name, position, nip
       FROM officials
       WHERE name LIKE ? OR position LIKE ? OR bio LIKE ?
       ORDER BY sort_order ASC, id ASC LIMIT 5`
    )
    .all(pattern, pattern, pattern) as Array<{
    id: number;
    name: string;
    position: string;
    nip: string;
  }>;
  for (const o of officialRows) {
    results.push({
      id: `perangkat-${o.id}`,
      category: 'profil',
      categoryLabel: 'Perangkat Desa',
      title: o.name,
      subtitle: `${o.position} · ${o.nip}`,
      route: 'profil',
      subTab: 'perangkat',
    });
  }

  const regionRows = db
    .prepare(
      `SELECT id, dusun, kepala_dusun, blok, rw, rt, ketua_rw, ketua_rt
       FROM regions
       WHERE dusun LIKE ? OR kepala_dusun LIKE ? OR blok LIKE ? OR rw LIKE ? OR rt LIKE ? OR ketua_rw LIKE ? OR ketua_rt LIKE ?
       ORDER BY dusun ASC, rw ASC, rt ASC LIMIT 5`
    )
    .all(pattern, pattern, pattern, pattern, pattern, pattern, pattern) as Array<{
    id: number;
    dusun: string;
    kepala_dusun: string;
    blok: string;
    rw: string;
    rt: string;
    ketua_rw: string;
    ketua_rt: string;
  }>;
  for (const rg of regionRows) {
    results.push({
      id: `wilayah-${rg.id}`,
      category: 'profil',
      categoryLabel: 'Wilayah Dusun & RT/RW',
      title: `${rg.blok} (RT ${rg.rt} / RW ${rg.rw})`,
      subtitle: `${rg.dusun} · Kadus: ${rg.kepala_dusun || '-'} · RW: ${rg.ketua_rw} · RT: ${rg.ketua_rt}`,
      route: 'profil',
      subTab: 'wilayah',
    });
  }

  const apbdesRows = db
    .prepare(
      `SELECT id, fiscal_year, type, category, title, budget_amount
       FROM apbdes_items
       WHERE title LIKE ? OR category LIKE ? OR type LIKE ? OR CAST(fiscal_year AS TEXT) LIKE ? OR notes LIKE ?
       ORDER BY fiscal_year DESC, id ASC LIMIT 5`
    )
    .all(pattern, pattern, pattern, pattern, pattern) as Array<{
    id: number;
    fiscal_year: number;
    type: string;
    category: string;
    title: string;
    budget_amount: number;
  }>;
  for (const ap of apbdesRows) {
    results.push({
      id: `apbdes-${ap.id}`,
      category: 'apbdes',
      categoryLabel: 'Transparansi APBDes',
      title: ap.title,
      subtitle: `TA ${ap.fiscal_year} · ${ap.type} · ${ap.category} · Rp ${Number(ap.budget_amount || 0).toLocaleString('id-ID')}`,
      route: 'profil',
      subTab: 'apbdes',
    });
  }

  res.json({ query: rawQuery, total: results.length, results });
});

app.get('/api/public/profile', (_req, res) => {
  const settings = db.prepare('SELECT * FROM village_settings WHERE id = 1').get();
  const officials = db.prepare('SELECT * FROM officials ORDER BY sort_order ASC, id ASC').all();
  const regions = db.prepare('SELECT * FROM regions ORDER BY dusun ASC, rw ASC, rt ASC').all();
  const stats = getPopulationStats();
  res.json({ settings, officials, regions, stats });
});

app.get('/api/public/institutions', (req, res) => {
  const slug = String(req.query.slug || '').trim().toLowerCase();
  const rawInstitutions = slug
    ? (db.prepare('SELECT * FROM village_institutions WHERE is_active = 1 AND slug = ? ORDER BY id ASC').all(slug) as Array<Record<string, unknown>>)
    : (db.prepare('SELECT * FROM village_institutions WHERE is_active = 1 ORDER BY id ASC').all() as Array<Record<string, unknown>>);

  const memberStmt = db.prepare(
    'SELECT * FROM institution_members WHERE institution_id = ? ORDER BY sort_order ASC, id ASC'
  );

  const institutions = rawInstitutions.map((inst) => {
    let tupoksi: string[] = [];
    try {
      const parsed = JSON.parse(String(inst.tupoksi || '[]'));
      if (Array.isArray(parsed)) {
        tupoksi = parsed.map((x) => String(x));
      }
    } catch {
      tupoksi = [];
    }
    const members = memberStmt.all(Number(inst.id));
    return {
      ...inst,
      tupoksi,
      members,
    };
  });

  res.json({ institutions });
});

app.get('/api/public/statistics', (_req, res) => {
  const settings = db.prepare('SELECT village_name, district_name, regency_name FROM village_settings WHERE id = 1').get();
  const stats = getPopulationStats();
  res.json({ settings, stats });
});

app.get('/api/public/apbdes', (req, res) => {
  const yearRows = db
    .prepare('SELECT DISTINCT fiscal_year FROM apbdes_items ORDER BY fiscal_year DESC')
    .all() as Array<{ fiscal_year: number }>;
  const years = yearRows.map((y) => y.fiscal_year);
  const requestedYear = Number(req.query.year || 0);
  const activeYear = years.includes(requestedYear) ? requestedYear : years[0] || new Date().getFullYear();

  const items = db
    .prepare('SELECT * FROM apbdes_items WHERE fiscal_year = ? ORDER BY type ASC, id ASC')
    .all(activeYear) as Array<{
    id: number;
    fiscal_year: number;
    type: 'Pendapatan' | 'Belanja' | 'Pembiayaan';
    category: string;
    title: string;
    budget_amount: number;
    realized_amount: number;
    notes: string;
  }>;

  const totals = {
    pendapatanBudget: 0,
    pendapatanRealized: 0,
    belanjaBudget: 0,
    belanjaRealized: 0,
    pembiayaanBudget: 0,
    pembiayaanRealized: 0,
  };

  const groupMap = (targetType: string) => {
    const map = new Map<string, { category: string; budget: number; realized: number }>();
    for (const item of items) {
      if (item.type !== targetType) continue;
      const cur = map.get(item.category) || { category: item.category, budget: 0, realized: 0 };
      cur.budget += Number(item.budget_amount || 0);
      cur.realized += Number(item.realized_amount || 0);
      map.set(item.category, cur);
    }
    return Array.from(map.values());
  };

  for (const item of items) {
    const b = Number(item.budget_amount || 0);
    const r = Number(item.realized_amount || 0);
    if (item.type === 'Pendapatan') {
      totals.pendapatanBudget += b;
      totals.pendapatanRealized += r;
    } else if (item.type === 'Belanja') {
      totals.belanjaBudget += b;
      totals.belanjaRealized += r;
    } else if (item.type === 'Pembiayaan') {
      totals.pembiayaanBudget += b;
      totals.pembiayaanRealized += r;
    }
  }

  res.json({
    year: activeYear,
    years,
    totals,
    pendapatanByCategory: groupMap('Pendapatan'),
    belanjaByCategory: groupMap('Belanja'),
    pembiayaanByCategory: groupMap('Pembiayaan'),
    items,
  });
});

app.get('/api/public/residents/lookup', (req, res) => {
  const nik = String(req.query.nik || '').trim();
  if (!nik || nik.length < 8) {
    res.status(400).json({ error: 'Masukkan minimal 8-16 digit NIK untuk pencarian.' });
    return;
  }
  const resident = db
    .prepare(
      `SELECT r.*, rg.dusun, rg.blok, rg.rw, rg.rt
       FROM residents r
       LEFT JOIN regions rg ON r.region_id = rg.id
       WHERE r.nik = ?`
    )
    .get(nik);
  if (!resident) {
    res.status(404).json({ error: 'NIK belum terdaftar di database penduduk. Anda tetap dapat mengisi formulir secara manual.' });
    return;
  }
  res.json({ resident });
});

app.get('/api/public/letters/templates', (_req, res) => {
  const templates = db
    .prepare('SELECT * FROM letter_templates WHERE is_active = 1 ORDER BY id ASC')
    .all();
  res.json({ templates });
});

app.post('/api/public/letters/request', (req, res) => {
  const b = req.body || {};
  const required = ['template_id', 'applicant_nik', 'applicant_name', 'birth_place', 'birth_date', 'gender', 'address', 'purpose'];
  for (const field of required) {
    if (!b[field] || !String(b[field]).trim()) {
      res.status(400).json({ error: `Field wajib diisi: ${field}` });
      return;
    }
  }

  const tpl = db.prepare('SELECT * FROM letter_templates WHERE id = ?').get(Number(b.template_id));
  if (!tpl) {
    res.status(404).json({ error: 'Jenis surat tidak ditemukan.' });
    return;
  }

  const countRow = db.prepare('SELECT COUNT(*) as total FROM letter_requests').get() as { total: number };
  const seq = String((countRow.total || 0) + 1).padStart(4, '0');
  const year = new Date().getFullYear();
  const randomTag = Math.random().toString(36).slice(2, 5).toUpperCase();
  const trackingCode = `SRT-${year}-${seq}-${randomTag}`;

  const result = db
    .prepare(
      `INSERT INTO letter_requests (
        tracking_code, template_id, applicant_nik, applicant_name,
        birth_place, birth_date, gender, religion, occupation, marital_status,
        address, phone, purpose, extra_data, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    )
    .run(
      trackingCode,
      Number(b.template_id),
      String(b.applicant_nik).trim(),
      String(b.applicant_name).trim(),
      String(b.birth_place).trim(),
      String(b.birth_date).trim(),
      String(b.gender).trim(),
      String(b.religion || 'Islam').trim(),
      String(b.occupation || '-').trim(),
      String(b.marital_status || 'Belum Kawin').trim(),
      String(b.address).trim(),
      String(b.phone || '').trim(),
      String(b.purpose).trim(),
      JSON.stringify(b.extra_data || {})
    );

  const created = db
    .prepare(
      `SELECT lr.*, lt.name as template_name, lt.code as template_code, lt.classification_code
       FROM letter_requests lr
       JOIN letter_templates lt ON lr.template_id = lt.id
       WHERE lr.id = ?`
    )
    .get(result.lastInsertRowid);

  res.status(201).json({ request: created, tracking_code: trackingCode });
});

app.get('/api/public/letters/track', (req, res) => {
  const code = String(req.query.code || '').trim().toUpperCase();
  if (!code) {
    res.status(400).json({ error: 'Masukkan kode pelacakan surat.' });
    return;
  }
  const row = db
    .prepare(
      `SELECT lr.*, lt.name as template_name, lt.code as template_code, lt.classification_code, lt.body_template
       FROM letter_requests lr
       JOIN letter_templates lt ON lr.template_id = lt.id
       WHERE UPPER(lr.tracking_code) = ?`
    )
    .get(code) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Kode pelacakan tidak ditemukan. Periksa kembali kode Anda.' });
    return;
  }

  const settings = db.prepare('SELECT * FROM village_settings WHERE id = 1').get();
  const renderedBody = row.status === 'approved' ? renderLetterBody(String(row.body_template || ''), row) : null;
  res.json({ request: row, renderedBody, settings });
});

app.get('/api/public/letters/verify', (req, res) => {
  const code = String(req.query.code || '').trim().toUpperCase();
  if (!code) {
    res.status(400).json({ valid: false, error: 'Kode verifikasi surat tidak boleh kosong.' });
    return;
  }

  const row = db
    .prepare(
      `SELECT lr.tracking_code, lr.letter_number, lr.applicant_name, lr.applicant_nik,
              lr.purpose, lr.status, lr.approved_at, lr.created_at,
              lr.signer_name, lr.signer_position, lr.signer_nip, lr.signer_tte_code, lr.use_digital_signature,
              lt.name as template_name, lt.code as template_code, lt.classification_code
       FROM letter_requests lr
       JOIN letter_templates lt ON lr.template_id = lt.id
       WHERE UPPER(lr.tracking_code) = ?`
    )
    .get(code) as
    | {
        tracking_code: string;
        letter_number: string;
        applicant_name: string;
        applicant_nik: string;
        purpose: string;
        status: 'pending' | 'approved' | 'rejected';
        approved_at: string | null;
        created_at: string;
        signer_name: string;
        signer_position: string;
        signer_nip: string;
        signer_tte_code: string;
        use_digital_signature: number;
        template_name: string;
        template_code: string;
        classification_code: string;
      }
    | undefined;

  if (!row) {
    res.status(404).json({
      valid: false,
      error: 'Kode verifikasi surat tidak terdaftar pada arsip Pemerintah Desa Margamukti.',
    });
    return;
  }

  const settings = db
    .prepare('SELECT village_name, district_name, regency_name, head_name, head_nip FROM village_settings WHERE id = 1')
    .get() as {
    village_name: string;
    district_name: string;
    regency_name: string;
    head_name: string;
    head_nip: string;
  };

  const rawNik = String(row.applicant_nik || '').trim();
  const maskedNik =
    rawNik.length >= 10
      ? `${rawNik.slice(0, 6)}${'*'.repeat(Math.max(4, rawNik.length - 10))}${rawNik.slice(-4)}`
      : '******';

  res.json({
    valid: row.status === 'approved',
    status: row.status,
    tracking_code: row.tracking_code,
    letter_number: row.letter_number,
    template_name: row.template_name,
    template_code: row.template_code,
    classification_code: row.classification_code,
    applicant_name: row.applicant_name,
    masked_nik: maskedNik,
    purpose: row.purpose,
    approved_at: row.approved_at,
    created_at: row.created_at,
    signer_name: row.signer_name || settings.head_name,
    signer_position: row.signer_position || `Kepala ${settings.village_name}`,
    signer_nip: row.signer_nip || settings.head_nip,
    signer_tte_code: row.signer_tte_code || '',
    use_digital_signature: Boolean(row.use_digital_signature),
    issuer: settings,
  });
});

// ============================================================================
// PUBLIC AI ASSISTANT ROUTES (DTSEN, BANSOS, ADMINDUK, PEMDA & PEMDES)
// ============================================================================

const aiRateLimitMap = new Map<string, number[]>();

function checkAiRateLimit(ipKey: string): boolean {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const maxRequests = 25;
  const history = (aiRateLimitMap.get(ipKey) || []).filter((ts) => now - ts < windowMs);
  if (history.length >= maxRequests) {
    aiRateLimitMap.set(ipKey, history);
    return false;
  }
  history.push(now);
  aiRateLimitMap.set(ipKey, history);
  return true;
}

app.get('/api/public/ai-chat/topics', (_req, res) => {
  const data = getPublicAiTopics();
  const entries = db
    .prepare(
      'SELECT id, category, title, summary, official_source, related_route, related_subtab, related_label FROM ai_knowledge_entries WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    )
    .all();
  res.json({ ...data, guides: entries });
});

app.post('/api/public/ai-chat', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkAiRateLimit(clientIp)) {
    res.status(429).json({
      error: 'Terlalu banyak permintaan dalam waktu singkat. Mohon tunggu beberapa menit sebelum bertanya kembali.',
      code: 'RATE_LIMIT_LOCAL',
    });
    return;
  }

  const body = (req.body || {}) as {
    message?: unknown;
    history?: Array<{ role: 'user' | 'model'; text: string }>;
  };

  try {
    const result = await askVillageAiAssistant({
      message: String(body.message || ''),
      history: Array.isArray(body.history) ? body.history : [],
    });
    res.json(result);
  } catch (err) {
    if (err instanceof AiServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({
      error: 'Gagal memproses pertanyaan Asisten AI. Silakan coba lagi.',
      code: 'INTERNAL_ERROR',
    });
  }
});

app.get('/api/public/articles', (_req, res) => {
  const articles = db
    .prepare(
      `SELECT a.*,
        (SELECT COUNT(*) FROM article_comments c WHERE c.article_id = a.id AND c.status = 'published') as comment_count
       FROM articles a
       WHERE a.is_published = 1
       ORDER BY a.published_at DESC, a.id DESC`
    )
    .all();
  res.json({ articles });
});

app.get('/api/public/articles/:slug', (req, res) => {
  const article = db
    .prepare(
      `SELECT a.*,
        (SELECT COUNT(*) FROM article_comments c WHERE c.article_id = a.id AND c.status = 'published') as comment_count
       FROM articles a
       WHERE a.slug = ? AND a.is_published = 1`
    )
    .get(req.params.slug);
  if (!article) {
    res.status(404).json({ error: 'Artikel tidak ditemukan.' });
    return;
  }
  res.json({ article });
});

app.get('/api/public/articles/:id/comments', (req, res) => {
  const articleId = Number(req.params.id);
  const comments = db
    .prepare(
      `SELECT id, article_id, author_name, author_region, comment_text, admin_reply, status, created_at
       FROM article_comments
       WHERE article_id = ? AND status = 'published'
       ORDER BY created_at DESC, id DESC`
    )
    .all(articleId);
  res.json({ comments });
});

app.post('/api/public/articles/:id/comments', (req, res) => {
  const articleId = Number(req.params.id);
  const exists = db
    .prepare('SELECT id FROM articles WHERE id = ? AND is_published = 1')
    .get(articleId);
  if (!exists) {
    res.status(404).json({ error: 'Artikel tidak ditemukan.' });
    return;
  }

  const authorName = String(req.body?.author_name || '').trim().slice(0, 80);
  const authorRegion = String(req.body?.author_region || '').trim().slice(0, 80);
  const commentText = String(req.body?.comment_text || '').trim().slice(0, 1000);

  if (!authorName || commentText.length < 3) {
    res.status(400).json({ error: 'Nama warga dan komentar (minimal 3 karakter) wajib diisi.' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO article_comments (article_id, author_name, author_region, comment_text, status)
       VALUES (?, ?, ?, ?, 'published')`
    )
    .run(articleId, authorName, authorRegion, commentText);

  const comment = db
    .prepare(
      `SELECT id, article_id, author_name, author_region, comment_text, admin_reply, status, created_at
       FROM article_comments WHERE id = ?`
    )
    .get(result.lastInsertRowid);

  res.status(201).json({ comment });
});

app.get('/api/public/umkm', (_req, res) => {
  const products = db
    .prepare('SELECT * FROM umkm_products WHERE is_verified = 1 ORDER BY id DESC')
    .all();
  res.json({ products });
});

app.get('/api/public/gallery', (_req, res) => {
  const items = db.prepare('SELECT * FROM gallery_items ORDER BY event_date DESC, id DESC').all();
  res.json({ items });
});

app.get('/api/public/map', (_req, res) => {
  const settings = db.prepare('SELECT * FROM village_settings WHERE id = 1').get();
  const locations = db.prepare('SELECT * FROM map_locations ORDER BY id ASC').all();
  const regions = db
    .prepare(
      'SELECT * FROM regions WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY dusun ASC, rw ASC, rt ASC'
    )
    .all();
  const developments = db
    .prepare(
      'SELECT * FROM village_developments WHERE is_published = 1 AND latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY fiscal_year DESC, id DESC'
    )
    .all();
  res.json({ settings, locations, regions, developments });
});

interface NominatimCacheEntry {
  ts: number;
  results: Array<{
    place_id: number;
    display_name: string;
    short_name: string;
    type: string;
    lat: number;
    lng: number;
  }>;
}

const mapGeocodeCache = new Map<string, NominatimCacheEntry>();

app.get('/api/public/map/geocode', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    res.status(400).json({ error: 'Masukkan minimal 2 karakter nama tempat atau alamat.' });
    return;
  }
  if (q.length > 120) {
    res.status(400).json({ error: 'Kata kunci pencarian alamat terlalu panjang.' });
    return;
  }

  const cacheKey = q.toLowerCase();
  const cached = mapGeocodeCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.ts < 10 * 60 * 1000) {
    res.json({ results: cached.results, cached: true });
    return;
  }

  try {
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
    nominatimUrl.searchParams.set('format', 'jsonv2');
    nominatimUrl.searchParams.set('q', q);
    nominatimUrl.searchParams.set('countrycodes', 'id');
    nominatimUrl.searchParams.set('addressdetails', '1');
    nominatimUrl.searchParams.set('limit', '6');
    // Bias pencarian sekitar Sumedang Utara & Kabupaten Sumedang
    nominatimUrl.searchParams.set('viewbox', '107.75,-6.95,108.05,-6.72');
    nominatimUrl.searchParams.set('bounded', '0');

    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        'User-Agent': 'PortalDesaMargamukti/1.0 (+https://margamukti-sumedang.desa.id)',
        'Accept-Language': 'id,en;q=0.8',
      },
      signal: AbortSignal.timeout(7000),
    });

    if (!response.ok) {
      res.status(502).json({
        error: `Layanan pencarian alamat OpenStreetMap merespons status ${response.status}. Silakan coba beberapa saat lagi.`,
      });
      return;
    }

    const raw = (await response.json()) as Array<{
      place_id: number;
      display_name: string;
      name?: string;
      type?: string;
      lat: string;
      lon: string;
    }>;

    const results = (Array.isArray(raw) ? raw : [])
      .map((item) => {
        const lat = Number(item.lat);
        const lng = Number(item.lon);
        const shortName = (item.name || item.display_name.split(',')[0] || q).trim();
        return {
          place_id: Number(item.place_id),
          display_name: String(item.display_name || shortName),
          short_name: shortName,
          type: String(item.type || 'lokasi'),
          lat,
          lng,
        };
      })
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));

    if (mapGeocodeCache.size >= 100) {
      const oldestKey = mapGeocodeCache.keys().next().value;
      if (oldestKey) mapGeocodeCache.delete(oldestKey);
    }
    mapGeocodeCache.set(cacheKey, { ts: now, results });

    res.json({ results });
  } catch (err) {
    console.error('[Map Geocode Error]', err);
    res.status(502).json({
      error: 'Gagal terhubung ke layanan pencarian alamat OpenStreetMap. Periksa koneksi server.',
    });
  }
});

app.post('/api/public/complaints', (req, res) => {
  const { sender_name, sender_contact, category, subject, message } = req.body || {};
  if (!sender_name || !sender_contact || !subject || !message) {
    res.status(400).json({ error: 'Nama, kontak, subjek, dan isi pesan wajib diisi.' });
    return;
  }
  const result = db
    .prepare(
      'INSERT INTO complaints (sender_name, sender_contact, category, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      String(sender_name).trim(),
      String(sender_contact).trim(),
      String(category || 'Pengaduan').trim(),
      String(subject).trim(),
      String(message).trim(),
      'baru'
    );
  res.status(201).json({ id: result.lastInsertRowid, ok: true });
});

app.get('/api/public/early-warning', async (_req, res) => {
  const settings = db
    .prepare('SELECT village_code, whatsapp, phone, map_center_lat, map_center_lng FROM village_settings WHERE id = 1')
    .get() as
    | {
        village_code: string;
        whatsapp: string;
        phone: string;
        map_center_lat: number;
        map_center_lng: number;
      }
    | undefined;

  const warnings = db
    .prepare(
      `SELECT * FROM early_warnings
       WHERE is_active = 1
       ORDER BY
         CASE severity
           WHEN 'darurat' THEN 0
           WHEN 'siaga' THEN 1
           WHEN 'waspada' THEN 2
           ELSE 3
         END ASC,
         updated_at DESC,
         id DESC`
    )
    .all();

  const bmkg = await fetchBmkgLiveData(settings?.village_code || '32.11.18.2008');

  res.json({
    warnings,
    bmkg,
    emergencyContact: settings?.whatsapp || settings?.phone || '',
    mapCenter: {
      lat: settings?.map_center_lat ?? -6.8283,
      lng: settings?.map_center_lng ?? 107.9,
    },
  });
});

app.post('/api/public/emergency-reports', (req, res) => {
  const b = req.body || {};
  const senderName = String(b.sender_name || '').trim().slice(0, 100);
  const senderContact = String(b.sender_contact || '').trim().slice(0, 60);
  const incidentType = String(b.incident_type || '').trim().slice(0, 100);
  const locationLandmark = String(b.location_landmark || '').trim().slice(0, 160);
  const description = String(b.description || '').trim().slice(0, 1000);
  const lat = Number(b.latitude);
  const lng = Number(b.longitude);

  if (!senderName || !senderContact || !incidentType || !description) {
    res.status(400).json({
      error: 'Nama pelapor, kontak, jenis insiden, dan deskripsi singkat wajib diisi.',
    });
    return;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({
      error: 'Titik lokasi GPS (latitude & longitude) wajib dipilih atau diambil otomatis.',
    });
    return;
  }

  const finalMessage = locationLandmark
    ? `[Patokan Lokasi: ${locationLandmark}] ${description}`
    : description;

  const result = db
    .prepare(
      `INSERT INTO complaints (sender_name, sender_contact, category, subject, message, status, is_emergency, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, 'baru', 1, ?, ?)`
    )
    .run(
      senderName,
      senderContact,
      `Darurat: ${incidentType}`,
      `[DARURAT] ${incidentType}`,
      finalMessage,
      Number(lat.toFixed(6)),
      Number(lng.toFixed(6))
    );

  const reportId = Number(result.lastInsertRowid);
  res.status(201).json({
    ok: true,
    id: reportId,
    reportCode: `DRT-${String(reportId).padStart(4, '0')}`,
  });
});

// ============================================================================
// ADMIN PROTECTED ROUTES (/api/admin/*)
// ============================================================================

app.get('/api/admin/dashboard', requireAdmin, requirePermission('overview'), (_req, res) => {
  const population = getPopulationStats();
  const pendingLetters = (db.prepare("SELECT COUNT(*) as c FROM letter_requests WHERE status = 'pending'").get() as { c: number }).c;
  const approvedLetters = (db.prepare("SELECT COUNT(*) as c FROM letter_requests WHERE status = 'approved'").get() as { c: number }).c;
  const totalUmkm = (db.prepare('SELECT COUNT(*) as c FROM umkm_products').get() as { c: number }).c;
  const totalArticles = (db.prepare('SELECT COUNT(*) as c FROM articles').get() as { c: number }).c;
  const unreadComplaints = (db.prepare("SELECT COUNT(*) as c FROM complaints WHERE status = 'baru'").get() as { c: number }).c;

  const recentRequests = db
    .prepare(
      `SELECT lr.*, lt.name as template_name, lt.code as template_code
       FROM letter_requests lr
       JOIN letter_templates lt ON lr.template_id = lt.id
       ORDER BY lr.created_at DESC, lr.id DESC LIMIT 6`
    )
    .all();

  const recentComplaints = db
    .prepare('SELECT * FROM complaints ORDER BY created_at DESC, id DESC LIMIT 5')
    .all();

  res.json({
    population,
    counts: {
      pendingLetters,
      approvedLetters,
      totalUmkm,
      totalArticles,
      unreadComplaints,
    },
    recentRequests,
    recentComplaints,
  });
});

// Image upload endpoint (stores uploaded base64 image file locally into /uploads)
app.post('/api/admin/upload', requireAdmin, (req, res) => {
  const { dataUrl, filename } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    res.status(400).json({ error: 'Format gambar tidak valid.' });
    return;
  }
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'Ekstensi gambar harus PNG, JPG, atau WEBP.' });
    return;
  }
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const safeBase = slugify(String(filename || 'media')).slice(0, 32) || 'media';
  const finalName = `${safeBase}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(match[2], 'base64');
  fs.writeFileSync(path.join(uploadsDir, finalName), buffer);
  res.json({ url: `/uploads/${finalName}` });
});

const MAX_UPLOAD_VIDEO_BYTES = 10 * 1024 * 1024; // 10 MB

// Unified article media upload (images & videos max 10MB)
app.post('/api/admin/upload-media', requireAdmin, (req, res) => {
  const { dataUrl, filename } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string') {
    res.status(400).json({ error: 'Data media tidak valid.' });
    return;
  }
  const match = dataUrl.match(/^data:(image|video)\/([a-zA-Z0-9.+-]+)(?:;[^,]*)?;base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'Format berkas harus berupa gambar atau video yang didukung.' });
    return;
  }

  const mediaType = match[1] as 'image' | 'video';
  const subtype = match[2].toLowerCase();
  const base64Payload = match[3];

  let ext = '';
  if (mediaType === 'image') {
    if (!['png', 'jpeg', 'jpg', 'webp'].includes(subtype)) {
      res.status(400).json({ error: 'Ekstensi gambar harus PNG, JPG, atau WEBP.' });
      return;
    }
    ext = subtype === 'jpeg' ? 'jpg' : subtype;
  } else {
    if (!['mp4', 'webm', 'ogg', 'quicktime'].includes(subtype)) {
      res.status(400).json({ error: 'Ekstensi video harus MP4, WEBM, OGG, atau MOV.' });
      return;
    }
    ext = subtype === 'quicktime' ? 'mov' : subtype;
  }

  const buffer = Buffer.from(base64Payload, 'base64');
  if (mediaType === 'video' && buffer.length > MAX_UPLOAD_VIDEO_BYTES) {
    res.status(400).json({
      error: `Ukuran video melebihi batas maksimal 10 MB (${(buffer.length / (1024 * 1024)).toFixed(1)} MB).`,
    });
    return;
  }

  const safeBase = slugify(String(filename || 'media')).slice(0, 32) || 'media';
  const finalName = `${safeBase}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, finalName), buffer);
  res.json({ url: `/uploads/${finalName}`, mediaType, sizeBytes: buffer.length });
});

// Settings (also accessible to surat admins for Kop Surat configuration)
app.get('/api/admin/settings', requireAdmin, requireAnyPermission('pengaturan', 'surat'), (_req, res) => {
  const settings = db.prepare('SELECT * FROM village_settings WHERE id = 1').get();
  res.json({ settings });
});

app.put('/api/admin/settings', requireAdmin, requireAnyPermission('pengaturan', 'surat'), (req, res) => {
  const b = req.body || {};
  db.prepare(`
    UPDATE village_settings SET
      village_name = ?, district_name = ?, regency_name = ?, province_name = ?,
      postal_code = ?, village_code = ?, office_address = ?, phone = ?, whatsapp = ?,
      facebook_url = ?, instagram_url = ?,
      email = ?, service_hours = ?, hero_title = ?, hero_subtitle = ?, hero_image = ?,
      vision = ?, mission = ?, history = ?, head_name = ?, head_nip = ?,
      kop_line1 = ?, kop_line2 = ?, kop_line3 = ?, kop_address = ?,
      map_center_lat = ?, map_center_lng = ?, updated_at = datetime('now')
    WHERE id = 1
  `).run(
    b.village_name,
    b.district_name,
    b.regency_name,
    b.province_name,
    b.postal_code,
    b.village_code,
    b.office_address,
    b.phone,
    b.whatsapp,
    String(b.facebook_url || '').trim(),
    String(b.instagram_url || '').trim(),
    b.email,
    b.service_hours,
    b.hero_title,
    b.hero_subtitle,
    b.hero_image,
    b.vision,
    b.mission,
    b.history,
    b.head_name,
    b.head_nip,
    b.kop_line1,
    b.kop_line2,
    b.kop_line3,
    b.kop_address,
    Number(b.map_center_lat || -6.8283),
    Number(b.map_center_lng || 107.9000)
  );
  const settings = db.prepare('SELECT * FROM village_settings WHERE id = 1').get();
  res.json({ settings });
});

// Village Agenda / Events (Running Text) CRUD
app.get('/api/admin/events', requireAdmin, requirePermission('agenda'), (_req, res) => {
  const events = db.prepare('SELECT * FROM village_events ORDER BY sort_order ASC, id ASC').all();
  res.json({ events });
});

app.post('/api/admin/events', requireAdmin, requirePermission('agenda'), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.event_time || !b.location) {
    res.status(400).json({ error: 'Nama acara, waktu, dan tempat wajib diisi.' });
    return;
  }
  const result = db
    .prepare('INSERT INTO village_events (title, event_time, location, is_active, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(
      String(b.title).trim(),
      String(b.event_time).trim(),
      String(b.location).trim(),
      b.is_active === false || b.is_active === 0 ? 0 : 1,
      Number(b.sort_order || 1)
    );
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/admin/events/:id', requireAdmin, requirePermission('agenda'), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.event_time || !b.location) {
    res.status(400).json({ error: 'Nama acara, waktu, dan tempat wajib diisi.' });
    return;
  }
  db.prepare('UPDATE village_events SET title = ?, event_time = ?, location = ?, is_active = ?, sort_order = ? WHERE id = ?')
    .run(
      String(b.title).trim(),
      String(b.event_time).trim(),
      String(b.location).trim(),
      b.is_active === false || b.is_active === 0 ? 0 : 1,
      Number(b.sort_order || 1),
      Number(req.params.id)
    );
  res.json({ ok: true });
});

app.patch('/api/admin/events/:id/toggle', requireAdmin, requirePermission('agenda'), (req, res) => {
  const existing = db.prepare('SELECT id, is_active FROM village_events WHERE id = ?').get(Number(req.params.id)) as
    | { id: number; is_active: number }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Agenda tidak ditemukan.' });
    return;
  }
  const nextActive = existing.is_active === 1 ? 0 : 1;
  db.prepare('UPDATE village_events SET is_active = ? WHERE id = ?').run(nextActive, existing.id);
  res.json({ ok: true, is_active: nextActive });
});

app.delete('/api/admin/events/:id', requireAdmin, requirePermission('agenda'), (req, res) => {
  db.prepare('DELETE FROM village_events WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Officials CRUD + Reorder + Digital Signature (TTE)
app.get('/api/admin/officials', requireAdmin, requirePermission('perangkat'), (_req, res) => {
  res.json({ officials: db.prepare('SELECT * FROM officials ORDER BY sort_order ASC, id ASC').all() });
});

app.post('/api/admin/officials', requireAdmin, requirePermission('perangkat'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.position) {
    res.status(400).json({ error: 'Nama dan jabatan wajib diisi.' });
    return;
  }
  const canSign = b.can_sign_letters ? 1 : 0;
  const result = db
    .prepare('INSERT INTO officials (name, position, nip, sort_order, photo_url, phone, bio, can_sign_letters) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(b.name, b.position, b.nip || '-', Number(b.sort_order || 1), b.photo_url || '', b.phone || '', b.bio || '', canSign);
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/admin/officials/:id', requireAdmin, requirePermission('perangkat'), (req, res) => {
  const b = req.body || {};
  const canSign = b.can_sign_letters !== undefined ? (b.can_sign_letters ? 1 : 0) : 0;
  db.prepare('UPDATE officials SET name = ?, position = ?, nip = ?, sort_order = ?, photo_url = ?, phone = ?, bio = ?, can_sign_letters = ? WHERE id = ?')
    .run(b.name, b.position, b.nip || '-', Number(b.sort_order || 1), b.photo_url || '', b.phone || '', b.bio || '', canSign, Number(req.params.id));
  res.json({ ok: true });
});

app.patch('/api/admin/officials/reorder', requireAdmin, requirePermission('perangkat'), (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const stmt = db.prepare('UPDATE officials SET sort_order = ? WHERE id = ?');
  const tx = db.transaction((list: Array<{ id: number; sort_order: number }>) => {
    for (const item of list) {
      stmt.run(Number(item.sort_order), Number(item.id));
    }
  });
  tx(items);
  res.json({ ok: true });
});

app.post('/api/admin/officials/:id/tte/request', requireAdmin, requirePermission('perangkat'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id, tte_status FROM officials WHERE id = ?').get(id) as
    | { id: number; tte_status: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Perangkat desa tidak ditemukan.' });
    return;
  }
  db.prepare(
    "UPDATE officials SET tte_status = 'pending', tte_approved_by = '', tte_approved_at = NULL, can_sign_letters = 1 WHERE id = ?"
  ).run(id);
  res.json({ ok: true, tte_status: 'pending' });
});

app.patch('/api/admin/officials/:id/tte/verify', requireAdmin, requireSuperAdmin, (req, res) => {
  const id = Number(req.params.id);
  const action = String(req.body?.action || '').trim().toLowerCase();
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({ error: 'Sesi admin tidak valid.' });
    return;
  }
  const existing = db.prepare('SELECT id, position FROM officials WHERE id = ?').get(id) as
    | { id: number; position: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Perangkat desa tidak ditemukan.' });
    return;
  }
  if (action !== 'approve' && action !== 'revoke') {
    res.status(400).json({ error: 'Aksi verifikasi TTE harus approve atau revoke.' });
    return;
  }

  const nowIso = new Date().toISOString();
  if (action === 'approve') {
    const tag = Math.random().toString(36).slice(2, 6).toUpperCase();
    const tteCode = `TTE-MGM-${String(id).padStart(2, '0')}-${tag}`;
    db.prepare(
      "UPDATE officials SET tte_status = 'approved', tte_code = ?, tte_approved_by = ?, tte_approved_at = ?, can_sign_letters = 1 WHERE id = ?"
    ).run(tteCode, user.fullName, nowIso, id);
    res.json({ ok: true, tte_status: 'approved', tte_code: tteCode, tte_approved_by: user.fullName, tte_approved_at: nowIso });
    return;
  }

  db.prepare(
    "UPDATE officials SET tte_status = 'revoked', tte_code = '', tte_approved_by = ?, tte_approved_at = ? WHERE id = ?"
  ).run(user.fullName, nowIso, id);
  res.json({ ok: true, tte_status: 'revoked' });
});

app.delete('/api/admin/officials/:id', requireAdmin, requirePermission('perangkat'), (req, res) => {
  db.prepare('DELETE FROM officials WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Lembaga Desa (BPD, BUMDesa, LPM, PKK) Admin CRUD
app.get('/api/admin/institutions', requireAdmin, requirePermission('lembaga'), (_req, res) => {
  const raw = db.prepare('SELECT * FROM village_institutions ORDER BY id ASC').all() as Array<Record<string, unknown>>;
  const memberStmt = db.prepare('SELECT * FROM institution_members WHERE institution_id = ? ORDER BY sort_order ASC, id ASC');
  const institutions = raw.map((inst) => {
    let tupoksi: string[] = [];
    try {
      const parsed = JSON.parse(String(inst.tupoksi || '[]'));
      if (Array.isArray(parsed)) tupoksi = parsed.map((x) => String(x));
    } catch {
      tupoksi = [];
    }
    return {
      ...inst,
      tupoksi,
      members: memberStmt.all(Number(inst.id)),
    };
  });
  res.json({ institutions });
});

app.put('/api/admin/institutions/:slug', requireAdmin, requirePermission('lembaga'), (req, res) => {
  const slug = String(req.params.slug || '').trim().toLowerCase();
  const b = (req.body || {}) as Record<string, unknown>;
  const existing = db.prepare('SELECT id FROM village_institutions WHERE slug = ?').get(slug) as { id: number } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Lembaga desa tidak ditemukan.' });
    return;
  }
  const tupoksiArr = Array.isArray(b.tupoksi)
    ? b.tupoksi.map((x) => String(x).trim()).filter(Boolean)
    : [];
  db.prepare(`
    UPDATE village_institutions
    SET name = ?, short_name = ?, tagline = ?, legal_basis = ?, description = ?, tupoksi = ?, office_location = ?, contact_phone = ?, updated_at = datetime('now')
    WHERE slug = ?
  `).run(
    String(b.name || '').trim(),
    String(b.short_name || '').trim(),
    String(b.tagline || '').trim(),
    String(b.legal_basis || '').trim(),
    String(b.description || '').trim(),
    JSON.stringify(tupoksiArr),
    String(b.office_location || '').trim(),
    String(b.contact_phone || '').trim(),
    slug
  );
  res.json({ ok: true });
});

app.post('/api/admin/institution-members', requireAdmin, requirePermission('lembaga'), (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const instId = Number(b.institution_id);
  const name = String(b.name || '').trim();
  const position = String(b.position || '').trim();
  if (!instId || !name || !position) {
    res.status(400).json({ error: 'Lembaga, nama pengurus, dan jabatan wajib diisi.' });
    return;
  }
  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM institution_members WHERE institution_id = ?')
    .get(instId) as { maxOrder: number };
  const sortOrder = b.sort_order ? Number(b.sort_order) : maxOrder.maxOrder + 1;
  const result = db
    .prepare('INSERT INTO institution_members (institution_id, name, position, phone, sort_order, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run(instId, name, position, String(b.phone || '').trim(), sortOrder, String(b.notes || '').trim());
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/admin/institution-members/:id', requireAdmin, requirePermission('lembaga'), (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const name = String(b.name || '').trim();
  const position = String(b.position || '').trim();
  if (!name || !position) {
    res.status(400).json({ error: 'Nama pengurus dan jabatan wajib diisi.' });
    return;
  }
  db.prepare('UPDATE institution_members SET name = ?, position = ?, phone = ?, sort_order = ?, notes = ? WHERE id = ?').run(
    name,
    position,
    String(b.phone || '').trim(),
    Number(b.sort_order || 1),
    String(b.notes || '').trim(),
    Number(req.params.id)
  );
  res.json({ ok: true });
});

app.delete('/api/admin/institution-members/:id', requireAdmin, requirePermission('lembaga'), (req, res) => {
  db.prepare('DELETE FROM institution_members WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Regions CRUD (read allowed for 'wilayah' or 'penduduk'; filtered to scope for ketua_rt / ketua_rw)
app.get('/api/admin/regions', requireAdmin, requireAnyPermission('wilayah', 'penduduk'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const scope = getUserRegionScopeClause(user, 'regions');
  const sql = scope.sql
    ? `SELECT * FROM regions WHERE ${scope.sql} ORDER BY dusun ASC, rw ASC, rt ASC`
    : 'SELECT * FROM regions ORDER BY dusun ASC, rw ASC, rt ASC';
  res.json({ regions: db.prepare(sql).all(...scope.params) });
});

function parseOptionalCoord(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

app.post('/api/admin/regions', requireAdmin, requirePermission('wilayah'), (req, res) => {
  const b = req.body || {};
  if (!b.dusun || !b.blok || !b.rw || !b.rt) {
    res.status(400).json({ error: 'Dusun, Blok, RW, dan RT wajib diisi.' });
    return;
  }
  const lat = parseOptionalCoord(b.latitude);
  const lng = parseOptionalCoord(b.longitude);
  if ((lat === null) !== (lng === null)) {
    res.status(400).json({ error: 'Koordinat Latitude dan Longitude harus diisi berpasangan atau dikosongkan keduanya.' });
    return;
  }
  const dusun = String(b.dusun).trim();
  const kepalaDusun = String(b.kepala_dusun || '-').trim();
  const kepalaDusunPhone = cleanPhoneInput(b.kepala_dusun_phone);
  const blok = String(b.blok).trim();
  const rw = String(b.rw).trim();
  const rt = String(b.rt).trim();
  const ketuaRw = String(b.ketua_rw || '-').trim();
  const ketuaRwPhone = cleanPhoneInput(b.ketua_rw_phone);
  const ketuaRt = String(b.ketua_rt || '-').trim();
  const ketuaRtPhone = cleanPhoneInput(b.ketua_rt_phone);

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        'INSERT INTO regions (dusun, kepala_dusun, kepala_dusun_phone, blok, rw, rt, ketua_rw, ketua_rw_phone, ketua_rt, ketua_rt_phone, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        dusun,
        kepalaDusun,
        kepalaDusunPhone,
        blok,
        rw,
        rt,
        ketuaRw,
        ketuaRwPhone,
        ketuaRt,
        ketuaRtPhone,
        lat,
        lng
      );

    if (kepalaDusunPhone) {
      db.prepare(
        'UPDATE regions SET kepala_dusun_phone = ? WHERE LOWER(TRIM(dusun)) = LOWER(TRIM(?))'
      ).run(kepalaDusunPhone, dusun);
    }
    if (ketuaRwPhone) {
      db.prepare(
        'UPDATE regions SET ketua_rw_phone = ? WHERE LOWER(TRIM(dusun)) = LOWER(TRIM(?)) AND TRIM(rw) = TRIM(?)'
      ).run(ketuaRwPhone, dusun, rw);
    }
    return result.lastInsertRowid;
  });

  const newId = tx();
  res.status(201).json({ id: newId });
});

app.put('/api/admin/regions/:id', requireAdmin, requirePermission('wilayah'), (req, res) => {
  const b = req.body || {};
  if (!b.dusun || !b.blok || !b.rw || !b.rt) {
    res.status(400).json({ error: 'Dusun, Blok, RW, dan RT wajib diisi.' });
    return;
  }
  const lat = parseOptionalCoord(b.latitude);
  const lng = parseOptionalCoord(b.longitude);
  if ((lat === null) !== (lng === null)) {
    res.status(400).json({ error: 'Koordinat Latitude dan Longitude harus diisi berpasangan atau dikosongkan keduanya.' });
    return;
  }
  const id = Number(req.params.id);
  const dusun = String(b.dusun).trim();
  const kepalaDusun = String(b.kepala_dusun || '-').trim();
  const kepalaDusunPhone = cleanPhoneInput(b.kepala_dusun_phone);
  const blok = String(b.blok).trim();
  const rw = String(b.rw).trim();
  const rt = String(b.rt).trim();
  const ketuaRw = String(b.ketua_rw || '-').trim();
  const ketuaRwPhone = cleanPhoneInput(b.ketua_rw_phone);
  const ketuaRt = String(b.ketua_rt || '-').trim();
  const ketuaRtPhone = cleanPhoneInput(b.ketua_rt_phone);

  db.transaction(() => {
    db.prepare(
      'UPDATE regions SET dusun = ?, kepala_dusun = ?, kepala_dusun_phone = ?, blok = ?, rw = ?, rt = ?, ketua_rw = ?, ketua_rw_phone = ?, ketua_rt = ?, ketua_rt_phone = ?, latitude = ?, longitude = ? WHERE id = ?'
    ).run(
      dusun,
      kepalaDusun,
      kepalaDusunPhone,
      blok,
      rw,
      rt,
      ketuaRw,
      ketuaRwPhone,
      ketuaRt,
      ketuaRtPhone,
      lat,
      lng,
      id
    );

    if (kepalaDusunPhone) {
      db.prepare(
        'UPDATE regions SET kepala_dusun_phone = ? WHERE LOWER(TRIM(dusun)) = LOWER(TRIM(?))'
      ).run(kepalaDusunPhone, dusun);
    }
    if (ketuaRwPhone) {
      db.prepare(
        'UPDATE regions SET ketua_rw_phone = ? WHERE LOWER(TRIM(dusun)) = LOWER(TRIM(?)) AND TRIM(rw) = TRIM(?)'
      ).run(ketuaRwPhone, dusun, rw);
    }
  })();
  res.json({ ok: true });
});

app.delete('/api/admin/regions/:id', requireAdmin, requirePermission('wilayah'), (req, res) => {
  db.prepare('DELETE FROM regions WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Residents CRUD + CSV & Excel (.xlsx) Export / Upsert Import
app.get('/api/admin/residents', requireAdmin, requirePermission('penduduk'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const scope = getUserRegionScopeClause(user, 'rg');
  const whereClause = scope.sql ? `WHERE ${scope.sql}` : '';
  const residents = db
    .prepare(
      `SELECT r.*, rg.dusun, rg.blok, rg.rw, rg.rt
       FROM residents r
       LEFT JOIN regions rg ON r.region_id = rg.id
       ${whereClause}
       ORDER BY r.id DESC`
    )
    .all(...scope.params);
  res.json({ residents });
});

function formatActorScope(user: AuthPayload | undefined): string {
  if (!user) return '';
  if (user.role === 'ketua_rt') {
    return `Ketua RT ${user.scopeRt || '-'} / RW ${user.scopeRw || '-'} · ${user.scopeDusun || '-'}`;
  }
  if (user.role === 'ketua_rw') {
    return `Ketua RW ${user.scopeRw || '-'} · ${user.scopeDusun || '-'}`;
  }
  return user.role;
}

function formatRegionLabel(region?: { dusun: string; rw: string; rt: string } | null): string {
  if (!region) return '-';
  return `RT ${region.rt} / RW ${region.rw} · ${region.dusun}`;
}

app.post('/api/admin/residents', requireAdmin, requirePermission('penduduk'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const b = req.body || {};
  if (!b.nik || !b.no_kk || !b.full_name) {
    res.status(400).json({ error: 'NIK, No. KK, dan Nama Lengkap wajib diisi.' });
    return;
  }

  const targetRegionId = b.region_id ? Number(b.region_id) : null;
  let targetRegion: { id: number; dusun: string; rw: string; rt: string } | undefined;
  if (targetRegionId) {
    targetRegion = db
      .prepare('SELECT id, dusun, rw, rt FROM regions WHERE id = ?')
      .get(targetRegionId) as { id: number; dusun: string; rw: string; rt: string } | undefined;
    if (!targetRegion) {
      res.status(400).json({ error: 'Wilayah RT/RW yang dipilih tidak ditemukan.' });
      return;
    }
  }

  const isRtRw = isRtRwRole(user?.role);
  if (isRtRw) {
    if (!targetRegion || !isRegionAllowedForUser(user, targetRegion)) {
      res.status(403).json({
        error: 'Akses ditolak. Ketua RT/RW hanya dapat menambah data warga di wilayah RT/RW yang dikepalainya.',
      });
      return;
    }
  }

  const status = normalizeResidentStatus(b.resident_status);
  const mutationDate =
    String(b.mutation_date || '').trim() ||
    (status !== 'aktif' ? new Date().toISOString().slice(0, 10) : '');
  const mutationNotes = String(b.mutation_notes || '').trim();
  const familyRelationship = String(b.family_relationship || 'Kepala keluarga').trim() || 'Kepala keluarga';
  const fatherName = String(b.father_name || '').trim();
  const motherName = String(b.mother_name || '').trim();
  const education = String(b.education || 'SLTA/Sederajat').trim() || 'SLTA/Sederajat';
  const physicalDisability = String(b.physical_disability || 'Tidak Ada').trim() || 'Tidak Ada';
  const verificationStatus = isRtRw ? 'pending' : 'verified';

  try {
    const newId = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO residents (
             nik, no_kk, full_name, birth_place, birth_date, gender, address, region_id,
             religion, occupation, marital_status,
             family_relationship, father_name, mother_name, education, physical_disability,
             resident_status, mutation_date, mutation_notes,
             death_time, death_day, death_cause, death_location, death_reporter_name, death_reporter_nik,
             verification_status, verification_note
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')`
        )
        .run(
          String(b.nik).trim(),
          String(b.no_kk).trim(),
          String(b.full_name).trim(),
          b.birth_place || 'Sumedang',
          b.birth_date || '1990-01-01',
          b.gender || 'Laki-laki',
          b.address || '',
          targetRegionId,
          b.religion || 'Islam',
          b.occupation || '-',
          b.marital_status || 'Belum Kawin',
          familyRelationship,
          fatherName,
          motherName,
          education,
          physicalDisability,
          status,
          mutationDate,
          mutationNotes,
          String(b.death_time || '').trim(),
          String(b.death_day || '').trim(),
          String(b.death_cause || '').trim(),
          String(b.death_location || '').trim(),
          String(b.death_reporter_name || '').trim(),
          String(b.death_reporter_nik || '').trim(),
          verificationStatus
        );

      const residentId = Number(result.lastInsertRowid);
      if (isRtRw && user) {
        db.prepare(
          `INSERT INTO resident_mutation_logs (
             resident_id, resident_nik, resident_name, region_label, action_type,
             prev_status, prev_mutation_date, prev_mutation_notes,
             new_status, new_mutation_date, new_mutation_notes,
             actor_user_id, actor_name, actor_role, actor_scope, verification_status
           ) VALUES (?, ?, ?, ?, 'create', '', '', '', ?, ?, ?, ?, ?, ?, ?, 'pending')`
        ).run(
          residentId,
          String(b.nik).trim(),
          String(b.full_name).trim(),
          formatRegionLabel(targetRegion),
          status,
          mutationDate,
          mutationNotes,
          user.id,
          user.fullName,
          user.role,
          formatActorScope(user)
        );
      }
      return residentId;
    })();

    res.status(201).json({ id: newId });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan data penduduk (kemungkinan NIK duplikat).' });
  }
});

app.put('/api/admin/residents/:id', requireAdmin, requirePermission('penduduk'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const residentId = Number(req.params.id);
  const existing = db
    .prepare(
      `SELECT r.id, r.nik, r.full_name, r.region_id, r.resident_status, r.mutation_date, r.mutation_notes,
              r.verification_status, r.verification_note, rg.dusun, rg.rw, rg.rt
       FROM residents r
       LEFT JOIN regions rg ON r.region_id = rg.id
       WHERE r.id = ?`
    )
    .get(residentId) as
    | {
        id: number;
        nik: string;
        full_name: string;
        region_id: number | null;
        resident_status: string;
        mutation_date: string;
        mutation_notes: string;
        verification_status: string;
        verification_note: string;
        dusun: string | null;
        rw: string | null;
        rt: string | null;
      }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Data penduduk tidak ditemukan.' });
    return;
  }

  const b = req.body || {};
  const targetRegionId = b.region_id ? Number(b.region_id) : null;
  let targetRegion: { id: number; dusun: string; rw: string; rt: string } | undefined;
  if (targetRegionId) {
    targetRegion = db
      .prepare('SELECT id, dusun, rw, rt FROM regions WHERE id = ?')
      .get(targetRegionId) as { id: number; dusun: string; rw: string; rt: string } | undefined;
    if (!targetRegion) {
      res.status(400).json({ error: 'Wilayah RT/RW yang dipilih tidak ditemukan.' });
      return;
    }
  }

  const isRtRw = isRtRwRole(user?.role);
  if (isRtRw) {
    const existingRegion =
      existing.dusun && existing.rw && existing.rt
        ? { dusun: existing.dusun, rw: existing.rw, rt: existing.rt }
        : null;
    if (!isRegionAllowedForUser(user, existingRegion)) {
      res.status(403).json({
        error: 'Akses ditolak. Anda tidak memiliki wewenang mengedit data penduduk di luar wilayah RT/RW Anda.',
      });
      return;
    }
    if (!targetRegion || !isRegionAllowedForUser(user, targetRegion)) {
      res.status(403).json({
        error: 'Akses ditolak. Wilayah tujuan harus tetap berada di dalam cakupan RT/RW Anda.',
      });
      return;
    }
  }

  const status = normalizeResidentStatus(b.resident_status);
  const mutationDate =
    String(b.mutation_date || '').trim() ||
    (status !== 'aktif' ? new Date().toISOString().slice(0, 10) : '');
  const mutationNotes = String(b.mutation_notes || '').trim();
  const familyRelationship = String(b.family_relationship || 'Kepala keluarga').trim() || 'Kepala keluarga';
  const fatherName = String(b.father_name || '').trim();
  const motherName = String(b.mother_name || '').trim();
  const education = String(b.education || 'SLTA/Sederajat').trim() || 'SLTA/Sederajat';
  const physicalDisability = String(b.physical_disability || 'Tidak Ada').trim() || 'Tidak Ada';

  const existingStatus = normalizeResidentStatus(existing.resident_status);
  const existingMutDate = String(existing.mutation_date || '').trim();
  const existingMutNotes = String(existing.mutation_notes || '').trim();
  const mutationChanged =
    status !== existingStatus ||
    mutationDate !== existingMutDate ||
    mutationNotes !== existingMutNotes ||
    existing.verification_status === 'rejected';

  const nextVerificationStatus = isRtRw
    ? mutationChanged
      ? 'pending'
      : existing.verification_status || 'verified'
    : 'verified';
  const nextVerificationNote = isRtRw
    ? mutationChanged
      ? ''
      : existing.verification_note || ''
    : '';

  try {
    db.transaction(() => {
      db.prepare(
        `UPDATE residents SET
          nik = ?, no_kk = ?, full_name = ?, birth_place = ?, birth_date = ?,
          gender = ?, address = ?, region_id = ?, religion = ?, occupation = ?, marital_status = ?,
          family_relationship = ?, father_name = ?, mother_name = ?, education = ?, physical_disability = ?,
          resident_status = ?, mutation_date = ?, mutation_notes = ?,
          verification_status = ?, verification_note = ?
         WHERE id = ?`
      ).run(
        String(b.nik).trim(),
        String(b.no_kk).trim(),
        String(b.full_name).trim(),
        b.birth_place || 'Sumedang',
        b.birth_date || '1990-01-01',
        b.gender || 'Laki-laki',
        b.address || '',
        targetRegionId,
        b.religion || 'Islam',
        b.occupation || '-',
        b.marital_status || 'Belum Kawin',
        familyRelationship,
        fatherName,
        motherName,
        education,
        physicalDisability,
        status,
        mutationDate,
        mutationNotes,
        nextVerificationStatus,
        nextVerificationNote,
        residentId
      );

      if (isRtRw && user && mutationChanged) {
        const pendingPrior = db
          .prepare(
            "SELECT * FROM resident_mutation_logs WHERE resident_id = ? AND verification_status = 'pending' ORDER BY id DESC LIMIT 1"
          )
          .get(residentId) as
          | {
              id: number;
              action_type: 'create' | 'status_change';
              prev_status: string;
              prev_mutation_date: string;
              prev_mutation_notes: string;
            }
          | undefined;

        const baseActionType = pendingPrior ? pendingPrior.action_type : 'status_change';
        const basePrevStatus = pendingPrior ? pendingPrior.prev_status : existingStatus;
        const basePrevDate = pendingPrior ? pendingPrior.prev_mutation_date : existingMutDate;
        const basePrevNotes = pendingPrior ? pendingPrior.prev_mutation_notes : existingMutNotes;

        if (pendingPrior) {
          db.prepare(
            `UPDATE resident_mutation_logs
             SET verification_status = 'rejected',
                 verified_by_name = ?,
                 verification_note = 'Diperbarui ulang oleh pengurus RT/RW sebelum verifikasi selesai.',
                 verified_at = datetime('now')
             WHERE id = ?`
          ).run(user.fullName, pendingPrior.id);
        }

        db.prepare(
          `INSERT INTO resident_mutation_logs (
             resident_id, resident_nik, resident_name, region_label, action_type,
             prev_status, prev_mutation_date, prev_mutation_notes,
             new_status, new_mutation_date, new_mutation_notes,
             actor_user_id, actor_name, actor_role, actor_scope, verification_status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
        ).run(
          residentId,
          String(b.nik).trim(),
          String(b.full_name).trim(),
          formatRegionLabel(targetRegion),
          baseActionType,
          basePrevStatus,
          basePrevDate,
          basePrevNotes,
          status,
          mutationDate,
          mutationNotes,
          user.id,
          user.fullName,
          user.role,
          formatActorScope(user)
        );
      } else if (!isRtRw && user) {
        db.prepare(
          `UPDATE resident_mutation_logs
           SET verification_status = 'approved',
               verified_by_name = ?,
               verification_note = 'Diverifikasi langsung melalui pembaruan data Admin Desa.',
               verified_at = datetime('now')
           WHERE resident_id = ? AND verification_status = 'pending'`
        ).run(user.fullName, residentId);
      }
    })();

    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui data penduduk.' });
  }
});

app.post('/api/admin/residents/:id/record-death', requireAdmin, requirePermission('penduduk'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const residentId = Number(req.params.id);
  const existing = db
    .prepare(
      `SELECT r.*, rg.dusun, rg.blok, rg.rw, rg.rt
       FROM residents r
       LEFT JOIN regions rg ON r.region_id = rg.id
       WHERE r.id = ?`
    )
    .get(residentId) as Record<string, unknown> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Data penduduk tidak ditemukan.' });
    return;
  }

  const isRtRw = isRtRwRole(user?.role);
  if (isRtRw) {
    const existingRegion =
      existing.dusun && existing.rw && existing.rt
        ? { dusun: String(existing.dusun), rw: String(existing.rw), rt: String(existing.rt) }
        : null;
    if (!isRegionAllowedForUser(user, existingRegion)) {
      res.status(403).json({
        error: 'Akses ditolak. Penduduk berada di luar cakupan wilayah RT/RW Anda.',
      });
      return;
    }
  }

  const b = req.body || {};
  const deathDate = String(b.death_date || '').trim() || new Date().toISOString().slice(0, 10);
  const deathTime = String(b.death_time || '').trim();
  const deathDay = String(b.death_day || '').trim();
  const deathCause = String(b.death_cause || 'Sakit').trim();
  const deathLocation = String(b.death_location || 'Rumah').trim();
  const reporterName = String(b.death_reporter_name || '').trim();
  const reporterNik = String(b.death_reporter_nik || '').trim();

  if (!deathTime || !deathDay || !reporterName || !reporterNik) {
    res.status(400).json({
      error: 'Jam meninggal, hari meninggal, nama pelapor, dan NIK pelapor wajib diisi.',
    });
    return;
  }

  const mutationNotes = `Meninggal dunia (${deathCause}) di ${deathLocation} pada hari ${deathDay}, ${deathDate} pukul ${deathTime}. Pelapor: ${reporterName} (NIK ${reporterNik})`;
  const verificationStatus = isRtRw ? 'pending' : 'verified';

  db.transaction(() => {
    db.prepare(
      `UPDATE residents
       SET resident_status = 'meninggal',
           mutation_date = ?,
           mutation_notes = ?,
           death_time = ?,
           death_day = ?,
           death_cause = ?,
           death_location = ?,
           death_reporter_name = ?,
           death_reporter_nik = ?,
           verification_status = ?,
           verification_note = ''
       WHERE id = ?`
    ).run(
      deathDate,
      mutationNotes,
      deathTime,
      deathDay,
      deathCause,
      deathLocation,
      reporterName,
      reporterNik,
      verificationStatus,
      residentId
    );

    if (isRtRw && user) {
      db.prepare(
        `INSERT INTO resident_mutation_logs (
           resident_id, resident_nik, resident_name, region_label, action_type,
           prev_status, prev_mutation_date, prev_mutation_notes,
           new_status, new_mutation_date, new_mutation_notes,
           actor_user_id, actor_name, actor_role, actor_scope, verification_status
         ) VALUES (?, ?, ?, ?, 'status_change', ?, ?, ?, 'meninggal', ?, ?, ?, ?, ?, ?, 'pending')`
      ).run(
        residentId,
        String(existing.nik || ''),
        String(existing.full_name || ''),
        existing.dusun ? `RT ${existing.rt || '-'} / RW ${existing.rw || '-'} · ${existing.dusun}` : '-',
        String(existing.resident_status || 'aktif'),
        String(existing.mutation_date || ''),
        String(existing.mutation_notes || ''),
        deathDate,
        mutationNotes,
        user.id,
        user.fullName,
        user.role,
        formatActorScope(user)
      );
    } else if (!isRtRw && user) {
      db.prepare(
        `UPDATE resident_mutation_logs
         SET verification_status = 'approved',
             verified_by_name = ?,
             verification_note = 'Pencatatan kematian disetujui langsung oleh Admin Desa.',
             verified_at = datetime('now')
         WHERE resident_id = ? AND verification_status = 'pending'`
      ).run(user.fullName, residentId);
    }
  })();

  const updated = db
    .prepare(
      `SELECT r.*, rg.dusun, rg.blok, rg.rw, rg.rt
       FROM residents r
       LEFT JOIN regions rg ON r.region_id = rg.id
       WHERE r.id = ?`
    )
    .get(residentId);

  res.json({ ok: true, resident: updated });
});

app.get('/api/admin/residents/aggregate-report', requireAdmin, requirePermission('penduduk'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const scope = getUserRegionScopeClause(user, 'rg');
  const whereClause = scope.sql ? `WHERE ${scope.sql}` : '';

  const now = new Date();
  const periodType = String(req.query.periodType || 'monthly') === 'annual' ? 'annual' : 'monthly';
  const yearNum = Math.min(2100, Math.max(1990, Number(req.query.year) || now.getFullYear()));
  const monthNum = Math.min(12, Math.max(1, Number(req.query.month) || now.getMonth() + 1));

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const lastDayOfMonth = new Date(yearNum, monthNum, 0).getDate();
  const startDate = periodType === 'monthly' ? `${yearNum}-${pad2(monthNum)}-01` : `${yearNum}-01-01`;
  const cutoffDate =
    periodType === 'monthly'
      ? `${yearNum}-${pad2(monthNum)}-${pad2(lastDayOfMonth)}`
      : `${yearNum}-12-31`;
  const periodLabel =
    periodType === 'monthly'
      ? `Bulan ${monthNames[monthNum - 1]} ${yearNum}`
      : `Tahun ${yearNum}`;

  const allRows = db
    .prepare(
      `SELECT r.*, rg.dusun, rg.rw, rg.rt
       FROM residents r
       LEFT JOIN regions rg ON r.region_id = rg.id
       ${whereClause}`
    )
    .all(...scope.params) as Array<Record<string, unknown>>;

  const periodMutations = {
    lahir: 0,
    pindah_masuk: 0,
    pindah_keluar: 0,
    meninggal: 0,
  };

  const activeInPeriod: Array<Record<string, unknown>> = [];

  for (const row of allRows) {
    const st = normalizeResidentStatus(row.resident_status);
    const mutDate = String(row.mutation_date || '').trim();
    const birthDate = String(row.birth_date || '').trim();
    const createdDate = String(row.created_at || '').slice(0, 10);

    if (mutDate && mutDate >= startDate && mutDate <= cutoffDate) {
      if (st === 'lahir') periodMutations.lahir++;
      else if (st === 'pindah_masuk') periodMutations.pindah_masuk++;
      else if (st === 'pindah_keluar') periodMutations.pindah_keluar++;
      else if (st === 'meninggal') periodMutations.meninggal++;
    }

    // Determine whether this resident was active on cutoffDate
    if (birthDate && birthDate > cutoffDate) continue;
    if ((st === 'meninggal' || st === 'pindah_keluar') && (!mutDate || mutDate <= cutoffDate)) {
      continue;
    }
    if ((st === 'lahir' || st === 'pindah_masuk') && mutDate && mutDate > cutoffDate) {
      continue;
    }
    if (st === 'aktif' && createdDate && createdDate > cutoffDate && (!birthDate || birthDate > cutoffDate)) {
      continue;
    }

    activeInPeriod.push(row);
  }

  type BucketAcc = { label: string; male: number; female: number; total: number };
  const accumulate = (
    rows: Array<Record<string, unknown>>,
    getter: (row: Record<string, unknown>) => string,
    fixedOrder?: string[]
  ): BucketAcc[] => {
    const map = new Map<string, BucketAcc>();
    if (fixedOrder) {
      for (const lbl of fixedOrder) {
        map.set(lbl, { label: lbl, male: 0, female: 0, total: 0 });
      }
    }
    for (const r of rows) {
      const label = getter(r) || 'Tidak Diketahui';
      const entry = map.get(label) || { label, male: 0, female: 0, total: 0 };
      if (r.gender === 'Perempuan') entry.female++;
      else entry.male++;
      entry.total++;
      map.set(label, entry);
    }
    const list = Array.from(map.values());
    if (fixedOrder) return list;
    return list.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  };

  const refDate = new Date(cutoffDate + 'T23:59:59');
  const calcAge = (birthStr: string): number | null => {
    if (!birthStr) return null;
    const dob = new Date(birthStr);
    if (Number.isNaN(dob.getTime())) return null;
    let age = refDate.getFullYear() - dob.getFullYear();
    const m = refDate.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && refDate.getDate() < dob.getDate())) age--;
    return Math.max(0, age);
  };

  const ageGroupOrder = ['0-12 Tahun', '13-17 Tahun', '18-30 Tahun', '31-45 Tahun', '46-60 Tahun', '>60 Tahun'];
  const getBroadAgeGroup = (row: Record<string, unknown>) => {
    const age = calcAge(String(row.birth_date || ''));
    if (age === null) return 'Tidak Diketahui';
    if (age <= 12) return '0-12 Tahun';
    if (age <= 17) return '13-17 Tahun';
    if (age <= 30) return '18-30 Tahun';
    if (age <= 45) return '31-45 Tahun';
    if (age <= 60) return '46-60 Tahun';
    return '>60 Tahun';
  };

  const pyramidBrackets = [
    '0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39',
    '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75+',
  ];
  const pyramidMap = new Map<string, { bracket: string; male: number; female: number; total: number }>();
  for (const bkt of pyramidBrackets) {
    pyramidMap.set(bkt, { bracket: bkt, male: 0, female: 0, total: 0 });
  }
  for (const r of activeInPeriod) {
    const age = calcAge(String(r.birth_date || ''));
    const idx = age === null ? 6 : Math.min(15, Math.floor(age / 5));
    const bkt = pyramidBrackets[idx];
    const item = pyramidMap.get(bkt)!;
    if (r.gender === 'Perempuan') item.female++;
    else item.male++;
    item.total++;
  }

  const educationOrder = [
    'Tidak sekolah',
    'Belum tamat SD/Sederajat',
    'Tamat SD/Sederajat',
    'SLTP/Sederajat',
    'SLTA/Sederajat',
    'Akademi/D-III/S-Muda',
    'Strata 1',
    'Strata II',
    'Strata III',
  ];

  const maleCount = activeInPeriod.filter((r) => r.gender !== 'Perempuan').length;
  const femaleCount = activeInPeriod.filter((r) => r.gender === 'Perempuan').length;
  const totalFamilies = new Set(activeInPeriod.map((r) => String(r.no_kk || '').trim()).filter(Boolean)).size;

  res.json({
    periodType,
    year: yearNum,
    month: periodType === 'monthly' ? monthNum : null,
    periodLabel,
    cutoffDate,
    totals: {
      totalResidents: activeInPeriod.length,
      maleCount,
      femaleCount,
      totalFamilies,
    },
    periodMutations,
    byGender: accumulate(activeInPeriod, (r) => (r.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki'), ['Laki-laki', 'Perempuan']),
    byAgeGroup: accumulate(activeInPeriod, getBroadAgeGroup, ageGroupOrder),
    byOccupation: accumulate(activeInPeriod, (r) => String(r.occupation || 'Lainnya').trim()),
    byReligion: accumulate(activeInPeriod, (r) => String(r.religion || 'Islam').trim()),
    byEducation: accumulate(activeInPeriod, (r) => String(r.education || 'SLTA/Sederajat').trim(), educationOrder),
    byMaritalStatus: accumulate(activeInPeriod, (r) => String(r.marital_status || 'Belum Kawin').trim()),
    byPhysicalDisability: accumulate(activeInPeriod, (r) => String(r.physical_disability || 'Tidak Ada').trim(), ['Tidak Ada', 'Ada']),
    pyramid: Array.from(pyramidMap.values()),
  });
});

app.delete('/api/admin/residents/:id', requireAdmin, requirePermission('penduduk'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  if (isRtRwRole(user?.role)) {
    res.status(403).json({
      error: 'Akses hapus permanen khusus Admin Desa. Gunakan pencatatan mutasi (Pindah Keluar / Meninggal) melalui Edit Data.',
    });
    return;
  }
  const residentId = Number(req.params.id);
  const reason = String(req.query.reason || req.body?.reason || '').trim();
  const reasonText =
    reason === 'data_ganda'
      ? 'Data ganda dihapus permanen oleh Admin Desa.'
      : reason === 'kesalahan_data'
      ? 'Kesalahan input data dihapus permanen oleh Admin Desa.'
      : 'Data warga dihapus dari arsip oleh Admin Desa.';

  db.transaction(() => {
    db.prepare(
      `UPDATE resident_mutation_logs
       SET verification_status = 'rejected',
           verified_by_name = ?,
           verification_note = ?,
           verified_at = datetime('now')
       WHERE resident_id = ? AND verification_status = 'pending'`
    ).run(user?.fullName || 'Admin Desa', reasonText, residentId);
    db.prepare('DELETE FROM residents WHERE id = ?').run(residentId);
  })();
  res.json({ ok: true });
});

// Super Admin: RT/RW Resident Mutation Notifications & Final Verification
app.get('/api/admin/resident-mutations', requireAdmin, requireSuperAdmin, (req, res) => {
  const statusFilter = String(req.query.status || 'all').trim().toLowerCase();
  const allowedFilter = ['pending', 'approved', 'rejected'].includes(statusFilter);
  const logs = allowedFilter
    ? db
        .prepare(
          `SELECT * FROM resident_mutation_logs
           WHERE verification_status = ?
           ORDER BY CASE WHEN verification_status = 'pending' THEN 0 ELSE 1 END, id DESC`
        )
        .all(statusFilter)
    : db
        .prepare(
          `SELECT * FROM resident_mutation_logs
           ORDER BY CASE WHEN verification_status = 'pending' THEN 0 ELSE 1 END, id DESC`
        )
        .all();

  const pendingRow = db
    .prepare("SELECT COUNT(*) as count FROM resident_mutation_logs WHERE verification_status = 'pending'")
    .get() as { count: number };

  res.json({ logs, pendingCount: pendingRow.count || 0 });
});

app.post('/api/admin/resident-mutations/:id/verify', requireAdmin, requireSuperAdmin, (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  const logId = Number(req.params.id);
  const decision = String(req.body?.decision || '').trim().toLowerCase();
  const note = String(req.body?.note || '').trim();

  if (decision !== 'approved' && decision !== 'rejected') {
    res.status(400).json({ error: 'Keputusan verifikasi tidak valid (gunakan approved atau rejected).' });
    return;
  }

  const log = db.prepare('SELECT * FROM resident_mutation_logs WHERE id = ?').get(logId) as
    | {
        id: number;
        resident_id: number | null;
        action_type: 'create' | 'status_change';
        prev_status: string;
        prev_mutation_date: string;
        prev_mutation_notes: string;
        verification_status: string;
      }
    | undefined;

  if (!log) {
    res.status(404).json({ error: 'Riwayat mutasi tidak ditemukan.' });
    return;
  }
  if (log.verification_status !== 'pending') {
    res.status(400).json({ error: 'Ajuan mutasi ini sudah diverifikasi sebelumnya.' });
    return;
  }

  db.transaction(() => {
    if (decision === 'approved') {
      const approvalNote = note || 'Diverifikasi dan disetujui permanen oleh Super Admin.';
      db.prepare(
        `UPDATE resident_mutation_logs
         SET verification_status = 'approved',
             verified_by_name = ?,
             verification_note = ?,
             verified_at = datetime('now')
         WHERE id = ?`
      ).run(user.fullName, approvalNote, logId);

      if (log.resident_id) {
        db.prepare(
          `UPDATE residents
           SET verification_status = 'verified', verification_note = ?
           WHERE id = ?`
        ).run(note, log.resident_id);
      }
    } else {
      const rejectNote = note || 'Perubahan status kependudukan ditolak dan dikembalikan oleh Super Admin.';
      db.prepare(
        `UPDATE resident_mutation_logs
         SET verification_status = 'rejected',
             verified_by_name = ?,
             verification_note = ?,
             verified_at = datetime('now')
         WHERE id = ?`
      ).run(user.fullName, rejectNote, logId);

      if (log.resident_id) {
        if (log.action_type === 'create') {
          db.prepare('DELETE FROM residents WHERE id = ?').run(log.resident_id);
        } else {
          const revertedStatus = normalizeResidentStatus(log.prev_status || 'aktif');
          db.prepare(
            `UPDATE residents
             SET resident_status = ?,
                 mutation_date = ?,
                 mutation_notes = ?,
                 verification_status = 'rejected',
                 verification_note = ?
             WHERE id = ?`
          ).run(
            revertedStatus,
            log.prev_mutation_date || '',
            log.prev_mutation_notes || '',
            rejectNote,
            log.resident_id
          );
        }
      }
    }
  })();

  const pendingRow = db
    .prepare("SELECT COUNT(*) as count FROM resident_mutation_logs WHERE verification_status = 'pending'")
    .get() as { count: number };

  res.json({ ok: true, pendingCount: pendingRow.count || 0 });
});

app.get('/api/admin/residents/export-csv', requireAdmin, requirePermission('penduduk'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const scope = getUserRegionScopeClause(user, 'rg');
  const whereClause = scope.sql ? `WHERE ${scope.sql}` : '';
  const rows = db
    .prepare(
      `SELECT r.nik, r.no_kk, r.full_name, r.birth_place, r.birth_date, r.gender,
              r.address, r.religion, r.occupation, r.marital_status,
              r.family_relationship, r.father_name, r.mother_name, r.education, r.physical_disability,
              r.resident_status, r.mutation_date, r.mutation_notes,
              rg.dusun, rg.blok, rg.rw, rg.rt
       FROM residents r
       LEFT JOIN regions rg ON r.region_id = rg.id
       ${whereClause}
       ORDER BY r.id ASC`
    )
    .all(...scope.params) as Array<Record<string, unknown>>;

  const headers = [
    'nik', 'no_kk', 'full_name', 'birth_place', 'birth_date', 'gender',
    'address', 'religion', 'occupation', 'marital_status',
    'family_relationship', 'father_name', 'mother_name', 'education', 'physical_disability',
    'resident_status', 'mutation_date', 'mutation_notes',
    'dusun', 'blok', 'rw', 'rt',
  ];
  const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const csvLines = [headers.join(',')];
  for (const row of rows) {
    csvLines.push(headers.map((h) => escapeCsv(row[h])).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="data-penduduk-margamukti.csv"');
  res.send(csvLines.join('\n'));
});

app.post('/api/admin/residents/import-csv', requireAdmin, requirePermission('penduduk'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  if (isRtRwRole(user?.role)) {
    res.status(403).json({ error: 'Impor massal CSV hanya tersedia untuk Admin Desa.' });
    return;
  }
  const { csvText } = req.body || {};
  if (!csvText || typeof csvText !== 'string') {
    res.status(400).json({ error: 'Konten CSV kosong.' });
    return;
  }

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    res.status(400).json({ error: 'File CSV harus memiliki baris header dan minimal 1 baris data.' });
    return;
  }

  const parseCsvRow = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parseCsvRow(lines[0]).map((h) => h.toLowerCase());
  const defaultRegion = db.prepare('SELECT id FROM regions ORDER BY id ASC LIMIT 1').get() as { id: number } | undefined;
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO residents (
      nik, no_kk, full_name, birth_place, birth_date, gender, address, region_id,
      religion, occupation, marital_status,
      family_relationship, father_name, mother_name, education, physical_disability
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  let skipped = 0;
  const tx = db.transaction(() => {
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvRow(lines[i]);
      const getVal = (key: string, fallback = '') => {
        const idx = headers.indexOf(key);
        return idx >= 0 && cols[idx] ? cols[idx] : fallback;
      };
      const nik = getVal('nik');
      const noKk = getVal('no_kk');
      const fullName = getVal('full_name');
      if (!nik || !fullName) {
        skipped++;
        continue;
      }
      const genderRaw = getVal('gender', 'Laki-laki');
      const gender = genderRaw.toLowerCase().includes('perempuan') ? 'Perempuan' : 'Laki-laki';
      const info = insertStmt.run(
        nik,
        noKk || nik,
        fullName,
        getVal('birth_place', 'Sumedang'),
        getVal('birth_date', '1990-01-01'),
        gender,
        getVal('address', 'Desa Margamukti'),
        defaultRegion?.id ?? null,
        getVal('religion', 'Islam'),
        getVal('occupation', 'Wiraswasta'),
        getVal('marital_status', 'Belum Kawin'),
        getVal('family_relationship', 'Kepala keluarga'),
        getVal('father_name', ''),
        getVal('mother_name', ''),
        getVal('education', 'SLTA/Sederajat'),
        getVal('physical_disability', 'Tidak Ada')
      );
      if (info.changes > 0) inserted++;
      else skipped++;
    }
  });
  tx();

  res.json({ inserted, skipped });
});

app.get('/api/admin/residents/excel-template', requireAdmin, requirePermission('penduduk'), (_req, res) => {
  const regions = db.prepare('SELECT dusun, blok, rw, rt FROM regions ORDER BY dusun ASC, rw ASC, rt ASC').all() as Array<{
    dusun: string;
    blok: string;
    rw: string;
    rt: string;
  }>;

  const sampleRows = [
    {
      nik: '3211180101900099',
      no_kk: '3211180101120099',
      full_name: 'Contoh Warga Satu',
      birth_place: 'Sumedang',
      birth_date: '1990-05-15',
      gender: 'Laki-laki',
      address: 'Blok Kebonkalapa RT 01 RW 01, Dusun Pawenang',
      dusun: regions[0]?.dusun || 'Dusun Pawenang',
      blok: regions[0]?.blok || 'Blok Kebonkalapa',
      rw: regions[0]?.rw || '01',
      rt: regions[0]?.rt || '01',
      religion: 'Islam',
      occupation: 'Wiraswasta',
      marital_status: 'Kawin',
      family_relationship: 'Kepala keluarga',
      father_name: 'H. Rahmat',
      mother_name: 'Hj. Aminah',
      education: 'Strata 1',
      physical_disability: 'Tidak Ada',
    },
    {
      nik: '3211184508950088',
      no_kk: '3211180101120099',
      full_name: 'Contoh Warga Dua',
      birth_place: 'Sumedang',
      birth_date: '1995-08-05',
      gender: 'Perempuan',
      address: 'Blok Kebonkalapa RT 01 RW 01, Dusun Pawenang',
      dusun: regions[0]?.dusun || 'Dusun Pawenang',
      blok: regions[0]?.blok || 'Blok Kebonkalapa',
      rw: regions[0]?.rw || '01',
      rt: regions[0]?.rt || '01',
      religion: 'Islam',
      occupation: 'Pengrajin UMKM',
      marital_status: 'Kawin',
      family_relationship: 'Istri',
      father_name: 'Tatang',
      mother_name: 'Imas',
      education: 'SLTA/Sederajat',
      physical_disability: 'Tidak Ada',
    },
  ];

  const wb = XLSX.utils.book_new();
  const wsData = XLSX.utils.json_to_sheet(sampleRows, {
    header: [
      'nik',
      'no_kk',
      'full_name',
      'birth_place',
      'birth_date',
      'gender',
      'address',
      'dusun',
      'blok',
      'rw',
      'rt',
      'religion',
      'occupation',
      'marital_status',
      'family_relationship',
      'father_name',
      'mother_name',
      'education',
      'physical_disability',
    ],
  });
  wsData['!cols'] = [
    { wch: 20 }, { wch: 20 }, { wch: 24 }, { wch: 15 }, { wch: 14 }, { wch: 13 },
    { wch: 36 }, { wch: 18 }, { wch: 18 }, { wch: 6 }, { wch: 6 }, { wch: 12 }, { wch: 18 }, { wch: 16 },
    { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 24 }, { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'Data_Penduduk');

  const guideRows = [
    { kolom: 'nik', keterangan: 'Wajib 16 digit (teks). Jika NIK sudah ada di database, data lama akan diperbarui (Upsert).' },
    { kolom: 'no_kk', keterangan: 'Nomor Kartu Keluarga 16 digit (warga ber-No. KK sama otomatis dikelompokkan sebagai 1 keluarga).' },
    { kolom: 'full_name', keterangan: 'Wajib diisi. Nama lengkap sesuai KTP.' },
    { kolom: 'birth_place', keterangan: 'Tempat lahir (misal: Sumedang).' },
    { kolom: 'birth_date', keterangan: 'Format YYYY-MM-DD (misal: 1990-05-15) atau tanggal Excel.' },
    { kolom: 'gender', keterangan: 'Isi "Laki-laki" atau "Perempuan".' },
    { kolom: 'address', keterangan: 'Alamat lengkap domisili.' },
    { kolom: 'dusun', keterangan: 'Nama dusun sesuai daftar wilayah (misal: Dusun Pawenang / Dusun Cikondang).' },
    { kolom: 'blok', keterangan: 'Nama blok / kampung.' },
    { kolom: 'rw', keterangan: 'Nomor RW 2 digit (misal: 01, 02, 03, 04).' },
    { kolom: 'rt', keterangan: 'Nomor RT 2 digit (misal: 01, 02).' },
    { kolom: 'religion', keterangan: 'Islam / Kristen / Katolik / Hindu / Buddha / Konghucu.' },
    { kolom: 'occupation', keterangan: 'Jenis pekerjaan warga.' },
    { kolom: 'marital_status', keterangan: 'Belum Kawin / Kawin / Cerai Hidup / Cerai Mati.' },
    { kolom: 'family_relationship', keterangan: 'Kepala keluarga / Istri / Suami / Anak / Cucu / Menantu / Famili Lain / Mertua / Orang Tua / Lainnya.' },
    { kolom: 'father_name', keterangan: 'Nama lengkap ayah kandung.' },
    { kolom: 'mother_name', keterangan: 'Nama lengkap ibu kandung.' },
    { kolom: 'education', keterangan: 'Tidak sekolah / Belum tamat SD/Sederajat / Tamat SD/Sederajat / SLTP/Sederajat / SLTA/Sederajat / Akademi/D-III/S-Muda / Strata 1 / Strata II / Strata III.' },
    { kolom: 'physical_disability', keterangan: 'Isi "Tidak Ada" atau "Ada".' },
  ];
  const wsGuide = XLSX.utils.json_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 84 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan_Kolom');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="template-penduduk-margamukti.xlsx"');
  res.send(buf);
});

app.get('/api/admin/residents/export-xlsx', requireAdmin, requirePermission('penduduk'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const scope = getUserRegionScopeClause(user, 'rg');
  const whereClause = scope.sql ? `WHERE ${scope.sql}` : '';
  const rows = db
    .prepare(
      `SELECT r.nik, r.no_kk, r.full_name, r.birth_place, r.birth_date, r.gender,
              r.address, rg.dusun, rg.blok, rg.rw, rg.rt,
              r.religion, r.occupation, r.marital_status,
              r.family_relationship, r.father_name, r.mother_name, r.education, r.physical_disability,
              r.resident_status, r.mutation_date, r.mutation_notes
       FROM residents r
       LEFT JOIN regions rg ON r.region_id = rg.id
       ${whereClause}
       ORDER BY r.id ASC`
    )
    .all(...scope.params) as Array<Record<string, unknown>>;

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      'nik', 'no_kk', 'full_name', 'birth_place', 'birth_date', 'gender',
      'address', 'dusun', 'blok', 'rw', 'rt', 'religion', 'occupation', 'marital_status',
      'family_relationship', 'father_name', 'mother_name', 'education', 'physical_disability',
      'resident_status', 'mutation_date', 'mutation_notes',
    ],
  });
  ws['!cols'] = [
    { wch: 20 }, { wch: 20 }, { wch: 24 }, { wch: 15 }, { wch: 14 }, { wch: 13 },
    { wch: 36 }, { wch: 18 }, { wch: 18 }, { wch: 6 }, { wch: 6 }, { wch: 12 }, { wch: 18 }, { wch: 16 },
    { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 24 }, { wch: 15 },
    { wch: 16 }, { wch: 14 }, { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Data_Penduduk');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="data-penduduk-margamukti.xlsx"');
  res.send(buf);
});

function normalizeExcelDate(val: unknown): string {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number' && val > 1000) {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${mm}-${dd}`;
    }
  }
  const s = String(val ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return '1990-01-01';
}

function normalizeIdDigits(val: unknown): string {
  if (typeof val === 'number') {
    return Math.trunc(val).toString();
  }
  return String(val ?? '').trim();
}

app.post('/api/admin/residents/import-xlsx', requireAdmin, requirePermission('penduduk'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  if (isRtRwRole(user?.role)) {
    res.status(403).json({ error: 'Impor massal Excel (.xlsx) hanya tersedia untuk Admin Desa.' });
    return;
  }
  const { fileBase64 } = req.body || {};
  if (!fileBase64 || typeof fileBase64 !== 'string') {
    res.status(400).json({ error: 'File Excel (.xlsx) kosong.' });
    return;
  }

  try {
    const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const buffer = Buffer.from(cleanBase64, 'base64');
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) {
      res.status(400).json({ error: 'Workbook Excel tidak memiliki sheet.' });
      return;
    }
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[firstSheetName], {
      defval: '',
      raw: true,
    });
    if (rawRows.length === 0) {
      res.status(400).json({ error: 'Sheet Excel tidak memiliki baris data.' });
      return;
    }

    const regions = db.prepare('SELECT id, dusun, rw, rt FROM regions ORDER BY id ASC').all() as Array<{
      id: number;
      dusun: string;
      rw: string;
      rt: string;
    }>;
    const defaultRegionId = regions[0]?.id ?? null;

    const findRegionId = (dusunVal: string, rwVal: string, rtVal: string): number | null => {
      const rwPad = rwVal ? rwVal.replace(/\D/g, '').padStart(2, '0') : '';
      const rtPad = rtVal ? rtVal.replace(/\D/g, '').padStart(2, '0') : '';
      const dusunNorm = dusunVal.trim().toLowerCase();

      if (dusunNorm && rwPad && rtPad) {
        const exact = regions.find(
          (rg) => rg.dusun.toLowerCase() === dusunNorm && rg.rw === rwPad && rg.rt === rtPad
        );
        if (exact) return exact.id;
      }
      if (rwPad && rtPad) {
        const byRwRt = regions.find((rg) => rg.rw === rwPad && rg.rt === rtPad);
        if (byRwRt) return byRwRt.id;
      }
      if (dusunNorm) {
        const byDusun = regions.find((rg) => rg.dusun.toLowerCase() === dusunNorm);
        if (byDusun) return byDusun.id;
      }
      return defaultRegionId;
    };

    const findExistingStmt = db.prepare('SELECT id FROM residents WHERE nik = ?');
    const upsertStmt = db.prepare(`
      INSERT INTO residents (
        nik, no_kk, full_name, birth_place, birth_date, gender, address, region_id,
        religion, occupation, marital_status,
        family_relationship, father_name, mother_name, education, physical_disability
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(nik) DO UPDATE SET
        no_kk = excluded.no_kk,
        full_name = excluded.full_name,
        birth_place = excluded.birth_place,
        birth_date = excluded.birth_date,
        gender = excluded.gender,
        address = excluded.address,
        region_id = excluded.region_id,
        religion = excluded.religion,
        occupation = excluded.occupation,
        marital_status = excluded.marital_status,
        family_relationship = excluded.family_relationship,
        father_name = excluded.father_name,
        mother_name = excluded.mother_name,
        education = excluded.education,
        physical_disability = excluded.physical_disability
    `);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const tx = db.transaction(() => {
      for (const rawRow of rawRows) {
        const row: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rawRow)) {
          row[k.trim().toLowerCase()] = v;
        }
        const nik = normalizeIdDigits(row.nik);
        const fullName = String(row.full_name ?? row.nama ?? '').trim();
        if (!nik || !fullName) {
          skipped++;
          continue;
        }
        const noKk = normalizeIdDigits(row.no_kk) || nik;
        const genderRaw = String(row.gender ?? row.jenis_kelamin ?? 'Laki-laki').toLowerCase();
        const gender = genderRaw.includes('perempuan') || genderRaw === 'p' ? 'Perempuan' : 'Laki-laki';
        const regionId = findRegionId(
          String(row.dusun ?? ''),
          String(row.rw ?? ''),
          String(row.rt ?? '')
        );
        const disabilityRaw = String(row.physical_disability ?? row.kelainan_fisik ?? 'Tidak Ada').trim().toLowerCase();
        const physicalDisability = disabilityRaw === 'ada' ? 'Ada' : 'Tidak Ada';

        const existed = Boolean(findExistingStmt.get(nik));
        upsertStmt.run(
          nik,
          noKk,
          fullName,
          String(row.birth_place ?? row.tempat_lahir ?? 'Sumedang').trim() || 'Sumedang',
          normalizeExcelDate(row.birth_date ?? row.tanggal_lahir),
          gender,
          String(row.address ?? row.alamat ?? 'Desa Margamukti').trim() || 'Desa Margamukti',
          regionId,
          String(row.religion ?? row.agama ?? 'Islam').trim() || 'Islam',
          String(row.occupation ?? row.pekerjaan ?? 'Wiraswasta').trim() || 'Wiraswasta',
          String(row.marital_status ?? row.status_perkawinan ?? 'Belum Kawin').trim() || 'Belum Kawin',
          String(row.family_relationship ?? row.hubungan_keluarga ?? 'Kepala keluarga').trim() || 'Kepala keluarga',
          String(row.father_name ?? row.nama_ayah ?? '').trim(),
          String(row.mother_name ?? row.nama_ibu ?? '').trim(),
          String(row.education ?? row.pendidikan_terakhir ?? row.pendidikan ?? 'SLTA/Sederajat').trim() || 'SLTA/Sederajat',
          physicalDisability
        );
        if (existed) updated++;
        else inserted++;
      }
    });
    tx();

    res.json({ inserted, updated, skipped });
  } catch (err: unknown) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Gagal membaca file Excel (.xlsx). Pastikan format template sesuai.',
    });
  }
});

// Letter Templates CRUD
app.get('/api/admin/letter-templates', requireAdmin, requirePermission('surat'), (_req, res) => {
  res.json({ templates: db.prepare('SELECT * FROM letter_templates ORDER BY id ASC').all() });
});

app.post('/api/admin/letter-templates', requireAdmin, requirePermission('surat'), (req, res) => {
  const b = req.body || {};
  if (!b.code || !b.name || !b.body_template) {
    res.status(400).json({ error: 'Kode, nama, dan isi template surat wajib diisi.' });
    return;
  }
  try {
    const result = db
      .prepare(
        `INSERT INTO letter_templates (code, name, classification_code, description, body_template, required_fields, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        String(b.code).toUpperCase(),
        b.name,
        b.classification_code || '470',
        b.description || '',
        b.body_template,
        typeof b.required_fields === 'string' ? b.required_fields : JSON.stringify(b.required_fields || []),
        b.is_active === false ? 0 : 1
      );
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal menambah template surat.' });
  }
});

app.put('/api/admin/letter-templates/:id', requireAdmin, requirePermission('surat'), (req, res) => {
  const b = req.body || {};
  db.prepare(
    `UPDATE letter_templates SET
      code = ?, name = ?, classification_code = ?, description = ?,
      body_template = ?, required_fields = ?, is_active = ?
     WHERE id = ?`
  ).run(
    String(b.code).toUpperCase(),
    b.name,
    b.classification_code || '470',
    b.description || '',
    b.body_template,
    typeof b.required_fields === 'string' ? b.required_fields : JSON.stringify(b.required_fields || []),
    b.is_active === false || b.is_active === 0 ? 0 : 1,
    Number(req.params.id)
  );
  res.json({ ok: true });
});

app.delete('/api/admin/letter-templates/:id', requireAdmin, requirePermission('surat'), (req, res) => {
  db.prepare('DELETE FROM letter_templates WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Letter Requests Management & Verification (Multi-Signatory & TTE QR)
app.get('/api/admin/letter-requests', requireAdmin, requirePermission('surat'), (_req, res) => {
  const requests = db
    .prepare(
      `SELECT lr.*, lt.name as template_name, lt.code as template_code, lt.classification_code, lt.body_template
       FROM letter_requests lr
       JOIN letter_templates lt ON lr.template_id = lt.id
       ORDER BY lr.created_at DESC, lr.id DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const enriched = requests.map((row) => ({
    ...row,
    rendered_body: renderLetterBody(String(row.body_template || ''), row),
  }));
  const settings = db.prepare('SELECT * FROM village_settings WHERE id = 1').get();
  const signers = db
    .prepare('SELECT * FROM officials ORDER BY sort_order ASC, id ASC')
    .all();
  res.json({ requests: enriched, settings, signers });
});

app.patch('/api/admin/letter-requests/:id/verify', requireAdmin, requirePermission('surat'), (req, res) => {
  const id = Number(req.params.id);
  const { status, letter_number, admin_notes, signer_official_id, use_digital_signature } = req.body || {};
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Status verifikasi tidak valid.' });
    return;
  }

  const existing = db
    .prepare(
      `SELECT lr.*, lt.classification_code
       FROM letter_requests lr
       JOIN letter_templates lt ON lr.template_id = lt.id
       WHERE lr.id = ?`
    )
    .get(id) as { id: number; classification_code: string; letter_number: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Permohonan surat tidak ditemukan.' });
    return;
  }

  let finalNumber = String(letter_number || '').trim();
  if (status === 'approved' && !finalNumber) {
    const approvedTotal = (
      db.prepare("SELECT COUNT(*) as c FROM letter_requests WHERE status = 'approved'").get() as { c: number }
    ).c;
    const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const now = new Date();
    const seq = String(approvedTotal + 1).padStart(3, '0');
    finalNumber = `${existing.classification_code} / ${seq} / DS-MGM / ${romanMonths[now.getMonth()]} / ${now.getFullYear()}`;
  }

  let signerOfficialId: number | null = signer_official_id ? Number(signer_official_id) : null;
  let signerName = '';
  let signerPosition = '';
  let signerNip = '';
  let signerTteCode = '';
  const wantDigital = Boolean(use_digital_signature);

  if (status === 'approved') {
    let officialRow = signerOfficialId
      ? (db
          .prepare('SELECT id, name, position, nip, tte_status, tte_code FROM officials WHERE id = ?')
          .get(signerOfficialId) as
          | { id: number; name: string; position: string; nip: string; tte_status: string; tte_code: string }
          | undefined)
      : (db
          .prepare("SELECT id, name, position, nip, tte_status, tte_code FROM officials WHERE LOWER(position) LIKE 'kepala desa%' ORDER BY sort_order ASC LIMIT 1")
          .get() as
          | { id: number; name: string; position: string; nip: string; tte_status: string; tte_code: string }
          | undefined);

    if (!officialRow && signerOfficialId) {
      res.status(404).json({ error: 'Pejabat penanda tangan yang dipilih tidak ditemukan.' });
      return;
    }

    if (officialRow) {
      signerOfficialId = officialRow.id;
      signerName = officialRow.name;
      signerPosition = officialRow.position;
      signerNip = officialRow.nip;

      if (wantDigital) {
        if (officialRow.tte_status !== 'approved' || !officialRow.tte_code) {
          res.status(400).json({
            error: `Tanda Tangan Digital (TTE) untuk ${officialRow.name} belum disetujui Super Admin.`,
          });
          return;
        }
        signerTteCode = officialRow.tte_code;
      }
    } else if (wantDigital) {
      res.status(400).json({ error: 'Pilih pejabat dengan TTE disetujui untuk mengaktifkan tanda tangan digital.' });
      return;
    }
  }

  const approvedAt = status === 'approved' ? new Date().toISOString() : null;
  db.prepare(
    `UPDATE letter_requests
     SET status = ?, letter_number = ?, admin_notes = ?, approved_at = ?,
         signer_official_id = ?, signer_name = ?, signer_position = ?, signer_nip = ?,
         signer_tte_code = ?, use_digital_signature = ?
     WHERE id = ?`
  ).run(
    status,
    finalNumber,
    String(admin_notes || ''),
    approvedAt,
    signerOfficialId,
    signerName,
    signerPosition,
    signerNip,
    signerTteCode,
    wantDigital && status === 'approved' ? 1 : 0,
    id
  );

  res.json({
    ok: true,
    letter_number: finalNumber,
    signer_name: signerName,
    signer_position: signerPosition,
    signer_tte_code: signerTteCode,
    use_digital_signature: wantDigital && status === 'approved' ? 1 : 0,
  });
});

app.delete('/api/admin/letter-requests/:id', requireAdmin, requirePermission('surat'), (req, res) => {
  db.prepare('DELETE FROM letter_requests WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

function sanitizeArticleMediaItems(raw: unknown): string {
  let items: unknown[] = [];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      items = [];
    }
  }
  const cleaned = items
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry, idx) => {
      const type = entry.type === 'video' || entry.type === 'embed' ? entry.type : 'image';
      const platform =
        entry.platform === 'youtube' ||
        entry.platform === 'tiktok' ||
        entry.platform === 'instagram' ||
        entry.platform === 'upload'
          ? entry.platform
          : 'upload';
      const url = String(entry.url || '').trim().slice(0, 1000);
      const caption = String(entry.caption || '').trim().slice(0, 300);
      const id = String(entry.id || `media-${Date.now()}-${idx}`).slice(0, 80);
      return { id, type, platform, url, caption };
    })
    .filter((item) => item.url.length > 0)
    .slice(0, 30);

  return JSON.stringify(cleaned);
}

// Articles CRUD
app.get('/api/admin/articles', requireAdmin, requirePermission('berita'), (_req, res) => {
  res.json({ articles: db.prepare('SELECT * FROM articles ORDER BY published_at DESC, id DESC').all() });
});

app.post('/api/admin/articles', requireAdmin, requirePermission('berita'), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.content) {
    res.status(400).json({ error: 'Judul dan isi berita wajib diisi.' });
    return;
  }
  const baseSlug = slugify(b.title);
  const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
  const mediaJson = sanitizeArticleMediaItems(b.media_items);
  const result = db
    .prepare(
      `INSERT INTO articles (title, slug, category, excerpt, content, image_url, media_items, author_name, published_at, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.title,
      slug,
      b.category || 'Pemerintahan',
      b.excerpt || b.title,
      b.content,
      b.image_url || '',
      mediaJson,
      b.author_name || 'Admin Desa Margamukti',
      b.published_at || new Date().toISOString().slice(0, 10),
      b.is_published === false || b.is_published === 0 ? 0 : 1
    );
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/admin/articles/:id', requireAdmin, requirePermission('berita'), (req, res) => {
  const b = req.body || {};
  const mediaJson = sanitizeArticleMediaItems(b.media_items);
  db.prepare(
    `UPDATE articles SET title = ?, category = ?, excerpt = ?, content = ?, image_url = ?, media_items = ?, author_name = ?, published_at = ?, is_published = ?
     WHERE id = ?`
  ).run(
    b.title,
    b.category || 'Pemerintahan',
    b.excerpt || '',
    b.content,
    b.image_url || '',
    mediaJson,
    b.author_name || 'Admin Desa Margamukti',
    b.published_at || new Date().toISOString().slice(0, 10),
    b.is_published === false || b.is_published === 0 ? 0 : 1,
    Number(req.params.id)
  );
  res.json({ ok: true });
});

app.delete('/api/admin/articles/:id', requireAdmin, requirePermission('berita'), (req, res) => {
  db.prepare('DELETE FROM articles WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Article Comments Moderation
app.get('/api/admin/comments', requireAdmin, requirePermission('berita'), (_req, res) => {
  const comments = db
    .prepare(
      `SELECT c.*, a.title as article_title, a.slug as article_slug
       FROM article_comments c
       JOIN articles a ON c.article_id = a.id
       ORDER BY c.created_at DESC, c.id DESC`
    )
    .all();
  res.json({ comments });
});

app.patch('/api/admin/comments/:id', requireAdmin, requirePermission('berita'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT status, admin_reply FROM article_comments WHERE id = ?').get(id) as
    | { status: string; admin_reply: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Komentar tidak ditemukan.' });
    return;
  }
  const nextStatus =
    req.body?.status === 'hidden' || req.body?.status === 'published'
      ? req.body.status
      : existing.status;
  const nextReply =
    req.body?.admin_reply !== undefined ? String(req.body.admin_reply).trim() : existing.admin_reply;

  db.prepare('UPDATE article_comments SET status = ?, admin_reply = ? WHERE id = ?').run(
    nextStatus,
    nextReply,
    id
  );
  res.json({ ok: true });
});

app.delete('/api/admin/comments/:id', requireAdmin, requirePermission('berita'), (req, res) => {
  db.prepare('DELETE FROM article_comments WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// UMKM CRUD
app.get('/api/admin/umkm', requireAdmin, requirePermission('umkm'), (_req, res) => {
  res.json({ products: db.prepare('SELECT * FROM umkm_products ORDER BY id DESC').all() });
});

app.post('/api/admin/umkm', requireAdmin, requirePermission('umkm'), (req, res) => {
  const b = req.body || {};
  if (!b.business_name || !b.product_name || !b.whatsapp) {
    res.status(400).json({ error: 'Nama usaha, nama produk, dan WhatsApp wajib diisi.' });
    return;
  }
  const result = db
    .prepare(
      `INSERT INTO umkm_products (business_name, product_name, category, owner_name, description, price, whatsapp, image_url, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.business_name,
      b.product_name,
      b.category || 'Kuliner',
      b.owner_name || '-',
      b.description || '',
      Number(b.price || 0),
      String(b.whatsapp).replace(/\D/g, ''),
      b.image_url || '',
      b.is_verified === false || b.is_verified === 0 ? 0 : 1
    );
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/admin/umkm/:id', requireAdmin, requirePermission('umkm'), (req, res) => {
  const b = req.body || {};
  db.prepare(
    `UPDATE umkm_products SET business_name = ?, product_name = ?, category = ?, owner_name = ?, description = ?, price = ?, whatsapp = ?, image_url = ?, is_verified = ?
     WHERE id = ?`
  ).run(
    b.business_name,
    b.product_name,
    b.category || 'Kuliner',
    b.owner_name || '-',
    b.description || '',
    Number(b.price || 0),
    String(b.whatsapp).replace(/\D/g, ''),
    b.image_url || '',
    b.is_verified === false || b.is_verified === 0 ? 0 : 1,
    Number(req.params.id)
  );
  res.json({ ok: true });
});

app.delete('/api/admin/umkm/:id', requireAdmin, requirePermission('umkm'), (req, res) => {
  db.prepare('DELETE FROM umkm_products WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Gallery CRUD
app.get('/api/admin/gallery', requireAdmin, requirePermission('galeri'), (_req, res) => {
  res.json({ items: db.prepare('SELECT * FROM gallery_items ORDER BY event_date DESC, id DESC').all() });
});

app.post('/api/admin/gallery', requireAdmin, requirePermission('galeri'), (req, res) => {
  const b = req.body || {};
  if (!b.title) {
    res.status(400).json({ error: 'Judul foto galeri wajib diisi.' });
    return;
  }
  const result = db
    .prepare('INSERT INTO gallery_items (title, description, event_date, category, image_url) VALUES (?, ?, ?, ?, ?)')
    .run(b.title, b.description || '', b.event_date || new Date().toISOString().slice(0, 10), b.category || 'Kegiatan', b.image_url || '');
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/admin/gallery/:id', requireAdmin, requirePermission('galeri'), (req, res) => {
  const b = req.body || {};
  db.prepare('UPDATE gallery_items SET title = ?, description = ?, event_date = ?, category = ?, image_url = ? WHERE id = ?')
    .run(b.title, b.description || '', b.event_date || '', b.category || 'Kegiatan', b.image_url || '', Number(req.params.id));
  res.json({ ok: true });
});

app.delete('/api/admin/gallery/:id', requireAdmin, requirePermission('galeri'), (req, res) => {
  db.prepare('DELETE FROM gallery_items WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Map Locations CRUD
app.get('/api/admin/map', requireAdmin, requirePermission('peta'), (_req, res) => {
  const settings = db.prepare('SELECT map_center_lat, map_center_lng FROM village_settings WHERE id = 1').get();
  const locations = db.prepare('SELECT * FROM map_locations ORDER BY id DESC').all();
  res.json({ locations, settings });
});

app.post('/api/admin/map', requireAdmin, requirePermission('peta'), (req, res) => {
  const b = req.body || {};
  if (!b.name || b.latitude === undefined || b.longitude === undefined) {
    res.status(400).json({ error: 'Nama lokasi dan koordinat latitude/longitude wajib diisi.' });
    return;
  }
  const result = db
    .prepare('INSERT INTO map_locations (name, category, description, address, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)')
    .run(b.name, b.category || 'Fasilitas Umum', b.description || '', b.address || '', Number(b.latitude), Number(b.longitude));
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/admin/map/:id', requireAdmin, requirePermission('peta'), (req, res) => {
  const b = req.body || {};
  db.prepare('UPDATE map_locations SET name = ?, category = ?, description = ?, address = ?, latitude = ?, longitude = ? WHERE id = ?')
    .run(b.name, b.category || 'Fasilitas Umum', b.description || '', b.address || '', Number(b.latitude), Number(b.longitude), Number(req.params.id));
  res.json({ ok: true });
});

app.delete('/api/admin/map/:id', requireAdmin, requirePermission('peta'), (req, res) => {
  db.prepare('DELETE FROM map_locations WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Complaints Inbox CRUD
app.get('/api/admin/complaints', requireAdmin, requireAnyPermission('pengaduan', 'peringatan'), (_req, res) => {
  res.json({ complaints: db.prepare('SELECT * FROM complaints ORDER BY created_at DESC, id DESC').all() });
});

app.patch('/api/admin/complaints/:id', requireAdmin, requireAnyPermission('pengaduan', 'peringatan'), (req, res) => {
  const { status, admin_reply } = req.body || {};
  db.prepare('UPDATE complaints SET status = ?, admin_reply = ? WHERE id = ?')
    .run(status || 'diproses', admin_reply || '', Number(req.params.id));
  res.json({ ok: true });
});

app.delete('/api/admin/complaints/:id', requireAdmin, requireAnyPermission('pengaduan', 'peringatan'), (req, res) => {
  db.prepare('DELETE FROM complaints WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Early Warnings & Emergency Reports CRUD
app.get('/api/admin/early-warnings', requireAdmin, requirePermission('peringatan'), async (_req, res) => {
  const settings = db
    .prepare('SELECT village_code FROM village_settings WHERE id = 1')
    .get() as { village_code?: string } | undefined;

  const warnings = db
    .prepare(
      `SELECT * FROM early_warnings
       ORDER BY is_active DESC,
         CASE severity
           WHEN 'darurat' THEN 0
           WHEN 'siaga' THEN 1
           WHEN 'waspada' THEN 2
           ELSE 3
         END ASC,
         updated_at DESC, id DESC`
    )
    .all();

  const emergencyReports = db
    .prepare('SELECT * FROM complaints WHERE is_emergency = 1 ORDER BY created_at DESC, id DESC')
    .all();

  const bmkg = await fetchBmkgLiveData(settings?.village_code || '32.11.18.2008');

  res.json({ warnings, emergencyReports, bmkg });
});

app.post('/api/admin/early-warnings', requireAdmin, requirePermission('peringatan'), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.description) {
    res.status(400).json({ error: 'Judul peringatan dan uraian situasi wajib diisi.' });
    return;
  }
  const severity = ['darurat', 'siaga', 'waspada', 'info'].includes(String(b.severity))
    ? String(b.severity)
    : 'waspada';
  const result = db
    .prepare(
      `INSERT INTO early_warnings (title, category, severity, affected_area, description, instruction, emergency_contact, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(b.title).trim(),
      String(b.category || 'Cuaca Ekstrem').trim(),
      severity,
      String(b.affected_area || 'Seluruh Wilayah Desa Margamukti').trim(),
      String(b.description).trim(),
      String(b.instruction || '').trim(),
      String(b.emergency_contact || '').trim(),
      b.is_active === false || b.is_active === 0 ? 0 : 1
    );
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/admin/early-warnings/:id', requireAdmin, requirePermission('peringatan'), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.description) {
    res.status(400).json({ error: 'Judul peringatan dan uraian situasi wajib diisi.' });
    return;
  }
  const severity = ['darurat', 'siaga', 'waspada', 'info'].includes(String(b.severity))
    ? String(b.severity)
    : 'waspada';
  db.prepare(
    `UPDATE early_warnings SET
      title = ?, category = ?, severity = ?, affected_area = ?, description = ?, instruction = ?,
      emergency_contact = ?, is_active = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    String(b.title).trim(),
    String(b.category || 'Cuaca Ekstrem').trim(),
    severity,
    String(b.affected_area || 'Seluruh Wilayah Desa Margamukti').trim(),
    String(b.description).trim(),
    String(b.instruction || '').trim(),
    String(b.emergency_contact || '').trim(),
    b.is_active === false || b.is_active === 0 ? 0 : 1,
    Number(req.params.id)
  );
  res.json({ ok: true });
});

app.patch('/api/admin/early-warnings/:id/toggle', requireAdmin, requirePermission('peringatan'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT is_active FROM early_warnings WHERE id = ?').get(id) as
    | { is_active: number }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Peringatan tidak ditemukan.' });
    return;
  }
  const nextActive = existing.is_active === 1 ? 0 : 1;
  db.prepare("UPDATE early_warnings SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(
    nextActive,
    id
  );
  res.json({ ok: true, is_active: nextActive });
});

app.delete('/api/admin/early-warnings/:id', requireAdmin, requirePermission('peringatan'), (req, res) => {
  db.prepare('DELETE FROM early_warnings WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// APBDes (Anggaran Desa) CRUD
app.get('/api/admin/apbdes', requireAdmin, requirePermission('apbdes'), (_req, res) => {
  const items = db
    .prepare('SELECT * FROM apbdes_items ORDER BY fiscal_year DESC, type ASC, id DESC')
    .all();
  res.json({ items });
});

app.post('/api/admin/apbdes', requireAdmin, requirePermission('apbdes'), (req, res) => {
  const b = req.body || {};
  if (!b.fiscal_year || !b.type || !b.category || !b.title) {
    res.status(400).json({ error: 'Tahun anggaran, jenis, bidang/kategori, dan uraian wajib diisi.' });
    return;
  }
  const result = db
    .prepare(
      `INSERT INTO apbdes_items (fiscal_year, type, category, title, budget_amount, realized_amount, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      Number(b.fiscal_year),
      b.type,
      String(b.category).trim(),
      String(b.title).trim(),
      Math.max(0, Math.round(Number(b.budget_amount || 0))),
      Math.max(0, Math.round(Number(b.realized_amount || 0))),
      String(b.notes || '').trim()
    );
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/admin/apbdes/:id', requireAdmin, requirePermission('apbdes'), (req, res) => {
  const b = req.body || {};
  db.prepare(
    `UPDATE apbdes_items SET
      fiscal_year = ?, type = ?, category = ?, title = ?, budget_amount = ?, realized_amount = ?, notes = ?
     WHERE id = ?`
  ).run(
    Number(b.fiscal_year),
    b.type,
    String(b.category).trim(),
    String(b.title).trim(),
    Math.max(0, Math.round(Number(b.budget_amount || 0))),
    Math.max(0, Math.round(Number(b.realized_amount || 0))),
    String(b.notes || '').trim(),
    Number(req.params.id)
  );
  res.json({ ok: true });
});

app.delete('/api/admin/apbdes/:id', requireAdmin, requirePermission('apbdes'), (req, res) => {
  db.prepare('DELETE FROM apbdes_items WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Super Admin: Sub-Admin Perangkat Desa, Ketua RW, Ketua RT & Granular RBAC Permissions CRUD
app.get('/api/admin/users', requireAdmin, requireSuperAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.role, u.permissions, u.official_id,
              u.scope_dusun, u.scope_rw, u.scope_rt, u.is_active, u.created_at,
              o.name as official_name, o.position as official_position
       FROM users u
       LEFT JOIN officials o ON u.official_id = o.id
       ORDER BY CASE
         WHEN u.role = 'super_admin' THEN 0
         WHEN u.role = 'sub_admin' THEN 1
         WHEN u.role = 'ketua_rw' THEN 2
         ELSE 3
       END, u.id ASC`
    )
    .all() as Array<Record<string, unknown>>;

  const users = rows.map((r) => ({
    ...r,
    scope_dusun: String(r.scope_dusun || ''),
    scope_rw: String(r.scope_rw || ''),
    scope_rt: String(r.scope_rt || ''),
    permissions: parseUserPermissions(String(r.role), r.permissions),
  }));
  const officials = db.prepare('SELECT id, name, position FROM officials ORDER BY sort_order ASC, id ASC').all();
  const regions = db
    .prepare('SELECT id, dusun, blok, rw, rt, ketua_rw, ketua_rt FROM regions ORDER BY dusun ASC, rw ASC, rt ASC')
    .all();
  res.json({ users, officials, regions, allPermissions: ALL_ADMIN_PERMISSIONS });
});

function resolveAccountRoleAndScope(body: Record<string, unknown>): {
  role: 'sub_admin' | 'ketua_rw' | 'ketua_rt';
  scopeDusun: string;
  scopeRw: string;
  scopeRt: string;
  permissions: string[];
  error?: string;
} {
  const rawRole = String(body.role || 'sub_admin').trim();
  const role: 'sub_admin' | 'ketua_rw' | 'ketua_rt' =
    rawRole === 'ketua_rw' || rawRole === 'ketua_rt' ? rawRole : 'sub_admin';

  if (role === 'sub_admin') {
    const perms = Array.isArray(body.permissions)
      ? body.permissions.filter(
          (p: unknown): p is string => typeof p === 'string' && (ALL_ADMIN_PERMISSIONS as readonly string[]).includes(p)
        )
      : [];
    return {
      role: 'sub_admin',
      scopeDusun: '',
      scopeRw: '',
      scopeRt: '',
      permissions: perms,
    };
  }

  const scopeDusun = String(body.scope_dusun || '').trim();
  const scopeRw = String(body.scope_rw || '').trim();
  const scopeRt = role === 'ketua_rt' ? String(body.scope_rt || '').trim() : '';

  if (!scopeDusun || !scopeRw) {
    return {
      role,
      scopeDusun,
      scopeRw,
      scopeRt,
      permissions: [...RT_RW_DEFAULT_PERMISSIONS],
      error: 'Wilayah Dusun dan RW wajib dipilih untuk akun Ketua RT/RW.',
    };
  }

  if (role === 'ketua_rw') {
    const exists = db
      .prepare('SELECT id FROM regions WHERE LOWER(TRIM(dusun)) = LOWER(TRIM(?)) AND TRIM(rw) = TRIM(?) LIMIT 1')
      .get(scopeDusun, scopeRw);
    if (!exists) {
      return {
        role,
        scopeDusun,
        scopeRw,
        scopeRt: '',
        permissions: [...RT_RW_DEFAULT_PERMISSIONS],
        error: 'Wilayah Dusun/RW yang dipilih tidak ditemukan di data wilayah.',
      };
    }
    return {
      role: 'ketua_rw',
      scopeDusun,
      scopeRw,
      scopeRt: '',
      permissions: [...RT_RW_DEFAULT_PERMISSIONS],
    };
  }

  if (!scopeRt) {
    return {
      role,
      scopeDusun,
      scopeRw,
      scopeRt,
      permissions: [...RT_RW_DEFAULT_PERMISSIONS],
      error: 'Nomor RT wajib dipilih untuk akun Ketua RT.',
    };
  }

  const existsRt = db
    .prepare(
      'SELECT id FROM regions WHERE LOWER(TRIM(dusun)) = LOWER(TRIM(?)) AND TRIM(rw) = TRIM(?) AND TRIM(rt) = TRIM(?) LIMIT 1'
    )
    .get(scopeDusun, scopeRw, scopeRt);
  if (!existsRt) {
    return {
      role,
      scopeDusun,
      scopeRw,
      scopeRt,
      permissions: [...RT_RW_DEFAULT_PERMISSIONS],
      error: 'Wilayah RT/RW yang dipilih tidak ditemukan di data wilayah.',
    };
  }

  return {
    role: 'ketua_rt',
    scopeDusun,
    scopeRw,
    scopeRt,
    permissions: [...RT_RW_DEFAULT_PERMISSIONS],
  };
}

app.post('/api/admin/users', requireAdmin, requireSuperAdmin, (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const username = String(b.username || '').trim().toLowerCase();
  const password = String(b.password || '');
  const fullName = String(b.full_name || '').trim();
  if (!username || !password || !fullName) {
    res.status(400).json({ error: 'Username, password, dan nama lengkap wajib diisi.' });
    return;
  }
  if (password.length < 4) {
    res.status(400).json({ error: 'Password minimal 4 karakter.' });
    return;
  }
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(username);
  if (existing) {
    res.status(400).json({ error: 'Username sudah digunakan oleh akun lain.' });
    return;
  }

  const resolved = resolveAccountRoleAndScope(b);
  if (resolved.error) {
    res.status(400).json({ error: resolved.error });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const result = db
    .prepare(
      `INSERT INTO users (username, password_hash, full_name, role, permissions, official_id, scope_dusun, scope_rw, scope_rt, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      username,
      passwordHash,
      fullName,
      resolved.role,
      JSON.stringify(resolved.permissions),
      resolved.role === 'sub_admin' && b.official_id ? Number(b.official_id) : null,
      resolved.scopeDusun,
      resolved.scopeRw,
      resolved.scopeRt,
      b.is_active === false || b.is_active === 0 ? 0 : 1
    );
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/admin/users/:id', requireAdmin, requireSuperAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as
    | { id: number; username: string; role: string }
    | undefined;
  if (!target) {
    res.status(404).json({ error: 'Akun tidak ditemukan.' });
    return;
  }

  const b = (req.body || {}) as Record<string, unknown>;
  const fullName = String(b.full_name || '').trim();
  if (!fullName) {
    res.status(400).json({ error: 'Nama lengkap wajib diisi.' });
    return;
  }

  const isPrimarySuperAdmin = target.username === 'admin' || target.role === 'super_admin';
  const nextActive = isPrimarySuperAdmin ? 1 : (b.is_active === false || b.is_active === 0 ? 0 : 1);

  let nextRole = target.role;
  let nextPerms = [...ALL_ADMIN_PERMISSIONS] as string[];
  let nextOfficialId: number | null = b.official_id ? Number(b.official_id) : null;
  let nextScopeDusun = '';
  let nextScopeRw = '';
  let nextScopeRt = '';

  if (!isPrimarySuperAdmin) {
    const resolved = resolveAccountRoleAndScope({ ...b, role: b.role ?? target.role });
    if (resolved.error) {
      res.status(400).json({ error: resolved.error });
      return;
    }
    nextRole = resolved.role;
    nextPerms = resolved.permissions;
    nextOfficialId = resolved.role === 'sub_admin' && b.official_id ? Number(b.official_id) : null;
    nextScopeDusun = resolved.scopeDusun;
    nextScopeRw = resolved.scopeRw;
    nextScopeRt = resolved.scopeRt;
  }

  if (b.password && String(b.password).trim().length > 0) {
    if (String(b.password).trim().length < 4) {
      res.status(400).json({ error: 'Password baru minimal 4 karakter.' });
      return;
    }
    const newHash = bcrypt.hashSync(String(b.password).trim(), 10);
    db.prepare(
      `UPDATE users
       SET full_name = ?, password_hash = ?, role = ?, permissions = ?, official_id = ?,
           scope_dusun = ?, scope_rw = ?, scope_rt = ?, is_active = ?
       WHERE id = ?`
    ).run(
      fullName,
      newHash,
      nextRole,
      JSON.stringify(nextPerms),
      nextOfficialId,
      nextScopeDusun,
      nextScopeRw,
      nextScopeRt,
      nextActive,
      targetId
    );
  } else {
    db.prepare(
      `UPDATE users
       SET full_name = ?, role = ?, permissions = ?, official_id = ?,
           scope_dusun = ?, scope_rw = ?, scope_rt = ?, is_active = ?
       WHERE id = ?`
    ).run(
      fullName,
      nextRole,
      JSON.stringify(nextPerms),
      nextOfficialId,
      nextScopeDusun,
      nextScopeRw,
      nextScopeRt,
      nextActive,
      targetId
    );
  }

  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireAdmin, requireSuperAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  const currentUser = (req as AuthenticatedRequest).user;
  const target = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(targetId) as
    | { id: number; username: string; role: string }
    | undefined;
  if (!target) {
    res.status(404).json({ error: 'Akun tidak ditemukan.' });
    return;
  }
  if (target.username === 'admin' || target.role === 'super_admin' || target.id === currentUser?.id) {
    res.status(400).json({ error: 'Akun Super Admin utama tidak dapat dihapus.' });
    return;
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.json({ ok: true });
});

// ============================================================================
// SISTEM CADANGAN (BACKUP) OTOMATIS MINGGUAN & UNDUH MANUAL JSON
// ============================================================================

app.get('/api/admin/backups', requireAdmin, requireVillageBackupAccess, (_req, res) => {
  res.json(getBackupOverview());
});

app.post('/api/admin/backups', requireAdmin, requireVillageBackupAccess, (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const actorName = user?.fullName || 'Admin Desa';
  const archive = createAndStoreBackupSnapshot('manual', actorName);
  res.status(201).json({ ok: true, archive });
});

app.get('/api/admin/backups/download-live', requireAdmin, requireVillageBackupAccess, (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const actorName = user?.fullName || 'Admin Desa';
  const { payload, wib } = buildVillageBackupPayload('manual', actorName);
  const filename = `backup-penduduk-surat-margamukti-${wib.fileStamp}.json`;
  const jsonString = JSON.stringify(payload, null, 2);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(jsonString);
});

app.get('/api/admin/backups/:id/download', requireAdmin, requireVillageBackupAccess, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM backup_archives WHERE id = ?').get(id) as
    | BackupArchiveRow
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Arsip cadangan tidak ditemukan.' });
    return;
  }
  const filePath = resolveSafeBackupPath(row.filename);
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Berkas JSON cadangan tidak ditemukan di server.' });
    return;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.download(filePath, row.filename);
});

app.delete('/api/admin/backups/:id', requireAdmin, requireVillageBackupAccess, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM backup_archives WHERE id = ?').get(id) as
    | BackupArchiveRow
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Arsip cadangan tidak ditemukan.' });
    return;
  }
  if (row.trigger_type === 'auto_weekly') {
    res.status(400).json({
      error: 'Arsip otomatis mingguan dikelola oleh sistem retensi maksimal 8 arsip terbaru.',
    });
    return;
  }
  const filePath = resolveSafeBackupPath(row.filename);
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Abaikan jika file sudah terhapus
    }
  }
  db.prepare('DELETE FROM backup_archives WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ============================================================================
// WHATSAPP BLASTER (PERANGKAT DESA, KEPALA DUSUN, KETUA RW, KETUA RT)
// ============================================================================

app.get('/api/admin/wa-blaster/recipients', requireAdmin, requirePermission('wa_blaster'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const recipients = collectWaRecipientsDirectory(user);
  const gatewayStatus = getWaGatewayStatus();
  res.json({
    recipients,
    gatewayStatus,
    todayLabel: formatIndonesianTodayLabel(),
  });
});

app.get('/api/admin/wa-blaster/templates', requireAdmin, requirePermission('wa_blaster'), (_req, res) => {
  const templates = db.prepare('SELECT * FROM wa_templates ORDER BY id DESC').all();
  res.json({ templates });
});

app.post('/api/admin/wa-blaster/templates', requireAdmin, requirePermission('wa_blaster'), (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const title = String(b.title || '').trim();
  const category = String(b.category || 'Umum').trim() || 'Umum';
  const content = String(b.content || '').trim();
  const status = b.status === 'draft' ? 'draft' : 'active';
  if (!title || !content) {
    res.status(400).json({ error: 'Judul dan isi template pesan wajib diisi.' });
    return;
  }
  const result = db
    .prepare('INSERT INTO wa_templates (title, category, content, status) VALUES (?, ?, ?, ?)')
    .run(title, category, content, status);
  const created = db.prepare('SELECT * FROM wa_templates WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ id: result.lastInsertRowid, template: created });
});

app.put('/api/admin/wa-blaster/templates/:id', requireAdmin, requirePermission('wa_blaster'), (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const title = String(b.title || '').trim();
  const category = String(b.category || 'Umum').trim() || 'Umum';
  const content = String(b.content || '').trim();
  const status = b.status === 'draft' ? 'draft' : 'active';
  if (!title || !content) {
    res.status(400).json({ error: 'Judul dan isi template pesan wajib diisi.' });
    return;
  }
  db.prepare(
    "UPDATE wa_templates SET title = ?, category = ?, content = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title, category, content, status, Number(req.params.id));
  res.json({ ok: true });
});

app.post('/api/admin/wa-blaster/templates/:id/duplicate', requireAdmin, requirePermission('wa_blaster'), (req, res) => {
  const source = db.prepare('SELECT * FROM wa_templates WHERE id = ?').get(Number(req.params.id)) as
    | { id: number; title: string; category: string; content: string }
    | undefined;
  if (!source) {
    res.status(404).json({ error: 'Template pesan tidak ditemukan.' });
    return;
  }
  const newTitle = `${source.title} (Salinan)`;
  const result = db
    .prepare("INSERT INTO wa_templates (title, category, content, status) VALUES (?, ?, ?, 'draft')")
    .run(newTitle, source.category, source.content);
  const duplicated = db.prepare('SELECT * FROM wa_templates WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ id: result.lastInsertRowid, template: duplicated });
});

app.delete('/api/admin/wa-blaster/templates/:id', requireAdmin, requirePermission('wa_blaster'), (req, res) => {
  db.prepare('DELETE FROM wa_templates WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.get('/api/admin/wa-blaster/blasts', requireAdmin, requirePermission('wa_blaster'), (_req, res) => {
  const blasts = db.prepare('SELECT * FROM wa_blasts ORDER BY id DESC LIMIT 50').all();
  res.json({ blasts });
});

app.get('/api/admin/wa-blaster/blasts/:id', requireAdmin, requirePermission('wa_blaster'), (req, res) => {
  const id = Number(req.params.id);
  const blast = db.prepare('SELECT * FROM wa_blasts WHERE id = ?').get(id);
  if (!blast) {
    res.status(404).json({ error: 'Sesi siaran WhatsApp tidak ditemukan.' });
    return;
  }
  const recipients = db
    .prepare('SELECT * FROM wa_blast_recipients WHERE blast_id = ? ORDER BY id ASC')
    .all(id);
  res.json({ blast, recipients });
});

app.post('/api/admin/wa-blaster/blasts', requireAdmin, requirePermission('wa_blaster'), async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const b = (req.body || {}) as Record<string, unknown>;
  const title = String(b.title || '').trim() || `Siaran Desa · ${formatIndonesianTodayLabel()}`;
  const messageTemplate = String(b.message_template || '').trim();
  const deliveryMode = b.delivery_mode === 'gateway_api' ? 'gateway_api' : 'wa_me_queue';
  const recipientKeys = Array.isArray(b.recipient_keys)
    ? b.recipient_keys.filter((k): k is string => typeof k === 'string')
    : [];

  if (!messageTemplate) {
    res.status(400).json({ error: 'Isi pesan WhatsApp wajib diisi.' });
    return;
  }
  if (recipientKeys.length === 0) {
    res.status(400).json({ error: 'Pilih minimal 1 penerima dengan nomor WhatsApp aktif.' });
    return;
  }

  const gatewayStatus = getWaGatewayStatus();
  if (deliveryMode === 'gateway_api' && !gatewayStatus.configured) {
    res.status(400).json({
      error: 'Gateway API server belum dikonfigurasi pada environment. Gunakan Mode Antrean wa.me gratis.',
    });
    return;
  }

  const directory = collectWaRecipientsDirectory(user);
  const byKey = new Map(directory.map((item) => [item.key, item]));
  const selectedContacts = recipientKeys
    .map((key) => byKey.get(key))
    .filter((item): item is NonNullable<typeof item> => Boolean(item && item.hasValidPhone));

  if (selectedContacts.length === 0) {
    res.status(400).json({ error: 'Tidak ada penerima terpilih yang memiliki nomor WhatsApp valid.' });
    return;
  }

  const roleCounts = selectedContacts.reduce<Record<string, number>>((acc, item) => {
    acc[item.roleLabel] = (acc[item.roleLabel] || 0) + 1;
    return acc;
  }, {});
  const targetSummary = Object.entries(roleCounts)
    .map(([label, count]) => `${count} ${label}`)
    .join(' · ');

  const todayLabel = formatIndonesianTodayLabel();
  const createdBy = user?.fullName || 'Admin Desa';

  const blastId = db.transaction(() => {
    const insertBlast = db
      .prepare(
        `INSERT INTO wa_blasts (title, message_template, delivery_mode, target_summary, total_recipients, sent_count, failed_count, status, created_by)
         VALUES (?, ?, ?, ?, ?, 0, 0, 'in_progress', ?)`
      )
      .run(title, messageTemplate, deliveryMode, targetSummary, selectedContacts.length, createdBy);

    const newBlastId = Number(insertBlast.lastInsertRowid);
    const insertRec = db.prepare(
      `INSERT INTO wa_blast_recipients
       (blast_id, recipient_key, name, role_label, role_group, wilayah_label, phone, rendered_message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    );

    for (const contact of selectedContacts) {
      const rendered = renderWaMessageTemplate(
        messageTemplate,
        {
          name: contact.name,
          jabatan: contact.jabatan,
          wilayah: contact.wilayah,
          dusun: contact.dusun,
        },
        todayLabel
      );
      insertRec.run(
        newBlastId,
        contact.key,
        contact.name,
        contact.roleLabel,
        contact.roleGroup,
        contact.wilayah,
        contact.normalizedPhone,
        rendered
      );
    }

    return newBlastId;
  })();

  if (deliveryMode === 'gateway_api') {
    await runGatewayBlastSession(blastId);
  }

  const blast = db.prepare('SELECT * FROM wa_blasts WHERE id = ?').get(blastId);
  const recipients = db
    .prepare('SELECT * FROM wa_blast_recipients WHERE blast_id = ? ORDER BY id ASC')
    .all(blastId);
  res.status(201).json({ blast, recipients });
});

app.patch(
  '/api/admin/wa-blaster/blasts/:blastId/recipients/:recipientId',
  requireAdmin,
  requirePermission('wa_blaster'),
  (req, res) => {
    const blastId = Number(req.params.blastId);
    const recipientId = Number(req.params.recipientId);
    const statusRaw = String((req.body || {}).status || '').trim();
    if (!['pending', 'sent', 'skipped', 'failed'].includes(statusRaw)) {
      res.status(400).json({ error: 'Status pengiriman tidak valid.' });
      return;
    }

    const existing = db
      .prepare('SELECT id FROM wa_blast_recipients WHERE id = ? AND blast_id = ?')
      .get(recipientId, blastId);
    if (!existing) {
      res.status(404).json({ error: 'Data penerima antrean tidak ditemukan.' });
      return;
    }

    db.prepare(
      `UPDATE wa_blast_recipients
       SET status = ?,
           sent_at = CASE WHEN ? = 'sent' THEN COALESCE(sent_at, datetime('now')) ELSE NULL END
       WHERE id = ? AND blast_id = ?`
    ).run(statusRaw, statusRaw, recipientId, blastId);

    recomputeBlastSummary(blastId);

    const blast = db.prepare('SELECT * FROM wa_blasts WHERE id = ?').get(blastId);
    const recipients = db
      .prepare('SELECT * FROM wa_blast_recipients WHERE blast_id = ? ORDER BY id ASC')
      .all(blastId);
    res.json({ blast, recipients });
  }
);

app.delete('/api/admin/wa-blaster/blasts/:id', requireAdmin, requirePermission('wa_blaster'), (req, res) => {
  db.prepare('DELETE FROM wa_blasts WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ============================================================================
// ADMIN AI KNOWLEDGE BASE ROUTES (BASIS PENGETAHUAN ASISTEN AI)
// ============================================================================

const AI_KB_CATEGORIES = new Set(['DTSEN', 'Bansos', 'Adminduk', 'Pemerintahan Daerah', 'Pemerintahan Desa']);

app.get('/api/admin/ai-knowledge', requireAdmin, requirePermission('ai_knowledge'), (_req, res) => {
  const entries = db
    .prepare('SELECT * FROM ai_knowledge_entries ORDER BY sort_order ASC, id DESC')
    .all();
  res.json({ entries });
});

app.post('/api/admin/ai-knowledge', requireAdmin, requirePermission('ai_knowledge'), (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const user = (req as AuthenticatedRequest).user;
  const category = String(b.category || 'DTSEN').trim();
  const title = String(b.title || '').trim();
  const content = String(b.content || '').trim();
  if (!AI_KB_CATEGORIES.has(category)) {
    res.status(400).json({ error: 'Kategori basis pengetahuan tidak valid.' });
    return;
  }
  if (!title || !content) {
    res.status(400).json({ error: 'Judul panduan dan isi materi juknis wajib diisi.' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO ai_knowledge_entries (
        category, title, keywords, summary, content, official_source,
        related_route, related_subtab, related_label, is_active, sort_order, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      category,
      title,
      String(b.keywords || '').trim(),
      String(b.summary || '').trim(),
      content,
      String(b.official_source || '').trim(),
      String(b.related_route || '').trim(),
      String(b.related_subtab || '').trim(),
      String(b.related_label || '').trim(),
      b.is_active === false || b.is_active === 0 ? 0 : 1,
      Number(b.sort_order || 10),
      user?.fullName || 'Admin'
    );

  const created = db.prepare('SELECT * FROM ai_knowledge_entries WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ id: result.lastInsertRowid, entry: created });
});

app.put('/api/admin/ai-knowledge/:id', requireAdmin, requirePermission('ai_knowledge'), (req, res) => {
  const id = Number(req.params.id);
  const b = (req.body || {}) as Record<string, unknown>;
  const user = (req as AuthenticatedRequest).user;
  const category = String(b.category || 'DTSEN').trim();
  const title = String(b.title || '').trim();
  const content = String(b.content || '').trim();
  if (!AI_KB_CATEGORIES.has(category)) {
    res.status(400).json({ error: 'Kategori basis pengetahuan tidak valid.' });
    return;
  }
  if (!title || !content) {
    res.status(400).json({ error: 'Judul panduan dan isi materi juknis wajib diisi.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM ai_knowledge_entries WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Entri basis pengetahuan tidak ditemukan.' });
    return;
  }

  db.prepare(
    `UPDATE ai_knowledge_entries
     SET category = ?, title = ?, keywords = ?, summary = ?, content = ?,
         official_source = ?, related_route = ?, related_subtab = ?, related_label = ?,
         is_active = ?, sort_order = ?, updated_by = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    category,
    title,
    String(b.keywords || '').trim(),
    String(b.summary || '').trim(),
    content,
    String(b.official_source || '').trim(),
    String(b.related_route || '').trim(),
    String(b.related_subtab || '').trim(),
    String(b.related_label || '').trim(),
    b.is_active === false || b.is_active === 0 ? 0 : 1,
    Number(b.sort_order || 10),
    user?.fullName || 'Admin',
    id
  );

  const updated = db.prepare('SELECT * FROM ai_knowledge_entries WHERE id = ?').get(id);
  res.json({ ok: true, entry: updated });
});

app.patch('/api/admin/ai-knowledge/:id/toggle', requireAdmin, requirePermission('ai_knowledge'), (req, res) => {
  const id = Number(req.params.id);
  const user = (req as AuthenticatedRequest).user;
  const row = db.prepare('SELECT id, is_active FROM ai_knowledge_entries WHERE id = ?').get(id) as
    | { id: number; is_active: number }
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Entri basis pengetahuan tidak ditemukan.' });
    return;
  }
  const nextActive = row.is_active === 1 ? 0 : 1;
  db.prepare(
    "UPDATE ai_knowledge_entries SET is_active = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(nextActive, user?.fullName || 'Admin', id);
  res.json({ ok: true, is_active: nextActive });
});

app.delete('/api/admin/ai-knowledge/:id', requireAdmin, requirePermission('ai_knowledge'), (req, res) => {
  db.prepare('DELETE FROM ai_knowledge_entries WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ============================================================================
// PORTOFOLIO PEMERINTAH DESA & MANAJEMEN PEMBANGUNAN DESA
// ============================================================================

const PORTFOLIO_SECTION_TYPES = new Set([
  'program_unggulan',
  'penghargaan',
  'sinergi',
  'potensi_unggulan',
]);

function computeDevelopmentTotals(
  rows: Array<{ budget_amount?: number; progress_percent?: number }>
) {
  const totalProjects = rows.length;
  const completedProjects = rows.filter((r) => Number(r.progress_percent || 0) >= 100).length;
  const ongoingProjects = rows.filter((r) => {
    const p = Number(r.progress_percent || 0);
    return p > 0 && p < 100;
  }).length;
  const totalBudget = rows.reduce((sum, r) => sum + Number(r.budget_amount || 0), 0);
  const avgProgress =
    totalProjects > 0
      ? Math.round(
          rows.reduce((sum, r) => sum + Math.min(100, Math.max(0, Number(r.progress_percent || 0))), 0) /
            totalProjects
        )
      : 0;
  return {
    totalProjects,
    completedProjects,
    ongoingProjects,
    totalBudget,
    avgProgress,
  };
}

app.get('/api/public/portfolio', (_req, res) => {
  const settings = db.prepare('SELECT * FROM village_settings WHERE id = 1').get();
  const portfolioSettings = db.prepare('SELECT * FROM portfolio_settings WHERE id = 1').get();
  const stats = getPopulationStats();
  const officials = db.prepare('SELECT * FROM officials ORDER BY sort_order ASC, id ASC').all();

  const rawInstitutions = db
    .prepare('SELECT * FROM village_institutions WHERE is_active = 1 ORDER BY id ASC')
    .all() as Array<Record<string, unknown>>;
  const memberStmt = db.prepare(
    'SELECT * FROM institution_members WHERE institution_id = ? ORDER BY sort_order ASC, id ASC'
  );
  const institutions = rawInstitutions.map((inst) => {
    let tupoksi: string[] = [];
    try {
      const parsed = JSON.parse(String(inst.tupoksi || '[]'));
      if (Array.isArray(parsed)) tupoksi = parsed.map((x) => String(x));
    } catch {
      tupoksi = [];
    }
    return {
      ...inst,
      tupoksi,
      members: memberStmt.all(Number(inst.id)),
    };
  });

  const latestApbdesYearRow = db
    .prepare('SELECT MAX(fiscal_year) as y FROM apbdes_items')
    .get() as { y: number | null };
  const apbdesYear = latestApbdesYearRow?.y || new Date().getFullYear();
  const apbdesRows = db
    .prepare('SELECT type, budget_amount, realized_amount FROM apbdes_items WHERE fiscal_year = ?')
    .all(apbdesYear) as Array<{ type: string; budget_amount: number; realized_amount: number }>;

  let pendapatanBudget = 0;
  let pendapatanRealized = 0;
  let belanjaBudget = 0;
  let belanjaRealized = 0;
  for (const row of apbdesRows) {
    if (row.type === 'Pendapatan') {
      pendapatanBudget += Number(row.budget_amount || 0);
      pendapatanRealized += Number(row.realized_amount || 0);
    } else if (row.type === 'Belanja') {
      belanjaBudget += Number(row.budget_amount || 0);
      belanjaRealized += Number(row.realized_amount || 0);
    }
  }

  const publishedItems = db
    .prepare(
      'SELECT * FROM portfolio_items WHERE is_published = 1 ORDER BY sort_order ASC, id ASC'
    )
    .all() as Array<{ section_type: string }>;

  const itemsBySection: Record<string, unknown[]> = {
    program_unggulan: [],
    penghargaan: [],
    sinergi: [],
    potensi_unggulan: [],
  };
  for (const it of publishedItems) {
    if (itemsBySection[it.section_type]) {
      itemsBySection[it.section_type].push(it);
    }
  }

  const developments = db
    .prepare(
      'SELECT * FROM village_developments WHERE is_published = 1 ORDER BY fiscal_year DESC, progress_percent DESC, id DESC'
    )
    .all() as Array<{ budget_amount?: number; progress_percent?: number }>;

  res.json({
    settings,
    portfolioSettings,
    stats,
    officials,
    institutions,
    apbdesSummary: {
      year: apbdesYear,
      pendapatanBudget,
      pendapatanRealized,
      belanjaBudget,
      belanjaRealized,
    },
    itemsBySection,
    developments,
    developmentTotals: computeDevelopmentTotals(developments),
  });
});

app.get('/api/public/developments', (req, res) => {
  const yearFilter = Number(req.query.year || 0);
  const fundingFilter = String(req.query.funding_source || '').trim();

  const allPublished = db
    .prepare(
      'SELECT * FROM village_developments WHERE is_published = 1 ORDER BY fiscal_year DESC, progress_percent DESC, id DESC'
    )
    .all() as Array<{
    fiscal_year: number;
    funding_source: string;
    budget_amount: number;
    progress_percent: number;
  }>;

  const years = Array.from(new Set(allPublished.map((d) => Number(d.fiscal_year)))).sort(
    (a, b) => b - a
  );
  const fundingSources = Array.from(
    new Set(allPublished.map((d) => String(d.funding_source || '').trim()).filter(Boolean))
  );

  const filtered = allPublished.filter((d) => {
    const okYear = !yearFilter || Number(d.fiscal_year) === yearFilter;
    const okSource =
      !fundingFilter ||
      fundingFilter === 'Semua' ||
      String(d.funding_source || '').trim() === fundingFilter;
    return okYear && okSource;
  });

  res.json({
    developments: filtered,
    years,
    fundingSources,
    totals: computeDevelopmentTotals(filtered),
  });
});

app.get('/api/admin/portfolio', requireAdmin, requirePermission('portofolio'), (_req, res) => {
  const settings = db.prepare('SELECT * FROM portfolio_settings WHERE id = 1').get();
  const items = db
    .prepare('SELECT * FROM portfolio_items ORDER BY section_type ASC, sort_order ASC, id ASC')
    .all();
  res.json({ settings, items });
});

app.put('/api/admin/portfolio/settings', requireAdmin, requirePermission('portofolio'), (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const user = (req as AuthenticatedRequest).user;
  const title = String(b.portfolio_title || '').trim();
  const execSummary = String(b.executive_summary || '').trim();
  if (!title || !execSummary) {
    res.status(400).json({ error: 'Judul portofolio dan ringkasan eksekutif wajib diisi.' });
    return;
  }

  db.prepare(
    `UPDATE portfolio_settings
     SET portfolio_title = ?, portfolio_subtitle = ?, executive_summary = ?,
         profile_narrative = ?, demographic_narrative = ?, synergy_narrative = ?,
         idm_score = ?, idm_status = ?, sdgs_score = ?, area_size = ?,
         boundaries_north = ?, boundaries_east = ?, boundaries_south = ?, boundaries_west = ?,
         strategic_partners = ?, closing_statement = ?, updated_by = ?, updated_at = datetime('now')
     WHERE id = 1`
  ).run(
    title,
    String(b.portfolio_subtitle || '').trim(),
    execSummary,
    String(b.profile_narrative || '').trim(),
    String(b.demographic_narrative || '').trim(),
    String(b.synergy_narrative || '').trim(),
    String(b.idm_score || '').trim(),
    String(b.idm_status || '').trim(),
    String(b.sdgs_score || '').trim(),
    String(b.area_size || '').trim(),
    String(b.boundaries_north || '').trim(),
    String(b.boundaries_east || '').trim(),
    String(b.boundaries_south || '').trim(),
    String(b.boundaries_west || '').trim(),
    String(b.strategic_partners || '').trim(),
    String(b.closing_statement || '').trim(),
    user?.fullName || 'Admin'
  );

  const updated = db.prepare('SELECT * FROM portfolio_settings WHERE id = 1').get();
  res.json({ ok: true, settings: updated });
});

app.post('/api/admin/portfolio/items', requireAdmin, requirePermission('portofolio'), (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const user = (req as AuthenticatedRequest).user;
  const sectionType = String(b.section_type || '').trim();
  const title = String(b.title || '').trim();

  if (!PORTFOLIO_SECTION_TYPES.has(sectionType)) {
    res.status(400).json({ error: 'Jenis bagian portofolio tidak valid.' });
    return;
  }
  if (!title) {
    res.status(400).json({ error: 'Judul entri portofolio wajib diisi.' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO portfolio_items (
        section_type, title, category, year_label, issuer_or_partner,
        status_label, impact_summary, description, sort_order, is_published, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sectionType,
      title,
      String(b.category || '').trim(),
      String(b.year_label || String(new Date().getFullYear())).trim(),
      String(b.issuer_or_partner || '').trim(),
      String(b.status_label || 'Aktif').trim(),
      String(b.impact_summary || '').trim(),
      String(b.description || '').trim(),
      Number(b.sort_order || 1),
      b.is_published === false || b.is_published === 0 ? 0 : 1,
      user?.fullName || 'Admin'
    );

  const created = db
    .prepare('SELECT * FROM portfolio_items WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json({ ok: true, id: result.lastInsertRowid, item: created });
});

app.put('/api/admin/portfolio/items/:id', requireAdmin, requirePermission('portofolio'), (req, res) => {
  const id = Number(req.params.id);
  const b = (req.body || {}) as Record<string, unknown>;
  const user = (req as AuthenticatedRequest).user;
  const sectionType = String(b.section_type || '').trim();
  const title = String(b.title || '').trim();

  if (!PORTFOLIO_SECTION_TYPES.has(sectionType)) {
    res.status(400).json({ error: 'Jenis bagian portofolio tidak valid.' });
    return;
  }
  if (!title) {
    res.status(400).json({ error: 'Judul entri portofolio wajib diisi.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM portfolio_items WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Entri portofolio tidak ditemukan.' });
    return;
  }

  db.prepare(
    `UPDATE portfolio_items
     SET section_type = ?, title = ?, category = ?, year_label = ?, issuer_or_partner = ?,
         status_label = ?, impact_summary = ?, description = ?, sort_order = ?,
         is_published = ?, updated_by = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    sectionType,
    title,
    String(b.category || '').trim(),
    String(b.year_label || String(new Date().getFullYear())).trim(),
    String(b.issuer_or_partner || '').trim(),
    String(b.status_label || 'Aktif').trim(),
    String(b.impact_summary || '').trim(),
    String(b.description || '').trim(),
    Number(b.sort_order || 1),
    b.is_published === false || b.is_published === 0 ? 0 : 1,
    user?.fullName || 'Admin',
    id
  );

  const updated = db.prepare('SELECT * FROM portfolio_items WHERE id = ?').get(id);
  res.json({ ok: true, item: updated });
});

app.delete('/api/admin/portfolio/items/:id', requireAdmin, requirePermission('portofolio'), (req, res) => {
  db.prepare('DELETE FROM portfolio_items WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.get('/api/admin/developments', requireAdmin, requirePermission('pembangunan'), (_req, res) => {
  const developments = db
    .prepare('SELECT * FROM village_developments ORDER BY fiscal_year DESC, id DESC')
    .all() as Array<{ budget_amount?: number; progress_percent?: number }>;
  res.json({
    developments,
    totals: computeDevelopmentTotals(developments),
  });
});

app.post('/api/admin/developments', requireAdmin, requirePermission('pembangunan'), (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const user = (req as AuthenticatedRequest).user;
  const name = String(b.name || '').trim();
  const fundingSource = String(b.funding_source || '').trim();
  const volume = String(b.volume || '').trim();
  const executor = String(b.executor || '').trim();
  const locationRegion = String(b.location_region || '').trim();

  if (!name || !fundingSource || !volume || !executor || !locationRegion) {
    res.status(400).json({
      error: 'Nama pembangunan, sumber dana, volume, pelaksana, dan lokasi wilayah wajib diisi.',
    });
    return;
  }

  const budgetAmount = Math.max(0, Math.round(Number(b.budget_amount || 0)));
  const progressPercent = Math.min(100, Math.max(0, Math.round(Number(b.progress_percent || 0))));
  const fiscalYear = Number(b.fiscal_year || new Date().getFullYear());
  const rawLat = b.latitude !== null && b.latitude !== undefined && b.latitude !== '' ? Number(b.latitude) : null;
  const rawLng = b.longitude !== null && b.longitude !== undefined && b.longitude !== '' ? Number(b.longitude) : null;
  const latitude = rawLat !== null && Number.isFinite(rawLat) ? rawLat : null;
  const longitude = rawLng !== null && Number.isFinite(rawLng) ? rawLng : null;

  const result = db
    .prepare(
      `INSERT INTO village_developments (
        name, budget_amount, funding_source, volume, progress_percent,
        fiscal_year, executor, location_region, latitude, longitude,
        photo_url, description, is_published, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      budgetAmount,
      fundingSource,
      volume,
      progressPercent,
      fiscalYear,
      executor,
      locationRegion,
      latitude,
      longitude,
      String(b.photo_url || '').trim(),
      String(b.description || '').trim(),
      b.is_published === false || b.is_published === 0 ? 0 : 1,
      user?.fullName || 'Admin'
    );

  const created = db
    .prepare('SELECT * FROM village_developments WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json({ ok: true, id: result.lastInsertRowid, development: created });
});

app.put('/api/admin/developments/:id', requireAdmin, requirePermission('pembangunan'), (req, res) => {
  const id = Number(req.params.id);
  const b = (req.body || {}) as Record<string, unknown>;
  const user = (req as AuthenticatedRequest).user;
  const existing = db.prepare('SELECT id FROM village_developments WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Data pembangunan tidak ditemukan.' });
    return;
  }

  const name = String(b.name || '').trim();
  const fundingSource = String(b.funding_source || '').trim();
  const volume = String(b.volume || '').trim();
  const executor = String(b.executor || '').trim();
  const locationRegion = String(b.location_region || '').trim();

  if (!name || !fundingSource || !volume || !executor || !locationRegion) {
    res.status(400).json({
      error: 'Nama pembangunan, sumber dana, volume, pelaksana, dan lokasi wilayah wajib diisi.',
    });
    return;
  }

  const budgetAmount = Math.max(0, Math.round(Number(b.budget_amount || 0)));
  const progressPercent = Math.min(100, Math.max(0, Math.round(Number(b.progress_percent || 0))));
  const fiscalYear = Number(b.fiscal_year || new Date().getFullYear());
  const rawLat = b.latitude !== null && b.latitude !== undefined && b.latitude !== '' ? Number(b.latitude) : null;
  const rawLng = b.longitude !== null && b.longitude !== undefined && b.longitude !== '' ? Number(b.longitude) : null;
  const latitude = rawLat !== null && Number.isFinite(rawLat) ? rawLat : null;
  const longitude = rawLng !== null && Number.isFinite(rawLng) ? rawLng : null;

  db.prepare(
    `UPDATE village_developments
     SET name = ?, budget_amount = ?, funding_source = ?, volume = ?, progress_percent = ?,
         fiscal_year = ?, executor = ?, location_region = ?, latitude = ?, longitude = ?,
         photo_url = ?, description = ?, is_published = ?, updated_by = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name,
    budgetAmount,
    fundingSource,
    volume,
    progressPercent,
    fiscalYear,
    executor,
    locationRegion,
    latitude,
    longitude,
    String(b.photo_url || '').trim(),
    String(b.description || '').trim(),
    b.is_published === false || b.is_published === 0 ? 0 : 1,
    user?.fullName || 'Admin',
    id
  );

  const updated = db.prepare('SELECT * FROM village_developments WHERE id = ?').get(id);
  res.json({ ok: true, development: updated });
});

app.delete('/api/admin/developments/:id', requireAdmin, requirePermission('pembangunan'), (req, res) => {
  db.prepare('DELETE FROM village_developments WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ============================================================================
// KALENDER HARI BESAR INDONESIA BAKU & UCAPAN RESMI PEMERINTAH DESA
// ============================================================================

const HOLIDAY_CATEGORY_LABELS: Record<string, string> = {
  libur_nasional: 'Libur Nasional (SKB 3 Menteri)',
  cuti_bersama: 'Cuti Bersama Pemerintah',
  peringatan_nasional: 'Hari Peringatan Nasional',
  daerah_desa: 'Hari Jadi Daerah & Desa',
};

const INDO_MONTHS_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function getJakartaTodayIso(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback to local ISO date
  }
  return new Date().toISOString().slice(0, 10);
}

function formatIndoDateLabel(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || '').trim());
  if (!m) return isoDate;
  const monthIdx = Number(m[2]) - 1;
  return `${Number(m[3])} ${INDO_MONTHS_LONG[monthIdx] || m[2]} ${m[1]}`;
}

function inferGreetingTone(
  category: string,
  name: string
): 'resmi' | 'religius' | 'nasional' | 'daerah' | 'duka' {
  if (category === 'daerah_desa') return 'daerah';
  const lower = String(name || '').toLowerCase();
  if (
    /(idul|isra|maulid|muharam|natal|yesus|paskah|nyepi|waisak|imlek|santri|amal bakti)/i.test(
      lower
    )
  ) {
    return 'religius';
  }
  if (category === 'libur_nasional' || category === 'peringatan_nasional') return 'nasional';
  return 'resmi';
}

interface HolidayDbRow {
  id: number;
  holiday_date: string;
  month_day: string;
  name: string;
  category: string;
  is_annual: number;
  is_official_holiday: number;
  description: string;
  default_greeting: string;
  is_active: number;
  created_at?: string;
  updated_at?: string;
}

interface GreetingDbRow {
  id: number;
  holiday_id: number | null;
  holiday_name?: string;
  moment_title: string;
  greeting_text: string;
  sender_label: string;
  theme_tone: 'resmi' | 'religius' | 'nasional' | 'daerah' | 'duka';
  start_date: string;
  end_date: string;
  is_pinned: number;
  is_active: number;
  updated_by: string;
  created_at?: string;
  updated_at?: string;
}

function getProjectedHolidaysForYear(targetYear: number, activeOnly = true) {
  const rows = db
    .prepare(
      activeOnly
        ? 'SELECT * FROM national_holidays WHERE is_active = 1 ORDER BY month_day ASC, id ASC'
        : 'SELECT * FROM national_holidays ORDER BY month_day ASC, id ASC'
    )
    .all() as HolidayDbRow[];

  const activeGreetings = db
    .prepare(
      `SELECT g.*, h.name as holiday_name
       FROM village_greetings g
       LEFT JOIN national_holidays h ON h.id = g.holiday_id
       WHERE g.is_active = 1
       ORDER BY g.is_pinned DESC, g.start_date DESC, g.id DESC`
    )
    .all() as GreetingDbRow[];

  const greetingByHolidayId = new Map<number, GreetingDbRow>();
  for (const g of activeGreetings) {
    if (g.holiday_id && !greetingByHolidayId.has(g.holiday_id)) {
      greetingByHolidayId.set(g.holiday_id, g);
    }
  }

  const projected: Array<
    HolidayDbRow & { projected_date: string; custom_greeting: GreetingDbRow | null }
  > = [];

  for (const r of rows) {
    let projectedDate = '';
    if (r.is_annual === 1) {
      if (r.month_day === '02-29') {
        const isLeap =
          (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0;
        projectedDate = isLeap ? `${targetYear}-02-29` : `${targetYear}-02-28`;
      } else {
        projectedDate = `${targetYear}-${r.month_day}`;
      }
    } else if (r.holiday_date.startsWith(`${targetYear}-`)) {
      projectedDate = r.holiday_date;
    }

    if (!projectedDate) continue;

    projected.push({
      ...r,
      projected_date: projectedDate,
      custom_greeting: greetingByHolidayId.get(r.id) || null,
    });
  }

  projected.sort((a, b) => {
    if (a.projected_date !== b.projected_date) {
      return a.projected_date.localeCompare(b.projected_date);
    }
    if (b.is_official_holiday !== a.is_official_holiday) {
      return b.is_official_holiday - a.is_official_holiday;
    }
    return a.id - b.id;
  });

  return projected;
}

function resolveActiveGreetings(todayIso: string) {
  const results: Array<{
    key: string;
    source: 'pinned' | 'custom_schedule' | 'auto_holiday' | 'upcoming_holiday';
    greetingId: number | null;
    holidayId: number | null;
    momentTitle: string;
    greetingText: string;
    senderLabel: string;
    themeTone: 'resmi' | 'religius' | 'nasional' | 'daerah' | 'duka';
    dateLabel: string;
    categoryLabel: string;
    isPinned: boolean;
  }> = [];

  const seenGreetingIds = new Set<number>();
  const seenHolidayIds = new Set<number>();

  // 1. Ucapan yang disematkan (pinned) & aktif oleh Admin
  const pinnedRows = db
    .prepare(
      `SELECT g.*, h.name as holiday_name, h.category as holiday_category
       FROM village_greetings g
       LEFT JOIN national_holidays h ON h.id = g.holiday_id
       WHERE g.is_active = 1 AND g.is_pinned = 1
       ORDER BY g.updated_at DESC, g.id DESC`
    )
    .all() as Array<GreetingDbRow & { holiday_category?: string }>;

  for (const row of pinnedRows) {
    seenGreetingIds.add(row.id);
    if (row.holiday_id) seenHolidayIds.add(row.holiday_id);
    results.push({
      key: `greeting-${row.id}`,
      source: 'pinned',
      greetingId: row.id,
      holidayId: row.holiday_id,
      momentTitle: row.moment_title,
      greetingText: row.greeting_text,
      senderLabel: row.sender_label || 'Pemerintah Desa Margamukti',
      themeTone: row.theme_tone || 'resmi',
      dateLabel:
        row.start_date === row.end_date
          ? formatIndoDateLabel(row.start_date)
          : `${formatIndoDateLabel(row.start_date)} – ${formatIndoDateLabel(row.end_date)}`,
      categoryLabel: row.holiday_category
        ? HOLIDAY_CATEGORY_LABELS[row.holiday_category] || 'Ucapan Resmi Desa'
        : 'Ucapan Resmi Pemerintah Desa',
      isPinned: true,
    });
  }

  // 2. Ucapan terjadwal aktif sesuai rentang tanggal hari ini
  const scheduledRows = db
    .prepare(
      `SELECT g.*, h.name as holiday_name, h.category as holiday_category
       FROM village_greetings g
       LEFT JOIN national_holidays h ON h.id = g.holiday_id
       WHERE g.is_active = 1 AND g.start_date <= ? AND g.end_date >= ?
       ORDER BY g.start_date DESC, g.id DESC`
    )
    .all(todayIso, todayIso) as Array<GreetingDbRow & { holiday_category?: string }>;

  for (const row of scheduledRows) {
    if (seenGreetingIds.has(row.id)) continue;
    seenGreetingIds.add(row.id);
    if (row.holiday_id) seenHolidayIds.add(row.holiday_id);
    results.push({
      key: `greeting-${row.id}`,
      source: 'custom_schedule',
      greetingId: row.id,
      holidayId: row.holiday_id,
      momentTitle: row.moment_title,
      greetingText: row.greeting_text,
      senderLabel: row.sender_label || 'Pemerintah Desa Margamukti',
      themeTone: row.theme_tone || 'resmi',
      dateLabel:
        row.start_date === row.end_date
          ? formatIndoDateLabel(row.start_date)
          : `${formatIndoDateLabel(row.start_date)} – ${formatIndoDateLabel(row.end_date)}`,
      categoryLabel: row.holiday_category
        ? HOLIDAY_CATEGORY_LABELS[row.holiday_category] || 'Momen Terjadwal Desa'
        : 'Ucapan Resmi Pemerintah Desa',
      isPinned: false,
    });
  }

  // 3. Otomatis dari Kalender Hari Besar Indonesia yang bertepatan persis dengan hari ini
  const currentYear = Number(todayIso.slice(0, 4)) || new Date().getFullYear();
  const yearHolidays = getProjectedHolidaysForYear(currentYear, true);
  const todayHolidays = yearHolidays.filter(
    (h) => h.projected_date === todayIso && !seenHolidayIds.has(h.id)
  );

  for (const h of todayHolidays) {
    seenHolidayIds.add(h.id);
    results.push({
      key: `holiday-${h.id}-${h.projected_date}`,
      source: 'auto_holiday',
      greetingId: null,
      holidayId: h.id,
      momentTitle: h.name,
      greetingText:
        h.default_greeting ||
        `Pemerintah Desa Margamukti mengucapkan Selamat Memperingati ${h.name}.`,
      senderLabel: 'Pemerintah Desa Margamukti',
      themeTone: inferGreetingTone(h.category, h.name),
      dateLabel: formatIndoDateLabel(h.projected_date),
      categoryLabel: HOLIDAY_CATEGORY_LABELS[h.category] || 'Hari Besar Indonesia',
      isPinned: false,
    });
  }

  return results;
}

// Public Calendar & Active Greetings Endpoints
app.get('/api/public/calendar', (req, res) => {
  const today = getJakartaTodayIso();
  const defaultYear = Number(today.slice(0, 4)) || 2026;
  const defaultMonth = Number(today.slice(5, 7)) || 1;

  const yearRaw = Number(req.query.year);
  const year =
    Number.isInteger(yearRaw) && yearRaw >= 2020 && yearRaw <= 2035 ? yearRaw : defaultYear;

  const monthQuery = req.query.month;
  const monthRaw = monthQuery !== undefined ? Number(monthQuery) : defaultMonth;
  const month =
    monthQuery === 'all'
      ? null
      : Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12
        ? monthRaw
        : defaultMonth;

  const yearHolidays = getProjectedHolidaysForYear(year, true);
  const monthPrefix = month ? `${year}-${String(month).padStart(2, '0')}-` : null;
  const holidays = monthPrefix
    ? yearHolidays.filter((h) => h.projected_date.startsWith(monthPrefix))
    : yearHolidays;

  const summary = {
    liburNasional: yearHolidays.filter((h) => h.category === 'libur_nasional').length,
    cutiBersama: yearHolidays.filter((h) => h.category === 'cuti_bersama').length,
    peringatanNasional: yearHolidays.filter((h) => h.category === 'peringatan_nasional').length,
    daerahDesa: yearHolidays.filter((h) => h.category === 'daerah_desa').length,
  };

  res.json({
    year,
    month,
    today,
    holidays,
    yearHolidays,
    summary,
  });
});

app.get('/api/public/greetings/active', (_req, res) => {
  const today = getJakartaTodayIso();
  const activeGreetings = resolveActiveGreetings(today);
  res.json({ today, activeGreetings });
});

// Admin National Holidays CRUD
app.get('/api/admin/holidays', requireAdmin, requirePermission('agenda'), (_req, res) => {
  const holidays = db
    .prepare(
      `SELECT * FROM national_holidays
       ORDER BY month_day ASC, holiday_date ASC, id ASC`
    )
    .all();
  res.json({ holidays });
});

app.post('/api/admin/holidays', requireAdmin, requirePermission('agenda'), (req, res) => {
  const b = req.body || {};
  const holidayDate = String(b.holiday_date || '').trim();
  const name = String(b.name || '').trim();
  const category = String(b.category || 'peringatan_nasional').trim();
  const validCategories = ['libur_nasional', 'cuti_bersama', 'peringatan_nasional', 'daerah_desa'];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate) || !name) {
    res.status(400).json({ error: 'Tanggal (YYYY-MM-DD) dan nama hari besar wajib diisi.' });
    return;
  }
  if (!validCategories.includes(category)) {
    res.status(400).json({ error: 'Kategori hari besar tidak valid.' });
    return;
  }

  const monthDay = holidayDate.slice(5, 10);
  const isAnnual = b.is_annual === true || b.is_annual === 1 ? 1 : 0;
  const isOfficialHoliday =
    b.is_official_holiday !== undefined
      ? b.is_official_holiday === true || b.is_official_holiday === 1
        ? 1
        : 0
      : category === 'libur_nasional' || category === 'cuti_bersama'
        ? 1
        : 0;
  const isActive = b.is_active === false || b.is_active === 0 ? 0 : 1;

  const result = db
    .prepare(
      `INSERT INTO national_holidays (
        holiday_date, month_day, name, category, is_annual, is_official_holiday,
        description, default_greeting, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      holidayDate,
      monthDay,
      name,
      category,
      isAnnual,
      isOfficialHoliday,
      String(b.description || '').trim(),
      String(b.default_greeting || '').trim(),
      isActive
    );

  const created = db
    .prepare('SELECT * FROM national_holidays WHERE id = ?')
    .get(Number(result.lastInsertRowid));
  res.status(201).json({ id: result.lastInsertRowid, holiday: created });
});

app.put('/api/admin/holidays/:id', requireAdmin, requirePermission('agenda'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM national_holidays WHERE id = ?').get(id) as
    | HolidayDbRow
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Hari besar tidak ditemukan.' });
    return;
  }

  const b = req.body || {};
  const holidayDate = String(b.holiday_date || existing.holiday_date).trim();
  const name = String(b.name || existing.name).trim();
  const category = String(b.category || existing.category).trim();
  const validCategories = ['libur_nasional', 'cuti_bersama', 'peringatan_nasional', 'daerah_desa'];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate) || !name) {
    res.status(400).json({ error: 'Tanggal (YYYY-MM-DD) dan nama hari besar wajib diisi.' });
    return;
  }
  if (!validCategories.includes(category)) {
    res.status(400).json({ error: 'Kategori hari besar tidak valid.' });
    return;
  }

  const monthDay = holidayDate.slice(5, 10);
  const isAnnual =
    b.is_annual !== undefined ? (b.is_annual === true || b.is_annual === 1 ? 1 : 0) : existing.is_annual;
  const isOfficialHoliday =
    b.is_official_holiday !== undefined
      ? b.is_official_holiday === true || b.is_official_holiday === 1
        ? 1
        : 0
      : existing.is_official_holiday;
  const isActive =
    b.is_active !== undefined ? (b.is_active === false || b.is_active === 0 ? 0 : 1) : existing.is_active;

  db.prepare(
    `UPDATE national_holidays SET
      holiday_date = ?, month_day = ?, name = ?, category = ?,
      is_annual = ?, is_official_holiday = ?, description = ?,
      default_greeting = ?, is_active = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    holidayDate,
    monthDay,
    name,
    category,
    isAnnual,
    isOfficialHoliday,
    b.description !== undefined ? String(b.description).trim() : existing.description,
    b.default_greeting !== undefined ? String(b.default_greeting).trim() : existing.default_greeting,
    isActive,
    id
  );

  const updated = db.prepare('SELECT * FROM national_holidays WHERE id = ?').get(id);
  res.json({ ok: true, holiday: updated });
});

app.patch('/api/admin/holidays/:id/toggle', requireAdmin, requirePermission('agenda'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare('SELECT id, is_active FROM national_holidays WHERE id = ?')
    .get(id) as { id: number; is_active: number } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Data hari besar tidak ditemukan.' });
    return;
  }
  const nextActive = existing.is_active === 1 ? 0 : 1;
  db.prepare("UPDATE national_holidays SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(
    nextActive,
    id
  );
  res.json({ ok: true, is_active: nextActive });
});

app.delete('/api/admin/holidays/:id', requireAdmin, requirePermission('agenda'), (req, res) => {
  db.prepare('DELETE FROM national_holidays WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Admin Official Village Greetings CRUD
app.get('/api/admin/greetings', requireAdmin, requirePermission('agenda'), (_req, res) => {
  const greetings = db
    .prepare(
      `SELECT g.*, h.name as holiday_name
       FROM village_greetings g
       LEFT JOIN national_holidays h ON h.id = g.holiday_id
       ORDER BY g.is_pinned DESC, g.is_active DESC, g.start_date DESC, g.id DESC`
    )
    .all();
  res.json({ greetings, today: getJakartaTodayIso() });
});

app.post('/api/admin/greetings', requireAdmin, requirePermission('agenda'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const b = req.body || {};
  const momentTitle = String(b.moment_title || '').trim();
  const greetingText = String(b.greeting_text || '').trim();
  const senderLabel = String(b.sender_label || 'Pemerintah Desa Margamukti').trim();
  const themeTone = String(b.theme_tone || 'resmi').trim();
  const startDate = String(b.start_date || getJakartaTodayIso()).trim();
  const endDate = String(b.end_date || startDate).trim();
  const holidayId =
    b.holiday_id !== null && b.holiday_id !== undefined && b.holiday_id !== ''
      ? Number(b.holiday_id)
      : null;

  if (!momentTitle || !greetingText) {
    res.status(400).json({ error: 'Judul momen/peringatan dan teks ucapan wajib diisi.' });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai harus berformat YYYY-MM-DD.' });
    return;
  }
  if (endDate < startDate) {
    res.status(400).json({ error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.' });
    return;
  }

  const validTones = ['resmi', 'religius', 'nasional', 'daerah', 'duka'];
  const safeTone = validTones.includes(themeTone) ? themeTone : 'resmi';

  const result = db
    .prepare(
      `INSERT INTO village_greetings (
        holiday_id, moment_title, greeting_text, sender_label, theme_tone,
        start_date, end_date, is_pinned, is_active, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      holidayId,
      momentTitle,
      greetingText,
      senderLabel || 'Pemerintah Desa Margamukti',
      safeTone,
      startDate,
      endDate,
      b.is_pinned === true || b.is_pinned === 1 ? 1 : 0,
      b.is_active === false || b.is_active === 0 ? 0 : 1,
      user?.fullName || 'Admin Desa'
    );

  const created = db
    .prepare(
      `SELECT g.*, h.name as holiday_name
       FROM village_greetings g
       LEFT JOIN national_holidays h ON h.id = g.holiday_id
       WHERE g.id = ?`
    )
    .get(Number(result.lastInsertRowid));
  res.status(201).json({ id: result.lastInsertRowid, greeting: created });
});

app.put('/api/admin/greetings/:id', requireAdmin, requirePermission('agenda'), (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM village_greetings WHERE id = ?').get(id) as
    | GreetingDbRow
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Ucapan Pemerintah Desa tidak ditemukan.' });
    return;
  }

  const b = req.body || {};
  const momentTitle = String(b.moment_title ?? existing.moment_title).trim();
  const greetingText = String(b.greeting_text ?? existing.greeting_text).trim();
  const senderLabel = String(b.sender_label ?? existing.sender_label).trim();
  const themeTone = String(b.theme_tone ?? existing.theme_tone).trim();
  const startDate = String(b.start_date ?? existing.start_date).trim();
  const endDate = String(b.end_date ?? existing.end_date).trim();
  const holidayId =
    b.holiday_id !== undefined
      ? b.holiday_id === null || b.holiday_id === ''
        ? null
        : Number(b.holiday_id)
      : existing.holiday_id;

  if (!momentTitle || !greetingText) {
    res.status(400).json({ error: 'Judul momen/peringatan dan teks ucapan wajib diisi.' });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai harus berformat YYYY-MM-DD.' });
    return;
  }
  if (endDate < startDate) {
    res.status(400).json({ error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.' });
    return;
  }

  const validTones = ['resmi', 'religius', 'nasional', 'daerah', 'duka'];
  const safeTone = validTones.includes(themeTone) ? themeTone : existing.theme_tone;

  db.prepare(
    `UPDATE village_greetings SET
      holiday_id = ?, moment_title = ?, greeting_text = ?, sender_label = ?,
      theme_tone = ?, start_date = ?, end_date = ?, is_pinned = ?, is_active = ?,
      updated_by = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    holidayId,
    momentTitle,
    greetingText,
    senderLabel || 'Pemerintah Desa Margamukti',
    safeTone,
    startDate,
    endDate,
    b.is_pinned !== undefined ? (b.is_pinned === true || b.is_pinned === 1 ? 1 : 0) : existing.is_pinned,
    b.is_active !== undefined ? (b.is_active === false || b.is_active === 0 ? 0 : 1) : existing.is_active,
    user?.fullName || 'Admin Desa',
    id
  );

  const updated = db
    .prepare(
      `SELECT g.*, h.name as holiday_name
       FROM village_greetings g
       LEFT JOIN national_holidays h ON h.id = g.holiday_id
       WHERE g.id = ?`
    )
    .get(id);
  res.json({ ok: true, greeting: updated });
});

app.patch('/api/admin/greetings/:id/toggle', requireAdmin, requirePermission('agenda'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare('SELECT id, is_active FROM village_greetings WHERE id = ?')
    .get(id) as { id: number; is_active: number } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Ucapan Pemerintah Desa tidak ditemukan.' });
    return;
  }
  const nextActive = existing.is_active === 1 ? 0 : 1;
  db.prepare("UPDATE village_greetings SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(
    nextActive,
    id
  );
  res.json({ ok: true, is_active: nextActive });
});

app.patch('/api/admin/greetings/:id/pin', requireAdmin, requirePermission('agenda'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare('SELECT id, is_pinned FROM village_greetings WHERE id = ?')
    .get(id) as { id: number; is_pinned: number } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Ucapan Pemerintah Desa tidak ditemukan.' });
    return;
  }
  const nextPinned = existing.is_pinned === 1 ? 0 : 1;
  db.prepare("UPDATE village_greetings SET is_pinned = ?, updated_at = datetime('now') WHERE id = ?").run(
    nextPinned,
    id
  );
  res.json({ ok: true, is_pinned: nextPinned });
});

app.delete('/api/admin/greetings/:id', requireAdmin, requirePermission('agenda'), (req, res) => {
  db.prepare('DELETE FROM village_greetings WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ============================================================================
// VITE DEV / PRODUCTION STATIC SERVING + DYNAMIC ARTICLE OPENGRAPH PREVIEW
// ============================================================================

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectArticleOpenGraphHtml(html: string, req: express.Request): string {
  const slug = typeof req.query.berita === 'string' ? req.query.berita.trim() : '';
  if (!slug) return html;

  const article = db
    .prepare('SELECT title, excerpt, image_url, slug FROM articles WHERE slug = ? AND is_published = 1')
    .get(slug) as { title: string; excerpt: string; image_url: string; slug: string } | undefined;

  if (!article) return html;

  const envAppUrl = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .split(',')[0]
    .trim();
  const host = req.get('host') || `localhost:${PORT}`;
  const baseUrl =
    envAppUrl && envAppUrl !== 'MY_APP_URL' && /^https?:\/\//i.test(envAppUrl)
      ? envAppUrl
      : `${proto}://${host}`;

  const ogTitle = `${article.title} — Desa Margamukti`;
  const ogDesc = (
    article.excerpt || `Berita dan informasi resmi Pemerintah Desa Margamukti: ${article.title}`
  )
    .trim()
    .slice(0, 260);
  const articleUrl = `${baseUrl}/?berita=${encodeURIComponent(article.slug)}#jelajah`;
  const rawImg = String(article.image_url || '').trim();
  const ogImage = /^https?:\/\//i.test(rawImg)
    ? rawImg
    : rawImg.startsWith('/')
      ? `${baseUrl}${rawImg}`
      : `${baseUrl}/pwa-512x512.png`;

  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttr(ogTitle)}</title>`);
  out = out.replace(
    /<meta\s+name=["']description["'][\s\S]*?\/?>/i,
    `<meta name="description" content="${escapeHtmlAttr(ogDesc)}" />`
  );
  out = out.replace(
    /<meta\s+property=["']og:title["'][\s\S]*?\/?>/i,
    `<meta property="og:title" content="${escapeHtmlAttr(ogTitle)}" />`
  );
  out = out.replace(
    /<meta\s+property=["']og:description["'][\s\S]*?\/?>/i,
    `<meta property="og:description" content="${escapeHtmlAttr(ogDesc)}" />`
  );
  out = out.replace(
    /<meta\s+property=["']og:type["'][\s\S]*?\/?>/i,
    `<meta property="og:type" content="article" />`
  );

  const extraTags = [
    `<meta property="og:url" content="${escapeHtmlAttr(articleUrl)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(ogImage)}" />`,
    `<meta property="og:site_name" content="Portal Resmi Desa Margamukti" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(ogTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(ogDesc)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(ogImage)}" />`,
  ].join('\n    ');

  return out.replace('</head>', `    ${extraTags}\n  </head>`);
}

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.get('/', async (req, res, next) => {
      if (typeof req.query.berita !== 'string' || !req.query.berita.trim()) {
        next();
        return;
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        const rawHtml = fs.readFileSync(indexPath, 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        const finalHtml = injectArticleOpenGraphHtml(transformed, req);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(finalHtml);
      } catch (err) {
        next(err);
      }
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (req, res) => {
      const distIndexPath = path.join(distDir, 'index.html');
      const rawHtml = fs.readFileSync(distIndexPath, 'utf-8');
      const finalHtml = injectArticleOpenGraphHtml(rawHtml, req);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(finalHtml);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    startWeeklyBackupScheduler();
    console.log(`Portal Desa Margamukti berjalan di http://localhost:${PORT}`);
  });
}

startServer();
