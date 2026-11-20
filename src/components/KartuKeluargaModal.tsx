import { useState } from 'react';
import { FileText, Printer, Users, X } from 'lucide-react';
import { SumedangCrest } from './SumedangCrest';
import { sortFamilyMembers } from '../constants/residentOptions';
import { formatIndonesianDate } from '../utils/pdfGenerator';
import { generateKartuKeluargaPdf } from '../utils/residentExport';
import type { Resident, VillageSettings } from '../types';

interface KartuKeluargaModalProps {
  open: boolean;
  noKk: string;
  members: Resident[];
  settings: VillageSettings | null;
  onClose: () => void;
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

export function KartuKeluargaModal({
  open,
  noKk,
  members,
  settings,
  onClose,
  onNotify,
}: KartuKeluargaModalProps) {
  const [pdfLoading, setPdfLoading] = useState(false);

  if (!open || !noKk) return null;

  const sortedMembers = sortFamilyMembers(members);
  const head =
    sortedMembers.find((m) => (m.family_relationship || '').toLowerCase() === 'kepala keluarga') ||
    sortedMembers[0];

  const handleDownloadPdf = async () => {
    if (sortedMembers.length === 0) return;
    setPdfLoading(true);
    try {
      await generateKartuKeluargaPdf(noKk, sortedMembers, settings);
      onNotify(`PDF Kartu Keluarga No. ${noKk} berhasil diunduh.`);
    } catch {
      onNotify('Gagal membuat file PDF Kartu Keluarga.', 'err');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="print-modal-root fixed inset-0 z-50 bg-slate-950/70 flex items-start justify-center p-4 overflow-y-auto">
      <div className="print-modal-card bg-white rounded-xl max-w-6xl w-full my-4 overflow-hidden border border-slate-200 shadow-2xl">
        {/* Top Modal Controls */}
        <div className="no-print bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0F2744] text-white flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-[#E5C158]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#0F2744]">
                Format Kartu Keluarga (KK) · No. <span className="font-mono-tabular">{noKk}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {sortedMembers.length} anggota keluarga terdata · Kepala Keluarga: {head?.full_name || '-'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pdfLoading}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F2744] bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <FileText className="w-3.5 h-3.5" />
              {pdfLoading ? 'Menyusun PDF...' : 'Unduh PDF (A4)'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak Kartu Keluarga
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md cursor-pointer"
              aria-label="Tutup pratinjau Kartu Keluarga"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Kartu Keluarga Sheet */}
        <div className="p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0">
          <div className="print-only-sheet print-landscape-sheet bg-white border border-slate-300 shadow-sm p-6 sm:p-8 space-y-5 text-slate-900">
            {/* Kop & Judul KK */}
            <div className="relative flex items-center justify-center pb-3 border-b-4 border-double border-[#0F2744]">
              <div className="hidden sm:block sm:absolute sm:left-2">
                <SumedangCrest className="w-16 h-18" />
              </div>
              <div className="text-center font-serif leading-tight px-4 sm:px-20">
                <p className="text-xs font-semibold tracking-wider uppercase text-slate-600">
                  {settings?.kop_line1 || 'PEMERINTAH KABUPATEN SUMEDANG'} ·{' '}
                  {settings?.kop_line2 || 'KECAMATAN SUMEDANG UTARA'} ·{' '}
                  {settings?.village_name || 'DESA MARGAMUKTI'}
                </p>
                <h2 className="text-xl sm:text-2xl font-bold tracking-widest uppercase text-[#0F2744] mt-1">
                  KARTU KELUARGA
                </h2>
                <p className="text-sm font-mono-tabular font-bold text-slate-800 mt-0.5">
                  No. {noKk}
                </p>
              </div>
            </div>

            {/* Identitas Kepala Keluarga & Wilayah */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <div className="grid grid-cols-12">
                  <span className="col-span-5 text-slate-600">Nama Kepala Keluarga</span>
                  <span className="col-span-7 font-bold text-[#0F2744]">: {head?.full_name || '-'}</span>
                </div>
                <div className="grid grid-cols-12">
                  <span className="col-span-5 text-slate-600">Alamat</span>
                  <span className="col-span-7">: {head?.address || '-'}</span>
                </div>
                <div className="grid grid-cols-12">
                  <span className="col-span-5 text-slate-600">RT / RW</span>
                  <span className="col-span-7 font-mono-tabular">
                    : {head?.rt || '-'} / {head?.rw || '-'}
                  </span>
                </div>
                <div className="grid grid-cols-12">
                  <span className="col-span-5 text-slate-600">Dusun / Wilayah</span>
                  <span className="col-span-7">: {head?.dusun || '-'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="grid grid-cols-12">
                  <span className="col-span-5 text-slate-600">Desa / Kelurahan</span>
                  <span className="col-span-7 font-semibold">
                    : {settings?.village_name || 'Desa Margamukti'}
                  </span>
                </div>
                <div className="grid grid-cols-12">
                  <span className="col-span-5 text-slate-600">Kecamatan</span>
                  <span className="col-span-7">
                    : {settings?.district_name || 'Kecamatan Sumedang Utara'}
                  </span>
                </div>
                <div className="grid grid-cols-12">
                  <span className="col-span-5 text-slate-600">Kabupaten / Kota</span>
                  <span className="col-span-7">
                    : {settings?.regency_name || 'Kabupaten Sumedang'}
                  </span>
                </div>
                <div className="grid grid-cols-12">
                  <span className="col-span-5 text-slate-600">Provinsi / Kode Pos</span>
                  <span className="col-span-7 font-mono-tabular">
                    : {settings?.province_name || 'Jawa Barat'} ({settings?.postal_code || '45321'})
                  </span>
                </div>
              </div>
            </div>

            {/* Tabel 1: Biodata Utama Anggota Keluarga */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left border-collapse border border-slate-400 text-[11px]">
                <thead>
                  <tr className="bg-[#0F2744] text-white">
                    <th className="py-1.5 px-2 border border-slate-400 text-center w-8">No</th>
                    <th className="py-1.5 px-2 border border-slate-400">Nama Lengkap</th>
                    <th className="py-1.5 px-2 border border-slate-400">NIK</th>
                    <th className="py-1.5 px-2 border border-slate-400">Jenis Kelamin</th>
                    <th className="py-1.5 px-2 border border-slate-400">Tempat Lahir</th>
                    <th className="py-1.5 px-2 border border-slate-400">Tanggal Lahir</th>
                    <th className="py-1.5 px-2 border border-slate-400">Agama</th>
                    <th className="py-1.5 px-2 border border-slate-400">Pendidikan</th>
                    <th className="py-1.5 px-2 border border-slate-400">Jenis Pekerjaan</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((m, idx) => (
                    <tr key={m.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">{idx + 1}</td>
                      <td className="py-1.5 px-2 border border-slate-300 font-semibold text-slate-900">
                        {m.full_name}
                        {m.resident_status === 'meninggal' && (
                          <span className="text-[10px] font-normal text-slate-500"> (Alm.)</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 border border-slate-300 font-mono-tabular whitespace-nowrap">
                        {m.nik}
                      </td>
                      <td className="py-1.5 px-2 border border-slate-300">{m.gender}</td>
                      <td className="py-1.5 px-2 border border-slate-300">{m.birth_place}</td>
                      <td className="py-1.5 px-2 border border-slate-300 font-mono-tabular whitespace-nowrap">
                        {m.birth_date}
                      </td>
                      <td className="py-1.5 px-2 border border-slate-300">{m.religion}</td>
                      <td className="py-1.5 px-2 border border-slate-300">{m.education || 'SLTA/Sederajat'}</td>
                      <td className="py-1.5 px-2 border border-slate-300">{m.occupation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tabel 2: Status Kawin, Hubungan Keluarga, Kelainan Fisik, Nama Orang Tua */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left border-collapse border border-slate-400 text-[11px]">
                <thead>
                  <tr className="bg-[#0F2744] text-white">
                    <th className="py-1.5 px-2 border border-slate-400 text-center w-8">No</th>
                    <th className="py-1.5 px-2 border border-slate-400">Status Perkawinan</th>
                    <th className="py-1.5 px-2 border border-slate-400">Status Hubungan Dalam Keluarga</th>
                    <th className="py-1.5 px-2 border border-slate-400 text-center">Kelainan Fisik</th>
                    <th className="py-1.5 px-2 border border-slate-400">Nama Ayah</th>
                    <th className="py-1.5 px-2 border border-slate-400">Nama Ibu</th>
                    <th className="py-1.5 px-2 border border-slate-400">Status Data</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((m, idx) => (
                    <tr key={m.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">{idx + 1}</td>
                      <td className="py-1.5 px-2 border border-slate-300">{m.marital_status}</td>
                      <td className="py-1.5 px-2 border border-slate-300 font-semibold text-[#0F2744]">
                        {m.family_relationship || 'Kepala keluarga'}
                      </td>
                      <td className="py-1.5 px-2 border border-slate-300 text-center">
                        {m.physical_disability || 'Tidak Ada'}
                      </td>
                      <td className="py-1.5 px-2 border border-slate-300">{m.father_name || '-'}</td>
                      <td className="py-1.5 px-2 border border-slate-300">{m.mother_name || '-'}</td>
                      <td className="py-1.5 px-2 border border-slate-300 text-slate-600">
                        {m.resident_status === 'meninggal'
                          ? 'Meninggal Dunia'
                          : m.resident_status === 'pindah_keluar'
                          ? 'Pindah Keluar'
                          : 'Aktif'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tanda Tangan Kepala Keluarga & Kepala Desa */}
            <div className="grid grid-cols-2 gap-8 pt-4 font-serif text-xs text-slate-900">
              <div className="pl-4 space-y-1">
                <p>Mengetahui,</p>
                <p>Kepala Keluarga,</p>
                <div className="h-14" />
                <p className="font-bold underline">{head?.full_name || '-'}</p>
              </div>
              <div className="flex justify-end pr-4">
                <div className="w-64 space-y-1">
                  <p>Margamukti, {formatIndonesianDate()}</p>
                  <p>Kepala Desa Margamukti,</p>
                  <div className="h-14" />
                  <p className="font-bold underline">{settings?.head_name || 'H. Asep Kurniawan, S.Sos.'}</p>
                  <p className="text-[11px] font-mono-tabular text-slate-700">{settings?.head_nip || ''}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
