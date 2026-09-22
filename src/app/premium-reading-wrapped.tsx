import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

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

const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'] as const;

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function PremiumReadingWrappedScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const premium = usePremium();
  const [report, setReport] = useState<YearReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    if (!premium.ready || !premium.isPremium) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_premium_year_report').single();
      if (error) throw error;
      setReport(data as YearReport);
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

  async function shareWrapped() {
    if (!report || sharing) return;
    setSharing(true);
    try {
      await Share.share({
        message:
          `${report.report_year} Reading Wrapped 📚\n\n` +
          `• ${completed} kitap tamamladım\n` +
          `• ${totalPages} sayfa okudum\n` +
          `• ${activeDays} gün aktif okudum\n` +
          `• Aktif gün ortalamam ${average.toFixed(1)} sayfa\n` +
          `• En güçlü ayım ${bestMonthLabel}\n\nKitap`,
      });
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
              <Highlight icon="zap" title="En güçlü gün" value={report.best_day ? `${report.best_day} · ${report.best_day_pages ?? 0} sayfa` : 'Henüz veri yok'} />
              <Highlight icon="target" title="Hedef tutturulan gün" value={`${asNumber(report.goal_hit_days)} gün`} />
            </View>

            <Pressable onPress={() => void shareWrapped()} disabled={sharing} style={[styles.shareButton, { backgroundColor: colors.primary }]}>
              <Feather name="share-2" size={18} color={colors.onPrimary} />
              <Text style={[styles.shareButtonText, { color: colors.onPrimary }]}>{sharing ? 'Hazırlanıyor…' : 'Wrapped Özetini Paylaş'}</Text>
            </Pressable>
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
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 56 },
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
  shareButton: { marginTop: 16, minHeight: 52, borderRadius: 16, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  shareButtonText: { fontSize: 14, fontWeight: '900' },
  primaryButton: { minHeight: 48, borderRadius: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  emptyText: { textAlign: 'center', lineHeight: 20 },
});
