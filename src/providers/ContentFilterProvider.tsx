import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  ContentFilterLevel,
  DEFAULT_CONTENT_FILTER_LEVEL,
  isContentFilterLevel,
  shouldFilterContentText,
} from '@/lib/content-filter';
import { getRuntimeControls, settingString } from '@/lib/runtime-controls';
import { useAuth } from '@/providers/AuthProvider';
import { useNetworkStatus } from '@/providers/NetworkProvider';

type ContentFilterContextValue = {
  level: ContentFilterLevel;
  ready: boolean;
  shouldFilterText: (text: string | null | undefined) => boolean;
  reload: () => Promise<void>;
};

const ContentFilterContext = createContext<ContentFilterContextValue>({
  level: DEFAULT_CONTENT_FILTER_LEVEL,
  ready: false,
  shouldFilterText: () => false,
  reload: async () => undefined,
});

function resolveLevel(controls: Awaited<ReturnType<typeof getRuntimeControls>>) {
  const profileLevel = controls.profile_control?.content_filter_level;
  if (isContentFilterLevel(profileLevel)) return profileLevel;

  const defaultLevel = settingString(controls, 'default_content_filter', DEFAULT_CONTENT_FILTER_LEVEL);
  return isContentFilterLevel(defaultLevel) ? defaultLevel : DEFAULT_CONTENT_FILTER_LEVEL;
}

export function ContentFilterProvider({ children }: PropsWithChildren) {
  const { session, loading: authLoading } = useAuth();
  const { isOnline, retrySignal } = useNetworkStatus();
  const [level, setLevel] = useState<ContentFilterLevel>(DEFAULT_CONTENT_FILTER_LEVEL);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (authLoading) return;

    if (!isOnline) {
      setReady(true);
      return;
    }

    try {
      const controls = await getRuntimeControls();
      setLevel(resolveLevel(controls));
    } catch (error) {
      console.warn('İçerik filtresi ayarı alınamadı:', error);
      setLevel(DEFAULT_CONTENT_FILTER_LEVEL);
    } finally {
      setReady(true);
    }
  }, [authLoading, isOnline]);

  useEffect(() => {
    setReady(false);
    void reload();
  }, [reload, retrySignal, session?.user?.id]);

  const shouldFilterText = useCallback(
    (text: string | null | undefined) => shouldFilterContentText(text, level),
    [level]
  );

  const value = useMemo(
    () => ({ level, ready, shouldFilterText, reload }),
    [level, ready, reload, shouldFilterText]
  );

  return <ContentFilterContext.Provider value={value}>{children}</ContentFilterContext.Provider>;
}

export function useContentFilter() {
  return useContext(ContentFilterContext);
}
