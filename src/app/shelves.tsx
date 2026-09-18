import { BookCoverData, existingBookCover } from '@/lib/open-library-cover';
import BookCover from '@/components/BookCover';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { DEFAULT_PREMIUM_SHELF_CUSTOMIZATION, loadOwnShelfCustomization, PremiumShelfCustomization, SHELF_ACCENTS } from '@/lib/shelf-customization';
import { usePremium } from '@/providers/PremiumProvider';

type Author = string | { name?: string };

type Book = BookCoverData & {
  key?: string;
  title?: string;
  authors?: Author[];
  covers?: number[];
  first_publish_year?: number;
  status?: 'reading' | 'read' | 'want';
};

type Filter = 'all' | 'reading' | 'read' | 'want';
const SHELF_PAGE_SIZE = 30;

type UserBookStatusRow = {
  book_key: string;
  book_title: string | null;
  status: 'reading' | 'read' | 'want';
};

export default function ShelvesScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const premium = usePremium();
  const [shelfCustomization, setShelfCustomization] = useState<PremiumShelfCustomization | null>(null);

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [serverCounts, setServerCounts] = useState({ want: 0, reading: 0, read: 0, total: 0 });

  const loadBooks = useCallback(async (reset = true, offset = 0) => {
    if (reset) {
      setLoading(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError && userError.name !== 'AuthSessionMissingError') {
        throw userError;
      }

      if (!user) {
        setBooks([]);
        setShelfCustomization(null);
        setServerCounts({ want: 0, reading: 0, read: 0, total: 0 });
        return;
      }

      if (reset) {
        if (premium.ready && premium.isPremium) {
          const customization = await loadOwnShelfCustomization(user.id).catch(() => null);
          setShelfCustomization(customization);
        } else {
          setShelfCustomization(null);
        }

        const countsResult = await supabase.rpc('get_my_shelf_counts');
        if (!countsResult.error) {
          const row = Array.isArray(countsResult.data) ? countsResult.data[0] : countsResult.data;
          setServerCounts({
            want: Number(row?.want_count) || 0,
            reading: Number(row?.reading_count) || 0,
            read: Number(row?.read_count) || 0,
            total: Number(row?.total_count) || 0,
          });
        }
      }

      let request = supabase
        .from('user_book_status')
        .select('book_key, book_title, status')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .range(offset, offset + SHELF_PAGE_SIZE - 1);

      if (filter !== 'all') {
        request = request.eq('status', filter);
      }

      const { data, error } = await request;
      if (error) throw error;

      const serverBooks = ((data ?? []) as UserBookStatusRow[]).map((row) => ({
        key: row.book_key,
        title: row.book_title ?? 'Bilinmeyen kitap',
        status: row.status,
      }));

      setBooks((current) => {
        if (reset) return serverBooks;
        const existing = new Set(current.map((book) => book.key));
        return [...current, ...serverBooks.filter((book) => !existing.has(book.key))];
      });
      setHasMore(serverBooks.length === SHELF_PAGE_SIZE);
    } catch (error) {
      console.error('Raflar yüklenemedi:', error);
      if (reset) setBooks([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, premium.isPremium, premium.ready]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadBooks(true);
    }, [loadBooks])
  );

  async function changeStatus(
    key: string,
    newStatus: Book['status']
  ) {
    if (!newStatus) return;

    const currentBook = books.find((book) => book.key === key);
    if (!currentBook) return;

    try {
      const { error } = await supabase.rpc('set_user_book_status', {
        p_book_key: key,
        p_book_title: currentBook.title ?? '',
        p_status: newStatus,
      });

      if (error) throw error;

      setBooks((current) =>
        current.map((book) =>
          book.key === key ? { ...book, status: newStatus } : book
        )
      );
    } catch (error) {
      console.error('Kitap durumu değiştirilemedi:', error);
      Alert.alert('Durum değiştirilemedi', 'Lütfen tekrar dene.');
    }
  }

  async function removeBook(key: string) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError && userError.name !== 'AuthSessionMissingError') {
        throw userError;
      }

      if (!user) {
        Alert.alert('Giriş gerekli', 'Rafını düzenlemek için giriş yapmalısın.');
        return;
      }

      const { error } = await supabase
        .from('user_book_status')
        .delete()
        .eq('user_id', user.id)
        .eq('book_key', key);

      if (error) throw error;

      setBooks((current) => current.filter((book) => book.key !== key));
    } catch (error) {
      console.error('Kitap silme hatası:', error);
      Alert.alert('Kitap silinemedi', 'Lütfen tekrar dene.');
    }
  }

  function getAuthorName(book: Book) {
    const names = book.authors
      ?.map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        return item.name;
      })
      .filter(Boolean)
      .join(', ');

    return names || 'Bilinmeyen yazar';
  }

  function getStatusText(status?: Book['status']) {
    switch (status) {
      case 'reading':
        return `📖 ${shelfLabels.reading}`;

      case 'read':
        return `✅ ${shelfLabels.read}`;

      case 'want':
      default:
        return `📚 ${shelfLabels.want}`;
    }
  }

  const activeCustomization = premium.isPremium ? shelfCustomization : null;
  const shelfLabels = {
    want: activeCustomization?.want_label ?? DEFAULT_PREMIUM_SHELF_CUSTOMIZATION.want_label,
    reading: activeCustomization?.reading_label ?? DEFAULT_PREMIUM_SHELF_CUSTOMIZATION.reading_label,
    read: activeCustomization?.read_label ?? DEFAULT_PREMIUM_SHELF_CUSTOMIZATION.read_label,
  };
  const shelfAccent = SHELF_ACCENTS[activeCustomization?.accent_key ?? 'purple'];
  const shelfCounts = serverCounts;
  const filteredBooks = books;
  const activeShelfCount =
    filter === 'all'
      ? serverCounts.total
      : filter === 'reading'
        ? serverCounts.reading
        : filter === 'read'
          ? serverCounts.read
          : serverCounts.want;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>
          Raflarım
        </Text>

        <Text style={styles.subtitle}>
          Kitaplarını ve okuma durumlarını yönet
        </Text>

        {premium.isPremium ? (
          <Pressable
            onPress={() => router.push('/premium-shelf-customization')}
            style={[styles.premiumShelfButton, { borderColor: shelfAccent }]}
          >
            <Text style={[styles.premiumShelfButtonText, { color: shelfAccent }]}>✦ Raf görünümünü kişiselleştir</Text>
            <Text style={[styles.premiumShelfButtonArrow, { color: shelfAccent }]}>›</Text>
          </Pressable>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          <Pressable
            onPress={() => setFilter('all')}
            style={[
              styles.filterButton,
              filter === 'all' && styles.activeFilter,
              filter === 'all' && { borderColor: shelfAccent },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'all' &&
                  styles.activeFilterText,
              ]}
            >
              Tümü
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('reading')}
            style={[
              styles.filterButton,
              filter === 'reading' &&
                styles.activeFilter,
              filter === 'reading' && { borderColor: shelfAccent },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'reading' &&
                  styles.activeFilterText,
              ]}
            >
              📖 {shelfLabels.reading}{activeCustomization?.show_counts ? ` (${shelfCounts.reading})` : ''}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('read')}
            style={[
              styles.filterButton,
              filter === 'read' &&
                styles.activeFilter,
              filter === 'read' && { borderColor: shelfAccent },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'read' &&
                  styles.activeFilterText,
              ]}
            >
              ✅ {shelfLabels.read}{activeCustomization?.show_counts ? ` (${shelfCounts.read})` : ''}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('want')}
            style={[
              styles.filterButton,
              filter === 'want' &&
                styles.activeFilter,
              filter === 'want' && { borderColor: shelfAccent },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'want' &&
                  styles.activeFilterText,
              ]}
            >
              📚 {shelfLabels.want}{activeCustomization?.show_counts ? ` (${shelfCounts.want})` : ''}
            </Text>
          </Pressable>
        </ScrollView>

        {loading ? (
          <Text style={styles.info}>
            Kitaplar yükleniyor...
          </Text>
        ) : books.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>
              📚
            </Text>

            <Text style={styles.emptyTitle}>
              Rafın henüz boş
            </Text>

            <Text style={styles.emptyText}>
              Keşfet bölümünden kitap bulup
              rafına ekleyebilirsin.
            </Text>

            <Pressable
              onPress={() =>
                router.push('/explore')
              }
              style={styles.exploreButton}
            >
              <Text style={styles.exploreButtonText}>
                🔎 Kitap Keşfet
              </Text>
            </Pressable>
          </View>
        ) : filteredBooks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>
              📖
            </Text>

            <Text style={styles.emptyTitle}>
              Bu rafta kitap yok
            </Text>

            <Text style={styles.emptyText}>
              Bu okuma durumunda henüz bir kitap
              bulunmuyor.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.count}>
              {activeShelfCount} kitap
            </Text>

            {filteredBooks.map((book, index) => {
              const coverUrl = existingBookCover(book);

              const bookKey =
                book.key ??
                `${book.title ?? 'book'}-${index}`;

              return (
                <View
                  key={bookKey}
                  style={[styles.bookCard, activeCustomization?.layout_key === 'compact' && styles.compactBookCard]}
                >
                  <Pressable
                    style={styles.bookPressable}
                    onPress={() => {
                      if (!book.key) {
                        return;
                      }

                      router.push({
                        pathname: '/book',
                        params: {
                          key: book.key,
                          title: book.title,
                          coverUrl: existingBookCover(book) ?? undefined,
                          author: getAuthorName(book),
                        },
                      });
                    }}
                  >
                    <BookCover uri={coverUrl} style={styles.cover}>
                      <View style={styles.noCover}>
                        <Text style={styles.noCoverText}>
                          Kapak yok
                        </Text>
                      </View>
                    </BookCover>

                    <View style={styles.bookInfo}>
                      <Text
                        style={styles.bookTitle}
                        numberOfLines={2}
                      >
                        {book.title ??
                          'Bilinmeyen kitap'}
                      </Text>

                      <Text
                        style={styles.author}
                        numberOfLines={2}
                      >
                        {getAuthorName(book)}
                      </Text>

                      <Text style={styles.status}>
                        {getStatusText(book.status)}
                      </Text>

                      {book.first_publish_year && (
                        <Text style={styles.year}>
                          İlk yayın:{' '}
                          {book.first_publish_year}
                        </Text>
                      )}
                    </View>
                  </Pressable>

                  <View style={styles.statusSection}>
                    <Text style={styles.statusLabel}>
                      Okuma durumunu değiştir
                    </Text>

                    <View style={styles.statusButtons}>
                      <Pressable
                        onPress={() => {
                          if (book.key) {
                            changeStatus(
                              book.key,
                              'want'
                            );
                          }
                        }}
                        style={[
                          styles.smallStatusButton,
                          book.status === 'want' &&
                            styles.selectedSmallStatus,
                        ]}
                      >
                        <Text
                          style={
                            styles.smallStatusText
                          }
                        >
                          📚
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          if (book.key) {
                            changeStatus(
                              book.key,
                              'reading'
                            );
                          }
                        }}
                        style={[
                          styles.smallStatusButton,
                          book.status ===
                            'reading' &&
                            styles.selectedSmallStatus,
                        ]}
                      >
                        <Text
                          style={
                            styles.smallStatusText
                          }
                        >
                          📖
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          if (book.key) {
                            changeStatus(
                              book.key,
                              'read'
                            );
                          }
                        }}
                        style={[
                          styles.smallStatusButton,
                          book.status === 'read' &&
                            styles.selectedSmallStatus,
                        ]}
                      >
                        <Text
                          style={
                            styles.smallStatusText
                          }
                        >
                          ✅
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => {
                      if (!book.key) {
                        Alert.alert(
                          'Hata',
                          'Bu kitabın kimliği bulunamadı.'
                        );
                        return;
                      }

                      void removeBook(book.key);
                    }}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed &&
                        styles.deleteButtonPressed,
                    ]}
                  >
                    <Text style={styles.deleteText}>
                      🗑️ Kitabı Rafımdan Sil
                    </Text>
                  </Pressable>
                </View>
              );
            })}

            {hasMore ? (
              <Pressable
                onPress={() => void loadBooks(false, books.length)}
                disabled={loadingMore}
                style={styles.loadMoreButton}
              >
                <Text style={styles.loadMoreText}>
                  {loadingMore ? 'Yükleniyor…' : 'Daha fazla göster'}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090A0F',
  },

  content: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 110,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F5F5F7',
  },

  subtitle: {
    marginTop: 6,
    color: '#9A9AA4',
    fontSize: 14,
  },

  filterContainer: {
    gap: 8,
    paddingVertical: 20,
  },

  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#15161D',
    borderWidth: 1,
    borderColor: '#2A2B34',
  },

  activeFilter: {
    backgroundColor: '#2B2140',
    borderColor: '#8B5CF6',
  },

  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A0A0AA',
  },

  activeFilterText: {
    color: '#D9CCFF',
  },

  info: {
    marginTop: 40,
    textAlign: 'center',
    color: '#9A9AA4',
  },

  loadMoreButton: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#21182F',
    borderWidth: 1,
    borderColor: '#38284D',
  },

  loadMoreText: {
    color: '#A985FF',
    fontSize: 13,
    fontWeight: '800',
  },

  count: {
    marginBottom: 12,
    fontSize: 13,
    color: '#8E8E98',
    fontWeight: '600',
  },

  empty: {
    alignItems: 'center',
    marginTop: 40,
    marginHorizontal: 0,
    paddingHorizontal: 24,
    paddingVertical: 34,
    borderRadius: 20,
    backgroundColor: '#15161D',
    borderWidth: 1,
    borderColor: '#25262F',
  },

  emptyIcon: {
    fontSize: 44,
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F5F5F7',
  },

  emptyText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#9A9AA4',
    lineHeight: 21,
  },

  exploreButton: {
    marginTop: 25,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
  },

  exploreButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  bookCard: {
    backgroundColor: '#15161D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#25262F',
    marginBottom: 14,
    overflow: 'hidden',
  },

  bookPressable: {
    flexDirection: 'row',
    padding: 14,
  },

  cover: {
    width: 86,
    height: 128,
    borderRadius: 10,
    backgroundColor: '#20212A',
  },

  noCover: {
    width: 86,
    height: 128,
    borderRadius: 10,
    backgroundColor: '#20212A',
    borderWidth: 1,
    borderColor: '#30313A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  noCoverText: {
    color: '#777984',
    fontSize: 11,
    textAlign: 'center',
  },

  bookInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
    paddingVertical: 2,
  },

  bookTitle: {
    color: '#F5F5F7',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },

  author: {
    marginTop: 6,
    color: '#A0A1AA',
    fontSize: 13,
    lineHeight: 18,
  },

  status: {
    marginTop: 10,
    alignSelf: 'flex-start',
    color: '#CDB7F8',
    fontSize: 12,
    fontWeight: '700',
  },

  year: {
    marginTop: 7,
    color: '#6F707A',
    fontSize: 11,
  },

  statusSection: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#25262F',
  },

  statusLabel: {
    color: '#8E8E98',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
  },

  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  smallStatusButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1B1C24',
    borderWidth: 1,
    borderColor: '#2B2C35',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedSmallStatus: {
    backgroundColor: '#2B2140',
    borderColor: '#8B5CF6',
  },

  smallStatusText: {
    fontSize: 18,
  },

  deleteButton: {
    marginHorizontal: 14,
    marginBottom: 14,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#1C171A',
    borderWidth: 1,
    borderColor: '#4A292F',
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteButtonPressed: {
    opacity: 0.7,
  },

  deleteText: {
    color: '#D98792',
    fontSize: 12,
    fontWeight: '700',
  },

  premiumShelfButton: {
    marginTop: 14,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#15161D',
  },

  premiumShelfButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },

  premiumShelfButtonArrow: {
    fontSize: 25,
    lineHeight: 26,
    fontWeight: '700',
  },

  compactBookCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },

});
