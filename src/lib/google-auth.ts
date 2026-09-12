import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri({
  scheme: 'kitapapp',
  path: 'auth/callback',
});

export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(
      String(params.error_description ?? params.error ?? errorCode)
    );
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (!accessToken || !refreshToken) {
    throw new Error('Google oturumu oluşturulamadı.');
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: String(accessToken),
    refresh_token: String(refreshToken),
  });

  if (error) throw error;

  return data.session;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;

  if (!data.url) {
    throw new Error('Google giriş adresi oluşturulamadı.');
  }

  const result = await WebBrowser.openAuthSessionAsync(
    data.url,
    redirectTo
  );

  if (result.type !== 'success') {
    return null;
  }

  return createSessionFromUrl(result.url);
}
