export type ContentFilterLevel = 'standard' | 'strict' | 'off';

export const DEFAULT_CONTENT_FILTER_LEVEL: ContentFilterLevel = 'standard';

const STANDARD_TERMS = [
  'porn',
  'pornografi',
  'pornographic',
  'nude',
  'çıplaklık',
  'ciplaklik',
  'sexual content',
  'sexually explicit',
  'self harm',
  'self-harm',
  'kendine zarar',
  'suicide',
  'intihar',
  'heroin',
  'kokain',
  'cocaine',
  'methamphetamine',
] as const;

const STRICT_TERMS = [
  ...STANDARD_TERMS,
  'uyuşturucu',
  'uyusturucu',
  'narcotic',
  'drug use',
  'kumar',
  'gambling',
  'şiddet',
  'siddet',
  'violence',
  'silah',
  'weapon',
  'kanlı',
  'kanli',
  'gore',
] as const;

function normalize(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKC')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsTerm(text: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordLikeStart = /^[\p{L}\p{N}]/u.test(term);
  const wordLikeEnd = /[\p{L}\p{N}]$/u.test(term);
  const pattern = `${wordLikeStart ? '(?<![\\p{L}\\p{N}_])' : ''}${escaped}${wordLikeEnd ? '(?![\\p{L}\\p{N}_])' : ''}`;
  return new RegExp(pattern, 'iu').test(text);
}

export function isContentFilterLevel(value: unknown): value is ContentFilterLevel {
  return value === 'standard' || value === 'strict' || value === 'off';
}

export function shouldFilterContentText(text: string | null | undefined, level: ContentFilterLevel) {
  if (level === 'off' || !text?.trim()) return false;
  const normalized = normalize(text);
  const terms = level === 'strict' ? STRICT_TERMS : STANDARD_TERMS;
  return terms.some((term) => containsTerm(normalized, normalize(term)));
}

export const CONTENT_FILTER_PLACEHOLDER = 'İçerik filtresi nedeniyle bu metin gizlendi.';
