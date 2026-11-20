import { adminFetch } from './adminApi';

export const MAX_VIDEO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadImageFile(file: File): Promise<string> {
  const result = await uploadMediaFile(file, 'image');
  return result.url;
}

export async function uploadMediaFile(
  file: File,
  expectedKind?: 'image' | 'video'
): Promise<{ url: string; mediaType: 'image' | 'video'; sizeBytes: number }> {
  const lowerName = file.name.toLowerCase();
  const isVideo =
    file.type.startsWith('video/') ||
    /\.(mp4|webm|ogg|mov)$/i.test(lowerName);
  const isImage =
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp)$/i.test(lowerName);

  if (expectedKind === 'image' && !isImage) {
    throw new Error('Format gambar harus PNG, JPG, atau WEBP.');
  }
  if (expectedKind === 'video' && !isVideo) {
    throw new Error('Format video harus MP4, WEBM, OGG, atau MOV.');
  }
  if (!isImage && !isVideo) {
    throw new Error('Format berkas tidak didukung. Gunakan gambar (PNG/JPG/WEBP) atau video (MP4/WEBM/MOV).');
  }

  if (isVideo && file.size > MAX_VIDEO_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`Ukuran video maksimal 10 MB. File Anda berukuran ${sizeMb} MB.`);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca berkas media.'));
    reader.readAsDataURL(file);
  });

  const endpoint = isVideo ? '/api/admin/upload-media' : '/api/admin/upload';
  const res = await adminFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, filename: file.name }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Gagal mengunggah media.');
  }
  return {
    url: json.url as string,
    mediaType: (json.mediaType as 'image' | 'video') || (isVideo ? 'video' : 'image'),
    sizeBytes: Number(json.sizeBytes || file.size),
  };
}
