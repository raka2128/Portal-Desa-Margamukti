# Sistem Informasi & Layanan Pemerintahan Desa Margamukti
**Kecamatan Sumedang Utara, Kabupaten Sumedang, Provinsi Jawa Barat (Kode Pos 45321)**

Aplikasi web full-stack GUI Dinamis yang mencakup **Portal Publik Warga** dan **Dashboard Admin Pemerintahan Desa** menggunakan **React + Vite + Express.js + SQLite**.

---

## 1. Struktur Folder Proyek

```text
/
├── database/
│   ├── schema.sql               # Skema SQL lengkap (DDL) + Data Dummy awal
│   └── margamukti.db            # File database SQLite (otomatis dibuat saat start)
├── uploads/                     # Penyimpanan file foto unggahan dari Dashboard Admin
├── server/
│   └── db.ts                    # Inisialisasi SQLite, migrasi otomatis & query statistik
├── server.ts                    # Entry point Express.js API + Vite middleware
├── src/
│   ├── assets/images/           # Aset visual bawaan Desa Margamukti
│   ├── components/              # Komponen UI reusable (Kop Surat, PDF, Peta Leaflet, Rich Text)
│   ├── pages/
│   │   ├── public/              # Beranda, Profil (Visi Misi, Perangkat, Wilayah, Statistik, APBDes), Surat, Jelajah, Peta
│   │   └── admin/               # Login & 13 Modul CRUD Dashboard Admin (termasuk APBDes & RBAC Akun)
│   ├── types.ts                 # Definisi tipe TypeScript
│   ├── utils/pdfGenerator.ts    # Generator PDF resmi A4 dengan Kop Kabupaten Sumedang
│   ├── App.tsx                  # Router utama Portal Publik & Admin
│   └── index.css                # Konfigurasi Tailwind CSS v4 & Print stylesheet A4
├── index.html
├── package.json
└── README.md
```

---

## 2. Persyaratan Sistem Lokal
- **Node.js** versi `20.x` atau `22.x` (disarankan LTS)
- **npm** versi `10.x` ke atas

---

## 3. Panduan Instalasi & Menjalankan di Localhost

1. **Instal seluruh dependensi proyek:**
   ```bash
   npm install
   ```

2. **(Opsional) Konfigurasi file `.env`:**
   Salin `.env.example` menjadi `.env` dan sesuaikan `JWT_SECRET` bila diperlukan untuk lingkungan produksi.

3. **Jalankan mode pengembangan (Development Server):**
   ```bash
   npm run dev
   ```
   Server otomatis menginisialisasi database SQLite (`database/margamukti.db`) beserta seluruh data dummy Desa Margamukti pada pemuatan pertama, lalu berjalan di:
   **`http://localhost:3000`**

4. **Build untuk Produksi:**
   ```bash
   npm run build
   NODE_ENV=production npm run start
   ```

---

## 4. Kredensial Login & Hak Akses Dashboard Admin
Akses halaman admin melalui tombol **Portal Admin** pada navigasi atas atau langsung ke `/admin`:
- **Super Admin (Akses Penuh + Manajemen Akun & Wewenang):**
  - Username: `admin`
  - Password: `123456` *(disimpan dalam bentuk hash `bcrypt` di tabel `users`)*
- **Contoh Akun Sub-Admin Perangkat Desa (Sekretaris Desa):**
  - Username: `sekdes`
  - Password: `123456` *(wewenang dapat diatur ulang oleh Super Admin melalui menu **Akun & Wewenang**)*

### Fitur Utama Tambahan:
- **Grafik Kependudukan Publik:** Ringkasan demografi di Beranda + tab **Statistik Penduduk** (Usia, Jenis Kelamin, RW, Pekerjaan, Agama).
- **Pengelompokan & Impor Excel (`.xlsx`) Penduduk:** Tab filter kelompok (Pekerjaan, Usia, RW, Kelamin, Agama), unduh template `.xlsx`, ekspor `.xlsx`, dan impor `.xlsx` mode *Upsert* (perbarui data jika NIK sama).
- **Transparansi & Manajemen APBDes:** Pengisian anggaran Pendapatan, Belanja, dan Pembiayaan per tahun di Dashboard Admin yang langsung tampil pada tab **Transparansi APBDes** di Portal Publik.

---

## 5. Impor Skema SQL Secara Manual (Opsional)
Jika Anda ingin membuat ulang atau memeriksa skema SQL secara manual menggunakan SQLite CLI:
```bash
sqlite3 database/margamukti.db < database/schema.sql
```
