const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRevenueCatAppUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function transferUuidCandidates(
  values: string[] | null | undefined
) {
  return [
    ...new Set(
      (values ?? [])
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(isRevenueCatAppUuid)
    ),
  ];
}

export function resolveMatchedTransferUsers(
  matchedSources: string[],
  matchedDestinations: string[]
):
  | { ok: true; sourceUserIds: string[]; destinationUserId: string }
  | { ok: false; error: string } {
  const sourceUserIds = [...new Set(matchedSources.filter(Boolean))];
  const destinationUserIds = [
    ...new Set(matchedDestinations.filter(Boolean)),
  ];

  if (sourceUserIds.length === 0) {
    return { ok: false, error: 'unknown_transfer_source' };
  }

  if (destinationUserIds.length === 0) {
    return { ok: false, error: 'unknown_transfer_destination' };
  }

  if (destinationUserIds.length > 1) {
    return { ok: false, error: 'ambiguous_transfer_destination' };
  }

  const destinationUserId = destinationUserIds[0];
  if (sourceUserIds.includes(destinationUserId)) {
    return { ok: false, error: 'transfer_destination_is_source' };
  }

  return {
    ok: true,
    sourceUserIds,
    destinationUserId,
  };
}
