import { NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { getCatalog } from '@/lib/catalog';
import { getEnrichedMetadata } from '@/lib/metadata';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySupabaseToken(request.headers.get('authorization'));
  const devSkipAuth = process.env.NODE_ENV === 'development';
  if (!auth && !devSkipAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const catalog = await getCatalog();
  const book = catalog.find((a) => a.id === id);
  if (!book || book.sourceFileKeys.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const firstKey = book.sourceFileKeys[0];
  let enriched;
  try {
    enriched = await getEnrichedMetadata(firstKey, book.title, request.signal);
  } catch (err) {
    console.error('[metadata] getEnrichedMetadata failed for', id, firstKey, err);
    enriched = {
      title: book.title,
      author: book.author,
      description: book.description ?? null,
      duration: book.duration ?? 0,
      series: book.series,
      genre: book.genre,
      coverDataUrl: null,
      coverKey: book.coverKey ?? null,
      chapters: book.chapters ?? [],
      curatorNote: book.curatorNote,
      sections: book.sections,
      tags: book.tags,
      seriesNote: book.seriesNote,
      narrator: book.narrator,
      authorBio: book.authorBio,
      narratorBio: book.narratorBio,
      whyListen: book.whyListen,
      atGlance: book.atGlance,
      publisher: book.publisher,
      releaseYear: book.releaseYear,
      language: book.language,
      fileSizeBytes: book.fileSizeBytes,
      isbn: book.isbn,
    };
  }

  return NextResponse.json(
    {
      title: enriched.title,
      author: enriched.author,
      description: enriched.description ?? null,
      duration: enriched.duration,
      series: enriched.series ?? null,
      genre: enriched.genre ?? null,
      curatorNote: enriched.curatorNote ?? null,
      sections: enriched.sections ?? null,
      tags: enriched.tags ?? null,
      seriesNote: enriched.seriesNote ?? null,
      coverDataUrl: enriched.coverDataUrl,
      coverKey: enriched.coverKey,
      chapters: enriched.chapters,
      narrator: enriched.narrator ?? null,
      authorBio: enriched.authorBio ?? null,
      narratorBio: enriched.narratorBio ?? null,
      whyListen: enriched.whyListen ?? null,
      atGlance: enriched.atGlance ?? null,
      publisher: enriched.publisher ?? null,
      releaseYear: enriched.releaseYear ?? null,
      language: enriched.language ?? null,
      fileSizeBytes: enriched.fileSizeBytes ?? null,
      isbn: enriched.isbn ?? null,
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
      },
    }
  );
}
