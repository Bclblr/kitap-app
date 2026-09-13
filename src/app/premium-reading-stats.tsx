import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { usePremium } from '@/providers/PremiumProvider';
import { useAppTheme } from '@/providers/ThemeProvider';

type DailyPoint = {
  date: string;
  pages: number;
};

type PremiumReadingStats = {
  period_start: string;
  period_end: string;
  total_pages_30d: number | string | null;
  active_days_30d: number | string | null;
  average_pages_active_day: number | string | null;
  best_day_pages: number | null;
  best_day: string | null;
  goal_hit_days: number | string | null;
  pages_last_7d: number | string | null;
  pages_previous_7d: number | string | null;
  current_streak: number | null;
  daily_page_goal: number | null;
  daily_series: DailyPoint[] | null;
};

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function getTrendLabel(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? `Bu hafta ${current} sayfa` : 'Henüz veri yok';
  }

  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return 'Geçen haftayla aynı';
  return change > 0 ? `%${change} artış` : `%${Math.abs(change)} düşüş`;
}

export default function PremiumReadingStatsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const premium = usePremium();
  const [stats, setStats] = useState<PremiumReadingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!premium.ready || !premium.isPremium) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase
        .rpc('get_premium_reading_stats')
        .single();

      if (rpcError) throw rpcError;
      setStats(data as PremiumReadingStats);
    } catch (loadError) {
      console.error('Premium okuma istatistikleri yüklenemedi:', loadError);
      setError('İstatistikler şu anda yüklenemedi. Lütfen tekrar dene.');
    } finally {
      setLoading(false);
    }
  }, [premium.isPremium, premium.ready]);

  useFocusEffect(
    useCallback(() => {
      void loadStats();
    }, [loadStats])
  );

  const series = useMemo(
    () => (Array.isArray(stats?.daily_series) ? stats.daily_series : []),
    [stats?.daily_series]
  );
  const maxPages = useMemo(
    () => Math.max(1, ...series.map((item) => asNumber(item.pages))),
    [series]
  );

  const totalPages = asNumber(stats?.total_pages_30d);
  const activeDays = asNumber(stats?.active_days_30d);
  const averagePages = asNumber(stats?.average_pages_active_day);
  const goalHitDays = asNumber(stats?.goal_hit_days);
  const last7 = asNumber(stats?.pages_last_7d);
  const previous7 = asNumber(stats?.pages_previous_7d);

  if (premium.ready && !premium.isPremium) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}> 
        <View style={styles.centeredContent}>
          <View style={[styles.lockedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <View style={[styles.lockIcon, { backgroundColor: colors.primarySoft }]}> 
              <Feather name="lock" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.lockedTitle, { color: colors.text }]}>Premium istatistikleri</Text>
            <Text style={[styles.lockedBody, { color: colors.textSecondary }]}>Son 30 günün ayrıntılı okuma analizi Premium üyelikle kullanılabilir.</Text>
            <Pressable
              onPress={() => router.replace('/premium')}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.primaryButtonText}>Premium'u İncele</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri dön"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/premium'))}
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Feather name="chevron-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Okuma İstatistikleri</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.heroTopRow}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>PREMIUM ANALİZ</Text>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Son 30 gün</Text>
            </View>
            <Feather name="bar-chart-2" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.heroBody, { color: colors.textSecondary }]}>Okuma ilerlemene kaydettiğin sayfalardan oluşturulur.</Text>
        </View>

        {loading && !stats ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>İstatistikler hazırlanıyor...</Text>
          </View>
        ) : error ? (
          <View style={[styles.errorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Feather name="alert-circle" size={22} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
            <Pressable onPress={() => void loadStats()} style={[styles.retryButton, { borderColor: colors.primary }]}> 
              <Text style={[styles.retryText, { color: colors.primary }]}>Tekrar Dene</Text>
            </Pressable>
          </View>
        ) : stats ? (
          <>
            <View style={styles.metricGrid}>
              <MetricCard label="Toplam sayfa" value={String(totalPages)} icon="book-open" />
              <MetricCard label="Aktif gün" value={`${activeDays}/30`} icon="calendar" />
              <MetricCard label="Aktif gün ort." value={`${averagePages.toFixed(1)} sf.`} icon="activity" />
              <MetricCard label="Mevcut seri" value={`${stats.current_streak ?? 0} gün`} icon="zap" />
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>30 günlük tempo</Text>
                  <Text style={[styles.sectionCaption, { color: colors.textSecondary }]}>{formatDate(stats.period_start)} – {formatDate(stats.period_end)}</Text>
                </View>
                <Text style={[styles.totalLabel, { color: colors.primary }]}>{totalPages} sf.</Text>
              </View>

              <View style={styles.chart}>
                {series.map((item) => {
                  const pages = asNumber(item.pages);
                  const height = pages <= 0 ? 3 : Math.max(7, Math.round((pages / maxPages) * 82));
                  return (
                    <View key={item.date} style={styles.barColumn} accessibilityLabel={`${formatDate(item.date)} ${pages} sayfa`}>
                      <View style={[styles.bar, { height, backgroundColor: pages > 0 ? colors.primary : colors.border }]} />
                    </View>
                  );
                })}
              </View>
              <View style={styles.chartLabels}>
                <Text style={[styles.chartLabel, { color: colors.textMuted }]}>{formatDate(stats.period_start)}</Text>
                <Text style={[styles.chartLabel, { color: colors.textMuted }]}>{formatDate(stats.period_end)}</Text>
              </View>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Öne çıkanlar</Text>
              <InsightRow
                icon="award"
                title="En güçlü gün"
                value={stats.best_day ? `${formatDate(stats.best_day)} · ${stats.best_day_pages ?? 0} sayfa` : 'Henüz veri yok'}
              />
              <InsightRow
                icon="target"
                title="Hedef tutturulan gün"
                value={`${goalHitDays} gün · günlük hedef ${stats.daily_page_goal ?? 20} sayfa`}
              />
              <InsightRow
                icon="trending-up"
                title="Son 7 gün"
                value={`${last7} sayfa · ${getTrendLabel(last7, previous7)}`}
              />
              <InsightRow
                icon="clock"
                title="Önceki 7 gün"
                value={`${previous7} sayfa`}
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );

  function MetricCard({ label, value, icon }: { label: string; value: string; icon: keyof typeof Feather.glyphMap }) {
    return (
      <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Feather name={icon} size={18} color={colors.primary} />
        <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    );
  }

  function InsightRow({ icon, title, value }: { icon: keyof typeof Feather.glyphMap; title: string; value: string }) {
    return (
      <View style={[styles.insightRow, { borderTopColor: colors.divider }]}> 
        <View style={[styles.insightIcon, { backgroundColor: colors.primarySoft }]}> 
          <Feather name={icon} size={17} color={colors.primary} />
        </View>
        <View style={styles.insightText}>
          <Text style={[styles.insightTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.insightValue, { color: colors.textSecondary }]}>{value}</Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 56 },
  centeredContent: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '800' },
  headerSpacer: { width: 42 },
  hero: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 8 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { marginTop: 3, fontSize: 26, fontWeight: '900' },
  heroBody: { fontSize: 13, lineHeight: 19 },
  loadingBox: { paddingVertical: 64, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13 },
  errorCard: { marginTop: 16, borderWidth: 1, borderRadius: 18, padding: 18, alignItems: 'center', gap: 12 },
  errorText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retryButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { fontSize: 13, fontWeight: '800' },
  metricGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', flexGrow: 1, minHeight: 116, borderWidth: 1, borderRadius: 18, padding: 14, gap: 6 },
  metricValue: { marginTop: 2, fontSize: 22, fontWeight: '900' },
  metricLabel: { fontSize: 12, lineHeight: 17 },
  sectionCard: { marginTop: 14, borderWidth: 1, borderRadius: 20, padding: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  sectionCaption: { marginTop: 3, fontSize: 12 },
  totalLabel: { fontSize: 16, fontWeight: '900' },
  chart: { height: 94, marginTop: 18, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barColumn: { flex: 1, height: 88, justifyContent: 'flex-end', alignItems: 'stretch' },
  bar: { width: '100%', borderRadius: 3 },
  chartLabels: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between' },
  chartLabel: { fontSize: 10 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth },
  insightIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  insightText: { flex: 1, gap: 3 },
  insightTitle: { fontSize: 13, fontWeight: '800' },
  insightValue: { fontSize: 12, lineHeight: 17 },
  lockedCard: { borderWidth: 1, borderRadius: 22, padding: 22, alignItems: 'center', gap: 12 },
  lockIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  lockedTitle: { fontSize: 21, fontWeight: '900' },
  lockedBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  primaryButton: { marginTop: 5, minHeight: 46, borderRadius: 14, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
