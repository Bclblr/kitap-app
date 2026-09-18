import {
  resolveMatchedTransferUsers,
  transferUuidCandidates,
} from './identity.ts';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const C = '00000000-0000-4000-8000-000000000003';

Deno.test('anonymous RevenueCat aliases do not invalidate transfer candidates', () => {
  const candidates = transferUuidCandidates([
    '$RCAnonymousID:abc123',
    A,
    '$RCAnonymousID:def456',
    A,
  ]);

  if (candidates.length !== 1 || candidates[0] !== A) {
    throw new Error(`unexpected candidates: ${JSON.stringify(candidates)}`);
  }
});

Deno.test('one matched destination resolves successfully', () => {
  const result = resolveMatchedTransferUsers([A], [B]);
  if (!result.ok) throw new Error(result.error);
  if (result.destinationUserId !== B) throw new Error('wrong destination');
});

Deno.test('multiple real destination profiles are rejected', () => {
  const result = resolveMatchedTransferUsers([A], [B, C]);
  if (result.ok || result.error !== 'ambiguous_transfer_destination') {
    throw new Error('ambiguous destination was not rejected');
  }
});

Deno.test('destination cannot also be a source account', () => {
  const result = resolveMatchedTransferUsers([A, B], [B]);
  if (result.ok || result.error !== 'transfer_destination_is_source') {
    throw new Error('source/destination overlap was not rejected');
  }
});
