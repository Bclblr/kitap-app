import BookCover from '@/components/BookCover';
import { existingBookCover, openLibraryUrl } from '@/lib/open-library-cover';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Recommendation = {
  book_key: string;
  book_title: string;
  count: number;
  coverUrl: string | null;
  author?: string;
};

export default function BookDiscoveryRecommendations({
  bookKey,
  title,
  author,
  limit = 8,
}: {
  bookKey: string;
  title: string;
  author: string;
  limit?: number;
}) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [communityItems, setCommunityItems] = useState<Recommendation[]>([]);
  const [similarItems, setSimilarItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function enrich(items: Recommendation[]) {
      return Promise.all(
        items.map(async (item) => {
          const url = openLibraryUrl(item.book_key);
          if (!url) return item;
          try {
            const response = await fetch(url);
            if (!response.ok) return item;
            const metadata = await response.json();
            return {
              ...item,
              coverUrl: existingBookCover(metadata),
              author:
                Array.isArray(metadata?.authors) && metadata.authors.length
                  ? metadata.authors.map((entry: any) => entry?.name).filter(Boolean).join(', ')
                  : item.author,
            };
          } catch {
            return item;
          }
        }),
      );
    }

    async function load() {
      if (!bookKey) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: sameBookRows } = await supabase
          .from('user_book_status')
          .select('user_id')
          .eq('book_key', bookKey)
          .limit(150);

        const readerIds = [...new Set((sameBookRows ?? []).map((row) => row.user_id).filter(Boolean))].slice(0, 80);
        let community: Recommendation[] = [];

        if (readerIds.length) {
          const { data: otherRows } = await supabase
            .from('user_book_status')
            .select('user_id,book_key,book_title,status')
            .in('user_id', readerIds)
            .neq('book_key', bookKey)
            .limit(800);

          const aggregate = new Map<string, { title: string; readers: Set<string>; weight: number }>();
          for (const row of otherRows ?? []) {
            if (!row.book_key || !row.book_title) continue;
            const current = aggregate.get(row.book_key) ?? {
              title: row.book_title,
              readers: new Set<string>(),
              weight: 0,
            };
            current.readers.add(row.user_id);
            current.weight += row.status === 'read' ? 3 : row.status === 'reading' ? 2 : 1;
            aggregate.set(row.book_key, current);
          }

          community = [...aggregate.entries()]
            .map(([candidateKey, value]) => ({
              book_key: candidateKey,
              book_title: value.title,
              count: value.readers.size,
              score: value.weight,
              coverUrl: null,
            }))
            .sort((a, b) => b.count - a.count || b.score - a.score)
            .slice(0, limit)
            .map(({ score: _score, ...item }) => item);
        }

        let similar: Recommendation[] = [];
        const cleanAuthor = author && author !== 'Bilinmeyen yazar' ? author.split(',')[0].trim() : '';
        if (cleanAuthor) {
          try {
            const response = await fetch(
              `https://openlibrary.org/search.json?author=${encodeURIComponent(cleanAuthor)}&limit=${Math.max(limit + 5, 12)}&fields=key,title,author_name,cover_i,edition_key,isbn`,
            );
            if (response.ok) {
              const payload = await response.json();
              similar = (Array.isArray(payload?.docs) ? payload.docs : [])
                .filter((item: any) => item?.key && item.key !== bookKey && item?.title)
                .slice(0, limit)
                .map((item: any) => ({
                  book_key: String(item.key),
                  book_title: String(item.title),
                  count: 0,
                  coverUrl: existingBookCover(item),
                  author: Array.isArray(item.author_name) ? item.author_name.join(', ') : cleanAuthor,
                }));
            }
          } catch {
            similar = [];
          }
        }

        const enrichedCommunity = await enrich(community);
        if (!active) return;
        setCommunityItems(enrichedCommunity);
        setSimilarItems(similar);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [bookKey, author, limit]);

  if (loading) {
    return (
      <View style={[styles.loadingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Benzer kitaplar hazırlanıyor...</Text>
      </View>
    );
  }

  if (!communityItems.length && !similarItems.length) return null;

  function renderItems(items: Recommendation[], communityMode: boolean) {
    return (
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
                  author: item.author ?? undefined,
                },
              })
            }
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel={`${item.book_title} kitabını aç`}
          >
            <BookCover uri={item.coverUrl} style={styles.cover}>
              <View style={[styles.cover, styles.fallback, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.fallbackText, { color: colors.primary }]}>K</Text>
              </View>
            </BookCover>
            <Text numberOfLines={2} style={[styles.bookTitle, { color: colors.text }]}>{item.book_title}</Text>
            <Text numberOfLines={1} style={[styles.reason, { color: colors.textSecondary }]}>
              {communityMode ? `${item.count} ortak okur` : item.author || 'Benzer eser'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.wrapper}>
      {communityItems.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Bunu okuyanlar bunları da okudu</Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>Aynı kitabı rafına ekleyen okurların diğer kitaplarından seçildi.</Text>
          {renderItems(communityItems, true)}
        </View>
      ) : null}

      {similarItems.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Benzer kitaplar</Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>{title} sonrası aynı yazardan keşfedebileceğin eserler.</Text>
          {renderItems(similarItems, false)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 14, marginTop: 16 },
  card: { borderWidth: 1, borderRadius: 20, paddingVertical: 16 },
  title: { fontSize: 17, fontWeight: '900', paddingHorizontal: 16 },
  caption: { fontSize: 12, lineHeight: 18, marginTop: 4, paddingHorizontal: 16 },
  list: { gap: 12, paddingHorizontal: 16, paddingTop: 14 },
  item: { width: 112 },
  cover: { width: 104, height: 154, borderRadius: 10 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { fontSize: 30, fontWeight: '900' },
  bookTitle: { fontSize: 13, lineHeight: 17, fontWeight: '800', marginTop: 8 },
  reason: { fontSize: 10, marginTop: 4 },
  loadingCard: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', marginTop: 16 },
  loadingText: { fontSize: 12, marginTop: 8 },
});
