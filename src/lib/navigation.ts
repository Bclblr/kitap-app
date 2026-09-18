import type { Href, useRouter } from 'expo-router';

type AppRouter = ReturnType<typeof useRouter>;

export function safeBack(router: AppRouter, fallback: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
