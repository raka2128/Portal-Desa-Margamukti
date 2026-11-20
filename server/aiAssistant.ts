import { GoogleGenAI, type Content } from '@google/genai';
import { db } from './db.ts';

export interface AiKnowledgeRow {
  id: number;
  category: 'DTSEN' | 'Bansos' | 'Adminduk' | 'Pemerintahan Daerah' | 'Pemerintahan Desa';
  title: string;
  keywords: string;
  summary: string;
  content: string;
  official_source: string;
  related_route: string;
  related_subtab: string;
  related_label: string;
  is_active: number;
  sort_order: number;
  updated_by: string;
  updated_at: string;
}

export interface AiChatSourceLink {
  title: string;
  uri: string;
}

export interface AiChatActionLink {
  label: string;
  route: string;
  subTab?: string;
}

export interface AiChatQuickTopic {
  id: string;
  category: AiKnowledgeRow['category'];
  title: string;
  description: string;
  prompts: string[];
  action?: AiChatActionLink;
}

export class AiServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'AI_SERVICE_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getGeminiApiKey(): string {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') {
    throw new AiServiceError(
      'Layanan Asisten AI belum aktif karena kunci GEMINI_API_KEY belum dikonfigurasi pada pengaturan Secrets server.',
      503,
      'API_KEY_MISSING'
    );
  }
  return key;
}

function createAiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: getGeminiApiKey(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function tokenizeQuery(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function scoreEntryRelevance(entry: AiKnowledgeRow, queryTokens: string[], fullQueryLower: string): number {
  let score = 0;
  const hayTitle = entry.title.toLowerCase();
  const hayKeywords = entry.keywords.toLowerCase();
  const hayCategory = entry.category.toLowerCase();
  const haySummary = entry.summary.toLowerCase();
  const hayContent = entry.content.toLowerCase();

  if (fullQueryLower.includes(hayCategory)) score += 6;
  for (const tok of queryTokens) {
    if (hayKeywords.includes(tok)) score += 5;
    if (hayTitle.includes(tok)) score += 4;
    if (haySummary.includes(tok)) score += 2;
    if (hayContent.includes(tok)) score += 1;
  }
  return score;
}

function buildPortalFactsContext(): string {
  const settings = db.prepare('SELECT * FROM village_settings WHERE id = 1').get() as
    | {
        village_name: string;
        district_name: string;
        regency_name: string;
        province_name: string;
        postal_code: string;
        office_address: string;
        phone: string;
        whatsapp: string;
        email: string;
        service_hours: string;
        head_name: string;
      }
    | undefined;

  const officials = db
    .prepare('SELECT name, position, can_sign_letters, tte_status FROM officials ORDER BY sort_order ASC, id ASC')
    .all() as Array<{ name: string; position: string; can_sign_letters: number; tte_status: string }>;

  const templates = db
    .prepare('SELECT code, name, classification_code FROM letter_templates WHERE is_active = 1 ORDER BY id ASC')
    .all() as Array<{ code: string; name: string; classification_code: string }>;

  const institutions = db
    .prepare('SELECT slug, name, contact_phone, office_location FROM village_institutions WHERE is_active = 1 ORDER BY id ASC')
    .all() as Array<{ slug: string; name: string; contact_phone: string; office_location: string }>;

  const dusunRows = db
    .prepare('SELECT DISTINCT dusun, kepala_dusun FROM regions ORDER BY dusun ASC')
    .all() as Array<{ dusun: string; kepala_dusun: string }>;

  const desaInfo = settings
    ? `Nama Desa: ${settings.village_name}, Kecamatan ${settings.district_name}, Kabupaten ${settings.regency_name}, Provinsi ${settings.province_name} ${settings.postal_code}.
Alamat Kantor: ${settings.office_address}
Jam Pelayanan: ${settings.service_hours}
Telepon: ${settings.phone} | WhatsApp Center: ${settings.whatsapp} | Email: ${settings.email}
Kepala Desa: ${settings.head_name}`
    : 'Pemerintah Desa Margamukti, Kec. Sumedang Utara, Kab. Sumedang, Jawa Barat.';

  const templateList = templates
    .map((t) => `- [${t.code}/${t.classification_code}] ${t.name}`)
    .join('\n');

  const officialList = officials
    .map((o) => `- ${o.position}: ${o.name}${o.can_sign_letters ? ' (Penanda tangan surat resmi)' : ''}`)
    .join('\n');

  const institutionList = institutions
    .map((i) => `- ${i.name} (Lokasi: ${i.office_location}${i.contact_phone ? `, Kontak: ${i.contact_phone}` : ''})`)
    .join('\n');

  const dusunList = dusunRows
    .map((d) => `- ${d.dusun} (Kepala Dusun: ${d.kepala_dusun})`)
    .join('\n');

  return `=== DATA RESMI PORTAL DESA MARGAMUKTI ===
${desaInfo}

Wilayah Dusun di Desa Margamukti:
${dusunList || '- Dusun Pawenang & Dusun Cikondang'}

Perangkat Desa Aktif:
${officialList}

Lembaga Desa Aktif:
${institutionList}

Jenis Layanan Surat Mandiri Online di Portal Desa:
${templateList}`;
}

function buildKnowledgeContext(queryText: string): {
  contextText: string;
  matchedEntries: AiKnowledgeRow[];
} {
  const allActive = db
    .prepare('SELECT * FROM ai_knowledge_entries WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
    .all() as AiKnowledgeRow[];

  const queryTokens = tokenizeQuery(queryText);
  const fullLower = queryText.toLowerCase();

  const scored = allActive
    .map((entry) => ({
      entry,
      score: scoreEntryRelevance(entry, queryTokens, fullLower),
    }))
    .sort((a, b) => b.score - a.score || a.entry.sort_order - b.entry.sort_order);

  const matched = scored.filter((item) => item.score > 0).map((item) => item.entry);
  const detailEntries = (matched.length > 0 ? matched : scored.map((s) => s.entry)).slice(0, 6);
  const detailIds = new Set(detailEntries.map((e) => e.id));
  const summaryEntries = allActive.filter((e) => !detailIds.has(e.id));

  const detailText = detailEntries
    .map(
      (e) =>
        `[${e.category}] ${e.title}\nSumber Acuan: ${e.official_source || '-'}\n${e.content}`
    )
    .join('\n\n---\n\n');

  const summaryText =
    summaryEntries.length > 0
      ? `\n\n=== RINGKASAN PANDUAN TERKURASI LAINNYA ===\n${summaryEntries
          .map((e) => `- [${e.category}] ${e.title}: ${e.summary}`)
          .join('\n')}`
      : '';

  return {
    contextText: `${detailText}${summaryText}`,
    matchedEntries: matched.length > 0 ? matched : detailEntries.slice(0, 2),
  };
}

function computeSuggestedLinks(queryText: string, matchedEntries: AiKnowledgeRow[]): AiChatActionLink[] {
  const seen = new Set<string>();
  const links: AiChatActionLink[] = [];

  const pushLink = (item: AiChatActionLink) => {
    if (!item.route || !item.label) return;
    const key = `${item.route}:${item.subTab || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push(item);
  };

  for (const entry of matchedEntries) {
    if (entry.related_route && entry.related_label) {
      pushLink({
        label: entry.related_label,
        route: entry.related_route,
        subTab: entry.related_subtab || undefined,
      });
    }
    if (links.length >= 3) break;
  }

  const q = queryText.toLowerCase();
  if (/(dtsen|dtks|desil|bansos|pkh|bpnt|pbi|perlinsos|cek bansos)/i.test(q)) {
    pushLink({ label: 'Buka Cek Bansos & Panduan DTSEN', route: 'bansos' });
  }
  if (/(ktp|kk|kia|nikah|na\b|n1|sktm|domisili|surat|kehilangan|belum menikah|janda|duda)/i.test(q)) {
    pushLink({ label: 'Ajukan Surat Mandiri di Portal', route: 'surat', subTab: 'form' });
  }
  if (/(bpd|bumdes|lpm|pkk|lembaga)/i.test(q)) {
    pushLink({ label: 'Lihat Profil Lembaga Desa', route: 'lembaga', subTab: 'bpd' });
  }
  if (/(sumedang|pemda|dinas|kantor|lokasi|pengaduan|lapor|kontak)/i.test(q)) {
    pushLink({ label: 'Peta Fasilitas & Kontak Pengaduan', route: 'peta-kontak' });
  }

  return links.slice(0, 3);
}

export function getPublicAiTopics(): {
  quickTopics: AiChatQuickTopic[];
  entriesCount: number;
} {
  const countRow = db
    .prepare('SELECT COUNT(*) as total FROM ai_knowledge_entries WHERE is_active = 1')
    .get() as { total: number };

  const quickTopics: AiChatQuickTopic[] = [
    {
      id: 'dtsen',
      category: 'DTSEN',
      title: 'DTSEN & Kepesertaan',
      description: 'Pengganti DTKS, pembagian Desil 1–10, syarat & cara usul sanggah.',
      prompts: [
        'Apa itu DTSEN dan bagaimana pembagian Desil 1 sampai 10?',
        'Bagaimana cara mendaftar atau memperbarui data DTSEN lewat Perlinsos Digital dan desa?',
      ],
      action: { label: 'Cek Bansos & DTSEN', route: 'bansos' },
    },
    {
      id: 'bansos',
      category: 'Bansos',
      title: 'Syarat Bansos & KIP',
      description: 'PKH, BPNT Sembako, PBI-JK BPJS Gratis, KIP Sekolah (PIP), KIP Kuliah & BLT Desa.',
      prompts: [
        'Apa saja syarat penerima bansos PKH, BPNT, dan PBI-JK BPJS gratis?',
        'Bagaimana syarat dan cara mengurus KIP Sekolah (PIP) serta KIP Kuliah?',
      ],
      action: { label: 'Ajukan SKTM Online', route: 'surat', subTab: 'form' },
    },
    {
      id: 'adminduk',
      category: 'Adminduk',
      title: 'Layanan Adminduk',
      description: 'Syarat KTP-el, Kartu Keluarga (KK), Surat Nikah (NA/N1-N4), KIA & Akta.',
      prompts: [
        'Apa syarat mengurus Surat Pengantar Nikah (NA / N1-N4) dari desa sampai KUA?',
        'Apa saja syarat pembuatan KTP-el baru, Kartu Keluarga (KK), dan KIA anak?',
      ],
      action: { label: 'Ajukan Surat Pengantar', route: 'surat', subTab: 'form' },
    },
    {
      id: 'pemda',
      category: 'Pemerintahan Daerah',
      title: 'Pemdes & Pemda Sumedang',
      description: 'Layanan Pemkab Sumedang, Kecamatan Sumedang Utara, MPP, dan Lembaga Desa.',
      prompts: [
        'Layanan administrasi apa saja yang diurus di Desa, Kecamatan Sumedang Utara, dan Disdukcapil Sumedang?',
        'Apa tugas BPD, BUMDesa, LPM, dan PKK serta layanan surat apa saja yang bisa diajukan online di Desa Margamukti?',
      ],
      action: { label: 'Profil & Wilayah Desa', route: 'profil' },
    },
  ];

  return {
    quickTopics,
    entriesCount: countRow?.total || 0,
  };
}

function isRetryableGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /\b(429|503|502|504|RESOURCE_EXHAUSTED|UNAVAILABLE|ECONNRESET|ETIMEDOUT)\b/i.test(msg);
}

function mapGeminiError(err: unknown): AiServiceError {
  if (err instanceof AiServiceError) return err;
  const rawMsg = err instanceof Error ? err.message : String(err || 'Terjadi kesalahan tidak dikenal.');
  const upper = rawMsg.toUpperCase();

  if (upper.includes('PERMISSION_DENIED') || upper.includes('API_KEY_INVALID') || upper.includes('403') || upper.includes('401')) {
    return new AiServiceError(
      'Kunci API Gemini tidak valid atau tidak memiliki izin akses. Silakan periksa konfigurasi GEMINI_API_KEY di panel Secrets.',
      403,
      'API_KEY_INVALID'
    );
  }
  if (upper.includes('RESOURCE_EXHAUSTED') || upper.includes('429')) {
    return new AiServiceError(
      'Batas kuota permintaan Asisten AI sedang penuh. Mohon tunggu beberapa saat lalu coba kembali.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
  if (upper.includes('NOT_FOUND') || upper.includes('404')) {
    return new AiServiceError(
      'Model layanan AI yang diminta tidak tersedia. Hubungi pengelola sistem.',
      502,
      'MODEL_NOT_FOUND'
    );
  }
  return new AiServiceError(
    'Maaf, layanan Asisten AI sedang mengalami kendala koneksi ke server AI. Silakan coba lagi beberapa saat lagi.',
    502,
    'UPSTREAM_ERROR'
  );
}

export async function askVillageAiAssistant(params: {
  message: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
}): Promise<{
  reply: string;
  sources: AiChatSourceLink[];
  suggestedLinks: AiChatActionLink[];
}> {
  const cleanMessage = String(params.message || '').trim();
  if (!cleanMessage) {
    throw new AiServiceError('Pertanyaan tidak boleh kosong.', 400, 'EMPTY_MESSAGE');
  }
  if (cleanMessage.length > 1500) {
    throw new AiServiceError('Pertanyaan terlalu panjang (maksimal 1.500 karakter).', 400, 'MESSAGE_TOO_LONG');
  }

  const ai = createAiClient();

  const recentHistory = Array.isArray(params.history)
    ? params.history
        .filter(
          (item) =>
            item &&
            (item.role === 'user' || item.role === 'model') &&
            typeof item.text === 'string' &&
            item.text.trim().length > 0
        )
        .slice(-8)
    : [];

  const combinedSearchQuery = [
    ...recentHistory.slice(-2).map((h) => h.text),
    cleanMessage,
  ].join(' ');

  const portalFacts = buildPortalFactsContext();
  const { contextText, matchedEntries } = buildKnowledgeContext(combinedSearchQuery);

  const systemInstruction = `Anda adalah **Asisten Resmi Layanan Warga Portal Desa Margamukti** (Kecamatan Sumedang Utara, Kabupaten Sumedang, Provinsi Jawa Barat).

TUGAS UTAMA:
Membantu warga dan pengunjung memahami informasi serta petunjuk teknis secara akurat, ramah, sopan, dan mudah dipraktikkan seputar:
1. **Kepesertaan DTSEN (Data Tunggal Sosial dan Ekonomi Nasional)**: pengganti DTKS, klasifikasi Desil 1–10, syarat validasi NIK Dukcapil, cara usul/sanggah lewat Perlinsos Digital (IKD), aplikasi Cek Bansos, dan Musyawarah Desa/SIKS-NG.
2. **Syarat-syarat Penerima Bantuan Sosial**: PKH, BPNT/Sembako, PBI-JK (BPJS Kesehatan gratis), PIP / KIP Sekolah (SD–SMA), KIP Kuliah, serta BLT Dana Desa.
3. **Layanan Administrasi Kependudukan (Adminduk)**: syarat pembuatan/penggantian KTP-el, aktivasi IKD, Kartu Keluarga (KK baru, pecah KK, tambah anak, ubah data), Surat Pengantar Nikah (Model N1–N4 / NA) dari RT/RW & Desa hingga KUA, Kartu Identitas Anak (KIA), Akta Kelahiran/Kematian, dan SKPWNI.
4. **Pemerintahan Desa Margamukti & Pemerintahan Daerah Kabupaten Sumedang**: layanan surat online mandiri di portal ini, tugas perangkat desa, lembaga desa (BPD, BUMDesa, LPM, PKK), koordinasi Kecamatan Sumedang Utara, MPP Sumedang, Disdukcapil, Dinsos, DPMPTSP, dan kanal pengaduan resmi.

ATURAN MENJAWAB:
- Jawab selalu dalam **Bahasa Indonesia** yang jelas, sopan, dan terstruktur menggunakan poin atau penomoran singkat agar mudah dibaca di layar HP.
- Prioritaskan data aktual Desa Margamukti dan Basis Pengetahuan Terkurasi di bawah ini; gunakan penelusuran web resmi (Google Search) untuk melengkapi atau memverifikasi regulasi nasional/Kabupaten Sumedang terbaru bila dibutuhkan.
- Sebutkan secara jelas mana berkas yang diurus di tingkat **RT/RW & Kantor Desa Margamukti** dan mana yang dilanjutkan ke **KUA / Kecamatan Sumedang Utara / Disdukcapil / Dinas Sosial Kab. Sumedang / portal daring resmi**.
- Jangan mengarang nomor kontak, tarif, atau regulasi fiktif. Ingatkan bahwa pelayanan administrasi kependudukan (KTP, KK, KIA, Akta) serta layanan dasar desa tidak dipungut biaya sesuai ketentuan yang berlaku, dan untuk kasus khusus warga dapat menghubungi Kantor Desa / WhatsApp Center resmi desa.
- Jawab padat dan informatif (sekitar 120–350 kata kecuali pengguna meminta rincian sangat lengkap).

${portalFacts}

=== BASIS PENGETAHUAN & JUKNIS TERKURASI ===
${contextText}`;

  const contents: Content[] = [
    ...recentHistory.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text.slice(0, 2000) }],
    })),
    {
      role: 'user',
      parts: [{ text: cleanMessage }],
    },
  ];

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
        },
      });

      const replyText = (response.text || '').trim();
      if (!replyText) {
        throw new AiServiceError(
          'Asisten AI tidak menghasilkan jawaban untuk pertanyaan tersebut. Silakan coba rumuskan ulang pertanyaan Anda.',
          502,
          'EMPTY_MODEL_RESPONSE'
        );
      }

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const seenUris = new Set<string>();
      const sources: AiChatSourceLink[] = [];
      for (const chunk of rawChunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title;
        if (uri && !seenUris.has(uri)) {
          seenUris.add(uri);
          sources.push({
            uri,
            title: title || new URL(uri).hostname,
          });
        }
        if (sources.length >= 4) break;
      }

      const suggestedLinks = computeSuggestedLinks(cleanMessage, matchedEntries);

      return {
        reply: replyText,
        sources,
        suggestedLinks,
      };
    } catch (err) {
      lastError = err;
      if (attempt < 2 && isRetryableGeminiError(err)) {
        const delayMs = 600 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw mapGeminiError(err);
    }
  }

  throw mapGeminiError(lastError);
}
