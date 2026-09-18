import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { safeBack } from '@/lib/navigation';
import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type AuditAction = 'premium_admin_granted' | 'premium_admin_revoked';

type AuditLogRow = {
  id: string;
  admin_id: string;
  action: AuditAction;
  target_id: string | null;
  reason: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
};

type HistoryRow = AuditLogRow & {
  adminName: string;
  targetName: string;
};

const DURATION_LABELS: Record<string, string> = {
  '7_days': '7 Gün',
  '30_days': '30 Gün',
  '1_year': '1 Yıl',
  unlimited: 'Süresiz',
};

function profileLabel(profile?: ProfileRow) {
  if (!profile) return 'Bilinmeyen hesap';
  return profile.username || profile.full_name || 'Kitap Okuru';
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih bilinmiyor';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(row: HistoryRow) {
  const duration = typeof row.metadata?.duration === 'string' ? row.metadata.duration : null;
  if (duration && DURATION_LABELS[duration]) return DURATION_LABELS[duration];

  const expiresAt = typeof row.new_value?.expires_at === 'string' ? row.new_value.expires_at : null;
  if (row.action === 'premium_admin_granted' && !expiresAt) return 'Süresiz';
  return '—';
}

export default function AdminPremiumHistoryScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const goBackSafely = useCallback(() => {
    if (router.canGoBack()) safeBack(router, '/admin');
    else router.replace('/admin');
  }, [router]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (access.role !== 'admin' && access.role !== 'super_admin') {
        router.replace('/admin');
        return;
      }

      const { data: logs, error: logsError } = await supabase
        .from('admin_audit_logs')
        .select('id, admin_id, action, target_id, reason, old_value, new_value, metadata, created_at')
        .in('action', ['premium_admin_granted', 'premium_admin_revoked'])
        .order('created_at', { ascending: false })
        .limit(200);

      if (logsError) throw logsError;

      const typedLogs = (logs ?? []) as AuditLogRow[];
      const ids = Array.from(
        new Set(
          typedLogs
            .flatMap((row) => [row.admin_id, row.target_id])
            .filter((value): value is string => Boolean(value))
        )
      );

      let profiles: ProfileRow[] = [];
      if (ids.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, full_name')
          .in('id', ids);
        if (error) throw error;
        profiles = (data ?? []) as ProfileRow[];
      }

      const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
      setRows(
        typedLogs.map((row) => ({
          ...row,
          adminName: profileLabel(profileMap.get(row.admin_id)),
          targetName: profileLabel(row.target_id ? profileMap.get(row.target_id) : undefined),
        }))
      );
    } catch (error) {
      console.error('Premium işlem geçmişi yüklenemedi:', error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR');
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.adminName, row.targetName, row.target_id ?? '', row.reason ?? '', row.action]
        .join(' ')
        .toLocaleLowerCase('tr-TR')
        .includes(needle)
    );
  }, [query, rows]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Premium işlem geçmişi yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={goBackSafely} style={styles.headerButton}>
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>PREMIUM</Text>
            <Text style={styles.title}>İşlem Geçmişi</Text>
          </View>
          <Pressable onPress={() => void loadHistory()} style={styles.headerButton}>
            <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryValue}>{rows.length.toLocaleString('tr-TR')}</Text>
            <Text style={styles.summaryLabel}>Son 200 Premium admin işlemi</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Kullanıcı, admin, UUID veya neden ara"
            placeholderTextColor="#747483"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
        </View>

        <Text style={styles.resultText}>{filteredRows.length} işlem gösteriliyor</Text>

        <View style={styles.historyList}>
          {filteredRows.map((row) => {
            const granted = row.action === 'premium_admin_granted';
            return (
              <View key={row.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View style={[styles.actionIcon, granted ? styles.actionIconGrant : styles.actionIconRevoke]}>
                    <Feather
                      name={granted ? 'gift' : 'x-circle'}
                      size={18}
                      color={granted ? '#D7CAFF' : '#FFB4BC'}
                    />
                  </View>
                  <View style={styles.historyCopy}>
                    <Text style={styles.historyTitle}>
                      {granted ? 'Admin Premium verildi' : 'Admin Premium geri alındı'}
                    </Text>
                    <Text style={styles.historyDate}>{formatDateTime(row.created_at)}</Text>
                  </View>
                  {granted ? (
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationBadgeText}>{formatDuration(row)}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Kullanıcı</Text>
                    <Text style={styles.detailValue}>{row.targetName}</Text>
                    {row.target_id ? <Text style={styles.uuidText}>{row.target_id}</Text> : null}
                  </View>
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>İşlemi yapan</Text>
                    <Text style={styles.detailValue}>{row.adminName}</Text>
                  </View>
                </View>

                {row.reason ? (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>Neden / açıklama</Text>
                    <Text style={styles.reasonText}>{row.reason}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {filteredRows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="clock" size={24} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Premium işlemi bulunamadı</Text>
            <Text style={styles.emptyText}>Henüz kayıt yok veya arama filtresiyle eşleşen işlem bulunamadı.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0E' },
  loadingText: { marginTop: 12, color: '#A5A5B3', fontSize: 14 },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  headerCopy: { flex: 1, marginHorizontal: 14 },
  eyebrow: { color: '#A985FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 2, color: '#F5F5F8', fontSize: 25, fontWeight: '900' },
  summaryCard: { padding: 16, backgroundColor: '#15151D', borderRadius: 17, borderWidth: 1, borderColor: '#292934', marginBottom: 14 },
  summaryValue: { color: '#F5F5F8', fontSize: 22, fontWeight: '900' },
  summaryLabel: { marginTop: 3, color: '#8E8E9D', fontSize: 12 },
  searchBox: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, backgroundColor: '#15151D', borderRadius: 15, borderWidth: 1, borderColor: '#292934' },
  searchInput: { flex: 1, color: '#F5F5F8', fontSize: 14 },
  resultText: { color: '#747483', fontSize: 12, marginTop: 12, marginBottom: 9 },
  historyList: { gap: 10 },
  historyCard: { padding: 14, backgroundColor: '#15151D', borderRadius: 17, borderWidth: 1, borderColor: '#292934' },
  historyHeader: { flexDirection: 'row', alignItems: 'center' },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  actionIconGrant: { backgroundColor: '#241A35', borderColor: '#513A76' },
  actionIconRevoke: { backgroundColor: '#281419', borderColor: '#6E303A' },
  historyCopy: { flex: 1, marginLeft: 11 },
  historyTitle: { color: '#F5F5F8', fontSize: 14, fontWeight: '900' },
  historyDate: { marginTop: 3, color: '#747483', fontSize: 11 },
  durationBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#2B1E3E', borderWidth: 1, borderColor: '#60458A' },
  durationBadgeText: { color: '#D7CAFF', fontSize: 10, fontWeight: '900' },
  detailGrid: { flexDirection: 'row', gap: 12, marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#292934' },
  detailBlock: { flex: 1, minWidth: 0 },
  detailLabel: { color: '#747483', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  detailValue: { marginTop: 4, color: '#D4D4DC', fontSize: 12, fontWeight: '800' },
  uuidText: { marginTop: 3, color: '#686876', fontSize: 9 },
  reasonBox: { marginTop: 12, padding: 11, borderRadius: 12, backgroundColor: '#0F0F15', borderWidth: 1, borderColor: '#292934' },
  reasonLabel: { color: '#747483', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  reasonText: { marginTop: 5, color: '#A5A5B3', fontSize: 12, lineHeight: 17 },
  emptyCard: { marginTop: 24, alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  emptyTitle: { marginTop: 10, color: '#F5F5F8', fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 5, color: '#8E8E9D', fontSize: 12, textAlign: 'center' },
});
