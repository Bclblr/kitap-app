import AcademicWorkCard from '@/components/AcademicWorkCard';
import { getAcademicAuthor, getAuthorWorks, AcademicAuthorSummary, AcademicWork } from '@/lib/academic';
import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AcademicAuthorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [author, setAuthor] = useState<AcademicAuthorSummary | null>(null);
  const [works, setWorks] = useState<AcademicWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    const authorId = typeof id === 'string' ? id : '';
    if (!authorId) return;
    let active = true;
    const controller = new AbortController();

    async function load() {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      try {
        const [loadedAuthor, loadedWorks] = await Promise.all([
          getAcademicAuthor(authorId, controller.signal),
          getAuthorWorks(authorId, 30, controller.signal),
        ]);
        if (!active || !loadedAuthor) return;
        setAuthor(loadedAuthor);
        setWorks(loadedWorks);

        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user) return;

        const db = supabase as any;
        const { data: followData } = await db
          .from('followed_academic_entities')
          .select('entity_openalex_id')
          .eq('user_id', user.id)
          .eq('entity_type', 'author')
          .eq('entity_openalex_id', loadedAuthor.id)
          .maybeSingle();
        if (active) setFollowing(!!followData);
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') console.warn('Akademisyen yüklenemedi:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [id]);

  async function toggleFollow() {
    if (!author) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return Alert.alert('Giriş gerekli', 'Akademisyeni takip etmek için giriş yapmalısın.');
    const db = supabase as any;
    if (following) {
      const { error } = await db.from('followed_academic_entities').delete()
        .eq('user_id', data.user.id).eq('entity_type', 'author').eq('entity_openalex_id', author.id);
      if (error) return Alert.alert('Hata', error.message);
      setFollowing(false);
    } else {
      const { error } = await db.from('followed_academic_entities').upsert({
        user_id: data.user.id,
        entity_type: 'author',
        entity_openalex_id: author.id,
        display_name: author.name,
      }, { onConflict: 'user_id,entity_type,entity_openalex_id' });
      if (error) return Alert.alert('Hata', error.message);
      setFollowing(true);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Akademisyen yükleniyor...</Text></View>;
  if (!author) return <View style={styles.center}><Text style={styles.errorTitle}>Akademisyen bulunamadı</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={() => safeBack(router, '/academic-search' as any)} style={styles.iconButton}><Feather name="arrow-left" size={21} color={colors.text} /></Pressable>
          <Text style={styles.pageTitle}>Akademisyen</Text>
          <Pressable onPress={() => void toggleFollow()} style={[styles.followButton, following && styles.followingButton]}>
            <Feather name={following ? 'check' : 'plus'} size={15} color={following ? colors.primary : '#FFF'} />
            <Text style={[styles.followText, following && styles.followingText]}>{following ? 'Takipte' : 'Takip Et'}</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{author.name.charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.title}>{author.name}</Text>
          <Text style={styles.institution}>{author.institutionName || 'Kurum bilgisi bulunamadı'}</Text>
          <View style={styles.metrics}>
            <View style={styles.metric}><Text style={styles.metricValue}>{author.worksCount}</Text><Text style={styles.metricLabel}>Yayın</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{author.citedByCount}</Text><Text style={styles.metricLabel}>Atıf</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{author.topics.length}</Text><Text style={styles.metricLabel}>Alan</Text></View>
          </View>
          {author.orcid ? (
            <Pressable onPress={() => void Linking.openURL(`https://orcid.org/${author.orcid}`)} style={styles.orcidButton}>
              <Feather name="external-link" size={14} color={colors.primary} /><Text style={styles.orcidText}>ORCID {author.orcid}</Text>
            </Pressable>
          ) : null}
          {author.institutionId ? (
            <Pressable onPress={() => router.push({ pathname: '/academic-institution' as any, params: { id: author.institutionId } })} style={styles.institutionButton}>
              <Feather name="briefcase" size={14} color={colors.primary} /><Text style={styles.institutionButtonText}>Kurum sayfasını aç</Text>
            </Pressable>
          ) : null}
        </View>

        {author.topics.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Çalışma Alanları</Text>
            <View style={styles.topicWrap}>{author.topics.map((topic) => <View key={topic} style={styles.topic}><Text style={styles.topicText}>{topic}</Text></View>)}</View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yayınlar</Text>
          {works.length ? works.map((work) => <AcademicWorkCard key={work.id} work={work} onPress={() => router.push({ pathname: '/academic-work' as any, params: { id: work.id } })} />) : <Text style={styles.empty}>Yayın bulunamadı.</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090D' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#08090D', gap: 10 },
  loadingText: { color: '#858791', fontSize: 12 },
  errorTitle: { color: '#F2F2F5', fontSize: 18, fontWeight: '900' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  iconButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#111218', borderWidth: 1, borderColor: '#2A2B34', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, color: '#F2F2F5', fontSize: 16, fontWeight: '900' },
  followButton: { minHeight: 40, borderRadius: 12, backgroundColor: '#6232B5', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 5 },
  followingButton: { backgroundColor: '#211733', borderWidth: 1, borderColor: '#6232B5' },
  followText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  followingText: { color: '#D8C8FF' },
  hero: { borderRadius: 20, borderWidth: 1, borderColor: '#34284F', backgroundColor: '#111018', padding: 20, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2B1D42', borderWidth: 1, borderColor: '#5B3A86', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#E5D8FF', fontSize: 28, fontWeight: '900' },
  title: { color: '#F5F5F7', fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 13 },
  institution: { color: '#8E909A', fontSize: 11, textAlign: 'center', marginTop: 6 },
  metrics: { flexDirection: 'row', width: '100%', gap: 8, marginTop: 16 },
  metric: { flex: 1, borderRadius: 13, backgroundColor: '#171820', borderWidth: 1, borderColor: '#292A33', padding: 10, alignItems: 'center' },
  metricValue: { color: '#F1F1F4', fontSize: 16, fontWeight: '900' },
  metricLabel: { color: '#747680', fontSize: 9, marginTop: 3 },
  orcidButton: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  orcidText: { color: '#BCA2F6', fontSize: 11, fontWeight: '800' },
  institutionButton: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  institutionButtonText: { color: '#BCA2F6', fontSize: 11, fontWeight: '800' },
  section: { marginTop: 20 },
  sectionTitle: { color: '#F0F0F3', fontSize: 15, fontWeight: '900', marginBottom: 11 },
  topicWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  topic: { borderRadius: 999, borderWidth: 1, borderColor: '#3A2A54', backgroundColor: '#1C1528', paddingHorizontal: 10, paddingVertical: 7 },
  topicText: { color: '#C6B3F1', fontSize: 10, fontWeight: '800' },
  empty: { color: '#777983', fontSize: 11, textAlign: 'center', paddingVertical: 20 },
});
