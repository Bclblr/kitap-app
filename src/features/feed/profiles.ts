import { loadPremiumUserIds } from '@/lib/premium';
import { supabase } from '@/lib/supabase';
import { loadVerifiedUserIds } from '@/lib/verification';

import type { FeedProfile } from './model';

type FeedProfileResult = {
  data: FeedProfile[];
  error: unknown;
};

const feedProfilesCache = new Map<
  string,
  { profile: FeedProfile; expiresAt: number }
>();

export async function loadFeedProfiles(
  userIds: string[]
): Promise<FeedProfileResult> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return { data: [], error: null };

  const now = Date.now();
  const cachedProfiles: FeedProfile[] = [];
  const missingIds: string[] = [];

  for (const id of ids) {
    const cached = feedProfilesCache.get(id);
    if (cached && cached.expiresAt > now) {
      cachedProfiles.push(cached.profile);
    } else {
      if (cached) feedProfilesCache.delete(id);
      missingIds.push(id);
    }
  }

  if (!missingIds.length) {
    return { data: cachedProfiles, error: null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, profile_image')
    .in('id', missingIds);

  if (error) return { data: cachedProfiles, error };

  const baseProfiles = (data ?? []) as Omit<
    FeedProfile,
    'is_verified' | 'is_premium'
  >[];
  const profileIds = baseProfiles.map((profile) => profile.id);

  const [verifiedIds, premiumIds] = await Promise.all([
    loadVerifiedUserIds(profileIds).catch(() => new Set<string>()),
    loadPremiumUserIds(profileIds).catch(() => new Set<string>()),
  ]);

  const loadedProfiles: FeedProfile[] = baseProfiles.map((profile) => ({
    ...profile,
    is_verified: verifiedIds.has(profile.id),
    is_premium: premiumIds.has(profile.id),
  }));

  const expiresAt = Date.now() + 30_000;
  for (const profile of loadedProfiles) {
    feedProfilesCache.set(profile.id, { profile, expiresAt });
  }

  return {
    data: [...cachedProfiles, ...loadedProfiles],
    error: null,
  };
}

export function clearFeedProfileCache() {
  feedProfilesCache.clear();
}
