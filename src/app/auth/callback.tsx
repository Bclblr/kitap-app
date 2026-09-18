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
  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');

  const query =
    queryStart >= 0
      ? url.slice(
          queryStart + 1,
          hashStart > queryStart ? hashStart : undefined
        )
      : '';

  const fragment =
    hashStart >= 0
      ? url.slice(hashStart + 1)
      : '';

  return (
    new URLSearchParams(query).get(key) ??
    new URLSearchParams(fragment).get(key)
  );
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
      try {
        const callbackUrl = url ?? await Linking.getInitialURL();

        if (!callbackUrl) {
          const { data } = await supabase.auth.getSession();
          const activeSession = data.session;

          if (activeSession) {
            const onboardingPending =
              activeSession.user.user_metadata?.onboarding_pending === true;
            setDestination(onboardingPending ? '/onboarding' : '/');
          } else {
            setDestination('/login');
          }
          return;
        }

        const callbackError =
          getParam(callbackUrl, 'error_description') ??
          getParam(callbackUrl, 'error');

        if (callbackError) {
          throw new Error(callbackError);
        }

        const code = getParam(callbackUrl, 'code');
        const accessToken = getParam(callbackUrl, 'access_token');
        const next = getParam(callbackUrl, 'next');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken) {
          await createSessionFromUrl(callbackUrl);
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

    }

    void complete();

    return () => {
      alive = false;
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
