import type { ArticleMediaItem } from '../types';

export interface ParsedVideoEmbed {
  valid: boolean;
  platform?: 'youtube' | 'tiktok' | 'instagram';
  embedUrl?: string;
  originalUrl: string;
  isVertical?: boolean;
  label?: string;
  note?: string;
}

export function parseVideoEmbed(rawUrl: string): ParsedVideoEmbed {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, originalUrl: '' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
  } catch {
    return { valid: false, originalUrl: trimmed };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  const path = parsed.pathname;

  // 1. YouTube (watch, youtu.be, shorts, embed, live)
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
    let videoId = '';
    let isVertical = false;

    if (host === 'youtu.be') {
      videoId = path.replace(/^\/+/, '').split('/')[0] || '';
    } else if (path.startsWith('/shorts/')) {
      videoId = path.replace('/shorts/', '').split('/')[0] || '';
      isVertical = true;
    } else if (path.startsWith('/embed/')) {
      videoId = path.replace('/embed/', '').split('/')[0] || '';
    } else if (path.startsWith('/live/')) {
      videoId = path.replace('/live/', '').split('/')[0] || '';
    } else {
      videoId = parsed.searchParams.get('v') || '';
    }

    const cleanId = videoId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (cleanId.length >= 6) {
      return {
        valid: true,
        platform: 'youtube',
        embedUrl: `https://www.youtube.com/embed/${cleanId}?rel=0`,
        originalUrl: parsed.toString(),
        isVertical,
        label: isVertical ? 'YouTube Shorts' : 'YouTube',
      };
    }
  }

  // 2. TikTok (standard @user/video/ID or short link)
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    const match = path.match(/\/video\/(\d+)/);
    if (match?.[1]) {
      return {
        valid: true,
        platform: 'tiktok',
        embedUrl: `https://www.tiktok.com/embed/v2/${match[1]}`,
        originalUrl: parsed.toString(),
        isVertical: true,
        label: 'TikTok',
      };
    }
    return {
      valid: true,
      platform: 'tiktok',
      originalUrl: parsed.toString(),
      isVertical: true,
      label: 'TikTok',
      note: 'Gunakan tautan penuh TikTok (contoh: tiktok.com/@akun/video/123456...) agar video dapat diputar langsung di halaman ini.',
    };
  }

  // 3. Instagram (p, reel, reels, tv)
  if (host === 'instagram.com' || host === 'instagr.am') {
    const match = path.match(/^\/(p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/);
    if (match?.[1] && match?.[2]) {
      const kind = match[1] === 'reels' ? 'reel' : match[1];
      const code = match[2];
      return {
        valid: true,
        platform: 'instagram',
        embedUrl: `https://www.instagram.com/${kind}/${code}/embed/`,
        originalUrl: parsed.toString(),
        isVertical: kind === 'reel' || kind === 'tv',
        label: kind === 'reel' ? 'Instagram Reels' : 'Instagram Video',
      };
    }
  }

  return { valid: false, originalUrl: parsed.toString() };
}

export function parseArticleMediaItems(raw: unknown): ArticleMediaItem[] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is ArticleMediaItem =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as ArticleMediaItem).url === 'string' &&
        (item as ArticleMediaItem).url.trim().length > 0
    );
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return parseArticleMediaItems(parsed);
    } catch {
      return [];
    }
  }
  return [];
}
