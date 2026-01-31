import { NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { getCatalog } from '@/lib/catalog';
import { getPresignedUrl } from '@/lib/r2';

export async function GET(request: Request) {
  const auth = await verifySupabaseToken(request.headers.get('authorization'));
  const devSkipAuth = process.env.NODE_ENV === 'development';
  if (!auth && !devSkipAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const catalog = await getCatalog();
    const coverUrls = await Promise.all(
      catalog.map((a) => (a.coverKey ? getPresignedUrl(a.coverKey, 3600) : Promise.resolve(null)))
    );
    const dtos = catalog.map((a, i) => ({
      id: a.id,
      title: a.title,
      author: a.author,
      duration: 0,
      coverUrl: coverUrls[i] ?? undefined,
      sourceFileCount: a.sourceFileCount,
      sourceFileIds: a.sourceFileKeys,
      chapters: a.chapters,
    }));
    return NextResponse.json(dtos, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=900',
      },
    });
  } catch (err) {
    console.error('[api/audiobooks]', err);
    const msg = err instanceof Error ? err.message : String(err);
    const isR2Unauth = msg.includes('Unauthorized') || (err && typeof err === 'object' && 'Code' in err && (err as { Code?: string }).Code === 'Unauthorized');
    const hint = isR2Unauth
      ? `${msg}. R2 credentials rejected. Try: 1) Create a NEW API token (R2 → Manage R2 API Tokens, Object Read). 2) If bucket is EU jurisdiction, add R2_JURISDICTION=eu to .env.local. 3) Restart dev server.`
      : msg;
    return NextResponse.json(
      { error: 'Failed to load catalog', hint },
      { status: 500 }
    );
  }
}
