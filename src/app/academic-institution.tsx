import { AcademicAuthorSummary, AcademicInstitutionSummary, getAcademicInstitution, getInstitutionAuthors } from '@/lib/academic';
import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AcademicInstitutionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [institution, setInstitution] = useState<AcademicInstitutionSummary | null>(null);
  const [authors, setAuthors] = useState<AcademicAuthorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    const institutionId = typeof id === 'string' ? id : '';
    if (!institutionId) {
      setLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const [loadedInstitution, loadedAuthors] = await Promise.all([
          getAcademicInstitution(institutionId, controller.signal),
          getInstitutionAuthors(institutionId, 30, controller.signal),
        ]);
        if (!active || !loadedInstitution) return;
        setInstitution(loadedInstitution);
        setAuthors(loadedAuthors);

        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user) return;

        const db = supabase as any;
        await db.from('academic_institutions').upsert({
          openalex_id: loadedInstitution.id,
          name: loadedInstitution.name,
          country_code: loadedInstitution.countryCode,
          city: loadedInstitution.city,
          institution_type: loadedInstitution.type,
          homepage_url: loadedInstitution.homepageUrl,
          works_count: loadedInstitution.worksCount,
          cited_by_count: loadedInstitution.citedByCount,
          metadata: {},
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'openalex_id' });

        const { data: followData } = await db
          .from('followed_academic_entities')
          .select('entity_openalex_id')
          .eq('user_id', user.id)
          .eq('entity_type', 'institution')
          .eq('entity_openalex_id', loadedInstitution.id)
          .maybeSingle();
        if (active) setFollowing(!!followData);
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') console.warn('Kurum yüklenemedi:', error);
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
    if (!institution) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return Alert.alert('Giriş gerekli', 'Kurumu takip etmek için giriş yapmalısın.');
    const db = supabase as any;

    if (following) {
      const { error } = await db.from('followed_academic_entities').delete()
        .eq('user_id', data.user.id).eq('entity_type', 'institution').eq('entity_openalex_id', institution.id);
      if (error) return Alert.alert('Hata', error.message);
      setFollowing(false);
    } else {
      const { error } = await db.from('followed_academic_entities').upsert({
        user_id: data.user.id,
        entity_type: 'institution',
        entity_openalex_id: institution.id,
        display_name: institution.name,
      }, { onConflict: 'user_id,entity_type,entity_openalex_id' });
      if (error) return Alert.alert('Hata', error.message);
      setFollowing(true);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Kurum yükleniyor...</Text></View>;
  if (!institution) return <View style={styles.center}><Text style={styles.errorTitle}>Kurum bulunamadı</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={() => safeBack(router, '/academic-search')} style={styles.iconButton}><Feather name="arrow-left" size={21} color={colors.text} /></Pressable>
          <Text style={styles.pageTitle}>Akademik Kurum</Text>
          <Pressable onPress={() => void toggleFollow()} style={[styles.followButton, following && styles.followingButton]}>
            <Feather name={following ? 'check' : 'plus'} size={15} color={following ? colors.primary : '#FFF'} />
            <Text style={[styles.followText, following && styles.followingText]}>{following ? 'Takipte' : 'Takip Et'}</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}><Feather name="briefcase" size={25} color={colors.primary} /></View>
          <Text style={styles.title}>{institution.name}</Text>
          <Text style={styles.location}>{[institution.city, institution.countryCode].filter(Boolean).join(' · ') || 'Konum bilgisi yok'}</Text>
          <View style={styles.metrics}>
            <View style={styles.metric}><Text style={styles.metricValue}>{institution.worksCount}</Text><Text style={styles.metricLabel}>Çalışma</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{institution.citedByCount}</Text><Text style={styles.metricLabel}>Atıf</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{institution.type || '—'}</Text><Text style={styles.metricLabel}>Tür</Text></View>
          </View>
          {institution.homepageUrl ? (
            <Pressable onPress={() => void Linking.openURL(institution.homepageUrl!)} style={styles.homepageButton}>
              <Feather name="external-link" size={14} color={colors.primary} /><Text style={styles.homepageText}>Kurum sitesini aç</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Öne Çıkan Akademisyenler</Text>
          {authors.length ? authors.map((author) => (
            <Pressable key={author.id} onPress={() => router.push({ pathname: '/academic-author', params: { id: author.id } })} style={styles.authorCard}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{author.name.charAt(0).toUpperCase()}</Text></View>
              <View style={styles.authorCopy}>
                <Text style={styles.authorName}>{author.name}</Text>
                <Text style={styles.authorMeta}>{author.worksCount} yayın · {author.citedByCount} atıf</Text>
                {author.topics[0] ? <Text style={styles.authorTopic}>{author.topics.slice(0, 2).join(' · ')}</Text> : null}
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          )) : <Text style={styles.empty}>Akademisyen bulunamadı.</Text>}
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
  heroIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#241B36', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#F5F5F7', fontSize: 21, lineHeight: 28, fontWeight: '900', textAlign: 'center', marginTop: 13 },
  location: { color: '#8E909A', fontSize: 11, textAlign: 'center', marginTop: 6 },
  metrics: { flexDirection: 'row', width: '100%', gap: 8, marginTop: 16 },
  metric: { flex: 1, borderRadius: 13, backgroundColor: '#171820', borderWidth: 1, borderColor: '#292A33', padding: 10, alignItems: 'center' },
  metricValue: { color: '#F1F1F4', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  metricLabel: { color: '#747680', fontSize: 9, marginTop: 3 },
  homepageButton: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  homepageText: { color: '#BCA2F6', fontSize: 11, fontWeight: '800' },
  section: { marginTop: 20 },
  sectionTitle: { color: '#F0F0F3', fontSize: 15, fontWeight: '900', marginBottom: 11 },
  authorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#2A2B34', backgroundColor: '#111218', padding: 13, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2B1D42', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#E5D8FF', fontSize: 17, fontWeight: '900' },
  authorCopy: { flex: 1, minWidth: 0 },
  authorName: { color: '#F1F1F4', fontSize: 13, fontWeight: '800' },
  authorMeta: { color: '#7F818B', fontSize: 10, marginTop: 4 },
  authorTopic: { color: '#9E8BC7', fontSize: 9.5, marginTop: 4 },
  empty: { color: '#777983', fontSize: 11, textAlign: 'center', paddingVertical: 20 },
});
