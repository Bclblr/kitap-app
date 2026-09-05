import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Action } from './ReaderUI';
type Ads = typeof import('react-native-google-mobile-ads');
let initialization: Promise<Ads | null> | undefined;
function initialize() {
  initialization ??= (async () => {
    try {
      const sdk = await import('react-native-google-mobile-ads');
      const consent = await sdk.AdsConsent.gatherConsent();
      if (!consent.canRequestAds) return null;
      await sdk.default().setRequestConfiguration({ testDeviceIdentifiers: ['EMULATOR'] });
      await sdk.default().initialize();
      return sdk;
    } catch { return null; }
  })();
  return initialization;
}
export default function AdSlot() {
  const [sdk, setSdk] = useState<Ads | null>(null);
  const [width, setWidth] = useState(0);
  const enabled = process.env.EXPO_PUBLIC_ADS_ENABLED === 'true';
  const supported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  useEffect(() => {
    if (!enabled || !supported) return;
    let alive = true;
    void initialize().then(result => { if (alive) setSdk(result); });
    return () => { alive = false; };
  }, [enabled, supported]);
  if (!enabled || !supported || !sdk) return null;
  const Banner = sdk.BannerAd;
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ width: '100%', overflow: 'hidden', alignItems: 'center', gap: 8, paddingVertical: 12 }}>
    <Text style={{ color: '#999', fontSize: 11 }}>Test reklamı</Text>
    {width >= 250 && <Banner key={width} width={Math.floor(width)} maxHeight={120} unitId={sdk.TestIds.BANNER} size={sdk.BannerAdSize.INLINE_ADAPTIVE_BANNER} onAdFailedToLoad={() => setSdk(null)} />}
    <Action label="Reklam gizlilik tercihleri" onPress={() => { void sdk.AdsConsent.showPrivacyOptionsForm().then(() => sdk.AdsConsent.getConsentInfo()).then(info => { if (!info.canRequestAds) setSdk(null); }).catch(() => setSdk(null)); }} />
  </View>;
}
