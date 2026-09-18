import { Platform } from 'react-native';

type Ads = typeof import('react-native-google-mobile-ads');

let initialization: Promise<Ads | null> | undefined;
const listeners = new Set<() => void>();

export function subscribeAdsConsentChanged(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyConsentChanged() {
  for (const listener of listeners) listener();
}

export function resetAdsInitialization() {
  initialization = undefined;
}

export function initializeAds(): Promise<Ads | null> {
  if (initialization) return initialization;

  const attempt = (async () => {
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
    } catch (error) {
      if (__DEV__) console.warn('Ad SDK initialization failed:', error);
      return null;
    }
  })();

  initialization = attempt;

  void attempt.then((result) => {
    if (!result && initialization === attempt) {
      initialization = undefined;
    }
  });

  return attempt;
}

export async function showAdPrivacyOptions(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;

  try {
    const sdk = await import('react-native-google-mobile-ads');
    await sdk.AdsConsent.showPrivacyOptionsForm();
    const info = await sdk.AdsConsent.getConsentInfo();

    resetAdsInitialization();
    notifyConsentChanged();

    return info.canRequestAds;
  } catch (error) {
    if (__DEV__) console.warn('Ad privacy options could not be shown:', error);
    resetAdsInitialization();
    notifyConsentChanged();
    throw error;
  }
}
