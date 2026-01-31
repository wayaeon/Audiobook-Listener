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
      description: null,
      duration: 0,
      coverDataUrl: null,
      coverKey: null,
      chapters: book.chapters ?? [],
    };
  }

  return NextResponse.json(
    {
      title: enriched.title,
      author: enriched.author,
      description: enriched.description ?? null,
      duration: enriched.duration,
      coverDataUrl: enriched.coverDataUrl,
      coverKey: enriched.coverKey,
      chapters: enriched.chapters,
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
      },
    }
  );
}
