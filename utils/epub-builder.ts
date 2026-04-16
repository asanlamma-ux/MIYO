import JSZip from 'jszip';
import {
  cacheDirectory,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { sanitizeImportFileName } from '@/utils/library-import';
import type { WtrLabChapterContent, WtrLabNovelDetails } from '@/types/wtr-lab';

function xmlEscape(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slugify(input: string, fallback: string): string {
  const cleaned = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function wrapChapterHtml(title: string, body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${xmlEscape(title)}</title>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; }
      body {
        font-family: Georgia, serif;
        font-size: 1em;
        line-height: 1.7;
        color: #221a14;
        background: #fffdf9;
        padding: 1.4rem;
      }
      h1 {
        font-size: 1.35rem;
        margin: 0 0 1.4rem;
      }
      p {
        margin: 0 0 1rem;
      }
      img {
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    <h1>${xmlEscape(title)}</h1>
    ${body}
  </body>
</html>`;
}

async function ensureGeneratedDir(): Promise<string> {
  const dir = `${cacheDirectory || ''}generated-epub/`;
  const info = await getInfoAsync(dir);
  if (!info.exists) {
    await makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

async function fetchCoverBinary(coverUrl: string | null): Promise<{
  bytes: Uint8Array;
  extension: string;
  mediaType: string;
} | null> {
  if (!coverUrl) return null;

  try {
    const response = await fetch(coverUrl);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const normalizedType = contentType.includes('png')
      ? 'image/png'
      : contentType.includes('webp')
        ? 'image/webp'
        : 'image/jpeg';
    const extension =
      normalizedType === 'image/png'
        ? 'png'
        : normalizedType === 'image/webp'
          ? 'webp'
          : 'jpg';

    return {
      bytes: new Uint8Array(buffer),
      extension,
      mediaType: normalizedType,
    };
  } catch {
    return null;
  }
}

function buildNav(chapters: WtrLabChapterContent[]) {
  const items = chapters
    .map((chapter, index) => `<li><a href="chapter-${index + 1}.xhtml">${xmlEscape(chapter.title)}</a></li>`)
    .join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>Contents</title>
    <meta charset="utf-8" />
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Contents</h1>
      <ol>${items}</ol>
    </nav>
  </body>
</html>`;
}

function buildNcx(novel: WtrLabNovelDetails, chapters: WtrLabChapterContent[]) {
  const remoteId = `${novel.providerId || 'remote'}-${novel.rawId}`;
  const navPoints = chapters
    .map(
      (chapter, index) => `<navPoint id="navPoint-${index + 1}" playOrder="${index + 1}">
  <navLabel><text>${xmlEscape(chapter.title)}</text></navLabel>
  <content src="chapter-${index + 1}.xhtml"/>
</navPoint>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${xmlEscape(remoteId)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${xmlEscape(novel.title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
}

function buildOpf(
  novel: WtrLabNovelDetails,
  chapters: WtrLabChapterContent[],
  cover: Awaited<ReturnType<typeof fetchCoverBinary>>
) {
  const remoteId = `${novel.providerId || 'remote'}-${novel.rawId}`;
  const providerLabel = novel.providerLabel || 'Remote source';
  const manifestChapters = chapters
    .map(
      (_chapter, index) =>
        `<item id="chapter-${index + 1}" href="chapter-${index + 1}.xhtml" media-type="application/xhtml+xml"/>`
    )
    .join('\n    ');
  const spineChapters = chapters
    .map((_chapter, index) => `<itemref idref="chapter-${index + 1}"/>`)
    .join('\n    ');
  const coverManifest = cover
    ? `<item id="cover-image" href="images/cover.${cover.extension}" media-type="${cover.mediaType}" properties="cover-image"/>
    <item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>`
    : '';
  const coverSpine = cover ? `<itemref idref="cover-page" linear="yes"/>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${xmlEscape(remoteId)}</dc:identifier>
    <dc:title>${xmlEscape(novel.title)}</dc:title>
    <dc:creator>${xmlEscape(novel.author || 'Unknown Author')}</dc:creator>
    <dc:language>en</dc:language>
    <dc:description>${xmlEscape(novel.summary || `Downloaded from ${providerLabel} using Miyo.`)}</dc:description>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${coverManifest}
    ${manifestChapters}
  </manifest>
  <spine toc="ncx">
    ${coverSpine}
    ${spineChapters}
  </spine>
</package>`;
}

function buildCoverPage(novel: WtrLabNovelDetails, cover: NonNullable<Awaited<ReturnType<typeof fetchCoverBinary>>>) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${xmlEscape(novel.title)}</title>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; background: #000; }
      body { display: flex; min-height: 100vh; align-items: center; justify-content: center; }
      img { max-width: 100%; max-height: 100vh; }
    </style>
  </head>
  <body>
    <img src="images/cover.${cover.extension}" alt="${xmlEscape(novel.title)}" />
  </body>
</html>`;
}

export async function createRemoteNovelEpub(params: {
  novel: WtrLabNovelDetails;
  chapters: WtrLabChapterContent[];
}) {
  const { novel, chapters } = params;
  if (!chapters.length) {
    throw new Error('No chapters were available to export.');
  }

  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.folder('META-INF')?.file(
    'container.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const oebps = zip.folder('OEBPS');
  if (!oebps) {
    throw new Error('Could not initialize EPUB structure.');
  }

  const cover = await fetchCoverBinary(novel.coverUrl);
  if (cover) {
    oebps.folder('images')?.file(`cover.${cover.extension}`, cover.bytes);
    oebps.file('cover.xhtml', buildCoverPage(novel, cover));
  }

  chapters.forEach((chapter, index) => {
    oebps.file(`chapter-${index + 1}.xhtml`, wrapChapterHtml(chapter.title, chapter.html));
  });

  oebps.file('nav.xhtml', buildNav(chapters));
  oebps.file('toc.ncx', buildNcx(novel, chapters));
  oebps.file('content.opf', buildOpf(novel, chapters, cover));

  const base64 = await zip.generateAsync({
    type: 'base64',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const dir = await ensureGeneratedDir();
  const fileStem = slugify(novel.title, `${novel.providerId || 'remote'}-${novel.rawId}`);
  const fileName = sanitizeImportFileName(`${fileStem}.epub`, `${novel.providerId || 'remote'}-book`);
  const path = `${dir}${fileName}`;
  await writeAsStringAsync(path, base64, { encoding: EncodingType.Base64 });
  return {
    uri: path,
    fileName,
  };
}
