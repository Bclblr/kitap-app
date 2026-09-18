import { Session } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { clearAccountLocalState } from '@/lib/account-local-state';
import { clearSignedImageUrlCache } from '@/lib/image-cache';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true });

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    let eventReceived = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      eventReceived = true;

      const previousUserId = lastUserIdRef.current;
      const nextUserId = session?.user?.id ?? null;

      if (previousUserId && previousUserId !== nextUserId) {
        clearSignedImageUrlCache(previousUserId);
      }

      if (event === 'SIGNED_OUT' && previousUserId) {
        void clearAccountLocalState(previousUserId).catch((error) => {
          console.warn('Hesap yerel verileri temizlenemedi:', error);
        });
      }

      lastUserIdRef.current = nextUserId;
      if (alive) setState({ session, loading: false });
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive || eventReceived) return;
      const session = error ? null : data.session;
      lastUserIdRef.current = session?.user?.id ?? null;
      setState({ session, loading: false });
    }).catch(() => {
      if (alive && !eventReceived) {
        clearSignedImageUrlCache();
        lastUserIdRef.current = null;
        setState({ session: null, loading: false });
      }
    });

    const refresh = (active: string) => {
      if (Platform.OS === 'web') return;
      if (active === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };

    refresh(AppState.currentState);
    const appState = AppState.addEventListener('change', refresh);

    return () => {
      alive = false;
      subscription.unsubscribe();
      appState.remove();
      if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
