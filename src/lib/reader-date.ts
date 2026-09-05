/** Date-only values represent calendar days, not UTC instants. */
export function readerDate(value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Tarih bilinmiyor' : new Intl.DateTimeFormat('tr-TR', options).format(date);
}
export function storyAge(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  if (!Number.isFinite(minutes)) return '';
  return minutes < 1 ? 'Şimdi' : minutes < 60 ? `${minutes} dk önce` : `${Math.floor(minutes / 60)} sa önce`;
}
