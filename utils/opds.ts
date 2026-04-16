import AsyncStorage from '@react-native-async-storage/async-storage';
import { XMLParser } from 'fast-xml-parser';
import { OpdsCatalog, OpdsEntry, OpdsFeed, OpdsLink } from '@/types/opds';

const OPDS_CATALOGS_KEY = '@miyo/opds-catalogs';
const OPDS_TIMEOUT_MS = 12000;

const DEFAULT_OPDS_CATALOGS: OpdsCatalog[] = [
  {
    id: 'default-gutenberg',
    title: 'Project Gutenberg',
    url: 'https://www.gutenberg.org/ebooks.opds/',
    addedAt: 'default',
    isDefault: true,
  },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: true,
  textNodeName: 'text',
});

export interface AddOpdsCatalogResult {
  catalogs: OpdsCatalog[];
  addedCatalog: OpdsCatalog;
  alreadySaved: boolean;
}

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function asText(value: any): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';
  if (typeof value.text === 'string') return value.text.trim();
  if (typeof value['#text'] === 'string') return value['#text'].trim();
  return '';
}

function normalizeCatalogUrl(url: string): string {
  const trimmed = url.trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const normalized = new URL(candidate);
  if (normalized.protocol !== 'https:') {
    throw new Error('Use an HTTPS OPDS catalog URL. Insecure feeds are blocked.');
  }

  const hostname = normalized.hostname.toLowerCase();
  const isPrivateIpv4 =
    /^10\./.test(hostname) ||
    /^127\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
  const isPrivateIpv6 =
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.startsWith('fc') ||
    hostname.startsWith('fd') ||
    hostname.startsWith('fe80:');

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    isPrivateIpv4 ||
    isPrivateIpv6
  ) {
    throw new Error('Private-network OPDS feeds are blocked. Use a public HTTPS catalog URL.');
  }

  return normalized.toString();
}

function mergeCatalogs(customCatalogs: OpdsCatalog[]): OpdsCatalog[] {
  const merged = [...DEFAULT_OPDS_CATALOGS];
  for (const catalog of customCatalogs) {
    if (!merged.some(item => item.url === catalog.url)) {
      merged.push(catalog);
    }
  }
  return merged;
}

function parseLinks(input: any, baseUrl: string): OpdsLink[] {
  return ensureArray(input)
    .map((link: any) => {
      const href = link?.href;
      if (!href) return null;
      return {
        href: new URL(href, baseUrl).toString(),
        rel: link?.rel || 'alternate',
        type: link?.type,
        title: link?.title,
      } as OpdsLink;
    })
    .filter(Boolean) as OpdsLink[];
}

function getFeedNavigation(feed: any, baseUrl: string) {
  const links = parseLinks(feed?.link, baseUrl);
  const selfLink =
    links.find(link => link.rel === 'self') ||
    links.find(link => link.rel.includes('self'));
  const nextLink =
    links.find(link => link.rel === 'next') ||
    links.find(link => link.rel.includes('next'));
  const previousLink =
    links.find(link => link.rel === 'previous') ||
    links.find(link => link.rel === 'prev') ||
    links.find(link => link.rel.includes('previous'));

  return {
    selfUrl: selfLink?.href,
    nextUrl: nextLink?.href,
    previousUrl: previousLink?.href,
  };
}

function parseEntries(feed: any, baseUrl: string): OpdsEntry[] {
  return ensureArray(feed?.entry).map((entry: any, index) => {
    const links = parseLinks(entry?.link, baseUrl);
    const acquisitionLinks = links.filter(link =>
      link.rel.includes('acquisition') || link.type === 'application/epub+zip'
    );
    const navigationLinks = links.filter(link => !acquisitionLinks.includes(link));
    const authors = ensureArray(entry?.author)
      .map(author => asText(author?.name || author))
      .filter(Boolean);
    const summary = asText(entry?.summary) || asText(entry?.content);
    const coverLink = links.find(link => link.rel.includes('image') && !link.rel.includes('thumbnail'));
    const thumbnailLink = links.find(link => link.rel.includes('thumbnail'));

    return {
      id: asText(entry?.id) || asText(entry?.title) || `${index}`,
      title: asText(entry?.title) || 'Untitled',
      author: authors.join(', ') || 'Unknown Author',
      summary,
      coverUrl: coverLink?.href,
      thumbnailUrl: thumbnailLink?.href,
      acquisitionLinks,
      navigationLinks,
    };
  });
}

export async function getSavedOpdsCatalogs(): Promise<OpdsCatalog[]> {
  const raw = await AsyncStorage.getItem(OPDS_CATALOGS_KEY);
  if (!raw) return DEFAULT_OPDS_CATALOGS;
  try {
    const parsed = JSON.parse(raw) as OpdsCatalog[];
    return mergeCatalogs(parsed.map(catalog => ({ ...catalog, isDefault: false })));
  } catch {
    return DEFAULT_OPDS_CATALOGS;
  }
}

async function saveCatalogs(catalogs: OpdsCatalog[]): Promise<void> {
  const customCatalogs = catalogs.filter(catalog => !catalog.isDefault);
  await AsyncStorage.setItem(OPDS_CATALOGS_KEY, JSON.stringify(customCatalogs));
}

export async function addOpdsCatalog(url: string, title?: string): Promise<AddOpdsCatalogResult> {
  const normalizedUrl = normalizeCatalogUrl(url);
  const validatedFeed = await fetchOpdsFeed(normalizedUrl);
  const canonicalUrl = validatedFeed.selfUrl || validatedFeed.url || normalizedUrl;
  const catalogs = await getSavedOpdsCatalogs();
  const existingCatalog = catalogs.find(catalog => catalog.url === canonicalUrl);
  if (existingCatalog) {
    return {
      catalogs,
      addedCatalog: existingCatalog,
      alreadySaved: true,
    };
  }
  const addedCatalog: OpdsCatalog = {
    id: `opds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: title?.trim() || validatedFeed.title || canonicalUrl,
    url: canonicalUrl,
    addedAt: new Date().toISOString(),
    isDefault: false,
  };
  const nextCatalogs = [
    ...catalogs,
    addedCatalog,
  ];
  await saveCatalogs(nextCatalogs);
  return {
    catalogs: nextCatalogs,
    addedCatalog,
    alreadySaved: false,
  };
}

export async function removeOpdsCatalog(catalogId: string): Promise<OpdsCatalog[]> {
  const catalogs = await getSavedOpdsCatalogs();
  const nextCatalogs = catalogs.filter(catalog => catalog.id !== catalogId || catalog.isDefault);
  await saveCatalogs(nextCatalogs);
  return nextCatalogs;
}

export async function fetchOpdsFeed(url: string): Promise<OpdsFeed> {
  const normalizedUrl = normalizeCatalogUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPDS_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(normalizedUrl, {
      headers: {
        Accept: 'application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The catalog took too long to respond.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('This catalog requires authentication or blocks anonymous app requests.');
  }

  if (!response.ok) {
    throw new Error(`Catalog request failed (${response.status})`);
  }

  const finalUrl = response.url || normalizedUrl;
  const xml = await response.text();
  if (!xml.includes('<feed')) {
    throw new Error('The response is not a valid OPDS feed.');
  }

  const parsed = parser.parse(xml);
  const feed = parsed?.feed;
  if (!feed) {
    throw new Error('Could not parse this OPDS feed.');
  }

  return {
    title: asText(feed?.title) || 'Catalog',
    url: finalUrl,
    entries: parseEntries(feed, finalUrl),
    ...getFeedNavigation(feed, finalUrl),
  };
}
