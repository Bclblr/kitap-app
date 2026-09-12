import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type WorkStatus = 'all' | 'draft' | 'published';

type AdminWork = {
  id: string;
  author_id: string;
  author_username: string;
  title: string;
  description: string;
  cover_url: string | null;
  genre: string;
  tags: string[];
  status: 'draft' | 'published';
  language: string;
  audience: string;
  completed: boolean;
  chapter_count: number;
  published_chapter_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

const FILTERS: { key: WorkStatus; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'published', label: 'Yayında' },
  { key: 'draft', label: 'Taslak' },
];

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('tr-TR');
}

export default function AdminBooksScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();

  const [rows, setRows] = useState<AdminWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<WorkStatus>('all');

  const loadWorks = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (!access.canManageSystem) {
        router.replace('/admin');
        return;
      }

      const { data, error } = await supabase.rpc('admin_list_works', {
        p_search: search.trim(),
        p_status: status,
        p_limit: 100,
      });

      if (error) {
        console.error('Admin kitap yükleme hatası:', error);
        Alert.alert('Hata', error.message || 'Kitaplar yüklenemedi.');
        setRows([]);
        return;
      }

      const nextRows = (Array.isArray(data) ? data : []).map((row: any) => ({
        ...row,
        chapter_count: Number(row.chapter_count) || 0,
        published_chapter_count: Number(row.published_chapter_count) || 0,
        tags: Array.isArray(row.tags) ? row.tags : [],
        completed: row.completed === true,
      })) as AdminWork[];

      setRows(nextRows);
    } finally {
      setLoading(false);
    }
  }, [router, search, status]);

  useFocusEffect(
    useCallback(() => {
      void loadWorks();
    }, [loadWorks])
  );

  const counts = useMemo(() => ({
    all: rows.length,
    published: rows.filter((item) => item.status === 'published').length,
    draft: rows.filter((item) => item.status === 'draft').length,
  }), [rows]);

  const updateState = useCallback(async (item: AdminWork, nextStatus: 'draft' | 'published', nextCompleted: boolean) => {
    setSavingId(item.id);
    try {
      const { error } = await supabase.rpc('admin_update_work_state', {
        p_work_id: item.id,
        p_status: nextStatus,
        p_completed: nextCompleted,
      });

      if (error) {
        console.error('Kitap durumu güncellenemedi:', error);
        Alert.alert('Güncellenemedi', error.message || 'İşlem tamamlanamadı.');
        return;
      }

      setRows((current) => current.map((row) =>
        row.id === item.id
          ? { ...row, status: nextStatus, completed: nextCompleted, updated_at: new Date().toISOString() }
          : row
      ));
    } finally {
      setSavingId(null);
    }
  }, []);

  const askPublishToggle = useCallback((item: AdminWork) => {
    const nextStatus = item.status === 'published' ? 'draft' : 'published';
    Alert.alert(
      nextStatus === 'published' ? 'Kitabı yayınla' : 'Kitabı taslağa al',
      nextStatus === 'published'
        ? 'Bu eser okuyuculara açık hale gelecek. Devam edilsin mi?'
        : 'Bu eser yayından kaldırılıp taslak durumuna alınacak. Devam edilsin mi?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Devam et', onPress: () => void updateState(item, nextStatus, item.completed) },
      ]
    );
  }, [updateState]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Feather name="chevron-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>YÖNETİM</Text>
          <Text style={styles.title}>Kitaplar / Eserler</Text>
        </View>
        <Pressable onPress={() => void loadWorks()} style={styles.headerButton}>
          <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.searchShell}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void loadWorks()}
          placeholder="Kitap, yazar veya tür ara"
          placeholderTextColor="#666676"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')}>
            <Feather name="x" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((filter) => {
          const active = filter.key === status;
          return (
            <Pressable
              key={filter.key}
              onPress={() => setStatus(filter.key)}
              style={[styles.filterButton, active && styles.filterButtonActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {filter.label}{filter.key === 'all' ? '' : ` · ${counts[filter.key]}`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Kitaplar yükleniyor...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.resultText}>{rows.length} eser gösteriliyor</Text>

          {rows.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="book-open" size={28} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Eser bulunamadı</Text>
              <Text style={styles.emptyText}>Bu filtrede gösterilecek bir eser yok.</Text>
            </View>
          ) : rows.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.bookIcon}>
                  <Feather name="book" size={19} color={colors.primary} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.bookTitle}>{item.title}</Text>
                  <Text style={styles.author}>@{item.author_username || 'kitapokuru'}</Text>
                </View>
                <View style={[styles.statusBadge, item.status === 'published' ? styles.publishedBadge : styles.draftBadge]}>
                  <Text style={styles.statusText}>{item.status === 'published' ? 'YAYINDA' : 'TASLAK'}</Text>
                </View>
              </View>

              {item.description ? (
                <Text style={styles.description} numberOfLines={4}>{item.description}</Text>
              ) : null}

              <View style={styles.metaGrid}>
                <Text style={styles.metaText}>Tür: {item.genre || '—'}</Text>
                <Text style={styles.metaText}>Dil: {item.language || '—'}</Text>
                <Text style={styles.metaText}>Hedef: {item.audience || '—'}</Text>
                <Text style={styles.metaText}>Bölüm: {item.published_chapter_count}/{item.chapter_count}</Text>
              </View>

              {item.tags?.length ? (
                <Text style={styles.tags} numberOfLines={2}>{item.tags.map((tag) => `#${tag}`).join('  ')}</Text>
              ) : null}

              <Text style={styles.dateText}>Güncelleme: {formatDate(item.updated_at)}</Text>

              <View style={styles.actions}>
                <Pressable
                  disabled={savingId === item.id}
                  onPress={() => askPublishToggle(item)}
                  style={styles.actionButton}
                >
                  <Feather name={item.status === 'published' ? 'eye-off' : 'upload'} size={15} color={colors.primary} />
                  <Text style={styles.actionText}>{item.status === 'published' ? 'Taslağa Al' : 'Yayınla'}</Text>
                </Pressable>

                <Pressable
                  disabled={savingId === item.id}
                  onPress={() => void updateState(item, item.status, !item.completed)}
                  style={styles.actionButton}
                >
                  <Feather name={item.completed ? 'check-circle' : 'circle'} size={15} color={item.completed ? '#8ED0A3' : colors.primary} />
                  <Text style={styles.actionText}>{item.completed ? 'Tamamlandı' : 'Devam Ediyor'}</Text>
                </Pressable>
              </View>

              <Text style={styles.idText}>ID: {item.id}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E', paddingTop: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 12 },
  headerButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  headerCopy: { flex: 1, marginHorizontal: 14 },
  eyebrow: { color: '#A985FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 2, color: '#F5F5F8', fontSize: 24, fontWeight: '900' },
  searchShell: { marginHorizontal: 18, height: 46, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  searchInput: { flex: 1, color: '#F5F5F8', fontSize: 14 },
  filters: { paddingHorizontal: 18, gap: 8, paddingVertical: 12 },
  filterButton: { height: 36, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 11, backgroundColor: '#14141B', borderWidth: 1, borderColor: '#292934' },
  filterButtonActive: { backgroundColor: '#2B1F3C', borderColor: '#654A8C' },
  filterText: { color: '#8E8E9D', fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#F5F5F8' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, color: '#8E8E9D', fontSize: 13 },
  listContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 48 },
  resultText: { color: '#777786', fontSize: 12, marginBottom: 10 },
  card: { backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934', borderRadius: 17, padding: 15, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  bookIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#21182F' },
  cardCopy: { flex: 1 },
  bookTitle: { color: '#F5F5F8', fontSize: 15, fontWeight: '800' },
  author: { color: '#8E8E9D', fontSize: 12, marginTop: 3 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9 },
  publishedBadge: { backgroundColor: '#173020' },
  draftBadge: { backgroundColor: '#31251A' },
  statusText: { color: '#DADAE3', fontSize: 9, fontWeight: '900' },
  description: { color: '#D2D2DB', fontSize: 13, lineHeight: 19, marginTop: 13 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metaText: { color: '#8B8B99', fontSize: 11, backgroundColor: '#101015', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  tags: { color: '#BFA9F4', fontSize: 11, marginTop: 11, lineHeight: 17 },
  dateText: { color: '#696978', fontSize: 10, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 13 },
  actionButton: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#3A3150', backgroundColor: '#1B1722', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  actionText: { color: '#E7E0F8', fontSize: 12, fontWeight: '800' },
  idText: { color: '#5F5F6B', fontSize: 9, marginTop: 10 },
  emptyCard: { marginTop: 60, alignItems: 'center', padding: 28, backgroundColor: '#15151D', borderRadius: 18, borderWidth: 1, borderColor: '#292934' },
  emptyTitle: { marginTop: 12, color: '#F5F5F8', fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 6, color: '#7E7E8B', fontSize: 13, textAlign: 'center' },
});
