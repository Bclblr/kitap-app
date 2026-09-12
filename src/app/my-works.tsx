import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Action, Field, ReaderScreen, useReaderStyles } from '@/components/ReaderUI';
import WorksList from '@/components/WorksList';
import { useAuth } from '@/providers/AuthProvider';
export default function MyWorks() {
  const ui = useReaderStyles();
  const router = useRouter();
  const { session } = useAuth();
  const [section,setSection]=useState<'discover'|'mine'>('mine');
  const [status,setStatus]=useState<'draft'|'published'>('draft');
  const [genre,setGenre]=useState('');
  const [sort,setSort]=useState<'new'|'popular'>('new');
  return <ReaderScreen title="Okur Eserleri">
    <Text style={ui.muted}>Okurların kaleminden hikâyeler ve kendi yazı alanın.</Text>
    <View style={ui.row}><Action label={section==='discover'?'✓ Keşfet':'Keşfet'} onPress={()=>setSection('discover')}/><Action label={section==='mine'?'✓ Yazılarım':'Yazılarım'} onPress={()=>setSection('mine')}/></View>
    {section==='mine' ? <><Text style={ui.title}>Yazılarım</Text><View style={ui.row}><Action label={status==='draft'?'✓ Taslaklar':'Taslaklar'} onPress={()=>setStatus('draft')}/><Action label={status==='published'?'✓ Yayındakiler':'Yayındakiler'} onPress={()=>setStatus('published')}/><Action label="+ Yeni Eser" onPress={()=>router.push('/work-editor')}/></View><WorksList authorId={session!.user.id} own status={status}/></> : <>
      <Field label="Kategori / tür filtresi" value={genre} onChangeText={setGenre} placeholder="Örn. bilim kurgu"/>
      <View style={ui.row}><Action label={sort==='new'?'✓ Yeni çıkanlar':'Yeni çıkanlar'} onPress={()=>setSort('new')}/><Action label={sort==='popular'?'✓ Popüler eserler':'Popüler eserler'} onPress={()=>setSort('popular')}/></View>
      <WorksList genre={genre} sort={sort}/>
    </>}
  </ReaderScreen>;
}
