import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { safeBack } from '@/lib/navigation';
import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type BucketStat = {
  bucket_id: string;
  bucket_name: string;
  is_public: boolean;
  file_size_limit: number | null;
  object_count: number;
  total_bytes: number;
};

type StorageObject = {
  id: string;
  bucket_id: string;
  object_name: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string | null;
  last_accessed_at: string | null;
  size_bytes: number;
  mimetype: string | null;
  referenced: boolean;
  cleanup_status: string | null;
};

function formatBytes(value: number | null | undefined) {
  const size = Number(value ?? 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = size;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n >= 10 || i === 0 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`;
}

export default function AdminStorageScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<BucketStat[]>([]);
  const [objects, setObjects] = useState<StorageObject[]>([]);
  const [selectedBucket, setSelectedBucket] = useState('');
  const [search, setSearch] = useState('');
  const [onlyOrphans, setOnlyOrphans] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (!access.canManageSystem) {
        Alert.alert('Yetkisiz erişim', 'Bu alan yalnızca admin ve super admin hesaplarına açıktır.');
        safeBack(router, '/admin');
        return;
      }

      const [{ data: bucketData, error: bucketError }, { data: objectData, error: objectError }] = await Promise.all([
        supabase.rpc('admin_storage_bucket_stats'),
        supabase.rpc('admin_list_storage_objects', {
          p_bucket: selectedBucket || null,
          p_search: search.trim(),
          p_limit: 300,
        }),
      ]);

      if (bucketError) throw bucketError;
      if (objectError) throw objectError;
      setBuckets((bucketData ?? []) as BucketStat[]);
      setObjects((objectData ?? []) as StorageObject[]);
    } catch (error: any) {
      Alert.alert('Storage yüklenemedi', error?.message ?? 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  }, [router, search, selectedBucket]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visibleObjects = useMemo(
    () => (onlyOrphans ? objects.filter((item) => item.bucket_id === 'work-covers' && !item.referenced) : objects),
    [objects, onlyOrphans]
  );

  const totalBytes = useMemo(() => buckets.reduce((sum, item) => sum + Number(item.total_bytes ?? 0), 0), [buckets]);
  const totalObjects = useMemo(() => buckets.reduce((sum, item) => sum + Number(item.object_count ?? 0), 0), [buckets]);

  async function markCleanup(item: StorageObject) {
    if (item.referenced) {
      Alert.alert('Dosya kullanımda', 'Referanslı dosya temizleme listesine eklenemez.');
      return;
    }
    setWorkingId(item.id);
    try {
      const { error } = await supabase.rpc('admin_mark_storage_cleanup', {
        p_bucket: item.bucket_id,
        p_object_name: item.object_name,
        p_reason: 'Admin panelinden sahipsiz dosya adayı olarak işaretlendi',
      });
      if (error) throw error;
      await load();
    } catch (error: any) {
      Alert.alert('İşaretlenemedi', error?.message ?? 'Bilinmeyen hata');
    } finally {
      setWorkingId(null);
    }
  }

  async function reviewCleanup(item: StorageObject, status: 'approved' | 'rejected') {
    setWorkingId(item.id);
    try {
      const { error } = await supabase.rpc('admin_review_storage_cleanup', {
        p_bucket: item.bucket_id,
        p_object_name: item.object_name,
        p_status: status,
      });
      if (error) throw error;
      await load();
    } catch (error: any) {
      Alert.alert('İşlem yapılamadı', error?.message ?? 'Bilinmeyen hata');
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => safeBack(router, '/admin')} style={styles.headerButton}>
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>YÖNETİM</Text>
            <Text style={styles.title}>Dosyalar / Storage</Text>
          </View>
          <Pressable onPress={() => void load()} style={styles.headerButton}>
            <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}><Text style={styles.metricValue}>{totalObjects.toLocaleString('tr-TR')}</Text><Text style={styles.metricLabel}>Toplam dosya</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricValue}>{formatBytes(totalBytes)}</Text><Text style={styles.metricLabel}>Toplam boyut</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Bucketlar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable onPress={() => setSelectedBucket('')} style={[styles.chip, selectedBucket === '' && styles.chipActive]}>
            <Text style={[styles.chipText, selectedBucket === '' && styles.chipTextActive]}>Tümü</Text>
          </Pressable>
          {buckets.map((bucket) => (
            <Pressable key={bucket.bucket_id} onPress={() => setSelectedBucket(bucket.bucket_id)} style={[styles.chip, selectedBucket === bucket.bucket_id && styles.chipActive]}>
              <Text style={[styles.chipText, selectedBucket === bucket.bucket_id && styles.chipTextActive]}>{bucket.bucket_name} · {bucket.object_count}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.searchRow}>
          <TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => void load()} placeholder="Dosya adı veya bucket ara" placeholderTextColor="#747483" style={styles.searchInput} autoCapitalize="none" />
          <Pressable onPress={() => void load()} style={styles.searchButton}><Feather name="search" size={18} color="#fff" /></Pressable>
        </View>

        <Pressable onPress={() => setOnlyOrphans((v) => !v)} style={[styles.orphanToggle, onlyOrphans && styles.orphanToggleActive]}>
          <Feather name="alert-circle" size={17} color={onlyOrphans ? colors.primary : colors.textSecondary} />
          <Text style={[styles.orphanToggleText, onlyOrphans && { color: colors.primary }]}>Yalnızca kullanılmayan work-covers dosyaları</Text>
        </Pressable>

        <View style={styles.infoCard}>
          <Feather name="shield" size={18} color={colors.primary} />
          <Text style={styles.infoText}>Bu ekran dosyaları doğrudan silmez. Önce temizleme adayı olarak işaretler ve onaylar. Fiziksel silme daha sonra güvenli sunucu işlemiyle yapılmalıdır.</Text>
        </View>

        <Text style={styles.sectionTitle}>Dosyalar</Text>
        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Storage taranıyor...</Text></View>
        ) : visibleObjects.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>Dosya bulunamadı</Text><Text style={styles.emptyText}>Filtreyi veya arama ifadesini değiştirebilirsin.</Text></View>
        ) : (
          <View style={styles.list}>
            {visibleObjects.map((item) => {
              const busy = workingId === item.id;
              const orphan = item.bucket_id === 'work-covers' && !item.referenced;
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.fileIcon}><Feather name="file" size={18} color={colors.primary} /></View>
                    <View style={styles.cardCopy}>
                      <Text style={styles.fileName} numberOfLines={2}>{item.object_name}</Text>
                      <Text style={styles.meta}>{item.bucket_id} · {formatBytes(item.size_bytes)}{item.mimetype ? ` · ${item.mimetype}` : ''}</Text>
                    </View>
                  </View>

                  <View style={styles.badges}>
                    {orphan ? <Text style={styles.warningBadge}>Sahipsiz aday</Text> : <Text style={styles.okBadge}>Referanslı / genel</Text>}
                    {item.cleanup_status ? <Text style={styles.statusBadge}>Temizleme: {item.cleanup_status}</Text> : null}
                  </View>

                  <Text style={styles.dateText}>{new Date(item.created_at).toLocaleString('tr-TR')}</Text>

                  {orphan && !item.cleanup_status ? (
                    <Pressable disabled={busy} onPress={() => void markCleanup(item)} style={styles.actionButton}>
                      <Text style={styles.actionButtonText}>{busy ? 'İşleniyor...' : 'Temizleme adayı yap'}</Text>
                    </Pressable>
                  ) : null}

                  {item.cleanup_status === 'pending' ? (
                    <View style={styles.actionsRow}>
                      <Pressable disabled={busy} onPress={() => void reviewCleanup(item, 'approved')} style={styles.approveButton}><Text style={styles.actionButtonText}>Onayla</Text></Pressable>
                      <Pressable disabled={busy} onPress={() => void reviewCleanup(item, 'rejected')} style={styles.rejectButton}><Text style={styles.rejectText}>Reddet</Text></Pressable>
                    </View>
                  ) : null}
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
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 18, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  headerCopy: { flex: 1, marginHorizontal: 14 },
  eyebrow: { color: '#A985FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#F5F5F8', fontSize: 24, fontWeight: '900' },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  metricCard: { flex: 1, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934', borderRadius: 16, padding: 15 },
  metricValue: { color: '#F5F5F8', fontSize: 21, fontWeight: '900' },
  metricLabel: { color: '#8E8E9D', fontSize: 12, marginTop: 4 },
  sectionTitle: { color: '#F5F5F8', fontSize: 17, fontWeight: '800', marginBottom: 10 },
  chips: { gap: 8, paddingBottom: 14 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#30303D' },
  chipActive: { backgroundColor: '#21182F', borderColor: '#6C3CC5' },
  chipText: { color: '#A5A5B3', fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#D9C9FF' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, height: 44, borderRadius: 13, paddingHorizontal: 14, color: '#F5F5F8', backgroundColor: '#15151D', borderWidth: 1, borderColor: '#30303D' },
  searchButton: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6C3CC5' },
  orphanToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, marginBottom: 12 },
  orphanToggleActive: { opacity: 1 },
  orphanToggleText: { color: '#A5A5B3', fontSize: 13, fontWeight: '700' },
  infoCard: { flexDirection: 'row', gap: 10, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#302246', borderRadius: 15, padding: 13, marginBottom: 20 },
  infoText: { flex: 1, color: '#A5A5B3', fontSize: 12, lineHeight: 18 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  loadingText: { color: '#8E8E9D', marginTop: 9 },
  empty: { padding: 24, alignItems: 'center', backgroundColor: '#15151D', borderRadius: 16 },
  emptyTitle: { color: '#F5F5F8', fontWeight: '800' },
  emptyText: { color: '#8E8E9D', fontSize: 12, marginTop: 5 },
  list: { gap: 10 },
  card: { padding: 14, borderRadius: 16, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  fileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#21182F' },
  cardCopy: { flex: 1, marginLeft: 11 },
  fileName: { color: '#F5F5F8', fontSize: 14, fontWeight: '800' },
  meta: { color: '#8E8E9D', fontSize: 11, marginTop: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  warningBadge: { color: '#E9B96E', backgroundColor: '#2A2115', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 11, fontWeight: '800' },
  okBadge: { color: '#9ECFA9', backgroundColor: '#17251B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 11, fontWeight: '800' },
  statusBadge: { color: '#CDB9FF', backgroundColor: '#21182F', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 11, fontWeight: '800' },
  dateText: { marginTop: 9, color: '#747483', fontSize: 11 },
  actionButton: { marginTop: 12, backgroundColor: '#6C3CC5', paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveButton: { flex: 1, backgroundColor: '#6C3CC5', paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  rejectButton: { flex: 1, backgroundColor: '#201A21', borderWidth: 1, borderColor: '#4A3545', paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  rejectText: { color: '#E3B7C8', fontWeight: '800', fontSize: 12 },
});
