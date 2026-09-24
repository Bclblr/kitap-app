import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import BookCover from '@/components/BookCover';
import { supabase } from '@/lib/supabase';
import { Work } from '@/lib/works';
import { useAppTheme } from '@/providers/ThemeProvider';

export default function WorksList({
  authorId,
  own = false,
  status,
  genre = '',
  sort = 'new',
}: {
  authorId?: string;
  own?: boolean;
  status?: 'draft' | 'published';
  genre?: string;
  sort?: 'new' | 'popular';
}) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      async function load() {
        setLoading(true);
        setError('');
        try {
          const popularity =
            !own && sort === 'popular'
              ? await supabase.rpc('work_popularity', { genre_filter: genre.trim() })
              : null;

          if (popularity?.error) throw popularity.error;

          const counts = new Map<string, number>(
            (popularity?.data ?? []).map((row: { work_id: string; saves: number }) => [
              row.work_id,
              Number(row.saves),
            ])
          );

          if (popularity && !counts.size) {
            if (alive) setWorks([]);
            return;
          }

          let query = supabase
            .from('works')
            .select('*')
            .order(own ? 'updated_at' : 'published_at', { ascending: false })
            .limit(50);

          if (popularity) query = query.in('id', [...counts.keys()]);
          if (authorId) query = query.eq('author_id', authorId);
          if (!own) query = query.eq('status', 'published');
          if (own && status) query = query.eq('status', status);
          if (genre.trim()) {
            query = query.ilike('genre', `%${genre.trim().replace(/[%_]/g, '')}%`);
          }

          const result = await query;
          if (result.error) throw result.error;

          let rows = result.data ?? [];
          if (!own && sort === 'popular' && rows.length) {
            rows = [...rows].sort(
              (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)
            );
          }

          if (alive) setWorks(rows);
        } catch (loadError) {
          console.error('Eserler yüklenemedi:', loadError);
          if (alive) setError('Eserler yüklenemedi. Lütfen daha sonra yeniden dene.');
        } finally {
          if (alive) setLoading(false);
        }
      }

      const timer = setTimeout(() => void load(), genre ? 300 : 0);
      return () => {
        alive = false;
        clearTimeout(timer);
      };
    }, [authorId, genre, own, sort, status])
  );

  const heading = own
    ? status === 'draft'
      ? 'Taslaklar'
      : 'Yayındakiler'
    : sort === 'popular'
      ? 'Popüler eserler'
      : 'Yeni çıkan eserler';

  if (loading) {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.stateText}>Eserler hazırlanıyor...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateCard}>
        <Feather name="alert-circle" size={22} color={colors.textMuted} />
        <Text style={styles.stateText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.heading}>{heading}</Text>
          <Text style={styles.headingMeta}>{works.length} eser</Text>
        </View>
        <View style={styles.headingIcon}>
          <Feather
            name={sort === 'popular' && !own ? 'trending-up' : 'book-open'}
            size={17}
            color={colors.primary}
          />
        </View>
      </View>

      {!works.length ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Feather name="book-open" size={24} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Henüz eser yok</Text>
          <Text style={styles.emptyText}>
            {genre.trim()
              ? 'Bu kategoriyle eşleşen yayımlanmış bir eser bulunamadı.'
              : 'Yayımlanan eserler burada görünecek.'}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {works.map((work) => (
            <Pressable
              key={work.id}
              onPress={() =>
                router.push({
                  pathname: own ? '/work-editor' : '/work',
                  params: { id: work.id },
                })
              }
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <BookCover uri={work.cover_url} style={styles.cover} resizeMode="cover">
                <View style={[styles.cover, styles.coverFallback]}>
                  <Feather name="book-open" size={28} color={colors.primary} />
                </View>
              </BookCover>

              <View style={styles.copy}>
                <View style={styles.badgeRow}>
                  {!!work.genre && (
                    <View style={styles.genreBadge}>
                      <Text style={styles.genreText} numberOfLines={1}>{work.genre}</Text>
                    </View>
                  )}
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {work.completed
                        ? 'TAMAMLANDI'
                        : work.status === 'draft'
                          ? 'TASLAK'
                          : 'YAYINDA'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.title} numberOfLines={2}>{work.title}</Text>
                <Text style={styles.description} numberOfLines={2}>
                  {work.description || 'Bu eser için henüz bir açıklama eklenmemiş.'}
                </Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Feather name="globe" size={12} color={colors.textMuted} />
                    <Text style={styles.metaText}>{work.language || 'tr'}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Feather name="book" size={12} color={colors.textMuted} />
                    <Text style={styles.metaText}>
                      {work.completed ? 'Tamamlandı' : 'Devam ediyor'}
                    </Text>
                  </View>
                </View>

                {own ? (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        router.push({ pathname: '/work-editor', params: { id: work.id } });
                      }}
                      style={styles.primaryAction}
                    >
                      <Feather name="edit-3" size={14} color="#FFF" />
                      <Text style={styles.primaryActionText}>Düzenle</Text>
                    </Pressable>
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        router.push({
                          pathname: '/work-editor',
                          params: { id: work.id, addChapter: '1' },
                        });
                      }}
                      style={styles.secondaryAction}
                    >
                      <Feather name="plus" size={14} color={colors.primary} />
                      <Text style={styles.secondaryActionText}>Bölüm</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.readAction}>
                    <Text style={styles.readActionText}>Eseri İncele</Text>
                    <Feather name="arrow-right" size={15} color={colors.primary} />
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 13 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  heading: { color: '#F5F5F7', fontSize: 23, lineHeight: 29, fontWeight: '900' },
  headingMeta: { color: '#777983', fontSize: 10, marginTop: 3 },
  headingIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#382A4C',
    backgroundColor: '#1A1522',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { gap: 11 },
  card: {
    minHeight: 188,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#292A33',
    backgroundColor: '#111218',
    padding: 13,
    flexDirection: 'row',
    gap: 14,
  },
  cardPressed: { opacity: 0.84 },
  cover: {
    width: 104,
    height: 156,
    borderRadius: 12,
    backgroundColor: '#181920',
  },
  coverFallback: {
    borderWidth: 1,
    borderColor: '#302A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, paddingVertical: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 7 },
  genreBadge: {
    maxWidth: 140,
    borderRadius: 999,
    backgroundColor: '#21172F',
    borderWidth: 1,
    borderColor: '#493466',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  genreText: { color: '#CBB6F0', fontSize: 8, fontWeight: '900' },
  statusBadge: {
    borderRadius: 999,
    backgroundColor: '#171820',
    borderWidth: 1,
    borderColor: '#30313A',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { color: '#858791', fontSize: 8, fontWeight: '900' },
  title: { color: '#F5F5F7', fontSize: 18, lineHeight: 23, fontWeight: '900' },
  description: { color: '#90919B', fontSize: 11, lineHeight: 17, marginTop: 5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 9 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#777983', fontSize: 9, fontWeight: '700' },
  readAction: {
    marginTop: 'auto',
    minHeight: 34,
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: '#1A1522',
    borderWidth: 1,
    borderColor: '#3F2E58',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readActionText: { color: '#CBB6F0', fontSize: 9, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 7, marginTop: 'auto' },
  primaryAction: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: '#6232B5',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  primaryActionText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  secondaryAction: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3F2E58',
    backgroundColor: '#1A1522',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  secondaryActionText: { color: '#CBB6F0', fontSize: 9, fontWeight: '900' },
  stateCard: {
    minHeight: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#292A33',
    backgroundColor: '#111218',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    padding: 18,
  },
  stateText: { color: '#858791', fontSize: 11, textAlign: 'center' },
  emptyCard: {
    minHeight: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#292A33',
    backgroundColor: '#111218',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#21172F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: '#EEEEF2', fontSize: 14, fontWeight: '900', marginTop: 10 },
  emptyText: {
    color: '#777983',
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    maxWidth: 360,
    marginTop: 5,
  },
});
