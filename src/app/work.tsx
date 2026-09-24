import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
  Share,
} from 'react-native';

import Image from '@/components/SafeImage';
import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { Chapter, Work } from '@/lib/works';
import { useAuth } from '@/providers/AuthProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

function audienceLabel(value: string) {
  if (value === 'mature') return 'Yetişkin';
  if (value === 'teen') return 'Genç';
  return 'Genel';
}

function wordCount(value: string) {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

export default function WorkReader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [author, setAuthor] = useState('Yazar');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [lastChapterId, setLastChapterId] = useState<string | null>(null);
  const [work, setWork] = useState<Work | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readerCount, setReaderCount] = useState(0);
  const [starCount, setStarCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [starred, setStarred] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [ratingAverage, setRatingAverage] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const [book, parts] = await Promise.all([
          supabase.from('works').select('*').eq('id', id).single(),
          supabase
            .from('work_chapters')
            .select('*')
            .eq('work_id', id)
            .eq('status', 'published')
            .order('position'),
        ]);

        if (book.error || parts.error || !book.data) {
          throw Error('Eser bulunamadı.');
        }

        const activeUserId = userId;
        if (!activeUserId) throw Error('Oturum bulunamadı.');

        await supabase.from('work_views').upsert(
          { work_id: id, user_id: activeUserId, viewed_at: new Date().toISOString() },
          { onConflict: 'work_id,user_id' }
        );

        const [profile, bookmark, progress, readersMetric, starsMetric, viewsMetric, commentsMetric, myStar, ratingsMetric, myRatingResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('username,full_name')
            .eq('id', book.data.author_id)
            .maybeSingle(),
          supabase
            .from('saved_works')
            .select('work_id')
            .eq('work_id', id)
            .eq('user_id', activeUserId)
            .maybeSingle(),
          AsyncStorage.getItem(`work-progress:${activeUserId}:${id}`).catch(() => null),
          supabase.from('work_readers').select('work_id', { count: 'exact', head: true }).eq('work_id', id),
          supabase.from('work_stars').select('work_id', { count: 'exact', head: true }).eq('work_id', id),
          supabase.from('work_views').select('work_id', { count: 'exact', head: true }).eq('work_id', id),
          supabase.from('work_comments').select('id', { count: 'exact', head: true }).eq('work_id', id),
          supabase.from('work_stars').select('work_id').eq('work_id', id).eq('user_id', activeUserId).maybeSingle(),
          supabase.from('work_ratings').select('rating').eq('work_id', id),
          supabase.from('work_ratings').select('rating').eq('work_id', id).eq('user_id', activeUserId).maybeSingle(),
        ]);

        if (!alive) return;

        setAuthor(profile.data?.full_name || profile.data?.username || 'Yazar');
        setSaved(!!bookmark.data);
        setLastChapterId(progress);
        setWork(book.data);
        setChapters(parts.data ?? []);
        setReaderCount(readersMetric.count ?? 0);
        setStarCount(starsMetric.count ?? 0);
        setViewCount(viewsMetric.count ?? 0);
        setCommentCount(commentsMetric.count ?? 0);
        setStarred(!!myStar.data);
        const ratingValues = ratingsMetric.data ?? [];
        setRatingCount(ratingValues.length);
        setRatingAverage(ratingValues.length ? ratingValues.reduce((sum, item) => sum + item.rating, 0) / ratingValues.length : null);
        setMyRating(myRatingResult.data?.rating ?? null);
      } catch (loadError) {
        console.error('Eser görüntüleme hatası:', loadError);
        if (alive) setError('Eser bulunamadı veya okumak için yetkin yok.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [id, userId]);

  useEffect(() => {
    if (!userId || selected === null || !chapters[selected]) return;
    const chapterId = chapters[selected].id;
    void supabase.from('work_readers').upsert(
      { work_id: id, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: 'work_id,user_id' }
    ).then(({ error: readerError }) => {
      if (!readerError) setReaderCount((current) => Math.max(1, current));
    });
    void AsyncStorage
      .setItem(`work-progress:${userId}:${id}`, chapterId)
      .then(() => setLastChapterId(chapterId))
      .catch(() => undefined);
  }, [chapters, id, selected, userId]);

  async function toggleSaved() {
    if (!userId || saving) return;
    setSaving(true);
    setSaveError('');

    try {
      const result = saved
        ? await supabase.from('saved_works').delete().eq('user_id', userId).eq('work_id', id)
        : await supabase.from('saved_works').insert({ user_id: userId, work_id: id });

      if (result.error) throw result.error;
      setSaved((current) => !current);
    } catch (saveFailure) {
      console.error('Eser kaydetme hatası:', saveFailure);
      setSaveError('Kaydetme işlemi tamamlanamadı. Tekrar deneyebilirsin.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStar() {
    if (!userId) return;
    const next = !starred;
    setStarred(next);
    setStarCount((current) => Math.max(0, current + (next ? 1 : -1)));
    const result = next
      ? await supabase.from('work_stars').insert({ work_id: id, user_id: userId })
      : await supabase.from('work_stars').delete().eq('work_id', id).eq('user_id', userId);
    if (result.error) {
      setStarred(!next);
      setStarCount((current) => Math.max(0, current + (next ? -1 : 1)));
    }
  }

  async function shareWork() {
    if (!work) return;
    await Share.share({
      title: work.title,
      message: `${work.title} — ${author}\nBu eseri Kitap uygulamasında keşfet.`,
    });
  }

  async function rateWork(rating: number) {
    if (!userId) return;
    const previous = myRating;
    const { error: ratingError } = await supabase.from('work_ratings').upsert(
      { work_id: id, user_id: userId, rating, updated_at: new Date().toISOString() },
      { onConflict: 'work_id,user_id' }
    );
    if (ratingError) return;
    setMyRating(rating);
    setRatingOpen(false);
    const { data } = await supabase.from('work_ratings').select('rating').eq('work_id', id);
    const values = data ?? [];
    setRatingCount(values.length);
    setRatingAverage(values.length ? values.reduce((sum, item) => sum + item.rating, 0) / values.length : null);
    if (previous === null && values.length === 0) setRatingCount(1);
  }

  const continueIndex = useMemo(
    () => chapters.findIndex((part) => part.id === lastChapterId),
    [chapters, lastChapterId]
  );

  const chapter = selected === null ? null : chapters[selected];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Eser hazırlanıyor...</Text>
      </View>
    );
  }

  if (!work || error) {
    return (
      <View style={styles.center}>
        <Feather name="book-open" size={28} color={colors.textMuted} />
        <Text style={styles.errorTitle}>{error || 'Eser bulunamadı.'}</Text>
        <Pressable onPress={() => safeBack(router, '/my-works')} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Geri Dön</Text>
        </Pressable>
      </View>
    );
  }

  if (chapter) {
    return (
      <View style={styles.screen}>
        <View style={styles.readerHeader}>
          <Pressable onPress={() => setSelected(null)} style={styles.iconButton}>
            <Feather name="chevron-left" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.readerHeaderCopy}>
            <Text style={styles.readerEyebrow}>BÖLÜM {chapter.position}</Text>
            <Text style={styles.readerHeaderTitle} numberOfLines={1}>{chapter.title}</Text>
          </View>
          <Text style={styles.readerCounter}>{(selected ?? 0) + 1}/{chapters.length}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.readerContent}>
          <Text style={styles.chapterTitle}>{chapter.title}</Text>
          <Text style={styles.chapterMeta}>{wordCount(chapter.content)} kelime</Text>
          <Text selectable style={styles.chapterText}>{chapter.content}</Text>

          <View style={styles.readerNav}>
            <Pressable
              disabled={selected === 0}
              onPress={() => setSelected((current) => Math.max(0, (current ?? 0) - 1))}
              style={[styles.readerNavButton, selected === 0 && styles.disabled]}
            >
              <Feather name="arrow-left" size={16} color={colors.textSecondary} />
              <Text style={styles.readerNavText}>Önceki</Text>
            </Pressable>

            <Pressable onPress={() => setSelected(null)} style={styles.chapterListButton}>
              <Feather name="list" size={16} color={colors.primary} />
              <Text style={styles.chapterListButtonText}>Bölümler</Text>
            </Pressable>

            <Pressable
              disabled={selected === chapters.length - 1}
              onPress={() => setSelected((current) => Math.min(chapters.length - 1, (current ?? 0) + 1))}
              style={[styles.readerNavButton, selected === chapters.length - 1 && styles.disabled]}
            >
              <Text style={styles.readerNavText}>Sonraki</Text>
              <Feather name="arrow-right" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => safeBack(router, '/my-works')} style={styles.iconButton}>
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.topBarTitle}>Eser</Text>
        <Pressable
          onPress={() => void toggleSaved()}
          disabled={saving}
          style={[styles.iconButton, saved && styles.savedIconButton]}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Kaydedilenlerden kaldır' : 'Eseri kaydet'}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name={saved ? 'bookmark' : 'bookmark'} size={19} color={saved ? colors.primary : colors.textSecondary} />
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.coverWrap}>
            {work.cover_url ? (
              <Image source={{ uri: work.cover_url }} resizeMode="cover" style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverFallback]}>
                <Feather name="book-open" size={34} color={colors.primary} />
              </View>
            )}
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.genreLabel}>{work.genre || 'Eser'}</Text>
            <Text style={styles.title}>{work.title}</Text>
            <Pressable
              onPress={() => router.push({ pathname: '/profile', params: { userId: work.author_id } })}
              style={styles.authorRow}
            >
              <View style={styles.authorAvatar}>
                <Text style={styles.authorInitial}>{author.charAt(0).toLocaleUpperCase('tr-TR')}</Text>
              </View>
              <View style={styles.authorCopy}>
                <Text style={styles.authorLabel}>Yazar</Text>
                <Text style={styles.authorName}>{author}</Text>
              </View>
              <Feather name="chevron-right" size={17} color={colors.textMuted} />
            </Pressable>

            <View style={styles.metaWrap}>
              <Text style={styles.metaPill}>{chapters.length} bölüm</Text>
              <Text style={styles.metaPill}>{work.language?.toUpperCase() || 'TR'}</Text>
              <Text style={styles.metaPill}>{work.completed ? 'Tamamlandı' : 'Devam ediyor'}</Text>
              <Text style={styles.metaPill}>{audienceLabel(work.audience)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.metricsBar}>
          <View style={styles.metricItem}>
            <Feather name="book-open" size={20} color={colors.textSecondary} />
            <Text style={styles.metricValue}>{readerCount.toLocaleString('tr-TR')}</Text>
          </View>
          <Pressable onPress={() => void toggleStar()} style={styles.metricItem}>
            <Feather name="star" size={21} color={starred ? colors.primary : colors.textSecondary} />
            <Text style={[styles.metricValue, starred && { color: colors.primary }]}>{starCount.toLocaleString('tr-TR')}</Text>
          </Pressable>
          <View style={styles.metricItem}>
            <Feather name="eye" size={21} color={colors.textSecondary} />
            <Text style={styles.metricValue}>{viewCount.toLocaleString('tr-TR')}</Text>
          </View>
          <View style={styles.metricItem}>
            <Feather name="message-circle" size={21} color={colors.textSecondary} />
            <Text style={styles.metricValue}>{commentCount.toLocaleString('tr-TR')}</Text>
          </View>
        </View>

        <View style={styles.workActions}>
          <Pressable onPress={() => void shareWork()} style={styles.workActionButton}>
            <Feather name="send" size={17} color={colors.textPrimary} />
            <Text style={styles.workActionText}>Paylaş</Text>
          </Pressable>
          <Pressable onPress={() => setRatingOpen(true)} style={[styles.workActionButton, myRating !== null && styles.workActionActive]}>
            <Feather name="star" size={18} color={myRating !== null ? colors.primary : colors.textPrimary} />
            <Text style={[styles.workActionText, myRating !== null && { color: colors.primary }]}>
              {myRating !== null ? `Puanın: ${myRating}` : 'Puan Ver'}
            </Text>
          </Pressable>
        </View>
        {ratingAverage !== null && (
          <Text style={styles.ratingSummary}>Ortalama {ratingAverage.toFixed(1)} / 5 · {ratingCount} değerlendirme</Text>
        )}

        <View style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Okumaya hazır mısın?</Text>
          <Text style={styles.ctaDescription}>
            {chapters.length
              ? continueIndex >= 0
                ? 'Kaldığın yerden devam edebilir veya kitabı baştan okuyabilirsin.'
                : 'İlk bölümden başlayabilir veya eseri daha sonra okumak için kaydedebilirsin.'
              : 'Bu eser için henüz yayınlanmış bölüm bulunmuyor.'}
          </Text>

          <View style={styles.ctaActions}>
            {continueIndex >= 0 ? (
              <Pressable onPress={() => setSelected(continueIndex)} style={styles.primaryCta}>
                <Feather name="play" size={17} color="#FFF" />
                <Text style={styles.primaryCtaText}>Kaldığın Yerden Devam Et</Text>
              </Pressable>
            ) : (
              <Pressable
                disabled={!chapters.length}
                onPress={() => setSelected(0)}
                style={[styles.primaryCta, !chapters.length && styles.disabled]}
              >
                <Feather name="play" size={17} color="#FFF" />
                <Text style={styles.primaryCtaText}>Okumaya Başla</Text>
              </Pressable>
            )}

            {continueIndex >= 0 && (
              <Pressable onPress={() => setSelected(0)} style={styles.secondaryCta}>
                <Feather name="rotate-ccw" size={16} color={colors.primary} />
                <Text style={styles.secondaryCtaText}>Baştan Oku</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => void toggleSaved()}
              disabled={saving}
              style={[styles.secondaryCta, saved && styles.secondaryCtaActive]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="bookmark" size={16} color={colors.primary} />
              )}
              <Text style={styles.secondaryCtaText}>
                {saved ? 'Kaydedildi' : 'Eseri Kaydet'}
              </Text>
            </Pressable>
          </View>

          {!!saveError && <Text style={styles.saveError}>{saveError}</Text>}
        </View>

        {!!work.description && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Eser Hakkında</Text>
            <Text style={styles.description}>{work.description}</Text>
          </View>
        )}

        {!!work.tags?.length && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Etiketler</Text>
            <View style={styles.tagWrap}>
              {work.tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Bölümler</Text>
              <Text style={styles.sectionSubtitle}>{chapters.length} yayınlanmış bölüm</Text>
            </View>
          </View>

          {chapters.length === 0 ? (
            <View style={styles.emptyChapters}>
              <Feather name="file-text" size={24} color={colors.textMuted} />
              <Text style={styles.emptyChaptersTitle}>Henüz yayınlanmış bölüm yok</Text>
              <Text style={styles.emptyChaptersText}>Yazar yeni bölümler yayınladığında burada görünecek.</Text>
            </View>
          ) : (
            <View style={styles.chapterList}>
              {chapters.map((part, index) => {
                const isProgress = part.id === lastChapterId;
                return (
                  <Pressable key={part.id} onPress={() => setSelected(index)} style={styles.chapterCard}>
                    <View style={styles.chapterNumber}>
                      <Text style={styles.chapterNumberText}>{part.position}</Text>
                    </View>
                    <View style={styles.chapterCopy}>
                      <Text style={styles.chapterCardTitle} numberOfLines={1}>{part.title}</Text>
                      <Text style={styles.chapterCardMeta}>
                        {wordCount(part.content)} kelime{isProgress ? ' · Kaldığın bölüm' : ''}
                      </Text>
                    </View>
                    {isProgress ? (
                      <View style={styles.progressBadge}>
                        <Text style={styles.progressBadgeText}>DEVAM</Text>
                      </View>
                    ) : (
                      <Feather name="chevron-right" size={18} color={colors.textMuted} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
      <Modal visible={ratingOpen} transparent animationType="fade" onRequestClose={() => setRatingOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setRatingOpen(false)}>
          <Pressable style={styles.ratingModal} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.ratingModalEyebrow}>ESERİ DEĞERLENDİR</Text>
            <Text style={styles.ratingModalTitle}>Kaç yıldız verirsin?</Text>
            <Text style={styles.ratingModalSubtitle}>{work.title}</Text>
            <View style={styles.ratingStars}>
              {[1,2,3,4,5].map((value) => (
                <Pressable key={value} onPress={() => void rateWork(value)} style={styles.ratingStarButton}>
                  <Feather name="star" size={30} color={myRating !== null && value <= myRating ? colors.primary : colors.textMuted} />
                  <Text style={styles.ratingStarLabel}>{value}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setRatingOpen(false)} style={styles.ratingCancel}>
              <Text style={styles.ratingCancelText}>Vazgeç</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#08090D', padding: 24 },
  loadingText: { color: '#858791', fontSize: 12, marginTop: 10 },
  errorTitle: { color: '#F1F1F4', fontSize: 15, fontWeight: '800', marginTop: 10, textAlign: 'center' },

  topBar: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#20212A', backgroundColor: '#0B0C11' },
  topBarTitle: { flex: 1, textAlign: 'center', color: '#F4F4F6', fontSize: 15, fontWeight: '900' },
  iconButton: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#292A33', backgroundColor: '#15161D' },
  savedIconButton: { borderColor: '#5A4380', backgroundColor: '#21172F' },

  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, paddingBottom: 70, gap: 14 },
  hero: { flexDirection: 'row', gap: 18, borderRadius: 22, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 16 },
  coverWrap: { width: 150 },
  cover: { width: 150, height: 215, borderRadius: 14, backgroundColor: '#171820' },
  coverFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#343540' },
  heroCopy: { flex: 1, minWidth: 0 },
  genreLabel: { color: '#A985FF', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: '#F6F6F8', fontSize: 26, lineHeight: 33, fontWeight: '900', marginTop: 5 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14, paddingVertical: 8 },
  authorAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#21172F', alignItems: 'center', justifyContent: 'center' },
  authorInitial: { color: '#D8C8FF', fontSize: 13, fontWeight: '900' },
  authorCopy: { flex: 1 },
  authorLabel: { color: '#70727C', fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  authorName: { color: '#E5E5EA', fontSize: 11, fontWeight: '800', marginTop: 2 },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  metaPill: { color: '#AAA0BE', fontSize: 9, borderRadius: 999, backgroundColor: '#19151F', borderWidth: 1, borderColor: '#332842', paddingHorizontal: 8, paddingVertical: 5 },

  metricsBar: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  metricItem: { minHeight: 44, minWidth: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8 },
  metricValue: { color: '#B6B7C0', fontSize: 14, fontWeight: '800' },
  workActions: { flexDirection: 'row', gap: 10 },
  workActionButton: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#3A3B45', backgroundColor: '#111218', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  workActionActive: { borderColor: '#5D4584', backgroundColor: '#191321' },
  workActionText: { color: '#E9E9ED', fontSize: 11, fontWeight: '900' },
  ratingSummary: { color: '#777983', fontSize: 9, textAlign: 'center', marginTop: -5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  ratingModal: { width: '100%', maxWidth: 430, borderRadius: 24, borderWidth: 1, borderColor: '#34313E', backgroundColor: '#15151A', padding: 22 },
  ratingModalEyebrow: { color: '#9B7AD3', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  ratingModalTitle: { color: '#F5F5F7', fontSize: 21, fontWeight: '900', marginTop: 7 },
  ratingModalSubtitle: { color: '#858791', fontSize: 11, marginTop: 4 },
  ratingStars: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  ratingStarButton: { alignItems: 'center', gap: 5, padding: 5 },
  ratingStarLabel: { color: '#777983', fontSize: 9, fontWeight: '800' },
  ratingCancel: { minHeight: 44, borderRadius: 12, backgroundColor: '#222329', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  ratingCancelText: { color: '#D7D7DD', fontSize: 11, fontWeight: '900' },
  ctaCard: { borderRadius: 20, borderWidth: 1, borderColor: '#3A2A54', backgroundColor: '#121018', padding: 16 },
  ctaTitle: { color: '#F4F4F6', fontSize: 17, fontWeight: '900' },
  ctaDescription: { color: '#858791', fontSize: 11, lineHeight: 17, marginTop: 5 },
  ctaActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  primaryCta: { minHeight: 44, borderRadius: 12, backgroundColor: '#6232B5', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryCtaText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  secondaryCta: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#43305F', backgroundColor: '#1A1522', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryCtaActive: { borderColor: '#5D4584', backgroundColor: '#21172F' },
  secondaryCtaText: { color: '#CBB6F0', fontSize: 10, fontWeight: '900' },
  saveError: { color: '#FF9BA7', fontSize: 10, marginTop: 9 },

  sectionCard: { borderRadius: 18, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 15 },
  sectionTitle: { color: '#F1F1F4', fontSize: 15, fontWeight: '900' },
  sectionSubtitle: { color: '#71737D', fontSize: 9, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  description: { color: '#BFC0C8', fontSize: 13, lineHeight: 21, marginTop: 10 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  tagChip: { borderRadius: 999, borderWidth: 1, borderColor: '#3A2A54', backgroundColor: '#1B1525', paddingHorizontal: 9, paddingVertical: 6 },
  tagText: { color: '#BFA7EA', fontSize: 9, fontWeight: '800' },

  emptyChapters: { minHeight: 150, alignItems: 'center', justifyContent: 'center', padding: 16 },
  emptyChaptersTitle: { color: '#E8E8EC', fontSize: 12, fontWeight: '900', marginTop: 9 },
  emptyChaptersText: { color: '#747680', fontSize: 9, textAlign: 'center', marginTop: 4 },
  chapterList: { gap: 8, marginTop: 10 },
  chapterCard: { minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#171820', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chapterNumber: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#21172F', alignItems: 'center', justifyContent: 'center' },
  chapterNumberText: { color: '#CDB8F6', fontSize: 12, fontWeight: '900' },
  chapterCopy: { flex: 1, minWidth: 0 },
  chapterCardTitle: { color: '#EEEEF1', fontSize: 12, fontWeight: '900' },
  chapterCardMeta: { color: '#747680', fontSize: 9, marginTop: 4 },
  progressBadge: { borderRadius: 999, borderWidth: 1, borderColor: '#5D4584', backgroundColor: '#21172F', paddingHorizontal: 8, paddingVertical: 5 },
  progressBadgeText: { color: '#CDB8F6', fontSize: 8, fontWeight: '900' },

  readerHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#20212A', backgroundColor: '#0B0C11' },
  readerHeaderCopy: { flex: 1, minWidth: 0, marginHorizontal: 11 },
  readerEyebrow: { color: '#8C70BC', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  readerHeaderTitle: { color: '#F3F3F6', fontSize: 13, fontWeight: '900', marginTop: 2 },
  readerCounter: { color: '#777983', fontSize: 10, fontWeight: '800' },
  readerContent: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 22, paddingBottom: 80 },
  chapterTitle: { color: '#F5F5F7', fontSize: 28, lineHeight: 36, fontWeight: '900' },
  chapterMeta: { color: '#747680', fontSize: 9, marginTop: 7, marginBottom: 24 },
  chapterText: { color: '#D7D7DD', fontSize: 18, lineHeight: 31 },
  readerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 34, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#252630' },
  readerNavButton: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#15161D', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  readerNavText: { color: '#A5A6AF', fontSize: 9, fontWeight: '800' },
  chapterListButton: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#43305F', backgroundColor: '#1A1522', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chapterListButtonText: { color: '#CBB6F0', fontSize: 9, fontWeight: '900' },

  primaryButton: { marginTop: 16, minHeight: 42, borderRadius: 11, backgroundColor: '#6232B5', paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
