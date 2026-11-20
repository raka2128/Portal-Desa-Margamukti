import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.ts';

export const BACKUPS_DIR = path.resolve(process.cwd(), 'database', 'backups');
export const AUTO_WEEKLY_RETENTION_LIMIT = 8;

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export interface BackupArchiveRow {
  id: number;
  filename: string;
  trigger_type: 'auto_weekly' | 'manual';
  week_key: string;
  residents_count: number;
  mutations_count: number;
  regions_count: number;
  templates_count: number;
  letters_count: number;
  file_size: number;
  checksum: string;
  created_by: string;
  created_at: string;
  file_exists?: boolean;
}

const INDONESIAN_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDONESIAN_MONTHS = [
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

function getWibParts(date = new Date()) {
  const wibMs = date.getTime() + 7 * 60 * 60 * 1000;
  const wib = new Date(wibMs);
  const year = wib.getUTCFullYear();
  const month = wib.getUTCMonth() + 1;
  const day = wib.getUTCDate();
  const dayOfWeek = wib.getUTCDay(); // 0 = Sunday
  const hour = wib.getUTCHours();
  const minute = wib.getUTCMinutes();
  const second = wib.getUTCSeconds();

  const pad = (n: number) => String(n).padStart(2, '0');
  const isoDate = `${year}-${pad(month)}-${pad(day)}`;
  const fileStamp = `${isoDate}-${pad(hour)}${pad(minute)}${pad(second)}`;
  const displayLabel = `${day} ${INDONESIAN_MONTHS[month - 1]} ${year} · ${pad(hour)}:${pad(minute)} WIB`;

  // Anchor week_key on Sunday date in WIB so each Sunday 02:00 WIB cycle has a unique key
  const sundayAnchor = new Date(Date.UTC(year, month - 1, day - dayOfWeek));
  const sundayWeekKey = `${sundayAnchor.getUTCFullYear()}-${pad(sundayAnchor.getUTCMonth() + 1)}-${pad(sundayAnchor.getUTCDate())}`;

  return {
    year,
    month,
    day,
    dayOfWeek,
    hour,
    minute,
    second,
    isoDate,
    fileStamp,
    displayLabel,
    sundayWeekKey,
  };
}

export function getNextSunday0200WibLabel(now = new Date()): string {
  const wib = getWibParts(now);
  let daysUntilSunday = (7 - wib.dayOfWeek) % 7;
  if (daysUntilSunday === 0 && wib.hour >= 2) {
    daysUntilSunday = 7;
  }
  const target = new Date(Date.UTC(wib.year, wib.month - 1, wib.day + daysUntilSunday));
  const dName = INDONESIAN_DAYS[target.getUTCDay()];
  const dNum = target.getUTCDate();
  const mName = INDONESIAN_MONTHS[target.getUTCMonth()];
  const yNum = target.getUTCFullYear();
  return `${dName}, ${dNum} ${mName} ${yNum} · 02:00 WIB`;
}

export function getLiveBackupCounts() {
  const row = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM residents) AS residents,
         (SELECT COUNT(*) FROM resident_mutation_logs) AS mutations,
         (SELECT COUNT(*) FROM regions) AS regions,
         (SELECT COUNT(*) FROM letter_templates) AS templates,
         (SELECT COUNT(*) FROM letter_requests) AS letters`
    )
    .get() as {
    residents: number;
    mutations: number;
    regions: number;
    templates: number;
    letters: number;
  };
  return row;
}

export function buildVillageBackupPayload(
  triggerType: 'auto_weekly' | 'manual',
  createdBy: string
) {
  const now = new Date();
  const wib = getWibParts(now);

  const snapshot = db.transaction(() => {
    const settings = db
      .prepare('SELECT village_name, village_code, district_name, regency_name FROM village_settings WHERE id = 1')
      .get() as
      | { village_name?: string; village_code?: string; district_name?: string; regency_name?: string }
      | undefined;

    const residents = db
      .prepare(
        `SELECT r.*, rg.dusun, rg.blok, rg.rw, rg.rt
         FROM residents r
         LEFT JOIN regions rg ON r.region_id = rg.id
         ORDER BY r.id ASC`
      )
      .all() as Array<Record<string, unknown>>;

    const residentMutationLogs = db
      .prepare('SELECT * FROM resident_mutation_logs ORDER BY id ASC')
      .all() as Array<Record<string, unknown>>;

    const regions = db
      .prepare('SELECT * FROM regions ORDER BY dusun ASC, rw ASC, rt ASC, id ASC')
      .all() as Array<Record<string, unknown>>;

    const letterTemplates = db
      .prepare('SELECT * FROM letter_templates ORDER BY id ASC')
      .all() as Array<Record<string, unknown>>;

    const letterRequests = db
      .prepare(
        `SELECT lr.*, lt.code AS template_code, lt.name AS template_name, lt.classification_code
         FROM letter_requests lr
         LEFT JOIN letter_templates lt ON lr.template_id = lt.id
         ORDER BY lr.id ASC`
      )
      .all() as Array<Record<string, unknown>>;

    return {
      settings,
      residents,
      residentMutationLogs,
      regions,
      letterTemplates,
      letterRequests,
    };
  })();

  const data = {
    residents: snapshot.residents,
    resident_mutation_logs: snapshot.residentMutationLogs,
    regions: snapshot.regions,
    letter_templates: snapshot.letterTemplates,
    letter_requests: snapshot.letterRequests,
  };

  const counts = {
    residents: snapshot.residents.length,
    mutations: snapshot.residentMutationLogs.length,
    regions: snapshot.regions.length,
    templates: snapshot.letterTemplates.length,
    letters: snapshot.letterRequests.length,
  };

  const checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');

  const payload = {
    metadata: {
      backup_version: '1.0',
      application: 'Portal Desa Margamukti',
      scope: 'Database Penduduk, Log Mutasi, Wilayah, dan Arsip Surat',
      village_name: snapshot.settings?.village_name || 'Desa Margamukti',
      village_code: snapshot.settings?.village_code || '32.11.18.2008',
      district_name: snapshot.settings?.district_name || 'Kecamatan Sumedang Utara',
      regency_name: snapshot.settings?.regency_name || 'Kabupaten Sumedang',
      trigger_type: triggerType,
      created_by: createdBy,
      exported_at: now.toISOString(),
      exported_at_wib: wib.displayLabel,
      checksum_sha256: checksum,
      counts,
    },
    data,
  };

  return { payload, counts, checksum, wib };
}

export function resolveSafeBackupPath(filename: string): string | null {
  const safeBase = path.basename(filename);
  if (!safeBase || safeBase !== filename || !safeBase.endsWith('.json')) {
    return null;
  }
  const resolved = path.resolve(BACKUPS_DIR, safeBase);
  if (!resolved.startsWith(BACKUPS_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

export function pruneWeeklyAutoBackups(): void {
  const rows = db
    .prepare(
      `SELECT id, filename
       FROM backup_archives
       WHERE trigger_type = 'auto_weekly'
       ORDER BY id DESC`
    )
    .all() as Array<{ id: number; filename: string }>;

  if (rows.length <= AUTO_WEEKLY_RETENTION_LIMIT) return;

  const toDelete = rows.slice(AUTO_WEEKLY_RETENTION_LIMIT);
  const delStmt = db.prepare('DELETE FROM backup_archives WHERE id = ?');
  for (const row of toDelete) {
    const filePath = resolveSafeBackupPath(row.filename);
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Abaikan jika file sudah terhapus
      }
    }
    delStmt.run(row.id);
  }
}

export function createAndStoreBackupSnapshot(
  triggerType: 'auto_weekly' | 'manual',
  createdBy: string,
  weekKey = ''
): BackupArchiveRow {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const { payload, counts, checksum, wib } = buildVillageBackupPayload(triggerType, createdBy);
  const jsonString = JSON.stringify(payload, null, 2);
  const rand = crypto.randomBytes(2).toString('hex');
  const prefix = triggerType === 'auto_weekly' ? 'mingguan' : 'manual';
  const filename = `backup-${prefix}-margamukti-${wib.fileStamp}-${rand}.json`;
  const targetPath = path.join(BACKUPS_DIR, filename);

  fs.writeFileSync(targetPath, jsonString, 'utf8');
  const fileSize = Buffer.byteLength(jsonString, 'utf8');

  const effectiveWeekKey = weekKey || (triggerType === 'auto_weekly' ? wib.sundayWeekKey : '');

  const info = db
    .prepare(
      `INSERT INTO backup_archives (
         filename, trigger_type, week_key,
         residents_count, mutations_count, regions_count, templates_count, letters_count,
         file_size, checksum, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      filename,
      triggerType,
      effectiveWeekKey,
      counts.residents,
      counts.mutations,
      counts.regions,
      counts.templates,
      counts.letters,
      fileSize,
      checksum,
      createdBy
    );

  if (triggerType === 'auto_weekly') {
    pruneWeeklyAutoBackups();
  }

  const created = db
    .prepare('SELECT * FROM backup_archives WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as BackupArchiveRow;

  return { ...created, file_exists: true };
}

export function getBackupOverview() {
  const archivesRaw = db
    .prepare('SELECT * FROM backup_archives ORDER BY id DESC')
    .all() as BackupArchiveRow[];

  const archives = archivesRaw.map((row) => {
    const filePath = resolveSafeBackupPath(row.filename);
    return {
      ...row,
      file_exists: Boolean(filePath && fs.existsSync(filePath)),
    };
  });

  const autoBackups = archives.filter((a) => a.trigger_type === 'auto_weekly');
  const lastAutoBackupAt = autoBackups[0]?.created_at || null;

  return {
    schedule: {
      enabled: true,
      scheduleLabel: 'Setiap Minggu pukul 02.00 WIB',
      retentionLimit: AUTO_WEEKLY_RETENTION_LIMIT,
      autoBackupCount: autoBackups.length,
      lastAutoBackupAt,
      nextScheduledLabel: getNextSunday0200WibLabel(),
    },
    liveCounts: getLiveBackupCounts(),
    archives,
  };
}

let isWeeklyBackupRunning = false;

export function runDueWeeklyBackupCheck(): void {
  if (isWeeklyBackupRunning) return;
  isWeeklyBackupRunning = true;
  try {
    const now = new Date();
    const wib = getWibParts(now);

    const latestAuto = db
      .prepare(
        `SELECT * FROM backup_archives
         WHERE trigger_type = 'auto_weekly'
         ORDER BY id DESC
         LIMIT 1`
      )
      .get() as BackupArchiveRow | undefined;

    let shouldRun = false;

    if (!latestAuto) {
      // Ensure at least an initial weekly baseline exists upon first startup
      shouldRun = true;
    } else {
      const latestPath = resolveSafeBackupPath(latestAuto.filename);
      const missingFile = !latestPath || !fs.existsSync(latestPath);
      const parsedMs = Date.parse(latestAuto.created_at.replace(' ', 'T') + 'Z');
      const ageMs = Number.isFinite(parsedMs) ? now.getTime() - parsedMs : Number.MAX_SAFE_INTEGER;
      const overdueSevenDays = ageMs >= 7 * 24 * 60 * 60 * 1000;
      const sundayWindowDue =
        wib.dayOfWeek === 0 && wib.hour >= 2 && latestAuto.week_key !== wib.sundayWeekKey;

      if (missingFile || overdueSevenDays || sundayWindowDue) {
        shouldRun = true;
      }
    }

    if (shouldRun) {
      createAndStoreBackupSnapshot(
        'auto_weekly',
        'Sistem Otomatis (Mingguan 02.00 WIB)',
        wib.sundayWeekKey
      );
    }
  } catch (err) {
    console.error('[Backup] Gagal menjalankan pengecekan cadangan mingguan:', err);
  } finally {
    isWeeklyBackupRunning = false;
  }
}

let schedulerStarted = false;

export function startWeeklyBackupScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  runDueWeeklyBackupCheck();
  const timer = setInterval(runDueWeeklyBackupCheck, 60 * 1000);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}
