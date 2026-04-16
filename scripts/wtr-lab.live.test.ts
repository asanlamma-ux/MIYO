import { chromium } from 'playwright';
import { WTR_LAB_BOOTSTRAP_SCRIPT, WTR_LAB_START_URL } from '../utils/wtr-lab-bridge';
import type {
  WtrLabChapterContent,
  WtrLabNovelDetails,
  WtrLabNovelSummary,
  WtrLabSearchResult,
} from '../types/wtr-lab';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
    ],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    extraHTTPHeaders: {
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Google Chrome";v="126", "Chromium";v="126", "Not.A/Brand";v="24"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"Android"',
    },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Linux armv8l',
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin' },
        { name: 'Chrome PDF Viewer' },
        { name: 'Native Client' },
      ],
    });
  });
  const page = await context.newPage();

  try {
    await page.goto(WTR_LAB_START_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const nextDataReady = await page
      .waitForFunction(() => !!document.getElementById('__NEXT_DATA__'), undefined, {
        timeout: 45000,
      })
      .then(() => true)
      .catch(() => false);

    if (!nextDataReady) {
      const title = await page.title();
      const bodyText = await page.locator('body').innerText().catch(() => '');
      throw new Error(
        `WTR-LAB blocked automated verification in headless Chromium. Title: "${title}". Body sample: ${bodyText.slice(
          0,
          180
        )}`
      );
    }
    await page.evaluate(WTR_LAB_BOOTSTRAP_SCRIPT);

    async function bridge<T>(type: 'search' | 'details' | 'chapter', payload: Record<string, unknown>) {
      return page.evaluate(
        async request => {
          return (window as any).__MIYO_WTR_BRIDGE.execute(request);
        },
        { type, payload }
      ) as Promise<T>;
    }

    const search = await bridge<WtrLabSearchResult>('search', {
      query: '',
      descriptionQuery: '',
      page: 1,
      latestOnly: false,
      orderBy: 'update',
      order: 'desc',
      status: 'all',
      minChapters: 20,
      maxChapters: null,
      minRating: null,
      minReviewCount: null,
    });

    if (!search.items.length) {
      throw new Error('WTR live search returned no novels.');
    }

    const candidateResults = search.items.slice(0, 5);
    const verifiedDetails: WtrLabNovelDetails[] = [];

    for (const item of candidateResults) {
      const details = await bridge<WtrLabNovelDetails>('details', {
        rawId: item.rawId,
        slug: item.slug,
        path: item.path,
        includeChapters: true,
      });
      if (details.coverUrl && details.summary && details.summary.length > 24 && details.chapters.length > 0) {
        verifiedDetails.push(details);
      }
      if (verifiedDetails.length === 2) break;
    }

    if (!verifiedDetails.length) {
      throw new Error('Could not verify a WTR novel with cover, description, and chapters.');
    }

    const chapterChecks: Array<{
      title: string;
      chapter: WtrLabChapterContent;
    }> = [];

    for (const detail of verifiedDetails) {
      const chapterTarget = detail.chapters[0];
      if (!chapterTarget) continue;
      const chapter = await bridge<WtrLabChapterContent>('chapter', {
        rawId: detail.rawId,
        slug: detail.slug,
        chapterNo: chapterTarget.order,
        chapterTitle: chapterTarget.title,
      });
      if (!chapter.html || chapter.html.length < 60) {
        throw new Error(`Chapter fetch was too short for ${detail.title}.`);
      }
      chapterChecks.push({
        title: detail.title,
        chapter,
      });
    }

    if (!chapterChecks.length) {
      throw new Error('Chapter verification did not complete.');
    }

    const summary = {
      verifiedNovels: verifiedDetails.map(detail => ({
        title: detail.title,
        cover: detail.coverUrl,
        summaryLength: detail.summary.length,
        chapterCount: detail.chapters.length,
      })),
      chapterChecks: chapterChecks.map(check => ({
        title: check.title,
        chapterTitle: check.chapter.title,
        htmlLength: check.chapter.html.length,
      })),
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
