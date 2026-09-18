const TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

module.exports = ({ config }) => {
  const requireProductionAds = process.env.ADMOB_REQUIRE_PRODUCTION === 'true';
  const androidAppId = process.env.ADMOB_ANDROID_APP_ID?.trim() || TEST_ANDROID_APP_ID;
  const iosAppId = process.env.ADMOB_IOS_APP_ID?.trim() || TEST_IOS_APP_ID;

  if (requireProductionAds) {
    const missing = [];
    if (!process.env.ADMOB_ANDROID_APP_ID?.trim()) missing.push('ADMOB_ANDROID_APP_ID');
    if (!process.env.ADMOB_IOS_APP_ID?.trim()) missing.push('ADMOB_IOS_APP_ID');
    if (!process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID?.trim()) {
      missing.push('EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID');
    }
    if (!process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID?.trim()) {
      missing.push('EXPO_PUBLIC_ADMOB_IOS_BANNER_ID');
    }
    if (process.env.EXPO_PUBLIC_ADS_ENABLED !== 'true') {
      missing.push('EXPO_PUBLIC_ADS_ENABLED=true');
    }
    if (!process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim()) {
      missing.push('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY');
    }
    if (!process.env.EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID?.trim()) {
      missing.push('EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID');
    }
    if (!process.env.EXPO_PUBLIC_REVENUECAT_IOS_ANNUAL_PRODUCT_ID?.trim()) {
      missing.push('EXPO_PUBLIC_REVENUECAT_IOS_ANNUAL_PRODUCT_ID');
    }
    if (!process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim()) {
      missing.push('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY');
    }
    if (!process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID?.trim()) {
      missing.push('EXPO_PUBLIC_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID');
    }
    if (!process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID?.trim()) {
      missing.push('EXPO_PUBLIC_REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID');
    }
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
    const supabasePublishableKey =
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

    if (!supabaseUrl) {
      missing.push('EXPO_PUBLIC_SUPABASE_URL');
    } else {
      try {
        const parsedSupabaseUrl = new URL(supabaseUrl);
        if (
          parsedSupabaseUrl.protocol !== 'https:' ||
          !parsedSupabaseUrl.hostname.endsWith('.supabase.co')
        ) {
          missing.push('EXPO_PUBLIC_SUPABASE_URL(valid https://*.supabase.co)');
        }
      } catch {
        missing.push('EXPO_PUBLIC_SUPABASE_URL(valid URL)');
      }
    }

    if (!supabasePublishableKey) {
      missing.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    }

    if (!process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim()) {
      missing.push('EXPO_PUBLIC_PRIVACY_POLICY_URL');
    }
    if (!process.env.EXPO_PUBLIC_SUPPORT_URL?.trim()) {
      missing.push('EXPO_PUBLIC_SUPPORT_URL');
    }

    if (missing.length) {
      throw new Error(
        `Production store configuration is incomplete: ${missing.join(', ')}`
      );
    }
  }

  const plugins = (config.plugins || []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads') {
      return [
        'react-native-google-mobile-ads',
        {
          ...plugin[1],
          androidAppId,
          iosAppId,
          delayAppMeasurementInit: true,
          userTrackingUsageDescription:
            'Bu tanımlayıcı, izin vermen durumunda sana daha ilgili reklamlar göstermek için kullanılabilir.',
        },
      ];
    }
    return plugin;
  });

  if (!plugins.some((plugin) => plugin === 'expo-sharing' || (Array.isArray(plugin) && plugin[0] === 'expo-sharing'))) {
    plugins.push('expo-sharing');
  }

  plugins.push([
    'expo-build-properties',
    {
      android: {
        extraProguardRules:
          '-keep class com.google.android.gms.internal.consent_sdk.** { *; }',
      },
    },
  ]);

  return {
    ...config,
    plugins,
  };
};
