import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Image from '@/components/SafeImage';
import { deleteStoryWithMedia } from '@/lib/story-media';
import { supabase } from '@/lib/supabase';

type StoryViewer = {
  id: string;
  username: string | null;
  full_name: string | null;
  profile_image: string | null;
  viewed_at: string;
};

export default function StoryActions({
  storyId,
  ownerId,
  allowLikes = true,
  allowReplies = true,
  onDeleted,
  onClose,
}: {
  storyId: string;
  ownerId?: string | null;
  allowLikes?: boolean;
  allowReplies?: boolean;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const [userId, setUserId] = useState('');
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [viewersVisible, setViewersVisible] = useState(false);
  const [viewersLoading, setViewersLoading] = useState(false);

  const isOwner = !!userId && userId === ownerId;

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const auth = await supabase.auth.getUser();
        if (!auth.data.user) return;
        const currentUserId = auth.data.user.id;
        const [likeResult, viewResult] = await Promise.all([
          supabase.from('story_likes').select('story_id').eq('story_id', storyId).eq('user_id', currentUserId).maybeSingle(),
          ownerId === currentUserId
            ? supabase.from('story_views').select('viewer_id', { count: 'exact', head: true }).eq('story_id', storyId)
            : Promise.resolve({ count: 0, error: null }),
        ]);
        if (!alive) return;
        setUserId(currentUserId);
        setLiked(!!likeResult.data);
        setViewerCount(viewResult.count ?? 0);
      } catch {
        if (alive) setError('Hikâye işlemleri yüklenemedi.');
      }
    })();
    return () => { alive = false; };
  }, [ownerId, storyId]);

  async function loadViewers() {
    if (!isOwner || viewersLoading) return;
    setViewersVisible(true);
    setViewersLoading(true);
    try {
      const { data: rows, error: viewError } = await supabase
        .from('story_views')
        .select('viewer_id,viewed_at')
        .eq('story_id', storyId)
        .order('viewed_at', { ascending: false })
        .limit(200);
      if (viewError) throw viewError;

      const ids = (rows ?? []).map(row => row.viewer_id);
      if (!ids.length) {
        setViewers([]);
        setViewerCount(0);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id,username,full_name,profile_image')
        .in('id', ids);
      if (profileError) throw profileError;

      const profileMap = new Map((profiles ?? []).map(profile => [profile.id, profile]));
      const next = (rows ?? []).map(row => {
        const profile = profileMap.get(row.viewer_id);
        return {
          id: row.viewer_id,
          username: profile?.username ?? null,
          full_name: profile?.full_name ?? null,
          profile_image: profile?.profile_image ?? null,
          viewed_at: row.viewed_at,
        };
      });
      setViewers(next);
      setViewerCount(next.length);
    } catch {
      setError('Görenler listesi yüklenemedi.');
    } finally {
      setViewersLoading(false);
    }
  }

  async function act(remove = false) {
    if (lock.current || !userId) return;
    lock.current = true;
    setBusy(true);
    setError('');

    try {
      if (remove) {
        const { data: story, error: storyError } = await supabase
          .from('stories')
          .select('id,user_id,image_url')
          .eq('id', storyId)
          .eq('user_id', userId)
          .maybeSingle();
        if (storyError) throw storyError;
        if (!story) throw new Error('Hikâye bulunamadı.');
        await deleteStoryWithMedia(story.id, userId, story.image_url);
        onDeleted();
        return;
      }

      const result = liked
        ? await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', userId)
        : await supabase.from('story_likes').insert({ story_id: storyId, user_id: userId });
      if (result.error) throw result.error;
      setLiked(!liked);
    } catch {
      setError(remove ? 'Hikâye ve görseli silinemedi.' : 'İşlem tamamlanamadı.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        {isOwner ? (
          <>
            <Pressable onPress={() => void loadViewers()} style={styles.viewerButton}>
              <Feather name="eye" size={18} color="#EDE9F8" />
              <Text style={styles.viewerButtonText}>{viewerCount > 0 ? `${viewerCount} gören` : 'Görenler'}</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={() => void act(true)} style={styles.iconAction} accessibilityLabel="Hikâyeyi sil">
              {busy ? <ActivityIndicator size="small" color="#E9A3AE" /> : <Feather name="trash-2" size={19} color="#E9A3AE" />}
            </Pressable>
          </>
        ) : (
          <>
            {!!userId && allowLikes ? (
              <Pressable disabled={busy} onPress={() => void act()} style={[styles.iconAction, liked && styles.likedAction]} accessibilityLabel={liked ? 'Beğeniyi kaldır' : 'Hikâyeyi beğen'}>
                <Feather name="heart" size={20} color={liked ? '#F4B2D2' : '#FFF'} />
              </Pressable>
            ) : null}
            {ownerId && allowReplies ? (
              <Pressable
                style={styles.replyButton}
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/chat', params: { userId: ownerId, reply: `Hikâyene yanıt (${storyId}): ` } });
                }}
              >
                <Text style={styles.replyPlaceholder}>Yanıt gönder…</Text>
                <Feather name="send" size={18} color="#D9CCFF" />
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      {!!error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={viewersVisible} transparent animationType="slide" onRequestClose={() => setViewersVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewersVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Hikâyeyi görenler</Text>
                <Text style={styles.sheetSubtitle}>{viewerCount} kişi</Text>
              </View>
              <Pressable onPress={() => setViewersVisible(false)} style={styles.closeButton}>
                <Feather name="x" size={19} color="#FFF" />
              </Pressable>
            </View>

            {viewersLoading ? (
              <View style={styles.loading}><ActivityIndicator color="#A985FF" /></View>
            ) : viewers.length ? (
              <ScrollView style={styles.viewerList} contentContainerStyle={styles.viewerListContent}>
                {viewers.map(viewer => (
                  <Pressable
                    key={viewer.id}
                    style={styles.viewerRow}
                    onPress={() => {
                      setViewersVisible(false);
                      onClose();
                      router.push({ pathname: '/profile', params: { userId: viewer.id } });
                    }}
                  >
                    {viewer.profile_image ? (
                      <Image source={{ uri: viewer.profile_image }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarLetter}>{(viewer.username || viewer.full_name || 'K').charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.viewerCopy}>
                      <Text style={styles.viewerName}>{viewer.full_name || viewer.username || 'Kitap Okuru'}</Text>
                      {viewer.username ? <Text style={styles.viewerUsername}>@{viewer.username}</Text> : null}
                    </View>
                    <Text style={styles.viewedAt}>{new Date(viewer.viewed_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><Feather name="eye" size={24} color="#A985FF" /></View>
                <Text style={styles.emptyTitle}>Henüz kimse görmedi</Text>
                <Text style={styles.emptyText}>Hikâyeni gören kişiler burada listelenecek.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 12, paddingTop: 9, paddingBottom: 4, zIndex: 30 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconAction: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#17181E', borderWidth: 1, borderColor: '#2C2E36', alignItems: 'center', justifyContent: 'center' },
  likedAction: { backgroundColor: '#2A1721', borderColor: '#573044' },
  replyButton: { flex: 1, minHeight: 46, borderRadius: 23, paddingHorizontal: 16, backgroundColor: '#121318', borderWidth: 1, borderColor: '#30323A', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  replyPlaceholder: { color: '#8B8E98', fontSize: 12.5, fontWeight: '600' },
  viewerButton: { flex: 1, minHeight: 46, borderRadius: 23, paddingHorizontal: 16, backgroundColor: '#17151E', borderWidth: 1, borderColor: '#342A45', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  viewerButtonText: { color: '#EDE9F8', fontSize: 12.5, fontWeight: '800' },
  error: { color: '#E8A1AB', fontSize: 10, marginTop: 5, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '72%', minHeight: 300, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 28, backgroundColor: '#111218', borderWidth: 1, borderColor: '#292B33' },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#42454E', alignSelf: 'center', marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A2C34' },
  sheetTitle: { color: '#F5F5F7', fontSize: 17, fontWeight: '900' },
  sheetSubtitle: { color: '#777B86', fontSize: 10.5, marginTop: 3 },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#202229', alignItems: 'center', justifyContent: 'center' },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  viewerList: { flexGrow: 0 },
  viewerListContent: { paddingVertical: 8 },
  viewerRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#24262D' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2B2140', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#F1E9FF', fontSize: 16, fontWeight: '900' },
  viewerCopy: { flex: 1 },
  viewerName: { color: '#ECECEF', fontSize: 13, fontWeight: '800' },
  viewerUsername: { color: '#777B86', fontSize: 10.5, marginTop: 2 },
  viewedAt: { color: '#676B75', fontSize: 9.5 },
  empty: { minHeight: 210, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#21182F', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: '#F1F1F4', fontSize: 15, fontWeight: '900' },
  emptyText: { color: '#777B86', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 },
});
