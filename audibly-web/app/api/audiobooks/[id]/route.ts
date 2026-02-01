import { NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { getCatalog } from '@/lib/catalog';

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
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: book.id,
    title: book.title,
    author: book.author,
    description: book.description ?? undefined,
    duration: book.duration ?? 0,
    series: book.series ?? undefined,
    genre: book.genre ?? undefined,
    curatorNote: book.curatorNote ?? undefined,
    sections: book.sections ?? undefined,
    tags: book.tags ?? undefined,
    seriesNote: book.seriesNote ?? undefined,
    sourceFileCount: book.sourceFileCount,
    sourceFileIds: book.sourceFileKeys,
    chapters: book.chapters,
    narrator: book.narrator ?? undefined,
    authorBio: book.authorBio ?? undefined,
    narratorBio: book.narratorBio ?? undefined,
    whyListen: book.whyListen ?? undefined,
    atGlance: book.atGlance ?? undefined,
    publisher: book.publisher ?? undefined,
    releaseYear: book.releaseYear ?? undefined,
    language: book.language ?? undefined,
    fileSizeBytes: book.fileSizeBytes ?? undefined,
    isbn: book.isbn ?? undefined,
  });
}
