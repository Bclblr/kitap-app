import { useRouter } from 'expo-router';
import ReadersList from '@/components/ReadersList';
import AdSlot from '@/components/AdSlot';
import WorksList from '@/components/WorksList';
import { Action } from '@/components/ReaderUI';
import { useReaderSocial } from '@/hooks/use-reader-social';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  View as SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';

type Book = {
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
type FeaturedAuthor = Author & { featuredBookCount: number; featuredScore: number };

type SearchType = 'books' | 'authors' | 'users';

type ActiveReader = {
  user_id: string;
  username: string | null;
  profile_image: string | null;
};

type PopularBook = {
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
  post_count: number;
  review_count: number;
  trend_score: number;
  latest_mention_at: string;
};
type UpcomingEvent = { id: string; title: string; description: string | null; event_date: string; location: string | null; image_url: string | null; created_by: string | null };
type DiscoverCommunity = { id: string; name: string; description: string | null; image_url: string | null; member_count: number; is_member: boolean; created_at: string };

const DISCOVERY_SECTIONS = [
  ['Öne Çıkan Yazarlar', 'Okurların ilgisini çeken yazarları burada keşfedebileceksin.', '#B58AF6'],
  ['Yaklaşan Etkinlikler', 'Söyleşi, imza günü ve canlı yayınlar burada görünecek.', '#F29A45'],
  ['Toplulukları Keşfet', 'Kitap kulüpleri ve okuma toplulukları burada yer alacak.', '#7F8FEF'],
] as const;

export default function ExploreScreen() {
  const social = useReaderSocial();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeSearchType, setActiveSearchType] = useState<SearchType>('books');
  const [activeReaders, setActiveReaders] = useState<ActiveReader[]>([]);
  const [activeReadersLoading, setActiveReadersLoading] = useState(false);
  const [popularBooks, setPopularBooks] = useState<PopularBook[]>([]);
  const [popularBooksLoading, setPopularBooksLoading] = useState(false);
  const [featuredAuthors, setFeaturedAuthors] = useState<FeaturedAuthor[]>([]);
  const [featuredAuthorsLoading, setFeaturedAuthorsLoading] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [upcomingEventsLoading, setUpcomingEventsLoading] = useState(false);
  const [discoverCommunities, setDiscoverCommunities] = useState<DiscoverCommunity[]>([]);
  const [discoverCommunitiesLoading, setDiscoverCommunitiesLoading] = useState(false);
  const [trendingHashtags, setTrendingHashtags] =
    useState<TrendingHashtag[]>([]);
  const [trendingHashtagsLoading, setTrendingHashtagsLoading] =
    useState(false);
  const searchRequestIdRef = useRef(0);
  const skipNextSearchRef = useRef(false);
  const popularBooksRequestIdRef = useRef(0);
  const featuredAuthorsRequestIdRef = useRef(0);
  const upcomingEventsRequestIdRef = useRef(0);
  const discoverCommunitiesRequestIdRef = useRef(0);
  const trendingHashtagsRequestIdRef = useRef(0);

  const isSearching = query.trim().length > 0;

  const loadActiveReaders = useCallback(async () => {
    try {
      setActiveReadersLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error('Active readers user error:', userError);
        setActiveReaders([]);
        return;
      }

      if (!user) {
        setActiveReaders([]);
        return;
      }

      const { data, error } = await supabase.rpc('get_active_readers');

      if (error) {
        console.error('Active readers error:', error);
        setActiveReaders([]);
        return;
      }

      setActiveReaders((data ?? []) as ActiveReader[]);
    } catch (error) {
      console.error('Active readers error:', error);
      setActiveReaders([]);
    } finally {
      setActiveReadersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActiveReaders();
  }, [loadActiveReaders]);

  const loadPopularBooks = useCallback(async () => {
    const requestId = ++popularBooksRequestIdRef.current;

    try {
      setPopularBooksLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (requestId !== popularBooksRequestIdRef.current) return;

      if (userError) {
        console.error('Popular books user error:', userError);
        setPopularBooks([]);
        return;
      }

      if (!user) {
        setPopularBooks([]);
        return;
      }

      const { data, error } = await supabase.rpc('get_popular_books');

      if (requestId !== popularBooksRequestIdRef.current) return;

      if (error) {
        console.error('Popular books error:', error);
        setPopularBooks([]);
        return;
      }

      const rows = Array.isArray(data) ? data.slice(0, 10) : [];
      const normalizeNumber = (value: unknown) => {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : 0;
      };
      const normalizedBooks: PopularBook[] = rows.map((row) => ({
        book_key: String(row.book_key ?? ''),
        book_title:
          typeof row.book_title === 'string' ? row.book_title : null,
        reading_count: normalizeNumber(row.reading_count),
        read_count: normalizeNumber(row.read_count),
        want_count: normalizeNumber(row.want_count),
        total_users: normalizeNumber(row.total_users),
        popularity_score: normalizeNumber(row.popularity_score),
        author_name: null,
        cover_i: null,
      }));

      const enrichedBooks = await Promise.all(
        normalizedBooks.map(async (book) => {
          if (!book.book_key.startsWith('/works/')) return book;

          try {
            const response = await fetch(
              `https://openlibrary.org${book.book_key}.json`
            );

            if (!response.ok) {
              console.warn(
                'Popular book metadata error:',
                book.book_key,
                response.status
              );
              return book;
            }

            const metadata = await response.json();
            const coverId = Array.isArray(metadata.covers)
              ? Number(metadata.covers[0])
              : null;

            return {
              ...book,
              cover_i:
                coverId !== null && Number.isFinite(coverId)
                  ? coverId
                  : null,
            };
          } catch (metadataError) {
            console.warn(
              'Popular book metadata error:',
              book.book_key,
              metadataError
            );
            return book;
          }
        })
      );

      if (requestId !== popularBooksRequestIdRef.current) return;
      setPopularBooks(enrichedBooks);
    } catch (error) {
      if (requestId !== popularBooksRequestIdRef.current) return;
      console.error('Popular books error:', error);
      setPopularBooks([]);
    } finally {
      if (requestId === popularBooksRequestIdRef.current) {
        setPopularBooksLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadPopularBooks();

    return () => {
      popularBooksRequestIdRef.current += 1;
    };
  }, [loadPopularBooks]);

  const loadFeaturedAuthors = useCallback(async (books: PopularBook[]) => {
    const requestId = ++featuredAuthorsRequestIdRef.current;
    const candidates = books.slice(0, 10).filter((book) => book.book_key.startsWith('/works/'));
    if (!candidates.length) {
      setFeaturedAuthors([]);
      setFeaturedAuthorsLoading(false);
      return;
    }
    setFeaturedAuthorsLoading(true);
    try {
      const workResults = await Promise.all(candidates.map(async (book) => {
        try {
          const response = await fetch(`https://openlibrary.org${book.book_key}.json`);
          if (!response.ok) return { book, keys: [] as string[] };
          const data = await response.json();
          const keys = Array.isArray(data.authors)
            ? data.authors.map((entry: { author?: { key?: unknown } }) => entry?.author?.key)
                .filter((key: unknown): key is string => typeof key === 'string' && key.startsWith('/authors/'))
            : [];
          return { book, keys };
        } catch (error) {
          console.warn('Featured author work metadata error:', book.book_key, error);
          return { book, keys: [] as string[] };
        }
      }));
      const scores = new Map<string, { score: number; bookCount: number }>();
      workResults.forEach(({ book, keys }) => (Array.from(new Set(keys)) as string[]).forEach((key) => {
        const current = scores.get(key) ?? { score: 0, bookCount: 0 };
        scores.set(key, { score: current.score + book.popularity_score, bookCount: current.bookCount + 1 });
      }));
      const keys: string[] = Array.from(scores.entries()).sort((a, b) => b[1].score - a[1].score || b[1].bookCount - a[1].bookCount).slice(0, 6).map(([key]) => key);
      const results = await Promise.all(keys.map(async (key): Promise<FeaturedAuthor | null> => {
        try {
          const response = await fetch(`https://openlibrary.org${key}.json`);
          if (!response.ok) return null;
          const data = await response.json();
          return typeof data.name === 'string' && data.name.trim()
            ? { key, name: data.name, birth_date: typeof data.birth_date === 'string' ? data.birth_date : undefined, featuredBookCount: scores.get(key)?.bookCount ?? 0, featuredScore: scores.get(key)?.score ?? 0 }
            : null;
        } catch (error) {
          console.warn('Featured author metadata error:', key, error);
          return null;
        }
      }));
      if (requestId === featuredAuthorsRequestIdRef.current) setFeaturedAuthors(results.filter((author): author is FeaturedAuthor => author !== null));
    } finally {
      if (requestId === featuredAuthorsRequestIdRef.current) setFeaturedAuthorsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeaturedAuthors(popularBooks);
    return () => { featuredAuthorsRequestIdRef.current += 1; };
  }, [popularBooks, loadFeaturedAuthors]);

  const loadUpcomingEvents = useCallback(async () => {
    const requestId = ++upcomingEventsRequestIdRef.current;
    setUpcomingEventsLoading(true);
    try {
      const { data, error } = await supabase.from('events').select('id, title, description, event_date, location, image_url, created_by').gte('event_date', new Date().toISOString()).order('event_date', { ascending: true }).limit(5);
      if (requestId !== upcomingEventsRequestIdRef.current) return;
      if (error) { console.error('Upcoming events error:', error); setUpcomingEvents([]); return; }
      setUpcomingEvents((data ?? []) as UpcomingEvent[]);
    } catch (error) {
      if (requestId === upcomingEventsRequestIdRef.current) { console.error('Upcoming events error:', error); setUpcomingEvents([]); }
    } finally {
      if (requestId === upcomingEventsRequestIdRef.current) setUpcomingEventsLoading(false);
    }
  }, []);

  useEffect(() => { void loadUpcomingEvents(); return () => { upcomingEventsRequestIdRef.current += 1; }; }, [loadUpcomingEvents]);

  const loadDiscoverCommunities = useCallback(async () => {
    const requestId = ++discoverCommunitiesRequestIdRef.current;
    setDiscoverCommunitiesLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_discover_communities', { p_limit: 6 });
      if (requestId !== discoverCommunitiesRequestIdRef.current) return;
      if (error) { console.error('Discover communities error:', error); setDiscoverCommunities([]); return; }
      const rows: Record<string, unknown>[] = Array.isArray(data) ? data : [];
      setDiscoverCommunities(rows.map((row) => ({
        id: String(row.id ?? ''), name: typeof row.name === 'string' ? row.name : '',
        description: typeof row.description === 'string' ? row.description : null,
        image_url: typeof row.image_url === 'string' ? row.image_url : null,
        member_count: Number.isFinite(Number(row.member_count)) ? Number(row.member_count) : 0,
        is_member: row.is_member === true, created_at: typeof row.created_at === 'string' ? row.created_at : '',
      })).filter((community) => community.id && community.name));
    } catch (error) { if (requestId === discoverCommunitiesRequestIdRef.current) { console.error('Discover communities error:', error); setDiscoverCommunities([]); } }
    finally { if (requestId === discoverCommunitiesRequestIdRef.current) setDiscoverCommunitiesLoading(false); }
  }, []);

  useEffect(() => { void loadDiscoverCommunities(); return () => { discoverCommunitiesRequestIdRef.current += 1; }; }, [loadDiscoverCommunities]);

  const loadTrendingHashtags = useCallback(async () => {
    const requestId = ++trendingHashtagsRequestIdRef.current;

    try {
      setTrendingHashtagsLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (requestId !== trendingHashtagsRequestIdRef.current) return;

      if (userError) {
        console.error('Trending hashtags user error:', userError);
        setTrendingHashtags([]);
        return;
      }

      if (!user) {
        setTrendingHashtags([]);
        return;
      }

      const { data, error } = await supabase.rpc('get_trending_hashtags');

      if (requestId !== trendingHashtagsRequestIdRef.current) return;

      if (error) {
        console.error('Trending hashtags error:', error);
        setTrendingHashtags([]);
        return;
      }

      const rows: Record<string, unknown>[] = Array.isArray(data) ? data : [];
      const normalizeNumber = (value: unknown) => {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : 0;
      };
      const normalizedHashtags = rows
        .flatMap((row): TrendingHashtag[] => {
          if (typeof row.hashtag !== 'string' || !row.hashtag.trim()) {
            return [];
          }

          const hashtag = row.hashtag.replace(/^#+/, '').trim();
          if (!hashtag) return [];

          const displayHashtag =
            typeof row.display_hashtag === 'string' &&
            row.display_hashtag.replace(/^#+/, '').trim()
              ? row.display_hashtag.replace(/^#+/, '').trim()
              : hashtag;

          return [
            {
              hashtag,
              display_hashtag: displayHashtag,
              mention_count: normalizeNumber(row.mention_count),
              unique_users: normalizeNumber(row.unique_users),
              post_count: normalizeNumber(row.post_count),
              review_count: normalizeNumber(row.review_count),
              trend_score: normalizeNumber(row.trend_score),
              latest_mention_at:
                typeof row.latest_mention_at === 'string'
                  ? row.latest_mention_at
                  : '',
            },
          ];
        })
        .slice(0, 10);

      if (requestId !== trendingHashtagsRequestIdRef.current) return;
      setTrendingHashtags(normalizedHashtags);
    } catch (error) {
      if (requestId !== trendingHashtagsRequestIdRef.current) return;
      console.error('Trending hashtags error:', error);
      setTrendingHashtags([]);
    } finally {
      if (requestId === trendingHashtagsRequestIdRef.current) {
        setTrendingHashtagsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadTrendingHashtags();

    return () => {
      trendingHashtagsRequestIdRef.current += 1;
    };
  }, [loadTrendingHashtags]);

  const searchAll = useCallback(async () => {
    const searchText = query.trim();
    if (!searchText) return;

    const requestId = ++searchRequestIdRef.current;
    setLoading(true);
    setSearched(true);
    setBooks([]);
    setUsers([]);
    setAuthors([]);

    try {
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id, username, profile_image, bio')
        .ilike('username', `%${searchText}%`)
        .limit(10);

      if (requestId !== searchRequestIdRef.current) return;
      if (userError) {
        console.error('Kullanıcı arama hatası:', userError);
        setUsers([]);
      } else {
        setUsers((userData as UserProfile[]) || []);
      }

      try {
        const response = await fetch(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(searchText)}&limit=20`
        );
        if (requestId !== searchRequestIdRef.current) return;
        if (!response.ok) {
          console.warn('OpenLibrary kitap araması başarısız:', response.status);
          setBooks([]);
        } else {
          const data = await response.json();
          if (requestId !== searchRequestIdRef.current) return;
          setBooks(Array.isArray(data.docs) ? data.docs : []);
        }
      } catch (error) {
        if (requestId !== searchRequestIdRef.current) return;
        console.warn('Kitap araması yapılamadı:', error);
        setBooks([]);
      }

      const response = await fetch(
        `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(searchText)}&limit=10`
      );
      if (requestId !== searchRequestIdRef.current) return;
      if (!response.ok) {
        console.warn('OpenLibrary yazar araması başarısız:', response.status);
        setAuthors([]);
        return;
      }

      const data = await response.json();
      if (requestId !== searchRequestIdRef.current) return;
      const docs = Array.isArray(data.docs) ? data.docs : [];
      setAuthors(
        docs.map((author: Author & { author_key?: string[] }) => ({
          key: author.key || author.author_key?.[0],
          name: author.name,
          birth_date: author.birth_date,
          top_work: author.top_work,
          work_count: author.work_count,
        }))
      );
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) return;
      console.error('Genel arama hatası:', error);
      setBooks([]);
      setAuthors([]);
    } finally {
      if (requestId === searchRequestIdRef.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (!query.trim()) {
      searchRequestIdRef.current += 1;
      setBooks([]);
      setUsers([]);
      setAuthors([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    searchRequestIdRef.current += 1;
    const timer = setTimeout(() => void searchAll(), 600);
    return () => clearTimeout(timer);
  }, [query, searchAll]);

  function openUser(user: UserProfile) {
    router.push({ pathname: '/profile', params: { userId: user.id } });
  }

  function openBook(book: Book, authorName: string) {
    router.push({
      pathname: '/book',
      params: { key: book.key, author: authorName },
    });
  }

  function openAuthor(author: Author) {
    if (!author.name) return;
    skipNextSearchRef.current = true;
    setQuery(author.name);
    setActiveSearchType('books');
    void searchAuthorBooks(author.name);
  }

  async function searchAuthorBooks(authorName: string) {
    const requestId = ++searchRequestIdRef.current;
    setLoading(true);
    setSearched(true);
    setBooks([]);
    setUsers([]);
    setAuthors([]);
    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?author=${encodeURIComponent(authorName)}&limit=20`
      );
      if (requestId !== searchRequestIdRef.current) return;
      if (!response.ok) throw new Error(`Yazar kitap API hatası: ${response.status}`);
      const data = await response.json();
      if (requestId !== searchRequestIdRef.current) return;
      setBooks(Array.isArray(data.docs) ? data.docs : []);
      setUsers([]);
      setAuthors([]);
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) return;
      console.error('Yazar kitapları yüklenemedi:', error);
      setBooks([]);
    } finally {
      if (requestId === searchRequestIdRef.current) setLoading(false);
    }
  }

  const selectedCount = activeSearchType === 'books'
    ? books.length
    : activeSearchType === 'authors'
      ? authors.length
      : users.length;
  const emptyMessage = activeSearchType === 'books'
    ? 'Kitap bulunamadı.'
    : activeSearchType === 'authors'
      ? 'Yazar bulunamadı.'
      : 'Kullanıcı bulunamadı.';

  return (
    <SafeAreaView style={styles.safeArea}>
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
            <Text style={styles.searchGlyph}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void searchAll()}
              placeholder="Kitap, yazar veya kullanıcı ara"
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
              <ReadersList />
              <WorksList />
              <AdSlot />
              <Action label="Topluluk / Kitap Kulübü Oluştur" onPress={() => router.push('/community-editor')} />
              <Text style={styles.discoveryTitle}>Yeni şeyler keşfet</Text>
              <Text style={styles.discoveryText}>
                Okuma dünyandaki yeni kitaplar, insanlar ve sohbetler burada buluşacak.
              </Text>

              <View style={styles.activeReadersSection}>
                <View style={styles.activeReadersHeader}>
                  <View style={styles.activeReadersTitleRow}>
                    <View style={styles.activeReadersAccent} />
                    <Text style={styles.discoveryCardTitle}>Aktif Okuyucular</Text>
                  </View>
                  <Text style={styles.activeReadersCaption}>
                    Okuma topluluğunda şu anda aktif olan okurlar.
                  </Text>
                </View>

                {activeReadersLoading ? (
                  <View style={styles.activeReadersLoading}>
                    <ActivityIndicator size="small" color="#9B72F2" />
                    <Text style={styles.activeReadersLoadingText}>
                      Okuyucular yükleniyor...
                    </Text>
                  </View>
                ) : activeReaders.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.activeReadersList}
                  >
                    {activeReaders.filter(reader => !social.error && reader.user_id !== social.userId && !social.blocked.includes(reader.user_id)).map((reader) => {
                      const name = reader.username?.trim() || 'Okuyucu';
                      const initial = name
                        .charAt(0)
                        .toLocaleUpperCase('tr-TR');

                      return (
                        <Pressable
                          key={reader.user_id}
                          onPress={() =>
                            router.push({
                              pathname: '/profile',
                              params: { userId: reader.user_id },
                            })
                          }
                          style={styles.activeReaderCard}
                        >
                          {reader.profile_image ? (
                            <Image
                              source={{ uri: reader.profile_image }}
                              style={styles.activeReaderAvatar}
                            />
                          ) : (
                            <View
                              style={[
                                styles.activeReaderAvatar,
                                styles.avatarFallback,
                              ]}
                            >
                              <Text style={styles.activeReaderInitial}>
                                {initial}
                              </Text>
                            </View>
                          )}
                          <Text style={styles.activeReaderName} numberOfLines={1}>
                            {name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={styles.activeReadersEmpty}>
                    Şu anda aktif okuyucu görünmüyor.
                  </Text>
                )}
              </View>

              <View style={styles.popularBooksSection}>
                <View style={styles.popularBooksHeader}>
                  <View style={styles.activeReadersTitleRow}>
                    <View style={styles.popularBooksAccent} />
                    <Text style={styles.discoveryCardTitle}>Popüler Kitaplar</Text>
                  </View>
                  <Text style={styles.popularBooksCaption}>
                    Topluluğun raflarında öne çıkan kitaplar.
                  </Text>
                </View>

                {popularBooksLoading ? (
                  <View style={styles.popularBooksLoading}>
                    <ActivityIndicator size="small" color="#F29A45" />
                    <Text style={styles.activeReadersLoadingText}>
                      Kitaplar yükleniyor...
                    </Text>
                  </View>
                ) : popularBooks.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.popularBooksList}
                  >
                    {popularBooks.map((book) => {
                      const coverUrl = book.cover_i
                        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                        : null;

                      return (
                        <Pressable
                          key={book.book_key}
                          onPress={() =>
                            router.push({
                              pathname: '/book',
                              params: {
                                key: book.book_key,
                                author: book.author_name ?? '',
                              },
                            })
                          }
                          style={styles.popularBookCard}
                        >
                          {coverUrl ? (
                            <Image
                              source={{ uri: coverUrl }}
                              style={styles.popularBookCover}
                              resizeMode="cover"
                            />
                          ) : (
                            <View
                              style={[
                                styles.popularBookCover,
                                styles.popularBookCoverFallback,
                              ]}
                            >
                              <Text style={styles.popularBookCoverMark}>▥</Text>
                            </View>
                          )}
                          <Text style={styles.popularBookTitle} numberOfLines={2}>
                            {book.book_title || 'Bilinmeyen kitap'}
                          </Text>
                          {book.author_name ? (
                            <Text style={styles.popularBookAuthor} numberOfLines={1}>
                              {book.author_name}
                            </Text>
                          ) : null}
                          <Text style={styles.popularBookStats}>
                            {book.total_users} kişi rafında
                          </Text>
                          {book.reading_count > 0 ? (
                            <Text style={styles.popularBookReading}>
                              {book.reading_count} kişi okuyor
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={styles.popularBooksEmpty}>
                    Henüz popüler kitap verisi oluşmadı.
                  </Text>
                )}
              </View>

              <View style={styles.trendingSection}>
                <View style={styles.trendingHeader}>
                  <View style={styles.activeReadersTitleRow}>
                    <View style={styles.trendingAccent} />
                    <Text style={styles.discoveryCardTitle}>Gündem</Text>
                  </View>
                  <Text style={styles.trendingCaption}>
                    Okuma topluluğunda şu anda konuşulanlar.
                  </Text>
                </View>

                {trendingHashtagsLoading ? (
                  <View style={styles.trendingLoading}>
                    <ActivityIndicator size="small" color="#D8799B" />
                    <Text style={styles.activeReadersLoadingText}>
                      Gündem yükleniyor...
                    </Text>
                  </View>
                ) : trendingHashtags.length > 0 ? (
                  <View style={styles.trendingList}>
                    {trendingHashtags.map((item, index) => (
                      <Pressable
                        key={item.hashtag}
                        onPress={() =>
                          router.push({
                            pathname: '/hashtag',
                            params: { tag: item.hashtag },
                          })
                        }
                        style={({ pressed }) => [
                          styles.trendingRow,
                          index < trendingHashtags.length - 1 &&
                            styles.trendingRowBorder,
                          pressed && styles.trendingRowPressed,
                        ]}
                      >
                        <Text style={styles.trendingRowMeta}>
                          {index + 1} · {index < 3 ? 'Yükseliyor' : 'Gündem'}
                        </Text>
                        <Text style={styles.trendingHashtag} numberOfLines={1}>
                          #{item.display_hashtag.replace(/^#+/, '')}
                        </Text>
                        <Text style={styles.trendingCounts}>
                          {item.mention_count} paylaşım · {item.unique_users} okur
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.trendingEmpty}>
                    Henüz gündem oluşturacak hashtag yok.
                  </Text>
                )}
              </View>

              <View style={styles.featuredAuthorsSection}>
                <View style={styles.activeReadersTitleRow}><View style={styles.featuredAuthorsAccent} /><Text style={styles.discoveryCardTitle}>Öne Çıkan Yazarlar</Text></View>
                <Text style={styles.popularBooksCaption}>Okurların ilgisini çeken yazarlar</Text>
                {featuredAuthorsLoading ? <ActivityIndicator size="small" color="#B58AF6" style={styles.featuredAuthorsLoading} /> : featuredAuthors.length ? featuredAuthors.map((author, index) => (
                  <Pressable key={author.key || `${author.name}-${index}`} onPress={() => openAuthor(author)} style={styles.featuredAuthorRow}>
                    <View style={styles.authorMark}><Text style={styles.authorMarkText}>{(author.name?.trim().charAt(0) || 'Y').toLocaleUpperCase('tr-TR')}</Text></View>
                    <View style={styles.featuredAuthorInfo}><Text style={styles.resultTitle} numberOfLines={1}>{author.name}</Text><Text style={styles.featuredAuthorMeta}>{author.featuredBookCount} popüler kitap</Text></View><Text style={styles.arrow}>›</Text>
                  </Pressable>
                )) : <Text style={styles.popularBooksEmpty}>Henüz yeterli veri yok.</Text>}
              </View>

              <View style={styles.eventsSection}>
                <View style={styles.activeReadersTitleRow}><View style={styles.eventsAccent} /><Text style={styles.discoveryCardTitle}>Yaklaşan Etkinlikler</Text></View>
                <Text style={styles.popularBooksCaption}>Okur buluşmaları ve etkinlikler</Text>
                {upcomingEventsLoading ? <ActivityIndicator size="small" color="#F29A45" style={styles.eventsLoading} /> : upcomingEvents.length ? upcomingEvents.map((event) => {
                  const date = new Date(event.event_date);
                  return <Pressable key={event.id} onPress={() => router.push({ pathname: '/event', params: { id: event.id } })} style={styles.eventRow}><View style={styles.eventDate}><Text style={styles.eventDay}>{date.toLocaleDateString('tr-TR', { day: '2-digit' })}</Text><Text style={styles.eventMonth}>{date.toLocaleDateString('tr-TR', { month: 'short' }).replace('.', '').toLocaleUpperCase('tr-TR')}</Text><Text style={styles.eventTime}>{date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</Text></View><View style={styles.eventInfo}><Text style={styles.resultTitle} numberOfLines={2}>{event.title}</Text>{event.location ? <Text style={styles.eventMeta} numberOfLines={1}>{event.location}</Text> : null}{event.description ? <Text style={styles.eventDescription} numberOfLines={2}>{event.description}</Text> : null}</View></Pressable>;
                }) : <Text style={styles.popularBooksEmpty}>Yaklaşan etkinlik bulunmuyor.</Text>}
              </View>

              <View style={styles.communitiesSection}>
                <View style={styles.activeReadersTitleRow}><View style={styles.communitiesAccent} /><Text style={styles.discoveryCardTitle}>Toplulukları Keşfet</Text></View>
                <Text style={styles.popularBooksCaption}>Birlikte okuyan insanlarla buluş</Text>
                {discoverCommunitiesLoading ? <ActivityIndicator size="small" color="#7F8FEF" style={styles.communitiesLoading} /> : discoverCommunities.length ? discoverCommunities.map((community) => (
                  <Pressable key={community.id} onPress={() => router.push({ pathname: '/community', params: { id: community.id } })} style={styles.communityRow}>
                    {community.image_url ? <Image source={{ uri: community.image_url }} style={styles.communityImage} /> : <View style={[styles.communityImage, styles.communityMark]}><Text style={styles.communityMarkText}>{community.name.charAt(0).toLocaleUpperCase('tr-TR')}</Text></View>}
                    <View style={styles.communityInfo}><Text style={styles.resultTitle} numberOfLines={1}>{community.name}</Text><Text style={styles.communityMeta}>{community.member_count} üye {community.is_member ? '· Üyesin' : '· Keşfet'}</Text>{community.description ? <Text style={styles.eventDescription} numberOfLines={2}>{community.description}</Text> : null}</View>
                  </Pressable>
                )) : <Text style={styles.popularBooksEmpty}>Henüz keşfedilecek topluluk yok.</Text>}
              </View>

              {DISCOVERY_SECTIONS.slice(3).map(([title, description, accent]) => (
                <View key={title} style={styles.discoveryCard}>
                  <View style={[styles.discoveryAccent, { backgroundColor: accent }]} />
                  <View style={styles.discoveryCardText}>
                    <Text style={styles.discoveryCardTitle}>{title}</Text>
                    <Text style={styles.discoveryCardDescription}>{description}</Text>
                  </View>
                  <View style={styles.soonPill}>
                    <Text style={styles.soonText}>Yakında</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.resultsArea}>
              <View style={styles.tabs}>
                <SearchTab label="Kitaplar" active={activeSearchType === 'books'} onPress={() => setActiveSearchType('books')} />
                <SearchTab label="Yazarlar" active={activeSearchType === 'authors'} onPress={() => setActiveSearchType('authors')} />
                <SearchTab label="Kullanıcılar" active={activeSearchType === 'users'} onPress={() => setActiveSearchType('users')} />
              </View>

              {loading ? (
                <View style={styles.messageCard}>
                  <ActivityIndicator size="small" color="#9B72F2" />
                  <Text style={styles.loadingText}>Aranıyor...</Text>
                </View>
              ) : searched && selectedCount === 0 ? (
                <View style={styles.messageCard}>
                  <View style={styles.emptyDot} />
                  <Text style={styles.emptyTitle}>{emptyMessage}</Text>
                  <Text style={styles.emptyText}>Farklı bir arama ifadesi deneyebilirsin.</Text>
                </View>
              ) : (
                <>
                  {activeSearchType === 'users' && users.filter(user => !social.error && !social.blocked.includes(user.id)).map((user) => {
                    const name = user.username?.trim() || 'Kitap Okuru';
                    const initial = name.charAt(0).toLocaleUpperCase('tr-TR');
                    return (
                      <Pressable key={user.id} onPress={() => openUser(user)} style={styles.resultCard}>
                        {user.profile_image ? (
                          <Image source={{ uri: user.profile_image }} style={styles.avatar} />
                        ) : (
                          <View style={[styles.avatar, styles.avatarFallback]}>
                            <Text style={styles.avatarText}>{initial}</Text>
                          </View>
                        )}
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultTitle} numberOfLines={1}>{name}</Text>
                          <Text style={styles.resultMeta} numberOfLines={2}>{user.bio || 'Profilini görüntüle'}</Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                      </Pressable>
                    );
                  })}

                  {activeSearchType === 'authors' && authors.map((author, index) => (
                    <Pressable key={author.key || `${author.name}-${index}`} onPress={() => openAuthor(author)} style={styles.resultCard}>
                      <View style={styles.authorMark}>
                        <Text style={styles.authorMarkText}>{(author.name?.trim().charAt(0) || 'Y').toLocaleUpperCase('tr-TR')}</Text>
                      </View>
                      <View style={styles.resultInfo}>
                        <Text style={styles.resultTitle} numberOfLines={1}>{author.name || 'Bilinmeyen yazar'}</Text>
                        {author.birth_date ? <Text style={styles.resultMeta}>Doğum: {author.birth_date}</Text> : null}
                        {author.top_work ? <Text style={styles.authorWork} numberOfLines={1}>En bilinen eseri: {author.top_work}</Text> : null}
                        {typeof author.work_count === 'number' ? <Text style={styles.authorCount}>{author.work_count} eser</Text> : null}
                      </View>
                      <Text style={styles.arrow}>›</Text>
                    </Pressable>
                  ))}

                  {activeSearchType === 'books' && books.map((book, index) => {
                    const coverUrl = book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null;
                    const authorName = book.author_name?.join(', ') || 'Bilinmeyen yazar';
                    return (
                      <Pressable key={book.key || `${book.title}-${index}`} onPress={() => openBook(book, authorName)} style={styles.bookCard}>
                        {coverUrl ? (
                          <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
                        ) : (
                          <View style={styles.noCover}>
                            <Text style={styles.noCoverMark}>▥</Text>
                            <Text style={styles.noCoverText}>Kapak yok</Text>
                          </View>
                        )}
                        <View style={styles.resultInfo}>
                          <Text style={styles.bookTitle} numberOfLines={2}>{book.title ?? 'Bilinmeyen kitap'}</Text>
                          <Text style={styles.bookAuthor} numberOfLines={2}>{authorName}</Text>
                          {book.first_publish_year ? <Text style={styles.year}>İlk yayın: {book.first_publish_year}</Text> : null}
                        </View>
                        <Text style={styles.arrow}>›</Text>
                      </Pressable>
                    );
                  })}
                </>
              )}
            </View>
          )}
        </ScrollView>
        <BottomNav />
      </View>
    </SafeAreaView>
  );
}

function SearchTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.activeTab]}>
      <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  featuredAuthorsSection: { borderRadius: 17, borderWidth: 1, borderColor: '#332B41', backgroundColor: '#111218', padding: 14, marginBottom: 10 },
  featuredAuthorsAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: '#B58AF6', marginRight: 9 },
  featuredAuthorsLoading: { marginVertical: 18 },
  featuredAuthorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#252630' },
  featuredAuthorInfo: { flex: 1, marginLeft: 10 },
  featuredAuthorMeta: { color: '#777983', fontSize: 10, marginTop: 3 },
  eventsSection: { borderRadius: 17, borderWidth: 1, borderColor: '#3A3027', backgroundColor: '#111218', padding: 14, marginBottom: 10 },
  eventsAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: '#F29A45', marginRight: 9 },
  eventsLoading: { marginVertical: 20 },
  eventRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#252630' },
  eventDate: { width: 58, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  eventDay: { color: '#F29A45', fontSize: 21, fontWeight: '900' },
  eventMonth: { color: '#B58AF6', fontSize: 10, fontWeight: '900' },
  eventTime: { color: '#777983', fontSize: 9, marginTop: 3 },
  eventInfo: { flex: 1, justifyContent: 'center' },
  eventMeta: { color: '#B58AF6', fontSize: 10, marginTop: 4 },
  eventDescription: { color: '#777983', fontSize: 10, marginTop: 3 },
  communitiesSection: { borderRadius: 17, borderWidth: 1, borderColor: '#302F4A', backgroundColor: '#111218', padding: 14, marginBottom: 10 },
  communitiesAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: '#7F8FEF', marginRight: 9 },
  communitiesLoading: { marginVertical: 20 },
  communityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#252630' },
  communityImage: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#24253A' },
  communityMark: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#7F8FEF' },
  communityMarkText: { color: '#D5D7FF', fontSize: 18, fontWeight: '900' },
  communityInfo: { flex: 1, marginLeft: 11 },
  communityMeta: { color: '#B58AF6', fontSize: 10, marginTop: 3 },
  safeArea: { flex: 1, backgroundColor: '#08090D' },
  container: { flex: 1, backgroundColor: '#08090D' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 124 },
  header: { paddingVertical: 12, marginBottom: 16 },
  eyebrow: { color: '#9870EA', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#F7F7F9', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 4 },
  searchShell: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#2D2E37', backgroundColor: '#111218', paddingLeft: 13, paddingRight: 6 },
  searchGlyph: { color: '#9B72F2', fontSize: 24, lineHeight: 26, marginRight: 8 },
  input: { flex: 1, height: 52, color: '#F4F4F6', fontSize: 14, paddingVertical: 0 },
  searchButton: { minWidth: 62, height: 42, borderRadius: 13, backgroundColor: '#8058D9', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14 },
  searchButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  discovery: { marginTop: 24 },
  discoveryTitle: { color: '#F2F2F5', fontSize: 17, fontWeight: '900' },
  discoveryText: { color: '#7E808A', fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: 14 },
  activeReadersSection: { minHeight: 150, borderRadius: 17, borderWidth: 1, borderColor: '#332B41', backgroundColor: '#111218', paddingVertical: 14, marginBottom: 10 },
  activeReadersHeader: { paddingHorizontal: 14, marginBottom: 13 },
  activeReadersTitleRow: { flexDirection: 'row', alignItems: 'center' },
  activeReadersAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: '#9B72F2', marginRight: 9 },
  activeReadersCaption: { color: '#777983', fontSize: 10, lineHeight: 15, marginTop: 5, marginLeft: 13 },
  activeReadersLoading: { minHeight: 74, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  activeReadersLoadingText: { color: '#858791', fontSize: 10, marginLeft: 8 },
  activeReadersList: { paddingHorizontal: 14, gap: 12 },
  activeReaderCard: { width: 72, alignItems: 'center' },
  activeReaderAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#24252D', borderWidth: 2, borderColor: '#7654B5' },
  activeReaderInitial: { color: '#E4D7FA', fontSize: 19, fontWeight: '900' },
  activeReaderName: { width: '100%', color: '#DADAE0', fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 7 },
  activeReadersEmpty: { color: '#777983', fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: 20, paddingVertical: 23 },
  popularBooksSection: { minHeight: 196, borderRadius: 17, borderWidth: 1, borderColor: '#3A3027', backgroundColor: '#111218', paddingVertical: 14, marginBottom: 10 },
  popularBooksHeader: { paddingHorizontal: 14, marginBottom: 13 },
  popularBooksAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: '#F29A45', marginRight: 9 },
  popularBooksCaption: { color: '#777983', fontSize: 10, lineHeight: 15, marginTop: 5, marginLeft: 13 },
  popularBooksLoading: { minHeight: 118, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  popularBooksList: { paddingHorizontal: 14, gap: 12 },
  popularBookCard: { width: 106, borderRadius: 14, borderWidth: 1, borderColor: '#2D2E37', backgroundColor: '#17181F', padding: 8 },
  popularBookCover: { width: '100%', height: 126, borderRadius: 9, backgroundColor: '#1D1E25' },
  popularBookCoverFallback: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#34353E' },
  popularBookCoverMark: { color: '#F29A45', fontSize: 25 },
  popularBookTitle: { color: '#EEEFF2', fontSize: 11, lineHeight: 15, fontWeight: '800', marginTop: 8 },
  popularBookAuthor: { color: '#898B95', fontSize: 9, marginTop: 4 },
  popularBookStats: { color: '#D49A65', fontSize: 9, fontWeight: '700', marginTop: 7 },
  popularBookReading: { color: '#777983', fontSize: 8, marginTop: 3 },
  popularBooksEmpty: { color: '#777983', fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: 20, paddingVertical: 45 },
  trendingSection: { minHeight: 150, borderRadius: 17, borderWidth: 1, borderColor: '#3B2933', backgroundColor: '#111218', padding: 14, marginBottom: 10 },
  trendingHeader: { marginBottom: 12 },
  trendingAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: '#D8799B', marginRight: 9 },
  trendingCaption: { color: '#777983', fontSize: 10, lineHeight: 15, marginTop: 5, marginLeft: 13 },
  trendingLoading: { minHeight: 92, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  trendingList: { marginHorizontal: -14, marginBottom: -14 },
  trendingRow: { minHeight: 82, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  trendingRowBorder: { borderBottomWidth: 1, borderBottomColor: '#292A32' },
  trendingRowPressed: { opacity: 0.68 },
  trendingRowMeta: { color: '#777983', fontSize: 9, fontWeight: '700' },
  trendingHashtag: { color: '#F1F1F4', fontSize: 14, fontWeight: '900', marginTop: 5 },
  trendingCounts: { color: '#8B7D92', fontSize: 9, marginTop: 6 },
  trendingEmpty: { color: '#777983', fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: 20, paddingVertical: 34 },
  discoveryCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 14, marginBottom: 10 },
  discoveryAccent: { width: 4, height: 38, borderRadius: 2, marginRight: 12 },
  discoveryCardText: { flex: 1, paddingRight: 9 },
  discoveryCardTitle: { color: '#ECECF0', fontSize: 13, fontWeight: '800' },
  discoveryCardDescription: { color: '#777983', fontSize: 10, lineHeight: 15, marginTop: 5 },
  soonPill: { borderRadius: 10, backgroundColor: '#25202F', paddingHorizontal: 8, paddingVertical: 5 },
  soonText: { color: '#B89BF0', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  resultsArea: { marginTop: 18 },
  tabs: { flexDirection: 'row', borderRadius: 15, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#101116', padding: 4, marginBottom: 16 },
  tab: { flex: 1, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  activeTab: { backgroundColor: '#302345', borderWidth: 1, borderColor: '#684CA0' },
  tabText: { color: '#777983', fontSize: 11, fontWeight: '700' },
  activeTabText: { color: '#D7C4FA', fontWeight: '900' },
  messageCard: { minHeight: 140, borderRadius: 18, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: '#858791', fontSize: 11, marginTop: 10 },
  emptyDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#2B2140', borderWidth: 1, borderColor: '#573F82', marginBottom: 12 },
  emptyTitle: { color: '#ECECF0', fontSize: 14, fontWeight: '900' },
  emptyText: { color: '#777983', fontSize: 11, marginTop: 6 },
  resultCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 13, marginBottom: 10 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#24252D', borderWidth: 1, borderColor: '#694CA3' },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#E4D7FA', fontSize: 19, fontWeight: '900' },
  authorMark: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#2B2140', borderWidth: 1, borderColor: '#5C438B', justifyContent: 'center', alignItems: 'center' },
  authorMarkText: { color: '#DCC9FA', fontSize: 19, fontWeight: '900' },
  resultInfo: { flex: 1, marginLeft: 13, paddingVertical: 3 },
  resultTitle: { color: '#F0F0F3', fontSize: 15, fontWeight: '900' },
  resultMeta: { color: '#7E808A', fontSize: 11, lineHeight: 16, marginTop: 5 },
  authorWork: { color: '#9B83C7', fontSize: 10, marginTop: 4 },
  authorCount: { color: '#686A74', fontSize: 9, marginTop: 4 },
  bookCard: { minHeight: 132, flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 11, marginBottom: 11 },
  cover: { width: 72, height: 108, borderRadius: 10, backgroundColor: '#1B1C23' },
  noCover: { width: 72, height: 108, borderRadius: 10, borderWidth: 1, borderColor: '#30313A', backgroundColor: '#191A21', justifyContent: 'center', alignItems: 'center' },
  noCoverMark: { color: '#9870EA', fontSize: 24 },
  noCoverText: { color: '#686A74', fontSize: 9, marginTop: 6 },
  bookTitle: { color: '#F2F2F5', fontSize: 15, lineHeight: 20, fontWeight: '900' },
  bookAuthor: { color: '#9698A1', fontSize: 11, lineHeight: 16, marginTop: 7 },
  year: { color: '#656771', fontSize: 9, marginTop: 9 },
  arrow: { color: '#706579', fontSize: 25, marginLeft: 8 },
});
