import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type ReportStatus = 'pending' | 'reviewing' | 'actioned' | 'rejected';

type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  category: string;
  description: string;
  status: ReportStatus;
  assigned_to: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

const FILTERS: { key: 'all' | ReportStatus; label: string }[] = [
  { key: 'pending', label: 'Bekleyen' },
  { key: 'reviewing', label: 'İncelenen' },
  { key: 'actioned', label: 'İşlem Yapılan' },
  { key: 'rejected', label: 'Reddedilen' },
  { key: 'all', label: 'Tümü' },
];

function statusLabel(status: ReportStatus) {
  if (status === 'pending') return 'Bekliyor';
  if (status === 'reviewing') return 'İnceleniyor';
  if (status === 'actioned') return 'İşlem yapıldı';
  return 'Reddedildi';
}

function targetLabel(target: string) {
  const labels: Record<string, string> = {
    user: 'Kullanıcı',
    post: 'Gönderi',
    review: 'İnceleme',
    quote: 'Alıntı',
    comment: 'Yorum',
    message: 'Mesaj',
    community: 'Topluluk',
    event: 'Etkinlik',
  };
  return labels[target] ?? target;
}

export default function AdminModerationScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [filter, setFilter] = useState<'all' | ReportStatus>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolutionById, setResolutionById] = useState<Record<string, string>>({});

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (!access.canOpenAdmin) {
        router.replace('/');
        return;
      }

      const { data, error } = await supabase
        .from('reports')
        .select('id, reporter_id, target_type, target_id, category, description, status, assigned_to, resolution, resolved_at, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Şikâyetler yüklenemedi:', error);
        Alert.alert('Hata', 'Şikâyetler yüklenemedi.');
        return;
      }

      const rows = (data ?? []) as ReportRow[];
      setReports(rows);
      setResolutionById((old) => {
        const next = { ...old };
        rows.forEach((row) => {
          if (next[row.id] === undefined) next[row.id] = row.resolution ?? '';
        });
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadReports();
    }, [loadReports])
  );

  const visibleReports = useMemo(
    () => (filter === 'all' ? reports : reports.filter((item) => item.status === filter)),
    [filter, reports]
  );

  async function updateReport(report: ReportRow, status: ReportStatus) {
    const resolution = (resolutionById[report.id] ?? '').trim();

    if ((status === 'actioned' || status === 'rejected') && !resolution) {
      Alert.alert('Açıklama gerekli', 'Bu işlem için çözüm/açıklama alanını doldur.');
      return;
    }

    setBusyId(report.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const resolved = status === 'actioned' || status === 'rejected';
      const nextValues = {
        status,
        assigned_to: status === 'reviewing' ? user.id : report.assigned_to ?? user.id,
        resolution: resolution || null,
        resolved_at: resolved ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('reports')
        .update(nextValues)
        .eq('id', report.id);

      if (error) {
        Alert.alert('Hata', error.message);
        return;
      }

      const { error: auditError } = await supabase.from('admin_audit_logs').insert({
        admin_id: user.id,
        action: 'report_status_changed',
        target_type: 'report',
        target_id: report.id,
        reason: resolution || null,
        old_value: { status: report.status },
        new_value: { status, resolution: resolution || null },
        metadata: {
          reported_target_type: report.target_type,
          reported_target_id: report.target_id,
          category: report.category,
        },
      });

      if (auditError) {
        console.warn('Audit log yazılamadı:', auditError.message);
      }

      await loadReports();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Moderasyon kayıtları yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>MODERASYON</Text>
            <Text style={styles.title}>Şikâyet Yönetimi</Text>
          </View>
          <Pressable onPress={() => void loadReports()} style={styles.headerButton}>
            <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = item.key === filter;
            const count = item.key === 'all' ? reports.length : reports.filter((r) => r.status === item.key).length;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label} · {count}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {visibleReports.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="check-circle" size={30} color={colors.primary} />
            <Text style={styles.emptyTitle}>Bu bölüm boş</Text>
            <Text style={styles.emptyText}>Seçili durumda herhangi bir şikâyet bulunmuyor.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleReports.map((report) => {
              const busy = busyId === report.id;
              return (
                <View key={report.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.targetBadge}>
                      <Text style={styles.targetBadgeText}>{targetLabel(report.target_type)}</Text>
                    </View>
                    <Text style={styles.statusText}>{statusLabel(report.status)}</Text>
                  </View>

                  <Text style={styles.category}>{report.category || 'other'}</Text>
                  <Text style={styles.description}>{report.description || 'Açıklama girilmemiş.'}</Text>

                  <View style={styles.metaBox}>
                    <Text style={styles.metaLabel}>Hedef ID</Text>
                    <Text selectable style={styles.metaValue}>{report.target_id}</Text>
                    <Text style={styles.metaLabel}>Şikâyetçi UUID</Text>
                    <Text selectable style={styles.metaValue}>{report.reporter_id}</Text>
                    <Text style={styles.metaDate}>{new Date(report.created_at).toLocaleString('tr-TR')}</Text>
                  </View>

                  <Text style={styles.resolutionLabel}>Moderasyon notu / çözüm</Text>
                  <TextInput
                    value={resolutionById[report.id] ?? ''}
                    onChangeText={(text) => setResolutionById((old) => ({ ...old, [report.id]: text }))}
                    placeholder="İşlemin nedenini veya sonucu yaz..."
                    placeholderTextColor="#6F6F7B"
                    multiline
                    style={styles.resolutionInput}
                  />

                  <View style={styles.actionRow}>
                    {report.status !== 'reviewing' ? (
                      <Pressable
                        disabled={busy}
                        onPress={() => void updateReport(report, 'reviewing')}
                        style={[styles.actionButton, styles.reviewButton, busy && styles.disabled]}
                      >
                        <Feather name="eye" size={16} color="#D8C9FF" />
                        <Text style={styles.reviewButtonText}>İncelemeye al</Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      disabled={busy}
                      onPress={() => void updateReport(report, 'actioned')}
                      style={[styles.actionButton, styles.successButton, busy && styles.disabled]}
                    >
                      <Feather name="check" size={16} color="#D9FFE8" />
                      <Text style={styles.successButtonText}>İşlem yapıldı</Text>
                    </Pressable>

                    <Pressable
                      disabled={busy}
                      onPress={() => void updateReport(report, 'rejected')}
                      style={[styles.actionButton, styles.rejectButton, busy && styles.disabled]}
                    >
                      <Feather name="x" size={16} color="#FFD5D8" />
                      <Text style={styles.rejectButtonText}>Reddet</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0E' },
  loadingText: { marginTop: 12, color: '#A5A5B3', fontSize: 14 },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  headerCopy: { flex: 1, marginHorizontal: 14 },
  eyebrow: { color: '#A985FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 2, color: '#F5F5F8', fontSize: 25, fontWeight: '900' },
  filterRow: { gap: 8, paddingBottom: 16 },
  filterChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#2C2C37' },
  filterChipActive: { backgroundColor: '#241A33', borderColor: '#6C4A98' },
  filterText: { color: '#9494A0', fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#D5C4FF' },
  list: { gap: 12 },
  card: { backgroundColor: '#15151D', borderRadius: 18, borderWidth: 1, borderColor: '#2A2A35', padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  targetBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#21182F' },
  targetBadgeText: { color: '#C9B4FF', fontSize: 11, fontWeight: '800' },
  statusText: { color: '#9898A5', fontSize: 12, fontWeight: '800' },
  category: { marginTop: 14, color: '#F4F4F7', fontSize: 16, fontWeight: '900' },
  description: { marginTop: 7, color: '#BCBCC6', fontSize: 14, lineHeight: 20 },
  metaBox: { marginTop: 14, padding: 12, borderRadius: 13, backgroundColor: '#0E0E13', borderWidth: 1, borderColor: '#252530' },
  metaLabel: { color: '#737381', fontSize: 10, fontWeight: '800', marginTop: 5 },
  metaValue: { color: '#AFAFBA', fontSize: 11, marginTop: 2 },
  metaDate: { color: '#696976', fontSize: 11, marginTop: 9 },
  resolutionLabel: { marginTop: 14, marginBottom: 7, color: '#BEBEC8', fontSize: 12, fontWeight: '800' },
  resolutionInput: { minHeight: 82, borderRadius: 13, borderWidth: 1, borderColor: '#2A2A35', backgroundColor: '#0E0E13', color: '#F3F3F6', paddingHorizontal: 12, paddingTop: 11, textAlignVertical: 'top', fontSize: 13 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  actionButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  reviewButton: { backgroundColor: '#21182F', borderColor: '#4A3569' },
  reviewButtonText: { color: '#D8C9FF', fontSize: 12, fontWeight: '800' },
  successButton: { backgroundColor: '#10251A', borderColor: '#225A3A' },
  successButtonText: { color: '#D9FFE8', fontSize: 12, fontWeight: '800' },
  rejectButton: { backgroundColor: '#281418', borderColor: '#683038' },
  rejectButtonText: { color: '#FFD5D8', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  emptyCard: { marginTop: 24, alignItems: 'center', padding: 30, borderRadius: 18, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#2A2A35' },
  emptyTitle: { marginTop: 12, color: '#F5F5F8', fontSize: 17, fontWeight: '900' },
  emptyText: { marginTop: 5, color: '#898996', fontSize: 13, textAlign: 'center' },
});
