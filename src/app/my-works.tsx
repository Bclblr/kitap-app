import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { Action, Busy, ReaderScreen, ui } from '@/components/ReaderUI';
import WorksList from '@/components/WorksList';
import { supabase } from '@/lib/supabase';
export default function MyWorks() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>();
  useEffect(() => { let alive = true; supabase.auth.getUser().then(({ data }) => { if (alive) setUserId(data.user?.id ?? null); }).catch(() => { if (alive) setUserId(null); }); return () => { alive = false; }; }, []);
  return <ReaderScreen title="Kitap Yaz / Yayınla">{userId === undefined ? <Busy /> : !userId ? <><Text style={ui.muted}>Eserlerini yönetmek için giriş yap.</Text><Action label="Giriş yap" onPress={() => router.push('/login')} /></> : <><Action label="Yeni kitap" onPress={() => router.push('/work-editor')} /><WorksList authorId={userId} own /></>}</ReaderScreen>;
}
