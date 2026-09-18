import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { showAdPrivacyOptions } from '@/lib/ads';

export default function AdPrivacyPreferences() {
  const [opening, setOpening] = useState(false);
  const enabled = process.env.EXPO_PUBLIC_ADS_ENABLED === 'true';
  const supported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

  if (!enabled || !supported) return null;

  async function openPreferences() {
    if (opening) return;
    setOpening(true);

    try {
      await showAdPrivacyOptions();
    } catch {
      Alert.alert(
        'Reklam tercihleri açılamadı',
        'Reklam gizlilik tercihleri şu anda açılamadı. Daha sonra tekrar deneyebilirsin.'
      );
    } finally {
      setOpening(false);
    }
  }

  return (
    <Pressable
      onPress={() => void openPreferences()}
      disabled={opening}
      accessibilityRole="button"
      accessibilityLabel="Reklam gizlilik tercihlerini aç"
      style={{
        minHeight: 76,
        borderRadius: 17,
        backgroundColor: '#15151D',
        borderWidth: 1,
        borderColor: '#292934',
        padding: 14,
        marginBottom: 10,
        justifyContent: 'center',
        opacity: opening ? 0.65 : 1,
      }}
    >
      <View>
        <Text style={{ color: '#F5F5F8', fontSize: 14, fontWeight: '800' }}>
          Reklam gizlilik tercihleri
        </Text>
        <Text style={{ color: '#8E8E9D', fontSize: 12, lineHeight: 17, marginTop: 3 }}>
          Kişiselleştirilmiş reklam ve onay tercihlerini görüntüle veya değiştir.
        </Text>
      </View>
    </Pressable>
  );
}
