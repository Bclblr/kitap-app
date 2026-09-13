import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import RuntimeGate from '@/components/RuntimeGate';
import StoryMediaMaintenance from '@/components/StoryMediaMaintenance';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { NetworkProvider, NetworkStatusBanner } from '@/providers/NetworkProvider';
import { ThemeProvider, useAppTheme } from '@/providers/ThemeProvider';

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <NetworkProvider>
            <AuthProvider>
              <GuardedLayout />
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
  const onboardingPending = session?.user?.user_metadata?.onboarding_pending === true;

  useEffect(() => {
    if (loading || !ready || !session || !onboardingPending) return;
    if (segments[0] === 'onboarding') return;
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

          {/* Recovery routes must stay reachable while logged out, and reset-password
              must also survive the temporary recovery session created by Supabase. */}
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="verify-email" />

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
