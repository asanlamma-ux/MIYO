export type OnlineMtlProviderId = 'wtr-lab' | 'fanmtl' | 'wuxiaspot';

export type WtrLabOrderBy =
  | 'update'
  | 'date'
  | 'random'
  | 'weekly_rank'
  | 'monthly_rank'
  | 'view'
  | 'name'
  | 'reader'
  | 'chapter'
  | 'rating'
  | 'total_rate';

export type WtrLabOrder = 'desc' | 'asc';
export type WtrLabStatus = 'all' | 'ongoing' | 'completed' | 'hiatus';

export interface WtrLabSearchFilters {
  providerId: OnlineMtlProviderId;
  query: string;
  page: number;
  cursor?: string | null;
  latestOnly: boolean;
  orderBy: WtrLabOrderBy;
  order: WtrLabOrder;
  status: WtrLabStatus;
  minChapters: number | null;
  maxChapters: number | null;
  minRating: number | null;
  minReviewCount: number | null;
}

export interface WtrLabNovelSummary {
  providerId: OnlineMtlProviderId;
  providerLabel: string;
  rawId: number | string;
  slug: string;
  path: string;
  title: string;
  coverUrl: string | null;
  author: string;
  summary: string;
  status: string;
  chapterCount: number | null;
  rating: number | null;
}

export interface WtrLabChapterSummary {
  order: number;
  title: string;
  path: string;
  updatedAt: string | null;
}

export interface WtrLabNovelDetails extends WtrLabNovelSummary {
  genres: string[];
  tags: string[];
  chapters: WtrLabChapterSummary[];
}

export interface WtrLabSearchResult {
  items: WtrLabNovelSummary[];
  page: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface WtrLabChapterContent {
  order: number;
  title: string;
  html: string;
}

export interface WtrLabBridgeRequest {
  id: string;
  type: 'search' | 'details' | 'chapter';
  payload: Record<string, unknown>;
}

export interface WtrLabBridgeMessage {
  scope: 'wtr-lab';
  id?: string;
  type: 'ready' | 'result' | 'error' | 'challenge';
  providerId?: OnlineMtlProviderId;
  payload?: unknown;
  error?: string;
  title?: string;
  body?: string;
}
