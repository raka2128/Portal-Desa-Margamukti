export interface ShareableArticleMeta {
  title: string;
  slug: string;
  excerpt?: string;
}

export function buildArticleShareUrl(slug: string): string {
  if (typeof window === 'undefined') {
    return `/?berita=${encodeURIComponent(slug)}#jelajah`;
  }
  return `${window.location.origin}/?berita=${encodeURIComponent(slug)}#jelajah`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Lanjut ke fallback textarea
    }
  }

  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export function buildArticleShareLinks(article: ShareableArticleMeta) {
  const url = buildArticleShareUrl(article.slug);
  const cleanTitle = article.title.trim();
  const cleanExcerpt = (article.excerpt || '').trim();
  const summaryBlock = cleanExcerpt ? `${cleanExcerpt}\n\n` : '';

  const whatsappText = `*${cleanTitle}*\n\n${summaryBlock}Baca berita selengkapnya di Portal Resmi Desa Margamukti:\n${url}`;
  const gmailSubject = `[Berita Desa Margamukti] ${cleanTitle}`;
  const gmailBody = `${cleanTitle}\n\n${summaryBlock}Baca artikel selengkapnya melalui tautan resmi Portal Desa Margamukti:\n${url}`;
  const instagramCaption = `${cleanTitle}\n\n${summaryBlock}Baca selengkapnya: ${url}\n#DesaMargamukti #SumedangUtara #KabarDesa`;

  return {
    url,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(whatsappText)}`,
    facebookUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(cleanTitle)}`,
    gmailUrl: `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(gmailSubject)}&body=${encodeURIComponent(gmailBody)}`,
    instagramUrl: 'https://www.instagram.com/',
    instagramCaption,
  };
}
