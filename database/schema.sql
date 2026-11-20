-- ============================================================================
-- SKEMA DATABASE LENGKAP & DATA AWAL (SEED)
-- SISTEM INFORMASI & LAYANAN PEMERINTAHAN DESA MARGAMUKTI
-- Kecamatan Sumedang Utara, Kabupaten Sumedang, Provinsi Jawa Barat (45321)
-- Kompatibel dengan SQLite 3 (dan mudah disesuaikan ke MySQL / PostgreSQL)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Tabel Pengguna / Super Admin & Sub-Admin Perangkat Desa
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'sub_admin' CHECK (role IN ('super_admin', 'sub_admin')),
  permissions TEXT NOT NULL DEFAULT '[]',
  official_id INTEGER REFERENCES officials(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 13. Tabel Anggaran Desa (APBDes)
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

-- 2. Tabel Pengaturan Profil Desa & Kop Surat Resmi
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

-- 2b. Tabel Agenda / Kegiatan Desa (Running Text Portal Publik)
CREATE TABLE IF NOT EXISTS village_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_time TEXT NOT NULL,
  location TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Tabel Wilayah Administratif (Dusun, Blok/Kampung, RW, RT)
CREATE TABLE IF NOT EXISTS regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dusun TEXT NOT NULL,
  blok TEXT NOT NULL,
  rw TEXT NOT NULL,
  rt TEXT NOT NULL,
  ketua_rw TEXT NOT NULL,
  ketua_rt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Tabel Data Penduduk
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
  resident_status TEXT NOT NULL DEFAULT 'aktif',
  mutation_date TEXT NOT NULL DEFAULT '',
  mutation_notes TEXT NOT NULL DEFAULT '',
  death_time TEXT NOT NULL DEFAULT '',
  death_day TEXT NOT NULL DEFAULT '',
  death_cause TEXT NOT NULL DEFAULT '',
  death_location TEXT NOT NULL DEFAULT '',
  death_reporter_name TEXT NOT NULL DEFAULT '',
  death_reporter_nik TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'verified',
  verification_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Tabel Perangkat Desa
CREATE TABLE IF NOT EXISTS officials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  nip TEXT NOT NULL DEFAULT '-',
  sort_order INTEGER NOT NULL DEFAULT 1,
  photo_url TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Tabel Template Jenis Surat Keterangan
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

-- 7. Tabel Permohonan Surat Keterangan Warga
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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. Tabel Berita & Artikel Desa
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT 'Admin Desa Margamukti',
  published_at TEXT NOT NULL DEFAULT (date('now')),
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. Tabel Katalog UMKM Warga
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

-- 10. Tabel Galeri Kegiatan Desa
CREATE TABLE IF NOT EXISTS gallery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 11. Tabel Titik Peta & Lokasi Penting
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

-- 12. Tabel Kotak Masuk Kontak & Pengaduan Warga
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_name TEXT NOT NULL,
  sender_contact TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Pengaduan',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'diproses', 'selesai')),
  admin_reply TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 13. Tabel Riwayat Arsip Cadangan (Backup) Database Penduduk & Surat
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

-- ============================================================================
-- DATA AWAL (DUMMY DATA DESA MARGAMUKTI)
-- Akun Admin Default: username = 'admin', password = '123456' (bcrypt hash)
-- ============================================================================

INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role, permissions, official_id, is_active) VALUES
(1, 'admin', '$2b$10$vi8Lr1cRWaY5mtsVD2uZterQiztslLDnBm3aYN6Fyg6PQJZmLcKTC', 'Super Admin Desa Margamukti', 'super_admin', '["overview","surat","penduduk","wilayah","perangkat","apbdes","agenda","berita","umkm","galeri","peta","pengaduan","pengaturan"]', NULL, 1),
(2, 'sekdes', '$2b$10$vi8Lr1cRWaY5mtsVD2uZterQiztslLDnBm3aYN6Fyg6PQJZmLcKTC', 'Rina Marlina, S.AP.', 'sub_admin', '["overview","surat","penduduk","berita"]', 2, 1);

INSERT OR IGNORE INTO village_settings (
  id, village_name, district_name, regency_name, province_name, postal_code, village_code,
  office_address, phone, whatsapp, facebook_url, instagram_url, email, service_hours,
  hero_title, hero_subtitle, hero_image,
  vision, mission, history,
  head_name, head_nip,
  kop_line1, kop_line2, kop_line3, kop_address, map_center_lat, map_center_lng
) VALUES (
  1,
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
  'Portal resmi Pemerintah Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang. Akses informasi kependudukan, pengajuan surat keterangan mandiri, UMKM lokal, dan peta wilayah dalam satu pintu.',
  '/src/assets/images/hero_desa_margamukti_clean_1794845942599.jpg',
  'Terwujudnya Desa Margamukti yang Maju, Mandiri, Sejahtera, dan Berakhlak Mulia melalui Tata Kelola Pemerintahan yang Bersih serta Pemberdayaan Ekonomi Masyarakat.',
  '1. Meningkatkan kualitas pelayanan publik desa yang cepat, ramah, dan berbasis digital.\n2. Memperkuat pembangunan infrastruktur dusun dan fasilitas umum secara merata.\n3. Mendorong kemandirian ekonomi warga melalui pembinaan UMKM, pertanian, dan kerajinan lokal.\n4. Menjaga kerukunan sosial, budaya gotong royong, dan ketahanan lingkungan hidup.',
  'Desa Margamukti merupakan salah satu desa di wilayah Kecamatan Sumedang Utara, Kabupaten Sumedang yang terdiri atas dua wilayah dusun utama yaitu Dusun Pawenang dan Dusun Cikondang, mencakup kampung Kebonkalapa, Pasarean, Sukajadi, Balong, dan Pasiramis.',
  'H. Asep Kurniawan, S.Sos.',
  'NIAP. 19740512 202101 1 001',
  'PEMERINTAH KABUPATEN SUMEDANG',
  'KECAMATAN SUMEDANG UTARA',
  'KEPALA DESA MARGAMUKTI',
  'Jalan Raya Kebonkalapa No. 12, Desa Margamukti, Kec. Sumedang Utara, Kab. Sumedang, Kode Pos 45321',
  -6.8283,
  107.9000
);

INSERT OR IGNORE INTO village_events (id, title, event_time, location, is_active, sort_order) VALUES
(1, 'Musyawarah Perencanaan Pembangunan Desa (Musrenbangdes) 2026', 'Kamis, 21 Nov 2026 · 09.00 WIB', 'Aula Balai Desa Margamukti', 1, 1),
(2, 'Pelayanan Posyandu Terpadu Balita & Lansia Dusun Pawenang', 'Sabtu, 23 Nov 2026 · 08.00 WIB', 'Posyandu Melati Blok Kebonkalapa RW 01', 1, 2),
(3, 'Gerakan Jumat Bersih & Kerja Bakti Saluran Air Warga', 'Jumat, 29 Nov 2026 · 07.00 WIB', 'Blok Sukajadi RT 01-02 Dusun Cikondang', 1, 3);

INSERT OR IGNORE INTO regions (id, dusun, blok, rw, rt, ketua_rw, ketua_rt) VALUES
(1, 'Dusun Pawenang', 'Blok Kebonkalapa', '01', '01', 'Dedi Supriadi', 'Ujang Rohman'),
(2, 'Dusun Pawenang', 'Blok Kebonkalapa', '01', '02', 'Dedi Supriadi', 'Tatang Suryana'),
(3, 'Dusun Pawenang', 'Blok Pasarean', '02', '01', 'Hendra Kusnadi', 'Cecep Mulyana'),
(4, 'Dusun Pawenang', 'Blok Balong', '02', '02', 'Hendra Kusnadi', 'Ayi Solihin'),
(5, 'Dusun Cikondang', 'Blok Sukajadi', '03', '01', 'Yayat Ruhiyat', 'Eman Sulaeman'),
(6, 'Dusun Cikondang', 'Blok Sukajadi', '03', '02', 'Yayat Ruhiyat', 'Budi Santoso'),
(7, 'Dusun Cikondang', 'Blok Pasiramis', '04', '01', 'Ade Sumarna', 'Wawan Hermawan'),
(8, 'Dusun Cikondang', 'Blok Pasiramis', '04', '02', 'Ade Sumarna', 'Engkus Kuswara');

INSERT OR IGNORE INTO officials (id, name, position, nip, sort_order, photo_url, phone, bio) VALUES
(1, 'H. Asep Kurniawan, S.Sos.', 'Kepala Desa Margamukti', 'NIAP. 19740512 202101 1 001', 1, '', '081220458801', 'Memimpin penyelenggaraan pemerintahan, pembangunan, pembinaan kemasyarakatan, dan pemberdayaan Desa Margamukti.'),
(2, 'Rina Marlina, S.AP.', 'Sekretaris Desa', 'NIAP. 19820819 201603 2 002', 2, '', '081220458802', 'Koordinator administrasi kesekretariatan, perencanaan program desa, dan tata naskah dinas.'),
(3, 'Dadan Ramdani, S.E.', 'Kaur Keuangan', 'NIAP. 19870311 201805 1 003', 3, '', '081220458803', 'Mengelola administrasi keuangan desa, APBDes, dan pelaporan realisasi anggaran.'),
(4, 'Siti Nurjanah, S.Pd.', 'Kasi Kesejahteraan & Pelayanan', 'NIAP. 19900125 201902 2 004', 4, '', '081220458804', 'Menangani pelayanan surat warga, program sosial, posyandu, dan pemberdayaan UMKM.'),
(5, 'Agus Permana', 'Kasi Pemerintahan', 'NIAP. 19851108 201704 1 005', 5, '', '081220458805', 'Mengelola administrasi kependudukan, pertanahan, dan ketertiban wilayah desa.'),
(6, 'Oman Abdurahman', 'Kepala Dusun Pawenang', 'NIAP. 19790614 201501 1 006', 6, '', '081220458806', 'Koordinator wilayah Dusun Pawenang meliputi Blok Kebonkalapa, Pasarean, dan Balong.'),
(7, 'Endang Suherman', 'Kepala Dusun Cikondang', 'NIAP. 19810903 201608 1 007', 7, '', '081220458807', 'Koordinator wilayah Dusun Cikondang meliputi Blok Sukajadi dan Pasiramis.');

INSERT OR IGNORE INTO residents (id, nik, no_kk, full_name, birth_place, birth_date, gender, address, region_id, religion, occupation, marital_status) VALUES
(1, '3211181205850001', '3211180101120011', 'Ahmad Fauzi', 'Sumedang', '1985-05-12', 'Laki-laki', 'Blok Kebonkalapa RT 01 RW 01, Dusun Pawenang', 1, 'Islam', 'Wiraswasta', 'Kawin'),
(2, '3211185408880002', '3211180101120011', 'Nenden Kartika', 'Sumedang', '1988-08-14', 'Perempuan', 'Blok Kebonkalapa RT 01 RW 01, Dusun Pawenang', 1, 'Islam', 'Pedagang', 'Kawin'),
(3, '3211182003920003', '3211180405150022', 'Rizky Pratama', 'Bandung', '1992-03-20', 'Laki-laki', 'Blok Kebonkalapa RT 02 RW 01, Dusun Pawenang', 2, 'Islam', 'Karyawan Swasta', 'Belum Kawin'),
(4, '3211186111790004', '3211180902080033', 'Yanti Suryati', 'Sumedang', '1979-11-21', 'Perempuan', 'Blok Pasarean RT 01 RW 02, Dusun Pawenang', 3, 'Islam', 'Guru', 'Kawin'),
(5, '3211181507760005', '3211181103090044', 'Maman Abdurrahman', 'Sumedang', '1976-07-15', 'Laki-laki', 'Blok Balong RT 02 RW 02, Dusun Pawenang', 4, 'Islam', 'Petani', 'Kawin'),
(6, '3211184802950006', '3211181506180055', 'Fitriani Rahmawati', 'Sumedang', '1995-02-08', 'Perempuan', 'Blok Sukajadi RT 01 RW 03, Dusun Cikondang', 5, 'Islam', 'Pengrajin UMKM', 'Kawin'),
(7, '3211180309900007', '3211181904160066', 'Denny Kusumah', 'Sumedang', '1990-09-03', 'Laki-laki', 'Blok Sukajadi RT 02 RW 03, Dusun Cikondang', 6, 'Islam', 'Teknisi', 'Kawin'),
(8, '3211186512010008', '3211182208100077', 'Salsa Nabila', 'Sumedang', '2001-12-25', 'Perempuan', 'Blok Pasiramis RT 01 RW 04, Dusun Cikondang', 7, 'Islam', 'Mahasiswa', 'Belum Kawin'),
(9, '3211181804830009', '3211182501110088', 'Jajang Nurjaman', 'Sumedang', '1983-04-18', 'Laki-laki', 'Blok Pasiramis RT 02 RW 04, Dusun Cikondang', 8, 'Islam', 'Pengusaha Kuliner', 'Kawin'),
(10, '3211185006860010', '3211182501110088', 'Lilis Komariah', 'Garut', '1986-06-10', 'Perempuan', 'Blok Pasiramis RT 02 RW 04, Dusun Cikondang', 8, 'Islam', 'Ibu Rumah Tangga', 'Kawin');

INSERT OR IGNORE INTO apbdes_items (id, fiscal_year, type, category, title, budget_amount, realized_amount, notes) VALUES
(1, 2026, 'Pendapatan', 'Pendapatan Asli Desa (PADes)', 'Hasil Pengelolaan Tanah Kas Desa & Retribusi Pasar/UMKM', 85000000, 68000000, 'Realisasi s.d. Triwulan III'),
(2, 2026, 'Pendapatan', 'Dana Desa (APBN)', 'Transfer Dana Desa Pusat Tahun Anggaran 2026', 1120000000, 952000000, 'Tahap I & II tersalur'),
(3, 2026, 'Pendapatan', 'Alokasi Dana Desa (ADD)', 'Bagian Dana Perimbangan Kabupaten Sumedang', 645000000, 516000000, 'Siltap & operasional desa'),
(4, 2026, 'Belanja', 'Penyelenggaraan Pemerintahan Desa', 'Penghasilan Tetap Perangkat, Operasional Balai Desa & Digitalisasi Layanan', 610000000, 505000000, 'Termasuk sistem informasi desa'),
(5, 2026, 'Belanja', 'Pelaksanaan Pembangunan Desa', 'Peningkatan Jalan Lingkungan, Drainase Blok Kebonkalapa & Posyandu', 740000000, 612000000, 'Progres fisik 83%'),
(6, 2026, 'Belanja', 'Pemberdayaan Masyarakat', 'Pelatihan UMKM Anyaman Bambu, Kuliner Tahu & Ketahanan Pangan', 295000000, 236000000, '4 kelompok UMKM binaan');
