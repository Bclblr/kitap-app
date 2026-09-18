import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { usePremium } from '@/providers/PremiumProvider';
import { useAppTheme } from '@/providers/ThemeProvider';

type GoalDashboard = {
  weekly_page_goal: number | null;
  weekly_pages_read: number | string | null;
  monthly_page_goal: number | null;
  monthly_pages_read: number | string | null;
  yearly_book_goal: number | null;
  yearly_books_completed: number | string | null;
  streak_goal_days: number | null;
  current_streak: number | null;
};

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(current: number, goal: number) {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((current / goal) * 100));
}

export default function PremiumReadingGoalsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const premium = usePremium();

  const [dashboard, setDashboard] = useState<GoalDashboard | null>(null);
  const [weekly, setWeekly] = useState('140');
  const [monthly, setMonthly] = useState('600');
  const [yearlyBooks, setYearlyBooks] = useState('24');
  const [streak, setStreak] = useState('7');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    if (!premium.ready || !premium.isPremium) return;

    try {
      setLoading(true);
      setError(null);
      const { data, error: rpcError } = await supabase
        .rpc('get_premium_goal_dashboard')
        .single();
      if (rpcError) throw rpcError;

      const row = data as GoalDashboard;
      setDashboard(row);
      setWeekly(String(row.weekly_page_goal ?? 140));
      setMonthly(String(row.monthly_page_goal ?? 600));
      setYearlyBooks(String(row.yearly_book_goal ?? 24));
      setStreak(String(row.streak_goal_days ?? 7));
    } catch (loadError) {
      console.error('Premium hedefleri yüklenemedi:', loadError);
      setError('Hedefler şu anda yüklenemedi. Lütfen tekrar dene.');
    } finally {
      setLoading(false);
    }
  }, [premium.isPremium, premium.ready]);

  useFocusEffect(
    useCallback(() => {
      void loadGoals();
    }, [loadGoals])
  );

  function parseGoal(value: string, min: number, max: number, label: string) {
    const clean = value.trim();
    if (!/^\d+$/.test(clean)) {
      Alert.alert('Geçersiz hedef', `${label} tam sayı olmalı.`);
      return null;
    }
    const parsed = Number(clean);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
      Alert.alert('Geçersiz hedef', `${label} ${min} ile ${max} arasında olmalı.`);
      return null;
    }
    return parsed;
  }

  async function saveGoals() {
    const weeklyValue = parseGoal(weekly, 1, 70000, 'Haftalık sayfa hedefi');
    if (weeklyValue === null) return;
    const monthlyValue = parseGoal(monthly, 1, 300000, 'Aylık sayfa hedefi');
    if (monthlyValue === null) return;
    const yearlyValue = parseGoal(yearlyBooks, 1, 1000, 'Yıllık kitap hedefi');
    if (yearlyValue === null) return;
    const streakValue = parseGoal(streak, 1, 365, 'Seri hedefi');
    if (streakValue === null) return;

    try {
      setSaving(true);
      const { error: rpcError } = await supabase.rpc('set_premium_reading_goals', {
        p_weekly_page_goal: weeklyValue,
        p_monthly_page_goal: monthlyValue,
        p_yearly_book_goal: yearlyValue,
        p_streak_goal_days: streakValue,
      });
      if (rpcError) throw rpcError;
      await loadGoals();
      Alert.alert('Hedefler kaydedildi', 'Premium okuma hedeflerin güncellendi.');
    } catch (saveError) {
      console.error('Premium hedefleri kaydedilemedi:', saveError);
      Alert.alert('Hedefler kaydedilemedi', 'Lütfen tekrar dene.');
    } finally {
      setSaving(false);
    }
  }

  if (premium.ready && !premium.isPremium) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centeredContent}>
          <View style={[styles.lockedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Feather name="lock" size={26} color={colors.primary} />
            <Text style={[styles.lockedTitle, { color: colors.text }]}>Gelişmiş hedefler Premium’a özel</Text>
            <Text style={[styles.lockedBody, { color: colors.textSecondary }]}>Haftalık, aylık, yıllık ve seri hedeflerini Premium üyelikle kullanabilirsin.</Text>
            <Pressable onPress={() => router.replace('/premium')} style={[styles.primaryButton, { backgroundColor: colors.primary }]}> 
              <Text style={styles.primaryButtonText}>Premium’u İncele</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const weeklyRead = asNumber(dashboard?.weekly_pages_read);
  const monthlyRead = asNumber(dashboard?.monthly_pages_read);
  const yearlyCompleted = asNumber(dashboard?.yearly_books_completed);
  const currentStreak = dashboard?.current_streak ?? 0;
  const weeklyGoal = dashboard?.weekly_page_goal ?? asNumber(weekly);
  const monthlyGoal = dashboard?.monthly_page_goal ?? asNumber(monthly);
  const yearlyGoal = dashboard?.yearly_book_goal ?? asNumber(yearlyBooks);
  const streakGoal = dashboard?.streak_goal_days ?? asNumber(streak);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri dön"
            onPress={() => (router.canGoBack() ? safeBack(router, '/premium') : router.replace('/premium'))}
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Feather name="chevron-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Gelişmiş Hedefler</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading && !dashboard ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Hedefler yükleniyor...</Text>
          </View>
        ) : error ? (
          <View style={[styles.errorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
            <Pressable onPress={() => void loadGoals()} style={[styles.retryButton, { borderColor: colors.primary }]}> 
              <Text style={[styles.retryText, { color: colors.primary }]}>Tekrar Dene</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.eyebrow, { color: colors.primary }]}>PREMIUM HEDEFLER</Text>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Okuma ritmini kendi planına göre kur.</Text>
              <Text style={[styles.heroBody, { color: colors.textSecondary }]}>Günlük ücretsiz hedefin yanında, daha uzun dönemli hedefler belirleyebilirsin.</Text>
            </View>

            <View style={styles.progressGrid}>
              <ProgressCard label="Bu hafta" current={weeklyRead} goal={weeklyGoal} suffix="sayfa" icon="calendar" />
              <ProgressCard label="Bu ay" current={monthlyRead} goal={monthlyGoal} suffix="sayfa" icon="bar-chart-2" />
              <ProgressCard label="Bu yıl" current={yearlyCompleted} goal={yearlyGoal} suffix="kitap" icon="book-open" />
              <ProgressCard label="Okuma serisi" current={currentStreak} goal={streakGoal} suffix="gün" icon="zap" />
            </View>

            <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Hedeflerini düzenle</Text>
              <GoalInput label="Haftalık sayfa" value={weekly} onChangeText={setWeekly} />
              <GoalInput label="Aylık sayfa" value={monthly} onChangeText={setMonthly} />
              <GoalInput label="Yıllık kitap" value={yearlyBooks} onChangeText={setYearlyBooks} />
              <GoalInput label="Seri hedefi (gün)" value={streak} onChangeText={setStreak} />

              <Pressable
                disabled={saving}
                onPress={() => void saveGoals()}
                style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Hedefleri Kaydet</Text>}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );

  function ProgressCard({ label, current, goal, suffix, icon }: { label: string; current: number; goal: number; suffix: string; icon: keyof typeof Feather.glyphMap }) {
    const progress = percent(current, goal);
    return (
      <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <View style={styles.progressHeader}>
          <Feather name={icon} size={18} color={colors.primary} />
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>{label}</Text>
        </View>
        <Text style={[styles.progressValue, { color: colors.text }]}>{current} / {goal} {suffix}</Text>
        <View style={[styles.track, { backgroundColor: colors.border }]}> 
          <View style={[styles.fill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
        </View>
        <Text style={[styles.percentText, { color: colors.primary }]}>%{progress}</Text>
      </View>
    );
  }

  function GoalInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
    return (
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          inputMode="numeric"
          style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
          placeholderTextColor={colors.textMuted}
        />
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
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { fontSize: 25, lineHeight: 31, fontWeight: '900' },
  heroBody: { fontSize: 13, lineHeight: 19 },
  loadingBox: { paddingVertical: 64, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13 },
  errorCard: { marginTop: 16, borderWidth: 1, borderRadius: 18, padding: 18, alignItems: 'center', gap: 12 },
  errorText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retryButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { fontSize: 13, fontWeight: '800' },
  progressGrid: { marginTop: 14, gap: 10 },
  progressCard: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 9 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressLabel: { fontSize: 13, fontWeight: '700' },
  progressValue: { fontSize: 18, fontWeight: '900' },
  track: { height: 9, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  percentText: { fontSize: 12, fontWeight: '800' },
  formCard: { marginTop: 16, borderWidth: 1, borderRadius: 20, padding: 17, gap: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '900' },
  inputGroup: { gap: 7 },
  inputLabel: { fontSize: 13, fontWeight: '800' },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, fontSize: 15 },
  primaryButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4, paddingHorizontal: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  lockedCard: { borderWidth: 1, borderRadius: 22, padding: 22, alignItems: 'center', gap: 12 },
  lockedTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  lockedBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
