export type FeedCursor = {
  createdAt: string;
  id: string;
} | null;

export type FeedCursorState = {
  posts: FeedCursor;
  reviews: FeedCursor;
  quotes: FeedCursor;
};

export type FeedExhaustedState = {
  posts: boolean;
  reviews: boolean;
  quotes: boolean;
};

export function emptyFeedCursors(): FeedCursorState {
  return { posts: null, reviews: null, quotes: null };
}

export function emptyFeedExhausted(): FeedExhaustedState {
  return { posts: false, reviews: false, quotes: false };
}

export function nextFeedCursor(
  rows: { id?: string | null; created_at?: string | null }[]
): FeedCursor {
  const last = rows.at(-1);
  if (!last?.id || !last.created_at) return null;
  return {
    id: String(last.id),
    createdAt: String(last.created_at),
  };
}

export function feedCursorFilter(cursor: NonNullable<FeedCursor>) {
  return [
    `created_at.lt.${cursor.createdAt}`,
    `and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
  ].join(',');
}
