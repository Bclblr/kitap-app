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
import Image from '@/components/SafeImage';
import { getCurrentAdminAccess, type AppRole } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type UserRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  profile_image: string | null;
  role: AppRole;
  isVerified: boolean;
};

const ROLES: AppRole[] = ['user', 'moderator', 'admin', 'super_admin'];

const ROLE_LABELS: Record<AppRole, string> = {
  user: 'Kullanıcı',
  moderator: 'Moderatör',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

export default function AdminUsersScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [canManageAdmins, setCanManageAdmins] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();

      if (!access.canManageUsers) {
        router.replace('/admin');
        return;
      }

      setCanManageAdmins(access.canManageAdmins);

      const [
        { data: profiles, error: profileError },
        { data: roles, error: roleError },
        { data: verifiedRows, error: verifiedError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, full_name, profile_image')
          .order('username', { ascending: true }),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('verified_accounts').select('user_id, is_verified'),
      ]);

      if (profileError) throw profileError;
      if (roleError) throw roleError;
      if (verifiedError) throw verifiedError;

      const roleMap = new Map<string, AppRole>();
      for (const row of roles ?? []) {
        const role = row.role as AppRole;
        if (ROLES.includes(role)) roleMap.set(row.user_id, role);
      }

      const verifiedMap = new Map<string, boolean>();
      for (const row of verifiedRows ?? []) {
        verifiedMap.set(row.user_id, row.is_verified === true);
      }

      setUsers(
        (profiles ?? []).map((profile) => ({
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name,
          profile_image: profile.profile_image,
          role: roleMap.get(profile.id) ?? 'user',
          isVerified: verifiedMap.get(profile.id) ?? false,
        }))
      );
    } catch (error) {
      console.error('Kullanıcı yönetimi yüklenemedi:', error);
      Alert.alert('Hata', 'Kullanıcılar yüklenemedi.');
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

  async function changeRole(user: UserRow, nextRole: AppRole) {
    if (!canManageAdmins) {
      Alert.alert('Yetki gerekli', 'Kullanıcı rollerini yalnızca Super Admin değiştirebilir.');
      return;
    }

    if (user.role === nextRole) return;

    setUpdatingId(user.id);
    try {
      const { error } = await supabase.rpc('admin_set_user_role', {
        p_user_id: user.id,
        p_role: nextRole,
      });

      if (error) throw error;

      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, role: nextRole } : item))
      );
    } catch (error) {
      console.error('Rol değiştirilemedi:', error);
      Alert.alert('Hata', 'Kullanıcı rolü değiştirilemedi.');
    } finally {
      setUpdatingId(null);
    }
  }

  const grantVerification = useCallback(
    async (user: UserRow) => {
      if (updatingId || user.isVerified) return;

      setUpdatingId(user.id);
      try {
        const { error } = await supabase.rpc('admin_grant_verification', {
          p_user_id: user.id,
          p_reason: 'Admin panelinden doğrulanmış hesap rozeti verildi',
        });
        if (error) throw error;

        setUsers((current) =>
          current.map((item) => (item.id === user.id ? { ...item, isVerified: true } : item))
        );

        Alert.alert(
          'Hesap doğrulandı',
          `${user.username || 'Kullanıcı'} için doğrulanmış hesap rozeti aktif edildi.`
        );
      } catch (error) {
        console.error('Doğrulanmış hesap rozeti verilemedi:', error);
        Alert.alert('Hata', 'Doğrulanmış hesap rozeti verilemedi. Supabase migration ve admin yetkisini kontrol et.');
      } finally {
        setUpdatingId(null);
      }
    },
    [updatingId]
  );

  const revokeVerification = useCallback(
    (user: UserRow) => {
      if (updatingId || !user.isVerified) return;

      Alert.alert(
        'Doğrulama rozeti kaldırılsın mı?',
        'Bu işlem yalnızca doğrulanmış hesap rozetini kaldırır. Kullanıcının Premium durumu etkilenmez.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Rozeti Kaldır',
            style: 'destructive',
            onPress: async () => {
              setUpdatingId(user.id);
              try {
                const { error } = await supabase.rpc('admin_revoke_verification', {
                  p_user_id: user.id,
                  p_reason: 'Admin panelinden doğrulanmış hesap rozeti geri alındı',
                });
                if (error) throw error;

                setUsers((current) =>
                  current.map((item) => (item.id === user.id ? { ...item, isVerified: false } : item))
                );

                Alert.alert(
                  'Rozet kaldırıldı',
                  `${user.username || 'Kullanıcı'} artık doğrulanmış hesap rozeti kullanmıyor.`
                );
              } catch (error) {
                console.error('Doğrulanmış hesap rozeti geri alınamadı:', error);
                Alert.alert('Hata', 'Doğrulanmış hesap rozeti geri alınamadı. Supabase migration ve admin yetkisini kontrol et.');
              } finally {
                setUpdatingId(null);
              }
            },
          },
        ]
      );
    },
    [updatingId]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Kullanıcılar yükleniyor...</Text>
      </View>
    );
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
            <Text style={styles.title}>Kullanıcılar</Text>
          </View>
          <Pressable onPress={() => void loadUsers()} style={styles.headerButton}>
            <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryValue}>{users.length.toLocaleString('tr-TR')}</Text>
            <Text style={styles.summaryLabel}>Profil</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View>
            <Text style={styles.summaryValue}>
              {users.filter((user) => user.role !== 'user').length.toLocaleString('tr-TR')}
            </Text>
            <Text style={styles.summaryLabel}>Yetkili hesap</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View>
            <Text style={styles.summaryValue}>
              {users.filter((user) => user.isVerified).length.toLocaleString('tr-TR')}
            </Text>
            <Text style={styles.summaryLabel}>Doğrulanmış</Text>
          </View>
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
                    <View style={styles.usernameRow}>
                      <Text style={styles.username}>{user.username || 'Kitap Okuru'}</Text>
                      {user.isVerified ? (
                        <View style={styles.verifiedIcon} accessibilityLabel="Doğrulanmış hesap">
                          <Feather name="check" size={11} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.fullName}>{user.full_name || 'Ad soyad belirtilmemiş'}</Text>
                    <Text style={styles.userId} numberOfLines={1}>{user.id}</Text>
                  </View>

                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{ROLE_LABELS[user.role]}</Text>
                  </View>
                </View>

                <View style={styles.verificationRow}>
                  <View style={styles.verificationCopy}>
                    <Text style={styles.verificationLabel}>Doğrulanmış hesap</Text>
                    <Text style={styles.verificationValue}>
                      {user.isVerified ? 'Rozet aktif' : 'Rozet verilmemiş'}
                    </Text>
                  </View>

                  {user.isVerified ? (
                    <Pressable
                      onPress={() => revokeVerification(user)}
                      disabled={updating || updatingId !== null}
                      style={[
                        styles.revokeVerifyButton,
                        (updating || (updatingId !== null && !updating)) && styles.verifyButtonDisabled,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${user.username || 'Kullanıcı'} kullanıcısının doğrulanmış hesap rozetini kaldır`}
                    >
                      {updating ? (
                        <ActivityIndicator size="small" color="#FFB4BC" />
                      ) : (
                        <Feather name="x-circle" size={16} color="#FFB4BC" />
                      )}
                      <Text style={styles.revokeVerifyButtonText}>Rozeti Kaldır</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => void grantVerification(user)}
                      disabled={updating || updatingId !== null}
                      style={[
                        styles.verifyButton,
                        (updating || (updatingId !== null && !updating)) && styles.verifyButtonDisabled,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${user.username || 'Kullanıcı'} kullanıcısına doğrulanmış hesap rozeti ver`}
                    >
                      {updating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Feather name="award" size={16} color="#FFFFFF" />
                      )}
                      <Text style={styles.verifyButtonText}>Rozet Ver</Text>
                    </Pressable>
                  )}
                </View>

                {canManageAdmins ? (
                  <View style={styles.roleRow}>
                    {ROLES.map((role) => {
                      const active = role === user.role;
                      return (
                        <Pressable
                          key={role}
                          disabled={updatingId === user.id}
                          onPress={() => void changeRole(user, role)}
                          style={[styles.roleButton, active && styles.roleButtonActive]}
                        >
                          <Text style={[styles.roleButtonText, active && styles.roleButtonTextActive]}>
                            {ROLE_LABELS[role]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {filteredUsers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="users" size={24} color={colors.textMuted} />
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
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 22, padding: 16, backgroundColor: '#15151D', borderRadius: 17, borderWidth: 1, borderColor: '#292934', marginBottom: 14 },
  summaryValue: { color: '#F5F5F8', fontSize: 21, fontWeight: '900' },
  summaryLabel: { marginTop: 3, color: '#8E8E9D', fontSize: 12 },
  summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: '#30303D' },
  searchBox: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, backgroundColor: '#15151D', borderRadius: 15, borderWidth: 1, borderColor: '#292934' },
  searchInput: { flex: 1, color: '#F5F5F8', fontSize: 14 },
  resultText: { color: '#747483', fontSize: 12, marginTop: 12, marginBottom: 9 },
  userList: { gap: 10 },
  userCard: { padding: 14, backgroundColor: '#15151D', borderRadius: 17, borderWidth: 1, borderColor: '#292934' },
  userHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarPlaceholder: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#20202A' },
  userCopy: { flex: 1, marginLeft: 11, minWidth: 0 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { color: '#F5F5F8', fontSize: 15, fontWeight: '800' },
  verifiedIcon: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4C83FF' },
  fullName: { marginTop: 2, color: '#A5A5B3', fontSize: 12 },
  userId: { marginTop: 3, color: '#686876', fontSize: 10 },
  roleBadge: { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#21182F' },
  roleBadgeText: { color: '#BDA8FF', fontSize: 10, fontWeight: '800' },
  verificationRow: { marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#292934', flexDirection: 'row', alignItems: 'center', gap: 12 },
  verificationCopy: { flex: 1 },
  verificationLabel: { color: '#747483', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  verificationValue: { marginTop: 4, color: '#D4D4DC', fontSize: 12, fontWeight: '700' },
  verifyButton: { minHeight: 38, paddingHorizontal: 13, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#315FC5', borderWidth: 1, borderColor: '#527BE0' },
  revokeVerifyButton: { minHeight: 38, paddingHorizontal: 13, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#281419', borderWidth: 1, borderColor: '#6E303A' },
  revokeVerifyButtonText: { color: '#FFB4BC', fontSize: 11, fontWeight: '900' },
  verifyButtonDisabled: { opacity: 0.6 },
  verifyButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#292934' },
  roleButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: '#0F0F15', borderWidth: 1, borderColor: '#30303D' },
  roleButtonActive: { backgroundColor: '#2B1E3E', borderColor: '#60458A' },
  roleButtonText: { color: '#8E8E9D', fontSize: 11, fontWeight: '700' },
  roleButtonTextActive: { color: '#C8B8FF' },
  emptyCard: { marginTop: 24, alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  emptyTitle: { marginTop: 10, color: '#F5F5F8', fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 5, color: '#8E8E9D', fontSize: 12, textAlign: 'center' },
});
