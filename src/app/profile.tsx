import ReviewSpoilerText from '@/components/ReviewSpoilerText';
import QuoteMetadata from '@/components/QuoteMetadata';
import { useThemedStyles } from '@/theme/use-themed-styles';
import ReadersList from '@/components/ReadersList';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Image from '@/components/SafeImage';
import ProfileHeader from '@/components/profile/ProfileHeader';
import RetryNotice from '@/components/RetryNotice';

import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { isUserVerified } from '@/lib/verification';
import { isUserPremium } from '@/lib/premium';
import { useAppTheme } from '@/providers/ThemeProvider';
import { loadProfileCustomization, PremiumProfileCustomization } from '@/lib/profile-customization';
import {
  feedCursorFilter,
  nextFeedCursor,
  type FeedCursor,
} from '@/features/feed/pagination';

type Comment = {
  id: string;
  userId: string | null;
  username: string;
  fullName?: string | null;
  profileImage?: string | null;
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
  viewCount?: number;
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
  viewCount?: number;
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
  viewCount?: number;
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


type InteractionType = 'post' | 'review' | 'quote';

function ProfileCardActions({
  type,
  id,
  viewCount = 0,
  onComment,
}: {
  type: InteractionType;
  id: string;
  viewCount?: number;
  onComment: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(baseStyles);
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(0);
  const [reposts, setReposts] = useState(0);
  const [comments, setComments] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;
      const config =
        type === 'post'
          ? { likeTable: 'post_likes', repostTable: 'post_reposts', commentTable: 'post_comments', key: 'post_id' }
          : type === 'review'
            ? { likeTable: 'likes', repostTable: 'reposts', commentTable: 'comments', key: 'review_id' }
            : { likeTable: 'quote_likes', repostTable: 'quote_reposts', commentTable: 'quote_comments', key: 'quote_id' };

      const [likeResult, repostResult, commentResult, savedResult] = await Promise.all([
        (supabase as any).from(config.likeTable).select('user_id').eq(config.key, id),
        (supabase as any).from(config.repostTable).select('user_id').eq(config.key, id),
        (supabase as any).from(config.commentTable).select('id', { count: 'exact', head: true }).eq(config.key, id),
        type === 'post' && userId
          ? supabase.from('saved_posts').select('post_id').eq('post_id', id).eq('user_id', userId).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      if (!active) return;
      const likeRows = likeResult.data ?? [];
      const repostRows = repostResult.data ?? [];
      setLikes(likeRows.length);
      setReposts(repostRows.length);
      setComments(commentResult.count ?? 0);
      setLiked(!!userId && likeRows.some((row: any) => row.user_id === userId));
      setReposted(!!userId && repostRows.some((row: any) => row.user_id === userId));
      setSaved(!!savedResult.data);
    })();

    return () => { active = false; };
  }, [id, type]);

  async function toggleLike() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert('Giriş gerekli', 'Beğenmek için giriş yapmalısın.');
    const table = type === 'post' ? 'post_likes' : type === 'review' ? 'likes' : 'quote_likes';
    const key = type === 'post' ? 'post_id' : type === 'review' ? 'review_id' : 'quote_id';

    if (liked) {
      const { error } = await (supabase as any).from(table).delete().eq(key, id).eq('user_id', user.id);
      if (error) return Alert.alert('Hata', error.message);
      setLiked(false);
      setLikes((count) => Math.max(0, count - 1));
    } else {
      const { error } = await (supabase as any).from(table).insert({ [key]: id, user_id: user.id });
      if (error) return Alert.alert('Hata', error.message);
      setLiked(true);
      setLikes((count) => count + 1);
    }
  }

  async function toggleRepost() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert('Giriş gerekli', 'Tekrar paylaşmak için giriş yapmalısın.');
    const table = type === 'post' ? 'post_reposts' : type === 'review' ? 'reposts' : 'quote_reposts';
    const key = type === 'post' ? 'post_id' : type === 'review' ? 'review_id' : 'quote_id';

    if (reposted) {
      const { error } = await (supabase as any).from(table).delete().eq(key, id).eq('user_id', user.id);
      if (error) return Alert.alert('Hata', error.message);
      setReposted(false);
      setReposts((count) => Math.max(0, count - 1));
    } else {
      const { error } = await (supabase as any).from(table).insert({ [key]: id, user_id: user.id });
      if (error) return Alert.alert('Hata', error.message);
      setReposted(true);
      setReposts((count) => count + 1);
    }
  }

  async function toggleSave() {
    if (type !== 'post') return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert('Giriş gerekli', 'Kaydetmek için giriş yapmalısın.');
    if (saved) {
      const { error } = await supabase.from('saved_posts').delete().eq('post_id', id).eq('user_id', user.id);
      if (error) return Alert.alert('Hata', error.message);
      setSaved(false);
    } else {
      const { error } = await supabase.from('saved_posts').insert({ post_id: id, user_id: user.id, username: user.user_metadata?.username || user.email?.split('@')[0] || 'Kitap Okuru' });
      if (error) return Alert.alert('Hata', error.message);
      setSaved(true);
    }
  }

  return (
    <View style={styles.profileActionRow}>
      {type === 'post' ? (
        <Pressable onPress={() => void toggleSave()} style={styles.profileActionButton} accessibilityLabel={saved ? 'Kaydı kaldır' : 'Kaydet'}>
          <Feather name="bookmark" size={20} color={saved ? colors.primary : colors.textSecondary} />
        </Pressable>
      ) : null}
      <Pressable onPress={onComment} style={styles.profileActionButton} accessibilityLabel="Yorumlar">
        <Feather name="message-circle" size={20} color={colors.textSecondary} />
        <Text style={styles.profileActionCount}>{comments}</Text>
      </Pressable>
      <Pressable onPress={() => void toggleLike()} style={styles.profileActionButton} accessibilityLabel={liked ? 'Beğeniyi kaldır' : 'Beğen'}>
        <Feather name="heart" size={20} color={liked ? '#FF6B7A' : colors.textSecondary} />
        <Text style={[styles.profileActionCount, liked && { color: '#FF6B7A' }]}>{likes}</Text>
      </Pressable>
      <Pressable onPress={() => void toggleRepost()} style={styles.profileActionButton} accessibilityLabel={reposted ? 'Repostu kaldır' : 'Repost'}>
        <Feather name="repeat" size={20} color={reposted ? '#66D19E' : colors.textSecondary} />
        <Text style={[styles.profileActionCount, reposted && { color: '#66D19E' }]}>{reposts}</Text>
      </Pressable>
      <View style={styles.profileActionButton}>
        <Feather name="bar-chart-2" size={20} color={colors.textSecondary} />
        <Text style={styles.profileActionCount}>{viewCount}</Text>
      </View>
    </View>
  );
}

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
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

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

  const [, setReviews] = useState<Review[]>([]);
  const [, setQuotes] = useState<Quote[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [profileLoadingMore, setProfileLoadingMore] = useState(false);
  const [profileHasMore, setProfileHasMore] = useState({ post: true, review: true, quote: true, repost: true });
  const profileCursorRef = useRef<Record<'post' | 'review' | 'quote' | 'repost', FeedCursor>>({
    post: null,
    review: null,
    quote: null,
    repost: null,
  });
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
  const [commentTarget, setCommentTarget] = useState<{ type: InteractionType; id: string } | null>(null);

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

    const cursor = profileCursorRef.current[profileTab];

    setProfileLoadingMore(true);
    try {
      let newItems: FeedItem[] = [];
      let pageLength = 0;
      let pageCursorRows: { id?: string | null; created_at?: string | null }[] = [];

      if (profileTab === 'review') {
        let query = supabase
          .from('reviews')
          .select('id, user_id, book_key, book_title, rating, text, title, topic, tags, contains_spoiler, created_at, view_count')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(PROFILE_PAGE_SIZE);
        if (cursor) query = query.or(feedCursorFilter(cursor));
        const { data, error } = await query;
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
          viewCount: Number(item.view_count) || 0,
        }));
        pageLength = page.length;
        pageCursorRows = (data ?? []) as { id?: string | null; created_at?: string | null }[];
        setReviews((current) => [...current, ...page]);
        newItems = page.map((review) => ({
          id: `review-${review.id}`,
          type: 'review',
          createdAt: review.createdAt,
          review,
        }));
      } else if (profileTab === 'quote') {
        let query = supabase
          .from('quotes')
          .select('id, user_id, book_key, book_title, text, title, topic, page_number, note, created_at, view_count')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(PROFILE_PAGE_SIZE);
        if (cursor) query = query.or(feedCursorFilter(cursor));
        const { data, error } = await query;
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
          viewCount: Number(item.view_count) || 0,
        }));
        pageLength = page.length;
        pageCursorRows = (data ?? []) as { id?: string | null; created_at?: string | null }[];
        setQuotes((current) => [...current, ...page]);
        newItems = page.map((quote) => ({
          id: `quote-${quote.id}`,
          type: 'quote',
          createdAt: quote.createdAt,
          quote,
        }));
      } else if (profileTab === 'post') {
        let query = supabase
          .from('posts')
          .select('id, username, text, image_url, book_key, book_title, rating, created_at, user_id, view_count')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(PROFILE_PAGE_SIZE);
        if (cursor) query = query.or(feedCursorFilter(cursor));
        const { data, error } = await query;
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
          viewCount: Number(item.view_count) || 0,
        }));
        pageLength = page.length;
        pageCursorRows = (data ?? []) as { id?: string | null; created_at?: string | null }[];
        setPosts((current) => [...current, ...page]);
        newItems = page.map((post) => ({
          id: `post-${post.id}`,
          type: 'post',
          createdAt: post.createdAt,
          post,
        }));
      } else {
        let query = supabase
          .from('post_reposts')
          .select('id, post_id, user_id, created_at')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(PROFILE_PAGE_SIZE);
        if (cursor) query = query.or(feedCursorFilter(cursor));
        const { data: repostRows, error } = await query;
        if (error) throw error;

        pageLength = repostRows?.length ?? 0;
        pageCursorRows = (repostRows ?? []) as { id?: string | null; created_at?: string | null }[];
        const postIds = (repostRows ?? []).map((row: any) => row.post_id);
        if (postIds.length) {
          const { data: repostPosts, error: postsError } = await supabase
            .from('posts')
            .select('id, username, text, image_url, book_key, book_title, rating, created_at, user_id, view_count')
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
          viewCount: Number(item.view_count) || 0,
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

      if (pageCursorRows.length > 0) {
        profileCursorRef.current = {
          ...profileCursorRef.current,
          [profileTab]: nextFeedCursor(pageCursorRows) ?? cursor,
        };
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

  const refreshQuotes = useCallback(async () => {
    try {
      const loggedInUserId = await getCurrentUserId();
      const targetUserId =
        typeof userId === 'string' && userId
          ? userId
          : loggedInUserId;

      if (!targetUserId) {
        setQuotes([]);
        setFeed((current) => current.filter((item) => item.type !== 'quote'));
        setQuoteCount(0);
        return;
      }

      const [{ data, error }, { count, error: countError }] = await Promise.all([
        supabase
          .from('quotes')
          .select('id, user_id, book_key, book_title, text, title, topic, page_number, note, created_at, view_count')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(PROFILE_PAGE_SIZE),
        supabase
          .from('quotes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', targetUserId),
      ]);

      if (error) throw error;
      if (countError) console.warn('Alıntı sayısı yüklenemedi:', countError);

      const loadedQuotes: Quote[] = (data ?? []).map((item: any) => ({
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
          viewCount: Number(item.view_count) || 0,
      }));

      setQuotes(loadedQuotes);
      setQuoteCount(count ?? loadedQuotes.length);
      profileCursorRef.current = {
        ...profileCursorRef.current,
        quote: nextFeedCursor(data ?? []),
      };
      setProfileHasMore((current) => ({
        ...current,
        quote: (data?.length ?? 0) === PROFILE_PAGE_SIZE,
      }));

      setFeed((current) => {
        const withoutQuotes = current.filter((item) => item.type !== 'quote');
        const quoteItems: FeedItem[] = loadedQuotes.map((quote) => ({
          id: `quote-${quote.id}`,
          type: 'quote',
          createdAt: quote.createdAt,
          quote,
        }));
        return [...withoutQuotes, ...quoteItems].sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
        );
      });
    } catch (error) {
      console.error('Profil alıntıları yenilenemedi:', error);
      setLoadError('Alıntılar şu anda yenilenemedi.');
    }
  }, [userId]);

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
            'id, user_id, book_key, book_title, rating, text, title, topic, tags, contains_spoiler, created_at, view_count'
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
          .order('id', { ascending: false })
          .limit(PROFILE_PAGE_SIZE),

        supabase
          .from('quotes')
          .select(
            'id, user_id, book_key, book_title, text, title, topic, page_number, note, created_at, view_count'
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
          .order('id', { ascending: false })
          .limit(PROFILE_PAGE_SIZE),

        supabase
          .from('posts')
          .select(
            'id, username, text, image_url, book_key, book_title, rating, created_at, user_id, view_count'
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
          .order('id', { ascending: false })
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
          .order('id', { ascending: false })
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
            viewCount: Number(item.view_count) || 0,
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
            viewCount: Number(item.view_count) || 0,
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
            viewCount: Number(item.view_count) || 0,
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
            'id, username, text, image_url, book_key, book_title, rating, created_at, user_id, view_count'
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

      profileCursorRef.current = {
        review: nextFeedCursor(reviewsResult.data ?? []),
        quote: nextFeedCursor(quotesResult.data ?? []),
        post: nextFeedCursor(postsResult.data ?? []),
        repost: nextFeedCursor(repostResult.data ?? []),
      };

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

  async function openContentComments(type: InteractionType, id: string) {
    setCommentTarget({ type, id });
    setSelectedPost(type === 'post' ? posts.find((post) => post.id === id) ?? null : null);
    setPostModalVisible(true);
    setCommentsLoading(true);
    setCommentText('');

    const config =
      type === 'post'
        ? { table: 'post_comments', key: 'post_id' }
        : type === 'review'
          ? { table: 'comments', key: 'review_id' }
          : { table: 'quote_comments', key: 'quote_id' };

    try {
      const { data, error } = await (supabase as any)
        .from(config.table)
        .select('id, user_id, text, created_at')
        .eq(config.key, id)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const rows = data ?? [];
      const userIds = Array.from(new Set(rows.map((row: any) => row.user_id).filter(Boolean))) as string[];
      const { data: profilesData } = userIds.length
        ? await supabase.from('profiles').select('id, username, full_name, profile_image').in('id', userIds)
        : { data: [] as any[] };
      const profileMap = new Map((profilesData ?? []).map((row: any) => [String(row.id), row]));

      setComments(rows.map((row: any) => {
        const author: any = profileMap.get(String(row.user_id));
        return {
          id: String(row.id),
          userId: row.user_id ? String(row.user_id) : null,
          username: author?.username || 'Kitap Okuru',
          fullName: author?.full_name ?? null,
          profileImage: author?.profile_image ?? null,
          text: String(row.text || ''),
          createdAt: row.created_at || '',
        };
      }));
    } catch (error) {
      console.error('Yorumlar yüklenemedi:', error);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }


  async function sendPostComment() {
    const text = commentText.trim();
    if (!text || !commentTarget) return;

    const loggedInUserId = await getCurrentUserId();
    if (!loggedInUserId) {
      Alert.alert('Giriş gerekli', 'Yorum yapmak için giriş yapmalısın.');
      return;
    }

    const config =
      commentTarget.type === 'post'
        ? { table: 'post_comments', key: 'post_id' }
        : commentTarget.type === 'review'
          ? { table: 'comments', key: 'review_id' }
          : { table: 'quote_comments', key: 'quote_id' };

    setCommentSending(true);
    try {
      const { data, error } = await (supabase as any)
        .from(config.table)
        .insert({ [config.key]: commentTarget.id, user_id: loggedInUserId, text })
        .select()
        .single();
      if (error) throw error;

      const { data: authorProfile } = await supabase
        .from('profiles')
        .select('username, full_name, profile_image')
        .eq('id', loggedInUserId)
        .maybeSingle();

      setComments((old) => [...old, {
        id: String(data.id),
        userId: loggedInUserId,
        username: authorProfile?.username || profile.username || 'Kitap Okuru',
        fullName: authorProfile?.full_name ?? null,
        profileImage: authorProfile?.profile_image ?? null,
        text,
        createdAt: data.created_at || new Date().toISOString(),
      }]);
      setCommentText('');
    } catch (error) {
      console.error('Yorum gönderilemedi:', error);
      Alert.alert('Hata', 'Yorum gönderilemedi.');
    } finally {
      setCommentSending(false);
    }
  }


  async function deletePostComment(commentId: string) {
    const loggedInUserId = await getCurrentUserId();
    if (!loggedInUserId || !commentTarget) return;

    const table =
      commentTarget.type === 'post'
        ? 'post_comments'
        : commentTarget.type === 'review'
          ? 'comments'
          : 'quote_comments';

    Alert.alert('Yorumu sil', 'Bu yorum silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const { error } = await (supabase as any)
            .from(table)
            .delete()
            .eq('id', commentId)
            .eq('user_id', loggedInUserId);
          if (error) {
            Alert.alert('Hata', error.message);
            return;
          }
          setComments((current) => current.filter((comment) => comment.id !== commentId));
        },
      },
    ]);
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
    setCommentTarget(null);
  }


  function deleteOwnPost(post: Post) {
    if (!currentUserId || post.userId !== currentUserId) return;

    Alert.alert('Gönderiyi sil', 'Bu gönderi kalıcı olarak silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
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
          setFeed((current) => current.filter((item) => !(item.type === 'post' && item.post?.id === post.id)));
          if (selectedPost?.id === post.id) closePostModal();
        },
      },
    ]);
  }

  function openProfilePostMenu(post: Post) {
    if (!currentUserId || post.userId !== currentUserId) return;

    Alert.alert('Gönderi seçenekleri', undefined, [
      {
        text: 'Gönderiyi Sil',
        style: 'destructive',
        onPress: () => deleteOwnPost(post),
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.profileTabs}
          >
            {([['post','Gönderiler'],['review','İncelemeler'],['quote','Alıntılar'],['repost','Tekrar Paylaşımlar']] as const).map(([tab,label]) => (
              <Pressable
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: profileTab === tab }}
                onPress={() => {
                  setProfileTab(tab);
                  if (tab === 'quote') void refreshQuotes();
                }}
                style={[
                  styles.profileTab,
                  profileTab === tab && styles.profileTabActive,
                ]}
              >
                <Text style={[styles.profileTabText, profileTab === tab && styles.profileTabTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
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
                      style={[
                        styles.feedCard,
                        styles.reviewFeedCard,
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
                      <ProfileCardActions
                        type="review"
                        id={review.id}
                        viewCount={review.viewCount ?? 0}
                        onComment={() => void openContentComments('review', review.id)}
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
                      <ProfileCardActions
                        type="quote"
                        id={quote.id}
                        viewCount={quote.viewCount ?? 0}
                        onComment={() => void openContentComments('quote', quote.id)}
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

                      <View style={styles.feedTypeRow}>
                        <Text style={styles.feedType}>📝 GÖNDERİ</Text>

                        <View style={styles.postHeaderActions}>
                          {!item.reposted ? (
                            <Text style={styles.feedDate}>
                              {formatDate(post.createdAt)}
                            </Text>
                          ) : null}
                          {isOwnProfile && !item.reposted ? (
                            <Pressable
                              onPress={() => openProfilePostMenu(post)}
                              style={styles.postMoreButton}
                              accessibilityLabel="Gönderi seçenekleri"
                            >
                              <Text style={styles.postMoreText}>•••</Text>
                            </Pressable>
                          ) : null}
                        </View>
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

                      <View style={styles.postMetaRow}>
                        <Text style={styles.feedDate}>
                          {formatDate(item.reposted ? item.createdAt : post.createdAt)}
                        </Text>
                      </View>
                      <ProfileCardActions
                        type="post"
                        id={post.id}
                        viewCount={post.viewCount ?? 0}
                        onComment={() => void openContentComments('post', post.id)}
                      />
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

      <Modal
        visible={postModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closePostModal}
      >
        <KeyboardAvoidingView
          style={styles.commentSheetRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.commentSheetBackdrop} onPress={closePostModal} />
          <View style={[styles.commentSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.commentSheetHandle} />
            <View style={styles.commentSheetHeader}>
              <View style={styles.commentSheetHeaderSpacer} />
              <Text style={styles.commentSheetTitle}>Yorumlar</Text>
              <Pressable
                onPress={closePostModal}
                style={styles.commentSheetClose}
                accessibilityLabel="Yorumları kapat"
              >
                <Feather name="x" size={21} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.commentSheetDivider} />

            <FlatList
              data={comments}
              keyExtractor={(comment) => comment.id}
              style={styles.commentSheetList}
              contentContainerStyle={
                comments.length ? styles.commentSheetListContent : styles.commentSheetEmptyContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                commentsLoading ? (
                  <View style={styles.commentSheetEmpty}>
                    <Text style={styles.commentSheetEmptyText}>Yorumlar yükleniyor...</Text>
                  </View>
                ) : (
                  <View style={styles.commentSheetEmpty}>
                    <Feather name="message-circle" size={32} color={colors.textSecondary} />
                    <Text style={styles.commentSheetEmptyTitle}>Henüz yorum yok</Text>
                    <Text style={styles.commentSheetEmptyText}>İlk yorumu sen yaz.</Text>
                  </View>
                )
              }
              renderItem={({ item: comment }) => {
                const isOwnComment = !!comment.userId && comment.userId === currentUserId;
                const displayName =
                  comment.fullName?.trim() ||
                  comment.username?.trim() ||
                  (isOwnComment ? profile.username : 'Kitap Okuru');

                return (
                  <View style={styles.commentSheetRow}>
                    <Pressable
                      onPress={() => {
                        if (comment.userId) {
                          closePostModal();
                          router.push({ pathname: '/profile', params: { userId: comment.userId } });
                        }
                      }}
                      disabled={!comment.userId}
                      style={styles.commentSheetAvatarWrap}
                    >
                      {comment.profileImage ? (
                        <Image source={{ uri: comment.profileImage }} style={styles.commentSheetAvatar} />
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
                        onPress={() => void deletePostComment(comment.id)}
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
                {currentUserId && isOwnProfile && profile.profileImage ? (
                  <Image source={{ uri: profile.profileImage }} style={styles.commentComposerAvatarImage} />
                ) : (
                  <Feather name="user" size={18} color={colors.textSecondary} />
                )}
              </Pressable>

              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Yorum ekle..."
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={1000}
                style={styles.commentComposerInput}
              />

              <Pressable
                onPress={() => void sendPostComment()}
                disabled={!commentText.trim() || commentSending}
                style={[
                  styles.commentComposerSend,
                  (!commentText.trim() || commentSending) && styles.commentComposerSendDisabled,
                ]}
                accessibilityLabel="Yorumu gönder"
              >
                <Text style={styles.commentComposerSendText}>
                  {commentSending ? '...' : 'Paylaş'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    marginHorizontal: 0,
  },

  loadMoreButton: { alignSelf: 'center', marginTop: 14, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: '#21182F', borderWidth: 1, borderColor: '#38284D' },
  loadMoreText: { color: '#A985FF', fontSize: 13, fontWeight: '800' },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#F5F5F7',
    marginBottom: 4,
    paddingHorizontal: 14,
  },

  profileTabs: {
    minWidth: '100%',
    paddingHorizontal: 14,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2027',
  },

  profileTab: {
    minHeight: 48,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  profileTabActive: {
    borderBottomColor: '#8D65F2',
  },

  profileTabText: {
    color: '#81838D',
    fontSize: 13,
    fontWeight: '700',
  },

  profileTabTextActive: {
    color: '#F2F3F5',
    fontWeight: '900',
  },

  emptyCard: {
    backgroundColor: '#15161D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#25262F',
    padding: 25,
    marginHorizontal: 14,
    marginTop: 12,
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
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#202129',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 18,
    marginBottom: 0,
    width: '100%',
    alignSelf: 'stretch',
  },

  reviewFeedCard: {
    width: 'auto',
    alignSelf: 'stretch',
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#34284F',
    backgroundColor: '#111018',
  },

  quoteCard: {
    width: 'auto',
    alignSelf: 'stretch',
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#2D2738',
    borderLeftWidth: 3,
    borderLeftColor: '#8D65F2',
    backgroundColor: '#111017',
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

  postAction: {
    minWidth: 48,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
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

  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#24242B',
  },
  profileActionButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  profileActionCount: {
    color: '#8B8B95',
    fontSize: 12,
    fontWeight: '700',
  },
  postMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  postMoreButton: {
    minWidth: 34,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  postMoreText: {
    color: '#8E8E98',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 20,
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
