import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import BookCover from '@/components/BookCover';
import { existingBookCover, openLibraryUrl } from '@/lib/open-library-cover';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';

type ReviewRow = {
  user_id: string;
  book_key: string;
  book_title: string | null;
  rating: number | null;
};

type Suggestion = {
  book_key: string;
  book_title: string;
  score: number;
  people: number;
  coverUrl: string | null;
};

export default function PersonalizedBookSuggestions({ limit = 8 }: { limit?: number }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasPersonalSignal, setHasPersonalSignal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        setError('');

        try {
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData.user?.id;
          if (!userId) {
            if (active) setItems([]);
            return;
          }

          const [myReviewsResult, myShelfResult] = await Promise.all([
            supabase
              .from('reviews')
              .select('book_key,book_title,rating')
              .eq('user_id', userId)
              .limit(100),
            supabase
              .from('user_book_status')
              .select('book_key')
              .eq('user_id', userId)
              .limit(300),
          ]);

          if (myReviewsResult.error) throw myReviewsResult.error;

          const myReviews = (myReviewsResult.data ?? []) as {
            book_key: string;
            book_title: string | null;
            rating: number | null;
          }[];
          const reviewedKeys = [...new Set(myReviews.map((row) => row.book_key).filter(Boolean))];
          const ownedKeys = new Set([
            ...reviewedKeys,
            ...((myShelfResult.data ?? []).map((row) => row.book_key).filter(Boolean) as string[]),
          ]);

          let suggestions: Suggestion[] = [];

          if (reviewedKeys.length) {
            const { data: overlapRows, error: overlapError } = await supabase
              .from('reviews')
              .select('user_id,book_key,book_title,rating')
              .in('book_key', reviewedKeys.slice(0, 80))
              .neq('user_id', userId)
              .limit(500);

            if (overlapError) throw overlapError;

            const peerStrength = new Map<string, number>();
            for (const row of (overlapRows ?? []) as ReviewRow[]) {
              peerStrength.set(row.user_id, (peerStrength.get(row.user_id) ?? 0) + 1);
            }

            const peers = [...peerStrength.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 30)
              .map(([id]) => id);

            if (peers.length) {
              const { data: candidateRows, error: candidateError } = await supabase
                .from('reviews')
                .select('user_id,book_key,book_title,rating')
                .in('user_id', peers)
                .limit(600);

              if (candidateError) throw candidateError;

              const aggregate = new Map<
                string,
                { title: string; score: number; people: Set<string> }
              >();

              for (const row of (candidateRows ?? []) as ReviewRow[]) {
                if (!row.book_key || ownedKeys.has(row.book_key)) continue;
                const title = row.book_title?.trim();
                if (!title) continue;

                const peerWeight = Math.min(peerStrength.get(row.user_id) ?? 1, 5);
                const ratingWeight = Math.max(0, Number(row.rating) || 0);
                const current = aggregate.get(row.book_key) ?? {
                  title,
                  score: 0,
                  people: new Set<string>(),
                };
                current.score += peerWeight * 3 + ratingWeight;
                current.people.add(row.user_id);
                aggregate.set(row.book_key, current);
              }

              suggestions = [...aggregate.entries()]
                .map(([book_key, value]) => ({
                  book_key,
                  book_title: value.title,
                  score: value.score,
                  people: value.people.size,
                  coverUrl: null,
                }))
                .sort((a, b) => b.score - a.score || b.people - a.people)
                .slice(0, limit);
            }
          }

          const personal = suggestions.length > 0;

          if (!suggestions.length) {
            const { data: popular, error: popularError } = await supabase.rpc('get_popular_books');
            if (popularError) throw popularError;
            suggestions = (Array.isArray(popular) ? popular : [])
              .filter((row: any) => row?.book_key && !ownedKeys.has(String(row.book_key)))
              .slice(0, limit)
              .map((row: any) => ({
                book_key: String(row.book_key),
                book_title: String(row.book_title || 'Bilinmeyen kitap'),
                score: Number(row.popularity_score) || 0,
                people: Number(row.total_users) || 0,
                coverUrl: null,
              }));
          }

          const enriched = await Promise.all(
            suggestions.map(async (item) => {
              const url = openLibraryUrl(item.book_key);
              if (!url) return item;
              try {
                const response = await fetch(url);
                if (!response.ok) return item;
                const metadata = await response.json();
                return { ...item, coverUrl: existingBookCover(metadata) };
              } catch {
                return item;
              }
            }),
          );

          if (active) {
            setHasPersonalSignal(personal);
            setItems(enriched);
          }
        } catch (loadError) {
          console.error('Personalized book suggestions error:', loadError);
          if (active) {
            setItems([]);
            setError('Kitap önerileri şu anda yüklenemedi.');
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      void load();
      return () => {
        active = false;
      };
    }, [limit]),
  );

  if (!loading && !items.length && !error) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
      <Text style={[styles.title, { color: colors.text }]}>Senin için kitaplar</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}> 
        {hasPersonalSignal
          ? 'Benzer kitapları seven okurların beğendiklerinden seçildi.'
          : 'Okuma geçmişin geliştikçe öneriler daha kişisel hale gelecek.'}
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : error ? (
        <Text style={[styles.error, { color: colors.textSecondary }]}>{error}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
          {items.map((item) => (
            <Pressable
              key={item.book_key}
              onPress={() =>
                router.push({
                  pathname: '/book',
                  params: {
                    key: item.book_key,
                    title: item.book_title,
                    coverUrl: item.coverUrl ?? undefined,
                  },
                })
              }
              style={styles.book}
              accessibilityRole="button"
              accessibilityLabel={`${item.book_title} kitabını aç`}
            >
              <BookCover uri={item.coverUrl} style={styles.cover}>
                <View style={[styles.cover, styles.fallback, { backgroundColor: colors.surfaceElevated }]}> 
                  <Text style={[styles.fallbackText, { color: colors.primary }]}>K</Text>
                </View>
              </BookCover>
              <Text numberOfLines={2} style={[styles.bookTitle, { color: colors.text }]}>
                {item.book_title}
              </Text>
              <Text numberOfLines={1} style={[styles.reason, { color: colors.textSecondary }]}> 
                {hasPersonalSignal
                  ? `${item.people} benzer okur öneriyor`
                  : `${item.people} kişinin rafında`}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 16,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '900', paddingHorizontal: 16 },
  caption: { fontSize: 12, lineHeight: 18, marginTop: 4, paddingHorizontal: 16 },
  loader: { marginVertical: 28 },
  error: { fontSize: 13, padding: 16 },
  list: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  book: { width: 112 },
  cover: { width: 112, height: 164, borderRadius: 10 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { fontSize: 28, fontWeight: '900' },
  bookTitle: { fontSize: 13, fontWeight: '800', lineHeight: 18, marginTop: 8, minHeight: 36 },
  reason: { fontSize: 10, marginTop: 4 },
});
