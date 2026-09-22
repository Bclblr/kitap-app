import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { usePremium } from '@/providers/PremiumProvider';
import { useAppTheme } from '@/providers/ThemeProvider';

type ReadingBook = {
  book_key: string;
  book_title: string | null;
};

type ProgressRow = {
  current_page: number | null;
  total_pages: number | null;
};

type SavedPlan = {
  user_id: string;
  book_key: string;
  book_title: string;
  current_page: number;
  total_pages: number;
  target_date: string;
  daily_pages: number;
};

const DURATIONS = [7, 14, 30, 60] as const;

function normalizeOpenLibraryKey(key: string) {
  let normalized = key.startsWith('/') ? key : `/${key}`;
  if (/^\/OL\d+W$/i.test(normalized)) normalized = `/works${normalized}`;
  if (/^\/OL\d+M$/i.test(normalized)) normalized = `/books${normalized}`;
  return normalized;
}

function representativePageCount(values: number[]) {
  const valid = values.filter((value) => Number.isInteger(value) && value >= 20 && value <= 5000).sort((a, b) => a - b);
  if (!valid.length) return null;
  return valid[Math.floor(valid.length / 2)];
}

async function fetchPageCount(bookKey: string) {
  const normalized = normalizeOpenLibraryKey(bookKey);
  if (normalized.startsWith('/books/')) {
    const response = await fetch(`https://openlibrary.org${normalized}.json`);
    if (!response.ok) return null;
    const data = await response.json();
    return representativePageCount([Number(data?.number_of_pages)]);
  }

  if (normalized.startsWith('/works/')) {
    const response = await fetch(`https://openlibrary.org${normalized}/editions.json?limit=50`);
    if (!response.ok) return null;
    const data = await response.json();
    const values = Array.isArray(data?.entries)
      ? data.entries.map((entry: any) => Number(entry?.number_of_pages))
      : [];
    return representativePageCount(values);
  }

  return null;
}

export default function PremiumReadingPlanScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const premium = usePremium();
  const [books, setBooks] = useState<ReadingBook[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(30);
  const [savedPlan, setSavedPlan] = useState<SavedPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedBook = books.find((book) => book.book_key === selectedKey) ?? null;
  const remainingPages = Math.max(0, (totalPages ?? 0) - currentPage);
  const dailyPages = totalPages ? Math.max(1, Math.ceil(remainingPages / duration)) : 0;
  const targetDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + duration);
    return date;
  }, [duration]);

  const loadBookProgress = useCallback(async (bookKey: string) => {
    setPageLoading(true);
    try {
      const { data, error } = await supabase
        .from('reading_progress')
        .select('current_page, total_pages')
        .eq('book_key', bookKey)
        .maybeSingle();

      if (error) throw error;
      const row = data as ProgressRow | null;
      const savedCurrent = Number(row?.current_page ?? 0);
      let pages = row?.total_pages ? Number(row.total_pages) : null;

      if (!pages) {
        pages = await fetchPageCount(bookKey);
      }

      setCurrentPage(savedCurrent);
      setTotalPages(pages);
    } catch (error) {
      console.error('Plan kitap verisi yüklenemedi:', error);
      setCurrentPage(0);
      setTotalPages(null);
    } finally {
      setPageLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!premium.ready || !premium.isPremium) return;
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return;

      const [booksResult, planResult] = await Promise.all([
        supabase
          .from('user_book_status')
          .select('book_key, book_title')
          .eq('user_id', user.id)
          .eq('status', 'reading')
          .order('updated_at', { ascending: false }),
        (supabase as any)
          .from('premium_reading_plans')
          .select('user_id, book_key, book_title, current_page, total_pages, target_date, daily_pages')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (booksResult.error) throw booksResult.error;
      const nextBooks = (booksResult.data ?? []) as ReadingBook[];
      setBooks(nextBooks);

      const existing = planResult.data as SavedPlan | null;
      setSavedPlan(existing);

      const initialKey = existing?.book_key ?? nextBooks[0]?.book_key ?? null;
      setSelectedKey(initialKey);
      if (initialKey) await loadBookProgress(initialKey);
    } catch (error) {
      console.error('Akıllı okuma planı yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  }, [loadBookProgress, premium.isPremium, premium.ready]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function selectBook(bookKey: string) {
    setSelectedKey(bookKey);
    await loadBookProgress(bookKey);
  }

  async function savePlan() {
    if (!selectedBook || !totalPages || remainingPages <= 0 || saving) return;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return;

    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        book_key: selectedBook.book_key,
        book_title: selectedBook.book_title ?? 'Bilinmeyen kitap',
        current_page: currentPage,
        total_pages: totalPages,
        target_date: targetDate.toISOString().slice(0, 10),
        daily_pages: dailyPages,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from('premium_reading_plans')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;
      setSavedPlan(payload as SavedPlan);
      Alert.alert('Plan hazır', `Günde yaklaşık ${dailyPages} sayfa okuyarak hedefe ulaşabilirsin.`);
    } catch (error) {
      console.error('Okuma planı kaydedilemedi:', error);
      Alert.alert('Kaydedilemedi', 'Akıllı okuma planı şu anda kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  if (premium.ready && !premium.isPremium) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Feather name="lock" size={28} color={colors.primary} />
          <Text style={[styles.lockedTitle, { color: colors.text }]}>Akıllı Okuma Planı Premium’a özel</Text>
          <Text style={[styles.lockedBody, { color: colors.textSecondary }]}>Kalan sayfana göre günlük hedefini otomatik hesaplayan planlayıcıya Premium ile erişebilirsin.</Text>
          <Pressable onPress={() => router.replace('/premium')} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.primaryButtonText}>Premium’u İncele</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => safeBack(router, '/premium')} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="chevron-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Akıllı Okuma Planı</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingBox}><ActivityIndicator color={colors.primary} /></View>
        ) : books.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="book-open" size={24} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Aktif kitabın yok</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>Bir kitabı “Okuyorum” olarak işaretlediğinde burada kişisel plan oluşturabilirsin.</Text>
          </View>
        ) : (
          <>
            <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>PREMIUM PLANLAYICI</Text>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Kitabını ne zaman bitirmek istiyorsun?</Text>
              <Text style={[styles.heroBody, { color: colors.textSecondary }]}>Kalan sayfa sayına göre günlük okuma hedefini otomatik hesaplıyoruz.</Text>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Aktif kitap</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookRow}>
              {books.map((book) => {
                const active = selectedKey === book.book_key;
                return (
                  <Pressable key={book.book_key} onPress={() => void selectBook(book.book_key)} style={[styles.bookChip, { backgroundColor: colors.surface, borderColor: active ? colors.primary : colors.border }]}>
                    <Feather name={active ? 'check-circle' : 'book'} size={16} color={active ? colors.primary : colors.textMuted} />
                    <Text style={[styles.bookChipText, { color: colors.text }]} numberOfLines={1}>{book.book_title ?? 'Bilinmeyen kitap'}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {pageLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : totalPages ? (
                <>
                  <View style={styles.statsRow}>
                    <Stat label="Mevcut" value={String(currentPage)} />
                    <Stat label="Toplam" value={String(totalPages)} />
                    <Stat label="Kalan" value={String(remainingPages)} />
                  </View>

                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Bitirme süresi</Text>
                  <View style={styles.durationGrid}>
                    {DURATIONS.map((days) => (
                      <Pressable key={days} onPress={() => setDuration(days)} style={[styles.durationButton, { borderColor: duration === days ? colors.primary : colors.border, backgroundColor: duration === days ? colors.primarySoft : colors.background }]}>
                        <Text style={[styles.durationValue, { color: duration === days ? colors.primary : colors.text }]}>{days}</Text>
                        <Text style={[styles.durationLabel, { color: colors.textSecondary }]}>gün</Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={[styles.planResult, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
                    <Feather name="target" size={24} color={colors.primary} />
                    <View style={styles.planResultText}>
                      <Text style={[styles.planDaily, { color: colors.text }]}>Günde {dailyPages} sayfa</Text>
                      <Text style={[styles.planDate, { color: colors.textSecondary }]}>
                        Hedef bitiş: {targetDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </Text>
                    </View>
                  </View>

                  <Pressable onPress={() => void savePlan()} disabled={saving || remainingPages <= 0} style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving || remainingPages <= 0 ? 0.5 : 1 }]}>
                    {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>Planı Kaydet</Text>}
                  </Pressable>
                </>
              ) : (
                <View style={styles.missingPages}>
                  <Feather name="alert-circle" size={22} color={colors.primary} />
                  <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>Bu kitabın toplam sayfa bilgisi henüz bulunamadı. “Oku” sayfasındaki otomatik sayfa eşleştirmesi tamamlandığında plan oluşturabilirsin.</Text>
                </View>
              )}
            </View>

            {savedPlan ? (
              <View style={[styles.savedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Feather name="check-circle" size={20} color={colors.primary} />
                <View style={styles.savedText}>
                  <Text style={[styles.savedTitle, { color: colors.text }]}>Kayıtlı planın</Text>
                  <Text style={[styles.savedBody, { color: colors.textSecondary }]}>{savedPlan.book_title} · günde {savedPlan.daily_pages} sayfa · {new Date(`${savedPlan.target_date}T12:00:00`).toLocaleDateString('tr-TR')}</Text>
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );

  function Stat({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.stat}>
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 56 },
  centered: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center', gap: 12 },
  lockedTitle: { fontSize: 21, fontWeight: '900', textAlign: 'center' },
  lockedBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '800' },
  headerSpacer: { width: 42 },
  loadingBox: { paddingVertical: 72, alignItems: 'center' },
  hero: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 8 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900' },
  heroBody: { fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginTop: 18, marginBottom: 10 },
  bookRow: { gap: 9, paddingRight: 12 },
  bookChip: { maxWidth: 220, minHeight: 44, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookChipText: { maxWidth: 170, fontSize: 12.5, fontWeight: '800' },
  card: { marginTop: 16, borderWidth: 1, borderRadius: 20, padding: 16 },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statValue: { fontSize: 21, fontWeight: '900' },
  statLabel: { fontSize: 10.5, marginTop: 3 },
  durationGrid: { flexDirection: 'row', gap: 8 },
  durationButton: { flex: 1, minHeight: 62, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  durationValue: { fontSize: 18, fontWeight: '900' },
  durationLabel: { fontSize: 10, marginTop: 2 },
  planResult: { marginTop: 18, borderWidth: 1, borderRadius: 17, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  planResultText: { flex: 1 },
  planDaily: { fontSize: 18, fontWeight: '900' },
  planDate: { fontSize: 11.5, marginTop: 4 },
  saveButton: { marginTop: 14, minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { fontSize: 14, fontWeight: '900' },
  savedCard: { marginTop: 14, borderWidth: 1, borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  savedText: { flex: 1 },
  savedTitle: { fontSize: 13.5, fontWeight: '900' },
  savedBody: { fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  missingPages: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  emptyTitle: { fontSize: 18, fontWeight: '900', marginTop: 8 },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  primaryButton: { minHeight: 48, borderRadius: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
});
