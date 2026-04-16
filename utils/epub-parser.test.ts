/**
 * EPUB parser tests — uses an in-memory zip and mocks expo-file-system/legacy.
 */

import JSZip from 'jszip';
import { parseEpub, extractEpubMetadata, getEpubChapterCount } from './epub-parser';

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: jest.fn(),
}));

import * as LegacyFS from 'expo-file-system/legacy';

const readAsStringAsync = LegacyFS.readAsStringAsync as jest.MockedFunction<
  typeof LegacyFS.readAsStringAsync
>;

async function minimalEpubBase64(): Promise<string> {
  const zip = new JSZip();

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Parser Test Book</dc:title>
    <dc:creator>Test Writer</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
  </spine>
</package>`
  );

  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<body>
<nav epub:type="toc" id="toc"><ol><li><a href="chapter1.xhtml">First Chapter</a></li></ol></nav>
</body>
</html>`
  );

  zip.file(
    'OEBPS/chapter1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Ch1</title></head>
<body><p>Hello from the EPUB parser test. Enough text for the chapter to be kept.</p></body>
</html>`
  );

  return zip.generateAsync({ type: 'base64' });
}

/** Minimal valid 1×1 PNG (red), as raw bytes → base64 in zip */
const MINI_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function epub2WithNcxBase64(): Promise<string> {
  const zip = new JSZip();

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>EPUB Two NCX</dc:title>
    <dc:creator>Legacy Author</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="chap1" href="chap1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chap1"/>
  </spine>
</package>`
  );

  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    <navPoint id="np1" playOrder="1">
      <navLabel><text>From NCX TOC</text></navLabel>
      <content src="chap1.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`
  );

  zip.file(
    'OEBPS/chap1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Fallback Title</title></head>
<body><p>EPUB 2 body with enough characters for the parser to keep this chapter.</p></body>
</html>`
  );

  return zip.generateAsync({ type: 'base64' });
}

async function epubWithInlineImageBase64(): Promise<string> {
  const zip = new JSZip();

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Image EPUB</dc:title>
    <dc:creator>Pixel Author</dc:creator>
  </metadata>
  <manifest>
    <item id="img" href="images/pixel.png" media-type="image/png"/>
    <item id="c1" href="chapter.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
  </spine>
</package>`
  );

  zip.file('OEBPS/images/pixel.png', MINI_PNG_BASE64, { base64: true });
  zip.file(
    'OEBPS/chapter.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Ch</title></head>
<body>
  <p>Before the image we need sufficient text length for the chapter threshold.</p>
  <img src='images/pixel.png' alt='x'/>
  <p>After the image more text so the chapter is definitely kept by the parser.</p>
</body>
</html>`
  );

  return zip.generateAsync({ type: 'base64' });
}

describe('epub-parser', () => {
  beforeEach(() => {
    readAsStringAsync.mockReset();
  });

  it('parseEpub returns metadata and one chapter from a minimal EPUB 3', async () => {
    const b64 = await minimalEpubBase64();
    readAsStringAsync.mockResolvedValue(b64);

    const parsed = await parseEpub('file:///test/book.epub');

    expect(parsed.metadata.title).toBe('Parser Test Book');
    expect(parsed.metadata.author).toBe('Test Writer');
    expect(parsed.chapters.length).toBe(1);
    expect(parsed.chapters[0].title).toBe('First Chapter');
    expect(parsed.chapters[0].content).toMatch(/Hello from the EPUB parser test/);
    expect(parsed.chapters[0].wordCount).toBeGreaterThan(3);
    expect(parsed.totalChapters).toBe(1);
  });

  it('extractEpubMetadata reads title without loading chapters', async () => {
    const b64 = await minimalEpubBase64();
    readAsStringAsync.mockResolvedValue(b64);

    const meta = await extractEpubMetadata('file:///test/book.epub');
    expect(meta.title).toBe('Parser Test Book');
    expect(meta.author).toBe('Test Writer');
  });

  it('getEpubChapterCount matches spine HTML items', async () => {
    const b64 = await minimalEpubBase64();
    readAsStringAsync.mockResolvedValue(b64);

    const n = await getEpubChapterCount('file:///test/book.epub');
    expect(n).toBe(1);
  });

  it('parseEpub handles single-quoted container full-path', async () => {
    const zip = new JSZip();
    zip.file(
      'META-INF/container.xml',
      `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path='OEBPS/content.opf' media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
    );
    zip.file(
      'OEBPS/content.opf',
      `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Quoted Path</dc:title>
    <dc:creator>Author</dc:creator>
  </metadata>
  <manifest>
    <item id="c1" href="c.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref='c1'/>
  </spine>
</package>`
    );
    zip.file(
      'OEBPS/c.xhtml',
      `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Body text for quoted path test content here.</p></body></html>`
    );
    readAsStringAsync.mockResolvedValue(await zip.generateAsync({ type: 'base64' }));

    const parsed = await parseEpub('file:///q.epub');
    expect(parsed.metadata.title).toBe('Quoted Path');
    expect(parsed.chapters.length).toBe(1);
  });

  it('parseEpub uses NCX labels for EPUB 2 (no nav document)', async () => {
    const b64 = await epub2WithNcxBase64();
    readAsStringAsync.mockResolvedValue(b64);

    const parsed = await parseEpub('file:///test/epub2.epub');

    expect(parsed.metadata.title).toBe('EPUB Two NCX');
    expect(parsed.metadata.author).toBe('Legacy Author');
    expect(parsed.chapters.length).toBe(1);
    expect(parsed.chapters[0].title).toBe('From NCX TOC');
    expect(parsed.chapters[0].content).toMatch(/EPUB 2 body/);
  });

  it('getEpubChapterCount works for EPUB 2 spine', async () => {
    const b64 = await epub2WithNcxBase64();
    readAsStringAsync.mockResolvedValue(b64);
    expect(await getEpubChapterCount('file:///test/epub2.epub')).toBe(1);
  });

  it('parseEpub embeds chapter images as data URLs (single-quoted src)', async () => {
    const b64 = await epubWithInlineImageBase64();
    readAsStringAsync.mockResolvedValue(b64);

    const parsed = await parseEpub('file:///test/img.epub');

    expect(parsed.chapters.length).toBe(1);
    expect(parsed.chapters[0].content).toMatch(/data:image\/png;base64,/);
    expect(parsed.chapters[0].content).toContain(MINI_PNG_BASE64);
  });

  it('parseNcx accepts single-quoted content src', async () => {
    const zip = new JSZip();
    zip.file(
      'META-INF/container.xml',
      `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
    );
    zip.file(
      'OEBPS/content.opf',
      `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Single Quote NCX</dc:title>
    <dc:creator>A</dc:creator>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="p1" href="p.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx"><itemref idref="p1"/></spine>
</package>`
    );
    zip.file(
      'OEBPS/toc.ncx',
      `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    <navPoint id="n1" playOrder="1">
      <navLabel><text>Squoted Src</text></navLabel>
      <content src='p.xhtml'/>
    </navPoint>
  </navMap>
</ncx>`
    );
    zip.file(
      'OEBPS/p.xhtml',
      `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Paragraph with enough length for chapter keep rule here.</p></body></html>`
    );
    readAsStringAsync.mockResolvedValue(await zip.generateAsync({ type: 'base64' }));

    const parsed = await parseEpub('file:///sqncx.epub');
    expect(parsed.chapters[0].title).toBe('Squoted Src');
  });
});
