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

type HashtagRow = {
  tag: string;
  usage_count: number;
  post_count: number;
  review_count: number;
  blocked: boolean;
  featured: boolean;
  priority: number;
  updated_at: string | null;
};

export default function AdminHashtagsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<HashtagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [savingTag, setSavingTag] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  const loadHashtags = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (!access.canOpenAdmin) {
        router.replace('/');
        return;
      }
      setCanManage(access.role === 'admin' || access.role === 'super_admin');

      const { data, error } = await supabase.rpc('admin_list_hashtags');
      if (error) {
        console.error('Hashtag yönetimi yükleme hatası:', error);
        Alert.alert('Hata', error.message || 'Hashtagler yüklenemedi.');
        setRows([]);
        return;
      }

      setRows(
        ((data ?? []) as any[]).map((item) => ({
          tag: String(item.tag ?? ''),
          usage_count: Number(item.usage_count ?? 0),
          post_count: Number(item.post_count ?? 0),
          review_count: Number(item.review_count ?? 0),
          blocked: Boolean(item.blocked),
          featured: Boolean(item.featured),
          priority: Number(item.priority ?? 0),
          updated_at: item.updated_at ?? null,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadHashtags();
    }, [loadHashtags])
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR').replace(/^#/, '');
    if (!q) return rows;
    return rows.filter((item) => item.tag.toLocaleLowerCase('tr-TR').includes(q));
  }, [query, rows]);

  const updateControl = useCallback(
    async (item: HashtagRow, next: Partial<Pick<HashtagRow, 'blocked' | 'featured' | 'priority'>>) => {
      if (!canManage) return;
      const nextRow = { ...item, ...next };
      setSavingTag(item.tag);
      try {
        const { error } = await supabase.rpc('admin_set_hashtag_control', {
          p_tag: item.tag,
          p_blocked: nextRow.blocked,
          p_featured: nextRow.featured,
          p_priority: nextRow.priority,
        });

        if (error) {
          console.error('Hashtag kontrol güncelleme hatası:', error);
          Alert.alert('Kaydedilemedi', error.message || 'Hashtag ayarı güncellenemedi.');
          return;
        }

        setRows((current) => current.map((row) => (row.tag === item.tag ? nextRow : row)));
      } finally {
        setSavingTag(null);
      }
    },
    [canManage]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => safeBack(router, '/admin')} style={styles.headerButton}>
          <Feather name="chevron-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>YÖNETİM</Text>
          <Text style={styles.title}>Hashtag Yönetimi</Text>
        </View>
        <Pressable onPress={() => void loadHashtags()} style={styles.headerButton}>
          <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Feather name="search" size={17} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Hashtag ara..."
          placeholderTextColor="#686875"
          autoCapitalize="none"
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Hashtagler taranıyor...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.resultText}>{filteredRows.length} hashtag gösteriliyor</Text>

          {!canManage ? (
            <View style={styles.infoCard}>
              <Feather name="info" size={18} color={colors.primary} />
              <Text style={styles.infoText}>Moderatör hesabı kullanım istatistiklerini görebilir; ayar değiştirmek için admin yetkisi gerekir.</Text>
            </View>
          ) : null}

          {filteredRows.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="hash" size={28} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Hashtag bulunamadı</Text>
              <Text style={styles.emptyText}>Gönderi ve incelemelerde hashtag kullanıldığında burada görünür.</Text>
            </View>
          ) : (
            filteredRows.map((item) => {
              const busy = savingTag === item.tag;
              return (
                <View key={item.tag} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.tagIcon}>
                      <Feather name="hash" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.tagCopy}>
                      <Text style={styles.tag}>#{item.tag}</Text>
                      <Text style={styles.meta}>
                        {item.usage_count} kullanım · {item.post_count} gönderi · {item.review_count} inceleme
                      </Text>
                    </View>
                  </View>

                  <View style={styles.badges}>
                    {item.featured ? <Text style={styles.featuredBadge}>ÖNE ÇIKAN</Text> : null}
                    {item.blocked ? <Text style={styles.blockedBadge}>ENGELLİ</Text> : null}
                    {item.priority > 0 ? <Text style={styles.priorityBadge}>Öncelik {item.priority}</Text> : null}
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      disabled={!canManage || busy}
                      onPress={() => void updateControl(item, { featured: !item.featured })}
                      style={[styles.actionButton, item.featured && styles.actionButtonActive, (!canManage || busy) && styles.disabled]}
                    >
                      <Feather name="star" size={15} color={item.featured ? '#F5F5F8' : '#A985FF'} />
                      <Text style={[styles.actionText, item.featured && styles.actionTextActive]}>
                        {item.featured ? 'Öne Çıkarmayı Kaldır' : 'Öne Çıkar'}
                      </Text>
                    </Pressable>

                    <Pressable
                      disabled={!canManage || busy}
                      onPress={() => void updateControl(item, { blocked: !item.blocked })}
                      style={[styles.actionButton, item.blocked && styles.dangerButton, (!canManage || busy) && styles.disabled]}
                    >
                      <Feather name={item.blocked ? 'check-circle' : 'slash'} size={15} color={item.blocked ? '#FF8B94' : '#A985FF'} />
                      <Text style={[styles.actionText, item.blocked && styles.dangerText]}>
                        {item.blocked ? 'Engeli Kaldır' : 'Engelle'}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.priorityRow}>
                    <Text style={styles.priorityLabel}>Trend önceliği</Text>
                    <View style={styles.priorityControls}>
                      <Pressable
                        disabled={!canManage || busy || item.priority <= 0}
                        onPress={() => void updateControl(item, { priority: Math.max(0, item.priority - 1) })}
                        style={styles.smallButton}
                      >
                        <Feather name="minus" size={16} color={colors.textSecondary} />
                      </Pressable>
                      <Text style={styles.priorityValue}>{item.priority}</Text>
                      <Pressable
                        disabled={!canManage || busy}
                        onPress={() => void updateControl(item, { priority: item.priority + 1 })}
                        style={styles.smallButton}
                      >
                        <Feather name="plus" size={16} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E', paddingTop: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 12 },
  headerButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  headerCopy: { flex: 1, marginHorizontal: 14 },
  eyebrow: { color: '#A985FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 2, color: '#F5F5F8', fontSize: 24, fontWeight: '900' },
  searchWrap: { marginHorizontal: 18, height: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934', marginBottom: 12 },
  searchInput: { flex: 1, color: '#F5F5F8', fontSize: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, color: '#8E8E9D', fontSize: 13 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 48 },
  resultText: { color: '#777786', fontSize: 12, marginBottom: 10 },
  infoCard: { flexDirection: 'row', gap: 10, padding: 13, borderRadius: 14, backgroundColor: '#16131D', borderWidth: 1, borderColor: '#342742', marginBottom: 10 },
  infoText: { flex: 1, color: '#A8A0B5', fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934', borderRadius: 17, padding: 15, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  tagIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#21182F', alignItems: 'center', justifyContent: 'center' },
  tagCopy: { flex: 1, marginLeft: 11 },
  tag: { color: '#F5F5F8', fontSize: 16, fontWeight: '900' },
  meta: { color: '#7E7E8B', fontSize: 11, marginTop: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  featuredBadge: { color: '#D9CAFF', backgroundColor: '#2B1F3C', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 10, fontWeight: '900' },
  blockedBadge: { color: '#FF9AA1', backgroundColor: '#251416', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 10, fontWeight: '900' },
  priorityBadge: { color: '#AFAFB9', backgroundColor: '#202028', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 10, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 13 },
  actionButton: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#3A2C4C', backgroundColor: '#17131D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10 },
  actionButtonActive: { backgroundColor: '#2B1F3C', borderColor: '#654A8C' },
  actionText: { color: '#C8B8EE', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  actionTextActive: { color: '#F5F5F8' },
  dangerButton: { backgroundColor: '#211416', borderColor: '#5B2A30' },
  dangerText: { color: '#FF8B94' },
  disabled: { opacity: 0.45 },
  priorityRow: { marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#25252F', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priorityLabel: { color: '#A3A3AF', fontSize: 12, fontWeight: '700' },
  priorityControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#202028', alignItems: 'center', justifyContent: 'center' },
  priorityValue: { minWidth: 22, textAlign: 'center', color: '#F5F5F8', fontWeight: '900' },
  emptyCard: { marginTop: 60, alignItems: 'center', padding: 28, backgroundColor: '#15151D', borderRadius: 18, borderWidth: 1, borderColor: '#292934' },
  emptyTitle: { marginTop: 12, color: '#F5F5F8', fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 6, color: '#7E7E8B', fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
