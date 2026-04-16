import { Bookmark, Highlight } from '@/types/book';

export function annotationsToPlainText(
  bookTitle: string,
  bookmarks: Bookmark[],
  highlights: Highlight[],
  chapterTitles: string[]
): string {
  const lines: string[] = [`${bookTitle} — Annotations`, ''];

  if (bookmarks.length) {
    lines.push('BOOKMARKS', '---');
    for (const b of bookmarks) {
      const ch = chapterTitles[b.chapterIndex] || `Chapter ${b.chapterIndex + 1}`;
      lines.push(`• ${ch}`, `  ${b.text}`, `  ${b.createdAt}`, '');
    }
  }

  if (highlights.length) {
    lines.push('HIGHLIGHTS & NOTES', '---');
    for (const h of highlights) {
      const ch = chapterTitles[h.chapterIndex] || `Chapter ${h.chapterIndex + 1}`;
      lines.push(`• ${ch}`, `  "${h.text}"`);
      if (h.note) lines.push(`  Note: ${h.note}`);
      lines.push(`  ${h.createdAt}`, '');
    }
  }

  return lines.join('\n').trim() || 'No annotations.';
}

export function annotationsToMarkdown(
  bookTitle: string,
  bookmarks: Bookmark[],
  highlights: Highlight[],
  chapterTitles: string[]
): string {
  const parts: string[] = [`# ${bookTitle}`, '', '*Exported from Miyo*', ''];

  if (bookmarks.length) {
    parts.push('## Bookmarks', '');
    for (const b of bookmarks) {
      const ch = chapterTitles[b.chapterIndex] || `Chapter ${b.chapterIndex + 1}`;
      parts.push(`### ${ch}`, `> ${b.text.replace(/\n/g, ' ')}`, '', `*${b.createdAt}*`, '');
    }
  }

  if (highlights.length) {
    parts.push('## Highlights', '');
    for (const h of highlights) {
      const ch = chapterTitles[h.chapterIndex] || `Chapter ${h.chapterIndex + 1}`;
      parts.push(`### ${ch}`, `> ${h.text.replace(/\n/g, ' ')}`, '');
      if (h.note) parts.push(`**Note:** ${h.note}`, '');
      parts.push(`*${h.createdAt}*`, '');
    }
  }

  return parts.join('\n').trim() || '# (empty)';
}
