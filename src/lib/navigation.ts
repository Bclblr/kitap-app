import type { Href, Router } from 'expo-router';

export function safeBack(router: Router, fallback: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
