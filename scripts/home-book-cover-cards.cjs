const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'app', 'index.tsx');

if (!fs.existsSync(file)) {
  console.error('HATA: src/app/index.tsx bulunamadı.');
  process.exit(1);
}

let source = fs.readFileSync(file, 'utf8');
const original = source;
const eol = source.includes('\r\n') ? '\r\n' : '\n';
const withEol = (value) => value.replace(/\n/g, eol);

if (source.includes('const [bookCoverUrls, setBookCoverUrls]')) {
  console.log('Bu değişiklik daha önce uygulanmış görünüyor.');
  process.exit(0);
}

// useEffect importu
if (!/\buseEffect\b/.test(source.split("from 'react';")[0])) {
  const next = source.replace(
    /import \{\s*useCallback,\s*useState\s*\} from 'react';/,
    "import { useCallback, useEffect, useState } from 'react';"
  );

  if (next === source) {
    console.error('HATA: React importu bulunamadı. Dosyada değişiklik yapılmadı.');
    process.exit(1);
  }

  source = next;
}

// Kapak URL cache state'i
{
  const marker = /const \[stories, setStories\] = useState<Story\[]>\(\);?/;
  const match = source.match(marker);

  if (!match) {
    console.error('HATA: stories state alanı bulunamadı. Dosyada değişiklik yapılmadı.');
    process.exit(1);
  }

  source = source.replace(
    marker,
    withEol(`${match[0]}\n  const [bookCoverUrls, setBookCoverUrls] =\n    useState<Record<string, string | null>>({});`)
  );
}

// Post ve incelemelerdeki kitaplar için Open Library kapaklarını yükle.
{
  const screenLoadMarker = /\s*\/\*\s*\n\s*\* =+\s*\n\s*\* EKRAN YÜKLE\s*\n\s*\* =+\s*\n\s*\*\//;
  const markerMatch = source.match(screenLoadMarker);

  if (!markerMatch || markerMatch.index == null) {
    console.error('HATA: EKRAN YÜKLE bölümü bulunamadı. Dosyada değişiklik yapılmadı.');
    process.exit(1);
  }

  const block = withEol(`

  useEffect(() => {
    const bookKeys = Array.from(
      new Set(
        [
          ...posts.map((post) => post.book_key),
          ...reviews.map((review) => review.bookKey),
        ].filter((value): value is string => !!value)
      )
    );

    const missingKeys = bookKeys.filter(
      (bookKey) => !(bookKey in bookCoverUrls)
    );

    if (missingKeys.length === 0) {
      return;
    }

    let cancelled = false;

    Promise.all(
      missingKeys.map(async (bookKey) => {
        try {
          const response = await fetch(
            \`https://openlibrary.org\${bookKey}.json\`
          );

          if (!response.ok) {
            return [bookKey, null] as const;
          }

          const data = await response.json();
          const coverId = Array.isArray(data?.covers)
            ? data.covers.find(
                (id: unknown) =>
                  typeof id === 'number' && id > 0
              )
            : null;

          const coverUrl = coverId
            ? \`https://covers.openlibrary.org/b/id/\${coverId}-M.jpg\`
            : null;

          return [bookKey, coverUrl] as const;
        } catch (error) {
          console.error(
            'Kitap kapağı alınamadı:',
            bookKey,
            error
          );
          return [bookKey, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      setBookCoverUrls((current) => {
        const next = { ...current };

        entries.forEach(([bookKey, coverUrl]) => {
          next[bookKey] = coverUrl;
        });

        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [posts, reviews, bookCoverUrls]);
`);

  source =
    source.slice(0, markerMatch.index) +
    block +
    source.slice(markerMatch.index);
}

// Kitap ikonlarını gerçek kapaklarla değiştir.
{
  const iconRegex = /<View style=\{styles\.bookAttachmentIcon\}>\s*<Text style=\{styles\.bookAttachmentEmoji\}>▥<\/Text>\s*<\/View>/g;
  let changed = 0;

  source = source.replace(iconRegex, (block, offset) => {
    const nearby = source.slice(offset, offset + 700);

    if (nearby.includes('{post.book_title}')) {
      changed += 1;
      return withEol(`<View style={styles.bookAttachmentIcon}>
                    {post.book_key && bookCoverUrls[post.book_key] ? (
                      <Image
                        source={{ uri: bookCoverUrls[post.book_key] as string }}
                        style={styles.bookAttachmentCover}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.bookAttachmentEmoji}>▥</Text>
                    )}
                  </View>`);
    }

    if (nearby.includes('{review.bookTitle}')) {
      changed += 1;
      return withEol(`<View style={styles.bookAttachmentIcon}>
                      {review.bookKey && bookCoverUrls[review.bookKey] ? (
                        <Image
                          source={{ uri: bookCoverUrls[review.bookKey] as string }}
                          style={styles.bookAttachmentCover}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.bookAttachmentEmoji}>▥</Text>
                      )}
                    </View>`);
    }

    return block;
  });

  if (changed === 0) {
    console.error('HATA: Ana sayfadaki kitap ikonları bulunamadı. Dosyada değişiklik yapılmadı.');
    process.exit(1);
  }
}

// Kapak görseli stili ve ikon kutusuna clipping.
if (!source.includes('bookAttachmentCover:')) {
  source = source.replace(
    /(bookAttachmentIcon:\s*\{[\s\S]*?borderRadius:\s*7,)/,
    `$1${eol}    overflow: 'hidden',`
  );

  const styleMarker = /\s*bookAttachmentEmoji:\s*\{/;
  const styleMatch = source.match(styleMarker);

  if (!styleMatch || styleMatch.index == null) {
    console.error('HATA: bookAttachmentEmoji stili bulunamadı. Dosyada değişiklik yapılmadı.');
    process.exit(1);
  }

  const coverStyle = withEol(`

  bookAttachmentCover: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
  },
`);

  source =
    source.slice(0, styleMatch.index) +
    coverStyle +
    source.slice(styleMatch.index);
}

if (source === original) {
  console.log('Değişiklik gerekmedi.');
  process.exit(0);
}

const backup = file + '.before-book-covers.bak';
fs.writeFileSync(backup, original, 'utf8');
fs.writeFileSync(file, source, 'utf8');

console.log('TAMAM: Ana sayfadaki kitap kartlarına kapak görselleri eklendi.');
console.log('Yedek:', backup);
console.log('Kapak bulunamazsa mevcut ▥ simgesi yedek olarak gösterilir.');
