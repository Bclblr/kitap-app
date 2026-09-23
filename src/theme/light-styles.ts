import type { AppColors } from './palette';

type Style = Record<string, unknown>;

function rgb(value: unknown) {
  if (typeof value !== 'string' || !/^#([\da-f]{3}|[\da-f]{6})$/i.test(value)) return null;
  const hex = value.length === 4 ? value.slice(1).split('').map(c => c + c).join('') : value.slice(1);
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
}

function solidAccent(value: unknown) {
  const channels = rgb(value);
  if (!channels) return false;
  const [r, g, b] = channels;
  return b > r && b - g > 35 && b > 145;
}

// Feed story labels are UI; full-screen story playback remains authored media.
const storyUI = /^(addStoryCircle|addStoryBadge|addStoryIcon|storyRing(?:Seen|Unseen)?|storyCircleInner|storyCountBadge|storyCountText|storyName(?:Seen)?|storyCreateBox)$/;
const fixedMedia = /^(story|splash)|^(removeImageText)$/i;

/** Light-only semantic resolution. Never runs for the existing dark theme. */
export function resolveLightStyle(name: string, authored: Style, fallback: Style, all: Record<string, object>, colors: AppColors): Style {
  if (fixedMedia.test(name) && !storyUI.test(name)) return authored;
  const result = { ...fallback };
  for (const [key, value] of Object.entries(authored)) {
    const channels = rgb(value);
    if (!channels) continue;
    const [r, g, b] = channels;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (key === 'backgroundColor') {
      if (solidAccent(value)) result[key] = colors.primary;
      else if (b > r && b - g > 12 && spread > 18) result[key] = colors.primarySoft;
      else if (spread < 45 && Math.min(r, g, b) > 185) result[key] = colors.surface;
      if (/input|textArea|searchShell/i.test(name)) result[key] = colors.input;
      if (/card|sheet$|drawerPanel/i.test(name) && spread < 38 && Math.max(r, g, b) < 75) result[key] = colors.surface;
      if (/selected|active|^unreadCard$/i.test(name) && !/inactive/i.test(name) && !solidAccent(value)) result[key] = colors.primarySoft;
      if (/divider|separator|^orLine$/i.test(name)) result[key] = colors.divider;
      if (/handle$/i.test(name)) result[key] = colors.border;
      if (/^(postCard|reviewPostCard|quotePostCard)$/.test(name)) result[key] = colors.surface;
      if (/success/i.test(name)) result[key] = colors.successSoft;
      if (/danger|delete|logout/i.test(name)) result[key] = colors.dangerSoft;
      if (/warning/i.test(name)) result[key] = colors.warningSoft;
    }
    if (key === 'color' || key === 'tintColor') {
      if (g > r && g > b && spread > 35) result[key] = colors.success;
      else if (r > b && r > g && g > 95 && spread > 45) result[key] = colors.warning;
      else if (r > g + 35 && r > b) result[key] = colors.danger;
      if (/warningTitle/.test(name)) result[key] = colors.warning;
      if (/warningText/.test(name)) result[key] = colors.textSecondary;
      if (/selected|active/i.test(name) && !/inactive/i.test(name)) result[key] = colors.primary;
      // Resolve text against its actual solid parent, not every white literal.
      const stem = name.replace(/^disabled/i, '').replace(/(?:Subtext|Text|Label|Icon|Arrow)$/i, '').replace(/^Button/, 'button');
      const parents = [stem, `${stem}Button`, stem.replace(/Button$/, '')];
      if (parents.some(parent => solidAccent((all[parent] as Style | undefined)?.backgroundColor))) result[key] = colors.onPrimary;
    }
  }
  if (/disabled/i.test(name) && typeof result.opacity === 'number') result.opacity = Math.max(result.opacity, 0.8);
  if (name === 'bottomBar' && typeof authored.backgroundColor === 'string' && authored.backgroundColor.startsWith('rgba')) result.backgroundColor = colors.surface;
  if (/^(primarySmallButton|emptyButton|floatingCreateButton|myMessageBubble)$/.test(name)) result.backgroundColor = colors.primary;
  if (/^(addStoryIcon|trendingHashtag)$/.test(name)) result.color = colors.primary;
  if (name === 'floatingCreateButton') result.borderColor = colors.primary;
  if (/^(primarySmallText|emptyButtonText|floatingCreateIcon|myMessageText|myMessageTime|readStatus|readStatusRead|storyCountText)$/.test(name)) result.color = colors.onPrimary;
  if (name === 'myMessageBubble') result.borderColor = colors.primary;
  if (/^(storyName|storyNameSeen)$/.test(name)) result.color = colors.textSecondary;
  if (name === 'storyRingSeen') Object.assign(result, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary });
  if (/^(addStoryCircle|addStoryBadge)$/.test(name)) Object.assign(result, { backgroundColor: colors.surface, borderColor: colors.primary });
  if (/^(storyRingUnseen|storyCircleInner|storyCreateBox)$/.test(name)) result.backgroundColor = colors.surface;
  if (name === 'storyRingUnseen') result.borderColor = colors.primary;
  if (name === 'storyCountBadge') Object.assign(result, { backgroundColor: colors.primary, borderColor: colors.surface });
  if (name === 'messageBadge') Object.assign(result, { backgroundColor: colors.danger, borderColor: colors.surface });
  if (name === 'messageBadgeText') result.color = colors.onPrimary;
  if (/^(resultTitle|discoveryCardTitle)$/.test(name) && result.fontWeight === '900') result.fontWeight = '800';
  return result;
}
