const fs = require('fs');

const path = 'src/app/explore.tsx';
let source = fs.readFileSync(path, 'utf8');

if (source.includes('const searchAbortRef = useRef<AbortController | null>(null);')) {
  console.log('Explore search improvements already applied.');
  process.exit(0);
}

const refsOld = `  const searchRequestIdRef = useRef(0);\n  const skipNextSearchRef = useRef(false);`;
const refsNew = `  const searchRequestIdRef = useRef(0);\n  const searchAbortRef = useRef<AbortController | null>(null);\n  const searchCacheRef = useRef(new Map<string, { books: Book[]; users: UserProfile[]; authors: Author[] }>());\n  const skipNextSearchRef = useRef(false);`;
if (!source.includes(refsOld)) throw new Error('Search refs anchor not found');
source = source.replace(refsOld, refsNew);

const startMarker = '  const searchAll = useCallback(async () => {';
const endMarker = `\n\n  useEffect(() => {\n    if (!query.trim()) {`;
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('Search function anchors not found');

const replacement = `  const searchAll = useCallback(async () => {
    const searchText = query.trim();
    if (!searchText) return;

    const normalizedQuery = searchText.toLocaleLowerCase('tr-TR');
    const cached = searchCacheRef.current.get(normalizedQuery);
    if (cached) {
      setBooks(cached.books);
      setUsers(cached.users);
      setAuthors(cached.authors);
      setSearched(true);
      setLoading(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setLoading(true);
    setSearched(true);

    try {
      const [userResult, bookResponse, authorResponse] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, profile_image, bio')
          .ilike('username', \`%\${searchText}%\`)
          .limit(10),
        fetch(
          \`https://openlibrary.org/search.json?q=\${encodeURIComponent(searchText)}&limit=20&fields=key,title,author_name,cover_i,edition_key,isbn,first_publish_year\`,
          { signal: controller.signal }
        ),
        fetch(
          \`https://openlibrary.org/search/authors.json?q=\${encodeURIComponent(searchText)}&limit=10\`,
          { signal: controller.signal }
        ),
      ]);

      if (requestId !== searchRequestIdRef.current) return;

      const rankText = (value: string | null | undefined) => {
        const normalized = (value ?? '').toLocaleLowerCase('tr-TR');
        if (normalized === normalizedQuery) return 3;
        if (normalized.startsWith(normalizedQuery)) return 2;
        if (normalized.includes(normalizedQuery)) return 1;
        return 0;
      };

      const nextUsers = (userResult.error ? [] : ((userResult.data ?? []) as UserProfile[]))
        .slice()
        .sort((a, b) => rankText(b.username) - rankText(a.username));

      let nextBooks: Book[] = [];
      if (bookResponse.ok) {
        const bookData = await bookResponse.json();
        const docs: Book[] = Array.isArray(bookData.docs) ? bookData.docs : [];
        nextBooks = docs
          .filter(
            (item, index, all) =>
              !!item.key && all.findIndex((candidate) => candidate.key === item.key) === index
          )
          .sort((a, b) => rankText(b.title) - rankText(a.title));
      }

      let nextAuthors: Author[] = [];
      if (authorResponse.ok) {
        const authorData = await authorResponse.json();
        nextAuthors = (Array.isArray(authorData.docs)
          ? authorData.docs.map((author: any) => ({
              key: author.key || author.author_key?.[0],
              name: author.name,
              birth_date: author.birth_date,
              top_work: author.top_work,
              work_count: author.work_count,
            }))
          : [])
          .filter((item: Author) => !!item.name)
          .sort((a: Author, b: Author) => rankText(b.name) - rankText(a.name));
      }

      if (requestId !== searchRequestIdRef.current) return;

      setUsers(nextUsers);
      setBooks(nextBooks);
      setAuthors(nextAuthors);

      searchCacheRef.current.set(normalizedQuery, {
        books: nextBooks,
        users: nextUsers,
        authors: nextAuthors,
      });
      if (searchCacheRef.current.size > 20) {
        const oldestKey = searchCacheRef.current.keys().next().value;
        if (oldestKey) searchCacheRef.current.delete(oldestKey);
      }

      void supabase.rpc('log_search_event', {
        p_query: searchText,
        p_scope: 'explore',
        p_result_count: nextBooks.length + nextUsers.length + nextAuthors.length,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Genel arama hatası:', error);
    } finally {
      if (requestId === searchRequestIdRef.current) setLoading(false);
    }
  }, [query]);`;

source = source.slice(0, start) + replacement + source.slice(end);
source = source.replace(
  '    const timer = setTimeout(() => void searchAll(), 600);',
  '    const timer = setTimeout(() => void searchAll(), 350);'
);

fs.writeFileSync(path, source);
console.log('Explore search improvements applied.');
