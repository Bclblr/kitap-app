import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { palette, ThemeMode } from '@/theme/palette';

const ThemeContext = createContext({ mode: 'system' as ThemeMode, scheme: 'dark' as 'light' | 'dark', colors: palette.dark, ready: false, setMode: async (_mode: ThemeMode) => {} });
export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [mode, updateMode] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);
  useEffect(() => { let alive = true; void AsyncStorage.getItem('kitapp:theme').then(value => { if (alive && (value === 'system' || value === 'dark' || value === 'light')) updateMode(value); }).catch(() => {}).finally(() => { if (alive) setReady(true); }); return () => { alive = false; }; }, []);
  const scheme = mode === 'system' ? system === 'light' ? 'light' : 'dark' : mode;
  async function setMode(value: ThemeMode) { updateMode(value); await AsyncStorage.setItem('kitapp:theme', value); }
  return <ThemeContext.Provider value={{ mode, scheme, colors: palette[scheme], ready, setMode }}>{children}</ThemeContext.Provider>;
}
export function useAppTheme() { return useContext(ThemeContext); }
