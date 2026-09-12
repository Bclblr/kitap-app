import { Session } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
  useEffect(() => {
    let alive = true;
    let eventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      eventReceived = true;
      if (alive) setState({ session, loading: false });
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (alive && !eventReceived) setState({ session: error ? null : data.session, loading: false });
    }).catch(() => { if (alive && !eventReceived) setState({ session: null, loading: false }); });
    const refresh = (active: string) => {
      if (Platform.OS === 'web') return;
      if (active === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
    };
    refresh(AppState.currentState);
    const appState = AppState.addEventListener('change', refresh);
    return () => { alive = false; subscription.unsubscribe(); appState.remove(); if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh(); };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
