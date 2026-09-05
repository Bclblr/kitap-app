import { useLocalSearchParams } from 'expo-router';
import { ReaderScreen } from '@/components/ReaderUI';
import ReadersList from '@/components/ReadersList';
export default function Readers() {
  const { id, mode } = useLocalSearchParams<{ id?: string; mode?: string }>();
  return <ReaderScreen title="Okurlar"><ReadersList targetId={id} mode={mode === 'followers' || mode === 'following' ? mode : undefined} /></ReaderScreen>;
}
