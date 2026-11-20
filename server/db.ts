import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const dbDir = path.resolve(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'margamukti.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const ALL_ADMIN_PERMISSIONS = [
  'overview',
  'surat',
  'penduduk',
  'wilayah',
  'perangkat',
  'apbdes',
  'agenda',
  'berita',
  'umkm',
  'galeri',
  'peta',
  'pengaduan',
  'peringatan',
  'pengaturan',
  'lembaga',
  'wa_blaster',
  'ai_knowledge',
  'portofolio',
  'pembangunan',
] as const;

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'sub_admin',
      permissions TEXT NOT NULL DEFAULT '[]',
      official_id INTEGER DEFAULT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS apbdes_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fiscal_year INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('Pendapatan', 'Belanja', 'Pembiayaan')),
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      budget_amount INTEGER NOT NULL DEFAULT 0,
      realized_amount INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS village_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      village_name TEXT NOT NULL,
      district_name TEXT NOT NULL,
      regency_name TEXT NOT NULL,
      province_name TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      village_code TEXT NOT NULL,
      office_address TEXT NOT NULL,
      phone TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      facebook_url TEXT NOT NULL DEFAULT '',
      instagram_url TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      service_hours TEXT NOT NULL,
      hero_title TEXT NOT NULL,
      hero_subtitle TEXT NOT NULL,
      hero_image TEXT NOT NULL,
      vision TEXT NOT NULL,
      mission TEXT NOT NULL,
      history TEXT NOT NULL,
      head_name TEXT NOT NULL,
      head_nip TEXT NOT NULL,
      kop_line1 TEXT NOT NULL,
      kop_line2 TEXT NOT NULL,
      kop_line3 TEXT NOT NULL,
      kop_address TEXT NOT NULL,
      map_center_lat REAL NOT NULL DEFAULT -6.8283,
      map_center_lng REAL NOT NULL DEFAULT 107.9000,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS village_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      event_time TEXT NOT NULL,
      location TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS regions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dusun TEXT NOT NULL,
      kepala_dusun TEXT NOT NULL DEFAULT '-',
      kepala_dusun_phone TEXT NOT NULL DEFAULT '',
      blok TEXT NOT NULL,
      rw TEXT NOT NULL,
      rt TEXT NOT NULL,
      ketua_rw TEXT NOT NULL,
      ketua_rw_phone TEXT NOT NULL DEFAULT '',
      ketua_rt TEXT NOT NULL,
      ketua_rt_phone TEXT NOT NULL DEFAULT '',
      latitude REAL DEFAULT NULL,
      longitude REAL DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS residents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nik TEXT NOT NULL UNIQUE,
      no_kk TEXT NOT NULL,
      full_name TEXT NOT NULL,
      birth_place TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      gender TEXT NOT NULL CHECK (gender IN ('Laki-laki', 'Perempuan')),
      address TEXT NOT NULL,
      region_id INTEGER REFERENCES regions(id) ON DELETE SET NULL,
      religion TEXT NOT NULL,
      occupation TEXT NOT NULL,
      marital_status TEXT NOT NULL,
      family_relationship TEXT NOT NULL DEFAULT 'Kepala keluarga',
      father_name TEXT NOT NULL DEFAULT '',
      mother_name TEXT NOT NULL DEFAULT '',
      education TEXT NOT NULL DEFAULT 'SLTA/Sederajat',
      physical_disability TEXT NOT NULL DEFAULT 'Tidak Ada',
      death_time TEXT NOT NULL DEFAULT '',
      death_day TEXT NOT NULL DEFAULT '',
      death_cause TEXT NOT NULL DEFAULT '',
      death_location TEXT NOT NULL DEFAULT '',
      death_reporter_name TEXT NOT NULL DEFAULT '',
      death_reporter_nik TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS officials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      nip TEXT NOT NULL DEFAULT '-',
      sort_order INTEGER NOT NULL DEFAULT 1,
      photo_url TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      tte_status TEXT NOT NULL DEFAULT 'none' CHECK (tte_status IN ('none', 'pending', 'approved', 'revoked')),
      tte_code TEXT NOT NULL DEFAULT '',
      tte_approved_by TEXT NOT NULL DEFAULT '',
      tte_approved_at TEXT DEFAULT NULL,
      can_sign_letters INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS letter_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      classification_code TEXT NOT NULL,
      description TEXT NOT NULL,
      body_template TEXT NOT NULL,
      required_fields TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS letter_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_code TEXT NOT NULL UNIQUE,
      template_id INTEGER NOT NULL REFERENCES letter_templates(id) ON DELETE CASCADE,
      letter_number TEXT NOT NULL DEFAULT '',
      applicant_nik TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      birth_place TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      gender TEXT NOT NULL,
      religion TEXT NOT NULL,
      occupation TEXT NOT NULL,
      marital_status TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      purpose TEXT NOT NULL,
      extra_data TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      admin_notes TEXT NOT NULL DEFAULT '',
      approved_at TEXT DEFAULT NULL,
      signer_official_id INTEGER DEFAULT NULL,
      signer_name TEXT NOT NULL DEFAULT '',
      signer_position TEXT NOT NULL DEFAULT '',
      signer_nip TEXT NOT NULL DEFAULT '',
      signer_tte_code TEXT NOT NULL DEFAULT '',
      use_digital_signature INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      media_items TEXT NOT NULL DEFAULT '[]',
      author_name TEXT NOT NULL DEFAULT 'Admin Desa Margamukti',
      published_at TEXT NOT NULL DEFAULT (date('now')),
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS umkm_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT NOT NULL,
      product_name TEXT NOT NULL,
      category TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      whatsapp TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      is_verified INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gallery_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      event_date TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS map_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_name TEXT NOT NULL,
      sender_contact TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Pengaduan',
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'diproses', 'selesai')),
      admin_reply TEXT NOT NULL DEFAULT '',
      is_emergency INTEGER NOT NULL DEFAULT 0,
      latitude REAL DEFAULT NULL,
      longitude REAL DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS article_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_region TEXT NOT NULL DEFAULT '',
      comment_text TEXT NOT NULL,
      admin_reply TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS early_warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Cuaca Ekstrem',
      severity TEXT NOT NULL DEFAULT 'waspada' CHECK (severity IN ('darurat', 'siaga', 'waspada', 'info')),
      affected_area TEXT NOT NULL DEFAULT 'Seluruh Wilayah Desa Margamukti',
      description TEXT NOT NULL,
      instruction TEXT NOT NULL DEFAULT '',
      emergency_contact TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_knowledge_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL CHECK (category IN ('DTSEN', 'Bansos', 'Adminduk', 'Pemerintahan Daerah', 'Pemerintahan Desa')),
      title TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      official_source TEXT NOT NULL DEFAULT '',
      related_route TEXT NOT NULL DEFAULT '',
      related_subtab TEXT NOT NULL DEFAULT '',
      related_label TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL DEFAULT 'Sistem',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Safe migration for existing SQLite databases created before RBAC update
  const userCols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  const colNames = new Set(userCols.map((c) => c.name));
  if (!colNames.has('permissions')) {
    db.exec("ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '[]'");
  }
  if (!colNames.has('official_id')) {
    db.exec('ALTER TABLE users ADD COLUMN official_id INTEGER DEFAULT NULL');
  }
  if (!colNames.has('is_active')) {
    db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  }
  if (!colNames.has('scope_dusun')) {
    db.exec("ALTER TABLE users ADD COLUMN scope_dusun TEXT NOT NULL DEFAULT ''");
  }
  if (!colNames.has('scope_rw')) {
    db.exec("ALTER TABLE users ADD COLUMN scope_rw TEXT NOT NULL DEFAULT ''");
  }
  if (!colNames.has('scope_rt')) {
    db.exec("ALTER TABLE users ADD COLUMN scope_rt TEXT NOT NULL DEFAULT ''");
  }

  // Safe migration for residents status & mutation tracking
  const residentCols = db.prepare('PRAGMA table_info(residents)').all() as Array<{ name: string }>;
  const residentColNames = new Set(residentCols.map((c) => c.name));
  if (!residentColNames.has('resident_status')) {
    db.exec("ALTER TABLE residents ADD COLUMN resident_status TEXT NOT NULL DEFAULT 'aktif'");
  }
  if (!residentColNames.has('mutation_date')) {
    db.exec("ALTER TABLE residents ADD COLUMN mutation_date TEXT NOT NULL DEFAULT ''");
  }
  if (!residentColNames.has('mutation_notes')) {
    db.exec("ALTER TABLE residents ADD COLUMN mutation_notes TEXT NOT NULL DEFAULT ''");
  }
  if (!residentColNames.has('verification_status')) {
    db.exec("ALTER TABLE residents ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'verified'");
  }
  if (!residentColNames.has('verification_note')) {
    db.exec("ALTER TABLE residents ADD COLUMN verification_note TEXT NOT NULL DEFAULT ''");
  }
  if (!residentColNames.has('family_relationship')) {
    db.exec("ALTER TABLE residents ADD COLUMN family_relationship TEXT NOT NULL DEFAULT 'Kepala keluarga'");
  }
  if (!residentColNames.has('father_name')) {
    db.exec("ALTER TABLE residents ADD COLUMN father_name TEXT NOT NULL DEFAULT ''");
  }
  if (!residentColNames.has('mother_name')) {
    db.exec("ALTER TABLE residents ADD COLUMN mother_name TEXT NOT NULL DEFAULT ''");
  }
  if (!residentColNames.has('education')) {
    db.exec("ALTER TABLE residents ADD COLUMN education TEXT NOT NULL DEFAULT 'SLTA/Sederajat'");
  }
  if (!residentColNames.has('physical_disability')) {
    db.exec("ALTER TABLE residents ADD COLUMN physical_disability TEXT NOT NULL DEFAULT 'Tidak Ada'");
  }
  if (!residentColNames.has('death_time')) {
    db.exec("ALTER TABLE residents ADD COLUMN death_time TEXT NOT NULL DEFAULT ''");
  }
  if (!residentColNames.has('death_day')) {
    db.exec("ALTER TABLE residents ADD COLUMN death_day TEXT NOT NULL DEFAULT ''");
  }
  if (!residentColNames.has('death_cause')) {
    db.exec("ALTER TABLE residents ADD COLUMN death_cause TEXT NOT NULL DEFAULT ''");
  }
  if (!residentColNames.has('death_location')) {
    db.exec("ALTER TABLE residents ADD COLUMN death_location TEXT NOT NULL DEFAULT ''");
  }
  if (!residentColNames.has('death_reporter_name')) {
    db.exec("ALTER TABLE residents ADD COLUMN death_reporter_name TEXT NOT NULL DEFAULT ''");
  }
  if (!residentColNames.has('death_reporter_nik')) {
    db.exec("ALTER TABLE residents ADD COLUMN death_reporter_nik TEXT NOT NULL DEFAULT ''");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS resident_mutation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resident_id INTEGER,
      resident_nik TEXT NOT NULL,
      resident_name TEXT NOT NULL,
      region_label TEXT NOT NULL DEFAULT '',
      action_type TEXT NOT NULL DEFAULT 'status_change',
      prev_status TEXT NOT NULL DEFAULT '',
      prev_mutation_date TEXT NOT NULL DEFAULT '',
      prev_mutation_notes TEXT NOT NULL DEFAULT '',
      new_status TEXT NOT NULL DEFAULT 'aktif',
      new_mutation_date TEXT NOT NULL DEFAULT '',
      new_mutation_notes TEXT NOT NULL DEFAULT '',
      actor_user_id INTEGER NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      actor_scope TEXT NOT NULL DEFAULT '',
      verification_status TEXT NOT NULL DEFAULT 'pending',
      verified_by_name TEXT NOT NULL DEFAULT '',
      verification_note TEXT NOT NULL DEFAULT '',
      verified_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Safe migration for village_settings social media links
  const settingsCols = db.prepare('PRAGMA table_info(village_settings)').all() as Array<{ name: string }>;
  const settingsColNames = new Set(settingsCols.map((c) => c.name));
  if (!settingsColNames.has('facebook_url')) {
    db.exec("ALTER TABLE village_settings ADD COLUMN facebook_url TEXT NOT NULL DEFAULT 'https://www.facebook.com/pemdesmargamukti'");
  }
  if (!settingsColNames.has('instagram_url')) {
    db.exec("ALTER TABLE village_settings ADD COLUMN instagram_url TEXT NOT NULL DEFAULT 'https://www.instagram.com/pemdes_margamukti'");
  }

  // Safe migration for regions (kepala_dusun, phone numbers, latitude, longitude)
  const regionCols = db.prepare('PRAGMA table_info(regions)').all() as Array<{ name: string }>;
  const regionColNames = new Set(regionCols.map((c) => c.name));
  const hadRegionPhones = regionColNames.has('ketua_rw_phone') && regionColNames.has('ketua_rt_phone');
  if (!regionColNames.has('kepala_dusun')) {
    db.exec("ALTER TABLE regions ADD COLUMN kepala_dusun TEXT NOT NULL DEFAULT '-'");
  }
  if (!regionColNames.has('kepala_dusun_phone')) {
    db.exec("ALTER TABLE regions ADD COLUMN kepala_dusun_phone TEXT NOT NULL DEFAULT ''");
  }
  if (!regionColNames.has('ketua_rw_phone')) {
    db.exec("ALTER TABLE regions ADD COLUMN ketua_rw_phone TEXT NOT NULL DEFAULT ''");
  }
  if (!regionColNames.has('ketua_rt_phone')) {
    db.exec("ALTER TABLE regions ADD COLUMN ketua_rt_phone TEXT NOT NULL DEFAULT ''");
  }
  if (!regionColNames.has('latitude')) {
    db.exec('ALTER TABLE regions ADD COLUMN latitude REAL DEFAULT NULL');
  }
  if (!regionColNames.has('longitude')) {
    db.exec('ALTER TABLE regions ADD COLUMN longitude REAL DEFAULT NULL');
  }

  // Safe migration for complaints emergency & GPS coordinates
  const complaintCols = db.prepare('PRAGMA table_info(complaints)').all() as Array<{ name: string }>;
  const complaintColNames = new Set(complaintCols.map((c) => c.name));
  if (!complaintColNames.has('is_emergency')) {
    db.exec('ALTER TABLE complaints ADD COLUMN is_emergency INTEGER NOT NULL DEFAULT 0');
  }
  if (!complaintColNames.has('latitude')) {
    db.exec('ALTER TABLE complaints ADD COLUMN latitude REAL DEFAULT NULL');
  }
  if (!complaintColNames.has('longitude')) {
    db.exec('ALTER TABLE complaints ADD COLUMN longitude REAL DEFAULT NULL');
  }

  // Safe migration for articles multi-media gallery & embedded video
  const articleCols = db.prepare('PRAGMA table_info(articles)').all() as Array<{ name: string }>;
  const articleColNames = new Set(articleCols.map((c) => c.name));
  if (!articleColNames.has('media_items')) {
    db.exec("ALTER TABLE articles ADD COLUMN media_items TEXT NOT NULL DEFAULT '[]'");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS backup_archives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      trigger_type TEXT NOT NULL CHECK (trigger_type IN ('auto_weekly', 'manual')),
      week_key TEXT NOT NULL DEFAULT '',
      residents_count INTEGER NOT NULL DEFAULT 0,
      mutations_count INTEGER NOT NULL DEFAULT 0,
      regions_count INTEGER NOT NULL DEFAULT 0,
      templates_count INTEGER NOT NULL DEFAULT 0,
      letters_count INTEGER NOT NULL DEFAULT 0,
      file_size INTEGER NOT NULL DEFAULT 0,
      checksum TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT 'Sistem Otomatis',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wa_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Umum',
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wa_blasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message_template TEXT NOT NULL,
      delivery_mode TEXT NOT NULL DEFAULT 'wa_me_queue' CHECK (delivery_mode IN ('wa_me_queue', 'gateway_api')),
      target_summary TEXT NOT NULL DEFAULT '',
      total_recipients INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('draft', 'in_progress', 'completed')),
      created_by TEXT NOT NULL DEFAULT 'Admin Desa',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wa_blast_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blast_id INTEGER NOT NULL REFERENCES wa_blasts(id) ON DELETE CASCADE,
      recipient_key TEXT NOT NULL,
      name TEXT NOT NULL,
      role_label TEXT NOT NULL,
      role_group TEXT NOT NULL,
      wilayah_label TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL,
      rendered_message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
      gateway_response TEXT NOT NULL DEFAULT '',
      sent_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS village_institutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      tagline TEXT NOT NULL DEFAULT '',
      legal_basis TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      tupoksi TEXT NOT NULL DEFAULT '[]',
      office_location TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS institution_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id INTEGER NOT NULL REFERENCES village_institutions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 1,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS national_holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      holiday_date TEXT NOT NULL,
      month_day TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('libur_nasional', 'cuti_bersama', 'peringatan_nasional', 'daerah_desa')),
      is_annual INTEGER NOT NULL DEFAULT 0,
      is_official_holiday INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      default_greeting TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_national_holidays_date ON national_holidays(holiday_date);
    CREATE INDEX IF NOT EXISTS idx_national_holidays_month_day ON national_holidays(month_day);

    CREATE TABLE IF NOT EXISTS village_greetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      holiday_id INTEGER DEFAULT NULL REFERENCES national_holidays(id) ON DELETE SET NULL,
      moment_title TEXT NOT NULL,
      greeting_text TEXT NOT NULL,
      sender_label TEXT NOT NULL DEFAULT 'Pemerintah Desa Margamukti',
      theme_tone TEXT NOT NULL DEFAULT 'resmi' CHECK (theme_tone IN ('resmi', 'religius', 'nasional', 'daerah', 'duka')),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL DEFAULT 'Admin Desa',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Safe migration for officials TTE & multi-signatory columns
  const officialCols = db.prepare('PRAGMA table_info(officials)').all() as Array<{ name: string }>;
  const officialColNames = new Set(officialCols.map((c) => c.name));
  if (!officialColNames.has('tte_status')) {
    db.exec("ALTER TABLE officials ADD COLUMN tte_status TEXT NOT NULL DEFAULT 'none'");
  }
  if (!officialColNames.has('tte_code')) {
    db.exec("ALTER TABLE officials ADD COLUMN tte_code TEXT NOT NULL DEFAULT ''");
  }
  if (!officialColNames.has('tte_approved_by')) {
    db.exec("ALTER TABLE officials ADD COLUMN tte_approved_by TEXT NOT NULL DEFAULT ''");
  }
  if (!officialColNames.has('tte_approved_at')) {
    db.exec('ALTER TABLE officials ADD COLUMN tte_approved_at TEXT DEFAULT NULL');
  }
  if (!officialColNames.has('can_sign_letters')) {
    db.exec('ALTER TABLE officials ADD COLUMN can_sign_letters INTEGER NOT NULL DEFAULT 0');
  }

  // Safe migration for letter_requests signatory snapshot
  const letterCols = db.prepare('PRAGMA table_info(letter_requests)').all() as Array<{ name: string }>;
  const letterColNames = new Set(letterCols.map((c) => c.name));
  if (!letterColNames.has('signer_official_id')) {
    db.exec('ALTER TABLE letter_requests ADD COLUMN signer_official_id INTEGER DEFAULT NULL');
  }
  if (!letterColNames.has('signer_name')) {
    db.exec("ALTER TABLE letter_requests ADD COLUMN signer_name TEXT NOT NULL DEFAULT ''");
  }
  if (!letterColNames.has('signer_position')) {
    db.exec("ALTER TABLE letter_requests ADD COLUMN signer_position TEXT NOT NULL DEFAULT ''");
  }
  if (!letterColNames.has('signer_nip')) {
    db.exec("ALTER TABLE letter_requests ADD COLUMN signer_nip TEXT NOT NULL DEFAULT ''");
  }
  if (!letterColNames.has('signer_tte_code')) {
    db.exec("ALTER TABLE letter_requests ADD COLUMN signer_tte_code TEXT NOT NULL DEFAULT ''");
  }
  if (!letterColNames.has('use_digital_signature')) {
    db.exec('ALTER TABLE letter_requests ADD COLUMN use_digital_signature INTEGER NOT NULL DEFAULT 0');
  }

  // Safe migration for wa_templates status ('draft' | 'active')
  const waTplCols = db.prepare('PRAGMA table_info(wa_templates)').all() as Array<{ name: string }>;
  const waTplColNames = new Set(waTplCols.map((c) => c.name));
  if (!waTplColNames.has('status')) {
    db.exec("ALTER TABLE wa_templates ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  }

  seedInitialData(!hadRegionPhones);
}

function seedInitialData(backfillRegionPhones = false): void {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const hash = bcrypt.hashSync('123456', 10);
    db.prepare(
      'INSERT INTO users (username, password_hash, full_name, role, permissions, is_active) VALUES (?, ?, ?, ?, ?, 1)'
    ).run('admin', hash, 'Super Admin Desa Margamukti', 'super_admin', JSON.stringify(ALL_ADMIN_PERMISSIONS));
  } else {
    db.prepare(
      "UPDATE users SET role = 'super_admin', permissions = ?, is_active = 1 WHERE username = 'admin'"
    ).run(JSON.stringify(ALL_ADMIN_PERMISSIONS));
  }

  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM village_settings').get() as { count: number };
  if (settingsCount.count === 0) {
    db.prepare(`
      INSERT INTO village_settings (
        id, village_name, district_name, regency_name, province_name, postal_code, village_code,
        office_address, phone, whatsapp, facebook_url, instagram_url, email, service_hours,
        hero_title, hero_subtitle, hero_image,
        vision, mission, history,
        head_name, head_nip,
        kop_line1, kop_line2, kop_line3, kop_address, map_center_lat, map_center_lng
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      'Desa Margamukti',
      'Kecamatan Sumedang Utara',
      'Kabupaten Sumedang',
      'Provinsi Jawa Barat',
      '45321',
      '32.11.18.2008',
      'Jl. Raya Kebonkalapa No. 12, Dusun Pawenang, Desa Margamukti, Kec. Sumedang Utara, Kab. Sumedang 45321',
      '(0261) 204512',
      '6281220458899',
      'https://www.facebook.com/pemdesmargamukti',
      'https://www.instagram.com/pemdes_margamukti',
      'pemdes@margamukti-sumedang.desa.id',
      'Senin - Jumat, 08.00 - 15.30 WIB',
      'Melayani Warga dengan Transparan, Cepat, dan Akuntabel',
      'Portal resmi Pemerintah Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang. Akses informasi kependudukan, pengajuan surat keterangan mandiri, katalog UMKM, dan peta wilayah dalam satu pintu.',
      '/src/assets/images/hero_desa_margamukti_clean_1794845942599.jpg',
      'Terwujudnya Desa Margamukti yang Maju, Mandiri, Sejahtera, dan Berakhlak Mulia melalui Tata Kelola Pemerintahan yang Bersih serta Pemberdayaan Ekonomi Masyarakat.',
      '1. Meningkatkan kualitas pelayanan publik desa yang cepat, ramah, dan berbasis digital.\n2. Memperkuat pembangunan infrastruktur dusun dan fasilitas umum secara merata.\n3. Mendorong kemandirian ekonomi warga melalui pembinaan UMKM, pertanian, dan kerajinan lokal.\n4. Menjaga kerukunan sosial, budaya gotong royong, dan ketahanan lingkungan hidup.',
      'Desa Margamukti merupakan salah satu desa di Kecamatan Sumedang Utara, Kabupaten Sumedang yang memiliki dua wilayah dusun utama yaitu Dusun Pawenang dan Dusun Cikondang, mencakup Blok Kebonkalapa, Pasarean, Sukajadi, Balong, dan Pasiramis.',
      'H. Asep Kurniawan, S.Sos.',
      'NIAP. 19740512 202101 1 001',
      'PEMERINTAH KABUPATEN SUMEDANG',
      'KECAMATAN SUMEDANG UTARA',
      'KEPALA DESA MARGAMUKTI',
      'Jalan Raya Kebonkalapa No. 12, Desa Margamukti, Kec. Sumedang Utara, Kab. Sumedang, Kode Pos 45321',
      -6.8283,
      107.9000
    );
  }

  const eventCount = db.prepare('SELECT COUNT(*) as count FROM village_events').get() as { count: number };
  if (eventCount.count === 0) {
    const insertEvent = db.prepare(
      'INSERT INTO village_events (title, event_time, location, is_active, sort_order) VALUES (?, ?, ?, 1, ?)'
    );
    insertEvent.run(
      'Musyawarah Perencanaan Pembangunan Desa (Musrenbangdes) 2026',
      'Kamis, 21 Nov 2026 · 09.00 WIB',
      'Aula Balai Desa Margamukti',
      1
    );
    insertEvent.run(
      'Pelayanan Posyandu Terpadu Balita & Lansia Dusun Pawenang',
      'Sabtu, 23 Nov 2026 · 08.00 WIB',
      'Posyandu Melati Blok Kebonkalapa RW 01',
      2
    );
    insertEvent.run(
      'Gerakan Jumat Bersih & Kerja Bakti Saluran Air Warga',
      'Jumat, 29 Nov 2026 · 07.00 WIB',
      'Blok Sukajadi RT 01-02 Dusun Cikondang',
      3
    );
  }

  const regionCount = db.prepare('SELECT COUNT(*) as count FROM regions').get() as { count: number };
  if (regionCount.count === 0) {
    const insertRegion = db.prepare(
      'INSERT INTO regions (dusun, kepala_dusun, kepala_dusun_phone, blok, rw, rt, ketua_rw, ketua_rw_phone, ketua_rt, ketua_rt_phone, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const regionsData = [
      ['Dusun Pawenang', 'Oman Abdurahman', '081220458806', 'Blok Kebonkalapa', '01', '01', 'Dedi Supriadi', '081220458811', 'Ujang Rohman', '081220458821', -6.8278, 107.8995],
      ['Dusun Pawenang', 'Oman Abdurahman', '081220458806', 'Blok Kebonkalapa', '01', '02', 'Dedi Supriadi', '081220458811', 'Tatang Suryana', '081220458822', -6.8271, 107.9009],
      ['Dusun Pawenang', 'Oman Abdurahman', '081220458806', 'Blok Pasarean', '02', '01', 'Hendra Kusnadi', '081220458812', 'Cecep Mulyana', '081220458823', -6.8263, 107.8981],
      ['Dusun Pawenang', 'Oman Abdurahman', '081220458806', 'Blok Balong', '02', '02', 'Hendra Kusnadi', '081220458812', 'Ayi Solihin', '081220458824', -6.8292, 107.8976],
      ['Dusun Cikondang', 'Endang Suherman', '081220458807', 'Blok Sukajadi', '03', '01', 'Yayat Ruhiyat', '081220458813', 'Eman Sulaeman', '081220458825', -6.8306, 107.9024],
      ['Dusun Cikondang', 'Endang Suherman', '081220458807', 'Blok Sukajadi', '03', '02', 'Yayat Ruhiyat', '081220458813', 'Budi Santoso', '081220458826', -6.8316, 107.9034],
      ['Dusun Cikondang', 'Endang Suherman', '081220458807', 'Blok Pasiramis', '04', '01', 'Ade Sumarna', '081220458814', 'Wawan Hermawan', '081220458827', -6.8298, 107.9046],
      ['Dusun Cikondang', 'Endang Suherman', '081220458807', 'Blok Pasiramis', '04', '02', 'Ade Sumarna', '081220458814', 'Engkus Kuswara', '081220458828', -6.8322, 107.9042],
    ];
    for (const r of regionsData) {
      insertRegion.run(...r);
    }
  } else {
    // Backfill kepala_dusun and initial coordinates safely on pre-existing seeded regions
    db.prepare(
      "UPDATE regions SET kepala_dusun = 'Oman Abdurahman' WHERE dusun = 'Dusun Pawenang' AND (kepala_dusun IS NULL OR kepala_dusun = '' OR kepala_dusun = '-')"
    ).run();
    db.prepare(
      "UPDATE regions SET kepala_dusun = 'Endang Suherman' WHERE dusun = 'Dusun Cikondang' AND (kepala_dusun IS NULL OR kepala_dusun = '' OR kepala_dusun = '-')"
    ).run();
    if (backfillRegionPhones) {
      const seedPhones: Array<[string, string, string, string, string, string]> = [
        ['Dusun Pawenang', '01', '01', '081220458806', '081220458811', '081220458821'],
        ['Dusun Pawenang', '01', '02', '081220458806', '081220458811', '081220458822'],
        ['Dusun Pawenang', '02', '01', '081220458806', '081220458812', '081220458823'],
        ['Dusun Pawenang', '02', '02', '081220458806', '081220458812', '081220458824'],
        ['Dusun Cikondang', '03', '01', '081220458807', '081220458813', '081220458825'],
        ['Dusun Cikondang', '03', '02', '081220458807', '081220458813', '081220458826'],
        ['Dusun Cikondang', '04', '01', '081220458807', '081220458814', '081220458827'],
        ['Dusun Cikondang', '04', '02', '081220458807', '081220458814', '081220458828'],
      ];
      const fillPhoneStmt = db.prepare(
        `UPDATE regions
         SET kepala_dusun_phone = CASE WHEN kepala_dusun_phone = '' THEN ? ELSE kepala_dusun_phone END,
             ketua_rw_phone = CASE WHEN ketua_rw_phone = '' THEN ? ELSE ketua_rw_phone END,
             ketua_rt_phone = CASE WHEN ketua_rt_phone = '' THEN ? ELSE ketua_rt_phone END
         WHERE dusun = ? AND rw = ? AND rt = ?`
      );
      for (const [dusun, rw, rt, kdPhone, rwPhone, rtPhone] of seedPhones) {
        fillPhoneStmt.run(kdPhone, rwPhone, rtPhone, dusun, rw, rt);
      }
    }
    const defaultRegionCoords: Array<[string, string, string, number, number]> = [
      ['Dusun Pawenang', '01', '01', -6.8278, 107.8995],
      ['Dusun Pawenang', '01', '02', -6.8271, 107.9009],
      ['Dusun Pawenang', '02', '01', -6.8263, 107.8981],
      ['Dusun Pawenang', '02', '02', -6.8292, 107.8976],
      ['Dusun Cikondang', '03', '01', -6.8306, 107.9024],
      ['Dusun Cikondang', '03', '02', -6.8316, 107.9034],
      ['Dusun Cikondang', '04', '01', -6.8298, 107.9046],
      ['Dusun Cikondang', '04', '02', -6.8322, 107.9042],
    ];
    const fillCoordStmt = db.prepare(
      'UPDATE regions SET latitude = ?, longitude = ? WHERE dusun = ? AND rw = ? AND rt = ? AND latitude IS NULL AND longitude IS NULL'
    );
    for (const [dusun, rw, rt, lat, lng] of defaultRegionCoords) {
      fillCoordStmt.run(lat, lng, dusun, rw, rt);
    }
  }

  const residentCount = db.prepare('SELECT COUNT(*) as count FROM residents').get() as { count: number };
  if (residentCount.count === 0) {
    const insertResident = db.prepare(`
      INSERT INTO residents (
        nik, no_kk, full_name, birth_place, birth_date, gender, address, region_id,
        religion, occupation, marital_status, family_relationship, father_name, mother_name, education, physical_disability
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const residentsData = [
      ['3211181205850001', '3211180101120011', 'Ahmad Fauzi', 'Sumedang', '1985-05-12', 'Laki-laki', 'Blok Kebonkalapa RT 01 RW 01, Dusun Pawenang', 1, 'Islam', 'Wiraswasta', 'Kawin', 'Kepala keluarga', 'H. Endang Suparman', 'Hj. Siti Rohimah', 'Strata 1', 'Tidak Ada'],
      ['3211185408880002', '3211180101120011', 'Nenden Kartika', 'Sumedang', '1988-08-14', 'Perempuan', 'Blok Kebonkalapa RT 01 RW 01, Dusun Pawenang', 1, 'Islam', 'Pedagang', 'Kawin', 'Istri', 'Ujang Komarudin', 'Euis Hasanah', 'SLTA/Sederajat', 'Tidak Ada'],
      ['3211182003920003', '3211180405150022', 'Rizky Pratama', 'Bandung', '1992-03-20', 'Laki-laki', 'Blok Kebonkalapa RT 02 RW 01, Dusun Pawenang', 2, 'Islam', 'Karyawan Swasta', 'Belum Kawin', 'Kepala keluarga', 'Tatang Suryana', 'Imas Suryani', 'Strata 1', 'Tidak Ada'],
      ['3211186111790004', '3211180902080033', 'Yanti Suryati', 'Sumedang', '1979-11-21', 'Perempuan', 'Blok Pasarean RT 01 RW 02, Dusun Pawenang', 3, 'Islam', 'Guru', 'Kawin', 'Kepala keluarga', 'Dadang Hermawan', 'Tuti Alawiyah', 'Strata 1', 'Tidak Ada'],
      ['3211181507760005', '3211181103090044', 'Maman Abdurrahman', 'Sumedang', '1976-07-15', 'Laki-laki', 'Blok Balong RT 02 RW 02, Dusun Pawenang', 4, 'Islam', 'Petani', 'Kawin', 'Kepala keluarga', 'Abdurrahman', 'Aminah', 'SLTP/Sederajat', 'Tidak Ada'],
      ['3211184802950006', '3211181506180055', 'Fitriani Rahmawati', 'Sumedang', '1995-02-08', 'Perempuan', 'Blok Sukajadi RT 01 RW 03, Dusun Cikondang', 5, 'Islam', 'Pengrajin UMKM', 'Kawin', 'Kepala keluarga', 'Rahmat Hidayat', 'Kokom Komariah', 'SLTA/Sederajat', 'Tidak Ada'],
      ['3211180309900007', '3211181904160066', 'Denny Kusumah', 'Sumedang', '1990-09-03', 'Laki-laki', 'Blok Sukajadi RT 02 RW 03, Dusun Cikondang', 6, 'Islam', 'Teknisi', 'Kawin', 'Kepala keluarga', 'Ade Kusumah', 'Yayah Rokayah', 'Akademi/D-III/S-Muda', 'Tidak Ada'],
      ['3211186512010008', '3211182208100077', 'Salsa Nabila', 'Sumedang', '2001-12-25', 'Perempuan', 'Blok Pasiramis RT 01 RW 04, Dusun Cikondang', 7, 'Islam', 'Mahasiswa', 'Belum Kawin', 'Kepala keluarga', 'Wawan Hermawan', 'Neni Kurniawati', 'SLTA/Sederajat', 'Tidak Ada'],
      ['3211181804830009', '3211182501110088', 'Jajang Nurjaman', 'Sumedang', '1983-04-18', 'Laki-laki', 'Blok Pasiramis RT 02 RW 04, Dusun Cikondang', 8, 'Islam', 'Pengusaha Kuliner', 'Kawin', 'Kepala keluarga', 'Engkus Kuswara', 'Mimin Mintarsih', 'SLTA/Sederajat', 'Tidak Ada'],
      ['3211185006860010', '3211182501110088', 'Lilis Komariah', 'Garut', '1986-06-10', 'Perempuan', 'Blok Pasiramis RT 02 RW 04, Dusun Cikondang', 8, 'Islam', 'Ibu Rumah Tangga', 'Kawin', 'Istri', 'Asep Saepudin', 'Tati Hartati', 'SLTA/Sederajat', 'Tidak Ada'],
      ['3211180702740011', '3211180702100099', 'Hendra Wijaya', 'Sumedang', '1974-02-07', 'Laki-laki', 'Blok Pasarean RT 01 RW 02, Dusun Pawenang', 3, 'Islam', 'Wiraswasta', 'Kawin', 'Kepala keluarga', 'Cecep Wijaya', 'Entin Kartini', 'SLTA/Sederajat', 'Tidak Ada'],
      ['3211186909970012', '3211180702100099', 'Intan Permatasari', 'Sumedang', '1997-09-29', 'Perempuan', 'Blok Pasarean RT 01 RW 02, Dusun Pawenang', 3, 'Islam', 'Perawat', 'Belum Kawin', 'Anak', 'Hendra Wijaya', 'Siti Aminah', 'Akademi/D-III/S-Muda', 'Tidak Ada'],
    ];
    for (const r of residentsData) {
      insertResident.run(...r);
    }
  } else {
    // Backfill realistic defaults for previously seeded rows whose parent/education details are still empty
    const backfillSeeds: Array<[string, string, string, string, string, string]> = [
      ['3211181205850001', 'Kepala keluarga', 'H. Endang Suparman', 'Hj. Siti Rohimah', 'Strata 1', 'Tidak Ada'],
      ['3211185408880002', 'Istri', 'Ujang Komarudin', 'Euis Hasanah', 'SLTA/Sederajat', 'Tidak Ada'],
      ['3211182003920003', 'Kepala keluarga', 'Tatang Suryana', 'Imas Suryani', 'Strata 1', 'Tidak Ada'],
      ['3211186111790004', 'Kepala keluarga', 'Dadang Hermawan', 'Tuti Alawiyah', 'Strata 1', 'Tidak Ada'],
      ['3211181507760005', 'Kepala keluarga', 'Abdurrahman', 'Aminah', 'SLTP/Sederajat', 'Tidak Ada'],
      ['3211184802950006', 'Kepala keluarga', 'Rahmat Hidayat', 'Kokom Komariah', 'SLTA/Sederajat', 'Tidak Ada'],
      ['3211180309900007', 'Kepala keluarga', 'Ade Kusumah', 'Yayah Rokayah', 'Akademi/D-III/S-Muda', 'Tidak Ada'],
      ['3211186512010008', 'Kepala keluarga', 'Wawan Hermawan', 'Neni Kurniawati', 'SLTA/Sederajat', 'Tidak Ada'],
      ['3211181804830009', 'Kepala keluarga', 'Engkus Kuswara', 'Mimin Mintarsih', 'SLTA/Sederajat', 'Tidak Ada'],
      ['3211185006860010', 'Istri', 'Asep Saepudin', 'Tati Hartati', 'SLTA/Sederajat', 'Tidak Ada'],
      ['3211180702740011', 'Kepala keluarga', 'Cecep Wijaya', 'Entin Kartini', 'SLTA/Sederajat', 'Tidak Ada'],
      ['3211186909970012', 'Anak', 'Hendra Wijaya', 'Siti Aminah', 'Akademi/D-III/S-Muda', 'Tidak Ada'],
    ];
    const backfillStmt = db.prepare(`
      UPDATE residents
      SET family_relationship = ?,
          father_name = ?,
          mother_name = ?,
          education = ?,
          physical_disability = ?
      WHERE nik = ? AND father_name = '' AND mother_name = ''
    `);
    for (const [nik, rel, father, mother, edu, disab] of backfillSeeds) {
      backfillStmt.run(rel, father, mother, edu, disab, nik);
    }
  }

  const officialCount = db.prepare('SELECT COUNT(*) as count FROM officials').get() as { count: number };
  if (officialCount.count === 0) {
    const insertOfficial = db.prepare(
      'INSERT INTO officials (name, position, nip, sort_order, photo_url, phone, bio, tte_status, tte_code, tte_approved_by, tte_approved_at, can_sign_letters) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const nowIso = new Date().toISOString();
    const officialsData = [
      ['H. Asep Kurniawan, S.Sos.', 'Kepala Desa Margamukti', 'NIAP. 19740512 202101 1 001', 1, '', '081220458801', 'Memimpin penyelenggaraan pemerintahan, pembangunan, pembinaan kemasyarakatan, dan pemberdayaan Desa Margamukti.', 'approved', 'TTE-MGM-KADES-001', 'Super Admin Desa Margamukti', nowIso, 1],
      ['Rina Marlina, S.AP.', 'Sekretaris Desa', 'NIAP. 19820819 201603 2 002', 2, '', '081220458802', 'Koordinator administrasi kesekretariatan, perencanaan program desa, dan tata naskah dinas.', 'none', '', '', null, 1],
      ['Dadan Ramdani, S.E.', 'Kaur Keuangan', 'NIAP. 19870311 201805 1 003', 3, '', '081220458803', 'Mengelola administrasi keuangan desa, APBDes, dan pelaporan realisasi anggaran.', 'none', '', '', null, 0],
      ['Yudi Hermawan, S.Kom.', 'Kaur Umum dan TU', 'NIAP. 19890417 201901 1 008', 4, '', '081220458808', 'Mengelola tata naskah dinas, kearsipan surat desa, inventaris aset, dan administrasi umum perkantoran.', 'none', '', '', null, 1],
      ['Rizky Pratama, S.Pd.', 'Kaur Perencanaan', 'NIAP. 19910722 202003 1 009', 5, '', '081220458809', 'Menyusun rencana anggaran program kerja desa (RKPDes/RPJMDes) dan evaluasi pelaporan pembangunan.', 'none', '', '', null, 1],
      ['Agus Permana', 'Kasi Pemerintahan', 'NIAP. 19851108 201704 1 005', 6, '', '081220458805', 'Mengelola administrasi kependudukan, pertanahan, dan ketertiban wilayah desa.', 'none', '', '', null, 1],
      ['Siti Nurjanah, S.Pd.', 'Kasi Pelayanan', 'NIAP. 19900125 201902 2 004', 7, '', '081220458804', 'Menangani pelayanan surat keterangan warga, kesejahteraan sosial, posyandu, dan pemberdayaan UMKM.', 'none', '', '', null, 1],
      ['Oman Abdurahman', 'Kepala Dusun Pawenang', 'NIAP. 19790614 201501 1 006', 8, '', '081220458806', 'Koordinator wilayah Dusun Pawenang meliputi Blok Kebonkalapa, Pasarean, dan Balong.', 'none', '', '', null, 0],
      ['Endang Suherman', 'Kepala Dusun Cikondang', 'NIAP. 19810903 201608 1 007', 9, '', '081220458807', 'Koordinator wilayah Dusun Cikondang meliputi Blok Sukajadi dan Pasiramis.', 'none', '', '', null, 0],
    ];
    for (const o of officialsData) {
      insertOfficial.run(...o);
    }
  } else {
    // Pastikan 6 jabatan penanda tangan (termasuk Kaur Umum dan TU & Kaur Perencanaan) tersedia untuk database existing
    const existingPositions = db.prepare('SELECT id, position, tte_status, tte_code, can_sign_letters FROM officials').all() as Array<{
      id: number;
      position: string;
      tte_status: string;
      tte_code: string;
      can_sign_letters: number;
    }>;
    const hasKaurUmum = existingPositions.some((o) => o.position.toLowerCase().includes('kaur umum'));
    const hasKaurPerencanaan = existingPositions.some((o) => o.position.toLowerCase().includes('kaur perencanaan'));
    const insertMissingOfficial = db.prepare(
      'INSERT INTO officials (name, position, nip, sort_order, photo_url, phone, bio, can_sign_letters) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
    );
    if (!hasKaurUmum) {
      insertMissingOfficial.run(
        'Yudi Hermawan, S.Kom.',
        'Kaur Umum dan TU',
        'NIAP. 19890417 201901 1 008',
        4,
        '',
        '081220458808',
        'Mengelola tata naskah dinas, kearsipan surat desa, inventaris aset, dan administrasi umum perkantoran.'
      );
    }
    if (!hasKaurPerencanaan) {
      insertMissingOfficial.run(
        'Rizky Pratama, S.Pd.',
        'Kaur Perencanaan',
        'NIAP. 19910722 202003 1 009',
        5,
        '',
        '081220458809',
        'Menyusun rencana anggaran program kerja desa (RKPDes/RPJMDes) dan evaluasi pelaporan pembangunan.'
      );
    }
    // Pastikan jabatan penanda tangan utama memiliki flag can_sign_letters = 1 dan Kepala Desa punya TTE awal jika belum pernah diatur
    const signRoles = ['kepala desa', 'sekretaris desa', 'kaur umum', 'kasi pemerintahan', 'kasi pelayanan', 'kasi kesejahteraan', 'kaur perencanaan'];
    const markSigner = db.prepare('UPDATE officials SET can_sign_letters = 1 WHERE id = ?');
    for (const off of existingPositions) {
      const lowerPos = off.position.toLowerCase();
      if (signRoles.some((r) => lowerPos.includes(r)) && off.can_sign_letters !== 1) {
        markSigner.run(off.id);
      }
      if (lowerPos.includes('kepala desa') && !lowerPos.includes('dusun') && off.tte_status === 'none' && !off.tte_code) {
        db.prepare(
          "UPDATE officials SET tte_status = 'approved', tte_code = 'TTE-MGM-KADES-001', tte_approved_by = 'Super Admin Desa Margamukti', tte_approved_at = ? WHERE id = ?"
        ).run(new Date().toISOString(), off.id);
      }
    }
  }

  const templateCount = db.prepare('SELECT COUNT(*) as count FROM letter_templates').get() as { count: number };
  if (templateCount.count === 0) {
    const insertTpl = db.prepare(`
      INSERT INTO letter_templates (code, name, classification_code, description, body_template, required_fields, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    insertTpl.run(
      'SKD',
      'Surat Keterangan Domisili',
      '470',
      'Menerangkan bahwa pemohon benar-benar berdomisili dan bertempat tinggal di wilayah Desa Margamukti.',
      `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:

Nama Lengkap          : {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Agama                 : {{agama}}
Pekerjaan             : {{pekerjaan}}
Status Perkawinan     : {{status_perkawinan}}
Alamat                : {{alamat}}

Adalah benar warga yang berdomisili dan bertempat tinggal di alamat tersebut di atas pada wilayah Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang.

Surat keterangan ini dibuat untuk keperluan: {{keperluan}}.

Demikian surat keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.`,
      JSON.stringify([])
    );

    insertTpl.run(
      'SKU',
      'Surat Keterangan Usaha (SKU)',
      '503',
      'Keterangan resmi kepemilikan kegiatan usaha warga untuk pengajuan modal bank, KUR, atau perizinan NIB.',
      `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:

Nama Lengkap          : {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Pekerjaan             : {{pekerjaan}}
Alamat                : {{alamat}}

Berdasarkan pengamatan serta keterangan Ketua RT/RW setempat, orang tersebut di atas benar memiliki dan menjalankan kegiatan usaha:
Nama / Jenis Usaha    : {{nama_usaha}}
Lokasi Usaha          : {{lokasi_usaha}}

Surat keterangan ini diberikan untuk keperluan: {{keperluan}}.

Demikian surat keterangan usaha ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.`,
      JSON.stringify([
        { key: 'nama_usaha', label: 'Nama / Jenis Usaha', placeholder: 'Contoh: Warung Tahu & Kuliner Sunda' },
        { key: 'lokasi_usaha', label: 'Lokasi Usaha', placeholder: 'Contoh: Blok Kebonkalapa RT 01 RW 01' },
      ])
    );

    insertTpl.run(
      'SKTM',
      'Surat Keterangan Tidak Mampu (SKTM)',
      '401',
      'Surat keterangan kondisi ekonomi keluarga untuk pengajuan beasiswa pendidikan, KIP, atau bantuan kesehatan.',
      `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:

Nama Lengkap          : {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Pekerjaan             : {{pekerjaan}}
Alamat                : {{alamat}}

Berdasarkan data kependudukan dan verifikasi perangkat wilayah setempat, keluarga tersebut di atas tergolong keluarga kurang mampu / pra-sejahtera di Desa Margamukti.

Surat keterangan ini diterbitkan untuk keperluan: {{keperluan}}.

Demikian surat keterangan ini dibuat dengan sebenarnya agar pihak berkepentingan dapat memberikan bantuan atau fasilitas sesuai ketentuan yang berlaku.`,
      JSON.stringify([
        { key: 'tanggungan', label: 'Jumlah Tanggungan Keluarga', placeholder: 'Contoh: 3 Orang' },
      ])
    );

    insertTpl.run(
      'SKCK',
      'Surat Pengantar SKCK',
      '300',
      'Surat pengantar dari Pemerintah Desa untuk pengurusan Surat Keterangan Catatan Kepolisian (SKCK) di Polsek/Polres.',
      `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:

Nama Lengkap          : {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Agama                 : {{agama}}
Pekerjaan             : {{pekerjaan}}
Status Perkawinan     : {{status_perkawinan}}
Alamat                : {{alamat}}

Orang tersebut di atas adalah warga Desa Margamukti yang berkelakuan baik, tidak pernah tersangkut perkara pidana, serta aktif bermasyarakat di lingkungannya.

Surat pengantar ini diberikan untuk keperluan: {{keperluan}} (Pengurusan SKCK).

Demikian surat pengantar ini dibuat untuk dipergunakan sebagaimana mestinya.`,
      JSON.stringify([])
    );

    insertTpl.run(
      'SKKL',
      'Surat Keterangan Kelahiran / Kematian',
      '474',
      'Surat keterangan peristiwa kependudukan (kelahiran atau kematian) sebagai dasar penerbitan akta catatan sipil.',
      `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya berdasarkan pelaporan dari:

Nama Pelapor          : {{nama}}
NIK Pelapor           : {{nik}}
Alamat                : {{alamat}}

Telah melaporkan peristiwa kependudukan berupa {{jenis_peristiwa}} atas nama {{nama_subjek}} yang terjadi pada tanggal {{tanggal_peristiwa}} di {{lokasi_peristiwa}}.

Surat keterangan ini dibuat untuk keperluan: {{keperluan}}.

Demikian surat keterangan ini dibuat dengan sebenarnya untuk proses pencatatan administrasi kependudukan lebih lanjut.`,
      JSON.stringify([
        { key: 'jenis_peristiwa', label: 'Jenis Peristiwa', placeholder: 'Kelahiran / Kematian' },
        { key: 'nama_subjek', label: 'Nama Bayi / Almarhum', placeholder: 'Nama lengkap subjek' },
        { key: 'tanggal_peristiwa', label: 'Tanggal Peristiwa', placeholder: 'Contoh: 12 November 2026' },
        { key: 'lokasi_peristiwa', label: 'Tempat / Lokasi Peristiwa', placeholder: 'Contoh: RSUD Sumedang / Dusun Pawenang' },
      ])
    );
  }

  // Pastikan 3 format layanan surat baru selalu tersedia walau database sudah terisi sebelumnya
  const insertExtraTpl = db.prepare(`
    INSERT OR IGNORE INTO letter_templates (code, name, classification_code, description, body_template, required_fields, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  insertExtraTpl.run(
    'SKAW',
    'Surat Keterangan Ahli Waris',
    '474',
    'Surat keterangan resmi daftar ahli waris yang sah dari almarhum/almarhumah untuk pengurusan administrasi bank, tanah, atau keperdataan.',
    `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya berdasarkan pelaporan dan pernyataan:

Nama Pemohon / Pelapor: {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Pekerjaan             : {{pekerjaan}}
Alamat                : {{alamat}}
Hubungan dengan Alm.  : {{hubungan_pelapor}}

Menerangkan bahwa telah meninggal dunia seorang warga kami bernama:
Nama Almarhum / Almh. : {{nama_almarhum}}
Tanggal Meninggal     : {{tanggal_meninggal}}
Tempat / Alamat Akhir : {{lokasi_meninggal}}

Berdasarkan keterangan keluarga serta verifikasi Ketua RT/RW setempat, almarhum/almarhumah meninggalkan ahli waris yang sah sebagai berikut:
{{daftar_ahli_waris}}

Surat keterangan ahli waris ini dibuat untuk keperluan: {{keperluan}}.

Demikian surat keterangan ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.`,
    JSON.stringify([
      { key: 'nama_almarhum', label: 'Nama Almarhum / Almarhumah', placeholder: 'Contoh: H. Ujang Suryana (Alm.)' },
      { key: 'tanggal_meninggal', label: 'Tanggal Meninggal Dunia', placeholder: 'Contoh: 14 Agustus 2024' },
      { key: 'lokasi_meninggal', label: 'Tempat Meninggal / Alamat Terakhir', placeholder: 'Contoh: RSUD Sumedang / Blok Kebonkalapa RT 01 RW 01' },
      { key: 'hubungan_pelapor', label: 'Hubungan Pemohon dengan Almarhum', placeholder: 'Contoh: Anak Kandung / Istri / Suami' },
      {
        key: 'daftar_ahli_waris',
        label: 'Daftar Nama & Keterangan Ahli Waris',
        placeholder: '1. Siti Aminah (Istri)\n2. Ahmad Fauzi (Anak Kandung)\n3. Rina Kartika (Anak Kandung)',
        type: 'textarea',
      },
    ])
  );

  insertExtraTpl.run(
    'SKTMR',
    'Surat Keterangan Tidak Memiliki Rumah',
    '470',
    'Keterangan resmi bahwa pemohon belum memiliki rumah sendiri untuk pengajuan KPR bersubsidi, bantuan perumahan, atau administrasi bank.',
    `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:

Nama Lengkap          : {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Agama                 : {{agama}}
Pekerjaan             : {{pekerjaan}}
Status Perkawinan     : {{status_perkawinan}}
Alamat Domisili       : {{alamat}}

Berdasarkan data kependudukan desa dan keterangan Ketua RT/RW setempat, orang tersebut di atas hingga saat dikeluarkannya surat ini benar BELUM MEMILIKI RUMAH / tempat tinggal atas nama pribadi di wilayah Desa Margamukti maupun di tempat lain.

Keterangan Hunian Saat Ini:
Status Tempat Tinggal : {{status_hunian}}
Pemilik Rumah / KK    : {{nama_pemilik_rumah}}
Menempati Sejak       : {{menempati_sejak}}

Surat keterangan ini diterbitkan untuk keperluan: {{keperluan}}.

Demikian surat keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.`,
    JSON.stringify([
      { key: 'status_hunian', label: 'Status Tempat Tinggal Saat Ini', placeholder: 'Contoh: Menumpang pada rumah orang tua / Mengontrak' },
      { key: 'nama_pemilik_rumah', label: 'Nama Pemilik Rumah / Kepala Keluarga', placeholder: 'Contoh: Bpk. Dedi Supriadi' },
      { key: 'menempati_sejak', label: 'Menempati Alamat Sejak Tahun', placeholder: 'Contoh: Tahun 2018' },
    ])
  );

  insertExtraTpl.run(
    'SKTPT',
    'Surat Keterangan Tidak Mempunyai Penghasilan Tetap',
    '401',
    'Surat keterangan kondisi pendapatan tidak tetap (pekerja lepas/harian/wiraswasta kecil) untuk beasiswa, KIP Kuliah, bansos, atau keringanan biaya.',
    `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:

Nama Lengkap          : {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Agama                 : {{agama}}
Pekerjaan             : {{pekerjaan}}
Alamat                : {{alamat}}

Berdasarkan pengamatan serta verifikasi perangkat wilayah setempat, orang tersebut di atas benar merupakan warga Desa Margamukti yang TIDAK MEMPUNYAI PENGHASILAN TETAP setiap bulannya, dengan rincian sebagai berikut:
Sumber Penghasilan    : {{sumber_penghasilan}}
Rata-rata Penghasilan : {{perkiraan_penghasilan}}
Tanggungan Keluarga   : {{jumlah_tanggungan}}

Surat keterangan ini diterbitkan untuk keperluan: {{keperluan}}.

Demikian surat keterangan ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya oleh pihak yang berkepentingan.`,
    JSON.stringify([
      { key: 'sumber_penghasilan', label: 'Aktivitas / Sumber Penghasilan Tidak Tetap', placeholder: 'Contoh: Buruh harian lepas / Pedagang keliling' },
      { key: 'perkiraan_penghasilan', label: 'Perkiraan Rata-rata Penghasilan per Bulan', placeholder: 'Contoh: Rp 750.000 - Rp 1.100.000 / bulan (tidak menentu)' },
      { key: 'jumlah_tanggungan', label: 'Jumlah Tanggungan Keluarga', placeholder: 'Contoh: 3 Orang' },
    ])
  );

  // Pastikan 7 format surat baru sesuai aturan baku kearsipan (Permendagri / ANRI) selalu tersedia & bisa diedit admin
  insertExtraTpl.run(
    'SIR',
    'Surat Izin Rame-rame / Keramaian',
    '300',
    'Surat rekomendasi/izin penyelenggaraan acara keramaian masyarakat (hajatan, syukuran, hiburan rakyat, atau pentas seni) untuk pengajuan izin ke Polsek.',
    `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, berdasarkan permohonan yang bersangkutan serta rekomendasi Ketua RT/RW setempat, dengan ini memberikan pengantar izin keramaian kepada:

Nama Lengkap          : {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Pekerjaan             : {{pekerjaan}}
Alamat                : {{alamat}}

Untuk menyelenggarakan kegiatan keramaian/hajatan berupa {{nama_acara}} dengan hiburan {{jenis_hiburan}} pada:
Hari / Tanggal        : {{tanggal_acara}}
Waktu Pelaksanaan     : {{waktu_acara}}
Tempat Pelaksanaan    : {{lokasi_acara}}

Surat izin ini diterbitkan untuk keperluan: {{keperluan}}, dengan ketentuan penyelenggara wajib menjaga ketertiban umum, keamanan lingkungan, serta mematuhi peraturan batas waktu kegiatan yang berlaku.

Demikian surat izin keramaian ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.`,
    JSON.stringify([
      { key: 'nama_acara', label: 'Nama / Jenis Acara', placeholder: 'Contoh: Walimatul Ursy / Syukuran Khitanan' },
      { key: 'jenis_hiburan', label: 'Jenis Hiburan (Jika Ada)', placeholder: 'Contoh: Organ Tunggal / Kesenian Tradisional / Tanpa Hiburan' },
      { key: 'tanggal_acara', label: 'Hari & Tanggal Acara', placeholder: 'Contoh: Minggu, 24 November 2026' },
      { key: 'waktu_acara', label: 'Waktu Pelaksanaan', placeholder: 'Contoh: Pukul 09.00 - 16.00 WIB' },
      { key: 'lokasi_acara', label: 'Lokasi Acara', placeholder: 'Contoh: Halaman Rumah Blok Kebonkalapa RT 01 RW 01' },
    ])
  );

  insertExtraTpl.run(
    'SKDLK',
    'Surat Keterangan Di Luar Kota',
    '470',
    'Keterangan resmi bahwa warga yang bersangkutan sedang berada atau bekerja/menempuh pendidikan di luar kota untuk keperluan administrasi.',
    `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:

Nama Lengkap          : {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Agama                 : {{agama}}
Pekerjaan             : {{pekerjaan}}
Alamat KTP            : {{alamat}}

Berdasarkan keterangan keluarga dan perangkat wilayah RT/RW setempat, warga tersebut di atas saat ini sedang berada di luar wilayah Desa Margamukti, yaitu di:
Kota / Wilayah Tujuan : {{kota_tujuan}}
Keberadaan Sejak      : {{sejak_tanggal}}
Alasan / Aktivitas    : {{alasan_luar_kota}}

Surat keterangan ini dibuat untuk keperluan: {{keperluan}}.

Demikian surat keterangan ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.`,
    JSON.stringify([
      { key: 'kota_tujuan', label: 'Kota / Alamat Keberadaan Saat Ini', placeholder: 'Contoh: Kota Bandung, Jawa Barat' },
      { key: 'sejak_tanggal', label: 'Berada di Luar Kota Sejak', placeholder: 'Contoh: Januari 2026' },
      { key: 'alasan_luar_kota', label: 'Alasan / Aktivitas di Luar Kota', placeholder: 'Contoh: Bekerja sebagai Karyawan Swasta / Kuliah' },
    ])
  );

  insertExtraTpl.run(
    'SKBN',
    'Surat Keterangan Beda Nama / Identitas',
    '470',
    'Surat keterangan resmi yang menyatakan bahwa dua penulisan nama/identitas yang berbeda pada dokumen berbeda merujuk pada satu orang yang sama.',
    `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:

Nama Sesuai KTP       : {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Pekerjaan             : {{pekerjaan}}
Alamat                : {{alamat}}

Berdasarkan dokumen kependudukan serta surat pernyataan yang bersangkutan, terdapat perbedaan pencatatan identitas pada dokumen berikut:
Dokumen I             : {{dokumen_pertama}} (tertulis: {{identitas_dokumen_pertama}})
Dokumen II            : {{dokumen_kedua}} (tertulis: {{identitas_dokumen_kedua}})

Dengan ini ditegaskan bahwa kedua penulisan nama/identitas tersebut di atas adalah BENAR MILIK SATU ORANG YANG SAMA sesuai identitas KTP-el di Desa Margamukti.

Surat keterangan ini dibuat untuk keperluan: {{keperluan}}.

Demikian surat keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.`,
    JSON.stringify([
      { key: 'dokumen_pertama', label: 'Nama Dokumen Sumber I', placeholder: 'Contoh: KTP-el / Kartu Keluarga' },
      { key: 'identitas_dokumen_pertama', label: 'Nama/Data Tertulis di Dokumen I', placeholder: 'Contoh: AHMAD FAUZI' },
      { key: 'dokumen_kedua', label: 'Nama Dokumen Sumber II', placeholder: 'Contoh: Ijazah SD / Buku Nikah / Sertifikat Tanah' },
      { key: 'identitas_dokumen_kedua', label: 'Nama/Data Tertulis di Dokumen II', placeholder: 'Contoh: AHMAD PAUJI' },
    ])
  );

  insertExtraTpl.run(
    'SKBM',
    'Surat Keterangan Belum Menikah',
    '474.2',
    'Keterangan resmi bahwa pemohon berstatus belum pernah menikah / lajang untuk syarat pernikahan (KUA/Catatan Sipil), pekerjaan, atau beasiswa.',
    `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:

Nama Lengkap          : {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Agama                 : {{agama}}
Pekerjaan             : {{pekerjaan}}
Status Perkawinan     : {{status_perkawinan}}
Alamat                : {{alamat}}

Berdasarkan data kependudukan desa dan pengamatan Ketua RT/RW setempat, warga tersebut di atas hingga tanggal diterbitkannya surat ini benar berstatus BELUM PERNAH MENIKAH / LAJANG (Jejaka/Perawan).

Surat keterangan ini dibuat untuk keperluan: {{keperluan}}.

Demikian surat keterangan ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.`,
    JSON.stringify([])
  );

  insertExtraTpl.run(
    'SKSG',
    'Surat Keterangan Serbaguna (Format Kustom)',
    '470',
    'Format surat serbaguna yang dapat disesuaikan judul maupun isi uraian keterangannya untuk kebutuhan administrasi yang belum tersedia di daftar standar.',
    `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:

Nama Lengkap          : {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Agama                 : {{agama}}
Pekerjaan             : {{pekerjaan}}
Status Perkawinan     : {{status_perkawinan}}
Alamat                : {{alamat}}

Berdasarkan data administrasi Desa Margamukti serta keterangan pihak terkait, dengan ini diterangkan hal sebagai berikut:
{{uraian_keterangan}}

Surat keterangan ini diterbitkan untuk keperluan: {{keperluan}}.

Demikian surat keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.`,
    JSON.stringify([
      { key: 'judul_surat_khusus', label: 'Judul Surat Kustom (Opsional)', placeholder: 'Contoh: SURAT KETERANGAN PENGHASILAN ORANG TUA' },
      {
        key: 'uraian_keterangan',
        label: 'Uraian / Isi Keterangan Surat',
        placeholder: 'Tuliskan rincian keterangan resmi yang perlu dicantumkan di dalam badan surat...',
        type: 'textarea',
      },
    ])
  );

  insertExtraTpl.run(
    'SKJD',
    'Surat Keterangan Janda / Duda',
    '474.2',
    'Keterangan resmi status Janda atau Duda (cerai hidup / cerai mati) untuk keperluan pengurusan pensiun, pernikahan ulang, atau administrasi hukum.',
    `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:

Nama Lengkap          : {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Agama                 : {{agama}}
Pekerjaan             : {{pekerjaan}}
Alamat                : {{alamat}}

Berdasarkan data kependudukan serta bukti pencatatan sipil/pernikahan yang ada, orang tersebut di atas hingga saat ini berstatus {{status_janda_duda}} dari almarhum/mantan pasangan bernama {{nama_mantan_pasangan}} sejak tanggal {{tanggal_status}} ({{dasar_status}}), dan sampai surat ini dibuat belum menikah lagi.

Surat keterangan ini diterbitkan untuk keperluan: {{keperluan}}.

Demikian surat keterangan ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.`,
    JSON.stringify([
      { key: 'status_janda_duda', label: 'Status Saat Ini', placeholder: 'Contoh: Janda Cerai Mati / Duda Cerai Hidup' },
      { key: 'nama_mantan_pasangan', label: 'Nama Almarhum / Mantan Suami/Istri', placeholder: 'Contoh: Ujang Suryana (Alm.)' },
      { key: 'tanggal_status', label: 'Tanggal Meninggal / Cerai', placeholder: 'Contoh: 12 Mei 2023' },
      { key: 'dasar_status', label: 'Nomor Akta Cerai / Surat Kematian', placeholder: 'Contoh: Akta Kematian No. 3211-KM-...' },
    ])
  );

  insertExtraTpl.run(
    'SKKH',
    'Surat Keterangan Kehilangan (Pengantar Laporan)',
    '331',
    'Surat pengantar resmi dari Pemerintah Desa untuk pelaporan kehilangan dokumen berharga (KTP, KK, Ijazah, ATM, STNK, dll.) ke Kepolisian.',
    `Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:

Nama Lengkap          : {{nama}}
NIK                   : {{nik}}
Tempat/Tanggal Lahir  : {{ttl}}
Jenis Kelamin         : {{jenis_kelamin}}
Pekerjaan             : {{pekerjaan}}
Alamat                : {{alamat}}

Berdasarkan laporan dari yang bersangkutan kepada Pemerintah Desa Margamukti, orang tersebut di atas mengaku telah kehilangan barang/dokumen berharga berupa:
Barang / Dokumen      : {{barang_hilang}}
Perkiraan Waktu       : {{waktu_kehilangan}}
Lokasi Kejadian       : {{lokasi_kehilangan}}
Kronologi Singkat     : {{kronologi_singkat}}

Surat pengantar keterangan kehilangan ini diterbitkan untuk keperluan: {{keperluan}} (pengurusan Surat Tanda Terima Laporan Kehilangan di Polsek/Polres setempat).

Demikian surat keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.`,
    JSON.stringify([
      { key: 'barang_hilang', label: 'Dokumen / Barang yang Hilang', placeholder: 'Contoh: 1 (satu) buah KTP-el & Kartu ATM BRI' },
      { key: 'waktu_kehilangan', label: 'Hari / Perkiraan Waktu Kehilangan', placeholder: 'Contoh: Senin, 18 November 2026 sekitar pukul 10.00 WIB' },
      { key: 'lokasi_kehilangan', label: 'Lokasi Perkiraan Kehilangan', placeholder: 'Contoh: Di sepanjang Jl. Margamukti - Alun-alun Sumedang' },
      { key: 'kronologi_singkat', label: 'Kronologi Singkat Kehilangan', placeholder: 'Contoh: Dompet terjatuh saat berkendara menuju pasar...', type: 'textarea' },
    ])
  );

  const reqCount = db.prepare('SELECT COUNT(*) as count FROM letter_requests').get() as { count: number };
  if (reqCount.count === 0) {
    const insertReq = db.prepare(`
      INSERT INTO letter_requests (
        tracking_code, template_id, letter_number, applicant_nik, applicant_name,
        birth_place, birth_date, gender, religion, occupation, marital_status,
        address, phone, purpose, extra_data, status, admin_notes, approved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertReq.run(
      'SRT-2026-0001',
      1,
      '470 / 018 / DS-MGM / XI / 2026',
      '3211181205850001',
      'Ahmad Fauzi',
      'Sumedang',
      '1985-05-12',
      'Laki-laki',
      'Islam',
      'Wiraswasta',
      'Kawin',
      'Blok Kebonkalapa RT 01 RW 01, Dusun Pawenang, Desa Margamukti',
      '081223344556',
      'Persyaratan Administrasi Pembukaan Rekening Bank',
      '{}',
      'approved',
      'Data kependudukan sesuai dengan register desa.',
      '2026-11-15 10:15:00'
    );

    insertReq.run(
      'SRT-2026-0002',
      2,
      '',
      '3211184802950006',
      'Fitriani Rahmawati',
      'Sumedang',
      '1995-02-08',
      'Perempuan',
      'Islam',
      'Pengrajin UMKM',
      'Kawin',
      'Blok Sukajadi RT 01 RW 03, Dusun Cikondang, Desa Margamukti',
      '081398765432',
      'Pengajuan Kredit Usaha Rakyat (KUR) Pengembangan Anyaman Bambu',
      JSON.stringify({
        nama_usaha: 'Sanggar Anyaman Bambu Mukti',
        lokasi_usaha: 'Blok Sukajadi RT 01 RW 03, Dusun Cikondang',
      }),
      'pending',
      '',
      null
    );
  }

  const articleCount = db.prepare('SELECT COUNT(*) as count FROM articles').get() as { count: number };
  if (articleCount.count === 0) {
    const insertArticle = db.prepare(`
      INSERT INTO articles (title, slug, category, excerpt, content, image_url, author_name, published_at, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertArticle.run(
      'Musrenbangdes Desa Margamukti Tetapkan Prioritas Pembangunan Infrastruktur 2026',
      'musrenbangdes-margamukti-2026',
      'Pemerintahan',
      'Pemerintah Desa bersama BPD dan perwakilan RT/RW Dusun Pawenang serta Dusun Cikondang menyepakati rencana kerja pembangunan desa tahun anggaran berjalan.',
      '<p>Bertempat di Aula Balai Desa Margamukti, Pemerintah Desa bersama Badan Permusyawaratan Desa (BPD), para Kepala Dusun, Ketua RW/RT, dan tokoh masyarakat menyelenggarakan Musyawarah Perencanaan Pembangunan Desa (Musrenbangdes).</p><p>Beberapa poin utama yang menjadi kesepakatan bersama meliputi peningkatan drainase lingkungan di Blok Kebonkalapa dan Blok Pasarean, perbaikan jalan penghubung antar blok di Dusun Cikondang, serta dukungan permodalan dan pemasaran digital bagi pelaku UMKM desa.</p><blockquote>Partisipasi aktif warga menjadi kunci agar setiap rupiah anggaran desa tepat sasaran dan dirasakan langsung manfaatnya oleh masyarakat Margamukti.</blockquote><p>Hasil musyawarah ini selanjutnya dituangkan ke dalam dokumen RKPDes sebagai acuan pelaksanaan kegiatan sepanjang tahun berjalan.</p>',
      '/src/assets/images/berita_musrenbang_1794845873844.jpg',
      'Rina Marlina, S.AP.',
      '2026-11-10'
    );

    insertArticle.run(
      'Pelayanan Posyandu Rutin dan Pemantauan Gizi Balita di Dusun Pawenang & Cikondang',
      'posyandu-rutin-gizi-balita-margamukti',
      'Kesehatan',
      'Kader kesehatan desa bersinergi dengan Puskesmas Sumedang Utara menggelar penimbangan balita, pemberian vitamin, serta penyuluhan gizi keluarga.',
      '<p>Kegiatan Posyandu rutin bulanan kembali dilaksanakan serentak di wilayah Dusun Pawenang dan Dusun Cikondang. Sebanyak puluhan ibu dan balita hadir mengikuti pemeriksaan tumbuh kembang, imunisasi dasar, serta pemberian makanan tambahan (PMT) bergizi berbahan pangan lokal.</p><p>Kepala Seksi Kesejahteraan Desa Margamukti menyampaikan apresiasi atas dedikasi para kader Posyandu yang konsisten mendata perkembangan kesehatan ibu dan anak sehingga program pencegahan stunting di Desa Margamukti terus menunjukkan hasil positif.</p>',
      '/src/assets/images/berita_posyandu_1794845877855.jpg',
      'Siti Nurjanah, S.Pd.',
      '2026-11-06'
    );

    insertArticle.run(
      'Gerakan Jumat Bersih dan Gotong Royong Pemeliharaan Saluran Air di Blok Sukajadi',
      'gerakan-jumat-bersih-blok-sukajadi',
      'Kemasyarakatan',
      'Warga bersama perangkat desa membersihkan bahu jalan dan saluran drainase menjelang puncak musim penghujan untuk mencegah genangan air.',
      '<p>Semangat gotong royong kembali tampak pada kegiatan Jumat Bersih yang diikuti warga Dusun Cikondang khususnya di Blok Sukajadi dan Blok Pasiramis. Warga bahu-membahu membersihkan sedimentasi saluran air, memangkas rumput bahu jalan desa, dan menata titik pengumpulan sampah terpilah.</p><p>Kegiatan ini dijadwalkan rutin bergilir di seluruh RW Desa Margamukti demi menjaga kebersihan dan kenyamanan lingkungan bersama.</p>',
      '/src/assets/images/galeri_gotong_royong_1794845943477.jpg',
      'Endang Suherman',
      '2026-11-01'
    );

    insertArticle.run(
      'Digitalisasi Layanan Surat Keterangan Warga Kini Dapat Diajukan dari Rumah',
      'digitalisasi-layanan-surat-margamukti',
      'Layanan Publik',
      'Warga Desa Margamukti kini dapat mengajukan permohonan Surat Domisili, SKU, SKTM, hingga pengantar SKCK melalui portal desa dan memantau statusnya secara langsung.',
      '<p>Sebagai wujud komitmen peningkatan pelayanan publik yang transparan dan efisien, Pemerintah Desa Margamukti meluncurkan Portal Layanan Mandiri Warga. Melalui layanan ini, masyarakat cukup memasukkan NIK untuk mengisi biodata permohonan surat secara otomatis dan memperoleh kode pelacakan.</p><p>Setelah diverifikasi oleh operator desa, surat resmi ber-Kop Pemerintah Kabupaten Sumedang dapat langsung diunduh maupun diambil di Balai Desa.</p>',
      '/src/assets/images/hero_desa_margamukti_clean_1794845942599.jpg',
      'H. Asep Kurniawan, S.Sos.',
      '2026-10-25'
    );
  }

  const umkmCount = db.prepare('SELECT COUNT(*) as count FROM umkm_products').get() as { count: number };
  if (umkmCount.count === 0) {
    const insertUmkm = db.prepare(`
      INSERT INTO umkm_products (business_name, product_name, category, owner_name, description, price, whatsapp, image_url, is_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertUmkm.run(
      'Tahu Renyah Kang Jajang',
      'Tahu Sumedang Spesial Isi 50 (Siap Santap / Mentah)',
      'Kuliner',
      'Jajang Nurjaman',
      'Tahu Sumedang asli produksi rumahan warga Blok Pasiramis, renyah di luar dan lembut gurih di dalam. Tersedia paket hangat besek bambu lengkap dengan cengek rawit dan sambal kecap.',
      25000,
      '6281320114455',
      '/src/assets/images/umkm_tahu_sumedang_1794845875892.jpg'
    );

    insertUmkm.run(
      'Sanggar Anyaman Mukti',
      'Set Keranjang & Nampan Anyaman Bambu Sunda',
      'Kerajinan',
      'Fitriani Rahmawati',
      'Kerajinan tangan anyaman bambu berkualitas ekspor karya pengrajin Dusun Cikondang. Cocok untuk perlengkapan dapur, hantaran pernikahan, maupun dekorasi ruang tamu bernuansa alami.',
      85000,
      '6281224557788',
      '/src/assets/images/umkm_kerajinan_bambu_1794845876533.jpg'
    );

    insertUmkm.run(
      'Dapur Bu Nenden',
      'Peuyeum Ketan & Sale Pisang Renyah Khas Sumedang',
      'Kuliner',
      'Nenden Kartika',
      'Olahan makanan tradisional tanpa bahan pengawet dengan cita rasa manis legit alami. Dikemas higienis dalam kotak oleh-oleh praktis untuk keluarga maupun tamu kantor.',
      30000,
      '6285294001122',
      '/src/assets/images/umkm_tahu_sumedang_1794845875892.jpg'
    );

    insertUmkm.run(
      'Kebun Agro Pawenang',
      'Beras Organik & Madu Hutan Asli Sumedang 500ml',
      'Pertanian',
      'Maman Abdurrahman',
      'Hasil panen petani Dusun Pawenang berupa beras pulen bebas pestisida dan madu murni panen berkala yang telah teruji kebersihannya.',
      75000,
      '6281563009911',
      '/src/assets/images/umkm_kerajinan_bambu_1794845876533.jpg'
    );
  }

  const galleryCount = db.prepare('SELECT COUNT(*) as count FROM gallery_items').get() as { count: number };
  if (galleryCount.count === 0) {
    const insertGallery = db.prepare(
      'INSERT INTO gallery_items (title, description, event_date, category, image_url) VALUES (?, ?, ?, ?, ?)'
    );
    insertGallery.run(
      'Pelayanan Terpadu di Balai Desa Margamukti',
      'Suasana pagi hari di halaman Kantor Desa Margamukti sebelum jam pelayanan administrasi warga dimulai.',
      '2026-11-12',
      'Pemerintahan',
      '/src/assets/images/hero_desa_margamukti_clean_1794845942599.jpg'
    );
    insertGallery.run(
      'Musyawarah Perencanaan Pembangunan Desa (Musrenbangdes)',
      'Diskusi penyusunan prioritas pembangunan sarana prasarana dusun bersama BPD dan tokoh masyarakat.',
      '2026-11-10',
      'Musyawarah',
      '/src/assets/images/berita_musrenbang_1794845873844.jpg'
    );
    insertGallery.run(
      'Posyandu Terpadu Dusun Pawenang & Cikondang',
      'Pemeriksaan kesehatan balita dan konsultasi gizi oleh kader Posyandu Desa Margamukti.',
      '2026-11-06',
      'Kesehatan',
      '/src/assets/images/berita_posyandu_1794845877855.jpg'
    );
    insertGallery.run(
      'Kerja Bakti Jumat Bersih Lingkungan RW 03',
      'Warga Blok Sukajadi bergotong royong membersihkan jalan lingkungan dan saluran drainase desa.',
      '2026-11-01',
      'Kemasyarakatan',
      '/src/assets/images/galeri_gotong_royong_1794845943477.jpg'
    );
  }

  const mapCount = db.prepare('SELECT COUNT(*) as count FROM map_locations').get() as { count: number };
  if (mapCount.count === 0) {
    const insertMap = db.prepare(
      'INSERT INTO map_locations (name, category, description, address, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const mapData = [
      ['Kantor Kepala Desa Margamukti', 'Pemerintahan', 'Pusat pelayanan administrasi kependudukan, surat keterangan, dan Balai Desa Margamukti.', 'Blok Kebonkalapa No. 12, Dusun Pawenang', -6.8283, 107.9000],
      ['SDN Bendungan I', 'Pendidikan', 'Sekolah dasar negeri yang melayani wilayah Dusun Pawenang dan sekitarnya.', 'Kampung Pasarean, Dusun Pawenang', -6.8261, 107.8978],
      ['SDN Bendungan II', 'Pendidikan', 'Sekolah dasar negeri di wilayah Dusun Cikondang.', 'Kampung Sukajadi, Dusun Cikondang', -6.8304, 107.9032],
      ['Posyandu Melati Pawenang', 'Kesehatan', 'Pos pelayanan terpadu kesehatan ibu, balita, dan lansia Dusun Pawenang.', 'Blok Kebonkalapa RW 01, Dusun Pawenang', -6.8272, 107.9012],
      ['Lapangan Olahraga Sukajadi', 'Fasilitas Umum', 'Sarana olahraga sepak bola, voli, dan kegiatan hari besar kemasyarakatan Desa Margamukti.', 'Blok Sukajadi RW 03, Dusun Cikondang', -6.8315, 107.9018],
      ['Masjid Jami Al-Mukti', 'Ibadah', 'Masjid besar pusat kegiatan keagamaan warga di sekitar Blok Pasarean dan Kebonkalapa.', 'Blok Pasarean RW 02, Dusun Pawenang', -6.8290, 107.8985],
    ];
    for (const m of mapData) {
      insertMap.run(...m);
    }
  }

  const complaintCount = db.prepare('SELECT COUNT(*) as count FROM complaints').get() as { count: number };
  if (complaintCount.count === 0) {
    const insertComplaint = db.prepare(
      'INSERT INTO complaints (sender_name, sender_contact, category, subject, message, status, admin_reply) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insertComplaint.run(
      'Tatang Suryana',
      '081321009988',
      'Infrastruktur',
      'Usulan Perbaikan Lampu Penerangan Jalan Blok Kebonkalapa',
      'Assalamualaikum, mohon tindak lanjut perbaikan dua titik lampu PJU di gang masuk RT 02 RW 01 yang padam sejak hujan deras minggu lalu.',
      'diproses',
      'Laporan sudah diteruskan ke Kasi Kesejahteraan & Kepala Dusun Pawenang untuk pengecekan teknis minggu ini.'
    );
    insertComplaint.run(
      'Fitriani Rahmawati',
      '081224557788',
      'Layanan Publik',
      'Pendaftaran Produk Baru untuk Katalog UMKM Desa',
      'Halo Admin Desa, kami dari kelompok pengrajin bambu RW 03 ingin menanyakan jadwal pelatihan foto produk UMKM bulan depan.',
      'baru',
      ''
    );
  }

  // Seed sample Sub-Admin account (Sekretaris Desa) if only 1 user exists
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (totalUsers.count === 1) {
    const sekdesOfficial = db.prepare("SELECT id FROM officials WHERE position LIKE '%Sekretaris%' LIMIT 1").get() as
      | { id: number }
      | undefined;
    const subHash = bcrypt.hashSync('123456', 10);
    db.prepare(
      'INSERT OR IGNORE INTO users (username, password_hash, full_name, role, permissions, official_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)'
    ).run(
      'sekdes',
      subHash,
      'Rina Marlina, S.AP.',
      'sub_admin',
      JSON.stringify(['overview', 'surat', 'penduduk', 'agenda', 'berita', 'perangkat', 'portofolio']),
      sekdesOfficial?.id ?? null
    );
  } else {
    const existingSekdes = db
      .prepare("SELECT id, permissions FROM users WHERE username = 'sekdes'")
      .get() as { id: number; permissions: string } | undefined;
    if (existingSekdes) {
      try {
        const parsed = JSON.parse(existingSekdes.permissions || '[]') as string[];
        if (Array.isArray(parsed) && !parsed.includes('agenda')) {
          parsed.push('agenda');
          db.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(
            JSON.stringify(parsed),
            existingSekdes.id
          );
        }
      } catch {
        db.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(
          JSON.stringify(['overview', 'surat', 'penduduk', 'agenda', 'berita', 'perangkat', 'portofolio']),
          existingSekdes.id
        );
      }
    }
  }

  // Seed APBDes Desa Margamukti (Tahun 2026 & 2025)
  const apbdesCount = db.prepare('SELECT COUNT(*) as count FROM apbdes_items').get() as { count: number };
  if (apbdesCount.count === 0) {
    const insertApbdes = db.prepare(`
      INSERT INTO apbdes_items (fiscal_year, type, category, title, budget_amount, realized_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const seedApbdes = [
      [2026, 'Pendapatan', 'Pendapatan Asli Desa (PADes)', 'Hasil Pengelolaan Tanah Kas Desa & Retribusi Pasar/UMKM', 85000000, 68000000, 'Realisasi s.d. Triwulan III'],
      [2026, 'Pendapatan', 'Dana Desa (APBN)', 'Transfer Dana Desa Pusat Tahun Anggaran 2026', 1120000000, 952000000, 'Tahap I & II tersalur'],
      [2026, 'Pendapatan', 'Alokasi Dana Desa (ADD)', 'Bagian Dana Perimbangan Kabupaten Sumedang', 645000000, 516000000, 'Siltap & operasional desa'],
      [2026, 'Pendapatan', 'Bagi Hasil Pajak & Retribusi', 'Bagian Pajak Daerah dan Retribusi Kabupaten Sumedang', 140000000, 112000000, 'PBB & retribusi daerah'],

      [2026, 'Belanja', 'Penyelenggaraan Pemerintahan Desa', 'Penghasilan Tetap Perangkat, Operasional Balai Desa & Digitalisasi Layanan', 610000000, 505000000, 'Termasuk sistem informasi desa'],
      [2026, 'Belanja', 'Pelaksanaan Pembangunan Desa', 'Peningkatan Jalan Lingkungan, Drainase Blok Kebonkalapa & Posyandu', 740000000, 612000000, 'Progres fisik 83%'],
      [2026, 'Belanja', 'Pembinaan Kemasyarakatan', 'Dukungan Keamanan Linmas, Karang Taruna, & Kegiatan Keagamaan', 185000000, 148000000, 'Rutin triwulan'],
      [2026, 'Belanja', 'Pemberdayaan Masyarakat', 'Pelatihan UMKM Anyaman Bambu, Kuliner Tahu & Ketahanan Pangan', 295000000, 236000000, '4 kelompok UMKM binaan'],
      [2026, 'Belanja', 'Penanggulangan Bencana & Darurat', 'BLT Dana Desa & Cadangan Tanggap Darurat Bencana Alam', 160000000, 132000000, 'Penyaluran KPM tepat sasaran'],

      [2026, 'Pembiayaan', 'Penerimaan Pembiayaan', 'SiLPA Tahun Anggaran Sebelumnya (2025)', 65000000, 65000000, 'Hasil audit kas desa'],
      [2026, 'Pembiayaan', 'Pengeluaran Pembiayaan', 'Penyertaan Modal BUMDes Mukti Mandiri', 65000000, 50000000, 'Penguatan unit usaha desa'],

      [2025, 'Pendapatan', 'Dana Desa (APBN)', 'Transfer Dana Desa Tahun Anggaran 2025', 1050000000, 1050000000, 'Terealisasi 100%'],
      [2025, 'Pendapatan', 'Alokasi Dana Desa (ADD)', 'Alokasi Dana Desa Kabupaten Sumedang 2025', 610000000, 610000000, 'Terealisasi 100%'],
      [2025, 'Belanja', 'Penyelenggaraan Pemerintahan Desa', 'Operasional Pemerintahan & Administrasi Desa 2025', 580000000, 565000000, 'Selesai'],
      [2025, 'Belanja', 'Pelaksanaan Pembangunan Desa', 'Pembangunan Saluran Irigasi & Pengaspalan Jalan Sukajadi', 780000000, 745000000, 'Selesai 100%'],
      [2025, 'Belanja', 'Pemberdayaan Masyarakat', 'Bantuan Sarana Produksi Pertanian & UMKM 2025', 300000000, 285000000, 'Selesai'],
    ];
    for (const item of seedApbdes) {
      insertApbdes.run(...item);
    }
  }

  // Seed initial article comments
  const commentCount = db.prepare('SELECT COUNT(*) as count FROM article_comments').get() as { count: number };
  if (commentCount.count === 0) {
    const firstArticle = db.prepare('SELECT id FROM articles ORDER BY id ASC LIMIT 1').get() as
      | { id: number }
      | undefined;
    if (firstArticle) {
      const insertComment = db.prepare(
        'INSERT INTO article_comments (article_id, author_name, author_region, comment_text, admin_reply, status) VALUES (?, ?, ?, ?, ?, ?)'
      );
      insertComment.run(
        firstArticle.id,
        'Dedi Supriadi',
        'RW 01 · Dusun Pawenang',
        'Terima kasih atas hasil Musrenbangdes tahun ini. Semoga perbaikan saluran drainase di Blok Kebonkalapa segera terealisasi sebelum puncak musim hujan.',
        'Terima kasih Pak RW, pekerjaan drainase Blok Kebonkalapa dijadwalkan masuk tahap awal triwulan berjalan bersama TPK Desa.',
        'published'
      );
      insertComment.run(
        firstArticle.id,
        'Fitriani Rahmawati',
        'RT 01 RW 03 · Dusun Cikondang',
        'Mendukung penuh program pemasaran digital bagi pelaku UMKM anyaman dan kuliner di Desa Margamukti.',
        '',
        'published'
      );
    }
  }

  // Seed initial early warning advisory
  const warningCount = db.prepare('SELECT COUNT(*) as count FROM early_warnings').get() as { count: number };
  if (warningCount.count === 0) {
    db.prepare(
      `INSERT INTO early_warnings (title, category, severity, affected_area, description, instruction, emergency_contact, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(
      'Waspada Hujan Lebat Disertai Angin Kencang Sore hingga Malam Hari',
      'Cuaca Ekstrem',
      'waspada',
      'Dusun Pawenang (Blok Kebonkalapa, Pasarean) & Dusun Cikondang (Blok Sukajadi)',
      'Berdasarkan pemantauan cuaca wilayah Sumedang Utara, terdapat potensi peningkatan curah hujan berintensitas sedang hingga lebat pada sore hingga malam hari.',
      'Pastikan saluran air di depan rumah tidak tersumbat sampah, hindari berteduh di bawah pohon rindang saat angin kencang, dan segera laporkan genangan atau pohon tumbang melalui Panel Laporan Darurat.',
      '6281220458899'
    );
  }

  // Seed historical emergency reports across the past 12 months if none exist yet
  const emergencyCount = db
    .prepare('SELECT COUNT(*) as count FROM complaints WHERE is_emergency = 1')
    .get() as { count: number };
  if (emergencyCount.count === 0) {
    const insertEmergency = db.prepare(
      `INSERT INTO complaints
        (sender_name, sender_contact, category, subject, message, status, admin_reply, is_emergency, latitude, longitude, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
    );

    const monthOffsetTimestamp = (monthsAgo: number, day: number, hour: number) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - monthsAgo);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(Math.min(day, 28)).padStart(2, '0');
      const hh = String(hour).padStart(2, '0');
      return `${y}-${m}-${dd} ${hh}:15:00`;
    };

    const sampleEmergencies: Array<[number, number, number, string, string, string, string, string, string, number, number]> = [
      [11, 14, 19, 'Hendra Wijaya', '081322114401', 'Banjir / Luapan Air', '[Patokan Lokasi: Dusun Pawenang RT 02 RW 01] Saluran drainase utama meluap ke jalan gang setelah hujan lebat.', 'selesai', 'Tim piket & warga telah membersihkan sumbatan saluran air.', -6.8279, 107.8994],
      [10, 8, 16, 'Siti Aminah', '081298761204', 'Pohon Tumbang / Jalan Tertutup', '[Patokan Lokasi: Jalan Poros Dusun Cikondang] Dahan pohon mahoni patah menutup sebagian badan jalan.', 'selesai', 'Evakuasi batang pohon bersama Linmas dan warga selesai dalam 2 jam.', -6.8296, 107.9022],
      [9, 21, 17, 'Asep Sunandar', '085221449900', 'Banjir / Luapan Air', '[Patokan Lokasi: Blok Kebonkalapa RW 02] Genangan air setinggi mata kaki di pertigaan pasar desa.', 'selesai', 'Pintu air irigasi dibuka dan endapan lumpur dibersihkan.', -6.8272, 107.9008],
      [9, 26, 20, 'Rudi Hartono', '081394112233', 'Tanah Longsor', '[Patokan Lokasi: Tebing Jalan Dusun Sukajadi RT 03] Longsoran tanah ringan menutup bahu jalan.', 'selesai', 'Material tanah dibersihkan dan dipasang rambu pembatas sementara.', -6.8311, 107.9031],
      [7, 11, 15, 'Nurlaela', '081214008812', 'Angin Kencang / Puting Beliung', '[Patokan Lokasi: RT 01 RW 04 Dusun Margamukti] Angin kencang merusak atap asbes dua rumah warga.', 'selesai', 'Bantuan terpal darurat dan pendataan kerusakan telah disalurkan.', -6.8288, 107.8979],
      [5, 19, 14, 'Yusuf Maulana', '082118993344', 'Kerusakan Infrastruktur / Jembatan', '[Patokan Lokasi: Jembatan Kecil Cibeureum] Pondasi pembatas jalan jembatan tergerus aliran air.', 'selesai', 'Dipasang barikade pengaman dan masuk agenda perbaikan TPK Desa.', -6.8268, 107.9016],
      [4, 6, 18, 'Dadan Hermawan', '081320556677', 'Pohon Tumbang / Jalan Tertutup', '[Patokan Lokasi: Dekat SDN Margamukti] Pohon tumbang menimpa kabel penerangan jalan lingkungan.', 'selesai', 'Koordinasi cepat dengan petugas teknis dan area sudah aman dilalui.', -6.8284, 107.8998],
      [4, 22, 11, 'Euis Komalasari', '085314778899', 'Keadaan Darurat Medis / Kecelakaan', '[Patokan Lokasi: Tikungan Jalan Raya Margamukti] Pengendara motor tergelincir membutuhkan mobil siaga desa.', 'selesai', 'Armada Ambulans Siaga Desa langsung mengevakuasi korban ke puskesmas.', -6.8291, 107.9005],
      [2, 9, 17, 'Agus Permana', '081223445566', 'Banjir / Luapan Air', '[Patokan Lokasi: Dusun Pawenang RT 03 RW 01] Air parit meluap karena kiriman debit tinggi dari hulu.', 'selesai', 'Penyudetan aliran sementara sudah dilakukan perangkat wilayah.', -6.8276, 107.8989],
      [1, 18, 16, 'Tatang Suhendar', '081395881122', 'Tanah Longsor', '[Patokan Lokasi: Blok Pasarean RT 02] Pergerakan tanah kebun mendekati talud jalan lingkungan.', 'diproses', 'Sudah dipasang terpal penahan resapan dan dipantau Kepala Dusun.', -6.8304, 107.9027],
      [1, 25, 19, 'Rina Susanti', '082216779901', 'Angin Kencang / Puting Beliung', '[Patokan Lokasi: Dusun Cikondang RW 03] Pohon albasia miring mengancam kabel listrik warga.', 'selesai', 'Pemangkasan cabang berisiko selesai bersama warga dan petugas.', -6.8299, 107.9019],
      [0, 5, 16, 'Budi Santoso', '081221990044', 'Banjir / Luapan Air', '[Patokan Lokasi: Blok Kebonkalapa RT 01] Saluran got tersumbat ranting pasca hujan deras sore hari.', 'diproses', 'Petugas posko dan ketua RT sedang melakukan pembersihan lapangan.', -6.8281, 107.9002],
    ];

    for (const [mAgo, day, hr, name, contact, incType, msg, status, reply, lat, lng] of sampleEmergencies) {
      insertEmergency.run(
        name,
        contact,
        `Darurat: ${incType}`,
        `[DARURAT] ${incType}`,
        msg,
        status,
        reply,
        lat,
        lng,
        monthOffsetTimestamp(mAgo, day, hr)
      );
    }
  }

  // Seed default WhatsApp Blaster templates
  const waTplCount = db.prepare('SELECT COUNT(*) as count FROM wa_templates').get() as { count: number };
  if (waTplCount.count === 0) {
    const insertWaTpl = db.prepare(
      'INSERT INTO wa_templates (title, category, content, status) VALUES (?, ?, ?, ?)'
    );
    insertWaTpl.run(
      'Undangan Rapat Koordinasi Desa',
      'Rapat & Agenda',
      `Assalamu'alaikum Wr. Wb.\nYth. Bapak/Ibu *{{nama_penerima}}* ({{jabatan}} - {{wilayah}}),\n\nDengan hormat, kami mengundang Bapak/Ibu untuk menghadiri Rapat Koordinasi Pemerintahan Desa Margamukti pada:\n- Hari/Tanggal: {{tanggal}}\n- Tempat: Aula Balai Desa Margamukti\n\nMohon kehadirannya tepat waktu. Terima kasih.\n\n*Pemerintah Desa Margamukti*`,
      'active'
    );
    insertWaTpl.run(
      'Instruksi Siaga Cuaca & Keamanan Wilayah',
      'Siaga & Darurat',
      `Assalamu'alaikum Wr. Wb.\nYth. Bapak/Ibu *{{nama_penerima}}* ({{jabatan}} - {{wilayah}}),\n\nSehubungan dengan pantauan cuaca wilayah Sumedang Utara pada {{tanggal}}, dimohon kepada seluruh jajaran {{dusun}} untuk memantau saluran air, titik rawan longsor, dan mengimbau warga tetap waspada.\n\nApabila ada kejadian darurat, segera laporkan melalui Panel Siaga Portal Desa Margamukti.`,
      'active'
    );
    insertWaTpl.run(
      'Pengingat Rekap Mutasi & Data Warga RT/RW',
      'Kependudukan',
      `Assalamu'alaikum Wr. Wb.\nYth. *{{nama_penerima}}* ({{jabatan}} - {{wilayah}}),\n\nMohon bantuan Bapak/Ibu untuk memeriksa kembali data warga baru, pindah datang/keluar, dan kelahiran di wilayah {{wilayah}} melalui Portal Admin Desa agar rekapitulasi bulanan per {{tanggal}} tetap akurat.\n\nTerima kasih atas kerja samanya.`,
      'active'
    );
    insertWaTpl.run(
      'Informasi Pelayanan Administrasi Surat Desa',
      'Layanan Publik',
      `Yth. *{{nama_penerima}}* ({{jabatan}} - {{wilayah}}),\n\nDiinformasikan bahwa pelayanan administrasi surat warga di Kantor Desa Margamukti berjalan normal Senin-Jumat pukul 08.00-15.30 WIB, serta warga juga dapat mengajukan surat pengantar secara mandiri melalui Portal Desa.\n\nMohon bantuannya untuk diteruskan kepada warga di {{wilayah}}.`,
      'active'
    );
  }

  // Seed Lembaga Desa (BPD, BUMDesa, LPM, PKK) secara idempoten
  const instCount = db.prepare('SELECT COUNT(*) as count FROM village_institutions').get() as { count: number };
  if (instCount.count === 0) {
    const insertInst = db.prepare(`
      INSERT INTO village_institutions (slug, name, short_name, tagline, legal_basis, description, tupoksi, office_location, contact_phone, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const insertMember = db.prepare(`
      INSERT INTO institution_members (institution_id, name, position, phone, sort_order, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const institutionsSeed: Array<{
      slug: string;
      name: string;
      short_name: string;
      tagline: string;
      legal_basis: string;
      description: string;
      tupoksi: string[];
      office_location: string;
      contact_phone: string;
      members: Array<[string, string, string, string]>;
    }> = [
      {
        slug: 'bpd',
        name: 'Badan Permusyawaratan Desa (BPD)',
        short_name: 'BPD',
        tagline: 'Lembaga Perwujudan Demokrasi & Pengawasan Penyelenggaraan Pemerintahan Desa',
        legal_basis: 'UU No. 6 Tahun 2014 tentang Desa & Permendagri No. 110 Tahun 2016 tentang BPD',
        description:
          'BPD Desa Margamukti merupakan mitra sejajar Pemerintah Desa dalam membahas dan menyepakati Rancangan Peraturan Desa (Perdes), menampung serta menyalurkan aspirasi masyarakat, dan mengawasi kinerja Kepala Desa.',
        tupoksi: [
          'Membahas dan menyepakati Rancangan Peraturan Desa (Perdes) bersama Kepala Desa.',
          'Menampung, menghimpun, dan menyalurkan aspirasi seluruh warga Desa Margamukti dalam forum Musyawarah Desa.',
          'Melakukan pengawasan terhadap pelaksanaan Peraturan Desa, APBDes, serta kinerja Kepala Desa.',
          'Menyelenggarakan Musyawarah Desa (Musdes) untuk menetapkan kebijakan strategis pembangunan desa.',
        ],
        office_location: 'Gedung Sekretariat BPD, Komplek Balai Desa Margamukti',
        contact_phone: '081220458901',
        members: [
          ['Drs. H. Tatang Hidayat', 'Ketua BPD', '081220458901', 'Unsur Tokoh Masyarakat Dusun Pawenang'],
          ['Ustadz Mamat Rahmat', 'Wakil Ketua BPD', '081220458902', 'Unsur Tokoh Agama Desa Margamukti'],
          ['Siti Rohmah, S.Pd.', 'Sekretaris BPD', '081220458903', 'Koordinator Administrasi & Risalah Rapat'],
          ['Asep Saepudin', 'Ketua Bidang Penyelenggaraan Pemerintahan', '081220458904', 'Perwakilan Dusun Cikondang'],
          ['Nining Yuningsih', 'Anggota (Keterwakilan Perempuan)', '081220458905', 'Bidang Pembangunan & Pemberdayaan'],
        ],
      },
      {
        slug: 'bumdesa',
        name: 'BUMDesa Mukti Mandiri',
        short_name: 'BUMDesa',
        tagline: 'Motor Penggerak Ekonomi Produktif & Pendapatan Asli Desa Margamukti',
        legal_basis: 'PP No. 11 Tahun 2021 tentang Badan Usaha Milik Desa',
        description:
          'Badan Usaha Milik Desa (BUMDesa) Mukti Mandiri mengelola unit usaha desa di bidang pemasaran produk UMKM lokal, pengelolaan sarana air bersih desa, perdagangan kebutuhan pokok, serta kemitraan agribisnis.',
        tupoksi: [
          'Mengelola dan mengembangkan unit-unit usaha ekonomi desa yang berkelanjutan dan menguntungkan.',
          'Menampung serta memasarkan produk unggulan UMKM, hasil pertanian, dan kerajinan warga Desa Margamukti.',
          'Meningkatkan Pendapatan Asli Desa (PADes) untuk mendukung kemandirian pembiayaan pembangunan desa.',
          'Membuka lapangan kerja baru bagi pemuda dan warga produktif Desa Margamukti.',
        ],
        office_location: 'Kios Ekonomi Desa, Jl. Raya Margamukti No. 14',
        contact_phone: '081220458911',
        members: [
          ['Hendra Wijaya, S.E.', 'Direktur BUMDesa', '081220458911', 'Penanggung Jawab Operasional & Kemitraan'],
          ['Lina Marlina, A.Md.', 'Sekretaris BUMDesa', '081220458912', 'Administrasi Usaha & Pelaporan'],
          ['Euis Kartika', 'Bendahara BUMDesa', '081220458913', 'Pembukuan & Laporan Keuangan Usaha'],
          ['Dedi Mulyana', 'Kepala Unit Agribisnis & UMKM', '081220458914', 'Sentra Pemasaran Produk Lokal'],
          ['Cecep Supriatna', 'Kepala Unit Jasa & Air Bersih', '081220458915', 'Pengelolaan PAMSIMAS & Jasa Warga'],
        ],
      },
      {
        slug: 'lpm',
        name: 'Lembaga Pemberdayaan Masyarakat (LPM)',
        short_name: 'LPM',
        tagline: 'Mitra Perencanaan Pembangunan Partisipatif & Swadaya Gotong Royong',
        legal_basis: 'Permendagri No. 18 Tahun 2018 tentang Lembaga Kemasyarakatan Desa',
        description:
          'LPM Desa Margamukti berperan menampung usulan masyarakat dalam Musrenbangdes, menyusun rencana pembangunan partisipatif, dan menggerakkan swadaya gotong royong warga pada pelaksanaan infrastruktur dan lingkungan.',
        tupoksi: [
          'Menampung dan menyalurkan aspirasi masyarakat di bidang pembangunan fisik dan pemberdayaan sosial.',
          'Menyusun rencana pembangunan desa secara partisipatif bersama Pemerintah Desa dan unsur dusun/RW.',
          'Menggerakkan serta menumbuhkembangkan swadaya dan semangat gotong royong masyarakat.',
          'Membantu pengawasan kualitas pelaksanaan proyek infrastruktur serta pemeliharaan hasil pembangunan desa.',
        ],
        office_location: 'Sekretariat Bersama LKD, Komplek Balai Desa Margamukti',
        contact_phone: '081220458921',
        members: [
          ['Ir. Bambang Sutrisno', 'Ketua LPM', '081220458921', 'Koordinator Perencanaan & Pembangunan'],
          ['Ade Kosasih', 'Wakil Ketua LPM', '081220458922', 'Koordinator Swadaya & Gotong Royong'],
          ['Fitriani Rahayu', 'Sekretaris LPM', '081220458923', 'Dokumentasi Usulan Musrenbangdes'],
          ['Toto Suryana', 'Seksi Infrastruktur & Lingkungan', '081220458924', 'Pendampingan Jalan Desa & Drainase'],
          ['Usep Saepuloh', 'Seksi Pemuda & Olahraga', '081220458925', 'Sinergi Karang Taruna Dusun'],
        ],
      },
      {
        slug: 'pkk',
        name: 'Tim Penggerak PKK Desa Margamukti',
        short_name: 'PKK',
        tagline: 'Gerakan Pemberdayaan Kesejahteraan Keluarga, Posyandu & Ketahanan Pangan',
        legal_basis: 'Perpres No. 99 Tahun 2017 & Permendagri No. 36 Tahun 2020 tentang Gerakan PKK',
        description:
          'TP-PKK Desa Margamukti menggerakkan 10 Program Pokok PKK melalui empat kelompok kerja (Pokja I–IV), pembinaan Posyandu balita/lansia, pencegahan stunting, serta peningkatan keterampilan ekonomi keluarga.',
        tupoksi: [
          'Melaksanakan 10 Program Pokok PKK mulai dari tingkat keluarga, dasawisma, RT/RW hingga desa.',
          'Menggerakkan layanan Posyandu balita, ibu hamil, lansia, serta program percepatan penurunan stunting.',
          'Membina keterampilan ekonomi produktif keluarga, UP2K-PKK, serta pemanfaatan pekarangan pangan lestari.',
          'Menyuluh kesehatan lingkungan, ketahanan keluarga, dan pendidikan anak usia dini (PAUD).',
        ],
        office_location: 'Rumah Sekretariat PKK & Posyandu Terpadu Desa Margamukti',
        contact_phone: '081220458931',
        members: [
          ['Hj. Kokom Komariah', 'Ketua TP-PKK Desa', '081220458931', 'Penanggung Jawab 10 Program Pokok PKK'],
          ['Imas Suryani, S.Pd.', 'Wakil Ketua TP-PKK', '081220458932', 'Koordinator Dasawisma & Kader Wilayah'],
          ['Rini Anggraeni', 'Sekretaris TP-PKK', '081220458933', 'Administrasi & Pelaporan Pokja'],
          ['Yanti Susilawati', 'Bendahara TP-PKK', '081220458934', 'Pengelolaan Dana Kegiatan & UP2K'],
          ['Nani Sumarni', 'Ketua Pokja IV (Kesehatan & Posyandu)', '081220458935', 'Koordinator Posyandu & Cegah Stunting'],
        ],
      },
    ];

    for (const inst of institutionsSeed) {
      const res = insertInst.run(
        inst.slug,
        inst.name,
        inst.short_name,
        inst.tagline,
        inst.legal_basis,
        inst.description,
        JSON.stringify(inst.tupoksi),
        inst.office_location,
        inst.contact_phone
      );
      const instId = Number(res.lastInsertRowid);
      inst.members.forEach(([mName, mPos, mPhone, mNotes], idx) => {
        insertMember.run(instId, mName, mPos, mPhone, idx + 1, mNotes);
      });
    }
  }

  // Seed Basis Pengetahuan AI Layanan Warga (DTSEN, Bansos, Adminduk, Pemda & Pemdes)
  const aiKbCount = db.prepare('SELECT COUNT(*) as count FROM ai_knowledge_entries').get() as { count: number };
  if (aiKbCount.count === 0) {
    const insertKb = db.prepare(`
      INSERT INTO ai_knowledge_entries (
        category, title, keywords, summary, content, official_source,
        related_route, related_subtab, related_label, is_active, sort_order, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'Sistem')
    `);

    const kbSeeds: Array<[string, string, string, string, string, string, string, string, string, number]> = [
      [
        'DTSEN',
        'Juknis Kepesertaan DTSEN, Klasifikasi Desil 1–10 & Pemutakhiran Data',
        'dtsen, dtks, desil, regsosek, p3ke, perlinsos digital, ikd, usul sanggah, siks-ng, pemutakhiran bansos',
        'Panduan resmi penggantian DTKS menuju DTSEN (Data Tunggal Sosial dan Ekonomi Nasional), pengelompokan Desil 1–10, dan tata cara usul/sanggah melalui Perlinsos Digital, Cek Bansos, maupun Musyawarah Desa.',
        `1. Pengertian DTSEN:
DTSEN (Data Tunggal Sosial dan Ekonomi Nasional) adalah basis data tunggal nasional yang mengintegrasikan dan memadankan DTKS, Regsosek (BPS), serta P3KE dengan basis NIK Dukcapil secara by name by address (Permensos No. 3 Tahun 2025).

2. Pembagian Desil Kesejahteraan (1–10):
- Desil 1: 10% keluarga dengan tingkat kesejahteraan paling rendah (miskin ekstrem).
- Desil 2: Kelompok sangat miskin.
- Desil 3: Kelompok rentan miskin.
- Desil 4: Kelompok hampir miskin.
- Desil 5–10: Kelompok rentan menuju menengah hingga mampu.
Sasaran utama bansos reguler Kemensos (PKH & BPNT) diprioritaskan pada Desil 1 sampai Desil 4 setelah verifikasi dan ground checking lapangan.

3. Syarat Utama Kepesertaan DTSEN:
- NIK dan Nomor KK valid, aktif, serta padan dengan data Disdukcapil pusat.
- Bukan ASN, anggota TNI/Polri, pegawai BUMN/BUMD, atau penerima pensiun/gaji bersumber APBN/APBD di atas ketentuan.
- Mengisi data kondisi sosial ekonomi keluarga secara jujur (pekerjaan, penghasilan, aset, kondisi rumah, tanggungan, listrik/sanitasi).

4. Cara Pendaftaran / Pemutakhiran & Usul Sanggah:
a. Jalur Mandiri Digital (Perlinsos Digital / Aplikasi Cek Bansos):
   - Siapkan akun IKD (Identitas Kependudukan Digital) yang sudah aktif di smartphone.
   - Masuk melalui portal Perlinsos Digital atau aplikasi resmi Cek Bansos Kemensos, pilih menu Daftar Usulan atau Tanggapan Kelayakan (Usul/Sanggah), unggah foto KTP, KK, dan kondisi rumah tampak depan serta dalam.
b. Jalur Musyawarah Desa/Kelurahan (SIKS-NG):
   - Lapor ke Ketua RT/RW atau Operator SIKS-NG di Balai Desa Margamukti dengan membawa fotokopi KTP-el, Kartu Keluarga, dan pengantar RT/RW agar dibahas dalam Musyawarah Desa (Musdes) untuk pengusulan atau pembaruan data ke Dinas Sosial Kab. Sumedang.`,
        'Kemensos RI · BPS · Permensos No. 3 Tahun 2025 (cekbansos.kemensos.go.id)',
        'bansos',
        '',
        'Buka Halaman Cek Bansos & DTSEN',
        1,
      ],
      [
        'Bansos',
        'Syarat Penerima PKH, BPNT / Program Sembako & PBI-JK (BPJS Kesehatan Gratis)',
        'pkh, bpnt, sembako, pbi, pbi-jk, bpjs gratis, kis, syarat bansos, ibu hamil, balita, lansia, disabilitas',
        'Rincian persyaratan komponen keluarga penerima PKH, kriteria BPNT/Sembako, serta syarat kepesertaan PBI-JK (KIS/BPJS Kesehatan ditanggung pemerintah).',
        `1. Program Keluarga Harapan (PKH):
- Wajib terdaftar pada DTSEN (prioritas Desil 1–4) dan padan NIK Dukcapil.
- Dalam satu Kartu Keluarga minimal memiliki salah satu komponen berikut:
  a. Komponen Kesehatan: Ibu hamil/nifas (maks. kehamilan kedua) atau anak usia dini/balita (0–6 tahun).
  b. Komponen Pendidikan: Anak usia sekolah SD/MI, SMP/MTs, atau SMA/MA/sederajat yang terdaftar aktif di Dapodik/EMIS.
  c. Komponen Kesejahteraan Sosial: Lanjut usia (usia >= 60 tahun sesuai ketentuan juknis berjalan) atau penyandang disabilitas berat.

2. BPNT / Program Sembako:
- Keluarga miskin atau rentan miskin yang terdaftar di DTSEN (prioritas Desil 1–4) dengan NIK & KK padan Dukcapil.
- Bukan ASN/TNI/Polri/pegawai BUMN/BUMD maupun pendamping sosial aktif.
- Penyaluran dilakukan melalui Kartu Keluarga Sejahtera (KKS) Bank Himbara atau PT Pos sesuai penetapan Kemensos.

3. PBI-JK (Penerima Bantuan Iuran Jaminan Kesehatan / BPJS Gratis):
- Diperuntukkan bagi fakir miskin dan orang tidak mampu yang masuk DTSEN (umumnya Desil 1–5 sesuai kuota daerah/pusat) serta terdaftar oleh Kemensos untuk dibayarkan iuran BPJS Kesehatan kelas 3 oleh pemerintah.
- Jika kartu PBI nonaktif padahal warga tidak mampu/sakit mendesak: bawa KTP, KK, Surat Keterangan Tidak Mampu (SKTM) desa, dan surat keterangan dirawat/rujukan puskesmas ke Dinas Sosial Kab. Sumedang untuk reaktivasi atau pengusulan PBI APBD (UHC).`,
        'Kementerian Sosial RI & Dinas Sosial Kabupaten Sumedang',
        'bansos',
        '',
        'Cek Status & Panduan Bansos',
        2,
      ],
      [
        'Bansos',
        'Syarat KIP Sekolah (PIP Kemdikbud/Kemenag) & KIP Kuliah',
        'kip, kip sekolah, pip, program indonesia pintar, kip kuliah, beasiswa kuliah, sktm sekolah, dtks, dtsen',
        'Persyaratan pengusulan dan pencairan Program Indonesia Pintar (PIP / KIP Sekolah SD-SMA) serta bantuan pendidikan tinggi KIP Kuliah.',
        `1. PIP / KIP Sekolah (Jenjang SD, SMP, SMA/SMK/Sederajat):
- Peserta didik berusia 6–21 tahun dengan NISN dan NIK valid serta padan Dapodik/EMIS.
- Prioritas penerima:
  a. Pemegang Kartu Indonesia Pintar (KIP) aktif.
  b. Siswa dari keluarga peserta PKH, BPNT, atau terdaftar di DTSEN (Desil 1–4).
  c. Pertimbangan khusus: siswa yatim/piatu/yatim piatu, korban bencana alam, keluarga rentan miskin (dapat melampirkan SKTM dari Desa untuk diusulkan sekolah/Dinas Pendidikan).
- Alur usul di sekolah: orang tua melapor ke operator sekolah membawa KK, KTP orang tua, rapor/NISN, dan bukti DTSEN atau SKTM Desa Margamukti agar ditandai layak PIP di Dapodik.

2. KIP Kuliah (Perguruan Tinggi Negeri / Swasta Terakreditasi):
- Lulusan SMA/SMK/MA tahun berjalan atau maksimal lulus 2 tahun sebelumnya yang lulus seleksi masuk PTN/PTS (SNBP, SNBT, atau jalur mandiri prodi terakreditasi).
- Memiliki potensi akademik baik tetapi memiliki keterbatasan ekonomi yang dibuktikan dengan:
  a. Terdaftar aktif di DTSEN / penerima PKH / BPNT / PBI-JK atau pernah menerima PIP saat SMA, ATAU
  b. Pendapatan kotor gabungan orang tua/wali maksimal Rp4.000.000/bulan (atau <= Rp750.000 dibagi jumlah anggota keluarga), dibuktikan dengan SKTM dari Pemerintah Desa + slip/surat keterangan penghasilan dan foto rumah/rekening listrik.
- Pendaftaran akun dilakukan mandiri di portal resmi kip-kuliah.kemdiktisaintek.go.id / portal Kemendikbud sebelum jadwal seleksi ditutup.`,
        'Kemendikdasmen / Kemdiktisaintek & Layanan SKTM Desa Margamukti',
        'surat',
        'form',
        'Ajukan SKTM via Layanan Surat',
        3,
      ],
      [
        'Bansos',
        'BLT Dana Desa & Bantuan Sosial Skala Desa / Kabupaten',
        'blt dd, blt dana desa, kemiskinan ekstrem, bantuan desa, musdesus, bansos daerah',
        'Kriteria penerima Bantuan Langsung Tunai (BLT) Dana Desa serta mekanisme penetapannya melalui Musyawarah Desa Khusus.',
        `1. Sasaran Prioritas BLT Dana Desa:
- Keluarga miskin ekstrem di Desa Margamukti (terutama Desil 1 DTSEN/P3KE) yang belum menerima bantuan reguler pusat seperti PKH atau BPNT.
- Prioritas tambahan sesuai regulasi Dana Desa berjalan: keluarga dengan anggota sakit menahun/kronis, penyandang disabilitas berat, atau lansia tunggal tanpa penopang ekonomi.

2. Mekanisme Penetapan:
- Pendataan awal diusulkan oleh Kepala Dusun, Ketua RW, dan Ketua RT.
- Verifikasi faktual lapangan oleh tim pendata desa.
- Penetapan daftar Keluarga Penerima Manfaat (KPM) disahkan melalui Musyawarah Desa Khusus (Musdesus) bersama BPD serta ditetapkan dengan Peraturan Kepala Desa.`,
        'Kemendes PDT & Pemerintah Desa Margamukti',
        'profil',
        'apbdes',
        'Lihat Transparansi APBDes',
        4,
      ],
      [
        'Adminduk',
        'Syarat Penerbitan, Penggantian KTP-el & Aktivasi IKD (Identitas Kependudukan Digital)',
        'ktp, ktp-el, e-ktp, buat ktp, ktp hilang, ktp rusak, ikd, perekaman, disdukcapil',
        'Syarat lengkap pembuatan KTP-el pemula usia 17 tahun, penggantian KTP hilang/rusak, perubahan elemen data, serta cara aktivasi IKD.',
        `1. Pembuatan KTP-el Baru (Pemula Usia >= 17 Tahun atau Sudah Menikah):
- Fotokopi Kartu Keluarga (KK) terbaru.
- Berusia minimal 17 tahun atau sudah/pernah kawin (dibuktikan Akta Nikah).
- Datang langsung ke Kecamatan Sumedang Utara atau Mal Pelayanan Publik / Disdukcapil Kab. Sumedang untuk perekaman biometrik (foto, sidik jari, tanda tangan, iris mata).

2. KTP-el Rusak / Perubahan Data (Alamat, Status Perkawinan, Pekerjaan):
- KTP-el lama yang rusak atau yang datanya berubah.
- Fotokopi Kartu Keluarga (KK) yang elemen datanya sudah diperbarui lebih dulu.

3. KTP-el Hilang:
- Surat Keterangan Kehilangan dari Kepolisian (diawali dengan Surat Pengantar Kehilangan dari Desa Margamukti).
- Fotokopi Kartu Keluarga (KK).

4. Aktivasi IKD (Identitas Kependudukan Digital):
- Unduh aplikasi resmi "Identitas Kependudukan Digital" (Kemendagri) di Play Store / App Store.
- Siapkan NIK, email aktif, dan nomor HP aktif.
- Lakukan pindai QR Code petugas verifikasi di loket Kecamatan Sumedang Utara, Balai Desa (saat layanan jemput bola), atau Disdukcapil Kab. Sumedang.`,
        'Disdukcapil Kab. Sumedang & Kecamatan Sumedang Utara',
        'surat',
        'form',
        'Ajukan Surat Kehilangan / Domisili',
        5,
      ],
      [
        'Adminduk',
        'Syarat Pembuatan & Perubahan Kartu Keluarga (KK Baru, Pecah KK, Tambah Anggota)',
        'kk, kartu keluarga, pecah kk, kk baru, tambah anak, pisah kk, ubah kk, disdukcapil',
        'Daftar berkas pengurusan KK baru bagi pengantin baru, pisah/pecah KK, penambahan bayi baru lahir, maupun perbaikan data anggota keluarga.',
        `1. Penerbitan KK Baru (Membentuk Keluarga Baru / Pengantin Baru):
- Fotokopi Buku Nikah / Kutipan Akta Perkawinan (jika sudah menikah).
- KK asli masing-masing pihak (orang tua suami dan istri).
- Formulir F-1.02 (permohonan pendaftaran peristiwa kependudukan) dari Desa/Kecamatan/Disdukcapil.
- Surat Keterangan Pindah Datang (SKPWNI) jika salah satu pasangan berasal dari luar Kabupaten Sumedang.

2. Penambahan Anggota Keluarga (Bayi Baru Lahir):
- KK asli orang tua.
- Surat Keterangan Kelahiran dari Bidan/Dokter/Rumah Sakit/Puskesmas.
- Fotokopi Buku Nikah / Akta Perkawinan orang tua & KTP-el kedua orang tua (proses dapat sekalian mengurus Akta Kelahiran + KIA).

3. Perubahan Elemen Data (Pendidikan, Pekerjaan, Golongan Darah, Status):
- KK asli.
- Dokumen pendukung sah atas perubahan (mis. Ijazah terakhir, SK pekerjaan, atau surat keterangan golongan darah).

4. KK Hilang atau Rusak:
- KTP-el pemohon; jika hilang wajib melampirkan Surat Keterangan Kehilangan dari Kepolisian (dengan pengantar dari Desa).

Catatan: Kartu Keluarga kini dicetak mandiri menggunakan kertas HVS A4 80gr bertanda tangan elektronik (QR Code) tanpa perlu legalisir manual.`,
        'Permendagri No. 108 Tahun 2019 & Disdukcapil Kab. Sumedang',
        'surat',
        'form',
        'Ajukan Pengantar Layanan Surat Desa',
        6,
      ],
      [
        'Adminduk',
        'Syarat Surat Pengantar Nikah (Model N1–N4 / NA) di Desa & Pendaftaran KUA',
        'nikah, surat nikah, na, n1, n2, n3, n4, kua, pengantar nikah, numpang nikah, belum menikah',
        'Persyaratan lengkap pengurusan formulir N1–N4 (NA) di Kantor Desa Margamukti hingga pendaftaran akad nikah di KUA Kecamatan Sumedang Utara.',
        `1. Tahap Pengurusan Surat Pengantar Nikah (Model N1–N4 / NA) di Desa Margamukti:
- Surat pengantar dari Ketua RT dan Ketua RW setempat.
- Fotokopi KTP-el & Kartu Keluarga calon pengantin (Catin) serta kedua orang tua.
- Fotokopi Akta Kelahiran & Ijazah terakhir Catin.
- Pas foto latar biru ukuran 2x3 (4 lembar) dan 4x6 (2 lembar).
- Surat Keterangan Belum Menikah (bila diminta kelengkapan khusus).
- Bagi berstatus Duda/Janda: wajib melampirkan Akta Cerai asli (cerai hidup) atau Akta Kematian pasangan (cerai mati) + Surat Keterangan Janda/Duda.
- Bagi anggota TNI/Polri: melampirkan surat izin kawin dari atasan/komandan.
- Bagi calon pengantin di bawah usia 19 tahun: wajib melampirkan penetapan Dispensasi Nikah dari Pengadilan Agama.

2. Tahap Pendaftaran di KUA Kecamatan Sumedang Utara:
- Bawa berkas N1, N2, N3 (persetujuan kedua calon), N4 dari Desa.
- Jika menikah di luar wilayah domisili KTP: urus Surat Rekomendasi / Numpang Nikah di KUA asal terlebih dahulu.
- Lampirkan bukti pemeriksaan kesehatan / imunisasi TT calon pengantin dari Puskesmas dan pendaftaran SIMKAH KUA minimal 10 hari kerja sebelum akad nikah.`,
        'PMA No. 20 Tahun 2019 · KUA Sumedang Utara · Pemdes Margamukti',
        'surat',
        'form',
        'Ajukan Surat Keterangan Belum Menikah / Janda-Duda',
        7,
      ],
      [
        'Adminduk',
        'Syarat Penerbitan KIA (Kartu Identitas Anak) & Akta Kelahiran / Kematian',
        'kia, kartu identitas anak, akta kelahiran, akta kematian, surat lahir, pindah datang, skpwni',
        'Persyaratan pembuatan KIA untuk anak usia 0–17 tahun kurang 1 hari, Akta Kelahiran bayi, Akta Kematian, serta surat pindah datang.',
        `1. Kartu Identitas Anak (KIA):
- Usia Anak 0 s.d. < 5 Tahun:
  a. Fotokopi Kutipan Akta Kelahiran anak.
  b. Kartu Keluarga (KK) asli/fotokopi orang tua.
  c. KTP-el kedua orang tua. (Tidak memerlukan pas foto).
- Usia Anak 5 s.d. 17 Tahun Kurang 1 Hari:
  a. Fotokopi Kutipan Akta Kelahiran anak.
  b. Kartu Keluarga (KK) orang tua & KTP-el kedua orang tua.
  c. Pas foto anak berwarna ukuran 2x3 atau 3x4 sebanyak 2 lembar (latar merah untuk tahun lahir ganjil, latar biru untuk tahun lahir genap).

2. Akta Kelahiran:
- Surat Keterangan Kelahiran dari Dokter/Bidan/Penolong kelahiran.
- Fotokopi Buku Nikah / Akta Perkawinan orang tua (dilegalisir jika perlu).
- Fotokopi KK dan KTP-el kedua orang tua serta 2 orang saksi.

3. Akta Kematian:
- Surat Keterangan Kematian dari Desa (F-2.01) atau Rumah Sakit/Dokter.
- KTP-el asli & KK almarhum/almarhumah serta KTP-el pelapor.

4. Pindah Datang / Keluar (SKPWNI):
- Formulir permohonan pindah, KK asli, dan KTP-el seluruh anggota keluarga yang pindah.`,
        'Permendagri No. 2 Tahun 2016 · Disdukcapil Kab. Sumedang',
        'surat',
        'form',
        'Ajukan Surat Keterangan Kelahiran / Kematian / Pindah',
        8,
      ],
      [
        'Pemerintahan Daerah',
        'Pemerintahan Daerah Kabupaten Sumedang, Kecamatan Sumedang Utara & Layanan Publik Daerah',
        'pemda, pemkab sumedang, sumedang utara, kecamatan, bupati, disdukcapil, dinsos, mpp, perizinan, dinas',
        'Informasi tata kelola pemerintahan Kabupaten Sumedang, koordinasi Kecamatan Sumedang Utara, Mal Pelayanan Publik (MPP), dan perangkat daerah terkait layanan warga.',
        `1. Struktur Hubungan Pemerintahan Daerah & Desa:
Desa Margamukti berada di wilayah administrasi Kecamatan Sumedang Utara, Kabupaten Sumedang, Provinsi Jawa Barat. Urusan administrasi kependudukan, sosial, perizinan, dan pembangunan daerah dikoordinasikan berjenjang dari Pemerintah Desa -> Kecamatan Sumedang Utara -> Perangkat Daerah (OPD) Kabupaten Sumedang.

2. Perangkat Daerah / Instansi Layanan Utama di Kabupaten Sumedang:
- Kecamatan Sumedang Utara: Pelayanan perekaman KTP-el/KK/IKD tingkat kecamatan, rekomendasi perizinan usaha mikro, serta pembinaan penyelenggaraan pemerintahan desa.
- Disdukcapil Kabupaten Sumedang & Mal Pelayanan Publik (MPP Sumedang): Penerbitan KTP-el, KK, KIA, Akta Kelahiran/Kematian, Akta Perkawinan Non-Muslim, serta SKPWNI.
- Dinas Sosial (Dinsos) Kabupaten Sumedang: Verifikasi & validasi DTSEN/SIKS-NG, pengusulan/reaktivasi PBI-JK/BPJS, penanganan Pemerlu Pelayanan Kesejahteraan Sosial (PPKS), serta rekomendasi bantuan sosial daerah.
- DPMPTSP Kabupaten Sumedang: Penerbitan Nomor Induk Berusaha (NIB/OSS-RBA) dan perizinan berusaha daerah.
- Dinas Pendidikan & Kemenag Sumedang: Koordinasi PIP/KIP Sekolah serta layanan KUA Kecamatan Sumedang Utara.

3. Kanal Layanan & Aspirasi Daerah:
- Warga Kabupaten Sumedang dapat mengakses layanan terintegrasi di Mal Pelayanan Publik (MPP) Sumedang, aplikasi layanan publik Pemkab Sumedang, maupun kanal pengaduan SP4N-LAPOR! (lapor.go.id) atau kontak resmi desa untuk penerusan aspirasi berjenjang.`,
        'Pemerintah Kabupaten Sumedang & Kecamatan Sumedang Utara',
        'peta-kontak',
        '',
        'Lihat Peta Fasilitas & Kontak Resmi',
        9,
      ],
      [
        'Pemerintahan Desa',
        'Layanan Pemerintahan Desa Margamukti, Surat Mandiri Online, BPD, BUMDesa, LPM & PKK',
        'pemdes, margamukti, kepala desa, perangkat desa, bpd, bumdesa, lpm, pkk, surat online, jam pelayanan, struktur',
        'Gambaran layanan administrasi Kantor Desa Margamukti, daftar jenis surat yang dapat diajukan online beserta TTE QR resmi, dan peran lembaga desa.',
        `1. Jam Operasional Kantor Desa Margamukti:
Senin – Jumat pukul 08.00 – 15.30 WIB di Jl. Raya Kebonkalapa No. 12, Desa Margamukti, Kec. Sumedang Utara, Kab. Sumedang 45321.

2. Layanan Surat Mandiri Online di Portal Desa:
Warga dapat mengajukan berbagai jenis surat langsung dari HP dengan memasukkan NIK lalu memantau status menggunakan kode pelacakan (SRT-...):
- Surat Keterangan Domisili (SKD)
- Surat Keterangan Usaha (SKU)
- Surat Keterangan Tidak Mampu (SKTM)
- Surat Pengantar SKCK, Surat Keterangan Kelahiran, Surat Keterangan Kematian, Surat Keterangan Pindah (SKP)
- Format kearsipan tambahan: Surat Izin Rame-rame (SIR), Surat Keterangan Di Luar Kota (SKDLK), Beda Nama (SKBN), Belum Menikah (SKBM), Janda/Duda (SKJD), Kehilangan (SKKH), serta Surat Serbaguna (SKSG).
Surat yang telah disetujui dapat ditandatangani secara digital menggunakan QR Code Verifikasi Resmi oleh Kepala Desa maupun pejabat berwenang (Sekdes, Kasi Pemerintahan, Kasi Pelayanan, Kaur Umum & TU, Kaur Perencanaan).

3. Lembaga Kemasyarakatan & Mitra Desa:
- BPD (Badan Permusyawaratan Desa): Membahas Perdes, menampung aspirasi warga, dan mengawasi kinerja Pemdes.
- BUMDesa Mukti Mandiri: Unit ekonomi produktif desa, pemasaran UMKM, dan layanan air bersih.
- LPM (Lembaga Pemberdayaan Masyarakat): Perencanaan pembangunan partisipatif & gotong royong dusun.
- TP-PKK Desa: 10 Program Pokok PKK, Posyandu balita/lansia, cegah stunting, dan ekonomi keluarga.`,
        'Pemerintah Desa Margamukti, Kec. Sumedang Utara',
        'surat',
        'form',
        'Ajukan Surat Mandiri Sekarang',
        10,
      ],
    ];

    for (const row of kbSeeds) {
      insertKb.run(...row);
    }
  }

  // ============================================================================
  // PORTOFOLIO PEMERINTAH DESA & MANAJEMEN PEMBANGUNAN DESA
  // ============================================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolio_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      portfolio_title TEXT NOT NULL,
      portfolio_subtitle TEXT NOT NULL,
      executive_summary TEXT NOT NULL,
      profile_narrative TEXT NOT NULL,
      demographic_narrative TEXT NOT NULL,
      synergy_narrative TEXT NOT NULL,
      idm_score TEXT NOT NULL DEFAULT '0.8420',
      idm_status TEXT NOT NULL DEFAULT 'Desa Mandiri',
      sdgs_score TEXT NOT NULL DEFAULT '68.45',
      area_size TEXT NOT NULL DEFAULT '245,8 Ha',
      boundaries_north TEXT NOT NULL DEFAULT 'Desa Sirnamulya & Kecamatan Cimalaka',
      boundaries_east TEXT NOT NULL DEFAULT 'Desa Jatihurip, Kecamatan Sumedang Utara',
      boundaries_south TEXT NOT NULL DEFAULT 'Kelurahan Situ & Kelurahan Kotakaler',
      boundaries_west TEXT NOT NULL DEFAULT 'Desa Kebonjati & Desa Rancamulya',
      strategic_partners TEXT NOT NULL DEFAULT '',
      closing_statement TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT 'Sistem Desa',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS portfolio_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_type TEXT NOT NULL CHECK (section_type IN ('program_unggulan', 'penghargaan', 'sinergi', 'potensi_unggulan')),
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      year_label TEXT NOT NULL DEFAULT '2026',
      issuer_or_partner TEXT NOT NULL DEFAULT '',
      status_label TEXT NOT NULL DEFAULT 'Aktif',
      impact_summary TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_published INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL DEFAULT 'Admin Desa',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS village_developments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      budget_amount INTEGER NOT NULL DEFAULT 0,
      funding_source TEXT NOT NULL DEFAULT 'Dana Desa',
      volume TEXT NOT NULL DEFAULT '',
      progress_percent INTEGER NOT NULL DEFAULT 0,
      fiscal_year INTEGER NOT NULL DEFAULT 2026,
      executor TEXT NOT NULL DEFAULT 'TPK Desa Margamukti',
      location_region TEXT NOT NULL DEFAULT '',
      latitude REAL DEFAULT NULL,
      longitude REAL DEFAULT NULL,
      photo_url TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      is_published INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL DEFAULT 'Admin Desa',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const pfSettingsCount = db.prepare('SELECT COUNT(*) as count FROM portfolio_settings').get() as { count: number };
  if (pfSettingsCount.count === 0) {
    db.prepare(`
      INSERT INTO portfolio_settings (
        id, portfolio_title, portfolio_subtitle, executive_summary,
        profile_narrative, demographic_narrative, synergy_narrative,
        idm_score, idm_status, sdgs_score, area_size,
        boundaries_north, boundaries_east, boundaries_south, boundaries_west,
        strategic_partners, closing_statement, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      1,
      'Portofolio Pemerintahan & Kinerja Pembangunan Desa Margamukti',
      'Profil Kelembagaan, Transformasi Layanan Digital, Capaian Pembangunan, dan Kemitraan Strategis Menuju Desa Mandiri Berdaya Saing',
      'Pemerintah Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang berkomitmen menyelenggarakan tata kelola pemerintahan yang bersih, akuntabel, berbasis data kependudukan akurat, serta mengutamakan pembangunan infrastruktur produktif dan pemberdayaan ekonomi masyarakat.',
      'Secara geografis, Desa Margamukti terletak di kawasan strategis penyangga perkotaan Kecamatan Sumedang Utara dengan perpaduan potensi pertanian hortikultura, sentra pangan olahan tahu & kerajinan bambu, serta koridor permukiman yang berkembang pesat.',
      'Struktur kependudukan Desa Margamukti didominasi penduduk usia produktif yang menjadi penggerak utama sektor UMKM, pertanian, perdagangan, serta industri rumah tangga. Pemutakhiran data mutasi penduduk dan DTSEN dilakukan berjenjang bersama Kepala Dusun, Ketua RW, dan Ketua RT.',
      'Seluruh kebijakan, RKPDes, dan program pemberdayaan di Desa Margamukti dijalankan melalui sinergi erat antara Pemerintah Desa (Kepala Desa dan Perangkat), BPD dalam fungsi legislasi dan pengawasan, LPM dalam mobilisasi swadaya masyarakat, TP-PKK dalam penguatan keluarga & kesehatan, serta BUMDesa Mukti Mandiri sebagai motor ekonomi desa.',
      '0.8420',
      'Desa Mandiri',
      '68.45',
      '245,8 Ha',
      'Desa Sirnamulya & Kecamatan Cimalaka',
      'Desa Jatihurip, Kecamatan Sumedang Utara',
      'Kelurahan Situ & Kelurahan Kotakaler',
      'Desa Kebonjati & Desa Rancamulya',
      'Pemerintah Kabupaten Sumedang\nKecamatan Sumedang Utara\nDinas Sosial & Disdukcapil Kab. Sumedang\nUPTD Puskesmas Situ\nBUMDesa Mukti Mandiri & Forum UMKM Sumedang\nPerguruan Tinggi Mitra KKN Tematik & CSR Perbankan Daerah',
      'Portofolio ini disusun sebagai dokumen resmi pertanggungjawaban kinerja sekaligus bahan rujukan kerja sama bagi instansi pemerintah, mitra pembangunan, akademisi, dan pelaku usaha.',
      'Super Admin Desa Margamukti'
    );
  }

  const pfItemsCount = db.prepare('SELECT COUNT(*) as count FROM portfolio_items').get() as { count: number };
  if (pfItemsCount.count === 0) {
    const insertPfItem = db.prepare(`
      INSERT INTO portfolio_items (
        section_type, title, category, year_label, issuer_or_partner, status_label,
        impact_summary, description, sort_order, is_published, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Super Admin Desa Margamukti')
    `);

    const pfSeeds: Array<[string, string, string, string, string, string, string, string, number]> = [
      // Program Unggulan Desa
      [
        'program_unggulan',
        'Digitalisasi Administrasi Surat Mandiri & TTE QR Verifikasi',
        'Tata Kelola & Layanan Publik',
        '2025–2026',
        'Pemdes Margamukti & Diskominfo Sumedang',
        'Berjalan',
        'Memangkas waktu penerbitan surat warga dari 2 hari menjadi kurang dari 30 menit dengan verifikasi QR Code anti-pemalsuan.',
        'Warga mengajukan 14 jenis surat keterangan baku kearsipan langsung dari portal berbasis NIK terintegrasi database penduduk dan ditandatangani secara digital oleh pejabat desa berwenang.',
        1,
      ],
      [
        'program_unggulan',
        'Gerakan Margamukti Zero Stunting & Posyandu Terpadu',
        'Kesehatan & Ketahanan Keluarga',
        '2024–2026',
        'TP-PKK, Kader Posyandu & Puskesmas Situ',
        'Berjalan',
        '100% balita sasaran terpantau tumbuh kembangnya setiap bulan dengan pemberian makanan tambahan (PMT) pangan lokal bergizi.',
        'Kolaborasi intervensi gizi ibu hamil dan balita di 4 Dusun melalui Posyandu aktif, edukasi sanitasi keluarga, dan pemutakhiran data sasaran rentan.',
        2,
      ],
      [
        'program_unggulan',
        'Inkubasi UMKM & Etalase Ekonomi Lokal BUMDesa Mukti Mandiri',
        'Ekonomi Produktif Desa',
        '2025–2026',
        'BUMDesa Mukti Mandiri & Pelaku UMKM',
        'Berjalan',
        'Memfasilitasi pemasaran digital dan pengurusan NIB/PIRT bagi 35+ perajin bambu, olahan tahu, dan kuliner warga.',
        'Penguatan rantai pasok produk lokal desa melalui katalog daring terintegrasi WhatsApp pelaku usaha, pelatihan kemasan higienis, dan fasilitasi permodalan mikro.',
        3,
      ],
      // Kinerja & Penghargaan
      [
        'penghargaan',
        'Predikat Desa Mandiri Berdasarkan Indeks Desa Membangun (IDM)',
        'Tata Kelola & Kemandirian Desa',
        '2025',
        'Kementerian Desa, PDT & Transmigrasi RI',
        'Tercapai',
        'Skor IDM menembus 0.8420 melampaui ambang batas Desa Mandiri pada dimensi ketahanan sosial, ekonomi, dan ekologi.',
        'Penilaian resmi komposit ketersediaan layanan dasar, infrastruktur konektivitas antar-dusun, kelembagaan ekonomi BUMDesa, serta transparansi keuangan desa.',
        1,
      ],
      [
        'penghargaan',
        'Desa Terbaik I Keterbukaan Informasi & Transparansi APBDes',
        'Akuntabilitas Keuangan Desa',
        '2025',
        'Pemerintah Kabupaten Sumedang',
        'Juara I Tingkat Kecamatan',
        'Realisasi publikasi APBDes, progress fisik pembangunan, dan layanan pengaduan warga tersaji terbuka dan tepat waktu.',
        'Penghargaan atas kepatuhan pelaporan pertanggungjawaban APBDes tepat waktu, penyediaan papan informasi digital, dan respons cepat tindak lanjut aspirasi masyarakat.',
        2,
      ],
      [
        'penghargaan',
        'Apresiasi Inovasi Pelayanan Publik Desa Berbasis Digital',
        'Transformasi Digital Desa',
        '2026',
        'Kecamatan Sumedang Utara',
        'Terbaik',
        'Mengintegrasikan kependudukan per RT/RW, layanan surat mandiri, asisten AI informasi warga, dan peta interaktif desa.',
        'Diakui sebagai percontohan integrasi data kewilayahan tingkat RT/RW dengan layanan administrasi warga yang ramah akses melalui telepon genggam.',
        3,
      ],
      // Sinergi Pemerintah Desa, Lembaga Desa & Masyarakat
      [
        'sinergi',
        'Musrenbangdes Partisipatif Berbasis Peta Kebutuhan RT/RW',
        'Pemdes · BPD · LPM · Ketua RT/RW',
        '2026',
        'BPD, LPM & 8 Wilayah RT/RW',
        'Rutin Tahunan',
        '100% usulan prioritas infrastruktur dusun disepakati bersama secara transparan sebelum penetapan RKPDes dan APBDes.',
        'Pemerintah Desa bersama BPD dan LPM menghimpun usulan warga dari tingkat RT melalui rembuk dusun untuk memastikan pembangunan tepat sasaran.',
        1,
      ],
      [
        'sinergi',
        'Jumat Bersih & Satgas Siaga Bencana Berbasis Dusun',
        'Pemdes · LPM · Karang Taruna · Warga',
        '2025–2026',
        'LPM Desa & Relawan Warga',
        'Berkelanjutan',
        'Normalisasi rutin saluran drainase di 4 blok rawan genangan serta aktivasi sistem pelaporan darurat GPS terintegrasi.',
        'Gotong royong mingguan lintas RW menjaga kebersihan saluran irigasi, lingkungan permukiman, serta kesiapsiagaan menghadapi cuaca ekstrem.',
        2,
      ],
      [
        'sinergi',
        'Pendampingan Keluarga Sejahtera & Pemutakhiran DTSEN Terpadu',
        'Pemdes · TP-PKK · Operator SIKS-NG · Kadus',
        '2026',
        'TP-PKK, Kader & Dinas Sosial',
        'Berkelanjutan',
        'Mempercepat validasi data warga rentan sehingga penyaluran PKH, BPNT, PBI-JK, dan KIP lebih tepat sasaran.',
        'Kader PKK dan perangkat wilayah aktif mendampingi warga dalam pengecekan kelengkapan dokumen adminduk dan pembaruan data sosial ekonomi.',
        3,
      ],
      // Potensi Unggulan & Peluang Kemitraan
      [
        'potensi_unggulan',
        'Sentra Olahan Pangan Tahu & Kuliner Khas Sumedang',
        'Industri Pangan & UMKM',
        '2026',
        'Koperasi & Sentra UMKM Margamukti',
        'Siap Kemitraan',
        'Menyerap tenaga kerja lokal dan memasok produk olahan ke pasar Sumedang Utara serta wisatawan lintas kota.',
        'Memiliki puluhan unit usaha rumahan olahan kedelai dan camilan tradisional yang siap bermitra dalam perluasan kemasan dan pemasaran modern.',
        1,
      ],
      [
        'potensi_unggulan',
        'Pertanian Hortikultura & Saluran Irigasi Teknis Produktif',
        'Ketahanan Pangan & Agribisnis',
        '2026',
        'Kelompok Tani Desa Margamukti',
        'Produktif',
        'Lahan persawahan subur terdukung peningkatan jalan usaha tani dan jaringan irigasi tersier di Dusun Sukajadi & Babakan.',
        'Berpotensi untuk pengembangan kemitraan off-taker hasil panen padi, palawija, dan sayuran segar serta wisata edukasi pertanian.',
        2,
      ],
      [
        'potensi_unggulan',
        'Kerajinan Anyaman Bambu & Ekonomi Kreatif Warga',
        'Ekonomi Kreatif',
        '2026',
        'Perajin Bambu & BUMDesa',
        'Siap Ekspansi',
        'Produk besek, tampir, dan suvenir ramah lingkungan bernilai tambah tinggi untuk sektor kuliner dan perhotelan.',
        'Terbuka untuk program pendampingan desain produk, sertifikasi ramah lingkungan, dan kemitraan pengadaan suvenir lembaga/perusahaan.',
        3,
      ],
    ];

    for (const row of pfSeeds) {
      insertPfItem.run(...row);
    }
  }

  const devCount = db.prepare('SELECT COUNT(*) as count FROM village_developments').get() as { count: number };
  if (devCount.count === 0) {
    const insertDev = db.prepare(`
      INSERT INTO village_developments (
        name, budget_amount, funding_source, volume, progress_percent,
        fiscal_year, executor, location_region, latitude, longitude,
        photo_url, description, is_published, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Super Admin Desa Margamukti')
    `);

    const devSeeds: Array<[string, number, string, string, number, number, string, string, number, number, string, string]> = [
      [
        'Betonisasi Jalan Usaha Tani Blok Sukajadi',
        185000000,
        'Dana Desa (DD)',
        '420 m x 3 m x 0,15 m',
        100,
        2026,
        'TPK Desa Margamukti (Swakelola)',
        'Dusun Sukajadi · RW 03 / RT 02',
        -6.8261,
        107.9034,
        '/src/assets/images/pembangunan_jalan_desa_1795135153157.jpg',
        'Peningkatan akses jalan cor beton untuk memperlancar pengangkutan hasil panen petani serta mobilitas warga antar-blok pertanian di Dusun Sukajadi.',
      ],
      [
        'Revitalisasi Gedung & Sarana Pelayanan Posyandu Melati',
        92500000,
        'Bantuan Provinsi Jawa Barat (Banprov)',
        '1 Unit (72 m²)',
        100,
        2026,
        'TPK Desa & Kader PKK Margamukti',
        'Dusun Kebonkalapa · RW 01 / RT 01',
        -6.8286,
        107.8998,
        '/src/assets/images/pembangunan_posyandu_desa_1795135153423.jpg',
        'Renovasi ruang pemeriksaan ibu dan balita, penyediaan meja layanan imunisasi, sanitasi bersih, serta halaman ramah anak untuk pencegahan stunting.',
      ],
      [
        'Pembangunan Saluran Irigasi Tersier & Drainase Blok Babakan',
        148000000,
        'Dana Desa (DD)',
        '310 Meter (Pasangan Batu Kali)',
        75,
        2026,
        'TPK Desa & Kelompok Tani Tirtamukti',
        'Dusun Babakan · RW 04 / RT 01',
        -6.8312,
        107.9025,
        '/src/assets/images/pembangunan_irigasi_desa_1795135154042.jpg',
        'Normalisasi dan pembangunan dinding pasangan batu kali saluran irigasi persawahan guna menjamin pasokan air musim kemarau serta mencegah luapan saat hujan deras.',
      ],
      [
        'Pemasangan Penerangan Jalan Umum (PJU) Tenaga Surya & Perbaikan Gorong-gorong',
        64000000,
        'Alokasi Dana Desa (ADD) & BKK Kabupaten',
        '12 Titik PJU + 2 Unit Gorong-gorong',
        45,
        2026,
        'TPK Desa Margamukti',
        'Dusun Pawenang · RW 02 / RT 02',
        -6.8258,
        107.8975,
        '/src/assets/images/galeri_gotong_royong_1794845943477.jpg',
        'Pemasangan lampu jalan tenaga surya hemat energi pada jalur akses sekolah dan simpang permukiman Dusun Pawenang beserta perbaikan saluran melintas jalan.',
      ],
    ];

    for (const row of devSeeds) {
      insertDev.run(...row);
    }
  }

  const holidayCount = db.prepare('SELECT COUNT(*) as count FROM national_holidays').get() as { count: number };
  if (holidayCount.count === 0) {
    const insertHoliday = db.prepare(`
      INSERT INTO national_holidays (
        holiday_date, month_day, name, category, is_annual, is_official_holiday,
        description, default_greeting, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const holidaySeeds: Array<[string, string, string, string, number, number, string, string]> = [
      // === LIBUR NASIONAL TETAP TAHUNAN (ANNUAL) ===
      ['2026-01-01', '01-01', 'Tahun Baru Masehi', 'libur_nasional', 1, 1, 'Hari Libur Nasional Tahun Baru Masehi (SKB 3 Menteri).', 'Selamat Tahun Baru Masehi! Pemerintah Desa Margamukti mengucapkan terima kasih atas kebersamaan warga membangun desa yang rukun, maju, dan sejahtera.'],
      ['2026-05-01', '05-01', 'Hari Buruh Internasional', 'libur_nasional', 1, 1, 'Hari Libur Nasional memperingati dedikasi dan kesejahteraan pekerja Indonesia.', 'Selamat Hari Buruh Internasional. Pemerintah Desa Margamukti mengapresiasi kerja keras seluruh pekerja, perajin, dan penggerak ekonomi warga desa.'],
      ['2026-06-01', '06-01', 'Hari Lahir Pancasila', 'libur_nasional', 1, 1, 'Hari Libur Nasional memperingati pidato Bung Karno 1 Juni 1945 tentang dasar negara Pancasila.', 'Selamat Hari Lahir Pancasila! Mari kita rawat persatuan, gotong royong, dan kebinekaan dalam kehidupan bermasyarakat di Desa Margamukti.'],
      ['2026-08-17', '08-17', 'Hari Proklamasi Kemerdekaan Republik Indonesia', 'libur_nasional', 1, 1, 'Hari Ulang Tahun Kemerdekaan Negara Kesatuan Republik Indonesia ke-81 (17 Agustus 1945).', 'Dirgahayu Republik Indonesia! Pemerintah Desa Margamukti mengajak seluruh warga memupuk semangat kemerdekaan melalui karya nyata dan gotong royong membangun desa.'],
      ['2026-12-25', '12-25', 'Hari Raya Natal (Kelahiran Yesus Kristus)', 'libur_nasional', 1, 1, 'Hari Libur Nasional Kelahiran Yesus Kristus.', 'Selamat Hari Raya Natal bagi umat Kristiani di Desa Margamukti dan sekitarnya. Semoga damai kasih, kerukunan, dan sukacita senantiasa menyertai kita semua.'],

      // === SKB 3 MENTERI 2026 — LIBUR NASIONAL KEAGAMAAN & PERGERAKAN ===
      ['2026-01-16', '01-16', 'Isra Mikraj Nabi Muhammad SAW (1447 H)', 'libur_nasional', 0, 1, 'Hari Libur Nasional memperingati Isra Mikraj Nabi Muhammad SAW 27 Rajab 1447 H (SKB 3 Menteri 2026).', 'Pemerintah Desa Margamukti mengucapkan Selamat Memperingati Isra Mikraj Nabi Muhammad SAW. Semoga keteladanan akhlak mulia memperkuat iman dan ukhuwah warga.'],
      ['2026-02-17', '02-17', 'Tahun Baru Imlek 2577 Kongzili', 'libur_nasional', 0, 1, 'Hari Libur Nasional Tahun Baru Imlek 2577 Kongzili (SKB 3 Menteri 2026).', 'Selamat Tahun Baru Imlek 2577 Kongzili. Semoga tahun baru membawa kesehatan, keberkahan rezeki, dan harmoni di tengah masyarakat.'],
      ['2026-03-19', '03-19', 'Hari Suci Nyepi Tahun Baru Saka 1948', 'libur_nasional', 0, 1, 'Hari Libur Nasional Hari Suci Nyepi Tahun Baru Saka 1948 (SKB 3 Menteri 2026).', 'Selamat Hari Suci Nyepi Tahun Baru Saka 1948 bagi umat Hindu. Semoga keteduhan Catur Brata Penyepian menghadirkan kedamaian batin.'],
      ['2026-03-21', '03-21', 'Hari Raya Idulfitri 1447 Hijriah (Hari Pertama)', 'libur_nasional', 0, 1, 'Hari Libur Nasional 1 Syawal 1447 Hijriah (SKB 3 Menteri 2026).', 'Selamat Hari Raya Idulfitri 1447 Hijriah, Taqabbalallahu Minna Wa Minkum. Pemerintah Desa Margamukti memohon maaf lahir dan batin atas segala khilaf dalam pelayanan.'],
      ['2026-03-22', '03-22', 'Hari Raya Idulfitri 1447 Hijriah (Hari Kedua)', 'libur_nasional', 0, 1, 'Hari Libur Nasional 2 Syawal 1447 Hijriah (SKB 3 Menteri 2026).', 'Selamat Hari Raya Idulfitri 1447 Hijriah. Semoga silaturahmi Idulfitri mempererat persaudaraan seluruh keluarga besar warga Desa Margamukti.'],
      ['2026-04-03', '04-03', 'Wafat Yesus Kristus (Jumat Agung)', 'libur_nasional', 0, 1, 'Hari Libur Nasional Wafat Yesus Kristus (SKB 3 Menteri 2026).', 'Pemerintah Desa Margamukti mengucapkan Selamat Memperingati Hari Wafat Yesus Kristus bagi umat Kristiani. Semoga damai dan keteduhan iman menyertai.'],
      ['2026-04-05', '04-05', 'Kebangkitan Yesus Kristus (Paskah)', 'libur_nasional', 0, 1, 'Hari Libur Nasional Hari Kebangkitan Yesus Kristus / Paskah (SKB 3 Menteri 2026).', 'Selamat Hari Paskah bagi umat Kristiani. Semoga semangat kebangkitan membawa pengharapan baru, kasih, dan damai sejahtera.'],
      ['2026-05-14', '05-14', 'Kenaikan Yesus Kristus', 'libur_nasional', 0, 1, 'Hari Libur Nasional Kenaikan Yesus Kristus (SKB 3 Menteri 2026).', 'Selamat Memperingati Kenaikan Yesus Kristus bagi umat Kristiani di Desa Margamukti. Semoga rahmat dan kedamaian senantiasa tercurah.'],
      ['2026-05-27', '05-27', 'Hari Raya Iduladha 1447 Hijriah', 'libur_nasional', 0, 1, 'Hari Libur Nasional 10 Dzulhijjah 1447 Hijriah (SKB 3 Menteri 2026).', 'Selamat Hari Raya Iduladha 1447 Hijriah. Semoga semangat berkurban dan keikhlasan memperkokoh kepedulian sosial warga Desa Margamukti.'],
      ['2026-05-31', '05-31', 'Hari Raya Waisak 2570 BE', 'libur_nasional', 0, 1, 'Hari Libur Nasional Hari Raya Tri Suci Waisak 2570 BE (SKB 3 Menteri 2026).', 'Selamat Hari Raya Waisak 2570 BE bagi umat Buddha. Semoga ajaran welas asih dan kebijaksanaan senantiasa membawa kedamaian bagi semua makhluk.'],
      ['2026-06-16', '06-16', '1 Muharam Tahun Baru Islam 1448 H', 'libur_nasional', 0, 1, 'Hari Libur Nasional 1 Muharam 1448 Hijriah (SKB 3 Menteri 2026).', 'Selamat Tahun Baru Islam 1 Muharam 1448 Hijriah. Mari awali tahun baru dengan semangat hijrah menuju desa yang lebih berdaya dan bermartabat.'],
      ['2026-08-25', '08-25', 'Maulid Nabi Muhammad SAW (1448 H)', 'libur_nasional', 0, 1, 'Hari Libur Nasional memperingati hari lahir Nabi Muhammad SAW 12 Rabiulawal 1448 H (SKB 3 Menteri 2026).', 'Selamat Memperingati Maulid Nabi Muhammad SAW 1448 H. Mari teladani kasih sayang, kejujuran, dan kepedulian Rasulullah dalam kehidupan bertetangga dan bermasyarakat.'],

      // === SKB 3 MENTERI 2026 — CUTI BERSAMA ===
      ['2026-02-16', '02-16', 'Cuti Bersama Tahun Baru Imlek 2577 Kongzili', 'cuti_bersama', 0, 1, 'Cuti Bersama resmi berdasarkan SKB 3 Menteri Tahun 2026.', 'Pemerintah Desa Margamukti menginformasikan Cuti Bersama Imlek 2577 Kongzili. Layanan darurat dan verifikasi QR surat tetap dapat diakses secara daring.'],
      ['2026-03-18', '03-18', 'Cuti Bersama Hari Suci Nyepi Saka 1948', 'cuti_bersama', 0, 1, 'Cuti Bersama resmi berdasarkan SKB 3 Menteri Tahun 2026.', 'Informasi Cuti Bersama Hari Suci Nyepi Tahun Baru Saka 1948. Pengajuan surat daring tetap tercatat dan akan diproses petugas piket/hari kerja.'],
      ['2026-03-20', '03-20', 'Cuti Bersama Hari Raya Idulfitri 1447 H', 'cuti_bersama', 0, 1, 'Cuti Bersama Idulfitri 1447 H berdasarkan SKB 3 Menteri Tahun 2026.', 'Memasuki masa Cuti Bersama Idulfitri 1447 H, Pemerintah Desa Margamukti mengucapkan selamat mudik dan berkumpul bersama keluarga tercinta dengan aman.'],
      ['2026-03-23', '03-23', 'Cuti Bersama Hari Raya Idulfitri 1447 H', 'cuti_bersama', 0, 1, 'Cuti Bersama Idulfitri 1447 H berdasarkan SKB 3 Menteri Tahun 2026.', 'Masih dalam suasana Idulfitri 1447 H, mari jaga keamanan lingkungan dan kebersamaan warga selama masa cuti bersama.'],
      ['2026-03-24', '03-24', 'Cuti Bersama Hari Raya Idulfitri 1447 H', 'cuti_bersama', 0, 1, 'Cuti Bersama Idulfitri 1447 H berdasarkan SKB 3 Menteri Tahun 2026.', 'Hari terakhir Cuti Bersama Idulfitri 1447 H. Pelayanan tatap muka Balai Desa kembali berjalan normal pada hari kerja berikutnya.'],
      ['2026-05-15', '05-15', 'Cuti Bersama Kenaikan Yesus Kristus', 'cuti_bersama', 0, 1, 'Cuti Bersama resmi berdasarkan SKB 3 Menteri Tahun 2026.', 'Informasi Cuti Bersama Kenaikan Yesus Kristus. Portal layanan surat mandiri dan pelaporan darurat tetap beroperasi 24 jam.'],
      ['2026-05-28', '05-28', 'Cuti Bersama Hari Raya Iduladha 1447 H', 'cuti_bersama', 0, 1, 'Cuti Bersama Iduladha 1447 H berdasarkan SKB 3 Menteri Tahun 2026.', 'Cuti Bersama Hari Raya Iduladha 1447 H. Selamat berbagi keberkahan kurban bersama tetangga dan warga sekitar.'],
      ['2026-12-24', '12-24', 'Cuti Bersama Kelahiran Yesus Kristus (Natal)', 'cuti_bersama', 0, 1, 'Cuti Bersama Natal berdasarkan SKB 3 Menteri Tahun 2026.', 'Menyambut Malam Natal dan Cuti Bersama, mari bersama-sama menjaga ketertiban, keamanan, dan kerukunan di lingkungan Desa Margamukti.'],

      // === SKB 3 MENTERI 2027 — LIBUR NASIONAL & CUTI BERSAMA ===
      ['2027-01-05', '01-05', 'Isra Mikraj Nabi Muhammad SAW (1448 H)', 'libur_nasional', 0, 1, 'Hari Libur Nasional sesuai SKB 3 Menteri Tahun 2027 (Nomor 1205/2026).', 'Selamat Memperingati Isra Mikraj Nabi Muhammad SAW 1448 H. Semoga semangat ibadah dan kejujuran senantiasa membimbing langkah kita.'],
      ['2027-02-05', '02-05', 'Cuti Bersama Tahun Baru Imlek 2578 Kongzili', 'cuti_bersama', 0, 1, 'Cuti Bersama Imlek 2578 Kongzili sesuai SKB 3 Menteri Tahun 2027.', 'Cuti Bersama Tahun Baru Imlek 2578 Kongzili. Layanan pengajuan surat daring tetap tersedia bagi warga.'],
      ['2027-02-06', '02-06', 'Tahun Baru Imlek 2578 Kongzili', 'libur_nasional', 0, 1, 'Hari Libur Nasional Tahun Baru Imlek 2578 Kongzili sesuai SKB 3 Menteri Tahun 2027.', 'Selamat Tahun Baru Imlek 2578 Kongzili. Semoga kedamaian, kesehatan, dan kesejahteraan senantiasa hadir bagi kita semua.'],
      ['2027-03-08', '03-08', 'Hari Suci Nyepi Tahun Baru Saka 1949', 'libur_nasional', 0, 1, 'Hari Libur Nasional Hari Suci Nyepi Tahun Baru Saka 1949 sesuai SKB 3 Menteri Tahun 2027.', 'Selamat Hari Suci Nyepi Tahun Baru Saka 1949 bagi umat Hindu. Semoga keheningan membawa kejernihan hati dan harmoni alam.'],
      ['2027-03-09', '03-09', 'Cuti Bersama Hari Suci Nyepi / Jelang Idulfitri 1448 H', 'cuti_bersama', 0, 1, 'Cuti Bersama resmi sesuai SKB 3 Menteri Tahun 2027.', 'Cuti Bersama resmi Pemerintah. Balai Desa menyesuaikan jadwal layanan tatap muka, sedangkan layanan daring tetap aktif.'],
      ['2027-03-10', '03-10', 'Hari Raya Idulfitri 1448 Hijriah (Hari Pertama)', 'libur_nasional', 0, 1, 'Hari Libur Nasional 1 Syawal 1448 Hijriah sesuai SKB 3 Menteri Tahun 2027.', 'Selamat Hari Raya Idulfitri 1448 Hijriah, Mohon Maaf Lahir dan Batin. Semoga fitri hati mempererat kebersamaan warga Margamukti.'],
      ['2027-03-11', '03-11', 'Hari Raya Idulfitri 1448 Hijriah (Hari Kedua)', 'libur_nasional', 0, 1, 'Hari Libur Nasional 2 Syawal 1448 Hijriah sesuai SKB 3 Menteri Tahun 2027.', 'Selamat Hari Raya Idulfitri 1448 Hijriah. Semoga keberkahan Syawal menyertai seluruh keluarga di Desa Margamukti.'],
      ['2027-03-12', '03-12', 'Cuti Bersama Hari Raya Idulfitri 1448 H', 'cuti_bersama', 0, 1, 'Cuti Bersama Idulfitri 1448 H sesuai SKB 3 Menteri Tahun 2027.', 'Cuti Bersama Hari Raya Idulfitri 1448 H. Tetap jaga keselamatan berkendara dan keamanan lingkungan rumah warga.'],
      ['2027-03-15', '03-15', 'Cuti Bersama Hari Raya Idulfitri 1448 H', 'cuti_bersama', 0, 1, 'Cuti Bersama Idulfitri 1448 H sesuai SKB 3 Menteri Tahun 2027.', 'Cuti Bersama Hari Raya Idulfitri 1448 H. Pelayanan tatap muka Balai Desa kembali aktif pada hari kerja berikutnya.'],
      ['2027-03-25', '03-25', 'Cuti Bersama Wafat Yesus Kristus', 'cuti_bersama', 0, 1, 'Cuti Bersama resmi sesuai SKB 3 Menteri Tahun 2027.', 'Informasi Cuti Bersama menjelang Hari Wafat Yesus Kristus.'],
      ['2027-03-26', '03-26', 'Wafat Yesus Kristus (Jumat Agung)', 'libur_nasional', 0, 1, 'Hari Libur Nasional Wafat Yesus Kristus sesuai SKB 3 Menteri Tahun 2027.', 'Selamat Memperingati Hari Wafat Yesus Kristus bagi umat Kristiani.'],
      ['2027-03-28', '03-28', 'Kebangkitan Yesus Kristus (Paskah)', 'libur_nasional', 0, 1, 'Hari Libur Nasional Paskah sesuai SKB 3 Menteri Tahun 2027.', 'Selamat Hari Paskah bagi umat Kristiani. Semoga damai kasih senantiasa menyertai.'],
      ['2027-05-06', '05-06', 'Kenaikan Yesus Kristus', 'libur_nasional', 0, 1, 'Hari Libur Nasional Kenaikan Yesus Kristus sesuai SKB 3 Menteri Tahun 2027.', 'Selamat Memperingati Kenaikan Yesus Kristus bagi umat Kristiani.'],
      ['2027-05-17', '05-17', 'Hari Raya Iduladha 1448 Hijriah', 'libur_nasional', 0, 1, 'Hari Libur Nasional Iduladha 1448 H sesuai SKB 3 Menteri Tahun 2027.', 'Selamat Hari Raya Iduladha 1448 Hijriah. Semoga keikhlasan berkurban membawa keberkahan bagi sesama.'],
      ['2027-05-18', '05-18', 'Cuti Bersama Hari Raya Iduladha 1448 H', 'cuti_bersama', 0, 1, 'Cuti Bersama Iduladha 1448 H sesuai SKB 3 Menteri Tahun 2027.', 'Informasi Cuti Bersama Hari Raya Iduladha 1448 Hijriah.'],
      ['2027-05-19', '05-19', 'Cuti Bersama Hari Raya Waisak 2571 BE', 'cuti_bersama', 0, 1, 'Cuti Bersama Waisak 2571 BE sesuai SKB 3 Menteri Tahun 2027.', 'Informasi Cuti Bersama Hari Raya Waisak 2571 BE.'],
      ['2027-05-20', '05-20', 'Hari Raya Waisak 2571 BE', 'libur_nasional', 0, 1, 'Hari Libur Nasional Waisak 2571 BE sesuai SKB 3 Menteri Tahun 2027.', 'Selamat Hari Raya Waisak 2571 BE bagi umat Buddha. Semoga kedamaian dan kebijaksanaan menaungi kita semua.'],
      ['2027-06-06', '06-06', '1 Muharam Tahun Baru Islam 1449 H', 'libur_nasional', 0, 1, 'Hari Libur Nasional 1 Muharam 1449 H sesuai SKB 3 Menteri Tahun 2027.', 'Selamat Tahun Baru Islam 1 Muharam 1449 Hijriah.'],
      ['2027-08-15', '08-15', 'Maulid Nabi Muhammad SAW (1449 H)', 'libur_nasional', 0, 1, 'Hari Libur Nasional Maulid Nabi SAW 1449 H sesuai SKB 3 Menteri Tahun 2027.', 'Selamat Memperingati Maulid Nabi Muhammad SAW 1449 H.'],
      ['2027-12-24', '12-24', 'Cuti Bersama Kelahiran Yesus Kristus (Natal)', 'cuti_bersama', 0, 1, 'Cuti Bersama Natal sesuai SKB 3 Menteri Tahun 2027.', 'Menyambut Hari Natal dan Cuti Bersama Pemerintah Tahun 2027.'],

      // === HARI PERINGATAN NASIONAL BAKU (ANNUAL, BUKAN TANGGAL MERAH) ===
      ['2026-01-03', '01-03', 'Hari Amal Bakti Kementerian Agama RI', 'peringatan_nasional', 1, 0, 'Peringatan berdirinya Kementerian Agama RI untuk menjaga kerukunan umat beragama.', 'Selamat Hari Amal Bakti Kementerian Agama RI. Mari terus rawat toleransi dan kerukunan antarumat beragama di Desa Margamukti.'],
      ['2026-01-15', '01-15', 'Hari Dharma Samudra', 'peringatan_nasional', 1, 0, 'Peringatan pengorbanan para pahlawan laut dalam Pertempuran Laut Aru 1962.', 'Memperingati Hari Dharma Samudra. Menghormati jasa para pahlawan penjaga kedaulatan perairan Nusantara.'],
      ['2026-01-25', '01-25', 'Hari Gizi Nasional', 'peringatan_nasional', 1, 0, 'Peringatan kesadaran gizi seimbang untuk generasi sehat dan bebas stunting.', 'Selamat Hari Gizi Nasional! Pemerintah Desa Margamukti bersama Posyandu mengajak keluarga rutin memantau tumbuh kembang balita demi generasi bebas stunting.'],
      ['2026-02-09', '02-09', 'Hari Pers Nasional', 'peringatan_nasional', 1, 0, 'Peringatan kelahiran Persatuan Wartawan Indonesia dan kebebasan pers yang bertanggung jawab.', 'Selamat Hari Pers Nasional! Terima kasih insan pers atas kontribusi menyebarkan informasi pembangunan desa yang jujur dan edukatif.'],
      ['2026-03-01', '03-01', 'Hari Penegakan Kedaulatan Negara', 'peringatan_nasional', 1, 0, 'Keputusan Presiden RI tentang peristiwa Serangan Umum 1 Maret 1949.', 'Memperingati Hari Penegakan Kedaulatan Negara 1 Maret. Meneladani kegigihan pejuang mempertahankan kedaulatan Indonesia.'],
      ['2026-03-09', '03-09', 'Hari Musik Nasional', 'peringatan_nasional', 1, 0, 'Keputusan Presiden RI memperingati lahirnya komposer Lagu Kebangsaan W.R. Supratman.', 'Selamat Hari Musik Nasional. Mari lestarikan seni musik daerah Sunda dan kreativitas seniman muda Margamukti.'],
      ['2026-04-06', '04-06', 'Hari Nelayan Nasional', 'peringatan_nasional', 1, 0, 'Penghargaan atas jasa nelayan dan penggerak perikanan Nusantara.', 'Selamat Hari Nelayan Nasional bagi seluruh penggiat perikanan air tawar dan kelautan Indonesia.'],
      ['2026-04-21', '04-21', 'Hari Kartini', 'peringatan_nasional', 1, 0, 'Keppres RI No. 108/1964 memperingati emansipasi dan gagasan pendidikan R.A. Kartini.', 'Selamat Hari Kartini! Teruslah menginspirasi perempuan Desa Margamukti dalam pendidikan, ekonomi keluarga, dan pengabdian masyarakat.'],
      ['2026-05-02', '05-02', 'Hari Pendidikan Nasional (Hardiknas)', 'peringatan_nasional', 1, 0, 'Keppres RI memperingati lahirnya Ki Hadjar Dewantara, Bapak Pendidikan Nasional.', 'Selamat Hari Pendidikan Nasional! Pemerintah Desa Margamukti mendukung penuh semangat belajar sepanjang hayat bagi putra-putri desa.'],
      ['2026-05-17', '05-17', 'Hari Buku Nasional', 'peringatan_nasional', 1, 0, 'Peringatan berdirinya Perpustakaan Nasional RI untuk menumbuhkan budaya literasi.', 'Selamat Hari Buku Nasional! Ayo manfaatkan taman baca dan pojok literasi desa untuk membangun generasi cerdas.'],
      ['2026-05-20', '05-20', 'Hari Kebangkitan Nasional (Harkitnas)', 'peringatan_nasional', 1, 0, 'Memperingati berdirinya Boedi Oetomo 20 Mei 1908 sebagai tonggak kesadaran persatuan bangsa.', 'Selamat Hari Kebangkitan Nasional! Bangkitkan semangat kemandirian ekonomi dan inovasi pelayanan publik di Desa Margamukti.'],
      ['2026-07-01', '07-01', 'Hari Bhayangkara (HUT Polri)', 'peringatan_nasional', 1, 0, 'Peringatan lahirnya Kepolisian Negara Republik Indonesia.', 'Selamat Hari Bhayangkara! Terima kasih jajaran Polri dan Bhabinkamtibmas atas sinergi menjaga kamtibmas Desa Margamukti.'],
      ['2026-07-22', '07-22', 'Hari Bhakti Adhyaksa', 'peringatan_nasional', 1, 0, 'Hari ulang tahun Kejaksaan Republik Indonesia.', 'Selamat Hari Bhakti Adhyaksa. Bersama membangun tata kelola desa yang sadar hukum dan transparan.'],
      ['2026-07-23', '07-23', 'Hari Anak Nasional', 'peringatan_nasional', 1, 0, 'Keppres RI No. 44/1984 untuk pemenuhan hak, perlindungan, dan kebahagiaan anak Indonesia.', 'Selamat Hari Anak Nasional! Mari wujudkan Desa Margamukti yang ramah anak, aman, sehat, dan penuh kasih sayang.'],
      ['2026-08-10', '08-10', 'Hari Veteran Nasional', 'peringatan_nasional', 1, 0, 'Keppres RI No. 30/2014 menghormati jasa para veteran pejuang kemerdekaan RI.', 'Selamat Hari Veteran Nasional. Terima kasih dan hormat setinggi-tingginya kepada para sesepuh dan pejuang bangsa.'],
      ['2026-08-14', '08-14', 'Hari Pramuka', 'peringatan_nasional', 1, 0, 'Peringatan lahirnya Gerakan Pramuka Indonesia 14 Agustus 1961.', 'Selamat Hari Pramuka! Salam Pramuka bagi gugus depan sekolah dan Karang Taruna Desa Margamukti yang berkarakter tangguh.'],
      ['2026-09-09', '09-09', 'Hari Olahraga Nasional (Haornas)', 'peringatan_nasional', 1, 0, 'Keppres RI No. 67/1985 bertepatan pembukaan PON I di Surakarta.', 'Selamat Hari Olahraga Nasional! Mari budayakan olahraga rutin di lapangan desa agar warga Margamukti senantiasa sehat dan bugar.'],
      ['2026-09-17', '09-17', 'Hari Perhubungan Nasional & Hari PMI', 'peringatan_nasional', 1, 0, 'Peringatan bakti sektor perhubungan nasional serta berdirinya Palang Merah Indonesia.', 'Selamat Hari Perhubungan Nasional dan Hari PMI. Terima kasih para relawan kemanusiaan dan penggerak mobilitas masyarakat.'],
      ['2026-09-24', '09-24', 'Hari Tani Nasional', 'peringatan_nasional', 1, 0, 'Keppres RI No. 169/1963 bertepatan dengan pengesahan Undang-Undang Pokok Agraria 1960.', 'Selamat Hari Tani Nasional! Pemerintah Desa Margamukti bangga dan mendukung ketangguhan petani sebagai pilar ketahanan pangan desa.'],
      ['2026-09-26', '09-26', 'Hari Statistik Nasional', 'peringatan_nasional', 1, 0, 'Peringatan UU Statistik dan pentingnya data yang akurat dalam perencanaan pembangunan.', 'Selamat Hari Statistik Nasional! Data kependudukan dan pembangunan yang akurat menjadi fondasi pelayanan terbaik Desa Margamukti.'],
      ['2026-10-01', '10-01', 'Hari Kesaktian Pancasila', 'peringatan_nasional', 1, 0, 'Keputusan Pemerintah memperingati keteguhan Pancasila sebagai ideologi bangsa.', 'Memperingati Hari Kesaktian Pancasila 1 Oktober. Teguhkan persatuan, nilai gotong royong, dan pengabdian untuk negeri.'],
      ['2026-10-02', '10-02', 'Hari Batik Nasional', 'peringatan_nasional', 1, 0, 'Keppres RI No. 33/2009 setelah penetapan Batik Indonesia sebagai Warisan Budaya Takbenda UNESCO.', 'Selamat Hari Batik Nasional! Mari kenakan dan banggakan batik serta wastra karya UMKM perajin lokal Indonesia.'],
      ['2026-10-05', '10-05', 'Hari Tentara Nasional Indonesia (HUT TNI)', 'peringatan_nasional', 1, 0, 'Peringatan lahirnya Tentara Keamanan Rakyat 5 Oktober 1945.', 'Dirgahayu Tentara Nasional Indonesia! Terima kasih jajaran TNI dan Babinsa atas kemanunggalan bersama warga menjaga kondusivitas desa.'],
      ['2026-10-22', '10-22', 'Hari Santri Nasional', 'peringatan_nasional', 1, 0, 'Keppres RI No. 22/2015 mengenang Resolusi Jihad 22 Oktober 1945.', 'Selamat Hari Santri Nasional! Pemerintah Desa Margamukti mengapresiasi peran santri, pesantren, dan majelis taklim dalam mencerdaskan akhlak generasi desa.'],
      ['2026-10-28', '10-28', 'Hari Sumpah Pemuda', 'peringatan_nasional', 1, 0, 'Memperingati ikrar Satu Nusa, Satu Bangsa, dan Satu Bahasa Pemuda Indonesia 28 Oktober 1928.', 'Selamat Hari Sumpah Pemuda! Pemuda Margamukti bersatu, kreatif, dan berdaya cipta untuk kemajuan kampung halaman.'],
      ['2026-11-10', '11-10', 'Hari Pahlawan', 'peringatan_nasional', 1, 0, 'Keppres RI No. 316/1959 mengenang Pertempuran Surabaya 10 November 1945.', 'Selamat Hari Pahlawan! Mari teruskan api perjuangan para pahlawan dengan pengabdian tulus, kejujuran, dan kepedulian antarwarga.'],
      ['2026-11-12', '11-12', 'Hari Kesehatan Nasional (HKN)', 'peringatan_nasional', 1, 0, 'Peringatan gerakan kesehatan masyarakat Indonesia sejak 1964.', 'Selamat Hari Kesehatan Nasional! Mari jaga kebersihan lingkungan, pola makan bergizi, serta aktif memeriksakan kesehatan di Posyandu dan Puskesmas.'],
      ['2026-11-25', '11-25', 'Hari Guru Nasional', 'peringatan_nasional', 1, 0, 'Keppres RI No. 78/1994 bertepatan dengan berdirinya Persatuan Guru Republik Indonesia (PGRI) 1945.', 'Selamat Hari Guru Nasional! Pemerintah Desa Margamukti menghaturkan terima kasih setulusnya kepada seluruh guru, pendidik PAUD, dan ustaz atas ilmu serta keteladanan bagi anak-anak desa.'],
      ['2026-11-29', '11-29', 'Hari Ulang Tahun KORPRI', 'peringatan_nasional', 1, 0, 'Keppres RI No. 82/1971 memperingati lahirnya Korps Pegawai Republik Indonesia.', 'Selamat HUT KORPRI! Menguatkan komitmen integritas, profesionalitas, dan keramahan pelayanan publik aparatur bagi seluruh masyarakat.'],
      ['2026-12-19', '12-19', 'Hari Bela Negara', 'peringatan_nasional', 1, 0, 'Keppres RI No. 28/2006 memperingati berdirinya Pemerintahan Darurat Republik Indonesia 1948.', 'Selamat Hari Bela Negara. Bela negara dimulai dari kepedulian warga menjaga persatuan, ketahanan lingkungan, dan ketertiban desa.'],
      ['2026-12-22', '12-22', 'Hari Ibu Nasional', 'peringatan_nasional', 1, 0, 'Keppres RI No. 316/1959 mengenang Kongres Perempuan Indonesia I tanggal 22 Desember 1928.', 'Selamat Hari Ibu! Penghormatan terdalam bagi seluruh ibu tangguh di Desa Margamukti yang menjadi tiang kasih sayang keluarga dan penggerak PKK desa.'],

      // === HARI PERINGATAN DAERAH SUMEDANG & JAWA BARAT (ANNUAL) ===
      ['2026-03-24', '03-24', 'Peringatan Peristiwa Bandung Lautan Api', 'daerah_desa', 1, 0, 'Peringatan perjuangan rakyat Jawa Barat mempertahankan kemerdekaan pada 24 Maret 1946.', 'Memperingati Peristiwa Bandung Lautan Api. Meneladani jiwa pengorbanan rakyat Jawa Barat demi kemerdekaan bangsa.'],
      ['2026-04-22', '04-22', 'Hari Jadi Kabupaten Sumedang', 'daerah_desa', 1, 0, 'Perda Kabupaten Sumedang memperingati berdirinya Kabupaten Sumedang sejak 22 April 1578 (Prabu Geusan Ulun).', 'Wilujeng Tepang Taun Kabupaten Sumedang! Pemerintah beserta seluruh warga Desa Margamukti siap bersinergi mewujudkan Sumedang Simpati yang maju, mandiri, dan berbudaya.'],
      ['2026-08-19', '08-19', 'Hari Jadi Provinsi Jawa Barat', 'daerah_desa', 1, 0, 'Peringatan penetapan Provinsi Jawa Barat sebagai salah satu provinsi awal RI pada 19 Agustus 1945.', 'Wilujeng Milangkala Provinsi Jawa Barat! Dari Desa Margamukti untuk Jawa Barat yang gemah ripah repeh rapih dan sejahtera.'],
    ];

    for (const h of holidaySeeds) {
      insertHoliday.run(...h);
    }
  }

  const greetingCount = db.prepare('SELECT COUNT(*) as count FROM village_greetings').get() as { count: number };
  if (greetingCount.count === 0) {
    const findHolidayId = (monthDay: string, fallbackNameLike?: string): number | null => {
      const row = db
        .prepare(
          fallbackNameLike
            ? 'SELECT id FROM national_holidays WHERE month_day = ? AND name LIKE ? ORDER BY id ASC LIMIT 1'
            : 'SELECT id FROM national_holidays WHERE month_day = ? ORDER BY id ASC LIMIT 1'
        )
        .get(...(fallbackNameLike ? [monthDay, fallbackNameLike] : [monthDay])) as { id: number } | undefined;
      return row?.id ?? null;
    };

    const insertGreeting = db.prepare(`
      INSERT INTO village_greetings (
        holiday_id, moment_title, greeting_text, sender_label, theme_tone,
        start_date, end_date, is_pinned, is_active, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const greetingSeeds: Array<[number | null, string, string, string, string, string, string, number, number, string]> = [
      [
        findHolidayId('11-25', '%Guru%'),
        'Menyongsong & Memperingati Hari Guru Nasional 2026',
        'Pemerintah Desa Margamukti mengucapkan Selamat Hari Guru Nasional (25 November 2026). Terima kasih setulus-tulusnya kepada seluruh guru, pendidik PAUD, pengasuh madrasah, dan relawan literasi yang tanpa lelah menyalakan lentera ilmu bagi generasi penerus Desa Margamukti.',
        'Kepala Desa & Perangkat Desa Margamukti',
        'nasional',
        '2026-11-18',
        '2026-11-26',
        1,
        1,
        'Admin Desa',
      ],
      [
        findHolidayId('11-29', '%KORPRI%'),
        'HUT ke-55 KORPRI Tahun 2026',
        'Pemerintah Desa Margamukti mengucapkan Selamat Hari Ulang Tahun KORPRI ke-55. Terus tingkatkan pelayanan publik desa yang ramah, transparan, cepat, dan berintegritas untuk seluruh warga.',
        'Pemerintah Desa Margamukti',
        'resmi',
        '2026-11-27',
        '2026-11-30',
        0,
        1,
        'Admin Desa',
      ],
      [
        findHolidayId('12-22', '%Ibu%'),
        'Peringatan Hari Ibu Nasional 2026',
        'Pemerintah Desa Margamukti mengucapkan Selamat Hari Ibu Nasional. Penghargaan setinggi-tingginya bagi seluruh ibu dan kader PKK Desa Margamukti yang menguatkan ketahanan keluarga dan kesehatan generasi desa.',
        'Pemerintah Desa & TP PKK Desa Margamukti',
        'resmi',
        '2026-12-21',
        '2026-12-23',
        0,
        1,
        'Admin Desa',
      ],
      [
        findHolidayId('12-25', '%Natal%'),
        'Hari Raya Natal 2026 & Tahun Baru 2027',
        'Pemerintah Desa Margamukti mengucapkan Selamat Hari Raya Natal 2026 bagi umat Kristiani yang merayakan serta Selamat Menyambut Tahun Baru 2027. Mari jaga kerukunan, keamanan, dan semangat gotong royong antarwarga.',
        'Pemerintah Desa Margamukti',
        'religius',
        '2026-12-24',
        '2027-01-02',
        0,
        1,
        'Admin Desa',
      ],
      [
        findHolidayId('04-22', '%Sumedang%'),
        'Hari Jadi Kabupaten Sumedang',
        'Wilujeng Tepang Taun Kabupaten Sumedang! Pemerintah Desa Margamukti mengajak seluruh masyarakat menjaga budaya Sunda, kebersihan lingkungan, dan inovasi pelayanan desa menuju Sumedang yang semakin sejahtera.',
        'Pemerintah & BPD Desa Margamukti',
        'daerah',
        '2027-04-20',
        '2027-04-23',
        0,
        1,
        'Admin Desa',
      ],
    ];

    for (const g of greetingSeeds) {
      insertGreeting.run(...g);
    }
  }
}

export function getPopulationStats() {
  const activeWhere = "COALESCE(resident_status, 'aktif') IN ('aktif', 'lahir', 'pindah_masuk')";
  const activeJoinWhere = "COALESCE(rs.resident_status, 'aktif') IN ('aktif', 'lahir', 'pindah_masuk')";

  const totals = db.prepare(`
    SELECT
      COUNT(*) as totalResidents,
      SUM(CASE WHEN gender = 'Laki-laki' THEN 1 ELSE 0 END) as maleCount,
      SUM(CASE WHEN gender = 'Perempuan' THEN 1 ELSE 0 END) as femaleCount,
      COUNT(DISTINCT no_kk) as totalFamilies
    FROM residents
    WHERE ${activeWhere}
  `).get() as {
    totalResidents: number;
    maleCount: number;
    femaleCount: number;
    totalFamilies: number;
  };

  const regionStats = db.prepare(`
    SELECT
      COUNT(DISTINCT dusun) as totalDusun,
      COUNT(DISTINCT rw) as totalRw,
      COUNT(*) as totalRt
    FROM regions
  `).get() as {
    totalDusun: number;
    totalRw: number;
    totalRt: number;
  };

  const dusunBreakdown = db.prepare(`
    SELECT
      rg.dusun as dusun,
      COUNT(DISTINCT rg.rw) as rwCount,
      COUNT(DISTINCT rg.id) as rtCount,
      COUNT(rs.id) as residentCount,
      SUM(CASE WHEN rs.gender = 'Laki-laki' THEN 1 ELSE 0 END) as maleCount,
      SUM(CASE WHEN rs.gender = 'Perempuan' THEN 1 ELSE 0 END) as femaleCount
    FROM regions rg
    LEFT JOIN residents rs ON rs.region_id = rg.id AND ${activeJoinWhere}
    GROUP BY rg.dusun
    ORDER BY rg.dusun ASC
  `).all();

  const rwBreakdown = db.prepare(`
    SELECT
      rg.rw as rw,
      rg.dusun as dusun,
      COUNT(rs.id) as residentCount,
      SUM(CASE WHEN rs.gender = 'Laki-laki' THEN 1 ELSE 0 END) as maleCount,
      SUM(CASE WHEN rs.gender = 'Perempuan' THEN 1 ELSE 0 END) as femaleCount
    FROM regions rg
    LEFT JOIN residents rs ON rs.region_id = rg.id AND ${activeJoinWhere}
    GROUP BY rg.rw, rg.dusun
    ORDER BY rg.rw ASC
  `).all();

  const occupationBreakdown = db.prepare(`
    SELECT occupation, COUNT(*) as count
    FROM residents
    WHERE ${activeWhere}
    GROUP BY occupation
    ORDER BY count DESC, occupation ASC
  `).all();

  const religionBreakdown = db.prepare(`
    SELECT religion, COUNT(*) as count
    FROM residents
    WHERE ${activeWhere}
    GROUP BY religion
    ORDER BY count DESC, religion ASC
  `).all();

  const allBirthDates = db.prepare(`SELECT birth_date FROM residents WHERE ${activeWhere}`).all() as Array<{ birth_date: string }>;
  const ageBuckets: Record<string, number> = {
    '0-12 Tahun': 0,
    '13-17 Tahun': 0,
    '18-30 Tahun': 0,
    '31-45 Tahun': 0,
    '46-60 Tahun': 0,
    '>60 Tahun': 0,
  };
  const now = new Date();
  for (const row of allBirthDates) {
    const dob = new Date(row.birth_date);
    if (Number.isNaN(dob.getTime())) continue;
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    if (age <= 12) ageBuckets['0-12 Tahun']++;
    else if (age <= 17) ageBuckets['13-17 Tahun']++;
    else if (age <= 30) ageBuckets['18-30 Tahun']++;
    else if (age <= 45) ageBuckets['31-45 Tahun']++;
    else if (age <= 60) ageBuckets['46-60 Tahun']++;
    else ageBuckets['>60 Tahun']++;
  }
  const ageBreakdown = Object.entries(ageBuckets).map(([group, count]) => ({ group, count }));

  const educationBreakdown = db.prepare(`
    SELECT COALESCE(NULLIF(education, ''), 'SLTA/Sederajat') as education, COUNT(*) as count
    FROM residents
    WHERE ${activeWhere}
    GROUP BY education
    ORDER BY count DESC, education ASC
  `).all();

  const maritalBreakdown = db.prepare(`
    SELECT marital_status as status, COUNT(*) as count
    FROM residents
    WHERE ${activeWhere}
    GROUP BY marital_status
    ORDER BY count DESC, marital_status ASC
  `).all();

  const disabilityBreakdown = db.prepare(`
    SELECT COALESCE(NULLIF(physical_disability, ''), 'Tidak Ada') as status, COUNT(*) as count
    FROM residents
    WHERE ${activeWhere}
    GROUP BY status
    ORDER BY count DESC
  `).all();

  return {
    totalResidents: totals.totalResidents || 0,
    maleCount: totals.maleCount || 0,
    femaleCount: totals.femaleCount || 0,
    totalFamilies: totals.totalFamilies || 0,
    totalDusun: regionStats.totalDusun || 0,
    totalRw: regionStats.totalRw || 0,
    totalRt: regionStats.totalRt || 0,
    dusunBreakdown,
    rwBreakdown,
    occupationBreakdown,
    religionBreakdown,
    ageBreakdown,
    educationBreakdown,
    maritalBreakdown,
    disabilityBreakdown,
  };
}
