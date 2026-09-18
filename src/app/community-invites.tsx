import { safeBack } from '@/lib/navigation';
import Image from '@/components/SafeImage';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

type CommunityInvite = {
  invite_id: string;
  community_id: string;
  community_name: string;
  community_image_url: string | null;
  inviter_id: string;
  inviter_username: string;
  created_at: string;
};

export default function CommunityInvitesScreen() {
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const [invites, setInvites] = useState<CommunityInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_my_community_invites');
      if (error) throw error;
      setInvites((Array.isArray(data) ? data : []) as CommunityInvite[]);
    } catch (error) {
      console.error('Community invites load error:', error);
      Alert.alert('Hata', 'Topluluk davetleri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  async function respond(invite: CommunityInvite, accept: boolean) {
    if (pendingId) return;
    setPendingId(invite.invite_id);
    try {
      const { error } = await supabase.rpc('respond_to_community_invite', {
        p_invite_id: invite.invite_id,
        p_accept: accept,
      });
      if (error) throw error;
      setInvites((current) => current.filter((item) => item.invite_id !== invite.invite_id));
      if (accept) {
        router.replace({ pathname: '/community', params: { id: invite.community_id } });
      }
    } catch (error) {
      console.error('Community invite response error:', error);
      Alert.alert('Hata', accept ? 'Davet kabul edilemedi.' : 'Davet reddedilemedi.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? safeBack(router, '/explore') : router.replace('/explore'))} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Geri dön">
          <Feather name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Topluluk Davetleri</Text>
        <View style={styles.iconButton} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : invites.length === 0 ? (
        <View style={styles.center}>
          <Feather name="mail" size={30} color={colors.textSecondary} />
          <Text style={styles.empty}>Bekleyen topluluk davetin yok.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {invites.map((invite) => (
            <View key={invite.invite_id} style={styles.card}>
              {invite.community_image_url ? (
                <Image source={{ uri: invite.community_image_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{invite.community_name.charAt(0).toLocaleUpperCase('tr-TR')}</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.communityName}>{invite.community_name}</Text>
                <Text style={styles.meta}>{invite.inviter_username} seni bu topluluğa davet etti.</Text>
                <View style={styles.actions}>
                  <Pressable disabled={pendingId === invite.invite_id} onPress={() => void respond(invite, true)} style={styles.acceptButton}>
                    <Text style={styles.acceptText}>{pendingId === invite.invite_id ? 'İşleniyor…' : 'Kabul Et'}</Text>
                  </Pressable>
                  <Pressable disabled={pendingId === invite.invite_id} onPress={() => void respond(invite, false)} style={styles.declineButton}>
                    <Text style={styles.declineText}>Reddet</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08090D' },
  header: { minHeight: 60, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#222229' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#F7F7F9', fontSize: 18, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  empty: { color: '#B5B6BE', fontSize: 14, textAlign: 'center' },
  list: { padding: 18 },
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#111218', borderWidth: 1, borderColor: '#2D2E37', borderRadius: 16, padding: 14, marginBottom: 12 },
  avatar: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#24253A' },
  avatarFallback: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#24253A', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  info: { flex: 1, marginLeft: 12 },
  communityName: { color: '#F5F5F7', fontSize: 15, fontWeight: '900' },
  meta: { color: '#9A9CA7', fontSize: 12, lineHeight: 18, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  acceptButton: { minHeight: 38, borderRadius: 11, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8058D9' },
  acceptText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  declineButton: { minHeight: 38, borderRadius: 11, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#34353F' },
  declineText: { color: '#B5B6BE', fontSize: 12, fontWeight: '800' },
});
