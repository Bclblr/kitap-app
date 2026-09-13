let configured = false;

const noop = (..._args: unknown[]) => undefined;

export function configureProductionLogging() {
  if (configured) return;
  configured = true;

  if (typeof __DEV__ !== 'undefined' && __DEV__) return;

  console.log = noop;
  console.debug = noop;
}
