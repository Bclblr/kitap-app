import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

// BOOK_DARK_PREMIUM_V1

type Author = string | { name?: string };

type Book = {
  key?: string;
  title?: string;
  authors?: Author[];
  description?: string | { value?: string };
  covers?: number[];
  first_publish_year?: number;
  status?: 'reading' | 'read' | 'want';
};

type Quote = {
  id: string;
  bookKey: string;
  bookTitle: string;
  text: string;
  createdAt: string;
};

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

    if (!user) {
      return;
    }

    const { error } = await supabase.rpc('set_user_book_status', {
      p_book_key: bookKey,
      p_book_title: bookTitle,
      p_status: status,
    });

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

export default function BookScreen() {
  const { key, author } = useLocalSearchParams<{
    key?: string;
    author?: string;
  }>();

  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [status, setStatus] = useState<Book['status']>('want');

  const [showQuoteBox, setShowQuoteBox] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [savingQuote, setSavingQuote] = useState(false);
  const [quoteSaved, setQuoteSaved] = useState(false);

  useEffect(() => {
    async function getBook() {
      if (!key) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `https://openlibrary.org${key}.json`
        );

        if (!response.ok) {
          throw new Error('Kitap bilgisi alınamadı');
        }

        const data = await response.json();

        const savedBooks =
          await AsyncStorage.getItem('myBooks');

        if (savedBooks) {
          const books: Book[] = JSON.parse(savedBooks);

          const savedBook = books.find(
            (item) => item.key === key
          );

          if (savedBook) {
            setAdded(true);
            setStatus(savedBook.status ?? 'want');
          }
        }

        setBook(data);
      } catch (error) {
        console.error('Kitap detay hatası:', error);
      } finally {
        setLoading(false);
      }
    }

    getBook();
  }, [key]);

  async function addToShelf() {
    if (!book || !key) {
      return;
    }

    try {
      const savedBooks =
        await AsyncStorage.getItem('myBooks');

      const books: Book[] = savedBooks
        ? JSON.parse(savedBooks)
        : [];

      const existingIndex = books.findIndex(
        (item) => item.key === key
      );

      const newBook: Book = {
        ...book,
        key,
        status,
        authors:
          book.authors && book.authors.length > 0
            ? book.authors
            : author
              ? [author]
              : [],
      };

      if (existingIndex >= 0) {
        books[existingIndex] = newBook;
      } else {
        books.push(newBook);
      }

      await AsyncStorage.setItem(
        'myBooks',
        JSON.stringify(books)
      );

      setAdded(true);

      void syncBookStatusToSupabase(
        key,
        book.title ?? '',
        status ?? 'want'
      );
    } catch (error) {
      console.error('Rafa ekleme hatası:', error);
    }
  }

  async function changeStatus(
    newStatus: Book['status']
  ) {
    setStatus(newStatus);

    if (!book || !key) {
      return;
    }

    try {
      const savedBooks =
        await AsyncStorage.getItem('myBooks');

      const books: Book[] = savedBooks
        ? JSON.parse(savedBooks)
        : [];

      const existingIndex = books.findIndex(
        (item) => item.key === key
      );

      const updatedBook: Book = {
        ...book,
        key,
        status: newStatus,
        authors:
          book.authors && book.authors.length > 0
            ? book.authors
            : author
              ? [author]
              : [],
      };

      if (existingIndex >= 0) {
        books[existingIndex] = updatedBook;
      } else {
        books.push(updatedBook);
      }

      await AsyncStorage.setItem(
        'myBooks',
        JSON.stringify(books)
      );

      setAdded(true);

      if (newStatus) {
        void syncBookStatusToSupabase(
          key,
          book.title ?? '',
          newStatus
        );
      }
    } catch (error) {
      console.error('Durum kaydetme hatası:', error);
    }
  }

  async function saveQuote() {
    const cleanQuote = quoteText.trim();

    if (!cleanQuote || !book || !key) {
      return;
    }

    setSavingQuote(true);

    try {
      const savedQuotes =
        await AsyncStorage.getItem('quotes');

      const quotes: Quote[] = savedQuotes
        ? JSON.parse(savedQuotes)
        : [];

      const newQuote: Quote = {
        id:
          Date.now().toString() +
          Math.random().toString(36).slice(2),
        bookKey: key,
        bookTitle: book.title ?? 'Bilinmeyen kitap',
        text: cleanQuote,
        createdAt: new Date().toISOString(),
      };

      quotes.unshift(newQuote);

      await AsyncStorage.setItem(
        'quotes',
        JSON.stringify(quotes)
      );

      setQuoteText('');
      setShowQuoteBox(false);
      setQuoteSaved(true);

      setTimeout(() => {
        setQuoteSaved(false);
      }, 2500);
    } catch (error) {
      console.error('Alıntı kaydedilemedi:', error);
    } finally {
      setSavingQuote(false);
    }
  }

  function openReview() {
    if (!key) {
      console.log(
        'İnceleme açılamadı: kitap key yok'
      );
      return;
    }

    router.push({
      pathname: '/review',
      params: {
        key,
        title: book?.title ?? 'Bilinmeyen kitap',
      },
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#A985FF"
        />
        <Text style={styles.loadingText}>
          Kitap bilgileri yükleniyor...
        </Text>
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}>
          <Feather
            name="book"
            size={24}
            color="#A985FF"
          />
        </View>

        <Text style={styles.errorTitle}>
          Kitap bulunamadı
        </Text>

        <Text style={styles.errorText}>
          Kitap bilgilerine şu anda ulaşılamıyor.
        </Text>

        <Pressable
          onPress={() => router.replace('/explore')}
          style={styles.backButton}
        >
          <Feather
            name="arrow-left"
            size={17}
            color="#F4F5F7"
          />
          <Text style={styles.backButtonText}>
            Keşfet'e dön
          </Text>
        </Pressable>
      </View>
    );
  }

  const coverUrl = book.covers?.[0]
    ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-L.jpg`
    : null;

  const description =
    typeof book.description === 'string'
      ? book.description
      : book.description?.value;

  const authorNames =
    book.authors
      ?.map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        return item.name;
      })
      .filter(Boolean)
      .join(', ') ||
    author ||
    'Bilinmeyen yazar';

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              style={styles.iconButton}
            >
              <Feather
                name="arrow-left"
                size={21}
                color="#F4F5F7"
              />
            </Pressable>

            <Text style={styles.pageTitle}>
              Kitap Detayı
            </Text>

            <View style={styles.iconButtonPlaceholder} />
          </View>

          <View style={styles.heroCard}>
            <View style={styles.coverShadow}>
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl }}
                  style={styles.cover}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.noCover}>
                  <Feather
                    name="book-open"
                    size={34}
                    color="#717784"
                  />
                  <Text style={styles.noCoverText}>
                    Kapak yok
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.bookInfo}>
              <View style={styles.eyebrow}>
                <Feather
                  name="book"
                  size={13}
                  color="#A985FF"
                />
                <Text style={styles.eyebrowText}>
                  KİTAP
                </Text>
              </View>

              <Text style={styles.title}>
                {book.title ?? 'Bilinmeyen kitap'}
              </Text>

              <Text style={styles.author}>
                {authorNames}
              </Text>

              {book.first_publish_year ? (
                <View style={styles.metaRow}>
                  <Feather
                    name="calendar"
                    size={14}
                    color="#8F96A3"
                  />
                  <Text style={styles.metaText}>
                    İlk yayın {book.first_publish_year}
                  </Text>
                </View>
              ) : null}

              {added ? (
                <View style={styles.shelfBadge}>
                  <Feather
                    name="check"
                    size={13}
                    color="#C8B6FF"
                  />
                  <Text style={styles.shelfBadgeText}>
                    Rafında
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>
                Okuma Durumu
              </Text>
              <Text style={styles.sectionHint}>
                Durumunu seç
              </Text>
            </View>

            <View style={styles.statusRow}>
              <Pressable
                onPress={() => changeStatus('want')}
                style={[
                  styles.statusButton,
                  status === 'want' &&
                    styles.statusButtonSelected,
                ]}
              >
                <View
                  style={[
                    styles.statusIcon,
                    status === 'want' &&
                      styles.statusIconSelected,
                  ]}
                >
                  <Feather
                    name="bookmark"
                    size={17}
                    color={
                      status === 'want'
                        ? '#F4F5F7'
                        : '#8F96A3'
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.statusText,
                    status === 'want' &&
                      styles.statusTextSelected,
                  ]}
                >
                  Okuyacağım
                </Text>
              </Pressable>

              <Pressable
                onPress={() => changeStatus('reading')}
                style={[
                  styles.statusButton,
                  status === 'reading' &&
                    styles.statusButtonSelected,
                ]}
              >
                <View
                  style={[
                    styles.statusIcon,
                    status === 'reading' &&
                      styles.statusIconSelected,
                  ]}
                >
                  <Feather
                    name="book-open"
                    size={17}
                    color={
                      status === 'reading'
                        ? '#F4F5F7'
                        : '#8F96A3'
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.statusText,
                    status === 'reading' &&
                      styles.statusTextSelected,
                  ]}
                >
                  Okuyorum
                </Text>
              </Pressable>

              <Pressable
                onPress={() => changeStatus('read')}
                style={[
                  styles.statusButton,
                  status === 'read' &&
                    styles.statusButtonSelected,
                ]}
              >
                <View
                  style={[
                    styles.statusIcon,
                    status === 'read' &&
                      styles.statusIconSelected,
                  ]}
                >
                  <Feather
                    name="check-circle"
                    size={17}
                    color={
                      status === 'read'
                        ? '#F4F5F7'
                        : '#8F96A3'
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.statusText,
                    status === 'read' &&
                      styles.statusTextSelected,
                  ]}
                >
                  Okudum
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.actionGrid}>
            <Pressable
              onPress={openReview}
              style={styles.actionCard}
            >
              <View style={styles.actionIcon}>
                <Feather
                  name="edit-3"
                  size={20}
                  color="#C8B6FF"
                />
              </View>

              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>
                  İnceleme Yaz
                </Text>
                <Text style={styles.actionSubtitle}>
                  Kitap hakkındaki düşüncelerini paylaş
                </Text>
              </View>

              <Feather
                name="chevron-right"
                size={20}
                color="#707784"
              />
            </Pressable>

            <Pressable
              onPress={() =>
                setShowQuoteBox((current) => !current)
              }
              style={styles.actionCard}
            >
              <View style={styles.actionIcon}>
                <Feather
                  name="type"
                  size={20}
                  color="#C8B6FF"
                />
              </View>

              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>
                  Alıntı Ekle
                </Text>
                <Text style={styles.actionSubtitle}>
                  Altını çizdiğin bir bölümü kaydet
                </Text>
              </View>

              <Feather
                name={
                  showQuoteBox
                    ? 'chevron-up'
                    : 'chevron-right'
                }
                size={20}
                color="#707784"
              />
            </Pressable>
          </View>

          {showQuoteBox ? (
            <View style={styles.quoteBox}>
              <View style={styles.quoteHeader}>
                <View>
                  <Text style={styles.quoteTitle}>
                    Yeni Alıntı
                  </Text>
                  <Text style={styles.quoteSubtitle}>
                    Bu kitaptan kaydetmek istediğin bölüm
                  </Text>
                </View>

                <Text style={styles.characterCount}>
                  {quoteText.length}/1000
                </Text>
              </View>

              <TextInput
                value={quoteText}
                onChangeText={setQuoteText}
                placeholder="Alıntıyı buraya yaz..."
                placeholderTextColor="#676E7A"
                multiline
                maxLength={1000}
                textAlignVertical="top"
                style={styles.quoteInput}
              />

              <View style={styles.quoteActions}>
                <Pressable
                  onPress={() => {
                    setQuoteText('');
                    setShowQuoteBox(false);
                  }}
                  style={styles.cancelQuoteButton}
                >
                  <Text style={styles.cancelQuoteText}>
                    Vazgeç
                  </Text>
                </Pressable>

                <Pressable
                  onPress={saveQuote}
                  disabled={
                    savingQuote || !quoteText.trim()
                  }
                  style={[
                    styles.saveQuoteButton,
                    (!quoteText.trim() ||
                      savingQuote) &&
                      styles.disabledButton,
                  ]}
                >
                  <Feather
                    name="check"
                    size={16}
                    color="#0B0C0F"
                  />
                  <Text style={styles.saveQuoteText}>
                    {savingQuote
                      ? 'Kaydediliyor...'
                      : 'Kaydet'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {quoteSaved ? (
            <View style={styles.successBox}>
              <View style={styles.successIcon}>
                <Feather
                  name="check"
                  size={15}
                  color="#B8F3D1"
                />
              </View>
              <Text style={styles.successText}>
                Alıntı kaydedildi
              </Text>
            </View>
          ) : null}

          {description ? (
            <View style={styles.descriptionBox}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionTitle}>
                  Kitap Hakkında
                </Text>
                <Feather
                  name="align-left"
                  size={17}
                  color="#747B88"
                />
              </View>

              <Text style={styles.description}>
                {description}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={addToShelf}
            style={[
              styles.addButton,
              added && styles.addedButton,
            ]}
          >
            <View style={styles.addButtonIcon}>
              <Feather
                name={added ? 'check' : 'plus'}
                size={19}
                color={added ? '#C8B6FF' : '#0B0C0F'}
              />
            </View>

            <View style={styles.addButtonCopy}>
              <Text
                style={[
                  styles.addButtonText,
                  added && styles.addedButtonText,
                ]}
              >
                {added ? 'Kitap Rafında' : 'Rafıma Ekle'}
              </Text>

              <Text
                style={[
                  styles.addButtonSubtext,
                  added && styles.addedButtonSubtext,
                ]}
              >
                {added
                  ? 'Okuma durumun kaydedildi'
                  : 'Kitabı kütüphanene kaydet'}
              </Text>
            </View>

            <Feather
              name="chevron-right"
              size={20}
              color={added ? '#8673C8' : '#292C32'}
            />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08090C',
  },

  scrollContent: {
    paddingBottom: 42,
  },

  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#08090C',
    paddingHorizontal: 28,
  },

  loadingText: {
    marginTop: 14,
    color: '#8F96A3',
    fontSize: 14,
  },

  errorIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17131F',
    borderWidth: 1,
    borderColor: '#2A2238',
    marginBottom: 16,
  },

  errorTitle: {
    color: '#F4F5F7',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 7,
  },

  errorText: {
    color: '#8F96A3',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
  },

  backButton: {
    minHeight: 46,
    paddingHorizontal: 17,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#15171C',
    borderWidth: 1,
    borderColor: '#252830',
  },

  backButtonText: {
    color: '#F4F5F7',
    fontSize: 14,
    fontWeight: '700',
  },

  topBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121419',
    borderWidth: 1,
    borderColor: '#22252C',
  },

  iconButtonPlaceholder: {
    width: 42,
    height: 42,
  },

  pageTitle: {
    color: '#F4F5F7',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  heroCard: {
    flexDirection: 'row',
    gap: 18,
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#111318',
    borderWidth: 1,
    borderColor: '#23262D',
  },

  coverShadow: {
    borderRadius: 16,
    backgroundColor: '#1A1D23',
  },

  cover: {
    width: 126,
    height: 188,
    borderRadius: 15,
    backgroundColor: '#191C22',
  },

  noCover: {
    width: 126,
    height: 188,
    borderRadius: 15,
    backgroundColor: '#171A20',
    borderWidth: 1,
    borderColor: '#292D35',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  noCoverText: {
    color: '#747B88',
    fontSize: 12,
    fontWeight: '700',
  },

  bookInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },

  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 9,
  },

  eyebrowText: {
    color: '#A985FF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
  },

  title: {
    color: '#F4F5F7',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.3,
  },

  author: {
    color: '#B2B7C0',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 8,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 13,
  },

  metaText: {
    color: '#8F96A3',
    fontSize: 12,
    fontWeight: '600',
  },

  shelfBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 10,
    marginTop: 13,
    backgroundColor: '#1B1527',
    borderWidth: 1,
    borderColor: '#35274D',
  },

  shelfBadgeText: {
    color: '#C8B6FF',
    fontSize: 11,
    fontWeight: '800',
  },

  section: {
    marginTop: 24,
  },

  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },

  sectionTitle: {
    color: '#F4F5F7',
    fontSize: 16,
    fontWeight: '800',
  },

  sectionHint: {
    color: '#747B88',
    fontSize: 12,
    fontWeight: '600',
  },

  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },

  statusButton: {
    flex: 1,
    minHeight: 84,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111318',
    borderWidth: 1,
    borderColor: '#23262D',
  },

  statusButtonSelected: {
    backgroundColor: '#191424',
    borderColor: '#4A376B',
  },

  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#191C22',
  },

  statusIconSelected: {
    backgroundColor: '#4A376B',
  },

  statusText: {
    color: '#8F96A3',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  statusTextSelected: {
    color: '#E8DEFF',
  },

  actionGrid: {
    gap: 10,
    marginTop: 22,
  },

  actionCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 20,
    backgroundColor: '#111318',
    borderWidth: 1,
    borderColor: '#23262D',
  },

  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1525',
    borderWidth: 1,
    borderColor: '#302541',
  },

  actionCopy: {
    flex: 1,
  },

  actionTitle: {
    color: '#F4F5F7',
    fontSize: 14,
    fontWeight: '800',
  },

  actionSubtitle: {
    color: '#7F8692',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },

  quoteBox: {
    marginTop: 12,
    padding: 15,
    borderRadius: 21,
    backgroundColor: '#111318',
    borderWidth: 1,
    borderColor: '#292D35',
  },

  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },

  quoteTitle: {
    color: '#F4F5F7',
    fontSize: 15,
    fontWeight: '800',
  },

  quoteSubtitle: {
    color: '#777E8A',
    fontSize: 11,
    marginTop: 4,
  },

  quoteInput: {
    minHeight: 132,
    maxHeight: 240,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#ECEEF2',
    fontSize: 14,
    lineHeight: 21,
    backgroundColor: '#0B0D11',
    borderWidth: 1,
    borderColor: '#242831',
  },

  characterCount: {
    color: '#626975',
    fontSize: 10,
    fontWeight: '700',
  },

  quoteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 9,
    marginTop: 12,
  },

  cancelQuoteButton: {
    height: 42,
    paddingHorizontal: 15,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17191F',
    borderWidth: 1,
    borderColor: '#292C34',
  },

  cancelQuoteText: {
    color: '#A4AAB4',
    fontSize: 13,
    fontWeight: '700',
  },

  saveQuoteButton: {
    minWidth: 108,
    height: 42,
    paddingHorizontal: 15,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#B69AFF',
  },

  disabledButton: {
    opacity: 0.42,
  },

  saveQuoteText: {
    color: '#0B0C0F',
    fontSize: 13,
    fontWeight: '900',
  },

  successBox: {
    minHeight: 46,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#101B16',
    borderWidth: 1,
    borderColor: '#1E3B2C',
  },

  successIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#173224',
  },

  successText: {
    color: '#B8F3D1',
    fontSize: 13,
    fontWeight: '700',
  },

  descriptionBox: {
    marginTop: 22,
    padding: 17,
    borderRadius: 22,
    backgroundColor: '#111318',
    borderWidth: 1,
    borderColor: '#23262D',
  },

  description: {
    color: '#A6ACB6',
    fontSize: 14,
    lineHeight: 22,
  },

  addButton: {
    minHeight: 70,
    marginTop: 22,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#B69AFF',
  },

  addedButton: {
    backgroundColor: '#17131F',
    borderWidth: 1,
    borderColor: '#35274D',
  },

  addButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 11, 14, 0.10)',
  },

  addButtonCopy: {
    flex: 1,
  },

  addButtonText: {
    color: '#0B0C0F',
    fontSize: 14,
    fontWeight: '900',
  },

  addedButtonText: {
    color: '#D6C8FF',
  },

  addButtonSubtext: {
    color: '#3D334D',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },

  addedButtonSubtext: {
    color: '#82749E',
  },
});
