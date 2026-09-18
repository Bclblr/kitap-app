const assert = require('node:assert/strict');

const PAGE_SIZE = 15;

function compareDesc(a, b) {
  const timeDiff = Date.parse(b.created_at) - Date.parse(a.created_at);
  if (timeDiff !== 0) return timeDiff;
  return String(b.id).localeCompare(String(a.id));
}

function pageSource(rows, cursor) {
  const ordered = [...rows].sort(compareDesc);
  const filtered = cursor
    ? ordered.filter((row) => {
        if (row.created_at < cursor.createdAt) return true;
        if (row.created_at > cursor.createdAt) return false;
        return String(row.id) < cursor.id;
      })
    : ordered;

  return filtered.slice(0, PAGE_SIZE);
}

function nextCursor(rows) {
  const last = rows.at(-1);
  return last
    ? { createdAt: last.created_at, id: String(last.id) }
    : null;
}

function collectAll(sources) {
  const cursors = { posts: null, reviews: null, quotes: null };
  const exhausted = { posts: false, reviews: false, quotes: false };
  const seen = new Set();

  for (let safety = 0; safety < 20; safety += 1) {
    let progressed = false;

    for (const key of Object.keys(sources)) {
      if (exhausted[key]) continue;

      const rows = pageSource(sources[key], cursors[key]);
      for (const row of rows) seen.add(`${key}:${row.id}`);

      if (rows.length) {
        cursors[key] = nextCursor(rows);
        progressed = true;
      }

      if (rows.length < PAGE_SIZE) exhausted[key] = true;
    }

    if (Object.values(exhausted).every(Boolean)) break;
    if (!progressed) throw new Error('Pagination stopped making progress.');
  }

  return seen;
}

function iso(minute) {
  return new Date(Date.UTC(2026, 8, 18, 12, minute, 0)).toISOString();
}

// Regression: one old quote must never drag the post cursor backwards.
const sources = {
  posts: Array.from({ length: 40 }, (_, index) => ({
    id: String(1000 - index).padStart(4, '0'),
    created_at: iso(59 - index),
  })),
  reviews: Array.from({ length: 4 }, (_, index) => ({
    id: String(2000 - index),
    created_at: iso(15 - index),
  })),
  quotes: [{ id: '3000', created_at: iso(0) }],
};

const seen = collectAll(sources);
const expectedCount = Object.entries(sources).reduce(
  (sum, [, rows]) => sum + rows.length,
  0
);
assert.equal(seen.size, expectedCount);
for (const [key, rows] of Object.entries(sources)) {
  for (const row of rows) {
    assert.ok(seen.has(`${key}:${row.id}`), `missing ${key}:${row.id}`);
  }
}

// Equal timestamps must advance deterministically by id.
const tied = {
  posts: Array.from({ length: 31 }, (_, index) => ({
    id: String(5000 - index),
    created_at: iso(30),
  })),
  reviews: [],
  quotes: [],
};
const tiedSeen = collectAll(tied);
assert.equal(tiedSeen.size, tied.posts.length);

console.log('PASS: source-specific deterministic feed pagination');
