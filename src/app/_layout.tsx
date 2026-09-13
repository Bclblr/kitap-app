import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import RuntimeGate from '@/components/RuntimeGate';
import StoryMediaMaintenance from '@/components/StoryMediaMaintenance';
import { installGlobalErrorMonitoring } from '@/lib/error-monitoring';
import { configureProductionLogging } from '@/lib/production-logging';
import { trackProductEvent } from '@/lib/product-analytics';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { ContentFilterProvider } from '@/providers/ContentFilterProvider';
import { NetworkProvider, NetworkStatusBanner } from '@/providers/NetworkProvider';
import { PremiumProvider } from '@/providers/PremiumProvider';
import { ThemeProvider, useAppTheme } from '@/providers/ThemeProvider';

configureProductionLogging();
installGlobalErrorMonitoring();

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <NetworkProvider>
            <AuthProvider>
              <PremiumProvider>
                <ContentFilterProvider>
                  <GuardedLayout />
                </ContentFilterProvider>
              </PremiumProvider>
            </AuthProvider>
          </NetworkProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

function GuardedLayout() {
  const { session, loading } = useAuth();
  const { colors, scheme, ready } = useAppTheme();
  const router = useRouter();
  const segments = useSegments();
  const trackedUserRef = useRef<string | null>(null);
  const bookRouteActiveRef = useRef(false);
  const onboardingPending = session?.user?.user_metadata?.onboarding_pending === true;

  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (!userId || trackedUserRef.current === userId) return;
    trackedUserRef.current = userId;
    void trackProductEvent('app_open', { source: 'authenticated_session' });
  }, [session?.user?.id]);

  useEffect(() => {
    const onBookRoute = segments[0] === 'book';
    if (!onBookRoute) {
      bookRouteActiveRef.current = false;
      return;
    }
    if (!session || bookRouteActiveRef.current) return;
    bookRouteActiveRef.current = true;
    void trackProductEvent('book_opened', { source: 'book_detail' });
  }, [segments, session]);

  useEffect(() => {
    if (loading || !ready || !session || !onboardingPending) return;
    if (segments[0] === 'onboarding' || segments[0] === 'account-deletion') return;
    router.replace('/onboarding');
  }, [loading, onboardingPending, ready, router, segments, session]);

  if (loading || !ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator accessibilityLabel="Oturum yükleniyor" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <NetworkStatusBanner />
      <StoryMediaMaintenance />
      <RuntimeGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
          </Stack.Protected>

          {/* Public account lifecycle routes must remain reachable from the web. */}
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="verify-email" />
          <Stack.Screen name="account-deletion" />

          <Stack.Protected guard={!!session}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="explore" />
            <Stack.Screen name="shelves" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="review" />
            {[
              'book',
              'chat',
              'community',
              'community-editor',
              'event',
              'event-editor',
              'event-attendees',
              'hashtag',
              'messages',
              'my-works',
              'profile-settings',
              'premium',
              'premium-profile-customization',
              'premium-quote-cards',
              'premium-shelf-customization',
              'premium-reading-goals',
              'premium-reading-stats',
              'premium-year-report',
              'quote-create',
              'read',
              'readers',
              'work',
              'work-editor',
            ].map((name) => (
              <Stack.Screen key={name} name={name} />
            ))}
          </Stack.Protected>
          <Stack.Screen name="auth/callback" />
        </Stack>
      </RuntimeGate>
    </SafeAreaView>
  );
}
