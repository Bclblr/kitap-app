from pathlib import Path

path = Path('src/app/index.tsx')
source = path.read_text(encoding='utf-8')

reviews_start = source.index("  const loadReviews = useCallback(async () => {")
posts_start = source.index("\n  const loadPosts = useCallback(async () => {", reviews_start)

new_reviews = '''  const loadReviews = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      const blockedUserIds = await getBlockedUserIds(userId);

      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.error('Supabase incelemeleri yüklenemedi:', error);
        setReviews([]);
        return;
      }

      const visibleReviews = (data ?? []).filter(
        (review: any) => !review.user_id || !blockedUserIds.has(review.user_id)
      );
      const reviewIds = visibleReviews.map((review: any) => review.id);

      const [profileResult, likesResult, repostsResult, commentsResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username, profile_image'),
        reviewIds.length
          ? supabase.from('likes').select('review_id, user_id').in('review_id', reviewIds)
          : Promise.resolve({ data: [], error: null } as any),
        reviewIds.length
          ? supabase.from('reposts').select('review_id, user_id').in('review_id', reviewIds)
          : Promise.resolve({ data: [], error: null } as any),
        reviewIds.length
          ? supabase
              .from('comments')
              .select('id, text, created_at, user_id, review_id')
              .in('review_id', reviewIds)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (profileResult.error) console.error('İnceleme profilleri alınamadı:', profileResult.error);
      if (likesResult.error) console.error('İnceleme beğenileri alınamadı:', likesResult.error);
      if (repostsResult.error) console.error('İnceleme repostları alınamadı:', repostsResult.error);
      if (commentsResult.error) console.error('İnceleme yorumları alınamadı:', commentsResult.error);

      const reviewProfiles = new Map(
        (profileResult.data ?? []).map((profile: any) => [profile.id, profile])
      );
      const likesByReview = new Map<string, any[]>();
      const repostsByReview = new Map<string, any[]>();
      const commentsByReview = new Map<string, any[]>();

      for (const like of likesResult.data ?? []) {
        const items = likesByReview.get(like.review_id) ?? [];
        items.push(like);
        likesByReview.set(like.review_id, items);
      }
      for (const repost of repostsResult.data ?? []) {
        const items = repostsByReview.get(repost.review_id) ?? [];
        items.push(repost);
        repostsByReview.set(repost.review_id, items);
      }
      for (const comment of commentsResult.data ?? []) {
        if (comment.user_id && blockedUserIds.has(comment.user_id)) continue;
        const items = commentsByReview.get(comment.review_id) ?? [];
        items.push(comment);
        commentsByReview.set(comment.review_id, items);
      }

      const preparedReviews: Review[] = visibleReviews.map((review: any) => {
        const reviewAuthor = reviewProfiles.get(review.user_id);
        const reviewLikes = likesByReview.get(review.id) ?? [];
        const reviewReposts = repostsByReview.get(review.id) ?? [];
        const reviewComments = commentsByReview.get(review.id) ?? [];

        return {
          id: review.id,
          user_id: review.user_id,
          bookKey: review.book_key,
          coverUrl: review.coverUrl,
          cover_url: review.cover_url,
          isbn: review.isbn,
          key: review.key,
          workKey: review.workKey,
          cover_i: review.cover_i,
          covers: review.covers,
          edition_key: review.edition_key,
          bookTitle: review.book_title,
          rating: Number(review.rating) || 0,
          text: review.text || '',
          createdAt: review.created_at,
          username: reviewAuthor?.username || CURRENT_USERNAME,
          full_name: reviewAuthor?.full_name ?? null,
          profile_image: reviewAuthor?.profile_image ?? null,
          likes: reviewLikes.length,
          liked: !!userId && reviewLikes.some((item: any) => item.user_id === userId),
          comments: reviewComments.map((comment: any) => ({
            id: comment.id,
            user_id: comment.user_id,
            username: reviewProfiles.get(comment.user_id)?.username || CURRENT_USERNAME,
            text: comment.text,
            createdAt: comment.created_at,
          })),
          reposts: reviewReposts.length,
          reposted: !!userId && reviewReposts.some((item: any) => item.user_id === userId),
        };
      });

      setReviews(preparedReviews);
    } catch (error) {
      console.error('İncelemeler yüklenemedi:', error);
      setReviews([]);
    }
  }, []);
'''

source = source[:reviews_start] + new_reviews + source[posts_start:]

posts_start = source.index("  const loadPosts = useCallback(async () => {")
stories_start = source.index("\n  const loadStories = useCallback(async () => {", posts_start)

new_posts = '''  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.error('Postlar yüklenemedi:', error);
        return;
      }

      const userId = await getCurrentUserId();
      setCurrentUserId(userId);
      const blockedUserIds = await getBlockedUserIds(userId);
      const visiblePosts = (data ?? []).filter(
        (post: any) => !post.user_id || !blockedUserIds.has(post.user_id)
      );
      const postIds = visiblePosts.map((post: any) => post.id);

      const [profileResult, likesResult, repostsResult, commentsResult, savedResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username, profile_image'),
        postIds.length
          ? supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
          : Promise.resolve({ data: [], error: null } as any),
        postIds.length
          ? supabase.from('post_reposts').select('post_id, user_id').in('post_id', postIds)
          : Promise.resolve({ data: [], error: null } as any),
        postIds.length
          ? supabase
              .from('post_comments')
              .select('id, text, created_at, user_id, post_id')
              .in('post_id', postIds)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
        userId && postIds.length
          ? supabase
              .from('saved_posts')
              .select('post_id')
              .eq('user_id', userId)
              .in('post_id', postIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (profileResult.error) console.error('Post profilleri alınamadı:', profileResult.error);
      if (likesResult.error) console.error('Post beğenileri alınamadı:', likesResult.error);
      if (repostsResult.error) console.error('Post repostları alınamadı:', repostsResult.error);
      if (commentsResult.error) console.error('Post yorumları alınamadı:', commentsResult.error);
      if (savedResult.error) console.error('Kaydedilen postlar alınamadı:', savedResult.error);

      const profilesByUserId = new Map(
        (profileResult.data ?? []).map((profile: any) => [profile.id, profile])
      );
      const currentProfile = userId ? profilesByUserId.get(userId) : null;
      setStoryProfile({ userId, imageUrl: currentProfile?.profile_image?.trim() || null });

      const likesByPost = new Map<string, any[]>();
      const repostsByPost = new Map<string, any[]>();
      const commentsByPost = new Map<string, any[]>();
      const savedPostIds = new Set<string>((savedResult.data ?? []).map((item: any) => item.post_id));

      for (const like of likesResult.data ?? []) {
        const items = likesByPost.get(like.post_id) ?? [];
        items.push(like);
        likesByPost.set(like.post_id, items);
      }
      for (const repost of repostsResult.data ?? []) {
        const items = repostsByPost.get(repost.post_id) ?? [];
        items.push(repost);
        repostsByPost.set(repost.post_id, items);
      }
      for (const comment of commentsResult.data ?? []) {
        if (comment.user_id && blockedUserIds.has(comment.user_id)) continue;
        const items = commentsByPost.get(comment.post_id) ?? [];
        items.push(comment);
        commentsByPost.set(comment.post_id, items);
      }

      const preparedPosts: Post[] = visiblePosts.map((post: any) => {
        const postAuthor = post.user_id ? profilesByUserId.get(post.user_id) : null;
        const postLikes = likesByPost.get(post.id) ?? [];
        const postReposts = repostsByPost.get(post.id) ?? [];
        const postComments = commentsByPost.get(post.id) ?? [];

        return {
          ...post,
          username: postAuthor?.username || post.username || CURRENT_USERNAME,
          full_name: postAuthor?.full_name ?? null,
          profile_image: postAuthor?.profile_image ?? null,
          liked: !!userId && postLikes.some((item: any) => item.user_id === userId),
          likes: postLikes.length,
          reposted: !!userId && postReposts.some((item: any) => item.user_id === userId),
          reposts: postReposts.length,
          comments: postComments.map((comment: any) => ({
            id: comment.id,
            user_id: comment.user_id,
            username: profilesByUserId.get(comment.user_id)?.username || CURRENT_USERNAME,
            text: comment.text,
            createdAt: comment.created_at,
          })),
          saved: savedPostIds.has(post.id),
        } as Post;
      });

      const [reviewResult, quoteResult] = await Promise.all([
        supabase
          .from('reviews')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('quotes')
          .select('id,user_id,book_key,book_title,text,created_at')
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      if (reviewResult.error) console.error('Ana sayfa incelemeleri alınamadı:', reviewResult.error);
      if (quoteResult.error) throw quoteResult.error;

      const reviewPosts: Post[] = (reviewResult.data ?? [])
        .filter((review: any) => !review.user_id || !blockedUserIds.has(review.user_id))
        .map((review: any) => ({
          id: review.id,
          user_id: review.user_id ?? null,
          username: profilesByUserId.get(review.user_id)?.username || CURRENT_USERNAME,
          full_name: profilesByUserId.get(review.user_id)?.full_name ?? null,
          profile_image: profilesByUserId.get(review.user_id)?.profile_image ?? null,
          text: review.text,
          image_url: null,
          coverUrl: review.coverUrl,
          cover_url: review.cover_url,
          cover_i: review.cover_i,
          covers: review.covers,
          edition_key: review.edition_key,
          isbn: review.isbn,
          key: review.key,
          workKey: review.workKey,
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
        }));

      const remoteQuotePosts: Post[] = (quoteResult.data ?? [])
        .filter((quote: any) => !quote.user_id || !blockedUserIds.has(quote.user_id))
        .map((quote: any) => ({
          id: `quote-${quote.id}`,
          user_id: quote.user_id,
          username: profilesByUserId.get(quote.user_id)?.username || CURRENT_USERNAME,
          full_name: profilesByUserId.get(quote.user_id)?.full_name,
          profile_image: profilesByUserId.get(quote.user_id)?.profile_image,
          text: quote.text,
          image_url: null,
          book_key: quote.book_key,
          book_title: quote.book_title,
          rating: 0,
          created_at: quote.created_at,
          isQuote: true,
        }));

      const allFeedItems: Post[] = [
        ...preparedPosts,
        ...reviewPosts,
        ...remoteQuotePosts,
      ]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 60);

      setPosts(allFeedItems);
    } catch (error) {
      console.error('Post yükleme hatası:', error);
    } finally {
      setLoadingPosts(false);
    }
  }, []);
'''

source = source[:posts_start] + new_posts + source[stories_start:]
path.write_text(source, encoding='utf-8')
