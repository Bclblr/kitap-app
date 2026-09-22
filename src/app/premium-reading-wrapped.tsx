import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import PremiumBadge from '@/components/PremiumBadge';
import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { usePremium } from '@/providers/PremiumProvider';
import { useAppTheme } from '@/providers/ThemeProvider';

type MonthlyPoint = {
  month: number;
  pages: number | string | null;
  active_days: number | string | null;
};

type YearReport = {
  report_year: number;
  total_pages: number | string | null;
  active_days: number | string | null;
  books_completed: number | string | null;
  goal_hit_days: number | string | null;
  best_day: string | null;
  best_day_pages: number | null;
  best_month: number | null;
  best_month_pages: number | string | null;
  average_pages_active_day: number | string | null;
  monthly_series: MonthlyPoint[] | null;
};

type WrappedTemplate = 'midnight' | 'editorial' | 'violet';

const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'] as const;

const TEMPLATE_LABELS: Record<WrappedTemplate, string> = {
  midnight: 'Gece',
  editorial: 'Editoryal',
  violet: 'Mor Işık',
};

const TEMPLATE_PALETTES: Record<WrappedTemplate, {
  background: string;
  surface: string;
  text: string;
  secondary: string;
  accent: string;
  soft: string;
  border: string;
}> = {
  midnight: {
    background: '#08090D',
    surface: '#111218',
    text: '#F7F7F9',
    secondary: '#9B9CA6',
    accent: '#9B72F2',
    soft: '#241B35',
    border: '#2A2B34',
  },
  editorial: {
    background: '#F0ECE6',
    surface: '#E5DED5',
    text: '#17161A',
    secondary: '#6A6460',
    accent: '#6F4BB8',
    soft: '#D8CDEC',
    border: '#CCC3B9',
  },
  violet: {
    background: '#140D20',
    surface: '#21142F',
    text: '#FFF9FF',
    secondary: '#CAB9D8',
    accent: '#C49BFF',
    soft: '#38204E',
    border: '#56386B',
  },
};

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBestDay(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

export default function PremiumReadingWrappedScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const premium = usePremium();
  const storyRef = useRef<View>(null);

  const [report, setReport] = useState<YearReport | null>(null);
  const [username, setUsername] = useState('Kitap Okuru');
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [template, setTemplate] = useState<WrappedTemplate>('midnight');

  const load = useCallback(async () => {
    if (!premium.ready || !premium.isPremium) return;

    try {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return;

      const [{ data, error }, profileResult] = await Promise.all([
        supabase.rpc('get_premium_year_report').single(),
        supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle(),
      ]);

      if (error) throw error;

      setReport(data as YearReport);
      setUsername(profileResult.data?.username?.trim() || 'Kitap Okuru');
    } catch (error) {
      console.error('Reading Wrapped yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  }, [premium.isPremium, premium.ready]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const monthly = useMemo(
    () => (Array.isArray(report?.monthly_series) ? report!.monthly_series : []),
    [report?.monthly_series]
  );

  const maxMonth = Math.max(1, ...monthly.map((item) => asNumber(item.pages)));
  const totalPages = asNumber(report?.total_pages);
  const activeDays = asNumber(report?.active_days);
  const completed = asNumber(report?.books_completed);
  const average = asNumber(report?.average_pages_active_day);
  const bestMonthLabel = report?.best_month && report.best_month >= 1 && report.best_month <= 12
    ? MONTHS[report.best_month - 1]
    : '—';
  const palette = TEMPLATE_PALETTES[template];

  async function shareTextFallback() {
    if (!report) return;

    await Share.share({
      message:
        `${report.report_year} Reading Wrapped 📚\n\n` +
        `• ${completed} kitap tamamladım\n` +
        `• ${totalPages} sayfa okudum\n` +
        `• ${activeDays} gün aktif okudum\n` +
        `• Aktif gün ortalamam ${average.toFixed(1)} sayfa\n` +
        `• En güçlü ayım ${bestMonthLabel}\n\nKitap`,
    });
  }

  async function shareWrappedStory() {
    if (!report || sharing || !storyRef.current) return;

    setSharing(true);

    try {
      if (Platform.OS === 'web') {
        await shareTextFallback();
        return;
      }

      const uri = await captureRef(storyRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: 1080,
        height: 1920,
      });

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        await shareTextFallback();
        return;
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: 'Reading Wrapped hikâyeni paylaş',
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch (error) {
      console.warn('Reading Wrapped görsel paylaşım hatası:', error);
      await shareTextFallback();
    } finally {
      setSharing(false);
    }
  }

  if (premium.ready && !premium.isPremium) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Feather name="lock" size={28} color={colors.primary} />
          <Text style={[styles.lockedTitle, { color: colors.text }]}>Reading Wrapped Premium’a özel</Text>
          <Text style={[styles.lockedBody, { color: colors.textSecondary }]}>Yıllık okuma hikâyeni ve paylaşılabilir özetini Premium ile açabilirsin.</Text>
          <Pressable onPress={() => router.replace('/premium')} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.primaryButtonText}>Premium’u İncele</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => safeBack(router, '/premium')} style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Feather name="chevron-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Reading Wrapped</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading && !report ? (
          <View style={styles.loadingBox}><ActivityIndicator color={colors.primary} /></View>
        ) : report ? (
          <>
            <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>PREMIUM · {report.report_year}</Text>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Bu yılın okuma hikâyesi</Text>
              <Text style={[styles.heroBody, { color: colors.textSecondary }]}>Yıl boyunca kaydettiğin ilerlemelerden oluşturuldu.</Text>
            </View>

            <View style={styles.metricGrid}>
              <Metric value={String(completed)} label="Tamamlanan kitap" icon="book-open" />
              <Metric value={String(totalPages)} label="Toplam sayfa" icon="layers" />
              <Metric value={String(activeDays)} label="Aktif okuma günü" icon="calendar" />
              <Metric value={average.toFixed(1)} label="Aktif gün ort." icon="activity" />
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Ay ay okuma</Text>
              <View style={styles.chart}>
                {monthly.map((item) => {
                  const pages = asNumber(item.pages);
                  const height = pages ? Math.max(8, Math.round((pages / maxMonth) * 96)) : 4;
                  return (
                    <View key={item.month} style={styles.barColumn}>
                      <View style={[styles.bar, { height, backgroundColor: pages ? colors.primary : colors.border }]} />
                      <Text style={[styles.barLabel, { color: colors.textMuted }]}>{MONTHS[item.month - 1]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Öne çıkanlar</Text>
              <Highlight icon="award" title="En güçlü ay" value={`${bestMonthLabel} · ${asNumber(report.best_month_pages)} sayfa`} />
              <Highlight icon="zap" title="En güçlü gün" value={report.best_day ? `${formatBestDay(report.best_day)} · ${report.best_day_pages ?? 0} sayfa` : 'Henüz veri yok'} />
              <Highlight icon="target" title="Hedef tutturulan gün" value={`${asNumber(report.goal_hit_days)} gün`} />
            </View>

            <View style={[styles.shareSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.shareSectionHeader}>
                <View style={styles.shareSectionCopy}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Hikâye Tasarımı</Text>
                  <Text style={[styles.shareSectionBody, { color: colors.textSecondary }]}>9:16 formatındaki Wrapped kartını seçtiğin tasarımla Instagram, WhatsApp ve diğer uygulamalarda paylaş.</Text>
                </View>
                <PremiumBadge size={26} />
              </View>

              <View style={styles.templateRow}>
                {(Object.keys(TEMPLATE_LABELS) as WrappedTemplate[]).map((key) => {
                  const active = template === key;
                  const itemPalette = TEMPLATE_PALETTES[key];

                  return (
                    <Pressable
                      key={key}
                      onPress={() => setTemplate(key)}
                      style={[
                        styles.templateButton,
                        {
                          backgroundColor: itemPalette.background,
                          borderColor: active ? colors.primary : colors.border,
                          borderWidth: active ? 2 : 1,
                        },
                      ]}
                    >
                      <View style={[styles.templateDot, { backgroundColor: itemPalette.accent }]} />
                      <Text style={[styles.templateLabel, { color: itemPalette.text }]}>{TEMPLATE_LABELS[key]}</Text>
                      {active ? <Feather name="check" size={15} color={itemPalette.accent} /> : null}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.storyPreviewShell}>
                <View
                  ref={storyRef}
                  collapsable={false}
                  style={[styles.storyCard, { backgroundColor: palette.background }]}
                >
                  <View style={[styles.storyGlowOne, { backgroundColor: palette.soft }]} />
                  <View style={[styles.storyGlowTwo, { backgroundColor: palette.accent }]} />

                  <View style={styles.storyTopRow}>
                    <View>
                      <Text style={[styles.storyBrand, { color: palette.accent }]}>KİTAP · WRAPPED</Text>
                      <Text style={[styles.storyYear, { color: palette.text }]}>{report.report_year}</Text>
                    </View>
                    <View style={[styles.storyPremiumBadge, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                      <Feather name="star" size={12} color={palette.accent} />
                      <Text style={[styles.storyPremiumText, { color: palette.secondary }]}>PREMIUM</Text>
                    </View>
                  </View>

                  <View style={styles.storyHeroCopy}>
                    <Text style={[styles.storyKicker, { color: palette.secondary }]}>YILIN OKUMA HİKÂYESİ</Text>
                    <Text style={[styles.storyHeadline, { color: palette.text }]}>
                      {completed > 0 ? `${completed} kitaplık bir yıl.` : 'Okuma yolculuğum.'}
                    </Text>
                    <Text style={[styles.storySubheadline, { color: palette.secondary }]}>
                      {username}
                    </Text>
                  </View>

                  <View style={styles.storyMetricGrid}>
                    <StoryMetric label="KİTAP" value={String(completed)} />
                    <StoryMetric label="SAYFA" value={String(totalPages)} />
                    <StoryMetric label="AKTİF GÜN" value={String(activeDays)} />
                    <StoryMetric label="GÜNLÜK ORT." value={average.toFixed(1)} />
                  </View>

                  <View style={[styles.storyHighlightBox, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                    <View style={styles.storyHighlightRow}>
                      <Text style={[styles.storyHighlightLabel, { color: palette.secondary }]}>En güçlü ay</Text>
                      <Text style={[styles.storyHighlightValue, { color: palette.text }]}>{bestMonthLabel}</Text>
                    </View>
                    <View style={[styles.storyDivider, { backgroundColor: palette.border }]} />
                    <View style={styles.storyHighlightRow}>
                      <Text style={[styles.storyHighlightLabel, { color: palette.secondary }]}>En güçlü gün</Text>
                      <Text style={[styles.storyHighlightValue, { color: palette.text }]}>
                        {report.best_day ? formatBestDay(report.best_day) : '—'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.storyChart}>
                    {monthly.map((item) => {
                      const pages = asNumber(item.pages);
                      const height = pages ? Math.max(5, Math.round((pages / maxMonth) * 54)) : 3;
                      return (
                        <View key={item.month} style={styles.storyBarColumn}>
                          <View style={[styles.storyBar, { height, backgroundColor: pages ? palette.accent : palette.border }]} />
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.storyFooter}>
                    <Text style={[styles.storyFooterText, { color: palette.secondary }]}>Okuma yolculuğum · Kitap</Text>
                    <View style={[styles.storyFooterMark, { backgroundColor: palette.accent }]} />
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => void shareWrappedStory()}
                disabled={sharing}
                style={[styles.shareButton, { backgroundColor: colors.primary, opacity: sharing ? 0.65 : 1 }]}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Feather name="share-2" size={18} color={colors.onPrimary} />
                )}
                <Text style={[styles.shareButtonText, { color: colors.onPrimary }]}>
                  {sharing ? 'Görsel hazırlanıyor…' : 'Hikâyede Paylaş'}
                </Text>
              </Pressable>

              <Text style={[styles.shareHint, { color: colors.textMuted }]}>Paylaşım ekranından Instagram Hikâyeler, WhatsApp Durum veya istediğin başka uygulamayı seçebilirsin.</Text>
            </View>
          </>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Wrapped oluşturmak için henüz yeterli okuma verisi yok.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  function Metric({ value, label, icon }: { value: string; label: string; icon: keyof typeof Feather.glyphMap }) {
    return (
      <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name={icon} size={18} color={colors.primary} />
        <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    );
  }

  function Highlight({ icon, title, value }: { icon: keyof typeof Feather.glyphMap; title: string; value: string }) {
    return (
      <View style={[styles.highlightRow, { borderTopColor: colors.divider }]}>
        <View style={[styles.highlightIcon, { backgroundColor: colors.primarySoft }]}><Feather name={icon} size={17} color={colors.primary} /></View>
        <View style={styles.highlightText}>
          <Text style={[styles.highlightTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.highlightValue, { color: colors.textSecondary }]}>{value}</Text>
        </View>
      </View>
    );
  }

  function StoryMetric({ label, value }: { label: string; value: string }) {
    return (
      <View style={[styles.storyMetric, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.storyMetricValue, { color: palette.text }]}>{value}</Text>
        <Text style={[styles.storyMetricLabel, { color: palette.secondary }]}>{label}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 64 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 12 },
  lockedTitle: { fontSize: 21, fontWeight: '900', textAlign: 'center' },
  lockedBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '800' },
  headerSpacer: { width: 42 },
  loadingBox: { paddingVertical: 72, alignItems: 'center' },
  hero: { borderWidth: 1, borderRadius: 24, padding: 20, gap: 8 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { fontSize: 28, lineHeight: 34, fontWeight: '900' },
  heroBody: { fontSize: 13, lineHeight: 19 },
  metricGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 18, padding: 14, minHeight: 116, gap: 6 },
  metricValue: { fontSize: 23, fontWeight: '900' },
  metricLabel: { fontSize: 11.5, lineHeight: 16 },
  card: { marginTop: 14, borderWidth: 1, borderRadius: 20, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '900', marginBottom: 12 },
  chart: { height: 128, flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  barColumn: { flex: 1, height: 124, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '72%', minWidth: 10, borderRadius: 6 },
  barLabel: { fontSize: 8.5, marginTop: 6 },
  highlightRow: { flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  highlightIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  highlightText: { flex: 1 },
  highlightTitle: { fontSize: 13, fontWeight: '800' },
  highlightValue: { fontSize: 12, marginTop: 3 },
  shareSection: { marginTop: 16, borderWidth: 1, borderRadius: 22, padding: 16 },
  shareSectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  shareSectionCopy: { flex: 1 },
  shareSectionBody: { fontSize: 12, lineHeight: 18, marginTop: -5 },
  templateRow: { flexDirection: 'row', gap: 8, marginTop: 15 },
  templateButton: { flex: 1, minHeight: 48, borderRadius: 14, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  templateDot: { width: 8, height: 8, borderRadius: 4 },
  templateLabel: { fontSize: 11, fontWeight: '900' },
  storyPreviewShell: { marginTop: 16, alignItems: 'center' },
  storyCard: { width: 320, height: 569, borderRadius: 26, padding: 22, overflow: 'hidden', position: 'relative' },
  storyGlowOne: { position: 'absolute', width: 230, height: 230, borderRadius: 115, top: -95, right: -95, opacity: 0.5 },
  storyGlowTwo: { position: 'absolute', width: 170, height: 170, borderRadius: 85, bottom: -75, left: -70, opacity: 0.12 },
  storyTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  storyBrand: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.5 },
  storyYear: { fontSize: 24, lineHeight: 28, fontWeight: '900', marginTop: 2 },
  storyPremiumBadge: { minHeight: 27, borderRadius: 13.5, borderWidth: 1, paddingHorizontal: 9, flexDirection: 'row', gap: 5, alignItems: 'center' },
  storyPremiumText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  storyHeroCopy: { marginTop: 32 },
  storyKicker: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  storyHeadline: { fontSize: 31, lineHeight: 36, fontWeight: '900', letterSpacing: -0.8, marginTop: 7, maxWidth: 255 },
  storySubheadline: { fontSize: 12, fontWeight: '700', marginTop: 9 },
  storyMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 27 },
  storyMetric: { width: '48%', minHeight: 69, borderWidth: 1, borderRadius: 15, paddingHorizontal: 12, justifyContent: 'center' },
  storyMetricValue: { fontSize: 21, fontWeight: '900' },
  storyMetricLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 3 },
  storyHighlightBox: { marginTop: 14, borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 8 },
  storyHighlightRow: { minHeight: 33, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  storyHighlightLabel: { fontSize: 9.5, fontWeight: '700' },
  storyHighlightValue: { fontSize: 10.5, fontWeight: '900', textAlign: 'right', flexShrink: 1 },
  storyDivider: { height: StyleSheet.hairlineWidth },
  storyChart: { height: 59, flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 15 },
  storyBarColumn: { flex: 1, height: 58, justifyContent: 'flex-end' },
  storyBar: { width: '100%', borderRadius: 3 },
  storyFooter: { marginTop: 'auto', paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storyFooterText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.7 },
  storyFooterMark: { width: 22, height: 4, borderRadius: 2 },
  shareButton: { marginTop: 16, minHeight: 52, borderRadius: 16, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  shareButtonText: { fontSize: 14, fontWeight: '900' },
  shareHint: { fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: 9, paddingHorizontal: 8 },
  primaryButton: { minHeight: 48, borderRadius: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  emptyText: { textAlign: 'center', lineHeight: 20 },
});
