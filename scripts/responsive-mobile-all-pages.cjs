const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'src', 'app');
const EXTRA_FILES = [path.join(ROOT, 'src', 'components', 'BottomNav.tsx')];
const MARKER = 'RESPONSIVE_MOBILE_V1';

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

function collectStyleBlocks(source) {
  const blocks = [];
  const styleStartRegex = /\b([A-Za-z_$][\w$]*)\s*:\s*\{/g;
  let match;

  while ((match = styleStartRegex.exec(source))) {
    const name = match[1];
    const openIndex = source.indexOf('{', match.index);
    const closeIndex = findMatchingBrace(source, openIndex);
    if (closeIndex === -1) continue;

    // Sadece StyleSheet.create(...) sonrasında yer alan ve JSX olmayan stil benzeri blokları ele al.
    const before = source.slice(Math.max(0, match.index - 12000), match.index);
    const lastStyleSheet = before.lastIndexOf('StyleSheet.create({');
    const lastClose = before.lastIndexOf('});');
    if (lastStyleSheet === -1 || lastStyleSheet < lastClose) continue;

    blocks.push({ name, openIndex, closeIndex });
    styleStartRegex.lastIndex = closeIndex + 1;
  }

  return blocks;
}

function hasProp(body, prop) {
  return new RegExp(`(^|\\n)\\s*${prop}\\s*:`, 'm').test(body);
}

function addProps(body, props, indent) {
  const missing = props.filter(([key]) => !hasProp(body, key));
  if (!missing.length) return body;

  const addition = missing
    .map(([key, value]) => `${indent}${key}: ${value},`)
    .join('\n');

  const trimmed = body.replace(/\s*$/, '');
  return `${trimmed}\n${addition}\n`;
}

function patchLargeFixedWidths(body, indent) {
  let next = body;

  // Ekrandan büyük sabit genişlikleri mobilde yüzde 100'e düşür, eski değeri maxWidth olarak koru.
  next = next.replace(/(^|\n)(\s*)width\s*:\s*(\d{3,4})\s*,/g, (full, lead, spaces, raw) => {
    const width = Number(raw);
    if (width < 320) return full;
    if (hasProp(next, 'maxWidth')) return full;
    return `${lead}${spaces}width: '100%',\n${spaces}maxWidth: ${width},`;
  });

  next = next.replace(/(^|\n)(\s*)minWidth\s*:\s*(\d{3,4})\s*,/g, (full, lead, spaces, raw) => {
    const width = Number(raw);
    if (width < 280) return full;
    return `${lead}${spaces}minWidth: 0,\n${spaces}maxWidth: ${width},`;
  });

  return next;
}

function patchFile(file) {
  if (!fs.existsSync(file)) return { changed: false, reason: 'missing' };

  let source = fs.readFileSync(file, 'utf8');
  if (source.includes(MARKER)) {
    return { changed: false, reason: 'already' };
  }

  const original = source;
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const blocks = collectStyleBlocks(source);

  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const { name, openIndex, closeIndex } = blocks[i];
    let body = source.slice(openIndex + 1, closeIndex);
    const lineStart = source.lastIndexOf('\n', openIndex) + 1;
    const baseIndentMatch = source.slice(lineStart, openIndex).match(/^\s*/);
    const baseIndent = baseIndentMatch ? baseIndentMatch[0] : '  ';
    const propIndent = `${baseIndent}  `;

    body = patchLargeFixedWidths(body, propIndent);

    const props = [];

    if (/^(container|screen|page|root|wrapper|main)$/i.test(name)) {
      props.push(['width', "'100%'"]);
      props.push(['maxWidth', "'100%'"]);
      props.push(['minWidth', '0']);
    } else if (/(content|scrollContent|listContent|screenContent|pageContent)$/i.test(name)) {
      props.push(['maxWidth', "'100%'"]);
      props.push(['minWidth', '0']);
    }

    if (/(row|header|topBar|toolbar|actions|actionRow|stats|tabs|tabBar|bookAttachment|postHeader|commentHeader|itemRow|cardRow|metaRow|bottomBar)/i.test(name)) {
      props.push(['maxWidth', "'100%'"]);
      props.push(['minWidth', '0']);
    }

    if (/(title|subtitle|text|name|username|label|description|bio|message|bookTitle|author|meta)/i.test(name)) {
      props.push(['flexShrink', '1']);
      props.push(['minWidth', '0']);
    }

    if (/(input|search|button|card|modal|panel|section|image|cover|avatar)/i.test(name)) {
      props.push(['maxWidth', "'100%'"]);
    }

    if (/^tab$/i.test(name)) {
      // 5 sekmeli alt menünün küçük Android/iPhone ekranlarında dışarı taşmasını engeller.
      body = body.replace(/(^|\n)(\s*)minWidth\s*:\s*\d+\s*,/g, '$1$2minWidth: 0,');
      props.push(['minWidth', '0']);
      props.push(['flexBasis', '0']);
    }

    body = addProps(body, props, propIndent);

    source = source.slice(0, openIndex + 1) + body + source.slice(closeIndex);
  }

  // Uzun yatay satırlarda metin kutularının ekranı itmesini azaltır.
  source = source.replace(
    /flexDirection\s*:\s*['"]row['"]\s*,(?![\s\S]{0,120}?minWidth\s*:)/g,
    (match) => `${match}${eol}    minWidth: 0,`
  );

  // Dosyayı tekrar çalıştırdığımızı anlayabilmek için güvenli işaret.
  source = `${source.trimEnd()}${eol}${eol}// ${MARKER}${eol}`;

  if (source === original) {
    return { changed: false, reason: 'nochange' };
  }

  const backup = `${file}.before-responsive-mobile.bak`;
  fs.writeFileSync(backup, original, 'utf8');
  fs.writeFileSync(file, source, 'utf8');

  return { changed: true, backup };
}

if (!fs.existsSync(APP_DIR)) {
  console.error('HATA: src/app klasörü bulunamadı.');
  process.exit(1);
}

const appFiles = fs
  .readdirSync(APP_DIR)
  .filter((name) => name.endsWith('.tsx'))
  .filter((name) => name !== '_layout.tsx')
  .map((name) => path.join(APP_DIR, name));

const files = [...appFiles, ...EXTRA_FILES];
const changed = [];
const skipped = [];

for (const file of files) {
  try {
    const result = patchFile(file);
    const rel = path.relative(ROOT, file);
    if (result.changed) changed.push(rel);
    else skipped.push(`${rel} (${result.reason})`);
  } catch (error) {
    console.error(`HATA: ${path.relative(ROOT, file)} işlenemedi:`);
    console.error(error);
    process.exit(1);
  }
}

console.log('TAMAM: Mobil responsive temel düzen tüm sayfalara uygulandı.');
console.log(`Değiştirilen dosya sayısı: ${changed.length}`);
changed.forEach((file) => console.log(`  + ${file}`));
if (skipped.length) {
  console.log(`Atlanan dosya sayısı: ${skipped.length}`);
}
console.log('Her değişen dosyanın yanında .before-responsive-mobile.bak yedeği oluşturuldu.');
console.log('Amaç: küçük iPhone/Android ekranlarında yatay taşmayı, sabit genişlikleri ve sıkışan metin satırlarını azaltmak.');
