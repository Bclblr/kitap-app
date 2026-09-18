const lockTails = new Map<string, Promise<void>>();

export async function withKeyedAsyncLock<T>(
  key: string,
  operation: () => Promise<T>
): Promise<T> {
  const previous = lockTails.get(key) ?? Promise.resolve();

  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  const tail = previous
    .catch(() => undefined)
    .then(() => current);

  lockTails.set(key, tail);

  await previous.catch(() => undefined);

  try {
    return await operation();
  } finally {
    release();
    if (lockTails.get(key) === tail) {
      lockTails.delete(key);
    }
  }
}
