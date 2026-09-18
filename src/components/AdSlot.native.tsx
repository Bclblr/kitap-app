import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import {
  initializeAds,
  resetAdsInitialization,
  subscribeAdsConsentChanged,
} from '@/lib/ads';
import { usePremium } from '@/providers/PremiumProvider';

type Ads = typeof import('react-native-google-mobile-ads');

export default function AdSlot() {
  const premium = usePremium();
  const [sdk, setSdk] = useState<Ads | null>(null);
  const [width, setWidth] = useState(0);
  const [retrySignal, setRetrySignal] = useState(0);
  const [bannerRetrySignal, setBannerRetrySignal] = useState(0);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerRetryCountRef = useRef(0);
  const bannerRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = process.env.EXPO_PUBLIC_ADS_ENABLED === 'true';
  const supported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  const canShowAds = premium.ready && !premium.isPremium && enabled && supported;

  function scheduleRetry() {
    if (retryCountRef.current >= 3 || retryTimerRef.current) return;

    retryCountRef.current += 1;
    const delay = retryCountRef.current * 5000;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      resetAdsInitialization();
      setRetrySignal((value) => value + 1);
    }, delay);
  }

  function scheduleBannerRetry() {
    if (bannerRetryCountRef.current >= 3 || bannerRetryTimerRef.current) return;

    bannerRetryCountRef.current += 1;
    const delay = bannerRetryCountRef.current * 5000;
    bannerRetryTimerRef.current = setTimeout(() => {
      bannerRetryTimerRef.current = null;
      setBannerRetrySignal((value) => value + 1);
    }, delay);
  }

  useEffect(() => {
    return subscribeAdsConsentChanged(() => {
      retryCountRef.current = 0;
      bannerRetryCountRef.current = 0;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (bannerRetryTimerRef.current) {
        clearTimeout(bannerRetryTimerRef.current);
        bannerRetryTimerRef.current = null;
      }
      setSdk(null);
      setBannerRetrySignal((value) => value + 1);
      setRetrySignal((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    if (!canShowAds) return;

    let alive = true;

    void initializeAds().then((result) => {
      if (!alive) return;

      if (result) {
        retryCountRef.current = 0;
        setSdk(result);
        return;
      }

      // Initialization can fail because of a temporary SDK/network issue.
      // Retry with a bounded backoff instead of permanently caching null.
      scheduleRetry();
    });

    return () => {
      alive = false;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (bannerRetryTimerRef.current) {
        clearTimeout(bannerRetryTimerRef.current);
        bannerRetryTimerRef.current = null;
      }
    };
  }, [canShowAds, retrySignal]);

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
      style={{ width: '100%', overflow: 'hidden', alignItems: 'center', paddingVertical: 12 }}
    >
      {__DEV__ ? <Text style={{ color: '#999', fontSize: 12 }}>Test reklamı</Text> : null}
      {width >= 250 ? (
        <Banner
          key={`${width}-${bannerRetrySignal}`}
          width={Math.floor(width)}
          maxHeight={120}
          unitId={unitId}
          size={sdk.BannerAdSize.INLINE_ADAPTIVE_BANNER}
          onAdLoaded={() => {
            bannerRetryCountRef.current = 0;
            if (bannerRetryTimerRef.current) {
              clearTimeout(bannerRetryTimerRef.current);
              bannerRetryTimerRef.current = null;
            }
          }}
          onAdFailedToLoad={() => {
            scheduleBannerRetry();
          }}
        />
      ) : null}
    </View>
  );
}
