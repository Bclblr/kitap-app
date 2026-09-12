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

      const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, full_name, profile_image')
          .order('username', { ascending: true }),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      if (profileError) throw profileError;
      if (roleError) throw roleError;

      const roleMap = new Map<string, AppRole>();
      for (const row of roles ?? []) {
        const role = row.role as AppRole;
        if (ROLES.includes(role)) roleMap.set(row.user_id, role);
      }

      setUsers(
        (profiles ?? []).map((profile) => ({
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name,
          profile_image: profile.profile_image,
          role: roleMap.get(profile.id) ?? 'user',
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
      const { data: authData } = await supabase.auth.getUser();
      const adminId = authData.user?.id ?? null;

      const { error } = await supabase.from('user_roles').upsert(
        {
          user_id: user.id,
          role: nextRole,
          updated_by: adminId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (error) throw error;

      await supabase.from('admin_audit_logs').insert({
        admin_id: adminId,
        action: 'user_role_changed',
        target_type: 'user',
        target_id: user.id,
        old_value: { role: user.role },
        new_value: { role: nextRole },
      });

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
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
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
          {filteredUsers.map((user) => (
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

                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{ROLE_LABELS[user.role]}</Text>
                </View>
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
          ))}
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
  username: { color: '#F5F5F8', fontSize: 15, fontWeight: '800' },
  fullName: { marginTop: 2, color: '#A5A5B3', fontSize: 12 },
  userId: { marginTop: 3, color: '#686876', fontSize: 10 },
  roleBadge: { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#21182F' },
  roleBadgeText: { color: '#BDA8FF', fontSize: 10, fontWeight: '800' },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#292934' },
  roleButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: '#0F0F15', borderWidth: 1, borderColor: '#30303D' },
  roleButtonActive: { backgroundColor: '#2B1E3E', borderColor: '#60458A' },
  roleButtonText: { color: '#8E8E9D', fontSize: 11, fontWeight: '700' },
  roleButtonTextActive: { color: '#C8B8FF' },
  emptyCard: { marginTop: 24, alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  emptyTitle: { marginTop: 10, color: '#F5F5F8', fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 5, color: '#8E8E9D', fontSize: 12, textAlign: 'center' },
});
