import BookCover from '@/components/BookCover';
import { existingBookCover } from '@/lib/open-library-cover';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type AuthorInfo = {
  name: string;
  birth_date?: string;
  death_date?: string;
  bio?: string | { value?: string };
};

type AuthorBook = {
  key: string;
  title?: string;
  cover_i?: number;
  first_publish_year?: number;
  author_name?: string[];
};

export default function AuthorScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ key?: string; name?: string }>();
  const authorKey = typeof params.key === 'string' ? params.key : '';
  const fallbackName = typeof params.name === 'string' ? params.name : '';
  const [author, setAuthor] = useState<AuthorInfo | null>(null);
  const [books, setBooks] = useState<AuthorBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!authorKey && !fallbackName) {
        setError('Yazar bilgisi bulunamadı.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        let info: AuthorInfo = { name: fallbackName || 'Yazar' };
        if (authorKey) {
          const normalized = authorKey.startsWith('/') ? authorKey : `/authors/${authorKey}`;
          const response = await fetch(`https://openlibrary.org${normalized}.json`);
          if (response.ok) info = await response.json();
        }
        const name = info.name || fallbackName;
        const worksResponse = await fetch(`https://openlibrary.org/search.json?author=${encodeURIComponent(name)}&limit=30&fields=key,title,author_name,cover_i,edition_key,isbn,first_publish_year`);
        const worksData = worksResponse.ok ? await worksResponse.json() : { docs: [] };
        if (!active) return;
        setAuthor(info);
        setBooks(Array.isArray(worksData.docs) ? worksData.docs : []);
      } catch (loadError) {
        console.error('Author detail error:', loadError);
        if (active) setError('Yazar bilgileri yüklenemedi.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [authorKey, fallbackName]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  if (!author || error) return <View style={styles.center}><Text style={styles.muted}>{error ?? 'Yazar bulunamadı.'}</Text><Pressable onPress={() => router.back()} style={styles.button}><Text style={styles.buttonText}>Geri dön</Text></Pressable></View>;

  const bio = typeof author.bio === 'string' ? author.bio : author.bio?.value;
  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Geri dön"><Text style={styles.back}>‹ Geri</Text></Pressable>
      <Text style={styles.title}>{author.name}</Text>
      {(author.birth_date || author.death_date) ? <Text style={styles.meta}>{[author.birth_date, author.death_date].filter(Boolean).join(' – ')}</Text> : null}
      {bio ? <Text style={styles.bio} numberOfLines={8}>{bio}</Text> : null}
      <Text style={styles.section}>Eserleri</Text>
      {books.length === 0 ? <Text style={styles.muted}>Bu yazar için eser bulunamadı.</Text> : books.map((book) => (
        <Pressable key={book.key} style={styles.book} onPress={() => router.push({ pathname: '/book', params: { key: book.key, title: book.title, author: author.name, coverUrl: existingBookCover(book) ?? undefined } })} accessibilityRole="button" accessibilityLabel={`${book.title ?? 'Eser'} kitabını aç`}>
          <BookCover book={book} style={styles.cover} />
          <View style={styles.bookInfo}><Text style={styles.bookTitle} numberOfLines={2}>{book.title || 'Başlıksız eser'}</Text>{book.first_publish_year ? <Text style={styles.meta}>{book.first_publish_year}</Text> : null}</View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0E' },
  content: { padding: 18, paddingBottom: 42 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#0A0A0E' },
  back: { color: '#A985FF', fontSize: 15, fontWeight: '700', paddingVertical: 8 },
  title: { color: '#F7F7F9', fontSize: 30, fontWeight: '900', marginTop: 18 },
  meta: { color: '#8E8F98', fontSize: 13, marginTop: 5 },
  bio: { color: '#B5B6BE', fontSize: 14, lineHeight: 22, marginTop: 16 },
  section: { color: '#F2F2F5', fontSize: 19, fontWeight: '900', marginTop: 26, marginBottom: 12 },
  muted: { color: '#8E8F98', fontSize: 14, textAlign: 'center' },
  book: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 10, borderRadius: 16, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#302246' },
  cover: { width: 52, height: 76, borderRadius: 7 },
  bookInfo: { flex: 1, marginLeft: 12 },
  bookTitle: { color: '#F2F2F5', fontSize: 15, fontWeight: '800' },
  arrow: { color: '#A985FF', fontSize: 28, marginLeft: 8 },
  button: { marginTop: 18, backgroundColor: '#A985FF', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
  buttonText: { color: '#0A0A0E', fontWeight: '900' },
});