import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import Image from '@/components/SafeImage';
import { supabase } from '@/lib/supabase';
import { Work } from '@/lib/works';
import { Action, Busy, useReaderStyles } from './ReaderUI';
export default function WorksList({ authorId, own = false, status, genre = '', sort = 'new' }: { authorId?: string; own?: boolean; status?: 'draft'|'published'; genre?: string; sort?: 'new'|'popular' }) {
  const ui = useReaderStyles();
  const router = useRouter();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let alive = true;
    async function load() {
      setLoading(true); setError('');
      try {
        const popularity = !own && sort === 'popular' ? await supabase.rpc('work_popularity', { genre_filter: genre.trim() }) : null;
        if (popularity?.error) throw popularity.error;
        const counts = new Map<string,number>((popularity?.data ?? []).map((row: {work_id:string; saves:number})=>[row.work_id,Number(row.saves)]));
        if (popularity && !counts.size) { if (alive) setWorks([]); return; }
        let query = supabase.from('works').select('*').order(own ? 'updated_at' : 'published_at', { ascending: false }).limit(50);
        if (popularity) query = query.in('id', [...counts.keys()]);
        if (authorId) query = query.eq('author_id', authorId);
        if (!own) query = query.eq('status', 'published');
        if (own && status) query = query.eq('status',status);
        if (genre.trim()) query = query.ilike('genre',`%${genre.trim().replace(/[%_]/g,'')}%`);
        const result = await query;
        if (result.error) throw result.error;
        let rows = result.data ?? [];
        if (!own && sort==='popular' && rows.length) {
          rows = [...rows].sort((a,b)=>(counts.get(b.id)??0)-(counts.get(a.id)??0));
        }
        if (alive) setWorks(rows);
      } catch { if (alive) setError('Eserler yüklenemedi. Lütfen daha sonra yeniden dene.'); }
      finally { if (alive) setLoading(false); }
    }
    const timer=setTimeout(()=>void load(),genre?300:0); return () => { alive = false; clearTimeout(timer); };
  }, [authorId, own,status,genre,sort]));
  return <View style={{ gap: 12 }}><Text style={ui.title}>{own ? status==='draft'?'Taslaklar':'Yayındakiler' : sort==='popular'?'Popüler eserler':'Yeni çıkan eserler'}</Text>
    {loading ? <Busy /> : error ? <Text style={ui.error}>{error}</Text> : !works.length ? <Text style={ui.muted}>Henüz eser yok.</Text> : works.map(work => <View key={work.id} style={ui.card}>
      {work.cover_url && <Image source={{ uri: work.cover_url }} style={{ width: 80, height: 112, borderRadius: 8 }} resizeMode="cover" />}
      <Text style={ui.title}>{work.title}</Text><Text numberOfLines={3} style={ui.muted}>{work.description}</Text>
      <Text style={ui.muted}>{work.genre} · {work.completed ? 'Tamamlandı' : work.status === 'draft' ? 'Taslak' : 'Yayında'} · {work.language || 'tr'}</Text>
      <Action label={own ? 'Düzenle' : 'Oku'} onPress={() => router.push({ pathname: own ? '/work-editor' : '/work', params: { id: work.id } })} />
    </View>)}
  </View>;
}
