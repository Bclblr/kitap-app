export function permanentImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}
export function requirePermanentImage(value: string | null | undefined): string | null {
  if (!value) return null;
  const url = permanentImageUrl(value);
  if (!url) throw new Error('Görsel yüklenemedi. Kalıcı HTTPS adresi gerekli.');
  return url;
}
