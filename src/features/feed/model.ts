import type { BookCoverData } from '@/lib/open-library-cover';
import type { QuoteCardTemplate } from '@/lib/quote-card';

export type FeedComment = {
  id: string;
  username: string;
  full_name?: string | null;
  profile_image?: string | null;
  text: string;
  createdAt: string;
  user_id?: string;
};

export type FeedReview = BookCoverData & {
  id: string;
  user_id?: string;
  bookKey: string;
  bookTitle: string;
  rating: number;
  text: string;
  title?: string | null;
  topic?: string | null;
  tags?: string[];
  containsSpoiler?: boolean;
  createdAt: string;
  username?: string;
  full_name?: string | null;
  profile_image?: string | null;
  is_verified?: boolean;
  is_premium?: boolean;
  likes?: number;
  liked?: boolean;
  comments?: FeedComment[];
  reposts?: number;
  reposted?: boolean;
};

export type FeedPost = BookCoverData & {
  id: string;
  user_id: string | null;
  username: string;
  full_name?: string | null;
  profile_image?: string | null;
  is_verified?: boolean;
  is_premium?: boolean;
  text: string | null;
  image_url: string | null;
  image_urls?: string[] | null;
  book_key: string | null;
  book_title: string | null;
  rating: number;
  created_at: string;
  saved?: boolean;
  likes?: number;
  liked?: boolean;
  comments?: FeedComment[];
  reposts?: number;
  reposted?: boolean;
  isReview?: boolean;
  isQuote?: boolean;
  card_template_key?: QuoteCardTemplate;
  quoteTitle?: string | null;
  quoteTopic?: string | null;
  quotePageNumber?: number | null;
  quoteNote?: string | null;
  reviewTitle?: string | null;
  reviewTopic?: string | null;
  reviewTags?: string[];
  containsSpoiler?: boolean;
};

export type FeedProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  profile_image: string | null;
  is_verified: boolean;
  is_premium: boolean;
};
