import { ArrowRight, CheckCircle2, Database, ExternalLink, SearchCheck, ShieldAlert, Smartphone } from 'lucide-react';
import type { PublicRoute } from './HomePage';

interface BansosPageProps {
  onNavigate: (route: PublicRoute, subTab?: string, param?: string | number) => void;
}

export function BansosPage({ onNavigate }: BansosPageProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header Section */}
      <div className="border-b border-slate-200 pb-6 space-y-2 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
          Layanan Perlindungan Sosial · Kementerian Sosial RI
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--theme-primary)] [text-wrap:balance]">
          Cek Bansos &amp; Pemutakhiran Data DTSEN
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Warga Desa Margamukti dapat memeriksa status kepesertaan bantuan sosial secara daring sekaligus memperbarui data kesejahteraan keluarga menuju <strong>DTSEN (Data Tunggal Sosial dan Ekonomi Nasional)</strong> melalui portal resmi Kementerian Sosial RI.
        </p>
      </div>

      {/* Two Primary Action Panels (Balanced Stretch Grid) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Card 1: Cek Bansos Kemensos */}
        <article className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--theme-accent-dark)]">
                  01. Pengecekan Status Kepesertaan
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold text-[var(--theme-primary)]">
                  Portal Cek Bansos Kemensos
                </h2>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                <SearchCheck className="w-5 h-5 text-[var(--theme-primary)]" />
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Gunakan portal resmi <strong>cekbansos.kemensos.go.id</strong> untuk memastikan apakah nama Anda atau anggota keluarga terdaftar sebagai penerima manfaat program <strong>PKH</strong> (Program Keluarga Harapan), <strong>BPNT / Sembako</strong>, maupun <strong>PBI-JK</strong>.
            </p>

            <div className="space-y-2.5 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Langkah Pengecekan Mandiri
              </p>
              <ol className="space-y-2 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-tabular font-semibold text-[var(--theme-primary)] shrink-0">1.</span>
                  <span>Buka situs resmi <strong>cekbansos.kemensos.go.id</strong> melalui tombol di bawah.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-tabular font-semibold text-[var(--theme-primary)] shrink-0">2.</span>
                  <span>Pilih wilayah KTP Anda: <strong>Jawa Barat · Kab. Sumedang · Kec. Sumedang Utara · Desa Margamukti</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-tabular font-semibold text-[var(--theme-primary)] shrink-0">3.</span>
                  <span>Ketikkan <strong>Nama Lengkap</strong> persis seperti tertera pada KTP-el dan masukkan 4 huruf kode verifikasi (*captcha*).</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-tabular font-semibold text-[var(--theme-primary)] shrink-0">4.</span>
                  <span>Tekan tombol <strong>CARI DATA</strong> untuk melihat status kepesertaan serta periode penyalurannya.</span>
                </li>
              </ol>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <a
              href="https://cekbansos.kemensos.go.id"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md transition-colors text-center"
            >
              <span>Buka Portal Cek Bansos Kemensos</span>
              <ExternalLink className="w-4 h-4 text-[var(--theme-accent-light)] shrink-0" />
            </a>
            <p className="text-[11px] text-slate-500 font-mono-tabular text-center">
              Tautan resmi: https://cekbansos.kemensos.go.id
            </p>
          </div>
        </article>

        {/* Card 2: Perlinsos Digital (Pembaruan Data DTSEN) */}
        <article className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--theme-accent-dark)]">
                  02. Pemutakhiran &amp; Usulan Mandiri DTSEN
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold text-[var(--theme-primary)]">
                  Aplikasi Perlinsos Digital
                </h2>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 border border-[var(--theme-accent)]/40 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 text-[var(--theme-primary)]" />
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Bagi warga yang ingin <strong>memperbarui data kepesertaan bansos</strong> agar tercatat dan terupdate pada <strong>DTSEN (Data Tunggal Sosial dan Ekonomi Nasional)</strong> — khususnya untuk pemutakhiran kondisi sosial-ekonomi atau pengusulan kelompok kesejahteraan Desil 1–4 — silakan menginput data melalui <strong>Aplikasi Perlinsos Digital</strong>.
            </p>

            <div className="space-y-2.5 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Persiapan &amp; Cara Penginputan DTSEN
              </p>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--theme-accent-dark)] shrink-0 mt-0.5" />
                  <span>
                    <strong>Akun IKD (Identitas Kependudukan Digital) aktif:</strong> Login di situs Perlinsos menggunakan NIK dan PIN IKD serta verifikasi wajah.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--theme-accent-dark)] shrink-0 mt-0.5" />
                  <span>
                    <strong>Dokumen KTP-el, Kartu Keluarga (KK) &amp; ID Meteran Listrik:</strong> Disiapkan untuk validasi anggota keluarga dan indikator rumah tangga.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--theme-accent-dark)] shrink-0 mt-0.5" />
                  <span>
                    <strong>Isi &amp; konfirmasi pembaruan:</strong> Lengkapi formulir kondisi sosial-ekonomi atau pendaftaran program PKH/BPNT lalu kirim untuk sinkronisasi DTSEN.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <a
              href="https://perlinsos.kemensos.go.id"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[var(--theme-primary)] bg-[var(--theme-accent)] hover:bg-[var(--theme-accent-light)] rounded-md transition-colors text-center"
            >
              <span>Buka Aplikasi Perlinsos Digital</span>
              <ExternalLink className="w-4 h-4 shrink-0" />
            </a>
            <p className="text-[11px] text-slate-500 font-mono-tabular text-center">
              Tautan resmi: https://perlinsos.kemensos.go.id
            </p>
          </div>
        </article>
      </section>

      {/* Comparison & DTSEN Overview */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-base font-semibold text-[var(--theme-primary)]">
            Perbedaan Fungsi Layanan &amp; Kapan Digunakan
          </h3>
        </div>
        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-100 text-xs">
          <div className="p-4 space-y-2">
            <p className="text-sm font-bold text-[var(--theme-primary)]">Cek Bansos Kemensos</p>
            <p className="text-slate-700 leading-relaxed">
              Memeriksa status penerima manfaat aktif PKH, BPNT/Sembako, dan PBI-JK beserta periode salur.
            </p>
            <p className="text-slate-500">
              <strong className="text-slate-700">Syarat:</strong> Data wilayah domisili sesuai KTP &amp; Nama Lengkap.
            </p>
            <a
              href="https://cekbansos.kemensos.go.id"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center gap-1.5 font-mono-tabular font-semibold text-[var(--theme-primary)] underline"
            >
              cekbansos.kemensos.go.id
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-sm font-bold text-[var(--theme-primary)]">Perlinsos Digital (DTSEN)</p>
            <p className="text-slate-700 leading-relaxed">
              Memperbarui data kepesertaan bansos dan profil sosial-ekonomi agar terupdate dalam basis data DTSEN.
            </p>
            <p className="text-slate-500">
              <strong className="text-slate-700">Syarat:</strong> Akun IKD aktif, NIK, KK, dan ID Pelanggan Listrik.
            </p>
            <a
              href="https://perlinsos.kemensos.go.id"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center gap-1.5 font-mono-tabular font-semibold text-[var(--theme-primary)] underline"
            >
              perlinsos.kemensos.go.id
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50/60">
                <th className="py-3 px-5">Portal Layanan</th>
                <th className="py-3 px-5">Fungsi Utama</th>
                <th className="py-3 px-5">Syarat Akses</th>
                <th className="py-3 px-5">Alamat Resmi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-3.5 px-5 font-semibold text-[var(--theme-primary)] whitespace-nowrap">
                  Cek Bansos Kemensos
                </td>
                <td className="py-3.5 px-5">
                  Memeriksa status penerima manfaat aktif PKH, BPNT/Sembako, dan PBI-JK beserta periode salur.
                </td>
                <td className="py-3.5 px-5">
                  Data wilayah domisili sesuai KTP &amp; Nama Lengkap.
                </td>
                <td className="py-3.5 px-5 font-mono-tabular">
                  <a
                    href="https://cekbansos.kemensos.go.id"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--theme-primary)] underline hover:text-[var(--theme-accent-dark)]"
                  >
                    cekbansos.kemensos.go.id
                  </a>
                </td>
              </tr>
              <tr>
                <td className="py-3.5 px-5 font-semibold text-[var(--theme-primary)] whitespace-nowrap">
                  Perlinsos Digital (DTSEN)
                </td>
                <td className="py-3.5 px-5">
                  Memperbarui data kepesertaan bansos dan profil sosial-ekonomi agar terupdate dalam basis data DTSEN.
                </td>
                <td className="py-3.5 px-5">
                  Akun IKD aktif, NIK, KK, dan ID Pelanggan Listrik.
                </td>
                <td className="py-3.5 px-5 font-mono-tabular">
                  <a
                    href="https://perlinsos.kemensos.go.id"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--theme-primary)] underline hover:text-[var(--theme-accent-dark)]"
                  >
                    perlinsos.kemensos.go.id
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Security & Village Desk Assistance */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--theme-primary)]">
            <ShieldAlert className="w-4 h-4 text-[var(--theme-accent-dark)]" />
            <span>Waspada Tautan Tiruan</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Pastikan Anda hanya memasukkan NIK, Nomor KK, atau PIN IKD pada situs resmi pemerintah berakhiran domain <strong>.go.id</strong> (yakni <span className="font-mono-tabular">cekbansos.kemensos.go.id</span> dan <span className="font-mono-tabular">perlinsos.kemensos.go.id</span>). Pemerintah Desa maupun Kemensos tidak memungut biaya apa pun untuk pengecekan atau pemutakhiran DTSEN.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--theme-primary)]">
              <Smartphone className="w-4 h-4 text-[var(--theme-accent-dark)]" />
              <span>Butuh Pendampingan Aktivasi IKD atau Data DTSEN?</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Warga yang belum mengaktivasi IKD di ponsel atau menemui perbedaan data KK dapat berkonsultasi dengan Perangkat Desa Margamukti pada jam kerja atau mengirim pesan lewat kanal pengaduan desa.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => onNavigate('peta-kontak')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--theme-primary)] hover:text-[var(--theme-accent-dark)] cursor-pointer"
            >
              Hubungi Kantor &amp; Operator Desa Margamukti
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
