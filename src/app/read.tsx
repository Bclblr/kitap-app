import { safeBack } from '@/lib/navigation';
import { BookCoverData, existingBookCover, loadOpenLibraryBookMetadata } from '@/lib/open-library-cover';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View as SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Image from '@/components/SafeImage';

import { supabase } from '@/lib/supabase';

type Author = string | { name?: string };

type BookStatus = 'reading' | 'read' | 'want' | 'abandoned';

type Book = BookCoverData & {
  key?: string;
  title?: string;
  authors?: Author[];
  covers?: number[];
  first_publish_year?: number;
  status?: BookStatus;
};

type ReadingDashboardResult = {
  today_pages_read: number | null;
  daily_page_goal: number | null;
  current_streak: number | null;
  timezone: string | null;
};

type UpdateProgressResult = {
  current_page: number;
  total_pages: number;
  furthest_page: number;
  added_pages: number;
  today_pages_read: number;
  updated_at: string | null;
};

type SameBookReader = {
  user_id: string;
  username: string | null;
  profile_image: string | null;
};

type UserBookStatusRow = {
  book_key: string;
  book_title: string | null;
  status: BookStatus;
};

type ReadingDayStat = {
  date: string;
  pages: number;
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shortDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString('tr-TR', { weekday: 'short' }).replace('.', '');
}

function readingActivityLabel(dateKey: string) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dateKey === localDateKey(today)) return 'Bugün';
  if (dateKey === localDateKey(yesterday)) return 'Dün';

  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
  });
}

function representativePageCount(values: number[]) {
  const valid = values
    .filter((value) => Number.isInteger(value) && value >= 20 && value <= 5000)
    .sort((a, b) => a - b);

  if (!valid.length) return null;
  return valid[Math.floor(valid.length / 2)];
}

function getAuthorName(book: Book) {
  const authorName = book.authors
    ?.map((author) =>
      typeof author === 'string' ? author : author.name
    )
    .filter(Boolean)
    .join(', ');

  return authorName || 'Bilinmeyen yazar';
}

const getCoverUrl = existingBookCover;

function getDeviceTimezone() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timezone === 'string' && timezone.trim() ? timezone : 'UTC';
  } catch {
    return 'UTC';
  }
}

export default function ReadScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const { key: routeBookKey } = useLocalSearchParams<{ key?: string | string[] }>();
  const selectedBookKey = Array.isArray(routeBookKey) ? routeBookKey[0] : routeBookKey;

  const [readingBooks, setReadingBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [currentPageInput, setCurrentPageInput] = useState('0');
  const [totalPagesInput, setTotalPagesInput] = useState('');
  const [lastProgressUpdate, setLastProgressUpdate] = useState<string | null>(
    null
  );
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const [dailyPageGoal, setDailyPageGoal] = useState(0);
  const [dailyPageGoalInput, setDailyPageGoalInput] = useState('');
  const [todayPagesRead, setTodayPagesRead] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [sameBookReaders, setSameBookReaders] = useState<SameBookReader[]>([]);
  const [sameBookReadersLoading, setSameBookReadersLoading] = useState(false);
  const [pageCountLoading, setPageCountLoading] = useState(false);
  const [pageCountSource, setPageCountSource] = useState<string | null>(null);
  const [readingInsightsLoading, setReadingInsightsLoading] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState<ReadingDayStat[]>([]);
  const [recentReadingActivity, setRecentReadingActivity] = useState<ReadingDayStat[]>([]);
  const progressRequestId = useRef(0);
  const sameBookReadersRequestId = useRef(0);

  const loadReadingDashboard = useCallback(async () => {
    try {
      setDashboardLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError && userError.name !== 'AuthSessionMissingError') {
        console.error('Okuma paneli kullanıcısı alınamadı:', userError);
        setTodayPagesRead(0);
        setDailyPageGoal(0);
        setDailyPageGoalInput('');
        setCurrentStreak(0);
        return;
      }

      if (!user) {
        setTodayPagesRead(0);
        setDailyPageGoal(0);
        setDailyPageGoalInput('');
        setCurrentStreak(0);
        return;
      }

      const { data, error } = await supabase
        .rpc('get_reading_dashboard')
        .single();

      if (error) {
        console.error('Okuma paneli yüklenemedi:', error);
        return;
      }

      const dashboard = data as ReadingDashboardResult | null;
      const loadedTodayPages = dashboard?.today_pages_read ?? 0;
      const loadedDailyGoal = dashboard?.daily_page_goal ?? 0;
      const loadedStreak = dashboard?.current_streak ?? 0;

      setTodayPagesRead(loadedTodayPages);
      setDailyPageGoal(loadedDailyGoal);
      setDailyPageGoalInput(
        loadedDailyGoal > 0 ? String(loadedDailyGoal) : ''
      );
      setCurrentStreak(loadedStreak);
    } catch (error) {
      console.error('Okuma paneli yükleme hatası:', error);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const resetProgress = useCallback(() => {
    setCurrentPage(0);
    setTotalPages(null);
    setCurrentPageInput('0');
    setTotalPagesInput('');
    setLastProgressUpdate(null);
  }, []);

  const loadProgress = useCallback(
    async (book: Book | undefined) => {
      const requestId = ++progressRequestId.current;
      resetProgress();

      if (!book?.key) {
        setProgressLoading(false);
        return;
      }

      try {
        setProgressLoading(true);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError && userError.name !== 'AuthSessionMissingError') {
          console.error('İlerleme kullanıcısı alınamadı:', userError);
          return;
        }

        if (!user) {
          return;
        }

        const { data, error } = await supabase
          .from('reading_progress')
          .select('current_page, total_pages, updated_at')
          .eq('user_id', user.id)
          .eq('book_key', book.key)
          .maybeSingle();

        if (error) {
          console.error('Okuma ilerlemesi yüklenemedi:', error);
          return;
        }

        if (!data) {
          return;
        }

        if (requestId !== progressRequestId.current) {
          return;
        }

        const savedCurrentPage = data.current_page ?? 0;
        const savedTotalPages = data.total_pages ?? null;

        setCurrentPage(savedCurrentPage);
        setTotalPages(savedTotalPages);
        setCurrentPageInput(String(savedCurrentPage));
        setTotalPagesInput(
          savedTotalPages === null ? '' : String(savedTotalPages)
        );
        setLastProgressUpdate(data.updated_at ?? null);
      } catch (error) {
        console.error('Okuma ilerlemesi yükleme hatası:', error);
      } finally {
        if (requestId === progressRequestId.current) {
          setProgressLoading(false);
        }
      }
    },
    [resetProgress]
  );

  const loadSameBookReaders = useCallback(async (bookKey?: string) => {
    const requestId = ++sameBookReadersRequestId.current;
    setSameBookReaders([]);

    if (!bookKey) {
      setSameBookReadersLoading(false);
      return;
    }

    try {
      setSameBookReadersLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError && userError.name !== 'AuthSessionMissingError') {
        console.error('Same book readers user error:', userError);
        return;
      }

      if (!user) return;

      const { data, error } = await supabase.rpc(
        'get_same_book_readers',
        { p_book_key: bookKey }
      );

      if (error) {
        console.error('Same book readers error:', error);
        return;
      }

      if (requestId !== sameBookReadersRequestId.current) return;

      setSameBookReaders((data ?? []) as SameBookReader[]);
    } catch (error) {
      console.error('Same book readers error:', error);
    } finally {
      if (requestId === sameBookReadersRequestId.current) {
        setSameBookReadersLoading(false);
      }
    }
  }, []);

  const loadBookPageCount = useCallback(async (book: Book | undefined) => {
    if (!book?.key) {
      setPageCountLoading(false);
      setPageCountSource(null);
      setTotalPages(null);
      setTotalPagesInput('');
      return;
    }

    try {
      setPageCountLoading(true);
      setPageCountSource(null);

      let normalizedKey = book.key.startsWith('/') ? book.key : `/${book.key}`;
      if (/^\/OL\d+W$/i.test(normalizedKey)) {
        normalizedKey = `/works${normalizedKey}`;
      } else if (/^\/OL\d+M$/i.test(normalizedKey)) {
        normalizedKey = `/books${normalizedKey}`;
      }

      let candidates: number[] = [];

      if (normalizedKey.startsWith('/books/')) {
        const response = await fetch(`https://openlibrary.org${normalizedKey}.json`);
        if (response.ok) {
          const data = await response.json();
          if (Number.isInteger(data?.number_of_pages)) {
            candidates = [data.number_of_pages];
          }
        }
      } else if (normalizedKey.startsWith('/works/')) {
        const response = await fetch(
          `https://openlibrary.org${normalizedKey}/editions.json?limit=50`
        );
        if (response.ok) {
          const data = await response.json();
          candidates = Array.isArray(data?.entries)
            ? data.entries
                .map((entry: any) => Number(entry?.number_of_pages))
                .filter((value: number) => Number.isFinite(value))
            : [];
        }
      }

      const databasePageCount = representativePageCount(candidates);

      if (databasePageCount) {
        setTotalPages(databasePageCount);
        setTotalPagesInput(String(databasePageCount));
        setPageCountSource('Open Library');
        return;
      }

      setPageCountSource('bulunamadı');
    } catch {
      // Open Library erişimi özellikle web tarafında CORS/ağ/TLS nedeniyle
      // geçici olarak başarısız olabilir. Daha önce kaydedilmiş sayfa sayısını
      // koru ve yalnızca kaynak bilgisini güncelle.
      setPageCountSource((current) => current ?? 'bulunamadı');
    } finally {
      setPageCountLoading(false);
    }
  }, []);

  const loadReadingInsights = useCallback(async () => {
    try {
      setReadingInsightsLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError && userError.name !== 'AuthSessionMissingError') {
        throw userError;
      }

      if (!user) {
        setWeeklyStats([]);
        setRecentReadingActivity([]);
        return;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

      const { data, error } = await supabase
        .from('reading_daily_stats')
        .select('reading_date, pages_read')
        .eq('user_id', user.id)
        .gte('reading_date', localDateKey(thirtyDaysAgo))
        .order('reading_date', { ascending: true });

      if (error) throw error;

      const pageMap = new Map<string, number>(
        (data ?? []).map((row: any) => [
          String(row.reading_date),
          Number(row.pages_read) || 0,
        ])
      );

      const lastSeven: ReadingDayStat[] = [];
      for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - offset);
        const key = localDateKey(date);
        lastSeven.push({ date: key, pages: pageMap.get(key) ?? 0 });
      }

      setWeeklyStats(lastSeven);
      setRecentReadingActivity(
        (data ?? [])
          .map((row: any) => ({
            date: String(row.reading_date),
            pages: Number(row.pages_read) || 0,
          }))
          .filter((row: ReadingDayStat) => row.pages > 0)
          .reverse()
          .slice(0, 5)
      );
    } catch (error) {
      console.error('Okuma özeti yüklenemedi:', error);
      setWeeklyStats([]);
      setRecentReadingActivity([]);
    } finally {
      setReadingInsightsLoading(false);
    }
  }, []);

  const loadReadingBooks = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError && userError.name !== 'AuthSessionMissingError') {
        throw userError;
      }

      if (!user) {
        setReadingBooks([]);
        await Promise.all([
          loadProgress(undefined),
          loadSameBookReaders(undefined),
        ]);
        return;
      }

      const { data, error } = await supabase
        .from('user_book_status')
        .select('book_key, book_title, status')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const shelfBooks: Book[] = ((data ?? []) as UserBookStatusRow[]).map((row) => ({
        key: row.book_key,
        title: row.book_title ?? 'Bilinmeyen kitap',
        status: row.status,
      }));

      const activeBooks = selectedBookKey
        ? [
            ...shelfBooks.filter((book) => book.key === selectedBookKey),
            ...shelfBooks.filter((book) => book.key !== selectedBookKey && book.status === 'reading'),
          ]
        : shelfBooks.filter((book) => book.status === 'reading');

      const enrichedBooks = await Promise.all(
        activeBooks.map(async (book) => {
          if (!book.key) return book;

          const metadata = await loadOpenLibraryBookMetadata(book.key, book);
          if (!metadata) return book;

          return {
            ...book,
            ...metadata,
            key: book.key,
            title: metadata.title ?? book.title,
            authors: metadata.authors?.length ? metadata.authors : book.authors,
            status: book.status,
          } as Book;
        })
      );

      setReadingBooks(enrichedBooks);
      await loadProgress(enrichedBooks[0]);
      await Promise.all([
        loadBookPageCount(enrichedBooks[0]),
        loadSameBookReaders(enrichedBooks[0]?.key),
      ]);
    } catch (error) {
      console.error('Okunan kitaplar yüklenemedi:', error);
      setReadingBooks([]);
      await Promise.all([
        loadProgress(undefined),
        loadBookPageCount(undefined),
        loadSameBookReaders(undefined),
      ]);
    } finally {
      setLoading(false);
    }
  }, [loadBookPageCount, loadProgress, loadSameBookReaders, selectedBookKey]);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([
        loadReadingBooks(),
        loadReadingDashboard(),
        loadReadingInsights(),
      ]);
    }, [loadReadingBooks, loadReadingDashboard, loadReadingInsights])
  );

  function getBookStatusLabel(status?: BookStatus) {
    switch (status) {
      case 'want':
        return 'Okuyacağım';
      case 'read':
        return 'Okudum';
      case 'abandoned':
        return 'Yarım Bıraktım';
      case 'reading':
      default:
        return 'Okuyorum';
    }
  }

  function openBook(book: Book) {
    if (!book.key) return;

    router.push({
      pathname: '/book',
      params: {
        key: book.key,
        title: book.title,
        author: getAuthorName(book),
      },
    });
  }

  const currentBook = readingBooks[0];
  const otherReadingBooks = readingBooks.slice(1);
  const progressPercentage =
    totalPages !== null && totalPages > 0
      ? Math.min(100, Math.round((currentPage / totalPages) * 100))
      : null;
  const dailyGoalPercentage =
    dailyPageGoal > 0
      ? Math.min(100, Math.round((todayPagesRead / dailyPageGoal) * 100))
      : null;
  const weeklyPages = weeklyStats.reduce((sum, day) => sum + day.pages, 0);
  const weeklyActiveDays = weeklyStats.filter((day) => day.pages > 0).length;
  const weeklyDailyAverage = weeklyStats.length ? weeklyPages / weeklyStats.length : 0;
  const maxWeeklyPages = Math.max(1, ...weeklyStats.map((day) => day.pages));
  const estimatedDaysToFinish =
    totalPages && totalPages > currentPage && weeklyDailyAverage > 0
      ? Math.ceil((totalPages - currentPage) / weeklyDailyAverage)
      : null;
  const estimatedFinishDate =
    estimatedDaysToFinish !== null
      ? new Date(Date.now() + estimatedDaysToFinish * 24 * 60 * 60 * 1000)
      : null;

  async function saveDailyPageGoal() {
    const cleanGoal = dailyPageGoalInput.trim();

    if (!/^\d+$/.test(cleanGoal)) {
      Alert.alert(
        'Geçersiz günlük hedef',
        'Günlük hedef 1 ile 10000 arasında bir tam sayı olmalı.'
      );
      return;
    }

    const parsedGoal = Number(cleanGoal);

    if (
      !Number.isSafeInteger(parsedGoal) ||
      parsedGoal < 1 ||
      parsedGoal > 10000
    ) {
      Alert.alert(
        'Geçersiz günlük hedef',
        'Günlük hedef 1 ile 10000 arasında bir tam sayı olmalı.'
      );
      return;
    }

    try {
      setGoalSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError && userError.name !== 'AuthSessionMissingError') {
        console.error('Hedef kullanıcısı alınamadı:', userError);
        Alert.alert('Hata', 'Kullanıcı bilgisi alınamadı. Lütfen tekrar dene.');
        return;
      }

      if (!user) {
        Alert.alert(
          'Giriş gerekli',
          'Günlük okuma hedefini kaydetmek için önce giriş yapmalısın.'
        );
        return;
      }

      const { error } = await supabase.from('reading_preferences').upsert(
        {
          user_id: user.id,
          daily_page_goal: parsedGoal,
          timezone: getDeviceTimezone(),
        },
        {
          onConflict: 'user_id',
        }
      );

      if (error) {
        console.error('Günlük hedef kaydedilemedi:', error);
        Alert.alert('Hedef kaydedilemedi', error.message);
        return;
      }

      setDailyPageGoal(parsedGoal);
      setDailyPageGoalInput(String(parsedGoal));
      await loadReadingDashboard();
    } catch (error) {
      console.error('Günlük hedef kayıt hatası:', error);
      Alert.alert('Hata', 'Günlük hedef kaydedilirken bir hata oluştu.');
    } finally {
      setGoalSaving(false);
    }
  }

  async function saveProgress() {
    if (!currentBook?.key) {
      Alert.alert('Kitap bulunamadı', 'İlerleme kaydedilecek aktif kitap yok.');
      return;
    }

    const cleanCurrentPage = currentPageInput.trim();
    const cleanTotalPages = totalPagesInput.trim();

    if (!totalPages || !/^\d+$/.test(cleanTotalPages)) {
      Alert.alert(
        'Sayfa sayısı bulunamadı',
        'Bu kitabın toplam sayfa bilgisi Open Library veritabanında bulunamadı. İlerleme kaydı için önce kitap verisinin gelmesi gerekiyor.'
      );
      return;
    }

    if (!/^\d+$/.test(cleanCurrentPage)) {
      Alert.alert(
        'Geçersiz mevcut sayfa',
        'Mevcut sayfa sıfır veya daha büyük bir tam sayı olmalı.'
      );
      return;
    }

    const parsedCurrentPage = Number(cleanCurrentPage);
    const parsedTotalPages = Number(cleanTotalPages);

    if (!Number.isSafeInteger(parsedCurrentPage) || parsedCurrentPage < 0) {
      Alert.alert(
        'Geçersiz mevcut sayfa',
        'Mevcut sayfa sıfır veya daha büyük bir tam sayı olmalı.'
      );
      return;
    }

    if (!Number.isSafeInteger(parsedTotalPages) || parsedTotalPages <= 0) {
      Alert.alert(
        'Geçersiz toplam sayfa',
        'Toplam sayfa sıfırdan büyük bir tam sayı olmalı.'
      );
      return;
    }

    if (parsedCurrentPage > parsedTotalPages) {
      Alert.alert(
        'Sayfa aralığı geçersiz',
        'Mevcut sayfa toplam sayfadan büyük olamaz.'
      );
      return;
    }

    try {
      setProgressSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError && userError.name !== 'AuthSessionMissingError') {
        console.error('İlerleme kullanıcısı alınamadı:', userError);
        Alert.alert('Hata', 'Kullanıcı bilgisi alınamadı. Lütfen tekrar dene.');
        return;
      }

      if (!user) {
        Alert.alert(
          'Giriş gerekli',
          'Okuma ilerlemeni kaydetmek için önce giriş yapmalısın.'
        );
        return;
      }

      const { data, error } = await supabase
        .rpc('update_reading_progress', {
          p_book_key: currentBook.key,
          p_book_title: currentBook.title ?? '',
          p_current_page: parsedCurrentPage,
          p_total_pages: parsedTotalPages,
        })
        .single();

      if (error) {
        console.error('Okuma ilerlemesi kaydedilemedi:', error);
        Alert.alert('İlerleme kaydedilemedi', error.message);
        return;
      }

      const updatedProgress = data as UpdateProgressResult;

      setCurrentPage(updatedProgress.current_page);
      setTotalPages(updatedProgress.total_pages);
      setCurrentPageInput(String(updatedProgress.current_page));
      setTotalPagesInput(String(updatedProgress.total_pages));
      setLastProgressUpdate(updatedProgress.updated_at ?? null);
      setTodayPagesRead(updatedProgress.today_pages_read ?? 0);

      await Promise.all([loadReadingDashboard(), loadReadingInsights()]);

      if (updatedProgress.current_page >= updatedProgress.total_pages) {
        const { error: statusError } = await supabase.rpc('set_user_book_status', {
          p_book_key: currentBook.key,
          p_book_title: currentBook.title ?? '',
          p_status: 'read',
        });

        if (statusError) {
          console.error('Kitap tamamlandı olarak işaretlenemedi:', statusError);
          Alert.alert(
            'İlerleme kaydedildi',
            'Sayfa ilerlemen kaydedildi ancak kitap Okudum rafına taşınamadı.'
          );
          return;
        }

        await loadReadingBooks();
        Alert.alert(
          'Kitap tamamlandı 🎉',
          'Tebrikler! Kitap otomatik olarak Okudum rafına taşındı.'
        );
        return;
      }

      Alert.alert('Güncellendi', 'Okuma ilerlemen kaydedildi.');
    } catch (error) {
      console.error('Okuma ilerlemesi kayıt hatası:', error);
      Alert.alert('Hata', 'Okuma ilerlemesi kaydedilirken bir hata oluştu.');
    } finally {
      setProgressSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Pressable onPress={() => safeBack(router, '/shelves')} style={styles.backButton} hitSlop={10}>
              <Text style={styles.backButtonText}>‹</Text>
            </Pressable>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerEyebrow}>KİTAPLIĞIN</Text>
              <Text style={styles.headerTitle}>Oku</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#9B72F2" />
            <Text style={styles.loadingText}>Kitapların yükleniyor...</Text>
          </View>
        ) : currentBook ? (
          <>
            <Text style={styles.sectionTitle}>{selectedBookKey ? 'Seçili Kitap' : 'Şu An Okuyorum'}</Text>
            <View style={styles.currentBookCard}>
              <View style={styles.currentBookContent}>
                {getCoverUrl(currentBook) ? (
                  <Image source={{ uri: getCoverUrl(currentBook)! }} style={styles.currentCover} resizeMode="cover" />
                ) : (
                  <View style={[styles.currentCover, styles.coverFallback]}>
                    <Text style={styles.coverFallbackIcon}>▥</Text>
                  </View>
                )}
                <View style={styles.currentBookInfo}>
                  <View style={styles.statusPill}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>{getBookStatusLabel(currentBook.status)}</Text>
                  </View>
                  <Text style={styles.currentBookTitle} numberOfLines={3}>
                    {currentBook.title || 'İsimsiz kitap'}
                  </Text>
                  <Text style={styles.author} numberOfLines={2}>{getAuthorName(currentBook)}</Text>
                  {currentBook.first_publish_year ? (
                    <Text style={styles.year}>İlk yayın: {currentBook.first_publish_year}</Text>
                  ) : null}
                </View>
              </View>
              <Pressable onPress={() => openBook(currentBook)} style={styles.continueButton}>
                <Text style={styles.continueButtonText}>Okumaya Devam Et</Text>
                <Text style={styles.continueButtonArrow}>›</Text>
              </Pressable>
            </View>

            {otherReadingBooks.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Diğer Aktif Kitaplar</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
                  {otherReadingBooks.map((book, index) => (
                    <Pressable key={book.key || `${book.title}-${index}`} onPress={() => openBook(book)} style={styles.smallBookCard}>
                      {getCoverUrl(book) ? (
                        <Image source={{ uri: getCoverUrl(book)! }} style={styles.smallCover} resizeMode="cover" />
                      ) : (
                        <View style={[styles.smallCover, styles.coverFallback]}>
                          <Text style={styles.smallFallbackIcon}>▥</Text>
                        </View>
                      )}
                      <Text style={styles.smallBookTitle} numberOfLines={2}>{book.title || 'İsimsiz kitap'}</Text>
                      <Text style={styles.smallAuthor} numberOfLines={1}>{getAuthorName(book)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.emptyHero}>
            <View style={styles.emptyIconWrap}><Text style={styles.emptyIcon}>▥</Text></View>
            <Text style={styles.emptyTitle}>Şu anda okuduğun bir kitap yok</Text>
            <Text style={styles.emptyText}>
              Raflarından bir kitap seçip durumunu “Okuyorum” olarak işaretleyebilirsin.
            </Text>
            <Pressable onPress={() => router.push('/shelves')} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Raflara Git</Text>
              <Text style={styles.primaryButtonArrow}>›</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Okuma İlerlemesi</Text>
          {currentBook ? (
            <View style={styles.progressCard}>
              {progressLoading ? (
                <View style={styles.progressLoadingRow}>
                  <ActivityIndicator size="small" color="#9B72F2" />
                  <Text style={styles.progressLoadingText}>İlerlemen yükleniyor...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.inputRow}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Mevcut sayfa</Text>
                      <TextInput value={currentPageInput} onChangeText={setCurrentPageInput} keyboardType="number-pad" placeholder="0" placeholderTextColor="#5F616B" style={styles.progressInput} />
                    </View>
                    <View style={styles.inputDivider} />
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Toplam sayfa</Text>
                      <View style={styles.pageCountBox}>
                        {pageCountLoading ? (
                          <ActivityIndicator size="small" color="#9B72F2" />
                        ) : (
                          <Text style={styles.pageCountValue}>
                            {totalPages ? totalPages : '—'}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.pageCountSource}>
                        {pageCountLoading
                          ? 'Veritabanından alınıyor...'
                          : pageCountSource === 'Open Library'
                            ? 'Open Library verisinden otomatik'
                            : 'Sayfa bilgisi bulunamadı'}
                      </Text>
                    </View>
                  </View>

                  {progressPercentage !== null ? (
                    <View style={styles.progressSummary}>
                      <View style={styles.progressSummaryRow}>
                        <Text style={styles.progressPageText}>{currentPage} / {totalPages} sayfa</Text>
                        <Text style={styles.progressPercentText}>%{progressPercentage}</Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progressPercentage}%` as `${number}%` }]} />
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.progressHint}>Toplam sayfa bilgisi veritabanından geldiğinde ilerleme yüzdesi otomatik hesaplanır.</Text>
                  )}

                  {lastProgressUpdate ? (
                    <Text style={styles.lastUpdatedText}>
                      Son güncelleme: {new Date(lastProgressUpdate).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </Text>
                  ) : null}

                  <Pressable onPress={saveProgress} disabled={progressSaving} style={[styles.updateButton, progressSaving && styles.updateButtonDisabled]}>
                    {progressSaving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.updateButtonText}>İlerlemeyi Güncelle</Text>}
                  </Pressable>
                </>
              )}
            </View>
          ) : (
            <EmptyFeatureCard icon="◔" title="İlerleme kaydı için aktif kitap gerekli" description="Raflarından bir kitabı Okuyorum olarak işaretlediğinde ilerlemeni kaydedebilirsin." />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Okuma Serisi</Text>
          <View style={styles.dashboardCard}>
            {dashboardLoading ? <DashboardLoading /> : (
              <View style={styles.streakContent}>
                <View style={styles.streakIconWrap}><Text style={styles.streakIcon}>◇</Text></View>
                <View style={styles.streakInfo}>
                  <Text style={styles.streakValue}>
                    {currentStreak === 0 ? 'Seri henüz başlamadı' : currentStreak === 1 ? '1 gün' : `${currentStreak} gün`}
                  </Text>
                  <Text style={styles.streakDescription}>
                    {currentStreak === 0 ? 'Bugün okumaya başlayarak ilk serini oluşturabilirsin.' : 'Okumaya devam ederek serini koru.'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Günlük Hedef</Text>
          <View style={styles.dashboardCard}>
            {dashboardLoading ? <DashboardLoading /> : (
              <>
                <View style={styles.dailyStatsRow}>
                  <View style={styles.dailyStat}>
                    <Text style={styles.dailyStatValue}>{todayPagesRead}</Text>
                    <Text style={styles.dailyStatLabel}>Bugün okunan</Text>
                  </View>
                  <View style={styles.dailyStatDivider} />
                  <View style={styles.dailyStat}>
                    <Text style={styles.dailyStatValue}>{dailyPageGoal > 0 ? dailyPageGoal : '—'}</Text>
                    <Text style={styles.dailyStatLabel}>Günlük hedef</Text>
                  </View>
                  <View style={styles.dailyStatDivider} />
                  <View style={styles.dailyStat}>
                    <Text style={styles.dailyPercentValue}>{dailyGoalPercentage === null ? '—' : `%${dailyGoalPercentage}`}</Text>
                    <Text style={styles.dailyStatLabel}>Tamamlandı</Text>
                  </View>
                </View>

                {dailyGoalPercentage !== null ? (
                  <View style={styles.dailyProgressTrack}>
                    <View style={[styles.dailyProgressFill, { width: `${dailyGoalPercentage}%` as `${number}%` }]} />
                  </View>
                ) : (
                  <Text style={styles.progressHint}>İlerlemeni görmek için günlük hedefini kaydet.</Text>
                )}

                <View style={styles.goalEditor}>
                  <View style={styles.goalInputGroup}>
                    <Text style={styles.inputLabel}>Günlük sayfa hedefi</Text>
                    <TextInput value={dailyPageGoalInput} onChangeText={setDailyPageGoalInput} keyboardType="number-pad" placeholder="Örn. 20" placeholderTextColor="#5F616B" style={styles.goalInput} />
                  </View>
                  <Pressable onPress={saveDailyPageGoal} disabled={goalSaving} style={[styles.goalSaveButton, goalSaving && styles.updateButtonDisabled]}>
                    {goalSaving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.goalSaveButtonText}>Kaydet</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Son 7 Gün</Text>
          <View style={styles.insightsCard}>
            {readingInsightsLoading ? (
              <DashboardLoading />
            ) : (
              <>
                <View style={styles.weeklySummaryRow}>
                  <View style={styles.weeklySummaryItem}>
                    <Text style={styles.weeklySummaryValue}>{weeklyPages}</Text>
                    <Text style={styles.weeklySummaryLabel}>sayfa</Text>
                  </View>
                  <View style={styles.weeklySummaryDivider} />
                  <View style={styles.weeklySummaryItem}>
                    <Text style={styles.weeklySummaryValue}>{weeklyActiveDays}</Text>
                    <Text style={styles.weeklySummaryLabel}>aktif gün</Text>
                  </View>
                  <View style={styles.weeklySummaryDivider} />
                  <View style={styles.weeklySummaryItem}>
                    <Text style={styles.weeklySummaryValue}>
                      {weeklyStats.length ? Math.round(weeklyDailyAverage) : 0}
                    </Text>
                    <Text style={styles.weeklySummaryLabel}>günlük ort.</Text>
                  </View>
                </View>

                <View style={styles.weeklyChart}>
                  {weeklyStats.map((day) => {
                    const barHeight = day.pages > 0
                      ? Math.max(8, Math.round((day.pages / maxWeeklyPages) * 82))
                      : 4;

                    return (
                      <View key={day.date} style={styles.weeklyBarColumn}>
                        <Text style={styles.weeklyBarValue}>{day.pages || ''}</Text>
                        <View style={styles.weeklyBarTrack}>
                          <View style={[styles.weeklyBarFill, { height: barHeight }]} />
                        </View>
                        <Text style={styles.weeklyBarLabel}>{shortDayLabel(day.date)}</Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.estimateCard}>
                  <View style={styles.estimateIconWrap}>
                    <Text style={styles.estimateIcon}>⌁</Text>
                  </View>
                  <View style={styles.estimateCopy}>
                    <Text style={styles.estimateTitle}>Tahmini bitirme</Text>
                    <Text style={styles.estimateText}>
                      {!currentBook
                        ? 'Aktif bir kitap seçtiğinde tahmin burada görünür.'
                        : !totalPages
                          ? 'Toplam sayfa bilgisi bekleniyor.'
                          : currentPage >= totalPages
                            ? 'Bu kitabı tamamladın.'
                            : estimatedFinishDate
                              ? `Bu tempoyla yaklaşık ${estimatedDaysToFinish} gün içinde, ${estimatedFinishDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} civarında bitirebilirsin.`
                              : 'Tahmin için son 7 günde biraz okuma verisi gerekiyor.'}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Son Okuma Hareketleri</Text>
          <View style={styles.activityCard}>
            {readingInsightsLoading ? (
              <DashboardLoading />
            ) : recentReadingActivity.length ? (
              recentReadingActivity.map((activity, index) => (
                <View
                  key={activity.date}
                  style={[
                    styles.activityRow,
                    index < recentReadingActivity.length - 1 && styles.activityRowBorder,
                  ]}
                >
                  <View style={styles.activityDot} />
                  <View style={styles.activityCopy}>
                    <Text style={styles.activityTitle}>
                      {activity.pages} sayfa okudun
                    </Text>
                    <Text style={styles.activityDate}>
                      {readingActivityLabel(activity.date)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.activityEmpty}>
                İlerleme kaydettikçe son okuma hareketlerin burada görünecek.
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aynı Kitabı Okuyanlar</Text>
          <View style={styles.sameReadersCard}>
            {sameBookReadersLoading ? (
              <View style={styles.sameReadersLoading}>
                <ActivityIndicator size="small" color="#9B72F2" />
                <Text style={styles.sameReadersLoadingText}>Okuyucular yükleniyor...</Text>
              </View>
            ) : sameBookReaders.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sameReadersList}>
                {sameBookReaders.map((reader) => {
                  const displayName = reader.username?.trim() || 'Okuyucu';
                  const initial = displayName.charAt(0).toLocaleUpperCase('tr-TR');
                  return (
                    <Pressable
                      key={reader.user_id}
                      onPress={() => router.push({ pathname: '/profile', params: { userId: reader.user_id } })}
                      style={styles.sameReaderItem}
                    >
                      {reader.profile_image ? (
                        <Image source={{ uri: reader.profile_image }} style={styles.sameReaderAvatar} />
                      ) : (
                        <View style={[styles.sameReaderAvatar, styles.sameReaderAvatarPlaceholder]}>
                          <Text style={styles.sameReaderInitial}>{initial}</Text>
                        </View>
                      )}
                      <Text style={styles.sameReaderName} numberOfLines={1}>{displayName}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.sameReadersEmptyText}>Bu kitabı aktif olarak okuyan başka bir kullanıcı henüz görünmüyor.</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Raflara Hızlı Erişim</Text>
          <View style={styles.shelfGrid}>
            <ShelfButton accent="#9B72F2" label="Okuyorum" symbol="◉" onPress={() => router.push('/shelves')} />
            <ShelfButton accent="#65C79A" label="Okudum" symbol="✓" onPress={() => router.push('/shelves')} />
            <ShelfButton accent="#F29A45" label="Okumak İstiyorum" symbol="+" onPress={() => router.push('/shelves')} />
            <ShelfButton accent="#D98792" label="Yarım Bıraktım" symbol="Ⅱ" onPress={() => router.push('/shelves')} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type EmptyFeatureCardProps = {
  icon: string;
  title: string;
  description: string;
  compact?: boolean;
};

function DashboardLoading() {
  const styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.dashboardLoading}>
      <ActivityIndicator size="small" color="#9B72F2" />
      <Text style={styles.dashboardLoadingText}>Okuma verilerin yükleniyor...</Text>
    </View>
  );
}

function EmptyFeatureCard({ icon, title, description, compact = false }: EmptyFeatureCardProps) {
  const styles = useThemedStyles(baseStyles);
  return (
    <View style={[styles.featureCard, compact && styles.compactFeatureCard]}>
      <View style={styles.featureIconWrap}><Text style={styles.featureIcon}>{icon}</Text></View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  );
}

type ShelfButtonProps = {
  accent: string;
  label: string;
  symbol: string;
  onPress: () => void;
};

function ShelfButton({ accent, label, symbol, onPress }: ShelfButtonProps) {
  const styles = useThemedStyles(baseStyles);
  return (
    <Pressable onPress={onPress} style={styles.shelfButton}>
      <View style={[styles.shelfIconWrap, { borderColor: accent }]}>
        <Text style={[styles.shelfIcon, { color: accent }]}>{symbol}</Text>
      </View>
      <Text style={styles.shelfLabel}>{label}</Text>
    </Pressable>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#08090D' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 132 },
  header: { paddingVertical: 12, marginBottom: 20 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111218', borderWidth: 1, borderColor: '#2A2B34', marginRight: 12 },
  backButtonText: { color: '#F7F7F9', fontSize: 32, lineHeight: 34, fontWeight: '500', marginTop: -2 },
  headerTextWrap: { flex: 1 },
  headerEyebrow: { color: '#9870EA', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  headerTitle: { color: '#F7F7F9', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 4 },
  section: { marginTop: 24 },
  sectionTitle: { color: '#F1F1F4', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  loadingCard: { minHeight: 170, borderRadius: 20, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8A8B94', fontSize: 13, marginTop: 12 },
  currentBookCard: { borderRadius: 22, padding: 15, backgroundColor: '#111218', borderWidth: 1, borderColor: '#2A2B34' },
  currentBookContent: { flexDirection: 'row' },
  currentCover: { width: 112, height: 168, borderRadius: 13, backgroundColor: '#191A21' },
  coverFallback: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#30313A' },
  coverFallbackIcon: { color: '#9870EA', fontSize: 38 },
  currentBookInfo: { flex: 1, paddingLeft: 15, paddingVertical: 2 },
  statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: '#282039', marginBottom: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A982F6', marginRight: 6 },
  statusText: { color: '#CDB7F8', fontSize: 10, fontWeight: '800' },
  currentBookTitle: { color: '#FAFAFB', fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.4 },
  author: { color: '#A0A1AA', fontSize: 13, lineHeight: 19, marginTop: 7 },
  year: { color: '#696B75', fontSize: 10, marginTop: 9 },
  pageCountBox: { height: 46, borderRadius: 13, paddingHorizontal: 13, backgroundColor: '#111218', borderWidth: 1, borderColor: '#352A49', justifyContent: 'center', alignItems: 'flex-start' },
  pageCountValue: { color: '#DCCEFF', fontSize: 15, fontWeight: '900' },
  pageCountSource: { color: '#676A74', fontSize: 9, lineHeight: 13, marginTop: 5 },
  insightsCard: { borderRadius: 20, padding: 16, backgroundColor: '#111218', borderWidth: 1, borderColor: '#292A33' },
  weeklySummaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  weeklySummaryItem: { flex: 1, alignItems: 'center' },
  weeklySummaryValue: { color: '#F4F4F6', fontSize: 20, fontWeight: '900' },
  weeklySummaryLabel: { color: '#747680', fontSize: 9.5, fontWeight: '700', marginTop: 3 },
  weeklySummaryDivider: { width: 1, height: 30, backgroundColor: '#292A33' },
  weeklyChart: { height: 132, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  weeklyBarColumn: { flex: 1, height: 126, alignItems: 'center', justifyContent: 'flex-end' },
  weeklyBarValue: { color: '#8E8F99', fontSize: 8.5, minHeight: 13, marginBottom: 4 },
  weeklyBarTrack: { height: 84, width: '62%', minWidth: 16, borderRadius: 8, backgroundColor: '#1B1C24', justifyContent: 'flex-end', overflow: 'hidden' },
  weeklyBarFill: { width: '100%', borderRadius: 8, backgroundColor: '#8B63E6' },
  weeklyBarLabel: { color: '#777983', fontSize: 9, fontWeight: '700', marginTop: 7 },
  estimateCard: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#292A33', flexDirection: 'row', alignItems: 'center', gap: 12 },
  estimateIconWrap: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#241B35', borderWidth: 1, borderColor: '#3A2A52', alignItems: 'center', justifyContent: 'center' },
  estimateIcon: { color: '#B79AF8', fontSize: 22, fontWeight: '800' },
  estimateCopy: { flex: 1 },
  estimateTitle: { color: '#ECECF0', fontSize: 12.5, fontWeight: '900' },
  estimateText: { color: '#858791', fontSize: 10.5, lineHeight: 16, marginTop: 4 },
  activityCard: { borderRadius: 18, paddingHorizontal: 15, backgroundColor: '#111218', borderWidth: 1, borderColor: '#292A33' },
  activityRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center' },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: '#24252D' },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#8B63E6', marginRight: 12 },
  activityCopy: { flex: 1 },
  activityTitle: { color: '#E6E6EA', fontSize: 12.5, fontWeight: '800' },
  activityDate: { color: '#72747D', fontSize: 10, marginTop: 3 },
  activityEmpty: { color: '#7E8089', fontSize: 11.5, lineHeight: 18, textAlign: 'center', paddingVertical: 22 },
  primaryButton: { minHeight: 48, borderRadius: 15, backgroundColor: '#21182F', borderWidth: 1, borderColor: '#38284D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 15 },
  primaryButtonText: { color: '#A985FF', fontSize: 14, fontWeight: '900' },
  primaryButtonArrow: { color: '#A985FF', fontSize: 25, lineHeight: 26, marginLeft: 8 },
  continueButton: { minHeight: 46, borderRadius: 14, backgroundColor: '#8058D9', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 15 },
  continueButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  continueButtonArrow: { color: '#FFFFFF', fontSize: 22, lineHeight: 24, marginLeft: 8 },
  horizontalList: { gap: 11, paddingRight: 16 },
  smallBookCard: { width: 132, padding: 10, borderRadius: 16, backgroundColor: '#111218', borderWidth: 1, borderColor: '#292A33' },
  smallCover: { width: '100%', height: 148, borderRadius: 10, backgroundColor: '#191A21' },
  smallFallbackIcon: { color: '#9870EA', fontSize: 28 },
  smallBookTitle: { color: '#F1F1F3', fontSize: 12, lineHeight: 16, fontWeight: '800', marginTop: 9 },
  smallAuthor: { color: '#777983', fontSize: 10, marginTop: 4 },
  emptyHero: { borderRadius: 22, padding: 20, backgroundColor: '#111218', borderWidth: 1, borderColor: '#2A2B34', alignItems: 'center' },
  emptyIconWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#282039', justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { color: '#A982F6', fontSize: 32 },
  emptyTitle: { color: '#F4F4F6', fontSize: 18, lineHeight: 24, fontWeight: '900', textAlign: 'center', marginTop: 16 },
  emptyText: { color: '#858791', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  progressCard: { borderRadius: 18, padding: 16, backgroundColor: '#111218', borderWidth: 1, borderColor: '#292A33' },
  progressLoadingRow: { minHeight: 90, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  progressLoadingText: { color: '#8A8B94', fontSize: 12, marginLeft: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  inputGroup: { flex: 1 },
  inputDivider: { width: 10 },
  inputLabel: { color: '#9A9CA5', fontSize: 10, fontWeight: '700', marginBottom: 7 },
  progressInput: { height: 46, borderRadius: 13, paddingHorizontal: 13, backgroundColor: '#090A0F', borderWidth: 1, borderColor: '#30313A', color: '#F4F4F6', fontSize: 15, fontWeight: '700' },
  progressSummary: { marginTop: 18 },
  progressSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  progressPageText: { color: '#A1A2AB', fontSize: 11, fontWeight: '600' },
  progressPercentText: { color: '#B999F8', fontSize: 13, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#24252D', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#9368EB' },
  progressHint: { color: '#73757F', fontSize: 11, lineHeight: 16, marginTop: 14 },
  lastUpdatedText: { color: '#686A74', fontSize: 10, marginTop: 12 },
  updateButton: { minHeight: 46, borderRadius: 14, backgroundColor: '#8058D9', justifyContent: 'center', alignItems: 'center', marginTop: 15 },
  updateButtonDisabled: { opacity: 0.6 },
  updateButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  dashboardCard: { minHeight: 120, borderRadius: 18, padding: 16, backgroundColor: '#111218', borderWidth: 1, borderColor: '#292A33' },
  dashboardLoading: { minHeight: 88, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  dashboardLoadingText: { color: '#858791', fontSize: 11, marginLeft: 9 },
  streakContent: { flexDirection: 'row', alignItems: 'center' },
  streakIconWrap: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#2B2140', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  streakIcon: { color: '#B18CF7', fontSize: 28, fontWeight: '900' },
  streakInfo: { flex: 1 },
  streakValue: { color: '#F3F3F5', fontSize: 18, fontWeight: '900' },
  streakDescription: { color: '#7C7E88', fontSize: 11, lineHeight: 17, marginTop: 5 },
  dailyStatsRow: { flexDirection: 'row', alignItems: 'center' },
  dailyStat: { flex: 1, alignItems: 'center' },
  dailyStatDivider: { width: 1, height: 38, backgroundColor: '#2C2D36' },
  dailyStatValue: { color: '#F4F4F6', fontSize: 19, fontWeight: '900' },
  dailyPercentValue: { color: '#B28DF8', fontSize: 19, fontWeight: '900' },
  dailyStatLabel: { color: '#777983', fontSize: 9, fontWeight: '700', marginTop: 4 },
  dailyProgressTrack: { height: 8, borderRadius: 4, backgroundColor: '#24252D', overflow: 'hidden', marginTop: 17 },
  dailyProgressFill: { height: '100%', borderRadius: 4, backgroundColor: '#9368EB' },
  goalEditor: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 9, marginTop: 17, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#292A33' },
  goalInputGroup: { flex: 1, minWidth: 100 },
  goalInput: { height: 44, borderRadius: 13, paddingHorizontal: 13, backgroundColor: '#090A0F', borderWidth: 1, borderColor: '#30313A', color: '#F4F4F6', fontSize: 14, fontWeight: '700' },
  goalSaveButton: { minWidth: 88, height: 44, borderRadius: 13, backgroundColor: '#8058D9', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14 },
  goalSaveButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  sameReadersCard: { minHeight: 124, borderRadius: 18, paddingVertical: 16, backgroundColor: '#111218', borderWidth: 1, borderColor: '#292A33', justifyContent: 'center' },
  sameReadersLoading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  sameReadersLoadingText: { color: '#858791', fontSize: 11, marginLeft: 9 },
  sameReadersList: { paddingHorizontal: 16, gap: 14 },
  sameReaderItem: { width: 70, alignItems: 'center' },
  sameReaderAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#252630', borderWidth: 2, borderColor: '#8B62E1' },
  sameReaderAvatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  sameReaderInitial: { color: '#E9DFFF', fontSize: 20, fontWeight: '900' },
  sameReaderName: { width: '100%', color: '#DADAE0', fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  sameReadersEmptyText: { color: '#777983', fontSize: 11, lineHeight: 18, textAlign: 'center', paddingHorizontal: 24 },
  featureCard: { minHeight: 142, borderRadius: 18, padding: 16, backgroundColor: '#111218', borderWidth: 1, borderColor: '#292A33' },
  compactFeatureCard: { minHeight: 172 },
  featureIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#282039', justifyContent: 'center', alignItems: 'center' },
  featureIcon: { color: '#AA85F4', fontSize: 21, fontWeight: '800' },
  featureTitle: { color: '#EDEDF0', fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: 13 },
  featureDescription: { color: '#777983', fontSize: 11, lineHeight: 17, marginTop: 6 },
  shelfGrid: { flexDirection: 'row', gap: 9 },
  shelfButton: { flex: 1, minHeight: 112, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 13, backgroundColor: '#111218', borderWidth: 1, borderColor: '#292A33', alignItems: 'center', justifyContent: 'center' },
  shelfIconWrap: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 9 },
  shelfIcon: { fontSize: 18, fontWeight: '900' },
  shelfLabel: { color: '#D9D9DE', fontSize: 10, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
});
