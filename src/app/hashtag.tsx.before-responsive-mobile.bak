import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

type HashtagContentItem = {
  content_id: string;
  content_type: 'post' | 'review';
  user_id: string | null;
  username: string;
  profile_image: string | null;
  text: string;
  image_url: string | null;
  book_key: string | null;
  book_title: string | null;
  rating: number | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  liked?: boolean;
  reposted?: boolean;
};

type HashtagComment = {
  id: string;
  user_id: string | null;
  username: string;
  text: string;
  created_at: string;
};

const PAGE_SIZE = 20;

function normalizeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatSupabaseError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return 'Bilinmeyen Supabase hatası.';
  }

  const supabaseError = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
    code?: unknown;
  };

  return [
    ['message', supabaseError.message],
    ['details', supabaseError.details],
    ['hint', supabaseError.hint],
    ['code', supabaseError.code],
  ]
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
    .map(([label, value]) => `${label}: ${String(value)}`)
    .join('\n') || 'Bilinmeyen Supabase hatası.';
}

function normalizeContent(data: unknown): HashtagContentItem[] {
  const rows: Record<string, unknown>[] = Array.isArray(data) ? data : [];

  return rows.flatMap((row): HashtagContentItem[] => {
    if (
      typeof row.content_id !== 'string' ||
      !row.content_id ||
      (row.content_type !== 'post' && row.content_type !== 'review') ||
      typeof row.created_at !== 'string'
    ) {
      return [];
    }

    return [
      {
        content_id: row.content_id,
        content_type: row.content_type,
        user_id: typeof row.user_id === 'string' ? row.user_id : null,
        username:
          typeof row.username === 'string' && row.username.trim()
            ? row.username
            : 'Kitap Okuru',
        profile_image:
          typeof row.profile_image === 'string' ? row.profile_image : null,
        text: typeof row.text === 'string' ? row.text : '',
        image_url: typeof row.image_url === 'string' ? row.image_url : null,
        book_key: typeof row.book_key === 'string' ? row.book_key : null,
        book_title:
          typeof row.book_title === 'string' ? row.book_title : null,
        rating:
          row.rating === null || row.rating === undefined
            ? null
            : normalizeNumber(row.rating),
        created_at: row.created_at,
        likes_count: normalizeNumber(row.likes_count),
        comments_count: normalizeNumber(row.comments_count),
        reposts_count: normalizeNumber(row.reposts_count),
        liked: false,
        reposted: false,
      },
    ];
  });
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (elapsedSeconds < 60) return 'Şimdi';

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} dk`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün`;

  return new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
  });
}

export default function HashtagScreen() {
  const router = useRouter();
  const { tag } = useLocalSearchParams<{ tag?: string | string[] }>();
  const rawTag = Array.isArray(tag) ? tag[0] : tag;
  const normalizedTag = (rawTag ?? '').trim().replace(/^#+/, '').trim();
  const validTag = normalizedTag.length > 0;

  const [content, setContent] = useState<HashtagContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [commentingContentKey, setCommentingContentKey] =
    useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentsByContentKey, setCommentsByContentKey] = useState<
    Record<string, HashtagComment[]>
  >({});
  const [commentsLoadingKey, setCommentsLoadingKey] = useState<string | null>(
    null
  );
  const [commentSendingKey, setCommentSendingKey] = useState<string | null>(
    null
  );
  const requestIdRef = useRef(0);
  const commentsRequestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const pendingActionsRef = useRef(new Set<string>());

  const loadInteractionStates = useCallback(
    async (
      items: HashtagContentItem[],
      userId: string,
      requestId: number
    ) => {
      const postIds = items
        .filter((item) => item.content_type === 'post')
        .map((item) => item.content_id);
      const reviewIds = items
        .filter((item) => item.content_type === 'review')
        .map((item) => item.content_id);
      const targetKeys = new Set(
        items.map((item) => `${item.content_type}-${item.content_id}`)
      );

      const loadPostLikes = async () => {
        if (postIds.length === 0) return [];
        const { data, error } = await supabase
          .from('post_likes')
          .select('post_id')
          .in('post_id', postIds)
          .eq('user_id', userId);
        if (error) console.error('Hashtag post likes state error:', error);
        return data ?? [];
      };

      const loadPostReposts = async () => {
        if (postIds.length === 0) return [];
        const { data, error } = await supabase
          .from('post_reposts')
          .select('post_id')
          .in('post_id', postIds)
          .eq('user_id', userId);
        if (error) console.error('Hashtag post reposts state error:', error);
        return data ?? [];
      };

      const loadReviewLikes = async () => {
        if (reviewIds.length === 0) return [];
        const { data, error } = await supabase
          .from('likes')
          .select('review_id')
          .in('review_id', reviewIds)
          .eq('user_id', userId);
        if (error) console.error('Hashtag review likes state error:', error);
        return data ?? [];
      };

      const loadReviewReposts = async () => {
        if (reviewIds.length === 0) return [];
        const { data, error } = await supabase
          .from('reposts')
          .select('review_id')
          .in('review_id', reviewIds)
          .eq('user_id', userId);
        if (error) console.error('Hashtag review reposts state error:', error);
        return data ?? [];
      };

      const [postLikes, postReposts, reviewLikes, reviewReposts] =
        await Promise.all([
          loadPostLikes(),
          loadPostReposts(),
          loadReviewLikes(),
          loadReviewReposts(),
        ]);

      if (requestId !== requestIdRef.current) return;

      const likedPostIds = new Set(postLikes.map((row) => row.post_id));
      const repostedPostIds = new Set(postReposts.map((row) => row.post_id));
      const likedReviewIds = new Set(reviewLikes.map((row) => row.review_id));
      const repostedReviewIds = new Set(
        reviewReposts.map((row) => row.review_id)
      );

      setContent((current) =>
        current.map((item) => {
          if (!targetKeys.has(`${item.content_type}-${item.content_id}`)) {
            return item;
          }

          return item.content_type === 'post'
            ? {
                ...item,
                liked: likedPostIds.has(item.content_id),
                reposted: repostedPostIds.has(item.content_id),
              }
            : {
                ...item,
                liked: likedReviewIds.has(item.content_id),
                reposted: repostedReviewIds.has(item.content_id),
              };
        })
      );
    },
    []
  );

  const loadInitialContent = useCallback(
    async (isRefresh = false) => {
      const requestId = ++requestIdRef.current;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      commentsRequestIdRef.current += 1;
      setCommentingContentKey(null);
      setCommentText('');
      setCommentsByContentKey({});

      if (!validTag) {
        setContent([]);
        setHasMore(false);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (requestId !== requestIdRef.current) return;

        if (userError) {
          console.error('Hashtag content user error:', userError);
          setCurrentUserId(null);
          setContent([]);
          setHasMore(false);
          setError(formatSupabaseError(userError));
          return;
        }

        if (!user) {
          setCurrentUserId(null);
          setContent([]);
          setHasMore(false);
          return;
        }

        setCurrentUserId(user.id);

        const { data, error: rpcError } = await supabase.rpc(
          'get_hashtag_content',
          {
            p_hashtag: normalizedTag,
            p_limit: PAGE_SIZE,
            p_before: null,
          }
        );

        if (requestId !== requestIdRef.current) return;

        if (rpcError) {
          console.error('Hashtag content error:', rpcError);
          setContent([]);
          setHasMore(false);
          setError(formatSupabaseError(rpcError));
          return;
        }

        const rawCount = Array.isArray(data) ? data.length : 0;
        const normalizedItems = normalizeContent(data);
        setContent(normalizedItems);
        setHasMore(rawCount >= PAGE_SIZE);
        await loadInteractionStates(normalizedItems, user.id, requestId);
      } catch (loadError) {
        if (requestId !== requestIdRef.current) return;
        console.error('Hashtag content error:', loadError);
        setContent([]);
        setHasMore(false);
        setError(formatSupabaseError(loadError));
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [loadInteractionStates, normalizedTag, validTag]
  );

  useEffect(() => {
    void loadInitialContent();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadInitialContent]);

  async function loadMoreContent() {
    if (
      !validTag ||
      loading ||
      refreshing ||
      !currentUserId ||
      !hasMore ||
      loadingMoreRef.current ||
      content.length === 0
    ) {
      return;
    }

    const lastCreatedAt = content[content.length - 1]?.created_at;
    if (!lastCreatedAt) {
      setHasMore(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'get_hashtag_content',
        {
          p_hashtag: normalizedTag,
          p_limit: PAGE_SIZE,
          p_before: lastCreatedAt,
        }
      );

      if (requestId !== requestIdRef.current) return;

      if (rpcError) {
        console.error('Hashtag content error:', rpcError);
        return;
      }

      const rawCount = Array.isArray(data) ? data.length : 0;
      const nextItems = normalizeContent(data);

      setContent((current) => {
        const itemMap = new Map(
          current.map((item) => [
            `${item.content_type}-${item.content_id}`,
            item,
          ])
        );

        nextItems.forEach((item) => {
          itemMap.set(`${item.content_type}-${item.content_id}`, item);
        });

        return Array.from(itemMap.values());
      });
      setHasMore(rawCount >= PAGE_SIZE);
      await loadInteractionStates(nextItems, currentUserId, requestId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      console.error('Hashtag content error:', loadError);
    } finally {
      loadingMoreRef.current = false;
      if (requestId === requestIdRef.current) setLoadingMore(false);
    }
  }

  function updateContentItem(
    item: HashtagContentItem,
    updates: Partial<HashtagContentItem>
  ) {
    setContent((current) =>
      current.map((currentItem) =>
        currentItem.content_type === item.content_type &&
        currentItem.content_id === item.content_id
          ? { ...currentItem, ...updates }
          : currentItem
      )
    );
  }

  async function toggleLike(item: HashtagContentItem) {
    if (!currentUserId) return;
    if (item.content_type !== 'post' && item.content_type !== 'review') return;

    const actionKey = `like-${item.content_type}-${item.content_id}`;
    if (pendingActionsRef.current.has(actionKey)) return;
    pendingActionsRef.current.add(actionKey);

    try {
      if (item.content_type === 'post') {
        const { error: interactionError } = item.liked
          ? await supabase
              .from('post_likes')
              .delete()
              .eq('post_id', item.content_id)
              .eq('user_id', currentUserId)
          : await supabase.from('post_likes').insert({
              post_id: item.content_id,
              user_id: currentUserId,
            });

        if (interactionError) {
          console.error('Hashtag post like error:', interactionError);
          return;
        }
      } else {
        const { error: interactionError } = item.liked
          ? await supabase
              .from('likes')
              .delete()
              .eq('review_id', item.content_id)
              .eq('user_id', currentUserId)
          : await supabase.from('likes').insert({
              review_id: item.content_id,
              user_id: currentUserId,
            });

        if (interactionError) {
          console.error('Hashtag review like error:', interactionError);
          return;
        }
      }

      updateContentItem(item, {
        liked: !item.liked,
        likes_count: item.liked
          ? Math.max(0, item.likes_count - 1)
          : item.likes_count + 1,
      });
    } catch (interactionError) {
      console.error('Hashtag like error:', interactionError);
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }

  async function toggleRepost(item: HashtagContentItem) {
    if (!currentUserId) return;
    if (item.content_type !== 'post' && item.content_type !== 'review') return;

    const actionKey = `repost-${item.content_type}-${item.content_id}`;
    if (pendingActionsRef.current.has(actionKey)) return;
    pendingActionsRef.current.add(actionKey);

    try {
      if (item.content_type === 'post') {
        const { error: interactionError } = item.reposted
          ? await supabase
              .from('post_reposts')
              .delete()
              .eq('post_id', item.content_id)
              .eq('user_id', currentUserId)
          : await supabase.from('post_reposts').insert({
              post_id: item.content_id,
              user_id: currentUserId,
            });

        if (interactionError) {
          console.error('Hashtag post repost error:', interactionError);
          return;
        }
      } else {
        const { error: interactionError } = item.reposted
          ? await supabase
              .from('reposts')
              .delete()
              .eq('review_id', item.content_id)
              .eq('user_id', currentUserId)
          : await supabase.from('reposts').insert({
              review_id: item.content_id,
              user_id: currentUserId,
            });

        if (interactionError) {
          console.error('Hashtag review repost error:', interactionError);
          return;
        }
      }

      updateContentItem(item, {
        reposted: !item.reposted,
        reposts_count: item.reposted
          ? Math.max(0, item.reposts_count - 1)
          : item.reposts_count + 1,
      });
    } catch (interactionError) {
      console.error('Hashtag repost error:', interactionError);
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }

  function getContentKey(item: HashtagContentItem) {
    return `${item.content_type}-${item.content_id}`;
  }

  async function loadComments(item: HashtagContentItem) {
    if (!currentUserId) return;
    if (item.content_type !== 'post' && item.content_type !== 'review') return;

    const contentKey = getContentKey(item);
    const requestId = ++commentsRequestIdRef.current;
    setCommentsLoadingKey(contentKey);

    try {
      let rows: {
        id: string;
        user_id: string | null;
        text: string;
        created_at: string;
      }[] = [];

      if (item.content_type === 'post') {
        const { data, error: commentsError } = await supabase
          .from('post_comments')
          .select('id, user_id, text, created_at')
          .eq('post_id', item.content_id)
          .order('created_at', { ascending: true });
        if (commentsError) {
          console.error('Hashtag post comments error:', commentsError);
          return;
        }
        rows = data ?? [];
      } else {
        const { data, error: commentsError } = await supabase
          .from('comments')
          .select('id, user_id, text, created_at')
          .eq('review_id', item.content_id)
          .order('created_at', { ascending: true });
        if (commentsError) {
          console.error('Hashtag review comments error:', commentsError);
          return;
        }
        rows = data ?? [];
      }

      const userIds = Array.from(
        new Set(
          rows
            .map((comment) => comment.user_id)
            .filter((userId): userId is string => typeof userId === 'string')
        )
      );
      const usernameMap = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);

        if (profileError) {
          console.error('Hashtag comment profiles error:', profileError);
        } else {
          (profileData ?? []).forEach((profile) => {
            if (profile.username) usernameMap.set(profile.id, profile.username);
          });
        }
      }

      if (requestId !== commentsRequestIdRef.current) return;

      const preparedComments: HashtagComment[] = rows.map((comment) => ({
        id: comment.id,
        user_id: comment.user_id,
        username:
          (comment.user_id && usernameMap.get(comment.user_id)) || 'Kullanıcı',
        text: comment.text,
        created_at: comment.created_at,
      }));

      setCommentsByContentKey((current) => ({
        ...current,
        [contentKey]: preparedComments,
      }));
    } catch (commentsError) {
      console.error('Hashtag comments load error:', commentsError);
    } finally {
      if (requestId === commentsRequestIdRef.current) {
        setCommentsLoadingKey(null);
      }
    }
  }

  function toggleCommentPanel(item: HashtagContentItem) {
    if (!currentUserId) return;
    const contentKey = getContentKey(item);

    if (commentingContentKey === contentKey) {
      commentsRequestIdRef.current += 1;
      setCommentingContentKey(null);
      setCommentText('');
      setCommentsLoadingKey(null);
      return;
    }

    setCommentingContentKey(contentKey);
    setCommentText('');
    void loadComments(item);
  }

  async function submitComment(item: HashtagContentItem) {
    if (!currentUserId) return;
    if (item.content_type !== 'post' && item.content_type !== 'review') return;

    const cleanText = commentText.trim();
    if (!cleanText) return;

    const contentKey = getContentKey(item);
    const actionKey = `comment-${contentKey}`;
    if (pendingActionsRef.current.has(actionKey)) return;
    pendingActionsRef.current.add(actionKey);
    setCommentSendingKey(contentKey);

    try {
      if (item.content_type === 'post') {
        const { error: commentError } = await supabase
          .from('post_comments')
          .insert({
            post_id: item.content_id,
            user_id: currentUserId,
            text: cleanText,
          });
        if (commentError) {
          console.error('Hashtag post comment insert error:', commentError);
          return;
        }
      } else {
        const { error: commentError } = await supabase
          .from('comments')
          .insert({
            review_id: item.content_id,
            user_id: currentUserId,
            text: cleanText,
          });
        if (commentError) {
          console.error('Hashtag review comment insert error:', commentError);
          return;
        }
      }

      setCommentText('');
      updateContentItem(item, {
        comments_count: item.comments_count + 1,
      });
      await loadComments(item);
    } catch (commentError) {
      console.error('Hashtag comment insert error:', commentError);
    } finally {
      pendingActionsRef.current.delete(actionKey);
      setCommentSendingKey((current) =>
        current === contentKey ? null : current
      );
    }
  }

  async function deleteComment(
    item: HashtagContentItem,
    comment: HashtagComment
  ) {
    if (!currentUserId || comment.user_id !== currentUserId) return;
    if (item.content_type !== 'post' && item.content_type !== 'review') return;

    const contentKey = getContentKey(item);
    const actionKey = `delete-comment-${contentKey}-${comment.id}`;
    if (pendingActionsRef.current.has(actionKey)) return;
    pendingActionsRef.current.add(actionKey);

    try {
      const { error: deleteError } =
        item.content_type === 'post'
          ? await supabase
              .from('post_comments')
              .delete()
              .eq('id', comment.id)
              .eq('user_id', currentUserId)
          : await supabase
              .from('comments')
              .delete()
              .eq('id', comment.id)
              .eq('user_id', currentUserId);

      if (deleteError) {
        console.error('Hashtag comment delete error:', deleteError);
        return;
      }

      setCommentsByContentKey((current) => ({
        ...current,
        [contentKey]: (current[contentKey] ?? []).filter(
          (currentComment) => currentComment.id !== comment.id
        ),
      }));
      updateContentItem(item, {
        comments_count: Math.max(0, item.comments_count - 1),
      });
    } catch (deleteError) {
      console.error('Hashtag comment delete error:', deleteError);
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/explore');
    }
  }

  function openProfile(item: HashtagContentItem) {
    if (!item.user_id) return;
    router.push({
      pathname: '/profile',
      params: { userId: item.user_id },
    });
  }

  function openBook(item: HashtagContentItem) {
    if (!item.book_key) return;
    router.push({
      pathname: '/book',
      params: { key: item.book_key, author: '' },
    });
  }

  function renderItem({ item }: { item: HashtagContentItem }) {
    const displayName = item.username.trim() || 'Kitap Okuru';
    const initial = displayName.charAt(0).toLocaleUpperCase('tr-TR');
    const contentKey = getContentKey(item);
    const comments = commentsByContentKey[contentKey] ?? [];
    const commentPanelOpen = commentingContentKey === contentKey;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Pressable
            disabled={!item.user_id}
            onPress={() => openProfile(item)}
            style={styles.profileArea}
          >
            {item.profile_image ? (
              <Image source={{ uri: item.profile_image }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={styles.profileText}>
              <Text style={styles.username} numberOfLines={1}>
                @{displayName}
              </Text>
              <Text style={styles.timeText}>{formatRelativeTime(item.created_at)}</Text>
            </View>
          </Pressable>

          <View
            style={[
              styles.typeBadge,
              item.content_type === 'review' && styles.reviewBadge,
            ]}
          >
            <Text style={styles.typeBadgeText}>
              {item.content_type === 'review' ? 'İnceleme' : 'Gönderi'}
            </Text>
          </View>
        </View>

        {item.text ? <Text style={styles.bodyText}>{item.text}</Text> : null}

        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.postImage}
            resizeMode="cover"
          />
        ) : null}

        {item.book_title ? (
          item.book_key ? (
            <Pressable onPress={() => openBook(item)} style={styles.bookLink}>
              <Text style={styles.bookLabel}>KİTAP</Text>
              <Text style={styles.bookTitle} numberOfLines={2}>
                {item.book_title}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.bookLink}>
              <Text style={styles.bookLabel}>KİTAP</Text>
              <Text style={styles.bookTitle} numberOfLines={2}>
                {item.book_title}
              </Text>
            </View>
          )
        ) : null}

        {item.content_type === 'review' && item.rating !== null ? (
          <Text style={styles.rating}>★ {item.rating}/5</Text>
        ) : null}

        <View style={styles.actionsRow}>
          <Pressable
            disabled={!currentUserId}
            onPress={() => void toggleLike(item)}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <Text style={[styles.actionIcon, item.liked && styles.likeActive]}>
              {item.liked ? '♥' : '♡'}
            </Text>
            <Text style={[styles.actionText, item.liked && styles.likeActive]}>
              {item.likes_count}
            </Text>
          </Pressable>

          <Pressable
            disabled={!currentUserId}
            onPress={() => toggleCommentPanel(item)}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <Text style={[styles.actionIcon, commentPanelOpen && styles.commentActive]}>
              ◯
            </Text>
            <Text style={[styles.actionText, commentPanelOpen && styles.commentActive]}>
              {item.comments_count}
            </Text>
          </Pressable>

          <Pressable
            disabled={!currentUserId}
            onPress={() => void toggleRepost(item)}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <Text style={[styles.actionIcon, item.reposted && styles.repostActive]}>
              ↻
            </Text>
            <Text style={[styles.actionText, item.reposted && styles.repostActive]}>
              {item.reposts_count}
            </Text>
          </Pressable>
        </View>

        {commentPanelOpen ? (
          <View style={styles.commentPanel}>
            <View style={styles.commentComposer}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Yorum yaz..."
                placeholderTextColor="#686A74"
                style={styles.commentInput}
                multiline
                maxLength={500}
              />
              <Pressable
                disabled={!commentText.trim() || commentSendingKey === contentKey}
                onPress={() => void submitComment(item)}
                style={[
                  styles.commentSendButton,
                  (!commentText.trim() || commentSendingKey === contentKey) &&
                    styles.commentSendButtonDisabled,
                ]}
              >
                {commentSendingKey === contentKey ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.commentSendText}>Gönder</Text>
                )}
              </Pressable>
            </View>

            {commentsLoadingKey === contentKey ? (
              <View style={styles.commentsLoading}>
                <ActivityIndicator size="small" color="#9B72F2" />
              </View>
            ) : comments.length > 0 ? (
              <View style={styles.commentsList}>
                {comments.map((comment) => (
                  <View key={comment.id} style={styles.commentRow}>
                    <View style={styles.commentBody}>
                      <Text style={styles.commentUsername} numberOfLines={1}>
                        @{comment.username}
                      </Text>
                      <Text style={styles.commentContent}>{comment.text}</Text>
                    </View>
                    {comment.user_id === currentUserId ? (
                      <Pressable
                        onPress={() => void deleteComment(item, comment)}
                        style={styles.commentDeleteButton}
                      >
                        <Text style={styles.commentDeleteText}>Sil</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noCommentsText}>Henüz yorum yok.</Text>
            )}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={goBack} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              #{normalizedTag || 'Hashtag'}
            </Text>
            <Text style={styles.subtitle}>Bu hashtag hakkındaki paylaşımlar</Text>
          </View>
          <View style={styles.headerAccent} />
        </View>

        {!validTag ? (
          <ScreenMessage title="Geçersiz hashtag." />
        ) : loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#9B72F2" />
            <Text style={styles.loadingText}>Paylaşımlar yükleniyor...</Text>
          </View>
        ) : error && content.length === 0 ? (
        <ScreenMessage
          title="İçerikler yüklenemedi."
          debugText={error}
        />
        ) : (
          <FlatList
            data={content}
            renderItem={renderItem}
            keyExtractor={(item) =>
              `${item.content_type}-${item.content_id}`
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              content.length === 0 && styles.emptyListContent,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void loadInitialContent(true)}
                tintColor="#9B72F2"
                colors={['#9B72F2']}
              />
            }
            onEndReached={() => void loadMoreContent()}
            onEndReachedThreshold={0.35}
            ListEmptyComponent={
              <ScreenMessage title="Bu hashtag ile henüz paylaşım yapılmamış." />
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator size="small" color="#9B72F2" />
                </View>
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function ScreenMessage({
  title,
  debugText,
}: {
  title: string;
  debugText?: string;
}) {
  return (
    <View style={styles.centerState}>
      <View style={styles.emptyMark} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {debugText ? <Text style={styles.debugText}>{debugText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#08090D' },
  container: { flex: 1, backgroundColor: '#08090D' },
  header: { minHeight: 78, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#24252D', paddingHorizontal: 14, paddingVertical: 10 },
  backButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#30313A', backgroundColor: '#111218', justifyContent: 'center', alignItems: 'center' },
  backIcon: { color: '#F3F3F6', fontSize: 31, lineHeight: 32, marginTop: -2 },
  headerText: { flex: 1, marginLeft: 12 },
  title: { color: '#F6F6F8', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  subtitle: { color: '#777983', fontSize: 10, marginTop: 4 },
  headerAccent: { width: 4, height: 34, borderRadius: 2, backgroundColor: '#F29A45', marginLeft: 10 },
  listContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 42 },
  emptyListContent: { flexGrow: 1 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileArea: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 10 },
  avatar: { width: 43, height: 43, borderRadius: 22, borderWidth: 1, borderColor: '#654A94', backgroundColor: '#24252D' },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#E6D9FB', fontSize: 17, fontWeight: '900' },
  profileText: { flex: 1, marginLeft: 10 },
  username: { color: '#EEEFF2', fontSize: 12, fontWeight: '900' },
  timeText: { color: '#686A74', fontSize: 9, marginTop: 4 },
  typeBadge: { borderRadius: 9, backgroundColor: '#29213A', paddingHorizontal: 8, paddingVertical: 5 },
  reviewBadge: { backgroundColor: '#382A27' },
  typeBadgeText: { color: '#CDB7F5', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  bodyText: { color: '#E4E5E8', fontSize: 13, lineHeight: 20, marginTop: 13 },
  postImage: { width: '100%', aspectRatio: 1.7, borderRadius: 13, backgroundColor: '#1B1C23', marginTop: 13 },
  bookLink: { borderRadius: 12, borderWidth: 1, borderColor: '#332D28', backgroundColor: '#191714', paddingHorizontal: 11, paddingVertical: 9, marginTop: 12 },
  bookLabel: { color: '#F29A45', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  bookTitle: { color: '#DADBE0', fontSize: 11, lineHeight: 16, fontWeight: '800', marginTop: 4 },
  rating: { color: '#F0B45D', fontSize: 11, fontWeight: '900', marginTop: 10 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#282932', paddingTop: 10, marginTop: 13 },
  actionButton: { minWidth: 64, minHeight: 34, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 10, paddingHorizontal: 8 },
  actionButtonPressed: { backgroundColor: '#20212A', opacity: 0.8 },
  actionIcon: { color: '#858792', fontSize: 17, lineHeight: 20 },
  actionText: { color: '#858792', fontSize: 10, fontWeight: '800', marginLeft: 6 },
  likeActive: { color: '#A985FF' },
  commentActive: { color: '#B99CF0' },
  repostActive: { color: '#F29A45' },
  commentPanel: { borderTopWidth: 1, borderTopColor: '#282932', marginTop: 9, paddingTop: 11 },
  commentComposer: { flexDirection: 'row', alignItems: 'flex-end' },
  commentInput: { flex: 1, minHeight: 40, maxHeight: 84, borderRadius: 12, borderWidth: 1, borderColor: '#30313A', backgroundColor: '#0B0C11', color: '#F0F0F3', fontSize: 11, lineHeight: 16, paddingHorizontal: 11, paddingVertical: 9 },
  commentSendButton: { minWidth: 66, height: 40, borderRadius: 12, backgroundColor: '#8058D9', justifyContent: 'center', alignItems: 'center', marginLeft: 8, paddingHorizontal: 10 },
  commentSendButtonDisabled: { opacity: 0.45 },
  commentSendText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  commentsLoading: { minHeight: 58, justifyContent: 'center', alignItems: 'center' },
  commentsList: { marginTop: 10 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 11, backgroundColor: '#17181F', paddingHorizontal: 10, paddingVertical: 9, marginTop: 6 },
  commentBody: { flex: 1 },
  commentUsername: { color: '#B99BEF', fontSize: 9, fontWeight: '900' },
  commentContent: { color: '#C9CBD1', fontSize: 10, lineHeight: 15, marginTop: 4 },
  commentDeleteButton: { minWidth: 34, minHeight: 28, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  commentDeleteText: { color: '#D97A87', fontSize: 9, fontWeight: '800' },
  noCommentsText: { color: '#6F717B', fontSize: 10, textAlign: 'center', paddingVertical: 16 },
  centerState: { flex: 1, minHeight: 240, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  loadingText: { color: '#858791', fontSize: 11, marginTop: 10 },
  emptyMark: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#5A4380', backgroundColor: '#2B2140', marginBottom: 13 },
  emptyTitle: { color: '#A2A3AC', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  debugText: { color: '#D87987', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 10, maxWidth: 330 },
  footerLoading: { height: 54, justifyContent: 'center', alignItems: 'center' },
});
