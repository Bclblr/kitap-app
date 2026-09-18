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
  const accessRef = useRef<PremiumAccess>(EMPTY_ACCESS);
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
      return accessRef.current;
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

      accessRef.current = nextAccess;
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
  }, [authLoading, isOnline, session?.user?.id]);

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

      const empty = resolvePremiumAccess([]);
      accessRef.current = empty;
      setAccess(empty);
      setRevenueCat(emptyRevenueCatSnapshot());
      setError(null);
      setRefreshing(false);
      setReady(true);
      return;
    }

    // Do not render the previous user's Premium state while the new account loads.
    if (previousUserId !== currentUserId) {
      const empty = resolvePremiumAccess([]);
      accessRef.current = empty;
      setAccess(empty);
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

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (cancelled) return;

      const remainingMs = expirationMs - Date.now();

      if (remainingMs <= 0) {
        const next = resolvePremiumAccess(accessRef.current.allEntitlements);
        accessRef.current = next;
        setAccess(next);

        if (isOnline) {
          void reload().catch(() => undefined);
        }
        return;
      }

      timeout = setTimeout(
        schedule,
        Math.min(remainingMs + 250, 2_147_000_000)
      );
    };

    schedule();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
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
