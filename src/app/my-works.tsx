import { useState } from 'react';
import { Text, View } from 'react-native';
import { Action, Field, ReaderScreen, useReaderStyles } from '@/components/ReaderUI';
import WorksList from '@/components/WorksList';
import { useAuth } from '@/providers/AuthProvider';

export default function MyWorks() {
  const ui = useReaderStyles();
  const { session } = useAuth();
  const [section, setSection] = useState<'discover' | 'mine'>('discover');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [genre, setGenre] = useState('');
  const [sort, setSort] = useState<'new' | 'popular'>('new');

  return (
    <ReaderScreen title="Okur Eserleri">
      <Text style={ui.muted}>
        Okurların yayımlanmış eserlerini keşfedebilirsin. Eser yazma ve yayınlama alanı V1 sonrasındaki geliştirme dönemine kadar donduruldu.
      </Text>

      <View style={ui.row}>
        <Action label={section === 'discover' ? '✓ Keşfet' : 'Keşfet'} onPress={() => setSection('discover')} />
        <Action label={section === 'mine' ? '✓ Yazılarım' : 'Yazılarım'} onPress={() => setSection('mine')} />
      </View>

      {section === 'mine' ? (
        <>
          <Text style={ui.title}>Yazılarım</Text>
          <Text style={ui.muted}>
            Mevcut taslakların ve yayımlanmış eserlerin korunuyor. Yeni eser oluşturma V1 sonrasında yeniden açılacak.
          </Text>
          <View style={ui.row}>
            <Action label={status === 'draft' ? '✓ Taslaklar' : 'Taslaklar'} onPress={() => setStatus('draft')} />
            <Action label={status === 'published' ? '✓ Yayındakiler' : 'Yayındakiler'} onPress={() => setStatus('published')} />
          </View>
          {session ? <WorksList authorId={session.user.id} own status={status} /> : null}
        </>
      ) : (
        <>
          <Field label="Kategori / tür filtresi" value={genre} onChangeText={setGenre} placeholder="Örn. bilim kurgu" />
          <View style={ui.row}>
            <Action label={sort === 'new' ? '✓ Yeni çıkanlar' : 'Yeni çıkanlar'} onPress={() => setSort('new')} />
            <Action label={sort === 'popular' ? '✓ Popüler eserler' : 'Popüler eserler'} onPress={() => setSort('popular')} />
          </View>
          <WorksList genre={genre} sort={sort} />
        </>
      )}
    </ReaderScreen>
  );
}
