import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type Overview = {
  total_users: number;
  users_7d: number;
  users_30d: number;
  total_posts: number;
  posts_7d: number;
  total_reviews: number;
  reviews_7d: number;
  total_quotes: number;
  quotes_7d: number;
  total_comments: number;
  comments_7d: number;
  total_communities: number;
  total_events: number;
  pending_reports: number;
};

type DailyRow = {
  day: string;
  new_users: number;
  posts: number;
  reviews: number;
  quotes: number;
  comments: number;
};

const EMPTY: Overview = {
  total_users: 0,
  users_7d: 0,
  users_30d: 0,
  total_posts: 0,
  posts_7d: 0,
  total_reviews: 0,
  reviews_7d: 0,
  total_quotes: 0,
  quotes_7d: 0,
  total_comments: 0,
  comments_7d: 0,
  total_communities: 0,
  total_events: 0,
  pending_reports: 0,
};

export default function AdminAnalyticsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [overview, setOverview] = useState<Overview>(EMPTY);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorText('');
    try {
      const access = await getCurrentAdminAccess();
      if (!access.canManageSystem) {
        router.replace('/admin');
        return;
      }

      const [overviewResult, dailyResult] = await Promise.all([
        supabase.rpc('admin_analytics_overview'),
        supabase.rpc('admin_analytics_daily', { p_days: 14 }),
      ]);

      if (overviewResult.error) throw overviewResult.error;
      if (dailyResult.error) throw dailyResult.error;

      setOverview((overviewResult.data?.[0] ?? EMPTY) as Overview);
      setDaily((dailyResult.data ?? []) as DailyRow[]);
    } catch (error: any) {
      setErrorText(error?.message ?? 'Analitik verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const maxActivity = useMemo(() => {
    return Math.max(
      1,
      ...daily.map((row) => row.posts + row.reviews + row.quotes + row.comments)
    );
  }, [daily]);

  const cards = [
    ['Toplam kullanıcı', overview.total_users, `${overview.users_7d} yeni / 7 gün`],
    ['30 günde yeni kullanıcı', overview.users_30d, 'Kayıt büyümesi'],
    ['Gönderiler', overview.total_posts, `${overview.posts_7d} yeni / 7 gün`],
    ['İncelemeler', overview.total_reviews, `${overview.reviews_7d} yeni / 7 gün`],
    ['Alıntılar', overview.total_quotes, `${overview.quotes_7d} yeni / 7 gün`],
    ['Yorumlar', overview.total_comments, `${overview.comments_7d} yeni / 7 gün`],
    ['Topluluklar', overview.total_communities, 'Toplam'],
    ['Etkinlikler', overview.total_events, 'Toplam'],
    ['Bekleyen şikâyet', overview.pending_reports, 'Moderasyon kuyruğu'],
  ] as const;

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary}/><Text style={styles.loadingText}>Analitik verileri yükleniyor...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}><Feather name="chevron-left" size={24} color={colors.textPrimary}/></Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>YÖNETİM</Text><Text style={styles.title}>Analitik</Text></View>
          <Pressable onPress={() => void load()} style={styles.headerButton}><Feather name="refresh-cw" size={19} color={colors.textSecondary}/></Pressable>
        </View>

        {!!errorText && <View style={styles.errorCard}><Text style={styles.errorText}>{errorText}</Text></View>}

        <Text style={styles.sectionTitle}>Genel Bakış</Text>
        <View style={styles.grid}>
          {cards.map(([label, value, note]) => (
            <View key={label} style={styles.metricCard}>
              <Text style={styles.metricValue}>{Number(value ?? 0).toLocaleString('tr-TR')}</Text>
              <Text style={styles.metricLabel}>{label}</Text>
              <Text style={styles.metricNote}>{note}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Son 14 Gün İçerik Hareketi</Text>
        <View style={styles.chartCard}>
          {daily.map((row) => {
            const total = row.posts + row.reviews + row.quotes + row.comments;
            const width = Math.max(4, (total / maxActivity) * 100);
            return (
              <View key={row.day} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{new Date(`${row.day}T12:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}</Text>
                <View style={styles.barTrack}><View style={[styles.barFill, { width: `${width}%` }]} /></View>
                <Text style={styles.dayValue}>{total}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Günlük Detay</Text>
        <View style={styles.tableCard}>
          {daily.slice().reverse().map((row) => (
            <View key={`detail-${row.day}`} style={styles.detailRow}>
              <View style={styles.detailDateWrap}><Text style={styles.detailDate}>{new Date(`${row.day}T12:00:00`).toLocaleDateString('tr-TR')}</Text><Text style={styles.detailUsers}>+{row.new_users} kullanıcı</Text></View>
              <View style={styles.detailStats}><Text style={styles.detailStat}>G {row.posts}</Text><Text style={styles.detailStat}>İ {row.reviews}</Text><Text style={styles.detailStat}>A {row.quotes}</Text><Text style={styles.detailStat}>Y {row.comments}</Text></View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#0A0A0E'},
  centered:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#0A0A0E'},
  loadingText:{marginTop:12,color:'#A5A5B3'},
  content:{width:'100%',maxWidth:760,alignSelf:'center',padding:18,paddingBottom:48},
  header:{flexDirection:'row',alignItems:'center',marginBottom:20},
  headerButton:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934'},
  headerCopy:{flex:1,marginHorizontal:14},
  eyebrow:{color:'#A985FF',fontSize:11,fontWeight:'900',letterSpacing:1.2},
  title:{color:'#F5F5F8',fontSize:25,fontWeight:'900'},
  errorCard:{padding:14,borderRadius:14,backgroundColor:'#2A1519',borderWidth:1,borderColor:'#593038',marginBottom:18},
  errorText:{color:'#F0A8B2',fontSize:13},
  sectionTitle:{color:'#F5F5F8',fontSize:17,fontWeight:'800',marginBottom:11,marginTop:4},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:24},
  metricCard:{width:'48%',minWidth:145,flexGrow:1,padding:15,borderRadius:16,backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934'},
  metricValue:{color:'#F5F5F8',fontSize:22,fontWeight:'900'},
  metricLabel:{color:'#D8D8E0',marginTop:5,fontSize:13,fontWeight:'700'},
  metricNote:{color:'#838392',marginTop:4,fontSize:11},
  chartCard:{padding:15,borderRadius:16,backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934',marginBottom:24,gap:10},
  dayRow:{flexDirection:'row',alignItems:'center',gap:10},
  dayLabel:{width:42,color:'#8E8E9D',fontSize:11},
  barTrack:{flex:1,height:9,borderRadius:999,backgroundColor:'#252530',overflow:'hidden'},
  barFill:{height:'100%',borderRadius:999,backgroundColor:'#A985FF'},
  dayValue:{width:28,textAlign:'right',color:'#CFCFD7',fontSize:11,fontWeight:'800'},
  tableCard:{borderRadius:16,backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934',overflow:'hidden'},
  detailRow:{padding:14,borderBottomWidth:1,borderBottomColor:'#252530',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  detailDateWrap:{flex:1},
  detailDate:{color:'#F5F5F8',fontWeight:'800',fontSize:13},
  detailUsers:{color:'#8E8E9D',fontSize:11,marginTop:3},
  detailStats:{flexDirection:'row',gap:9},
  detailStat:{color:'#B8A7E8',fontSize:11,fontWeight:'800'},
});
