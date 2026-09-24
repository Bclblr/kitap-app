import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import BookCover from '@/components/BookCover';
import WorksList from '@/components/WorksList';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type Section = 'mine' | 'discover';
type MineFilter = 'all' | 'draft' | 'published';

type OwnWork = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  cover_url: string | null;
  genre: string;
  tags: string[];
  language: string;
  audience: string;
  completed: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  chapterCount: number;
  publishedChapterCount: number;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function MyWorks() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [section, setSection] = useState<Section>('mine');
  const [mineFilter, setMineFilter] = useState<MineFilter>('all');
  const [works, setWorks] = useState<OwnWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [sort, setSort] = useState<'new' | 'popular'>('new');

  const loadMine = useCallback(async () => {
    if (!userId) {
      setWorks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: workRows, error: workError } = await supabase
        .from('works')
        .select('*')
        .eq('author_id', userId)
        .order('updated_at', { ascending: false });

      if (workError) throw workError;

      const ids = (workRows ?? []).map((item) => item.id);
      let chapterRows: { work_id: string; status: string }[] = [];

      if (ids.length) {
        const { data, error } = await supabase
          .from('work_chapters')
          .select('work_id,status')
          .in('work_id', ids);
        if (error) throw error;
        chapterRows = data ?? [];
      }

      const counts = new Map<string, { all: number; published: number }>();
      chapterRows.forEach((chapter) => {
        const current = counts.get(chapter.work_id) ?? { all: 0, published: 0 };
        current.all += 1;
        if (chapter.status === 'published') current.published += 1;
        counts.set(chapter.work_id, current);
      });

      setWorks(
        (workRows ?? []).map((work) => ({
          ...work,
          chapterCount: counts.get(work.id)?.all ?? 0,
          publishedChapterCount: counts.get(work.id)?.published ?? 0,
        })) as OwnWork[]
      );
    } catch (error) {
      console.error('Kitaplarım yüklenemedi:', error);
      setWorks([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadMine();
    }, [loadMine])
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR');
    return works.filter((work) => {
      if (mineFilter !== 'all' && work.status !== mineFilter) return false;
      if (!needle) return true;
      return [work.title, work.description, work.genre, ...(work.tags ?? [])]
        .join(' ')
        .toLocaleLowerCase('tr-TR')
        .includes(needle);
    });
  }, [mineFilter, query, works]);

  const draftCount = works.filter((work) => work.status === 'draft').length;
  const publishedCount = works.filter((work) => work.status === 'published').length;
  const totalChapterCount = works.reduce((sum, work) => sum + work.chapterCount, 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>YAZAR STÜDYOSU</Text>
            <Text style={styles.title}>Kitap Yaz & Yayınla</Text>
            <Text style={styles.subtitle}>
              Kendi kitabını oluştur, bölümler halinde yaz, taslaklarını yönet ve yayımladığın eserleri düzenle.
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/work-editor' as any)}
            style={styles.newBookButton}
            accessibilityRole="button"
            accessibilityLabel="Yeni kitap oluştur"
          >
            <Feather name="plus" size={18} color="#FFF" />
            <Text style={styles.newBookButtonText}>Yeni Kitap</Text>
          </Pressable>
        </View>

        <View style={styles.sectionTabs}>
          <Pressable
            onPress={() => setSection('mine')}
            style={[styles.sectionTab, section === 'mine' && styles.sectionTabActive]}
          >
            <Feather name="edit-3" size={16} color={section === 'mine' ? colors.primary : colors.textMuted} />
            <Text style={[styles.sectionTabText, section === 'mine' && styles.sectionTabTextActive]}>Kitaplarım</Text>
          </Pressable>
          <Pressable
            onPress={() => setSection('discover')}
            style={[styles.sectionTab, section === 'discover' && styles.sectionTabActive]}
          >
            <Feather name="compass" size={16} color={section === 'discover' ? colors.primary : colors.textMuted} />
            <Text style={[styles.sectionTabText, section === 'discover' && styles.sectionTabTextActive]}>Keşfet</Text>
          </Pressable>
        </View>

        {section === 'mine' ? (
          <>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{works.length}</Text>
                <Text style={styles.summaryLabel}>Toplam kitap</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{draftCount}</Text>
                <Text style={styles.summaryLabel}>Taslak</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{publishedCount}</Text>
                <Text style={styles.summaryLabel}>Yayında</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{totalChapterCount}</Text>
                <Text style={styles.summaryLabel}>Toplam bölüm</Text>
              </View>
            </View>

            <View style={styles.toolbar}>
              <View style={styles.searchBox}>
                <Feather name="search" size={17} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Kitaplarımda ara"
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                />
              </View>
              <Pressable onPress={() => void loadMine()} style={styles.refreshButton}>
                <Feather name="refresh-cw" size={17} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.filterRow}>
              {([
                ['all', `Tümü (${works.length})`],
                ['draft', `Taslaklar (${draftCount})`],
                ['published', `Yayınlananlar (${publishedCount})`],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setMineFilter(value)}
                  style={[styles.filterChip, mineFilter === value && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, mineFilter === value && styles.filterChipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Kitapların yükleniyor...</Text>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.emptyCard}>
                <Feather name="book-open" size={28} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>
                  {works.length ? 'Bu filtrede kitap yok' : 'Henüz bir kitabın yok'}
                </Text>
                <Text style={styles.emptyText}>
                  {works.length
                    ? 'Filtreyi değiştir veya farklı bir arama yap.'
                    : 'İlk kitabını oluşturup bölüm eklemeye başlayabilirsin.'}
                </Text>
                {!works.length ? (
                  <Pressable onPress={() => router.push('/work-editor' as any)} style={styles.emptyAction}>
                    <Feather name="plus" size={16} color="#FFF" />
                    <Text style={styles.emptyActionText}>İlk Kitabımı Oluştur</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.bookList}>
                {filtered.map((work) => (
                  <View key={work.id} style={styles.bookCard}>
                    <View style={styles.bookTop}>
                      <BookCover uri={work.cover_url} style={styles.cover}>
                        <View style={[styles.cover, styles.coverFallback]}>
                          <Feather name="book-open" size={24} color={colors.primary} />
                        </View>
                      </BookCover>

                      <View style={styles.bookInfo}>
                        <View style={styles.titleRow}>
                          <Text style={styles.bookTitle} numberOfLines={2}>{work.title}</Text>
                          <View style={[styles.statusBadge, work.status === 'published' && styles.statusBadgePublished]}>
                            <Text style={[styles.statusBadgeText, work.status === 'published' && styles.statusBadgeTextPublished]}>
                              {work.status === 'published' ? 'YAYINDA' : 'TASLAK'}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.bookDescription} numberOfLines={3}>
                          {work.description || 'Açıklama eklenmemiş.'}
                        </Text>

                        <View style={styles.metaWrap}>
                          {!!work.genre && <Text style={styles.metaPill}>{work.genre}</Text>}
                          <Text style={styles.metaPill}>{work.chapterCount} bölüm</Text>
                          <Text style={styles.metaPill}>{work.publishedChapterCount} yayında</Text>
                          <Text style={styles.metaPill}>{work.completed ? 'Tamamlandı' : 'Devam ediyor'}</Text>
                        </View>

                        <Text style={styles.dateText}>
                          {work.status === 'published'
                            ? `Yayın: ${formatDate(work.published_at)}`
                            : `Son düzenleme: ${formatDate(work.updated_at)}`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actionGrid}>
                      <Pressable
                        onPress={() => router.push({ pathname: '/work-editor', params: { id: work.id } })}
                        style={styles.primaryAction}
                      >
                        <Feather name="edit-3" size={16} color="#FFF" />
                        <Text style={styles.primaryActionText}>Eseri Düzenle</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => router.push({ pathname: '/work-editor', params: { id: work.id, addChapter: '1' } })}
                        style={styles.secondaryAction}
                      >
                        <Feather name="plus-circle" size={16} color={colors.primary} />
                        <Text style={styles.secondaryActionText}>Bölüm Ekle</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => router.push({ pathname: '/work', params: { id: work.id } })}
                        style={styles.secondaryAction}
                      >
                        <Feather name="eye" size={16} color={colors.primary} />
                        <Text style={styles.secondaryActionText}>Görüntüle</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.discoverSection}>
            <Text style={styles.discoverTitle}>Okur eserlerini keşfet</Text>
            <Text style={styles.discoverText}>Diğer kullanıcıların yayımladığı kitapları ve bölümleri inceleyebilirsin.</Text>

            <View style={styles.searchBox}>
              <Feather name="search" size={17} color={colors.textMuted} />
              <TextInput
                value={genre}
                onChangeText={setGenre}
                placeholder="Tür veya kategori ara"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.filterRow}>
              <Pressable onPress={() => setSort('new')} style={[styles.filterChip, sort === 'new' && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, sort === 'new' && styles.filterChipTextActive]}>Yeni çıkanlar</Text>
              </Pressable>
              <Pressable onPress={() => setSort('popular')} style={[styles.filterChip, sort === 'popular' && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, sort === 'popular' && styles.filterChipTextActive]}>Popüler</Text>
              </Pressable>
            </View>

            <WorksList genre={genre} sort={sort} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090D' },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 18 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#A985FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#F6F6F8', fontSize: 27, lineHeight: 33, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#8E909A', fontSize: 12, lineHeight: 18, marginTop: 6 },
  newBookButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#6232B5', flexDirection: 'row', alignItems: 'center', gap: 7 },
  newBookButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  sectionTabs: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  sectionTab: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: '#111218', borderWidth: 1, borderColor: '#292A33', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  sectionTabActive: { backgroundColor: '#21172F', borderColor: '#563D7E' },
  sectionTabText: { color: '#858791', fontSize: 12, fontWeight: '800' },
  sectionTabTextActive: { color: '#D8C8FF' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  summaryCard: { flexGrow: 1, flexBasis: '22%', minWidth: 130, borderRadius: 15, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 13 },
  summaryValue: { color: '#F3F3F6', fontSize: 20, fontWeight: '900' },
  summaryLabel: { color: '#777983', fontSize: 10, marginTop: 3 },
  toolbar: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchBox: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: '#F1F1F4', fontSize: 13, paddingVertical: 0 },
  refreshButton: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  filterChip: { minHeight: 34, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: '#30313B', backgroundColor: '#111218', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { borderColor: '#654A91', backgroundColor: '#241A35' },
  filterChipText: { color: '#777983', fontSize: 10, fontWeight: '800' },
  filterChipTextActive: { color: '#D8C8FF' },
  loadingBox: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#858791', fontSize: 12 },
  emptyCard: { minHeight: 230, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 22 },
  emptyTitle: { color: '#F2F2F5', fontSize: 17, fontWeight: '900', marginTop: 12 },
  emptyText: { color: '#777983', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6, maxWidth: 420 },
  emptyAction: { marginTop: 15, minHeight: 42, borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#6232B5', flexDirection: 'row', alignItems: 'center', gap: 7 },
  emptyActionText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  bookList: { gap: 12 },
  bookCard: { borderRadius: 18, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 14 },
  bookTop: { flexDirection: 'row', gap: 13 },
  cover: { width: 86, height: 124, borderRadius: 10, backgroundColor: '#181922' },
  coverFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#30313B' },
  bookInfo: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bookTitle: { flex: 1, color: '#F2F2F5', fontSize: 16, lineHeight: 21, fontWeight: '900' },
  statusBadge: { borderRadius: 999, borderWidth: 1, borderColor: '#5A4A36', backgroundColor: '#2B241A', paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgePublished: { borderColor: '#3E6B51', backgroundColor: '#18281F' },
  statusBadgeText: { color: '#E1B97A', fontSize: 8, fontWeight: '900' },
  statusBadgeTextPublished: { color: '#8DD5A5' },
  bookDescription: { color: '#8E909A', fontSize: 11, lineHeight: 17, marginTop: 7 },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  metaPill: { color: '#AAA0BE', fontSize: 9, borderRadius: 999, backgroundColor: '#19151F', borderWidth: 1, borderColor: '#332842', paddingHorizontal: 7, paddingVertical: 4 },
  dateText: { color: '#666873', fontSize: 9, marginTop: 9 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#252630' },
  primaryAction: { minHeight: 40, borderRadius: 11, backgroundColor: '#6232B5', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  primaryActionText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  secondaryAction: { minHeight: 40, borderRadius: 11, backgroundColor: '#19151F', borderWidth: 1, borderColor: '#392A4C', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  secondaryActionText: { color: '#C9B8ED', fontSize: 10, fontWeight: '900' },
  discoverSection: { gap: 10 },
  discoverTitle: { color: '#F2F2F5', fontSize: 18, fontWeight: '900' },
  discoverText: { color: '#777983', fontSize: 11, lineHeight: 17, marginBottom: 2 },
});
