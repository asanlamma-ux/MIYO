export interface Book {
  id: string;
  title: string;
  author: string;
  coverUri: string | null;
  filePath: string;
  fileName?: string;
  contentHash?: string;
  identityKey?: string;
  epubIdentifier?: string | null;
  language?: string;
  storageLocation?: 'app' | 'saf';
  storageFolderUri?: string | null;
  progress: number; // 0-100
  currentChapter: number;
  totalChapters: number;
  lastReadAt: string | null;
  dateAdded: string;
  readingStatus: 'unread' | 'reading' | 'finished';
  tags: string[];
}

export interface Chapter {
  id: string;
  title: string;
  href: string;
  order: number;
}

export interface ReadingPosition {
  bookId: string;
  chapterIndex: number;
  scrollPosition: number;
  /** 0–100 scroll through current chapter (optional, for restore/progress) */
  chapterScrollPercent?: number;
  timestamp: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  chapterIndex: number;
  position: number;
  text: string;
  createdAt: string;
}

export interface Highlight {
  id: string;
  bookId: string;
  chapterIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
  color: string;
  textColor?: string;
  note?: string;
  createdAt: string;
}

export type SortOption = 'recent' | 'title' | 'author' | 'progress' | 'dateAdded';
export type FilterOption = 'all' | 'unread' | 'reading' | 'finished';
export type ViewMode = 'grid' | 'list';
