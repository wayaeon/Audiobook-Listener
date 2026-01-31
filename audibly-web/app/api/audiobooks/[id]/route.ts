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
    duration: 0,
    sourceFileCount: book.sourceFileCount,
    sourceFileIds: book.sourceFileKeys,
    chapters: book.chapters,
  });
}
