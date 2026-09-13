import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import Image from '@/components/SafeImage';
import { supabase } from '@/lib/supabase';
import { notifySocialChanged, useReaderSocial } from '@/hooks/use-reader-social';
import { Action, Busy, useReaderStyles } from './ReaderUI';
import ReaderSuggestions from './ReaderSuggestions';
import VerifiedBadge from './VerifiedBadge';
import { loadVerifiedUserIds } from '@/lib/verification';

type Reader = {
  id: string;
  username: string;
  full_name: string | null;
  profile_image: string | null;
  is_private: boolean;
  request_pending: boolean;
  is_verified: boolean;
};

const DIRECTORY_PAGE_SIZE = 30;
const DIRECTORY_FETCH_LIMIT = 100;

export default function ReadersList({
  targetId,
  mode,
  query,
  limit = 8,
}: {
  targetId?: string;
  mode?: 'followers' | 'following';
  query?: string;
  limit?: number;
}) {
  return !mode && !query ? (
    <ReaderSuggestions limit={limit} />
  ) : (
    <ReaderDirectory targetId={targetId} mode={mode} query={query} limit={limit} />
  );
}

function ReaderDirectory({
  targetId,
  mode,
  query,
  limit,
}: {
  targetId?: string;
  mode?: 'followers' | 'following';
  query?: string;
  limit: number;
}) {
  const ui = useReaderStyles();
  const router = useRouter();
  const social = useReaderSocial();
  const [readers, setReaders] = useState<Reader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(DIRECTORY_PAGE_SIZE);
  const lock = useRef(false);

  const followingSet = useMemo(() => new Set(social.following), [social.following]);
  const blockedSet = useMemo(() => new Set(social.blocked), [social.blocked]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      async function load() {
        setLoading(true);
        setError('');
        setVisibleLimit(DIRECTORY_PAGE_SIZE);

        try {
          let ids: string[] | undefined;

          if (targetId && mode) {
            const rows = await supabase
              .from('follows')
              .select('follower_id,following_id')
              .eq(mode === 'followers' ? 'following_id' : 'follower_id', targetId)
              .limit(DIRECTORY_FETCH_LIMIT);

            if (rows.error) throw rows.error;

            ids = [
              ...new Set(
                (rows.data ?? [])
                  .map((row) =>
                    String(mode === 'followers' ? row.follower_id : row.following_id)
                  )
                  .filter(Boolean)
              ),
            ];

            if (!ids.length) {
              if (alive) setReaders([]);
              return;
            }
          }

          let request = supabase
            .from('profiles')
            .select('id,username,full_name,profile_image')
            .order('username', { ascending: true })
            .limit(DIRECTORY_FETCH_LIMIT);

          if (ids) request = request.in('id', ids);

          if (query?.trim()) {
            const term = query.trim().replace(/[%_,().]/g, '');
            if (!term) {
              if (alive) setReaders([]);
              return;
            }
            request = request.or(`username.ilike.%${term}%,full_name.ilike.%${term}%`);
          }

          const result = await request;
          if (result.error) throw result.error;

          const baseReaders = (result.data ?? []) as Omit<Reader, 'is_private' | 'request_pending' | 'is_verified'>[];
          const verifiedIds = await loadVerifiedUserIds(baseReaders.map((reader) => reader.id)).catch(() => new Set<string>());
          const relationshipEntries = await Promise.all(
            baseReaders.map(async (reader) => {
              if (!social.userId || reader.id === social.userId) {
                return [reader.id, { is_private: false, request_pending: false }] as const;
              }

              const relation = await supabase.rpc('get_follow_relationship', {
                p_target: reader.id,
              });

              if (relation.error) {
                console.error('Reader relationship load error:', relation.error);
                return [reader.id, { is_private: false, request_pending: false }] as const;
              }

              const row = Array.isArray(relation.data) ? relation.data[0] : relation.data;
              return [
                reader.id,
                {
                  is_private: row?.is_private === true,
                  request_pending: row?.request_pending === true,
                },
              ] as const;
            })
          );

          const relationshipMap = new Map(relationshipEntries);
          const loadedReaders: Reader[] = baseReaders.map((reader) => {
            const relationship = relationshipMap.get(reader.id);
            return {
              ...reader,
              is_private: relationship?.is_private ?? false,
              request_pending: relationship?.request_pending ?? false,
              is_verified: verifiedIds.has(reader.id),
            };
          });

          if (alive) setReaders(loadedReaders);
        } catch (loadError) {
          console.error('Reader directory load error:', loadError);
          if (alive) setError('Okurlar yüklenemedi.');
        } finally {
          if (alive) setLoading(false);
        }
      }

      const timer = setTimeout(() => void load(), query ? 300 : 0);
      return () => {
        alive = false;
        clearTimeout(timer);
      };
    }, [targetId, mode, query, social.userId])
  );

  async function follow(reader: Reader) {
    if (!social.userId) {
      router.push('/login');
      return;
    }
    if (reader.id === social.userId || lock.current) return;

    lock.current = true;
    setPending(reader.id);
    setError('');

    const wasFollowing = followingSet.has(reader.id);
    const requestWasPending = reader.request_pending;

    try {
      if (wasFollowing) {
        const result = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', social.userId)
          .eq('following_id', reader.id);

        if (result.error) throw result.error;
        social.setFollowing((current) => current.filter((id) => id !== reader.id));
        notifySocialChanged();
        return;
      }

      if (requestWasPending) {
        const result = await supabase.rpc('cancel_follow_request', {
          p_target: reader.id,
        });
        if (result.error) throw result.error;
        setReaders((current) =>
          current.map((item) =>
            item.id === reader.id ? { ...item, request_pending: false } : item
          )
        );
        return;
      }

      const result = await supabase.rpc('request_follow', {
        p_target: reader.id,
      });
      if (result.error) throw result.error;

      if (String(result.data ?? '') === 'requested') {
        setReaders((current) =>
          current.map((item) =>
            item.id === reader.id ? { ...item, request_pending: true } : item
          )
        );
      } else {
        social.setFollowing((current) =>
          current.includes(reader.id) ? current : [...current, reader.id]
        );
        setReaders((current) =>
          current.map((item) =>
            item.id === reader.id ? { ...item, request_pending: false } : item
          )
        );
        notifySocialChanged();
      }
    } catch (followError) {
      console.error('Reader follow error:', followError);
      setError('Takip işlemi tamamlanamadı.');
    } finally {
      lock.current = false;
      setPending(null);
    }
  }

  const filteredReaders = useMemo(
    () =>
      readers.filter(
        (reader) => !blockedSet.has(reader.id) && (mode || reader.id !== social.userId)
      ),
    [readers, blockedSet, mode, social.userId]
  );

  const maxVisible = mode || query ? visibleLimit : limit;
  const visible = filteredReaders.slice(0, maxVisible);
  const hasMore = (mode || query) && visible.length < filteredReaders.length;

  return (
    <View style={{ gap: 10 }}>
      <Text style={ui.title}>
        {mode === 'followers'
          ? 'Takipçiler'
          : mode === 'following'
            ? 'Takip edilenler'
            : query
              ? 'Okur ara'
              : 'Keşfedilecek Okurlar'}
      </Text>

      {!!(error || social.error) && <Text style={ui.error}>{error || social.error}</Text>}

      {loading || social.loading ? (
        <Busy />
      ) : (
        !social.error && (
          <>
            {!visible.length && <Text style={ui.muted}>Gösterilecek okur bulunamadı.</Text>}

            {visible.map((reader) => {
              const isFollowing = followingSet.has(reader.id);
              return (
                <View
                  key={reader.id}
                  style={[ui.card, { flexDirection: 'row', alignItems: 'center' }]}
                >
                  {reader.profile_image ? (
                    <Image
                      source={{ uri: reader.profile_image }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                    />
                  ) : null}

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text numberOfLines={1} style={[ui.text, { flexShrink: 1 }]}>
                        {reader.full_name || reader.username}
                        {reader.is_private ? '  🔒' : ''}
                      </Text>
                      {reader.is_verified ? <VerifiedBadge size={16} /> : null}
                    </View>
                    <Text numberOfLines={1} style={ui.muted}>
                      @{reader.username}
                    </Text>
                    <Action
                      label={query ? 'Mesaj gönder' : 'Profili gör'}
                      onPress={() =>
                        router.push(
                          query
                            ? {
                                pathname: '/chat',
                                params: { userId: reader.id, username: reader.username },
                              }
                            : { pathname: '/profile', params: { userId: reader.id } }
                        )
                      }
                    />
                  </View>

                  {reader.id !== social.userId && (
                    <Action
                      disabled={pending !== null}
                      label={
                        pending === reader.id
                          ? '…'
                          : isFollowing
                            ? 'Takipten çık'
                            : reader.request_pending
                              ? 'İstek gönderildi'
                              : reader.is_private
                                ? 'İstek gönder'
                                : 'Takip et'
                      }
                      onPress={() => void follow(reader)}
                    />
                  )}
                </View>
              );
            })}

            {hasMore ? (
              <Action
                label="Daha fazla göster"
                onPress={() =>
                  setVisibleLimit((current) =>
                    Math.min(current + DIRECTORY_PAGE_SIZE, filteredReaders.length)
                  )
                }
              />
            ) : null}
          </>
        )
      )}
    </View>
  );
}
