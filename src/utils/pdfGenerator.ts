import { jsPDF } from 'jspdf';
import { SUMEDANG_CREST_URL } from '../components/SumedangCrest';
import { generateLetterQrDataUrl } from './letterVerification';
import type { VillageSettings } from '../types';

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
    img.onerror = () => {
      resolve(null);
    };
    img.src = src;
  });
}

export function formatIndonesianDate(dateInput?: string | null): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const d = dateInput ? new Date(dateInput) : new Date();
  const valid = Number.isNaN(d.getTime()) ? new Date() : d;
  return `${valid.getDate()} ${months[valid.getMonth()]} ${valid.getFullYear()}`;
}

export interface OfficialLetterPdfInput {
  settings: VillageSettings;
  letterTitle: string;
  letterNumber: string;
  trackingCode: string;
  bodyText: string;
  issuedDate?: string | null;
  signerName?: string;
  signerPosition?: string;
  signerNip?: string;
  signerTteCode?: string;
  useDigitalSignature?: boolean;
}

export async function generateOfficialLetterPdf(input: OfficialLetterPdfInput): Promise<void> {
  const {
    settings,
    letterTitle,
    letterNumber,
    trackingCode,
    bodyText,
    issuedDate,
    signerName,
    signerPosition,
    signerNip,
    signerTteCode,
    useDigitalSignature = false,
  } = input;

  const finalSignerName = (signerName || '').trim() || settings.head_name || 'H. Asep Kurniawan, S.Sos.';
  const finalSignerPosition = (signerPosition || '').trim() || `Kepala ${settings.village_name || 'Desa Margamukti'}`;
  const finalSignerNip = signerNip !== undefined ? signerNip : settings.head_nip || '';
  const isKades =
    finalSignerPosition.toLowerCase().includes('kepala desa') &&
    !finalSignerPosition.toLowerCase().includes('dusun');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 22;
  const contentWidth = pageWidth - marginX * 2;

  // 1. Logo Kabupaten Sumedang di Kiri Kop Surat
  const logoImg = await loadImageAsPngDataUrl(SUMEDANG_CREST_URL);
  if (logoImg) {
    const maxW = 22;
    const maxH = 24;
    const ratio = logoImg.width / logoImg.height;
    let drawW = maxW;
    let drawH = drawW / ratio;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * ratio;
    }
    const logoY = 13 + (maxH - drawH) / 2;
    doc.addImage(logoImg.dataUrl, 'PNG', marginX, logoY, drawW, drawH);
  }

  // 2. Teks Kop Surat Resmi (3 Baris + Alamat)
  const kopCenterX = pageWidth / 2 + 8;
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text((settings.kop_line1 || 'PEMERINTAH KABUPATEN SUMEDANG').toUpperCase(), kopCenterX, 18, { align: 'center' });

  doc.setFontSize(13);
  doc.text((settings.kop_line2 || 'KECAMATAN SUMEDANG UTARA').toUpperCase(), kopCenterX, 24, { align: 'center' });

  doc.setFontSize(15);
  doc.text((settings.kop_line3 || 'KEPALA DESA MARGAMUKTI').toUpperCase(), kopCenterX, 31, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.text(
    settings.kop_address || 'Jalan Raya Kebonkalapa No. 12, Desa Margamukti, Kec. Sumedang Utara, Kab. Sumedang 45321',
    kopCenterX,
    36.5,
    { align: 'center', maxWidth: contentWidth - 22 }
  );

  // Garis Kop Ganda (Tebal + Tipis)
  doc.setDrawColor(15, 39, 68);
  doc.setLineWidth(0.9);
  doc.line(marginX, 41, pageWidth - marginX, 41);
  doc.setLineWidth(0.3);
  doc.line(marginX, 42.3, pageWidth - marginX, 42.3);

  // 3. Judul & Nomor Surat
  let cursorY = 53;
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  const titleUpper = letterTitle.toUpperCase();
  doc.text(titleUpper, pageWidth / 2, cursorY, { align: 'center' });
  const titleWidth = doc.getTextWidth(titleUpper);
  doc.setLineWidth(0.4);
  doc.line(pageWidth / 2 - titleWidth / 2, cursorY + 1.2, pageWidth / 2 + titleWidth / 2, cursorY + 1.2);

  cursorY += 6.5;
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text(`Nomor: ${letterNumber || '-'}`, pageWidth / 2, cursorY, { align: 'center' });

  // 4. Isi Surat Dinamis
  cursorY += 11;
  doc.setFont('times', 'normal');
  doc.setFontSize(11);

  const paragraphs = bodyText.split('\n');
  for (const para of paragraphs) {
    if (!para.trim()) {
      cursorY += 4.5;
      continue;
    }
    if (para.includes(':') && para.indexOf(':') < 28) {
      const colonIdx = para.indexOf(':');
      const labelPart = para.slice(0, colonIdx).trim();
      const valuePart = para.slice(colonIdx + 1).trim();
      doc.text(labelPart, marginX + 6, cursorY);
      doc.text(':', marginX + 52, cursorY);
      const wrappedVal = doc.splitTextToSize(valuePart, contentWidth - 56);
      doc.text(wrappedVal, marginX + 56, cursorY);
      cursorY += wrappedVal.length * 5.4;
    } else {
      const wrapped = doc.splitTextToSize(para, contentWidth);
      doc.text(wrapped, marginX, cursorY, { align: 'left' });
      cursorY += wrapped.length * 5.6 + 1;
    }

    if (cursorY > 245) {
      doc.addPage();
      cursorY = 22;
    }
  }

  // 5. Blok Autentifikasi QR (Kiri Bawah) & Tanda Tangan Pejabat (Kanan Bawah)
  const signY = Math.max(cursorY + 10, 200);
  const signX = pageWidth - marginX - 72;

  const qrDataUrl = await generateLetterQrDataUrl(trackingCode, 260);
  if (qrDataUrl) {
    const qrBoxY = signY + 4;
    const qrSize = 23;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.rect(marginX, qrBoxY, qrSize, qrSize);
    doc.addImage(qrDataUrl, 'PNG', marginX + 1, qrBoxY + 1, qrSize - 2, qrSize - 2);

    const textX = marginX + qrSize + 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 39, 68);
    doc.text('AUTENTIFIKASI DOKUMEN RESMI', textX, qrBoxY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('Dikeluarkan sah oleh Pemerintah', textX, qrBoxY + 9.5);
    doc.text(`${settings.village_name || 'Desa Margamukti'}, Kab. Sumedang`, textX, qrBoxY + 13);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 39, 68);
    doc.text(`Kode: ${trackingCode}`, textX, qrBoxY + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Pindai QR untuk verifikasi keaslian', textX, qrBoxY + 22);
    doc.setTextColor(0, 0, 0);
  }

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text(`Margamukti, ${formatIndonesianDate(issuedDate)}`, signX, signY);
  let titleOffsetY = signY + 5.5;
  if (!isKades) {
    doc.text(`a.n. Kepala ${settings.village_name || 'Desa Margamukti'}`, signX, titleOffsetY);
    titleOffsetY += 5;
  }
  doc.text(`${finalSignerPosition},`, signX, titleOffsetY);

  let nameY = titleOffsetY + 24;
  if (useDigitalSignature && qrDataUrl) {
    const tteQrSize = 18;
    const tteQrY = titleOffsetY + 2.5;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.rect(signX, tteQrY, tteQrSize, tteQrSize);
    doc.addImage(qrDataUrl, 'PNG', signX + 0.8, tteQrY + 0.8, tteQrSize - 1.6, tteQrSize - 1.6);

    const tteTextX = signX + tteQrSize + 2.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 39, 68);
    doc.text('DITANDATANGANI ELEKTRONIK', tteTextX, tteQrY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(71, 85, 105);
    doc.text('Sah tanpa TTD & cap basah', tteTextX, tteQrY + 8.5);
    if (signerTteCode) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 39, 68);
      doc.text(signerTteCode, tteTextX, tteQrY + 13);
    }
    doc.setTextColor(0, 0, 0);
    nameY = tteQrY + tteQrSize + 5.5;
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text(finalSignerName, signX, nameY);
  const headWidth = doc.getTextWidth(finalSignerName);
  doc.setLineWidth(0.35);
  doc.line(signX, nameY + 1, signX + headWidth, nameY + 1);

  if (finalSignerNip && finalSignerNip !== '-') {
    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    doc.text(finalSignerNip, signX, nameY + 5.5);
  }

  // Footer Verifikasi Dokumen
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Dokumen Resmi Desa Margamukti · Kode Verifikasi: ${trackingCode}${signerTteCode ? ` · TTE: ${signerTteCode}` : ''}`,
    marginX,
    284
  );

  const safeFile = `${letterTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${trackingCode.toLowerCase()}.pdf`;
  doc.save(safeFile);
}
