import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import BookCover from '@/components/BookCover';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppTheme } from '@/providers/ThemeProvider';

type Story = {
  id: string; author_id: string; title: string; description: string; cover_url: string | null;
  genre: string; tags: string[]; status: string; language: string; audience: string;
  completed: boolean; updated_at: string; published_at: string | null;
};
type Tab = 'discover' | 'mine';
type MineFilter = 'all' | 'published' | 'draft' | 'ongoing';

export default function StoriesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [tab, setTab] = useState<Tab>('discover');
  const [filter, setFilter] = useState<MineFilter>('all');
  const [query, setQuery] = useState('');
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let request = supabase.from('works').select('*').eq('work_type', 'story');
      request = tab === 'mine'
        ? request.eq('author_id', userId).order('updated_at', { ascending: false })
        : request.eq('status', 'published').order('published_at', { ascending: false }).limit(50);
      const { data, error } = await request;
      if (error) throw error;
      setStories((data ?? []) as Story[]);
    } catch (error) {
      console.error('Hikayeler yüklenemedi:', error);
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, [tab, userId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR');
    return stories.filter((story) => {
      if (tab === 'mine') {
        if (filter === 'published' && story.status !== 'published') return false;
        if (filter === 'draft' && story.status !== 'draft') return false;
        if (filter === 'ongoing' && (story.completed || story.status !== 'published')) return false;
      }
      if (!needle) return true;
      return [story.title, story.description, story.genre, ...(story.tags ?? [])]
        .join(' ').toLocaleLowerCase('tr-TR').includes(needle);
    });
  }, [filter, query, stories, tab]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>OKUR HİKAYELERİ</Text>
          <Text style={styles.title}>Hikayeler</Text>
        </View>
        <Pressable onPress={() => router.push('/story-editor' as any)} style={styles.writeButton}>
          <Feather name="edit-3" size={16} color="#FFF" /><Text style={styles.writeText}>Yaz</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {([['discover','Keşfet'],['mine','Hikayelerim']] as const).map(([value,label]) => (
          <Pressable key={value} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.tabActive]}>
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.search}>
          <Feather name="search" size={17} color={colors.textMuted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Hikaye, tür veya konu ara" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
        </View>

        {tab === 'mine' && (
          <View style={styles.filters}>
            {([['all','Tümü'],['published','Yayındakiler'],['draft','Taslaklar'],['ongoing','Devam Edenler']] as const).map(([value,label]) => (
              <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}>
                <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>{tab === 'mine' ? 'Hikayelerim' : 'Yeni Hikayeler'}</Text>
            <Text style={styles.sectionMeta}>{visible.length} hikaye</Text>
          </View>
          <Feather name={tab === 'mine' ? 'folder' : 'sparkles'} size={18} color={colors.primary} />
        </View>

        {loading ? (
          <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.stateText}>Hikayeler hazırlanıyor...</Text></View>
        ) : !visible.length ? (
          <View style={styles.state}>
            <View style={styles.emptyIcon}><Feather name="feather" size={25} color={colors.primary} /></View>
            <Text style={styles.emptyTitle}>{tab === 'mine' ? 'Henüz hikaye yazmadın' : 'Henüz hikaye yok'}</Text>
            <Text style={styles.stateText}>{tab === 'mine' ? 'İlk hikayeni oluşturup bölümler halinde yayınlayabilirsin.' : 'Yeni hikayeler yayınlandığında burada görünecek.'}</Text>
            {tab === 'mine' && <Pressable onPress={() => router.push('/story-editor' as any)} style={styles.emptyAction}><Text style={styles.writeText}>Hikaye Oluştur</Text></Pressable>}
          </View>
        ) : (
          <View style={styles.list}>
            {visible.map((story) => (
              <Pressable key={story.id} onPress={() => router.push({ pathname: tab === 'mine' ? '/story-editor' : '/work', params: { id: story.id } } as any)} style={styles.card}>
                <BookCover uri={story.cover_url} style={styles.cover} resizeMode="cover">
                  <View style={[styles.cover, styles.coverFallback]}><Feather name="feather" size={25} color={colors.primary} /></View>
                </BookCover>
                <View style={styles.cardCopy}>
                  <View style={styles.badges}>
                    {!!story.genre && <Text style={styles.genre}>{story.genre}</Text>}
                    {tab === 'mine' && <Text style={styles.status}>{story.status === 'published' ? 'YAYINDA' : 'TASLAK'}</Text>}
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>{story.title}</Text>
                  <Text style={styles.desc} numberOfLines={2}>{story.description || 'Açıklama eklenmemiş.'}</Text>
                  <View style={styles.cardMeta}><Text style={styles.metaText}>{story.language.toUpperCase()}</Text><Text style={styles.dot}>•</Text><Text style={styles.metaText}>{story.completed ? 'Tamamlandı' : 'Devam ediyor'}</Text></View>
                  <View style={styles.openRow}><Text style={styles.openText}>{tab === 'mine' ? 'Düzenle' : 'Hikayeyi Oku'}</Text><Feather name="arrow-right" size={14} color={colors.primary} /></View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#08090D'}, header:{paddingHorizontal:18,paddingTop:14,paddingBottom:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  eyebrow:{color:'#A985FF',fontSize:9,fontWeight:'900',letterSpacing:1}, title:{color:'#F6F6F8',fontSize:27,fontWeight:'900',marginTop:2},
  writeButton:{minHeight:42,borderRadius:13,backgroundColor:'#6232B5',paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:7},writeText:{color:'#FFF',fontSize:11,fontWeight:'900'},
  tabs:{flexDirection:'row',paddingHorizontal:18,borderBottomWidth:1,borderBottomColor:'#24252D'},tab:{flex:1,minHeight:45,alignItems:'center',justifyContent:'center',borderBottomWidth:2,borderBottomColor:'transparent'},tabActive:{borderBottomColor:'#9B6CF0'},tabText:{color:'#777983',fontSize:12,fontWeight:'800'},tabTextActive:{color:'#E6DDF6'},
  content:{padding:18,paddingBottom:70},search:{minHeight:47,borderRadius:14,borderWidth:1,borderColor:'#292A33',backgroundColor:'#111218',paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:9},searchInput:{flex:1,color:'#F3F3F6',fontSize:12},
  filters:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:12},filter:{minHeight:34,borderRadius:999,borderWidth:1,borderColor:'#30313A',paddingHorizontal:11,alignItems:'center',justifyContent:'center'},filterActive:{borderColor:'#654A91',backgroundColor:'#241A35'},filterText:{color:'#777983',fontSize:9,fontWeight:'800'},filterTextActive:{color:'#D8C8FF'},
  sectionHead:{marginTop:22,marginBottom:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},sectionTitle:{color:'#F5F5F7',fontSize:20,fontWeight:'900'},sectionMeta:{color:'#70727C',fontSize:9,marginTop:3},
  state:{minHeight:280,borderRadius:20,borderWidth:1,borderColor:'#292A33',backgroundColor:'#111218',alignItems:'center',justifyContent:'center',padding:24,gap:8},stateText:{color:'#858791',fontSize:11,lineHeight:17,textAlign:'center'},emptyIcon:{width:50,height:50,borderRadius:17,backgroundColor:'#21172F',alignItems:'center',justifyContent:'center'},emptyTitle:{color:'#F1F1F4',fontSize:16,fontWeight:'900',marginTop:4},emptyAction:{marginTop:7,minHeight:40,borderRadius:11,backgroundColor:'#6232B5',paddingHorizontal:13,alignItems:'center',justifyContent:'center'},
  list:{gap:11},card:{minHeight:174,borderRadius:19,borderWidth:1,borderColor:'#292A33',backgroundColor:'#111218',padding:12,flexDirection:'row',gap:13},cover:{width:100,height:150,borderRadius:11,backgroundColor:'#181920'},coverFallback:{alignItems:'center',justifyContent:'center'},cardCopy:{flex:1,minWidth:0,paddingVertical:2},badges:{flexDirection:'row',flexWrap:'wrap',gap:6},genre:{color:'#CBB6F0',fontSize:8,fontWeight:'900',backgroundColor:'#21172F',borderRadius:999,paddingHorizontal:8,paddingVertical:4},status:{color:'#8DD5A5',fontSize:8,fontWeight:'900',backgroundColor:'#18281F',borderRadius:999,paddingHorizontal:8,paddingVertical:4},cardTitle:{color:'#F5F5F7',fontSize:18,lineHeight:23,fontWeight:'900',marginTop:7},desc:{color:'#8D8F99',fontSize:10,lineHeight:16,marginTop:5},cardMeta:{flexDirection:'row',gap:6,marginTop:8},metaText:{color:'#73757F',fontSize:9},dot:{color:'#494B54',fontSize:9},openRow:{marginTop:'auto',flexDirection:'row',alignItems:'center',gap:6},openText:{color:'#CBB6F0',fontSize:9,fontWeight:'900'}
});
