import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
  image_url: string | null;
  text: string | null;
  created_at: string;
  expires_at: string;
};

const REVIEWS_KEY = 'reviews';

const CURRENT_USERNAME = 'Kitap Okuru';

function isValidUUID(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export default function HomeScreen() {
  const router = useRouter();const [selectedStory, setSelectedStory] =
  useState<Story | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

    const [currentUser, setCurrentUser] =
  useState<any>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);

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

          return {
            id: review.id,
            user_id: review.user_id,
            bookKey: review.book_key,
            bookTitle: review.book_title,
            rating: Number(review.rating) || 0,
            text: review.text || '',
            createdAt: review.created_at,
            username: CURRENT_USERNAME,
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

            return {
              ...post,
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
    username: CURRENT_USERNAME,
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
    username: CURRENT_USERNAME,
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

const allFeedItems: Post[] = [
  ...preparedPosts,
  ...reviewPosts,
  ...quotePosts,
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

      setStories(
        (data || []) as Story[]
      );
    } catch (error) {
      console.error(
        'Hikâye yükleme hatası:',
        error
      );
    } finally {
      setLoadingStories(false);
    }
  }, []);

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
    // POST'U VERİTABANINA KAYDET
    // =====================================================

    const {
      data,
      error,
    } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        username: CURRENT_USERNAME,
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

  function openStory(story: Story) {
  setSelectedStory(story);
}

  /*
   * =====================================================
   * EKRAN
   * =====================================================
   */

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
       <View style={styles.homeHeader}>
  <View style={styles.homeHeaderText}>
    <Text style={styles.greeting}>
      Merhaba 👋
    </Text>

    <Text style={styles.title}>
      Kitap dünyasına hoş
      geldin
    </Text>
  </View>

  <Pressable
    onPress={() =>
      router.push('/messages')
    }
    style={styles.messageButton}
  >
    <Text style={styles.messageIcon}>
      💬
    </Text>
  </Pressable>
</View>
        <Text
          style={styles.title}
        >
          Kitap dünyasına hoş
          geldin
        </Text>

        
<Pressable
  onPress={async () => {
    if (currentUser) {
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        Alert.alert(
          'Hata',
          'Çıkış yapılırken bir hata oluştu.'
        );
        return;
      }

      setCurrentUser(null);
      setCurrentUserId(null);

      router.replace('/login');
    } else {
      router.push('/login');
    }
  }}
  style={styles.loginButton}
>
  <Text style={styles.loginButtonText}>
    {currentUser
      ? 'Çıkış Yap'
      : 'Giriş Yap / Kayıt Ol'}
  </Text>
</Pressable>      



        <Pressable
          onPress={() =>
            router.push('/explore')
          }
          style={
            styles.exploreButton
          }
        >
          <Text
            style={
              styles.exploreButtonText
            }
          >
            🔎 Kitap Keşfet
          </Text>
        </Pressable>

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
                  <Text>
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
              stories.map(
                (story) => (
                  <Pressable
                    key={
                      story.id
                    }
                    onPress={() =>
                      openStory(
                        story
                      )
                    }
                    style={
                      styles.storyItem
                    }
                  >
                    {story.image_url ? (
                      <Image
                        source={{
                          uri: story.image_url,
                        }}
                        style={
                          styles.storyCircle
                        }
                      />
                    ) : (
                      <View
                        style={[
                          styles.storyCircle,
                          styles.storyTextCircle,
                        ]}
                      >
                        <Text>
                          📖
                        </Text>
                      </View>
                    )}

                    <Text
                      numberOfLines={
                        1
                      }
                      style={
                        styles.storyName
                      }
                    >
                      {
                        story.username
                      }
                    </Text>
                  </Pressable>
                )
              )
            )}
          </ScrollView>
        </View>

        {/* POST OLUŞTUR */}

        <View
          style={
            styles.createPostCard
          }
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
                  <Text>
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
      onRequestClose={() =>
        setSelectedStory(null)
      }
    >
      <View style={styles.storyModalOverlay}>
        <Pressable
          style={styles.storyModalCloseArea}
          onPress={() =>
            setSelectedStory(null)
          }
        />

        <View style={styles.storyViewer}>
          <Pressable
            onPress={() =>
              setSelectedStory(null)
            }
            style={styles.storyCloseButton}
          >
            <Text style={styles.storyCloseText}>
              ×
            </Text>
          </Pressable>

          <Text style={styles.storyViewerUsername}>
            {selectedStory?.username}
          </Text>

          {selectedStory?.image_url ? (
            <Image
              source={{
                uri: selectedStory.image_url,
              }}
              style={styles.storyViewerImage}
              resizeMode="contain"
            />
          ) : null}

          {selectedStory?.text ? (
            <Text style={styles.storyViewerText}>
              {selectedStory.text}
            </Text>
          ) : null}
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
        ) : posts.length === 0 ? (
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
              Henüz gönderi yok
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              İlk gönderiyi sen
              paylaş.
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
          posts.map((post) => (
            <View
              key={post.id}
              style={
                styles.postCard
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
                  <Text
                    style={
                      styles.avatarText
                    }
                  >
                    👤
                  </Text>
                </View>

                <View
                  style={
                    styles.userInfo
                  }
                >
                  <Text
                    style={
                      styles.username
                    }
                  >
                    {
                      post.username
                    }
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
              </View>

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
                  style={
                    styles.postText
                  }
                >
                  {post.text}
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
                >
                  <Text
                    style={
                      styles.bookTitle
                    }
                  >
                    📖{' '}
                    {
                      post.book_title
                    }
                  </Text>
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

              <View
                style={
                  styles.postActions
                }
              >
                <Pressable
                  onPress={() =>
                    toggleSavePost(
                      post
                    )
                  }
                  style={
                    styles.postAction
                  }
                >
                  <Text
                    style={[
                      styles.postActionText,
                      post.saved &&
                        styles.savedText,
                    ]}
                  >
                    {post.saved
                      ? '🔖 Kaydedildi'
                      : '🔖 Kaydet'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    openPostCommentBox(
                      post.id
                    )
                  }
                  style={
                    styles.postAction
                  }
                >
                  <Text
                    style={
                      styles.postActionText
                    }
                  >
                    💬 Yorum
                    {(post.comments
                      ?.length ??
                      0) > 0
                      ? ` ${post.comments?.length}`
                      : ''}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    togglePostLike(
                      post
                    )
                  }
                  style={
                    styles.postAction
                  }
                >
                  <Text
                    style={[
                      styles.postActionText,
                      post.liked &&
                        styles.likedPostAction,
                    ]}
                  >
                    {post.liked
                      ? `♥ Beğenildi${
                          post.likes
                            ? ` ${post.likes}`
                            : ''
                        }`
                      : `♡ Beğen${
                          post.likes
                            ? ` ${post.likes}`
                            : ''
                        }`}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    togglePostRepost(
                      post
                    )
                  }
                  style={
                    styles.postAction
                  }
                >
                  <Text
                    style={[
                      styles.postActionText,
                      post.reposted &&
                        styles.repostedPostAction,
                    ]}
                  >
                    {post.reposted
                      ? `✓ Repostlandı${
                          post.reposts
                            ? ` ${post.reposts}`
                            : ''
                        }`
                      : `↻ Repost${
                          post.reposts
                            ? ` ${post.reposts}`
                            : ''
                        }`}
                  </Text>
                </Pressable>
              </View>

              {/* POST YORUM KUTUSU */}

              {commentingPostId ===
                post.id && (
                <View
                  style={
                    styles.commentBox
                  }
                >
                  <TextInput
                    value={
                      postCommentText
                    }
                    onChangeText={
                      setPostCommentText
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
                        setCommentingPostId(
                          null
                        );
                        setPostCommentText(
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
                        submitPostComment(
                          post.id
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

              {/* POST YORUMLARI */}

              {(post.comments
                ?.length ?? 0) > 0 && (
                <View
                  style={
                    styles.comments
                  }
                >
                  {post.comments?.map(
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
                                  deletePostComment(
                                    post.id,
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
          ))
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
        ) : reviews.length > 0 ? (
          
          <>
          <Text style={{ color: 'red', fontSize: 20 }}>
  TEST: {reviews.length}
</Text>
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

            {reviews.map(
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
                      <Text
                        style={
                          styles.avatarText
                        }
                      >
                        👤
                      </Text>
                    </View>

                    <View
                      style={
                        styles.userInfo
                      }
                    >
                      <Text
                        style={
                          styles.username
                        }
                      >
                        {review.username ||
                          CURRENT_USERNAME}
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
                  </View>

                  <Pressable
                    onPress={() =>
                      openBook(
                        review.bookKey
                      )
                    }
                  >
                    <Text
                      style={
                        styles.bookTitle
                      }
                    >
                      📖{' '}
                      {
                        review.bookTitle
                      }
                    </Text>
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

      <BottomNav />
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
    backgroundColor: '#F7F7F5',
  },

  content: {
    padding: 20,
    paddingBottom: 110,
  },

  homeHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 5,
},

homeHeaderText: {
  flex: 1,
},

messageButton: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: '#FFF',
  borderWidth: 1,
  borderColor: '#E5E5E5',
  justifyContent: 'center',
  alignItems: 'center',
  marginLeft: 12,
},

messageIcon: {
  fontSize: 22,
},

  greeting: {
    fontSize: 16,
    color: '#777',
  },

  title: {
    marginTop: 5,
    fontSize: 27,
    fontWeight: '700',
    color: '#222',
  },

  loginButton: {
    marginTop: 15,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loginButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },

  exploreButton: {
    marginTop: 12,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },

  storyModalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.85)',
  justifyContent: 'center',
  alignItems: 'center',
},

storyModalCloseArea: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
},

storyViewer: {
  width: '92%',
  maxHeight: '85%',
  backgroundColor: '#111',
  borderRadius: 20,
  padding: 20,
  alignItems: 'center',
  position: 'relative',
},

storyCloseButton: {
  position: 'absolute',
  top: 10,
  right: 12,
  zIndex: 10,
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: 'rgba(255,255,255,0.15)',
  justifyContent: 'center',
  alignItems: 'center',
},

storyCloseText: {
  color: '#fff',
  fontSize: 28,
  lineHeight: 30,
},

storyViewerUsername: {
  color: '#fff',
  fontSize: 17,
  fontWeight: '700',
  marginBottom: 18,
  alignSelf: 'flex-start',
},

storyViewerImage: {
  width: '100%',
  height: 500,
  borderRadius: 12,
},

storyViewerText: {
  color: '#fff',
  fontSize: 20,
  lineHeight: 30,
  textAlign: 'center',
  marginTop: 15,
},

  exploreButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },

  sectionHeader: {
    marginTop: 25,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#222',
  },

  storySection: {
    marginTop: 5,
  },

  addStoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
  },

  storyList: {
    gap: 14,
    paddingBottom: 5,
  },

  storyItem: {
    width: 65,
    alignItems: 'center',
  },

  addStoryCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },

  addStoryIcon: {
    fontSize: 25,
    fontWeight: '300',
  },

  storyCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EEEEEA',
    borderWidth: 2,
    borderColor: '#222',
  },

  storyTextCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  storyName: {
    marginTop: 5,
    fontSize: 10,
    color: '#555',
    maxWidth: 65,
    textAlign: 'center',
  },

  storyCreateBox: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  storyPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
  },

  createTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 10,
  },

  createPostCard: {
    marginTop: 25,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEEEEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  avatarText: {
    fontSize: 20,
  },

  postPrompt: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F7F7F5',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  postPromptText: {
    color: '#888',
    fontSize: 13,
  },

  postCreateBox: {
    marginTop: 14,
  },

  postInput: {
    minHeight: 90,
    borderRadius: 12,
    backgroundColor: '#F7F7F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 12,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
  },

  postPreview: {
    width: '100%',
    height: 230,
    borderRadius: 14,
    marginBottom: 10,
  },

  removeImageButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  removeImageText: {
    fontSize: 16,
    fontWeight: '700',
  },

  createActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
  },

  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EEEEEA',
    alignItems: 'center',
  },

  primarySmallButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#222',
    alignItems: 'center',
  },

  primarySmallText: {
    color: '#FFF',
    fontWeight: '700',
  },

  postCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 14,
    marginTop: 14,
  },

  postText: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },

  postActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },

  postAction: {
    paddingVertical: 6,
  },

  postActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },

  likedPostAction: {
    color: '#C0392B',
    fontWeight: '700',
  },

  repostedPostAction: {
    color: '#4A7C59',
    fontWeight: '700',
  },

  savedText: {
    color: '#222',
    fontWeight: '700',
  },

  loadingBox: {
    alignItems: 'center',
    marginVertical: 20,
  },

  info: {
    marginTop: 8,
    textAlign: 'center',
    color: '#777',
  },

  empty: {
    alignItems: 'center',
    marginTop: 35,
    padding: 20,
  },

  emptyIcon: {
    fontSize: 45,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 19,
    fontWeight: '700',
    color: '#222',
  },

  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#777',
    lineHeight: 21,
  },

  emptyButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#222',
  },

  emptyButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },

  reviewCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  userInfo: {
    flex: 1,
  },

  username: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
  },

  date: {
    marginTop: 2,
    fontSize: 11,
    color: '#999',
  },

  bookTitle: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },

  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  stars: {
    fontSize: 18,
    letterSpacing: 1,
  },

  ratingNumber: {
    marginLeft: 8,
    fontSize: 12,
    color: '#777',
  },

  reviewText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#444',
  },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    gap: 16,
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
  },

  action: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },

  likedAction: {
    color: '#C0392B',
  },

  repostedAction: {
    color: '#4A7C59',
  },

  count: {
    fontSize: 12,
    color: '#999',
  },

  commentBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },

  commentInput: {
    minHeight: 80,
    backgroundColor: '#F7F7F5',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  commentButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },

  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EEEEEA',
  },

  cancelText: {
    color: '#555',
    fontWeight: '600',
  },

  sendButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#222',
  },

  sendText: {
    color: '#FFF',
    fontWeight: '700',
  },

  comments: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },

  comment: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F7F7F5',
  },

  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  commentUser: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },

  deleteComment: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C0392B',
  },

  commentText: {
    marginTop: 4,
    fontSize: 13,
    color: '#555',
    lineHeight: 19,
  },

  commentDate: {
    marginTop: 5,
    fontSize: 10,
    color: '#999',
  },
});