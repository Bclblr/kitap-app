import { supabase } from '@/lib/supabase';

async function invokeBookCatalog<T>(
  mode: 'book_search' | 'book_author_search' | 'book_record',
  payload: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('book-catalog', {
    body: { mode, ...payload },
  });

  if (error) throw new Error(error.message || 'Book catalog request failed');
  if (!data || !('data' in data)) throw new Error('Book catalog returned an invalid response');

  return data.data as T;
}

export function searchOpenLibraryBooks(query: string, limit = 20) {
  const clean = query.trim();
  if (!clean) return Promise.resolve<any[]>([]);
  return invokeBookCatalog<any[]>('book_search', { query: clean, limit });
}

export function searchOpenLibraryAuthors(query: string, limit = 10) {
  const clean = query.trim();
  if (!clean) return Promise.resolve<any[]>([]);
  return invokeBookCatalog<any[]>('book_author_search', { query: clean, limit });
}

export function getOpenLibraryRecord(key: string) {
  const clean = key.trim();
  if (!clean) return Promise.resolve<any | null>(null);
  return invokeBookCatalog<any>('book_record', { key: clean });
}
