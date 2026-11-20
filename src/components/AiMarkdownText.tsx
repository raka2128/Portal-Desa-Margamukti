import React from 'react';

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s)]+)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={`b-${keyCounter++}`} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={`c-${keyCounter++}`}
          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[12px]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (linkMatch) {
        tokens.push(
          <a
            key={`a-${keyCounter++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[var(--theme-primary)] hover:text-[var(--theme-primary-hover)] break-all"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        tokens.push(token);
      }
    } else {
      tokens.push(
        <a
          key={`u-${keyCounter++}`}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-[var(--theme-primary)] hover:text-[var(--theme-primary-hover)] break-all"
        >
          {token}
        </a>
      );
    }
    lastIdx = match.index + token.length;
  }

  if (lastIdx < text.length) {
    tokens.push(text.slice(lastIdx));
  }
  return tokens;
}

export function AiMarkdownText({ text }: { text: string }) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: Array<{ ordered: boolean; content: string; num?: string }> = [];
  let listType: 'ul' | 'ol' | null = null;
  let blockKey = 0;

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    if (listType === 'ol') {
      blocks.push(
        <ol key={`ol-${blockKey++}`} className="space-y-1.5 pl-1 my-1.5">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed">
              <span className="font-mono-tabular font-semibold text-[var(--theme-primary)] shrink-0">
                {item.num || `${idx + 1}.`}
              </span>
              <span className="min-w-0 flex-1">{renderInlineMarkdown(item.content)}</span>
            </li>
          ))}
        </ol>
      );
    } else {
      blocks.push(
        <ul key={`ul-${blockKey++}`} className="space-y-1.5 pl-1 my-1.5">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed">
              <span className="text-[var(--theme-accent-dark)] font-bold shrink-0" aria-hidden="true">
                •
              </span>
              <span className="min-w-0 flex-1">{renderInlineMarkdown(item.content)}</span>
            </li>
          ))}
        </ul>
      );
    }
    listItems = [];
    listType = null;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      flushList();
      blocks.push(
        <p key={`h-${blockKey++}`} className="font-semibold text-[var(--theme-primary)] pt-1.5 pb-0.5">
          {renderInlineMarkdown(headingMatch[1])}
        </p>
      );
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+\.)\s+(.+)$/);
    if (orderedMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listItems.push({ ordered: true, num: orderedMatch[1], content: orderedMatch[2] });
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listItems.push({ ordered: false, content: bulletMatch[1] });
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${blockKey++}`} className="leading-relaxed">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-1.5 text-[13.5px] sm:text-sm text-slate-700">{blocks}</div>;
}
