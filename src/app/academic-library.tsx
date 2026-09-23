import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type SavedWork = {
  work_openalex_id: string;
  title: string;
  author_summary: string | null;
  journal_name: string | null;
  publication_year: number | null;
  created_at: string;
};

type StatusWork = {
  work_openalex_id: string;
  title: string;
  author_summary: string | null;
  journal_name: string | null;
  publication_year: number | null;
  status: 'want' | 'reading' | 'read';
  updated_at: string;
};

type FollowedEntity = {
  entity_type: 'author' | 'journal' | 'institution';
  entity_openalex_id: string;
  display_name: string;
  created_at: string;
};

type Tab = 'saved' | 'want' | 'reading' | 'read' | 'following';

export default function AcademicLibraryScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<Tab>('saved');
  const [saved, setSaved] = useState<SavedWork[]>([]);
  const [statuses, setStatuses] = useState<StatusWork[]>([]);
  const [following, setFollowing] = useState<FollowedEntity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        setSaved([]);
        setStatuses([]);
        setFollowing([]);
        return;
      }

      const db = supabase as any;
      const [savedResult, statusResult, followResult] = await Promise.all([
        db.from('saved_academic_works')
          .select('work_openalex_id,title,author_summary,journal_name,publication_year,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        db.from('academic_reading_status')
          .select('work_openalex_id,title,author_summary,journal_name,publication_year,status,updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false }),
        db.from('followed_academic_entities')
          .select('entity_type,entity_openalex_id,display_name,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      setSaved((savedResult.data ?? []) as SavedWork[]);
      setStatuses((statusResult.data ?? []) as StatusWork[]);
      setFollowing((followResult.data ?? []) as FollowedEntity[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const statusRows = statuses.filter((item) => item.status === tab);
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'saved', label: 'Kaydedilenler', count: saved.length },
    { key: 'want', label: 'Okuyacağım', count: statuses.filter((item) => item.status === 'want').length },
    { key: 'reading', label: 'Okuyorum', count: statuses.filter((item) => item.status === 'reading').length },
    { key: 'read', label: 'Okudum', count: statuses.filter((item) => item.status === 'read').length },
    { key: 'following', label: 'Takip', count: following.length },
  ];

  function openEntity(item: FollowedEntity) {
    if (item.entity_type === 'author') {
      router.push({ pathname: '/academic-author' as any, params: { id: item.entity_openalex_id } });
    } else if (item.entity_type === 'journal') {
      router.push({ pathname: '/journal' as any, params: { id: item.entity_openalex_id } });
    } else {
      router.push({ pathname: '/academic-institution' as any, params: { id: item.entity_openalex_id } });
    }
  }

  const renderWork = (item: SavedWork | StatusWork) => (
    <Pressable key={item.work_openalex_id} onPress={() => router.push({ pathname: '/academic-work' as any, params: { id: item.work_openalex_id } })} style={styles.card}>
      <View style={styles.cardIcon}><Feather name="file-text" size={17} color={colors.primary} /></View>
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{item.author_summary || 'Yazar bilgisi yok'}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{[item.publication_year, item.journal_name].filter(Boolean).join(' · ')}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={() => safeBack(router, '/academic-search' as any)} style={styles.iconButton}><Feather name="arrow-left" size={21} color={colors.text} /></Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Akademik Kitaplığım</Text>
            <Text style={styles.subtitle}>Kaydettiğin ve takip ettiğin akademik içerikler</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((item) => (
            <Pressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && styles.activeTab]}>
              <Text style={[styles.tabText, tab === item.key && styles.activeTabText]}>{item.label} ({item.count})</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View> : null}

        {!loading && tab === 'saved' ? (saved.length ? saved.map(renderWork) : <Text style={styles.empty}>Henüz kaydedilmiş makale yok.</Text>) : null}
        {!loading && (tab === 'want' || tab === 'reading' || tab === 'read') ? (statusRows.length ? statusRows.map(renderWork) : <Text style={styles.empty}>Bu rafta henüz makale yok.</Text>) : null}
        {!loading && tab === 'following' ? (
          following.length ? following.map((item) => (
            <Pressable key={`${item.entity_type}:${item.entity_openalex_id}`} onPress={() => openEntity(item)} style={styles.card}>
              <View style={styles.cardIcon}><Feather name={item.entity_type === 'author' ? 'user' : item.entity_type === 'journal' ? 'layers' : 'briefcase'} size={17} color={colors.primary} /></View>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{item.display_name}</Text>
                <Text style={styles.cardMeta}>{item.entity_type === 'author' ? 'Akademisyen' : item.entity_type === 'journal' ? 'Dergi' : 'Kurum'}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          )) : <Text style={styles.empty}>Henüz takip ettiğin akademik profil yok.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090D' },
  content: { padding: 16, paddingBottom: 48 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconButton: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: '#2A2B34', backgroundColor: '#111218', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: '#F4F4F6', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#858791', fontSize: 11, marginTop: 3 },
  tabs: { gap: 8, paddingVertical: 12, marginBottom: 5 },
  tab: { minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: '#2D2E36', backgroundColor: '#111218', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  activeTab: { borderColor: '#6232B5', backgroundColor: '#24183A' },
  tabText: { color: '#8E909A', fontSize: 10.5, fontWeight: '800' },
  activeTabText: { color: '#D8C8FF' },
  loading: { paddingVertical: 30 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: '#2A2B34', backgroundColor: '#111218', padding: 13, marginBottom: 9 },
  cardIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#241B36', alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: '#F1F1F4', fontSize: 13, fontWeight: '800' },
  cardMeta: { color: '#7F818B', fontSize: 10, marginTop: 4 },
  empty: { color: '#777983', fontSize: 11, textAlign: 'center', paddingVertical: 30 },
});
