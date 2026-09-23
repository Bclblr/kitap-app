const OPENALEX_BASE = 'https://api.openalex.org';
const CROSSREF_BASE = 'https://api.crossref.org';

export type AcademicAuthorSummary = {
  id: string;
  name: string;
  orcid: string | null;
  institutionName: string | null;
  institutionId: string | null;
  worksCount: number;
  citedByCount: number;
  topics: string[];
};

export type AcademicJournalSummary = {
  id: string;
  name: string;
  issnL: string | null;
  issn: string[];
  publisher: string | null;
  homepageUrl: string | null;
  countryCode: string | null;
  worksCount: number;
  citedByCount: number;
};

export type AcademicInstitutionSummary = {
  id: string;
  name: string;
  countryCode: string | null;
  city: string | null;
  type: string | null;
  homepageUrl: string | null;
  worksCount: number;
  citedByCount: number;
};

export type AcademicWork = {
  id: string;
  doi: string | null;
  title: string;
  abstract: string | null;
  publicationYear: number | null;
  publicationDate: string | null;
  type: string | null;
  language: string | null;
  citedByCount: number;
  primaryTopic: string | null;
  authors: AcademicAuthorSummary[];
  journal: AcademicJournalSummary | null;
  externalUrl: string | null;
  openAccessUrl: string | null;
  pdfUrl: string | null;
  isOpenAccess: boolean;
};

export type CrossrefWork = {
  publisher: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  url: string | null;
  subject: string[];
};

type OpenAlexList<T> = {
  results?: T[];
  meta?: { count?: number; next_cursor?: string | null };
};

function cleanOpenAlexId(value: unknown, prefix: 'W' | 'A' | 'S' | 'I'): string {
  const text = typeof value === 'string' ? value.trim() : '';
  const match = text.match(new RegExp(`(?:^|/)(${prefix}\\d+)$`, 'i'));
  return match?.[1]?.toUpperCase() ?? text;
}

function openAlexEntityPath(id: string, prefix: 'W' | 'A' | 'S' | 'I') {
  const clean = cleanOpenAlexId(id, prefix);
  return clean ? `${OPENALEX_BASE}/${prefix === 'W' ? 'works' : prefix === 'A' ? 'authors' : prefix === 'S' ? 'sources' : 'institutions'}/${encodeURIComponent(clean)}` : null;
}

function reconstructAbstract(index: Record<string, number[]> | null | undefined): string | null {
  if (!index || typeof index !== 'object') return null;
  const pairs: { word: string; pos: number }[] = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      if (Number.isInteger(pos)) pairs.push({ word, pos });
    }
  }
  if (!pairs.length) return null;
  return pairs.sort((a, b) => a.pos - b.pos).map((item) => item.word).join(' ');
}

function topicNames(value: any): string[] {
  const candidates = [
    value?.primary_topic?.display_name,
    ...(Array.isArray(value?.topics) ? value.topics.map((item: any) => item?.display_name) : []),
    ...(Array.isArray(value?.x_concepts) ? value.x_concepts.slice(0, 5).map((item: any) => item?.display_name) : []),
  ];
  return [...new Set(candidates.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))].slice(0, 6);
}

export function normalizeAcademicAuthor(value: any): AcademicAuthorSummary {
  const institution = value?.last_known_institutions?.[0] ?? value?.last_known_institution ?? value?.affiliations?.[0]?.institution ?? null;
  return {
    id: cleanOpenAlexId(value?.id, 'A'),
    name: typeof value?.display_name === 'string' ? value.display_name : 'Bilinmeyen akademisyen',
    orcid: typeof value?.orcid === 'string' ? value.orcid.replace(/^https?:\/\/orcid\.org\//i, '') : null,
    institutionName: typeof institution?.display_name === 'string' ? institution.display_name : null,
    institutionId: institution?.id ? cleanOpenAlexId(institution.id, 'I') : null,
    worksCount: Number(value?.works_count) || 0,
    citedByCount: Number(value?.cited_by_count) || 0,
    topics: topicNames(value),
  };
}

export function normalizeAcademicJournal(value: any): AcademicJournalSummary | null {
  if (!value) return null;
  return {
    id: cleanOpenAlexId(value?.id, 'S'),
    name: typeof value?.display_name === 'string' ? value.display_name : 'Bilinmeyen dergi',
    issnL: typeof value?.issn_l === 'string' ? value.issn_l : null,
    issn: Array.isArray(value?.issn) ? value.issn.filter((item: unknown): item is string => typeof item === 'string') : [],
    publisher:
      typeof value?.host_organization_name === 'string'
        ? value.host_organization_name
        : typeof value?.publisher === 'string'
          ? value.publisher
          : null,
    homepageUrl: typeof value?.homepage_url === 'string' ? value.homepage_url : null,
    countryCode: typeof value?.country_code === 'string' ? value.country_code : null,
    worksCount: Number(value?.works_count) || 0,
    citedByCount: Number(value?.cited_by_count) || 0,
  };
}

export function normalizeAcademicInstitution(value: any): AcademicInstitutionSummary {
  const city = value?.geo?.city;
  return {
    id: cleanOpenAlexId(value?.id, 'I'),
    name: typeof value?.display_name === 'string' ? value.display_name : 'Bilinmeyen kurum',
    countryCode: typeof value?.country_code === 'string' ? value.country_code : null,
    city: typeof city === 'string' ? city : null,
    type: typeof value?.type === 'string' ? value.type : null,
    homepageUrl: typeof value?.homepage_url === 'string' ? value.homepage_url : null,
    worksCount: Number(value?.works_count) || 0,
    citedByCount: Number(value?.cited_by_count) || 0,
  };
}

export function normalizeAcademicWork(value: any): AcademicWork {
  const authors = Array.isArray(value?.authorships)
    ? value.authorships
        .map((entry: any) => {
          const author = normalizeAcademicAuthor({
            ...(entry?.author ?? {}),
            last_known_institutions: Array.isArray(entry?.institutions) ? entry.institutions : [],
          });
          return author.id ? author : null;
        })
        .filter((item: AcademicAuthorSummary | null): item is AcademicAuthorSummary => !!item)
    : [];

  const source = value?.primary_location?.source ?? value?.best_oa_location?.source ?? null;
  const journal = normalizeAcademicJournal(source);
  const openAccessUrl =
    typeof value?.best_oa_location?.landing_page_url === 'string'
      ? value.best_oa_location.landing_page_url
      : typeof value?.open_access?.oa_url === 'string'
        ? value.open_access.oa_url
        : null;
  const pdfUrl =
    typeof value?.best_oa_location?.pdf_url === 'string'
      ? value.best_oa_location.pdf_url
      : typeof value?.primary_location?.pdf_url === 'string'
        ? value.primary_location.pdf_url
        : null;

  return {
    id: cleanOpenAlexId(value?.id, 'W'),
    doi: typeof value?.doi === 'string' ? value.doi.replace(/^https?:\/\/doi\.org\//i, '') : null,
    title: typeof value?.display_name === 'string' ? value.display_name : typeof value?.title === 'string' ? value.title : 'Başlıksız çalışma',
    abstract: reconstructAbstract(value?.abstract_inverted_index),
    publicationYear: Number.isInteger(value?.publication_year) ? value.publication_year : null,
    publicationDate: typeof value?.publication_date === 'string' ? value.publication_date : null,
    type: typeof value?.type === 'string' ? value.type : null,
    language: typeof value?.language === 'string' ? value.language : null,
    citedByCount: Number(value?.cited_by_count) || 0,
    primaryTopic: typeof value?.primary_topic?.display_name === 'string' ? value.primary_topic.display_name : null,
    authors,
    journal,
    externalUrl:
      typeof value?.primary_location?.landing_page_url === 'string'
        ? value.primary_location.landing_page_url
        : typeof value?.doi === 'string'
          ? value.doi
          : null,
    openAccessUrl,
    pdfUrl,
    isOpenAccess: value?.open_access?.is_oa === true,
  };
}

async function fetchJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Academic API HTTP ${response.status}`);
  return response.json();
}

export async function searchAcademicWorks(query: string, limit = 20, signal?: AbortSignal): Promise<AcademicWork[]> {
  const clean = query.trim();
  if (!clean) return [];
  const url = `${OPENALEX_BASE}/works?search=${encodeURIComponent(clean)}&per-page=${Math.min(50, Math.max(1, limit))}`;
  const data = (await fetchJson(url, signal)) as OpenAlexList<any>;
  return (data.results ?? []).map(normalizeAcademicWork);
}

export async function searchAcademicAuthors(query: string, limit = 20, signal?: AbortSignal): Promise<AcademicAuthorSummary[]> {
  const clean = query.trim();
  if (!clean) return [];
  const url = `${OPENALEX_BASE}/authors?search=${encodeURIComponent(clean)}&per-page=${Math.min(50, Math.max(1, limit))}`;
  const data = (await fetchJson(url, signal)) as OpenAlexList<any>;
  return (data.results ?? []).map(normalizeAcademicAuthor);
}

export async function searchAcademicJournals(query: string, limit = 20, signal?: AbortSignal): Promise<AcademicJournalSummary[]> {
  const clean = query.trim();
  if (!clean) return [];
  const url = `${OPENALEX_BASE}/sources?search=${encodeURIComponent(clean)}&filter=type:journal&per-page=${Math.min(50, Math.max(1, limit))}`;
  const data = (await fetchJson(url, signal)) as OpenAlexList<any>;
  return (data.results ?? []).map(normalizeAcademicJournal).filter((item): item is AcademicJournalSummary => !!item);
}

export async function searchAcademicInstitutions(query: string, limit = 20, signal?: AbortSignal): Promise<AcademicInstitutionSummary[]> {
  const clean = query.trim();
  if (!clean) return [];
  const url = `${OPENALEX_BASE}/institutions?search=${encodeURIComponent(clean)}&per-page=${Math.min(50, Math.max(1, limit))}`;
  const data = (await fetchJson(url, signal)) as OpenAlexList<any>;
  return (data.results ?? []).map(normalizeAcademicInstitution);
}

export async function getAcademicWork(id: string, signal?: AbortSignal): Promise<AcademicWork | null> {
  const url = openAlexEntityPath(id, 'W');
  if (!url) return null;
  return normalizeAcademicWork(await fetchJson(url, signal));
}

export async function getAcademicAuthor(id: string, signal?: AbortSignal): Promise<AcademicAuthorSummary | null> {
  const url = openAlexEntityPath(id, 'A');
  if (!url) return null;
  return normalizeAcademicAuthor(await fetchJson(url, signal));
}

export async function getAcademicJournal(id: string, signal?: AbortSignal): Promise<AcademicJournalSummary | null> {
  const url = openAlexEntityPath(id, 'S');
  if (!url) return null;
  return normalizeAcademicJournal(await fetchJson(url, signal));
}

export async function getAcademicInstitution(id: string, signal?: AbortSignal): Promise<AcademicInstitutionSummary | null> {
  const url = openAlexEntityPath(id, 'I');
  if (!url) return null;
  return normalizeAcademicInstitution(await fetchJson(url, signal));
}

export async function getAuthorWorks(authorId: string, limit = 30, signal?: AbortSignal): Promise<AcademicWork[]> {
  const id = cleanOpenAlexId(authorId, 'A');
  if (!id) return [];
  const url = `${OPENALEX_BASE}/works?filter=authorships.author.id:${encodeURIComponent(id)}&sort=publication_date:desc&per-page=${Math.min(50, Math.max(1, limit))}`;
  const data = (await fetchJson(url, signal)) as OpenAlexList<any>;
  return (data.results ?? []).map(normalizeAcademicWork);
}

export async function getJournalWorks(journalId: string, limit = 30, signal?: AbortSignal): Promise<AcademicWork[]> {
  const id = cleanOpenAlexId(journalId, 'S');
  if (!id) return [];
  const url = `${OPENALEX_BASE}/works?filter=primary_location.source.id:${encodeURIComponent(id)}&sort=publication_date:desc&per-page=${Math.min(50, Math.max(1, limit))}`;
  const data = (await fetchJson(url, signal)) as OpenAlexList<any>;
  return (data.results ?? []).map(normalizeAcademicWork);
}

export async function getInstitutionAuthors(institutionId: string, limit = 30, signal?: AbortSignal): Promise<AcademicAuthorSummary[]> {
  const id = cleanOpenAlexId(institutionId, 'I');
  if (!id) return [];
  const url = `${OPENALEX_BASE}/authors?filter=last_known_institutions.id:${encodeURIComponent(id)}&sort=cited_by_count:desc&per-page=${Math.min(50, Math.max(1, limit))}`;
  const data = (await fetchJson(url, signal)) as OpenAlexList<any>;
  return (data.results ?? []).map(normalizeAcademicAuthor);
}

export async function getRelatedAcademicWorks(workId: string, limit = 10, signal?: AbortSignal): Promise<AcademicWork[]> {
  const work = await getAcademicWork(workId, signal);
  if (!work?.primaryTopic) return [];
  return searchAcademicWorks(work.primaryTopic, limit + 1, signal)
    .then((items) => items.filter((item) => item.id !== work.id).slice(0, limit));
}

export async function getCrossrefWorkByDoi(doi: string | null, signal?: AbortSignal): Promise<CrossrefWork | null> {
  const clean = doi?.trim();
  if (!clean) return null;
  try {
    const data = await fetchJson(`${CROSSREF_BASE}/works/${encodeURIComponent(clean)}`, signal);
    const message = data?.message;
    if (!message) return null;
    return {
      publisher: typeof message.publisher === 'string' ? message.publisher : null,
      volume: typeof message.volume === 'string' ? message.volume : null,
      issue: typeof message.issue === 'string' ? message.issue : null,
      pages: typeof message.page === 'string' ? message.page : null,
      url: typeof message.URL === 'string' ? message.URL : null,
      subject: Array.isArray(message.subject) ? message.subject.filter((item: unknown): item is string => typeof item === 'string') : [],
    };
  } catch {
    return null;
  }
}

export function academicAuthorLine(work: AcademicWork) {
  return work.authors.map((author) => author.name).filter(Boolean).slice(0, 4).join(', ') || 'Bilinmeyen yazar';
}
