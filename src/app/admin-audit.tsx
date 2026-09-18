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

import { safeBack } from '@/lib/navigation';
import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type AuditRow = {
  id: string;
  admin_id: string;
  admin_username: string | null;
  admin_full_name: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  old_value: unknown;
  new_value: unknown;
  metadata: unknown;
  created_at: string;
};

type FilterOptions = {
  actions: string[] | null;
  target_types: string[] | null;
};

const PAGE_SIZE = 100;

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function prettyJson(value: unknown) {
  if (value == null) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminAuditScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [query, setQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async (offset = 0, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const access = await getCurrentAdminAccess();
        if (!access.canManageSystem) {
          router.replace('/admin');
          return;
        }

        const [{ data, error }, { data: filterRows, error: filterError }] = await Promise.all([
          supabase.rpc('admin_list_audit_logs', {
            p_search: query.trim(),
            ...(selectedAction ? { p_action: selectedAction } : {}),
            ...(selectedTarget ? { p_target_type: selectedTarget } : {}),
            p_limit: PAGE_SIZE,
            p_offset: offset,
          }),
          supabase.rpc('admin_audit_filter_options'),
        ]);

        if (error) throw error;
        if (filterError) throw filterError;

        const next = (data ?? []) as AuditRow[];
        setLogs((current) => (append ? [...current, ...next] : next));
        setHasMore(next.length === PAGE_SIZE);

        const options = (filterRows?.[0] ?? null) as FilterOptions | null;
        setActions(options?.actions ?? []);
        setTargets(options?.target_types ?? []);
      } catch (error) {
        console.error('Audit kayıtları yüklenemedi:', error);
        Alert.alert('Hata', 'İşlem geçmişi yüklenemedi.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, router, selectedAction, selectedTarget]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const activeFilterCount = useMemo(
    () => Number(Boolean(selectedAction)) + Number(Boolean(selectedTarget)),
    [selectedAction, selectedTarget]
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => safeBack(router, '/admin')} style={styles.headerButton}>
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>YÖNETİM</Text>
            <Text style={styles.title}>İşlem Geçmişi</Text>
          </View>
          <Pressable onPress={() => void load()} style={styles.headerButton}>
            <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Feather name="shield" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Yönetici işlemleri burada salt okunur olarak tutulur. Bu ekrandan kayıt silinmez veya değiştirilmez.
          </Text>
        </View>

        <View style={styles.searchBox}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void load()}
            placeholder="İşlem, hedef, kullanıcı adı veya UUID ara"
            placeholderTextColor="#747483"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
          <Pressable onPress={() => void load()}>
            <Feather name="arrow-right" size={18} color={colors.primary} />
          </Pressable>
        </View>

        <Text style={styles.filterLabel}>İşlem türü</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable
            onPress={() => setSelectedAction(null)}
            style={[styles.chip, !selectedAction && styles.chipActive]}
          >
            <Text style={[styles.chipText, !selectedAction && styles.chipTextActive]}>Tümü</Text>
          </Pressable>
          {actions.map((action) => (
            <Pressable
              key={action}
              onPress={() => setSelectedAction(action === selectedAction ? null : action)}
              style={[styles.chip, selectedAction === action && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedAction === action && styles.chipTextActive]}>
                {action}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>Hedef türü</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable
            onPress={() => setSelectedTarget(null)}
            style={[styles.chip, !selectedTarget && styles.chipActive]}
          >
            <Text style={[styles.chipText, !selectedTarget && styles.chipTextActive]}>Tümü</Text>
          </Pressable>
          {targets.map((target) => (
            <Pressable
              key={target}
              onPress={() => setSelectedTarget(target === selectedTarget ? null : target)}
              style={[styles.chip, selectedTarget === target && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedTarget === target && styles.chipTextActive]}>
                {target}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {activeFilterCount > 0 ? (
          <Pressable
            onPress={() => {
              setSelectedAction(null);
              setSelectedTarget(null);
            }}
            style={styles.clearButton}
          >
            <Feather name="x" size={15} color={colors.primary} />
            <Text style={styles.clearButtonText}>Filtreleri temizle</Text>
          </Pressable>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>İşlem geçmişi yükleniyor...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.resultText}>{logs.length} kayıt gösteriliyor</Text>
            <View style={styles.list}>
              {logs.map((log) => {
                const oldValue = prettyJson(log.old_value);
                const newValue = prettyJson(log.new_value);
                return (
                  <View key={log.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.iconWrap}>
                        <Feather name="activity" size={17} color={colors.primary} />
                      </View>
                      <View style={styles.cardHeaderCopy}>
                        <Text style={styles.action}>{log.action}</Text>
                        <Text style={styles.date}>{formatDate(log.created_at)}</Text>
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Yönetici</Text>
                      <Text style={styles.metaValue} numberOfLines={2}>
                        {log.admin_username || log.admin_full_name || log.admin_id}
                      </Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Hedef</Text>
                      <Text style={styles.metaValue} numberOfLines={2}>
                        {log.target_type}{log.target_id ? ` · ${log.target_id}` : ''}
                      </Text>
                    </View>
                    {log.reason ? (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Neden</Text>
                        <Text style={styles.metaValue}>{log.reason}</Text>
                      </View>
                    ) : null}

                    {oldValue ? (
                      <View style={styles.jsonBox}>
                        <Text style={styles.jsonTitle}>Önceki değer</Text>
                        <Text style={styles.jsonText}>{oldValue}</Text>
                      </View>
                    ) : null}
                    {newValue ? (
                      <View style={styles.jsonBox}>
                        <Text style={styles.jsonTitle}>Yeni değer</Text>
                        <Text style={styles.jsonText}>{newValue}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {logs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Feather name="clock" size={24} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>Kayıt bulunamadı</Text>
                <Text style={styles.emptyText}>Arama veya filtreleri değiştirip tekrar dene.</Text>
              </View>
            ) : null}

            {hasMore ? (
              <Pressable
                disabled={loadingMore}
                onPress={() => void load(logs.length, true)}
                style={styles.moreButton}
              >
                {loadingMore ? <ActivityIndicator color="#fff" /> : <Text style={styles.moreButtonText}>Daha fazla yükle</Text>}
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 18, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  headerCopy: { flex: 1, marginHorizontal: 14 },
  eyebrow: { color: '#A985FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#F5F5F8', fontSize: 25, fontWeight: '900' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 14, borderRadius: 15, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#302342', marginBottom: 13 },
  infoText: { flex: 1, color: '#A5A5B3', fontSize: 12, lineHeight: 18 },
  searchBox: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, backgroundColor: '#15151D', borderRadius: 15, borderWidth: 1, borderColor: '#292934', marginBottom: 14 },
  searchInput: { flex: 1, color: '#F5F5F8', fontSize: 14 },
  filterLabel: { color: '#A5A5B3', fontSize: 12, fontWeight: '800', marginBottom: 7 },
  chipRow: { gap: 7, paddingBottom: 12 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: '#121219', borderWidth: 1, borderColor: '#30303D' },
  chipActive: { backgroundColor: '#2B1E3E', borderColor: '#60458A' },
  chipText: { color: '#8E8E9D', fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: '#C8B8FF' },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginBottom: 10 },
  clearButtonText: { color: '#A985FF', fontSize: 12, fontWeight: '700' },
  loadingBox: { alignItems: 'center', paddingVertical: 48 },
  loadingText: { color: '#A5A5B3', marginTop: 10, fontSize: 13 },
  resultText: { color: '#747483', fontSize: 12, marginBottom: 9 },
  list: { gap: 10 },
  card: { padding: 14, borderRadius: 17, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#21182F' },
  cardHeaderCopy: { flex: 1, marginLeft: 10 },
  action: { color: '#F5F5F8', fontSize: 14, fontWeight: '900' },
  date: { marginTop: 2, color: '#747483', fontSize: 11 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 5 },
  metaLabel: { width: 68, color: '#747483', fontSize: 11, fontWeight: '700' },
  metaValue: { flex: 1, color: '#B4B4C1', fontSize: 11, lineHeight: 16 },
  jsonBox: { marginTop: 11, padding: 10, borderRadius: 11, backgroundColor: '#0F0F15', borderWidth: 1, borderColor: '#252530' },
  jsonTitle: { color: '#9A84D8', fontSize: 10, fontWeight: '800', marginBottom: 5 },
  jsonText: { color: '#A5A5B3', fontSize: 10, lineHeight: 15 },
  emptyCard: { marginTop: 18, alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  emptyTitle: { marginTop: 10, color: '#F5F5F8', fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 5, color: '#8E8E9D', fontSize: 12, textAlign: 'center' },
  moreButton: { marginTop: 14, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#6C3CC5' },
  moreButtonText: { color: '#fff', fontWeight: '900' },
});
