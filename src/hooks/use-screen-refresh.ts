import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useNetworkStatus } from '@/providers/NetworkProvider';

export type ScreenRefreshSource = 'focus' | 'pull' | 'manual' | 'reconnect';

type Loader = (source: ScreenRefreshSource) => Promise<void> | void;

export function useScreenRefresh(loader: Loader) {
  const loaderRef = useRef(loader);
  const focusedRef = useRef(false);
  const lastRetrySignalRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const { retrySignal } = useNetworkStatus();

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const run = useCallback(async (source: ScreenRefreshSource) => {
    if (source === 'pull') setRefreshing(true);
    try {
      await loaderRef.current(source);
    } finally {
      if (source === 'pull') setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      void run('focus');

      return () => {
        focusedRef.current = false;
      };
    }, [run])
  );

  useEffect(() => {
    if (retrySignal === lastRetrySignalRef.current) return;

    lastRetrySignalRef.current = retrySignal;
    if (focusedRef.current) {
      void run('reconnect');
    }
  }, [retrySignal, run]);

  const onRefresh = useCallback(() => {
    void run('pull');
  }, [run]);

  const refresh = useCallback(() => run('manual'), [run]);

  return { refreshing, onRefresh, refresh };
}
