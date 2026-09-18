import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { usePremium } from '@/providers/PremiumProvider';
import { Action } from './ReaderUI';

type Ads = typeof import('react-native-google-mobile-ads');
let initialization: Promise<Ads | null> | undefined;

function initialize() {
  initialization ??= (async () => {
    try {
      const sdk = await import('react-native-google-mobile-ads');
      try {
        await sdk.AdsConsent.gatherConsent();
      } catch (error) {
        if (__DEV__) console.warn('Ad consent gathering failed:', error);
      }

      const consentInfo = await sdk.AdsConsent.getConsentInfo();
      if (!consentInfo.canRequestAds) return null;

      if (__DEV__) {
        await sdk.default().setRequestConfiguration({
          testDeviceIdentifiers: ['EMULATOR'],
        });
      }

      await sdk.default().initialize();
      return sdk;
    } catch {
      return null;
    }
  })();
  return initialization;
}

export default function AdSlot() {
  const premium = usePremium();
  const [sdk, setSdk] = useState<Ads | null>(null);
  const [width, setWidth] = useState(0);
  const enabled = process.env.EXPO_PUBLIC_ADS_ENABLED === 'true';
  const supported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  const canShowAds = premium.ready && !premium.isPremium && enabled && supported;

  useEffect(() => {
    if (!canShowAds) return;
    let alive = true;
    void initialize().then((result) => {
      if (alive) setSdk(result);
    });
    return () => {
      alive = false;
    };
  }, [canShowAds]);

  // Premium state must be resolved before any ad SDK UI can appear. This also
  // prevents a brief ad flash while a paid/admin entitlement is loading.
  if (!canShowAds || !sdk) return null;

  const productionBannerId =
    Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID?.trim()
      : process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID?.trim();
  const unitId = __DEV__ ? sdk.TestIds.BANNER : productionBannerId;
  if (!unitId) {
    if (__DEV__) console.warn('AdMob banner unit ID is missing for this platform.');
    return null;
  }

  const Banner = sdk.BannerAd;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ width: '100%', overflow: 'hidden', alignItems: 'center', gap: 8, paddingVertical: 12 }}
    >
      {__DEV__ ? <Text style={{ color: '#999', fontSize: 12 }}>Test reklamı</Text> : null}
      {width >= 250 ? (
        <Banner
          key={width}
          width={Math.floor(width)}
          maxHeight={120}
          unitId={unitId}
          size={sdk.BannerAdSize.INLINE_ADAPTIVE_BANNER}
          onAdFailedToLoad={() => setSdk(null)}
        />
      ) : null}
      <Action
        label="Reklam gizlilik tercihleri"
        onPress={() => {
          void sdk.AdsConsent.showPrivacyOptionsForm()
            .then(() => sdk.AdsConsent.getConsentInfo())
            .then((info) => {
              if (!info.canRequestAds) setSdk(null);
            })
            .catch(() => setSdk(null));
        }}
      />
    </View>
  );
}
