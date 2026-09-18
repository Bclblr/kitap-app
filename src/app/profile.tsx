import ReviewSpoilerText from '@/components/ReviewSpoilerText';
import QuoteMetadata from '@/components/QuoteMetadata';
import { useThemedStyles } from '@/theme/use-themed-styles';
import ReadersList from '@/components/ReadersList';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Image from '@/components/SafeImage';
import ProfileHeader from '@/components/profile/ProfileHeader';
import RetryNotice from '@/components/RetryNotice';

import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { isUserVerified } from '@/lib/verification';
import { isUserPremium } from '@/lib/premium';
import { loadProfileCustomization, PremiumProfileCustomization } from '@/lib/profile-customization';

type Comment = {
  id: string;
  username: string;
  text: string;
  createdAt: string;
};

type ProfileData = {
  fullName?: string;
  id: string;
  username: string;
  bio: string;
  profileImage: string | null;
  coverImage: string | null;
};

type Review = {
  id: string;
  userId: string;
  bookKey: string;
  bookTitle: string;
  rating: number;
  text: string;
  title?: string | null;
  topic?: string | null;
  tags?: string[];
  containsSpoiler?: boolean;
  createdAt: string;
};

type Quote = {
  id: string;
  userId: string;
  bookKey: string;
  bookTitle: string;
  text: string;
  title?: string | null;
  topic?: string | null;
  pageNumber?: number | null;
  note?: string | null;
  createdAt: string;
};

type Post = {
  id: string;
  userId: string;
  username: string;
  text: string;
  imageUrl: string | null;
  bookKey: string | null;
  bookTitle: string | null;
  rating: number;
  createdAt: string;
};

type FeedItem = {
  id: string;
  type: 'review' | 'quote' | 'post';
  createdAt: string;
  review?: Review;
  quote?: Quote;
  post?: Post;
  reposted?: boolean;
  repostedByUsername?: string;
  repostedAt?: string;
};

const PROFILE_PAGE_SIZE = 20;

const DEFAULT_PROFILE: ProfileData = {
  id: '',
  username: 'Kitap Okuru',
  bio: 'Kitaplar, hikâyeler ve keşfedilecek yeni dünyalar 📚',
  profileImage: null,
  coverImage: null,
};

export default function ProfileScreen() {
  const [profileTab, setProfileTab] = useState<'post'|'review'|'quote'|'repost'>('post');
  const styles = useThemedStyles(baseStyles);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const router = useRouter();

  const { userId } = useLocalSearchParams<{
    userId?: string;
  }>();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumProfileCustomization, setPremiumProfileCustomization] = useState<PremiumProfileCustomization | null>(null);

  const [profile, setProfile] =
    useState<ProfileData>(DEFAULT_PROFILE);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [bookCount, setBookCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [quoteCount, setQuoteCount] = useState(0);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followRequestPending, setFollowRequestPending] = useState(false);
  const [isPrivateProfile, setIsPrivateProfile] = useState(false);
  const [canViewProfileContent, setCanViewProfileContent] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [safetyLoading, setSafetyLoading] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [profileLoadingMore, setProfileLoadingMore] = useState(false);
  const [profileHasMore, setProfileHasMore] = useState({ post: true, review: true, quote: true, repost: true });
  const visibleFeed = canViewProfileContent
    ? feed.filter(item => profileTab === 'repost' ? item.reposted : !item.reposted && item.type === profileTab)
    : [];

  const [selectedPost, setSelectedPost] =
    useState<Post | null>(null);

  const [postModalVisible, setPostModalVisible] =
    useState(false);

  const [commentText, setCommentText] = useState('');

  const [comments, setComments] =
    useState<Comment[]>([]);

  const [commentsLoading, setCommentsLoading] =
    useState(false);

  const [commentSending, setCommentSending] =
    useState(false);

  const [selectedReview, setSelectedReview] =
    useState<Review | null>(null);

  const [reviewModalVisible, setReviewModalVisible] =
    useState(false);

  const isOwnProfile =
    !userId || userId === currentUserId;

  async function getCurrentUserId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user?.id ?? null;
  }

  /*
   * ============================================================
   * PROFİL
   * ============================================================
   */

  const loadProfile = useCallback(async () => {
    try {
      const loggedInUserId =
        await getCurrentUserId();

      setCurrentUserId(loggedInUserId);

      const targetUserId =
        typeof userId === 'string' && userId
          ? userId
          : loggedInUserId;

      if (!targetUserId) {
        setProfile(DEFAULT_PROFILE);
        setIsVerified(false);
        setIsPremium(false);
        setPremiumProfileCustomization(null);
        return;
      }

      const [verified, premium, customization] = await Promise.all([
        isUserVerified(targetUserId).catch(() => false),
        isUserPremium(targetUserId).catch(() => false),
        loadProfileCustomization(targetUserId).catch(() => null),
      ]);
      setIsVerified(verified);
      setIsPremium(premium);
      setPremiumProfileCustomization(premium ? customization : null);

      const { data, error } =
        await supabase
          .from('profiles')
          .select(
            'id, username, full_name, bio, profile_image, cover_image'
          )
          .eq('id', targetUserId)
          .maybeSingle();

      if (error) {
        console.error(
          'Profil yüklenemedi:',
          error
        );
        return;
      }

      if (!data) {
        if (targetUserId !== loggedInUserId) {
          setProfile(DEFAULT_PROFILE);
          return;
        }

        const newProfile = {
          id: targetUserId,
          username: DEFAULT_PROFILE.username,
          bio: DEFAULT_PROFILE.bio,
          profile_image: null,
          cover_image: null,
        };

        const { error: insertError } =
          await supabase
            .from('profiles')
            .insert(newProfile);

        if (insertError) {
          console.error(
            'Profil oluşturulamadı:',
            insertError
          );
        }

        setProfile(DEFAULT_PROFILE);
        return;
      }

      setProfile({
  id: data.id,

  username:
    data.username ||
    DEFAULT_PROFILE.username,

  fullName:
    data.full_name || '',

  bio:
    data.bio ??
    DEFAULT_PROFILE.bio,

  profileImage:
    data.profile_image || null,

  coverImage:
    data.cover_image || null,
});
    } catch (error) {
      console.error(
        'Profil yükleme hatası:',
        error
      );
    }
  }, [userId]);

  /*
   * ============================================================
   * TAKİP
   * ============================================================
   */

  const loadFollowData = useCallback(async () => {
    try {
      const loggedInUserId = await getCurrentUserId();
      const targetUserId = typeof userId === 'string' && userId ? userId : loggedInUserId;

      if (!targetUserId) {
        setFollowerCount(0);
        setFollowingCount(0);
        setIsFollowing(false);
        setFollowRequestPending(false);
        setIsPrivateProfile(false);
        setCanViewProfileContent(true);
        return;
      }

      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetUserId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetUserId),
      ]);

      setFollowerCount(followers || 0);
      setFollowingCount(following || 0);

      if (loggedInUserId && loggedInUserId !== targetUserId) {
        const { data, error } = await supabase.rpc('get_follow_relationship', { p_target: targetUserId });
        if (error) throw error;
        const relationship = Array.isArray(data) ? data[0] : data;
        setIsFollowing(relationship?.is_following === true);
        setFollowRequestPending(relationship?.request_pending === true);
        setIsPrivateProfile(relationship?.is_private === true);
        setCanViewProfileContent(relationship?.can_view_content !== false);
      } else {
        setIsFollowing(false);
        setFollowRequestPending(false);
        setCanViewProfileContent(true);
        const { data } = await supabase
          .from('profile_privacy_settings')
          .select('is_private')
          .eq('user_id', targetUserId)
          .maybeSingle();
        setIsPrivateProfile(data?.is_private === true);
      }
    } catch (error) {
      console.error('Takip bilgileri yüklenemedi:', error);
    }
  }, [userId]);

  async function toggleFollow() {
    try {
      const loggedInUserId = await getCurrentUserId();
      const targetUserId = typeof userId === 'string' && userId ? userId : null;

      if (!loggedInUserId) {
        Alert.alert('Giriş gerekli', 'Takip etmek için giriş yapmalısın.');
        return;
      }
      if (!targetUserId || loggedInUserId === targetUserId) return;

      setFollowLoading(true);

      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', loggedInUserId)
          .eq('following_id', targetUserId);
        if (error) throw error;
        setIsFollowing(false);
        setFollowerCount((count) => Math.max(0, count - 1));
        setCanViewProfileContent(!isPrivateProfile);
        return;
      }

      if (followRequestPending) {
        const { error } = await supabase.rpc('cancel_follow_request', { p_target: targetUserId });
        if (error) throw error;
        setFollowRequestPending(false);
        return;
      }

      const { data, error } = await supabase.rpc('request_follow', { p_target: targetUserId });
      if (error) throw error;
      const result = String(data ?? '');
      if (result === 'requested') {
        setFollowRequestPending(true);
      } else {
        setIsFollowing(true);
        setFollowRequestPending(false);
        setFollowerCount((count) => count + 1);
        setCanViewProfileContent(true);
      }
    } catch (error) {
      console.error('Takip işlemi başarısız:', error);
      Alert.alert('Hata', 'Takip işlemi tamamlanamadı.');
    } finally {
      setFollowLoading(false);
    }
  }

  async function reportProfile() {
    const loggedInUserId = await getCurrentUserId();
    const targetUserId = typeof userId === 'string' && userId ? userId : null;
    if (!loggedInUserId) {
      Alert.alert('Giriş gerekli', 'Şikâyet göndermek için giriş yapmalısın.');
      return;
    }
    if (!targetUserId || targetUserId === loggedInUserId) return;

    const submitReport = async (category: string) => {
      try {
        setSafetyLoading(true);
        const { error } = await supabase.from('reports').insert({ reporter_id: loggedInUserId, target_type: 'user', target_id: targetUserId, category, description: '' });
        if (error) throw error;
        Alert.alert('Şikâyet alındı', 'Bildirimin inceleme için gönderildi.');
      } catch (error) {
        console.error('Kullanıcı şikâyeti gönderilemedi:', error);
        Alert.alert('Hata', 'Şikâyet gönderilemedi.');
      } finally { setSafetyLoading(false); }
    };

    Alert.alert('Kullanıcıyı şikâyet et', 'Şikâyet nedenini seç.', [
      { text: 'Spam', onPress: () => submitReport('spam') },
      { text: 'Taciz', onPress: () => submitReport('harassment') },
      { text: 'Uygunsuz içerik', onPress: () => submitReport('inappropriate') },
      { text: 'Taklit / sahte hesap', onPress: () => submitReport('impersonation') },
      { text: 'Diğer', onPress: () => submitReport('other') },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }

  async function blockProfile() {
    const loggedInUserId = await getCurrentUserId();
    const targetUserId = typeof userId === 'string' && userId ? userId : null;
    if (!loggedInUserId) {
      Alert.alert('Giriş gerekli', 'Kullanıcı engellemek için giriş yapmalısın.');
      return;
    }
    if (!targetUserId || targetUserId === loggedInUserId) return;

    Alert.alert('Kullanıcıyı engelle', `@${profile.username} hesabını engellemek istiyor musun?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Engelle', style: 'destructive', onPress: async () => {
        try {
          setSafetyLoading(true);
          const { error } = await supabase.from('user_blocks').insert({ blocker_id: loggedInUserId, blocked_id: targetUserId });
          if (error && error.code !== '23505') throw error;
          await supabase.from('follows').delete().eq('follower_id', loggedInUserId).eq('following_id', targetUserId);
          await supabase.from('follows').delete().eq('follower_id', targetUserId).eq('following_id', loggedInUserId);
          Alert.alert('Engellendi', 'Bu kullanıcıyla etkileşim kısıtlandı.', [{ text: 'Tamam', onPress: () => router.replace('/profile') }]);
        } catch (error) {
          console.error('Kullanıcı engellenemedi:', error);
          Alert.alert('Hata', 'Kullanıcı engellenemedi.');
        } finally { setSafetyLoading(false); }
      }},
    ]);
  }

  function openSafetyMenu() {
    Alert.alert('Profil seçenekleri', `@${profile.username}`, [
      { text: 'Şikâyet Et', onPress: reportProfile },
      { text: 'Engelle', style: 'destructive', onPress: blockProfile },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }

  /*
   * ============================================================
   * İNCELEMELER
   * ============================================================
   */

  function buildFeed(
    loadedReviews: Review[],
    loadedQuotes: Quote[],
    loadedPosts: Post[],
    repostItems: FeedItem[]
  ) {
    const items: FeedItem[] = [];

    loadedReviews.forEach(
      (review) => {
        items.push({
          id:
            `review-${review.id}`,

          type: 'review',

          createdAt:
            review.createdAt,

          review,
        });
      }
    );

    loadedQuotes.forEach(
      (quote) => {
        items.push({
          id:
            `quote-${quote.id}`,

          type: 'quote',

          createdAt:
            quote.createdAt,

          quote,
        });
      }
    );

    loadedPosts.forEach(
      (post) => {
        items.push({
          id:
            `post-${post.id}`,

          type: 'post',

          createdAt:
            post.createdAt,

          post,
        });
      }
    );

    items.push(
      ...repostItems
    );

    items.sort(
      (a, b) =>
        new Date(
          b.createdAt
        ).getTime() -
        new Date(
          a.createdAt
        ).getTime()
    );

    setFeed(items);
  }

  async function loadMoreProfileContent() {
    if (profileLoadingMore || !profileHasMore[profileTab]) return;

    const loggedInUserId = await getCurrentUserId();
    const targetUserId = typeof userId === 'string' && userId ? userId : loggedInUserId;
    if (!targetUserId) return;

    setProfileLoadingMore(true);
    try {
      let newItems: FeedItem[] = [];
      let pageLength = 0;

      if (profileTab === 'review') {
        const { data, error } = await supabase
          .from('reviews')
          .select('id, user_id, book_key, book_title, rating, text, title, topic, tags, contains_spoiler, created_at')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .range(reviews.length, reviews.length + PROFILE_PAGE_SIZE - 1);
        if (error) throw error;
        const page: Review[] = (data ?? []).map((item: any) => ({
          id: String(item.id),
          userId: String(item.user_id),
          bookKey: String(item.book_key || ''),
          bookTitle: String(item.book_title || ''),
          rating: Number(item.rating) || 0,
          text: String(item.text || ''),
          title: item.title ? String(item.title) : null,
          topic: item.topic ? String(item.topic) : null,
          tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
          containsSpoiler: item.contains_spoiler === true,
          createdAt: item.created_at || new Date().toISOString(),
        }));
        pageLength = page.length;
        setReviews((current) => [...current, ...page]);
        newItems = page.map((review) => ({
          id: `review-${review.id}`,
          type: 'review',
          createdAt: review.createdAt,
          review,
        }));
      } else if (profileTab === 'quote') {
        const { data, error } = await supabase
          .from('quotes')
          .select('id, user_id, book_key, book_title, text, title, topic, page_number, note, created_at')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .range(quotes.length, quotes.length + PROFILE_PAGE_SIZE - 1);
        if (error) throw error;
        const page: Quote[] = (data ?? []).map((item: any) => ({
          id: String(item.id),
          userId: String(item.user_id),
          bookKey: String(item.book_key || ''),
          bookTitle: String(item.book_title || ''),
          text: String(item.text || ''),
          title: item.title ? String(item.title) : null,
          topic: item.topic ? String(item.topic) : null,
          pageNumber: Number.isInteger(item.page_number) ? item.page_number : null,
          note: item.note ? String(item.note) : null,
          createdAt: item.created_at || new Date().toISOString(),
        }));
        pageLength = page.length;
        setQuotes((current) => [...current, ...page]);
        newItems = page.map((quote) => ({
          id: `quote-${quote.id}`,
          type: 'quote',
          createdAt: quote.createdAt,
          quote,
        }));
      } else if (profileTab === 'post') {
        const { data, error } = await supabase
          .from('posts')
          .select('id, username, text, image_url, book_key, book_title, rating, created_at, user_id')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .range(posts.length, posts.length + PROFILE_PAGE_SIZE - 1);
        if (error) throw error;
        const page: Post[] = (data ?? []).map((item: any) => ({
          id: String(item.id),
          userId: String(item.user_id),
          username: item.username || profile.username,
          text: item.text || '',
          imageUrl: item.image_url || null,
          bookKey: item.book_key || null,
          bookTitle: item.book_title || null,
          rating: Number(item.rating) || 0,
          createdAt: item.created_at || new Date().toISOString(),
        }));
        pageLength = page.length;
        setPosts((current) => [...current, ...page]);
        newItems = page.map((post) => ({
          id: `post-${post.id}`,
          type: 'post',
          createdAt: post.createdAt,
          post,
        }));
      } else {
        const repostOffset = feed.filter((item) => item.reposted).length;
        const { data: repostRows, error } = await supabase
          .from('post_reposts')
          .select('id, post_id, user_id, created_at')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .range(repostOffset, repostOffset + PROFILE_PAGE_SIZE - 1);
        if (error) throw error;

        pageLength = repostRows?.length ?? 0;
        const postIds = (repostRows ?? []).map((row: any) => row.post_id);
        if (postIds.length) {
          const { data: repostPosts, error: postsError } = await supabase
            .from('posts')
            .select('id, username, text, image_url, book_key, book_title, rating, created_at, user_id')
            .in('id', postIds);
          if (postsError) throw postsError;

          const postMap = new Map<string, Post>();
          for (const item of repostPosts ?? []) {
            postMap.set(String(item.id), {
              id: String(item.id),
              userId: String(item.user_id),
              username: item.username || 'Kitap Okuru',
              text: item.text || '',
              imageUrl: item.image_url || null,
              bookKey: item.book_key || null,
              bookTitle: item.book_title || null,
              rating: Number(item.rating) || 0,
              createdAt: item.created_at || new Date().toISOString(),
            });
          }

          newItems = (repostRows ?? []).flatMap((repost: any) => {
            const post = postMap.get(String(repost.post_id));
            return post ? [{
              id: `repost-${repost.id}`,
              type: 'post' as const,
              createdAt: repost.created_at,
              post,
              reposted: true,
              repostedByUsername: profile.username,
              repostedAt: repost.created_at,
            }] : [];
          });
        }
      }

      setFeed((current) => [...current, ...newItems].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
      ));
      setProfileHasMore((current) => ({
        ...current,
        [profileTab]: pageLength === PROFILE_PAGE_SIZE,
      }));
    } catch (error) {
      console.error('Profil içeriğinin devamı yüklenemedi:', error);
    } finally {
      setProfileLoadingMore(false);
    }
  }

  /*
   * ============================================================
   * İSTATİSTİKLER
   * ============================================================
   */

  const loadStats = useCallback(async () => {
    try {
      const loggedInUserId =
        await getCurrentUserId();

      const targetUserId =
        typeof userId === 'string' && userId
          ? userId
          : loggedInUserId;

      console.log('PROFILE QUOTES USER ID:', loggedInUserId);
      console.log('PROFILE QUOTES TARGET USER ID:', targetUserId);

      if (!targetUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) {
        setBookCount(0);
        setReviewCount(0);
        setQuoteCount(0);
        setReviews([]);
        setQuotes([]);
        setPosts([]);
        setFeed([]);
        return;
      }

      /*
       * Önce içerikleri yükle
       */

      const [
        reviewsResult,
        quotesResult,
        postsResult,
        repostResult,
        statsResult,
      ] = await Promise.all([
        supabase
          .from('reviews')
          .select(
            'id, user_id, book_key, book_title, rating, text, title, topic, tags, contains_spoiler, created_at'
          )
          .eq(
            'user_id',
            targetUserId
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          )
          .limit(PROFILE_PAGE_SIZE),

        supabase
          .from('quotes')
          .select(
            'id, user_id, book_key, book_title, text, title, topic, page_number, note, created_at'
          )
          .eq(
            'user_id',
            targetUserId
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          )
          .limit(PROFILE_PAGE_SIZE),

        supabase
          .from('posts')
          .select(
            'id, username, text, image_url, book_key, book_title, rating, created_at, user_id'
          )
          .eq(
            'user_id',
            targetUserId
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          )
          .limit(PROFILE_PAGE_SIZE),

        supabase
          .from('post_reposts')
          .select(
            'id, post_id, user_id, created_at'
          )
          .eq(
            'user_id',
            targetUserId
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          )
          .limit(PROFILE_PAGE_SIZE),

        supabase.rpc('get_profile_content_stats', {
          p_target: targetUserId,
        }),
      ]);

      /*
       * İNCELEMELER
       */

      if (reviewsResult.error) {
        console.error(
          'Profil incelemeleri yüklenemedi:',
          reviewsResult.error
        );
      }

      const loadedReviews: Review[] =
        (
          reviewsResult.data ||
          []
        ).map(
          (item: any) => ({
            id: String(
              item.id
            ),

            userId: String(
              item.user_id
            ),

            bookKey:
              String(
                item.book_key ||
                  ''
              ),

            bookTitle:
              String(
                item.book_title ||
                  ''
              ),

            rating:
              Number(
                item.rating
              ) || 0,

            text:
              String(
                item.text ||
                  ''
              ),

            title: item.title ? String(item.title) : null,
            topic: item.topic ? String(item.topic) : null,
            tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
            containsSpoiler: item.contains_spoiler === true,

            createdAt:
              item.created_at ||
              new Date().toISOString(),
          })
        );

      /*
       * ALINTILAR
       */

      console.log('PROFILE QUOTES DATA:', quotesResult.data);
      console.log('PROFILE QUOTES ERROR:', quotesResult.error);

      if (quotesResult.error) {
        console.error(
          'Alıntılar yüklenemedi:',
          quotesResult.error
        );
      }

      const loadedQuotes: Quote[] =
        (
          quotesResult.data ||
          []
        ).map(
          (item: any) => ({
            id: String(
              item.id
            ),

            userId: item.user_id,

            bookKey:
              String(
                item.book_key ||
                  ''
              ),

            bookTitle:
              String(
                item.book_title ||
                  ''
              ),

            text:
              String(
                item.text ||
                  ''
              ),

            title: item.title ? String(item.title) : null,
            topic: item.topic ? String(item.topic) : null,
            pageNumber: Number.isInteger(item.page_number) ? item.page_number : null,
            note: item.note ? String(item.note) : null,

            createdAt:
              item.created_at ||
              new Date().toISOString(),
          })
        );

      /*
       * GÖNDERİLER
       */

      if (postsResult.error) {
        console.error(
          'Profil gönderileri yüklenemedi:',
          postsResult.error
        );
      }

      const loadedPosts: Post[] =
        (
          postsResult.data ||
          []
        ).map(
          (item: any) => ({
            id: String(
              item.id
            ),

            userId: String(
              item.user_id
            ),

            username:
              item.username ||
              profile.username,

            text:
              item.text ||
              '',

            imageUrl:
              item.image_url ||
              null,

            bookKey:
              item.book_key ||
              null,

            bookTitle:
              item.book_title ||
              null,

            rating:
              Number(
                item.rating
              ) || 0,

            createdAt:
              item.created_at ||
              new Date().toISOString(),
          })
        );

      /*
       * REPOSTLAR
       */

      let repostItems: FeedItem[] = [];

      if (
        !repostResult.error &&
        repostResult.data &&
        repostResult.data.length > 0
      ) {
        const repostPostIds =
          repostResult.data.map(
            (item: any) =>
              item.post_id
          );

        const {
          data: repostPosts,
          error: repostPostsError,
        } = await supabase
          .from('posts')
          .select(
            'id, username, text, image_url, book_key, book_title, rating, created_at, user_id'
          )
          .in(
            'id',
            repostPostIds
          );

        if (repostPostsError) {
          console.error(
            'Repost gönderileri yüklenemedi:',
            repostPostsError
          );
        } else {
          const postMap =
            new Map<string, Post>();

          (
            repostPosts ||
            []
          ).forEach(
            (item: any) => {
              postMap.set(
                String(
                  item.id
                ),
                {
                  id: String(
                    item.id
                  ),

                  userId:
                    String(
                      item.user_id
                    ),

                  username:
                    item.username ||
                    'Kitap Okuru',

                  text:
                    item.text ||
                    '',

                  imageUrl:
                    item.image_url ||
                    null,

                  bookKey:
                    item.book_key ||
                    null,

                  bookTitle:
                    item.book_title ||
                    null,

                  rating:
                    Number(
                      item.rating
                    ) || 0,

                  createdAt:
                    item.created_at ||
                    new Date().toISOString(),
                }
              );
            }
          );

          repostItems =
            repostResult.data
              .map(
                (repost: any) => {
                  const post =
                    postMap.get(
                      String(
                        repost.post_id
                      )
                    );

                  if (!post) {
                    return null;
                  }

                  return {
                    id:
                      `repost-${repost.id}`,

                    type: 'post',

                    createdAt:
                      repost.created_at,

                    post,

                    reposted:
                      true,

                    repostedByUsername:
                      profile.username,

                    repostedAt:
                      repost.created_at,
                  } as FeedItem;
                }
              )
              .filter(
                Boolean
              ) as FeedItem[];
        }
      }

      setReviews(
        loadedReviews
      );

      setQuotes(
        loadedQuotes
      );

      setPosts(
        loadedPosts
      );

      const statsRow = Array.isArray(statsResult.data) ? statsResult.data[0] : statsResult.data;
      setReviewCount(Number(statsRow?.review_count) || 0);
      setQuoteCount(Number(statsRow?.quote_count) || 0);
      setBookCount(Number(statsRow?.book_count) || 0);

      setProfileHasMore({
        review: (reviewsResult.data?.length ?? 0) === PROFILE_PAGE_SIZE,
        quote: (quotesResult.data?.length ?? 0) === PROFILE_PAGE_SIZE,
        post: (postsResult.data?.length ?? 0) === PROFILE_PAGE_SIZE,
        repost: (repostResult.data?.length ?? 0) === PROFILE_PAGE_SIZE,
      });

      /*
       * TEK AKIŞ
       */

      buildFeed(
        loadedReviews,
        loadedQuotes,
        loadedPosts,
        repostItems
      );
    } catch (error) {
      console.error(
        'Profil istatistikleri yüklenemedi:',
        error
      );
      setLoadError('Profil içerikleri şu anda yenilenemedi. Mevcut bilgiler korunuyor.');
    }
  }, [userId, profile.username]);

  /*
   * ============================================================
   * TÜM VERİLERİ YÜKLE
   * ============================================================
   */

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadAll() {
        setLoading(true);
        setLoadError(null);

        try {
          await loadProfile();
          await loadStats();
          await loadFollowData();
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      loadAll();

      return () => {
        active = false;
      };
    }, [
      loadProfile,
      loadStats,
      loadFollowData,
    ])
  );

  /*
   * ============================================================
   * TARİH
   * ============================================================
   */

  function formatDate(
    dateString: string
  ) {
    if (!dateString) {
      return '';
    }

    const date =
      new Date(
        dateString
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return dateString;
    }

    return date.toLocaleDateString(
      'tr-TR',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    );
  }

  function renderStars(
    rating: number
  ) {
    const safeRating =
      Math.max(
        0,
        Math.min(
          5,
          Math.round(
            Number(
              rating
            ) || 0
          )
        )
      );

    return '★'.repeat(
      safeRating
    );
  }

  /*
   * ============================================================
   * KİTABA GİT
   * ============================================================
   */

  function openBook(
    bookKey: string | null | undefined
  ) {
    if (!bookKey) {
      return;
    }

    router.push({
      pathname: '/book',
      params: {
        key: bookKey,
      },
    });
  }

  /*
   * ============================================================
   * YORUMLAR
   * ============================================================
   */

  async function openPostComments(
    post: Post
  ) {
    setSelectedPost(
      post
    );

    setPostModalVisible(
      true
    );

    setCommentsLoading(
      true
    );

    try {
      const {
        data,
        error,
      } = await supabase
        .from('post_comments')
        .select(
          'id, user_id, text, created_at'
        )
        .eq(
          'post_id',
          post.id
        )
        .order(
          'created_at',
          {
            ascending: true,
          }
        );

      if (error) {
        console.error(
          'Yorumlar yüklenemedi:',
          error
        );

        setComments([]);
        return;
      }

      const loadedComments: Comment[] =
        (
          data || []
        ).map(
          (item: any) => ({
            id:
              String(
                item.id
              ),

            username:
              'Kullanıcı',

            text:
              String(
                item.text ||
                  ''
              ),

            createdAt:
              item.created_at ||
              '',
          })
        );

      setComments(
        loadedComments
      );
    } finally {
      setCommentsLoading(
        false
      );
    }
  }

  async function sendPostComment() {
    const text =
      commentText.trim();

    if (
      !text ||
      !selectedPost
    ) {
      return;
    }

    const loggedInUserId =
      await getCurrentUserId();

    if (!loggedInUserId) {
      Alert.alert(
        'Giriş gerekli',
        'Yorum yapmak için giriş yapmalısın.'
      );
      return;
    }

    setCommentSending(
      true
    );

    try {
      const {
        data,
        error,
      } = await supabase
        .from('post_comments')
        .insert({
          post_id:
            selectedPost.id,

          user_id:
            loggedInUserId,

          text,
        })
        .select()
        .single();

      if (error) {
        console.error(
          'Yorum gönderilemedi:',
          error
        );

        Alert.alert(
          'Hata',
          'Yorum gönderilemedi.'
        );

        return;
      }

      setComments(
        (old) => [
          ...old,

          {
            id:
              String(
                data.id
              ),

            username:
              profile.username,

            text,

            createdAt:
              data.created_at ||
              new Date().toISOString(),
          },
        ]
      );

      setCommentText('');
    } finally {
      setCommentSending(
        false
      );
    }
  }

  function closePostModal() {
    setPostModalVisible(
      false
    );

    setSelectedPost(
      null
    );

    setCommentText('');
    setComments([]);
  }

  async function openMessageToProfile() {
    if (!profile?.id) {
      Alert.alert('Hata', 'Kullanıcı bulunamadı.');
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const senderId = authData.user?.id;
    if (!senderId) {
      Alert.alert('Giriş gerekli', 'Mesaj göndermek için giriş yapmalısın.');
      return;
    }

    const { data: allowed, error } = await supabase.rpc('can_message_user', {
      p_sender: senderId,
      p_target: profile.id,
    });
    if (error) {
      console.error('Mesaj izni kontrol edilemedi:', error);
      Alert.alert('Hata', 'Mesaj izni kontrol edilemedi.');
      return;
    }
    if (!allowed) {
      Alert.alert(
        'Mesaj gönderilemiyor',
        'Bu kullanıcı kimlerin mesaj gönderebileceğini sınırlandırmış olabilir.'
      );
      return;
    }

    router.push({
      pathname: '/chat',
      params: { userId: profile.id, username: profile.username || 'Kitap Okuru' },
    });
  }

  /*
   * ============================================================
   * YÜKLENİYOR
   * ============================================================
   */

  if (loading) {
    return (
      <View
        style={
          styles.container
        }
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <Text
            style={
              styles.loadingText
            }
          >
            Profil yükleniyor...
          </Text>
        </View>

        <BottomNav />
      </View>
    );
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <View
      style={
        styles.container
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <Text
          style={
            styles.pageTitle
          }
        >
          Profil
        </Text>

        {loadError ? (
          <RetryNotice
            message={loadError}
            busy={loading}
            onRetry={async () => {
              setLoadError(null);
              await Promise.all([loadProfile(), loadStats(), loadFollowData()]);
            }}
          />
        ) : null}

        <ProfileHeader
          profile={profile}
          customization={premiumProfileCustomization}
          isVerified={isVerified}
          isPremium={isPremium}
          editing={false}
          isOwnProfile={isOwnProfile}
          isFollowing={isFollowing}
          followRequestPending={followRequestPending}
          isPrivateProfile={isPrivateProfile}
          followLoading={followLoading}
          safetyLoading={safetyLoading}
          bookCount={bookCount}
          followerCount={followerCount}
          followingCount={followingCount}
          quoteCount={quoteCount}
          reviewCount={reviewCount}
          styles={styles}
          onAvatarPress={() => setAvatarOpen(true)}
          onOpenSettings={() => router.push('/profile-settings')}
          onToggleFollow={() => void toggleFollow()}
          onMessage={() => void openMessageToProfile()}
          onSafety={openSafetyMenu}
          onFollowers={() =>
            router.push({ pathname: '/readers', params: { id: profile.id, mode: 'followers' } })
          }
          onFollowing={() =>
            router.push({ pathname: '/readers', params: { id: profile.id, mode: 'following' } })
          }
        />

        {/* =====================================================
            TEK AKIŞ
            ===================================================== */}

        <View
          style={
            styles.section
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            {profileTab === 'post' ? 'Gönderiler' : profileTab === 'review' ? 'İncelemeler' : profileTab === 'quote' ? 'Alıntılar' : 'Tekrar Paylaşımlar'}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:12}}>
            {([['post','Gönderiler'],['review','İncelemeler'],['quote','Alıntılar'],['repost','Tekrar Paylaşımlar']] as const).map(([tab,label])=><Pressable key={tab} accessibilityRole="tab" accessibilityState={{selected:profileTab===tab}} onPress={()=>setProfileTab(tab)} style={{minHeight:44,padding:10,borderBottomWidth:3,borderBottomColor:profileTab===tab?'#9467E8':'transparent'}}><Text style={styles.feedType}>{label}</Text></Pressable>)}
          </ScrollView>
          {!canViewProfileContent ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🔒</Text>
              <Text style={styles.emptyTitle}>Bu hesap gizli</Text>
              <Text style={styles.emptyText}>
                Bu hesabın gönderilerini, incelemelerini, alıntılarını ve tekrar paylaşımlarını görmek için takip isteğinin onaylanması gerekiyor.
              </Text>
              {!isOwnProfile && (
                <Pressable
                  onPress={toggleFollow}
                  disabled={followLoading}
                  style={[styles.followButton, { width: '100%', marginTop: 16 }]}
                  accessibilityRole="button"
                  accessibilityLabel={followRequestPending ? 'Takip isteğini iptal et' : 'Takip isteği gönder'}
                >
                  <Text style={styles.followButtonText}>
                    {followLoading ? '...' : followRequestPending ? 'İstek Gönderildi' : 'Takip İsteği Gönder'}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : loadError && feed.length === 0 ? null : visibleFeed.length === 0 ? (
            <View
              style={
                styles.emptyCard
              }
            >
              <Text
                style={
                  styles.emptyIcon
                }
              >
                📚
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Henüz paylaşım yok
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                İnceleme, alıntı veya
                gönderilerini burada
                görebilirsin.
              </Text>
            </View>
          ) : (
            visibleFeed.map(
              (item) => {
                /*
                 * ================================================
                 * İNCELEME
                 * ================================================
                 */

                if (
                  item.type ===
                  'review' &&
                  item.review
                ) {
                  const review =
                    item.review;

                  return (
                    <Pressable
                      key={
                        item.id
                      }
                      onPress={() => {
                        setSelectedReview(
                          review
                        );

                        setReviewModalVisible(
                          true
                        );
                      }}
                      style={
                        styles.feedCard
                      }
                    >
                      <View
                        style={
                          styles.feedTypeRow
                        }
                      >
                        <Text
                          style={
                            styles.feedType
                          }
                        >
                          📚 İNCELEME
                        </Text>

                        <Text
                          style={
                            styles.feedDate
                          }
                        >
                          {formatDate(
                            review.createdAt
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.bookHeader
                        }
                      >
                        <Text
                          style={
                            styles.bookTitle
                          }
                          numberOfLines={
                            2
                          }
                        >
                          📖{' '}
                          {
                            review.bookTitle
                          }
                        </Text>

                        {review.bookKey && (
                          <Text
                            style={
                              styles.openBookText
                            }
                          >
                            ›
                          </Text>
                        )}
                      </View>

                      <View
                        style={
                          styles.ratingRow
                        }
                      >
                        <Text
                          style={
                            styles.stars
                          }
                        >
                          {renderStars(
                            review.rating
                          )}
                        </Text>

                        <Text
                          style={
                            styles.ratingText
                          }
                        >
                          {
                            review.rating
                          }
                          /5
                        </Text>
                      </View>

                      <ReviewSpoilerText
                        text={review.text}
                        containsSpoiler={review.containsSpoiler}
                        title={review.title}
                        topic={review.topic}
                        tags={review.tags}
                        textStyle={styles.feedText}
                      />
                    </Pressable>
                  );
                }

                /*
                 * ================================================
                 * ALINTI
                 * ================================================
                 */

                if (
                  item.type ===
                  'quote' &&
                  item.quote
                ) {
                  const quote =
                    item.quote;

                  return (
                    <Pressable
                      key={
                        item.id
                      }
                      onPress={() =>
                        openBook(
                          quote.bookKey
                        )
                      }
                      style={[
                        styles.feedCard,
                        styles.quoteCard,
                      ]}
                    >
                      <View
                        style={
                          styles.feedTypeRow
                        }
                      >
                        <Text
                          style={
                            styles.feedType
                          }
                        >
                          ✍️ ALINTI
                        </Text>

                        <Text
                          style={
                            styles.feedDate
                          }
                        >
                          {formatDate(
                            quote.createdAt
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.bookHeader
                        }
                      >
                        <Text
                          style={
                            styles.bookTitle
                          }
                          numberOfLines={
                            2
                          }
                        >
                          📖{' '}
                          {
                            quote.bookTitle
                          }
                        </Text>

                        {quote.bookKey && (
                          <Text
                            style={
                              styles.openBookText
                            }
                          >
                            ›
                          </Text>
                        )}
                      </View>

                      <Text
                        style={
                          styles.quoteText
                        }
                      >
                        “{quote.text}”
                      </Text>

                      <QuoteMetadata
                        title={quote.title}
                        topic={quote.topic}
                        pageNumber={quote.pageNumber}
                        note={quote.note}
                      />
                    </Pressable>
                  );
                }

                /*
                 * ================================================
                 * GÖNDERİ
                 * ================================================
                 */

                if (
                  item.type ===
                    'post' &&
                  item.post
                ) {
                  const post =
                    item.post;

                  return (
                    <View
                      key={
                        item.id
                      }
                      style={
                        styles.feedCard
                      }
                    >
                      {item.reposted && (
                        <View
                          style={
                            styles.repostHeader
                          }
                        >
                          <Text
                            style={
                              styles.repostText
                            }
                          >
                            🔁 Yeniden paylaşıldı
                          </Text>

                          <Text
                            style={
                              styles.repostDate
                            }
                          >
                            {formatDate(
                              item.createdAt
                            )}
                          </Text>
                        </View>
                      )}

                      <View
                        style={
                          styles.feedTypeRow
                        }
                      >
                        <Text
                          style={
                            styles.feedType
                          }
                        >
                          📝 GÖNDERİ
                        </Text>

                        {!item.reposted && (
                          <Text
                            style={
                              styles.feedDate
                            }
                          >
                            {formatDate(
                              post.createdAt
                            )}
                          </Text>
                        )}
                      </View>

                      <Text
                        style={
                          styles.postUsername
                        }
                      >
                        @{post.username}
                      </Text>

                      {post.text ? (
                        <Text
                          style={
                            styles.feedText
                          }
                        >
                          {
                            post.text
                          }
                        </Text>
                      ) : null}

                      {post.imageUrl && (
                        <Image
                          source={{
                            uri:
                              post.imageUrl,
                          }}
                          style={
                            styles.postImage
                          }
                          resizeMode="cover"
                        />
                      )}

                      {post.bookTitle && (
                        <Pressable
                          onPress={() =>
                            openBook(
                              post.bookKey
                            )
                          }
                          style={
                            styles.attachedBook
                          }
                        >
                          <Text
                            style={
                              styles.attachedBookText
                            }
                          >
                            📖{' '}
                            {
                              post.bookTitle
                            }
                          </Text>

                          {post.rating >
                            0 && (
                            <Text
                              style={
                                styles.attachedRating
                              }
                            >
                              {renderStars(
                                post.rating
                              )}
                            </Text>
                          )}
                        </Pressable>
                      )}

                      <View
                        style={
                          styles.postBottomRow
                        }
                      >
                        <Text
                          style={
                            styles.feedDate
                          }
                        >
                          {formatDate(
                            item.reposted
                              ? item.createdAt
                              : post.createdAt
                          )}
                        </Text>

                        <Pressable
                          onPress={() =>
                            openPostComments(
                              post
                            )
                          }
                          style={
                            styles.commentButton
                          }
                        >
                          <Text>
                            💬 Yorumlar
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }

                return null;
              }
            )
          )}

          {canViewProfileContent && visibleFeed.length > 0 && profileHasMore[profileTab] ? (
            <Pressable
              onPress={() => void loadMoreProfileContent()}
              disabled={profileLoadingMore}
              style={styles.loadMoreButton}
            >
              <Text style={styles.loadMoreText}>
                {profileLoadingMore ? 'Yükleniyor…' : 'Daha fazla göster'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <ReadersList limit={6} />
        </View>
      </ScrollView>
      <Modal visible={avatarOpen} transparent animationType="fade" onRequestClose={() => setAvatarOpen(false)}>
        <Pressable accessibilityLabel="Profil fotoğrafını kapat" onPress={() => setAvatarOpen(false)} style={{ flex: 1, backgroundColor: '#000E', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {profile.profileImage ? <Image source={{ uri: profile.profileImage }} resizeMode="contain" style={{ width: '100%', maxWidth: 600, aspectRatio: 1 }} /> : <Text style={{ color: '#fff' }}>Profil fotoğrafı yok</Text>}
          <Text style={{ color: '#fff', padding: 20 }}>Kapat ×</Text>
        </Pressable>
      </Modal>

      {/* =======================================================
          İNCELEME MODALI
          ======================================================= */}

      <Modal
        visible={
          reviewModalVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setReviewModalVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.reviewModal
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <Text
                style={
                  styles.modalTitle
                }
              >
                İnceleme
              </Text>

              <Pressable
                onPress={() =>
                  setReviewModalVisible(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.closeButton
                  }
                >
                  ✕
                </Text>
              </Pressable>
            </View>

            {selectedReview && (
              <>
                <Text
                  style={
                    styles.modalBookTitle
                  }
                >
                  📖{' '}
                  {
                    selectedReview.bookTitle
                  }
                </Text>

                <View
                  style={
                    styles.ratingRow
                  }
                >
                  <Text
                    style={
                      styles.stars
                    }
                  >
                    {renderStars(
                      selectedReview.rating
                    )}
                  </Text>

                  <Text
                    style={
                      styles.ratingText
                    }
                  >
                    {
                      selectedReview.rating
                    }
                    /5
                  </Text>
                </View>

                <ReviewSpoilerText
                  text={selectedReview.text}
                  containsSpoiler={selectedReview.containsSpoiler}
                  title={selectedReview.title}
                  topic={selectedReview.topic}
                  tags={selectedReview.tags}
                  textStyle={styles.modalReviewText}
                />

                <Text
                  style={
                    styles.feedDate
                  }
                >
                  {formatDate(
                    selectedReview.createdAt
                  )}
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* =======================================================
          GÖNDERİ / YORUM MODALI
          ======================================================= */}

      <Modal
        visible={
          postModalVisible
        }
        transparent
        animationType="slide"
        onRequestClose={
          closePostModal
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.postModal
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <Text
                style={
                  styles.modalTitle
                }
              >
                Gönderi
              </Text>

              <Pressable
                onPress={
                  closePostModal
                }
              >
                <Text
                  style={
                    styles.closeButton
                  }
                >
                  ✕
                </Text>
              </Pressable>
            </View>

            {selectedPost && (
              <ScrollView
                style={
                  styles.modalScroll
                }
              >
                <Text
                  style={
                    styles.postUsername
                  }
                >
                  @{selectedPost.username}
                </Text>

                {selectedPost.text ? (
                  <Text
                    style={
                      styles.modalPostText
                    }
                  >
                    {
                      selectedPost.text
                    }
                  </Text>
                ) : null}

                {selectedPost.imageUrl && (
                  <Image
                    source={{
                      uri:
                        selectedPost.imageUrl,
                    }}
                    style={
                      styles.modalPostImage
                    }
                    resizeMode="contain"
                  />
                )}

                <Text
                  style={
                    styles.feedDate
                  }
                >
                  {formatDate(
                    selectedPost.createdAt
                  )}
                </Text>

                <Text
                  style={
                    styles.commentsTitle
                  }
                >
                  Yorumlar
                </Text>

                {commentsLoading ? (
                  <Text
                    style={
                      styles.emptyComments
                    }
                  >
                    Yorumlar yükleniyor...
                  </Text>
                ) : comments.length ===
                  0 ? (
                  <Text
                    style={
                      styles.emptyComments
                    }
                  >
                    Henüz yorum yok.
                  </Text>
                ) : (
                  comments.map(
                    (
                      comment
                    ) => (
                      <View
                        key={
                          comment.id
                        }
                        style={
                          styles.commentItem
                        }
                      >
                        <Text
                          style={
                            styles.commentUsername
                          }
                        >
                          {
                            comment.username
                          }
                        </Text>

                        <Text
                          style={
                            styles.commentText
                          }
                        >
                          {
                            comment.text
                          }
                        </Text>
                      </View>
                    )
                  )
                )}
              </ScrollView>
            )}

            <View
              style={
                styles.commentInputRow
              }
            >
              <TextInput
                value={
                  commentText
                }
                onChangeText={
                  setCommentText
                }
                placeholder="Yorum yaz..."
                placeholderTextColor="#999"
                style={
                  styles.commentInput
                }
                multiline
                maxLength={300}
              />

              <Pressable
                onPress={
                  sendPostComment
                }
                disabled={
                  commentSending
                }
                style={
                  styles.sendButton
                }
              >
                <Text
                  style={
                    styles.sendButtonText
                  }
                >
                  {commentSending
                    ? '...'
                    : 'Gönder'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090A0F',
  },

  scrollContent: {
    paddingBottom: 110,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#8E8E98',
  },

  pageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F5F5F7',
    marginTop: 18,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  profileHero: { paddingBottom: 4 },
  coverContainer: { width: '100%', height: 190, position: 'relative', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', backgroundColor: '#15161D', justifyContent: 'center', alignItems: 'center' },
  coverShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 95, backgroundColor: 'rgba(9,10,15,0.38)' },
  coverIcon: { fontSize: 34 },
  coverText: { marginTop: 8, fontSize: 13, color: '#A2A2AC', fontWeight: '600' },
  coverCamera: { position: 'absolute', right: 16, top: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(15,16,22,0.88)', justifyContent: 'center', alignItems: 'center' },
  cameraText: { fontSize: 17 },
  identityRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: -74, paddingHorizontal: 20, zIndex: 3 },
  profileImageContainer: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#7C63E6', backgroundColor: '#090A0F', padding: 4, position: 'relative', flexShrink: 0 },
  profileImage: { width: 82, height: 82, borderRadius: 41 },
  profilePlaceholder: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#1A1B23', justifyContent: 'center', alignItems: 'center' },
  profileIcon: { fontSize: 48 },
  profileCamera: { position: 'absolute', right: -2, bottom: 4, width: 36, height: 36, borderRadius: 18, backgroundColor: '#20212A', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#090A0F' },
  identityInfo: { flex: 1, minWidth: 0, paddingLeft: 12, paddingTop: 78, minHeight: 150 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  fullName: {
    flexShrink: 1,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: '#F5F5F7',
  },
  username: { flexShrink: 1, fontSize: 24, lineHeight: 30, fontWeight: '800', color: '#F5F5F7' },
  handle: { marginTop: 3, fontSize: 14, color: '#B5B5BE' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  verifiedIcon: { color: '#8B6FF0', fontSize: 16, marginRight: 6 },
  verifiedText: { color: '#A98BFF', fontSize: 14, fontWeight: '700' },
  bio: { marginTop: 9, color: '#E0E0E5', fontSize: 14, lineHeight: 20 },
  profileActions: { flexDirection: 'row', gap: 10, marginTop: 18, paddingHorizontal: 20 },
  messageButton: { flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: '#1B1C23', borderWidth: 1, borderColor: '#292A33', justifyContent: 'center', alignItems: 'center' },
  messageButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  editArea: { width: '90%', marginTop: 18, alignSelf: 'center' },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#E7E7EB', marginBottom: 7, marginTop: 12 },
  input: { width: '100%', minHeight: 48, backgroundColor: '#15161D', borderRadius: 12, borderWidth: 1, borderColor: '#2A2B34', paddingHorizontal: 14, fontSize: 15, color: '#F5F5F7' },
  bioInput: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  editButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 15 },
  cancelButton: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: '#20212A' },
  cancelText: { color: '#B0B0BA', fontWeight: '600' },
  saveButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: '#7C63E6' },
  saveText: { color: '#FFF', fontWeight: '700' },
  settingsButton: {
    position: 'absolute',
    right: 18,
    top: 138,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1B1C23',
    borderWidth: 1,
    borderColor: '#2A2B34',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  settingsButtonText: {
    fontSize: 22,
    color: '#F5F5F7',
  },
  editButton: { marginTop: 16, marginHorizontal: 20, minHeight: 46, borderRadius: 23, backgroundColor: '#7C63E6', justifyContent: 'center', alignItems: 'center' },
  editButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  followButton: { flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: '#7157DD', justifyContent: 'center', alignItems: 'center' },
  followingButton: { backgroundColor: '#7157DD' },
  followButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  followingButtonText: { color: '#FFF' },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    borderRadius: 0,
  },

  stat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },

  statDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#34353F',
  },

  statNumber: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: '#F5F5F7',
    textAlign: 'center',
  },

  statLabel: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
    color: '#9A9AA4',
    textAlign: 'center',
  },

  section: {
    marginTop: 28,
    marginHorizontal: 20,
  },

  loadMoreButton: { alignSelf: 'center', marginTop: 14, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: '#21182F', borderWidth: 1, borderColor: '#38284D' },
  loadMoreText: { color: '#A985FF', fontSize: 13, fontWeight: '800' },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#F5F5F7',
    marginBottom: 12,
  },

  emptyCard: {
    backgroundColor: '#15161D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#25262F',
    padding: 25,
    alignItems: 'center',
  },

  emptyIcon: {
    fontSize: 38,
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '700',
    color: '#F5F5F7',
  },

  emptyText: {
    marginTop: 6,
    textAlign: 'center',
    color: '#8E8E98',
    lineHeight: 20,
  },

  /*
   * FEED
   */

  feedCard: {
    backgroundColor: '#15161D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#25262F',
    padding: 18,
    marginBottom: 12,
  },

  quoteCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#7C63E6',
  },

  feedTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  feedType: {
    fontSize: 12,
    fontWeight: '800',
    color: '#A98BFF',
  },

  feedDate: {
    fontSize: 11,
    color: '#8E8E98',
  },

  bookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  bookTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#F5F5F7',
    lineHeight: 23,
  },

  openBookText: {
    marginLeft: 8,
    fontSize: 28,
    color: '#A98BFF',
    lineHeight: 30,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
  },

  stars: {
    fontSize: 17,
    letterSpacing: 2,
    color: '#A98BFF',
  },

  ratingText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#A7A7B0',
  },

  feedText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#E0E0E5',
  },

  quoteText: {
    marginTop: 15,
    fontSize: 17,
    lineHeight: 27,
    color: '#E0E0E5',
    fontStyle: 'italic',
  },

  postUsername: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F5F5F7',
    marginBottom: 7,
  },

  postImage: {
    width: '100%',
    height: 260,
    borderRadius: 14,
    marginTop: 14,
    backgroundColor: '#20212A',
  },

  attachedBook: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1B1C24',
    borderWidth: 1,
    borderColor: '#292A33',
  },

  attachedBookText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F5F5F7',
  },

  attachedRating: {
    marginTop: 5,
    fontSize: 13,
    letterSpacing: 1,
  },

  postBottomRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#25262F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  commentButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#20212A',
    borderWidth: 1,
    borderColor: '#2B2C35',
  },

  repostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#25262F',
  },

  repostText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A98BFF',
  },

  repostDate: {
    fontSize: 11,
    color: '#999',
  },

  /*
   * MODAL
   */

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },

  reviewModal: {
    backgroundColor: '#090A0F',
    borderRadius: 22,
    padding: 20,
    maxHeight: '75%',
  },

  postModal: {
    backgroundColor: '#090A0F',
    borderRadius: 22,
    maxHeight: '85%',
    padding: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    marginBottom: 15,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#222',
  },

  closeButton: {
    fontSize: 22,
    color: '#B0B0BA',
    padding: 5,
  },

  modalBookTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },

  modalReviewText: {
    marginTop: 18,
    fontSize: 16,
    lineHeight: 25,
    color: '#D4D4DA',
  },

  modalScroll: {
    flexGrow: 0,
  },

  modalPostText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#D4D4DA',
    marginBottom: 12,
  },

  modalPostImage: {
    width: '100%',
    height: 300,
    borderRadius: 14,
    backgroundColor: '#EEE',
    marginBottom: 12,
  },

  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginTop: 22,
    marginBottom: 12,
  },

  emptyComments: {
    color: '#888',
    paddingVertical: 20,
  },

  commentItem: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },

  commentUsername: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E7E7EB',
    marginBottom: 4,
  },

  commentText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#D4D4DA',
  },

  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
  },

  commentInput: {
    flex: 1,
    minHeight: 45,
    maxHeight: 90,
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: '#222',
    fontSize: 14,
  },

  sendButton: {
    minHeight: 45,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
