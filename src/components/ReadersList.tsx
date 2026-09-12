import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import Image from '@/components/SafeImage';
import { supabase } from '@/lib/supabase';
import { notifySocialChanged, useReaderSocial } from '@/hooks/use-reader-social';
import { Action, Busy, useReaderStyles } from './ReaderUI';
import ReaderSuggestions from './ReaderSuggestions';

type Reader = {
  id: string;
  username: string;
  full_name: string | null;
  profile_image: string | null;
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

          if (alive) setReaders((result.data ?? []) as Reader[]);
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
    }, [targetId, mode, query])
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

    social.setFollowing((current) =>
      wasFollowing
        ? current.filter((id) => id !== reader.id)
        : current.includes(reader.id)
          ? current
          : [...current, reader.id]
    );

    try {
      const result = wasFollowing
        ? await supabase
            .from('follows')
            .delete()
            .eq('follower_id', social.userId)
            .eq('following_id', reader.id)
        : await supabase.from('follows').insert({
            follower_id: social.userId,
            following_id: reader.id,
          });

      if (result.error) throw result.error;
      notifySocialChanged();
    } catch (followError) {
      console.error('Reader follow error:', followError);
      social.setFollowing((current) =>
        wasFollowing
          ? current.includes(reader.id)
            ? current
            : [...current, reader.id]
          : current.filter((id) => id !== reader.id)
      );
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
                    <Text numberOfLines={1} style={ui.text}>
                      {reader.full_name || reader.username}
                    </Text>
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
