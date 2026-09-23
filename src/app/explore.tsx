import BookCover from '@/components/BookCover';
import AcademicAuthorAvatar from '@/components/AcademicAuthorAvatar';
import AcademicInstitutionLogo from '@/components/AcademicInstitutionLogo';
import BottomNav from '@/components/BottomNav';
import Image from '@/components/SafeImage';
import AdSlot from '@/components/AdSlot';
import PersonalizedBookSuggestions from '@/components/PersonalizedBookSuggestions';
import ReaderSuggestions from '@/components/ReaderSuggestions';
import { BookCoverData, existingBookCover, openLibraryUrl } from '@/lib/open-library-cover';
import { AcademicAuthorSummary, AcademicInstitutionSummary, AcademicJournalSummary, AcademicWork, searchAcademicAuthors, searchAcademicInstitutions, searchAcademicJournals, searchAcademicWorks } from '@/lib/academic';
import { supabase } from '@/lib/supabase';
import { useReaderSocial } from '@/hooks/use-reader-social';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Book = BookCoverData & {
  key: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
};

type UserProfile = {
  id: string;
  username: string | null;
  profile_image: string | null;
  bio?: string | null;
};

type Author = {
  key?: string;
  name?: string;
  birth_date?: string;
  top_work?: string;
  work_count?: number;
};

type UnifiedPerson = {
  name: string;
  author: Author | null;
  academicAuthor: AcademicAuthorSummary | null;
};

function normalizePersonName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}

function mergePeople(authors: Author[], academicAuthors: AcademicAuthorSummary[]): UnifiedPerson[] {
  const byName = new Map<string, UnifiedPerson>();

  authors.forEach((author) => {
    const name = author.name?.trim();
    if (!name) return;
    const key = normalizePersonName(name);
    if (!byName.has(key)) byName.set(key, { name, author, academicAuthor: null });
  });

  academicAuthors.forEach((academicAuthor) => {
    const name = academicAuthor.name.trim();
    if (!name) return;
    const key = normalizePersonName(name);
    const current = byName.get(key);
    if (current) {
      current.academicAuthor = academicAuthor;
    } else {
      byName.set(key, { name, author: null, academicAuthor });
    }
  });

  return [...byName.values()];
}

type FeaturedAuthor = Author & {
  featuredBookCount: number;
  featuredScore: number;
};


type PopularBook = BookCoverData & {
  book_key: string;
  book_title: string | null;
  reading_count: number;
  read_count: number;
  want_count: number;
  total_users: number;
  popularity_score: number;
  author_name?: string | null;
  cover_i?: number | null;
};

type TrendingHashtag = {
  hashtag: string;
  display_hashtag: string;
  mention_count: number;
  unique_users: number;
};

type UpcomingEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  image_url: string | null;
  created_by: string | null;
};

type DiscoverCommunity = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  member_count: number;
  is_member: boolean;
  created_at: string;
};

export default function ExploreScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const social = useReaderSocial();

  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [academicWorks, setAcademicWorks] = useState<AcademicWork[]>([]);
  const [academicAuthors, setAcademicAuthors] = useState<AcademicAuthorSummary[]>([]);
  const [journals, setJournals] = useState<AcademicJournalSummary[]>([]);
  const [institutions, setInstitutions] = useState<AcademicInstitutionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [academicLoading, setAcademicLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [popularBooks, setPopularBooks] = useState<PopularBook[]>([]);
  const [popularBooksLoading, setPopularBooksLoading] = useState(false);
  const [featuredAuthors, setFeaturedAuthors] = useState<FeaturedAuthor[]>([]);
  const [featuredAuthorsLoading, setFeaturedAuthorsLoading] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [upcomingEventsLoading, setUpcomingEventsLoading] = useState(false);
  const [discoverCommunities, setDiscoverCommunities] = useState<DiscoverCommunity[]>([]);
  const [discoverCommunitiesLoading, setDiscoverCommunitiesLoading] = useState(false);
  const [trendingHashtags, setTrendingHashtags] = useState<TrendingHashtag[]>([]);
  const [trendingHashtagsLoading, setTrendingHashtagsLoading] = useState(false);

  const searchRequestIdRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchCacheRef = useRef(new Map<string, { books: Book[]; users: UserProfile[]; authors: Author[]; academicWorks: AcademicWork[]; academicAuthors: AcademicAuthorSummary[]; journals: AcademicJournalSummary[]; institutions: AcademicInstitutionSummary[] }>());
  const skipNextSearchRef = useRef(false);
  const isSearching = query.trim().length > 0;

  const loadPopularBooks = useCallback(async () => {
    setPopularBooksLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_popular_books');
      if (error) throw error;

      const rows = Array.isArray(data) ? data.slice(0, 10) : [];
      const normalized: PopularBook[] = rows.map((row: any) => ({
        book_key: String(row.book_key ?? ''),
        book_title: typeof row.book_title === 'string' ? row.book_title : null,
        reading_count: Number(row.reading_count) || 0,
        read_count: Number(row.read_count) || 0,
        want_count: Number(row.want_count) || 0,
        total_users: Number(row.total_users) || 0,
        popularity_score: Number(row.popularity_score) || 0,
        author_name: null,
        cover_i: null,
      }));

      const enriched = await Promise.all(
        normalized.map(async (book) => {
          if (existingBookCover(book)) return book;
          const url = openLibraryUrl(book.book_key);
          if (!url) return book;
          try {
            const response = await fetch(url);
            if (!response.ok) return book;
            const metadata = await response.json();
            return {
              ...book,
              coverUrl: existingBookCover(metadata),
              author_name: Array.isArray(metadata.authors)
                ? metadata.authors.map((item: any) => item?.name).filter(Boolean).join(', ')
                : book.author_name,
            };
          } catch {
            return book;
          }
        })
      );

      setPopularBooks(enriched);
    } catch (error) {
      console.error('Popular books error:', error);
      setPopularBooks([]);
    } finally {
      setPopularBooksLoading(false);
    }
  }, []);

  const loadFeaturedAuthors = useCallback(async (items: PopularBook[]) => {
    setFeaturedAuthorsLoading(true);
    try {
      const candidates = items
        .filter((book) => book.book_key.startsWith('/works/'))
        .slice(0, 10);

      const scores = new Map<string, { score: number; bookCount: number }>();

      await Promise.all(
        candidates.map(async (book) => {
          try {
            const response = await fetch(`https://openlibrary.org${book.book_key}.json`);
            if (!response.ok) return;
            const data = await response.json();
            const authorKeys: string[] = Array.isArray(data.authors)
              ? data.authors
                  .map((entry: any) => entry?.author?.key)
                  .filter((key: unknown): key is string => typeof key === 'string')
              : [];

            [...new Set(authorKeys)].forEach((key) => {
              const current = scores.get(key) ?? { score: 0, bookCount: 0 };
              scores.set(key, {
                score: current.score + book.popularity_score,
                bookCount: current.bookCount + 1,
              });
            });
          } catch {
            return;
          }
        })
      );

      const authorKeys = [...scores.entries()]
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 6)
        .map(([key]) => key);

      const results = await Promise.all(
        authorKeys.map(async (key): Promise<FeaturedAuthor | null> => {
          try {
            const response = await fetch(`https://openlibrary.org${key}.json`);
            if (!response.ok) return null;
            const data = await response.json();
            if (!data?.name) return null;
            return {
              key,
              name: data.name,
              birth_date: data.birth_date,
              featuredBookCount: scores.get(key)?.bookCount ?? 0,
              featuredScore: scores.get(key)?.score ?? 0,
            };
          } catch {
            return null;
          }
        })
      );

      setFeaturedAuthors(results.filter((item): item is FeaturedAuthor => !!item));
    } finally {
      setFeaturedAuthorsLoading(false);
    }
  }, []);

  const loadUpcomingEvents = useCallback(async () => {
    setUpcomingEventsLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, description, event_date, location, image_url, created_by')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(5);
      if (error) throw error;
      setUpcomingEvents((data ?? []) as UpcomingEvent[]);
    } catch (error) {
      console.error('Upcoming events error:', error);
      setUpcomingEvents([]);
    } finally {
      setUpcomingEventsLoading(false);
    }
  }, []);

  const loadDiscoverCommunities = useCallback(async () => {
    setDiscoverCommunitiesLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_discover_communities', { p_limit: 6 });
      if (error) throw error;
      const rows: any[] = Array.isArray(data) ? data : [];
      setDiscoverCommunities(
        rows
          .map((row) => ({
            id: String(row.id ?? ''),
            name: String(row.name ?? ''),
            description: typeof row.description === 'string' ? row.description : null,
            image_url: typeof row.image_url === 'string' ? row.image_url : null,
            member_count: Number(row.member_count) || 0,
            is_member: row.is_member === true,
            created_at: String(row.created_at ?? ''),
          }))
          .filter((item) => item.id && item.name)
      );
    } catch (error) {
      console.error('Discover communities error:', error);
      setDiscoverCommunities([]);
    } finally {
      setDiscoverCommunitiesLoading(false);
    }
  }, []);

  const loadTrendingHashtags = useCallback(async () => {
    setTrendingHashtagsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_trending_hashtags');
      if (error) throw error;
      const rows: any[] = Array.isArray(data) ? data : [];
      const { data: hashtagControls } = await supabase
        .from('hashtag_controls')
        .select('tag,blocked,featured,priority');
      const controlMap = new Map(
        (hashtagControls ?? []).map((item: any) => [String(item.tag), item])
      );
      setTrendingHashtags(
        rows
          .map((row) => ({
            hashtag: String(row.hashtag ?? '').replace(/^#+/, ''),
            display_hashtag: String(row.display_hashtag ?? row.hashtag ?? '').replace(/^#+/, ''),
            mention_count: Number(row.mention_count) || 0,
            unique_users: Number(row.unique_users) || 0,
          }))
          .filter((item) => item.hashtag && !controlMap.get(item.hashtag)?.blocked)
          .sort((a, b) => {
            const ac = controlMap.get(a.hashtag);
            const bc = controlMap.get(b.hashtag);
            return Number(bc?.featured ?? false) - Number(ac?.featured ?? false)
              || Number(bc?.priority ?? 0) - Number(ac?.priority ?? 0)
              || b.mention_count - a.mention_count;
          })
          .slice(0, 10)
      );
    } catch (error) {
      console.error('Trending hashtags error:', error);
      setTrendingHashtags([]);
    } finally {
      setTrendingHashtagsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPopularBooks();
      void loadUpcomingEvents();
      void loadDiscoverCommunities();
      void loadTrendingHashtags();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPopularBooks, loadUpcomingEvents, loadDiscoverCommunities, loadTrendingHashtags]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (popularBooks.length) void loadFeaturedAuthors(popularBooks);
      else setFeaturedAuthors([]);
    }, 0);
    return () => clearTimeout(timer);
  }, [popularBooks, loadFeaturedAuthors]);

  const searchAll = useCallback(async () => {
    const searchText = query.trim();
    if (!searchText) return;

    const normalizedQuery = searchText.toLocaleLowerCase('tr-TR');
    const cached = searchCacheRef.current.get(normalizedQuery);
    if (cached) {
      setBooks(cached.books);
      setUsers(cached.users);
      setAuthors(cached.authors);
      setAcademicWorks(cached.academicWorks);
      setAcademicAuthors(cached.academicAuthors);
      setJournals(cached.journals);
      setInstitutions(cached.institutions);
      setSearched(true);
      setLoading(false);
      setAcademicLoading(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setLoading(true);
    setSearched(true);

    try {
      const [userResult, bookResult, authorResult] = await Promise.all([
        supabase.rpc('search_visible_profiles', { p_query: searchText, p_limit: 10 }),
        fetch(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(searchText)}&limit=20&fields=key,title,author_name,cover_i,edition_key,isbn,first_publish_year`,
          { signal: controller.signal }
        ).then((response) => ({ response, error: null as unknown })).catch((error: unknown) => ({ response: null, error })),
        fetch(
          `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(searchText)}&limit=10`,
          { signal: controller.signal }
        ).then((response) => ({ response, error: null as unknown })).catch((error: unknown) => ({ response: null, error })),
      ]);

      if (requestId !== searchRequestIdRef.current) return;

      const rankText = (value: string | null | undefined) => {
        const normalized = (value ?? '').toLocaleLowerCase('tr-TR');
        if (normalized === normalizedQuery) return 3;
        if (normalized.startsWith(normalizedQuery)) return 2;
        if (normalized.includes(normalizedQuery)) return 1;
        return 0;
      };

      const nextUsers = (userResult.error ? [] : ((userResult.data ?? []) as UserProfile[]))
        .slice()
        .sort((a, b) => rankText(b.username) - rankText(a.username));

      let nextBooks: Book[] = [];
      if (bookResult.response?.ok) {
        const bookData = await bookResult.response.json();
        const docs: Book[] = Array.isArray(bookData.docs) ? bookData.docs : [];
        nextBooks = docs
          .filter((item, index, all) => !!item.key && all.findIndex((candidate) => candidate.key === item.key) === index)
          .sort((a, b) => rankText(b.title) - rankText(a.title));
      }

      let nextAuthors: Author[] = [];
      if (authorResult.response?.ok) {
        const authorData = await authorResult.response.json();
        nextAuthors = (Array.isArray(authorData.docs)
          ? authorData.docs.map((author: any) => ({
              key: author.key || author.author_key?.[0],
              name: author.name,
              birth_date: author.birth_date,
              top_work: author.top_work,
              work_count: author.work_count,
            }))
          : [])
          .filter((item: Author) => !!item.name)
          .sort((a: Author, b: Author) => rankText(b.name) - rankText(a.name));
      }

      if (requestId !== searchRequestIdRef.current) return;

      setUsers(nextUsers);
      setBooks(nextBooks);
      setAuthors(nextAuthors);
      setAcademicWorks([]);
      setAcademicAuthors([]);
      setJournals([]);
      setInstitutions([]);

      searchCacheRef.current.set(normalizedQuery, {
        books: nextBooks,
        users: nextUsers,
        authors: nextAuthors,
        academicWorks: [],
        academicAuthors: [],
        journals: [],
        institutions: [],
      });

      void supabase.rpc('log_search_event', {
        p_query: searchText,
        p_scope: 'explore',
        p_result_count: nextBooks.length + nextUsers.length + nextAuthors.length,
      });

      setAcademicLoading(true);
      const loadingGuard = setTimeout(() => {
        if (requestId === searchRequestIdRef.current) setAcademicLoading(false);
      }, 4500);

      void Promise.allSettled([
        searchAcademicWorks(searchText, 8, controller.signal),
        searchAcademicAuthors(searchText, 6, controller.signal),
      ]).then(([workResult, academicAuthorResult]) => {
        if (requestId !== searchRequestIdRef.current) return;

        const nextAcademicWorks = workResult.status === 'fulfilled' ? workResult.value : [];
        const nextAcademicAuthors = academicAuthorResult.status === 'fulfilled' ? academicAuthorResult.value : [];

        setAcademicWorks(nextAcademicWorks);
        setAcademicAuthors(nextAcademicAuthors);
        setAcademicLoading(false);
        clearTimeout(loadingGuard);

        const current = searchCacheRef.current.get(normalizedQuery);
        if (current) {
          searchCacheRef.current.set(normalizedQuery, {
            ...current,
            academicWorks: nextAcademicWorks,
            academicAuthors: nextAcademicAuthors,
          });
        }
      }).finally(() => {
        if (requestId === searchRequestIdRef.current) {
          setAcademicLoading(false);
          clearTimeout(loadingGuard);
        }
      });

      void Promise.allSettled([
        searchAcademicJournals(searchText, 6, controller.signal),
        searchAcademicInstitutions(searchText, 6, controller.signal),
      ]).then(([journalResult, institutionResult]) => {
        if (requestId !== searchRequestIdRef.current) return;

        const nextJournals = journalResult.status === 'fulfilled' ? journalResult.value : [];
        const nextInstitutions = institutionResult.status === 'fulfilled' ? institutionResult.value : [];

        setJournals(nextJournals);
        setInstitutions(nextInstitutions);

        const current = searchCacheRef.current.get(normalizedQuery);
        if (current) {
          searchCacheRef.current.set(normalizedQuery, {
            ...current,
            journals: nextJournals,
            institutions: nextInstitutions,
          });
        }
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Genel arama hatası:', error);
    } finally {
      if (requestId === searchRequestIdRef.current) setLoading(false);
    }
  }, [query]);


  useEffect(() => {
    if (!query.trim()) {
      searchRequestIdRef.current += 1;
      const resetTimer = setTimeout(() => {
        setBooks([]);
        setUsers([]);
        setAuthors([]);
        setAcademicWorks([]);
        setAcademicAuthors([]);
        setJournals([]);
        setInstitutions([]);
        setSearched(false);
        setLoading(false);
        setAcademicLoading(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    const timer = setTimeout(() => void searchAll(), 180);
    return () => clearTimeout(timer);
  }, [query, searchAll]);

  function openUser(user: UserProfile) {
    router.push({ pathname: '/profile', params: { userId: user.id } });
  }

  function openBook(book: Book, authorName: string) {
    router.push({
      pathname: '/book',
      params: {
        key: book.key,
        author: authorName,
        title: book.title,
        coverUrl: existingBookCover(book) ?? undefined,
      },
    });
  }

  function openAuthor(author: Author) {
    if (!author.name) return;
    router.push({
      pathname: '/person' as any,
      params: { authorKey: author.key, name: author.name },
    });
  }


  const people = mergePeople(authors, academicAuthors);

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>KİTAPLIĞIN</Text>
            <Text style={styles.title}>Keşfet</Text>
          </View>

          <View style={styles.searchShell}>
            <Feather name="search" size={21} color="#9B72F2" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void searchAll()}
              placeholder="Kitap, yazar, kullanıcı, makale veya dergi ara"
              placeholderTextColor="#686A74"
              style={styles.input}
              returnKeyType="search"
              autoCapitalize="none"
            />
            <Pressable onPress={() => void searchAll()} style={styles.searchButton}>
              <Text style={styles.searchButtonText}>Ara</Text>
            </Pressable>
          </View>

          {!isSearching ? (
            <View style={styles.discovery}>
              <AdSlot />

              <Text style={styles.discoveryTitle}>Yeni şeyler keşfet</Text>
              <Text style={styles.discoveryText}>
                Okuma dünyandaki yeni kitaplar, insanlar ve sohbetler burada buluşacak.
              </Text>

              <PersonalizedBookSuggestions />
              <ReaderSuggestions limit={8} />

              <View style={styles.sectionCard}>
                <SectionHeader accent="#F29A45" title="Popüler Kitaplar" />
                <Text style={styles.sectionCaption}>Topluluğun raflarında öne çıkan kitaplar.</Text>
                {popularBooksLoading ? (
                  <ActivityIndicator color="#F29A45" style={styles.sectionLoading} />
                ) : popularBooks.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularBooksList}>
                    {popularBooks.map((book) => {
                      const coverUrl = existingBookCover(book);
                      return (
                        <Pressable
                          key={book.book_key}
                          onPress={() =>
                            router.push({
                              pathname: '/book',
                              params: {
                                key: book.book_key,
                                title: book.book_title ?? undefined,
                                coverUrl: coverUrl ?? undefined,
                                author: book.author_name ?? '',
                              },
                            })
                          }
                          style={styles.popularBookCard}
                        >
                          <BookCover uri={coverUrl} style={styles.popularBookCover}>
                            <View style={[styles.popularBookCover, styles.coverFallback]}>
                              <Feather name="book-open" size={24} color="#F29A45" />
                            </View>
                          </BookCover>
                          <Text style={styles.popularBookTitle} numberOfLines={2}>
                            {book.book_title || 'Bilinmeyen kitap'}
                          </Text>
                          <Text style={styles.popularBookStats}>{book.total_users} kişi rafında</Text>
                          {!!book.reading_count && (
                            <Text style={styles.popularBookReading}>{book.reading_count} kişi okuyor</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={styles.emptySection}>Henüz popüler kitap verisi oluşmadı.</Text>
                )}
              </View>

              <View style={styles.trendingSection}>
                <SectionHeader accent="#D8799B" title="Gündem" />
                <Text style={styles.sectionCaption}>Okuma topluluğunda şu anda konuşulanlar.</Text>
                {trendingHashtagsLoading ? (
                  <ActivityIndicator color="#D8799B" style={styles.sectionLoading} />
                ) : trendingHashtags.length ? (
                  trendingHashtags.map((item, index) => (
                    <Pressable
                      key={item.hashtag}
                      onPress={() => router.push({ pathname: '/hashtag', params: { tag: item.hashtag } })}
                      style={styles.listRow}
                    >
                      <View style={styles.flexOne}>
                        <Text style={styles.rowMeta}>{index + 1} · {index < 3 ? 'Yükseliyor' : 'Gündem'}</Text>
                        <Text style={styles.hashtag}>#{item.display_hashtag}</Text>
                        <Text style={styles.rowDescription}>{item.mention_count} paylaşım · {item.unique_users} okur</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color="#777983" />
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.emptySection}>Henüz gündem oluşturacak hashtag yok.</Text>
                )}
              </View>

              <View style={styles.sectionCard}>
                <SectionHeader accent="#B58AF6" title="Öne Çıkan Yazarlar" />
                <Text style={styles.sectionCaption}>Okurların ilgisini çeken yazarlar</Text>
                {featuredAuthorsLoading ? (
                  <ActivityIndicator color="#B58AF6" style={styles.sectionLoading} />
                ) : featuredAuthors.length ? (
                  featuredAuthors.map((author, index) => (
                    <Pressable key={author.key || `${author.name}-${index}`} onPress={() => void openAuthor(author)} style={styles.listRow}>
                      <AuthorAvatar author={author} style={styles.authorMark} textStyle={styles.authorMarkText} />
                      <View style={styles.flexOne}>
                        <Text style={styles.resultTitle}>{author.name}</Text>
                        <Text style={styles.rowDescription}>{author.featuredBookCount} popüler kitap</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color="#777983" />
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.emptySection}>Henüz yeterli veri yok.</Text>
                )}
              </View>

              <View style={styles.eventsSection}>
                <SectionHeader
                  accent="#F29A45"
                  title="Yaklaşan Etkinlikler"
                  actionLabel="Etkinlik oluştur"
                  onAction={() => router.push('/event-editor')}
                />
                <Text style={styles.sectionCaption}>Okur buluşmaları ve etkinlikler</Text>
                {upcomingEventsLoading ? (
                  <ActivityIndicator color="#F29A45" style={styles.sectionLoading} />
                ) : upcomingEvents.length ? (
                  upcomingEvents.map((event) => {
                    const date = new Date(event.event_date);
                    return (
                      <Pressable
                        key={event.id}
                        onPress={() => router.push({ pathname: '/event', params: { id: event.id } })}
                        style={styles.eventRow}
                      >
                        <View style={styles.eventDate}>
                          <Text style={styles.eventDay}>{date.toLocaleDateString('tr-TR', { day: '2-digit' })}</Text>
                          <Text style={styles.eventMonth}>{date.toLocaleDateString('tr-TR', { month: 'short' }).replace('.', '').toUpperCase()}</Text>
                          <Text style={styles.eventTime}>{date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
                        <View style={styles.flexOne}>
                          <Text style={styles.resultTitle} numberOfLines={2}>{event.title}</Text>
                          {!!event.location && <Text style={styles.eventMeta}>{event.location}</Text>}
                          {!!event.description && <Text style={styles.rowDescription} numberOfLines={2}>{event.description}</Text>}
                        </View>
                        <Feather name="chevron-right" size={18} color="#777983" />
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.emptySection}>Yaklaşan etkinlik bulunmuyor.</Text>
                )}
              </View>

              <View style={styles.communitiesSection}>
                <SectionHeader
                  accent="#7F8FEF"
                  title="Toplulukları Keşfet"
                  actionLabel="Topluluk / Kulüp oluştur"
                  onAction={() => router.push('/community-editor')}
                />
                <Text style={styles.sectionCaption}>Birlikte okuyan insanlarla buluş</Text>
                {discoverCommunitiesLoading ? (
                  <ActivityIndicator color="#7F8FEF" style={styles.sectionLoading} />
                ) : discoverCommunities.length ? (
                  discoverCommunities.map((community) => (
                    <Pressable
                      key={community.id}
                      onPress={() => router.push({ pathname: '/community', params: { id: community.id } })}
                      style={styles.communityRow}
                    >
                      {community.image_url ? (
                        <Image source={{ uri: community.image_url }} style={styles.communityImage} />
                      ) : (
                        <View style={[styles.communityImage, styles.communityMark]}>
                          <Text style={styles.communityMarkText}>{community.name.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={styles.flexOne}>
                        <Text style={styles.resultTitle} numberOfLines={1}>{community.name}</Text>
                        <Text style={styles.communityMeta}>
                          {community.member_count} üye {community.is_member ? '· Üyesin' : '· Keşfet'}
                        </Text>
                        {!!community.description && (
                          <Text style={styles.rowDescription} numberOfLines={2}>{community.description}</Text>
                        )}
                      </View>
                      <Feather name="chevron-right" size={18} color="#777983" />
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.emptySection}>Henüz keşfedilecek topluluk yok.</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.resultsArea}>
              {loading ? (
                <View style={styles.messageCard}>
                  <ActivityIndicator color="#9B72F2" />
                  <Text style={styles.loadingText}>Aranıyor...</Text>
                </View>
              ) : (
                <>
                  <SearchSection title="Kitaplar" count={books.length}>
                    {books.slice(0, 8).map((book, index) => {
                      const authorName = book.author_name?.join(', ') || 'Bilinmeyen yazar';
                      return (
                        <Pressable key={book.key || `${book.title}-${index}`} onPress={() => openBook(book, authorName)} style={styles.bookCard}>
                          <BookCover uri={existingBookCover(book)} style={styles.cover}>
                            <View style={[styles.cover, styles.coverFallback]}>
                              <Feather name="book-open" size={24} color="#9870EA" />
                            </View>
                          </BookCover>
                          <View style={styles.flexOne}>
                            <Text style={styles.bookTitle} numberOfLines={2}>{book.title ?? 'Bilinmeyen kitap'}</Text>
                            <Text style={styles.bookAuthor} numberOfLines={2}>{authorName}</Text>
                            {!!book.first_publish_year && <Text style={styles.year}>İlk yayın: {book.first_publish_year}</Text>}
                          </View>
                          <Feather name="chevron-right" size={18} color="#777983" />
                        </Pressable>
                      );
                    })}
                  </SearchSection>

                  <SearchSection title="Kişiler" count={people.length}>
                    {people.slice(0, 10).map((person, index) => (
                      <Pressable
                        key={person.academicAuthor?.id || person.author?.key || `${person.name}-${index}`}
                        onPress={() => router.push({
                          pathname: '/person' as any,
                          params: {
                            name: person.name,
                            authorKey: person.author?.key,
                            academicId: person.academicAuthor?.id,
                          },
                        })}
                        style={styles.resultCard}
                      >
                        <AcademicAuthorAvatar
                          name={person.name}
                          orcid={person.academicAuthor?.orcid}
                          size={44}
                          style={styles.authorMark}
                          textStyle={styles.authorMarkText}
                        />
                        <View style={styles.flexOne}>
                          <Text style={styles.resultTitle}>{person.name}</Text>
                          <View style={styles.personRoles}>
                            {person.author ? <Text style={styles.personRole}>Yazar</Text> : null}
                            {person.academicAuthor ? <Text style={styles.personRole}>Akademisyen</Text> : null}
                          </View>
                          {person.academicAuthor?.institutionName ? (
                            <View style={styles.institutionInline}>
                              <AcademicInstitutionLogo name={person.academicAuthor.institutionName} size={22} />
                              <Text style={[styles.rowDescription, styles.institutionInlineText]} numberOfLines={1}>
                                {person.academicAuthor.institutionName}
                              </Text>
                            </View>
                          ) : person.author?.top_work ? (
                            <Text style={styles.rowDescription}>En bilinen eseri: {person.author.top_work}</Text>
                          ) : null}
                        </View>
                        <Feather name="chevron-right" size={18} color="#777983" />
                      </Pressable>
                    ))}
                  </SearchSection>

                  <SearchSection title="Kullanıcılar" count={users.length}>
                    {users
                      .filter((user) => !social.error && !social.blocked.includes(user.id))
                      .slice(0, 6)
                      .map((user) => {
                        const name = user.username?.trim() || 'Kitap Okuru';
                        return (
                          <Pressable key={user.id} onPress={() => openUser(user)} style={styles.resultCard}>
                            {user.profile_image ? (
                              <Image source={{ uri: user.profile_image }} style={styles.avatar} />
                            ) : (
                              <View style={[styles.avatar, styles.avatarFallback]}>
                                <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                              </View>
                            )}
                            <View style={styles.flexOne}>
                              <Text style={styles.resultTitle}>{name}</Text>
                              <Text style={styles.rowDescription}>{user.bio || 'Profilini görüntüle'}</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color="#777983" />
                          </Pressable>
                        );
                      })}
                  </SearchSection>

                  <SearchSection title="Makaleler" count={academicWorks.length}>
                    {academicWorks.map((work) => (
                      <Pressable
                        key={work.id}
                        onPress={() => router.push({ pathname: '/academic-work' as any, params: { id: work.id } })}
                        style={styles.resultCard}
                      >
                        <View style={styles.academicResultIcon}>
                          <Feather name="file-text" size={19} color="#B79AF2" />
                        </View>
                        <View style={styles.flexOne}>
                          <Text style={styles.resultTitle} numberOfLines={2}>{work.title}</Text>
                          <Text style={styles.rowDescription} numberOfLines={2}>
                            {work.authors.map((item) => item.name).slice(0, 3).join(', ') || 'Yazar bilgisi yok'}
                          </Text>
                          <Text style={styles.rowDescription} numberOfLines={1}>
                            {[work.publicationYear, work.journal?.name, `${work.citedByCount} atıf`].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={18} color="#777983" />
                      </Pressable>
                    ))}
                  </SearchSection>

                  <SearchSection title="Dergiler" count={journals.length}>
                    {journals.map((journal) => (
                      <Pressable
                        key={journal.id}
                        onPress={() => router.push({ pathname: '/journal' as any, params: { id: journal.id } })}
                        style={styles.resultCard}
                      >
                        <View style={styles.academicResultIcon}>
                          <Feather name="layers" size={19} color="#B79AF2" />
                        </View>
                        <View style={styles.flexOne}>
                          <Text style={styles.resultTitle}>{journal.name}</Text>
                          <Text style={styles.rowDescription}>{journal.publisher || 'Yayıncı bilgisi yok'}</Text>
                          <Text style={styles.rowDescription}>{journal.worksCount} çalışma · {journal.citedByCount} atıf</Text>
                        </View>
                        <Feather name="chevron-right" size={18} color="#777983" />
                      </Pressable>
                    ))}
                  </SearchSection>

                  <SearchSection title="Kurumlar" count={institutions.length}>
                    {institutions.map((institution) => (
                      <Pressable
                        key={institution.id}
                        onPress={() => router.push({ pathname: '/academic-institution' as any, params: { id: institution.id } })}
                        style={styles.resultCard}
                      >
                        <AcademicInstitutionLogo name={institution.name} size={44} />
                        <View style={styles.flexOne}>
                          <Text style={styles.resultTitle}>{institution.name}</Text>
                          <Text style={styles.rowDescription}>{[institution.city, institution.countryCode].filter(Boolean).join(' · ') || 'Konum bilgisi yok'}</Text>
                          <Text style={styles.rowDescription}>{institution.worksCount} çalışma · {institution.citedByCount} atıf</Text>
                        </View>
                        <Feather name="chevron-right" size={18} color="#777983" />
                      </Pressable>
                    ))}
                  </SearchSection>

                  {searched &&
                  !books.length &&
                  !people.length &&
                  !users.length &&
                  !academicLoading &&
                  !academicWorks.length &&
                  !journals.length &&
                  !institutions.length ? (
                    <View style={styles.messageCard}>
                      <Text style={styles.emptyTitle}>Sonuç bulunamadı.</Text>
                      <Text style={styles.emptyText}>Farklı bir arama ifadesi deneyebilirsin.</Text>
                    </View>
                  ) : null}
                </>
              )}
            </View>
          )}
        </ScrollView>
        <BottomNav />
      </View>
    </View>
  );
}

const authorPhotoCache = new Map<string, string | null>();

async function findWikipediaAuthorPhoto(name: string): Promise<string | null> {
  const normalizedName = name.trim();
  if (!normalizedName) return null;

  const cached = authorPhotoCache.get(normalizedName);
  if (cached !== undefined) return cached;

  const languages = ['tr', 'en'];
  for (const language of languages) {
    try {
      const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: normalizedName,
        gsrnamespace: '0',
        gsrlimit: '1',
        prop: 'pageimages',
        piprop: 'thumbnail',
        pithumbsize: '256',
        format: 'json',
        origin: '*',
      });

      const response = await fetch(`https://${language}.wikipedia.org/w/api.php?${params.toString()}`);
      if (!response.ok) continue;

      const data = await response.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) as { thumbnail?: { source?: string } }[] : [];
      const imageUrl = pages[0]?.thumbnail?.source;

      if (typeof imageUrl === 'string' && /^https:\/\//i.test(imageUrl)) {
        authorPhotoCache.set(normalizedName, imageUrl);
        return imageUrl;
      }
    } catch {
      // Bir sonraki Wikipedia dilini dene.
    }
  }

  authorPhotoCache.set(normalizedName, null);
  return null;
}

function AuthorAvatar({
  author,
  style,
  textStyle,
}: {
  author: Author;
  style: any;
  textStyle: any;
}) {
  const authorName = author.name?.trim() || '';
  const [photoState, setPhotoState] = useState<{ authorName: string; url: string | null }>({
    authorName: '',
    url: null,
  });
  const [failedAuthorName, setFailedAuthorName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!authorName) {
      return () => {
        active = false;
      };
    }

    void findWikipediaAuthorPhoto(authorName).then((url) => {
      if (active) {
        setPhotoState({ authorName, url });
      }
    });

    return () => {
      active = false;
    };
  }, [authorName]);

  const photoUrl = photoState.authorName === authorName ? photoState.url : null;
  const failed = failedAuthorName === authorName;

  if (!photoUrl || failed) {
    return (
      <View style={style}>
        <Text style={textStyle}>{(author.name?.charAt(0) || 'Y').toUpperCase()}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: photoUrl }}
      style={style}
      accessibilityLabel={author.name ? `${author.name} profil fotoğrafı` : 'Yazar profil fotoğrafı'}
      onError={() => setFailedAuthorName(authorName)}
    />
  );
}

function SectionHeader({
  accent,
  title,
  actionLabel,
  onAction,
}: {
  accent: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useThemedStyles(baseStyles);

  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionHeaderTitleRow}>
        <View style={[styles.sectionAccent, { backgroundColor: accent }]} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.createButton} accessibilityLabel={actionLabel}>
          <Feather name="plus" size={15} color="#CDBBFF" />
          <Text style={styles.createButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SearchSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const styles = useThemedStyles(baseStyles);
  if (!count) return null;

  return (
    <View style={styles.searchSection}>
      <View style={styles.searchSectionHeader}>
        <Text style={styles.searchSectionTitle}>{title}</Text>
        <Text style={styles.searchSectionCount}>{count}</Text>
      </View>
      {children}
    </View>
  );
}


const baseStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#08090D' },
  container: { flex: 1, backgroundColor: '#08090D' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 124 },
  header: { paddingVertical: 12, marginBottom: 16 },
  eyebrow: { color: '#9870EA', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#F7F7F9', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 4 },
  searchShell: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 17, borderWidth: 1, borderColor: '#2D2E37', backgroundColor: '#111218', paddingLeft: 14, paddingRight: 6 },
  input: { flex: 1, height: 52, color: '#F4F4F6', fontSize: 14, paddingVertical: 0 },
  searchButton: { minWidth: 62, height: 42, borderRadius: 13, backgroundColor: '#8058D9', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14 },
  searchButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  discovery: { marginTop: 24 },
  discoveryTitle: { color: '#F2F2F5', fontSize: 17, fontWeight: '900' },
  discoveryText: { color: '#7E808A', fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: 14 },
  sectionCard: { borderRadius: 17, borderWidth: 1, borderColor: '#332B41', backgroundColor: '#111218', padding: 14, marginBottom: 10 },
  eventsSection: { borderRadius: 17, borderWidth: 1, borderColor: '#3A3027', backgroundColor: '#111218', padding: 14, marginBottom: 10 },
  communitiesSection: { borderRadius: 17, borderWidth: 1, borderColor: '#302F4A', backgroundColor: '#111218', padding: 14, marginBottom: 10 },
  trendingSection: { borderRadius: 17, borderWidth: 1, borderColor: '#3B2933', backgroundColor: '#111218', padding: 14, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  sectionAccent: { width: 4, height: 18, borderRadius: 2, marginRight: 9 },
  sectionTitle: { color: '#ECECF0', fontSize: 13, fontWeight: '800', flexShrink: 1 },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#1D1728', borderWidth: 1, borderColor: '#302342' },
  createButtonText: { color: '#CDBBFF', fontSize: 9, fontWeight: '800' },
  sectionCaption: { color: '#777983', fontSize: 10, lineHeight: 15, marginTop: 5, marginLeft: 13, marginBottom: 10 },
  sectionLoading: { marginVertical: 20 },
  popularBooksList: { gap: 12, paddingVertical: 2 },
  popularBookCard: { width: 106, borderRadius: 14, borderWidth: 1, borderColor: '#2D2E37', backgroundColor: '#17181F', padding: 8 },
  popularBookCover: { width: '100%', height: 126, borderRadius: 9, backgroundColor: '#1D1E25' },
  coverFallback: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#34353E' },
  popularBookTitle: { color: '#EEEFF2', fontSize: 11, lineHeight: 15, fontWeight: '800', marginTop: 8 },
  popularBookStats: { color: '#D49A65', fontSize: 9, fontWeight: '700', marginTop: 7 },
  popularBookReading: { color: '#777983', fontSize: 8, marginTop: 3 },
  emptySection: { color: '#777983', fontSize: 11, lineHeight: 17, textAlign: 'center', paddingVertical: 24 },
  listRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#252630' },
  eventRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#252630' },
  eventDate: { width: 58, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  eventDay: { color: '#F29A45', fontSize: 21, fontWeight: '900' },
  eventMonth: { color: '#B58AF6', fontSize: 10, fontWeight: '900' },
  eventTime: { color: '#777983', fontSize: 9, marginTop: 3 },
  eventMeta: { color: '#B58AF6', fontSize: 10, marginTop: 4 },
  communityRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#252630' },
  communityImage: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#24253A' },
  communityMark: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#7F8FEF' },
  communityMarkText: { color: '#D5D7FF', fontSize: 18, fontWeight: '900' },
  communityMeta: { color: '#B58AF6', fontSize: 10, marginTop: 3 },
  authorMark: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#2B2140', borderWidth: 1, borderColor: '#5C438B', justifyContent: 'center', alignItems: 'center' },
  authorMarkText: { color: '#DCC9FA', fontSize: 19, fontWeight: '900' },
  flexOne: { flex: 1, minWidth: 0 },
  rowMeta: { color: '#777983', fontSize: 9, fontWeight: '700' },
  hashtag: { color: '#F1F1F4', fontSize: 14, fontWeight: '900', marginTop: 4 },
  rowDescription: { color: '#777983', fontSize: 10, lineHeight: 15, marginTop: 4 },
  resultTitle: { color: '#F0F0F3', fontSize: 15, fontWeight: '900' },
  resultsArea: { marginTop: 18 },
  searchSection: { marginBottom: 22 },
  searchSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  searchSectionTitle: { color: '#ECECF0', fontSize: 15, fontWeight: '900' },
  searchSectionCount: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: '#241B36', color: '#CDBBFF', fontSize: 10, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center', lineHeight: 24 },
  personRoles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  personRole: { color: '#CDBBFF', fontSize: 9, fontWeight: '900', borderRadius: 999, borderWidth: 1, borderColor: '#4C386B', backgroundColor: '#21172F', paddingHorizontal: 7, paddingVertical: 3 },
  institutionInline: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  institutionInlineText: { flex: 1, marginTop: 0 },
  academicLoadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginBottom: 8 },
  messageCard: { minHeight: 140, borderRadius: 18, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: '#858791', fontSize: 11, marginTop: 10 },
  emptyTitle: { color: '#ECECF0', fontSize: 14, fontWeight: '900' },
  emptyText: { color: '#777983', fontSize: 11, marginTop: 6 },
  academicResultIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#241B36', borderWidth: 1, borderColor: '#3A2A54', alignItems: 'center', justifyContent: 'center' },
  resultCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 17, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 13, marginBottom: 10 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#24252D', borderWidth: 1, borderColor: '#694CA3' },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#E4D7FA', fontSize: 19, fontWeight: '900' },
  bookCard: { minHeight: 132, flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 18, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 11, marginBottom: 11 },
  cover: { width: 72, height: 108, borderRadius: 10, backgroundColor: '#1B1C23' },
  bookTitle: { color: '#F2F2F5', fontSize: 15, lineHeight: 20, fontWeight: '900' },
  bookAuthor: { color: '#9698A1', fontSize: 11, lineHeight: 16, marginTop: 7 },
  year: { color: '#656771', fontSize: 9, marginTop: 9 },
});