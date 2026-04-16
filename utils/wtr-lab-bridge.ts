import type { OnlineMtlProviderId, WtrLabBridgeMessage, WtrLabBridgeRequest } from '@/types/wtr-lab';

export const WTR_LAB_BASE_URL = 'https://wtr-lab.com/';
export const WTR_LAB_START_URL = 'https://wtr-lab.com/en/novel-finder';
export const WTR_LAB_MESSAGE_SCOPE = 'wtr-lab';

export const ONLINE_MTL_PROVIDERS: {
  id: OnlineMtlProviderId;
  label: string;
  description: string;
  startUrl: string;
  requiresBrowserVerification?: boolean;
}[] = [
  {
    id: 'wtr-lab',
    label: 'WTR-LAB',
    description: 'Protected browser bridge with live verification-aware search and export.',
    startUrl: WTR_LAB_START_URL,
    requiresBrowserVerification: true,
  },
  {
    id: 'fanmtl',
    label: 'FanMTL',
    description: 'Fan-fiction-heavy MTL catalog with HTML chapters and paged chapter lists.',
    startUrl: 'https://www.fanmtl.com/search.html',
  },
  {
    id: 'wuxiaspot',
    label: 'WuxiaSpot',
    description: 'WuxiaSpot HTML source with the same paged novel/chapter structure as FanMTL.',
    startUrl: 'https://www.wuxiaspot.com/search.html',
  },
];

export function getProviderStartUrl(providerId: OnlineMtlProviderId) {
  return ONLINE_MTL_PROVIDERS.find(provider => provider.id === providerId)?.startUrl || WTR_LAB_START_URL;
}

export const WTR_LAB_BOOTSTRAP_SCRIPT = String.raw`
(function () {
  function post(payload) {
    if (!window.ReactNativeWebView) return;
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  var PROVIDERS = {
    'wtr-lab': {
      id: 'wtr-lab',
      label: 'WTR-LAB',
      baseUrl: 'https://wtr-lab.com/',
      startUrl: 'https://wtr-lab.com/en/novel-finder'
    },
    fanmtl: {
      id: 'fanmtl',
      label: 'FanMTL',
      baseUrl: 'https://www.fanmtl.com/',
      startUrl: 'https://www.fanmtl.com/search.html'
    },
    wuxiaspot: {
      id: 'wuxiaspot',
      label: 'WuxiaSpot',
      baseUrl: 'https://www.wuxiaspot.com/',
      startUrl: 'https://www.wuxiaspot.com/search.html'
    }
  };

  function detectProviderId() {
    var host = String(location.hostname || '').toLowerCase();
    if (host.indexOf('fanmtl.com') !== -1) return 'fanmtl';
    if (host.indexOf('wuxiaspot.com') !== -1) return 'wuxiaspot';
    return 'wtr-lab';
  }

  function getProvider(providerId) {
    return PROVIDERS[providerId] || PROVIDERS[detectProviderId()] || PROVIDERS['wtr-lab'];
  }

  function pageTextSample() {
    try {
      return String((document.body && document.body.innerText) || '').slice(0, 800);
    } catch (_error) {
      return '';
    }
  }

  function isChallengePage(providerId) {
    if (providerId !== 'wtr-lab') return false;
    var title = String(document.title || '').toLowerCase();
    var body = pageTextSample().toLowerCase();
    return (
      title.indexOf('just a moment') !== -1 ||
      body.indexOf('security verification') !== -1 ||
      body.indexOf('captcha') !== -1 ||
      body.indexOf('verify you are human') !== -1 ||
      body.indexOf('protect against malicious bots') !== -1
    );
  }

  var detectedProviderId = detectProviderId();

  if (window.__MIYO_WTR_BRIDGE_READY && window.__MIYO_WTR_BRIDGE_PROVIDER === detectedProviderId) {
    if (isChallengePage(detectedProviderId)) {
      post({
        scope: 'wtr-lab',
        type: 'challenge',
        providerId: detectedProviderId,
        title: document.title || 'Verification required',
        body: pageTextSample(),
      });
    } else {
      post({ scope: 'wtr-lab', type: 'ready', providerId: detectedProviderId });
    }
    return true;
  }

  if (isChallengePage(detectedProviderId)) {
    post({
      scope: 'wtr-lab',
      type: 'challenge',
      providerId: detectedProviderId,
      title: document.title || 'Verification required',
      body: pageTextSample(),
    });
    return true;
  }

  var SEARCH_KEY = 'TextEncoder().encode("';

  function asText(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      if (typeof value.text === 'string') return value.text.trim();
      if (typeof value['#text'] === 'string') return value['#text'].trim();
    }
    return '';
  }

  function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
  }

  function absUrl(input, providerId) {
    if (!input) return null;
    try {
      return new URL(input, getProvider(providerId).baseUrl).toString();
    } catch (_error) {
      return input;
    }
  }

  function parsePath(input, providerId) {
    if (!input) return '';
    try {
      return new URL(input, getProvider(providerId).baseUrl).pathname;
    } catch (_error) {
      return String(input);
    }
  }

  function stripHtml(html) {
    if (!html) return '';
    var doc = new DOMParser().parseFromString(String(html), 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function cleanText(text) {
    return String(text || '')
      .replace(/Auto generated hidden content[\s\S]*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sanitizeHtml(html) {
    var text = String(html || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<ins\b[^>]*>[\s\S]*?<\/ins>/gi, '')
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
      .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
      .replace(/\s(href|src)\s*=\s*"javascript:[^"]*"/gi, ' $1="#"')
      .replace(/\s(href|src)\s*=\s*'javascript:[^']*'/gi, " $1='#'");
    return text.replace(/Auto generated hidden content[\s\S]*$/i, '');
  }

  function statusLabel(value) {
    if (value === 0 || value === '0') return 'Ongoing';
    if (value === 1 || value === '1') return 'Completed';
    if (value === 2 || value === '2') return 'Hiatus';
    if (!value) return 'Unknown';
    var text = String(value).trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function normalizeText(value) {
    return cleanText(value).toLowerCase();
  }

  function matchesCombinedQuery(item, query) {
    if (!query) return true;
    var needle = normalizeText(query);
    var haystacks = [
      item && item.title,
      item && item.author,
      item && item.summary,
      item && item.slug,
      item && item.status,
      item && item.path,
      item && item.providerLabel,
      item && item.genres ? item.genres.join(' ') : '',
      item && item.tags ? item.tags.join(' ') : '',
    ];
    for (var i = 0; i < haystacks.length; i += 1) {
      if (normalizeText(haystacks[i]).indexOf(needle) !== -1) return true;
    }
    return false;
  }

  function parseNumber(value) {
    var match = String(value || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  }

  function pickChapterCount(source) {
    var candidates = [
      source && source.chapter_count,
      source && source.chapterCount,
      source && source.total_chapters,
      source && source.totalChapters,
      source && source.chapters_count,
      source && source.count_chapter,
      source && source.chapter,
      source && source.total,
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var raw = candidates[i];
      if (raw == null || raw === '') continue;
      var parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  function pickRating(source) {
    var candidates = [
      source && source.rating,
      source && source.score,
      source && source.average_rating,
      source && source.avg_rating,
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var raw = candidates[i];
      if (raw == null || raw === '') continue;
      var parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  function dedupe(items) {
    var seen = {};
    var output = [];
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var key = [item.providerId || '', item.rawId || '', item.path || '', item.title || ''].join('::');
      if (seen[key]) continue;
      seen[key] = true;
      output.push(item);
    }
    return output;
  }

  function applySearchFilters(items, payload) {
    var minChapters = payload && payload.minChapters != null && payload.minChapters !== '' ? Number(payload.minChapters) : null;
    var maxChapters = payload && payload.maxChapters != null && payload.maxChapters !== '' ? Number(payload.maxChapters) : null;
    var status = payload && payload.status ? String(payload.status) : 'all';
    var query = payload && payload.query ? String(payload.query).trim() : '';

    return items.filter(function (item) {
      var count = item.chapterCount;
      if (minChapters != null && (count == null || count < minChapters)) return false;
      if (maxChapters != null && count != null && count > maxChapters) return false;
      if (status !== 'all' && normalizeText(item.status) !== normalizeText(status)) return false;
      if (!matchesCombinedQuery(item, query)) return false;
      return true;
    });
  }

  function sortItems(items, payload) {
    var orderBy = payload && payload.orderBy ? String(payload.orderBy) : 'update';
    var order = payload && payload.order === 'asc' ? 1 : -1;
    var copy = items.slice();
    copy.sort(function (a, b) {
      if (orderBy === 'name') {
        return normalizeText(a.title).localeCompare(normalizeText(b.title)) * order;
      }
      if (orderBy === 'chapter') {
        return ((a.chapterCount || 0) - (b.chapterCount || 0)) * order;
      }
      if (orderBy === 'rating') {
        return ((a.rating || 0) - (b.rating || 0)) * order;
      }
      return 0;
    });
    return copy;
  }

  function nextDataFromDocument(doc) {
    var node = doc && doc.getElementById('__NEXT_DATA__');
    if (!node || !node.textContent) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (_error) {
      return null;
    }
  }

  function nextDataFromHtml(html) {
    return nextDataFromDocument(new DOMParser().parseFromString(html, 'text/html'));
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function fetchText(url, init) {
    var response = await fetch(url, Object.assign({
      credentials: 'include',
      headers: {
        accept: 'text/html,application/json,application/xhtml+xml',
      },
    }, init || {}));
    if (!response.ok) {
      throw new Error('Request failed (' + response.status + ')');
    }
    return response.text();
  }

  async function fetchTextWithMeta(url, init) {
    var response = await fetch(url, Object.assign({
      credentials: 'include',
      headers: {
        accept: 'text/html,application/json,application/xhtml+xml',
      },
    }, init || {}));
    if (!response.ok) {
      throw new Error('Request failed (' + response.status + ')');
    }
    return {
      text: await response.text(),
      url: response.url || url,
    };
  }

  async function fetchJson(url, init) {
    var response = await fetch(url, Object.assign({
      credentials: 'include',
      headers: {
        accept: 'application/json,text/plain,*/*',
      },
    }, init || {}));
    if (!response.ok) {
      throw new Error('Request failed (' + response.status + ')');
    }
    return response.json();
  }

  async function getBuildId() {
    for (var attempt = 0; attempt < 25; attempt += 1) {
      var current = nextDataFromDocument(document);
      if (current && current.buildId) return current.buildId;
      await delay(800);
    }

    var html = await fetchText('https://wtr-lab.com/en/novel-finder');
    var parsed = nextDataFromHtml(html);
    if (parsed && parsed.buildId) return parsed.buildId;

    throw new Error('WTR-LAB did not finish loading its novel finder data.');
  }

  function mapSeriesItem(item) {
    var data = (item && item.data) || item || {};
    var rawId = Number(item && (item.raw_id || item.rawId || data.raw_id || data.rawId || data.id || item.id));
    var slug = String((item && (item.slug || data.slug)) || '');
    return {
      providerId: 'wtr-lab',
      providerLabel: 'WTR-LAB',
      rawId: rawId,
      slug: slug,
      path: '/en/novel/' + rawId + '/' + slug,
      title: asText(data.title || (item && item.title) || slug || 'Untitled'),
      coverUrl: absUrl(data.image || data.cover || (item && item.image) || (item && item.cover), 'wtr-lab'),
      author: asText(data.author || (item && item.author) || 'Unknown Author'),
      summary: cleanText(stripHtml(data.description || data.summary || data.synopsis || (item && item.description) || '')),
      status: statusLabel(data.status || (item && item.status)),
      chapterCount: pickChapterCount(data) || pickChapterCount(item),
      rating: pickRating(data) || pickRating(item),
    };
  }

  async function recentNovels(page, payload) {
    var json = await fetchJson('https://wtr-lab.com/api/home/recent', {
      method: 'POST',
      headers: {
        accept: 'application/json,text/plain,*/*',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ page: page }),
    });
    var items = ensureArray(json && json.data).map(function (item) {
      return mapSeriesItem(item && item.serie ? item.serie : item);
    });
    items = sortItems(applySearchFilters(dedupe(items), payload), payload);
    return { items: items, page: page, hasMore: items.length >= 20, nextCursor: null };
  }

  async function enrichWtrResults(items) {
    var limit = Math.min(items.length, 8);
    var concurrency = Math.min(3, limit);
    var nextIndex = 0;
    var workers = [];

    function mergePreview(item, preview) {
      return Object.assign({}, item, {
        title: preview && preview.title ? preview.title : item.title,
        coverUrl: preview && preview.coverUrl ? preview.coverUrl : item.coverUrl,
        author: preview && preview.author ? preview.author : item.author,
        summary: preview && preview.summary ? preview.summary : item.summary,
        status: preview && preview.status && preview.status !== 'Unknown' ? preview.status : item.status,
        chapterCount: preview && preview.chapterCount ? preview.chapterCount : item.chapterCount,
        rating: preview && preview.rating ? preview.rating : item.rating,
      });
    }

    for (var workerIndex = 0; workerIndex < concurrency; workerIndex += 1) {
      workers.push((async function () {
        while (true) {
          var claimedIndex = nextIndex;
          nextIndex += 1;
          if (claimedIndex >= limit) return;
          try {
            var preview = await fetchWtrNovelDetails({
              rawId: items[claimedIndex].rawId,
              slug: items[claimedIndex].slug,
              path: items[claimedIndex].path,
              fallbackTitle: items[claimedIndex].title,
              fallbackCoverUrl: items[claimedIndex].coverUrl,
              fallbackAuthor: items[claimedIndex].author,
              fallbackSummary: items[claimedIndex].summary,
              fallbackStatus: items[claimedIndex].status,
              fallbackChapterCount: items[claimedIndex].chapterCount,
              includeChapters: false,
            });
            items[claimedIndex] = mergePreview(items[claimedIndex], preview);
          } catch (_error) {}
        }
      })());
    }

    await Promise.all(workers);
    return items;
  }

  async function finderSearch(payload) {
    var page = Number(payload && payload.page) || 1;
    var params = new URLSearchParams();
    params.set('page', String(page));
    params.set('orderBy', payload && payload.orderBy ? String(payload.orderBy) : 'update');
    params.set('order', payload && payload.order ? String(payload.order) : 'desc');

    var status = payload && payload.status ? String(payload.status) : 'all';
    if (status && status !== 'all') {
      params.set('status', status);
    }

    var query = payload && payload.query ? String(payload.query).trim() : '';
    if (query) {
      params.set('text', query);
    }

    if (payload && payload.minChapters != null && payload.minChapters !== '') {
      params.set('minc', String(payload.minChapters));
    }
    if (payload && payload.minRating != null && payload.minRating !== '') {
      params.set('minr', String(payload.minRating));
    }
    if (payload && payload.minReviewCount != null && payload.minReviewCount !== '') {
      params.set('minrc', String(payload.minReviewCount));
    }

    var buildId = await getBuildId();
    var url = 'https://wtr-lab.com/_next/data/' + buildId + '/en/novel-finder.json?' + params.toString();
    var json = await fetchJson(url);
    var series = (((json || {}).pageProps || {}).series) || [];
    var items = dedupe(series.map(mapSeriesItem));
    items = await enrichWtrResults(items);
    items = sortItems(applySearchFilters(items, payload), payload);
    return { items: items, page: page, hasMore: items.length >= 20, nextCursor: null };
  }

  async function searchWtr(payload) {
    var page = Number(payload && payload.page) || 1;
    if (payload && payload.latestOnly) {
      return recentNovels(page, payload);
    }
    return finderSearch(payload);
  }

  function parseGenres(doc, label) {
    var output = [];
    var rows = doc.querySelectorAll('td');
    for (var i = 0; i < rows.length; i += 1) {
      var cell = rows[i];
      if (!cell || !cell.textContent) continue;
      if (cell.textContent.toLowerCase().indexOf(label) === -1) continue;
      var sibling = cell.nextElementSibling;
      if (!sibling) continue;
      var links = sibling.querySelectorAll('a');
      for (var j = 0; j < links.length; j += 1) {
        var text = asText(links[j].textContent || '');
        if (text && output.indexOf(text) === -1) output.push(text);
      }
    }
    if (output.length) return output;

    var hrefHints = label === 'genre'
      ? ['/genre/', '/genres/', '/theme/', '/themes/']
      : ['/tag/', '/tags/'];
    var links = doc.querySelectorAll('a[href]');
    for (var k = 0; k < links.length; k += 1) {
      var href = String(links[k].getAttribute('href') || '').toLowerCase();
      var matches = false;
      for (var hintIndex = 0; hintIndex < hrefHints.length; hintIndex += 1) {
        if (href.indexOf(hrefHints[hintIndex]) !== -1) {
          matches = true;
          break;
        }
      }
      if (!matches) continue;
      var value = asText(links[k].textContent || '');
      if (value && output.indexOf(value) === -1) output.push(value);
    }
    return output;
  }

  async function fetchAllChapters(rawId, slug, totalChapters) {
    var output = [];
    var batchSize = 250;
    var start = 1;
    var loops = 0;

    while (loops < 40) {
      var end = totalChapters ? Math.min(start + batchSize - 1, totalChapters) : start + batchSize - 1;
      var json = await fetchJson('https://wtr-lab.com/api/chapters/' + rawId + '?start=' + start + '&end=' + end);
      var chapters = ensureArray(json && json.chapters);
      if (!chapters.length) break;

      for (var i = 0; i < chapters.length; i += 1) {
        var chapter = chapters[i] || {};
        var order = Number(chapter.order || chapter.chapter_no || chapter.chapterNumber || start + i);
        output.push({
          order: order,
          title: asText(chapter.title || chapter.name || 'Chapter ' + order),
          path: '/en/novel/' + rawId + '/' + slug + '/chapter-' + order,
          updatedAt: chapter.updated_at || chapter.updatedAt || null,
        });
      }

      if (chapters.length < batchSize) break;
      start += batchSize;
      if (totalChapters && start > totalChapters) break;
      loops += 1;
    }

    output.sort(function (a, b) { return a.order - b.order; });
    return output;
  }

  async function fetchWtrNovelDetails(payload) {
    var rawId = Number(payload && payload.rawId);
    var slug = String((payload && payload.slug) || '');
    var path = payload && payload.path ? String(payload.path) : '/en/novel/' + rawId + '/' + slug;
    var html = await fetchText('https://wtr-lab.com' + path);
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var nextData = nextDataFromDocument(doc);
    var serieData = nextData && nextData.props && nextData.props.pageProps && nextData.props.pageProps.serie && nextData.props.pageProps.serie.serie_data
      ? nextData.props.pageProps.serie.serie_data
      : null;
    var data = serieData && serieData.data ? serieData.data : {};
    rawId = rawId || Number(serieData && serieData.raw_id);
    slug = slug || String((serieData && serieData.slug) || '');

    var chapterCount = pickChapterCount(serieData) || pickChapterCount(data);
    var titleNode =
      doc.querySelector('h1') ||
      doc.querySelector('meta[property="og:title"]') ||
      doc.querySelector('meta[name="twitter:title"]');
    var authorNode =
      doc.querySelector('[itemprop="author"]') ||
      doc.querySelector('[rel="author"]') ||
      doc.querySelector('.author a') ||
      doc.querySelector('.author') ||
      doc.querySelector('.novel-author');
    var summaryNode =
      doc.querySelector('[itemprop="description"]') ||
      doc.querySelector('.summary') ||
      doc.querySelector('.lead') ||
      doc.querySelector('meta[property="og:description"]') ||
      doc.querySelector('meta[name="twitter:description"]') ||
      doc.querySelector('meta[name="description"]');
    var coverNode =
      doc.querySelector('meta[property="og:image"]') ||
      doc.querySelector('meta[name="twitter:image"]') ||
      doc.querySelector('.cover img') ||
      doc.querySelector('img[src*="/cover"]') ||
      doc.querySelector('img');
    var resolvedTitle = asText(
      data.title ||
      (titleNode && (titleNode.getAttribute && titleNode.getAttribute('content') ? titleNode.getAttribute('content') : titleNode.textContent)) ||
      (payload && payload.fallbackTitle) ||
      ''
    );
    var resolvedCoverUrl = absUrl(
      data.image ||
      data.cover ||
      (coverNode && (coverNode.getAttribute('content') || coverNode.getAttribute('data-src') || coverNode.getAttribute('src'))) ||
      (payload && payload.fallbackCoverUrl) ||
      '',
      'wtr-lab'
    );
    var resolvedSummary = cleanText(stripHtml(
      data.description ||
      data.summary ||
      data.synopsis ||
      (summaryNode && (summaryNode.getAttribute && summaryNode.getAttribute('content') ? summaryNode.getAttribute('content') : summaryNode.innerHTML)) ||
      (payload && payload.fallbackSummary) ||
      ''
    ));
    var resolvedAuthor = asText(
      data.author ||
      (authorNode && (authorNode.getAttribute && authorNode.getAttribute('content') ? authorNode.getAttribute('content') : authorNode.textContent)) ||
      (payload && payload.fallbackAuthor) ||
      ''
    );
    var resolvedStatus = statusLabel((serieData && serieData.status) || data.status || (payload && payload.fallbackStatus));
    var details = {
      providerId: 'wtr-lab',
      providerLabel: 'WTR-LAB',
      rawId: rawId,
      slug: slug,
      path: path,
      title: resolvedTitle || 'Untitled',
      coverUrl: resolvedCoverUrl || null,
      author: resolvedAuthor || 'Unknown Author',
      summary: resolvedSummary,
      status: resolvedStatus || 'Unknown',
      chapterCount: chapterCount || Number(payload && payload.fallbackChapterCount) || null,
      rating: pickRating(data) || pickRating(serieData),
      genres: parseGenres(doc, 'genre'),
      tags: parseGenres(doc, 'tag'),
      chapters: [],
    };

    if (payload && payload.includeChapters === false) {
      return details;
    }

    details.chapters = await fetchAllChapters(rawId, slug, chapterCount);
    if (!details.chapterCount) details.chapterCount = details.chapters.length;
    return details;
  }

  function base64ToBytes(input) {
    var binary = atob(input);
    var length = binary.length;
    var bytes = new Uint8Array(length);
    for (var i = 0; i < length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function extractEncryptionKey(pagePath) {
    var html = await fetchText('https://wtr-lab.com' + pagePath);
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var scripts = doc.querySelectorAll('script[src]');
    for (var i = 0; i < scripts.length; i += 1) {
      var src = scripts[i].getAttribute('src');
      if (!src) continue;
      try {
        var body = await fetchText(absUrl(src, 'wtr-lab'));
        var index = body.indexOf(SEARCH_KEY);
        if (index >= 0) {
          return body.substring(index + SEARCH_KEY.length, index + SEARCH_KEY.length + 32);
        }
      } catch (_error) {}
    }
    throw new Error('Failed to extract the reader encryption key.');
  }

  async function decryptPayload(encrypted, key) {
    var isArray = false;
    var body = encrypted;
    if (body.indexOf('arr:') === 0) {
      isArray = true;
      body = body.substring(4);
    } else if (body.indexOf('str:') === 0) {
      body = body.substring(4);
    }
    var parts = body.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted chapter payload.');
    var iv = base64ToBytes(parts[0]);
    var tag = base64ToBytes(parts[1]);
    var ciphertext = base64ToBytes(parts[2]);
    var combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext);
    combined.set(tag, ciphertext.length);

    var keyBytes = new TextEncoder().encode(String(key).slice(0, 32));
    var cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
    var decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, cryptoKey, combined);
    var text = new TextDecoder().decode(decrypted);
    return isArray ? JSON.parse(text) : text;
  }

  async function translateLines(lines) {
    if (!lines || !lines.length) return [];
    var payload = lines.map(function (line, index) {
      return '<a i=' + index + '>' + line + '</a>';
    });
    var response = await fetch('https://translate-pa.googleapis.com/v1/translateHtml', {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'content-type': 'application/json+protobuf',
        'X-Goog-API-Key': 'AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520',
      },
      referrer: 'https://wtr-lab.com/',
      body: '[[' + JSON.stringify(payload) + ',"zh-CN","en"],"te_lib"]',
    });
    if (!response.ok) throw new Error('Line translation failed (' + response.status + ')');
    var json = await response.json();
    return json && json[0] ? json[0] : [];
  }

  function glossaryMap(glossaryData) {
    var output = {};
    if (!glossaryData || !glossaryData.terms || !Array.isArray(glossaryData.terms)) {
      return output;
    }
    for (var i = 0; i < glossaryData.terms.length; i += 1) {
      output['※' + i + '⛬'] = glossaryData.terms[i][0];
    }
    return output;
  }

  function contentToHtml(content, glossary) {
    var replacements = glossaryMap(glossary);
    if (Array.isArray(content)) {
      return content.map(function (line) {
        var nextLine = String(line);
        Object.keys(replacements).forEach(function (token) {
          nextLine = nextLine.split(token).join(replacements[token]);
        });
        return '<p>' + nextLine + '</p>';
      }).join('');
    }

    var text = String(content || '');
    if (text.indexOf('<') >= 0) return sanitizeHtml(text);
    return '<p>' + text + '</p>';
  }

  async function fetchWtrChapter(payload) {
    var rawId = Number(payload && payload.rawId);
    var slug = String((payload && payload.slug) || '');
    var chapterNo = Number(payload && payload.chapterNo);
    var chapterTitle = String((payload && payload.chapterTitle) || ('Chapter ' + chapterNo));
    var path = payload && payload.path ? String(payload.path) : '/en/novel/' + rawId + '/' + slug + '/chapter-' + chapterNo;
    var translationTypes = ['ai', 'web'];
    var result = null;
    var readerError = '';

    for (var i = 0; i < translationTypes.length; i += 1) {
      var response = await fetch('https://wtr-lab.com/api/reader/get', {
        method: 'POST',
        credentials: 'include',
        headers: {
          accept: 'application/json,text/plain,*/*',
          'content-type': 'application/json',
        },
        referrer: 'https://wtr-lab.com' + path,
        body: JSON.stringify({
          translate: translationTypes[i],
          language: 'en',
          raw_id: rawId,
          chapter_no: chapterNo,
          retry: false,
          force_retry: false,
        }),
      });
      result = await response.json();
      if (response.ok && !(result && result.error)) break;
      readerError = result && (result.error || result.message) ? String(result.error || result.message) : readerError;
    }

    if (!result || result.success === false) {
      throw new Error(readerError || 'Could not fetch the requested chapter.');
    }

    var content = result.data && result.data.data ? result.data.data.body : null;
    var glossary = result.data && result.data.data ? result.data.data.glossary_data : null;
    if (typeof content === 'string' && (content.indexOf('arr:') === 0 || content.indexOf('str:') === 0)) {
      var key = await extractEncryptionKey(path);
      var decrypted = await decryptPayload(content, key);
      content = Array.isArray(decrypted) ? await translateLines(decrypted) : decrypted;
    }

    var html = contentToHtml(content, glossary);
    if (readerError) {
      html = '<p><small>' + readerError + '</small></p>' + html;
    }

    return {
      order: chapterNo,
      title: chapterTitle,
      html: sanitizeHtml(html),
    };
  }

  function parseSiteNovelList(doc, providerId) {
    var provider = getProvider(providerId);
    var items = [];
    var nodes = doc.querySelectorAll('ul.novel-list li.novel-item');
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var link = node.querySelector('a[href]');
      if (!link) continue;
      var path = parsePath(link.getAttribute('href'), providerId);
      var slugMatch = path.match(/\/novel\/([^/.]+)\.html$/);
      var slug = slugMatch ? slugMatch[1] : path.replace(/^\/+/, '');
      var title = asText((node.querySelector('.novel-title') && node.querySelector('.novel-title').textContent) || link.getAttribute('title') || 'Untitled');
      var coverNode = node.querySelector('img');
      var coverUrl = coverNode ? absUrl(coverNode.getAttribute('data-src') || coverNode.getAttribute('src'), providerId) : null;
      var stats = node.querySelectorAll('.novel-stats');
      var chapterCount = stats[0] ? parseNumber(stats[0].textContent) : null;
      var statusNode = node.querySelector('.status');
      var summaryNode = node.querySelector('p');
      items.push({
        providerId: provider.id,
        providerLabel: provider.label,
        rawId: slug,
        slug: slug,
        path: path,
        title: title,
        coverUrl: coverUrl,
        author: 'Unknown Author',
        summary: cleanText(stripHtml(summaryNode ? summaryNode.innerHTML : '')),
        status: asText(statusNode && statusNode.textContent) || 'Unknown',
        chapterCount: chapterCount,
        rating: null,
      });
    }
    return items;
  }

  function parseSiteOrder(path) {
    var match = String(path || '').match(/_(\d+)\.html?$/);
    return match ? Number(match[1]) : null;
  }

  function parseSiteChapterList(doc) {
    var items = [];
    var nodes = doc.querySelectorAll('ul.chapter-list li a[href]');
    for (var i = 0; i < nodes.length; i += 1) {
      var link = nodes[i];
      var path = parsePath(link.getAttribute('href'), detectProviderId());
      var order = parseSiteOrder(path);
      items.push({
        order: order || i + 1,
        title: asText(link.textContent || ('Chapter ' + (order || i + 1))),
        path: path,
        updatedAt: null,
      });
    }
    items.sort(function (a, b) { return a.order - b.order; });
    return dedupe(items.map(function (chapter) {
      return {
        providerId: 'chapters',
        providerLabel: '',
        rawId: chapter.path,
        slug: chapter.path,
        path: chapter.path,
        title: chapter.title,
        coverUrl: null,
        author: '',
        summary: '',
        status: '',
        chapterCount: chapter.order,
        rating: null,
        order: chapter.order,
        updatedAt: chapter.updatedAt,
      };
    })).map(function (chapter) {
      return {
        order: chapter.order,
        title: chapter.title,
        path: chapter.path,
        updatedAt: chapter.updatedAt,
      };
    });
  }

  function parseSiteSummary(doc) {
    var root =
      doc.querySelector('.summary .content') ||
      doc.querySelector('#info .summary .content') ||
      doc.querySelector('meta[name="description"]') ||
      doc.querySelector('.summary');
    if (!root) return '';
    var html = root.getAttribute && root.getAttribute('content') ? root.getAttribute('content') : root.innerHTML;
    return cleanText(stripHtml(html || ''));
  }

  function parseSiteAuthor(doc) {
    var node =
      doc.querySelector('.author [itemprop="author"]') ||
      doc.querySelector('.author a') ||
      doc.querySelector('.author span:last-child') ||
      doc.querySelector('[itemprop="author"]');
    return asText(node && node.textContent) || 'Unknown Author';
  }

  function parseSiteStatus(doc) {
    var nodes = doc.querySelectorAll('.header-stats strong');
    if (nodes && nodes.length > 1) {
      return asText(nodes[1].textContent) || 'Unknown';
    }
    var statusNode = doc.querySelector('.status');
    return asText(statusNode && statusNode.textContent) || 'Unknown';
  }

  function parseSiteChapterCount(doc) {
    var node = doc.querySelector('.header-stats strong');
    return parseNumber(node && node.textContent);
  }

  function parseSiteCoverUrl(doc, providerId) {
    var node =
      doc.querySelector('.cover img') ||
      doc.querySelector('meta[property="og:image"]') ||
      doc.querySelector('img[data-src]') ||
      doc.querySelector('img[src]');
    if (!node) return null;
    return absUrl(
      node.getAttribute('content') || node.getAttribute('data-src') || node.getAttribute('src') || '',
      providerId
    );
  }

  function parseSiteGenres(doc) {
    var genres = [];
    var nodes = doc.querySelectorAll('.categories .property-item');
    for (var i = 0; i < nodes.length; i += 1) {
      var text = asText(nodes[i].textContent);
      if (text && genres.indexOf(text) === -1) genres.push(text);
    }
    return genres;
  }

  function parseSiteTags(doc) {
    var tags = [];
    var nodes = doc.querySelectorAll('.categories .tag, .tags .content .tag');
    for (var i = 0; i < nodes.length; i += 1) {
      var text = asText(nodes[i].textContent);
      if (text && tags.indexOf(text) === -1) tags.push(text);
    }
    return tags;
  }

  async function fetchSiteNovelDetails(payload, providerId) {
    var provider = getProvider(providerId);
    var path = parsePath(payload && payload.path ? String(payload.path) : '', providerId);
    var slug = String((payload && payload.slug) || (path.match(/\/novel\/([^/.]+)\.html$/) || [])[1] || '');
    if (!path) {
      path = '/novel/' + slug + '.html';
    }

    var html = await fetchText(absUrl(path + (path.indexOf('?') === -1 ? '?tab=chapters' : '&tab=chapters'), providerId));
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var details = {
      providerId: provider.id,
      providerLabel: provider.label,
      rawId: slug || path,
      slug: slug || path,
      path: path,
      title: asText(
        (doc.querySelector('.novel-title') && doc.querySelector('.novel-title').textContent) ||
        (payload && payload.fallbackTitle) ||
        'Untitled'
      ),
      coverUrl: parseSiteCoverUrl(doc, providerId) || (payload && payload.fallbackCoverUrl) || null,
      author: parseSiteAuthor(doc) || asText(payload && payload.fallbackAuthor) || 'Unknown Author',
      summary: parseSiteSummary(doc) || asText(payload && payload.fallbackSummary),
      status: parseSiteStatus(doc) || asText(payload && payload.fallbackStatus) || 'Unknown',
      chapterCount: parseSiteChapterCount(doc) || Number(payload && payload.fallbackChapterCount) || null,
      rating: null,
      genres: parseSiteGenres(doc),
      tags: parseSiteTags(doc),
      chapters: [],
    };

    if (payload && payload.includeChapters === false) {
      return details;
    }

    var chapters = parseSiteChapterList(doc);
    var paginationNodes = doc.querySelectorAll('#chpagedlist .pagination a[href*="/e/extend/fy.php"]');
    var pageUrls = [];
    for (var i = 0; i < paginationNodes.length; i += 1) {
      var href = paginationNodes[i].getAttribute('href');
      if (!href) continue;
      var normalized = absUrl(href, providerId);
      if (pageUrls.indexOf(normalized) === -1) pageUrls.push(normalized);
    }

    for (var p = 0; p < pageUrls.length; p += 1) {
      var pageHtml = await fetchText(pageUrls[p]);
      var pageDoc = new DOMParser().parseFromString(pageHtml, 'text/html');
      chapters = chapters.concat(parseSiteChapterList(pageDoc));
    }

    var seen = {};
    details.chapters = chapters.filter(function (chapter) {
      var key = chapter.path;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).sort(function (a, b) { return a.order - b.order; });

    if (!details.chapterCount) {
      details.chapterCount = details.chapters.length;
    }

    return details;
  }

  async function enrichSiteResults(items, providerId, query) {
    var limit = Math.min(items.length, query ? 12 : 6);
    var concurrency = Math.min(4, limit);
    var nextIndex = 0;
    var workers = [];

    for (var workerIndex = 0; workerIndex < concurrency; workerIndex += 1) {
      workers.push((async function () {
        while (true) {
          var claimedIndex = nextIndex;
          nextIndex += 1;
          if (claimedIndex >= limit) return;
          try {
            var preview = await fetchSiteNovelDetails({
              slug: items[claimedIndex].slug,
              path: items[claimedIndex].path,
              fallbackTitle: items[claimedIndex].title,
              fallbackCoverUrl: items[claimedIndex].coverUrl,
              fallbackAuthor: items[claimedIndex].author,
              fallbackSummary: items[claimedIndex].summary,
              fallbackStatus: items[claimedIndex].status,
              fallbackChapterCount: items[claimedIndex].chapterCount,
              includeChapters: false,
            }, providerId);
            items[claimedIndex] = Object.assign({}, items[claimedIndex], {
              title: preview.title || items[claimedIndex].title,
              coverUrl: preview.coverUrl || items[claimedIndex].coverUrl,
              author: preview.author || items[claimedIndex].author,
              summary: preview.summary || items[claimedIndex].summary,
              status: preview.status || items[claimedIndex].status,
              chapterCount: preview.chapterCount || items[claimedIndex].chapterCount,
            });
          } catch (_error) {}
        }
      })());
    }

    await Promise.all(workers);

    if (query) {
      return items.filter(function (item) {
        return matchesCombinedQuery(item, query);
      });
    }

    return items;
  }

  function parseNextCursor(doc, providerId, currentPage) {
    var links = doc.querySelectorAll('.pagination a[href]');
    if (!links || !links.length) return null;

    function pageIndexFromHref(href) {
      var absolute = absUrl(href, providerId);
      if (!absolute) return null;
      try {
        var url = new URL(absolute);
        var param = url.searchParams.get('page');
        if (param != null && param !== '') {
          var parsedParam = Number(param);
          if (!Number.isNaN(parsedParam)) return parsedParam;
        }
      } catch (_error) {}
      var match = absolute.match(/-(\d+)\.html?(?:\?|$)/);
      if (!match) return null;
      var parsedPath = Number(match[1]);
      return Number.isNaN(parsedPath) ? null : parsedPath;
    }

    var targetIndex = Math.max(1, Number(currentPage) || 1) - 1;
    for (var i = 0; i < links.length; i += 1) {
      var href = links[i].getAttribute('href');
      if (!href) continue;
      if (pageIndexFromHref(href) === targetIndex + 1) {
        return absUrl(href, providerId);
      }
    }

    for (var j = 0; j < links.length; j += 1) {
      var label = asText(links[j].textContent);
      if (label === '>') {
        return absUrl(links[j].getAttribute('href'), providerId);
      }
    }

    return null;
  }

  async function searchSite(payload, providerId) {
    var provider = getProvider(providerId);
    var query = payload && payload.query ? String(payload.query).trim() : '';
    var page = Number(payload && payload.page) || 1;
    var response;

    if (payload && payload.cursor) {
      response = await fetchTextWithMeta(String(payload.cursor));
    } else if (query) {
      var body = new URLSearchParams();
      body.set('show', 'title');
      body.set('tempid', '1');
      body.set('tbname', 'news');
      body.set('keyboard', query);
      response = await fetchTextWithMeta(absUrl('/e/search/index.php', providerId), {
        method: 'POST',
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
    } else {
      response = await fetchTextWithMeta(absUrl('/list/all/all-newstime-' + Math.max(0, page - 1) + '.html', providerId));
    }

    var doc = new DOMParser().parseFromString(response.text, 'text/html');
    var items = parseSiteNovelList(doc, providerId);
    items = await enrichSiteResults(items, providerId, query);
    items = sortItems(applySearchFilters(dedupe(items), payload), payload);
    var nextCursor = parseNextCursor(doc, providerId, page);
    return {
      items: items,
      page: page,
      hasMore: Boolean(nextCursor),
      nextCursor: nextCursor,
    };
  }

  async function fetchSiteChapter(payload, providerId) {
    var path = parsePath(payload && payload.path ? String(payload.path) : '', providerId);
    if (!path) {
      var slug = String((payload && payload.slug) || '');
      var chapterNo = Number(payload && payload.chapterNo);
      path = '/novel/' + slug + '_' + chapterNo + '.html';
    }
    var html = await fetchText(absUrl(path, providerId));
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var contentNode = doc.querySelector('.chapter-content');
    if (!contentNode) {
      throw new Error('Could not locate the chapter content.');
    }

    var junk = contentNode.querySelectorAll('script, style, iframe, ins, [align="center"]');
    for (var i = 0; i < junk.length; i += 1) {
      if (junk[i] && junk[i].parentNode) junk[i].parentNode.removeChild(junk[i]);
    }

    var titleNode = doc.querySelector('#chapter-article .titles h2') || doc.querySelector('h2');
    var order = parseSiteOrder(path) || Number(payload && payload.chapterNo) || 1;
    return {
      order: order,
      title: asText((titleNode && titleNode.textContent) || (payload && payload.chapterTitle) || ('Chapter ' + order)),
      html: sanitizeHtml(contentNode.innerHTML || ''),
    };
  }

  async function executeRequest(request) {
    var payload = request && request.payload ? request.payload : {};
    var providerId = payload && payload.providerId ? String(payload.providerId) : detectProviderId();

    if (providerId === 'wtr-lab' && isChallengePage(providerId)) {
      throw new Error('Verification is required before WTR-LAB can load inside Miyo.');
    }

    if (request.type === 'search') {
      if (providerId === 'wtr-lab') return searchWtr(payload);
      return searchSite(payload, providerId);
    }
    if (request.type === 'details') {
      if (providerId === 'wtr-lab') return fetchWtrNovelDetails(payload);
      return fetchSiteNovelDetails(payload, providerId);
    }
    if (request.type === 'chapter') {
      if (providerId === 'wtr-lab') return fetchWtrChapter(payload);
      return fetchSiteChapter(payload, providerId);
    }
    throw new Error('Unsupported bridge request.');
  }

  window.__MIYO_WTR_BRIDGE = {
    execute: executeRequest,
    run: async function (request) {
      try {
        var result = await executeRequest(request);
        post({
          scope: 'wtr-lab',
          type: 'result',
          id: request.id,
          providerId: request && request.payload ? request.payload.providerId : detectProviderId(),
          payload: result
        });
      } catch (error) {
        post({
          scope: 'wtr-lab',
          type: 'error',
          id: request && request.id ? request.id : undefined,
          providerId: request && request.payload ? request.payload.providerId : detectProviderId(),
          error: error && error.message ? error.message : String(error),
        });
      }
    },
  };

  window.__MIYO_WTR_BRIDGE_READY = true;
  window.__MIYO_WTR_BRIDGE_PROVIDER = detectedProviderId;
  post({ scope: 'wtr-lab', type: 'ready', providerId: detectedProviderId });
  return true;
})();
`;

export function buildWtrBridgeCommand(request: WtrLabBridgeRequest): string {
  const providerId = ((request.payload && request.payload.providerId) || 'wtr-lab') as OnlineMtlProviderId;
  return `(function(){if(window.__MIYO_WTR_BRIDGE&&window.__MIYO_WTR_BRIDGE.run){window.__MIYO_WTR_BRIDGE.run(${JSON.stringify(
    request
  )});}else if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(${JSON.stringify(
    JSON.stringify({
      scope: WTR_LAB_MESSAGE_SCOPE,
      id: request.id,
      type: 'error',
      error: 'WTR bridge unavailable.',
      providerId,
    } satisfies WtrLabBridgeMessage)
  )});}})();true;`;
}

export function parseWtrBridgeMessage(raw: string): WtrLabBridgeMessage | null {
  try {
    const parsed = JSON.parse(raw) as WtrLabBridgeMessage;
    if (parsed.scope !== WTR_LAB_MESSAGE_SCOPE) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
