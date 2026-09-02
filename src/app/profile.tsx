import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';

type NotificationType = 'like' | 'comment' | 'repost';

type AppNotification = {
  id: string;
  type: NotificationType;
  username: string;
  message: string;
  bookTitle?: string;
  createdAt: string;
  read: boolean;
};

type Comment = {
  id: string;
  username: string;
  text: string;
  createdAt: string;
};

type ProfileData = {
  id: string;
  fullName: string;
  username: string;
  bio: string;
  profileImage: string | null;
  coverImage: string | null;
};

type Review = {
  id: string;
  userId: string;
  bookKey: string;
  bookTitle: string;
  rating: number;
  text: string;
  createdAt: string;
};

type Quote = {
  id: string;
  userId: string;
  bookKey: string;
  bookTitle: string;
  text: string;
  createdAt: string;
};

type Post = {
  id: string;
  userId: string;
  username: string;
  text: string;
  imageUrl: string | null;
  bookKey: string | null;
  bookTitle: string | null;
  rating: number;
  createdAt: string;
};

type FeedItem = {
  id: string;
  type: 'review' | 'quote' | 'post';
  createdAt: string;
  review?: Review;
  quote?: Quote;
  post?: Post;
  reposted?: boolean;
  repostedByUsername?: string;
  repostedAt?: string;
};

const DEFAULT_PROFILE: ProfileData = {
  id: '',
  fullName: '',
  username: 'Kitap Okuru',
  bio: 'Kitaplar, hikâyeler ve keşfedilecek yeni dünyalar 📚',
  profileImage: null,
  coverImage: null,
};

export default function ProfileScreen() {
  const router = useRouter();

  const { userId } = useLocalSearchParams<{
    userId?: string;
  }>();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [profile, setProfile] =
    useState<ProfileData>(DEFAULT_PROFILE);

  const [editing, setEditing] = useState(false);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');

  const [loading, setLoading] = useState(true);

  const [bookCount, setBookCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [quoteCount, setQuoteCount] = useState(0);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const [selectedPost, setSelectedPost] =
    useState<Post | null>(null);

  const [postModalVisible, setPostModalVisible] =
    useState(false);

  const [commentText, setCommentText] = useState('');

  const [comments, setComments] =
    useState<Comment[]>([]);

  const [commentsLoading, setCommentsLoading] =
    useState(false);

  const [commentSending, setCommentSending] =
    useState(false);

  const [selectedReview, setSelectedReview] =
    useState<Review | null>(null);

  const [reviewModalVisible, setReviewModalVisible] =
    useState(false);

  const isOwnProfile =
    !userId || userId === currentUserId;

  async function getCurrentUserId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user?.id ?? null;
  }

  /*
   * ============================================================
   * PROFİL
   * ============================================================
   */

  const loadProfile = useCallback(async () => {
    try {
      const loggedInUserId =
        await getCurrentUserId();

      setCurrentUserId(loggedInUserId);

      const targetUserId =
        typeof userId === 'string' && userId
          ? userId
          : loggedInUserId;

      if (!targetUserId) {
        setProfile(DEFAULT_PROFILE);
        return;
      }

      const { data, error } =
        await supabase
          .from('profiles')
          .select(
            'id, full_name, username, bio, profile_image, cover_image'
          )
          .eq('id', targetUserId)
          .maybeSingle();

      if (error) {
        console.error(
          'Profil yüklenemedi:',
          error
        );
        return;
      }

      if (!data) {
        if (targetUserId !== loggedInUserId) {
          setProfile(DEFAULT_PROFILE);
          return;
        }

        const newProfile = {
          id: targetUserId,
          full_name: '',
          username: DEFAULT_PROFILE.username,
          bio: DEFAULT_PROFILE.bio,
          profile_image: null,
          cover_image: null,
        };

        const { error: insertError } =
          await supabase
            .from('profiles')
            .insert(newProfile);

        if (insertError) {
          console.error(
            'Profil oluşturulamadı:',
            insertError
          );
        }

        setProfile(DEFAULT_PROFILE);
        return;
      }

      setProfile({
  id: data.id,

  fullName:
    data.full_name || '',

  username:
    data.username ||
    DEFAULT_PROFILE.username,

  bio:
    data.bio ??
    DEFAULT_PROFILE.bio,

  profileImage:
    data.profile_image || null,

  coverImage:
    data.cover_image || null,
});
    } catch (error) {
      console.error(
        'Profil yükleme hatası:',
        error
      );
    }
  }, [userId]);

  /*
   * ============================================================
   * TAKİP
   * ============================================================
   */

  const loadFollowData = useCallback(async () => {
    try {
      const loggedInUserId =
        await getCurrentUserId();

      const targetUserId =
        typeof userId === 'string' && userId
          ? userId
          : loggedInUserId;

      if (!targetUserId) {
        setFollowerCount(0);
        setFollowingCount(0);
        setIsFollowing(false);
        return;
      }

      const { count: followers } =
        await supabase
          .from('follows')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq(
            'following_id',
            targetUserId
          );

      setFollowerCount(
        followers || 0
      );

      const { count: following } =
        await supabase
          .from('follows')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq(
            'follower_id',
            targetUserId
          );

      setFollowingCount(
        following || 0
      );

      if (
        loggedInUserId &&
        loggedInUserId !== targetUserId
      ) {
        const { data } =
          await supabase
            .from('follows')
            .select('id')
            .eq(
              'follower_id',
              loggedInUserId
            )
            .eq(
              'following_id',
              targetUserId
            )
            .maybeSingle();

        setIsFollowing(!!data);
      } else {
        setIsFollowing(false);
      }
    } catch (error) {
      console.error(
        'Takip bilgileri yüklenemedi:',
        error
      );
    }
  }, [userId]);

  async function toggleFollow() {
    try {
      const loggedInUserId =
        await getCurrentUserId();

      const targetUserId =
        typeof userId === 'string' && userId
          ? userId
          : null;

      if (!loggedInUserId) {
        Alert.alert(
          'Giriş gerekli',
          'Takip etmek için giriş yapmalısın.'
        );
        return;
      }

      if (!targetUserId) return;

      if (
        loggedInUserId === targetUserId
      ) {
        return;
      }

      setFollowLoading(true);

      if (isFollowing) {
        const { error } =
          await supabase
            .from('follows')
            .delete()
            .eq(
              'follower_id',
              loggedInUserId
            )
            .eq(
              'following_id',
              targetUserId
            );

        if (error) {
          console.error(
            'Takipten çıkma hatası:',
            error
          );

          Alert.alert(
            'Hata',
            'Takipten çıkılamadı.'
          );

          return;
        }

        setIsFollowing(false);

        setFollowerCount(
          (count) =>
            Math.max(0, count - 1)
        );
      } else {
        const { error } =
          await supabase
            .from('follows')
            .insert({
              follower_id:
                loggedInUserId,
              following_id:
                targetUserId,
            });

        if (error) {
          console.error(
            'Takip etme hatası:',
            error
          );

          Alert.alert(
            'Hata',
            'Kullanıcı takip edilemedi.'
          );

          return;
        }

        setIsFollowing(true);

        setFollowerCount(
          (count) => count + 1
        );
      }
    } catch (error) {
      console.error(
        'Takip işlemi başarısız:',
        error
      );
    } finally {
      setFollowLoading(false);
    }
  }

  /*
   * ============================================================
   * İNCELEMELER
   * ============================================================
   */

  async function loadReviews(
    targetUserId: string
  ) {
    const {
      data,
      error,
    } = await supabase
      .from('reviews')
      .select(
        'id, user_id, book_key, book_title, rating, text, created_at'
      )
      .eq(
        'user_id',
        targetUserId
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      );

    if (error) {
      console.error(
        'İncelemeler yüklenemedi:',
        error
      );

      setReviews([]);
      return;
    }

    const loadedReviews: Review[] =
      (data || []).map(
        (item: any) => ({
          id: String(item.id),

          userId: String(
            item.user_id
          ),

          bookKey: String(
            item.book_key || ''
          ),

          bookTitle: String(
            item.book_title || ''
          ),

          rating:
            Number(item.rating) || 0,

          text: String(
            item.text || ''
          ),

          createdAt:
            item.created_at ||
            new Date().toISOString(),
        })
      );

    setReviews(
      loadedReviews
    );
  }

  /*
   * ============================================================
   * ALINTILAR
   * ============================================================
   */

  async function loadQuotes(
    targetUserId: string
  ) {
    const {
      data,
      error,
    } = await supabase
      .from('quotes')
      .select(
        'id, user_id, book_key, book_title, text, created_at'
      )
      .eq(
        'user_id',
        targetUserId
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      );

    if (error) {
      console.error(
        'Alıntılar yüklenemedi:',
        error
      );

      setQuotes([]);
      return;
    }

    const loadedQuotes: Quote[] =
      (data || []).map(
        (item: any) => ({
          id: String(item.id),

          userId: String(
            item.user_id
          ),

          bookKey: String(
            item.book_key || ''
          ),

          bookTitle: String(
            item.book_title || ''
          ),

          text: String(
            item.text || ''
          ),

          createdAt:
            item.created_at ||
            new Date().toISOString(),
        })
      );

    setQuotes(
      loadedQuotes
    );
  }

  /*
   * ============================================================
   * GÖNDERİLER
   *
   * posts kolonları:
   *
   * id
   * username
   * text
   * image_url
   * book_key
   * book_title
   * rating
   * created_at
   * user_id
   * ============================================================
   */

  async function loadPosts(
    targetUserId: string
  ) {
    const {
      data,
      error,
    } = await supabase
      .from('posts')
      .select(
        'id, username, text, image_url, book_key, book_title, rating, created_at, user_id'
      )
      .eq(
        'user_id',
        targetUserId
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      );

    if (error) {
      console.error(
        'Profil gönderileri yüklenemedi:',
        error
      );

      setPosts([]);
      return;
    }

    const loadedPosts: Post[] =
      (data || []).map(
        (item: any) => ({
          id: String(item.id),

          userId: String(
            item.user_id
          ),

          username:
            item.username ||
            profile.username,

          text:
            item.text || '',

          imageUrl:
            item.image_url ||
            null,

          bookKey:
            item.book_key ||
            null,

          bookTitle:
            item.book_title ||
            null,

          rating:
            Number(item.rating) || 0,

          createdAt:
            item.created_at ||
            new Date().toISOString(),
        })
      );

    setPosts(
      loadedPosts
    );
  }

  /*
   * ============================================================
   * REPOSTLAR
   *
   * post_reposts:
   * id
   * post_id
   * user_id
   * created_at
   * ============================================================
   */

  async function loadRepostedPosts(
    targetUserId: string
  ): Promise<FeedItem[]> {
    const {
      data: repostData,
      error: repostError,
    } = await supabase
      .from('post_reposts')
      .select(
        'id, post_id, user_id, created_at'
      )
      .eq(
        'user_id',
        targetUserId
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      );

    if (repostError) {
      console.error(
        'Repostlar yüklenemedi:',
        repostError
      );

      return [];
    }

    if (
      !repostData ||
      repostData.length === 0
    ) {
      return [];
    }

    const postIds =
      repostData.map(
        (item: any) =>
          item.post_id
      );

    const {
      data: originalPosts,
      error: postsError,
    } = await supabase
      .from('posts')
      .select(
        'id, username, text, image_url, book_key, book_title, rating, created_at, user_id'
      )
      .in(
        'id',
        postIds
      );

    if (postsError) {
      console.error(
        'Repost gönderileri alınamadı:',
        postsError
      );

      return [];
    }

    const postMap =
      new Map<string, Post>();

    (originalPosts || []).forEach(
      (item: any) => {
        postMap.set(
          String(item.id),
          {
            id: String(item.id),

            userId: String(
              item.user_id
            ),

            username:
              item.username ||
              'Kitap Okuru',

            text:
              item.text || '',

            imageUrl:
              item.image_url ||
              null,

            bookKey:
              item.book_key ||
              null,

            bookTitle:
              item.book_title ||
              null,

            rating:
              Number(item.rating) || 0,

            createdAt:
              item.created_at ||
              new Date().toISOString(),
          }
        );
      }
    );

    return repostData
      .map(
        (repost: any) => {
          const post =
            postMap.get(
              String(
                repost.post_id
              )
            );

          if (!post) {
            return null;
          }

          return {
            id:
              `repost-${repost.id}`,

            type: 'post',

            createdAt:
              repost.created_at,

            post,

            reposted: true,

            repostedByUsername:
              profile.username,

            repostedAt:
              repost.created_at,
          } as FeedItem;
        }
      )
      .filter(
        Boolean
      ) as FeedItem[];
  }

  /*
   * ============================================================
   * TEK AKIŞ OLUŞTUR
   *
   * İnceleme + Alıntı + Gönderi + Repost
   * hepsi aynı akışta.
   * En yeni tarih en üstte.
   * ============================================================
   */

  function buildFeed(
    loadedReviews: Review[],
    loadedQuotes: Quote[],
    loadedPosts: Post[],
    repostItems: FeedItem[]
  ) {
    const items: FeedItem[] = [];

    loadedReviews.forEach(
      (review) => {
        items.push({
          id:
            `review-${review.id}`,

          type: 'review',

          createdAt:
            review.createdAt,

          review,
        });
      }
    );

    loadedQuotes.forEach(
      (quote) => {
        items.push({
          id:
            `quote-${quote.id}`,

          type: 'quote',

          createdAt:
            quote.createdAt,

          quote,
        });
      }
    );

    loadedPosts.forEach(
      (post) => {
        items.push({
          id:
            `post-${post.id}`,

          type: 'post',

          createdAt:
            post.createdAt,

          post,
        });
      }
    );

    items.push(
      ...repostItems
    );

    items.sort(
      (a, b) =>
        new Date(
          b.createdAt
        ).getTime() -
        new Date(
          a.createdAt
        ).getTime()
    );

    setFeed(items);
  }

  /*
   * ============================================================
   * İSTATİSTİKLER
   * ============================================================
   */

  const loadStats = useCallback(async () => {
    try {
      const loggedInUserId =
        await getCurrentUserId();

      const targetUserId =
        typeof userId === 'string' && userId
          ? userId
          : loggedInUserId;

      if (!targetUserId) {
        setBookCount(0);
        setReviewCount(0);
        setQuoteCount(0);
        setReviews([]);
        setQuotes([]);
        setPosts([]);
        setFeed([]);
        return;
      }

      /*
       * Önce içerikleri yükle
       */

      const [
        reviewsResult,
        quotesResult,
        postsResult,
        repostResult,
      ] = await Promise.all([
        supabase
          .from('reviews')
          .select(
            'id, user_id, book_key, book_title, rating, text, created_at'
          )
          .eq(
            'user_id',
            targetUserId
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          ),

        supabase
          .from('quotes')
          .select(
            'id, user_id, book_key, book_title, text, created_at'
          )
          .eq(
            'user_id',
            targetUserId
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          ),

        supabase
          .from('posts')
          .select(
            'id, username, text, image_url, book_key, book_title, rating, created_at, user_id'
          )
          .eq(
            'user_id',
            targetUserId
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          ),

        supabase
          .from('post_reposts')
          .select(
            'id, post_id, user_id, created_at'
          )
          .eq(
            'user_id',
            targetUserId
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          ),
      ]);

      /*
       * İNCELEMELER
       */

      if (reviewsResult.error) {
        console.error(
          'Profil incelemeleri yüklenemedi:',
          reviewsResult.error
        );
      }

      const loadedReviews: Review[] =
        (
          reviewsResult.data ||
          []
        ).map(
          (item: any) => ({
            id: String(
              item.id
            ),

            userId: String(
              item.user_id
            ),

            bookKey:
              String(
                item.book_key ||
                  ''
              ),

            bookTitle:
              String(
                item.book_title ||
                  ''
              ),

            rating:
              Number(
                item.rating
              ) || 0,

            text:
              String(
                item.text ||
                  ''
              ),

            createdAt:
              item.created_at ||
              new Date().toISOString(),
          })
        );

      /*
       * ALINTILAR
       */

      if (quotesResult.error) {
        console.error(
          'Alıntılar yüklenemedi:',
          quotesResult.error
        );
      }

      const loadedQuotes: Quote[] =
        (
          quotesResult.data ||
          []
        ).map(
          (item: any) => ({
            id: String(
              item.id
            ),

            userId: String(
              item.user_id
            ),

            bookKey:
              String(
                item.book_key ||
                  ''
              ),

            bookTitle:
              String(
                item.book_title ||
                  ''
              ),

            text:
              String(
                item.text ||
                  ''
              ),

            createdAt:
              item.created_at ||
              new Date().toISOString(),
          })
        );

      /*
       * GÖNDERİLER
       */

      if (postsResult.error) {
        console.error(
          'Profil gönderileri yüklenemedi:',
          postsResult.error
        );
      }

      const loadedPosts: Post[] =
        (
          postsResult.data ||
          []
        ).map(
          (item: any) => ({
            id: String(
              item.id
            ),

            userId: String(
              item.user_id
            ),

            username:
              item.username ||
              profile.username,

            text:
              item.text ||
              '',

            imageUrl:
              item.image_url ||
              null,

            bookKey:
              item.book_key ||
              null,

            bookTitle:
              item.book_title ||
              null,

            rating:
              Number(
                item.rating
              ) || 0,

            createdAt:
              item.created_at ||
              new Date().toISOString(),
          })
        );

      /*
       * REPOSTLAR
       */

      let repostItems: FeedItem[] = [];

      if (
        !repostResult.error &&
        repostResult.data &&
        repostResult.data.length > 0
      ) {
        const repostPostIds =
          repostResult.data.map(
            (item: any) =>
              item.post_id
          );

        const {
          data: repostPosts,
          error: repostPostsError,
        } = await supabase
          .from('posts')
          .select(
            'id, username, text, image_url, book_key, book_title, rating, created_at, user_id'
          )
          .in(
            'id',
            repostPostIds
          );

        if (repostPostsError) {
          console.error(
            'Repost gönderileri yüklenemedi:',
            repostPostsError
          );
        } else {
          const postMap =
            new Map<string, Post>();

          (
            repostPosts ||
            []
          ).forEach(
            (item: any) => {
              postMap.set(
                String(
                  item.id
                ),
                {
                  id: String(
                    item.id
                  ),

                  userId:
                    String(
                      item.user_id
                    ),

                  username:
                    item.username ||
                    'Kitap Okuru',

                  text:
                    item.text ||
                    '',

                  imageUrl:
                    item.image_url ||
                    null,

                  bookKey:
                    item.book_key ||
                    null,

                  bookTitle:
                    item.book_title ||
                    null,

                  rating:
                    Number(
                      item.rating
                    ) || 0,

                  createdAt:
                    item.created_at ||
                    new Date().toISOString(),
                }
              );
            }
          );

          repostItems =
            repostResult.data
              .map(
                (repost: any) => {
                  const post =
                    postMap.get(
                      String(
                        repost.post_id
                      )
                    );

                  if (!post) {
                    return null;
                  }

                  return {
                    id:
                      `repost-${repost.id}`,

                    type: 'post',

                    createdAt:
                      repost.created_at,

                    post,

                    reposted:
                      true,

                    repostedByUsername:
                      profile.username,

                    repostedAt:
                      repost.created_at,
                  } as FeedItem;
                }
              )
              .filter(
                Boolean
              ) as FeedItem[];
        }
      }

      setReviews(
        loadedReviews
      );

      setQuotes(
        loadedQuotes
      );

      setPosts(
        loadedPosts
      );

      setReviewCount(
        loadedReviews.length
      );

      setQuoteCount(
        loadedQuotes.length
      );

      /*
       * Benzersiz kitap sayısı
       */

      const bookKeys =
        new Set<string>();

      loadedReviews.forEach(
        (review) => {
          if (
            review.bookKey
          ) {
            bookKeys.add(
              review.bookKey
            );
          }
        }
      );

      loadedQuotes.forEach(
        (quote) => {
          if (
            quote.bookKey
          ) {
            bookKeys.add(
              quote.bookKey
            );
          }
        }
      );

      loadedPosts.forEach(
        (post) => {
          if (
            post.bookKey
          ) {
            bookKeys.add(
              post.bookKey
            );
          }
        }
      );

      setBookCount(
        bookKeys.size
      );

      /*
       * TEK AKIŞ
       */

      buildFeed(
        loadedReviews,
        loadedQuotes,
        loadedPosts,
        repostItems
      );
    } catch (error) {
      console.error(
        'Profil istatistikleri yüklenemedi:',
        error
      );
    }
  }, [userId, profile.username]);

  /*
   * ============================================================
   * TÜM VERİLERİ YÜKLE
   * ============================================================
   */

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadAll() {
        setLoading(true);

        try {
          await loadProfile();
          await loadStats();
          await loadFollowData();
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      loadAll();

      return () => {
        active = false;
      };
    }, [
      loadProfile,
      loadStats,
      loadFollowData,
    ])
  );

  /*
   * ============================================================
   * TARİH
   * ============================================================
   */

  function formatDate(
    dateString: string
  ) {
    if (!dateString) {
      return '';
    }

    const date =
      new Date(
        dateString
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return dateString;
    }

    return date.toLocaleDateString(
      'tr-TR',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    );
  }

  function formatDateTime(
    dateString: string
  ) {
    if (!dateString) {
      return '';
    }

    const date =
      new Date(
        dateString
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }

    return date.toLocaleDateString(
      'tr-TR',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    );
  }

  function renderStars(
    rating: number
  ) {
    const safeRating =
      Math.max(
        0,
        Math.min(
          5,
          Math.round(
            Number(
              rating
            ) || 0
          )
        )
      );

    return '★'.repeat(
      safeRating
    );
  }

  /*
   * ============================================================
   * KİTABA GİT
   * ============================================================
   */

  function openBook(
    bookKey: string | null | undefined
  ) {
    if (!bookKey) {
      return;
    }

    router.push({
      pathname: '/book',
      params: {
        key: bookKey,
      },
    });
  }

  /*
   * ============================================================
   * PROFİL DÜZENLE
   * ============================================================
   */

  function startEditing() {
    setFullName(profile.fullName);
    setUsername(
      profile.username
    );

    setBio(
      profile.bio
    );

    setEditing(true);
  }

  async function handleSaveProfile() {
    const cleanUsername =
      username.trim();

    const cleanFullName =
      fullName.trim();

    const cleanBio =
      bio.trim();

    if (!cleanUsername) {
      Alert.alert(
        'Eksik bilgi',
        'Kullanıcı adı boş bırakılamaz.'
      );
      return;
    }

    const loggedInUserId =
      await getCurrentUserId();

    if (!loggedInUserId) {
      Alert.alert(
        'Giriş gerekli',
        'Profilini düzenlemek için giriş yapmalısın.'
      );
      return;
    }

    const updatedProfile =
      {
        ...profile,

        fullName:
          cleanFullName,

        username:
          cleanUsername,

        bio:
          cleanBio,
      };

    const {
      error,
    } = await supabase
      .from('profiles')
      .upsert(
        {
          id:
            loggedInUserId,

          full_name:
            cleanFullName || null,

          username:
            cleanUsername,

          bio:
            cleanBio,

          profile_image:
            profile.profileImage,

          cover_image:
            profile.coverImage,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      );

    if (error) {
      console.error(
        'Profil kaydedilemedi:',
        error
      );

      Alert.alert(
        'Hata',
        'Profil kaydedilemedi.'
      );

      return;
    }

    setProfile(
      updatedProfile
    );

    setEditing(false);

    Alert.alert(
      'Başarılı',
      'Profilin güncellendi.'
    );
  }

  /*
   * ============================================================
   * FOTOĞRAF YÜKLEME
   * ============================================================
   */

  async function uploadImageToStorage(
    uri: string,
    type: 'profile' | 'cover'
  ) {
    try {
      const loggedInUserId =
        await getCurrentUserId();

      if (!loggedInUserId) {
        Alert.alert(
          'Giriş gerekli',
          'Fotoğraf yüklemek için giriş yapmalısın.'
        );

        return null;
      }

      const response =
        await fetch(uri);

      const arrayBuffer =
        await response.arrayBuffer();

      const path =
        `${loggedInUserId}/${type}.jpg`;

      const {
        error,
      } = await supabase.storage
        .from('avatars')
        .upload(
          path,
          arrayBuffer,
          {
            contentType:
              'image/jpeg',

            upsert:
              true,
          }
        );

      if (error) {
        console.error(
          'Storage hatası:',
          error
        );

        Alert.alert(
          'Hata',
          error.message
        );

        return null;
      }

      const {
        data,
      } =
        supabase.storage
          .from('avatars')
          .getPublicUrl(
            path
          );

      if (
        !data?.publicUrl
      ) {
        return null;
      }

      return `${data.publicUrl}?v=${Date.now()}`;
    } catch (error) {
      console.error(
        'Fotoğraf yükleme hatası:',
        error
      );

      return null;
    }
  }

  async function chooseProfileImage() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'İzin gerekli',
        'Galeri izni gerekli.'
      );
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

    if (
      result.canceled ||
      !result.assets?.[0]?.uri
    ) {
      return;
    }

    const url =
      await uploadImageToStorage(
        result.assets[0].uri,
        'profile'
      );

    if (!url) {
      return;
    }

    const loggedInUserId =
      await getCurrentUserId();

    if (!loggedInUserId) {
      return;
    }

    const {
      error,
    } = await supabase
      .from('profiles')
      .upsert(
        {
          id:
            loggedInUserId,

          full_name:
            profile.fullName || null,

          username:
            profile.username,

          bio:
            profile.bio,

          profile_image:
            url,

          cover_image:
            profile.coverImage,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      );

    if (error) {
      console.error(
        'Profil fotoğrafı kaydedilemedi:',
        error
      );
      return;
    }

    setProfile(
      (old) => ({
        ...old,
        profileImage:
          url,
      })
    );
  }

  async function chooseCoverImage() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'İzin gerekli',
        'Galeri izni gerekli.'
      );
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 7],
        quality: 0.8,
      });

    if (
      result.canceled ||
      !result.assets?.[0]?.uri
    ) {
      return;
    }

    const url =
      await uploadImageToStorage(
        result.assets[0].uri,
        'cover'
      );

    if (!url) {
      return;
    }

    const loggedInUserId =
      await getCurrentUserId();

    if (!loggedInUserId) {
      return;
    }

    const {
      error,
    } = await supabase
      .from('profiles')
      .upsert(
        {
          id:
            loggedInUserId,

          full_name:
            profile.fullName || null,

          username:
            profile.username,

          bio:
            profile.bio,

          profile_image:
            profile.profileImage,

          cover_image:
            url,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      );

    if (error) {
      console.error(
        'Kapak kaydedilemedi:',
        error
      );
      return;
    }

    setProfile(
      (old) => ({
        ...old,
        coverImage:
          url,
      })
    );
  }

  /*
   * ============================================================
   * YORUMLAR
   * ============================================================
   */

  async function openPostComments(
    post: Post
  ) {
    setSelectedPost(
      post
    );

    setPostModalVisible(
      true
    );

    setCommentsLoading(
      true
    );

    try {
      const {
        data,
        error,
      } = await supabase
        .from('post_comments')
        .select(
          'id, user_id, text, created_at'
        )
        .eq(
          'post_id',
          post.id
        )
        .order(
          'created_at',
          {
            ascending: true,
          }
        );

      if (error) {
        console.error(
          'Yorumlar yüklenemedi:',
          error
        );

        setComments([]);
        return;
      }

      const loadedComments: Comment[] =
        (
          data || []
        ).map(
          (item: any) => ({
            id:
              String(
                item.id
              ),

            username:
              'Kullanıcı',

            text:
              String(
                item.text ||
                  ''
              ),

            createdAt:
              item.created_at ||
              '',
          })
        );

      setComments(
        loadedComments
      );
    } finally {
      setCommentsLoading(
        false
      );
    }
  }

  async function sendPostComment() {
    const text =
      commentText.trim();

    if (
      !text ||
      !selectedPost
    ) {
      return;
    }

    const loggedInUserId =
      await getCurrentUserId();

    if (!loggedInUserId) {
      Alert.alert(
        'Giriş gerekli',
        'Yorum yapmak için giriş yapmalısın.'
      );
      return;
    }

    setCommentSending(
      true
    );

    try {
      const {
        data,
        error,
      } = await supabase
        .from('post_comments')
        .insert({
          post_id:
            selectedPost.id,

          user_id:
            loggedInUserId,

          text,
        })
        .select()
        .single();

      if (error) {
        console.error(
          'Yorum gönderilemedi:',
          error
        );

        Alert.alert(
          'Hata',
          'Yorum gönderilemedi.'
        );

        return;
      }

      setComments(
        (old) => [
          ...old,

          {
            id:
              String(
                data.id
              ),

            username:
              profile.username,

            text,

            createdAt:
              data.created_at ||
              new Date().toISOString(),
          },
        ]
      );

      setCommentText('');
    } finally {
      setCommentSending(
        false
      );
    }
  }

  function closePostModal() {
    setPostModalVisible(
      false
    );

    setSelectedPost(
      null
    );

    setCommentText('');
    setComments([]);
  }

  /*
   * ============================================================
   * YÜKLENİYOR
   * ============================================================
   */

  if (loading) {
    return (
      <View
        style={
          styles.container
        }
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <Text
            style={
              styles.loadingText
            }
          >
            Profil yükleniyor...
          </Text>
        </View>

        <BottomNav />
      </View>
    );
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <View
      style={
        styles.container
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <Text
          style={
            styles.pageTitle
          }
        >
          Profil
        </Text>

        {/* KAPAK + PROFİL ÜST BİLGİ */}
        <View style={styles.profileHero}>
          <Pressable
            onPress={isOwnProfile ? chooseCoverImage : undefined}
            style={styles.coverContainer}
          >
            {profile.coverImage ? (
              <Image source={{ uri: profile.coverImage }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Text style={styles.coverIcon}>🖼️</Text>
                {isOwnProfile && <Text style={styles.coverText}>Kapak fotoğrafı ekle</Text>}
              </View>
            )}
            <View style={styles.coverShade} />
            {isOwnProfile && (
              <View style={styles.coverCamera}><Text style={styles.cameraText}>📷</Text></View>
            )}
          </Pressable>

          <View style={styles.identityRow}>
            <Pressable
              onPress={isOwnProfile ? chooseProfileImage : undefined}
              style={styles.profileImageContainer}
            >
              {profile.profileImage ? (
                <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.profilePlaceholder}><Text style={styles.profileIcon}>👤</Text></View>
              )}
              {isOwnProfile && (
                <View style={styles.profileCamera}><Text style={styles.cameraText}>📷</Text></View>
              )}
            </Pressable>

            {!editing && (
              <View style={styles.identityInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.username} numberOfLines={1}>{profile.fullName || profile.username}</Text>
                </View>
                <Text style={styles.handle}>@{profile.username.toLowerCase().replace(/\s+/g, '')}</Text>
                <View style={styles.verifiedRow}>
                  <Text style={styles.verifiedIcon}>✦</Text>
                  <Text style={styles.verifiedText}>Okur Profili</Text>
                </View>
                <Text style={styles.bio}>{profile.bio}</Text>
              </View>
            )}
          </View>

          {editing ? (
            <View style={styles.editArea}>
              <Text style={styles.inputLabel}>Ad soyad</Text>
              <TextInput value={fullName} onChangeText={setFullName} placeholder="Adın ve soyadın" placeholderTextColor="#777" style={styles.input} maxLength={50} />
              <Text style={styles.inputLabel}>Kullanıcı adı</Text>
              <TextInput value={username} onChangeText={setUsername} placeholder="Kullanıcı adın" placeholderTextColor="#777" style={styles.input} maxLength={30} />
              <Text style={styles.inputLabel}>Biyografi</Text>
              <TextInput value={bio} onChangeText={setBio} placeholder="Kendinden bahset..." placeholderTextColor="#777" style={[styles.input, styles.bioInput]} multiline maxLength={150} />
              <View style={styles.editButtons}>
                <Pressable onPress={() => setEditing(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Vazgeç</Text></Pressable>
                <Pressable onPress={handleSaveProfile} style={styles.saveButton}><Text style={styles.saveText}>Kaydet</Text></Pressable>
              </View>
            </View>
          ) : isOwnProfile ? (
            <Pressable onPress={startEditing} style={styles.editButton}><Text style={styles.editButtonText}>✏️ Profili Düzenle</Text></Pressable>
          ) : (
            <View style={styles.profileActions}>
              <Pressable onPress={toggleFollow} disabled={followLoading} style={[styles.followButton, isFollowing && styles.followingButton]}>
                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>{followLoading ? '...' : isFollowing ? 'Takiptesin' : 'Takip Et'}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!profile?.id) { Alert.alert('Hata', 'Kullanıcı bulunamadı.'); return; }
                  router.push({ pathname: '/chat', params: { userId: profile.id, username: profile.username || 'Kitap Okuru' } });
                }}
                style={styles.messageButton}
              ><Text style={styles.messageButtonText}>💬 Mesaj</Text></Pressable>
            </View>
          )}
        </View>

        {/* İSTATİSTİKLER */}

        <View
          style={
            styles.stats
          }
        >
          <View
            style={
              styles.stat
            }
          >
            <Text
              style={
                styles.statNumber
              }
            >
              {
                bookCount
              }
            </Text>

            <Text
              style={
                styles.statLabel
              }
            >
              Kitap
            </Text>
          </View>

          <View
            style={
              styles.stat
            }
          >
            <Text
              style={
                styles.statNumber
              }
            >
              {
                reviewCount
              }
            </Text>

            <Text
              style={
                styles.statLabel
              }
            >
              İnceleme
            </Text>
          </View>

          <View
            style={
              styles.stat
            }
          >
            <Text
              style={
                styles.statNumber
              }
            >
              {
                followerCount
              }
            </Text>

            <Text
              style={
                styles.statLabel
              }
            >
              Takipçi
            </Text>
          </View>

          <View
            style={
              styles.stat
            }
          >
            <Text
              style={
                styles.statNumber
              }
            >
              {
                followingCount
              }
            </Text>

            <Text
              style={
                styles.statLabel
              }
            >
              Takip
            </Text>
          </View>

          <View
            style={
              styles.stat
            }
          >
            <Text
              style={
                styles.statNumber
              }
            >
              {
                quoteCount
              }
            </Text>

            <Text
              style={
                styles.statLabel
              }
            >
              Alıntı
            </Text>
          </View>
        </View>

        {/* =====================================================
            TEK AKIŞ
            ===================================================== */}

        <View
          style={
            styles.section
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Paylaşımlar
          </Text>

          {feed.length === 0 ? (
            <View
              style={
                styles.emptyCard
              }
            >
              <Text
                style={
                  styles.emptyIcon
                }
              >
                📚
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Henüz paylaşım yok
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                İnceleme, alıntı veya
                gönderilerini burada
                görebilirsin.
              </Text>
            </View>
          ) : (
            feed.map(
              (item) => {
                /*
                 * ================================================
                 * İNCELEME
                 * ================================================
                 */

                if (
                  item.type ===
                  'review' &&
                  item.review
                ) {
                  const review =
                    item.review;

                  return (
                    <Pressable
                      key={
                        item.id
                      }
                      onPress={() => {
                        setSelectedReview(
                          review
                        );

                        setReviewModalVisible(
                          true
                        );
                      }}
                      style={
                        styles.feedCard
                      }
                    >
                      <View
                        style={
                          styles.feedTypeRow
                        }
                      >
                        <Text
                          style={
                            styles.feedType
                          }
                        >
                          📚 İNCELEME
                        </Text>

                        <Text
                          style={
                            styles.feedDate
                          }
                        >
                          {formatDate(
                            review.createdAt
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.bookHeader
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
                          📖{' '}
                          {
                            review.bookTitle
                          }
                        </Text>

                        {review.bookKey && (
                          <Text
                            style={
                              styles.openBookText
                            }
                          >
                            ›
                          </Text>
                        )}
                      </View>

                      <View
                        style={
                          styles.ratingRow
                        }
                      >
                        <Text
                          style={
                            styles.stars
                          }
                        >
                          {renderStars(
                            review.rating
                          )}
                        </Text>

                        <Text
                          style={
                            styles.ratingText
                          }
                        >
                          {
                            review.rating
                          }
                          /5
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.feedText
                        }
                      >
                        {
                          review.text
                        }
                      </Text>
                    </Pressable>
                  );
                }

                /*
                 * ================================================
                 * ALINTI
                 * ================================================
                 */

                if (
                  item.type ===
                  'quote' &&
                  item.quote
                ) {
                  const quote =
                    item.quote;

                  return (
                    <Pressable
                      key={
                        item.id
                      }
                      onPress={() =>
                        openBook(
                          quote.bookKey
                        )
                      }
                      style={[
                        styles.feedCard,
                        styles.quoteCard,
                      ]}
                    >
                      <View
                        style={
                          styles.feedTypeRow
                        }
                      >
                        <Text
                          style={
                            styles.feedType
                          }
                        >
                          ✍️ ALINTI
                        </Text>

                        <Text
                          style={
                            styles.feedDate
                          }
                        >
                          {formatDate(
                            quote.createdAt
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.bookHeader
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
                          📖{' '}
                          {
                            quote.bookTitle
                          }
                        </Text>

                        {quote.bookKey && (
                          <Text
                            style={
                              styles.openBookText
                            }
                          >
                            ›
                          </Text>
                        )}
                      </View>

                      <Text
                        style={
                          styles.quoteText
                        }
                      >
                        “{quote.text}”
                      </Text>
                    </Pressable>
                  );
                }

                /*
                 * ================================================
                 * GÖNDERİ
                 * ================================================
                 */

                if (
                  item.type ===
                    'post' &&
                  item.post
                ) {
                  const post =
                    item.post;

                  return (
                    <View
                      key={
                        item.id
                      }
                      style={
                        styles.feedCard
                      }
                    >
                      {item.reposted && (
                        <View
                          style={
                            styles.repostHeader
                          }
                        >
                          <Text
                            style={
                              styles.repostText
                            }
                          >
                            🔁 Yeniden paylaşıldı
                          </Text>

                          <Text
                            style={
                              styles.repostDate
                            }
                          >
                            {formatDate(
                              item.createdAt
                            )}
                          </Text>
                        </View>
                      )}

                      <View
                        style={
                          styles.feedTypeRow
                        }
                      >
                        <Text
                          style={
                            styles.feedType
                          }
                        >
                          📝 GÖNDERİ
                        </Text>

                        {!item.reposted && (
                          <Text
                            style={
                              styles.feedDate
                            }
                          >
                            {formatDate(
                              post.createdAt
                            )}
                          </Text>
                        )}
                      </View>

                      <Text
                        style={
                          styles.postUsername
                        }
                      >
                        @{post.username}
                      </Text>

                      {post.text ? (
                        <Text
                          style={
                            styles.feedText
                          }
                        >
                          {
                            post.text
                          }
                        </Text>
                      ) : null}

                      {post.imageUrl && (
                        <Image
                          source={{
                            uri:
                              post.imageUrl,
                          }}
                          style={
                            styles.postImage
                          }
                          resizeMode="cover"
                        />
                      )}

                      {post.bookTitle && (
                        <Pressable
                          onPress={() =>
                            openBook(
                              post.bookKey
                            )
                          }
                          style={
                            styles.attachedBook
                          }
                        >
                          <Text
                            style={
                              styles.attachedBookText
                            }
                          >
                            📖{' '}
                            {
                              post.bookTitle
                            }
                          </Text>

                          {post.rating >
                            0 && (
                            <Text
                              style={
                                styles.attachedRating
                              }
                            >
                              {renderStars(
                                post.rating
                              )}
                            </Text>
                          )}
                        </Pressable>
                      )}

                      <View
                        style={
                          styles.postBottomRow
                        }
                      >
                        <Text
                          style={
                            styles.feedDate
                          }
                        >
                          {formatDate(
                            item.reposted
                              ? item.createdAt
                              : post.createdAt
                          )}
                        </Text>

                        <Pressable
                          onPress={() =>
                            openPostComments(
                              post
                            )
                          }
                          style={
                            styles.commentButton
                          }
                        >
                          <Text>
                            💬 Yorumlar
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }

                return null;
              }
            )
          )}
        </View>
      </ScrollView>

      {/* =======================================================
          İNCELEME MODALI
          ======================================================= */}

      <Modal
        visible={
          reviewModalVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setReviewModalVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.reviewModal
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <Text
                style={
                  styles.modalTitle
                }
              >
                İnceleme
              </Text>

              <Pressable
                onPress={() =>
                  setReviewModalVisible(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.closeButton
                  }
                >
                  ✕
                </Text>
              </Pressable>
            </View>

            {selectedReview && (
              <>
                <Text
                  style={
                    styles.modalBookTitle
                  }
                >
                  📖{' '}
                  {
                    selectedReview.bookTitle
                  }
                </Text>

                <View
                  style={
                    styles.ratingRow
                  }
                >
                  <Text
                    style={
                      styles.stars
                    }
                  >
                    {renderStars(
                      selectedReview.rating
                    )}
                  </Text>

                  <Text
                    style={
                      styles.ratingText
                    }
                  >
                    {
                      selectedReview.rating
                    }
                    /5
                  </Text>
                </View>

                <Text
                  style={
                    styles.modalReviewText
                  }
                >
                  {
                    selectedReview.text
                  }
                </Text>

                <Text
                  style={
                    styles.feedDate
                  }
                >
                  {formatDate(
                    selectedReview.createdAt
                  )}
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* =======================================================
          GÖNDERİ / YORUM MODALI
          ======================================================= */}

      <Modal
        visible={
          postModalVisible
        }
        transparent
        animationType="slide"
        onRequestClose={
          closePostModal
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.postModal
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <Text
                style={
                  styles.modalTitle
                }
              >
                Gönderi
              </Text>

              <Pressable
                onPress={
                  closePostModal
                }
              >
                <Text
                  style={
                    styles.closeButton
                  }
                >
                  ✕
                </Text>
              </Pressable>
            </View>

            {selectedPost && (
              <ScrollView
                style={
                  styles.modalScroll
                }
              >
                <Text
                  style={
                    styles.postUsername
                  }
                >
                  @{selectedPost.username}
                </Text>

                {selectedPost.text ? (
                  <Text
                    style={
                      styles.modalPostText
                    }
                  >
                    {
                      selectedPost.text
                    }
                  </Text>
                ) : null}

                {selectedPost.imageUrl && (
                  <Image
                    source={{
                      uri:
                        selectedPost.imageUrl,
                    }}
                    style={
                      styles.modalPostImage
                    }
                    resizeMode="contain"
                  />
                )}

                <Text
                  style={
                    styles.feedDate
                  }
                >
                  {formatDate(
                    selectedPost.createdAt
                  )}
                </Text>

                <Text
                  style={
                    styles.commentsTitle
                  }
                >
                  Yorumlar
                </Text>

                {commentsLoading ? (
                  <Text
                    style={
                      styles.emptyComments
                    }
                  >
                    Yorumlar yükleniyor...
                  </Text>
                ) : comments.length ===
                  0 ? (
                  <Text
                    style={
                      styles.emptyComments
                    }
                  >
                    Henüz yorum yok.
                  </Text>
                ) : (
                  comments.map(
                    (
                      comment
                    ) => (
                      <View
                        key={
                          comment.id
                        }
                        style={
                          styles.commentItem
                        }
                      >
                        <Text
                          style={
                            styles.commentUsername
                          }
                        >
                          {
                            comment.username
                          }
                        </Text>

                        <Text
                          style={
                            styles.commentText
                          }
                        >
                          {
                            comment.text
                          }
                        </Text>
                      </View>
                    )
                  )
                )}
              </ScrollView>
            )}

            <View
              style={
                styles.commentInputRow
              }
            >
              <TextInput
                value={
                  commentText
                }
                onChangeText={
                  setCommentText
                }
                placeholder="Yorum yaz..."
                placeholderTextColor="#999"
                style={
                  styles.commentInput
                }
                multiline
                maxLength={300}
              />

              <Pressable
                onPress={
                  sendPostComment
                }
                disabled={
                  commentSending
                }
                style={
                  styles.sendButton
                }
              >
                <Text
                  style={
                    styles.sendButtonText
                  }
                >
                  {commentSending
                    ? '...'
                    : 'Gönder'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090A0F',
  },

  scrollContent: {
    paddingBottom: 110,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#8E8E98',
  },

  pageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F5F5F7',
    marginTop: 18,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  profileHero: { paddingBottom: 4 },
  coverContainer: { width: '100%', height: 190, position: 'relative', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', backgroundColor: '#15161D', justifyContent: 'center', alignItems: 'center' },
  coverShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 95, backgroundColor: 'rgba(9,10,15,0.38)' },
  coverIcon: { fontSize: 34 },
  coverText: { marginTop: 8, fontSize: 13, color: '#A2A2AC', fontWeight: '600' },
  coverCamera: { position: 'absolute', right: 16, top: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(15,16,22,0.88)', justifyContent: 'center', alignItems: 'center' },
  cameraText: { fontSize: 17 },
  identityRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: -74, paddingHorizontal: 20, zIndex: 3 },
  profileImageContainer: { width: 138, height: 138, borderRadius: 69, borderWidth: 3, borderColor: '#7C63E6', backgroundColor: '#090A0F', padding: 4, position: 'relative', flexShrink: 0 },
  profileImage: { width: 124, height: 124, borderRadius: 62 },
  profilePlaceholder: { width: 124, height: 124, borderRadius: 62, backgroundColor: '#1A1B23', justifyContent: 'center', alignItems: 'center' },
  profileIcon: { fontSize: 48 },
  profileCamera: { position: 'absolute', right: -2, bottom: 4, width: 36, height: 36, borderRadius: 18, backgroundColor: '#20212A', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#090A0F' },
  identityInfo: { flex: 1, paddingLeft: 18, paddingTop: 70, minHeight: 150 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { flexShrink: 1, fontSize: 24, lineHeight: 30, fontWeight: '800', color: '#F5F5F7' },
  handle: { marginTop: 3, fontSize: 14, color: '#B5B5BE' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  verifiedIcon: { color: '#8B6FF0', fontSize: 16, marginRight: 6 },
  verifiedText: { color: '#A98BFF', fontSize: 14, fontWeight: '700' },
  bio: { marginTop: 9, color: '#E0E0E5', fontSize: 14, lineHeight: 20 },
  profileActions: { flexDirection: 'row', gap: 10, marginTop: 18, paddingHorizontal: 20 },
  messageButton: { flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: '#1B1C23', borderWidth: 1, borderColor: '#292A33', justifyContent: 'center', alignItems: 'center' },
  messageButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  editArea: { width: '90%', marginTop: 18, alignSelf: 'center' },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#E7E7EB', marginBottom: 7, marginTop: 12 },
  input: { width: '100%', minHeight: 48, backgroundColor: '#15161D', borderRadius: 12, borderWidth: 1, borderColor: '#2A2B34', paddingHorizontal: 14, fontSize: 15, color: '#F5F5F7' },
  bioInput: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  editButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 15 },
  cancelButton: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: '#20212A' },
  cancelText: { color: '#B0B0BA', fontWeight: '600' },
  saveButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: '#7C63E6' },
  saveText: { color: '#FFF', fontWeight: '700' },
  editButton: { marginTop: 16, marginHorizontal: 20, minHeight: 46, borderRadius: 23, backgroundColor: '#7C63E6', justifyContent: 'center', alignItems: 'center' },
  editButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  followButton: { flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: '#7157DD', justifyContent: 'center', alignItems: 'center' },
  followingButton: { backgroundColor: '#7157DD' },
  followButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  followingButtonText: { color: '#FFF' },

  stats: {
    flexDirection: 'row',
    marginTop: 25,
    marginHorizontal: 15,
    justifyContent: 'space-around',
    paddingVertical: 18,
    backgroundColor: '#FFF',
    borderRadius: 18,
  },

  stat: {
    alignItems: 'center',
  },

  statNumber: {
    fontSize: 19,
    fontWeight: '700',
    color: '#222',
  },

  statLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#8E8E98',
  },

  section: {
    marginTop: 28,
    marginHorizontal: 20,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
  },

  emptyCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 25,
    alignItems: 'center',
  },

  emptyIcon: {
    fontSize: 38,
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },

  emptyText: {
    marginTop: 6,
    textAlign: 'center',
    color: '#8E8E98',
    lineHeight: 20,
  },

  /*
   * FEED
   */

  feedCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },

  quoteCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#7C63E6',
  },

  feedTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  feedType: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B0B0BA',
  },

  feedDate: {
    fontSize: 11,
    color: '#999',
  },

  bookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  bookTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
    lineHeight: 23,
  },

  openBookText: {
    marginLeft: 8,
    fontSize: 28,
    color: '#999',
    lineHeight: 30,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
  },

  stars: {
    fontSize: 17,
    letterSpacing: 2,
    color: '#222',
  },

  ratingText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E98',
  },

  feedText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#D4D4DA',
  },

  quoteText: {
    marginTop: 15,
    fontSize: 17,
    lineHeight: 27,
    color: '#D4D4DA',
    fontStyle: 'italic',
  },

  postUsername: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E7E7EB',
    marginBottom: 7,
  },

  postImage: {
    width: '100%',
    height: 260,
    borderRadius: 14,
    marginTop: 14,
    backgroundColor: '#EEE',
  },

  attachedBook: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#181920',
  },

  attachedBookText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E7E7EB',
  },

  attachedRating: {
    marginTop: 5,
    fontSize: 13,
    letterSpacing: 1,
  },

  postBottomRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#25262F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  commentButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#1B1C24',
  },

  repostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#25262F',
  },

  repostText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B0B0BA',
  },

  repostDate: {
    fontSize: 11,
    color: '#999',
  },

  /*
   * MODAL
   */

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },

  reviewModal: {
    backgroundColor: '#090A0F',
    borderRadius: 22,
    padding: 20,
    maxHeight: '75%',
  },

  postModal: {
    backgroundColor: '#090A0F',
    borderRadius: 22,
    maxHeight: '85%',
    padding: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    marginBottom: 15,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#222',
  },

  closeButton: {
    fontSize: 22,
    color: '#B0B0BA',
    padding: 5,
  },

  modalBookTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },

  modalReviewText: {
    marginTop: 18,
    fontSize: 16,
    lineHeight: 25,
    color: '#D4D4DA',
  },

  modalScroll: {
    flexGrow: 0,
  },

  modalPostText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#D4D4DA',
    marginBottom: 12,
  },

  modalPostImage: {
    width: '100%',
    height: 300,
    borderRadius: 14,
    backgroundColor: '#EEE',
    marginBottom: 12,
  },

  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginTop: 22,
    marginBottom: 12,
  },

  emptyComments: {
    color: '#888',
    paddingVertical: 20,
  },

  commentItem: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },

  commentUsername: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E7E7EB',
    marginBottom: 4,
  },

  commentText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#D4D4DA',
  },

  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
  },

  commentInput: {
    flex: 1,
    minHeight: 45,
    maxHeight: 90,
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: '#222',
    fontSize: 14,
  },

  sendButton: {
    minHeight: 45,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
