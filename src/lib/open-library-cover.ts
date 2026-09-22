const BOOK_COVER_CACHE_MS = 10 * 60 * 1000;

const bookCoverCache = new Map<string, { value: string | null; expiresAt: number }>();
const bookCoverRequests = new Map<string, Promise<string | null>>();

export type BookCoverData = {
  title?: string | null;
  book_title?: string | null;
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
