import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ScreenRefreshSource = 'focus' | 'pull' | 'manual';

type Loader = (source: ScreenRefreshSource) => Promise<void> | void;

export function useScreenRefresh(loader: Loader) {
  const loaderRef = useRef(loader);
  const [refreshing, setRefreshing] = useState(false);

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
      void run('focus');
    }, [run])
  );

  const onRefresh = useCallback(() => {
    void run('pull');
  }, [run]);

  const refresh = useCallback(() => run('manual'), [run]);

  return { refreshing, onRefresh, refresh };
}
