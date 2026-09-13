import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  loadCurrentUserPremiumAccess,
  PremiumAccess,
  resolvePremiumAccess,
} from '@/lib/premium';
import { useAuth } from '@/providers/AuthProvider';
import { useNetworkStatus } from '@/providers/NetworkProvider';

type PremiumContextValue = PremiumAccess & {
  ready: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const EMPTY_ACCESS = resolvePremiumAccess([]);

const PremiumContext = createContext<PremiumContextValue>({
  ...EMPTY_ACCESS,
  ready: false,
  refreshing: false,
  error: null,
  reload: async () => undefined,
});

export function PremiumProvider({ children }: PropsWithChildren) {
  const { session, loading: authLoading } = useAuth();
  const { isOnline, retrySignal } = useNetworkStatus();
  const [access, setAccess] = useState<PremiumAccess>(EMPTY_ACCESS);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (authLoading) return;

    if (!session?.user?.id) {
      setAccess(resolvePremiumAccess([]));
      setError(null);
      setReady(true);
      setRefreshing(false);
      return;
    }

    if (!isOnline) {
      setReady(true);
      return;
    }

    setRefreshing(true);

    try {
      const nextAccess = await loadCurrentUserPremiumAccess();
      setAccess(nextAccess);
      setError(null);
    } catch (loadError) {
      console.warn('Premium durumu alınamadı:', loadError);
      // Geçici bağlantı/backend hatasında mevcut Premium hakkını istemeden kapatma.
      setError('Premium durumu şu anda yenilenemedi.');
    } finally {
      setRefreshing(false);
      setReady(true);
    }
  }, [authLoading, isOnline, session?.user?.id]);

  useEffect(() => {
    if (authLoading) return;

    if (!session?.user?.id) {
      setAccess(resolvePremiumAccess([]));
      setError(null);
      setRefreshing(false);
      setReady(true);
      return;
    }

    setReady(false);
    void reload();
  }, [authLoading, reload, retrySignal, session?.user?.id]);

  const value = useMemo(
    () => ({
      ...access,
      ready,
      refreshing,
      error,
      reload,
    }),
    [access, error, ready, refreshing, reload]
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium() {
  return useContext(PremiumContext);
}
