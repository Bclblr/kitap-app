import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { SUPABASE_URL } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';

type NetworkContextValue = {
  isOnline: boolean;
  networkAvailable: boolean | null;
  backendReachable: boolean;
  checking: boolean;
  retrySignal: number;
  checkNow: () => Promise<boolean>;
};

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  networkAvailable: null,
  backendReachable: true,
  checking: false,
  retrySignal: 0,
  checkNow: async () => true,
});

const CHECK_INTERVAL_MS = 30_000;
const CHECK_TIMEOUT_MS = 6_000;

function browserNetworkAvailability(): boolean | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  return navigator.onLine;
}

async function canReachBackend() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function NetworkProvider({ children }: PropsWithChildren) {
  const [networkAvailable, setNetworkAvailable] = useState<boolean | null>(
    browserNetworkAvailability()
  );
  const [backendReachable, setBackendReachable] = useState(true);
  const [checking, setChecking] = useState(false);
  const [retrySignal, setRetrySignal] = useState(0);
  const backendWasUnavailableRef = useRef(false);

  const checkNow = useCallback(async () => {
    setChecking(true);

    const transportAvailable = browserNetworkAvailability();
    if (transportAvailable !== null) setNetworkAvailable(transportAvailable);

    if (transportAvailable === false) {
      backendWasUnavailableRef.current = true;
      setBackendReachable(false);
      setChecking(false);
      return false;
    }

    const nextBackendReachable = await canReachBackend();
    const reconnected =
      nextBackendReachable && backendWasUnavailableRef.current;

    backendWasUnavailableRef.current = !nextBackendReachable;
    setBackendReachable(nextBackendReachable);
    setChecking(false);

    if (reconnected) {
      setRetrySignal((value) => value + 1);
    }

    return nextBackendReachable;
  }, []);

  useEffect(() => {
    const initialCheck = setTimeout(() => void checkNow(), 0);

    const interval = setInterval(() => {
      void checkNow();
    }, CHECK_INTERVAL_MS);

    const appState = Platform.OS === 'web'
      ? null
      : AppState.addEventListener('change', (state) => {
          if (state === 'active') void checkNow();
        });

    const handleOnline = () => {
      setNetworkAvailable(true);
      void checkNow();
    };

    const handleOffline = () => {
      setNetworkAvailable(false);
      backendWasUnavailableRef.current = true;
      setBackendReachable(false);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
      appState?.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [checkNow]);

  const value = useMemo(
    () => ({
      isOnline: backendReachable,
      networkAvailable,
      backendReachable,
      checking,
      retrySignal,
      checkNow,
    }),
    [networkAvailable, backendReachable, checking, retrySignal, checkNow]
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus() {
  return useContext(NetworkContext);
}

export function NetworkStatusBanner() {
  const { colors } = useAppTheme();
  const {
    networkAvailable,
    backendReachable,
    checking,
    checkNow,
  } = useNetworkStatus();

  if (backendReachable) return null;

  const message =
    networkAvailable === false
      ? 'İnternet bağlantısı yok. Açık içerikler görüntülenebilir; yeni işlemler bağlantı gelince yapılabilir.'
      : 'Sunucuya şu anda ulaşılamıyor. İnternet bağlantın çalışıyor olabilir; tekrar denediğinde uygulama sunucu durumunu yeniden kontrol eder.';

  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bağlantıyı yeniden kontrol et"
        disabled={checking}
        onPress={() => void checkNow()}
        style={({ pressed }) => [
          styles.button,
          { borderColor: colors.primary },
          (pressed || checking) && styles.pressed,
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.primary }]}>
          {checking ? 'Kontrol ediliyor…' : 'Tekrar Dene'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 48,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  message: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  button: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.6,
  },
});
