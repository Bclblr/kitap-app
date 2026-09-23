import AcademicWorkCard from '@/components/AcademicWorkCard';
import { safeBack } from '@/lib/navigation';
import {
  AcademicAuthorSummary,
  AcademicInstitutionSummary,
  AcademicJournalSummary,
  AcademicWork,
  searchAcademicAuthors,
  searchAcademicInstitutions,
  searchAcademicJournals,
  searchAcademicWorks,
} from '@/lib/academic';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Tab = 'works' | 'authors' | 'journals' | 'institutions';

export default function AcademicSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('works');
  const [works, setWorks] = useState<AcademicWork[]>([]);
  const [authors, setAuthors] = useState<AcademicAuthorSummary[]>([]);
  const [journals, setJournals] = useState<AcademicJournalSummary[]>([]);
  const [institutions, setInstitutions] = useState<AcademicInstitutionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const requestRef = useRef(0);

  async function search(term = query) {
    const clean = term.trim();
    if (!clean) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setSearched(true);
    try {
      const [workRows, authorRows, journalRows, institutionRows] = await Promise.all([
        searchAcademicWorks(clean, 24),
        searchAcademicAuthors(clean, 24),
        searchAcademicJournals(clean, 24),
        searchAcademicInstitutions(clean, 24),
      ]);
      if (requestId !== requestRef.current) return;
      setWorks(workRows);
      setAuthors(authorRows);
      setJournals(journalRows);
      setInstitutions(institutionRows);
    } catch (error) {
      console.warn('Akademik arama başarısız:', error);
      if (requestId === requestRef.current) {
        setWorks([]);
        setAuthors([]);
        setJournals([]);
        setInstitutions([]);
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    const initial = typeof params.q === 'string' ? params.q.trim() : '';
    if (!initial) return;

    setQuery(initial);
    const requestId = ++requestRef.current;
    let active = true;
    const controller = new AbortController();

    const timer = setTimeout(() => {
      setLoading(true);
      setSearched(true);
      void Promise.all([
        searchAcademicWorks(initial, 24, controller.signal),
        searchAcademicAuthors(initial, 24, controller.signal),
        searchAcademicJournals(initial, 24, controller.signal),
        searchAcademicInstitutions(initial, 24, controller.signal),
      ])
        .then(([workRows, authorRows, journalRows, institutionRows]) => {
          if (!active || requestId !== requestRef.current) return;
          setWorks(workRows);
          setAuthors(authorRows);
          setJournals(journalRows);
          setInstitutions(institutionRows);
        })
        .catch((error) => {
          if ((error as Error)?.name === 'AbortError') return;
          console.warn('Akademik arama başarısız:', error);
          if (!active || requestId !== requestRef.current) return;
          setWorks([]);
          setAuthors([]);
          setJournals([]);
          setInstitutions([]);
        })
        .finally(() => {
          if (active && requestId === requestRef.current) setLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [params.q]);

  const counts: Record<Tab, number> = {
    works: works.length,
    authors: authors.length,
    journals: journals.length,
    institutions: institutions.length,
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable onPress={() => safeBack(router, '/explore')} style={styles.iconButton}>
            <Feather name="arrow-left" size={21} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Akademik Keşif</Text>
            <Text style={styles.subtitle}>Makaleler, akademisyenler, dergiler ve kurumlar</Text>
          </View>
          <Pressable onPress={() => router.push('/academic-library' as any)} style={styles.iconButton}>
            <Feather name="bookmark" size={20} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.searchShell}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void search()}
            returnKeyType="search"
            placeholder="Konu, makale, akademisyen veya dergi ara"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text }]}
          />
          <Pressable onPress={() => void search()} style={styles.searchButton}>
            <Text style={styles.searchButtonText}>Ara</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {([
            ['works', 'Makaleler'],
            ['authors', 'Akademisyenler'],
            ['journals', 'Dergiler'],
            ['institutions', 'Kurumlar'],
          ] as const).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.activeTab]}>
              <Text style={[styles.tabText, tab === key && styles.activeTabText]}>
                {label}{searched ? ` (${counts[key]})` : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Akademik kaynaklar taranıyor...</Text>
          </View>
        ) : null}

        {!loading && !searched ? (
          <View style={styles.hero}>
            <View style={styles.heroIcon}><Feather name="book-open" size={28} color={colors.primary} /></View>
            <Text style={styles.heroTitle}>Kitapların ötesine geç</Text>
            <Text style={styles.heroText}>OpenAlex ve Crossref verileriyle akademik yayınları, akademisyenleri ve dergileri keşfet.</Text>
          </View>
        ) : null}

        {!loading && searched && tab === 'works' ? (
          works.length ? works.map((work) => (
            <AcademicWorkCard key={work.id} work={work} onPress={() => router.push({ pathname: '/academic-work' as any, params: { id: work.id } })} />
          )) : <Text style={styles.empty}>Makale bulunamadı.</Text>
        ) : null}

        {!loading && searched && tab === 'authors' ? (
          authors.length ? authors.map((author) => (
            <Pressable key={author.id} onPress={() => router.push({ pathname: '/academic-author' as any, params: { id: author.id } })} style={styles.resultCard}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{author.name.charAt(0).toUpperCase()}</Text></View>
              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle}>{author.name}</Text>
                <Text style={styles.resultMeta}>{author.institutionName || 'Kurum bilgisi yok'}</Text>
                <Text style={styles.resultMeta}>{author.worksCount} çalışma · {author.citedByCount} atıf</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          )) : <Text style={styles.empty}>Akademisyen bulunamadı.</Text>
        ) : null}

        {!loading && searched && tab === 'journals' ? (
          journals.length ? journals.map((journal) => (
            <Pressable key={journal.id} onPress={() => router.push({ pathname: '/journal' as any, params: { id: journal.id } })} style={styles.resultCard}>
              <View style={styles.squareIcon}><Feather name="layers" size={18} color={colors.primary} /></View>
              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle}>{journal.name}</Text>
                <Text style={styles.resultMeta}>{journal.publisher || 'Yayıncı bilgisi yok'}</Text>
                <Text style={styles.resultMeta}>{journal.worksCount} çalışma · {journal.citedByCount} atıf</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          )) : <Text style={styles.empty}>Dergi bulunamadı.</Text>
        ) : null}

        {!loading && searched && tab === 'institutions' ? (
          institutions.length ? institutions.map((institution) => (
            <Pressable key={institution.id} onPress={() => router.push({ pathname: '/academic-institution' as any, params: { id: institution.id } })} style={styles.resultCard}>
              <View style={styles.squareIcon}><Feather name="briefcase" size={18} color={colors.primary} /></View>
              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle}>{institution.name}</Text>
                <Text style={styles.resultMeta}>{[institution.city, institution.countryCode].filter(Boolean).join(' · ') || 'Konum bilgisi yok'}</Text>
                <Text style={styles.resultMeta}>{institution.worksCount} çalışma · {institution.citedByCount} atıf</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          )) : <Text style={styles.empty}>Kurum bulunamadı.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090D' },
  content: { padding: 16, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  iconButton: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: '#2A2B34', backgroundColor: '#111218', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: '#F4F4F6', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#858791', fontSize: 11, marginTop: 3 },
  searchShell: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, borderWidth: 1, borderColor: '#30313A', backgroundColor: '#111218', paddingLeft: 13, paddingRight: 6, minHeight: 52 },
  input: { flex: 1, minWidth: 0, fontSize: 13 },
  searchButton: { height: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#6232B5', justifyContent: 'center' },
  searchButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  tabs: { gap: 8, paddingVertical: 14 },
  tab: { minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: '#2D2E36', backgroundColor: '#111218', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  activeTab: { borderColor: '#6232B5', backgroundColor: '#24183A' },
  tabText: { color: '#8E909A', fontSize: 11, fontWeight: '800' },
  activeTabText: { color: '#D8C8FF' },
  loadingBox: { alignItems: 'center', paddingVertical: 30, gap: 10 },
  loadingText: { color: '#858791', fontSize: 11 },
  hero: { marginTop: 12, borderRadius: 20, borderWidth: 1, borderColor: '#34284F', backgroundColor: '#111018', padding: 22, alignItems: 'center' },
  heroIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#261B39', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitle: { color: '#F2F2F5', fontSize: 18, fontWeight: '900' },
  heroText: { color: '#858791', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#2A2B34', backgroundColor: '#111218', padding: 14, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2E2045', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#E7DBFF', fontWeight: '900', fontSize: 17 },
  squareIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#241B36', alignItems: 'center', justifyContent: 'center' },
  resultCopy: { flex: 1, minWidth: 0 },
  resultTitle: { color: '#F1F1F4', fontSize: 14, fontWeight: '800' },
  resultMeta: { color: '#7E808A', fontSize: 10.5, marginTop: 4 },
  empty: { color: '#777983', textAlign: 'center', paddingVertical: 30, fontSize: 12 },
});
