import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Work } from '@/lib/works';
import { Action, Busy, ui } from './ReaderUI';
export default function WorksList({ authorId, own = false }: { authorId?: string; own?: boolean }) {
  const router = useRouter();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let alive = true;
    async function load() {
      setLoading(true); setError('');
      try {
        let query = supabase.from('works').select('*').order('updated_at', { ascending: false }).limit(30);
        if (authorId) query = query.eq('author_id', authorId);
        if (!own) query = query.eq('status', 'published');
        const result = await query;
        if (result.error) throw result.error;
        if (alive) setWorks(result.data ?? []);
      } catch { if (alive) setError('Eserler yüklenemedi. Lütfen daha sonra yeniden dene.'); }
      finally { if (alive) setLoading(false); }
    }
    void load(); return () => { alive = false; };
  }, [authorId, own]));
  return <View style={{ gap: 12 }}><Text style={ui.title}>{own ? 'Eserlerim' : 'Okurlardan Kitaplar'}</Text>
    {loading ? <Busy /> : error ? <Text style={ui.error}>{error}</Text> : !works.length ? <Text style={ui.muted}>Henüz eser yok.</Text> : works.map(work => <View key={work.id} style={ui.card}>
      {work.cover_url && <Image source={{ uri: work.cover_url }} style={{ width: 80, height: 112, borderRadius: 8 }} resizeMode="cover" />}
      <Text style={ui.title}>{work.title}</Text><Text numberOfLines={3} style={ui.muted}>{work.description}</Text>
      <Text style={ui.muted}>{work.genre}{own ? ` · ${work.status === 'draft' ? 'Taslak' : 'Yayında'}` : ''}</Text>
      <Action label={own ? 'Düzenle' : 'Oku'} onPress={() => router.push({ pathname: own ? '/work-editor' : '/work', params: { id: work.id } })} />
    </View>)}
  </View>;
}
