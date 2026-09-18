import { safeBack } from '@/lib/navigation';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Image from '@/components/SafeImage';
import { supabase } from '@/lib/supabase';

type BlockedUser = {
  id: string;
  username: string;
  fullName: string;
  profileImage: string | null;
};

export default function BlockedUsersScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadBlockedUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData.user;

      if (!currentUser) {
        router.replace('/login');
        return;
      }

      const { data: blocks, error: blocksError } = await supabase
        .from('user_blocks')
        .select('blocked_id, created_at')
        .eq('blocker_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (blocksError) throw blocksError;

      const blockedIds = (blocks ?? []).map((item: any) => String(item.blocked_id));
      if (blockedIds.length === 0) {
        setUsers([]);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, full_name, profile_image')
        .in('id', blockedIds);

      if (profileError) throw profileError;

      const byId = new Map((profiles ?? []).map((profile: any) => [String(profile.id), profile]));
      setUsers(
        blockedIds.map((id) => {
          const profile = byId.get(id);
          return {
            id,
            username: profile?.username || 'Kitap Okuru',
            fullName: profile?.full_name || '',
            profileImage: profile?.profile_image || null,
          };
        })
      );
    } catch (error) {
      console.error('Engellenen kullanıcılar yüklenemedi:', error);
      Alert.alert('Hata', 'Engellenen kullanıcılar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadBlockedUsers();
    }, [loadBlockedUsers])
  );

  function confirmUnblock(user: BlockedUser) {
    Alert.alert(
      'Engeli kaldır',
      `@${user.username} hesabının engelini kaldırmak istiyor musun?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Engeli Kaldır',
          onPress: () => {
            void unblockUser(user.id);
          },
        },
      ]
    );
  }

  async function unblockUser(blockedId: string) {
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData.user;
    if (!currentUser) return;

    setWorkingId(blockedId);
    try {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', blockedId);

      if (error) throw error;
      setUsers((current) => current.filter((user) => user.id !== blockedId));
    } catch (error) {
      console.error('Engel kaldırılamadı:', error);
      Alert.alert('Hata', 'Engel kaldırılamadı.');
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => safeBack(router, '/privacy-settings')} style={styles.backButton} accessibilityLabel="Geri">
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Engellenen Kullanıcılar</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator /><Text style={styles.info}>Yükleniyor...</Text></View>
      ) : users.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🛡</Text>
          <Text style={styles.emptyTitle}>Engellenen kullanıcı yok</Text>
          <Text style={styles.info}>Engellediğin hesaplar burada görünür.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {users.map((user) => (
            <View key={user.id} style={styles.row}>
              <Pressable
                onPress={() => router.push({ pathname: '/profile', params: { userId: user.id } })}
                style={styles.identity}
              >
                {user.profileImage ? (
                  <Image source={{ uri: user.profileImage }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.textWrap}>
                  <Text style={styles.name} numberOfLines={1}>{user.fullName || user.username}</Text>
                  <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => confirmUnblock(user)}
                disabled={workingId === user.id}
                style={styles.unblockButton}
              >
                <Text style={styles.unblockText}>{workingId === user.id ? '...' : 'Engeli Kaldır'}</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  header: { height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#24242C' },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17171F' },
  backText: { color: '#F5F5F7', fontSize: 32, lineHeight: 34 },
  title: { color: '#F5F5F7', fontSize: 18, fontWeight: '800' },
  headerSpacer: { width: 42 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  info: { color: '#9B9BA7', textAlign: 'center' },
  emptyIcon: { fontSize: 34 },
  emptyTitle: { color: '#F5F5F7', fontSize: 18, fontWeight: '800' },
  row: { minHeight: 76, borderRadius: 16, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#282832', padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: '#262231', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#F5F5F7', fontSize: 17, fontWeight: '800' },
  textWrap: { flex: 1, minWidth: 0 },
  name: { color: '#F5F5F7', fontSize: 15, fontWeight: '800' },
  username: { color: '#93939F', marginTop: 2 },
  unblockButton: { minHeight: 38, paddingHorizontal: 13, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#5E4B90' },
  unblockText: { color: '#BDA9FF', fontSize: 12, fontWeight: '800' },
});
