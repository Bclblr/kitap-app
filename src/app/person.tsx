import AcademicAuthorAvatar from '@/components/AcademicAuthorAvatar';
import AcademicInstitutionLogo from '@/components/AcademicInstitutionLogo';
import AcademicWorkCard from '@/components/AcademicWorkCard';
import BookCover from '@/components/BookCover';
import {
  AcademicAuthorSummary,
  AcademicWork,
  getAcademicAuthor,
  getAuthorWorks,
  searchAcademicAuthors,
} from '@/lib/academic';
import { existingBookCover } from '@/lib/open-library-cover';
import { safeBack } from '@/lib/navigation';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type OpenLibraryAuthor = {
  key?: string;
  name?: string;
  birth_date?: string;
  death_date?: string;
  bio?: string | { value?: string };
  personal_name?: string;
};

type OpenLibraryBook = {
  key: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  edition_key?: string[];
  isbn?: string[];
  first_publish_year?: number;
};

function normalizePersonName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}

async function loadOpenLibraryIdentity(authorKey: string, name: string, signal: AbortSignal): Promise<OpenLibraryAuthor | null> {
  let author: OpenLibraryAuthor | null = null;

  if (authorKey) {
    const normalized = authorKey.startsWith('/') ? authorKey : `/authors/${authorKey}`;
    const response = await fetch(`https://openlibrary.org${normalized}.json`, { signal }).catch(() => null);
    if (response?.ok) author = await response.json();
  }

  if (!author && name) {
    const response = await fetch(
      `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=5`,
      { signal }
    ).catch(() => null);
    if (response?.ok) {
      const data = await response.json();
      const exact = (Array.isArray(data?.docs) ? data.docs : []).find(
        (item: any) => normalizePersonName(String(item?.name ?? '')) === normalizePersonName(name)
      );
      if (exact) {
        author = {
          key: typeof exact.key === 'string' ? exact.key : undefined,
          name: exact.name,
          birth_date: exact.birth_date,
        };
      }
    }
  }

  return author;
}

async function loadOpenLibraryBooks(name: string, signal: AbortSignal): Promise<OpenLibraryBook[]> {
  if (!name) return [];
  const response = await fetch(
    `https://openlibrary.org/search.json?author=${encodeURIComponent(name)}&limit=24&fields=key,title,author_name,cover_i,edition_key,isbn,first_publish_year`,
    { signal }
  ).catch(() => null);
  if (!response?.ok) return [];

  const data = await response.json();
  return (Array.isArray(data?.docs) ? data.docs : [])
    .filter((book: OpenLibraryBook, index: number, all: OpenLibraryBook[]) =>
      !!book.key && all.findIndex((item) => item.key === book.key) === index
    )
    .slice(0, 20);
}

async function loadAcademicIdentity(academicId: string, name: string, signal: AbortSignal): Promise<AcademicAuthorSummary | null> {
  if (academicId) return getAcademicAuthor(academicId, signal);
  if (!name) return null;

  const candidates = await searchAcademicAuthors(name, 5, signal);
  return candidates.find((item) => normalizePersonName(item.name) === normalizePersonName(name)) ?? null;
}

export default function PersonScreen() {
  const params = useLocalSearchParams<{ name?: string; authorKey?: string; academicId?: string }>();
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();

  const name = typeof params.name === 'string' ? params.name : '';
  const authorKey = typeof params.authorKey === 'string' ? params.authorKey : '';
  const academicId = typeof params.academicId === 'string' ? params.academicId : '';

  const [author, setAuthor] = useState<OpenLibraryAuthor | null>(null);
  const [books, setBooks] = useState<OpenLibraryBook[]>([]);
  const [academicAuthor, setAcademicAuthor] = useState<AcademicAuthorSummary | null>(null);
  const [academicWorks, setAcademicWorks] = useState<AcademicWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [booksLoading, setBooksLoading] = useState(false);
  const [academicWorksLoading, setAcademicWorksLoading] = useState(false);

  useEffect(() => {
    if (!name && !authorKey && !academicId) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      await Promise.resolve();
      if (!active) return;

      setLoading(false);

      const literaryPromise = loadOpenLibraryIdentity(authorKey, name, controller.signal)
        .then((loadedAuthor) => {
          if (!active) return null;
          if (loadedAuthor) setAuthor(loadedAuthor);
          return loadedAuthor;
        })
        .catch((error) => {
          if ((error as Error)?.name !== 'AbortError') console.warn('Yazar kimliği yüklenemedi:', error);
          return null;
        });

      const academicPromise = loadAcademicIdentity(academicId, name, controller.signal)
        .then((loadedAcademicAuthor) => {
          if (!active) return null;
          if (loadedAcademicAuthor) setAcademicAuthor(loadedAcademicAuthor);
          return loadedAcademicAuthor;
        })
        .catch((error) => {
          if ((error as Error)?.name !== 'AbortError') console.warn('Akademik kimlik yüklenemedi:', error);
          return null;
        });

      void literaryPromise.then((loadedAuthor) => {
        if (!active) return;
        const resolvedName = loadedAuthor?.name || name;
        if (!resolvedName) return;

        setBooksLoading(true);
        void loadOpenLibraryBooks(resolvedName, controller.signal)
          .then((rows) => {
            if (active) setBooks(rows);
          })
          .catch((error) => {
            if ((error as Error)?.name !== 'AbortError') console.warn('Yazar eserleri yüklenemedi:', error);
          })
          .finally(() => {
            if (active) setBooksLoading(false);
          });
      });

      void academicPromise.then((loadedAcademicAuthor) => {
        if (!active || !loadedAcademicAuthor) return;

        setAcademicWorksLoading(true);
        const guard = setTimeout(() => {
          if (active) setAcademicWorksLoading(false);
        }, 5000);

        void getAuthorWorks(loadedAcademicAuthor.id, 20, controller.signal)
          .then((rows) => {
            if (active) setAcademicWorks(rows);
          })
          .catch((error) => {
            if ((error as Error)?.name !== 'AbortError') console.warn('Akademik yayınlar yüklenemedi:', error);
          })
          .finally(() => {
            clearTimeout(guard);
            if (active) setAcademicWorksLoading(false);
          });
      });
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [academicId, authorKey, name]);

  const displayName = academicAuthor?.name || author?.name || name || 'Kişi';
  const isWriter = !!author || books.length > 0;
  const isAcademic = !!academicAuthor;
  const biography = typeof author?.bio === 'string' ? author.bio : author?.bio?.value ?? null;

  if (loading && !displayName) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Profil hazırlanıyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={() => safeBack(router, '/explore')} style={styles.iconButton}>
            <Feather name="arrow-left" size={21} color={colors.text} />
          </Pressable>
          <Text style={styles.pageTitle}>Kişi Profili</Text>
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.hero}>
          <AcademicAuthorAvatar
            name={displayName}
            orcid={academicAuthor?.orcid}
            size={92}
            style={styles.avatar}
            textStyle={styles.avatarText}
          />
          <Text style={styles.title}>{displayName}</Text>

          <View style={styles.roles}>
            {isWriter ? <View style={styles.role}><Text style={styles.roleText}>Yazar</Text></View> : null}
            {isAcademic ? <View style={styles.role}><Text style={styles.roleText}>Akademisyen</Text></View> : null}
          </View>

          {academicAuthor?.institutionName ? (
            <Pressable
              onPress={() => academicAuthor.institutionId && router.push({ pathname: '/academic-institution' as any, params: { id: academicAuthor.institutionId } })}
              style={styles.institutionRow}
            >
              <AcademicInstitutionLogo name={academicAuthor.institutionName} size={34} />
              <Text style={styles.institutionText}>{academicAuthor.institutionName}</Text>
            </Pressable>
          ) : null}

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{books.length}</Text>
              <Text style={styles.metricLabel}>Kitap/Eser</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{academicAuthor?.worksCount ?? academicWorks.length}</Text>
              <Text style={styles.metricLabel}>Akademik yayın</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{academicAuthor?.citedByCount ?? 0}</Text>
              <Text style={styles.metricLabel}>Atıf</Text>
            </View>
          </View>
        </View>

        {biography ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Biyografi</Text>
            <Text style={styles.bio}>{biography}</Text>
          </View>
        ) : null}

        {academicAuthor?.topics.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Çalışma Alanları</Text>
            <View style={styles.topicWrap}>
              {academicAuthor.topics.map((topic) => (
                <View key={topic} style={styles.topic}>
                  <Text style={styles.topicText}>{topic}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {booksLoading && !books.length ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.loadingText}>Eserler yükleniyor...</Text>
          </View>
        ) : null}

        {books.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kitapları ve Eserleri</Text>
            {books.map((book) => (
              <Pressable
                key={book.key}
                onPress={() => router.push({
                  pathname: '/book',
                  params: {
                    key: book.key,
                    title: book.title,
                    author: displayName,
                    coverUrl: existingBookCover(book) ?? undefined,
                  },
                })}
                style={styles.bookCard}
              >
                <BookCover uri={existingBookCover(book)} style={styles.cover}>
                  <View style={[styles.cover, styles.coverFallback]}>
                    <Feather name="book-open" size={22} color={colors.primary} />
                  </View>
                </BookCover>
                <View style={styles.flexOne}>
                  <Text style={styles.bookTitle} numberOfLines={2}>{book.title || 'Başlıksız eser'}</Text>
                  {book.first_publish_year ? <Text style={styles.bookMeta}>İlk yayın: {book.first_publish_year}</Text> : null}
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {academicWorksLoading && !academicWorks.length ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.loadingText}>Akademik yayınlar yükleniyor...</Text>
          </View>
        ) : null}

        {academicWorks.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Akademik Yayınları</Text>
            {academicWorks.map((work) => (
              <AcademicWorkCard
                key={work.id}
                work={work}
                onPress={() => router.push({ pathname: '/academic-work' as any, params: { id: work.id } })}
              />
            ))}
          </View>
        ) : null}

        {!booksLoading && !academicWorksLoading && !books.length && !academicWorks.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Bu kişi için eser veya akademik yayın bulunamadı.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090D' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#08090D', gap: 10 },
  loadingText: { color: '#858791', fontSize: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  iconButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#111218', borderWidth: 1, borderColor: '#2A2B34', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, color: '#F2F2F5', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  topSpacer: { width: 42 },
  hero: { borderRadius: 22, borderWidth: 1, borderColor: '#34284F', backgroundColor: '#111018', padding: 20, alignItems: 'center' },
  avatar: { backgroundColor: '#2B1D42' },
  avatarText: { color: '#E5D8FF' },
  title: { color: '#F5F5F7', fontSize: 24, lineHeight: 30, fontWeight: '900', textAlign: 'center', marginTop: 13 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 10 },
  role: { borderRadius: 999, backgroundColor: '#241B36', borderWidth: 1, borderColor: '#513B73', paddingHorizontal: 10, paddingVertical: 6 },
  roleText: { color: '#D8C8FF', fontSize: 10, fontWeight: '900' },
  institutionRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14, maxWidth: '100%' },
  institutionText: { color: '#9A9CA7', fontSize: 11, flexShrink: 1 },
  metrics: { flexDirection: 'row', width: '100%', gap: 8, marginTop: 17 },
  metric: { flex: 1, borderRadius: 13, backgroundColor: '#171820', borderWidth: 1, borderColor: '#292A33', padding: 10, alignItems: 'center' },
  metricValue: { color: '#F1F1F4', fontSize: 16, fontWeight: '900' },
  metricLabel: { color: '#747680', fontSize: 9, marginTop: 3, textAlign: 'center' },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, paddingVertical: 10 },
  section: { marginTop: 22 },
  sectionTitle: { color: '#F0F0F3', fontSize: 16, fontWeight: '900', marginBottom: 11 },
  bio: { color: '#C1C2CA', fontSize: 13, lineHeight: 21 },
  topicWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  topic: { borderRadius: 999, borderWidth: 1, borderColor: '#3A2A54', backgroundColor: '#1C1528', paddingHorizontal: 10, paddingVertical: 7 },
  topicText: { color: '#C6B3F1', fontSize: 10, fontWeight: '800' },
  bookCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#2A2B34', backgroundColor: '#111218', padding: 12, marginBottom: 10 },
  cover: { width: 54, height: 78, borderRadius: 8 },
  coverFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#241B36' },
  flexOne: { flex: 1, minWidth: 0 },
  bookTitle: { color: '#F1F1F4', fontSize: 13, fontWeight: '800' },
  bookMeta: { color: '#7F818B', fontSize: 10, marginTop: 5 },
  empty: { marginTop: 24, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218' },
  emptyText: { color: '#777983', fontSize: 11, textAlign: 'center' },
});
