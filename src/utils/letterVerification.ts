import QRCode from 'qrcode';

export function getLetterVerificationUrl(trackingCode: string): string {
  const cleanCode = trackingCode.trim();
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://margamukti.desa.id';
  return `${origin}/?verifikasi=${encodeURIComponent(cleanCode)}`;
}

export async function generateLetterQrDataUrl(trackingCode: string, width = 220): Promise<string> {
  if (!trackingCode.trim()) return '';
  try {
    const url = getLetterVerificationUrl(trackingCode);
    return await QRCode.toDataURL(url, {
      width,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0F2744',
        light: '#FFFFFF',
      },
    });
  } catch {
    return '';
  }
}
