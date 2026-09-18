import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import Image from '@/components/SafeImage';
import { supabase } from '@/lib/supabase';
import { notifySocialChanged, useReaderSocial } from '@/hooks/use-reader-social';
import { Action, Busy, useReaderStyles } from './ReaderUI';
import RetryNotice from './RetryNotice';
import ReaderSuggestions from './ReaderSuggestions';
import VerifiedBadge from './VerifiedBadge';
import PremiumBadge from './PremiumBadge';
import { loadVerifiedUserIds } from '@/lib/verification';
import { loadPremiumUserIds } from '@/lib/premium';

type Reader = {
  id: string;
  username: string;
  full_name: string | null;
  profile_image: string | null;
  is_private: boolean;
  request_pending: boolean;
  is_following: boolean;
  is_verified: boolean;
  is_premium: boolean;
};

const DIRECTORY_PAGE_SIZE = 30;

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
    <ReaderDirectory targetId={targetId} mode={mode} query={query} />
  );
}

function ReaderDirectory({
  targetId,
  mode,
  query,
}: {
  targetId?: string;
  mode?: 'followers' | 'following';
  query?: string;
}) {
  const ui = useReaderStyles();
  const router = useRouter();
  const social = useReaderSocial();
  const [readers, setReaders] = useState<Reader[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const lock = useRef(false);
  const pageOffsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const pageLoadingRef = useRef(false);
  const scopeKey = `${targetId ?? ''}|${mode ?? ''}|${query?.trim() ?? ''}`;
  const scopeKeyRef = useRef(scopeKey);

  useEffect(() => {
    scopeKeyRef.current = scopeKey;
  }, [scopeKey]);

  const followingSet = useMemo(() => new Set(social.following), [social.following]);
  const blockedSet = useMemo(() => new Set(social.blocked), [social.blocked]);

  const loadPage = useCallback(async (reset: boolean) => {
    if (pageLoadingRef.current) return;
    if (!reset && !hasMoreRef.current) return;

    const requestScope = scopeKey;
    const offset = reset ? 0 : pageOffsetRef.current;

    pageLoadingRef.current = true;

    if (reset) {
      pageOffsetRef.current = 0;
      hasMoreRef.current = true;
      setLoading(true);
      setError('');
    } else {
      setLoadingMore(true);
    }

    try {
      const term = query?.trim() ?? '';
      const result = await supabase.rpc('get_reader_directory', {
        ...(targetId ? { p_target: targetId } : {}),
        ...(mode ? { p_mode: mode } : {}),
        ...(term ? { p_query: term } : {}),
        p_offset: offset,
        p_limit: DIRECTORY_PAGE_SIZE,
      });

      if (result.error) throw result.error;

      const baseReaders = (result.data ?? []) as Omit<Reader, 'is_verified' | 'is_premium'>[];
      const readerIds = baseReaders.map((reader) => reader.id);
      const [verifiedIds, premiumIds] = await Promise.all([
        loadVerifiedUserIds(readerIds).catch(() => new Set<string>()),
        loadPremiumUserIds(readerIds).catch(() => new Set<string>()),
      ]);

      if (scopeKeyRef.current !== requestScope) return;

      const loadedReaders: Reader[] = baseReaders.map((reader) => ({
        ...reader,
        username: reader.username || 'Kitap Okuru',
        full_name: reader.full_name ?? null,
        profile_image: reader.profile_image ?? null,
        is_private: reader.is_private === true,
        request_pending: reader.request_pending === true,
        is_following: reader.is_following === true,
        is_verified: verifiedIds.has(reader.id),
        is_premium: premiumIds.has(reader.id),
      }));

      pageOffsetRef.current = offset + baseReaders.length;
      const nextHasMore = baseReaders.length === DIRECTORY_PAGE_SIZE;
      hasMoreRef.current = nextHasMore;

      setReaders((current) => {
        if (reset) return loadedReaders;
        const existing = new Set(current.map((reader) => reader.id));
        return [...current, ...loadedReaders.filter((reader) => !existing.has(reader.id))];
      });
      setHasMore(nextHasMore);
    } catch (loadError) {
      if (scopeKeyRef.current !== requestScope) return;
      console.error('Reader directory load error:', loadError);
      setError('Okurlar yüklenemedi.');
    } finally {
      if (scopeKeyRef.current === requestScope) {
        setLoading(false);
        setLoadingMore(false);
      }
      pageLoadingRef.current = false;
    }
  }, [mode, query, scopeKey, targetId]);

  useFocusEffect(
    useCallback(() => {
      pageOffsetRef.current = 0;
      hasMoreRef.current = true;
      setHasMore(true);

      const timer = setTimeout(() => void loadPage(true), query ? 300 : 0);
      return () => clearTimeout(timer);
    }, [loadPage, query])
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

    const wasFollowing = followingSet.has(reader.id) || reader.is_following;
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
        setReaders((current) =>
          current.map((item) =>
            item.id === reader.id ? { ...item, is_following: false } : item
          )
        );
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
            item.id === reader.id
              ? { ...item, request_pending: false, is_following: true }
              : item
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

  const visible = useMemo(
    () =>
      readers.filter(
        (reader) => !blockedSet.has(reader.id) && (mode || reader.id !== social.userId)
      ),
    [readers, blockedSet, mode, social.userId]
  );

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

      {error ? (
        <RetryNotice
          message={error}
          busy={loading || loadingMore}
          onRetry={() => loadPage(true)}
        />
      ) : null}
      {!!social.error && <Text style={ui.error}>{social.error}</Text>}

      {loading || social.loading ? (
        <Busy />
      ) : (
        !social.error && (
          <>
            {!error && !visible.length && <Text style={ui.muted}>Gösterilecek okur bulunamadı.</Text>}

            {visible.map((reader) => {
              const isFollowing = followingSet.has(reader.id) || reader.is_following;
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
                      {reader.is_premium ? <PremiumBadge size={16} /> : null}
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
                disabled={loadingMore}
                label={loadingMore ? 'Yükleniyor…' : 'Daha fazla göster'}
                onPress={() => void loadPage(false)}
              />
            ) : null}
          </>
        )
      )}
    </View>
  );
}
