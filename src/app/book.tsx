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

export default function BookScreen() {
  const { key, author } = useLocalSearchParams<{
    key?: string;
    author?: string;
  }>();

  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  const [status, setStatus] =
    useState<Book['status']>('want');

  const [showQuoteBox, setShowQuoteBox] =
    useState(false);

  const [quoteText, setQuoteText] =
    useState('');

  const [savingQuote, setSavingQuote] =
    useState(false);

  const [quoteSaved, setQuoteSaved] =
    useState(false);

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
          throw new Error(
            'Kitap bilgisi alınamadı'
          );
        }

        const data = await response.json();

        const savedBooks =
          await AsyncStorage.getItem('myBooks');

        if (savedBooks) {
          const books: Book[] =
            JSON.parse(savedBooks);

          const savedBook = books.find(
            (item) => item.key === key
          );

          if (savedBook) {
            setAdded(true);
            setStatus(
              savedBook.status ?? 'want'
            );
          }
        }

        setBook(data);
      } catch (error) {
        console.error(
          'Kitap detay hatası:',
          error
        );
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

      const existingIndex =
        books.findIndex(
          (item) => item.key === key
        );

      const newBook: Book = {
        ...book,
        key,
        status,
        authors:
          book.authors &&
          book.authors.length > 0
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
    } catch (error) {
      console.error(
        'Rafa ekleme hatası:',
        error
      );
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

      const existingIndex =
        books.findIndex(
          (item) => item.key === key
        );

      const updatedBook: Book = {
        ...book,
        key,
        status: newStatus,
        authors:
          book.authors &&
          book.authors.length > 0
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
    } catch (error) {
      console.error(
        'Durum kaydetme hatası:',
        error
      );
    }
  }

  async function saveQuote() {
    const cleanQuote =
      quoteText.trim();

    if (!cleanQuote || !book || !key) {
      return;
    }

    setSavingQuote(true);

    try {
      const savedQuotes =
        await AsyncStorage.getItem('quotes');

      const quotes: Quote[] =
        savedQuotes
          ? JSON.parse(savedQuotes)
          : [];

      const newQuote: Quote = {
        id:
          Date.now().toString() +
          Math.random()
            .toString(36)
            .slice(2),
        bookKey: key,
        bookTitle:
          book.title ??
          'Bilinmeyen kitap',
        text: cleanQuote,
        createdAt:
          new Date().toISOString(),
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
      console.error(
        'Alıntı kaydedilemedi:',
        error
      );
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
        key: key,
        title:
          book?.title ??
          'Bilinmeyen kitap',
      },
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Kitap bilgileri yükleniyor...
        </Text>
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          Kitap bilgileri bulunamadı.
        </Text>

        <Pressable
          onPress={() =>
            router.replace('/explore')
          }
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>
            Keşfet'e Dön
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
        contentContainerStyle={styles.content}
      >
        <Pressable
          onPress={() =>
            router.replace('/explore')
          }
          style={styles.back}
        >
          <Text style={styles.backText}>
            ← Keşfet'e Dön
          </Text>
        </Pressable>

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

        <Text style={styles.title}>
          {book.title ??
            'Bilinmeyen kitap'}
        </Text>

        <Text style={styles.author}>
          {authorNames}
        </Text>

        {book.first_publish_year && (
          <Text style={styles.year}>
            İlk yayın:{' '}
            {book.first_publish_year}
          </Text>
        )}

        {description && (
          <View style={styles.descriptionBox}>
            <Text style={styles.sectionTitle}>
              Kitap Hakkında
            </Text>

            <Text style={styles.description}>
              {description}
            </Text>
          </View>
        )}

        <Text style={styles.statusTitle}>
          Okuma Durumu
        </Text>

        <View style={styles.statusRow}>
          <Pressable
            onPress={() =>
              changeStatus('want')
            }
            style={[
              styles.statusButton,
              status === 'want' &&
                styles.selectedStatus,
            ]}
          >
            <Text style={styles.statusText}>
              📚 Okuyacağım
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              changeStatus('reading')
            }
            style={[
              styles.statusButton,
              status === 'reading' &&
                styles.selectedStatus,
            ]}
          >
            <Text style={styles.statusText}>
              📖 Okuyorum
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              changeStatus('read')
            }
            style={[
              styles.statusButton,
              status === 'read' &&
                styles.selectedStatus,
            ]}
          >
            <Text style={styles.statusText}>
              ✅ Okudum
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={openReview}
          style={styles.reviewButton}
        >
          <Text style={styles.reviewButtonText}>
            📝 İnceleme Yaz
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            setShowQuoteBox(
              !showQuoteBox
            )
          }
          style={styles.quoteButton}
        >
          <Text style={styles.quoteButtonText}>
            ✍️ Alıntı Ekle
          </Text>
        </Pressable>

        {showQuoteBox && (
          <View style={styles.quoteBox}>
            <Text style={styles.quoteTitle}>
              Bu kitaptan bir alıntı
            </Text>

            <TextInput
              value={quoteText}
              onChangeText={setQuoteText}
              placeholder="Alıntıyı buraya yaz..."
              placeholderTextColor="#999"
              multiline
              maxLength={1000}
              style={styles.quoteInput}
            />

            <Text style={styles.characterCount}>
              {quoteText.length}/1000
            </Text>

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
                  savingQuote ||
                  !quoteText.trim()
                }
                style={[
                  styles.saveQuoteButton,
                  (!quoteText.trim() ||
                    savingQuote) &&
                    styles.disabledButton,
                ]}
              >
                <Text style={styles.saveQuoteText}>
                  {savingQuote
                    ? 'Kaydediliyor...'
                    : 'Kaydet'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {quoteSaved && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              ✓ Alıntı kaydedildi
            </Text>
          </View>
        )}

        <Pressable
          onPress={addToShelf}
          style={[
            styles.addButton,
            added &&
              styles.addedButton,
          ]}
        >
          <Text style={styles.addButtonText}>
            {added
              ? '✓ Rafımda'
              : '📚 Rafıma Ekle'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F7F5',
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    color: '#777',
  },

  errorText: {
    fontSize: 17,
    color: '#555',
    textAlign: 'center',
  },

  back: {
    marginBottom: 20,
  },

  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },

  cover: {
    width: 190,
    height: 285,
    borderRadius: 12,
    alignSelf: 'center',
    backgroundColor: '#E8E8E8',
  },

  noCover: {
    width: 190,
    height: 285,
    borderRadius: 12,
    alignSelf: 'center',
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  noCoverText: {
    color: '#777',
  },

  title: {
    marginTop: 25,
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
  },

  author: {
    marginTop: 8,
    fontSize: 17,
    color: '#666',
  },

  year: {
    marginTop: 8,
    fontSize: 14,
    color: '#888',
  },

  descriptionBox: {
    marginTop: 30,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 10,
  },

  description: {
    fontSize: 15,
    lineHeight: 23,
    color: '#555',
  },

  statusTitle: {
    marginTop: 30,
    fontSize: 19,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
  },

  statusRow: {
    gap: 10,
  },

  statusButton: {
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  selectedStatus: {
    borderColor: '#222',
    backgroundColor: '#EEEEEA',
  },

  statusText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },

  reviewButton: {
    marginTop: 25,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },

  reviewButtonText: {
    color: '#222',
    fontSize: 16,
    fontWeight: '700',
  },

  quoteButton: {
    marginTop: 12,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#777',
    justifyContent: 'center',
    alignItems: 'center',
  },

  quoteButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '700',
  },

  quoteBox: {
    marginTop: 14,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  quoteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 10,
  },

  quoteInput: {
    minHeight: 120,
    borderRadius: 12,
    backgroundColor: '#F7F7F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    textAlignVertical: 'top',
  },

  characterCount: {
    marginTop: 6,
    textAlign: 'right',
    fontSize: 11,
    color: '#999',
  },

  quoteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },

  cancelQuoteButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#EEEEEA',
  },

  cancelQuoteText: {
    color: '#555',
    fontWeight: '600',
  },

  saveQuoteButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#222',
  },

  disabledButton: {
    opacity: 0.45,
  },

  saveQuoteText: {
    color: '#FFF',
    fontWeight: '700',
  },

  successBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#E8F2EA',
  },

  successText: {
    textAlign: 'center',
    color: '#4A7C59',
    fontWeight: '700',
  },

  addButton: {
    marginTop: 12,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },

  addedButton: {
    backgroundColor: '#4A7C59',
  },

  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  backButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#222',
  },

  backButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
});