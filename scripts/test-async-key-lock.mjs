import assert from 'node:assert/strict';
import { withKeyedAsyncLock } from '../src/lib/async-key-lock.ts';

const state = new Map();
state.set('user-a', []);

await Promise.all(
  Array.from({ length: 10 }, (_, index) =>
    withKeyedAsyncLock('user-a', async () => {
      const current = [...state.get('user-a')];
      await new Promise((resolve) => setTimeout(resolve, index % 3));
      current.push(index);
      state.set('user-a', current);
    })
  )
);

assert.equal(state.get('user-a').length, 10);
assert.deepEqual(
  [...state.get('user-a')].sort((a, b) => a - b),
  Array.from({ length: 10 }, (_, index) => index)
);

// Different keys should not share one queue.
let aDone = false;
let bDone = false;
await Promise.all([
  withKeyedAsyncLock('a', async () => { aDone = true; }),
  withKeyedAsyncLock('b', async () => { bDone = true; }),
]);
assert.equal(aDone, true);
assert.equal(bDone, true);

console.log('PASS: keyed async lock preserves 10 concurrent mutations');
