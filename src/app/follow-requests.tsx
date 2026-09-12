import Image from '@/components/SafeImage';
import { supabase } from '@/lib/supabase';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type FollowRequest = {
  requester_id: string;
  created_at: string;
  username: string;
  profile_image: string | null;
};

export default function FollowRequestsScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: rows, error } = await supabase
        .from('follow_requests')
        .select('requester_id, created_at')
        .eq('target_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const requesterIds = [...new Set((rows ?? []).map((row) => String(row.requester_id)).filter(Boolean))];
      if (!requesterIds.length) {
        setRequests([]);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, profile_image')
        .in('id', requesterIds);

      if (profileError) throw profileError;

      const profileMap = new Map(
        (profiles ?? []).map((profile) => [
          String(profile.id),
          {
            username: profile.username || 'Kitap Okuru',
            profile_image: profile.profile_image || null,
          },
        ])
      );

      setRequests(
        (rows ?? []).map((row) => {
          const id = String(row.requester_id);
          const profile = profileMap.get(id);
          return {
            requester_id: id,
            created_at: String(row.created_at ?? ''),
            username: profile?.username ?? 'Kitap Okuru',
            profile_image: profile?.profile_image ?? null,
          };
        })
      );
    } catch (error) {
      console.error('Takip istekleri yüklenemedi:', error);
      Alert.alert('Hata', 'Takip istekleri yüklenemedi.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
    }, [loadRequests])
  );

  async function respond(requesterId: string, accept: boolean) {
    setBusyId(requesterId);
    try {
      const { error } = await supabase.rpc('respond_follow_request', {
        p_requester: requesterId,
        p_accept: accept,
      });
      if (error) throw error;
      setRequests((current) => current.filter((item) => item.requester_id !== requesterId));
    } catch (error) {
      console.error('Takip isteği yanıtlanamadı:', error);
      Alert.alert('Hata', 'Takip isteği yanıtlanamadı.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Geri dön">
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Takip İstekleri</Text>
          <View style={styles.spacer} />
        </View>

        {loading ? (
          <Text style={styles.muted}>Takip istekleri yükleniyor...</Text>
        ) : requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Bekleyen istek yok</Text>
            <Text style={styles.muted}>Yeni takip istekleri burada görünecek.</Text>
          </View>
        ) : (
          requests.map((item) => {
            const busy = busyId === item.requester_id;
            return (
              <View key={item.requester_id} style={styles.requestCard}>
                <Pressable
                  onPress={() => router.push({ pathname: '/profile', params: { userId: item.requester_id } })}
                  style={styles.identity}
                >
                  {item.profile_image ? (
                    <Image source={{ uri: item.profile_image }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarText}>👤</Text>
                    </View>
                  )}
                  <View style={styles.identityText}>
                    <Text style={styles.username}>@{item.username}</Text>
                    <Text style={styles.dateText}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString('tr-TR') : 'Takip isteği'}
                    </Text>
                  </View>
                </Pressable>

                <View style={styles.actions}>
                  <Pressable
                    onPress={() => void respond(item.requester_id, true)}
                    disabled={busy}
                    style={[styles.actionButton, styles.acceptButton]}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.username} takip isteğini kabul et`}
                  >
                    <Text style={styles.acceptText}>{busy ? '...' : 'Kabul Et'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void respond(item.requester_id, false)}
                    disabled={busy}
                    style={[styles.actionButton, styles.rejectButton]}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.username} takip isteğini reddet`}
                  >
                    <Text style={styles.rejectText}>Reddet</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  content: { padding: 18, paddingBottom: 48 },
  header: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15151D' },
  backText: { color: '#F5F5F7', fontSize: 32, lineHeight: 34 },
  title: { color: '#F5F5F7', fontSize: 20, fontWeight: '800' },
  spacer: { width: 42 },
  muted: { color: '#A7A7B2', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyCard: { padding: 22, borderRadius: 18, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#282833' },
  emptyTitle: { color: '#F5F5F7', fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  requestCard: { padding: 14, borderRadius: 18, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#282833', marginBottom: 12 },
  identity: { flexDirection: 'row', alignItems: 'center' },
  identityText: { flex: 1, marginLeft: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { backgroundColor: '#24242D', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20 },
  username: { color: '#F5F5F7', fontSize: 15, fontWeight: '800' },
  dateText: { color: '#858590', fontSize: 12, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionButton: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  acceptButton: { backgroundColor: '#A985FF' },
  rejectButton: { backgroundColor: '#24242D' },
  acceptText: { color: '#0A0A0E', fontWeight: '800' },
  rejectText: { color: '#F5F5F7', fontWeight: '700' },
});
