export type Work = { id: string; author_id: string; title: string; description: string; cover_url: string | null; genre: string; tags: string[]; status: 'draft' | 'published'; updated_at: string };
export type Chapter = { id: string; work_id: string; title: string; content: string; position: number; status: 'draft' | 'published' };
