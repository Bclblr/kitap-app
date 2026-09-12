import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { createSessionFromUrl } from '@/lib/google-auth';
import { supabase } from '@/lib/supabase';

function getParam(url: string, key: string) {
  const normalized = url.replace('#', '?');
  const query = normalized.split('?')[1] ?? '';
  return new URLSearchParams(query).get(key);
}

export default function AuthCallback() {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const url = Linking.useURL();
  const [finished, setFinished] = useState(false);
  const [destination, setDestination] = useState<'/' | '/onboarding' | '/login'>('/login');

  useEffect(() => {
    let alive = true;
    WebBrowser.maybeCompleteAuthSession();

    async function complete() {
      if (!url) {
        const timer = setTimeout(() => {
          if (alive) setFinished(true);
        }, 5000);
        return () => clearTimeout(timer);
      }

      try {
        const code = getParam(url, 'code');
        const accessToken = getParam(url, 'access_token');
        const next = getParam(url, 'next');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken) {
          await createSessionFromUrl(url);
        }

        const { data } = await supabase.auth.getSession();
        const activeSession = data.session;

        if (activeSession) {
          const onboardingPending = activeSession.user.user_metadata?.onboarding_pending === true;
          setDestination(next === 'onboarding' || onboardingPending ? '/onboarding' : '/');
        } else {
          setDestination('/login');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setDestination('/login');
      } finally {
        if (alive) setFinished(true);
      }

      return undefined;
    }

    let cleanup: undefined | (() => void);
    void complete().then((fn) => {
      cleanup = fn;
    });

    return () => {
      alive = false;
      cleanup?.();
    };
  }, [url]);

  if (session && finished) return <Redirect href={destination} />;
  if (finished) return <Redirect href={destination} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={colors.primary} />
      <Text style={{ color: colors.text }}>Giriş tamamlanıyor…</Text>
    </View>
  );
}
