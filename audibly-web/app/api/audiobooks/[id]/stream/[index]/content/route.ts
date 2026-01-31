import { Readable } from 'stream';
import { NextResponse } from 'next/server';
import { verifyStreamToken } from '@/lib/streamToken';
import { getCatalog } from '@/lib/catalog';
import { getObjectBody } from '@/lib/r2';

function contentTypeForKey(key: string): string {
  if (key.endsWith('.m4b')) return 'audio/mp4';
  if (key.endsWith('.mp3')) return 'audio/mpeg';
  return 'application/octet-stream';
}

/** AWS SDK may return Node Readable or Web ReadableStream. Normalize to Web for Response. */
function toWebReadableStream(body: unknown): ReadableStream<Uint8Array> {
  const b = body as { pipe?: unknown } | ReadableStream<Uint8Array>;
  if (b && typeof b.pipe === 'function') {
    return Readable.toWeb(b as NodeJS.ReadableStream) as ReadableStream<Uint8Array>;
  }
  return b as ReadableStream<Uint8Array>;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const devSkipAuth = process.env.NODE_ENV === 'development';
  const url = new URL(request.url);
  const streamToken = url.searchParams.get('stream_token');

  let id: string;
  let index: number;

  if (streamToken) {
    const payload = await verifyStreamToken(streamToken);
    if (!payload) return NextResponse.json({ error: 'Invalid or expired stream token' }, { status: 401 });
    ({ id, index } = payload);
  } else if (devSkipAuth) {
    const { id: paramId, index: indexStr } = await params;
    id = paramId;
    index = parseInt(indexStr, 10);
    if (Number.isNaN(index) || index < 0) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  } else {
    return NextResponse.json({ error: 'Missing stream_token' }, { status: 401 });
  }

  const catalog = await getCatalog();
  const book = catalog.find((a) => a.id === id);
  if (!book || index >= book.sourceFileKeys.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const key = book.sourceFileKeys[index];
  const result = await getObjectBody(key, request.signal);
  if (!result) return NextResponse.json({ error: 'Failed to stream' }, { status: 500 });

  const { body } = result;
  const contentType = result.contentType ?? contentTypeForKey(key);
  const webStream = toWebReadableStream(body);

  return new Response(webStream, {
    headers: {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
