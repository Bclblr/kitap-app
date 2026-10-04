import { Stack, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import RuntimeGate from '@/components/RuntimeGate';
import StoryMediaMaintenance from '@/components/StoryMediaMaintenance';
import { getCurrentAdminAccess } from '@/lib/admin';
import { installGlobalErrorMonitoring } from '@/lib/error-monitoring';
import { configureProductionLogging } from '@/lib/production-logging';
import { trackProductEvent } from '@/lib/product-analytics';
import { notificationUrl, registerPushNotifications } from '@/lib/push-notifications';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { ContentFilterProvider } from '@/providers/ContentFilterProvider';
import { NetworkProvider, NetworkStatusBanner } from '@/providers/NetworkProvider';
import { PremiumProvider } from '@/providers/PremiumProvider';
import { ThemeProvider, useAppTheme } from '@/providers/ThemeProvider';

configureProductionLogging();
installGlobalErrorMonitoring();

const AUTHENTICATED_ROUTES = [
  'index',
  'onboarding',
  'explore',
  'shelves',
  'profile',
  'notifications',
  'review',
  'appearance-settings',
  'academic-search',
  'academic-work',
  'academic-author',
  'academic-institution',
  'journal',
  'blocked-users',
  'author',
  'person',
  'book',
  'chat',
  'community',
  'community-editor',
  'community-invites',
  'community-members',
  'content',
  'event',
  'event-editor',
  'event-attendees',
  'follow-requests',
  'hashtag',
  'messages',
  'my-works',
  'notification-settings',
  'premium',
  'premium-profile-customization',
  'premium-quote-cards',
  'premium-shelf-customization',
  'premium-reading-goals',
  'premium-reading-plan',
  'premium-reading-stats',
  'premium-reading-wrapped',
  'premium-year-report',
  'post-create',
  'privacy-data',
  'privacy-settings',
  'profile-settings',
  'quote-create',
  'read',
  'readers',
  'saved',
  'story-create',
  'stories',
  'story-editor',
  'work',
  'work-editor',
] as const;

const ADMIN_ROUTES = [
  'admin',
  'admin-admins',
  'admin-ads',
  'admin-analytics',
  'admin-announcements',
  'admin-audit',
  'admin-authors',
  'admin-books',
  'admin-communities',
  'admin-content',
  'admin-control-center',
  'admin-events',
  'admin-explore',
  'admin-hashtags',
  'admin-moderation',
  'admin-notifications',
  'admin-premium-history',
  'admin-premium',
  'admin-storage',
  'admin-system',
  'admin-trash',
  'admin-users',
  'admin-verification-history',
] as const;

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
  const handledNotificationRef = useRef<string | null>(null);
  const [adminReady, setAdminReady] = useState(false);
  const [canOpenAdmin, setCanOpenAdmin] = useState(false);
  const onboardingPending = session?.user?.user_metadata?.onboarding_pending === true;
  const sessionUserId = session?.user?.id ?? null;

  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (!userId || trackedUserRef.current === userId) return;
    trackedUserRef.current = userId;
    void trackProductEvent('app_open', { source: 'authenticated_session' });
  }, [session?.user?.id]);

  useEffect(() => {
    if (!sessionUserId) return;
    void registerPushNotifications(sessionUserId);
  }, [sessionUserId]);

  useEffect(() => {
    if (!sessionUserId) return;

    const openNotification = (notification: Notifications.Notification) => {
      const identifier = notification.request.identifier;
      if (handledNotificationRef.current === identifier) return;

      const url = notificationUrl(notification);
      if (!url) return;

      handledNotificationRef.current = identifier;
      Notifications.clearLastNotificationResponse();
      router.push(url as any);
    };

    const initialResponse = Notifications.getLastNotificationResponse();
    if (initialResponse?.notification) {
      openNotification(initialResponse.notification);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotification(response.notification);
    });

    return () => subscription.remove();
  }, [router, sessionUserId]);

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
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!sessionUserId) {
        setCanOpenAdmin(false);
        setAdminReady(true);
        return;
      }

      setAdminReady(false);
      void getCurrentAdminAccess()
        .then((access) => {
          if (!cancelled) setCanOpenAdmin(access.canOpenAdmin);
        })
        .catch((error) => {
          console.warn('Admin route guard yüklenemedi:', error);
          if (!cancelled) setCanOpenAdmin(false);
        })
        .finally(() => {
          if (!cancelled) setAdminReady(true);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionUserId]);


  useEffect(() => {
    if (loading || !ready || !session || !onboardingPending) return;
    if (segments[0] === 'onboarding' || segments[0] === 'account-deletion') return;
    router.replace('/onboarding');
  }, [loading, onboardingPending, ready, router, segments, session]);

  if (loading || !ready || (!!session && !adminReady)) {
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
          <Stack.Screen name="privacy-policy" />

          <Stack.Protected guard={!!session}>
            {AUTHENTICATED_ROUTES.map((name) => (
              <Stack.Screen key={name} name={name} />
            ))}

            <Stack.Protected guard={canOpenAdmin}>
              {ADMIN_ROUTES.map((name) => (
                <Stack.Screen key={name} name={name} />
              ))}
            </Stack.Protected>
          </Stack.Protected>

          <Stack.Screen name="auth/callback" />
        </Stack>
      </RuntimeGate>
    </SafeAreaView>
  );
}
