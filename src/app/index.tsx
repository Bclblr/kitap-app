import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import BottomNav from '@/components/BottomNav';
import StoryPlayback from '@/components/StoryPlayback';
import StoryActions from '@/components/StoryActions';
import StoryTransition from '@/components/StoryTransition';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReadersList from '@/components/ReadersList';
import AdSlot from '@/components/AdSlot';
import { Action, ui } from '@/components/ReaderUI';
import { useReaderSocial } from '@/hooks/use-reader-social';
import { supabase } from '@/lib/supabase';
import { storyAge } from '@/lib/reader-date';

type Comment = {
  id: string;
  username: string;
  text: string;
  createdAt: string;
  user_id?: string;
};

type Review = {
  id: string;
  user_id?: string;
  bookKey: string;
  bookTitle: string;
  rating: number;
  text: string;
  createdAt: string;
  username?: string;
  full_name?: string | null;
  profile_image?: string | null;
  likes?: number;
  liked?: boolean;
  comments?: Comment[];
  reposts?: number;
  reposted?: boolean;
};

type Quote = {
  id: string;
  bookKey: string;
  bookTitle: string;
  text: string;
  createdAt: string;
};

type Post = {
  id: string;
  user_id: string | null;
  username: string;
  full_name?: string | null;
  profile_image?: string | null;
  text: string | null;
  image_url: string | null;
  book_key: string | null;
  book_title: string | null;
  rating: number;
  created_at: string;

  saved?: boolean;

  likes?: number;
  liked?: boolean;

  comments?: Comment[];
  reposts?: number;
  reposted?: boolean;
  isReview?: boolean;
  isQuote?: boolean;
};

type Story = {
  id: string;
  user_id?: string | null;
  username: string;
  profile_image?: string | null;
  image_url: string | null;
  text: string | null;
  created_at: string;
  expires_at: string;
};

const REVIEWS_KEY = 'reviews';
const STORY_SEEN_KEY = 'story-seen-ids';

const CURRENT_USERNAME = 'Kitap Okuru';

function isValidUUID(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export default function HomeScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const composerY = useRef(0);
  const insets = useSafeAreaInsets();
  const social = useReaderSocial();
  const [feedTab, setFeedTab] = useState<'following' | 'for-you'>('for-you');
  const [createMenu, setCreateMenu] = useState(false);
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const router = useRouter();const [selectedStory, setSelectedStory] =
  useState<Story | null>(null);
  const [storyGroupIndex, setStoryGroupIndex] = useState<number | null>(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [seenStoryIds, setSeenStoryIds] = useState<string[]>([]);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

    const [currentUser, setCurrentUser] =
  useState<any>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [bookCoverUrls, setBookCoverUrls] =
    useState<Record<string, string | null>>({});

  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingStories, setLoadingStories] = useState(false);

  const [commentingReviewId, setCommentingReviewId] =
    useState<string | null>(null);

  const [commentingPostId, setCommentingPostId] =
    useState<string | null>(null);

  const [commentText, setCommentText] = useState('');
  const [postCommentText, setPostCommentText] = useState('');

  const [showPostBox, setShowPostBox] = useState(false);
  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const [showStoryBox, setShowStoryBox] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [storyImage, setStoryImage] = useState<string | null>(null);
  const [postingStory, setPostingStory] = useState(false);

  /*
   * =====================================================
   * AUTH
   * =====================================================
   */

  async function getCurrentUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {

      return null;
    }

    async function checkAuth() {
  const user = await getCurrentUser();
  setCurrentUser(user);
}

    return user;
  }

  async function getCurrentUserId() {
    const user = await getCurrentUser();
    return user?.id ?? null;
  }



  /*
   * =====================================================
   * REVIEWS
   * =====================================================
   */

  const loadReviews = useCallback(async () => {
  console.log('LOAD REVIEWS ÇALIŞTI');

  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      console.error(
        'Supabase incelemeleri yüklenemedi:',
        error
      );

      setReviews([]);
      return;
    }

    if (!data) {
      setReviews([]);
      return;
    }

    const { data: reviewProfileData } =
      await supabase
        .from('profiles')
        .select('id, full_name, username, profile_image');

    const reviewProfiles = new Map(
      (reviewProfileData ?? []).map((profile: any) => [
        profile.id,
        profile,
      ])
    );

    const preparedReviews: Review[] =
      await Promise.all(
        data.map(async (review: any) => {
          let likesCount = 0;
          let liked = false;
          let repostsCount = 0;
          let reposted = false;
          let preparedComments: Comment[] = [];

          // BEĞENİ SAYISI
          const { count: likeCount } =
            await supabase
              .from('likes')
              .select('id', {
                count: 'exact',
                head: true,
              })
              .eq(
                'review_id',
                review.id
              );

          likesCount = likeCount ?? 0;

          // YENİDEN PAYLAŞIM SAYISI
          const { count: repostCount } =
            await supabase
              .from('reposts')
              .select('id', {
                count: 'exact',
                head: true,
              })
              .eq(
                'review_id',
                review.id
              );

          repostsCount = repostCount ?? 0;

          // KULLANICI BEĞENMİŞ Mİ?
          if (userId) {
            const { data: likeData } =
              await supabase
                .from('likes')
                .select('id')
                .eq(
                  'review_id',
                  review.id
                )
                .eq(
                  'user_id',
                  userId
                )
                .maybeSingle();

            liked = !!likeData;

            // KULLANICI YENİDEN PAYLAŞMIŞ MI?
            const { data: repostData } =
              await supabase
                .from('reposts')
                .select('id')
                .eq(
                  'review_id',
                  review.id
                )
                .eq(
                  'user_id',
                  userId
                )
                .maybeSingle();

            reposted = !!repostData;
          }

          // YORUMLAR
          const { data: commentData } =
            await supabase
              .from('comments')
              .select(`
                id,
                text,
                created_at,
                user_id
              `)
              .eq(
                'review_id',
                review.id
              )
              .order('created_at', {
                ascending: true,
              });

          if (commentData) {
            preparedComments =
              commentData.map(
                (comment: any) => ({
                  id: comment.id,
                  user_id: comment.user_id,
                  username:
                    comment.user_id === userId
                      ? CURRENT_USERNAME
                      : 'Kitap Okuru',
                  text: comment.text,
                  createdAt:
                    comment.created_at,
                })
              );
          }

          const reviewAuthor =
            reviewProfiles.get(review.user_id);

          return {
            id: review.id,
            user_id: review.user_id,
            bookKey: review.book_key,
            bookTitle: review.book_title,
            rating: Number(review.rating) || 0,
            text: review.text || '',
            createdAt: review.created_at,
            username:
              reviewAuthor?.username ||
              CURRENT_USERNAME,
            full_name:
              reviewAuthor?.full_name ?? null,
            profile_image:
              reviewAuthor?.profile_image ??
              null,
            likes: likesCount,
            liked,
            comments: preparedComments,
            reposts: repostsCount,
            reposted,
          };
        })
      );

    console.log(
      'SUPABASE REVIEWS:',
      preparedReviews
    );

    setReviews(preparedReviews);

  } catch (error) {
    console.error(
      'İncelemeler yüklenemedi:',
      error
    );

    setReviews([]);
  }
}, []);
  /*
   * =====================================================
   * POSTS
   * =====================================================
   */

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Postlar yüklenemedi:',
          error
        );
        return;
      }

      if (!data) {
        setPosts([]);
        return;
      }

      const userId =
        await getCurrentUserId();

      setCurrentUserId(userId);

      const { data: profileData } =
        await supabase
          .from('profiles')
          .select('id, full_name, username, profile_image');

      const profilesByUserId = new Map(
        (profileData ?? []).map((profile: any) => [
          profile.id,
          profile,
        ])
      );

      const currentProfile = userId
        ? profilesByUserId.get(userId)
        : null;

      const preparedPosts: Post[] =
        await Promise.all(
          data.map(async (post: any) => {
            let liked = false;
            let saved = false;
            let reposted = false;

            let likes = 0;
            let reposts = 0;

            let comments: Comment[] = [];

            /*
             * BEĞENİLER
             */

            const {
              count: likeCount,
            } = await supabase
              .from('post_likes')
              .select('id', {
                count: 'exact',
                head: true,
              })
              .eq(
                'post_id',
                post.id
              );

            likes =
              likeCount ?? 0;

            /*
             * REPOST
             */

            const {
              count: repostCount,
            } = await supabase
              .from('post_reposts')
              .select('id', {
                count: 'exact',
                head: true,
              })
              .eq(
                'post_id',
                post.id
              );

            reposts =
              repostCount ?? 0;

            /*
             * YORUMLAR
             */

            const {
              data: commentData,
              error: commentError,
            } = await supabase
              .from('post_comments')
              .select(
                `
                  id,
                  text,
                  created_at,
                  user_id
                `
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

            if (commentError) {
              console.error(
                'Post yorumları alınamadı:',
                commentError
              );
            }

            if (commentData) {
              comments =
                commentData.map(
                  (comment: any) => ({
                    id: comment.id,
                    user_id:
                      comment.user_id,
                    username:
                      comment.user_id ===
                      userId
                        ? CURRENT_USERNAME
                        : 'Kitap Okuru',
                    text: comment.text,
                    createdAt:
                      comment.created_at,
                  })
                );
            }

            if (userId) {
              /*
               * POST BEĞENİ
               */

              const {
                data: likeData,
              } = await supabase
                .from('post_likes')
                .select('id')
                .eq(
                  'post_id',
                  post.id
                )
                .eq(
                  'user_id',
                  userId
                )
                .maybeSingle();

              liked = !!likeData;

              /*
               * POST REPOST
               */

              const {
                data: repostData,
              } = await supabase
                .from('post_reposts')
                .select('id')
                .eq(
                  'post_id',
                  post.id
                )
                .eq(
                  'user_id',
                  userId
                )
                .maybeSingle();

              reposted =
                !!repostData;

              /*
               * POST KAYIT
               */

              const {
                data: savedData,
              } = await supabase
                .from('saved_posts')
                .select('id')
                .eq(
                  'post_id',
                  post.id
                )
                .eq(
                  'user_id',
                  userId
                )
                .maybeSingle();

              saved = !!savedData;
            }

            const postAuthor =
              post.user_id
                ? profilesByUserId.get(post.user_id)
                : null;

            return {
              ...post,
              username:
                postAuthor?.username ||
                post.username ||
                CURRENT_USERNAME,
              full_name:
                postAuthor?.full_name ?? null,
              profile_image:
                postAuthor?.profile_image ??
                null,
              liked,
              likes,
              reposted,
              reposts,
              comments,
              saved,
            } as Post;
          })
        );

       const {
  data: reviewData,
  error: reviewError,
} = await supabase
  .from('reviews')
  .select('*')
  .order('created_at', {
    ascending: false,
  });

if (reviewError) {
  console.error(
    'Ana sayfa incelemeleri alınamadı:',
    reviewError
  );
}

const reviewPosts: Post[] = (reviewData ?? []).map(
  (review: any) => ({
    id: review.id,
    user_id: review.user_id ?? null,
    username:
      profilesByUserId.get(review.user_id)?.username ||
      CURRENT_USERNAME,
    full_name:
      profilesByUserId.get(review.user_id)?.full_name ?? null,
    profile_image:
      profilesByUserId.get(review.user_id)?.profile_image ??
      null,
    text: review.text,
    image_url: null,
    book_key: review.book_key,
    book_title: review.book_title,
    rating: review.rating,
    created_at: review.created_at,
    saved: false,
    likes: 0,
    liked: false,
    comments: [],
    reposts: 0,
    reposted: false,
    isReview: true,
  })
);

const savedQuotes =
  await AsyncStorage.getItem('quotes');

const parsedQuotes: Quote[] =
  savedQuotes
    ? JSON.parse(savedQuotes)
    : [];
    console.log('ANA SAYFA QUOTES:', parsedQuotes);

const quotePosts: Post[] =
  parsedQuotes.map((quote) => ({
    id: `quote-${quote.id}`,
    user_id: null,
    username:
      currentProfile?.username ||
      CURRENT_USERNAME,
    profile_image:
      currentProfile?.profile_image ??
      null,
    text: quote.text,
    image_url: null,
    book_key: quote.bookKey,
    book_title: quote.bookTitle,
    rating: 0,
    created_at: quote.createdAt,
    saved: false,
    likes: 0,
    liked: false,
    comments: [],
    reposts: 0,
    reposted: false,
    isQuote: true,
  }));

const remoteQuotes = await supabase.from('quotes').select('id,user_id,book_key,book_title,text,created_at').order('created_at', { ascending: false }).limit(100);
if (remoteQuotes.error) throw remoteQuotes.error;
const remoteQuotePosts: Post[] = (remoteQuotes.data ?? []).map(quote => ({
  id: `quote-${quote.id}`, user_id: quote.user_id,
  username: profilesByUserId.get(quote.user_id)?.username || CURRENT_USERNAME,
  full_name: profilesByUserId.get(quote.user_id)?.full_name,
  profile_image: profilesByUserId.get(quote.user_id)?.profile_image,
  text: quote.text, image_url: null, book_key: quote.book_key, book_title: quote.book_title,
  rating: 0, created_at: quote.created_at, isQuote: true,
}));

const allFeedItems: Post[] = [
  ...preparedPosts,
  ...reviewPosts,
  ...remoteQuotePosts,
  ...quotePosts.filter(quote => !remoteQuotePosts.some(remote => remote.id === quote.id)),
].sort(
  (a, b) =>
    new Date(b.created_at).getTime() -
    new Date(a.created_at).getTime()
);

console.log(
  'ANA SAYFA TÜM AKIŞ:',
  allFeedItems
);

setPosts(allFeedItems);

} catch (error) {
  console.error(
    'Post yükleme hatası:',
    error
  );
} finally {
  setLoadingPosts(false);
}

}, []);
  /*
   * =====================================================
   * STORIES
   * =====================================================
   */

  const loadStories = useCallback(async () => {
    setLoadingStories(true);

    try {
      const now =
        new Date().toISOString();

      const {
        data,
        error,
      } = await supabase
        .from('stories')
        .select('*')
        .gt(
          'expires_at',
          now
        )
        .order(
          'created_at',
          {
            ascending: false,
          }
        );

      if (error) {
        console.error(
          'Hikâyeler yüklenemedi:',
          error
        );
        return;
      }
      const rawStories = (data || []) as Story[];

      const storyUserIds = Array.from(
        new Set(
          rawStories
            .map((story) => story.user_id)
            .filter((id): id is string => !!id)
        )
      );

      let storyProfiles = new Map<string, any>();

      if (storyUserIds.length > 0) {
        const { data: storyProfileData } = await supabase
          .from('profiles')
          .select('id, username, profile_image')
          .in('id', storyUserIds);

        storyProfiles = new Map(
          (storyProfileData ?? []).map((profile: any) => [
            profile.id,
            profile,
          ])
        );
      }

      const preparedStories = rawStories.map((story) => {
        const profile = story.user_id
          ? storyProfiles.get(story.user_id)
          : null;

        return {
          ...story,
          username:
            profile?.username ||
            story.username ||
            CURRENT_USERNAME,
          profile_image: profile?.profile_image ?? null,
        };
      });

      setStories(preparedStories);

      try {
        const savedSeen = await AsyncStorage.getItem(STORY_SEEN_KEY);
        const parsedSeen: string[] = savedSeen ? JSON.parse(savedSeen) : [];
        const activeIds = new Set(preparedStories.map((story) => story.id));
        const cleanSeen = parsedSeen.filter((id) => activeIds.has(id));
        setSeenStoryIds(cleanSeen);

        if (cleanSeen.length !== parsedSeen.length) {
          await AsyncStorage.setItem(STORY_SEEN_KEY, JSON.stringify(cleanSeen));
        }
      } catch (seenError) {
        console.error('Hikaye görülme bilgisi okunamadı:', seenError);
      }
    } catch (error) {
      console.error(
        'Hikâye yükleme hatası:',
        error
      );
    } finally {
      setLoadingStories(false);
    }
  }, []);

  useEffect(() => {
    const bookKeys = Array.from(
      new Set(
        [
          ...posts.map((post) => post.book_key),
          ...reviews.map((review) => review.bookKey),
        ].filter((value): value is string => !!value)
      )
    );

    const missingKeys = bookKeys.filter(
      (bookKey) => !(bookKey in bookCoverUrls)
    );

    if (missingKeys.length === 0) {
      return;
    }

    let cancelled = false;

    Promise.all(
      missingKeys.map(async (bookKey) => {
        try {
          const response = await fetch(
            `https://openlibrary.org${bookKey}.json`
          );

          if (!response.ok) {
            return [bookKey, null] as const;
          }

          const data = await response.json();
          const coverId = Array.isArray(data?.covers)
            ? data.covers.find(
                (id: unknown) =>
                  typeof id === 'number' && id > 0
              )
            : null;

          const coverUrl = coverId
            ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
            : null;

          return [bookKey, coverUrl] as const;
        } catch (error) {
          console.error(
            'Kitap kapağı alınamadı:',
            bookKey,
            error
          );
          return [bookKey, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      setBookCoverUrls((current) => {
        const next = { ...current };

        entries.forEach(([bookKey, coverUrl]) => {
          next[bookKey] = coverUrl;
        });

        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [posts, reviews, bookCoverUrls]);


  /*
   * =====================================================
   * EKRAN YÜKLE
   * =====================================================
   */

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadAll() {
        setLoading(true);

        const userId =
          await getCurrentUserId();

          const user =
  await getCurrentUser();

setCurrentUser(user);



        if (active) {
          setCurrentUserId(userId);
        }

        await Promise.all([
          loadReviews(),
          loadPosts(),
          loadStories(),
        ]);

        if (active) {
          setLoading(false);
        }
      }

      loadAll();

      return () => {
        active = false;
      };
    }, [
      loadReviews,
      loadPosts,
      loadStories,
    ])
  );

  /*
   * =====================================================
   * FOTOĞRAF SEÇ
   * =====================================================
   */

  async function pickPostImage() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'İzin gerekli',
        'Fotoğraf seçebilmek için galeri izni vermelisin.'
      );
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync(
        {
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        }
      );

    if (
      !result.canceled &&
      result.assets.length > 0
    ) {
      setPostImage(
        result.assets[0].uri
      );
    }
  }

  async function pickStoryImage() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'İzin gerekli',
        'Fotoğraf seçebilmek için galeri izni vermelisin.'
      );
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync(
        {
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        }
      );

    if (
      !result.canceled &&
      result.assets.length > 0
    ) {
      setStoryImage(
        result.assets[0].uri
      );
    }
  }

  /*
   * =====================================================
   * POST OLUŞTUR
   * =====================================================
   */


async function createPost() {
  const cleanText = postText.trim();

  if (!cleanText && !postImage) {
    Alert.alert(
      'Gönderi boş',
      'Bir yazı veya fotoğraf eklemelisin.'
    );
    return;
  }

  const user = await getCurrentUser();

  if (!user) {
    Alert.alert(
      'Giriş gerekli',
      'Gönderi paylaşmak için önce giriş yapmalısın.'
    );
    return;
  }

  setPosting(true);

  try {
    let imageUrl: string | null = null;

    // =====================================================
    // FOTOĞRAF YÜKLE
    // =====================================================

    if (postImage) {
      // Her zaman güvenli bir dosya uzantısı kullanıyoruz.
      // blob: URI'den uzantı almıyoruz.
      const fileName =
        `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2)}.jpg`;

      const filePath =
        `${user.id}/${fileName}`;

      // =====================================================
      // EXPO URI → ARRAYBUFFER
      // =====================================================

      const response =
        await fetch(postImage);

      if (!response.ok) {
        throw new Error(
          'Fotoğraf dosyası okunamadı.'
        );
      }

      const arrayBuffer =
        await response.arrayBuffer();

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error(
          'Fotoğraf dosyası boş.'
        );
      }

      // =====================================================
      // SUPABASE STORAGE
      // =====================================================

      const {
        error: uploadError,
      } = await supabase.storage
        .from('post-images')
        .upload(
          filePath,
          arrayBuffer,
          {
            contentType: 'image/jpeg',
            upsert: false,
          }
        );

      if (uploadError) {
        console.error(
          'Post fotoğrafı yüklenemedi:',
          uploadError
        );

        Alert.alert(
          'Fotoğraf yüklenemedi',
          uploadError.message
        );

        return;
      }

      // =====================================================
      // PUBLIC URL
      // =====================================================

      const {
        data: publicUrlData,
      } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      imageUrl =
        publicUrlData.publicUrl;

      console.log(
        'POST FOTOĞRAF URL:',
        imageUrl
      );
    }

    // =====================================================
    // GÖNDERİ SAHİBİNİN GÜNCEL PROFİLİNİ AL
    // =====================================================

    const { data: authorProfile } =
      await supabase
        .from('profiles')
        .select('full_name, username, profile_image')
        .eq('id', user.id)
        .maybeSingle();

    // =====================================================
    // POST'U VERİTABANINA KAYDET
    // =====================================================

    const {
      data,
      error,
    } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        username:
          authorProfile?.username ||
          CURRENT_USERNAME,
        text: cleanText || null,
        image_url: imageUrl,
        book_key: null,
        book_title: null,
        rating: 0,
      })
      .select()
      .single();

    if (error) {
      console.error(
        'Gönderi oluşturulamadı:',
        error
      );

      // Post oluşturulamadıysa Storage'a yüklenen
      // fotoğrafı da temizlemeyi deniyoruz.
      if (imageUrl) {
        const filePath =
          `${user.id}/${imageUrl.split('/').pop()}`;

        await supabase.storage
          .from('post-images')
          .remove([filePath]);
      }

      Alert.alert(
        'Hata',
        error.message
      );

      return;
    }

    // =====================================================
    // EKRANA EKLE
    // =====================================================

    if (data) {
      setPosts(
        (current) => [
          {
            ...(data as Post),
            username:
              authorProfile?.username ||
              data.username ||
              CURRENT_USERNAME,
            profile_image:
              authorProfile?.profile_image ??
              null,
            saved: false,
            liked: false,
            likes: 0,
            reposted: false,
            reposts: 0,
            comments: [],
          },
          ...current,
        ]
      );
    }

    // =====================================================
    // FORMU TEMİZLE
    // =====================================================

    setPostText('');
    setPostImage(null);
    setShowPostBox(false);

    Alert.alert(
      'Başarılı',
      'Gönderin paylaşıldı.'
    );

  } catch (error) {
    console.error(
      'Post hatası:',
      error
    );

    Alert.alert(
      'Hata',
      error instanceof Error
        ? error.message
        : 'Gönderi paylaşılırken hata oluştu.'
    );

  } finally {
    setPosting(false);
  }
}


  /*
   * =====================================================
   * STORY OLUŞTUR
   * =====================================================
   */


async function createStory() {
  const cleanText = storyText.trim();

  if (!cleanText && !storyImage) {
    Alert.alert(
      'Hikâye boş',
      'Bir yazı veya fotoğraf eklemelisin.'
    );
    return;
  }

  const user = await getCurrentUser();

  if (!user) {
    Alert.alert(
      'Giriş gerekli',
      'Hikâye paylaşmak için önce giriş yapmalısın.'
    );
    return;
  }

  setPostingStory(true);

  try {
    let imageUrl: string | null = null;

    // =====================================================
    // FOTOĞRAFI SUPABASE STORAGE'A YÜKLE
    // =====================================================

    if (storyImage) {
      // blob URI'den uzantı almıyoruz.
      // Her zaman güvenli bir .jpg dosyası oluşturuyoruz.
      const fileName =
        `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2)}.jpg`;

      // Kullanıcının kendi klasörü
      const filePath =
        `${user.id}/${fileName}`;

      // =====================================================
      // EXPO URI → ARRAYBUFFER
      // =====================================================

      const response =
        await fetch(storyImage);

      if (!response.ok) {
        throw new Error(
          'Hikâye fotoğrafı dosyası okunamadı.'
        );
      }

      const arrayBuffer =
        await response.arrayBuffer();

      if (
        !arrayBuffer ||
        arrayBuffer.byteLength === 0
      ) {
        throw new Error(
          'Hikâye fotoğrafı dosyası boş.'
        );
      }

      // =====================================================
      // SUPABASE STORAGE'A YÜKLE
      // =====================================================

      const {
        error: uploadError,
      } = await supabase.storage
        .from('story-images')
        .upload(
          filePath,
          arrayBuffer,
          {
            contentType: 'image/jpeg',
            upsert: false,
          }
        );

      if (uploadError) {
        console.error(
          'Story fotoğrafı yüklenemedi:',
          uploadError
        );

        Alert.alert(
          'Fotoğraf yüklenemedi',
          uploadError.message
        );

        return;
      }

      // =====================================================
      // PUBLIC URL
      // =====================================================

      const {
        data: publicUrlData,
      } = supabase.storage
        .from('story-images')
        .getPublicUrl(filePath);

      imageUrl =
        publicUrlData.publicUrl;

      console.log(
        'STORY FOTOĞRAF URL:',
        imageUrl
      );
    }

    // =====================================================
    // 24 SAATLİK SÜRE
    // =====================================================

    const expiresAt =
      new Date(
        Date.now() +
        24 * 60 * 60 * 1000
      ).toISOString();

    // =====================================================
    // STORY'Yİ VERİTABANINA KAYDET
    // =====================================================

    const {
      data,
      error,
    } = await supabase
      .from('stories')
      .insert({
        user_id: user.id,
        username: CURRENT_USERNAME,
        text: cleanText || null,
        image_url: imageUrl,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error(
        'Hikâye oluşturulamadı:',
        error
      );

      // Story veritabanına kaydedilemezse
      // Storage'a yüklenen fotoğrafı temizle.
      if (imageUrl) {
        const fileName =
          imageUrl.split('/').pop();

        if (fileName) {
          const filePath =
            `${user.id}/${fileName}`;

          await supabase.storage
            .from('story-images')
            .remove([filePath]);
        }
      }

      Alert.alert(
        'Hata',
        error.message
      );

      return;
    }

    // =====================================================
    // EKRANA EKLE
    // =====================================================

    if (data) {
      setStories(
        (current) => [
          data as Story,
          ...current,
        ]
      );
    }

    // =====================================================
    // FORMU TEMİZLE
    // =====================================================

    setStoryText('');
    setStoryImage(null);
    setShowStoryBox(false);

    Alert.alert(
      'Başarılı',
      'Hikâyen paylaşıldı.'
    );

  } catch (error) {
    console.error(
      'Story hatası:',
      error
    );

    Alert.alert(
      'Hata',
      error instanceof Error
        ? error.message
        : 'Hikâye paylaşılırken hata oluştu.'
    );

  } finally {
    setPostingStory(false);
  }
}



  /*
   * =====================================================
   * POST KAYDET
   * =====================================================
   */

  async function toggleSavePost(
    post: Post
  ) {
    const user =
      await getCurrentUser();

    if (!user) {
      Alert.alert(
        'Giriş gerekli',
        'Gönderiyi kaydetmek için önce giriş yapmalısın.'
      );
      return;
    }

    try {
      if (post.saved) {
        const {
          error,
        } = await supabase
          .from('saved_posts')
          .delete()
          .eq(
            'post_id',
            post.id
          )
          .eq(
            'user_id',
            user.id
          );

        if (error) {
          Alert.alert(
            'Hata',
            error.message
          );
          return;
        }

        setPosts(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                post.id
                  ? {
                      ...item,
                      saved: false,
                    }
                  : item
            )
        );
      } else {
        const {
          error,
        } = await supabase
          .from('saved_posts')
          .insert({
            post_id: post.id,
            user_id: user.id,
            username:
              CURRENT_USERNAME,
          });

        if (error) {
          Alert.alert(
            'Hata',
            error.message
          );
          return;
        }

        setPosts(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                post.id
                  ? {
                      ...item,
                      saved: true,
                    }
                  : item
            )
        );
      }
    } catch (error) {
      console.error(
        'Kaydetme hatası:',
        error
      );
    }
  }

  /*
   * =====================================================
   * POST BEĞEN
   * =====================================================
   */



async function togglePostLike(post: Post) {
  const user = await getCurrentUser();

  if (!user) {
    Alert.alert(
      'Giriş gerekli',
      'Gönderiyi beğenmek için önce giriş yapmalısın.'
    );
    return;
  }

  try {
    /*
     * =====================================================
     * BEĞENİYİ KALDIR
     * =====================================================
     */

    if (post.liked) {
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', user.id);

      if (error) {
        Alert.alert(
          'Hata',
          error.message
        );
        return;
      }

      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                liked: false,
                likes: Math.max(
                  0,
                  (item.likes ?? 0) - 1
                ),
              }
            : item
        )
      );

      return;
    }

    /*
     * =====================================================
     * BEĞENİ EKLE
     * =====================================================
     */

    const { error: likeError } = await supabase
      .from('post_likes')
      .insert({
        post_id: post.id,
        user_id: user.id,
      });

    if (likeError) {
      Alert.alert(
        'Hata',
        likeError.message
      );
      return;
    }

    /*
     * =====================================================
     * EKRANDA BEĞENİ SAYISINI ARTIR
     * =====================================================
     */

    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              liked: true,
              likes: (item.likes ?? 0) + 1,
            }
          : item
      )
    );

    /*
     * =====================================================
     * POST SAHİBİNİ BUL
     * =====================================================
     */

    const {
      data: postData,
      error: postError,
    } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', post.id)
      .single();

    if (postError || !postData) {
      console.error(
        'Post sahibi bulunamadı:',
        postError
      );
      return;
    }

    /*
     * =====================================================
     * KENDİ POSTUNU BEĞENDİYSE BİLDİRİM GÖNDERME
     * =====================================================
     */

    if (postData.user_id === user.id) {
      return;
    }

    /*
     * =====================================================
     * DAHA ÖNCE BU POST İÇİN BİLDİRİM VAR MI?
     * =====================================================
     */

    const {
      data: existingNotification,
      error: notificationCheckError,
    } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', postData.user_id)
      .eq('actor_id', user.id)
      .eq('type', 'like')
      .eq('post_id', post.id)
      .maybeSingle();

    if (notificationCheckError) {
      console.error(
        'Beğeni bildirimi kontrol edilemedi:',
        notificationCheckError
      );

      return;
    }

    /*
     * =====================================================
     * DAHA ÖNCE BİLDİRİM YOKSA OLUŞTUR
     * =====================================================
     */

    if (!existingNotification) {
      const {
        error: notificationError,
      } = await supabase
        .from('notifications')
        .insert({
          user_id: postData.user_id,
          actor_id: user.id,
          type: 'like',
          post_id: post.id,
          message: 'gönderini beğendi',
          read: false,
        });


if (notificationError) {
  // Bildirim zaten varsa bu normaldir.
  // 23505 = unique constraint ihlali.
  if (notificationError.code !== '23505') {
    console.error(
      'Beğeni bildirimi oluşturulamadı:',
      notificationError
    );
  }
}


    }

  } catch (error) {
    console.error(
      'Post beğeni hatası:',
      error
    );

    Alert.alert(
      'Hata',
      'Beğeni işlemi sırasında bir hata oluştu.'
    );
  }
}




/*
 * =====================================================
 * POST REPOST
 * =====================================================
 */

async function togglePostRepost(post: Post) {
  const user = await getCurrentUser();

  if (!user) {
    Alert.alert(
      'Giriş gerekli',
      'Gönderiyi repost etmek için önce giriş yapmalısın.'
    );
    return;
  }

  try {
    /*
     * =================================================
     * REPOSTU KALDIR
     * =================================================
     */

    if (post.reposted) {
      const { error } = await supabase
        .from('post_reposts')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', user.id);

      if (error) {
        Alert.alert(
          'Hata',
          error.message
        );
        return;
      }

      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                reposted: false,
                reposts: Math.max(
                  0,
                  (item.reposts ?? 0) - 1
                ),
              }
            : item
        )
      );

      return;
    }

    /*
     * =================================================
     * REPOST EKLE
     * =================================================
     */

    const { error: repostError } = await supabase
      .from('post_reposts')
      .insert({
        post_id: post.id,
        user_id: user.id,
      });

    if (repostError) {
      Alert.alert(
        'Hata',
        repostError.message
      );
      return;
    }

    /*
     * =================================================
     * EKRANDA REPOST SAYISINI ARTIR
     * =================================================
     */

    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              reposted: true,
              reposts: (item.reposts ?? 0) + 1,
            }
          : item
      )
    );

    /*
     * =================================================
     * POST SAHİBİNİ BUL
     * =================================================
     */

    const {
      data: postData,
      error: postError,
    } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', post.id)
      .single();

    if (postError || !postData) {
      console.error(
        'Repost post sahibi bulunamadı:',
        postError
      );
      return;
    }

    /*
     * =================================================
     * KENDİ POSTUNU REPOST ETTİYSE
     * BİLDİRİM GÖNDERME
     * =================================================
     */

    if (postData.user_id === user.id) {
      return;
    }

    /*
     * =================================================
     * DAHA ÖNCE REPOST BİLDİRİMİ VAR MI?
     * =================================================
     */

    const {
      data: existingNotification,
      error: notificationCheckError,
    } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', postData.user_id)
      .eq('actor_id', user.id)
      .eq('type', 'repost')
      .eq('post_id', post.id)
      .maybeSingle();

    if (notificationCheckError) {
      console.error(
        'Repost bildirimi kontrol edilemedi:',
        notificationCheckError
      );
      return;
    }

    /*
     * =================================================
     * BİLDİRİM YOKSA OLUŞTUR
     * =================================================
     */

    if (!existingNotification) {
      const {
        error: notificationError,
      } = await supabase
        .from('notifications')
        .insert({
          user_id: postData.user_id,
          actor_id: user.id,
          type: 'repost',
          post_id: post.id,
          message: 'gönderini yeniden paylaştı',
          read: false,
        });

      /*
       * 23505 = Aynı bildirim zaten var.
       * Bu durumda hata göstermiyoruz.
       */

      if (
        notificationError &&
        notificationError.code !== '23505'
      ) {
        console.error(
          'Repost bildirimi oluşturulamadı:',
          notificationError
        );
      }
    }

  } catch (error) {
    console.error(
      'Post repost hatası:',
      error
    );

    Alert.alert(
      'Hata',
      'Repost işlemi sırasında bir hata oluştu.'
    );
  }
}



/*
 * =====================================================
 * POST YORUM KUTUSU
 * =====================================================
 */

function openPostCommentBox(postId: string) {
  if (commentingPostId === postId) {
    setCommentingPostId(null);
    setPostCommentText('');
    return;
  }

  setCommentingPostId(postId);
  setPostCommentText('');
}


/*
 * =====================================================
 * POST YORUM EKLE + BİLDİRİM OLUŞTUR
 * =====================================================
 */

async function submitPostComment(postId: string) {
  const cleanText = postCommentText.trim();

  if (!cleanText) {
    return;
  }

  const user = await getCurrentUser();

  if (!user) {
    Alert.alert(
      'Giriş gerekli',
      'Yorum yapmak için önce giriş yapmalısın.'
    );
    return;
  }

  try {
    /*
     * -------------------------------------------------
     * 1. POSTU BUL
     * -------------------------------------------------
     */

    const {
      data: postData,
      error: postError,
    } = await supabase
      .from('posts')
      .select('id, user_id')
      .eq('id', postId)
      .single();

    if (postError || !postData) {
      Alert.alert(
        'Hata',
        'Gönderi bulunamadı.'
      );
      return;
    }

    /*
     * -------------------------------------------------
     * 2. YORUMU KAYDET
     * -------------------------------------------------
     */

    const {
      data,
      error,
    } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        text: cleanText,
      })
      .select()
      .single();

    if (error) {
      console.error(
        'Post yorum hatası:',
        error
      );

      Alert.alert(
        'Hata',
        error.message
      );

      return;
    }

    /*
     * -------------------------------------------------
     * 3. EKRANDA YORUMU GÖSTER
     * -------------------------------------------------
     */

    const newComment: Comment = {
      id: data.id,
      user_id: user.id,
      username: CURRENT_USERNAME,
      text: data.text,
      createdAt: data.created_at,
    };

    setPosts(
      (current) =>
        current.map(
          (item) =>
            item.id === postId
              ? {
                  ...item,
                  comments: [
                    ...(item.comments ?? []),
                    newComment,
                  ],
                }
              : item
        )
    );

    /*
     * -------------------------------------------------
     * 4. POST SAHİBİ KENDİSİ DEĞİLSE BİLDİRİM OLUŞTUR
     * -------------------------------------------------
     */

    if (postData.user_id !== user.id) {
      const {
        error: notificationError,
      } = await supabase
        .from('notifications')
        .insert({
          user_id: postData.user_id,
          actor_id: user.id,
          type: 'comment',
          message: 'gönderine yorum yaptı.',
          read: false,
        });

      if (notificationError) {
        console.error(
          'Post yorum bildirimi oluşturulamadı:',
          notificationError
        );
      }
    }

    /*
     * -------------------------------------------------
     * 5. FORMU TEMİZLE
     * -------------------------------------------------
     */

    setPostCommentText('');
    setCommentingPostId(null);

  } catch (error) {
    console.error(
      'Post yorum işlemi hatası:',
      error
    );

    Alert.alert(
      'Hata',
      'Yorum gönderilirken hata oluştu.'
    );
  }
}


/*
 * =====================================================
 * POST YORUM SİL
 * =====================================================
 */

async function deletePostComment(
  postId: string,
  commentId: string
) {
  const user = await getCurrentUser();

  if (!user) {
    Alert.alert(
      'Giriş gerekli',
      'Bu işlemi yapmak için giriş yapmalısın.'
    );
    return;
  }

  Alert.alert(
    'Yorumu sil',
    'Bu yorum silinsin mi?',
    [
      {
        text: 'Vazgeç',
        style: 'cancel',
      },
      {
        text: 'Sil',
        style: 'destructive',

        onPress: async () => {
          try {
            const {
              error,
            } = await supabase
              .from('post_comments')
              .delete()
              .eq('id', commentId)
              .eq('user_id', user.id);

            if (error) {
              Alert.alert(
                'Hata',
                error.message
              );
              return;
            }

            setPosts(
              (current) =>
                current.map(
                  (post) =>
                    post.id === postId
                      ? {
                          ...post,
                          comments:
                            (
                              post.comments ?? []
                            ).filter(
                              (comment) =>
                                comment.id !==
                                commentId
                            ),
                        }
                      : post
                )
            );

          } catch (error) {
            console.error(
              'Post yorumu silme hatası:',
              error
            );
          }
        },
      },
    ]
  );
}



  /*
   * =====================================================
   * REVIEW BEĞENİ
   * =====================================================
   */

  async function toggleLike(
    reviewId: string
  ) {
    try {
      const review =
        reviews.find(
          (item) =>
            item.id ===
            reviewId
        );

      if (!review) {
        return;
      }

      const user =
        await getCurrentUser();

      if (!user) {
        Alert.alert(
          'Giriş gerekli',
          'Beğenmek için önce giriş yapmalısın.'
        );
        return;
      }

      if (review.liked) {
        const {
          error,
        } = await supabase
          .from('likes')
          .delete()
          .eq(
            'review_id',
            reviewId
          )
          .eq(
            'user_id',
            user.id
          );

        if (error) {
          Alert.alert(
            'Hata',
            error.message
          );
          return;
        }

        setReviews(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                reviewId
                  ? {
                      ...item,
                      liked: false,
                      likes:
                        Math.max(
                          0,
                          (item.likes ??
                            0) - 1
                        ),
                    }
                  : item
            )
        );

        return;
      }

      const {
        error,
      } = await supabase
        .from('likes')
        .insert({
          review_id: reviewId,
          user_id: user.id,
        });

      if (error) {
        Alert.alert(
          'Hata',
          error.message
        );
        return;
      }

      setReviews(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              reviewId
                ? {
                    ...item,
                    liked: true,
                    likes:
                      (item.likes ??
                        0) + 1,
                  }
                : item
          )
      );
    } catch (error) {
      console.error(
        'Beğeni hatası:',
        error
      );
    }
  }

  /*
   * =====================================================
   * REVIEW REPOST
   * =====================================================
   */

  async function toggleRepost(
    reviewId: string
  ) {
    try {
      const review =
        reviews.find(
          (item) =>
            item.id ===
            reviewId
        );

      if (!review) {
        return;
      }

      const user =
        await getCurrentUser();

      if (!user) {
        Alert.alert(
          'Giriş gerekli',
          'Repost yapmak için önce giriş yapmalısın.'
        );
        return;
      }

      if (review.reposted) {
        const {
          error,
        } = await supabase
          .from('reposts')
          .delete()
          .eq(
            'review_id',
            reviewId
          )
          .eq(
            'user_id',
            user.id
          );

        if (error) {
          Alert.alert(
            'Hata',
            error.message
          );
          return;
        }

        setReviews(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                reviewId
                  ? {
                      ...item,
                      reposted: false,
                      reposts:
                        Math.max(
                          0,
                          (item.reposts ??
                            0) - 1
                        ),
                    }
                  : item
            )
        );

        return;
      }

      const {
        error,
      } = await supabase
        .from('reposts')
        .insert({
          review_id: reviewId,
          user_id: user.id,
        });

      if (error) {
        Alert.alert(
          'Hata',
          error.message
        );
        return;
      }

      setReviews(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              reviewId
                ? {
                    ...item,
                    reposted: true,
                    reposts:
                      (item.reposts ??
                        0) + 1,
                  }
                : item
          )
      );
    } catch (error) {
      console.error(
        'Repost hatası:',
        error
      );
    }
  }

  /*
   * =====================================================
   * REVIEW YORUM
   * =====================================================
   */

  function openCommentBox(
    reviewId: string
  ) {
    if (
      commentingReviewId ===
      reviewId
    ) {
      setCommentingReviewId(null);
      setCommentText('');
      return;
    }

    setCommentingReviewId(
      reviewId
    );
    setCommentText('');
  }

  async function submitComment(
    reviewId: string
  ) {
    const newCommentText =
      commentText.trim();

    if (!newCommentText) {
      return;
    }

    try {
      const review =
        reviews.find(
          (item) =>
            item.id ===
            reviewId
        );

      if (!review) {
        return;
      }

      const user =
        await getCurrentUser();

      if (!user) {
        Alert.alert(
          'Giriş gerekli',
          'Yorum yapmak için önce giriş yapmalısın.'
        );
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from('comments')
        .insert({
          review_id: reviewId,
          user_id: user.id,
          text: newCommentText,
        })
        .select()
        .single();

      if (error) {
        Alert.alert(
          'Hata',
          error.message
        );
        return;
      }

      const newComment: Comment = {
        id: data.id,
        user_id: user.id,
        username:
          CURRENT_USERNAME,
        text: data.text,
        createdAt:
          data.created_at,
      };

      setReviews(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              reviewId
                ? {
                    ...item,
                    comments: [
                      ...(item.comments ??
                        []),
                      newComment,
                    ],
                  }
                : item
          )
      );

      setCommentText('');
      setCommentingReviewId(null);
    } catch (error) {
      console.error(
        'Yorum hatası:',
        error
      );

      Alert.alert(
        'Hata',
        'Yorum gönderilirken bir hata oluştu.'
      );
    }
  }

  async function deleteComment(
    reviewId: string,
    commentId: string
  ) {
    const user =
      await getCurrentUser();

    if (!user) {
      Alert.alert(
        'Giriş gerekli',
        'Bu işlemi yapmak için giriş yapmalısın.'
      );
      return;
    }

    Alert.alert(
      'Yorumu sil',
      'Bu yorum silinsin mi?',
      [
        {
          text: 'Vazgeç',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const {
                error,
              } = await supabase
                .from('comments')
                .delete()
                .eq(
                  'id',
                  commentId
                )
                .eq(
                  'user_id',
                  user.id
                );

              if (error) {
                Alert.alert(
                  'Hata',
                  error.message
                );
                return;
              }

              setReviews(
                (current) =>
                  current.map(
                    (item) =>
                      item.id ===
                      reviewId
                        ? {
                            ...item,
                            comments:
                              (
                                item.comments ??
                                []
                              ).filter(
                                (
                                  comment
                                ) =>
                                  comment.id !==
                                  commentId
                              ),
                          }
                        : item
                  )
              );
            } catch (error) {
              console.error(
                'Yorum silinemedi:',
                error
              );
            }
          },
        },
      ]
    );
  }

  /*
   * =====================================================
   * TARİH
   * =====================================================
   */

  function formatDate(
    date: string
  ) {
    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return '';
    }

    return parsedDate.toLocaleDateString(
      'tr-TR',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    );
  }

  /*
   * =====================================================
   * KİTAP
   * =====================================================
   */

  function openBook(
    bookKey: string
  ) {
    router.push({
      pathname: '/book',
      params: {
        key: bookKey,
      },
    });
  }

  /*
   * =====================================================
   * STORY
   * =====================================================
   */
  const storyGroups = (() => {
    const groups = new Map<string, {
      key: string;
      username: string;
      profile_image: string | null;
      stories: Story[];
    }>();

    stories.filter(story => !social.blocked.includes(story.user_id ?? '')).forEach((story) => {
      const key = story.user_id || story.username || story.id;
      const existing = groups.get(key);

      if (existing) {
        existing.stories.push(story);
      } else {
        groups.set(key, {
          key,
          username: story.username || CURRENT_USERNAME,
          profile_image: story.profile_image ?? null,
          stories: [story],
        });
      }
    });

    return Array.from(groups.values()).map((group) => ({
      ...group,
      stories: [...group.stories].sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      ),
      hasUnseen: group.stories.some(
        (story) => !seenStoryIds.includes(story.id)
      ),
    }));
  })();

  const activeStoryGroup =
    storyGroupIndex === null
      ? null
      : storyGroups[storyGroupIndex] ?? null;

  function markStorySeen(storyId: string) {
    setSeenStoryIds((current) => {
      if (current.includes(storyId)) {
        return current;
      }

      const next = [...current, storyId];
      AsyncStorage.setItem(STORY_SEEN_KEY, JSON.stringify(next)).catch(
        (error) => console.error('Hikaye görülme bilgisi kaydedilemedi:', error)
      );
      return next;
    });
  }

  function showStoryAt(groupIndex: number, itemIndex: number) {
    const group = storyGroups[groupIndex];
    const story = group?.stories[itemIndex];

    if (!group || !story) {
      return;
    }

    setStoryGroupIndex(groupIndex);
    setStoryIndex(itemIndex);
    setSelectedStory(story);
    const upcoming = group.stories[itemIndex + 1] ?? storyGroups[groupIndex + 1]?.stories[0];
    if (upcoming?.image_url) Image.prefetch(upcoming.image_url).catch(() => {});
    markStorySeen(story.id);
  }

  function openStoryGroup(groupIndex: number) {
    const group = storyGroups[groupIndex];
    if (!group) return;

    const firstUnseen = group.stories.findIndex(
      (story) => !seenStoryIds.includes(story.id)
    );

    showStoryAt(groupIndex, firstUnseen >= 0 ? firstUnseen : 0);
  }

  function closeStory() {
    setSelectedStory(null);
    setStoryGroupIndex(null);
    setStoryIndex(0);
  }

  function nextStory() {
    if (storyGroupIndex === null) return;

    const group = storyGroups[storyGroupIndex];
    if (!group) return;

    if (storyIndex < group.stories.length - 1) {
      showStoryAt(storyGroupIndex, storyIndex + 1);
      return;
    }

    if (storyGroupIndex < storyGroups.length - 1) {
      showStoryAt(storyGroupIndex + 1, 0);
      return;
    }

    closeStory();
  }

  function previousStory() {
    if (storyGroupIndex === null) return;

    if (storyIndex > 0) {
      showStoryAt(storyGroupIndex, storyIndex - 1);
      return;
    }

    if (storyGroupIndex > 0) {
      const previousGroupIndex = storyGroupIndex - 1;
      const previousGroup = storyGroups[previousGroupIndex];
      showStoryAt(
        previousGroupIndex,
        Math.max(0, previousGroup.stories.length - 1)
      );
    }
  }

  const storyPanResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Math.abs(gesture.dy) > 12 &&
      Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 70) {
        closeStory();
      }
    },
  });

  const visiblePosts = social.error ? [] : posts.filter(post =>
    !social.blocked.includes(post.user_id ?? '') &&
    (feedTab !== 'following' || social.following.includes(post.user_id ?? ''))
  ).sort((a, b) => {
    if (feedTab === 'following') return Date.parse(b.created_at) - Date.parse(a.created_at);
    const score = (post: Post) => {
      const review = post.isReview ? reviews.find(item => item.id === post.id) : undefined;
      const age = Math.max(0, (Date.now() - Date.parse(post.created_at)) / 3600000);
      return (1 + Math.log1p((review?.likes ?? post.likes ?? 0) + 2 * (review?.comments?.length ?? post.comments?.length ?? 0) + 3 * (review?.reposts ?? post.reposts ?? 0))) / Math.pow(2 + age, .7) * (post.user_id === social.userId ? .65 : 1);
    };
    return score(b) - score(a) || a.id.localeCompare(b.id);
  });

  /*
   * =====================================================
   * EKRAN
   * =====================================================
   */

  return (
    <View style={styles.container}>
      <Modal
        visible={showAuthMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAuthMenu(false)}
      >
        <View style={styles.drawerOverlay}>
          <View style={styles.drawerPanel}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerBrand}>
                1000<Text style={styles.drawerBrandAccent}>Kitap</Text>
              </Text>

              <Pressable
                onPress={() => setShowAuthMenu(false)}
                style={styles.drawerCloseButton}
                accessibilityLabel="Menüyü kapat"
              >
                <Feather name="x" size={24} color="#F1F1F5" />
              </Pressable>
            </View>

            <View style={styles.drawerDivider} />

            <View style={styles.drawerSection}>
              <Pressable
                onPress={() => {
                  setShowAuthMenu(false);
                  router.push('/login');
                }}
                style={styles.drawerItem}
              >
                <View style={styles.drawerIconWrap}>
                  <Feather name="log-in" size={22} color="#F1F1F5" />
                </View>
                <Text style={styles.drawerItemText}>Giriş Yap</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowAuthMenu(false);
                  router.push('/register');
                }}
                style={styles.drawerItem}
              >
                <View style={styles.drawerIconWrap}>
                  <Feather name="user-plus" size={22} color="#F1F1F5" />
                </View>
                <Text style={styles.drawerItemText}>Kaydol</Text>
              </Pressable>
            </View>

            <View style={styles.drawerBottomArea}>
              <Text style={styles.drawerBottomText}>Okuma dünyana hoş geldin.</Text>
            </View>
          </View>

          <Pressable
            style={styles.drawerDismissArea}
            onPress={() => setShowAuthMenu(false)}
          />
        </View>
      </Modal>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        <View style={styles.homeHeader}>
          <Pressable
            onPress={() => setShowAuthMenu(true)}
            style={styles.headerIconButton}
            accessibilityLabel="Menü"
          >
            <Feather name="menu" size={24} color="#F1F1F5" />
          </Pressable>
          <Text style={styles.brandTitle}>
            1000<Text style={styles.brandAccent}>Kitap</Text>
          </Text>

          <View style={styles.headerRightActions}>


            <Pressable
              onPress={() => router.push('/notifications')}
              style={styles.headerIconButton}
              accessibilityLabel="Bildirimler"
            >
              <Feather name="bell" size={22} color="#F1F1F5" />
            </Pressable>
          </View>
        </View>
        <View style={styles.topTabs}>
          <Pressable onPress={() => router.push('/explore')} style={styles.topTab}>
            <Text style={styles.topTabActiveText}>Keşfet</Text>
          </Pressable>
          <Pressable onPress={() => setFeedTab('following')} style={feedTab === 'following' ? styles.topTabActive : styles.topTab}>
            <Text style={styles.topTabText}>Takip</Text>
          </Pressable>
          <Pressable onPress={() => setFeedTab('for-you')} style={feedTab === 'for-you' ? styles.topTabActive : styles.topTab}>
            <Text style={styles.topTabText}>Senin İçin</Text>
          </Pressable>
        </View>

        <View style={styles.headerDivider} />

        <View style={styles.headerActions}>

        </View>

        <View style={styles.readerHighlights}>



        </View>

        {/* HİKÂYELER */}

        <View
          style={
            styles.storySection
          }
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Hikâyeler
            </Text>

            <Pressable
              onPress={() =>
                setShowStoryBox(
                  !showStoryBox
                )
              }
            >
              <Text
                style={
                  styles.addStoryText
                }
              >
                + Hikâye
              </Text>
            </Pressable>
          </View>

          {showStoryBox && (
            <View
              style={
                styles.storyCreateBox
              }
            >
              <Text
                style={
                  styles.createTitle
                }
              >
                Hikâyen
              </Text>

              {storyImage && (
                <Image
                  source={{
                    uri: storyImage,
                  }}
                  style={
                    styles.storyPreview
                  }
                />
              )}

              <TextInput
                value={storyText}
                onChangeText={
                  setStoryText
                }
                placeholder="Hikâyene bir şeyler yaz..."
                placeholderTextColor="#999"
                multiline
                style={
                  styles.postInput
                }
              />

              <View
                style={
                  styles.createActions
                }
              >
                <Pressable
                  onPress={
                    pickStoryImage
                  }
                  style={
                    styles.secondaryButton
                  }
                >
                  <Text style={styles.secondaryButtonText}>
                    📷 Fotoğraf
                  </Text>
                </Pressable>

                <Pressable
                  onPress={
                    createStory
                  }
                  disabled={
                    postingStory
                  }
                  style={
                    styles.primarySmallButton
                  }
                >
                  <Text
                    style={
                      styles.primarySmallText
                    }
                  >
                    {postingStory
                      ? 'Paylaşılıyor...'
                      : 'Paylaş'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.storyList
            }
          >
            <Pressable
              onPress={() =>
                setShowStoryBox(true)
              }
              style={
                styles.addStoryCircle
              }
            >
              <Text
                style={
                  styles.addStoryIcon
                }
              >
                +
              </Text>

              <Text
                style={
                  styles.storyName
                }
              >
                Hikâyen
              </Text>
            </Pressable>

            {loadingStories ? (
              <ActivityIndicator />
            ) : (
              storyGroups.map((group, groupIndex) => {
                const previewStory =
                  group.stories[group.stories.length - 1];

                return (
                  <Pressable
                    key={group.key}
                    onPress={() => openStoryGroup(groupIndex)}
                    style={styles.storyItem}
                  >
                    <View
                      style={[
                        styles.storyRing,
                        group.hasUnseen
                          ? styles.storyRingUnseen
                          : styles.storyRingSeen,
                      ]}
                    >
                      {group.profile_image || previewStory?.image_url ? (
                        <Image
                          source={{
                            uri:
                              group.profile_image ||
                              previewStory?.image_url ||
                              '',
                          }}
                          style={styles.storyCircleInner}
                        />
                      ) : (
                        <View
                          style={[
                            styles.storyCircleInner,
                            styles.storyTextCircle,
                          ]}
                        >
                          <Text style={styles.storyFallbackIcon}>📖</Text>
                        </View>
                      )}

                      {group.stories.length > 1 ? (
                        <View style={styles.storyCountBadge}>
                          <Text style={styles.storyCountText}>
                            {group.stories.length}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.storyName,
                        !group.hasUnseen && styles.storyNameSeen,
                      ]}
                    >
                      {group.username}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>

        <View style={{ padding: 12 }}><ReadersList limit={3} /></View>
        {feedTab === 'following' && <Action label="Okurları keşfet" onPress={() => router.push('/readers')} />}
        {/* POST OLUŞTUR */}

        <View
          style={
            styles.createPostCard
          }
          onLayout={event => { composerY.current = event.nativeEvent.layout.y; }}
        >
          <View
            style={
              styles.createPostHeader
            }
          >
            <View
              style={
                styles.avatar
              }
            >
              <Text
                style={
                  styles.avatarText
                }
              >
                👤
              </Text>
            </View>

            <Pressable
              onPress={() =>
                setShowPostBox(
                  !showPostBox
                )
              }
              style={
                styles.postPrompt
              }
            >
              <Text
                style={
                  styles.postPromptText
                }
              >
                Ne okuyorsun, ne
                düşünüyorsun?
              </Text>
            </Pressable>
          </View>

          {showPostBox && (
            <View
              style={
                styles.postCreateBox
              }
            >
              {postImage && (
                <View>
                  <Image
                    source={{
                      uri: postImage,
                    }}
                    style={
                      styles.postPreview
                    }
                  />

                  <Pressable
                    onPress={() =>
                      setPostImage(
                        null
                      )
                    }
                    style={
                      styles.removeImageButton
                    }
                  >
                    <Text
                      style={
                        styles.removeImageText
                      }
                    >
                      ✕
                    </Text>
                  </Pressable>
                </View>
              )}

              <TextInput
                value={postText}
                onChangeText={
                  setPostText
                }
                placeholder="Bir şeyler paylaş..."
                placeholderTextColor="#999"
                multiline
                maxLength={2000}
                style={
                  styles.postInput
                }
              />

              <View
                style={
                  styles.createActions
                }
              >
                <Pressable
                  onPress={
                    pickPostImage
                  }
                  style={
                    styles.secondaryButton
                  }
                >
                  <Text style={styles.secondaryButtonText}>
                    📷 Fotoğraf
                  </Text>
                </Pressable>

                <Pressable
                  onPress={
                    createPost
                  }
                  disabled={
                    posting
                  }
                  style={
                    styles.primarySmallButton
                  }
                >
                  <Text
                    style={
                      styles.primarySmallText
                    }
                  >
                    {posting
                      ? 'Paylaşılıyor...'
                      : 'Paylaş'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
         <Modal
          visible={!!selectedStory}
          transparent
          animationType="fade"
          onRequestClose={closeStory}
        >
          <View style={[styles.storyModalOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View
              style={styles.storyViewer}
              {...storyPanResponder.panHandlers}
            >
              <View style={[styles.storyProgressRow, { opacity: 0 }]}>
                {(activeStoryGroup?.stories ?? []).map((story, index) => (
                  <View
                    key={story.id}
                    style={[
                      styles.storyProgressTrack,
                      index <= storyIndex && styles.storyProgressActive,
                    ]}
                  />
                ))}
              </View>

              <View style={styles.storyViewerHeader}>
                <View style={styles.storyViewerIdentity}>
                  {activeStoryGroup?.profile_image ? (
                    <Image
                      source={{ uri: activeStoryGroup.profile_image }}
                      style={styles.storyViewerAvatar}
                    />
                  ) : (
                    <View style={styles.storyViewerAvatarFallback}>
                      <Text style={styles.storyViewerAvatarText}>
                        {(selectedStory?.username || 'K')
                          .trim()
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View>
                    <Text style={styles.storyViewerUsername}>
                      {selectedStory?.username}
                    </Text>
                    <Text style={styles.storyViewerCounter}>
                      {selectedStory ? storyAge(selectedStory.created_at) : ''} · {storyIndex + 1}/{activeStoryGroup?.stories.length ?? 1}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={closeStory}
                  style={styles.storyCloseButton}
                >
                  <Text style={styles.storyCloseText}>×</Text>
                </Pressable>
              </View>

              <View style={styles.storyMediaArea}>
                <StoryTransition key={selectedStory?.id}>
                {selectedStory?.image_url ? (
                  <Image
                    source={{ uri: selectedStory.image_url }}
                    style={styles.storyViewerImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.storyTextOnlyCard}>
                    <Text style={styles.storyTextOnlyIcon}>📚</Text>
                  </View>
                )}

                {selectedStory?.text ? (
                  <View style={styles.storyTextOverlay}>
                    <Text style={styles.storyViewerText}>
                      {selectedStory.text}
                    </Text>
                  </View>
                ) : null}

                </StoryTransition>
              </View>

              <View style={styles.storySwipeHint}>
                <View style={styles.storySwipeHandle} />
                <Text style={styles.storySwipeText}>Aşağı kaydırarak kapat</Text>
              </View>
              {selectedStory && <StoryPlayback key={selectedStory.id} storyId={selectedStory.id} count={activeStoryGroup?.stories.length ?? 1} index={storyIndex} onNext={nextStory} onPrevious={previousStory} />}
              {selectedStory && <StoryActions key={`actions-${selectedStory.id}`} storyId={selectedStory.id} ownerId={selectedStory.user_id} onClose={closeStory} onDeleted={() => { setStories(current => current.filter(item => item.id !== selectedStory.id)); closeStory(); }} />}
            </View>
          </View>
        </Modal>

        {/* TOPLULUK */}

        <View
          style={
            styles.sectionHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Topluluk Akışı
          </Text>
        </View>

        {/* POSTS */}

        {loadingPosts ? (
          <View
            style={
              styles.loadingBox
            }
          >
            <ActivityIndicator />

            <Text
              style={
                styles.info
              }
            >
              Gönderiler yükleniyor...
            </Text>
          </View>
        ) : visiblePosts.length === 0 ? (
          <View
            style={
              styles.empty
            }
          >
            <Text
              style={
                styles.emptyIcon
              }
            >
              📝
            </Text>

            <Text
              style={
                styles.emptyTitle
              }
            >
              {social.error || (feedTab === 'following' ? 'Takip akışında henüz içerik yok' : 'Henüz gönderi yok')}
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              {feedTab === 'following' ? 'Okurları keşfet ve takip ederek akışını oluştur.' : 'İlk gönderiyi sen paylaş.'}
            </Text>

            <Pressable
              onPress={() =>
                setShowPostBox(
                  true
                )
              }
              style={
                styles.emptyButton
              }
            >
              <Text
                style={
                  styles.emptyButtonText
                }
              >
                Gönderi Paylaş
              </Text>
            </Pressable>
          </View>
        ) : (
          visiblePosts.map((post, feedIndex) => {
            const reviewForPost = post.isReview
              ? reviews.find((review) => review.id === post.id)
              : undefined;

            const feedComments = post.isReview
              ? reviewForPost?.comments
              : post.comments;

            const feedLiked = post.isReview
              ? reviewForPost?.liked
              : post.liked;
            const feedLikes = post.isReview
              ? reviewForPost?.likes
              : post.likes;
            const feedReposted = post.isReview
              ? reviewForPost?.reposted
              : post.reposted;
            const feedReposts = post.isReview
              ? reviewForPost?.reposts
              : post.reposts;

            return (
            <View
              key={post.id}
              style={[
                styles.postCard,
                post.isQuote && styles.quotePostCard,
                post.rating > 0 && styles.reviewPostCard,
              ]}
            >
              {feedIndex > 0 && feedIndex % 9 === 0 && <AdSlot />}
              <View
                style={
                  styles.userRow
                }
              >
                <View
                  style={
                    styles.avatar
                  }
                >
                  {post.profile_image ? (
                    <Image
                      source={{
                        uri: post.profile_image,
                      }}
                      style={
                        styles.avatarImage
                      }
                    />
                  ) : (
                    <Text
                      style={
                        styles.avatarText
                      }
                    >
                      {post.username
                        ?.trim()
                        .charAt(0)
                        .toUpperCase() || 'K'}
                    </Text>
                  )}
                </View>

                <View
                  style={
                    styles.userInfo
                  }
                >
                  <Text style={styles.username} numberOfLines={1}>
                    {post.full_name?.trim() || post.username}
                  </Text>

                  <Text style={styles.handle} numberOfLines={1}>
                    @{post.username}
                  </Text>

                    <Text
                      style={
                        styles.date
                      }
                  >
                    {formatDate(
                      post.created_at
                    )}
                    </Text>
                  </View>

                  <Text style={styles.moreButton}>•••</Text>
              </View>

              {(post.isQuote || post.rating > 0) && (
                <Text style={styles.feedTypeLabel}>
                  {post.isQuote ? 'ALINTI' : 'KİTAP İNCELEMESİ'}
                </Text>
              )}

              {post.image_url && (
                <Image
                  source={{
                    uri: post.image_url,
                  }}
                  style={
                    styles.postImage
                  }
                />
              )}

              {post.text && (
                <Text
                  style={[
                    styles.postText,
                    post.isQuote && styles.quotePostText,
                  ]}
                >
                  {post.isQuote ? `“${post.text}”` : post.text}
                </Text>
              )}

              {post.book_title && (
                <Pressable
                  onPress={() => {
                    if (
                      post.book_key
                    ) {
                      openBook(
                        post.book_key
                      );
                    }
                  }}
                  style={styles.bookAttachment}
                >
                  <View style={styles.bookAttachmentIcon}>
                    {post.book_key && bookCoverUrls[post.book_key] ? (
                      <Image
                        source={{ uri: bookCoverUrls[post.book_key] as string }}
                        style={styles.bookAttachmentCover}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.bookAttachmentEmoji}>▥</Text>
                    )}
                  </View>
                  <View style={styles.bookAttachmentInfo}>
                    <Text style={styles.bookAttachmentLabel}>KİTAP</Text>
                    <Text style={styles.bookTitle} numberOfLines={2}>
                      {post.book_title}
                    </Text>
                  </View>
                  <Text style={styles.bookAttachmentArrow}>›</Text>
                </Pressable>
              )}

              {post.rating > 0 && (
  <View style={styles.rating}>
    <Text style={styles.stars}>
      {'★'.repeat(post.rating)}
      {'☆'.repeat(
        Math.max(0, 5 - post.rating)
      )}
    </Text>

    <Text style={styles.ratingNumber}>
      {post.rating}/5
    </Text>
  </View>
)}

              {/* AKSİYONLAR */}

              {!post.isQuote && (
                <View style={styles.postActions}>
                  {!post.isReview && (
                    <Pressable
                      onPress={() => toggleSavePost(post)}
                      style={styles.postAction}
                    >
                      <Text
                        style={[
                          styles.postActionText,
                          post.saved && styles.savedText,
                        ]}
                      >
                        {post.saved ? '🔖 Kaydedildi' : '🔖 Kaydet'}
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={() =>
                      post.isReview
                        ? openCommentBox(post.id)
                        : openPostCommentBox(post.id)
                    }
                    style={styles.postAction}
                  >
                    <Text style={styles.postActionText}>
                      💬 Yorum
                      {(feedComments?.length ?? 0) > 0
                        ? ` ${feedComments?.length}`
                        : ''}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      post.isReview
                        ? toggleLike(post.id)
                        : togglePostLike(post)
                    }
                    style={styles.postAction}
                  >
                    <Text
                      style={[
                        styles.postActionText,
                        feedLiked && styles.likedPostAction,
                      ]}
                    >
                      {feedLiked
                        ? `♥ Beğenildi${feedLikes ? ` ${feedLikes}` : ''}`
                        : `♡ Beğen${feedLikes ? ` ${feedLikes}` : ''}`}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      post.isReview
                        ? toggleRepost(post.id)
                        : togglePostRepost(post)
                    }
                    style={styles.postAction}
                  >
                    <Text
                      style={[
                        styles.postActionText,
                        feedReposted && styles.repostedPostAction,
                      ]}
                    >
                      {feedReposted
                        ? `✓ Repostlandı${feedReposts ? ` ${feedReposts}` : ''}`
                        : `↻ Repost${feedReposts ? ` ${feedReposts}` : ''}`}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* POST YORUM KUTUSU */}

              {!post.isQuote &&
                (post.isReview
                  ? commentingReviewId === post.id
                  : commentingPostId === post.id) && (
                <View
                  style={
                    styles.commentBox
                  }
                >
                  <TextInput
                    value={post.isReview ? commentText : postCommentText}
                    onChangeText={
                      post.isReview ? setCommentText : setPostCommentText
                    }
                    placeholder="Yorumunu yaz..."
                    placeholderTextColor="#999"
                    multiline
                    style={
                      styles.commentInput
                    }
                  />

                  <View
                    style={
                      styles.commentButtons
                    }
                  >
                    <Pressable
                      onPress={() => {
                        if (post.isReview) {
                          setCommentingReviewId(null);
                          setCommentText('');
                        } else {
                          setCommentingPostId(null);
                          setPostCommentText('');
                        }
                      }}
                      style={
                        styles.cancelButton
                      }
                    >
                      <Text
                        style={
                          styles.cancelText
                        }
                      >
                        Vazgeç
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        post.isReview
                          ? submitComment(post.id)
                          : submitPostComment(post.id)
                      }
                      style={
                        styles.sendButton
                      }
                    >
                      <Text
                        style={
                          styles.sendText
                        }
                      >
                        Gönder
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* POST YORUMLARI */}

              {!post.isQuote && (feedComments?.length ?? 0) > 0 && (
                <View
                  style={
                    styles.comments
                  }
                >
                  {feedComments?.map(
                    (comment) => {
                      const isOwnComment =
                        comment.user_id ===
                        currentUserId;



                      return (
                        <View
                          key={
                            comment.id
                          }
                          style={
                            styles.comment
                          }
                        >
                          <View
                            style={
                              styles.commentHeader
                            }
                          >
                            <Text
                              style={
                                styles.commentUser
                              }
                            >
                              {isOwnComment
                                ? CURRENT_USERNAME
                                : 'Kitap Okuru'}
                            </Text>

                            {isOwnComment && (
                              <Pressable
                                onPress={() =>
                                  post.isReview
                                    ? deleteComment(post.id, comment.id)
                                    : deletePostComment(post.id, comment.id)
                                }
                              >
                                <Text
                                  style={
                                    styles.deleteComment
                                  }
                                >
                                  🗑️ Sil
                                </Text>
                              </Pressable>
                            )}
                          </View>

                          <Text
                            style={
                              styles.commentText
                            }
                          >
                            {
                              comment.text
                            }
                          </Text>

                          <Text
                            style={
                              styles.commentDate
                            }
                          >
                            {formatDate(
                              comment.createdAt
                            )}
                          </Text>
                        </View>
                      );
                    }
                  )}
                </View>
              )}
            </View>
            );
          })
        )}

        {/* ESKİ REVIEWS */}

        {loading ? (
          <Text
            style={
              styles.info
            }
          >
            Paylaşımlar yükleniyor...
          </Text>
        ) : reviews.length > 0 && posts.length === 0 && feedTab === 'for-you' && !social.error ? (

          <>
            <View
              style={
                styles.sectionHeader
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Kitap İncelemeleri
              </Text>
            </View>

            {reviews.filter(review => !social.blocked.includes(review.user_id ?? '')).map(
              (review) => (
                <View
                  key={
                    review.id
                  }
                  style={
                    styles.reviewCard
                  }
                >
                  <View
                    style={
                      styles.userRow
                    }
                  >
                    <View
                      style={
                        styles.avatar
                      }
                    >
                      {review.profile_image ? (
                        <Image
                          source={{ uri: review.profile_image }}
                          style={styles.avatarImage}
                        />
                      ) : (
                        <Text style={styles.avatarText}>
                          {(review.full_name || review.username || CURRENT_USERNAME)
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </Text>
                      )}
                    </View>

                    <View
                      style={
                        styles.userInfo
                      }
                    >
                      <Text style={styles.username} numberOfLines={1}>
                        {review.full_name?.trim() || review.username || CURRENT_USERNAME}
                      </Text>

                      <Text style={styles.handle} numberOfLines={1}>
                        @{review.username || CURRENT_USERNAME}
                      </Text>

                      <Text
                        style={
                          styles.date
                        }
                      >
                        {formatDate(
                          review.createdAt
                        )}
                      </Text>
                    </View>
                    <Text style={styles.moreButton}>•••</Text>
                  </View>

                  <Text style={styles.feedTypeLabel}>
                    KİTAP İNCELEMESİ
                  </Text>

                  <Pressable
                    onPress={() =>
                      openBook(
                        review.bookKey
                      )
                    }
                    style={styles.bookAttachment}
                  >
                    <View style={styles.bookAttachmentIcon}>
                      {review.bookKey && bookCoverUrls[review.bookKey] ? (
                        <Image
                          source={{ uri: bookCoverUrls[review.bookKey] as string }}
                          style={styles.bookAttachmentCover}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.bookAttachmentEmoji}>▥</Text>
                      )}
                    </View>
                    <View style={styles.bookAttachmentInfo}>
                      <Text style={styles.bookAttachmentLabel}>KİTAP</Text>
                      <Text style={styles.bookTitle} numberOfLines={2}>
                        {review.bookTitle}
                      </Text>
                    </View>
                    <Text style={styles.bookAttachmentArrow}>›</Text>
                  </Pressable>

                  <View
                    style={
                      styles.rating
                    }
                  >
                    <Text
                      style={
                        styles.stars
                      }
                    >
                      {'★'.repeat(
                        review.rating
                      )}
                      {'☆'.repeat(
                        Math.max(
                          0,
                          5 -
                            review.rating
                        )
                      )}
                    </Text>

                    <Text
                      style={
                        styles.ratingNumber
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
                      styles.reviewText
                    }
                  >
                    {review.text}
                  </Text>

                  <View
                    style={
                      styles.actions
                    }
                  >
                    <Pressable
                      onPress={() =>
                        toggleLike(
                          review.id
                        )
                      }
                      style={
                        styles.actionButton
                      }
                    >
                      <Text
                        style={[
                          styles.action,
                          review.liked &&
                            styles.likedAction,
                        ]}
                      >
                        {review.liked
                          ? '♥ Beğenildi'
                          : '♡ Beğen'}
                      </Text>

                      {(review.likes ??
                        0) > 0 && (
                        <Text
                          style={
                            styles.count
                          }
                        >
                          {
                            review.likes
                          }
                        </Text>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        openCommentBox(
                          review.id
                        )
                      }
                      style={
                        styles.actionButton
                      }
                    >
                      <Text
                        style={
                          styles.action
                        }
                      >
                        💬 Yorum
                      </Text>

                      {(review.comments
                        ?.length ??
                        0) > 0 && (
                        <Text
                          style={
                            styles.count
                          }
                        >
                          {
                            review
                              .comments
                              ?.length
                          }
                        </Text>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        toggleRepost(
                          review.id
                        )
                      }
                      style={
                        styles.actionButton
                      }
                    >
                      <Text
                        style={[
                          styles.action,
                          review.reposted &&
                            styles.repostedAction,
                        ]}
                      >
                        {review.reposted
                          ? '✓ Yeniden Gönderildi'
                          : '↻ Yeniden Gönder'}
                      </Text>

                      {(review.reposts ??
                        0) > 0 && (
                        <Text
                          style={
                            styles.count
                          }
                        >
                          {
                            review.reposts
                          }
                        </Text>
                      )}
                    </Pressable>
                  </View>

                  {commentingReviewId ===
                    review.id && (
                    <View
                      style={
                        styles.commentBox
                      }
                    >
                      <TextInput
                        value={
                          commentText
                        }
                        onChangeText={
                          setCommentText
                        }
                        placeholder="Yorumunu yaz..."
                        placeholderTextColor="#999"
                        multiline
                        style={
                          styles.commentInput
                        }
                      />

                      <View
                        style={
                          styles.commentButtons
                        }
                      >
                        <Pressable
                          onPress={() => {
                            setCommentingReviewId(
                              null
                            );
                            setCommentText(
                              ''
                            );
                          }}
                          style={
                            styles.cancelButton
                          }
                        >
                          <Text
                            style={
                              styles.cancelText
                            }
                          >
                            Vazgeç
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() =>
                            submitComment(
                              review.id
                            )
                          }
                          style={
                            styles.sendButton
                          }
                        >
                          <Text
                            style={
                              styles.sendText
                            }
                          >
                            Gönder
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {(review.comments
                    ?.length ??
                    0) > 0 && (
                    <View
                      style={
                        styles.comments
                      }
                    >
                      {review.comments?.map(
                        (comment) => {
                          const isOwnComment =
                            comment.user_id ===
                            currentUserId;

                          return (
                            <View
                              key={
                                comment.id
                              }
                              style={
                                styles.comment
                              }
                            >
                              <View
                                style={
                                  styles.commentHeader
                                }
                              >
                                <Text
                                  style={
                                    styles.commentUser
                                  }
                                >
                                  {isOwnComment
                                    ? CURRENT_USERNAME
                                    : 'Kitap Okuru'}
                                </Text>

                                {isOwnComment && (
                                  <Pressable
                                    onPress={() =>
                                      deleteComment(
                                        review.id,
                                        comment.id
                                      )
                                    }
                                  >
                                    <Text
                                      style={
                                        styles.deleteComment
                                      }
                                    >
                                      🗑️ Sil
                                    </Text>
                                  </Pressable>
                                )}
                              </View>

                              <Text
                                style={
                                  styles.commentText
                                }
                              >
                                {
                                  comment.text
                                }
                              </Text>

                              <Text
                                style={
                                  styles.commentDate
                                }
                              >
                                {formatDate(
                                  comment.createdAt
                                )}
                              </Text>

                            </View>
                          );
                        }
                      )}

                    </View>
                  )}
                </View>
              )
            )}
          </>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={() => setCreateMenu(true)}
        style={styles.floatingCreateButton}
        accessibilityRole="button"
        accessibilityLabel="Yeni gönderi oluştur"
      >
        <Text style={styles.floatingCreateIcon}>+</Text>
      </Pressable>

      <BottomNav />
      <Modal visible={createMenu} transparent animationType="slide" onRequestClose={() => setCreateMenu(false)}>
        <View style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} accessibilityLabel="Kapat" onPress={() => setCreateMenu(false)} />
          <View style={[ui.card, { padding: 24, paddingBottom: 40, maxHeight: '85%' }]}>
            <Action label="Gönderi Oluştur" onPress={() => { setCreateMenu(false); setShowPostBox(true); requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: composerY.current, animated: true })); }} />
            <Action label="Kitap İncelemesi Yaz" onPress={() => { setCreateMenu(false); router.push('/explore'); }} />
            <Action label="Alıntı Paylaş" onPress={() => { setCreateMenu(false); router.push('/quote-create'); }} />
            <Action label="Kitap Yaz / Yayınla" onPress={() => { setCreateMenu(false); router.push('/my-works'); }} />
            <Action label="Kapat" onPress={() => setCreateMenu(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/*
 * =====================================================
 * STYLES
 * =====================================================
 */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08090D',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },

  content: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 132,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },

  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    marginBottom: 6,
    maxWidth: '100%',
    minWidth: 0,
  },

  brandTitle: {
    position: 'absolute',
    left: 70,
    right: 70,
    textAlign: 'center',
    color: '#F8F8FA',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.6,
  },

  brandAccent: { color: '#F28A2E' },

  headerRightActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: 7,
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 1,
  },

  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerIcon: {
    color: '#F6F6F8',
    fontSize: 29,
    lineHeight: 31,
    transform: [{ rotate: '-15deg' }],
  },

  headerSmallIcon: {
    color: '#F6F6F8',
    fontSize: 20,
  },

  homeHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  greeting: {
    fontSize: 14,
    color: '#8F96A3',
    letterSpacing: 0.2,
    flexShrink: 1,
  },

  title: {
    marginTop: 4,
    fontSize: 25,
    fontWeight: '800',
    color: '#F7F8FA',
    letterSpacing: -0.5,
    flexShrink: 1,
  },

  messageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#171A22',
    borderWidth: 1,
    borderColor: '#292E39',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  messageIcon: {
    fontSize: 20,
    color: '#F7F8FA',
  },

  topTabs: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 2,
    gap: 25,
    maxWidth: '100%',
    minWidth: 0,
  },

  topTab: {
    paddingVertical: 10,
  },

  topTabText: {
    color: '#777E8A',
    fontSize: 15,
    fontWeight: '600',
  },

  topTabActive: {
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#8D65F2',
  },

  topTabActiveText: {
    color: '#F5F6F8',
    fontSize: 15,
    fontWeight: '800',
  },

  headerDivider: {
    height: 1,
    backgroundColor: '#1B1F28',
    marginHorizontal: -16,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
    maxWidth: '100%',
    minWidth: 0,
  },

  loginButton: {
    minWidth: 58,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 21,
    backgroundColor: '#171A22',
    borderWidth: 1,
    borderColor: '#303542',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loginButtonText: {
    color: '#E9EBEF',
    fontSize: 12,
    fontWeight: '800',
  },

  exploreButton: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#171A22',
    borderWidth: 1,
    borderColor: '#292E39',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minWidth: 0,
    maxWidth: '100%',
  },

  exploreIcon: {
    color: '#A7ADB8',
    fontSize: 24,
    lineHeight: 24,
    marginRight: 7,
  },

  exploreButtonText: {
    color: '#8F96A3',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    minWidth: 0,
  },

  readerHighlights: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    maxWidth: '100%',
    minWidth: 0,
  },

  readerHighlightCard: {
    flex: 1,
    minHeight: 116,
    padding: 13,
    borderRadius: 16,
    backgroundColor: '#111219',
    borderWidth: 1,
    borderColor: '#252631',
    minWidth: 0,
    maxWidth: '100%',
  },

  readerHighlightEyebrow: {
    color: '#A985FF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  readerHighlightTitle: {
    color: '#F3F3F6',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
    flexShrink: 1,
  },

  readerHighlightText: {
    color: '#747681',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 6,
    flexShrink: 1,
  },

  storyModalOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },

  storyViewer: {
    flex: 1,
    backgroundColor: '#050507',
    paddingTop: 14,
    paddingBottom: 18,
    maxWidth: '100%',
    minWidth: 0,
  },

  storyProgressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
  },

  storyProgressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },

  storyProgressActive: {
    backgroundColor: '#F5F5F7',
  },

  storyViewerHeader: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },

  storyViewerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  storyViewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },

  storyViewerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#2B2140',
    alignItems: 'center',
    justifyContent: 'center',
  },

  storyViewerAvatarText: {
    color: '#F4EEFF',
    fontWeight: '900',
  },

  storyViewerUsername: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
    maxWidth: '100%',
  },

  storyViewerCounter: {
    color: '#9B9BA4',
    fontSize: 10,
    marginTop: 2,
  },

  storyCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(20,20,26,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  storyCloseText: {
    color: '#FFF',
    fontSize: 27,
    lineHeight: 29,
  },

  storyMediaArea: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0D0D12',
    position: 'relative',
  },

  storyViewerImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0D0D12',
    maxWidth: '100%',
  },

  storyTextOnlyCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15111E',
  },

  storyTextOnlyIcon: {
    fontSize: 58,
  },

  storyTextOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 38,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    zIndex: 5,
  },

  storyViewerText: {
    color: '#FFF',
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '600',
    flexShrink: 1,
    maxWidth: '100%',
  },

  storyTapLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '42%',
    zIndex: 10,
  },

  storyTapRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '58%',
    zIndex: 10,
  },

  storySwipeHint: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  storySwipeHandle: {
    width: 34,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#4A4A52',
    marginBottom: 4,
  },

  storySwipeText: {
    color: '#66666F',
    fontSize: 9,
  },

  sectionHeader: {
    marginTop: 25,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '100%',
    minWidth: 0,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#F2F3F5',
    letterSpacing: -0.2,
    flexShrink: 1,
    minWidth: 0,
  },

  storySection: {
    marginTop: 8,
  },

  addStoryText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#A985FF',
  },

  storyList: {
    gap: 12,
    paddingBottom: 4,
  },

  storyItem: {
    width: 74,
    alignItems: 'center',
  },

  addStoryCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#F28A2E',
    backgroundColor: '#14151C',
    justifyContent: 'center',
    alignItems: 'center',
  },

  addStoryIcon: {
    fontSize: 26,
    fontWeight: '300',
    color: '#F28A2E',
  },

  storyRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 3,
    padding: 2,
    position: 'relative',
  },

  storyRingUnseen: {
    borderColor: '#A985FF',
    backgroundColor: '#17131F',
  },

  storyRingSeen: {
    borderColor: 'rgba(145,145,155,0.42)',
    backgroundColor: 'rgba(40,40,46,0.42)',
  },

  storyCircleInner: {
    width: '100%',
    height: '100%',
    borderRadius: 29,
    backgroundColor: '#171820',
  },

  storyTextCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  storyFallbackIcon: {
    fontSize: 21,
  },

  storyCountBadge: {
    position: 'absolute',
    right: -5,
    bottom: -3,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#A985FF',
    borderWidth: 2,
    borderColor: '#08090D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  storyCountText: {
    color: '#0C0812',
    fontSize: 9,
    fontWeight: '900',
  },

  storyName: {
    marginTop: 7,
    fontSize: 10,
    color: '#D0D0D6',
    fontWeight: '700',
    maxWidth: 72,
    textAlign: 'center',
  },

  storyNameSeen: {
    color: 'rgba(160,160,170,0.58)',
  },

  storyCreateBox: {
    backgroundColor: '#101117',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#292A33',
    maxWidth: '100%',
    minWidth: 0,
  },

  storyPreview: {
    width: '100%',
    height: 145,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '100%',
  },

  createTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F3F4F6',
    marginBottom: 8,
  },

  createPostCard: {
    marginTop: 22,
    backgroundColor: '#101117',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#292A33',
    maxWidth: '100%',
    minWidth: 0,
  },

  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    minWidth: 0,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#302447',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#6E4FA9',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },

  avatarText: {
    fontSize: 16,
    color: '#F1EAFE',
    fontWeight: '900',
  },

  postPrompt: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#1A1E27',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#292E39',
    minWidth: 0,
    maxWidth: '100%',
  },

  postPromptText: {
    color: '#858C99',
    fontSize: 13,
    flexShrink: 1,
    minWidth: 0,
  },

  postCreateBox: {
    marginTop: 10,
  },

  postInput: {
    minHeight: 72,
    maxHeight: 130,
    borderRadius: 13,
    backgroundColor: '#0A0B10',
    borderWidth: 1,
    borderColor: '#292E39',
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    color: '#F1F3F5',
    textAlignVertical: 'top',
    maxWidth: '100%',
    minWidth: 0,
  },

  postPreview: {
    width: '100%',
    height: 190,
    borderRadius: 13,
    marginBottom: 8,
    maxWidth: '100%',
  },

  removeImageButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(11,13,18,0.86)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  removeImageText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },

  createActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9,
    gap: 8,
    maxWidth: '100%',
    minWidth: 0,
  },

  secondaryButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: '#191A22',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30313B',
    minWidth: 0,
    maxWidth: '100%',
  },

  secondaryButtonText: {
    color: '#D3D3DA',
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },

  primarySmallButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: '#F28A2E',
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '100%',
  },

  primarySmallText: {
    color: '#15110A',
    fontWeight: '900',
    flexShrink: 1,
    textAlign: 'center',
  },

  postCard: {
    backgroundColor: '#0F1016',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#24252D',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },

  reviewPostCard: {
    borderColor: '#34284F',
    backgroundColor: '#111018',
  },

  quotePostCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#8D65F2',
    backgroundColor: '#111017',
  },

  postImage: {
    width: '100%',
    height: 292,
    borderRadius: 13,
    marginTop: 14,
    maxWidth: '100%',
  },

  postText: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 23,
    color: '#ECECF0',
    flexShrink: 1,
    maxWidth: '100%',
  },

  quotePostText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#F3EFFB',
    fontStyle: 'italic',
    flexShrink: 1,
    maxWidth: '100%',
  },

  feedTypeLabel: {
    alignSelf: 'flex-start',
    marginTop: 14,
    color: '#A985FF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  moreButton: {
    color: '#747680',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 4,
  },

  postActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#252A34',
    maxWidth: '100%',
    minWidth: 0,
  },

  postAction: {
    paddingVertical: 7,
    paddingHorizontal: 5,
    minWidth: 0,
    flexShrink: 1,
  },

  postActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9EA5B1',
    flexShrink: 1,
    textAlign: 'center',
  },

  likedPostAction: {
    color: '#FF6B7A',
    fontWeight: '800',
  },

  repostedPostAction: {
    color: '#66D19E',
    fontWeight: '800',
  },

  savedText: {
    color: '#F5A623',
    fontWeight: '800',
  },

  loadingBox: {
    alignItems: 'center',
    marginVertical: 20,
  },

  info: {
    marginTop: 8,
    textAlign: 'center',
    color: '#858C99',
  },

  empty: {
    alignItems: 'center',
    marginTop: 35,
    padding: 20,
    backgroundColor: '#12151C',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#242934',
  },

  emptyIcon: {
    fontSize: 45,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 19,
    fontWeight: '800',
    color: '#F2F3F5',
  },

  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#858C99',
    lineHeight: 21,
  },

  emptyButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F5A623',
  },

  emptyButtonText: {
    color: '#17120A',
    fontWeight: '900',
  },

  reviewCard: {
    backgroundColor: '#111018',
    borderRadius: 18,
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#34284F',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    minWidth: 0,
  },

  userInfo: {
    flex: 1,
    minWidth: 0,
  },

  username: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F2F3F5',
    flexShrink: 1,
    minWidth: 0,
  },

  handle: {
    marginTop: 2,
    fontSize: 12,
    color: '#9198A6',
    flexShrink: 1,
    minWidth: 0,
  },

  date: {
    marginTop: 3,
    fontSize: 11,
    color: '#737A87',
  },

  bookTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F2F2F5',
    flexShrink: 1,
    minWidth: 0,
  },

  bookAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    padding: 11,
    borderRadius: 13,
    backgroundColor: '#171820',
    borderWidth: 1,
    borderColor: '#2B2C36',
    maxWidth: '100%',
    minWidth: 0,
  },

  bookAttachmentIcon: {
    width: 38,
    height: 48,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#382651',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  bookAttachmentCover: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
  },


  bookAttachmentEmoji: {
    color: '#C7A9FF',
    fontSize: 22,
  },

  bookAttachmentInfo: { flex: 1,
    minWidth: 0,
  },

  bookAttachmentLabel: {
    color: '#8D65F2',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginBottom: 4,
  },

  bookAttachmentArrow: {
    color: '#777985',
    fontSize: 28,
    marginLeft: 8,
  },

  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    maxWidth: '100%',
    minWidth: 0,
  },

  stars: {
    fontSize: 17,
    letterSpacing: 1,
    color: '#F28A2E',
    flexShrink: 1,
  },

  ratingNumber: {
    marginLeft: 8,
    fontSize: 12,
    color: '#9299A5',
    flexShrink: 1,
  },

  reviewText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#D9DCE2',
    flexShrink: 1,
    maxWidth: '100%',
  },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#252A34',
    gap: 9,
    maxWidth: '100%',
    minWidth: 0,
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 14,
    backgroundColor: '#191D26',
    minWidth: 0,
    flexShrink: 1,
  },

  action: {
    fontSize: 12,
    color: '#9EA5B1',
    fontWeight: '700',
    flexShrink: 1,
  },

  likedAction: {
    color: '#FF6B7A',
  },

  repostedAction: {
    color: '#66D19E',
  },

  count: {
    fontSize: 11,
    color: '#777F8C',
  },

  commentBox: {
    marginTop: 11,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: '#25262E',
    maxWidth: '100%',
    minWidth: 0,
  },

  commentInput: {
    minHeight: 44,
    maxHeight: 96,
    backgroundColor: '#0A0B10',
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 11,
    fontSize: 13,
    color: '#F1F3F5',
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#30313A',
    maxWidth: '100%',
    minWidth: 0,
  },

  commentButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    maxWidth: '100%',
    minWidth: 0,
    flexWrap: 'wrap',
  },

  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#191A22',
    borderWidth: 1,
    borderColor: '#2B303C',
  },

  cancelText: {
    color: '#A9AFB9',
    fontWeight: '700',
  },

  sendButton: {
    paddingHorizontal: 17,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#7B55D9',
  },

  sendText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },

  comments: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#252A34',
    maxWidth: '100%',
    minWidth: 0,
  },

  comment: {
    marginBottom: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: '#17181F',
    maxWidth: '100%',
    minWidth: 0,
  },

  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: '100%',
    minWidth: 0,
  },

  commentUser: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E7E9ED',
    flexShrink: 1,
    minWidth: 0,
  },

  deleteComment: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B7A',
  },

  commentText: {
    marginTop: 4,
    fontSize: 13,
    color: '#C4C8D0',
    lineHeight: 19,
    flexShrink: 1,
    maxWidth: '100%',
  },

  commentDate: {
    marginTop: 5,
    fontSize: 10,
    color: '#737A87',
  },

  floatingCreateButton: {
    position: 'absolute',
    right: 18,
    bottom: 103,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F28A2E',
    borderWidth: 2,
    borderColor: '#FFB15C',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },

  floatingCreateIcon: {
    color: '#17100A',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '400',
  },

    headerMenuWrap: {
      position: 'relative',
      zIndex: 50,
    },
    authDropdown: {
      position: 'absolute',
      top: 48,
      left: 0,
      width: 170,
      backgroundColor: '#111116',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#292932',
      paddingVertical: 6,
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
      zIndex: 100,
    },
    authDropdownItem: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 15,
      gap: 11,
    },
    authDropdownText: {
      color: '#F1F1F5',
      fontSize: 14,
      fontWeight: '700',
    },
    authDropdownDivider: {
      height: 1,
      backgroundColor: '#24242B',
      marginHorizontal: 12,
    },

    drawerOverlay: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.48)',
    },
    drawerPanel: {
      width: '86%',
      height: '100%',
      backgroundColor: '#101012',
      paddingTop: 54,
      paddingHorizontal: 24,
      borderRightWidth: 1,
      borderRightColor: '#24242A',
    },
    drawerDismissArea: {
      flex: 1,
    },
    drawerHeader: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    drawerBrand: {
      fontSize: 24,
      fontWeight: '800',
      color: '#F3F3F6',
      letterSpacing: -0.5,
    },
    drawerBrandAccent: {
      color: '#A985FF',
    },
    drawerCloseButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#17171C',
      borderWidth: 1,
      borderColor: '#2A2A31',
    },
    drawerDivider: {
      height: 1,
      backgroundColor: '#29292F',
      marginTop: 18,
      marginBottom: 26,
    },
    drawerSection: {
      gap: 6,
    },
    drawerItem: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingHorizontal: 10,
    },
    drawerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#17171C',
      borderWidth: 1,
      borderColor: '#29292F',
      marginRight: 14,
    },
    drawerItemText: {
      color: '#F3F3F6',
      fontSize: 18,
      fontWeight: '700',
    },
    drawerBottomArea: {
      marginTop: 'auto',
      paddingBottom: 42,
      paddingTop: 22,
      borderTopWidth: 1,
      borderTopColor: '#29292F',
    },
    drawerBottomText: {
      color: '#7F7F89',
      fontSize: 13,
    },
});

// RESPONSIVE_HOME_SAFE_V1
