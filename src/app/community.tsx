import { safeBack } from '@/lib/navigation';
import Image from '@/components/SafeImage';
import { readerDate } from '@/lib/reader-date';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { pickCommunityImage } from '@/lib/upload-community-image';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  View as SafeAreaView,
} from 'react-native';

type CommunityDetail = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_by: string | null;
  created_at: string;
  kind: string;
  visibility: string;
  rules: string;
  tags: string[];
  current_book: string | null;
};

type CommunityMemberPreview = {
  user_id: string;
  username: string;
  profile_image: string | null;
};

type CommunityPostComment = {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  profile_image: string | null;
  text: string;
  created_at: string;
};

type CommunityPost = {
  id: string;
  community_id: string;
  user_id: string;
  username: string;
  profile_image: string | null;
  text: string;
  image_url: string | null;
  created_at: string;
  likes_count: number;
  liked: boolean;
  comments_count: number;
};

type CommunityPostRow = {
  id: string;
  community_id: string;
  user_id: string;
  text: string;
  image_url: string | null;
  created_at: string;
};

const COMMUNITY_POST_PAGE_SIZE = 20;

export default function CommunityScreen() {
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const communityId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'about' | 'members'>('feed');
  const [members, setMembers] = useState<CommunityMemberPreview[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [membershipUpdating, setMembershipUpdating] = useState(false);

  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityPostsLoading, setCommunityPostsLoading] = useState(false);
  const [communityPostsLoadingMore, setCommunityPostsLoadingMore] = useState(false);
  const [communityPostsHasMore, setCommunityPostsHasMore] = useState(true);
  const [communityPostsOffset, setCommunityPostsOffset] = useState(0);

  const [postText, setPostText] = useState('');
  const [postImageUrl, setPostImageUrl] = useState<string | null>(null);
  const [postImageBusy, setPostImageBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [pendingLikePostIds, setPendingLikePostIds] = useState<Set<string>>(new Set());
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<Record<string, CommunityPostComment[]>>({});
  const [commentsLoadingPostId, setCommentsLoadingPostId] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [commentPostingPostId, setCommentPostingPostId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!communityId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id ?? null;
        if (mounted) setCurrentUserId(userId);

        const { data, error } = await supabase
          .from('communities')
          .select('id, name, description, image_url, created_by, created_at, kind, visibility, rules, tags, current_book')
          .eq('id', communityId)
          .maybeSingle();

        if (error) throw error;
        if (!mounted) return;

        setCommunity(data as CommunityDetail | null);

        if (userId) {
          const permission = await supabase.rpc('community_admin', { cid: communityId });
          if (mounted) setIsAdmin(permission.data === true);
        }

        const countResult = await supabase
          .from('community_members')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', communityId);

        if (mounted) setMemberCount(countResult.count ?? 0);

        if (userId) {
          const membership = await supabase
            .from('community_members')
            .select('user_id')
            .eq('community_id', communityId)
            .eq('user_id', userId)
            .maybeSingle();

          if (mounted) setIsMember(Boolean(membership.data));
        }

        const { data: memberRows } = await supabase
          .from('community_members')
          .select('user_id')
          .eq('community_id', communityId)
          .order('joined_at', { ascending: true })
          .limit(6);

        const ids = (memberRows ?? []).map((row) => row.user_id).filter(Boolean);

        if (ids.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, profile_image')
            .in('id', ids);

          if (mounted) {
            setMembers(
              (profiles ?? []).map((profile) => ({
                user_id: profile.id,
                username: profile.username || 'Kullanıcı',
                profile_image: profile.profile_image,
              })),
            );
          }
        } else if (mounted) {
          setMembers([]);
        }
      } catch (error) {
        console.error('Community load error:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [communityId]);

  const enrichCommunityPosts = useCallback(
    async (rows: CommunityPostRow[], activeUserId: string | null): Promise<CommunityPost[]> => {
      if (!rows.length) return [];

      const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('id, username, profile_image').in('id', userIds)
        : { data: [] };

      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      const postIds = rows.map((row) => row.id).filter(Boolean);

      const [likesResult, commentsResult] = await Promise.all([
        postIds.length
          ? supabase.from('community_post_likes').select('post_id, user_id').in('post_id', postIds)
          : Promise.resolve({ data: [], error: null }),
        postIds.length
          ? supabase.from('community_post_comments').select('post_id').in('post_id', postIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (likesResult.error) console.error('Community post likes load error:', likesResult.error);
      if (commentsResult.error) console.error('Community post comments count error:', commentsResult.error);

      const likeRows = likesResult.data ?? [];
      const commentRows = commentsResult.data ?? [];
      const likeCountMap = new Map<string, number>();
      const commentCountMap = new Map<string, number>();
      const likedByCurrentUser = new Set<string>();

      for (const like of likeRows) {
        likeCountMap.set(like.post_id, (likeCountMap.get(like.post_id) ?? 0) + 1);
        if (activeUserId && like.user_id === activeUserId) likedByCurrentUser.add(like.post_id);
      }

      for (const comment of commentRows) {
        commentCountMap.set(comment.post_id, (commentCountMap.get(comment.post_id) ?? 0) + 1);
      }

      return rows.map((row) => ({
        ...row,
        username: profileMap.get(row.user_id)?.username || 'Kullanıcı',
        profile_image: profileMap.get(row.user_id)?.profile_image ?? null,
        likes_count: likeCountMap.get(row.id) ?? 0,
        liked: likedByCurrentUser.has(row.id),
        comments_count: commentCountMap.get(row.id) ?? 0,
      }));
    },
    [],
  );

  const loadCommunityPosts = useCallback(
    async (reset = true) => {
      if (!communityId) return;
      if (reset ? communityPostsLoading : communityPostsLoadingMore) return;
      if (!reset && !communityPostsHasMore) return;

      if (reset) setCommunityPostsLoading(true);
      else setCommunityPostsLoadingMore(true);

      const offset = reset ? 0 : communityPostsOffset;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const activeUserId = user?.id ?? null;

        const { data, error } = await supabase
          .from('community_posts')
          .select('id, community_id, user_id, text, image_url, created_at')
          .eq('community_id', communityId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + COMMUNITY_POST_PAGE_SIZE - 1);

        if (error) throw error;

        const rows = (data ?? []) as CommunityPostRow[];
        const enriched = await enrichCommunityPosts(rows, activeUserId);

        setCommunityPosts((current) => {
          if (reset) return enriched;
          const existingIds = new Set(current.map((item) => item.id));
          return [...current, ...enriched.filter((item) => !existingIds.has(item.id))];
        });
        setCommunityPostsHasMore(rows.length === COMMUNITY_POST_PAGE_SIZE);
        setCommunityPostsOffset(offset + rows.length);
      } catch (error) {
        console.error('Community posts error:', error);
        if (reset) {
          setCommunityPosts([]);
          setCommunityPostsOffset(0);
          setCommunityPostsHasMore(true);
        }
      } finally {
        if (reset) setCommunityPostsLoading(false);
        else setCommunityPostsLoadingMore(false);
      }
    },
    [
      communityId,
      communityPostsHasMore,
      communityPostsLoading,
      communityPostsLoadingMore,
      communityPostsOffset,
      enrichCommunityPosts,
    ],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setCommunityPosts([]);
      setCommunityPostsOffset(0);
      setCommunityPostsHasMore(true);
      void loadCommunityPosts(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [communityId, loadCommunityPosts]);

  async function toggleCommunityPostLike(post: CommunityPost) {
    if (!currentUserId || !post.id || pendingLikePostIds.has(post.id)) return;
    const wasLiked = post.liked;

    setCommunityPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              liked: !wasLiked,
              likes_count: wasLiked ? Math.max(0, item.likes_count - 1) : item.likes_count + 1,
            }
          : item,
      ),
    );

    setPendingLikePostIds((current) => new Set(current).add(post.id));

    try {
      const result = wasLiked
        ? await supabase
            .from('community_post_likes')
            .delete()
            .eq('post_id', post.id)
            .eq('user_id', currentUserId)
        : await supabase.from('community_post_likes').insert({ post_id: post.id, user_id: currentUserId });

      if (result.error) throw result.error;
    } catch (error) {
      console.error('Community post like error:', error);
      setCommunityPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                liked: wasLiked,
                likes_count: wasLiked ? item.likes_count + 1 : Math.max(0, item.likes_count - 1),
              }
            : item,
        ),
      );
    } finally {
      setPendingLikePostIds((current) => {
        const next = new Set(current);
        next.delete(post.id);
        return next;
      });
    }
  }

  async function togglePostComments(postId: string) {
    if (openCommentsPostId === postId) {
      setOpenCommentsPostId(null);
      return;
    }

    setOpenCommentsPostId(postId);
    setCommentsLoadingPostId(postId);

    try {
      const { data: rows, error } = await supabase
        .from('community_post_comments')
        .select('id, post_id, user_id, text, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const comments = rows ?? [];
      const userIds = [...new Set(comments.map((comment) => comment.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('id, username, profile_image').in('id', userIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

      setPostComments((current) => ({
        ...current,
        [postId]: comments.map((comment) => ({
          ...comment,
          username: profileMap.get(comment.user_id)?.username || 'Kullanıcı',
          profile_image: profileMap.get(comment.user_id)?.profile_image ?? null,
        })),
      }));
    } catch (error) {
      console.error('Community comments error:', error);
    } finally {
      setCommentsLoadingPostId(null);
    }
  }

  async function createCommunityPostComment(postId: string) {
    const text = (commentTexts[postId] ?? '').trim();
    if (!currentUserId || !postId || !text || commentPostingPostId === postId) return;

    setCommentPostingPostId(postId);
    try {
      const { data: insertedComment, error } = await supabase
        .from('community_post_comments')
        .insert({ post_id: postId, user_id: currentUserId, text })
        .select('id, post_id, user_id, text, created_at')
        .single();

      if (error) throw error;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, profile_image')
        .eq('id', currentUserId)
        .maybeSingle();

      const newComment: CommunityPostComment = {
        ...insertedComment,
        username: profile?.username || 'Kullanıcı',
        profile_image: profile?.profile_image ?? null,
      };

      setPostComments((current) => ({
        ...current,
        [postId]: [...(current[postId] ?? []), newComment],
      }));
      setCommunityPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, comments_count: post.comments_count + 1 } : post,
        ),
      );
      setCommentTexts((current) => ({ ...current, [postId]: '' }));
    } catch (error) {
      console.error('Community comment error:', error);
      Alert.alert('Hata', 'Yorum gönderilemedi.');
    } finally {
      setCommentPostingPostId(null);
    }
  }

  async function deleteCommunityPostComment(postId: string, comment: CommunityPostComment) {
    if (!currentUserId || comment.user_id !== currentUserId || deletingCommentId) return;

    setDeletingCommentId(comment.id);
    try {
      const { error } = await supabase
        .from('community_post_comments')
        .delete()
        .eq('id', comment.id)
        .eq('user_id', currentUserId);

      if (error) throw error;

      setPostComments((current) => ({
        ...current,
        [postId]: (current[postId] ?? []).filter((item) => item.id !== comment.id),
      }));
      setCommunityPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, comments_count: Math.max(0, post.comments_count - 1) }
            : post,
        ),
      );
    } catch (error) {
      console.error('Community comment delete error:', error);
      Alert.alert('Hata', 'Yorum silinemedi.');
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function choosePostImage() {
    if (postImageBusy) return;
    setPostImageBusy(true);
    try {
      const url = await pickCommunityImage('post');
      if (url) setPostImageUrl(url);
    } catch (error) {
      Alert.alert('Görsel eklenemedi', error instanceof Error ? error.message : 'Tekrar deneyebilirsin.');
    } finally {
      setPostImageBusy(false);
    }
  }

  async function createCommunityPost() {
    const text = postText.trim();
    if (!communityId || !currentUserId || !isMember || posting || (!text && !postImageUrl)) return;

    setPosting(true);
    try {
      const { error } = await supabase
        .from('community_posts')
        .insert({ community_id: communityId, user_id: currentUserId, text, image_url: postImageUrl });
      if (error) throw error;

      setPostText('');
      setPostImageUrl(null);
      setCommunityPostsOffset(0);
      setCommunityPostsHasMore(true);
      await loadCommunityPosts(true);
    } catch (error) {
      console.error('Community post create error:', error);
      Alert.alert('Hata', 'Paylaşım gönderilemedi.');
    } finally {
      setPosting(false);
    }
  }

  async function deleteCommunityPost(post: CommunityPost) {
    if (!currentUserId || post.user_id !== currentUserId || deletingPostId) return;

    setDeletingPostId(post.id);
    try {
      const { error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', currentUserId);
      if (error) throw error;

      setCommunityPosts((items) => items.filter((item) => item.id !== post.id));
      setCommunityPostsOffset((offset) => Math.max(0, offset - 1));
    } catch (error) {
      console.error('Community post delete error:', error);
      Alert.alert('Hata', 'Paylaşım silinemedi.');
    } finally {
      setDeletingPostId(null);
    }
  }

  async function toggleMembership() {
    if (!communityId || !currentUserId || membershipUpdating) return;
    setMembershipUpdating(true);

    const result = isMember
      ? await supabase
          .from('community_members')
          .delete()
          .eq('community_id', communityId)
          .eq('user_id', currentUserId)
      : await supabase.from('community_members').insert({ community_id: communityId, user_id: currentUserId });

    if (result.error) {
      console.error('Community membership error:', result.error);
      Alert.alert('İşlem başarısız', 'Topluluk üyeliği güncellenemedi.');
    } else {
      setIsMember(!isMember);
      setMemberCount((count) => Math.max(0, count + (isMember ? -1 : 1)));
    }

    setMembershipUpdating(false);
  }

  const goBack = () => {
    if (router.canGoBack()) safeBack(router, '/explore');
    else router.replace('/explore');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color="#9B72F2" style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (!communityId) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Geçersiz topluluk.</Text>
      </SafeAreaView>
    );
  }

  if (!community) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Topluluk bulunamadı.</Text>
      </SafeAreaView>
    );
  }

  const initial = community.name.charAt(0).toLocaleUpperCase('tr-TR');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={goBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Geri dön">
            <Feather name="chevron-left" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.topBarCopy}>
            <Text style={styles.topEyebrow}>TOPLULUK</Text>
            <Text style={styles.topTitle} numberOfLines={1}>{community.name}</Text>
          </View>
          {isAdmin ? (
            <Pressable
              onPress={() => router.push({ pathname: '/community-editor', params: { id: communityId } })}
              style={styles.settingsButton}
              accessibilityLabel="Topluluğu düzenle"
            >
              <Feather name="settings" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : <View style={styles.settingsPlaceholder} />}
        </View>

        <View style={styles.communityIdentity}>
          {community.image_url ? (
            <Image source={{ uri: community.image_url }} style={styles.communityAvatar} />
          ) : (
            <View style={[styles.communityAvatar, styles.mark]}>
              <Text style={styles.communityAvatarInitial}>{initial}</Text>
            </View>
          )}
          <View style={styles.communityIdentityCopy}>
            <View style={styles.communityNameRow}>
              <Text style={styles.communityName} numberOfLines={1}>{community.name}</Text>
              {isAdmin ? <Feather name="shield" size={14} color={colors.primary} /> : null}
            </View>
            <Text style={styles.communityMeta}>
              {memberCount} üye · {community.kind === 'book_club' ? 'Kitap kulübü' : 'Topluluk'}
            </Text>
            {community.description ? <Text style={styles.communityBlurb} numberOfLines={2}>{community.description}</Text> : null}
          </View>
          <Pressable
            disabled={membershipUpdating || !currentUserId || community.created_by === currentUserId}
            onPress={toggleMembership}
            style={[styles.joinButton, isMember && styles.joinButtonJoined]}
          >
            <Text style={[styles.joinButtonText, isMember && styles.joinButtonTextJoined]}>
              {membershipUpdating ? '...' : isMember ? 'Katıldın' : 'Katıl'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.tabBar}>
          {[
            { key: 'feed' as const, label: 'Akış', icon: 'message-square' as const },
            { key: 'about' as const, label: 'Hakkında', icon: 'info' as const },
            { key: 'members' as const, label: 'Üyeler', icon: 'users' as const },
          ].map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tabButton, selected && styles.tabButtonActive]}>
                <Feather name={tab.icon} size={15} color={selected ? colors.primary : colors.textMuted} />
                <Text style={[styles.tabText, selected && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'feed' ? <View style={styles.feed}>
          <View style={styles.feedHeading}>
            <Text style={styles.section}>Son paylaşımlar</Text>
            <Text style={styles.feedHint}>Yeni → eski</Text>
          </View>

          {isMember ? (
            <View style={styles.composerCard}>
              <View style={styles.composerHeader}>
                <View style={styles.composerIcon}>
                  <Feather name="edit-3" size={16} color={colors.primary} />
                </View>
                <Text style={styles.composerTitle}>Yeni paylaşım</Text>
              </View>
              <TextInput
                value={postText}
                onChangeText={setPostText}
                placeholder="Ne düşünüyorsun?"
                placeholderTextColor="#777983"
                multiline
                maxLength={2000}
                style={styles.postInput}
              />
              {postImageUrl ? (
                <View style={styles.postImagePreviewWrap}>
                  <Image source={{ uri: postImageUrl }} style={styles.postImagePreview} />
                  <Pressable onPress={() => setPostImageUrl(null)} style={styles.removePostImage} accessibilityLabel="Görseli kaldır">
                    <Feather name="x" size={16} color="#FFF" />
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.composerTools}>
                <Pressable disabled={postImageBusy} onPress={() => void choosePostImage()} style={styles.composerToolButton}>
                  {postImageBusy ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="image" size={17} color={colors.primary} />}
                  <Text style={styles.composerToolText}>{postImageUrl ? 'Görseli değiştir' : 'Görsel ekle'}</Text>
                </Pressable>
              </View>
              <View style={styles.composerFooter}>
                <Text style={styles.postCounter}>{postText.length}/2000</Text>
                <Pressable
                  disabled={posting || (!postText.trim() && !postImageUrl)}
                  onPress={createCommunityPost}
                  style={[styles.composerSend, (posting || (!postText.trim() && !postImageUrl)) && styles.composerSendDisabled]}
                >
                  {posting ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="send" size={15} color="#FFF" />}
                  <Text style={styles.composerSendText}>{posting ? 'Paylaşılıyor' : 'Paylaş'}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.emptySmall}>Paylaşım yapmak için topluluğa katıl.</Text>
          )}

          {communityPostsLoading ? (
            <ActivityIndicator color="#9B72F2" style={styles.postsLoader} />
          ) : communityPosts.length ? (
            <>
              {communityPosts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/profile', params: { userId: post.user_id } })}
                    accessibilityRole="button"
                    accessibilityLabel={`${post.username} profilini aç`}
                  >
                    <View style={styles.postAuthorRow}>
                      {post.profile_image ? (
                        <Image source={{ uri: post.profile_image }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, styles.avatarMark]}>
                          <Text style={styles.avatarText}>
                            {post.username.charAt(0).toLocaleUpperCase('tr-TR')}
                          </Text>
                        </View>
                      )}
                      <View style={styles.postAuthorInfo}>
                        <Text style={styles.memberName}>{post.username}</Text>
                        <Text style={styles.postDate}>{readerDate(post.created_at)}</Text>
                      </View>
                    </View>
                  </Pressable>

                  {post.text ? <Text style={styles.postBody}>{post.text}</Text> : null}
                  {post.image_url ? <Image source={{ uri: post.image_url }} style={styles.feedPostImage} /> : null}

                  <View style={styles.actionRow}>
                    <Pressable
                      disabled={pendingLikePostIds.has(post.id)}
                      onPress={() => void toggleCommunityPostLike(post)}
                      style={[styles.socialAction, post.liked && styles.socialActionActive]}
                      accessibilityLabel={post.liked ? 'Beğeniyi kaldır' : 'Beğen'}
                    >
                      <Feather
                        name="heart"
                        size={20}
                        color={post.liked ? colors.primary : colors.textSecondary}
                      />
                      <Text style={[styles.socialCount, post.liked && styles.likedText]}>
                        {post.likes_count}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => void togglePostComments(post.id)}
                      style={styles.socialAction}
                      accessibilityLabel="Yorumlar"
                    >
                      <Feather name="message-circle" size={20} color={colors.textSecondary} />
                      <Text style={styles.socialCount}>{post.comments_count}</Text>
                    </Pressable>

                    {post.user_id === currentUserId ? (
                      <Pressable
                        disabled={deletingPostId === post.id}
                        onPress={() => void deleteCommunityPost(post)}
                        style={styles.socialAction}
                        accessibilityLabel="Gönderiyi sil"
                      >
                        <Feather name="trash-2" size={19} color="#D87987" />
                      </Pressable>
                    ) : null}
                  </View>

                  {openCommentsPostId === post.id ? (
                    <View style={styles.commentsBox}>
                      {isMember ? (
                        <View style={styles.commentComposer}>
                          <TextInput
                            value={commentTexts[post.id] ?? ''}
                            onChangeText={(text) =>
                              setCommentTexts((current) => ({ ...current, [post.id]: text }))
                            }
                            placeholder="Konuşmaya katıl..."
                            placeholderTextColor="#777983"
                            multiline
                            style={styles.commentInput}
                          />
                          <Pressable
                            disabled={
                              commentPostingPostId === post.id || !(commentTexts[post.id] ?? '').trim()
                            }
                            onPress={() => void createCommunityPostComment(post.id)}
                            style={[
                              styles.commentSendButton,
                              (commentPostingPostId === post.id ||
                                !(commentTexts[post.id] ?? '').trim()) &&
                                styles.commentSendButtonDisabled,
                            ]}
                          >
                            <Text style={styles.commentSendText}>
                              {commentPostingPostId === post.id ? 'Gönderiliyor...' : 'Gönder'}
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Text style={styles.commentMemberNotice}>
                          Yorum yapmak için topluluğa katıl.
                        </Text>
                      )}

                      {commentsLoadingPostId === post.id ? (
                        <ActivityIndicator color="#9B72F2" style={styles.commentLoader} />
                      ) : (postComments[post.id] ?? []).length ? (
                        (postComments[post.id] ?? []).map((comment) => (
                          <View key={comment.id} style={styles.commentItem}>
                            {comment.profile_image ? (
                              <Image source={{ uri: comment.profile_image }} style={styles.commentAvatar} />
                            ) : (
                              <View style={[styles.commentAvatar, styles.avatarMark]}>
                                <Text style={styles.commentAvatarText}>
                                  {comment.username.charAt(0).toLocaleUpperCase('tr-TR')}
                                </Text>
                              </View>
                            )}
                            <View style={styles.commentContent}>
                              <Text style={styles.commentUsername}>{comment.username}</Text>
                              <Text style={styles.commentText}>{comment.text}</Text>
                              {comment.user_id === currentUserId ? (
                                <Pressable
                                  disabled={deletingCommentId === comment.id}
                                  onPress={() => void deleteCommunityPostComment(post.id, comment)}
                                >
                                  <Text style={styles.commentDeleteText}>
                                    {deletingCommentId === comment.id ? 'Siliniyor...' : 'Sil'}
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.noComments}>Henüz yorum yok.</Text>
                      )}
                    </View>
                  ) : null}
                </View>
              ))}

              {communityPostsHasMore ? (
                <Pressable
                  disabled={communityPostsLoadingMore}
                  onPress={() => void loadCommunityPosts(false)}
                  style={styles.loadMoreButton}
                  accessibilityRole="button"
                  accessibilityLabel="Daha fazla topluluk gönderisi yükle"
                >
                  {communityPostsLoadingMore ? (
                    <ActivityIndicator color="#CDBBFF" />
                  ) : (
                    <Text style={styles.loadMoreText}>Daha fazla yükle</Text>
                  )}
                </Pressable>
              ) : (
                <Text style={styles.endOfFeed}>Tüm gönderileri gördün.</Text>
              )}
            </>
          ) : (
            <Text style={styles.emptySmall}>Henüz paylaşım yok.</Text>
          )}
        </View> : null}

        {activeTab === 'about' ? (
          <View style={styles.aboutPanel}>
            <View style={styles.aboutCard}>
              <View style={styles.aboutIcon}><Feather name="info" size={18} color={colors.primary} /></View>
              <Text style={styles.aboutTitle}>Topluluk hakkında</Text>
              <Text style={styles.aboutBody}>{community.description || 'Bu topluluk için henüz açıklama eklenmemiş.'}</Text>
            </View>
            {community.current_book ? (
              <View style={styles.aboutCard}>
                <View style={styles.aboutIcon}><Feather name="book-open" size={18} color={colors.primary} /></View>
                <Text style={styles.aboutTitle}>Şu an okunuyor</Text>
                <Text style={styles.currentBook}>{community.current_book}</Text>
              </View>
            ) : null}
            <View style={styles.aboutCard}>
              <View style={styles.aboutIcon}><Feather name="shield" size={18} color={colors.primary} /></View>
              <Text style={styles.aboutTitle}>Topluluk kuralları</Text>
              <Text style={styles.aboutBody}>{community.rules || 'Henüz özel bir topluluk kuralı eklenmemiş.'}</Text>
            </View>
            {community.tags?.length ? (
              <View style={styles.tagWrap}>{community.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>#{tag}</Text></View>)}</View>
            ) : null}
          </View>
        ) : null}

        {activeTab === 'members' ? <>
        <View style={styles.membersSectionHeader}>
          <View>
            <Text style={styles.feedEyebrow}>TOPLULUK</Text>
            <Text style={styles.section}>Üyeler</Text>
          </View>
          {memberCount > 0 ? (
            <Pressable
              onPress={() => router.push({ pathname: '/community-members', params: { id: communityId } })}
              accessibilityRole="button"
              accessibilityLabel="Tüm topluluk üyelerini gör"
            >
              <Text style={styles.membersSeeAll}>Tümünü Gör</Text>
            </Pressable>
          ) : null}
        </View>

        {members.length ? (
          members.map((member) => (
            <Pressable
              key={member.user_id}
              onPress={() => router.push({ pathname: '/profile', params: { userId: member.user_id } })}
              style={styles.member}
            >
              {member.profile_image ? (
                <Image source={{ uri: member.profile_image }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarMark]}>
                  <Text style={styles.avatarText}>
                    {member.username.charAt(0).toLocaleUpperCase('tr-TR')}
                  </Text>
                </View>
              )}
              <Text style={styles.memberName}>{member.username}</Text>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.empty}>Henüz üye yok.</Text>
        )}
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08090D' },
  content: { width: '100%', maxWidth: 780, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 70 },
  loader: { marginTop: 80 },
  topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#2B2C35', backgroundColor: '#111218', alignItems: 'center', justifyContent: 'center' },
  topBarCopy: { flex: 1, minWidth: 0 },
  topEyebrow: { color: '#8F72C3', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  topTitle: { color: '#F1F1F4', fontSize: 14, fontWeight: '900', marginTop: 2 },
  settingsButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#2B2C35', backgroundColor: '#111218', alignItems: 'center', justifyContent: 'center' },
  settingsPlaceholder: { width: 42 },
  back: { color: '#B58AF6', fontSize: 15, marginBottom: 14 },
  communityIdentity: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#22232A' },
  communityAvatar: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#21172F' },
  communityAvatarInitial: { color: '#DCCBFF', fontSize: 22, fontWeight: '900' },
  communityIdentityCopy: { flex: 1, minWidth: 0 },
  communityNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  communityName: { color: '#F5F5F7', fontSize: 16, fontWeight: '900', flexShrink: 1 },
  communityMeta: { color: '#858792', fontSize: 9, fontWeight: '700', marginTop: 3 },
  communityBlurb: { color: '#9B9CA5', fontSize: 9, lineHeight: 13, marginTop: 5 },
  joinButton: { minWidth: 65, height: 36, borderRadius: 999, backgroundColor: '#6232B5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  joinButtonJoined: { backgroundColor: '#17181E', borderWidth: 1, borderColor: '#34353E' },
  joinButtonText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  joinButtonTextJoined: { color: '#B6B7BF' },
  hero: { backgroundColor: '#111218', borderColor: '#302F3A', borderWidth: 1, borderRadius: 24, padding: 14, overflow: 'hidden' },
  cover: { width: '100%', height: 190, borderRadius: 18, backgroundColor: '#24253A' },
  mark: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#21172F' },
  markText: { color: '#D5C4FA', fontSize: 58, fontWeight: '900' },
  heroTitleRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 15 },
  heroTitleCopy: { flex: 1 },
  title: { color: '#F7F7F9', fontSize: 25, lineHeight: 31, fontWeight: '900' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  metaPill: { minHeight: 29, borderRadius: 999, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1C1725' },
  count: { color: '#BCA4E8', fontSize: 9, fontWeight: '800' },
  adminPill: { minHeight: 29, borderRadius: 999, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#21172F' },
  adminPillText: { color: '#CDBBFF', fontSize: 9, fontWeight: '800' },
  description: { color: '#A2A3AC', marginTop: 13, lineHeight: 19, fontSize: 11 },
  cta: { backgroundColor: '#6232B5', borderRadius: 14, minHeight: 47, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  ctaText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  tabBar: { marginTop: 14, minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 5, flexDirection: 'row', gap: 5 },
  tabButton: { flex: 1, minHeight: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  tabButtonActive: { backgroundColor: '#21172F' },
  tabText: { color: '#737580', fontSize: 9, fontWeight: '900' },
  tabTextActive: { color: '#D9C7FA' },
  feed: { marginTop: 16 },
  feedHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  feedEyebrow: { color: '#8065AD', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  section: { color: '#F2F2F5', fontSize: 13, fontWeight: '900', marginTop: 3 },
  feedHint: { color: '#666873', fontSize: 8, fontWeight: '700' },
  livePill: { minHeight: 28, borderRadius: 999, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#15161B', borderWidth: 1, borderColor: '#292A32' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8D65D4' },
  liveText: { color: '#9697A0', fontSize: 8, fontWeight: '800' },
  composerCard: { borderRadius: 16, borderWidth: 1, borderColor: '#292A31', backgroundColor: '#101116', padding: 11, marginBottom: 7 },
  composerHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 9 },
  composerIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: '#21172F', alignItems: 'center', justifyContent: 'center' },
  composerTitle: { color: '#EDEDF0', fontSize: 11, fontWeight: '900' },
  composerSubtitle: { color: '#737580', fontSize: 8, marginTop: 2 },
  postInput: { minHeight: 70, maxHeight: 180, backgroundColor: '#15161B', borderColor: '#292A31', borderWidth: 1, borderRadius: 13, color: '#F4F4F6', paddingHorizontal: 12, paddingVertical: 11, fontSize: 12, lineHeight: 18, textAlignVertical: 'top' },
  postImagePreviewWrap: { marginTop: 10, borderRadius: 15, overflow: 'hidden', position: 'relative' },
  postImagePreview: { width: '100%', height: 210, backgroundColor: '#17181E' },
  removePostImage: { position: 'absolute', top: 9, right: 9, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(10,10,14,0.78)', alignItems: 'center', justifyContent: 'center' },
  composerTools: { flexDirection: 'row', alignItems: 'center', marginTop: 9 },
  composerToolButton: { minHeight: 36, borderRadius: 11, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#191522' },
  composerToolText: { color: '#BCA4E8', fontSize: 9, fontWeight: '800' },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
  postCounter: { color: '#5F616C', fontSize: 8 },
  composerSend: { minWidth: 94, minHeight: 39, borderRadius: 12, backgroundColor: '#6232B5', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  composerSendDisabled: { opacity: 0.42 },
  composerSendText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  postsLoader: { margin: 20 },
  postCard: { backgroundColor: '#0E0F13', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#24252B', paddingVertical: 13, paddingHorizontal: 2, marginTop: 4 },
  postAuthorRow: { flexDirection: 'row', alignItems: 'center' },
  postAuthorInfo: { flex: 1, marginLeft: 10 },
  moreButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  postDate: { color: '#666873', fontSize: 9, marginTop: 3 },
  postBody: { color: '#E8E8EC', fontSize: 13, lineHeight: 20, marginTop: 11 },
  feedPostImage: { width: '100%', height: 280, borderRadius: 14, marginTop: 11, backgroundColor: '#17181E' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  voteButton: { minWidth: 58, height: 36, borderRadius: 999, borderWidth: 1, borderColor: '#2C2D34', backgroundColor: '#15161B', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  commentAction: { minHeight: 36, borderRadius: 999, borderWidth: 1, borderColor: '#2C2D34', backgroundColor: '#15161B', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  socialAction: { minWidth: 44, height: 38, paddingHorizontal: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  socialActionActive: { backgroundColor: '#1D1728', borderWidth: 1, borderColor: '#302342' },
  socialCount: { color: '#777983', fontSize: 10, fontWeight: '800' },
  likedText: { color: '#9B72F2' },
  loadMoreButton: { minHeight: 46, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#302342', backgroundColor: '#1D1728', alignItems: 'center', justifyContent: 'center' },
  loadMoreText: { color: '#CDBBFF', fontSize: 11, fontWeight: '900' },
  endOfFeed: { color: '#686A74', fontSize: 9, textAlign: 'center', paddingVertical: 18 },
  commentsBox: { marginTop: 12, paddingTop: 12, paddingLeft: 13, borderTopWidth: 1, borderTopColor: '#25262E', borderLeftWidth: 1, borderLeftColor: '#34353D', gap: 11 },
  commentLoader: { marginVertical: 10 },
  commentComposer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  commentInput: { flex: 1, minHeight: 42, maxHeight: 100, backgroundColor: '#17181F', borderWidth: 1, borderColor: '#292A34', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, color: '#F5F5F7', fontSize: 11 },
  commentSendButton: { minHeight: 42, justifyContent: 'center', alignItems: 'center', backgroundColor: '#6232B5', borderRadius: 12, paddingHorizontal: 14 },
  commentSendButtonDisabled: { opacity: 0.45 },
  commentSendText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  commentMemberNotice: { color: '#777983', fontSize: 10, marginBottom: 4 },
  commentItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#24253A' },
  commentAvatarText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  commentContent: { flex: 1, paddingHorizontal: 2, paddingVertical: 4 },
  commentUsername: { color: '#F5F5F7', fontSize: 10, fontWeight: '900', marginBottom: 3 },
  commentText: { color: '#C5C6CE', fontSize: 10, lineHeight: 16 },
  commentDeleteText: { color: '#D88A8A', fontSize: 9, fontWeight: '700', marginTop: 6, alignSelf: 'flex-start' },
  noComments: { color: '#777983', fontSize: 10 },
  emptySmall: { color: '#8A8C96', paddingVertical: 15, fontSize: 10 },
  aboutPanel: { marginTop: 18, gap: 10 },
  aboutCard: { borderRadius: 18, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 15 },
  aboutIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#21172F', alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  aboutTitle: { color: '#F0F0F3', fontSize: 12, fontWeight: '900' },
  aboutBody: { color: '#9697A0', fontSize: 10, lineHeight: 17, marginTop: 7 },
  currentBook: { color: '#DCCBFF', fontSize: 14, fontWeight: '900', marginTop: 7 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { borderRadius: 999, backgroundColor: '#1C1725', paddingHorizontal: 10, paddingVertical: 7 },
  tagText: { color: '#BCA4E8', fontSize: 9, fontWeight: '800' },
  membersSectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 22, marginBottom: 11 },
  membersSeeAll: { color: '#B58AF6', fontSize: 10, fontWeight: '900', paddingVertical: 8, paddingLeft: 12 },
  member: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: '#111218', borderWidth: 1, borderColor: '#252630', borderRadius: 14, marginBottom: 7 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#24253A' },
  avatarMark: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#6C4CA4' },
  avatarText: { color: '#D5D7FF', fontWeight: '800' },
  memberName: { color: '#F4F4F6', flex: 1, fontSize: 11, fontWeight: '800' },
  arrow: { color: '#8C6AC8', fontSize: 20 },
  empty: { color: '#8A8C96', textAlign: 'center', marginTop: 60 },
});
