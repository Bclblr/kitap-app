import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

export async function signInWithApple() {
  const available = await AppleAuthentication.isAvailableAsync();

  if (!available) {
    throw new Error('Apple ile giriş bu cihazda kullanılamıyor.');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple kimlik doğrulama bilgisi alınamadı.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });

  if (error) {
    throw error;
  }

  return data.session;
}
