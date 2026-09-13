import AppLoadingState from '@/components/AppLoadingState';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View as SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Image from '@/components/SafeImage';

import { supabase } from '@/lib/supabase';

type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  image_url: string | null;
  created_by: string | null;
};

export default function EventScreen() {
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [isAttending, setIsAttending] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadEvent() {
      if (!id) {
        setErrorMessage('Etkinlik bilgisi bulunamadı.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage(null);

        const [{ data, error }, userResult, attendeeResult] = await Promise.all([
          supabase
            .from('events')
            .select('id, title, description, event_date, location, image_url, created_by')
            .eq('id', id)
            .single(),
          supabase.auth.getUser(),
          supabase
            .from('event_attendees')
            .select('user_id', { count: 'exact' })
            .eq('event_id', id),
        ]);

        if (!active) return;

        if (error || !data) {
          console.error('Event detail error:', error);
          setEvent(null);
          setErrorMessage('Etkinlik yüklenemedi.');
          return;
        }

        setEvent(data as EventDetail);
        setAttendeeCount(attendeeResult.count ?? 0);

        const user = userResult.data.user;
        setCurrentUserId(user?.id ?? null);

        if (user) {
          const { data: attendance, error: attendanceError } = await supabase
            .from('event_attendees')
            .select('event_id')
            .eq('event_id', id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!active) return;

          if (attendanceError) {
            console.error('Event attendance status error:', attendanceError);
          } else {
            setIsAttending(Boolean(attendance));
          }
        }
      } catch (error) {
        if (!active) return;
        console.error('Event detail error:', error);
        setEvent(null);
        setErrorMessage('Etkinlik yüklenemedi.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadEvent();

    return () => {
      active = false;
    };
  }, [id]);

  async function toggleAttendance() {
    if (!event || attendanceLoading) return;

    const eventTime = new Date(event.event_date).getTime();
    if (!Number.isFinite(eventTime) || eventTime <= Date.now()) {
      Alert.alert('Etkinlik sona erdi', 'Geçmiş bir etkinliğin katılım bilgisi artık değiştirilemez.');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Giriş gerekli', 'Etkinliğe katılmak için giriş yapmalısın.');
      return;
    }

    const previousAttending = isAttending;
    const previousCount = attendeeCount;
    const nextAttending = !previousAttending;

    setAttendanceLoading(true);
    setIsAttending(nextAttending);
    setAttendeeCount(Math.max(0, previousCount + (nextAttending ? 1 : -1)));

    try {
      if (nextAttending) {
        const { error } = await supabase.from('event_attendees').insert({
          event_id: event.id,
          user_id: currentUserId,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', event.id)
          .eq('user_id', currentUserId);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Event attendance error:', error);
      setIsAttending(previousAttending);
      setAttendeeCount(previousCount);
      Alert.alert('İşlem başarısız', 'Katılım bilgisi güncellenemedi.');
    } finally {
      setAttendanceLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppLoadingState variant="card" label="Etkinlik yükleniyor" />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{errorMessage ?? 'Etkinlik bulunamadı.'}</Text>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Geri dön">
            <Text style={styles.backButtonText}>Geri dön</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const eventDate = new Date(event.event_date);
  const eventTimestamp = eventDate.getTime();
  const hasEnded = Number.isFinite(eventTimestamp) && eventTimestamp <= Date.now();
  const formattedDate = eventDate.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = eventDate.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.topBack} accessibilityRole="button" accessibilityLabel="Geri dön">
          <Text style={[styles.topBackText, { color: colors.primary }]}>‹ Geri</Text>
        </Pressable>

        {event.image_url ? (
          <Image source={{ uri: event.image_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={[styles.calendarIcon, { color: colors.primary }]}>◷</Text>
            <Text style={styles.placeholderText}>Etkinlik</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={[styles.badge, hasEnded && styles.badgePast]}>
            {hasEnded ? 'ETKİNLİK SONA ERDİ' : 'YAKLAŞAN ETKİNLİK'}
          </Text>
          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Tarih</Text>
            <Text style={styles.infoValue}>{formattedDate}</Text>
            <Text style={styles.infoSubValue}>{formattedTime}</Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Konum</Text>
            <Text style={styles.infoValue}>{event.location?.trim() || 'Konum belirtilmemiş'}</Text>
          </View>

          <View style={styles.attendanceBox}>
            <Pressable
              onPress={() => router.push({ pathname: '/event-attendees', params: { id: event.id } })}
              style={({ pressed }) => [styles.attendanceInfo, pressed && styles.attendanceInfoPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${attendeeCount} katılımcıyı gör`}
            >
              <Text style={[styles.attendanceCount, { color: colors.primary }]}>{attendeeCount}</Text>
              <Text style={styles.attendanceLabel}>
                {hasEnded ? 'kişi katıldı · listeyi gör' : 'kişi katılıyor · listeyi gör'}
              </Text>
            </Pressable>

            {hasEnded ? (
              <View style={styles.pastAttendanceState} accessibilityRole="text">
                <Text style={styles.pastAttendanceText}>
                  {isAttending ? 'Katıldın ✓' : 'Katılım kapandı'}
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={() => void toggleAttendance()}
                disabled={attendanceLoading}
                accessibilityRole="button"
                accessibilityState={{ disabled: attendanceLoading, selected: isAttending }}
                accessibilityLabel={isAttending ? 'Etkinlik katılımını iptal et' : 'Etkinliğe katıl'}
                style={({ pressed }) => [
                  styles.attendanceButton,
                  { backgroundColor: colors.primary },
                  isAttending && styles.attendanceButtonActive,
                  (pressed || attendanceLoading) && styles.attendanceButtonPressed,
                ]}
              >
                {attendanceLoading ? (
                  <ActivityIndicator size="small" color={isAttending ? colors.primary : '#08090D'} />
                ) : (
                  <Text style={[styles.attendanceButtonText, isAttending && { color: colors.primary }]}>
                    {isAttending ? 'Katılıyorsun ✓' : 'Katılacağım'}
                  </Text>
                )}
              </Pressable>
            )}
          </View>

          {hasEnded ? (
            <View style={styles.pastNotice}>
              <Text style={styles.pastNoticeTitle}>Bu etkinlik tamamlandı.</Text>
              <Text style={styles.pastNoticeText}>Katılımcı listesi görüntülenebilir ancak katılım durumu artık değiştirilemez.</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Etkinlik hakkında</Text>
          <Text style={styles.description}>{event.description?.trim() || 'Bu etkinlik için henüz açıklama eklenmemiş.'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08090D' },
  content: { padding: 18, paddingBottom: 42 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  topBack: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  topBackText: { fontSize: 15, fontWeight: '700' },
  image: { width: '100%', height: 230, borderRadius: 22, backgroundColor: '#17181F' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#353038' },
  calendarIcon: { fontSize: 44, fontWeight: '900' },
  placeholderText: { color: '#8E8F98', marginTop: 8, fontSize: 13, fontWeight: '700' },
  card: { marginTop: 16, backgroundColor: '#111218', borderWidth: 1, borderColor: '#2D2E37', borderRadius: 20, padding: 18 },
  badge: { alignSelf: 'flex-start', color: '#B58AF6', backgroundColor: '#1D1728', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  badgePast: { color: '#A7A8B0', backgroundColor: '#23242B' },
  title: { color: '#F7F7F9', fontSize: 26, lineHeight: 33, fontWeight: '900', marginTop: 14, marginBottom: 18 },
  infoBox: { backgroundColor: '#17181F', borderRadius: 14, padding: 14, marginBottom: 10 },
  infoLabel: { color: '#777983', fontSize: 11, fontWeight: '700', marginBottom: 5, textTransform: 'uppercase' },
  infoValue: { color: '#F2F2F5', fontSize: 15, fontWeight: '800' },
  infoSubValue: { color: '#B5B6BE', fontSize: 13, marginTop: 3 },
  attendanceBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#17181F', borderRadius: 14, padding: 12, marginTop: 2, marginBottom: 6 },
  attendanceInfo: { flex: 1, minWidth: 0, paddingLeft: 2, paddingVertical: 4, marginRight: 10, borderRadius: 10 },
  attendanceInfoPressed: { opacity: 0.6 },
  attendanceCount: { fontSize: 20, fontWeight: '900' },
  attendanceLabel: { color: '#8E8F98', fontSize: 10, marginTop: 2 },
  attendanceButton: { minWidth: 120, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14 },
  attendanceButtonActive: { backgroundColor: '#1D1728', borderWidth: 1, borderColor: '#8058D9' },
  attendanceButtonPressed: { opacity: 0.7 },
  attendanceButtonText: { color: '#08090D', fontSize: 12, fontWeight: '900' },
  pastAttendanceState: { minWidth: 120, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#23242B', borderWidth: 1, borderColor: '#34353E' },
  pastAttendanceText: { color: '#B5B6BE', fontSize: 12, fontWeight: '800' },
  pastNotice: { marginTop: 10, padding: 13, borderRadius: 13, backgroundColor: '#17181F', borderWidth: 1, borderColor: '#2D2E37' },
  pastNoticeTitle: { color: '#F2F2F5', fontSize: 13, fontWeight: '800' },
  pastNoticeText: { color: '#8E8F98', fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionTitle: { color: '#F2F2F5', fontSize: 17, fontWeight: '900', marginTop: 14, marginBottom: 8 },
  description: { color: '#B5B6BE', fontSize: 14, lineHeight: 22 },
  errorText: { color: '#B5B6BE', fontSize: 15, textAlign: 'center' },
  backButton: { marginTop: 18, backgroundColor: '#8058D9', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
  backButtonText: { color: '#FFFFFF', fontWeight: '900' },
});
