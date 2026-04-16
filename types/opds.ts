export interface OpdsCatalog {
  id: string;
  title: string;
  url: string;
  addedAt: string;
  isDefault?: boolean;
}

export interface OpdsLink {
  href: string;
  rel: string;
  type?: string;
  title?: string;
}

export interface OpdsEntry {
  id: string;
  title: string;
  author: string;
  summary?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  acquisitionLinks: OpdsLink[];
  navigationLinks: OpdsLink[];
}

export interface OpdsFeed {
  title: string;
  url: string;
  entries: OpdsEntry[];
  selfUrl?: string;
  nextUrl?: string;
  previousUrl?: string;
}
