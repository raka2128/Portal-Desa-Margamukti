import { db } from './db.ts';

export type WaRoleGroup = 'perangkat' | 'kepala_dusun' | 'ketua_rw' | 'ketua_rt';

export interface WaRecipientContact {
  key: string;
  roleGroup: WaRoleGroup;
  roleLabel: string;
  name: string;
  jabatan: string;
  wilayah: string;
  dusun: string;
  rw: string;
  rt: string;
  rawPhone: string;
  normalizedPhone: string;
  hasValidPhone: boolean;
  sourceType: 'officials' | 'regions';
  sourceId: number;
}

export interface WaGatewayStatus {
  configured: boolean;
  provider: string;
  providerLabel: string;
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

export function formatIndonesianTodayLabel(date = new Date()): string {
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const dayName = INDONESIAN_DAYS[wib.getUTCDay()];
  const day = wib.getUTCDate();
  const monthName = INDONESIAN_MONTHS[wib.getUTCMonth()];
  const year = wib.getUTCFullYear();
  return `${dayName}, ${day} ${monthName} ${year}`;
}

export function normalizeWaPhone(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  let normalized = digits;
  if (normalized.startsWith('0')) {
    normalized = `62${normalized.slice(1)}`;
  } else if (normalized.startsWith('8')) {
    normalized = `62${normalized}`;
  } else if (normalized.startsWith('620')) {
    normalized = `62${normalized.slice(3)}`;
  }
  if (normalized.length < 9 || normalized.length > 15) {
    return '';
  }
  return normalized;
}

export function cleanPhoneInput(raw: unknown): string {
  return String(raw || '')
    .trim()
    .replace(/[^\d+\-\s()]/g, '')
    .slice(0, 32);
}

export function renderWaMessageTemplate(
  template: string,
  recipient: {
    name: string;
    jabatan: string;
    wilayah: string;
    dusun?: string;
  },
  dateLabel = formatIndonesianTodayLabel()
): string {
  const safeName = recipient.name || '-';
  const safeJabatan = recipient.jabatan || '-';
  const safeWilayah = recipient.wilayah || 'Desa Margamukti';
  const safeDusun = recipient.dusun || 'Desa Margamukti';

  return template
    .replace(/\{\{\s*(nama_penerima|nama)\s*\}\}/gi, safeName)
    .replace(/\{\{\s*jabatan\s*\}\}/gi, safeJabatan)
    .replace(/\{\{\s*wilayah\s*\}\}/gi, safeWilayah)
    .replace(/\{\{\s*dusun\s*\}\}/gi, safeDusun)
    .replace(/\{\{\s*tanggal\s*\}\}/gi, dateLabel)
    .replace(/\{\s*(nama_penerima|nama)\s*\}/gi, safeName)
    .replace(/\{\s*jabatan\s*\}/gi, safeJabatan)
    .replace(/\{\s*wilayah\s*\}/gi, safeWilayah)
    .replace(/\{\s*dusun\s*\}/gi, safeDusun)
    .replace(/\{\s*tanggal\s*\}/gi, dateLabel);
}

export function collectWaRecipientsDirectory(scope?: {
  role?: string;
  scopeDusun?: string;
  scopeRw?: string;
  scopeRt?: string;
}): WaRecipientContact[] {
  const officials = db
    .prepare('SELECT id, name, position, phone, sort_order FROM officials ORDER BY sort_order ASC, id ASC')
    .all() as Array<{
    id: number;
    name: string;
    position: string;
    phone: string;
    sort_order: number;
  }>;

  const regions = db
    .prepare(
      `SELECT id, dusun, kepala_dusun, kepala_dusun_phone, blok, rw, rt, ketua_rw, ketua_rw_phone, ketua_rt, ketua_rt_phone
       FROM regions
       ORDER BY dusun ASC, rw ASC, rt ASC, id ASC`
    )
    .all() as Array<{
    id: number;
    dusun: string;
    kepala_dusun: string;
    kepala_dusun_phone: string;
    blok: string;
    rw: string;
    rt: string;
    ketua_rw: string;
    ketua_rw_phone: string;
    ketua_rt: string;
    ketua_rt_phone: string;
  }>;

  const isScoped = scope?.role === 'ketua_rw' || scope?.role === 'ketua_rt';
  const scopeDusun = String(scope?.scopeDusun || '').trim().toLowerCase();
  const scopeRw = String(scope?.scopeRw || '').trim();
  const scopeRt = String(scope?.scopeRt || '').trim();

  const filteredRegions = regions.filter((rg) => {
    if (!isScoped) return true;
    if (rg.dusun.trim().toLowerCase() !== scopeDusun || rg.rw.trim() !== scopeRw) return false;
    if (scope?.role === 'ketua_rt') {
      return rg.rt.trim() === scopeRt;
    }
    return true;
  });

  const officialPhoneByName = new Map<string, string>();
  for (const off of officials) {
    const cleanName = off.name.trim().toLowerCase();
    if (cleanName && off.phone.trim()) {
      officialPhoneByName.set(cleanName, off.phone.trim());
    }
  }

  const result: WaRecipientContact[] = [];

  // 1. Perangkat Desa (hanya tampil penuh untuk super_admin / sub_admin; untuk scope RW/RT tampilkan Kepala Dusun wilayahnya)
  if (!isScoped) {
    for (const off of officials) {
      const normalized = normalizeWaPhone(off.phone);
      const posLower = off.position.toLowerCase();
      let inferredDusun = 'Kantor Desa Margamukti';
      if (posLower.includes('pawenang')) inferredDusun = 'Dusun Pawenang';
      else if (posLower.includes('cikondang')) inferredDusun = 'Dusun Cikondang';

      result.push({
        key: `perangkat:${off.id}`,
        roleGroup: 'perangkat',
        roleLabel: 'Perangkat Desa',
        name: off.name.trim(),
        jabatan: off.position.trim(),
        wilayah: inferredDusun,
        dusun: inferredDusun.startsWith('Dusun ') ? inferredDusun : 'Kantor Desa',
        rw: '',
        rt: '',
        rawPhone: off.phone.trim(),
        normalizedPhone: normalized,
        hasValidPhone: Boolean(normalized),
        sourceType: 'officials',
        sourceId: off.id,
      });
    }
  }

  // 2. Kepala Dusun (unik per Dusun)
  const seenKadus = new Set<string>();
  for (const rg of filteredRegions) {
    const dusunName = rg.dusun.trim();
    const kadusName = rg.kepala_dusun.trim();
    if (!dusunName || !kadusName || kadusName === '-') continue;
    const dedupeKey = `${dusunName.toLowerCase()}|||${kadusName.toLowerCase()}`;
    if (seenKadus.has(dedupeKey)) continue;
    seenKadus.add(dedupeKey);

    const rawPhone =
      rg.kepala_dusun_phone.trim() || officialPhoneByName.get(kadusName.toLowerCase()) || '';
    const normalized = normalizeWaPhone(rawPhone);

    result.push({
      key: `kadus:${dusunName.toLowerCase()}`,
      roleGroup: 'kepala_dusun',
      roleLabel: 'Kepala Dusun',
      name: kadusName,
      jabatan: `Kepala ${dusunName}`,
      wilayah: dusunName,
      dusun: dusunName,
      rw: '',
      rt: '',
      rawPhone,
      normalizedPhone: normalized,
      hasValidPhone: Boolean(normalized),
      sourceType: 'regions',
      sourceId: rg.id,
    });
  }

  // 3. Ketua RW (unik per Dusun + RW agar tidak duplikat jika punya banyak RT)
  const seenRw = new Set<string>();
  for (const rg of filteredRegions) {
    const dusunName = rg.dusun.trim();
    const rwNum = rg.rw.trim();
    const rwName = rg.ketua_rw.trim();
    if (!dusunName || !rwNum || !rwName || rwName === '-') continue;
    const dedupeKey = `${dusunName.toLowerCase()}|||${rwNum}`;
    if (seenRw.has(dedupeKey)) continue;
    seenRw.add(dedupeKey);

    const rawPhone = rg.ketua_rw_phone.trim();
    const normalized = normalizeWaPhone(rawPhone);

    result.push({
      key: `rw:${dusunName.toLowerCase()}:${rwNum}`,
      roleGroup: 'ketua_rw',
      roleLabel: 'Ketua RW',
      name: rwName,
      jabatan: `Ketua RW ${rwNum}`,
      wilayah: `RW ${rwNum} · ${dusunName}`,
      dusun: dusunName,
      rw: rwNum,
      rt: '',
      rawPhone,
      normalizedPhone: normalized,
      hasValidPhone: Boolean(normalized),
      sourceType: 'regions',
      sourceId: rg.id,
    });
  }

  // 4. Ketua RT (per RT di setiap Dusun / Blok / RW)
  const seenRt = new Set<string>();
  for (const rg of filteredRegions) {
    const dusunName = rg.dusun.trim();
    const rwNum = rg.rw.trim();
    const rtNum = rg.rt.trim();
    const rtName = rg.ketua_rt.trim();
    if (!dusunName || !rwNum || !rtNum || !rtName || rtName === '-') continue;
    const dedupeKey = `${dusunName.toLowerCase()}|||${rwNum}|||${rtNum}`;
    if (seenRt.has(dedupeKey)) continue;
    seenRt.add(dedupeKey);

    const rawPhone = rg.ketua_rt_phone.trim();
    const normalized = normalizeWaPhone(rawPhone);

    result.push({
      key: `rt:${dusunName.toLowerCase()}:${rwNum}:${rtNum}`,
      roleGroup: 'ketua_rt',
      roleLabel: 'Ketua RT',
      name: rtName,
      jabatan: `Ketua RT ${rtNum} / RW ${rwNum}`,
      wilayah: `RT ${rtNum}/RW ${rwNum} · ${rg.blok.trim()} · ${dusunName}`,
      dusun: dusunName,
      rw: rwNum,
      rt: rtNum,
      rawPhone,
      normalizedPhone: normalized,
      hasValidPhone: Boolean(normalized),
      sourceType: 'regions',
      sourceId: rg.id,
    });
  }

  return result;
}

export function getWaGatewayStatus(): WaGatewayStatus {
  const provider = String(process.env.WA_GATEWAY_PROVIDER || 'fonnte').trim().toLowerCase();
  const token = String(process.env.WA_GATEWAY_TOKEN || '').trim();
  const rawUrl = String(process.env.WA_GATEWAY_URL || '').trim();
  const url = rawUrl || (provider === 'fonnte' && token ? 'https://api.fonnte.com/send' : '');

  const configured = Boolean(token && url);
  const providerLabelMap: Record<string, string> = {
    fonnte: 'Fonnte API',
    wablas: 'Wablas API',
    webhook: 'Custom Webhook Gateway',
  };

  return {
    configured,
    provider,
    providerLabel: providerLabelMap[provider] || 'Gateway WhatsApp Server',
  };
}

async function sendSingleGatewayMessage(
  phone: string,
  message: string
): Promise<{ ok: boolean; detail: string }> {
  const provider = String(process.env.WA_GATEWAY_PROVIDER || 'fonnte').trim().toLowerCase();
  const token = String(process.env.WA_GATEWAY_TOKEN || '').trim();
  const rawUrl = String(process.env.WA_GATEWAY_URL || '').trim();
  const url = rawUrl || (provider === 'fonnte' ? 'https://api.fonnte.com/send' : '');

  if (!token || !url) {
    return { ok: false, detail: 'Gateway WhatsApp server belum dikonfigurasi pada environment.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let bodyPayload: Record<string, unknown> = { phone, message };

    if (provider === 'fonnte') {
      headers = {
        'Content-Type': 'application/json',
        Authorization: token,
      };
      bodyPayload = {
        target: phone,
        message,
        countryCode: '62',
      };
    } else if (provider === 'wablas') {
      headers = {
        'Content-Type': 'application/json',
        Authorization: token,
      };
      bodyPayload = {
        phone,
        message,
      };
    } else {
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      bodyPayload = {
        phone,
        message,
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = null;
    }

    const providerFailed =
      !res.ok ||
      (parsed && parsed.status === false) ||
      (parsed && parsed.ok === false);

    if (providerFailed) {
      const reason =
        (parsed && typeof parsed.reason === 'string' && parsed.reason) ||
        (parsed && typeof parsed.message === 'string' && parsed.message) ||
        text.slice(0, 180) ||
        `HTTP ${res.status}`;
      return { ok: false, detail: reason };
    }

    return { ok: true, detail: `Terkirim (${res.status})` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal menghubungi server gateway WhatsApp.';
    return { ok: false, detail: msg };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runGatewayBlastSession(blastId: number): Promise<{
  sentCount: number;
  failedCount: number;
}> {
  const recipients = db
    .prepare(
      "SELECT id, phone, rendered_message FROM wa_blast_recipients WHERE blast_id = ? AND status = 'pending' ORDER BY id ASC"
    )
    .all(blastId) as Array<{ id: number; phone: string; rendered_message: string }>;

  let sentCount = 0;
  let failedCount = 0;

  const updateRecipient = db.prepare(
    `UPDATE wa_blast_recipients
     SET status = ?, gateway_response = ?, sent_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE NULL END
     WHERE id = ?`
  );

  for (let i = 0; i < recipients.length; i++) {
    const rec = recipients[i];
    const result = await sendSingleGatewayMessage(rec.phone, rec.rendered_message);
    if (result.ok) {
      sentCount++;
      updateRecipient.run('sent', result.detail, 'sent', rec.id);
    } else {
      failedCount++;
      updateRecipient.run('failed', result.detail, 'failed', rec.id);
    }

    if (i < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 450));
    }
  }

  recomputeBlastSummary(blastId);
  return { sentCount, failedCount };
}

export function recomputeBlastSummary(blastId: number): void {
  const counts = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count
       FROM wa_blast_recipients
       WHERE blast_id = ?`
    )
    .get(blastId) as {
    total: number;
    sent_count: number;
    failed_count: number;
    pending_count: number;
  };

  const nextStatus = counts.pending_count === 0 ? 'completed' : 'in_progress';
  db.prepare(
    'UPDATE wa_blasts SET total_recipients = ?, sent_count = ?, failed_count = ?, status = ? WHERE id = ?'
  ).run(
    counts.total || 0,
    counts.sent_count || 0,
    counts.failed_count || 0,
    nextStatus,
    blastId
  );
}
