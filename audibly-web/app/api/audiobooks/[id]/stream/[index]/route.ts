import { NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { getCatalog, getStreamUrlForKey } from '@/lib/catalog';

const EXPIRES_IN = 3600;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const auth = await verifySupabaseToken(request.headers.get('authorization'));
  const devSkipAuth = process.env.NODE_ENV === 'development';
  if (!auth && !devSkipAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, index: indexStr } = await params;
  const index = parseInt(indexStr, 10);
  if (Number.isNaN(index) || index < 0) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const catalog = await getCatalog();
  const book = catalog.find((a) => a.id === id);
  if (!book || index >= book.sourceFileKeys.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = await getStreamUrlForKey(book.sourceFileKeys[index], EXPIRES_IN);
  if (!url) return NextResponse.json({ error: 'Failed to get stream URL' }, { status: 500 });

  const { createStreamToken } = await import('@/lib/streamToken');
  const streamToken = await createStreamToken(id, index);

  return NextResponse.json({
    url,
    contentUrl: `/api/audiobooks/${encodeURIComponent(id)}/stream/${index}/content?stream_token=${streamToken}`,
    expiresAtUtc: new Date(Date.now() + EXPIRES_IN * 1000).toISOString(),
    index,
  });
}
