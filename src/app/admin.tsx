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

import { getCurrentAdminAccess, type AdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type DashboardCounts = {
  users: number | null;
  posts: number | null;
  reviews: number | null;
  quotes: number | null;
  comments: number | null;
  communities: number | null;
  events: number | null;
  pendingReports: number | null;
};

type AdminModule = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  route?: string;
  minimumRole?: 'moderator' | 'admin' | 'super_admin';
};

const EMPTY_COUNTS: DashboardCounts = {
  users: null,
  posts: null,
  reviews: null,
  quotes: null,
  comments: null,
  communities: null,
  events: null,
  pendingReports: null,
};

const MODULES: AdminModule[] = [
  { key: 'users', title: 'Kullanıcılar', subtitle: 'Hesaplar, roller, rozetler ve yaptırımlar', icon: 'users', minimumRole: 'admin' },
  { key: 'content', title: 'İçerikler', subtitle: 'Gönderi, inceleme, alıntı ve yorum yönetimi', icon: 'file-text' },
  { key: 'reports', title: 'Moderasyon', subtitle: 'Şikâyetler, spam ve kullanıcı raporları', icon: 'shield' },
  { key: 'hashtags', title: 'Hashtagler', subtitle: 'Trend, engelleme ve öne çıkarma', icon: 'hash' },
  { key: 'explore', title: 'Keşfet', subtitle: 'Gündem, öne çıkanlar ve sıralama', icon: 'compass', minimumRole: 'admin' },
  { key: 'books', title: 'Kitaplar', subtitle: 'Kitap kataloğu, kapak ve eşleştirmeler', icon: 'book-open', minimumRole: 'admin' },
  { key: 'authors', title: 'Yazarlar', subtitle: 'Yazar profilleri ve birleştirme işlemleri', icon: 'edit-3', minimumRole: 'admin' },
  { key: 'communities', title: 'Topluluklar', subtitle: 'Kulüpler, üyeler, yöneticiler ve doğrulama', icon: 'users' },
  { key: 'events', title: 'Etkinlikler', subtitle: 'Etkinlik, katılımcı ve öne çıkarma', icon: 'calendar' },
  { key: 'notifications', title: 'Bildirimler', subtitle: 'Tek kullanıcıya, gruba veya herkese gönderim', icon: 'bell', minimumRole: 'admin' },
  { key: 'announcements', title: 'Duyurular', subtitle: 'Banner, bakım ve özellik duyuruları', icon: 'volume-2', minimumRole: 'admin' },
  { key: 'files', title: 'Dosyalar', subtitle: 'Storage görselleri ve sahipsiz dosyalar', icon: 'image', minimumRole: 'admin' },
  { key: 'analytics', title: 'Analitik', subtitle: 'Büyüme, etkileşim ve arama metrikleri', icon: 'bar-chart-2', minimumRole: 'admin' },
  { key: 'system', title: 'Sistem', subtitle: 'Feature flags, sürüm ve bakım modu', icon: 'settings', minimumRole: 'admin' },
  { key: 'admins', title: 'Adminler', subtitle: 'Admin hesapları ve yetki seviyeleri', icon: 'key', minimumRole: 'super_admin' },
  { key: 'audit', title: 'İşlem Geçmişi', subtitle: 'Tüm yönetici işlemlerinin kayıtları', icon: 'clock', minimumRole: 'admin' },
];

function roleRank(role: AdminAccess['role']) {
  if (role === 'super_admin') return 3;
  if (role === 'admin') return 2;
  if (role === 'moderator') return 1;
  return 0;
}

function minimumRank(role?: AdminModule['minimumRole']) {
  if (role === 'super_admin') return 3;
  if (role === 'admin') return 2;
  if (role === 'moderator') return 1;
  return 1;
}

export default function AdminScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [counts, setCounts] = useState<DashboardCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);

  const loadCount = useCallback(async (table: string, filter?: { column: string; value: string }) => {
    let query = supabase.from(table).select('*', { count: 'exact', head: true });
    if (filter) query = query.eq(filter.column, filter.value);
    const { count, error } = await query;
    if (error) {
      console.warn(`Admin count error (${table}):`, error.message);
      return null;
    }
    return count ?? 0;
  }, []);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const nextAccess = await getCurrentAdminAccess();
      setAccess(nextAccess);

      if (!nextAccess.canOpenAdmin) {
        setCounts(EMPTY_COUNTS);
        return;
      }

      const [users, posts, reviews, quotes, postComments, reviewComments, communities, events, pendingReports] = await Promise.all([
        loadCount('profiles'),
        loadCount('posts'),
        loadCount('reviews'),
        loadCount('quotes'),
        loadCount('post_comments'),
        loadCount('comments'),
        loadCount('communities'),
        loadCount('events'),
        loadCount('reports', { column: 'status', value: 'pending' }),
      ]);

      setCounts({
        users,
        posts,
        reviews,
        quotes,
        comments:
          postComments === null && reviewComments === null
            ? null
            : (postComments ?? 0) + (reviewComments ?? 0),
        communities,
        events,
        pendingReports,
      });
    } finally {
      setLoading(false);
    }
  }, [loadCount]);

  useFocusEffect(
    useCallback(() => {
      void loadAdmin();
    }, [loadAdmin])
  );

  const visibleModules = useMemo(() => {
    if (!access) return [];
    return MODULES.filter((item) => roleRank(access.role) >= minimumRank(item.minimumRole));
  }, [access]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Yönetim paneli yükleniyor...</Text>
      </View>
    );
  }

  if (!access?.canOpenAdmin) {
    return (
      <View style={styles.centered}>
        <View style={styles.deniedIcon}>
          <Feather name="shield" size={28} color={colors.textSecondary} />
        </View>
        <Text style={styles.deniedTitle}>Yetkisiz erişim</Text>
        <Text style={styles.deniedText}>Bu alan yalnızca yetkili hesaplar tarafından kullanılabilir.</Text>
        <Pressable onPress={() => router.back()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Geri dön</Text>
        </Pressable>
      </View>
    );
  }

  const metrics = [
    ['Kullanıcı', counts.users],
    ['Gönderi', counts.posts],
    ['İnceleme', counts.reviews],
    ['Alıntı', counts.quotes],
    ['Yorum', counts.comments],
    ['Topluluk', counts.communities],
    ['Etkinlik', counts.events],
    ['Bekleyen şikâyet', counts.pendingReports],
  ] as const;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>YÖNETİM</Text>
            <Text style={styles.title}>Admin Paneli</Text>
          </View>
          <Pressable onPress={() => void loadAdmin()} style={styles.headerButton}>
            <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.roleCard}>
          <View style={styles.roleIcon}>
            <Feather name="shield" size={22} color={colors.primary} />
          </View>
          <View style={styles.roleCopy}>
            <Text style={styles.roleLabel}>Oturum yetkisi</Text>
            <Text style={styles.roleValue}>{access.role.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Genel Bakış</Text>
        <View style={styles.metricsGrid}>
          {metrics.map(([label, value]) => (
            <View key={label} style={styles.metricCard}>
              <Text style={styles.metricValue}>{value === null ? '—' : value.toLocaleString('tr-TR')}</Text>
              <Text style={styles.metricLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Yönetim Araçları</Text>
        <View style={styles.moduleList}>
          {visibleModules.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => {
                if (item.route) router.push(item.route as never);
              }}
              style={styles.moduleCard}
            >
              <View style={styles.moduleIcon}>
                <Feather name={item.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.moduleCopy}>
                <Text style={styles.moduleTitle}>{item.title}</Text>
                <Text style={styles.moduleSubtitle}>{item.subtitle}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.footerNote}>
          İlk sürümde yetki kontrolü ve temel dashboard hazır. Yönetim modülleri bundan sonra tek tek bu panele bağlanacak.
        </Text>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#0A0A0E',
  },
  loadingText: { marginTop: 12, color: '#A5A5B3', fontSize: 14 },
  deniedIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15151D',
    borderWidth: 1,
    borderColor: '#30303D',
  },
  deniedTitle: { marginTop: 18, color: '#F5F5F8', fontSize: 22, fontWeight: '800' },
  deniedText: { marginTop: 8, color: '#A5A5B3', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  primaryButton: { marginTop: 22, backgroundColor: '#6C3CC5', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  headerCopy: { flex: 1, marginHorizontal: 14 },
  eyebrow: { color: '#A985FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 2, color: '#F5F5F8', fontSize: 25, fontWeight: '900' },
  roleCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#30303D', marginBottom: 22 },
  roleIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#21182F' },
  roleCopy: { marginLeft: 13 },
  roleLabel: { color: '#8E8E9D', fontSize: 12 },
  roleValue: { marginTop: 3, color: '#F5F5F8', fontSize: 15, fontWeight: '800' },
  sectionTitle: { color: '#F5F5F8', fontSize: 17, fontWeight: '850', marginBottom: 11, marginTop: 2 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  metricCard: { width: '48%', minWidth: 145, flexGrow: 1, padding: 15, borderRadius: 16, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  metricValue: { color: '#F5F5F8', fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#8E8E9D', marginTop: 5, fontSize: 12 },
  moduleList: { gap: 9 },
  moduleCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  moduleIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#21182F' },
  moduleCopy: { flex: 1, marginHorizontal: 12 },
  moduleTitle: { color: '#F5F5F8', fontSize: 15, fontWeight: '800' },
  moduleSubtitle: { marginTop: 3, color: '#8E8E9D', fontSize: 12, lineHeight: 17 },
  footerNote: { marginTop: 22, color: '#747483', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
