import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type SavedPost = {
  id: string;
  text: string | null;
  username: string | null;
  created_at: string;
};

type SavedWork = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
};

export default function SavedScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [works, setWorks] = useState<SavedWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    setLoading(true);
    setErrorText('');

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const user = authData.user;
      if (!user) {
        setPosts([]);
        setWorks([]);
        return;
      }

      const savedPostsResult = await supabase
        .from('saved_posts')
        .select('post_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (savedPostsResult.error) throw savedPostsResult.error;

      // saved_works eski/opsiyonel bir özellik. Canlı şemada henüz yoksa
      // Kaydedilenler ekranının tamamını bozmak yerine eser listesini boş bırak.
      const savedWorksResult = await supabase
        .from('saved_works')
        .select('work_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (savedWorksResult.error && savedWorksResult.error.code !== 'PGRST205') {
        throw savedWorksResult.error;
      }

      const savedWorksData = savedWorksResult.error ? [] : (savedWorksResult.data ?? []);

      const postIds = (savedPostsResult.data ?? [])
        .map((item: any) => item.post_id)
        .filter(Boolean);
      const workIds = savedWorksData
        .map((item: any) => item.work_id)
        .filter(Boolean);

      const [postResult, workResult] = await Promise.all([
        postIds.length
          ? supabase.from('posts').select('id,text,username,created_at').in('id', postIds)
          : Promise.resolve({ data: [], error: null } as any),
        workIds.length
          ? supabase.from('works').select('id,title,description,status').in('id', workIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (postResult.error) throw postResult.error;
      if (workResult.error) throw workResult.error;

      const postsById = new Map((postResult.data ?? []).map((post: any) => [post.id, post]));
      const worksById = new Map((workResult.data ?? []).map((work: any) => [work.id, work]));

      setPosts(
        (savedPostsResult.data ?? [])
          .map((item: any) => postsById.get(item.post_id))
          .filter(Boolean) as SavedPost[]
      );
      setWorks(
        savedWorksData
          .map((item: any) => worksById.get(item.work_id))
          .filter(Boolean) as SavedWork[]
      );
    } catch (error) {
      console.error('Kaydedilenler yüklenemedi:', error);
      setErrorText('Kaydedilenler yüklenemedi. Tekrar deneyebilirsin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSaved();
    }, [loadSaved])
  );

  async function removeSavedPost(postId: string) {
    if (removingId) return;
    setRemovingId(`post:${postId}`);
    setErrorText('');

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        router.replace('/login');
        return;
      }

      const { error } = await supabase
        .from('saved_posts')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId);

      if (error) throw error;
      setPosts((current) => current.filter((post) => post.id !== postId));
    } catch (error) {
      console.error('Kaydedilen gönderi kaldırılamadı:', error);
      setErrorText('Gönderi kaydedilenlerden çıkarılamadı.');
    } finally {
      setRemovingId(null);
    }
  }

  async function removeSavedWork(workId: string) {
    if (removingId) return;
    setRemovingId(`work:${workId}`);
    setErrorText('');

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        router.replace('/login');
        return;
      }

      const { error } = await supabase
        .from('saved_works')
        .delete()
        .eq('user_id', userId)
        .eq('work_id', workId);

      if (error?.code === 'PGRST205') {
        setWorks((current) => current.filter((work) => work.id !== workId));
        return;
      }
      if (error) throw error;
      setWorks((current) => current.filter((work) => work.id !== workId));
    } catch (error) {
      console.error('Kaydedilen eser kaldırılamadı:', error);
      setErrorText('Eser kaydedilenlerden çıkarılamadı.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Geri">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Kaydedilenler</Text>
        <Pressable onPress={() => void loadSaved()} style={styles.iconButton} accessibilityLabel="Kaydedilenleri yenile">
          <Feather name="refresh-cw" size={19} color={colors.text} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>Kaydedilenler yükleniyor...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {errorText ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{errorText}</Text>
              <Pressable onPress={() => void loadSaved()} style={styles.retryButton}>
                <Text style={styles.retryText}>Tekrar dene</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Gönderiler</Text>
          {posts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="bookmark" size={28} color={colors.primary} />
              <Text style={styles.emptyTitle}>Kaydedilmiş gönderi yok</Text>
              <Text style={styles.emptyText}>Ana akışta yer imi simgesine dokunduğun gönderiler burada görünür.</Text>
              <Pressable onPress={() => router.replace('/')} style={styles.browseButton}>
                <Text style={styles.browseButtonText}>Ana akışa git</Text>
              </Pressable>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={styles.card}>
                <Pressable
                  onPress={() => router.push({ pathname: '/content', params: { type: 'post', id: post.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${post.username || 'Kitap Okuru'} gönderisini aç`}
                >
                  <View style={styles.cardHeader}>
                    <Feather name="bookmark" size={17} color={colors.primary} />
                    <Text style={styles.cardMeta}>@{post.username || 'kitapokuru'}</Text>
                  </View>
                  <Text numberOfLines={4} style={styles.cardText}>{post.text || 'Gönderi'}</Text>
                </Pressable>

                <Pressable
                  onPress={() => void removeSavedPost(post.id)}
                  disabled={removingId !== null}
                  style={styles.removeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Gönderiyi kaydedilenlerden çıkar"
                >
                  <Feather name="bookmark" size={16} color={colors.textSecondary} />
                  <Text style={styles.removeButtonText}>
                    {removingId === `post:${post.id}` ? 'Kaldırılıyor…' : 'Kaydedilenlerden çıkar'}
                  </Text>
                </Pressable>
              </View>
            ))
          )}

          <Text style={[styles.sectionTitle, styles.secondSection]}>Eserler</Text>
          {works.length === 0 ? (
            <Text style={styles.emptyText}>Henüz kaydedilmiş eser yok.</Text>
          ) : (
            works.map((work) => (
              <View key={work.id} style={styles.card}>
                <Pressable
                  onPress={() => router.push({ pathname: '/work', params: { id: work.id } } as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${work.title} eserini aç`}
                >
                  <View style={styles.cardHeader}>
                    <Feather name="book-open" size={17} color={colors.primary} />
                    <Text style={styles.cardMeta}>Eser</Text>
                  </View>
                  <Text style={styles.workTitle}>{work.title}</Text>
                  {work.description ? <Text numberOfLines={3} style={styles.cardText}>{work.description}</Text> : null}
                </Pressable>

                <Pressable
                  onPress={() => void removeSavedWork(work.id)}
                  disabled={removingId !== null}
                  style={styles.removeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Eseri kaydedilenlerden çıkar"
                >
                  <Feather name="bookmark" size={16} color={colors.textSecondary} />
                  <Text style={styles.removeButtonText}>
                    {removingId === `work:${work.id}` ? 'Kaldırılıyor…' : 'Kaydedilenlerden çıkar'}
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  header: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#262631' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#F5F5F8', fontSize: 18, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: '#8E8E9D', fontSize: 13 },
  content: { padding: 16, paddingBottom: 48 },
  sectionTitle: { color: '#F5F5F8', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  secondSection: { marginTop: 28 },
  emptyCard: { alignItems: 'center', borderWidth: 1, borderColor: '#292934', borderRadius: 16, padding: 22, backgroundColor: '#15151D' },
  emptyTitle: { color: '#F5F5F8', fontSize: 16, fontWeight: '800', marginTop: 10 },
  emptyText: { color: '#8E8E9D', fontSize: 14, lineHeight: 20, paddingVertical: 10, textAlign: 'center' },
  browseButton: { marginTop: 5, minHeight: 44, borderRadius: 12, backgroundColor: '#302246', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  browseButtonText: { color: '#A985FF', fontWeight: '800' },
  card: { backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934', borderRadius: 16, padding: 15, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  cardMeta: { color: '#A985FF', fontSize: 12, fontWeight: '800' },
  cardText: { color: '#D8D8DF', fontSize: 14, lineHeight: 20 },
  workTitle: { color: '#F5F5F8', fontSize: 16, fontWeight: '800', marginBottom: 7 },
  removeButton: { minHeight: 44, marginTop: 12, borderTopWidth: 1, borderTopColor: '#292934', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingTop: 10 },
  removeButtonText: { color: '#A7A7B2', fontSize: 13, fontWeight: '700' },
  errorCard: { backgroundColor: '#1A1519', borderWidth: 1, borderColor: '#49313A', borderRadius: 14, padding: 14, marginBottom: 18 },
  errorText: { color: '#F0C7D1', fontSize: 13, lineHeight: 19 },
  retryButton: { alignSelf: 'flex-start', marginTop: 9, minHeight: 40, justifyContent: 'center' },
  retryText: { color: '#A985FF', fontWeight: '800' },
});
