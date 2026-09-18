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
  const url = openLibraryWorkUrl(bookKey);
  if (!url) return null;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    console.warn('Kitap kapağı isteği tamamlanamadı:', url, error);
    return fallback;
  }
  if (!response.ok) {
    console.warn('Kitap kapağı alınamadı:', url, `HTTP ${response.status}`);
    return fallback;
  }
  let data: BookCoverData | null;
  try {
    data = await response.json();
  } catch (error) {
    if (!(error instanceof SyntaxError || error instanceof TypeError)) throw error;
    console.warn('Kitap kapağı yanıtı okunamadı:', url, error);
    return fallback;
  }
  return data ? existingBookCover(data) ?? fallback : fallback;
}

export function existingBookCover(data: BookCoverData): string | null {
  return resolveBookCover(data);
}
