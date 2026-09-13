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

type MonthlyPoint = {
  month: number;
  pages: number | string | null;
  active_days: number | string | null;
};

type PremiumYearReport = {
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

const MONTHS = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
] as const;

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthLabel(month: number | null | undefined) {
  if (!month || month < 1 || month > 12) return '—';
  return MONTHS[month - 1];
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
  }).format(date);
}

export default function PremiumYearReportScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const premium = usePremium();
  const [report, setReport] = useState<PremiumYearReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!premium.ready || !premium.isPremium) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase
        .rpc('get_premium_year_report', { p_year: null })
        .single();

      if (rpcError) throw rpcError;
      setReport(data as PremiumYearReport);
    } catch (loadError) {
      console.error('Premium yıllık rapor yüklenemedi:', loadError);
      setError('Yıllık rapor şu anda yüklenemedi. Lütfen tekrar dene.');
    } finally {
      setLoading(false);
    }
  }, [premium.isPremium, premium.ready]);

  useFocusEffect(
    useCallback(() => {
      void loadReport();
    }, [loadReport])
  );

  const series = useMemo(
    () => (Array.isArray(report?.monthly_series) ? report.monthly_series : []),
    [report?.monthly_series]
  );
  const maxPages = useMemo(
    () => Math.max(1, ...series.map((item) => asNumber(item.pages))),
    [series]
  );

  const totalPages = asNumber(report?.total_pages);
  const activeDays = asNumber(report?.active_days);
  const booksCompleted = asNumber(report?.books_completed);
  const goalHitDays = asNumber(report?.goal_hit_days);
  const averagePages = asNumber(report?.average_pages_active_day);
  const bestMonthPages = asNumber(report?.best_month_pages);

  if (premium.ready && !premium.isPremium) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}> 
        <View style={styles.centeredContent}>
          <View style={[styles.lockedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <View style={[styles.lockIcon, { backgroundColor: colors.primarySoft }]}> 
              <Feather name="lock" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.lockedTitle, { color: colors.text }]}>Yıllık Okuma Raporu</Text>
            <Text style={[styles.lockedBody, { color: colors.textSecondary }]}>Yıllık okuma özetin ve aylık dağılımın Premium üyelikle kullanılabilir.</Text>
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Yıllık Okuma Raporu</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.heroTopRow}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>PREMIUM RAPOR</Text>
              <Text style={[styles.heroTitle, { color: colors.text }]}>{report?.report_year ?? new Date().getFullYear()}</Text>
            </View>
            <Feather name="calendar" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.heroBody, { color: colors.textSecondary }]}>Okuma ilerlemesi, günlük sayfa kayıtların ve bitirdiğin kitap durumlarından oluşturulur.</Text>
        </View>

        {loading && !report ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yıllık rapor hazırlanıyor...</Text>
          </View>
        ) : error ? (
          <View style={[styles.errorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Feather name="alert-circle" size={22} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
            <Pressable onPress={() => void loadReport()} style={[styles.retryButton, { borderColor: colors.primary }]}> 
              <Text style={[styles.retryText, { color: colors.primary }]}>Tekrar Dene</Text>
            </Pressable>
          </View>
        ) : report ? (
          <>
            <View style={styles.metricGrid}>
              <MetricCard label="Toplam sayfa" value={String(totalPages)} icon="book-open" />
              <MetricCard label="Aktif gün" value={String(activeDays)} icon="calendar" />
              <MetricCard label="Bitirilen kitap" value={String(booksCompleted)} icon="check-circle" />
              <MetricCard label="Aktif gün ort." value={`${averagePages.toFixed(1)} sf.`} icon="activity" />
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Aylık okuma dağılımı</Text>
                  <Text style={[styles.sectionCaption, { color: colors.textSecondary }]}>12 aylık sayfa toplamları</Text>
                </View>
                <Text style={[styles.totalLabel, { color: colors.primary }]}>{totalPages} sf.</Text>
              </View>

              <View style={styles.chart}>
                {series.map((item) => {
                  const pages = asNumber(item.pages);
                  const height = pages <= 0 ? 3 : Math.max(8, Math.round((pages / maxPages) * 118));
                  return (
                    <View
                      key={item.month}
                      style={styles.barColumn}
                      accessibilityLabel={`${monthLabel(item.month)} ${pages} sayfa`}
                    >
                      <View style={[styles.bar, { height, backgroundColor: pages > 0 ? colors.primary : colors.border }]} />
                      <Text style={[styles.barLabel, { color: colors.textMuted }]}>{monthLabel(item.month)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Yılın öne çıkanları</Text>
              <InsightRow
                icon="award"
                title="En güçlü ay"
                value={report.best_month ? `${monthLabel(report.best_month)} · ${bestMonthPages} sayfa` : 'Henüz veri yok'}
              />
              <InsightRow
                icon="zap"
                title="En güçlü gün"
                value={report.best_day ? `${formatDate(report.best_day)} · ${report.best_day_pages ?? 0} sayfa` : 'Henüz veri yok'}
              />
              <InsightRow
                icon="target"
                title="Hedef tutturulan gün"
                value={`${goalHitDays} gün`}
              />
              <InsightRow
                icon="check-circle"
                title="Bitirilen kitap"
                value={`${booksCompleted} kitap`}
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
  heroTitle: { marginTop: 3, fontSize: 30, fontWeight: '900' },
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
  chart: { height: 154, marginTop: 18, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barColumn: { flex: 1, height: 150, justifyContent: 'flex-end', alignItems: 'center', gap: 6 },
  bar: { width: '72%', borderRadius: 4 },
  barLabel: { fontSize: 9 },
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
