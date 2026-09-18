import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { safeBack } from '@/lib/navigation';
import Image from '@/components/SafeImage';
import HashtagText from '@/components/HashtagText';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type ContentType = 'post' | 'review';

type ContentRow = {
  id: string;
  user_id: string | null;
  text: string | null;
  image_url?: string | null;
  book_key?: string | null;
  book_title?: string | null;
  rating?: number | null;
  created_at: string;
  username?: string | null;
  full_name?: string | null;
  profile_image?: string | null;
};

export default function ContentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; type?: string }>();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [content, setContent] = useState<ContentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorText('');
      setContent(null);

      const id = typeof params.id === 'string' ? params.id.trim() : '';
      const type: ContentType = params.type === 'review' ? 'review' : 'post';

      if (!id) {
        if (active) {
          setErrorText('İçerik kimliği bulunamadı.');
          setLoading(false);
        }
        return;
      }

      const table = type === 'review' ? 'reviews' : 'posts';
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();

      if (error || !data) {
        if (active) {
          setErrorText('İçerik bulunamadı, silinmiş olabilir veya bu içeriği görme iznin olmayabilir.');
          setLoading(false);
        }
        return;
      }

      if (data.user_id) {
        const { data: authData } = await supabase.auth.getUser();
        const viewerId = authData.user?.id ?? null;

        if (viewerId && viewerId !== data.user_id) {
          const { data: blockedRows, error: blockError } = await supabase
            .from('user_blocks')
            .select('blocker_id,blocked_id')
            .or(
              `and(blocker_id.eq.${viewerId},blocked_id.eq.${data.user_id}),and(blocker_id.eq.${data.user_id},blocked_id.eq.${viewerId})`
            )
            .limit(1);

          if (blockError) {
            console.error('İçerik engel kontrolü yapılamadı:', blockError);
          } else if ((blockedRows ?? []).length > 0) {
            if (active) {
              setErrorText('Bu içeriğe erişilemiyor.');
              setLoading(false);
            }
            return;
          }

          const { data: canView, error: accessError } = await supabase.rpc(
            'can_view_profile_content',
            { p_owner: data.user_id }
          );

          if (accessError) {
            console.error('İçerik erişim kontrolü yapılamadı:', accessError);
          } else if (canView !== true) {
            if (active) {
              setErrorText('Bu hesap gizli. İçeriği görmek için takip isteğinin onaylanması gerekiyor.');
              setLoading(false);
            }
            return;
          }
        }
      }

      let profile: any = null;
      if (data.user_id) {
        const profileResult = await supabase
          .from('profiles')
          .select('username, full_name, profile_image')
          .eq('id', data.user_id)
          .maybeSingle();
        profile = profileResult.data;
      }

      if (!active) return;
      setContent({
        id: String(data.id),
        user_id: data.user_id ? String(data.user_id) : null,
        text: data.text ?? null,
        image_url: data.image_url ?? null,
        book_key: data.book_key ?? null,
        book_title: data.book_title ?? null,
        rating: Number(data.rating ?? 0),
        created_at: String(data.created_at ?? ''),
        username: profile?.username ?? data.username ?? 'Kitap Okuru',
        full_name: profile?.full_name ?? null,
        profile_image: profile?.profile_image ?? null,
      });
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [params.id, params.type]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => safeBack(router, '/')} style={styles.backButton} accessibilityLabel="Geri">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>İçerik</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>İçerik yükleniyor...</Text>
        </View>
      ) : errorText ? (
        <View style={styles.center}>
          <Feather name="lock" size={30} color={colors.primary} />
          <Text style={styles.errorTitle}>{errorText}</Text>
          <Pressable onPress={() => router.replace('/')} style={styles.homeButton}>
            <Text style={styles.homeButtonText}>Ana sayfaya dön</Text>
          </Pressable>
        </View>
      ) : content ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Pressable
              disabled={!content.user_id}
              onPress={() =>
                content.user_id
                  ? router.push({ pathname: '/profile', params: { userId: content.user_id } })
                  : undefined
              }
              style={styles.authorRow}
              accessibilityRole={content.user_id ? 'button' : undefined}
              accessibilityLabel={content.user_id ? 'Yazar profilini aç' : undefined}
            >
              {content.profile_image ? (
                <Image source={{ uri: content.profile_image }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Feather name="user" size={19} color={colors.primary} />
                </View>
              )}
              <View style={styles.authorText}>
                <Text style={styles.authorName}>{content.full_name || content.username || 'Kitap Okuru'}</Text>
                <Text style={styles.username}>@{content.username || 'kitapokuru'}</Text>
              </View>
            </Pressable>

            {content.book_title ? (
              <Pressable
                disabled={!content.book_key}
                onPress={() =>
                  content.book_key
                    ? router.push({ pathname: '/book', params: { key: content.book_key, title: content.book_title ?? undefined } })
                    : undefined
                }
                style={styles.bookRow}
                accessibilityRole={content.book_key ? 'button' : undefined}
                accessibilityLabel={content.book_key ? 'Kitap detayını aç' : undefined}
              >
                <View style={styles.cover}><Feather name="book-open" size={24} color={colors.primary} /></View>
                <View style={styles.bookText}>
                  <Text style={styles.bookLabel}>KİTAP</Text>
                  <Text style={styles.bookTitle}>{content.book_title}</Text>
                  {content.rating ? <Text style={styles.rating}>{'★'.repeat(Math.max(0, Math.min(5, Math.round(content.rating))))}</Text> : null}
                </View>
              </Pressable>
            ) : null}

            {content.text ? <HashtagText text={content.text} style={styles.bodyText} /> : null}
            {content.image_url ? <Image source={{ uri: content.image_url }} style={styles.image} /> : null}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#262631',
  },
  backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#F5F5F8', fontSize: 18, fontWeight: '800' },
  headerSpacer: { width: 38 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  muted: { color: '#8E8E9D', fontSize: 14 },
  errorTitle: { color: '#F5F5F8', textAlign: 'center', fontSize: 16, fontWeight: '700', lineHeight: 23 },
  homeButton: { marginTop: 6, backgroundColor: '#21182F', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  homeButtonText: { color: '#A985FF', fontWeight: '800' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934', borderRadius: 18, padding: 16, gap: 16 },
  authorRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#211F2B' },
  avatarFallback: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#21182F' },
  authorText: { marginLeft: 12, flex: 1 },
  authorName: { color: '#F5F5F8', fontSize: 15, fontWeight: '800' },
  username: { color: '#8E8E9D', marginTop: 2, fontSize: 12 },
  bookRow: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, backgroundColor: '#101016' },
  cover: { width: 62, height: 92, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  bookText: { flex: 1, justifyContent: 'center' },
  bookLabel: { color: '#8E8E9D', fontSize: 10, fontWeight: '800' },
  bookTitle: { color: '#F5F5F8', marginTop: 5, fontSize: 15, fontWeight: '800' },
  rating: { color: '#A985FF', marginTop: 7, letterSpacing: 1 },
  bodyText: { color: '#F5F5F8', fontSize: 16, lineHeight: 23 },
  image: { width: '100%', aspectRatio: 1.2, borderRadius: 14, backgroundColor: '#211F2B' },
});
