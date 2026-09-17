import BookCover from '@/components/BookCover';
import { existingBookCover } from '@/lib/open-library-cover';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export type ComposerBook = {
  key: string;
  title: string;
  author: string;
  coverUrl: string | null;
};

type SearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  edition_key?: string[];
  isbn?: string[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (book: ComposerBook) => void;
  title?: string;
};

export default function BookPickerModal({ visible, onClose, onSelect, title = 'Kitap seç' }: Props) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ComposerBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setError('');
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const clean = query.trim();
    if (clean.length < 2) {
      setResults([]);
      setError('');
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(clean)}&limit=18&fields=key,title,author_name,cover_i,edition_key,isbn`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const docs = Array.isArray(payload?.docs) ? payload.docs as SearchDoc[] : [];
        const prepared = docs
          .filter((item) => typeof item.key === 'string' && typeof item.title === 'string')
          .map((item) => ({
            key: item.key as string,
            title: item.title?.trim() || 'Bilinmeyen kitap',
            author: item.author_name?.filter(Boolean).slice(0, 3).join(', ') || 'Bilinmeyen yazar',
            coverUrl: existingBookCover({
              key: item.key,
              cover_i: item.cover_i,
              edition_key: item.edition_key,
              isbn: item.isbn,
            }),
          }));
        setResults(prepared);
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        console.warn('Kitap araması tamamlanamadı:', cause);
        setError('Kitaplar şu anda yüklenemedi. Tekrar deneyebilirsin.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, visible]);

  const hint = useMemo(() => {
    if (loading) return 'Kitaplar aranıyor…';
    if (query.trim().length < 2) return 'Kitap veya yazar adıyla ara';
    if (!results.length && !error) return 'Sonuç bulunamadı';
    return `${results.length} sonuç`;
  }, [error, loading, query, results.length]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>Ekrandan ayrılmadan kitabını bul</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Feather name="search" size={19} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Kitap veya yazar ara"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')}>
                <Feather name="x-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.hintRow}>
            <Text style={[styles.hint, { color: error ? '#E98992' : colors.textMuted }]}>{error || hint}</Text>
            {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.results}>
            {results.map((book) => (
              <Pressable
                key={`${book.key}-${book.title}`}
                onPress={() => {
                  onSelect(book);
                  onClose();
                }}
                style={[styles.bookRow, { borderBottomColor: colors.border }]}
              >
                <BookCover uri={book.coverUrl} style={styles.cover}>
                  <View style={[styles.coverFallback, { backgroundColor: colors.background }]}>
                    <Feather name="book-open" size={20} color={colors.textMuted} />
                  </View>
                </BookCover>
                <View style={styles.bookCopy}>
                  <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={2}>{book.title}</Text>
                  <Text style={[styles.bookAuthor, { color: colors.textMuted }]} numberOfLines={1}>{book.author}</Text>
                </View>
                <Feather name="plus-circle" size={20} color={colors.primary} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '86%', minHeight: '62%', borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 10, paddingHorizontal: 18, paddingBottom: 24 },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 4 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchBox: { height: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  hintRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3 },
  hint: { fontSize: 12, fontWeight: '600' },
  results: { paddingBottom: 22 },
  bookRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  cover: { width: 46, height: 66, borderRadius: 7, overflow: 'hidden' },
  coverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bookCopy: { flex: 1, marginHorizontal: 13 },
  bookTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  bookAuthor: { fontSize: 13, marginTop: 4 },
});