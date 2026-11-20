import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { SUMEDANG_CREST_URL } from '../components/SumedangCrest';
import { sortFamilyMembers } from '../constants/residentOptions';
import { downloadBlobFile } from './mobileDownload';
import { formatIndonesianDate } from './pdfGenerator';
import type { Resident, ResidentAggregateReport, VillageSettings } from '../types';

async function loadImageAsPngDataUrl(
  src: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || 200;
      const h = img.naturalHeight || 200;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
      }
      resolve({ dataUrl: canvas.toDataURL('image/png'), width: w, height: h });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function computeResidentSummary(residents: Resident[]) {
  const total = residents.length;
  const male = residents.filter((r) => r.gender === 'Laki-laki').length;
  const female = residents.filter((r) => r.gender === 'Perempuan').length;
  const families = new Set(residents.map((r) => r.no_kk).filter(Boolean)).size;
  return { total, male, female, families };
}

const STATUS_LABEL_MAP: Record<string, string> = {
  aktif: 'Penduduk Aktif',
  lahir: 'Bayi Baru Lahir',
  pindah_masuk: 'Pindah Masuk ke Desa',
  pindah_keluar: 'Pindah ke Luar Desa',
  meninggal: 'Meninggal Dunia',
};

export function exportResidentsToExcel(residents: Resident[], fileSuffix: string): void {
  const rows = residents.map((r, idx) => ({
    No: idx + 1,
    NIK: String(r.nik || ''),
    'No. KK': String(r.no_kk || ''),
    'Nama Lengkap': r.full_name || '',
    'Hubungan Keluarga': r.family_relationship || 'Kepala keluarga',
    'Tempat Lahir': r.birth_place || '',
    'Tanggal Lahir': r.birth_date || '',
    'Jenis Kelamin': r.gender || '',
    Alamat: r.address || '',
    Dusun: r.dusun || '-',
    Blok: r.blok || '-',
    RW: r.rw || '-',
    RT: r.rt || '-',
    Agama: r.religion || '',
    'Pendidikan Terakhir': r.education || 'SLTA/Sederajat',
    Pekerjaan: r.occupation || '',
    'Status Perkawinan': r.marital_status || '',
    'Kelainan Fisik': r.physical_disability || 'Tidak Ada',
    'Nama Ayah': r.father_name || '-',
    'Nama Ibu': r.mother_name || '-',
    'Status Kependudukan': STATUS_LABEL_MAP[r.resident_status || 'aktif'] || 'Penduduk Aktif',
    'Tanggal Mutasi': r.mutation_date || '-',
    'Keterangan Mutasi': r.mutation_notes || '-',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      'No',
      'NIK',
      'No. KK',
      'Nama Lengkap',
      'Hubungan Keluarga',
      'Tempat Lahir',
      'Tanggal Lahir',
      'Jenis Kelamin',
      'Alamat',
      'Dusun',
      'Blok',
      'RW',
      'RT',
      'Agama',
      'Pendidikan Terakhir',
      'Pekerjaan',
      'Status Perkawinan',
      'Kelainan Fisik',
      'Nama Ayah',
      'Nama Ibu',
      'Status Kependudukan',
      'Tanggal Mutasi',
      'Keterangan Mutasi',
    ],
  });

  // Ensure NIK (col 1), No. KK (col 2), RW (col 11), RT (col 12) remain pure text strings
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:W1');
  for (let row = 1; row <= range.e.r; row++) {
    for (const col of [1, 2, 11, 12]) {
      const addr = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = ws[addr];
      if (cell) {
        cell.t = 's';
        cell.v = String(cell.v ?? '');
        cell.z = '@';
      }
    }
  }

  ws['!cols'] = [
    { wch: 5 },
    { wch: 20 },
    { wch: 20 },
    { wch: 24 },
    { wch: 18 },
    { wch: 15 },
    { wch: 13 },
    { wch: 13 },
    { wch: 36 },
    { wch: 18 },
    { wch: 18 },
    { wch: 6 },
    { wch: 6 },
    { wch: 12 },
    { wch: 24 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 14 },
    { wch: 28 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Data_Penduduk');
  XLSX.writeFile(wb, `data-penduduk-margamukti-${fileSuffix}.xlsx`);
}

export function exportResidentsToCsv(residents: Resident[], fileSuffix: string): void {
  const headers = [
    'No',
    'NIK',
    'No. KK',
    'Nama Lengkap',
    'Hubungan Keluarga',
    'Tempat Lahir',
    'Tanggal Lahir',
    'Jenis Kelamin',
    'Alamat',
    'Dusun',
    'Blok',
    'RW',
    'RT',
    'Agama',
    'Pendidikan Terakhir',
    'Pekerjaan',
    'Status Perkawinan',
    'Kelainan Fisik',
    'Nama Ayah',
    'Nama Ibu',
    'Status Kependudukan',
    'Tanggal Mutasi',
    'Keterangan Mutasi',
  ];

  const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const lines = [headers.map(escapeCsv).join(',')];
  residents.forEach((r, idx) => {
    lines.push(
      [
        idx + 1,
        r.nik || '',
        r.no_kk || '',
        r.full_name || '',
        r.family_relationship || 'Kepala keluarga',
        r.birth_place || '',
        r.birth_date || '',
        r.gender || '',
        r.address || '',
        r.dusun || '-',
        r.blok || '-',
        r.rw || '-',
        r.rt || '-',
        r.religion || '',
        r.education || 'SLTA/Sederajat',
        r.occupation || '',
        r.marital_status || '',
        r.physical_disability || 'Tidak Ada',
        r.father_name || '-',
        r.mother_name || '-',
        STATUS_LABEL_MAP[r.resident_status || 'aktif'] || 'Penduduk Aktif',
        r.mutation_date || '-',
        r.mutation_notes || '-',
      ]
        .map(escapeCsv)
        .join(',')
    );
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  void downloadBlobFile(blob, `data-penduduk-margamukti-${fileSuffix}.csv`);
}

async function drawOfficialKop(
  doc: jsPDF,
  settings: VillageSettings | null,
  pageWidth: number,
  marginX: number
): Promise<number> {
  const contentWidth = pageWidth - marginX * 2;
  const logoImg = await loadImageAsPngDataUrl(SUMEDANG_CREST_URL);
  if (logoImg) {
    const maxW = 18;
    const maxH = 20;
    const ratio = logoImg.width / logoImg.height;
    let drawW = maxW;
    let drawH = drawW / ratio;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * ratio;
    }
    const logoY = 10 + (maxH - drawH) / 2;
    doc.addImage(logoImg.dataUrl, 'PNG', marginX + 4, logoY, drawW, drawH);
  }

  const kopCenterX = pageWidth / 2 + 6;
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text((settings?.kop_line1 || 'PEMERINTAH KABUPATEN SUMEDANG').toUpperCase(), kopCenterX, 14, { align: 'center' });

  doc.setFontSize(12);
  doc.text((settings?.kop_line2 || 'KECAMATAN SUMEDANG UTARA').toUpperCase(), kopCenterX, 19.5, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(15, 39, 68);
  doc.text((settings?.kop_line3 || 'KEPALA DESA MARGAMUKTI').toUpperCase(), kopCenterX, 25.5, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    settings?.kop_address ||
      'Jalan Raya Kebonkalapa No. 12, Desa Margamukti, Kec. Sumedang Utara, Kab. Sumedang 45321',
    kopCenterX,
    30.5,
    { align: 'center', maxWidth: contentWidth - 36 }
  );

  doc.setDrawColor(15, 39, 68);
  doc.setLineWidth(0.8);
  doc.line(marginX, 34, pageWidth - marginX, 34);
  doc.setLineWidth(0.25);
  doc.line(marginX, 35.1, pageWidth - marginX, 35.1);

  return 41;
}

export async function generateResidentsReportPdf(
  residents: Resident[],
  settings: VillageSettings | null,
  options: { filterDescription: string; fileSuffix: string }
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2; // 273mm
  const summary = computeResidentSummary(residents);

  let cursorY = await drawOfficialKop(doc, settings, pageWidth, marginX);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 39, 68);
  doc.text('DAFTAR DATA KEPENDUDUKAN DESA MARGAMUKTI', pageWidth / 2, cursorY, { align: 'center' });

  cursorY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Cakupan: ${options.filterDescription}  ·  Dicetak: ${formatIndonesianDate()}`,
    pageWidth / 2,
    cursorY,
    { align: 'center' }
  );

  cursorY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 39, 68);
  doc.text(
    `Total: ${summary.total} Jiwa   ·   Laki-laki: ${summary.male} Jiwa   ·   Perempuan: ${summary.female} Jiwa   ·   Jumlah KK: ${summary.families}`,
    pageWidth / 2,
    cursorY,
    { align: 'center' }
  );

  cursorY += 5;

  const cols = [
    { header: 'No', width: 8, align: 'center' as const },
    { header: 'NIK / No. KK', width: 34, align: 'left' as const },
    { header: 'Nama & Hub. Kel', width: 38, align: 'left' as const },
    { header: 'L/P', width: 8, align: 'center' as const },
    { header: 'TTL & Status', width: 34, align: 'left' as const },
    { header: 'Pendidikan', width: 28, align: 'left' as const },
    { header: 'Pekerjaan & Agama', width: 32, align: 'left' as const },
    { header: 'Orang Tua (Ayah / Ibu)', width: 38, align: 'left' as const },
    { header: 'Fisik', width: 16, align: 'center' as const },
    { header: 'Wilayah (RT/RW)', width: 37, align: 'left' as const },
  ];

  const drawTableHeader = (y: number): number => {
    doc.setFillColor(15, 39, 68);
    doc.rect(marginX, y, contentWidth, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    let x = marginX;
    for (const col of cols) {
      if (col.align === 'center') {
        doc.text(col.header, x + col.width / 2, y + 5, { align: 'center' });
      } else {
        doc.text(col.header, x + 1.5, y + 5);
      }
      x += col.width;
    }
    return y + 7.5;
  };

  cursorY = drawTableHeader(cursorY);

  residents.forEach((r, idx) => {
    const wilayahText = r.dusun ? `${r.dusun} (RT ${r.rt || '-'} / RW ${r.rw || '-'})` : r.address || '-';
    const ttlText = `${r.birth_place || '-'}, ${r.birth_date || '-'}\n${r.marital_status || '-'}`;
    const nameText = `${r.full_name || '-'}\n(${r.family_relationship || 'Kepala keluarga'})`;
    const jobText = `${r.occupation || '-'}\n${r.religion || '-'}`;
    const parentText = `A: ${r.father_name || '-'}\nI: ${r.mother_name || '-'}`;
    const lpText = r.gender === 'Laki-laki' ? 'L' : 'P';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    const nameLines = doc.splitTextToSize(nameText, cols[2].width - 3) as string[];
    const ttlLines = doc.splitTextToSize(ttlText, cols[4].width - 3) as string[];
    const eduLines = doc.splitTextToSize(r.education || 'SLTA/Sederajat', cols[5].width - 3) as string[];
    const jobLines = doc.splitTextToSize(jobText, cols[6].width - 3) as string[];
    const parentLines = doc.splitTextToSize(parentText, cols[7].width - 3) as string[];
    const wilayahLines = doc.splitTextToSize(wilayahText, cols[9].width - 3) as string[];

    const maxLines = Math.max(
      2,
      nameLines.length,
      ttlLines.length,
      eduLines.length,
      jobLines.length,
      parentLines.length,
      wilayahLines.length
    );
    const rowHeight = Math.max(7.5, maxLines * 3.4 + 2.4);

    if (cursorY + rowHeight > pageHeight - 18) {
      doc.addPage();
      cursorY = drawTableHeader(14);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, cursorY, contentWidth, rowHeight, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, cursorY + rowHeight, marginX + contentWidth, cursorY + rowHeight);

    doc.setTextColor(15, 23, 42);
    let x = marginX;
    const textTop = cursorY + 4;

    doc.text(String(idx + 1), x + cols[0].width / 2, textTop, { align: 'center' });
    x += cols[0].width;

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.8);
    doc.text([String(r.nik || '-'), `KK:${r.no_kk || '-'}`], x + 1.5, textTop);
    x += cols[1].width;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(nameLines, x + 1.5, textTop);
    x += cols[2].width;

    doc.text(lpText, x + cols[3].width / 2, textTop, { align: 'center' });
    x += cols[3].width;

    doc.text(ttlLines, x + 1.5, textTop);
    x += cols[4].width;

    doc.text(eduLines, x + 1.5, textTop);
    x += cols[5].width;

    doc.text(jobLines, x + 1.5, textTop);
    x += cols[6].width;

    doc.text(parentLines, x + 1.5, textTop);
    x += cols[7].width;

    doc.text(r.physical_disability || 'Tidak Ada', x + cols[8].width / 2, textTop, { align: 'center' });
    x += cols[8].width;

    doc.text(wilayahLines, x + 1.5, textTop);

    cursorY += rowHeight;
  });

  if (cursorY + 38 > pageHeight - 14) {
    doc.addPage();
    cursorY = 18;
  }

  const signY = cursorY + 8;
  const signX = pageWidth - marginX - 66;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Margamukti, ${formatIndonesianDate()}`, signX, signY);
  doc.text('Mengetahui,', signX, signY + 5);
  doc.text('Kepala Desa Margamukti,', signX, signY + 10);

  doc.setFont('times', 'bold');
  const headName = settings?.head_name || 'H. Asep Kurniawan, S.Sos.';
  doc.text(headName, signX, signY + 28);
  const nameW = doc.getTextWidth(headName);
  doc.setLineWidth(0.3);
  doc.setDrawColor(15, 23, 42);
  doc.line(signX, signY + 29, signX + nameW, signY + 29);

  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.text(settings?.head_nip || '', signX, signY + 33.5);

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Arsip Kependudukan Pemerintah Desa Margamukti  ·  Halaman ${p} dari ${totalPages}`,
      marginX,
      pageHeight - 8
    );
  }

  doc.save(`daftar-penduduk-margamukti-${options.fileSuffix}.pdf`);
}

export async function generateKartuKeluargaPdf(
  noKk: string,
  members: Resident[],
  settings: VillageSettings | null
): Promise<void> {
  const sorted = sortFamilyMembers(members);
  const head =
    sorted.find((m) => (m.family_relationship || '').toLowerCase() === 'kepala keluarga') || sorted[0];

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2;

  let y = await drawOfficialKop(doc, settings, pageWidth, marginX);

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 39, 68);
  doc.text('SALINAN DATA KARTU KELUARGA (KK)', pageWidth / 2, y, { align: 'center' });
  y += 5.5;
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text(`No. ${noKk}`, pageWidth / 2, y, { align: 'center' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const leftMeta = [
    `Nama Kepala Keluarga : ${head?.full_name || '-'}`,
    `Alamat               : ${head?.address || '-'}`,
    `RT / RW              : ${head?.rt || '-'} / ${head?.rw || '-'}`,
    `Dusun / Wilayah      : ${head?.dusun || '-'}`,
  ];
  const rightMeta = [
    `Desa / Kelurahan     : ${settings?.village_name || 'Desa Margamukti'}`,
    `Kecamatan            : ${settings?.district_name || 'Kecamatan Sumedang Utara'}`,
    `Kabupaten / Kota     : ${settings?.regency_name || 'Kabupaten Sumedang'}`,
    `Provinsi / Kode Pos  : ${settings?.province_name || 'Jawa Barat'} (${settings?.postal_code || '45321'})`,
  ];
  leftMeta.forEach((line, i) => doc.text(line, marginX, y + i * 4.5));
  rightMeta.forEach((line, i) => doc.text(line, pageWidth / 2 + 8, y + i * 4.5));
  y += 21;

  // Table 1: Identitas Anggota Keluarga
  const t1Cols = [
    { header: 'No', width: 9 },
    { header: 'Nama Lengkap', width: 46 },
    { header: 'NIK', width: 36 },
    { header: 'Jenis Kelamin', width: 24 },
    { header: 'Tempat Lahir', width: 28 },
    { header: 'Tanggal Lahir', width: 24 },
    { header: 'Agama', width: 22 },
    { header: 'Pendidikan', width: 44 },
    { header: 'Jenis Pekerjaan', width: 40 },
  ];

  doc.setFillColor(15, 39, 68);
  doc.rect(marginX, y, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  let x = marginX;
  t1Cols.forEach((c) => {
    doc.text(c.header, x + 1.5, y + 4.5);
    x += c.width;
  });
  y += 6.5;

  sorted.forEach((m, idx) => {
    const rowH = 6.5;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, y, contentWidth, rowH, 'F');
    }
    doc.setDrawColor(203, 213, 225);
    doc.line(marginX, y + rowH, marginX + contentWidth, y + rowH);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    let cx = marginX;
    const vals = [
      String(idx + 1),
      m.full_name || '-',
      m.nik || '-',
      m.gender || '-',
      m.birth_place || '-',
      m.birth_date || '-',
      m.religion || '-',
      m.education || 'SLTA/Sederajat',
      m.occupation || '-',
    ];
    vals.forEach((v, ci) => {
      doc.text(String(v).slice(0, 32), cx + 1.5, y + 4.5);
      cx += t1Cols[ci].width;
    });
    y += rowH;
  });

  y += 5;

  // Table 2: Status Hubungan, Kelainan Fisik, Nama Orang Tua
  const t2Cols = [
    { header: 'No', width: 9 },
    { header: 'Status Perkawinan', width: 38 },
    { header: 'Status Hubungan Dalam Keluarga', width: 58 },
    { header: 'Kelainan Fisik', width: 32 },
    { header: 'Nama Ayah', width: 68 },
    { header: 'Nama Ibu', width: 68 },
  ];

  doc.setFillColor(15, 39, 68);
  doc.rect(marginX, y, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  x = marginX;
  t2Cols.forEach((c) => {
    doc.text(c.header, x + 1.5, y + 4.5);
    x += c.width;
  });
  y += 6.5;

  sorted.forEach((m, idx) => {
    const rowH = 6.5;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, y, contentWidth, rowH, 'F');
    }
    doc.setDrawColor(203, 213, 225);
    doc.line(marginX, y + rowH, marginX + contentWidth, y + rowH);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    let cx = marginX;
    const vals = [
      String(idx + 1),
      m.marital_status || '-',
      m.family_relationship || 'Kepala keluarga',
      m.physical_disability || 'Tidak Ada',
      m.father_name || '-',
      m.mother_name || '-',
    ];
    vals.forEach((v, ci) => {
      doc.text(String(v).slice(0, 42), cx + 1.5, y + 4.5);
      cx += t2Cols[ci].width;
    });
    y += rowH;
  });

  if (y + 34 > pageHeight - 10) {
    doc.addPage();
    y = 18;
  } else {
    y += 7;
  }

  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Kepala Keluarga,', marginX + 12, y + 5);
  doc.setFont('times', 'bold');
  doc.text(head?.full_name || '-', marginX + 12, y + 23);

  const rightSignX = pageWidth - marginX - 68;
  doc.setFont('times', 'normal');
  doc.text(`Margamukti, ${formatIndonesianDate()}`, rightSignX, y);
  doc.text('Kepala Desa Margamukti,', rightSignX, y + 5);
  doc.setFont('times', 'bold');
  doc.text(settings?.head_name || 'H. Asep Kurniawan, S.Sos.', rightSignX, y + 23);
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.text(settings?.head_nip || '', rightSignX, y + 27.5);

  doc.save(`kartu-keluarga-${noKk}.pdf`);
}

export async function generateDeathCertificatePdf(
  resident: Resident,
  settings: VillageSettings | null
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 18;

  let y = await drawOfficialKop(doc, settings, pageWidth, marginX);
  y += 4;

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 39, 68);
  doc.text('FORM SURAT KETERANGAN MENINGGAL DUNIA', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Nomor: 474.3 / ${String(resident.id).padStart(3, '0')}-Pemdes / ${new Date().getFullYear()}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 9;

  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  const intro =
    'Yang bertanda tangan di bawah ini Kepala Desa Margamukti, Kecamatan Sumedang Utara, Kabupaten Sumedang, menerangkan dengan sebenarnya bahwa:';
  const introLines = doc.splitTextToSize(intro, pageWidth - marginX * 2) as string[];
  doc.text(introLines, marginX, y);
  y += introLines.length * 5.2 + 4;

  const drawKv = (label: string, val: string) => {
    doc.setFont('times', 'normal');
    doc.text(label, marginX + 4, y);
    doc.text(':', marginX + 54, y);
    doc.setFont('times', 'bold');
    const lines = doc.splitTextToSize(val || '-', pageWidth - marginX * 2 - 58) as string[];
    doc.text(lines, marginX + 58, y);
    y += Math.max(1, lines.length) * 5.2 + 0.8;
  };

  drawKv('Nama Lengkap', resident.full_name);
  drawKv('NIK', resident.nik);
  drawKv('No. Kartu Keluarga', resident.no_kk);
  drawKv('Jenis Kelamin', resident.gender);
  drawKv('Tempat / Tanggal Lahir', `${resident.birth_place}, ${formatIndonesianDate(resident.birth_date)}`);
  drawKv('Agama', resident.religion);
  drawKv('Pekerjaan', resident.occupation);
  drawKv('Nama Ayah / Ibu', `${resident.father_name || '-'} / ${resident.mother_name || '-'}`);
  drawKv(
    'Alamat Terakhir',
    resident.dusun
      ? `${resident.address} (${resident.dusun}, RT ${resident.rt || '-'} / RW ${resident.rw || '-'})`
      : resident.address
  );

  y += 4;
  doc.setFont('times', 'normal');
  doc.text('Telah meninggal dunia pada:', marginX, y);
  y += 6;

  drawKv('Hari / Tanggal', `${resident.death_day || '-'}, ${formatIndonesianDate(resident.mutation_date)}`);
  drawKv('Jam Meninggal', resident.death_time ? `${resident.death_time} WIB` : '-');
  drawKv('Sebab Meninggal', resident.death_cause || '-');
  drawKv('Lokasi Meninggal', resident.death_location || '-');

  y += 4;
  doc.setFont('times', 'normal');
  doc.text('Berdasarkan laporan resmi dari:', marginX, y);
  y += 6;

  drawKv('Nama Pelapor', resident.death_reporter_name || '-');
  drawKv('NIK Pelapor', resident.death_reporter_nik || '-');

  y += 5;
  doc.setFont('times', 'normal');
  const closing =
    'Demikian Surat Keterangan Meninggal Dunia ini dibuat dengan sebenarnya agar dapat dipergunakan untuk pengurusan administrasi kependudukan, pencatatan sipil (Akta Kematian), maupun keperluan keluarga lainnya.';
  const closingLines = doc.splitTextToSize(closing, pageWidth - marginX * 2) as string[];
  doc.text(closingLines, marginX, y);
  y += closingLines.length * 5.2 + 12;

  const signX = pageWidth - marginX - 64;
  doc.text(`Margamukti, ${formatIndonesianDate()}`, signX, y);
  doc.text('Kepala Desa Margamukti,', signX, y + 5.5);
  doc.setFont('times', 'bold');
  doc.text(settings?.head_name || 'H. Asep Kurniawan, S.Sos.', signX, y + 26);
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.text(settings?.head_nip || '', signX, y + 31);

  doc.save(`form-keterangan-meninggal-${resident.nik}.pdf`);
}

export function exportAggregateReportToExcel(report: ResidentAggregateReport): void {
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    { Indikator: 'Periode Laporan', Nilai: report.periodLabel },
    { Indikator: 'Tanggal Batas Rekap', Nilai: report.cutoffDate },
    { Indikator: 'Total Jumlah Penduduk Aktif', Nilai: report.totals.totalResidents },
    { Indikator: 'Penduduk Laki-laki', Nilai: report.totals.maleCount },
    { Indikator: 'Penduduk Perempuan', Nilai: report.totals.femaleCount },
    { Indikator: 'Total Kartu Keluarga (KK)', Nilai: report.totals.totalFamilies },
    { Indikator: 'Mutasi Periode - Kelahiran', Nilai: report.periodMutations.lahir },
    { Indikator: 'Mutasi Periode - Pindah Masuk', Nilai: report.periodMutations.pindah_masuk },
    { Indikator: 'Mutasi Periode - Pindah Keluar', Nilai: report.periodMutations.pindah_keluar },
    { Indikator: 'Mutasi Periode - Meninggal Dunia', Nilai: report.periodMutations.meninggal },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan');

  const toSheet = (rows: Array<{ label: string; male: number; female: number; total: number }>) =>
    XLSX.utils.json_to_sheet(
      rows.map((r, i) => ({
        No: i + 1,
        Kategori: r.label,
        'Laki-laki': r.male,
        Perempuan: r.female,
        Total: r.total,
      }))
    );

  XLSX.utils.book_append_sheet(wb, toSheet(report.byGender), 'Jenis_Kelamin');
  XLSX.utils.book_append_sheet(wb, toSheet(report.byAgeGroup), 'Kelompok_Usia');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      report.pyramid.map((p) => ({
        'Kelompok Umur': p.bracket,
        'Laki-laki': p.male,
        Perempuan: p.female,
        Total: p.total,
      }))
    ),
    'Piramida_Penduduk'
  );
  XLSX.utils.book_append_sheet(wb, toSheet(report.byOccupation), 'Pekerjaan');
  XLSX.utils.book_append_sheet(wb, toSheet(report.byReligion), 'Agama');
  XLSX.utils.book_append_sheet(wb, toSheet(report.byEducation), 'Pendidikan');
  XLSX.utils.book_append_sheet(wb, toSheet(report.byMaritalStatus), 'Status_Kawin');

  const suffix = report.periodType === 'monthly' ? `${report.year}-${String(report.month).padStart(2, '0')}` : `${report.year}`;
  XLSX.writeFile(wb, `laporan-agregat-penduduk-${suffix}.xlsx`);
}
