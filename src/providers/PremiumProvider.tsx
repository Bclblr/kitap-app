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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useNetworkStatus } from '@/providers/NetworkProvider';

type PremiumContextValue = PremiumAccess & {
  ready: boolean;
  refreshing: boolean;
  error: string | null;
  revenueCat: RevenueCatSnapshot;
  reload: () => Promise<PremiumAccess>;
};

const EMPTY_ACCESS = resolvePremiumAccess([]);
const EMPTY_REVENUECAT = emptyRevenueCatSnapshot();

const PremiumContext = createContext<PremiumContextValue>({
  ...EMPTY_ACCESS,
  ready: false,
  refreshing: false,
  error: null,
  revenueCat: EMPTY_REVENUECAT,
  reload: async () => EMPTY_ACCESS,
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
  const activeUserIdRef = useRef<string | null>(null);
  const reloadSequenceRef = useRef(0);

  const reload = useCallback(async (): Promise<PremiumAccess> => {
    if (authLoading) return EMPTY_ACCESS;

    const userId = session?.user?.id ?? null;
    const requestSequence = ++reloadSequenceRef.current;
    activeUserIdRef.current = userId;

    if (!userId) {
      const empty = resolvePremiumAccess([]);
      setAccess(empty);
      setRevenueCat(emptyRevenueCatSnapshot());
      setError(null);
      setReady(true);
      setRefreshing(false);
      return empty;
    }

    if (!isOnline) {
      setReady(true);
      return access;
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

      // A request started for an old account must never overwrite the state of
      // a user who signed in while that request was still running.
      if (
        requestSequence !== reloadSequenceRef.current ||
        activeUserIdRef.current !== userId
      ) {
        return nextAccess;
      }

      setAccess(nextAccess);
      setRevenueCat(revenueCatResult);
      setError(null);
      return nextAccess;
    } catch (loadError) {
      if (
        requestSequence === reloadSequenceRef.current &&
        activeUserIdRef.current === userId
      ) {
        console.warn('Premium durumu alınamadı:', loadError);
        // Geçici bağlantı/backend hatasında mevcut Premium hakkını istemeden kapatma.
        setError('Premium durumu şu anda yenilenemedi.');
      }
      throw loadError;
    } finally {
      if (
        requestSequence === reloadSequenceRef.current &&
        activeUserIdRef.current === userId
      ) {
        setRefreshing(false);
        setReady(true);
      }
    }
  }, [access, authLoading, isOnline, session?.user?.id]);

  useEffect(() => {
    if (authLoading) return;

    const currentUserId = session?.user?.id ?? null;
    const previousUserId = previousUserIdRef.current;

    previousUserIdRef.current = currentUserId;
    activeUserIdRef.current = currentUserId;
    // Invalidate every in-flight request whenever the authenticated identity changes.
    reloadSequenceRef.current += 1;

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

    // Do not render the previous user's Premium state while the new account loads.
    if (previousUserId !== currentUserId) {
      setAccess(resolvePremiumAccess([]));
      setRevenueCat(emptyRevenueCatSnapshot());
      setError(null);
    }

    setReady(false);
    void reload().catch(() => undefined);
  }, [authLoading, reload, retrySignal, session?.user?.id]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`premium-entitlements:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'premium_entitlements',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void reload().catch(() => undefined);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload, session?.user?.id]);

  useEffect(() => {
    if (!access.nextExpirationAt) return;

    const expirationMs = Date.parse(access.nextExpirationAt);
    if (!Number.isFinite(expirationMs)) return;

    const remainingMs = expirationMs - Date.now();
    const delay = Math.max(0, Math.min(remainingMs + 250, 2_147_000_000));

    const timeout = setTimeout(() => {
      // Recompute locally first so an expired entitlement never remains active
      // just because the app has stayed open for a long time.
      setAccess((current) => resolvePremiumAccess(current.allEntitlements));

      if (isOnline) {
        void reload().catch(() => undefined);
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [access.nextExpirationAt, isOnline, reload]);

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
