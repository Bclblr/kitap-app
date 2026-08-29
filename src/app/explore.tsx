import { useRouter } from 'expo-router';
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

export default function ExploreScreen() {
  const router = useRouter();

  const [query, setQuery] = useState('');

  const [books, setBooks] = useState<Book[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

useEffect(() => {
  const searchText = query.trim();

  if (!searchText) {
    setBooks([]);
    setUsers([]);
    setAuthors([]);
    setSearched(false);
    return;
  }

  const timer = setTimeout(() => {
    searchAll();
  }, 600);

  return () => {
    clearTimeout(timer);
  };
}, [query]);


  async function searchAll() {
    const searchText = query.trim();

    if (!searchText) {
      return;
    }

    setLoading(true);
    setSearched(true);

    setBooks([]);
    setUsers([]);
    setAuthors([]);

    try {
      /*
       * --------------------------------------------------
       * 1. KULLANICILARI SUPABASE'DEN ARA
       * --------------------------------------------------
       */

      const {
        data: userData,
        error: userError,
      } = await supabase
        .from('profiles')
        .select(
          'id, username, profile_image, bio'
        )
        .ilike(
          'username',
          `%${searchText}%`
        )
        .limit(10);

      if (userError) {
        console.error(
          'Kullanıcı arama hatası:',
          userError
        );
      }

      setUsers(
        (userData as UserProfile[]) || []
      );

      /*
       * --------------------------------------------------
       * 2. KİTAPLARI OPENLIBRARY'DEN ARA
       * --------------------------------------------------
       */

      try {
  const bookResponse = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(
      searchText
    )}&limit=20`
  );

  if (!bookResponse.ok) {
    console.warn(
      'OpenLibrary kitap araması başarısız:',
      bookResponse.status
    );

    setBooks([]);
  } else {
    const bookData =
      await bookResponse.json();

    setBooks(
      Array.isArray(bookData.docs)
        ? bookData.docs
        : []
    );
  }
} catch (error) {
  console.warn(
    'Kitap araması yapılamadı:',
    error
  );

  setBooks([]);
}

      /*
       * --------------------------------------------------
       * 3. YAZARLARI OPENLIBRARY'DEN ARA
       * --------------------------------------------------
       */

      const authorResponse =
        await fetch(
          `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(
            searchText
          )}&limit=10`
        );

      if (
        authorResponse.ok
      ) {
        const authorData =
          await authorResponse.json();

        const authorDocs =
          Array.isArray(
            authorData.docs
          )
            ? authorData.docs
            : [];

        const normalizedAuthors: Author[] =
          authorDocs.map(
            (author: any) => ({
              key:
                author.key ||
                author.author_key?.[0],

              name:
                author.name,

              birth_date:
                author.birth_date,

              top_work:
                author.top_work,

              work_count:
                author.work_count,
            })
          );

        setAuthors(
          normalizedAuthors
        );
      }
    } catch (error) {
      console.error(
        'Genel arama hatası:',
        error
      );

      setBooks([]);
      setAuthors([]);
    } finally {
      setLoading(false);
    }
  }

  function openUser(
  user: UserProfile
) {
  router.push({
    pathname: '/profile',
    params: {
      userId: user.id,
    },
  });
}

  function openBook(
    book: Book,
    authorName: string
  ) {
    router.push({
      pathname: '/book',
      params: {
        key: book.key,
        author: authorName,
      },
    });
  }

  function openAuthor(
    author: Author
  ) {
    /*
     * Şimdilik yazar için OpenLibrary
     * arama sonucundan kitapları gösteriyoruz.
     *
     * Ayrı bir author.tsx oluşturduğumuzda
     * burayı doğrudan yazar sayfasına
     * bağlayabiliriz.
     */

    if (!author.name) {
      return;
    }

    setQuery(author.name);

    searchAuthorBooks(
      author.name
    );
  }

  async function searchAuthorBooks(
    authorName: string
  ) {
    setLoading(true);

    try {
      const response =
        await fetch(
          `https://openlibrary.org/search.json?author=${encodeURIComponent(
            authorName
          )}&limit=20`
        );

      if (!response.ok) {
        throw new Error(
          `Yazar kitap API hatası: ${response.status}`
        );
      }

      const data =
        await response.json();

      setBooks(
        Array.isArray(data.docs)
          ? data.docs
          : []
      );

      /*
       * Kullanıcı ve yazar sonuçlarını
       * temizleyip kitapları gösteriyoruz.
       */
      setUsers([]);
      setAuthors([]);
      setSearched(true);
    } catch (error) {
      console.error(
        'Yazar kitapları yüklenemedi:',
        error
      );

      setBooks([]);
    } finally {
      setLoading(false);
    }
  }

  const hasResults =
    users.length > 0 ||
    authors.length > 0 ||
    books.length > 0;

  return (
    <View
      style={styles.container}
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        <Text
          style={styles.title}
        >
          Keşfet
        </Text>

        <Text
          style={styles.subtitle}
        >
          Kullanıcı, yazar, kitap veya ISBN ara
        </Text>

        {/* ARAMA */}
        <View
          style={styles.searchRow}
        >
          <TextInput
  value={query}
  onChangeText={(text) => {
    setQuery(text);
  }}
            onSubmitEditing={
              searchAll
            }
            placeholder="Kitap, yazar veya kullanıcı ara"
            placeholderTextColor="#999"
            style={styles.input}
            returnKeyType="search"
            autoCapitalize="none"
          />

          <Pressable
            onPress={
              searchAll
            }
            style={
              styles.searchButton
            }
          >
            <Text
              style={
                styles.searchButtonText
              }
            >
              Ara
            </Text>
          </Pressable>
        </View>

        {/* LOADING */}
        {loading && (
          <View
            style={styles.loading}
          >
            <ActivityIndicator
              size="large"
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Aranıyor...
            </Text>
          </View>
        )}

        {!loading &&
          searched &&
          !hasResults && (
            <View
              style={styles.empty}
            >
              <Text
                style={
                  styles.emptyIcon
                }
              >
                🔍
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Sonuç bulunamadı
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Farklı bir kullanıcı,
                yazar veya kitap adı
                deneyebilirsin.
              </Text>
            </View>
          )}

        {/* ------------------------------------------------ */}
        {/* KULLANICILAR */}
        {/* ------------------------------------------------ */}

        {!loading &&
          users.length > 0 && (
            <View
              style={styles.section}
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                👤 Kullanıcılar
              </Text>

              {users.map(
                (user) => (
                  <Pressable
                    key={
                      user.id
                    }
                    onPress={() =>
                      openUser(
                        user
                      )
                    }
                    style={
                      styles.userCard
                    }
                  >
                    {user.profile_image ? (
                      <Image
                        source={{
                          uri:
                            user.profile_image,
                        }}
                        style={
                          styles.userAvatar
                        }
                      />
                    ) : (
                      <View
                        style={
                          styles.userAvatarPlaceholder
                        }
                      >
                        <Text
                          style={
                            styles.userAvatarText
                          }
                        >
                          👤
                        </Text>
                      </View>
                    )}

                    <View
                      style={
                        styles.userInfo
                      }
                    >
                      <Text
                        style={
                          styles.username
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {user.username ||
                          'Kitap Okuru'}
                      </Text>

                      {user.bio ? (
                        <Text
                          style={
                            styles.userBio
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {
                            user.bio
                          }
                        </Text>
                      ) : (
                        <Text
                          style={
                            styles.userBio
                          }
                        >
                          Profilini görüntüle
                        </Text>
                      )}
                    </View>

                    <Text
                      style={
                        styles.arrow
                      }
                    >
                      ›
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          )}

        {/* ------------------------------------------------ */}
        {/* YAZARLAR */}
        {/* ------------------------------------------------ */}

        {!loading &&
          authors.length > 0 && (
            <View
              style={styles.section}
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                ✍️ Yazarlar
              </Text>

              {authors.map(
                (
                  author,
                  index
                ) => (
                  <Pressable
                    key={
                      author.key ||
                      `${author.name}-${index}`
                    }
                    onPress={() =>
                      openAuthor(
                        author
                      )
                    }
                    style={
                      styles.authorCard
                    }
                  >
                    <View
                      style={
                        styles.authorIcon
                      }
                    >
                      <Text
                        style={
                          styles.authorIconText
                        }
                      >
                        ✍️
                      </Text>
                    </View>

                    <View
                      style={
                        styles.authorInfo
                      }
                    >
                      <Text
                        style={
                          styles.authorName
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {author.name ||
                          'Bilinmeyen yazar'}
                      </Text>

                      {author.top_work ? (
                        <Text
                          style={
                            styles.authorWork
                          }
                          numberOfLines={
                            1
                          }
                        >
                          En bilinen eseri:{' '}
                          {
                            author.top_work
                          }
                        </Text>
                      ) : author.work_count ? (
                        <Text
                          style={
                            styles.authorWork
                          }
                        >
                          {
                            author.work_count
                          } eser
                        </Text>
                      ) : null}
                    </View>

                    <Text
                      style={
                        styles.arrow
                      }
                    >
                      ›
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          )}

        {/* ------------------------------------------------ */}
        {/* KİTAPLAR */}
        {/* ------------------------------------------------ */}

        {!loading &&
          books.length > 0 && (
            <View
              style={styles.section}
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                📚 Kitaplar
              </Text>

              {books.map(
                (book) => {
                  const coverUrl =
                    book.cover_i
                      ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                      : null;

                  const authorName =
                    book.author_name?.join(
                      ', '
                    ) ||
                    'Bilinmeyen yazar';

                  return (
                    <Pressable
                      key={
                        book.key
                      }
                      style={
                        styles.bookCard
                      }
                      onPress={() =>
                        openBook(
                          book,
                          authorName
                        )
                      }
                    >
                      {coverUrl ? (
                        <Image
                          source={{
                            uri:
                              coverUrl,
                          }}
                          style={
                            styles.cover
                          }
                        />
                      ) : (
                        <View
                          style={
                            styles.noCover
                          }
                        >
                          <Text
                            style={
                              styles.noCoverText
                            }
                          >
                            Kapak yok
                          </Text>
                        </View>
                      )}

                      <View
                        style={
                          styles.bookInfo
                        }
                      >
                        <Text
                          style={
                            styles.bookTitle
                          }
                          numberOfLines={
                            2
                          }
                        >
                          {book.title ??
                            'Bilinmeyen kitap'}
                        </Text>

                        <Text
                          style={
                            styles.author
                          }
                          numberOfLines={
                            2
                          }
                        >
                          {
                            authorName
                          }
                        </Text>

                        {book.first_publish_year && (
                          <Text
                            style={
                              styles.year
                            }
                          >
                            İlk yayın:{' '}
                            {
                              book.first_publish_year
                            }
                          </Text>
                        )}
                      </View>

                      <Text
                        style={
                          styles.bookArrow
                        }
                      >
                        ›
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>
          )}
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#F7F7F5',
    },

    content: {
      padding: 20,
      paddingBottom: 110,
    },

    title: {
      fontSize: 30,
      fontWeight: '700',
      color: '#222',
    },

    subtitle: {
      marginTop: 5,
      color: '#777',
      fontSize: 15,
      marginBottom: 20,
    },

    searchRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 25,
    },

    input: {
      flex: 1,
      height: 52,
      backgroundColor:
        '#FFFFFF',
      borderRadius: 14,
      paddingHorizontal: 16,
      fontSize: 15,
      borderWidth: 1,
      borderColor:
        '#E5E5E5',
    },

    searchButton: {
      height: 52,
      paddingHorizontal: 20,
      borderRadius: 14,
      backgroundColor:
        '#222',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    searchButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },

    loading: {
      alignItems: 'center',
      marginTop: 30,
    },

    loadingText: {
      marginTop: 10,
      color: '#777',
    },

    empty: {
      alignItems: 'center',
      marginTop: 50,
      paddingHorizontal: 25,
    },

    emptyIcon: {
      fontSize: 40,
      marginBottom: 12,
    },

    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#222',
    },

    emptyText: {
      marginTop: 8,
      color: '#777',
      textAlign: 'center',
      lineHeight: 20,
    },

    section: {
      marginBottom: 24,
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#222',
      marginBottom: 12,
    },

    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#FFFFFF',
      borderRadius: 16,
      padding: 13,
      marginBottom: 10,
    },

    userAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor:
        '#E8E8E3',
    },

    userAvatarPlaceholder: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor:
        '#E8E8E3',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    userAvatarText: {
      fontSize: 24,
    },

    userInfo: {
      flex: 1,
      marginLeft: 13,
    },

    username: {
      fontSize: 16,
      fontWeight: '700',
      color: '#222',
    },

    userBio: {
      marginTop: 5,
      fontSize: 13,
      color: '#777',
    },

    arrow: {
      fontSize: 28,
      color: '#999',
      marginLeft: 8,
    },

    authorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#FFFFFF',
      borderRadius: 16,
      padding: 13,
      marginBottom: 10,
    },

    authorIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor:
        '#E8E8E3',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    authorIconText: {
      fontSize: 23,
    },

    authorInfo: {
      flex: 1,
      marginLeft: 13,
    },

    authorName: {
      fontSize: 16,
      fontWeight: '700',
      color: '#222',
    },

    authorWork: {
      marginTop: 5,
      fontSize: 13,
      color: '#777',
    },

    bookCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 16,
      padding: 12,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },

    cover: {
      width: 75,
      height: 110,
      borderRadius: 8,
      backgroundColor:
        '#E8E8E8',
    },

    noCover: {
      width: 75,
      height: 110,
      borderRadius: 8,
      backgroundColor:
        '#E8E8E8',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    noCoverText: {
      fontSize: 11,
      color: '#777',
      textAlign: 'center',
    },

    bookInfo: {
      flex: 1,
      marginLeft: 14,
      paddingVertical: 5,
    },

    bookTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: '#222',
    },

    author: {
      fontSize: 14,
      color: '#777',
      marginTop: 7,
    },

    year: {
      fontSize: 12,
      color: '#999',
      marginTop: 10,
    },

    bookArrow: {
      fontSize: 28,
      color: '#999',
      marginLeft: 8,
    },
  });

