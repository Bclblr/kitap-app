import BookCover from '@/components/BookCover';
import HashtagText from '@/components/HashtagText';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Image from '@/components/SafeImage';
import VerifiedBadge from '@/components/VerifiedBadge';
import PremiumBadge from '@/components/PremiumBadge';

import BottomNav from '@/components/BottomNav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReadersList from '@/components/ReadersList';
import ReviewSpoilerText from '@/components/ReviewSpoilerText';
import QuoteMetadata from '@/components/QuoteMetadata';
import RetryNotice from '@/components/RetryNotice';
import AdSlot from '@/components/AdSlot';
import {
  HomeDrawer,
  HomeStories,
  HomeStoryViewer,
  type HomeStory,
} from '@/components/home/HomeChrome';
import { Action, useReaderStyles } from '@/components/ReaderUI';
import { useReaderSocial } from '@/hooks/use-reader-social';
import { supabase } from '@/lib/supabase';
import { existingBookCover, loadBookCover, openLibraryWorkUrl } from '@/lib/open-library-cover';
import type { BookCoverData } from '@/lib/open-library-cover';
import { normalizeQuoteCardTemplate, quoteCardPalette } from '@/lib/quote-card';
import type { FeedComment as Comment, FeedPost as Post, FeedReview as Review } from '@/features/feed/model';
import { loadFeedProfiles } from '@/features/feed/profiles';
import {
  emptyFeedCursors,
  emptyFeedExhausted,
  feedCursorFilter,
  nextFeedCursor,
  type FeedCursorState,
  type FeedExhaustedState,
} from '@/features/feed/pagination';

type Story = HomeStory;

const STORY_SEEN_KEY = 'story-seen-ids';
const CURRENT_USERNAME = 'Kitap Okuru';
const FEED_PAGE_SIZE = 15;

async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) return null;
  return user;
}

async function getCurrentUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

const REPORT_CATEGORIES = [
  { key: 'violence', label: 'Şiddet veya tehlikeli içerik', icon: 'alert-triangle' },
  { key: 'hate', label: 'Nefret söylemi', icon: 'slash' },
  { key: 'exploitation', label: 'Sömürü veya istismar', icon: 'shield' },
  { key: 'suicide_self_harm', label: 'İntihar veya kendine zarar verme', icon: 'heart' },
  { key: 'bullying_harassment', label: 'Zorbalık veya taciz', icon: 'user-x' },
  { key: 'sexual_content', label: 'Cinsel içerik', icon: 'eye-off' },
  { key: 'spam', label: 'Spam veya dolandırıcılık', icon: 'flag' },
  { key: 'misinformation', label: 'Yanlış veya yanıltıcı bilgi', icon: 'help-circle' },
  { key: 'illegal_goods', label: 'Yasa dışı ürün veya hizmet', icon: 'package' },
  { key: 'intellectual_property', label: 'Fikri mülkiyet ihlali', icon: 'copy' },
  { key: 'other', label: 'Diğer', icon: 'more-horizontal' },
] as const;

function isValidUUID(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function postImageUrls(post: Post) {
  const urls = [
    ...(Array.isArray(post.image_urls) ? post.image_urls : []),
    post.image_url,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return Array.from(new Set(urls)).slice(0, 6);
}

function ZoomableFeedImage({ uri, onClose }: { uri: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const startScaleRef = useRef(1);
  const startDistanceRef = useRef(0);

  const distance = (touches: any[]) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => ((event.nativeEvent as any).touches?.length ?? 0) >= 2,
        onMoveShouldSetPanResponder: (event) => ((event.nativeEvent as any).touches?.length ?? 0) >= 2,
        onPanResponderGrant: (event) => {
          const touches = (event.nativeEvent as any).touches ?? [];
          startDistanceRef.current = distance(touches);
          startScaleRef.current = scaleRef.current;
        },
        onPanResponderMove: (event) => {
          const touches = (event.nativeEvent as any).touches ?? [];
          const currentDistance = distance(touches);
          if (!startDistanceRef.current || !currentDistance) return;
          const next = Math.min(4, Math.max(1, startScaleRef.current * (currentDistance / startDistanceRef.current)));
          scaleRef.current = next;
          setScale(next);
        },
        onPanResponderRelease: () => {
          startDistanceRef.current = 0;
        },
        onPanResponderTerminate: () => {
          startDistanceRef.current = 0;
        },
      }),
    []
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={galleryStyles.zoomOverlay}>
        <Pressable style={galleryStyles.zoomClose} onPress={onClose} accessibilityLabel="Fotoğrafı kapat">
          <Feather name="x" size={28} color="#FFF" />
        </Pressable>
        <View style={galleryStyles.zoomStage} {...responder.panHandlers}>
          <Image
            source={{ uri }}
            style={[galleryStyles.zoomImage, { transform: [{ scale }] }]}
            resizeMode="contain"
          />
        </View>
        <Text style={galleryStyles.zoomHint}>İki parmağınla yakınlaştırıp uzaklaştırabilirsin</Text>
      </View>
    </Modal>
  );
}

function FeedImageGallery({ urls }: { urls: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx <= -45) {
            setActiveIndex((current) =>
              Math.min(Math.max(0, urls.length - 1), current + 1)
            );
          } else if (gesture.dx >= 45) {
            setActiveIndex((current) => Math.max(0, current - 1));
          }
        },
      }),
    [urls.length]
  );

  if (!urls.length) return null;

  const safeIndex = Math.min(activeIndex, urls.length - 1);
  const activeUri = urls[safeIndex];

  return (
    <>
      <View style={stylesForGallery.carouselWrap} {...swipeResponder.panHandlers}>
        <Pressable
          onPress={() => setViewerUri(activeUri)}
          accessibilityLabel={`Fotoğrafı büyüt ${safeIndex + 1}/${urls.length}`}
          style={stylesForGallery.slidePressable}
        >
          <Image
            key={activeUri}
            source={{ uri: activeUri }}
            style={stylesForGallery.carouselImage}
            resizeMode="cover"
          />
        </Pressable>

        {urls.length > 1 ? (
          <>
            <View style={stylesForGallery.counter}>
              <Text style={stylesForGallery.counterText}>{safeIndex + 1}/{urls.length}</Text>
            </View>

            <View style={stylesForGallery.dots}>
              {urls.map((_, index) => (
                <View
                  key={index}
                  style={[
                    stylesForGallery.dot,
                    index === safeIndex && stylesForGallery.dotActive,
                  ]}
                />
              ))}
            </View>

          </>
        ) : null}
      </View>

      {viewerUri ? <ZoomableFeedImage uri={viewerUri} onClose={() => setViewerUri(null)} /> : null}
    </>
  );
}

const stylesForGallery = StyleSheet.create({
  singleImage: { width: '100%', height: 320, marginTop: 14, backgroundColor: '#0D0D12' },
  carouselWrap: { width: '100%', height: 320, marginTop: 14, position: 'relative', overflow: 'hidden', backgroundColor: '#0D0D12' },
  slidePressable: { width: '100%', height: '100%' },
  carouselImage: { width: '100%', height: '100%', backgroundColor: '#0D0D12' },
  counter: { position: 'absolute', right: 10, top: 10, minWidth: 38, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  counterText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.38)' },
  dotActive: { backgroundColor: '#4D9BFF' },
});

const galleryStyles = StyleSheet.create({
  zoomOverlay: { flex: 1, backgroundColor: '#000', alignItems: 'stretch', justifyContent: 'center' },
  zoomStage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  zoomImage: { width: '100%', height: '100%' },
  zoomClose: { position: 'absolute', right: 16, top: 18, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(20,20,24,0.72)', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  zoomHint: { position: 'absolute', left: 20, right: 20, bottom: 24, color: 'rgba(255,255,255,0.72)', textAlign: 'center', fontSize: 11 },
});

export default function HomeScreen() {
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const ui = useReaderStyles();
  const scrollRef = useRef<FlatList<Post>>(null);
  const insets = useSafeAreaInsets();
  const social = useReaderSocial();
  const [storyProfile, setStoryProfile] = useState<{ userId: string | null; imageUrl: string | null } | null>(null);
  const storyProfileImage = social.userId && storyProfile?.userId === social.userId
    ? storyProfile.imageUrl
    : null;
  const [feedTab, setFeedTab] = useState<'following' | 'for-you'>('for-you');
  const [createMenu, setCreateMenu] = useState(false);
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const router = useRouter();const [selectedStory, setSelectedStory] =
  useState<Story | null>(null);
  const [storyGroupIndex, setStoryGroupIndex] = useState<number | null>(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [seenStoryIds, setSeenStoryIds] = useState<string[]>([]);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [bookCoverUrls, setBookCoverUrls] =
    useState<Record<string, string | null>>({});

  const [, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [loadingStories, setLoadingStories] = useState(false);
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const feedCursorRef = useRef<FeedCursorState>(emptyFeedCursors());
  const feedExhaustedRef = useRef<FeedExhaustedState>(emptyFeedExhausted());
  const loadingFeedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const recordedViewsRef = useRef(new Set<string>());
  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 60,
      minimumViewTime: 800,
    }),
    []
  );

  const [commentingReviewId, setCommentingReviewId] =
    useState<string | null>(null);

  const [commentingPostId, setCommentingPostId] =
    useState<string | null>(null);
  const [commentingQuoteId, setCommentingQuoteId] =
    useState<string | null>(null);

  const [commentText, setCommentText] = useState('');
  const [postCommentText, setPostCommentText] = useState('');
  const [quoteCommentText, setQuoteCommentText] = useState('');
  const [reportTarget, setReportTarget] = useState<Post | null>(null);
  const [reportCategory, setReportCategory] = useState<string>('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);



  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { item: Post; isViewable?: boolean }[] }) => {
      const viewerId = currentUserIdRef.current;
      if (!viewerId) return;

      for (const viewable of viewableItems) {
        if (!viewable.isViewable) continue;
        const item = viewable.item;
        if (!item?.id || item.user_id === viewerId) continue;

        const contentType = item.isQuote ? 'quote' : item.isReview ? 'review' : 'post';
        const rawId = item.isQuote ? item.id.replace(/^quote-/, '') : item.id;
        if (!isValidUUID(rawId)) continue;

        const viewKey = `${contentType}:${rawId}`;
        if (recordedViewsRef.current.has(viewKey)) continue;
        recordedViewsRef.current.add(viewKey);

        void supabase
          .rpc('record_content_view', {
            p_content_type: contentType,
            p_content_id: rawId,
          })
          .then(({ data, error }) => {
            if (error) {
              recordedViewsRef.current.delete(viewKey);
              console.warn('İçerik erişimi kaydedilemedi:', error);
              return;
            }

            const nextCount = Number(data) || 0;
            setPosts((current) =>
              current.map((post) =>
                post.id === item.id
                  ? { ...post, view_count: Math.max(Number(post.view_count) || 0, nextCount) }
                  : post
              )
            );
          });
      }
    }
    []
  );

  function closeReportSheet() {
    if (reportSubmitting) return;
    setReportTarget(null);
    setReportCategory('');
    setReportDescription('');
  }

  async function submitFeedReport() {
    if (!reportTarget || !reportCategory || reportSubmitting) return;

    const user = await getCurrentUser();
    if (!user) {
      Alert.alert('Giriş gerekli', 'İçeriği şikâyet etmek için giriş yapmalısın.');
      return;
    }

    if (reportTarget.user_id === user.id) {
      closeReportSheet();
      Alert.alert('Kendi içeriğin', 'Kendi içeriğini şikâyet edemezsin.');
      return;
    }

    const targetType = reportTarget.isQuote ? 'quote' : reportTarget.isReview ? 'review' : 'post';
    const targetId = reportTarget.isQuote ? reportTarget.id.replace(/^quote-/, '') : String(reportTarget.id);

    setReportSubmitting(true);
    try {
      const { error } = await supabase.rpc('submit_report', {
        p_target_type: targetType,
        p_target_id: targetId,
        p_category: reportCategory,
        p_description: reportDescription.trim(),
      });

      if (error) throw error;

      setReportTarget(null);
      setReportCategory('');
      setReportDescription('');
      Alert.alert(
        'Şikâyet incelemeye gönderildi',
        'Bildirimin moderasyon ekibine ulaştı. Durum değiştiğinde Bildirimler bölümünde bilgi göreceksin.'
      );
    } catch (error) {
      console.error('İçerik şikâyeti gönderilemedi:', error);
      Alert.alert('Gönderilemedi', 'Şikâyet şu anda gönderilemedi. Lütfen tekrar dene.');
    } finally {
      setReportSubmitting(false);
    }
  }

  async function deleteOwnFeedPost(post: Post) {
    if (!currentUserId || !post.user_id || post.user_id !== currentUserId || post.isReview || post.isQuote) {
      return;
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', post.id)
      .eq('user_id', currentUserId);

    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }

    setPosts((current) => current.filter((item) => item.id !== post.id));
    if (commentingPostId === post.id) closeCommentSheet();
  }

  function openFeedContentMenu(post: Post) {
    if (post.user_id && post.user_id === currentUserId) {
      if (!post.isReview && !post.isQuote) {
        Alert.alert('Gönderi seçenekleri', undefined, [
          {
            text: 'Gönderiyi Sil',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Gönderiyi sil',
                'Bu gönderi kalıcı olarak silinsin mi?',
                [
                  { text: 'Vazgeç', style: 'cancel' },
                  {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: () => { void deleteOwnFeedPost(post); },
                  },
                ]
              );
            },
          },
          { text: 'Vazgeç', style: 'cancel' },
        ]);
      } else {
        Alert.alert('İçerik seçenekleri', 'Bu içerik sana ait.', [
          { text: 'Vazgeç', style: 'cancel' },
        ]);
      }
      return;
    }

    Alert.alert('İçerik seçenekleri', undefined, [
      {
        text: 'Şikâyet Et',
        style: 'destructive',
        onPress: () => {
          setReportTarget(post);
          setReportCategory('');
          setReportDescription('');
        },
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }

  const getBlockedUserIds = useCallback(async (userId: string | null) => {
    const blocked = new Set<string>();
    if (!userId) return blocked;

    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

    if (error) {
      console.error('Engellenen kullanıcılar alınamadı:', error);
      return blocked;
    }

    for (const row of data ?? []) {
      if (row.blocker_id === userId && row.blocked_id) blocked.add(row.blocked_id);
      if (row.blocked_id === userId && row.blocker_id) blocked.add(row.blocker_id);
    }

    return blocked;
  }, []);

  const loadPosts = useCallback(async (reset = false) => {
    if (loadingFeedRef.current) return;
    loadingFeedRef.current = true;

    if (reset) {
      setLoadingPosts(true);
      setFeedError(null);
      setHasMoreFeed(true);
      feedCursorRef.current = emptyFeedCursors();
      feedExhaustedRef.current = emptyFeedExhausted();
    } else {
      setLoadingMoreFeed(true);
    }

    try {
      const userId = await getCurrentUserId();
      setCurrentUserId(userId);
      const blockedUserIds = await getBlockedUserIds(userId);
      const cursors = reset ? emptyFeedCursors() : feedCursorRef.current;
      const exhausted = reset ? emptyFeedExhausted() : feedExhaustedRef.current;

      const buildPostQuery = () => {
        let query = supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(FEED_PAGE_SIZE);
        if (cursors.posts) query = query.or(feedCursorFilter(cursors.posts));
        return query;
      };

      const buildReviewQuery = () => {
        let query = supabase
          .from('reviews')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(FEED_PAGE_SIZE);
        if (cursors.reviews) query = query.or(feedCursorFilter(cursors.reviews));
        return query;
      };

      const buildQuoteQuery = () => {
        let query = supabase
          .from('quotes')
          .select('id,user_id,book_key,book_title,text,title,topic,page_number,note,card_template_key,created_at,view_count')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(FEED_PAGE_SIZE);
        if (cursors.quotes) query = query.or(feedCursorFilter(cursors.quotes));
        return query;
      };

      const [postResult, reviewResult, quoteResult] = await Promise.all([
        exhausted.posts
          ? Promise.resolve({ data: [], error: null } as any)
          : buildPostQuery(),
        exhausted.reviews
          ? Promise.resolve({ data: [], error: null } as any)
          : buildReviewQuery(),
        exhausted.quotes
          ? Promise.resolve({ data: [], error: null } as any)
          : buildQuoteQuery(),
      ]);

      if (postResult.error) throw postResult.error;
      if (reviewResult.error) throw reviewResult.error;
      if (quoteResult.error) throw quoteResult.error;

      const visiblePostRows = (postResult.data ?? []).filter(
        (post: any) => !post.user_id || !blockedUserIds.has(post.user_id)
      );
      const visibleReviewRows = (reviewResult.data ?? []).filter(
        (review: any) => !review.user_id || !blockedUserIds.has(review.user_id)
      );
      const visibleQuoteRows = (quoteResult.data ?? []).filter(
        (quote: any) => !quote.user_id || !blockedUserIds.has(quote.user_id)
      );

      const postIds = visiblePostRows.map((post: any) => post.id);
      const reviewIds = visibleReviewRows.map((review: any) => review.id);
      const quoteIds = visibleQuoteRows.map((quote: any) => quote.id);

      const [
        postLikesResult,
        postRepostsResult,
        postCommentsResult,
        savedResult,
        reviewLikesResult,
        reviewRepostsResult,
        reviewCommentsResult,
        quoteLikesResult,
        quoteRepostsResult,
        quoteCommentsResult,
      ] = await Promise.all([
        postIds.length
          ? supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
          : Promise.resolve({ data: [], error: null } as any),
        postIds.length
          ? supabase.from('post_reposts').select('post_id, user_id').in('post_id', postIds)
          : Promise.resolve({ data: [], error: null } as any),
        postIds.length
          ? supabase.from('post_comments').select('id, text, created_at, user_id, post_id').in('post_id', postIds).order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
        userId && postIds.length
          ? supabase.from('saved_posts').select('post_id').eq('user_id', userId).in('post_id', postIds)
          : Promise.resolve({ data: [], error: null } as any),
        reviewIds.length
          ? supabase.from('likes').select('review_id, user_id').in('review_id', reviewIds)
          : Promise.resolve({ data: [], error: null } as any),
        reviewIds.length
          ? supabase.from('reposts').select('review_id, user_id').in('review_id', reviewIds)
          : Promise.resolve({ data: [], error: null } as any),
        reviewIds.length
          ? supabase.from('comments').select('id, text, created_at, user_id, review_id').in('review_id', reviewIds).order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
        quoteIds.length
          ? (supabase as any).from('quote_likes').select('quote_id, user_id').in('quote_id', quoteIds)
          : Promise.resolve({ data: [], error: null } as any),
        quoteIds.length
          ? (supabase as any).from('quote_reposts').select('quote_id, user_id').in('quote_id', quoteIds)
          : Promise.resolve({ data: [], error: null } as any),
        quoteIds.length
          ? (supabase as any).from('quote_comments').select('id, text, created_at, user_id, quote_id').in('quote_id', quoteIds).order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      for (const result of [postLikesResult, postRepostsResult, postCommentsResult, savedResult, reviewLikesResult, reviewRepostsResult, reviewCommentsResult, quoteLikesResult, quoteRepostsResult, quoteCommentsResult]) {
        if (result.error) console.error('Feed ilişki verisi alınamadı:', result.error);
      }

      const feedUserIds = [
        userId,
        ...visiblePostRows.map((post: any) => post.user_id),
        ...visibleReviewRows.map((review: any) => review.user_id),
        ...visibleQuoteRows.map((quote: any) => quote.user_id),
        ...(postCommentsResult.data ?? []).map((comment: any) => comment.user_id),
        ...(reviewCommentsResult.data ?? []).map((comment: any) => comment.user_id),
        ...(quoteCommentsResult.data ?? []).map((comment: any) => comment.user_id),
      ].filter((id): id is string => typeof id === 'string' && id.length > 0);

      const profileResult = await loadFeedProfiles(feedUserIds);
      if (profileResult.error) {
        console.error('Feed profilleri alınamadı:', profileResult.error);
      }

      const profilesByUserId = new Map(
        (profileResult.data ?? []).map((profile: any) => [profile.id, profile])
      );
      const currentProfile = userId ? profilesByUserId.get(userId) : null;
      setStoryProfile({ userId, imageUrl: currentProfile?.profile_image?.trim() || null });

      const groupBy = (rows: any[], key: string) => {
        const map = new Map<string, any[]>();
        for (const row of rows) {
          const value = String(row[key]);
          const items = map.get(value) ?? [];
          items.push(row);
          map.set(value, items);
        }
        return map;
      };

      const postLikes = groupBy(postLikesResult.data ?? [], 'post_id');
      const postReposts = groupBy(postRepostsResult.data ?? [], 'post_id');
      const postComments = groupBy(postCommentsResult.data ?? [], 'post_id');
      const reviewLikes = groupBy(reviewLikesResult.data ?? [], 'review_id');
      const reviewReposts = groupBy(reviewRepostsResult.data ?? [], 'review_id');
      const reviewComments = groupBy(reviewCommentsResult.data ?? [], 'review_id');
      const savedPostIds = new Set<string>((savedResult.data ?? []).map((item: any) => item.post_id));
      const quoteLikes = groupBy(quoteLikesResult.data ?? [], 'quote_id');
      const quoteReposts = groupBy(quoteRepostsResult.data ?? [], 'quote_id');
      const quoteComments = groupBy(quoteCommentsResult.data ?? [], 'quote_id');

      const preparedPosts: Post[] = visiblePostRows.map((post: any) => {
        const author = post.user_id ? profilesByUserId.get(post.user_id) : null;
        const likes = postLikes.get(post.id) ?? [];
        const reposts = postReposts.get(post.id) ?? [];
        const comments = (postComments.get(post.id) ?? []).filter(
          (comment: any) => !comment.user_id || !blockedUserIds.has(comment.user_id)
        );

        return {
          ...post,
          username: author?.username || post.username || CURRENT_USERNAME,
          full_name: author?.full_name ?? null,
          profile_image: author?.profile_image ?? null,
          is_verified: author?.is_verified ?? false,
          is_premium: author?.is_premium ?? false,
          liked: !!userId && likes.some((item: any) => item.user_id === userId),
          likes: likes.length,
          reposted: !!userId && reposts.some((item: any) => item.user_id === userId),
          reposts: reposts.length,
          comments: comments.map((comment: any) => ({
            id: comment.id,
            user_id: comment.user_id,
            username: profilesByUserId.get(comment.user_id)?.username || CURRENT_USERNAME,
            full_name: profilesByUserId.get(comment.user_id)?.full_name ?? null,
            profile_image: profilesByUserId.get(comment.user_id)?.profile_image ?? null,
            text: comment.text,
            createdAt: comment.created_at,
          })),
          saved: savedPostIds.has(post.id),
        } as Post;
      });

      const preparedReviews: Review[] = visibleReviewRows.map((review: any) => {
        const author = profilesByUserId.get(review.user_id);
        const likes = reviewLikes.get(review.id) ?? [];
        const reposts = reviewReposts.get(review.id) ?? [];
        const comments = (reviewComments.get(review.id) ?? []).filter(
          (comment: any) => !comment.user_id || !blockedUserIds.has(comment.user_id)
        );

        return {
          id: review.id,
          user_id: review.user_id,
          bookKey: review.book_key,
          coverUrl: review.coverUrl,
          cover_url: review.cover_url,
          isbn: review.isbn,
          key: review.key,
          workKey: review.workKey,
          cover_i: review.cover_i,
          covers: review.covers,
          edition_key: review.edition_key,
          bookTitle: review.book_title,
          rating: Number(review.rating) || 0,
          text: review.text || '',
          title: review.title ?? null,
          topic: review.topic ?? null,
          tags: Array.isArray(review.tags) ? review.tags : [],
          containsSpoiler: review.contains_spoiler === true,
          createdAt: review.created_at,
          username: author?.username || CURRENT_USERNAME,
          full_name: author?.full_name ?? null,
          profile_image: author?.profile_image ?? null,
          is_verified: author?.is_verified ?? false,
          is_premium: author?.is_premium ?? false,
          likes: likes.length,
          liked: !!userId && likes.some((item: any) => item.user_id === userId),
          comments: comments.map((comment: any) => ({
            id: comment.id,
            user_id: comment.user_id,
            username: profilesByUserId.get(comment.user_id)?.username || CURRENT_USERNAME,
            full_name: profilesByUserId.get(comment.user_id)?.full_name ?? null,
            profile_image: profilesByUserId.get(comment.user_id)?.profile_image ?? null,
            text: comment.text,
            createdAt: comment.created_at,
          })),
          reposts: reposts.length,
          reposted: !!userId && reposts.some((item: any) => item.user_id === userId),
          view_count: Number(review.view_count) || 0,
        };
      });

      const reviewPosts: Post[] = preparedReviews.map((review) => ({
        id: review.id,
        user_id: review.user_id ?? null,
        username: review.username || CURRENT_USERNAME,
        full_name: review.full_name ?? null,
        profile_image: review.profile_image ?? null,
        is_verified: review.is_verified,
        is_premium: review.is_premium,
        text: review.text,
        image_url: null,
        reviewTitle: review.title ?? null,
        reviewTopic: review.topic ?? null,
        reviewTags: review.tags ?? [],
        containsSpoiler: review.containsSpoiler,
        coverUrl: review.coverUrl,
        cover_url: review.cover_url,
        cover_i: review.cover_i,
        covers: review.covers,
        edition_key: review.edition_key,
        isbn: review.isbn,
        key: review.key,
        workKey: review.workKey,
        book_key: review.bookKey,
        book_title: review.bookTitle,
        rating: review.rating,
        created_at: review.createdAt,
        saved: false,
        likes: review.likes,
        liked: review.liked,
        comments: review.comments,
        reposts: review.reposts,
        reposted: review.reposted,
        view_count: review.view_count ?? 0,
        isReview: true,
      }));

      const quotePosts: Post[] = visibleQuoteRows.map((quote: any) => {
        const likes = quoteLikes.get(quote.id) ?? [];
        const reposts = quoteReposts.get(quote.id) ?? [];
        const comments = (quoteComments.get(quote.id) ?? []).filter(
          (comment: any) => !comment.user_id || !blockedUserIds.has(comment.user_id)
        );

        return {
          id: `quote-${quote.id}`,
          user_id: quote.user_id,
          username: profilesByUserId.get(quote.user_id)?.username || CURRENT_USERNAME,
          full_name: profilesByUserId.get(quote.user_id)?.full_name,
          profile_image: profilesByUserId.get(quote.user_id)?.profile_image,
          text: quote.text,
          image_url: null,
          book_key: quote.book_key,
          book_title: quote.book_title,
          rating: 0,
          created_at: quote.created_at,
          quoteTitle: quote.title ?? null,
          quoteTopic: quote.topic ?? null,
          quotePageNumber: Number.isInteger(quote.page_number) ? quote.page_number : null,
          quoteNote: quote.note ?? null,
          card_template_key: normalizeQuoteCardTemplate(quote.card_template_key),
          likes: likes.length,
          liked: !!userId && likes.some((item: any) => item.user_id === userId),
          reposts: reposts.length,
          reposted: !!userId && reposts.some((item: any) => item.user_id === userId),
          comments: comments.map((comment: any) => ({
            id: comment.id,
            user_id: comment.user_id,
            username: profilesByUserId.get(comment.user_id)?.username || CURRENT_USERNAME,
            full_name: profilesByUserId.get(comment.user_id)?.full_name ?? null,
            profile_image: profilesByUserId.get(comment.user_id)?.profile_image ?? null,
            text: comment.text,
            createdAt: comment.created_at,
          })),
          view_count: Number(quote.view_count) || 0,
          isQuote: true,
        };
      });

      const pageItems = [...preparedPosts, ...reviewPosts, ...quotePosts]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

      const postRows = (postResult.data ?? []) as any[];
      const reviewRows = (reviewResult.data ?? []) as any[];
      const quoteRows = (quoteResult.data ?? []) as any[];

      feedCursorRef.current = {
        posts: postRows.length ? nextFeedCursor(postRows) : cursors.posts,
        reviews: reviewRows.length ? nextFeedCursor(reviewRows) : cursors.reviews,
        quotes: quoteRows.length ? nextFeedCursor(quoteRows) : cursors.quotes,
      };

      feedExhaustedRef.current = {
        posts: exhausted.posts || postRows.length < FEED_PAGE_SIZE,
        reviews: exhausted.reviews || reviewRows.length < FEED_PAGE_SIZE,
        quotes: exhausted.quotes || quoteRows.length < FEED_PAGE_SIZE,
      };

      setHasMoreFeed(
        !feedExhaustedRef.current.posts ||
          !feedExhaustedRef.current.reviews ||
          !feedExhaustedRef.current.quotes
      );

      setReviews((current) => {
        if (reset) return preparedReviews;
        const existing = new Set(current.map((item) => item.id));
        return [...current, ...preparedReviews.filter((item) => !existing.has(item.id))];
      });

      setPosts((current) => {
        if (reset) return pageItems;
        const existing = new Set(current.map((item) => item.id));
        return [...current, ...pageItems.filter((item) => !existing.has(item.id))]
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      });
    } catch (error) {
      console.error('Post yükleme hatası:', error);
      setFeedError('Akış yüklenirken bir sorun oluştu. Mevcut içerikler korunuyor; yeniden deneyebilirsin.');
    } finally {
      loadingFeedRef.current = false;
      setLoadingPosts(false);
      setLoadingMoreFeed(false);
    }
  }, [getBlockedUserIds]);
  const loadStories = useCallback(async () => {
    setLoadingStories(true);

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .gt('expires_at', now)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Hikâyeler yüklenemedi:', error);
        return;
      }

      const rawStories = (data || []) as Story[];
      const storyViewerId = await getCurrentUserId();
      const blockedUserIds = await getBlockedUserIds(storyViewerId);
      const visibleStories = rawStories.filter((story) => !story.user_id || !blockedUserIds.has(story.user_id));
      const storyUserIds = Array.from(new Set(visibleStories.map((story) => story.user_id).filter((id): id is string => !!id)));
      let storyProfiles = new Map<string, any>();

      if (storyUserIds.length > 0) {
        const { data: storyProfileData } = await supabase
          .from('profiles')
          .select('id, username, profile_image')
          .in('id', storyUserIds);
        storyProfiles = new Map((storyProfileData ?? []).map((profile: any) => [profile.id, profile]));
      }

      const preparedStories = visibleStories.map((story) => {
        const profile = story.user_id ? storyProfiles.get(story.user_id) : null;
        return {
          ...story,
          username: profile?.username || story.username || CURRENT_USERNAME,
          profile_image: profile?.profile_image ?? null,
        };
      });

      setStories(preparedStories);

      try {
        const savedSeen = await AsyncStorage.getItem(STORY_SEEN_KEY);
        const parsedSeen: string[] = savedSeen ? JSON.parse(savedSeen) : [];
        const activeIds = new Set(preparedStories.map((story) => story.id));
        const cleanSeen = parsedSeen.filter((id) => activeIds.has(id));
        setSeenStoryIds(cleanSeen);
        if (cleanSeen.length !== parsedSeen.length) {
          await AsyncStorage.setItem(STORY_SEEN_KEY, JSON.stringify(cleanSeen));
        }
      } catch (seenError) {
        console.error('Hikaye görülme bilgisi okunamadı:', seenError);
      }
    } catch (error) {
      console.error('Hikâye yükleme hatası:', error);
    } finally {
      setLoadingStories(false);
    }
  }, [getBlockedUserIds]);

  useEffect(() => {
    let cancelled = false;
    async function refreshCovers() {
      let savedBooks: BookCoverData[] = [];
      try {
        const saved = await AsyncStorage.getItem('myBooks');
        const parsed: unknown = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) savedBooks = parsed.filter(book => book && typeof book === 'object');
      } catch (error) {
        console.warn('Yerel kitap kapaklar? okunamad?:', error);
      }
      const books = [...posts.map(post => ({ ...post, key: post.book_key || post.key || post.workKey, title: post.book_title })),
        ...reviews.map(review => ({ ...review, key: review.bookKey || review.key || review.workKey, title: review.bookTitle }))];
      const available = new Map<string, BookCoverData>();
      const normalizedKey = (key?: string | null) => openLibraryWorkUrl(key) ?? key ?? '';
      for (const book of [...savedBooks, ...books]) {
        const key = normalizedKey(book.key || book.workKey);
        if (key && existingBookCover(book)) available.set(key, book);
      }
      const requests = new Map<string, Promise<string | null>>();
      const entries = await Promise.all(books.map(async book => {
        const key = book.key;
        const metadata = existingBookCover(book) ? book : available.get(normalizedKey(key)) ?? book;
        let finalCoverUrl = existingBookCover(metadata);
        if (!finalCoverUrl && key && openLibraryWorkUrl(key)) {
          if (!requests.has(key)) requests.set(key, loadBookCover(key, null));
          try { finalCoverUrl = await requests.get(key) ?? null; }
          catch { finalCoverUrl = null; }
        }
        console.log('[Book cover debug]', {
          title: book.title, coverUrl: book.coverUrl, cover_url: book.cover_url,
          cover_i: book.cover_i, covers: book.covers, edition_key: book.edition_key,
          isbn: book.isbn, key, workKey: book.workKey,
          resolvedMetadata: { coverUrl: metadata.coverUrl, cover_url: metadata.cover_url, cover_i: metadata.cover_i, covers: metadata.covers, edition_key: metadata.edition_key, isbn: metadata.isbn }, finalCoverUrl,
        });
        return [key, finalCoverUrl] as const;
      }));
      if (cancelled) return;
      setBookCoverUrls(current => {
        const next = { ...current };
        for (const [key, url] of entries) if (key) next[key] = url ?? next[key] ?? null;
        return next;
      });
    }
    void refreshCovers();
    return () => { cancelled = true; };
  }, [posts, reviews]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function loadAll() {
        setLoading(true);
        const userId = await getCurrentUserId();
        if (active) setCurrentUserId(userId);
        await Promise.all([loadPosts(true), loadStories()]);
        if (active) setLoading(false);
      }
      loadAll();
      return () => { active = false; };
    }, [loadPosts, loadStories])
  );

  async function toggleSavePost(post: Post) {
    const user = await getCurrentUser();
    if (!user) {
      Alert.alert('Giriş gerekli', 'Gönderiyi kaydetmek için önce giriş yapmalısın.');
      return;
    }
    try {
      if (post.saved) {
        const { error } = await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', user.id);
        if (error) { Alert.alert('Hata', error.message); return; }
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, saved: false } : item));
      } else {
        const { error } = await supabase.from('saved_posts').insert({ post_id: post.id, user_id: user.id, username: CURRENT_USERNAME });
        if (error) { Alert.alert('Hata', error.message); return; }
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, saved: true } : item));
      }
    } catch (error) { console.error('Kaydetme hatası:', error); }
  }

  async function togglePostLike(post: Post) {
    const user = await getCurrentUser();
    if (!user) { Alert.alert('Giriş gerekli', 'Gönderiyi beğenmek için önce giriş yapmalısın.'); return; }
    try {
      if (post.liked) {
        const { error } = await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
        if (error) { Alert.alert('Hata', error.message); return; }
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, liked: false, likes: Math.max(0, (item.likes ?? 0) - 1) } : item));
        return;
      }
      const { error: likeError } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
      if (likeError) { Alert.alert('Hata', likeError.message); return; }
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, liked: true, likes: (item.likes ?? 0) + 1 } : item));
      const { data: postData, error: postError } = await supabase.from('posts').select('user_id').eq('id', post.id).single();
      if (postError || !postData) { console.error('Post sahibi bulunamadı:', postError); return; }
      if (!postData.user_id || postData.user_id === user.id) return;
      const { data: existingNotification, error: notificationCheckError } = await supabase.from('notifications').select('id').eq('user_id', postData.user_id).eq('actor_id', user.id).eq('type', 'like').eq('post_id', post.id).maybeSingle();
      if (notificationCheckError) { console.error('Beğeni bildirimi kontrol edilemedi:', notificationCheckError); return; }
      if (!existingNotification) {
        const { error: notificationError } = await supabase.from('notifications').insert({ user_id: postData.user_id, actor_id: user.id, type: 'like', post_id: post.id, message: 'gönderini beğendi', read: false });
        if (notificationError && notificationError.code !== '23505') console.error('Beğeni bildirimi oluşturulamadı:', notificationError);
      }
    } catch (error) {
      console.error('Post beğeni hatası:', error);
      Alert.alert('Hata', 'Beğeni işlemi sırasında bir hata oluştu.');
    }
  }

  async function togglePostRepost(post: Post) {
    const user = await getCurrentUser();
    if (!user) { Alert.alert('Giriş gerekli', 'Gönderiyi repost etmek için önce giriş yapmalısın.'); return; }
    if (typeof post.id !== 'string' || !isValidUUID(post.id) || typeof user.id !== 'string' || !isValidUUID(user.id)) return;
    try {
      if (post.reposted) {
        const { error } = await supabase.from('post_reposts').delete().eq('post_id', post.id).eq('user_id', user.id);
        if (error) { Alert.alert('Hata', error.message); return; }
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, reposted: false, reposts: Math.max(0, (item.reposts ?? 0) - 1) } : item));
        return;
      }
      const { error: repostError } = await supabase.from('post_reposts').insert({ post_id: post.id, user_id: user.id });
      if (repostError) { Alert.alert('Hata', repostError.message); return; }
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, reposted: true, reposts: (item.reposts ?? 0) + 1 } : item));
      const { data: postData, error: postError } = await supabase.from('posts').select('user_id').eq('id', post.id).single();
      if (postError || !postData) { console.error('Repost post sahibi bulunamadı:', postError); return; }
      if (typeof postData.user_id !== 'string' || !isValidUUID(postData.user_id) || postData.user_id === user.id) return;
      const { data: existingNotification, error: notificationCheckError } = await supabase.from('notifications').select('id').eq('user_id', postData.user_id).eq('actor_id', user.id).eq('type', 'repost').eq('post_id', post.id).maybeSingle();
      if (notificationCheckError) { console.error('Repost bildirimi kontrol edilemedi:', notificationCheckError); return; }
      if (!existingNotification) {
        const { error: notificationError } = await supabase.from('notifications').insert({ user_id: postData.user_id, actor_id: user.id, type: 'repost', post_id: post.id, message: 'gönderini yeniden paylaştı', read: false });
        if (notificationError && notificationError.code !== '23505') console.error('Repost bildirimi oluşturulamadı:', notificationError);
      }
    } catch (error) {
      console.error('Post repost hatası:', error);
      Alert.alert('Hata', 'Repost işlemi sırasında bir hata oluştu.');
    }
  }

  function openPostCommentBox(postId: string) {
    setCommentingReviewId(null);
    setCommentingPostId(postId);
    setPostCommentText('');
  }

  async function submitPostComment(postId: string) {
    const cleanText = postCommentText.trim();
    if (!cleanText) return;
    const user = await getCurrentUser();
    if (!user) { Alert.alert('Giriş gerekli', 'Yorum yapmak için önce giriş yapmalısın.'); return; }
    try {
      const { data: postData, error: postError } = await supabase.from('posts').select('id, user_id').eq('id', postId).single();
      if (postError || !postData) { Alert.alert('Hata', 'Gönderi bulunamadı.'); return; }
      const [commentResult, profileResult] = await Promise.all([
        supabase.from('post_comments').insert({ post_id: postId, user_id: user.id, text: cleanText }).select().single(),
        supabase.from('profiles').select('username, full_name, profile_image').eq('id', user.id).maybeSingle(),
      ]);
      const { data, error } = commentResult;
      if (error || !data) { console.error('Post yorum hatası:', error); Alert.alert('Hata', error?.message || 'Yorum kaydedilemedi.'); return; }
      if (profileResult.error) console.warn('Yorum profili yüklenemedi:', profileResult.error);
      setCurrentUserId(user.id);
      const newComment: Comment = {
        id: data.id,
        user_id: user.id,
        username: profileResult.data?.username || CURRENT_USERNAME,
        full_name: profileResult.data?.full_name ?? null,
        profile_image: profileResult.data?.profile_image ?? null,
        text: data.text,
        createdAt: data.created_at,
      };
      setPosts((current) => current.map((item) => item.id === postId ? { ...item, comments: [...(item.comments ?? []), newComment] } : item));
      if (postData.user_id && postData.user_id !== user.id) {
        const { error: notificationError } = await supabase.from('notifications').insert({ user_id: postData.user_id, actor_id: user.id, type: 'comment', message: 'gönderine yorum yaptı.', read: false });
        if (notificationError) console.error('Post yorum bildirimi oluşturulamadı:', notificationError);
      }
      setPostCommentText('');
    } catch (error) {
      console.error('Post yorum işlemi hatası:', error);
      Alert.alert('Hata', 'Yorum gönderilirken hata oluştu.');
    }
  }

  async function deletePostComment(postId: string, commentId: string) {
    const user = await getCurrentUser();
    if (!user) { Alert.alert('Giriş gerekli', 'Bu işlemi yapmak için giriş yapmalısın.'); return; }
    Alert.alert('Yorumu sil', 'Bu yorum silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from('post_comments').delete().eq('id', commentId).eq('user_id', user.id);
          if (error) { Alert.alert('Hata', error.message); return; }
          setPosts((current) => current.map((post) => post.id === postId ? { ...post, comments: (post.comments ?? []).filter((comment) => comment.id !== commentId) } : post));
        } catch (error) { console.error('Post yorumu silme hatası:', error); }
      }},
    ]);
  }

  async function toggleLike(reviewId: string) {
    try {
      const review = reviews.find((item) => item.id === reviewId);
      if (!review) return;
      const user = await getCurrentUser();
      if (!user) { Alert.alert('Giriş gerekli', 'Beğenmek için önce giriş yapmalısın.'); return; }
      if (review.liked) {
        const { error } = await supabase.from('likes').delete().eq('review_id', reviewId).eq('user_id', user.id);
        if (error) { Alert.alert('Hata', error.message); return; }
        setReviews((current) => current.map((item) => item.id === reviewId ? { ...item, liked: false, likes: Math.max(0, (item.likes ?? 0) - 1) } : item));
        return;
      }
      const { error } = await supabase.from('likes').insert({ review_id: reviewId, user_id: user.id });
      if (error) { Alert.alert('Hata', error.message); return; }
      setReviews((current) => current.map((item) => item.id === reviewId ? { ...item, liked: true, likes: (item.likes ?? 0) + 1 } : item));
    } catch (error) { console.error('Beğeni hatası:', error); }
  }

  async function toggleRepost(reviewId: string) {
    try {
      const review = reviews.find((item) => item.id === reviewId);
      if (!review) return;
      const user = await getCurrentUser();
      if (!user) { Alert.alert('Giriş gerekli', 'Repost yapmak için önce giriş yapmalısın.'); return; }
      if (review.reposted) {
        const { error } = await supabase.from('reposts').delete().eq('review_id', reviewId).eq('user_id', user.id);
        if (error) { Alert.alert('Hata', error.message); return; }
        setReviews((current) => current.map((item) => item.id === reviewId ? { ...item, reposted: false, reposts: Math.max(0, (item.reposts ?? 0) - 1) } : item));
        return;
      }
      const { error } = await supabase.from('reposts').insert({ review_id: reviewId, user_id: user.id });
      if (error) { Alert.alert('Hata', error.message); return; }
      setReviews((current) => current.map((item) => item.id === reviewId ? { ...item, reposted: true, reposts: (item.reposts ?? 0) + 1 } : item));
    } catch (error) { console.error('Repost hatası:', error); }
  }

  function openCommentBox(reviewId: string) {
    setCommentingPostId(null);
    setCommentingReviewId(reviewId);
    setCommentText('');
  }

  async function submitComment(reviewId: string) {
    const newCommentText = commentText.trim();
    if (!newCommentText) return;
    try {
      const review = reviews.find((item) => item.id === reviewId);
      if (!review) return;
      const user = await getCurrentUser();
      if (!user) { Alert.alert('Giriş gerekli', 'Yorum yapmak için önce giriş yapmalısın.'); return; }
      const [commentResult, profileResult] = await Promise.all([
        supabase.from('comments').insert({ review_id: reviewId, user_id: user.id, text: newCommentText }).select().single(),
        supabase.from('profiles').select('username, full_name, profile_image').eq('id', user.id).maybeSingle(),
      ]);
      const { data, error } = commentResult;
      if (error || !data) { Alert.alert('Hata', error?.message || 'Yorum kaydedilemedi.'); return; }
      if (profileResult.error) console.warn('Yorum profili yüklenemedi:', profileResult.error);
      setCurrentUserId(user.id);
      const newComment: Comment = {
        id: data.id,
        user_id: user.id,
        username: profileResult.data?.username || CURRENT_USERNAME,
        full_name: profileResult.data?.full_name ?? null,
        profile_image: profileResult.data?.profile_image ?? null,
        text: data.text,
        createdAt: data.created_at,
      };
      setReviews((current) => current.map((item) => item.id === reviewId ? { ...item, comments: [...(item.comments ?? []), newComment] } : item));
      setCommentText('');
    } catch (error) {
      console.error('Yorum hatası:', error);
      Alert.alert('Hata', 'Yorum gönderilirken bir hata oluştu.');
    }
  }

  async function deleteComment(reviewId: string, commentId: string) {
    const user = await getCurrentUser();
    if (!user) { Alert.alert('Giriş gerekli', 'Bu işlemi yapmak için giriş yapmalısın.'); return; }
    Alert.alert('Yorumu sil', 'Bu yorum silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from('comments').delete().eq('id', commentId).eq('user_id', user.id);
          if (error) { Alert.alert('Hata', error.message); return; }
          setReviews((current) => current.map((item) => item.id === reviewId ? { ...item, comments: (item.comments ?? []).filter((comment) => comment.id !== commentId) } : item));
        } catch (error) { console.error('Yorum silinemedi:', error); }
      }},
    ]);
  }

  function quoteRawId(postId: string) {
    return postId.replace(/^quote-/, '');
  }

  function openQuoteCommentBox(postId: string) {
    setCommentingReviewId(null);
    setCommentingPostId(null);
    setCommentingQuoteId(postId);
    setQuoteCommentText('');
  }

  async function toggleQuoteLike(post: Post) {
    const user = await getCurrentUser();
    if (!user) {
      Alert.alert('Giriş gerekli', 'Beğenmek için önce giriş yapmalısın.');
      return;
    }
    const quoteId = quoteRawId(post.id);
    try {
      if (post.liked) {
        const { error } = await (supabase as any).from('quote_likes').delete().eq('quote_id', quoteId).eq('user_id', user.id);
        if (error) throw error;
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, liked: false, likes: Math.max(0, (item.likes ?? 0) - 1) } : item));
      } else {
        const { error } = await (supabase as any).from('quote_likes').insert({ quote_id: quoteId, user_id: user.id });
        if (error) throw error;
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, liked: true, likes: (item.likes ?? 0) + 1 } : item));
      }
    } catch (error) {
      console.error('Alıntı beğeni hatası:', error);
      Alert.alert('Hata', 'Beğeni işlemi tamamlanamadı.');
    }
  }

  async function toggleQuoteRepost(post: Post) {
    const user = await getCurrentUser();
    if (!user) {
      Alert.alert('Giriş gerekli', 'Yeniden paylaşmak için önce giriş yapmalısın.');
      return;
    }
    const quoteId = quoteRawId(post.id);
    try {
      if (post.reposted) {
        const { error } = await (supabase as any).from('quote_reposts').delete().eq('quote_id', quoteId).eq('user_id', user.id);
        if (error) throw error;
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, reposted: false, reposts: Math.max(0, (item.reposts ?? 0) - 1) } : item));
      } else {
        const { error } = await (supabase as any).from('quote_reposts').insert({ quote_id: quoteId, user_id: user.id });
        if (error) throw error;
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, reposted: true, reposts: (item.reposts ?? 0) + 1 } : item));
      }
    } catch (error) {
      console.error('Alıntı repost hatası:', error);
      Alert.alert('Hata', 'Yeniden paylaşım işlemi tamamlanamadı.');
    }
  }

  async function submitQuoteComment(postId: string) {
    const cleanText = quoteCommentText.trim();
    if (!cleanText) return;
    const user = await getCurrentUser();
    if (!user) {
      Alert.alert('Giriş gerekli', 'Yorum yapmak için önce giriş yapmalısın.');
      return;
    }
    const quoteId = quoteRawId(postId);
    try {
      const [commentResult, profileResult] = await Promise.all([
        (supabase as any).from('quote_comments').insert({ quote_id: quoteId, user_id: user.id, text: cleanText }).select().single(),
        supabase.from('profiles').select('username, full_name, profile_image').eq('id', user.id).maybeSingle(),
      ]);
      if (commentResult.error || !commentResult.data) throw commentResult.error ?? new Error('Yorum kaydedilemedi.');
      const data = commentResult.data;
      const newComment: Comment = {
        id: data.id,
        user_id: user.id,
        username: profileResult.data?.username || CURRENT_USERNAME,
        full_name: profileResult.data?.full_name ?? null,
        profile_image: profileResult.data?.profile_image ?? null,
        text: data.text,
        createdAt: data.created_at,
      };
      setCurrentUserId(user.id);
      setPosts((current) => current.map((item) => item.id === postId ? { ...item, comments: [...(item.comments ?? []), newComment] } : item));
      setQuoteCommentText('');
    } catch (error) {
      console.error('Alıntı yorum hatası:', error);
      Alert.alert('Hata', 'Yorum gönderilemedi.');
    }
  }

  async function deleteQuoteComment(postId: string, commentId: string) {
    const user = await getCurrentUser();
    if (!user) return;
    Alert.alert('Yorumu sil', 'Bu yorum silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const { error } = await (supabase as any).from('quote_comments').delete().eq('id', commentId).eq('user_id', user.id);
          if (error) {
            Alert.alert('Hata', error.message);
            return;
          }
          setPosts((current) => current.map((item) => item.id === postId ? { ...item, comments: (item.comments ?? []).filter((comment) => comment.id !== commentId) } : item));
        },
      },
    ]);
  }

  function formatDate(date: string) {
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return '';
    return parsedDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function openBook(bookKey: string) {
    const post = posts.find(item => item.book_key === bookKey);
    const review = reviews.find(item => item.bookKey === bookKey);
    router.push({ pathname: '/book', params: { key: bookKey, title: post?.book_title ?? review?.bookTitle, coverUrl: bookCoverUrls[bookKey] ?? existingBookCover(post ?? review ?? {}) ?? undefined } });
  }

  const storyGroups = (() => {
    const groups = new Map<string, { key: string; username: string; profile_image: string | null; stories: Story[] }>();
    stories.filter(story => !social.blocked.includes(story.user_id ?? '')).forEach((story) => {
      const key = story.user_id || story.username || story.id;
      const existing = groups.get(key);
      if (existing) existing.stories.push(story);
      else groups.set(key, { key, username: story.username || CURRENT_USERNAME, profile_image: story.profile_image ?? null, stories: [story] });
    });
    return Array.from(groups.values()).map((group) => ({
      ...group,
      stories: [...group.stories].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      hasUnseen: group.stories.some((story) => !seenStoryIds.includes(story.id)),
    }));
  })();

  const activeStoryGroup = storyGroupIndex === null ? null : storyGroups[storyGroupIndex] ?? null;

  function markStorySeen(storyId: string) {
    setSeenStoryIds((current) => {
      if (current.includes(storyId)) return current;
      const next = [...current, storyId];
      AsyncStorage.setItem(STORY_SEEN_KEY, JSON.stringify(next)).catch((error) => console.error('Hikaye görülme bilgisi kaydedilemedi:', error));
      return next;
    });
  }

  function showStoryAt(groupIndex: number, itemIndex: number) {
    const group = storyGroups[groupIndex];
    const story = group?.stories[itemIndex];
    if (!group || !story) return;
    setStoryGroupIndex(groupIndex);
    setStoryIndex(itemIndex);
    setSelectedStory(story);
    const upcoming = group.stories[itemIndex + 1] ?? storyGroups[groupIndex + 1]?.stories[0];
    if (upcoming?.image_url) Image.prefetch(upcoming.image_url).catch(() => {});
    markStorySeen(story.id);
  }

  function openStoryGroup(groupIndex: number) {
    const group = storyGroups[groupIndex];
    if (!group) return;
    const firstUnseen = group.stories.findIndex((story) => !seenStoryIds.includes(story.id));
    showStoryAt(groupIndex, firstUnseen >= 0 ? firstUnseen : 0);
  }

  function closeStory() { setSelectedStory(null); setStoryGroupIndex(null); setStoryIndex(0); }
  function nextStory() {
    if (storyGroupIndex === null) return;
    const group = storyGroups[storyGroupIndex];
    if (!group) return;
    if (storyIndex < group.stories.length - 1) { showStoryAt(storyGroupIndex, storyIndex + 1); return; }
    if (storyGroupIndex < storyGroups.length - 1) { showStoryAt(storyGroupIndex + 1, 0); return; }
    closeStory();
  }
  function previousStory() {
    if (storyGroupIndex === null) return;
    if (storyIndex > 0) { showStoryAt(storyGroupIndex, storyIndex - 1); return; }
    if (storyGroupIndex > 0) {
      const previousGroupIndex = storyGroupIndex - 1;
      const previousGroup = storyGroups[previousGroupIndex];
      showStoryAt(previousGroupIndex, Math.max(0, previousGroup.stories.length - 1));
    }
  }

  const storyPanResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_event, gesture) => { if (gesture.dy > 70) closeStory(); },
  });

  const visiblePosts = social.error ? [] : posts
    .filter(post =>
      !social.blocked.includes(post.user_id ?? '') &&
      (feedTab !== 'following' || social.following.includes(post.user_id ?? ''))
    )
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));


  function renderFeedPost({ item: post, index: feedIndex }: { item: Post; index: number }) {
            const reviewForPost = post.isReview ? reviews.find((review) => review.id === post.id) : undefined;
            const feedComments = post.isReview ? reviewForPost?.comments : post.comments;
            const feedLiked = post.isReview ? reviewForPost?.liked : post.liked;
            const feedLikes = post.isReview ? reviewForPost?.likes : post.likes;
            const feedReposted = post.isReview ? reviewForPost?.reposted : post.reposted;
            const feedReposts = post.isReview ? reviewForPost?.reposts : post.reposts;

            const quoteCard = post.isQuote ? quoteCardPalette(normalizeQuoteCardTemplate(post.card_template_key), colors) : null;

            return (
              <Fragment key={post.id}>
                {feedIndex === 5 && <ReadersList limit={10} />}
                <View key={post.id} style={[styles.postCard, post.isQuote && styles.quotePostCard, post.rating > 0 && styles.reviewPostCard, quoteCard ? { backgroundColor: quoteCard.background, borderColor: quoteCard.border } : null]}>
                  {feedIndex > 0 && feedIndex % 9 === 0 && <AdSlot />}
                  <View style={styles.userRow}>
                    <Pressable
                      disabled={!post.user_id}
                      onPress={() => {
                        if (post.user_id) {
                          router.push({ pathname: '/profile', params: { userId: post.user_id } });
                        }
                      }}
                      style={styles.feedProfileButton}
                      accessibilityRole="button"
                      accessibilityLabel={`${post.full_name?.trim() || post.username} profilini aç`}
                    >
                      <View style={styles.avatar}>{post.profile_image ? <Image source={{ uri: post.profile_image }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{post.username?.trim().charAt(0).toUpperCase() || 'K'}</Text>}</View>
                      <View style={styles.userInfo}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text style={[styles.username, { flexShrink: 1 }]} numberOfLines={1}>{post.full_name?.trim() || post.username}</Text>{post.is_verified ? <VerifiedBadge size={16} /> : null}{post.is_premium ? <PremiumBadge size={16} /> : null}</View><Text style={styles.handle} numberOfLines={1}>@{post.username}</Text><Text style={styles.date}>{formatDate(post.created_at)}</Text></View>
                    </Pressable>
                    <Pressable onPress={() => openFeedContentMenu(post)} accessibilityLabel="İçerik seçenekleri"><Text style={styles.moreButton}>•••</Text></Pressable>
                  </View>

                  {(post.isQuote || post.rating > 0) && <Text style={styles.feedTypeLabel}>{post.isQuote ? 'ALINTI' : 'KİTAP İNCELEMESİ'}</Text>}
                  {postImageUrls(post).length > 0 && <FeedImageGallery urls={postImageUrls(post)} />}
                  {post.text ? (
                    post.isReview ? (
                      <ReviewSpoilerText
                        text={post.text}
                        containsSpoiler={post.containsSpoiler}
                        title={post.reviewTitle}
                        topic={post.reviewTopic}
                        tags={post.reviewTags}
                        textStyle={styles.postText}
                      />
                    ) : (
                      <>
                        <HashtagText text={post.isQuote ? `“${post.text}”` : post.text} style={[styles.postText, post.isQuote && styles.quotePostText, quoteCard ? { color: quoteCard.text } : null]} />
                        {post.isQuote ? (
                          <QuoteMetadata
                            title={post.quoteTitle}
                            topic={post.quoteTopic}
                            pageNumber={post.quotePageNumber}
                            note={post.quoteNote}
                          />
                        ) : null}
                      </>
                    )
                  ) : null}
                  {post.book_title && (
                    <Pressable onPress={() => { if (post.book_key) openBook(post.book_key); }} style={styles.bookAttachment}>
                      <View style={styles.bookAttachmentIcon}><BookCover uri={existingBookCover(post) ?? bookCoverUrls[post.book_key || post.key || post.workKey || ''] ?? null} style={styles.bookAttachmentCover}><Text style={styles.bookAttachmentEmoji}>▥</Text></BookCover></View>
                      <View style={styles.bookAttachmentInfo}><Text style={styles.bookAttachmentLabel}>KİTAP</Text><Text style={styles.bookTitle} numberOfLines={2}>{post.book_title}</Text></View>
                      <Text style={styles.bookAttachmentArrow}>›</Text>
                    </Pressable>
                  )}
                  {post.rating > 0 && <View style={styles.rating}><Text style={styles.stars}>{'★'.repeat(post.rating)}{'☆'.repeat(Math.max(0, 5 - post.rating))}</Text><Text style={styles.ratingNumber}>{post.rating}/5</Text></View>}

                  <View style={styles.postActions}>
                      {!post.isQuote && !post.isReview && (
                        <Pressable onPress={() => toggleSavePost(post)} style={[styles.postAction, post.saved && styles.postActionActive]} accessibilityLabel={post.saved ? 'Kaydı kaldır' : 'Kaydet'}>
                          <Feather name="bookmark" size={20} color={post.saved ? colors.primary : colors.textSecondary} />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => post.isQuote ? openQuoteCommentBox(post.id) : post.isReview ? openCommentBox(post.id) : openPostCommentBox(post.id)}
                        style={styles.postAction}
                        accessibilityLabel="Yorumlar"
                      >
                        <Feather name="message-circle" size={20} color={colors.textSecondary} />
                        <Text style={styles.postActionCount}>{feedComments?.length ?? 0}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => post.isQuote ? toggleQuoteLike(post) : post.isReview ? toggleLike(post.id) : togglePostLike(post)}
                        style={[styles.postAction, feedLiked && styles.postActionActive]}
                        accessibilityLabel={feedLiked ? 'Beğeniyi kaldır' : 'Beğen'}
                      >
                        <Feather name="heart" size={20} color={feedLiked ? '#FF6B7A' : colors.textSecondary} />
                        <Text style={[styles.postActionCount, feedLiked && styles.likedPostAction]}>{feedLikes ?? 0}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => post.isQuote ? toggleQuoteRepost(post) : post.isReview ? toggleRepost(post.id) : togglePostRepost(post)}
                        style={[styles.postAction, feedReposted && styles.postActionActive]}
                        accessibilityLabel={feedReposted ? 'Repostu kaldır' : 'Repost'}
                      >
                        <Feather name="repeat" size={20} color={feedReposted ? '#66D19E' : colors.textSecondary} />
                        <Text style={[styles.postActionCount, feedReposted && styles.repostedPostAction]}>{feedReposts ?? 0}</Text>
                      </Pressable>
                      <View style={styles.postAction} accessibilityLabel={`${post.view_count ?? 0} kişiye erişti`}>
                        <Feather name="bar-chart-2" size={20} color={colors.textSecondary} />
                        <Text style={styles.postActionCount}>{post.view_count ?? 0}</Text>
                      </View>
                    </View>

                </View>
              </Fragment>
            );
  }

  const activeCommentReview = commentingReviewId
    ? reviews.find((review) => review.id === commentingReviewId)
    : null;
  const activeCommentPost = commentingPostId
    ? posts.find((post) => post.id === commentingPostId)
    : null;
  const activeCommentQuote = commentingQuoteId
    ? posts.find((post) => post.id === commentingQuoteId)
    : null;
  const activeComments = activeCommentReview?.comments ?? activeCommentPost?.comments ?? activeCommentQuote?.comments ?? [];
  const activeCommentText = commentingReviewId ? commentText : commentingQuoteId ? quoteCommentText : postCommentText;
  const commentSheetVisible = !!commentingReviewId || !!commentingPostId || !!commentingQuoteId;

  function closeCommentSheet() {
    setCommentingReviewId(null);
    setCommentingPostId(null);
    setCommentingQuoteId(null);
    setCommentText('');
    setPostCommentText('');
    setQuoteCommentText('');
  }

  function submitActiveComment() {
    if (commentingReviewId) {
      void submitComment(commentingReviewId);
      return;
    }
    if (commentingPostId) {
      void submitPostComment(commentingPostId);
      return;
    }
    if (commentingQuoteId) {
      void submitQuoteComment(commentingQuoteId);
    }
  }

  return (
    <View style={styles.container}>
      <Modal
        visible={!!reportTarget}
        transparent
        animationType="slide"
        onRequestClose={closeReportSheet}
      >
        <View style={styles.reportSheetRoot}>
          <Pressable style={styles.reportSheetBackdrop} onPress={closeReportSheet} />
          <View style={[styles.reportSheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.reportSheetHandle} />
            <View style={styles.reportSheetHeader}>
              <View>
                <Text style={styles.reportSheetEyebrow}>ŞİKÂYET</Text>
                <Text style={styles.reportSheetTitle}>Neden şikâyet ediyorsun?</Text>
              </View>
              <Pressable onPress={closeReportSheet} style={styles.reportSheetClose} accessibilityLabel="Şikâyeti kapat">
                <Feather name="x" size={22} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.reportSheetHelp}>
              Uygun nedeni seç. Bildirim moderasyon ekibine gönderilecek ve sonucu Bildirimler bölümünde takip edebileceksin.
            </Text>
            <FlatList
              data={REPORT_CATEGORIES}
              keyExtractor={(item) => item.key}
              style={styles.reportCategoryList}
              contentContainerStyle={styles.reportCategoryListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = reportCategory === item.key;
                return (
                  <Pressable
                    onPress={() => setReportCategory(item.key)}
                    style={[styles.reportCategoryRow, selected && styles.reportCategoryRowSelected]}
                    accessibilityRole="button"
                  >
                    <View style={[styles.reportCategoryIcon, selected && styles.reportCategoryIconSelected]}>
                      <Feather name={item.icon as any} size={19} color={selected ? '#DCCFFF' : colors.textSecondary} />
                    </View>
                    <Text style={[styles.reportCategoryText, selected && styles.reportCategoryTextSelected]}>{item.label}</Text>
                    <Feather name={selected ? 'check-circle' : 'chevron-right'} size={19} color={selected ? colors.primary : colors.textMuted} />
                  </Pressable>
                );
              }}
            />
            {reportCategory ? (
              <View style={styles.reportNoteWrap}>
                <Text style={styles.reportNoteLabel}>Ek açıklama (isteğe bağlı)</Text>
                <TextInput
                  value={reportDescription}
                  onChangeText={setReportDescription}
                  placeholder="Moderasyon ekibine yardımcı olacak kısa bir açıklama yazabilirsin."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={1000}
                  style={styles.reportNoteInput}
                />
                <Pressable
                  disabled={reportSubmitting}
                  onPress={() => void submitFeedReport()}
                  style={[styles.reportSubmitButton, reportSubmitting && styles.reportSubmitButtonDisabled]}
                >
                  {reportSubmitting ? <ActivityIndicator color="#FFF" /> : <Feather name="flag" size={17} color="#FFF" />}
                  <Text style={styles.reportSubmitText}>{reportSubmitting ? 'Gönderiliyor...' : 'Şikâyeti gönder'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={commentSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeCommentSheet}
      >
        <KeyboardAvoidingView
          style={styles.commentSheetRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.commentSheetBackdrop} onPress={closeCommentSheet} />
          <View style={[styles.commentSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.commentSheetHandle} />
            <View style={styles.commentSheetHeader}>
              <View style={styles.commentSheetHeaderSpacer} />
              <Text style={styles.commentSheetTitle}>Yorumlar</Text>
              <Pressable
                onPress={closeCommentSheet}
                style={styles.commentSheetClose}
                accessibilityLabel="Yorumları kapat"
              >
                <Feather name="x" size={21} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.commentSheetDivider} />

            <FlatList
              data={activeComments}
              keyExtractor={(comment) => comment.id}
              style={styles.commentSheetList}
              contentContainerStyle={
                activeComments.length ? styles.commentSheetListContent : styles.commentSheetEmptyContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.commentSheetEmpty}>
                  <Feather name="message-circle" size={32} color={colors.textSecondary} />
                  <Text style={styles.commentSheetEmptyTitle}>Henüz yorum yok</Text>
                  <Text style={styles.commentSheetEmptyText}>İlk yorumu sen yaz.</Text>
                </View>
              }
              renderItem={({ item: comment }) => {
                const isOwnComment =
                  !!comment.user_id &&
                  (comment.user_id === currentUserId || comment.user_id === social.userId);
                const displayName =
                  comment.full_name?.trim() ||
                  comment.username?.trim() ||
                  (isOwnComment ? CURRENT_USERNAME : 'Kitap Okuru');

                return (
                  <View style={styles.commentSheetRow}>
                    <Pressable
                      onPress={() => {
                        if (comment.user_id) {
                          closeCommentSheet();
                          router.push({ pathname: '/profile', params: { userId: comment.user_id } });
                        }
                      }}
                      disabled={!comment.user_id}
                      style={styles.commentSheetAvatarWrap}
                    >
                      {comment.profile_image ? (
                        <Image source={{ uri: comment.profile_image }} style={styles.commentSheetAvatar} />
                      ) : (
                        <View style={[styles.commentSheetAvatar, styles.commentSheetAvatarFallback]}>
                          <Text style={styles.commentSheetAvatarText}>
                            {displayName.charAt(0).toLocaleUpperCase('tr-TR')}
                          </Text>
                        </View>
                      )}
                    </Pressable>

                    <View style={styles.commentSheetBody}>
                      <View style={styles.commentSheetNameRow}>
                        <Text style={styles.commentSheetUser} numberOfLines={1}>
                          {displayName}
                        </Text>
                        <Text style={styles.commentSheetDate}>{formatDate(comment.createdAt)}</Text>
                      </View>
                      <Text style={styles.commentSheetCommentText}>{comment.text}</Text>
                    </View>

                    {isOwnComment ? (
                      <Pressable
                        onPress={() =>
                          commentingReviewId
                            ? deleteComment(commentingReviewId, comment.id)
                            : commentingPostId
                              ? deletePostComment(commentingPostId, comment.id)
                              : commentingQuoteId
                                ? deleteQuoteComment(commentingQuoteId, comment.id)
                                : undefined
                        }
                        style={styles.commentSheetDelete}
                        accessibilityLabel="Yorumu sil"
                      >
                        <Feather name="trash-2" size={16} color="#FF6B7A" />
                      </Pressable>
                    ) : null}
                  </View>
                );
              }}
            />

            <View style={styles.commentComposer}>
              <Pressable
                onPress={() => router.push('/profile')}
                style={styles.commentComposerAvatar}
                accessibilityRole="button"
                accessibilityLabel="Profilimi aç"
              >
                {storyProfileImage ? (
                  <Image
                    source={{ uri: storyProfileImage }}
                    style={styles.commentComposerAvatarImage}
                  />
                ) : (
                  <Feather name="user" size={18} color={colors.textSecondary} />
                )}
              </Pressable>
              <TextInput
                value={activeCommentText}
                onChangeText={commentingReviewId ? setCommentText : commentingQuoteId ? setQuoteCommentText : setPostCommentText}
                placeholder="Yorum ekle..."
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={1000}
                style={styles.commentComposerInput}
              />
              <Pressable
                onPress={submitActiveComment}
                disabled={!activeCommentText.trim()}
                style={[
                  styles.commentComposerSend,
                  !activeCommentText.trim() && styles.commentComposerSendDisabled,
                ]}
                accessibilityLabel="Yorumu gönder"
              >
                <Text style={styles.commentComposerSendText}>Paylaş</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <HomeDrawer
        visible={showAuthMenu}
        styles={styles}
        colors={colors}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onClose={() => setShowAuthMenu(false)}
        onSaved={() => {
          setShowAuthMenu(false);
          router.push('/saved');
        }}
        onPremium={() => {
          setShowAuthMenu(false);
          router.push('/premium');
        }}
        onProfileSettings={() => {
          setShowAuthMenu(false);
          router.push('/profile-settings');
        }}
        onSignOut={() => {
          setShowAuthMenu(false);
          void supabase.auth.signOut().then(({ error }) => {
            if (error) Alert.alert('Hata', 'Çıkış yapılamadı.');
          });
        }}
      />

      <FlatList
        ref={scrollRef}
        data={visiblePosts}
        keyExtractor={(item) => item.isQuote ? item.id : `${item.isReview ? 'review' : 'post'}-${item.id}`}
        renderItem={renderFeedPost}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        onEndReachedThreshold={0.45}
        onEndReached={() => {
          if (hasMoreFeed && !loadingMoreFeed && !loadingPosts) {
            void loadPosts(false);
          }
        }}
        ListHeaderComponent={
          <>

        <View style={styles.homeHeader}>
          <Pressable onPress={() => setShowAuthMenu(true)} style={styles.headerIconButton} accessibilityLabel="Menü">
            <Feather name="menu" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.brandTitle}>Kitap</Text>
          <View style={styles.headerRightActions}>
            <Pressable onPress={() => router.push('/notifications')} style={styles.headerIconButton} accessibilityLabel="Bildirimler">
              <Feather name="bell" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.topTabs}>
          <Pressable onPress={() => setFeedTab('following')} style={feedTab === 'following' ? styles.topTabActive : styles.topTab}><Text style={styles.topTabText}>Takip</Text></Pressable>
          <Pressable onPress={() => setFeedTab('for-you')} style={feedTab === 'for-you' ? styles.topTabActive : styles.topTab}><Text style={styles.topTabText}>Senin İçin</Text></Pressable>
        </View>
        <View style={styles.headerDivider} />
        <View style={styles.headerActions}></View>
        <View style={styles.readerHighlights}></View>

        <HomeStories
          styles={styles}
          colors={colors}
          profileImage={storyProfileImage}
          loading={loadingStories}
          groups={storyGroups}
          onCreate={() => router.push('/story-create')}
          onOpenGroup={openStoryGroup}
        />

        {feedTab === 'following' && <Action label="Okurları keşfet" onPress={() => router.push('/readers')} />}

        <HomeStoryViewer
          styles={styles}
          visible={!!selectedStory}
          selectedStory={selectedStory}
          activeGroup={activeStoryGroup ?? null}
          storyIndex={storyIndex}
          topInset={insets.top}
          bottomInset={insets.bottom}
          panHandlers={storyPanResponder.panHandlers}
          onClose={closeStory}
          onNext={nextStory}
          onPrevious={previousStory}
          onDeleted={(storyId) => {
            setStories((current) => current.filter((item) => item.id !== storyId));
            closeStory();
          }}
        />

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Topluluk Akışı</Text></View>

        {feedError ? (
          <RetryNotice
            message={feedError}
            busy={loadingPosts}
            onRetry={() => { void loadPosts(true); }}
          />
        ) : null}


          </>
        }
        ListEmptyComponent={
          loadingPosts ? (
            <View style={styles.loadingBox}><ActivityIndicator /><Text style={styles.info}>Gönderiler yükleniyor...</Text></View>
          ) : feedTab === 'following' ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>{social.error || 'Takip akışında henüz içerik yok'}</Text>
              <Text style={styles.emptyText}>Okurları keşfet ve takip ederek akışını oluştur.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <>
            {loadingMoreFeed ? <View style={styles.loadingBox}><ActivityIndicator /><Text style={styles.info}>Daha fazla içerik yükleniyor...</Text></View> : null}
            {!hasMoreFeed && visiblePosts.length > 0 ? <Text style={styles.feedEndText}>Akışın sonuna geldin.</Text> : null}
            {visiblePosts.length < 6 ? <ReadersList limit={10} /> : null}
          </>
        }
      />

      <Pressable onPress={() => setCreateMenu(true)} style={styles.floatingCreateButton} accessibilityRole="button" accessibilityLabel="Yeni gönderi oluştur"><Text style={styles.floatingCreateIcon}>+</Text></Pressable>
      <BottomNav />
      <Modal visible={createMenu} transparent animationType="slide" onRequestClose={() => setCreateMenu(false)}>
        <View style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} accessibilityLabel="Kapat" onPress={() => setCreateMenu(false)} />
          <View style={[ui.card, { padding: 24, paddingBottom: 40, maxHeight: '85%' }]}>
            <Action label="Gönderi Oluştur" onPress={() => { setCreateMenu(false); router.push('/post-create' as any); }} />
            <Action label="Kitap İncelemesi Yaz" onPress={() => { setCreateMenu(false); router.push('/review'); }} />
            <Action label="Alıntı Paylaş" onPress={() => { setCreateMenu(false); router.push('/quote-create'); }} />
            <Action label="Kitap Yaz / Yayınla" onPress={() => { setCreateMenu(false); router.push('/my-works'); }} />
            <Action label="Kapat" onPress={() => setCreateMenu(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090D', width: '100%', maxWidth: '100%', minWidth: 0 },
  content: { paddingTop: 12, paddingHorizontal: 14, paddingBottom: 132, width: '100%', maxWidth: '100%', minWidth: 0, alignSelf: 'stretch' },
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, marginBottom: 6, maxWidth: '100%', minWidth: 0 },
  brandTitle: { position: 'absolute', left: 70, right: 70, textAlign: 'center', color: '#F8F8FA', fontSize: 21, fontWeight: '900', letterSpacing: -0.6 },
  headerRightActions: { marginLeft: 'auto', flexDirection: 'row', gap: 7, maxWidth: '100%', minWidth: 0, flexShrink: 1 },
  headerIconButton: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  headerIcon: { color: '#F6F6F8', fontSize: 29, lineHeight: 31, transform: [{ rotate: '-15deg' }] },
  headerSmallIcon: { color: '#F6F6F8', fontSize: 20 },
  homeHeaderText: { flex: 1, minWidth: 0 },
  greeting: { fontSize: 14, color: '#8F96A3', letterSpacing: 0.2, flexShrink: 1 },
  title: { marginTop: 4, fontSize: 25, fontWeight: '800', color: '#F7F8FA', letterSpacing: -0.5, flexShrink: 1 },
  messageButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#171A22', borderWidth: 1, borderColor: '#292E39', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  messageIcon: { fontSize: 20, color: '#F7F8FA' },
  topTabs: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2, gap: 25, maxWidth: '100%', minWidth: 0 },
  topTab: { paddingVertical: 10 },
  topTabText: { color: '#777E8A', fontSize: 15, fontWeight: '600' },
  topTabActive: { paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: '#8D65F2' },
  topTabActiveText: { color: '#F5F6F8', fontSize: 15, fontWeight: '800' },
  headerDivider: { height: 1, backgroundColor: '#1B1F28', marginHorizontal: -16 },
  headerActions: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10, maxWidth: '100%', minWidth: 0 },
  loginButton: { minWidth: 58, height: 42, paddingHorizontal: 12, borderRadius: 21, backgroundColor: '#171A22', borderWidth: 1, borderColor: '#303542', justifyContent: 'center', alignItems: 'center' },
  loginButtonText: { color: '#E9EBEF', fontSize: 12, fontWeight: '800' },
  exploreButton: { flex: 1, height: 42, borderRadius: 21, backgroundColor: '#171A22', borderWidth: 1, borderColor: '#292E39', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, minWidth: 0, maxWidth: '100%' },
  exploreIcon: { color: '#A7ADB8', fontSize: 24, lineHeight: 24, marginRight: 7 },
  exploreButtonText: { color: '#8F96A3', fontSize: 13, fontWeight: '600', flexShrink: 1, minWidth: 0 },
  readerHighlights: { flexDirection: 'row', gap: 10, marginTop: 16, maxWidth: '100%', minWidth: 0 },
  readerHighlightCard: { flex: 1, minHeight: 116, padding: 13, borderRadius: 16, backgroundColor: '#111219', borderWidth: 1, borderColor: '#252631', minWidth: 0, maxWidth: '100%' },
  readerHighlightEyebrow: { color: '#A985FF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  readerHighlightTitle: { color: '#F3F3F6', fontSize: 13, fontWeight: '800', marginTop: 8, flexShrink: 1 },
  readerHighlightText: { color: '#747681', fontSize: 10, lineHeight: 15, marginTop: 6, flexShrink: 1 },
  storyModalOverlay: { flex: 1, backgroundColor: '#000' },
  storyViewer: { flex: 1, backgroundColor: '#050507', paddingTop: 14, paddingBottom: 18, maxWidth: '100%', minWidth: 0 },
  storyProgressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 10, marginBottom: 10 },
  storyProgressTrack: { flex: 1, height: 3, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.24)' },
  storyProgressActive: { backgroundColor: '#F5F5F7' },
  storyViewerHeader: { height: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 },
  storyViewerIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  storyViewerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  storyViewerAvatarFallback: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#2B2140', alignItems: 'center', justifyContent: 'center' },
  storyViewerAvatarText: { color: '#F4EEFF', fontWeight: '900' },
  storyViewerUsername: { color: '#FFF', fontSize: 14, fontWeight: '800', flexShrink: 1, maxWidth: '100%' },
  storyViewerCounter: { color: '#9B9BA4', fontSize: 10, marginTop: 2 },
  storyCloseButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(20,20,26,0.78)', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  storyCloseText: { color: '#FFF', fontSize: 27, lineHeight: 29 },
  storyMediaArea: { flex: 1, marginHorizontal: 8, borderRadius: 18, overflow: 'hidden', backgroundColor: '#0D0D12', position: 'relative' },
  storyViewerImage: { width: '100%', height: '100%', backgroundColor: '#0D0D12', maxWidth: '100%' },
  storyTextOnlyCard: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15111E' },
  storyTextOnlyIcon: { fontSize: 58 },
  storyTextOverlay: { position: 'absolute', left: 18, right: 18, bottom: 38, backgroundColor: 'rgba(0,0,0,0.48)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, zIndex: 5 },
  storyViewerText: { color: '#FFF', fontSize: 17, lineHeight: 24, textAlign: 'center', fontWeight: '600', flexShrink: 1, maxWidth: '100%' },
  storyTapLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '42%', zIndex: 10 },
  storyTapRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '58%', zIndex: 10 },
  storySwipeHint: { height: 34, alignItems: 'center', justifyContent: 'flex-end' },
  storySwipeHandle: { width: 34, height: 4, borderRadius: 3, backgroundColor: '#4A4A52', marginBottom: 4 },
  storySwipeText: { color: '#66666F', fontSize: 9 },
  loadMoreButton: { alignSelf: 'center', marginTop: 8, marginBottom: 18, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: '#21182F', borderWidth: 1, borderColor: '#38284D' },
  loadMoreText: { color: '#A985FF', fontSize: 13, fontWeight: '800' },
  feedEndText: { color: '#666B76', fontSize: 12, textAlign: 'center', paddingVertical: 18 },
  sectionHeader: { marginTop: 25, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', maxWidth: '100%', minWidth: 0 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: '#F2F3F5', letterSpacing: -0.2, flexShrink: 1, minWidth: 0 },
  storySection: { marginTop: 8 },
  addStoryText: { fontSize: 13, fontWeight: '800', color: '#A985FF' },
  storyList: { gap: 12, paddingBottom: 4 },
  storyItem: { width: 74, alignItems: 'center' },
  addStoryCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#F28A2E', backgroundColor: '#14151C', justifyContent: 'center', alignItems: 'center' },
  addStoryAvatar: { width: 56, height: 56, borderRadius: 28 },
  addStoryBadge: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#F28A2E', backgroundColor: '#14151C', alignItems: 'center', justifyContent: 'center' },
  addStoryIcon: { fontSize: 18, lineHeight: 18, textAlign: 'center', includeFontPadding: false, fontWeight: '300', color: '#F28A2E' },
  storyRing: { width: 66, height: 66, borderRadius: 33, borderWidth: 3, padding: 2, position: 'relative' },
  storyRingUnseen: { borderColor: '#A985FF', backgroundColor: '#17131F' },
  storyRingSeen: { borderColor: 'rgba(145,145,155,0.42)', backgroundColor: 'rgba(40,40,46,0.42)' },
  storyCircleInner: { width: '100%', height: '100%', borderRadius: 29, backgroundColor: '#171820' },
  storyTextCircle: { justifyContent: 'center', alignItems: 'center' },
  storyFallbackIcon: { fontSize: 21 },
  storyCountBadge: { position: 'absolute', right: -5, bottom: -3, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#A985FF', borderWidth: 2, borderColor: '#08090D', alignItems: 'center', justifyContent: 'center' },
  storyCountText: { color: '#0C0812', fontSize: 9, fontWeight: '900' },
  storyName: { marginTop: 7, fontSize: 10, color: '#D0D0D6', fontWeight: '700', maxWidth: 72, textAlign: 'center' },
  storyNameSeen: { color: 'rgba(160,160,170,0.58)' },
  storyCreateBox: { backgroundColor: '#101117', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#292A33', maxWidth: '100%', minWidth: 0 },
  storyPreview: { width: '100%', height: 145, borderRadius: 12, marginBottom: 8, maxWidth: '100%' },
  createTitle: { fontSize: 14, fontWeight: '800', color: '#F3F4F6', marginBottom: 8 },
  createPostCard: { marginTop: 22, backgroundColor: '#101117', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#292A33', maxWidth: '100%', minWidth: 0 },
  createPostHeader: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', minWidth: 0 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#302447', justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#6E4FA9' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 22 },
  avatarText: { fontSize: 16, color: '#F1EAFE', fontWeight: '900' },
  postPrompt: { flex: 1, minHeight: 44, borderRadius: 22, backgroundColor: '#1A1E27', justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: '#292E39', minWidth: 0, maxWidth: '100%' },
  postPromptText: { color: '#858C99', fontSize: 13, flexShrink: 1, minWidth: 0 },
  postCreateBox: { marginTop: 10 },
  postInput: { minHeight: 72, maxHeight: 130, borderRadius: 13, backgroundColor: '#0A0B10', borderWidth: 1, borderColor: '#292E39', paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: '#F1F3F5', textAlignVertical: 'top', maxWidth: '100%', minWidth: 0 },
  postPreview: { width: '100%', height: 190, borderRadius: 13, marginBottom: 8, maxWidth: '100%' },
  removeImageButton: { position: 'absolute', right: 10, top: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(11,13,18,0.86)', justifyContent: 'center', alignItems: 'center' },
  removeImageText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  createActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9, gap: 8, maxWidth: '100%', minWidth: 0 },
  secondaryButton: { flex: 1, paddingVertical: 10, borderRadius: 11, backgroundColor: '#191A22', alignItems: 'center', borderWidth: 1, borderColor: '#30313B', minWidth: 0, maxWidth: '100%' },
  secondaryButtonText: { color: '#D3D3DA', fontSize: 12, fontWeight: '800', flexShrink: 1, textAlign: 'center' },
  primarySmallButton: { flex: 1, paddingVertical: 10, borderRadius: 11, backgroundColor: '#F28A2E', alignItems: 'center', minWidth: 0, maxWidth: '100%' },
  primarySmallText: { color: '#15110A', fontWeight: '900', flexShrink: 1, textAlign: 'center' },
  postCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
    marginHorizontal: -14,
    marginBottom: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#202129',
    width: 'auto',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  reviewPostCard: {
    marginHorizontal: 0,
    marginTop: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#34284F',
    backgroundColor: '#111018',
  },
  quotePostCard: {
    marginHorizontal: 0,
    marginTop: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: '#2D2738',
    borderLeftColor: '#8D65F2',
    backgroundColor: '#111017',
  },
  postImage: { width: '100%', height: 292, borderRadius: 13, marginTop: 14, maxWidth: '100%' },
  postText: { marginTop: 14, fontSize: 15, lineHeight: 23, color: '#ECECF0', flexShrink: 1, maxWidth: '100%' },
  quotePostText: { fontSize: 18, lineHeight: 28, color: '#F3EFFB', fontStyle: 'italic', flexShrink: 1, maxWidth: '100%' },
  feedTypeLabel: { alignSelf: 'flex-start', marginTop: 14, color: '#A985FF', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  moreButton: { color: '#747680', fontSize: 15, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 4 },
  postActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 6, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#252A34', maxWidth: '100%', minWidth: 0 },
  postAction: { minWidth: 48, height: 38, paddingHorizontal: 10, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  postActionActive: { backgroundColor: '#1D1728', borderWidth: 1, borderColor: '#302342' },
  postActionCount: { fontSize: 12, fontWeight: '700', color: '#9EA5B1' },
  postActionText: { fontSize: 12, fontWeight: '700', color: '#9EA5B1', flexShrink: 1, textAlign: 'center' },
  likedPostAction: { color: '#FF6B7A', fontWeight: '800' },
  repostedPostAction: { color: '#66D19E', fontWeight: '800' },
  savedText: { color: '#F5A623', fontWeight: '800' },
  loadingBox: { alignItems: 'center', marginVertical: 20 },
  info: { marginTop: 8, textAlign: 'center', color: '#858C99' },
  empty: { alignItems: 'center', marginTop: 35, padding: 20, backgroundColor: '#12151C', borderRadius: 18, borderWidth: 1, borderColor: '#242934' },
  emptyIcon: { fontSize: 45 },
  emptyTitle: { marginTop: 12, fontSize: 19, fontWeight: '800', color: '#F2F3F5' },
  emptyText: { marginTop: 8, textAlign: 'center', color: '#858C99', lineHeight: 21 },
  emptyButton: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F5A623' },
  emptyButtonText: { color: '#17120A', fontWeight: '900' },
  reviewCard: { backgroundColor: '#111018', borderRadius: 18, padding: 15, marginBottom: 14, borderWidth: 1, borderColor: '#34284F', width: '100%', maxWidth: '100%', minWidth: 0, alignSelf: 'stretch' },
  userRow: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', minWidth: 0 },
  feedProfileButton: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  userInfo: { flex: 1, minWidth: 0 },
  username: { fontSize: 14, fontWeight: '800', color: '#F2F3F5', flexShrink: 1, minWidth: 0 },
  handle: { marginTop: 2, fontSize: 12, color: '#9198A6', flexShrink: 1, minWidth: 0 },
  date: { marginTop: 3, fontSize: 11, color: '#737A87' },
  bookTitle: { fontSize: 14, fontWeight: '800', color: '#F2F2F5', flexShrink: 1, minWidth: 0 },
  bookAttachment: { flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 11, borderRadius: 13, backgroundColor: '#171820', borderWidth: 1, borderColor: '#2B2C36', maxWidth: '100%', minWidth: 0 },
  bookAttachmentIcon: { width: 38, height: 48, borderRadius: 7, overflow: 'hidden', backgroundColor: '#382651', justifyContent: 'center', alignItems: 'center', marginRight: 11 },
  bookAttachmentCover: { width: '100%', height: '100%', borderRadius: 7 },
  bookAttachmentEmoji: { color: '#C7A9FF', fontSize: 22 },
  bookAttachmentInfo: { flex: 1, minWidth: 0 },
  bookAttachmentLabel: { color: '#8D65F2', fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginBottom: 4 },
  bookAttachmentArrow: { color: '#777985', fontSize: 28, marginLeft: 8 },
  rating: { flexDirection: 'row', alignItems: 'center', marginTop: 8, maxWidth: '100%', minWidth: 0 },
  stars: { fontSize: 17, letterSpacing: 1, color: '#F28A2E', flexShrink: 1 },
  ratingNumber: { marginLeft: 8, fontSize: 12, color: '#9299A5', flexShrink: 1 },
  reviewText: { marginTop: 12, fontSize: 15, lineHeight: 22, color: '#D9DCE2', flexShrink: 1, maxWidth: '100%' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#252A34', gap: 6, maxWidth: '100%', minWidth: 0 },
  actionButton: { minWidth: 48, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 13 },
  action: { fontSize: 12, color: '#9EA5B1', fontWeight: '700', flexShrink: 1 },
  likedAction: { color: '#FF6B7A' },
  repostedAction: { color: '#66D19E' },
  count: { fontSize: 11, color: '#777F8C', fontWeight: '700' },
  commentBox: { marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#25262E', maxWidth: '100%', minWidth: 0 },
  commentInput: { minHeight: 44, maxHeight: 96, backgroundColor: '#0A0B10', borderRadius: 22, paddingHorizontal: 15, paddingVertical: 11, fontSize: 13, color: '#F1F3F5', textAlignVertical: 'top', borderWidth: 1, borderColor: '#30313A', maxWidth: '100%', minWidth: 0 },
  commentButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8, maxWidth: '100%', minWidth: 0, flexWrap: 'wrap' },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#191A22', borderWidth: 1, borderColor: '#2B303C' },
  cancelText: { color: '#A9AFB9', fontWeight: '700' },
  sendButton: { paddingHorizontal: 17, paddingVertical: 8, borderRadius: 16, backgroundColor: '#7B55D9' },
  sendText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  comments: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#252A34', maxWidth: '100%', minWidth: 0 },
  comment: { marginBottom: 7, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 13, backgroundColor: '#17181F', maxWidth: '100%', minWidth: 0 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', maxWidth: '100%', minWidth: 0 },
  commentUser: { fontSize: 12, fontWeight: '800', color: '#E7E9ED', flexShrink: 1, minWidth: 0 },
  deleteComment: { fontSize: 12, fontWeight: '700', color: '#FF6B7A' },
  commentText: { marginTop: 4, fontSize: 13, color: '#C4C8D0', lineHeight: 19, flexShrink: 1, maxWidth: '100%' },
  commentDate: { marginTop: 5, fontSize: 10, color: '#737A87' },
  reportSheetRoot: { flex: 1, justifyContent: 'flex-end' },
  reportSheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.62)' },
  reportSheet: { maxHeight: '88%', backgroundColor: '#101014', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: '#2A2A31', overflow: 'hidden' },
  reportSheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 3, backgroundColor: '#4B4B54', marginTop: 9 },
  reportSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14 },
  reportSheetEyebrow: { color: '#A985FF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  reportSheetTitle: { color: '#F4F4F7', fontSize: 20, fontWeight: '900', marginTop: 3 },
  reportSheetClose: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#18181E' },
  reportSheetHelp: { color: '#8E8E9A', fontSize: 12.5, lineHeight: 18, paddingHorizontal: 18, marginTop: 9, marginBottom: 8 },
  reportCategoryList: { flexGrow: 0, maxHeight: 420 },
  reportCategoryListContent: { paddingHorizontal: 14, paddingVertical: 4 },
  reportCategoryRow: { minHeight: 54, borderRadius: 14, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  reportCategoryRowSelected: { backgroundColor: '#21182F' },
  reportCategoryIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#18181E', borderWidth: 1, borderColor: '#292931' },
  reportCategoryIconSelected: { backgroundColor: '#2B1E40', borderColor: '#5A3D83' },
  reportCategoryText: { flex: 1, color: '#D1D1D8', fontSize: 14, fontWeight: '700' },
  reportCategoryTextSelected: { color: '#F2ECFF' },
  reportNoteWrap: { borderTopWidth: 1, borderTopColor: '#292930', paddingHorizontal: 16, paddingTop: 12 },
  reportNoteLabel: { color: '#B8B8C2', fontSize: 11.5, fontWeight: '800', marginBottom: 7 },
  reportNoteInput: { minHeight: 74, maxHeight: 120, borderRadius: 14, backgroundColor: '#18181E', borderWidth: 1, borderColor: '#303038', color: '#F2F2F5', fontSize: 13, lineHeight: 18, paddingHorizontal: 12, paddingTop: 11, textAlignVertical: 'top' },
  reportSubmitButton: { marginTop: 10, minHeight: 48, borderRadius: 14, backgroundColor: '#6F49C8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reportSubmitButtonDisabled: { opacity: 0.55 },
  reportSubmitText: { color: '#FFF', fontSize: 14, fontWeight: '900' },

  commentSheetRoot: { flex: 1, justifyContent: 'flex-end' },
  commentSheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.58)' },
  commentSheet: { height: '76%', minHeight: 420, backgroundColor: '#101014', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: '#2A2A31', overflow: 'hidden' },
  commentSheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 3, backgroundColor: '#4B4B54', marginTop: 9, marginBottom: 5 },
  commentSheetHeader: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  commentSheetHeaderSpacer: { width: 38 },
  commentSheetTitle: { color: '#F4F4F6', fontSize: 15, fontWeight: '900' },
  commentSheetClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  commentSheetDivider: { height: 1, backgroundColor: '#26262D' },
  commentSheetList: { flex: 1 },
  commentSheetListContent: { paddingHorizontal: 16, paddingVertical: 10 },
  commentSheetEmptyContent: { flexGrow: 1, justifyContent: 'center' },
  commentSheetEmpty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  commentSheetEmptyTitle: { color: '#ECECF0', fontSize: 16, fontWeight: '800', marginTop: 12 },
  commentSheetEmptyText: { color: '#777782', fontSize: 12, marginTop: 5 },
  commentSheetRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12 },
  commentSheetAvatarWrap: { marginRight: 11 },
  commentSheetAvatar: { width: 38, height: 38, borderRadius: 19 },
  commentSheetAvatarFallback: { backgroundColor: '#2B2140', borderWidth: 1, borderColor: '#5C438B', alignItems: 'center', justifyContent: 'center' },
  commentSheetAvatarText: { color: '#E2D4FF', fontSize: 14, fontWeight: '900' },
  commentSheetBody: { flex: 1, minWidth: 0 },
  commentSheetNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  commentSheetUser: { color: '#F0F0F3', fontSize: 12.5, fontWeight: '800', flexShrink: 1 },
  commentSheetDate: { color: '#6F707A', fontSize: 9.5 },
  commentSheetCommentText: { color: '#D1D1D7', fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  commentSheetDelete: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  commentComposer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#26262D', backgroundColor: '#0D0D11' },
  commentComposerAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A20', borderWidth: 1, borderColor: '#2C2C34', marginBottom: 4, overflow: 'hidden' },
  commentComposerAvatarImage: { width: '100%', height: '100%', borderRadius: 17 },
  commentComposerInput: { flex: 1, minHeight: 42, maxHeight: 96, borderRadius: 21, backgroundColor: '#18181E', borderWidth: 1, borderColor: '#303039', color: '#F3F3F5', fontSize: 13.5, paddingHorizontal: 14, paddingVertical: 10, textAlignVertical: 'top' },
  commentComposerSend: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 6, marginBottom: 1 },
  commentComposerSendDisabled: { opacity: 0.4 },
  commentComposerSendText: { color: '#A985FF', fontSize: 12.5, fontWeight: '900' },
  floatingCreateButton: { position: 'absolute', right: 18, bottom: 103, width: 56, height: 56, borderRadius: 28, backgroundColor: '#F28A2E', borderWidth: 2, borderColor: '#FFB15C', justifyContent: 'center', alignItems: 'center', zIndex: 20, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.35, shadowRadius: 8 },
  floatingCreateIcon: { color: '#17100A', fontSize: 34, lineHeight: 36, fontWeight: '400' },
  headerMenuWrap: { position: 'relative', zIndex: 50 },
  authDropdown: { position: 'absolute', top: 48, left: 0, width: 170, backgroundColor: '#111116', borderRadius: 16, borderWidth: 1, borderColor: '#292932', paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 12, zIndex: 100 },
  authDropdownItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 11 },
  authDropdownText: { color: '#F1F1F5', fontSize: 14, fontWeight: '700' },
  authDropdownDivider: { height: 1, backgroundColor: '#24242B', marginHorizontal: 12 },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.48)' },
  drawerPanel: { width: '86%', height: '100%', backgroundColor: '#101012', paddingTop: 54, paddingHorizontal: 24, borderRightWidth: 1, borderRightColor: '#24242A' },
  drawerDismissArea: { flex: 1 },
  drawerHeader: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  drawerBrand: { fontSize: 24, fontWeight: '800', color: '#F3F3F6', letterSpacing: -0.5 },
  drawerBrandAccent: { color: '#A985FF' },
  drawerCloseButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17171C', borderWidth: 1, borderColor: '#2A2A31' },
  drawerDivider: { height: 1, backgroundColor: '#29292F', marginTop: 18, marginBottom: 26 },
  drawerSection: { gap: 6 },
  drawerItem: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 10 },
  drawerIconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17171C', borderWidth: 1, borderColor: '#29292F', marginRight: 14 },
  drawerItemText: { color: '#F3F3F6', fontSize: 18, fontWeight: '700' },
  drawerBottomArea: { marginTop: 'auto', paddingBottom: 42, paddingTop: 22, borderTopWidth: 1, borderTopColor: '#29292F' },
  drawerBottomText: { color: '#7F7F89', fontSize: 13 },
});

// RESPONSIVE_HOME_SAFE_V1
