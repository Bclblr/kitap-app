import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';

type Author = string | { name?: string };

type Book = {
  key?: string;
  title?: string;
  authors?: Author[];
  covers?: number[];
  first_publish_year?: number;
  status?: 'reading' | 'read' | 'want';
};

type Filter = 'all' | 'reading' | 'read' | 'want';

async function syncBookStatusToSupabase(
  bookKey: string,
  bookTitle: string,
  status: NonNullable<Book['status']>
) {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error(
        'Kitap durumu kullanıcı kontrolü başarısız:',
        userError
      );
      return;
    }

    if (!user) return;

    const { error } = await supabase.rpc(
      'set_user_book_status',
      {
        p_book_key: bookKey,
        p_book_title: bookTitle,
        p_status: status,
      }
    );

    if (error) {
      console.error(
        'Kitap durumu Supabase ile eşitlenemedi:',
        error
      );
    }
  } catch (error) {
    console.error(
      'Kitap durumu senkronizasyon hatası:',
      error
    );
  }
}

export default function ShelvesScreen() {
  const router = useRouter();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  const loadBooks = useCallback(async () => {
    try {
      const savedBooks = await AsyncStorage.getItem('myBooks');

      if (!savedBooks) {
        setBooks([]);
        return;
      }

      const parsedBooks: Book[] = JSON.parse(savedBooks);

      const updatedBooks = parsedBooks.map((book) => ({
        ...book,
        status: book.status ?? 'want',
      }));

      setBooks(updatedBooks);

      await AsyncStorage.setItem(
        'myBooks',
        JSON.stringify(updatedBooks)
      );
    } catch (error) {
      console.error('Raflar yüklenemedi:', error);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadBooks();
    }, [loadBooks])
  );

  async function changeStatus(
    key: string,
    newStatus: Book['status']
  ) {
    try {
      const savedBooks = await AsyncStorage.getItem('myBooks');

      const currentBooks: Book[] = savedBooks
        ? JSON.parse(savedBooks)
        : [];

      const updatedBooks = currentBooks.map((book) => {
        if (book.key !== key) {
          return book;
        }

        return {
          ...book,
          status: newStatus,
        };
      });

      await AsyncStorage.setItem(
        'myBooks',
        JSON.stringify(updatedBooks)
      );

      setBooks(updatedBooks);

      const updatedBook = updatedBooks.find(
        (book) => book.key === key
      );

      if (newStatus && updatedBook) {
        void syncBookStatusToSupabase(
          key,
          updatedBook.title ?? '',
          newStatus
        );
      }
    } catch (error) {
      console.error(
        'Kitap durumu değiştirilemedi:',
        error
      );
    }
  }

  async function removeBook(key: string) {
    try {
      const savedBooks = await AsyncStorage.getItem('myBooks');

      const currentBooks: Book[] = savedBooks
        ? JSON.parse(savedBooks)
        : [];

      const updatedBooks = currentBooks.filter(
        (book) => book.key !== key
      );

      await AsyncStorage.setItem(
        'myBooks',
        JSON.stringify(updatedBooks)
      );

      setBooks(updatedBooks);
    } catch (error) {
      console.error('Kitap silme hatası:', error);
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
        return '📖 Okuyorum';

      case 'read':
        return '✅ Okudum';

      case 'want':
      default:
        return '📚 Okuyacağım';
    }
  }

  const filteredBooks =
    filter === 'all'
      ? books
      : books.filter(
          (book) => book.status === filter
        );

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
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'reading' &&
                  styles.activeFilterText,
              ]}
            >
              📖 Okuyorum
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('read')}
            style={[
              styles.filterButton,
              filter === 'read' &&
                styles.activeFilter,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'read' &&
                  styles.activeFilterText,
              ]}
            >
              ✅ Okudum
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('want')}
            style={[
              styles.filterButton,
              filter === 'want' &&
                styles.activeFilter,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'want' &&
                  styles.activeFilterText,
              ]}
            >
              📚 Okuyacağım
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
              {filteredBooks.length} kitap
            </Text>

            {filteredBooks.map((book, index) => {
              const coverUrl =
                book.covers?.[0]
                  ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-M.jpg`
                  : null;

              const bookKey =
                book.key ??
                `${book.title ?? 'book'}-${index}`;

              return (
                <View
                  key={bookKey}
                  style={styles.bookCard}
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
                          author: getAuthorName(book),
                        },
                      });
                    }}
                  >
                    {coverUrl ? (
                      <Image
                        source={{ uri: coverUrl }}
                        style={styles.cover}
                      />
                    ) : (
                      <View style={styles.noCover}>
                        <Text style={styles.noCoverText}>
                          Kapak yok
                        </Text>
                      </View>
                    )}

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

                      removeBook(book.key);
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
          </>
        )}
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
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
});
