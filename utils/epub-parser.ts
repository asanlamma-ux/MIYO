/**
 * EPUB Parser using JSZip
 * Handles EPUB file parsing, metadata extraction, chapter extraction, cover extraction
 * and inline image embedding for complete offline rendering.
 */

import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system/legacy';
import { logger } from '@/utils/logger';

/**
 * Yield control to the main thread so the UI stays responsive.
 * Insert between CPU-heavy operations.
 */
function yieldToMainThread(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export interface EpubMetadata {
  title: string;
  author: string;
  description: string;
  language: string;
  publisher: string;
  identifier?: string | null;
  coverImageBase64: string | null;
  subjects: string[];
  publishDate: string;
}

export interface EpubChapter {
  id: string;
  title: string;
  href: string;
  order: number;
  content: string;
  wordCount?: number;
}

export interface ParsedEpub {
  metadata: EpubMetadata;
  chapters: EpubChapter[];
  totalChapters: number;
  ncxToc?: NcxTocItem[];
  extractedCss?: string;
}

export interface NcxTocItem {
  id: string;
  label: string;
  href: string;
  children?: NcxTocItem[];
  order: number;
}

/**
 * Read file as base64 and parse with JSZip
 */
async function loadZip(filePath: string): Promise<JSZip> {
  try {
    const base64 = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const zip = await JSZip.loadAsync(base64, { base64: true });
    return zip;
  } catch (error) {
    logger.error('Failed to load EPUB zip', error);
    throw new Error('Invalid EPUB file - cannot open archive');
  }
}

/**
 * Get the path to the content.opf file from container.xml
 */
async function getContentOpfPath(zip: JSZip): Promise<string> {
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) {
    // Try case variations
    const containerFile = Object.keys(zip.files).find(f =>
      f.toLowerCase() === 'meta-inf/container.xml'
    );
    if (!containerFile) throw new Error('Invalid EPUB: Missing META-INF/container.xml');
    const xml = await zip.file(containerFile)!.async('text');
    const match = xml.match(/full-path=["']([^"']+)["']/);
    if (!match) throw new Error('Invalid EPUB: Cannot find OPF path');
    return match[1];
  }

  const match = containerXml.match(/full-path=["']([^"']+)["']/);
  if (!match) throw new Error('Invalid EPUB: Cannot find content.opf path');
  return match[1];
}

/**
 * Extract text content from XML/HTML tags
 */
function extractText(xml: string, tag: string): string {
  // Try both with and without namespace
  const patterns = [
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'),
    new RegExp(`<dc:${tag}[^>]*>([\\s\\S]*?)</dc:${tag}>`, 'i'),
    new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'),
    new RegExp(`<dc:${tag}[^>]*>([^<]*)</dc:${tag}>`, 'i'),
  ];
  for (const regex of patterns) {
    const match = xml.match(regex);
    if (match) {
      return match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
    }
  }
  return '';
}

/**
 * Parse metadata from content.opf
 */
function parseMetadata(opfContent: string): Partial<EpubMetadata> {
  const getAll = (tag: string): string[] => {
    const results: string[] = [];
    const regex = new RegExp(`<(?:dc:)?${tag}[^>]*>([\\s\\S]*?)</(?:dc:)?${tag}>`, 'gi');
    let match;
    while ((match = regex.exec(opfContent)) !== null) {
      const val = match[1].replace(/<[^>]+>/g, '').trim();
      if (val) results.push(val);
    }
    return results;
  };

  const title = extractText(opfContent, 'title') || 'Unknown Title';
  const authors = getAll('creator');
  const subjects = getAll('subject');
  const description = extractText(opfContent, 'description');
  const language = extractText(opfContent, 'language') || 'en';
  const publisher = extractText(opfContent, 'publisher');
  const publishDate = extractText(opfContent, 'date');
  const identifiers = getAll('identifier');

  return {
    title,
    author: authors.join(', ') || 'Unknown Author',
    description,
    language,
    publisher,
    identifier: identifiers[0] || null,
    subjects,
    publishDate,
  };
}

/**
 * Parse spine and manifest from content.opf
 */
function parseSpineAndManifest(opfContent: string): {
  spineIds: string[];
  manifest: Record<string, { href: string; mediaType: string; properties?: string }>;
  ncxId: string | null;
} {
  const manifest: Record<string, { href: string; mediaType: string; properties?: string }> = {};

  // More robust manifest parsing handling various attribute orders
  const itemRegex = /<item\b([^>]*?)(?:\/?>|>)/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(opfContent)) !== null) {
    const attrs = itemMatch[1];
    const getId = attrs.match(/\bid="([^"]*)"/) || attrs.match(/\bid='([^']*)'/);
    const getHref = attrs.match(/\bhref="([^"]*)"/) || attrs.match(/\bhref='([^']*)'/);
    const getType = attrs.match(/\bmedia-type="([^"]*)"/) || attrs.match(/\bmedia-type='([^']*)'/);
    const getProps = attrs.match(/\bproperties="([^"]*)"/) || attrs.match(/\bproperties='([^']*)'/);

    if (getId && getHref && getType) {
      manifest[getId[1]] = {
        href: decodeURIComponent(getHref[1]),
        mediaType: getType[1],
        properties: getProps ? getProps[1] : undefined,
      };
    }
  }

  // Parse spine (order matters)
  const spineIds: string[] = [];
  const spineMatch = opfContent.match(/<spine[^>]*>([\s\S]*?)<\/spine>/i);
  if (spineMatch) {
    const itemrefRegex = /<itemref\b[^>]*\bidref=["']([^"']*)["'][^>]*(?:\/>|>)/gi;
    let irMatch;
    while ((irMatch = itemrefRegex.exec(spineMatch[1])) !== null) {
      spineIds.push(irMatch[1]);
    }
  }

  // Find NCX toc
  const ncxEntry = Object.entries(manifest).find(([, v]) =>
    v.mediaType.includes('ncx') || v.href.endsWith('.ncx')
  );

  return { spineIds, manifest, ncxId: ncxEntry ? ncxEntry[0] : null };
}

/**
 * Parse NCX table of contents for better chapter titles
 */
async function parseNcx(zip: JSZip, ncxPath: string): Promise<Record<string, string>> {
  try {
    const ncxFile = zip.file(ncxPath);
    if (!ncxFile) return {};

    const ncxContent = await ncxFile.async('text');
    const titles: Record<string, string> = {};

    const navPointRegex = /<navPoint[^>]*>([\s\S]*?)<\/navPoint>/gi;
    let match;
    while ((match = navPointRegex.exec(ncxContent)) !== null) {
      const block = match[1];
      const labelMatch = block.match(/<text>([\s\S]*?)<\/text>/i);
      const srcMatch =
        block.match(/<content[^>]*\bsrc="([^"#]*)(?:#[^"]*)?"[^>]*\/?>/i) ||
        block.match(/<content[^>]*\bsrc='([^'#]*)(?:#[^']*)?'[^>]*\/?>/i);
      if (labelMatch && srcMatch) {
        const href = decodeURIComponent(srcMatch[1].split('/').pop() || srcMatch[1]);
        titles[href] = labelMatch[1].replace(/<[^>]+>/g, '').trim();
      }
    }

    return titles;
  } catch (e) {
    return {};
  }
}

/**
 * Find and extract cover image
 */
async function extractCover(
  zip: JSZip,
  opfContent: string,
  opfBasePath: string,
  manifest: Record<string, { href: string; mediaType: string; properties?: string }>
): Promise<string | null> {
  try {
    // Strategy 1: properties="cover-image" in manifest
    const coverPropEntry = Object.entries(manifest).find(([, v]) =>
      v.properties?.includes('cover-image')
    );
    if (coverPropEntry) {
      const result = await loadImageFromManifest(zip, opfBasePath, coverPropEntry[1].href);
      if (result) return result;
    }

    // Strategy 2: <meta name="cover" content="id">
    const coverMetaMatch = opfContent.match(/<meta\s+[^>]*name="cover"[^>]*content="([^"]*)"[^>]*\/?>/i)
      || opfContent.match(/<meta\s+[^>]*content="([^"]*)"[^>]*name="cover"[^>]*\/?>/i);

    if (coverMetaMatch) {
      const coverId = coverMetaMatch[1];
      const entry = manifest[coverId];
      if (entry) {
        const result = await loadImageFromManifest(zip, opfBasePath, entry.href);
        if (result) return result;
      }
    }

    // Strategy 3: Common cover file names
    const coverPatterns = [
      'cover.jpg', 'cover.jpeg', 'cover.png', 'cover.gif',
      'images/cover.jpg', 'images/cover.png', 'IMAGES/Cover.jpg',
      'cover-image.jpg', 'Cover.jpg', 'CoverDesign.jpg',
    ];

    const zipKeys = Object.keys(zip.files);
    for (const pattern of coverPatterns) {
      const found = zipKeys.find(k =>
        k.toLowerCase().endsWith(pattern.toLowerCase().split('/').pop()!) &&
        k.toLowerCase().includes('cover')
      );
      if (found) {
        const file = zip.file(found);
        if (file) {
          const base64 = await file.async('base64');
          const ext = found.split('.').pop()?.toLowerCase() || 'jpg';
          const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
          return `data:${mime};base64,${base64}`;
        }
      }
    }

    // Strategy 4: Look for any image item in manifest that has "cover" in the name
    const coverManifestEntry = Object.entries(manifest).find(([id, v]) =>
      (id.toLowerCase().includes('cover') || v.href.toLowerCase().includes('cover')) &&
      v.mediaType.startsWith('image/')
    );
    if (coverManifestEntry) {
      const result = await loadImageFromManifest(zip, opfBasePath, coverManifestEntry[1].href);
      if (result) return result;
    }

    return null;
  } catch (error) {
    logger.warn('Failed to extract cover image', error);
    return null;
  }
}

/**
 * Load image from manifest entry
 */
async function loadImageFromManifest(zip: JSZip, basePath: string, href: string): Promise<string | null> {
  const paths = [
    basePath ? `${basePath}/${href}` : href,
    href,
    href.split('/').pop() || href,
  ];

  for (const path of paths) {
    const normalized = path.replace(/\/\//g, '/').replace(/^\//, '');
    const file = zip.file(normalized);
    if (file) {
      const base64 = await file.async('base64');
      const ext = normalized.split('.').pop()?.toLowerCase() || 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      return `data:${mime};base64,${base64}`;
    }
  }

  return null;
}

/**
 * Resolve an image path relative to the chapter file and embed as base64
 */
async function resolveImageToBase64(
  zip: JSZip,
  chapterPath: string,
  imgSrc: string
): Promise<string | null> {
  if (!imgSrc || imgSrc.startsWith('data:')) return imgSrc;

  // Build the absolute path within the zip
  const chapterDir = chapterPath.includes('/')
    ? chapterPath.substring(0, chapterPath.lastIndexOf('/'))
    : '';

  const candidates = [
    // Relative to chapter directory
    chapterDir ? `${chapterDir}/${imgSrc}` : imgSrc,
    // As-is
    imgSrc,
    // Just the filename
    imgSrc.split('/').pop() || imgSrc,
    // With OEBPS prefix (common)
    `OEBPS/${imgSrc}`,
    `OEBPS/Images/${imgSrc.split('/').pop()}`,
    `OEBPS/images/${imgSrc.split('/').pop()}`,
  ];

  for (const candidate of candidates) {
    const normalized = candidate.replace(/\/\//g, '/').replace(/^\//, '');
    const file = zip.file(normalized);
    if (file) {
      try {
        const base64 = await file.async('base64');
        const ext = normalized.split('.').pop()?.toLowerCase() || 'jpg';
        const mime =
          ext === 'png' ? 'image/png' :
          ext === 'gif' ? 'image/gif' :
          ext === 'svg' ? 'image/svg+xml' :
          ext === 'webp' ? 'image/webp' :
          'image/jpeg';
        return `data:${mime};base64,${base64}`;
      } catch (e) {
        continue;
      }
    }
  }

  return null;
}

/**
 * Extract CSS stylesheets from the EPUB archive
 */
async function extractEpubCSS(
  zip: JSZip,
  opfBasePath: string,
  manifest: Record<string, { href: string; mediaType: string; properties?: string }>
): Promise<string> {
  const cssChunks: string[] = [];
  try {
    const manifestKeys = Object.keys(manifest);
    for (const key of manifestKeys) {
      const item = manifest[key];
      if (item.mediaType === 'text/css' || item.href.endsWith('.css')) {
        const cssPath = opfBasePath ? `${opfBasePath}/${item.href}` : item.href;
        const normalized = cssPath.replace(/\/\//g, '/').replace(/^\//, '');
        const file = zip.file(normalized);
        if (file) {
          let css = await file.async('text');
          // Remove @font-face rules (we handle fonts separately)
          css = css.replace(/@font-face\s*\{[^}]*\}/gi, '');
          // Remove @import rules
          css = css.replace(/@import[^;]*;/gi, '');
          // Scope dangerous selectors — don't let epub CSS override our UI
          css = css.replace(/\bbody\b/gi, '.epub-content');
          css = css.replace(/\bhtml\b/gi, '.epub-root');
          if (css.trim()) cssChunks.push(css.trim());
        }
      }
    }
  } catch (e) {
    logger.warn('Failed to extract epub CSS', e);
  }
  return cssChunks.join('\n');
}

/**
 * Parse EPUB3 nav.xhtml for table of contents
 */
async function parseNavXhtml(
  zip: JSZip,
  opfBasePath: string,
  manifest: Record<string, { href: string; mediaType: string; properties?: string }>
): Promise<Record<string, string>> {
  try {
    // Find nav item by properties="nav"
    const manifestKeys = Object.keys(manifest);
    let navHref: string | null = null;
    for (const key of manifestKeys) {
      if (manifest[key].properties?.includes('nav')) {
        navHref = manifest[key].href;
        break;
      }
    }
    if (!navHref) return {};
    const navPath = opfBasePath ? `${opfBasePath}/${navHref}` : navHref;
    const normalized = navPath.replace(/\/\//g, '/').replace(/^\//, '');
    const navFile = zip.file(normalized);
    if (!navFile) return {};

    const navContent = await navFile.async('text');
    const titles: Record<string, string> = {};

    // Find the toc nav element
    const tocMatch = navContent.match(/<nav[^>]*epub:type="toc"[^>]*>([\s\S]*?)<\/nav>/i);
    if (!tocMatch) return {};

    // Parse <a> tags within the toc nav
    const linkRegex = /<a[^>]*\bhref="([^"#]*)(?:#[^"]*)?"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(tocMatch[1])) !== null) {
      const href = decodeURIComponent(match[1].split('/').pop() || match[1]);
      const label = match[2].replace(/<[^>]+>/g, '').trim();
      if (href && label) {
        titles[href] = label;
      }
    }

    return titles;
  } catch (e) {
    return {};
  }
}

/**
 * Process HTML content: embed images as base64, clean markup
 */
async function processChapterContent(
  zip: JSZip,
  rawContent: string,
  chapterPath: string
): Promise<string> {
  let content = rawContent;

  // Remove XML declarations and DOCTYPE
  content = content.replace(/<\?xml[^>]*\?>/gi, '');
  content = content.replace(/<!DOCTYPE[^>]*>/gi, '');

  // Extract inline style blocks before body extraction
  const styleBlocks: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(content)) !== null) {
    styleBlocks.push(styleMatch[1]);
  }

  // Extract body content if present
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    content = bodyMatch[1];
  }

  // Re-inject inline styles
  if (styleBlocks.length > 0) {
    const inlineStyles = styleBlocks
      .map(s => s.replace(/@font-face\s*\{[^}]*\}/gi, '').trim())
      .filter(Boolean)
      .join('\n');
    if (inlineStyles) {
      content = `<style>${inlineStyles}</style>\n${content}`;
    }
  }

  // Fix epub: namespace links
  content = content.replace(/epub:type="[^"]*"/gi, '');

  // Remove external CSS link tags (we inject our own styles)
  content = content.replace(/<link[^>]*rel="stylesheet"[^>]*\/?>/gi, '');

  // Add lazy loading + async decoding attributes to images for performance
  content = content.replace(/<img\b/gi, '<img loading="lazy" decoding="async"');

  // Embed images as base64 (double- or single-quoted src)
  const embedImgs = async (regex: RegExp) => {
    const matches: Array<{ tag: string; src: string }> = [];
    let m: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((m = regex.exec(content)) !== null) {
      matches.push({ tag: m[0], src: m[1] });
    }
    // Process images in mini-batches of 3, yielding between batches
    for (let i = 0; i < matches.length; i++) {
      const { tag, src } = matches[i];
      if (!src || src.startsWith('data:') || src.startsWith('http')) continue;
      const b64 = await resolveImageToBase64(zip, chapterPath, src);
      if (b64) content = content.replace(tag, tag.replace(src, b64));
      if (i > 0 && i % 3 === 0) await yieldToMainThread();
    }
  };
  await embedImgs(/<img\b[^>]*\bsrc="([^"]*)"[^>]*\/?>/gi);
  await embedImgs(/<img\b[^>]*\bsrc='([^']*)'[^>]*\/?>/gi);

  // Also handle image elements with xlink:href (SVG images in EPUBs)
  const xlinkRegex = /xlink:href="([^"]*)"/gi;
  let xlinkMatch;
  while ((xlinkMatch = xlinkRegex.exec(content)) !== null) {
    const src = xlinkMatch[1];
    if (!src || src.startsWith('data:') || src.startsWith('http')) continue;
    const base64 = await resolveImageToBase64(zip, chapterPath, src);
    if (base64) {
      content = content.replace(xlinkMatch[0], `xlink:href="${base64}"`);
    }
  }

  content = content
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(href|src)\s*=\s*"javascript:[^"]*"/gi, ' $1="#"')
    .replace(/\s(href|src)\s*=\s*'javascript:[^']*'/gi, " $1='#'");

  return content.trim();
}

/**
 * Extract chapter title from HTML content
 */
function extractChapterTitle(content: string, fallback: string): string {
  // Try <title> tag
  const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch && titleMatch[1].trim() && titleMatch[1].trim().length < 100) {
    return titleMatch[1].trim();
  }

  // Try h1, h2, h3
  for (const tag of ['h1', 'h2', 'h3']) {
    const hMatch = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
    if (hMatch) {
      const text = hMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (text && text.length > 0 && text.length < 120) {
        return text;
      }
    }
  }

  return fallback;
}

/**
 * Count words in HTML content
 */
function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.split(' ').filter(w => w.length > 0).length;
}

/**
 * Parse a complete EPUB file
 */
export async function parseEpub(filePath: string): Promise<ParsedEpub> {
  logger.info('Starting EPUB parse', { filePath });

  const zip = await loadZip(filePath);
  const opfPath = await getContentOpfPath(zip);
  const opfBasePath = opfPath.includes('/')
    ? opfPath.substring(0, opfPath.lastIndexOf('/'))
    : '';

  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error('Invalid EPUB: Cannot read content.opf');
  }

  const opfContent = await opfFile.async('text');
  const metadataPartial = parseMetadata(opfContent);
  const { spineIds, manifest, ncxId } = parseSpineAndManifest(opfContent);

  // Extract cover
  const coverImageBase64 = await extractCover(zip, opfContent, opfBasePath, manifest);

  // Parse NCX for better chapter titles
  let ncxTitles: Record<string, string> = {};
  if (ncxId && manifest[ncxId]) {
    const ncxHref = manifest[ncxId].href;
    const ncxPath = opfBasePath ? `${opfBasePath}/${ncxHref}` : ncxHref;
    ncxTitles = await parseNcx(zip, ncxPath.replace(/\/\//g, '/'));
  }

  // Parse EPUB3 nav.xhtml for better titles (takes priority over NCX)
  const navTitles = await parseNavXhtml(zip, opfBasePath, manifest);
  const allTitles = { ...ncxTitles, ...navTitles };

  // Extract CSS from epub stylesheets
  const extractedCss = await extractEpubCSS(zip, opfBasePath, manifest);

  // Extract chapters from spine
  const chapters: EpubChapter[] = [];
  let order = 0;

  for (const spineId of spineIds) {
    const item = manifest[spineId];
    if (!item) continue;

    // Only process HTML/XHTML content (skip NCX, SVG-only, etc.)
    const mt = item.mediaType.toLowerCase();
    const isHtmlBody =
      mt.includes('html') ||
      mt === 'application/xhtml+xml' ||
      mt === 'text/html' ||
      mt === 'application/html+xml';
    if (!isHtmlBody) continue;

    const chapterHref = item.href.split('#')[0]; // Remove fragment
    const chapterPath = opfBasePath ? `${opfBasePath}/${chapterHref}` : chapterHref;
    const normalizedPath = chapterPath.replace(/\/\//g, '/');
    const chapterFile = zip.file(normalizedPath);

    if (!chapterFile) {
      logger.warn(`Chapter file not found: ${normalizedPath}`);
      continue;
    }

    try {
      const rawContent = await chapterFile.async('text');
      const processedContent = await processChapterContent(zip, rawContent, normalizedPath);

      if (!processedContent || processedContent.trim().length < 10) continue;

      // Get title from NCX, then from content, then fallback
      const hrefBasename = chapterHref.split('/').pop() || chapterHref;
      const tocTitle = allTitles[hrefBasename] || allTitles[chapterHref];
      const title = tocTitle || extractChapterTitle(rawContent, `Chapter ${order + 1}`);
      const truncatedTitle = title.length > 100 ? title.substring(0, 97) + '...' : title;

      chapters.push({
        id: spineId,
        title: truncatedTitle,
        href: item.href,
        order,
        content: processedContent,
        wordCount: countWords(processedContent),
      });
      order++;

      // Yield to main thread every 3 chapters to keep UI responsive
      if (order % 3 === 0) await yieldToMainThread();
    } catch (error) {
      logger.warn(`Failed to parse chapter: ${spineId}`, error);
    }
  }

  // Fallback: get all HTML files if spine gave nothing
  if (chapters.length === 0) {
    logger.warn('No chapters from spine, using file-based fallback');
    const htmlFiles = Object.keys(zip.files)
      .filter(f => {
        const lower = f.toLowerCase();
        return (lower.endsWith('.html') || lower.endsWith('.xhtml') || lower.endsWith('.htm'))
          && !lower.includes('toc') && !lower.includes('nav');
      })
      .sort();

    for (const htmlFile of htmlFiles) {
      const file = zip.file(htmlFile);
      if (!file) continue;

      try {
        const rawContent = await file.async('text');
        const processedContent = await processChapterContent(zip, rawContent, htmlFile);
        if (!processedContent || processedContent.trim().length < 10) continue;

        const title = extractChapterTitle(rawContent, `Chapter ${order + 1}`);

        chapters.push({
          id: `fallback_${order}`,
          title,
          href: htmlFile,
          order,
          content: processedContent,
          wordCount: countWords(processedContent),
        });
        order++;
      } catch (error) {
        logger.warn(`Failed to parse fallback chapter: ${htmlFile}`, error);
      }
    }
  }

  logger.info('EPUB parsed successfully', {
    title: metadataPartial.title,
    chapters: chapters.length,
    hasCover: !!coverImageBase64,
  });

  return {
    metadata: {
      title: metadataPartial.title || 'Unknown Title',
      author: metadataPartial.author || 'Unknown Author',
      description: metadataPartial.description || '',
      language: metadataPartial.language || 'en',
      publisher: metadataPartial.publisher || '',
      identifier: metadataPartial.identifier || null,
      coverImageBase64,
      subjects: metadataPartial.subjects || [],
      publishDate: metadataPartial.publishDate || '',
    },
    chapters,
    totalChapters: chapters.length,
    extractedCss,
  };
}

/**
 * Extract only metadata (lightweight, no chapter content)
 */
export async function extractEpubMetadata(filePath: string): Promise<EpubMetadata> {
  try {
    const zip = await loadZip(filePath);
    const opfPath = await getContentOpfPath(zip);
    const opfBasePath = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : '';

    const opfFile = zip.file(opfPath);
    if (!opfFile) {
      throw new Error('Invalid EPUB: Cannot read content.opf');
    }

    const opfContent = await opfFile.async('text');
    const metadataPartial = parseMetadata(opfContent);
    const { manifest } = parseSpineAndManifest(opfContent);
    const coverImageBase64 = await extractCover(zip, opfContent, opfBasePath, manifest);

    return {
      title: metadataPartial.title || 'Unknown Title',
      author: metadataPartial.author || 'Unknown Author',
      description: metadataPartial.description || '',
      language: metadataPartial.language || 'en',
      publisher: metadataPartial.publisher || '',
      identifier: metadataPartial.identifier || null,
      coverImageBase64,
      subjects: metadataPartial.subjects || [],
      publishDate: metadataPartial.publishDate || '',
    };
  } catch (error) {
    logger.error('Failed to extract EPUB metadata', error);
    return {
      title: 'Unknown Title',
      author: 'Unknown Author',
      description: '',
      language: 'en',
      publisher: '',
      identifier: null,
      coverImageBase64: null,
      subjects: [],
      publishDate: '',
    };
  }
}

/**
 * Read the EPUB file as a base64 string for use with epub.js rendering engine.
 * This is the preferred approach for rendering as it delegates all parsing to epub.js.
 */
export async function readEpubAsBase64(filePath: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    logger.error('Failed to read epub as base64', error);
    throw new Error('Cannot read epub file - it may have been moved or deleted.');
  }
}

/**
 * Get chapter count without loading content
 */
export async function getEpubChapterCount(filePath: string): Promise<number> {
  try {
    const zip = await loadZip(filePath);
    const opfPath = await getContentOpfPath(zip);
    const opfFile = zip.file(opfPath);
    if (!opfFile) return 1;

    const opfContent = await opfFile.async('text');
    const { spineIds, manifest } = parseSpineAndManifest(opfContent);

    const htmlSpineIds = spineIds.filter(id => {
      const item = manifest[id];
      if (!item) return false;
      const mt = item.mediaType.toLowerCase();
      return (
        mt.includes('html') ||
        mt === 'application/xhtml+xml' ||
        mt === 'text/html' ||
        mt === 'application/html+xml'
      );
    });

    return Math.max(htmlSpineIds.length, 1);
  } catch (error) {
    logger.warn('Failed to get chapter count', error);
    return 1;
  }
}

/**
 * Lightweight parse: extracts metadata, spine, cover, CSS, and chapter manifest
 * WITHOUT reading any chapter content. Ideal for the initial load.
 */
export interface LightweightEpub {
  metadata: EpubMetadata;
  spine: Array<{ id: string; href: string; title: string }>;
  totalChapters: number;
  extractedCss: string;
}

export async function parseEpubLightweight(filePath: string): Promise<LightweightEpub> {
  logger.info('Lightweight EPUB parse (no chapter content)', { filePath });

  const zip = await loadZip(filePath);
  const opfPath = await getContentOpfPath(zip);
  const opfBasePath = opfPath.includes('/')
    ? opfPath.substring(0, opfPath.lastIndexOf('/'))
    : '';

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error('Invalid EPUB: Cannot read content.opf');

  const opfContent = await opfFile.async('text');
  const metadataPartial = parseMetadata(opfContent);
  const { spineIds, manifest, ncxId } = parseSpineAndManifest(opfContent);

  const coverImageBase64 = await extractCover(zip, opfContent, opfBasePath, manifest);

  // Parse NCX + nav for chapter titles
  let ncxTitles: Record<string, string> = {};
  if (ncxId && manifest[ncxId]) {
    const ncxHref = manifest[ncxId].href;
    const ncxPath = opfBasePath ? `${opfBasePath}/${ncxHref}` : ncxHref;
    ncxTitles = await parseNcx(zip, ncxPath.replace(/\/\//g, '/'));
  }
  const navTitles = await parseNavXhtml(zip, opfBasePath, manifest);
  const allTitles = { ...ncxTitles, ...navTitles };

  const extractedCss = await extractEpubCSS(zip, opfBasePath, manifest);

  // Build spine with titles (no content)
  const spine: Array<{ id: string; href: string; title: string }> = [];
  let order = 0;
  for (const spineId of spineIds) {
    const item = manifest[spineId];
    if (!item) continue;
    const mt = item.mediaType.toLowerCase();
    const isHtml = mt.includes('html') || mt === 'application/xhtml+xml' || mt === 'text/html';
    if (!isHtml) continue;

    const hrefBasename = item.href.split('/').pop() || item.href;
    const title = allTitles[hrefBasename] || allTitles[item.href] || `Chapter ${order + 1}`;

    spine.push({ id: spineId, href: item.href, title });
    order++;
  }

  return {
    metadata: {
      title: metadataPartial.title || 'Unknown Title',
      author: metadataPartial.author || 'Unknown Author',
      description: metadataPartial.description || '',
      language: metadataPartial.language || 'en',
      publisher: metadataPartial.publisher || '',
      identifier: metadataPartial.identifier || null,
      coverImageBase64,
      subjects: metadataPartial.subjects || [],
      publishDate: metadataPartial.publishDate || '',
    },
    spine,
    totalChapters: spine.length,
    extractedCss,
  };
}

/**
 * Parse a single chapter by index from an EPUB file.
 * Used for lazy/on-demand chapter loading.
 */
export async function parseSingleChapter(
  filePath: string,
  chapterIndex: number
): Promise<EpubChapter | null> {
  try {
    const zip = await loadZip(filePath);
    const opfPath = await getContentOpfPath(zip);
    const opfBasePath = opfPath.includes('/')
      ? opfPath.substring(0, opfPath.lastIndexOf('/'))
      : '';

    const opfFile = zip.file(opfPath);
    if (!opfFile) return null;

    const opfContent = await opfFile.async('text');
    const { spineIds, manifest, ncxId } = parseSpineAndManifest(opfContent);

    // Filter to HTML spine items
    const htmlSpine = spineIds.filter(id => {
      const item = manifest[id];
      if (!item) return false;
      const mt = item.mediaType.toLowerCase();
      return mt.includes('html') || mt === 'application/xhtml+xml' || mt === 'text/html';
    });

    if (chapterIndex < 0 || chapterIndex >= htmlSpine.length) return null;

    const spineId = htmlSpine[chapterIndex];
    const item = manifest[spineId];
    if (!item) return null;

    // Get chapter titles for this index
    let ncxTitles: Record<string, string> = {};
    if (ncxId && manifest[ncxId]) {
      const ncxHref = manifest[ncxId].href;
      const ncxPath = opfBasePath ? `${opfBasePath}/${ncxHref}` : ncxHref;
      ncxTitles = await parseNcx(zip, ncxPath.replace(/\/\//g, '/'));
    }
    const navTitles = await parseNavXhtml(zip, opfBasePath, manifest);
    const allTitles = { ...ncxTitles, ...navTitles };

    const chapterHref = item.href.split('#')[0];
    const chapterPath = opfBasePath ? `${opfBasePath}/${chapterHref}` : chapterHref;
    const normalizedPath = chapterPath.replace(/\/\//g, '/');
    const chapterFile = zip.file(normalizedPath);

    if (!chapterFile) return null;

    const rawContent = await chapterFile.async('text');
    const processedContent = await processChapterContent(zip, rawContent, normalizedPath);

    const hrefBasename = chapterHref.split('/').pop() || chapterHref;
    const tocTitle = allTitles[hrefBasename] || allTitles[chapterHref];
    const title = tocTitle || extractChapterTitle(rawContent, `Chapter ${chapterIndex + 1}`);

    return {
      id: spineId,
      title: title.length > 100 ? title.substring(0, 97) + '...' : title,
      href: item.href,
      order: chapterIndex,
      content: processedContent,
      wordCount: countWords(processedContent),
    };
  } catch (error) {
    logger.error('Failed to parse single chapter', error);
    return null;
  }
}
