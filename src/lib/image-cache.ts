import { supabase } from './supabase';

const SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_CACHE_MS = 50 * 60 * 1000;

type CacheEntry = {
  url: string;
  expiresAt: number;
};

const signedUrlCache = new Map<string, CacheEntry>();
const signedUrlRequests = new Map<string, Promise<string | null>>();

function cacheKey(bucket: string, path: string) {
  return `${bucket}/${path}`;
}

export function clearSignedImageUrlCache(bucket?: string, path?: string) {
  if (!bucket) {
    signedUrlCache.clear();
    signedUrlRequests.clear();
    return;
  }

  const prefix = path ? cacheKey(bucket, path) : `${bucket}/`;
  for (const key of signedUrlCache.keys()) {
    if (path ? key === prefix : key.startsWith(prefix)) signedUrlCache.delete(key);
  }
  for (const key of signedUrlRequests.keys()) {
    if (path ? key === prefix : key.startsWith(prefix)) signedUrlRequests.delete(key);
  }
}

export async function getSignedImageUrl(bucket: string, path: string): Promise<string | null> {
  const key = cacheKey(bucket, path);
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
    .then(({ data, error }) => {
      if (error || !data?.signedUrl) return null;

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
