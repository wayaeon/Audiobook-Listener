import { NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { getCatalog } from '@/lib/catalog';
import { listKeysWithPrefix, getPresignedUrl } from '@/lib/r2';

const COVER_NAMES = ['cover.jpg', 'cover.png', 'cover.jpeg', 'cover.webp'];

export async function GET(request: Request) {
  const auth = await verifySupabaseToken(request.headers.get('authorization'));
  const devSkipAuth = process.env.NODE_ENV === 'development';
  if (!auth && !devSkipAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids');
  if (!idsParam) return NextResponse.json({ error: 'Missing ids' }, { status: 400 });
  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length > 50) return NextResponse.json({ error: 'Max 50 ids' }, { status: 400 });

  const catalog = await getCatalog();
  const result: Record<string, string> = {};

  const toResolve: { id: string; book: (typeof catalog)[0] }[] = [];
  for (const id of ids) {
    const book = catalog.find((a) => a.id === id);
    if (!book || book.sourceFileKeys.length === 0) continue;
    if (book.coverKey) {
      const url = await getPresignedUrl(book.coverKey, 3600);
      if (url) result[id] = url;
    } else {
      toResolve.push({ id, book });
    }
  }

  await Promise.all(
    toResolve.map(async ({ id, book }) => {
      const firstKey = book.sourceFileKeys[0];
      const folderPrefix = firstKey.includes('/') ? firstKey.slice(0, firstKey.lastIndexOf('/') + 1) : '';
      if (!folderPrefix) return;
      const keys = await listKeysWithPrefix(folderPrefix);
      const coverKey = keys.find((k) => COVER_NAMES.some((n) => k.toLowerCase().endsWith(n.toLowerCase())));
      if (!coverKey) return;
      const url = await getPresignedUrl(coverKey, 3600);
      if (url) result[id] = url;
    })
  );

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, max-age=3500, stale-while-revalidate=300' },
  });
}
