import { supabase } from './supabase';

const SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_CACHE_MS = 50 * 60 * 1000;

type CacheEntry = {
  url: string;
  expiresAt: number;
};

const signedUrlCache = new Map<string, CacheEntry>();
const signedUrlRequests = new Map<string, Promise<string | null>>();

function cacheKey(userId: string, bucket: string, path: string) {
  return `${userId}/${bucket}/${path}`;
}

async function currentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user?.id ?? null;
}

export function clearSignedImageUrlCache(userId?: string, bucket?: string, path?: string) {
  if (!userId) {
    signedUrlCache.clear();
    signedUrlRequests.clear();
    return;
  }

  const userPrefix = `${userId}/`;

  if (!bucket) {
    for (const key of signedUrlCache.keys()) {
      if (key.startsWith(userPrefix)) signedUrlCache.delete(key);
    }
    for (const key of signedUrlRequests.keys()) {
      if (key.startsWith(userPrefix)) signedUrlRequests.delete(key);
    }
    return;
  }

  const prefix = path
    ? cacheKey(userId, bucket, path)
    : `${userId}/${bucket}/`;

  for (const key of signedUrlCache.keys()) {
    if (path ? key === prefix : key.startsWith(prefix)) signedUrlCache.delete(key);
  }
  for (const key of signedUrlRequests.keys()) {
    if (path ? key === prefix : key.startsWith(prefix)) signedUrlRequests.delete(key);
  }
}

export async function getSignedImageUrl(
  bucket: string,
  path: string
): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const key = cacheKey(userId, bucket, path);
  const cached = signedUrlCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  if (cached) signedUrlCache.delete(key);

  const existingRequest = signedUrlRequests.get(key);
  if (existingRequest) return existingRequest;

  const request = supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    .then(async ({ data, error }) => {
      if (error || !data?.signedUrl) return null;

      // Do not cache a URL if the account changed while the request was in flight.
      const activeUserId = await currentUserId();
      if (activeUserId !== userId) return null;

      signedUrlCache.set(key, {
        url: data.signedUrl,
        expiresAt: Date.now() + SIGNED_URL_CACHE_MS,
      });

      return data.signedUrl;
    })
    .catch(() => null)
    .finally(() => {
      signedUrlRequests.delete(key);
    });

  signedUrlRequests.set(key, request);
  return request;
}
