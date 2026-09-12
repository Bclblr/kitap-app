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
  View,
} from 'react-native';

import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type ContentKind = 'post' | 'review' | 'quote' | 'post_comment' | 'comment';

type ContentTab = {
  key: ContentKind;
  label: string;
  table: string;
  icon: keyof typeof Feather.glyphMap;
};

type ContentRow = {
  id: string;
  user_id?: string | null;
  text?: string | null;
  book_title?: string | null;
  created_at?: string | null;
  post_id?: string | null;
  review_id?: string | null;
  username?: string | null;
};

const TABS: ContentTab[] = [
  { key: 'post', label: 'Gönderiler', table: 'posts', icon: 'edit' },
  { key: 'review', label: 'İncelemeler', table: 'reviews', icon: 'star' },
  { key: 'quote', label: 'Alıntılar', table: 'quotes', icon: 'message-square' },
  { key: 'post_comment', label: 'Gönderi Yorumları', table: 'post_comments', icon: 'message-circle' },
  { key: 'comment', label: 'İnceleme Yorumları', table: 'comments', icon: 'message-circle' },
];

function formatDate(value?: string | null) {
  if (!value) return 'Tarih yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('tr-TR');
}

export default function AdminContentScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [activeTab, setActiveTab] = useState<ContentKind>('post');
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const tab = useMemo(() => TABS.find((item) => item.key === activeTab) ?? TABS[0], [activeTab]);

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (!access.canOpenAdmin) {
        router.replace('/');
        return;
      }

      const currentTab = TABS.find((item) => item.key === activeTab) ?? TABS[0];
      const { data, error } = await supabase
        .from(currentTab.table)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error(`Admin içerik yükleme hatası (${currentTab.table}):`, error);
        Alert.alert('Hata', 'İçerikler yüklenemedi.');
        setRows([]);
        return;
      }

      const rawRows = (data ?? []) as ContentRow[];
      const userIds = Array.from(new Set(rawRows.map((item) => item.user_id).filter(Boolean))) as string[];
      let profileMap = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);

        profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile.username || 'Kitap Okuru']));
      }

      setRows(
        rawRows.map((item) => ({
          ...item,
          username: item.user_id ? profileMap.get(item.user_id) ?? 'Kitap Okuru' : 'Bilinmeyen kullanıcı',
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab, router]);

  useFocusEffect(
    useCallback(() => {
      void loadContent();
    }, [loadContent])
  );

  const deleteContent = useCallback(
    async (item: ContentRow) => {
      setDeletingId(item.id);
      try {
        const { error } = await supabase.rpc('admin_delete_content', {
          p_target_type: activeTab,
          p_target_id: item.id,
          p_reason: 'Admin panelinden çöp kutusuna taşındı',
        });

        if (error) {
          console.error('İçerik kaldırma hatası:', error);
          Alert.alert('Taşınamadı', error.message || 'İçerik çöp kutusuna taşınırken bir hata oluştu.');
          return;
        }

        setRows((current) => current.filter((row) => row.id !== item.id));
      } finally {
        setDeletingId(null);
      }
    },
    [activeTab]
  );

  const askDelete = useCallback(
    (item: ContentRow) => {
      Alert.alert(
        'Çöp kutusuna taşı',
        'Bu içerik uygulamadan kaldırılıp çöp kutusuna taşınacak. Daha sonra geri yüklenebilir. Devam edilsin mi?',
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Çöp Kutusuna Taşı', style: 'destructive', onPress: () => void deleteContent(item) },
        ]
      );
    },
    [deleteContent]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Feather name="chevron-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>YÖNETİM</Text>
          <Text style={styles.title}>İçerik Yönetimi</Text>
        </View>
        <Pressable onPress={() => void loadContent()} style={styles.headerButton}>
          <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((item) => {
          const active = item.key === activeTab;
          return (
            <Pressable
              key={item.key}
              onPress={() => setActiveTab(item.key)}
              style={[styles.tabButton, active && styles.tabButtonActive]}
            >
              <Feather name={item.icon} size={15} color={active ? '#F5F5F8' : '#8E8E9D'} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{tab.label} yükleniyor...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.resultText}>Son {rows.length} kayıt gösteriliyor</Text>

          {rows.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="inbox" size={28} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>İçerik bulunamadı</Text>
              <Text style={styles.emptyText}>Bu kategoride gösterilecek kayıt yok.</Text>
            </View>
          ) : (
            rows.map((item) => {
              const parentId = item.post_id || item.review_id;
              const body = item.text?.trim() || item.book_title?.trim() || 'Metin içeriği yok';
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardIdentity}>
                      <View style={styles.avatar}>
                        <Feather name="user" size={16} color={colors.primary} />
                      </View>
                      <View style={styles.identityCopy}>
                        <Text style={styles.username}>{item.username || 'Kitap Okuru'}</Text>
                        <Text style={styles.meta}>{formatDate(item.created_at)}</Text>
                      </View>
                    </View>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{tab.label}</Text>
                    </View>
                  </View>

                  {item.book_title ? <Text style={styles.bookTitle}>{item.book_title}</Text> : null}
                  <Text style={styles.bodyText} numberOfLines={8}>{body}</Text>

                  <View style={styles.idsBox}>
                    <Text style={styles.idText}>ID: {item.id}</Text>
                    {item.user_id ? <Text style={styles.idText}>Kullanıcı: {item.user_id}</Text> : null}
                    {parentId ? <Text style={styles.idText}>Bağlı içerik: {parentId}</Text> : null}
                  </View>

                  <Pressable
                    onPress={() => askDelete(item)}
                    disabled={deletingId === item.id}
                    style={[styles.deleteButton, deletingId === item.id && styles.disabledButton]}
                  >
                    <Feather name="trash-2" size={16} color="#FF7D86" />
                    <Text style={styles.deleteText}>
                      {deletingId === item.id ? 'Taşınıyor...' : 'Çöp Kutusuna Taşı'}
                    </Text>
                  </Pressable>
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
  tabs: { paddingHorizontal: 18, gap: 8, paddingBottom: 12 },
  tabButton: { height: 38, paddingHorizontal: 13, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#14141B', borderWidth: 1, borderColor: '#292934' },
  tabButtonActive: { backgroundColor: '#2B1F3C', borderColor: '#654A8C' },
  tabText: { color: '#8E8E9D', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#F5F5F8' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, color: '#8E8E9D', fontSize: 13 },
  listContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 48 },
  resultText: { color: '#777786', fontSize: 12, marginBottom: 10 },
  card: { backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934', borderRadius: 17, padding: 15, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#21182F', alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1, marginLeft: 10 },
  username: { color: '#F5F5F8', fontSize: 14, fontWeight: '800' },
  meta: { color: '#777786', fontSize: 11, marginTop: 2 },
  typeBadge: { backgroundColor: '#21182F', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  typeBadgeText: { color: '#BFA9F4', fontSize: 10, fontWeight: '800' },
  bookTitle: { marginTop: 13, color: '#CDBBFF', fontSize: 13, fontWeight: '800' },
  bodyText: { marginTop: 9, color: '#D7D7DF', fontSize: 14, lineHeight: 20 },
  idsBox: { marginTop: 13, padding: 10, backgroundColor: '#101015', borderRadius: 11, gap: 4 },
  idText: { color: '#696978', fontSize: 10 },
  deleteButton: { marginTop: 13, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#54272E', backgroundColor: '#201317', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: '#FF7D86', fontSize: 13, fontWeight: '800' },
  disabledButton: { opacity: 0.5 },
  emptyCard: { marginTop: 60, alignItems: 'center', padding: 28, backgroundColor: '#15151D', borderRadius: 18, borderWidth: 1, borderColor: '#292934' },
  emptyTitle: { marginTop: 12, color: '#F5F5F8', fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 6, color: '#7E7E8B', fontSize: 13, textAlign: 'center' },
});
