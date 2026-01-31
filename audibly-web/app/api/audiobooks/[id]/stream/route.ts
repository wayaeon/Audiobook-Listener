import { NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { getCatalog, getStreamUrlForKey } from '@/lib/catalog';
import { createStreamToken } from '@/lib/streamToken';

const EXPIRES_IN = 3600;

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

  const urls: { url: string; contentUrl?: string; expiresAtUtc: string; index: number }[] = [];
  for (let i = 0; i < book.sourceFileKeys.length; i++) {
    const url = await getStreamUrlForKey(book.sourceFileKeys[i], EXPIRES_IN);
    if (url) {
      const streamToken = await createStreamToken(id, i);
      urls.push({
        url,
        contentUrl: `/api/audiobooks/${encodeURIComponent(id)}/stream/${i}/content?stream_token=${streamToken}`,
        expiresAtUtc: new Date(Date.now() + EXPIRES_IN * 1000).toISOString(),
        index: i,
      });
    }
  }
  return NextResponse.json(urls);
}
