import { supabase } from './supabase';

export type SuggestedReader = {
  id: string;
  username: string;
  full_name: string | null;
  profile_image: string | null;
  reason: string;
  group: string;
  score: number;
  is_private: boolean;
};

export const recommendationWeights = {
  followedByFriends: 8,
  sharedBook: 6,
  sharedCommunity: 5,
  sharedHashtag: 3,
  recentPost: 2,
  completeProfile: 1,
};

export type ReaderSignals = {
  followedByFriends: number;
  sharedBook: number;
  sharedCommunity: number;
  sharedHashtag: number;
  recentPost: number;
  completeProfile: number;
};

export function explainReader(signals: ReaderSignals) {
  if (signals.followedByFriends) {
    return {
      reason: `Takip ettiğin ${signals.followedByFriends} kişi takip ediyor`,
      group: 'friends',
    };
  }
  if (signals.sharedBook) {
    return { reason: `Ortak ${signals.sharedBook} kitap ilginiz var`, group: 'books' };
  }
  if (signals.sharedCommunity) {
    return { reason: 'Aynı okur topluluğundasınız', group: 'community' };
  }
  if (signals.sharedHashtag) {
    return { reason: 'Benzer konularda paylaşıyorsunuz', group: 'topics' };
  }
  return {
    reason: signals.recentPost ? 'Yakın zamanda paylaşım yaptı' : 'Keşfedebileceğin bir okur',
    group: 'active',
  };
}

export function rankReaders(candidates: SuggestedReader[], excluded: Set<string>, limit: number) {
  const remaining = candidates
    .filter((reader) => !excluded.has(reader.id))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const result: SuggestedReader[] = [];
  while (remaining.length && result.length < limit) {
    const alternate = result.length
      ? remaining.findIndex((reader) => reader.group !== result[result.length - 1].group)
      : 0;
    result.push(remaining.splice(alternate >= 0 ? alternate : 0, 1)[0]);
  }
  return result;
}

function tags(text: string) {
  return new Set(text.toLocaleLowerCase('tr-TR').match(/#[\p{L}\p{N}_]+/gu) ?? []);
}

export async function loadSuggestedReaders(userId: string, following: string[]) {
  const [friends, myReviews, myReading, myGroups, recent, fallback] = await Promise.all([
    following.length
      ? supabase
          .from('follows')
          .select('follower_id,following_id')
          .in('follower_id', following.slice(0, 100))
          .limit(500)
      : Promise.resolve({ data: [] }),
    supabase.from('reviews').select('book_key').eq('user_id', userId).limit(100),
    supabase.from('reading_progress').select('book_key').eq('user_id', userId).limit(100),
    supabase.from('community_members').select('community_id').eq('user_id', userId).limit(50),
    supabase.from('posts').select('user_id,text,created_at').order('created_at', { ascending: false }).limit(300),
    supabase.from('profiles').select('id').order('id').limit(50),
  ]);

  const books = [
    ...new Set(
      [...(myReviews.data ?? []), ...(myReading.data ?? [])]
        .map((row) => row.book_key)
        .filter(Boolean)
    ),
  ].slice(0, 100);
  const groups = (myGroups.data ?? []).map((row) => row.community_id);

  const [sharedReviews, sharedGroups] = await Promise.all([
    books.length
      ? supabase.from('reviews').select('user_id,book_key').in('book_key', books).limit(300)
      : Promise.resolve({ data: [] }),
    groups.length
      ? supabase
          .from('community_members')
          .select('user_id,community_id')
          .in('community_id', groups)
          .limit(300)
      : Promise.resolve({ data: [] }),
  ]);

  const candidateIds = new Set<string>();
  for (const row of friends.data ?? []) candidateIds.add(row.following_id);
  for (const row of [
    ...(sharedReviews.data ?? []),
    ...(sharedGroups.data ?? []),
    ...(recent.data ?? []),
  ]) {
    candidateIds.add(row.user_id);
  }
  for (const row of fallback.data ?? []) candidateIds.add(row.id);

  candidateIds.delete(userId);
  following.forEach((id) => candidateIds.delete(id));

  const ids = [...candidateIds].slice(0, 150);
  if (!ids.length) return [];

  const visibility = await supabase.rpc('filter_discoverable_reader_candidates', { p_ids: ids });
  if (visibility.error) throw visibility.error;

  const visibleRows = Array.isArray(visibility.data) ? visibility.data : [];
  const visibleIds = visibleRows.map((row: any) => String(row.id));
  const privateMap = new Map(
    visibleRows.map((row: any) => [String(row.id), row.is_private === true] as const)
  );

  if (!visibleIds.length) return [];

  const profiles = await supabase
    .from('profiles')
    .select('id,username,full_name,profile_image')
    .in('id', visibleIds);
  if (profiles.error) throw profiles.error;

  const myTags = tags(
    (recent.data ?? [])
      .filter((post) => post.user_id === userId)
      .map((post) => post.text ?? '')
      .join(' ')
  );

  return (profiles.data ?? []).map((profile) => {
    const activity = (recent.data ?? []).filter((post) => post.user_id === profile.id);
    const readerTags = tags(activity.map((post) => post.text ?? '').join(' '));
    const signals: ReaderSignals = {
      followedByFriends: new Set(
        (friends.data ?? [])
          .filter((row) => row.following_id === profile.id)
          .map((row) => row.follower_id)
      ).size,
      sharedBook: new Set(
        (sharedReviews.data ?? [])
          .filter((row) => row.user_id === profile.id)
          .map((row) => row.book_key)
      ).size,
      sharedCommunity: new Set(
        (sharedGroups.data ?? [])
          .filter((row) => row.user_id === profile.id)
          .map((row) => row.community_id)
      ).size,
      sharedHashtag: [...readerTags].filter((tag) => myTags.has(tag)).length,
      recentPost: activity.some(
        (post) => Date.now() - Date.parse(post.created_at) < 7 * 86400000
      )
        ? 1
        : 0,
      completeProfile: profile.full_name && profile.profile_image ? 1 : 0,
    };
    const score = (Object.keys(signals) as (keyof ReaderSignals)[]).reduce(
      (sum, key) => sum + Math.min(signals[key], 5) * recommendationWeights[key],
      0
    );

    return {
      ...profile,
      ...explainReader(signals),
      score,
      is_private: privateMap.get(String(profile.id)) ?? false,
    } as SuggestedReader;
  });
}
