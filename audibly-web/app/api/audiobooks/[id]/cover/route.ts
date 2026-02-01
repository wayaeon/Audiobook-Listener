import { Readable } from 'stream';
import { NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { getCatalog } from '@/lib/catalog';
import { getObjectBody, listKeysWithPrefix } from '@/lib/r2';

const COVER_NAMES = ['cover.jpg', 'cover.png', 'cover.jpeg', 'cover.webp'];

function contentTypeForKey(key: string): string {
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.webp')) return 'image/webp';
  if (key.endsWith('.jpeg') || key.endsWith('.jpg')) return 'image/jpeg';
  return 'application/octet-stream';
}

/** AWS SDK body to Web ReadableStream for Response. */
function toWebStream(body: unknown): ReadableStream<Uint8Array> {
  const b = body as { pipe?: unknown } | ReadableStream<Uint8Array>;
  if (b && typeof b.pipe === 'function') {
    return Readable.toWeb(b as NodeJS.ReadableStream) as ReadableStream<Uint8Array>;
  }
  return b as ReadableStream<Uint8Array>;
}

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
  const folderPrefix = firstKey.includes('/') ? firstKey.slice(0, firstKey.lastIndexOf('/') + 1) : '';
  if (!folderPrefix) return NextResponse.json({ error: 'No cover' }, { status: 404 });
  const keys = await listKeysWithPrefix(folderPrefix);
  const coverKey = keys.find((k) => COVER_NAMES.some((n) => k.toLowerCase().endsWith(n.toLowerCase())));

  if (!coverKey) return NextResponse.json({ error: 'No cover' }, { status: 404 });

  const result = await getObjectBody(coverKey, request.signal);
  if (!result) return NextResponse.json({ error: 'Failed to load cover' }, { status: 500 });

  const webStream = toWebStream(result.body);
  const contentType = result.contentType ?? contentTypeForKey(coverKey);
  return new Response(webStream, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
