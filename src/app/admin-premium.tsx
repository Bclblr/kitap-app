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

import Image from '@/components/SafeImage';
import { getCurrentAdminAccess } from '@/lib/admin';
import {
  resolvePremiumAccess,
  type PremiumEntitlement,
} from '@/lib/premium';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type PremiumUserRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  profile_image: string | null;
  isPremium: boolean;
  hasPaidPremium: boolean;
  hasAdminPremium: boolean;
  paidSources: Array<'apple' | 'google'>;
  nextExpirationAt: string | null;
  entitlements: PremiumEntitlement[];
};

function formatSource(user: PremiumUserRow) {
  const labels: string[] = [];
  if (user.paidSources.includes('apple')) labels.push('Apple');
  if (user.paidSources.includes('google')) labels.push('Google Play');
  if (user.hasAdminPremium) labels.push('Admin hediyesi');
  return labels.length ? labels.join(' + ') : 'Ücretsiz';
}

function formatDate(value: string | null) {
  if (!value) return 'Süresiz / bitiş yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih bilinmiyor';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export default function AdminPremiumScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [users, setUsers] = useState<PremiumUserRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const goBackSafely = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/admin');
  }, [router]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (!access.canManageUsers) {
        router.replace('/admin');
        return;
      }

      const [{ data: profiles, error: profileError }, { data: entitlements, error: entitlementError }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id, username, full_name, profile_image')
            .order('username', { ascending: true }),
          supabase
            .from('premium_entitlements')
            .select(
              'id, user_id, source, status, product_id, entitlement_id, source_reference, starts_at, expires_at, revoked_at, created_at, updated_at'
            )
            .order('created_at', { ascending: false }),
        ]);

      if (profileError) throw profileError;
      if (entitlementError) throw entitlementError;

      const entitlementMap = new Map<string, PremiumEntitlement[]>();
      for (const row of (entitlements ?? []) as PremiumEntitlement[]) {
        const current = entitlementMap.get(row.user_id) ?? [];
        current.push(row);
        entitlementMap.set(row.user_id, current);
      }

      setUsers(
        (profiles ?? []).map((profile) => {
          const rows = entitlementMap.get(profile.id) ?? [];
          const accessState = resolvePremiumAccess(rows);
          return {
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            profile_image: profile.profile_image,
            isPremium: accessState.isPremium,
            hasPaidPremium: accessState.hasPaidPremium,
            hasAdminPremium: accessState.hasAdminPremium,
            paidSources: accessState.paidSources,
            nextExpirationAt: accessState.nextExpirationAt,
            entitlements: rows,
          };
        })
      );
    } catch (error) {
      console.error('Premium yönetimi yüklenemedi:', error);
      Alert.alert('Hata', 'Premium kullanıcı bilgileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadUsers();
    }, [loadUsers])
  );

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR');
    if (!needle) return users;

    return users.filter((user) => {
      const username = (user.username ?? '').toLocaleLowerCase('tr-TR');
      const fullName = (user.full_name ?? '').toLocaleLowerCase('tr-TR');
      return username.includes(needle) || fullName.includes(needle) || user.id.toLowerCase().includes(needle);
    });
  }, [query, users]);

  const premiumCount = users.filter((user) => user.isPremium).length;
  const paidCount = users.filter((user) => user.hasPaidPremium).length;
  const adminCount = users.filter((user) => user.hasAdminPremium).length;

  const grantFreePremium = useCallback(
    async (user: PremiumUserRow) => {
      if (updatingId) return;
      if (user.hasAdminPremium) {
        Alert.alert('Bilgi', 'Bu kullanıcıya zaten admin tarafından Premium verilmiş.');
        return;
      }

      setUpdatingId(user.id);
      try {
        const { error } = await supabase.rpc('admin_grant_premium', {
          p_user_id: user.id,
          p_reason: 'Admin panelinden ücretsiz Premium verildi',
        });
        if (error) throw error;

        await loadUsers();
        Alert.alert('Premium verildi', `${user.username || 'Kullanıcı'} artık admin hediyesi Premium kullanıyor.`);
      } catch (error) {
        console.error('Ücretsiz Premium verilemedi:', error);
        Alert.alert('Hata', 'Ücretsiz Premium verilemedi. Yetki ve Supabase migration durumunu kontrol et.');
      } finally {
        setUpdatingId(null);
      }
    },
    [loadUsers, updatingId]
  );

  const revokeFreePremium = useCallback(
    (user: PremiumUserRow) => {
      if (updatingId || !user.hasAdminPremium) return;

      Alert.alert(
        'Admin Premium geri alınsın mı?',
        user.hasPaidPremium
          ? 'Yalnızca admin tarafından verilen Premium kaldırılacak. Kullanıcının ücretli Apple/Google Premium hakkı devam edecek.'
          : 'Yalnızca admin tarafından verilen Premium hakkı kaldırılacak.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Geri Al',
            style: 'destructive',
            onPress: async () => {
              setUpdatingId(user.id);
              try {
                const { error } = await supabase.rpc('admin_revoke_premium', {
                  p_user_id: user.id,
                  p_reason: 'Admin panelinden ücretsiz Premium geri alındı',
                });
                if (error) throw error;

                await loadUsers();
                Alert.alert(
                  'Admin Premium kaldırıldı',
                  user.hasPaidPremium
                    ? `${user.username || 'Kullanıcı'} ücretli Premium hakkını kullanmaya devam ediyor.`
                    : `${user.username || 'Kullanıcı'} artık admin hediyesi Premium kullanmıyor.`
                );
              } catch (error) {
                console.error('Admin Premium geri alınamadı:', error);
                Alert.alert('Hata', 'Admin Premium geri alınamadı. Yetki ve Supabase migration durumunu kontrol et.');
              } finally {
                setUpdatingId(null);
              }
            },
          },
        ]
      );
    },
    [loadUsers, updatingId]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Premium yönetimi yükleniyor...</Text>
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
            <Text style={styles.eyebrow}>YÖNETİM</Text>
            <Text style={styles.title}>Premium Yönetimi</Text>
          </View>
          <Pressable onPress={() => void loadUsers()} style={styles.headerButton}>
            <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{premiumCount.toLocaleString('tr-TR')}</Text>
            <Text style={styles.summaryLabel}>Aktif Premium</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{paidCount.toLocaleString('tr-TR')}</Text>
            <Text style={styles.summaryLabel}>Ücretli</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{adminCount.toLocaleString('tr-TR')}</Text>
            <Text style={styles.summaryLabel}>Admin hediyesi</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Feather name="gift" size={18} color={colors.primary} />
          <Text style={styles.infoText}>
            Admin hediyesi Premium, Apple veya Google Play aboneliğinden tamamen bağımsızdır. Admin Premium geri alınsa bile aktif ücretli abonelik varsa kullanıcının Premium erişimi devam eder.
          </Text>
        </View>

        <View style={styles.searchBox}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Kullanıcı adı, ad soyad veya UUID ara"
            placeholderTextColor="#747483"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
        </View>

        <Text style={styles.resultText}>{filteredUsers.length} kullanıcı gösteriliyor</Text>

        <View style={styles.userList}>
          {filteredUsers.map((user) => {
            const updating = updatingId === user.id;
            return (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  {user.profile_image ? (
                    <Image source={{ uri: user.profile_image }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Feather name="user" size={20} color={colors.textSecondary} />
                    </View>
                  )}

                  <View style={styles.userCopy}>
                    <Text style={styles.username}>{user.username || 'Kitap Okuru'}</Text>
                    <Text style={styles.fullName}>{user.full_name || 'Ad soyad belirtilmemiş'}</Text>
                    <Text style={styles.userId} numberOfLines={1}>{user.id}</Text>
                  </View>

                  <View style={[styles.statusBadge, user.isPremium && styles.statusBadgeActive]}>
                    <Text style={[styles.statusBadgeText, user.isPremium && styles.statusBadgeTextActive]}>
                      {user.isPremium ? 'PREMIUM' : 'FREE'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Kaynak</Text>
                    <Text style={styles.detailValue}>{formatSource(user)}</Text>
                  </View>
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>En yakın bitiş</Text>
                    <Text style={styles.detailValue}>{user.isPremium ? formatDate(user.nextExpirationAt) : '—'}</Text>
                  </View>
                </View>

                {user.hasAdminPremium ? (
                  <Pressable
                    onPress={() => revokeFreePremium(user)}
                    disabled={updating || updatingId !== null}
                    style={[
                      styles.revokeButton,
                      (updating || (updatingId !== null && !updating)) && styles.grantButtonDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${user.username || 'Kullanıcı'} kullanıcısının admin Premium hakkını geri al`}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFB4BC" />
                    ) : (
                      <Feather name="x-circle" size={17} color="#FFB4BC" />
                    )}
                    <Text style={styles.revokeButtonText}>Admin Premium'u Geri Al</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => void grantFreePremium(user)}
                    disabled={updating || updatingId !== null}
                    style={[
                      styles.grantButton,
                      (updating || (updatingId !== null && !updating)) && styles.grantButtonDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${user.username || 'Kullanıcı'} kullanıcısına ücretsiz Premium ver`}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Feather name="gift" size={17} color="#FFFFFF" />
                    )}
                    <Text style={styles.grantButtonText}>Ücretsiz Premium Ver</Text>
                  </Pressable>
                )}

                {user.entitlements.length > 0 ? (
                  <Text style={styles.historyText}>
                    Toplam {user.entitlements.length} Premium kaydı
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {filteredUsers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="search" size={24} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Kullanıcı bulunamadı</Text>
            <Text style={styles.emptyText}>Arama kelimesini değiştirip tekrar dene.</Text>
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
  summaryCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#15151D', borderRadius: 17, borderWidth: 1, borderColor: '#292934', marginBottom: 12 },
  summaryItem: { flex: 1 },
  summaryValue: { color: '#F5F5F8', fontSize: 21, fontWeight: '900' },
  summaryLabel: { marginTop: 3, color: '#8E8E9D', fontSize: 11 },
  summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: '#30303D', marginHorizontal: 12 },
  infoCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 13, borderRadius: 14, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934', marginBottom: 14 },
  infoText: { flex: 1, color: '#A5A5B3', fontSize: 12, lineHeight: 18 },
  searchBox: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, backgroundColor: '#15151D', borderRadius: 15, borderWidth: 1, borderColor: '#292934' },
  searchInput: { flex: 1, color: '#F5F5F8', fontSize: 14 },
  resultText: { color: '#747483', fontSize: 12, marginTop: 12, marginBottom: 9 },
  userList: { gap: 10 },
  userCard: { padding: 14, backgroundColor: '#15151D', borderRadius: 17, borderWidth: 1, borderColor: '#292934' },
  userHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarPlaceholder: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#20202A' },
  userCopy: { flex: 1, marginLeft: 11, minWidth: 0 },
  username: { color: '#F5F5F8', fontSize: 15, fontWeight: '800' },
  fullName: { marginTop: 2, color: '#A5A5B3', fontSize: 12 },
  userId: { marginTop: 3, color: '#686876', fontSize: 10 },
  statusBadge: { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#17171E', borderWidth: 1, borderColor: '#30303D' },
  statusBadgeActive: { backgroundColor: '#2B1E3E', borderColor: '#60458A' },
  statusBadgeText: { color: '#8E8E9D', fontSize: 10, fontWeight: '900' },
  statusBadgeTextActive: { color: '#C8B8FF' },
  detailRow: { flexDirection: 'row', gap: 12, marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#292934' },
  detailBlock: { flex: 1 },
  detailLabel: { color: '#747483', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  detailValue: { marginTop: 4, color: '#D4D4DC', fontSize: 12, fontWeight: '700' },
  grantButton: { marginTop: 13, minHeight: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6C3CC5', borderWidth: 1, borderColor: '#8B67D5' },
  grantButtonDisabled: { opacity: 0.6 },
  grantButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  revokeButton: { marginTop: 13, minHeight: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#281419', borderWidth: 1, borderColor: '#6E303A' },
  revokeButtonText: { color: '#FFB4BC', fontSize: 12, fontWeight: '900' },
  historyText: { marginTop: 9, color: '#747483', fontSize: 11 },
  emptyCard: { marginTop: 24, alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  emptyTitle: { marginTop: 10, color: '#F5F5F8', fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 5, color: '#8E8E9D', fontSize: 12, textAlign: 'center' },
});
