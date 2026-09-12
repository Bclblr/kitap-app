import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Image from './SafeImage';
import { Action, Busy, useReaderStyles } from './ReaderUI';
import { useReaderSocial, notifySocialChanged } from '@/hooks/use-reader-social';
import { loadSuggestedReaders, rankReaders, SuggestedReader } from '@/lib/reader-recommendations';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';

export default function ReaderSuggestions({ limit = 10 }: { limit?: number }) {
  const social = useReaderSocial(); const router = useRouter(); const ui = useReaderStyles(); const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [candidates, setCandidates] = useState<SuggestedReader[]>([]);
  const [hidden, setHidden] = useState<Record<string,number>>({});
  const [now, setNow] = useState(Date.now);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null); const lock = useRef(false);
  const followingKey = social.following.slice().sort().join(',');
  useFocusEffect(useCallback(() => {
    if (!social.userId || social.loading || social.error) return;
    let alive = true; setLoading(true);
    void (async () => { try {
      const [readers, local, feedback] = await Promise.all([
        loadSuggestedReaders(social.userId!,followingKey ? followingKey.split(',') : []),
        AsyncStorage.getItem(`reader-hidden:${social.userId}`),
        supabase.from('reader_suggestion_feedback').select('candidate_id,hidden_until').eq('user_id',social.userId!),
      ]);
      let hiddenRows: Record<string,number> = {};
      try { hiddenRows = local ? JSON.parse(local) : {}; } catch { /* Invalid local feedback is ignored. */ }
      for (const row of feedback.data ?? []) hiddenRows[row.candidate_id] = Date.parse(row.hidden_until);
      if (alive) { setNow(Date.now()); setCandidates(readers); setHidden(current=>Object.fromEntries([...new Set([...Object.keys(hiddenRows),...Object.keys(current)])].map(id=>[id,Math.max(hiddenRows[id] || 0,current[id] || 0)]))); setError(''); }
    } catch { if (alive) setError('Öneriler şu anda yüklenemedi.'); } finally { if (alive) setLoading(false); } })();
    return () => { alive = false; };
  },[social.userId,social.loading,social.error,followingKey]));
  async function dismiss(id: string, until: number) {
    if (!social.userId) return;
    const next = { ...hidden,[id]:until }; setHidden(next);
    try {
      await AsyncStorage.setItem(`reader-hidden:${social.userId}`,JSON.stringify(next));
      const result = await supabase.from('reader_suggestion_feedback').upsert({ user_id:social.userId,candidate_id:id,hidden_until:new Date(until).toISOString(),reason:'dismissed' });
      if (result.error) setError('Öneri bu cihazda gizlendi; diğer cihazlara henüz aktarılamadı.');
    } catch { setError('Öneri gizlendi; cihaz kaydı tamamlanamadı.'); }
  }
  async function follow(id: string) {
    if (!social.userId || lock.current) return;
    lock.current = true; setPending(id);
    try {
      const result = await supabase.from('follows').insert({ follower_id:social.userId,following_id:id });
      if (result.error) throw result.error;
      social.setFollowing(current=>[...new Set([...current,id])]); notifySocialChanged();
    } catch { setError('Takip işlemi tamamlanamadı.'); } finally { lock.current=false; setPending(null); }
  }
  const excluded = new Set([social.userId ?? '',...social.following,...social.blocked,...Object.keys(hidden).filter(id=>hidden[id]>now)]);
  const readers = rankReaders(candidates,excluded,limit);
  if (social.error || (!loading && !readers.length && !error)) return null;
  return <View style={{ gap:12, paddingVertical:12 }}>
    <View style={{ flexDirection:'row',alignItems:'center',gap:8 }}><Text style={[ui.text,{flexGrow:1,flexBasis:0,fontWeight:'700'}]}>Senin için önerilenler</Text><Action label="Tümünü gör" onPress={()=>router.push('/readers')} /></View>
    {!!error && <Text style={ui.error}>{error}</Text>}
    {loading ? <Busy /> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:12 }}>
      {readers.map(reader=><View key={reader.id} style={[ui.card,{width:Math.min(188,width-64),alignItems:'center',paddingTop:30}]}>
        <Pressable accessibilityLabel={`${reader.username} önerisini gizle`} hitSlop={8} onPress={()=>void dismiss(reader.id, Date.now()+14*86400000)} style={{position:'absolute',right:4,top:0,minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.textSecondary,fontSize:23}}>×</Text></Pressable>
        <Pressable accessibilityLabel={`${reader.username} profilini aç`} onPress={()=>router.push({pathname:'/profile',params:{userId:reader.id}})}>
          <Image source={{uri:reader.profile_image ?? ''}} style={{width:64,height:64,borderRadius:32,backgroundColor:colors.surfaceElevated}} />
        </Pressable>
        <Text numberOfLines={1} style={[ui.text,{fontWeight:'700'}]}>{reader.full_name || reader.username}</Text><Text numberOfLines={1} style={ui.muted}>@{reader.username}</Text>
        <Text numberOfLines={2} style={[ui.muted,{fontSize:12,minHeight:34,textAlign:'center'}]}>{reader.reason}</Text>
        <Action label={pending===reader.id ? 'Takip ediliyor…' : 'Takip et'} disabled={pending!==null} onPress={()=>void follow(reader.id)} />
      </View>)}
    </ScrollView>}
  </View>;
}
