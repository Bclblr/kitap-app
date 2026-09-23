import AcademicWorkCard from '@/components/AcademicWorkCard';
import { AcademicJournalSummary, AcademicWork, getAcademicJournal, getJournalWorks } from '@/lib/academic';
import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function JournalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [journal, setJournal] = useState<AcademicJournalSummary | null>(null);
  const [works, setWorks] = useState<AcademicWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    const journalId = typeof id === 'string' ? id : '';
    if (!journalId) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      try {
        const [loadedJournal, loadedWorks] = await Promise.all([
          getAcademicJournal(journalId, controller.signal),
          getJournalWorks(journalId, 30, controller.signal),
        ]);
        if (!active || !loadedJournal) return;
        setJournal(loadedJournal);
        setWorks(loadedWorks);

        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user) return;

        const db = supabase as any;
        const { data: followData } = await db
          .from('followed_academic_entities')
          .select('entity_openalex_id')
          .eq('user_id', user.id)
          .eq('entity_type', 'journal')
          .eq('entity_openalex_id', loadedJournal.id)
          .maybeSingle();
        if (active) setFollowing(!!followData);
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') console.warn('Dergi yüklenemedi:', error);
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
    if (!journal) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return Alert.alert('Giriş gerekli', 'Dergiyi takip etmek için giriş yapmalısın.');

    const db = supabase as any;
    if (following) {
      const { error } = await db.from('followed_academic_entities').delete()
        .eq('user_id', data.user.id).eq('entity_type', 'journal').eq('entity_openalex_id', journal.id);
      if (error) return Alert.alert('Hata', error.message);
      setFollowing(false);
    } else {
      const { error } = await db.from('followed_academic_entities').upsert({
        user_id: data.user.id,
        entity_type: 'journal',
        entity_openalex_id: journal.id,
        display_name: journal.name,
      }, { onConflict: 'user_id,entity_type,entity_openalex_id' });
      if (error) return Alert.alert('Hata', error.message);
      setFollowing(true);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Dergi yükleniyor...</Text></View>;
  if (!journal) return <View style={styles.center}><Text style={styles.errorTitle}>Dergi bulunamadı</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={() => safeBack(router, '/academic-search' as any)} style={styles.iconButton}><Feather name="arrow-left" size={21} color={colors.text} /></Pressable>
          <Text style={styles.pageTitle}>Dergi</Text>
          <Pressable onPress={() => void toggleFollow()} style={[styles.followButton, following && styles.followingButton]}>
            <Feather name={following ? 'check' : 'plus'} size={15} color={following ? colors.primary : '#FFF'} />
            <Text style={[styles.followText, following && styles.followingText]}>{following ? 'Takipte' : 'Takip Et'}</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}><Feather name="layers" size={26} color={colors.primary} /></View>
          <Text style={styles.title}>{journal.name}</Text>
          <Text style={styles.publisher}>{journal.publisher || 'Yayıncı bilgisi bulunamadı'}</Text>
          <View style={styles.metrics}>
            <View style={styles.metric}><Text style={styles.metricValue}>{journal.worksCount}</Text><Text style={styles.metricLabel}>Çalışma</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{journal.citedByCount}</Text><Text style={styles.metricLabel}>Atıf</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{journal.issnL || '—'}</Text><Text style={styles.metricLabel}>ISSN-L</Text></View>
          </View>
          {journal.issn.length ? <Text style={styles.info}>ISSN: {journal.issn.join(', ')}</Text> : null}
          {journal.countryCode ? <Text style={styles.info}>Ülke: {journal.countryCode}</Text> : null}
          {journal.homepageUrl ? (
            <Pressable onPress={() => void Linking.openURL(journal.homepageUrl!)} style={styles.homepageButton}>
              <Feather name="external-link" size={14} color={colors.primary} /><Text style={styles.homepageText}>Dergi sitesini aç</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Son Makaleler</Text>
          {works.length ? works.map((work) => <AcademicWorkCard key={work.id} work={work} onPress={() => router.push({ pathname: '/academic-work' as any, params: { id: work.id } })} />) : <Text style={styles.empty}>Makale bulunamadı.</Text>}
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
  publisher: { color: '#8E909A', fontSize: 11, textAlign: 'center', marginTop: 6 },
  metrics: { flexDirection: 'row', width: '100%', gap: 8, marginTop: 16 },
  metric: { flex: 1, borderRadius: 13, backgroundColor: '#171820', borderWidth: 1, borderColor: '#292A33', padding: 10, alignItems: 'center' },
  metricValue: { color: '#F1F1F4', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  metricLabel: { color: '#747680', fontSize: 9, marginTop: 3 },
  info: { color: '#81838D', fontSize: 10.5, marginTop: 8 },
  homepageButton: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  homepageText: { color: '#BCA2F6', fontSize: 11, fontWeight: '800' },
  section: { marginTop: 20 },
  sectionTitle: { color: '#F0F0F3', fontSize: 15, fontWeight: '900', marginBottom: 11 },
  empty: { color: '#777983', fontSize: 11, textAlign: 'center', paddingVertical: 20 },
});
