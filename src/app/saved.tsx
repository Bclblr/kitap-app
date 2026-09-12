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

  const loadSaved = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        setPosts([]);
        setWorks([]);
        return;
      }

      const [savedPostsResult, savedWorksResult] = await Promise.all([
        supabase
          .from('saved_posts')
          .select('post_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('saved_works')
          .select('work_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (savedPostsResult.error) console.error('Kaydedilen gönderiler alınamadı:', savedPostsResult.error);
      if (savedWorksResult.error) console.error('Kaydedilen eserler alınamadı:', savedWorksResult.error);

      const postIds = (savedPostsResult.data ?? []).map((item: any) => item.post_id).filter(Boolean);
      const workIds = (savedWorksResult.data ?? []).map((item: any) => item.work_id).filter(Boolean);

      const [postResult, workResult] = await Promise.all([
        postIds.length
          ? supabase.from('posts').select('id,text,username,created_at').in('id', postIds)
          : Promise.resolve({ data: [], error: null } as any),
        workIds.length
          ? supabase.from('works').select('id,title,description,status').in('id', workIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (postResult.error) console.error('Kaydedilen gönderi içerikleri alınamadı:', postResult.error);
      if (workResult.error) console.error('Kaydedilen eser içerikleri alınamadı:', workResult.error);

      const postsById = new Map((postResult.data ?? []).map((post: any) => [post.id, post]));
      const worksById = new Map((workResult.data ?? []).map((work: any) => [work.id, work]));

      setPosts(
        (savedPostsResult.data ?? [])
          .map((item: any) => postsById.get(item.post_id))
          .filter(Boolean) as SavedPost[]
      );
      setWorks(
        (savedWorksResult.data ?? [])
          .map((item: any) => worksById.get(item.work_id))
          .filter(Boolean) as SavedWork[]
      );
    } catch (error) {
      console.error('Kaydedilenler yüklenemedi:', error);
      setPosts([]);
      setWorks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSaved();
    }, [loadSaved])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Geri">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Kaydedilenler</Text>
        <View style={styles.iconButton} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>Kaydedilenler yükleniyor...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>Gönderiler</Text>
          {posts.length === 0 ? (
            <Text style={styles.emptyText}>Henüz kaydedilmiş gönderin yok.</Text>
          ) : (
            posts.map((post) => (
              <Pressable
                key={post.id}
                onPress={() => router.push({ pathname: '/content', params: { type: 'post', id: post.id } } as never)}
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <Feather name="bookmark" size={17} color={colors.primary} />
                  <Text style={styles.cardMeta}>@{post.username || 'kitapokuru'}</Text>
                </View>
                <Text numberOfLines={4} style={styles.cardText}>{post.text || 'Gönderi'}</Text>
              </Pressable>
            ))
          )}

          <Text style={[styles.sectionTitle, styles.secondSection]}>Eserler</Text>
          {works.length === 0 ? (
            <Text style={styles.emptyText}>Henüz kaydedilmiş eser yok.</Text>
          ) : (
            works.map((work) => (
              <Pressable
                key={work.id}
                onPress={() => router.push({ pathname: '/work', params: { id: work.id } } as never)}
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <Feather name="book-open" size={17} color={colors.primary} />
                  <Text style={styles.cardMeta}>Eser</Text>
                </View>
                <Text style={styles.workTitle}>{work.title}</Text>
                {work.description ? <Text numberOfLines={3} style={styles.cardText}>{work.description}</Text> : null}
              </Pressable>
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
  emptyText: { color: '#8E8E9D', fontSize: 14, paddingVertical: 10 },
  card: { backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934', borderRadius: 16, padding: 15, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  cardMeta: { color: '#A985FF', fontSize: 12, fontWeight: '800' },
  cardText: { color: '#D8D8DF', fontSize: 14, lineHeight: 20 },
  workTitle: { color: '#F5F5F8', fontSize: 16, fontWeight: '800', marginBottom: 7 },
});
