import BookCover from '@/components/BookCover';
import Image from '@/components/SafeImage';
import { safeBack } from '@/lib/navigation';
import { existingBookCover } from '@/lib/open-library-cover';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type AuthorInfo = {
  key?: string;
  name: string;
  personal_name?: string;
  birth_date?: string;
  death_date?: string;
  bio?: string | { value?: string };
  alternate_names?: string[];
  wikipedia?: string;
};

type AuthorBook = {
  key: string;
  title?: string;
  cover_i?: number;
  edition_key?: string[];
  isbn?: string[];
  first_publish_year?: number;
  author_name?: string[];
};

type WikipediaAuthorInfo = {
  extract: string | null;
  imageUrl: string | null;
  pageUrl: string | null;
};

const wikipediaAuthorCache = new Map<string, WikipediaAuthorInfo>();

async function fetchWikipediaAuthorInfo(name: string): Promise<WikipediaAuthorInfo> {
  const normalizedName = name.trim();
  if (!normalizedName) return { extract: null, imageUrl: null, pageUrl: null };

  const cacheKey = normalizedName.toLocaleLowerCase('tr-TR');
  const cached = wikipediaAuthorCache.get(cacheKey);
  if (cached) return cached;

  const languages = ['tr', 'en'];

  for (const language of languages) {
    try {
      const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: language === 'tr' ? `${normalizedName} yazar` : `${normalizedName} writer`,
        gsrnamespace: '0',
        gsrlimit: '1',
        prop: 'extracts|pageimages|info',
        exintro: '1',
        explaintext: '1',
        inprop: 'url',
        piprop: 'thumbnail',
        pithumbsize: '640',
        format: 'json',
        origin: '*',
      });

      const response = await fetch(
        `https://${language}.wikipedia.org/w/api.php?${params.toString()}`
      );
      if (!response.ok) continue;

      const data = await response.json();
      const pages = data?.query?.pages
        ? (Object.values(data.query.pages) as {
            extract?: string;
            fullurl?: string;
            thumbnail?: { source?: string };
          }[])
        : [];

      const page = pages[0];
      if (!page) continue;

      const result: WikipediaAuthorInfo = {
        extract: typeof page.extract === 'string' && page.extract.trim() ? page.extract.trim() : null,
        imageUrl:
          typeof page.thumbnail?.source === 'string' && /^https:\/\//i.test(page.thumbnail.source)
            ? page.thumbnail.source
            : null,
        pageUrl: typeof page.fullurl === 'string' ? page.fullurl : null,
      };

      if (result.extract || result.imageUrl) {
        wikipediaAuthorCache.set(cacheKey, result);
        return result;
      }
    } catch {
      // Diğer Wikipedia dilini dene.
    }
  }

  const empty = { extract: null, imageUrl: null, pageUrl: null };
  wikipediaAuthorCache.set(cacheKey, empty);
  return empty;
}

export default function AuthorScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ key?: string; name?: string }>();
  const authorKey = typeof params.key === 'string' ? params.key : '';
  const fallbackName = typeof params.name === 'string' ? params.name : '';

  const [author, setAuthor] = useState<AuthorInfo | null>(null);
  const [wiki, setWiki] = useState<WikipediaAuthorInfo>({
    extract: null,
    imageUrl: null,
    pageUrl: null,
  });
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
          try {
            const response = await fetch(`https://openlibrary.org${normalized}.json`);
            if (response.ok) info = await response.json();
          } catch {
            // Wikipedia ve arama sonuçlarıyla sayfayı yine de aç.
          }
        }

        const name = info.name || fallbackName || 'Yazar';

        const [bookResult, wikipediaResult] = await Promise.all([
          fetch(
            `https://openlibrary.org/search.json?author=${encodeURIComponent(name)}&limit=60&fields=key,title,author_name,cover_i,edition_key,isbn,first_publish_year`
          )
            .then(async (response) => (response.ok ? await response.json() : { docs: [] }))
            .catch(() => ({ docs: [] })),
          fetchWikipediaAuthorInfo(name),
        ]);

        if (!active) return;

        const uniqueBooks = (Array.isArray(bookResult.docs) ? bookResult.docs : [])
          .filter(
            (book: AuthorBook, index: number, all: AuthorBook[]) =>
              !!book.key && all.findIndex((item) => item.key === book.key) === index
          )
          .sort(
            (a: AuthorBook, b: AuthorBook) =>
              (a.first_publish_year ?? Number.MAX_SAFE_INTEGER) -
              (b.first_publish_year ?? Number.MAX_SAFE_INTEGER)
          );

        setAuthor(info);
        setWiki(wikipediaResult);
        setBooks(uniqueBooks);
      } catch (loadError) {
        console.error('Author detail error:', loadError);
        if (active) setError('Yazar bilgileri yüklenemedi.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [authorKey, fallbackName]);

  const openLibraryBio = useMemo(() => {
    if (!author?.bio) return null;
    return typeof author.bio === 'string' ? author.bio : author.bio.value ?? null;
  }, [author?.bio]);

  const biography = wiki.extract || openLibraryBio;
  const knownBookCount = books.length;
  const firstKnownYear = books.find((book) => book.first_publish_year)?.first_publish_year;
  const alternateNames = Array.isArray(author?.alternate_names)
    ? author.alternate_names.filter(Boolean).slice(0, 5)
    : [];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#A985FF" />
        <Text style={styles.loadingText}>Yazar bilgileri hazırlanıyor...</Text>
      </View>
    );
  }

  if (!author || error) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{error ?? 'Yazar bulunamadı.'}</Text>
        <Pressable onPress={() => safeBack(router, '/explore')} style={styles.button}>
          <Text style={styles.buttonText}>Geri dön</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => safeBack(router, '/explore')}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
        >
          <Feather name="arrow-left" size={20} color="#D8C8FA" />
        </Pressable>
        <Text style={styles.topTitle}>Yazar Profili</Text>
        <View style={styles.topSpacer} />
      </View>

      <View style={styles.hero}>
        {wiki.imageUrl ? (
          <Image
            source={{ uri: wiki.imageUrl }}
            style={styles.authorImage}
            accessibilityLabel={`${author.name} profil fotoğrafı`}
          />
        ) : (
          <View style={[styles.authorImage, styles.authorImageFallback]}>
            <Text style={styles.authorInitial}>
              {(author.name?.charAt(0) || 'Y').toLocaleUpperCase('tr-TR')}
            </Text>
          </View>
        )}

        <View style={styles.heroInfo}>
          <Text style={styles.title}>{author.name}</Text>
          {!!author.personal_name && author.personal_name !== author.name && (
            <Text style={styles.personalName}>{author.personal_name}</Text>
          )}
          {(author.birth_date || author.death_date) && (
            <View style={styles.lifeRow}>
              <Feather name="calendar" size={13} color="#9A9CA7" />
              <Text style={styles.meta}>
                {[author.birth_date, author.death_date].filter(Boolean).join(' – ')}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{knownBookCount}</Text>
          <Text style={styles.statLabel}>Bulunan eser</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{firstKnownYear ?? '—'}</Text>
          <Text style={styles.statLabel}>İlk eser yılı</Text>
        </View>
      </View>

      {(biography || alternateNames.length > 0) && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Feather name="user" size={17} color="#B58AF6" />
            <Text style={styles.section}>Biyografi</Text>
          </View>

          {biography ? (
            <Text style={styles.bio}>{biography}</Text>
          ) : (
            <Text style={styles.mutedLeft}>Bu yazar için ayrıntılı biyografi bulunamadı.</Text>
          )}

          {alternateNames.length > 0 && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Diğer bilinen adları</Text>
              <Text style={styles.detailValue}>{alternateNames.join(', ')}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.sectionHeaderBooks}>
        <View style={styles.sectionHeader}>
          <Feather name="book-open" size={17} color="#F29A45" />
          <Text style={styles.section}>Kitapları ve Eserleri</Text>
        </View>
        <Text style={styles.bookCount}>{knownBookCount} eser</Text>
      </View>

      {books.length === 0 ? (
        <View style={styles.emptyCard}>
          <Feather name="book" size={24} color="#777983" />
          <Text style={styles.muted}>Bu yazar için eser bulunamadı.</Text>
        </View>
      ) : (
        books.map((book) => (
          <Pressable
            key={book.key}
            style={styles.book}
            onPress={() =>
              router.push({
                pathname: '/book',
                params: {
                  key: book.key,
                  title: book.title,
                  author: author.name,
                  coverUrl: existingBookCover(book) ?? undefined,
                },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`${book.title ?? 'Eser'} kitabını aç`}
          >
            <BookCover uri={existingBookCover(book)} style={styles.cover}>
              <View style={[styles.cover, styles.coverFallback]}>
                <Text style={styles.coverLetter}>
                  {(book.title || 'K').charAt(0).toLocaleUpperCase('tr-TR')}
                </Text>
              </View>
            </BookCover>

            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle} numberOfLines={2}>
                {book.title || 'Başlıksız eser'}
              </Text>
              {book.first_publish_year ? (
                <Text style={styles.bookMeta}>İlk yayın: {book.first_publish_year}</Text>
              ) : (
                <Text style={styles.bookMeta}>Yayın yılı bilinmiyor</Text>
              )}
            </View>

            <Feather name="chevron-right" size={20} color="#A985FF" />
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0E' },
  content: { padding: 18, paddingBottom: 54 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0A0A0E',
  },
  loadingText: { color: '#8E8F98', fontSize: 12, marginTop: 12 },
  topBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17131F',
    borderWidth: 1,
    borderColor: '#332745',
  },
  topTitle: { color: '#F2F2F5', fontSize: 15, fontWeight: '900' },
  topSpacer: { width: 40 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#121219',
    borderWidth: 1,
    borderColor: '#302246',
    padding: 16,
  },
  authorImage: { width: 96, height: 112, borderRadius: 22, backgroundColor: '#2B2140' },
  authorImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#5C438B',
  },
  authorInitial: { color: '#DCC9FA', fontSize: 38, fontWeight: '900' },
  heroInfo: { flex: 1, minWidth: 0, marginLeft: 16 },
  title: { color: '#F7F7F9', fontSize: 25, lineHeight: 31, fontWeight: '900' },
  personalName: { color: '#B4A1DD', fontSize: 12, marginTop: 5 },
  lifeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  meta: { color: '#9A9CA7', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#14141C',
    borderWidth: 1,
    borderColor: '#282832',
  },
  statValue: { color: '#EEEAF7', fontSize: 17, fontWeight: '900' },
  statLabel: { color: '#777983', fontSize: 10, marginTop: 3 },
  sectionCard: {
    marginTop: 18,
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#121219',
    borderWidth: 1,
    borderColor: '#282832',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeaderBooks: {
    marginTop: 25,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: { color: '#F2F2F5', fontSize: 17, fontWeight: '900' },
  bio: { color: '#C1C2CA', fontSize: 14, lineHeight: 22, marginTop: 14 },
  detailBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#282832',
  },
  detailLabel: { color: '#8E8F98', fontSize: 10, fontWeight: '800' },
  detailValue: { color: '#D4D4DB', fontSize: 12, lineHeight: 18, marginTop: 5 },
  bookCount: { color: '#777983', fontSize: 10, fontWeight: '700' },
  muted: { color: '#8E8F98', fontSize: 14, textAlign: 'center' },
  mutedLeft: { color: '#8E8F98', fontSize: 13, lineHeight: 20, marginTop: 12 },
  emptyCard: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 18,
    backgroundColor: '#121219',
    borderWidth: 1,
    borderColor: '#282832',
  },
  book: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
    borderRadius: 17,
    backgroundColor: '#15151D',
    borderWidth: 1,
    borderColor: '#302246',
  },
  cover: { width: 56, height: 82, borderRadius: 8 },
  coverFallback: {
    backgroundColor: '#302246',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLetter: { color: '#A985FF', fontSize: 20, fontWeight: '900' },
  bookInfo: { flex: 1, minWidth: 0, marginLeft: 13 },
  bookTitle: { color: '#F2F2F5', fontSize: 14, fontWeight: '800', lineHeight: 19 },
  bookMeta: { color: '#858791', fontSize: 10, marginTop: 6 },
  button: {
    marginTop: 18,
    backgroundColor: '#A985FF',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  buttonText: { color: '#0A0A0E', fontWeight: '900' },
});
