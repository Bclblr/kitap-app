const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const file = path.join(process.cwd(), 'src', 'app', 'index.tsx');
const marker = 'RESPONSIVE_HOME_SAFE_V1';

if (!fs.existsSync(file)) {
  console.error('HATA: src/app/index.tsx bulunamadı.');
  process.exit(1);
}

let source = fs.readFileSync(file, 'utf8');
const original = source;

if (source.includes(marker)) {
  console.log('Ana sayfa responsive düzenlemesi daha önce uygulanmış.');
  process.exit(0);
}

function parseErrors(text) {
  return ts
    .createSourceFile('index.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    .parseDiagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error);
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function addProps(styleName, props) {
  const re = new RegExp(`(^|\\n)(\\s*)${styleName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*:\\s*\\{`, 'm');
  const match = source.match(re);

  if (!match || match.index == null) {
    return false;
  }

  const openIndex = source.indexOf('{', match.index);
  const closeIndex = findMatchingBrace(source, openIndex);
  if (closeIndex === -1) return false;

  const body = source.slice(openIndex + 1, closeIndex);
  const additions = [];

  for (const [name, value] of Object.entries(props)) {
    const propRe = new RegExp(`(^|\\n)\\s*${name}\\s*:`, 'm');
    if (!propRe.test(body)) additions.push(`    ${name}: ${value},`);
  }

  if (!additions.length) return false;

  const trimmedBody = body.replace(/\s+$/, '');
  const needsComma = trimmedBody.length > 0 && !trimmedBody.endsWith(',');
  const suffixWhitespace = body.slice(trimmedBody.length);
  const insert = `${needsComma ? ',' : ''}\n${additions.join('\n')}\n  `;

  source =
    source.slice(0, openIndex + 1) +
    trimmedBody +
    insert +
    suffixWhitespace.replace(/^\s*/, '') +
    source.slice(closeIndex);

  return true;
}

const targets = {
  container: { width: "'100%'", maxWidth: "'100%'", minWidth: '0' },
  content: { width: "'100%'", maxWidth: "'100%'", minWidth: '0', alignSelf: "'stretch'" },
  homeHeader: { maxWidth: "'100%'", minWidth: '0' },
  headerRightActions: { maxWidth: "'100%'", minWidth: '0', flexShrink: '1' },
  homeHeaderText: { minWidth: '0' },
  greeting: { flexShrink: '1' },
  title: { flexShrink: '1' },
  topTabs: { maxWidth: "'100%'", minWidth: '0' },
  headerActions: { maxWidth: "'100%'", minWidth: '0' },
  exploreButton: { minWidth: '0', maxWidth: "'100%'" },
  exploreButtonText: { flexShrink: '1', minWidth: '0' },
  readerHighlights: { maxWidth: "'100%'", minWidth: '0' },
  readerHighlightCard: { minWidth: '0', maxWidth: "'100%'" },
  readerHighlightTitle: { flexShrink: '1' },
  readerHighlightText: { flexShrink: '1' },
  storyViewer: { maxWidth: "'100%'", minWidth: '0' },
  storyViewerUsername: { flexShrink: '1', maxWidth: "'100%'" },
  storyViewerImage: { maxWidth: "'100%'" },
  storyViewerText: { flexShrink: '1', maxWidth: "'100%'" },
  sectionHeader: { maxWidth: "'100%'", minWidth: '0' },
  sectionTitle: { flexShrink: '1', minWidth: '0' },
  storyCreateBox: { maxWidth: "'100%'", minWidth: '0' },
  storyPreview: { maxWidth: "'100%'" },
  createPostCard: { maxWidth: "'100%'", minWidth: '0' },
  createPostHeader: { maxWidth: "'100%'", minWidth: '0' },
  postPrompt: { minWidth: '0', maxWidth: "'100%'" },
  postPromptText: { flexShrink: '1', minWidth: '0' },
  postInput: { maxWidth: "'100%'", minWidth: '0' },
  postPreview: { maxWidth: "'100%'" },
  createActions: { maxWidth: "'100%'", minWidth: '0' },
  secondaryButton: { minWidth: '0', maxWidth: "'100%'" },
  secondaryButtonText: { flexShrink: '1', textAlign: "'center'" },
  primarySmallButton: { minWidth: '0', maxWidth: "'100%'" },
  primarySmallText: { flexShrink: '1', textAlign: "'center'" },
  postCard: { width: "'100%'", maxWidth: "'100%'", minWidth: '0', alignSelf: "'stretch'" },
  reviewCard: { width: "'100%'", maxWidth: "'100%'", minWidth: '0', alignSelf: "'stretch'" },
  postImage: { maxWidth: "'100%'" },
  postText: { flexShrink: '1', maxWidth: "'100%'" },
  quotePostText: { flexShrink: '1', maxWidth: "'100%'" },
  userRow: { maxWidth: "'100%'", minWidth: '0' },
  userInfo: { minWidth: '0' },
  username: { flexShrink: '1', minWidth: '0' },
  handle: { flexShrink: '1', minWidth: '0' },
  bookAttachment: { maxWidth: "'100%'", minWidth: '0' },
  bookAttachmentInfo: { minWidth: '0' },
  bookTitle: { flexShrink: '1', minWidth: '0' },
  rating: { maxWidth: "'100%'", minWidth: '0' },
  stars: { flexShrink: '1' },
  ratingNumber: { flexShrink: '1' },
  reviewText: { flexShrink: '1', maxWidth: "'100%'" },
  postActions: { maxWidth: "'100%'", minWidth: '0' },
  postAction: { minWidth: '0', flexShrink: '1' },
  postActionText: { flexShrink: '1', textAlign: "'center'" },
  actions: { maxWidth: "'100%'", minWidth: '0' },
  actionButton: { minWidth: '0', flexShrink: '1' },
  action: { flexShrink: '1' },
  commentBox: { maxWidth: "'100%'", minWidth: '0' },
  commentInput: { maxWidth: "'100%'", minWidth: '0' },
  commentButtons: { maxWidth: "'100%'", minWidth: '0', flexWrap: "'wrap'" },
  comments: { maxWidth: "'100%'", minWidth: '0' },
  comment: { maxWidth: "'100%'", minWidth: '0' },
  commentHeader: { maxWidth: "'100%'", minWidth: '0' },
  commentUser: { flexShrink: '1', minWidth: '0' },
  commentText: { flexShrink: '1', maxWidth: "'100%'" },
};

let changedCount = 0;
for (const [styleName, props] of Object.entries(targets)) {
  if (addProps(styleName, props)) changedCount += 1;
}

source = `${source.trimEnd()}\n\n// ${marker}\n`;

const beforeErrors = parseErrors(original);
const afterErrors = parseErrors(source);

if (afterErrors.length > beforeErrors.length) {
  console.error('HATA: Responsive düzenleme yeni sözdizimi hatası üretti. index.tsx değiştirilmedi.');
  console.error(`Önce: ${beforeErrors.length}, Sonra: ${afterErrors.length}`);
  process.exit(1);
}

const backup = `${file}.before-responsive-home-safe.bak`;
fs.writeFileSync(backup, original, 'utf8');
fs.writeFileSync(file, source, 'utf8');

console.log('TAMAM: Ana sayfa güvenli mobil responsive düzenlemeye alındı.');
console.log(`Güncellenen stil bloğu: ${changedCount}`);
console.log('Yedek:', backup);
console.log('Mevcut hikaye, kitap kapağı ve veri mantığı korunmuştur.');