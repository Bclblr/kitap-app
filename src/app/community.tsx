import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type CommunityDetail = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_by: string | null;
  created_at: string;
};
type CommunityMemberPreview = {
  user_id: string;
  username: string;
  profile_image: string | null;
};
type CommunityPost = {
  id: string;
  community_id: string;
  user_id: string;
  username: string;
  profile_image: string | null;
  text: string;
  created_at: string;
  likes_count: number;
  liked: boolean;
};

export default function CommunityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const communityId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [members, setMembers] = useState<CommunityMemberPreview[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [membershipUpdating, setMembershipUpdating] = useState(false);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityPostsLoading, setCommunityPostsLoading] = useState(false);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [pendingLikePostIds, setPendingLikePostIds] = useState<Set<string>>(
    new Set(),
  );

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
          .from("communities")
          .select("id, name, description, image_url, created_by, created_at")
          .eq("id", communityId)
          .maybeSingle();
        if (error) throw error;
        if (!mounted) return;
        setCommunity(data as CommunityDetail | null);
        const countResult = await supabase
          .from("community_members")
          .select("*", { count: "exact", head: true })
          .eq("community_id", communityId);
        if (mounted) setMemberCount(countResult.count ?? 0);
        if (userId) {
          const membership = await supabase
            .from("community_members")
            .select("user_id")
            .eq("community_id", communityId)
            .eq("user_id", userId)
            .maybeSingle();
          if (mounted) setIsMember(Boolean(membership.data));
        }
        const { data: memberRows } = await supabase
          .from("community_members")
          .select("user_id")
          .eq("community_id", communityId)
          .order("joined_at", { ascending: true })
          .limit(6);
        const ids = (memberRows ?? [])
          .map((row) => row.user_id)
          .filter(Boolean);
        if (ids.length) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username, profile_image")
            .in("id", ids);
          if (mounted)
            setMembers(
              (profiles ?? []).map((profile) => ({
                user_id: profile.id,
                username: profile.username || "Kullanıcı",
                profile_image: profile.profile_image,
              })),
            );
        }
      } catch (error) {
        console.error("Community load error:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [communityId]);

  async function loadCommunityPosts() {
    if (!communityId) return;
    setCommunityPostsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const activeUserId = user?.id ?? null;
      const { data, error } = await supabase
        .from("community_posts")
        .select("id, community_id, user_id, text, created_at")
        .eq("community_id", communityId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((row) => row.user_id).filter(Boolean);
      const { data: profiles } = ids.length
        ? await supabase
            .from("profiles")
            .select("id, username, profile_image")
            .in("id", ids)
        : { data: [] };
      const profileMap = new Map(
        (profiles ?? []).map((profile) => [profile.id, profile]),
      );
      const postIds = rows.map((row) => row.id).filter(Boolean);
      const { data: likeRows } = postIds.length
        ? await supabase
            .from("community_post_likes")
            .select("post_id, user_id")
            .in("post_id", postIds)
        : { data: [] };
      setCommunityPosts(
        rows.map((row) => ({
          ...row,
          username: profileMap.get(row.user_id)?.username || "Kullanıcı",
          profile_image: profileMap.get(row.user_id)?.profile_image ?? null,
          likes_count: (likeRows ?? []).filter(
            (like) => like.post_id === row.id,
          ).length,
          liked: (likeRows ?? []).some(
            (like) => like.post_id === row.id && like.user_id === activeUserId,
          ),
        })) as CommunityPost[],
      );
    } catch (error) {
      console.error("Community posts error:", error);
      setCommunityPosts([]);
    } finally {
      setCommunityPostsLoading(false);
    }
  }

  async function toggleCommunityPostLike(post: CommunityPost) {
    if (pendingLikePostIds.has(post.id)) return;
    if (!currentUserId || !post.id) return;

    setPendingLikePostIds((ids) => new Set(ids).add(post.id));

    try {
      const { data: existingLikes, error: fetchError } = await supabase
        .from("community_post_likes")
        .select("user_id")
        .eq("post_id", post.id);

      if (fetchError) {
        console.error("Failed to fetch current likes:", fetchError);
        return;
      }

      const wasLiked =
        existingLikes?.some((like) => like.user_id === currentUserId) ?? false;

      if (wasLiked) {
        const { error: deleteError } = await supabase
          .from("community_post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);

        if (deleteError) {
          console.error("Community post unlike error:", deleteError);
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from("community_post_likes")
          .insert({
            post_id: post.id,
            user_id: currentUserId,
          });

        if (insertError) {
          console.error("Community post like error:", insertError);
          return;
        }
      }

      const { data: freshLikes, error: freshError } = await supabase
        .from("community_post_likes")
        .select("user_id")
        .eq("post_id", post.id);

      if (freshError) {
        console.error("Failed to refresh likes:", freshError);
        return;
      }

      const freshLikesCount = freshLikes?.length ?? 0;
      const isNowLiked =
        freshLikes?.some((like) => like.user_id === currentUserId) ?? false;

      setCommunityPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                liked: isNowLiked,
                likes_count: freshLikesCount,
              }
            : item,
        ),
      );
    } finally {
      setPendingLikePostIds((ids) => {
        const next = new Set(ids);
        next.delete(post.id);
        return next;
      });
    }
  }
  useEffect(() => {
    void loadCommunityPosts();
  }, [communityId]);

  async function createCommunityPost() {
    const text = postText.trim();
    if (!communityId || !currentUserId || !isMember || posting || !text) return;
    setPosting(true);
    const { error } = await supabase
      .from("community_posts")
      .insert({ community_id: communityId, user_id: currentUserId, text });
    if (error) console.error("Community post create error:", error);
    else {
      setPostText("");
      await loadCommunityPosts();
    }
    setPosting(false);
  }

  async function deleteCommunityPost(post: CommunityPost) {
    if (!currentUserId || post.user_id !== currentUserId || deletingPostId)
      return;
    setDeletingPostId(post.id);
    const { error } = await supabase
      .from("community_posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", currentUserId);
    if (error) console.error("Community post delete error:", error);
    else
      setCommunityPosts((items) => items.filter((item) => item.id !== post.id));
    setDeletingPostId(null);
  }

  async function toggleMembership() {
    if (!communityId || !currentUserId || membershipUpdating) return;
    setMembershipUpdating(true);
    const result = isMember
      ? await supabase
          .from("community_members")
          .delete()
          .eq("community_id", communityId)
          .eq("user_id", currentUserId)
      : await supabase
          .from("community_members")
          .insert({ community_id: communityId, user_id: currentUserId });
    if (result.error) {
      console.error("Community membership error:", result.error);
      Alert.alert("İşlem başarısız", "Topluluk üyeliği güncellenemedi.");
    } else {
      setIsMember(!isMember);
      setMemberCount((count) => Math.max(0, count + (isMember ? -1 : 1)));
    }
    setMembershipUpdating(false);
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/explore");
  };
  if (loading)
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color="#9B72F2" style={styles.loader} />
      </SafeAreaView>
    );
  if (!communityId)
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Geçersiz topluluk.</Text>
      </SafeAreaView>
    );
  if (!community)
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Topluluk bulunamadı.</Text>
      </SafeAreaView>
    );
  const initial = community.name.charAt(0).toLocaleUpperCase("tr-TR");
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={goBack}>
          <Text style={styles.back}>‹ Geri</Text>
        </Pressable>
        <View style={styles.hero}>
          {community.image_url ? (
            <Image source={{ uri: community.image_url }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.mark]}>
              <Text style={styles.markText}>{initial}</Text>
            </View>
          )}
          <Text style={styles.title}>{community.name}</Text>
          <Text style={styles.count}>{memberCount} üye</Text>
          {community.description ? (
            <Text style={styles.description}>{community.description}</Text>
          ) : null}
          <Pressable
            disabled={membershipUpdating || !currentUserId}
            onPress={toggleMembership}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>
              {membershipUpdating
                ? "Güncelleniyor..."
                : isMember
                  ? "Topluluktan Ayrıl"
                  : "Topluluğa Katıl"}
            </Text>
          </Pressable>
        </View>
        <View style={styles.feed}>
          <Text style={styles.section}>Topluluk Akışı</Text>
          {isMember ? (
            <>
              <TextInput
                value={postText}
                onChangeText={setPostText}
                placeholder="Topluluğa bir şey yaz..."
                placeholderTextColor="#777983"
                multiline
                style={styles.postInput}
              />
              <Pressable
                disabled={posting}
                onPress={createCommunityPost}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>
                  {posting ? "Paylaşılıyor..." : "Paylaş"}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.emptySmall}>
              Paylaşım yapmak için topluluğa katıl.
            </Text>
          )}
          {communityPostsLoading ? (
            <ActivityIndicator color="#9B72F2" style={styles.postsLoader} />
          ) : communityPosts.length ? (
            communityPosts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/profile",
                      params: { userId: post.user_id },
                    })
                  }
                >
                  {post.profile_image ? (
                    <Image
                      source={{ uri: post.profile_image }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarMark]}>
                      <Text style={styles.avatarText}>
                        {post.username.charAt(0).toLocaleUpperCase("tr-TR")}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.memberName}>{post.username}</Text>
                </Pressable>
                <Text style={styles.postDate}>
                  {new Date(post.created_at).toLocaleDateString("tr-TR")}
                </Text>
                <Text style={styles.postBody}>{post.text}</Text>
                <View style={styles.actionRow}>
                  <Pressable
                    disabled={pendingLikePostIds.has(post.id)}
                    onPress={() => void toggleCommunityPostLike(post)}
                  >
                    <Text
                      style={[styles.likeText, post.liked && styles.likedText]}
                    >
                      {post.liked ? "♥ Beğen" : "♡ Beğen"} · {post.likes_count}
                    </Text>
                  </Pressable>
                  {post.user_id === currentUserId ? (
                    <Pressable onPress={() => void deleteCommunityPost(post)}>
                      <Text style={styles.deleteText}>
                        {deletingPostId === post.id ? "Siliniyor..." : "Sil"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptySmall}>Henüz paylaşım yok.</Text>
          )}
        </View>
        <Text style={styles.section}>Üyeler</Text>
        {members.length ? (
          members.map((member) => (
            <Pressable
              key={member.user_id}
              onPress={() =>
                router.push({
                  pathname: "/profile",
                  params: { userId: member.user_id },
                })
              }
              style={styles.member}
            >
              {member.profile_image ? (
                <Image
                  source={{ uri: member.profile_image }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarMark]}>
                  <Text style={styles.avatarText}>
                    {member.username.charAt(0).toLocaleUpperCase("tr-TR")}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#08090D" },
  content: { padding: 18, paddingBottom: 50 },
  loader: { marginTop: 80 },
  back: { color: "#B58AF6", fontSize: 15, marginBottom: 14 },
  hero: {
    backgroundColor: "#111218",
    borderColor: "#302F4A",
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  cover: {
    width: "100%",
    height: 130,
    borderRadius: 14,
    backgroundColor: "#24253A",
  },
  mark: { justifyContent: "center", alignItems: "center" },
  markText: { color: "#D5D7FF", fontSize: 48, fontWeight: "900" },
  title: { color: "#F7F7F9", fontSize: 24, fontWeight: "900", marginTop: 15 },
  count: { color: "#B58AF6", marginTop: 5 },
  description: { color: "#9A9CA7", marginTop: 10, lineHeight: 19 },
  cta: {
    backgroundColor: "#8058D9",
    borderRadius: 13,
    padding: 13,
    alignItems: "center",
    marginTop: 16,
  },
  ctaText: { color: "#FFF", fontWeight: "800" },
  section: {
    color: "#F2F2F5",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 22,
    marginBottom: 8,
  },
  feed: { marginTop: 4 },
  postInput: {
    minHeight: 80,
    backgroundColor: "#111218",
    borderColor: "#302F4A",
    borderWidth: 1,
    borderRadius: 14,
    color: "#F4F4F6",
    padding: 12,
    textAlignVertical: "top",
  },
  postsLoader: { margin: 20 },
  postCard: {
    backgroundColor: "#111218",
    borderColor: "#2D2E37",
    borderWidth: 1,
    borderRadius: 15,
    padding: 13,
    marginTop: 10,
  },
  postDate: { color: "#777983", fontSize: 10, marginTop: -20, marginLeft: 55 },
  postBody: { color: "#F4F4F6", fontSize: 14, lineHeight: 20, marginTop: 14 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 10,
  },
  likeText: { color: "#777983", fontSize: 11 },
  likedText: { color: "#9B72F2" },
  deleteText: { color: "#D87987", fontSize: 11 },
  emptySmall: { color: "#8A8C96", paddingVertical: 15 },
  member: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#111218",
    borderBottomWidth: 1,
    borderBottomColor: "#252630",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#24253A",
  },
  avatarMark: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#7F8FEF",
  },
  avatarText: { color: "#D5D7FF", fontWeight: "800" },
  memberName: { color: "#F4F4F6", marginLeft: 12, flex: 1 },
  arrow: { color: "#B58AF6", fontSize: 22 },
  empty: { color: "#8A8C96", textAlign: "center", marginTop: 60 },
});
