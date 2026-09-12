import { Stack } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import RuntimeGate from '@/components/RuntimeGate';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { ThemeProvider, useAppTheme } from '@/providers/ThemeProvider';

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <GuardedLayout />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

function GuardedLayout() {
  const { session, loading } = useAuth();
  const { colors, scheme, ready } = useAppTheme();

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
      <RuntimeGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
          </Stack.Protected>
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
