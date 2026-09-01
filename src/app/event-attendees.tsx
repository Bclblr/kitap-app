import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

type EventAttendee = {
  user_id: string;
  username: string;
  profile_image: string | null;
};

export default function EventAttendeesScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAttendees() {
      if (!id) {
        setErrorMessage('Etkinlik bilgisi bulunamadı.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage(null);

        const { data, error } = await supabase.rpc('get_event_attendees', {
          p_event_id: id,
        });

        if (!active) return;

        if (error) {
          console.error('Event attendees error:', error);
          setAttendees([]);
          setErrorMessage('Katılımcılar yüklenemedi.');
          return;
        }

        setAttendees((data ?? []) as EventAttendee[]);
      } catch (error) {
        if (!active) return;
        console.error('Event attendees error:', error);
        setAttendees([]);
        setErrorMessage('Katılımcılar yüklenemedi.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAttendees();

    return () => {
      active = false;
    };
  }, [id]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Geri</Text>
        </Pressable>

        <Text style={styles.title}>Katılımcılar</Text>
        <Text style={styles.subtitle}>
          {loading ? 'Katılımcılar yükleniyor...' : `${attendees.length} kişi katılıyor`}
        </Text>

        {loading ? (
          <ActivityIndicator color="#F29A45" size="large" style={styles.loader} />
        ) : errorMessage ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{errorMessage}</Text>
          </View>
        ) : attendees.length === 0 ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>Henüz katılımcı yok.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {attendees.map((attendee, index) => (
              <Pressable
                key={attendee.user_id}
                onPress={() =>
                  router.push({
                    pathname: '/profile',
                    params: { userId: attendee.user_id },
                  })
                }
                style={[
                  styles.attendeeRow,
                  index !== attendees.length - 1 && styles.attendeeRowBorder,
                ]}
              >
                {attendee.profile_image ? (
                  <Image
                    source={{ uri: attendee.profile_image }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarLetter}>
                      {(attendee.username || 'K').trim().charAt(0).toLocaleUpperCase('tr-TR')}
                    </Text>
                  </View>
                )}

                <View style={styles.userInfo}>
                  <Text style={styles.username} numberOfLines={1}>
                    {attendee.username || 'Kitap Okuru'}
                  </Text>
                  <Text style={styles.profileHint}>Profili görüntüle</Text>
                </View>

                <Text style={styles.arrow}>›</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#08090D',
  },
  content: {
    padding: 18,
    paddingBottom: 42,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 12,
  },
  backText: {
    color: '#F29A45',
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: '#F7F7F9',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: '#8E8F98',
    fontSize: 13,
    marginTop: 5,
    marginBottom: 18,
  },
  loader: {
    marginTop: 50,
  },
  messageBox: {
    backgroundColor: '#111218',
    borderWidth: 1,
    borderColor: '#2D2E37',
    borderRadius: 16,
    padding: 20,
  },
  messageText: {
    color: '#8E8F98',
    fontSize: 14,
    textAlign: 'center',
  },
  listCard: {
    backgroundColor: '#111218',
    borderWidth: 1,
    borderColor: '#2D2E37',
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },
  attendeeRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#252630',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1B1C23',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A3027',
  },
  avatarLetter: {
    color: '#F29A45',
    fontSize: 18,
    fontWeight: '900',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    color: '#F2F2F5',
    fontSize: 15,
    fontWeight: '800',
  },
  profileHint: {
    color: '#777983',
    fontSize: 10,
    marginTop: 3,
  },
  arrow: {
    color: '#F29A45',
    fontSize: 28,
    fontWeight: '400',
    marginLeft: 8,
  },
});
