const BOOK_COVER_CACHE_MS = 10 * 60 * 1000;

const bookCoverCache = new Map<string, { value: string | null; expiresAt: number }>();
const bookCoverRequests = new Map<string, Promise<string | null>>();

export type BookCoverData = {
  title?: string | null;
  book_title?: string | null;
  authors?: (string | { name?: string })[] | null;
  description?: string | { value?: string } | null;
  first_publish_year?: number | null;
  coverUrl?: string | null;
  cover_url?: string | null;
  cover_i?: number | string | null;
  covers?: (number | string)[] | null;
  edition_key?: string | string[] | null;
  isbn?: string | string[] | null;
  key?: string | null;
  workKey?: string | null;
};

export function openLibraryUrl(value?: string | null): string | null {
  const key = typeof value === 'string' ? value.trim() : null;
  if (!key || key === 'null' || key === 'undefined') return null;
  if (/^https?:\/\//i.test(key)) {
    try { return new URL(key).hostname ? key : null; } catch { return null; }
  }
  if (!/^\/(?:works\/OL\d+W|books\/OL\d+M)(?:\.json)?$/.test(key)) return null;
  return `https://openlibrary.org${key}${key.endsWith('.json') ? '' : '.json'}`;
}

export const openLibraryWorkUrl = openLibraryUrl;

function resolveBookCover(data: BookCoverData): string | null {
  for (const value of [data.coverUrl, data.cover_url]) {
    if (typeof value !== 'string') continue;
    try {
      const url = new URL(value.trim());
      if (['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password) return url.href;
    } catch { /* Try the next available cover field. */ }
  }
  const coverId = [data.cover_i, ...(Array.isArray(data.covers) ? data.covers : [])]
    .find(id => /^\d+$/.test(String(id)) && Number.isSafeInteger(Number(id)) && Number(id) > 0);
  if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`;
  const editions = Array.isArray(data.edition_key) ? data.edition_key : [data.edition_key];
  const edition = editions.map(key => typeof key === 'string' ? key.trim() : '').find(key => /^OL\d+M$/.test(key));
  if (edition) return `https://covers.openlibrary.org/b/olid/${edition}-L.jpg?default=false`;
  const isbns = Array.isArray(data.isbn) ? data.isbn : [data.isbn];
  const isbn = isbns.map(value => typeof value === 'string' ? value.replace(/[\s-]/g, '') : '')
    .find(value => /^(?:\d{9}[\dXx]|\d{13})$/.test(value));
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : null;

}

export async function loadBookCover(bookKey: string, fallback: string | null): Promise<string | null> {
  if (fallback) return fallback;

  const normalizedKey = bookKey.trim();
  if (!normalizedKey) return null;

  const cached = bookCoverCache.get(normalizedKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) bookCoverCache.delete(normalizedKey);

  const existingRequest = bookCoverRequests.get(normalizedKey);
  if (existingRequest) return existingRequest;

  const url = openLibraryWorkUrl(normalizedKey);
  if (!url) return null;

  const request = (async () => {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      // React Native / Expo native fetch failures (including TLS failures) are not
      // guaranteed to be TypeError instances. A missing remote cover must never
      // crash or surface as a feed error; callers can render their fallback.
      console.warn('Kitap kapağı isteği tamamlanamadı:', url);
      return null;
    }

    if (!response.ok) {
      console.warn('Kitap kapağı alınamadı:', url, `HTTP ${response.status}`);
      return null;
    }

    let data: BookCoverData | null;
    try {
      data = await response.json();
    } catch (error) {
      console.warn('Kitap kapağı yanıtı okunamadı:', url);
      return null;
    }

    return data ? existingBookCover(data) : null;
  })()
    .then((value) => {
      bookCoverCache.set(normalizedKey, {
        value,
        expiresAt: Date.now() + BOOK_COVER_CACHE_MS,
      });
      return value;
    })
    .finally(() => {
      bookCoverRequests.delete(normalizedKey);
    });

  bookCoverRequests.set(normalizedKey, request);
  return request;
}

export function existingBookCover(data: BookCoverData): string | null {
  return resolveBookCover(data);
}


type OpenLibraryMetadata = BookCoverData & {
  key?: string | null;
};

const bookMetadataCache = new Map<string, { value: OpenLibraryMetadata | null; expiresAt: number }>();
const bookMetadataRequests = new Map<string, Promise<OpenLibraryMetadata | null>>();

function normalizedOpenLibraryKey(value?: string | null): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  if (/^OL\d+W$/i.test(raw)) return `/works/${raw}`;
  if (/^OL\d+M$/i.test(raw)) return `/books/${raw}`;
  if (/^\/(?:works\/OL\d+W|books\/OL\d+M)(?:\.json)?$/i.test(raw)) {
    return raw.replace(/\.json$/i, '');
  }

  try {
    const url = new URL(raw);
    if (url.hostname === 'openlibrary.org') {
      const match = url.pathname.match(/^\/(works\/OL\d+W|books\/OL\d+M)(?:\.json)?$/i);
      if (match) return `/${match[1]}`;
    }
  } catch {
    // Not a URL; unsupported keys are ignored.
  }

  return null;
}

async function fetchOpenLibraryJson(url: string): Promise<any | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function resolveAuthorNames(rawAuthors: any): Promise<string[]> {
  if (!Array.isArray(rawAuthors)) return [];

  const direct = rawAuthors
    .map((entry) => typeof entry === 'string' ? entry : entry?.name)
    .filter((value): value is string => typeof value === 'string' && !!value.trim());

  if (direct.length) return direct;

  const authorKeys = rawAuthors
    .map((entry) => entry?.author?.key ?? entry?.key)
    .filter((value): value is string => typeof value === 'string' && /^\/authors\/OL\d+A$/i.test(value));

  if (!authorKeys.length) return [];

  const authorRows = await Promise.all(
    authorKeys.slice(0, 5).map((authorKey) =>
      fetchOpenLibraryJson(`https://openlibrary.org${authorKey}.json`)
    )
  );

  return authorRows
    .map((row) => typeof row?.name === 'string' ? row.name.trim() : '')
    .filter(Boolean);
}

export async function loadOpenLibraryBookMetadata(
  bookKey: string,
  fallback?: OpenLibraryMetadata | null
): Promise<OpenLibraryMetadata | null> {
  const normalizedKey = normalizedOpenLibraryKey(bookKey);
  if (!normalizedKey) return fallback ?? null;

  const cacheKey = normalizedKey.toLowerCase();
  const cached = bookMetadataCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value ? { ...fallback, ...cached.value } : fallback ?? null;
  }
  if (cached) bookMetadataCache.delete(cacheKey);

  const inFlight = bookMetadataRequests.get(cacheKey);
  if (inFlight) {
    const value = await inFlight;
    return value ? { ...fallback, ...value } : fallback ?? null;
  }

  const request = (async (): Promise<OpenLibraryMetadata | null> => {
    const row = await fetchOpenLibraryJson(`https://openlibrary.org${normalizedKey}.json`);
    if (!row || typeof row !== 'object') return null;

    let source = row;

    if (normalizedKey.startsWith('/books/')) {
      const workKey = Array.isArray(row.works) ? row.works[0]?.key : null;
      if (typeof workKey === 'string' && /^\/works\/OL\d+W$/i.test(workKey)) {
        const workRow = await fetchOpenLibraryJson(`https://openlibrary.org${workKey}.json`);
        if (workRow && typeof workRow === 'object') {
          source = {
            ...workRow,
            ...row,
            authors: row.authors?.length ? row.authors : workRow.authors,
            covers: row.covers?.length ? row.covers : workRow.covers,
            description: row.description ?? workRow.description,
            first_publish_year: row.first_publish_year ?? workRow.first_publish_year,
          };
        }
      }
    }

    const authorNames = await resolveAuthorNames(source.authors);
    const metadata: OpenLibraryMetadata = {
      key: normalizedKey,
      title: typeof source.title === 'string' ? source.title : undefined,
      authors: authorNames,
      description: source.description,
      covers: Array.isArray(source.covers) ? source.covers : undefined,
      cover_i: source.cover_i,
      coverUrl: source.coverUrl,
      cover_url: source.cover_url,
      edition_key: source.edition_key,
      isbn: source.isbn,
      first_publish_year: Number.isFinite(Number(source.first_publish_year))
        ? Number(source.first_publish_year)
        : undefined,
    };

    return metadata;
  })()
    .then((value) => {
      bookMetadataCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + BOOK_COVER_CACHE_MS,
      });
      return value;
    })
    .finally(() => {
      bookMetadataRequests.delete(cacheKey);
    });

  bookMetadataRequests.set(cacheKey, request);
  const value = await request;
  return value ? { ...fallback, ...value } : fallback ?? null;
}
