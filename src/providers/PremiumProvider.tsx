import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  loadCurrentUserPremiumAccess,
  PremiumAccess,
  resolvePremiumAccess,
} from '@/lib/premium';
import {
  configureRevenueCatForUser,
  detachRevenueCatUser,
  emptyRevenueCatSnapshot,
  RevenueCatSnapshot,
} from '@/lib/revenuecat';
import { useAuth } from '@/providers/AuthProvider';
import { useNetworkStatus } from '@/providers/NetworkProvider';

type PremiumContextValue = PremiumAccess & {
  ready: boolean;
  refreshing: boolean;
  error: string | null;
  revenueCat: RevenueCatSnapshot;
  reload: () => Promise<void>;
};

const EMPTY_ACCESS = resolvePremiumAccess([]);
const EMPTY_REVENUECAT = emptyRevenueCatSnapshot();

const PremiumContext = createContext<PremiumContextValue>({
  ...EMPTY_ACCESS,
  ready: false,
  refreshing: false,
  error: null,
  revenueCat: EMPTY_REVENUECAT,
  reload: async () => undefined,
});

export function PremiumProvider({ children }: PropsWithChildren) {
  const { session, loading: authLoading } = useAuth();
  const { isOnline, retrySignal } = useNetworkStatus();
  const [access, setAccess] = useState<PremiumAccess>(EMPTY_ACCESS);
  const [revenueCat, setRevenueCat] = useState<RevenueCatSnapshot>(EMPTY_REVENUECAT);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousUserIdRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (authLoading) return;

    const userId = session?.user?.id ?? null;

    if (!userId) {
      setAccess(resolvePremiumAccess([]));
      setRevenueCat(emptyRevenueCatSnapshot());
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
      const [nextAccess, revenueCatResult] = await Promise.all([
        loadCurrentUserPremiumAccess(),
        configureRevenueCatForUser(userId).catch((revenueCatError) => {
          console.warn('RevenueCat hazırlanamadı:', revenueCatError);
          return emptyRevenueCatSnapshot();
        }),
      ]);

      setAccess(nextAccess);
      setRevenueCat(revenueCatResult);
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

    const currentUserId = session?.user?.id ?? null;
    const previousUserId = previousUserIdRef.current;
    previousUserIdRef.current = currentUserId;

    if (!currentUserId) {
      if (previousUserId) {
        void detachRevenueCatUser().catch((revenueCatError) => {
          console.warn('RevenueCat oturumu kapatılamadı:', revenueCatError);
        });
      }

      setAccess(resolvePremiumAccess([]));
      setRevenueCat(emptyRevenueCatSnapshot());
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
      revenueCat,
      reload,
    }),
    [access, error, ready, refreshing, reload, revenueCat]
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium() {
  return useContext(PremiumContext);
}
