export type QuoteCardTemplate = 'classic' | 'editorial' | 'noir' | 'minimal';

export const QUOTE_CARD_LABELS: Record<QuoteCardTemplate, string> = {
  classic: 'Klasik',
  editorial: 'Editoryal',
  noir: 'Gece',
  minimal: 'Minimal',
};

export const PREMIUM_QUOTE_CARD_TEMPLATES: QuoteCardTemplate[] = [
  'editorial',
  'noir',
  'minimal',
];

export function isPremiumQuoteCard(template: QuoteCardTemplate) {
  return template !== 'classic';
}

export function normalizeQuoteCardTemplate(value: unknown): QuoteCardTemplate {
  return value === 'editorial' || value === 'noir' || value === 'minimal'
    ? value
    : 'classic';
}

export function quoteCardPalette(template: QuoteCardTemplate, fallback: { surface: string; text: string; textSecondary: string; border: string; primary: string }) {
  switch (template) {
    case 'editorial':
      return { background: '#F3E8D3', text: '#352719', secondary: '#745E46', border: '#CFAE7D', accent: '#9B6936' };
    case 'noir':
      return { background: '#111217', text: '#F7F4EF', secondary: '#B6B2AA', border: '#333640', accent: '#9B87F5' };
    case 'minimal':
      return { background: '#F7F7F8', text: '#202126', secondary: '#686A72', border: '#DEDFE4', accent: '#6662D9' };
    case 'classic':
    default:
      return { background: fallback.surface, text: fallback.text, secondary: fallback.textSecondary, border: fallback.border, accent: fallback.primary };
  }
}
