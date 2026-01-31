import { NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-admin';

/** Update the current user's profile. Auth required. */
export async function POST(request: Request) {
  const auth = await verifySupabaseToken(request.headers.get('authorization'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  let body: { first_name?: string; last_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const first_name = typeof body.first_name === 'string' ? body.first_name.trim().slice(0, 100) || null : null;
  const last_name = typeof body.last_name === 'string' ? body.last_name.trim().slice(0, 100) || null : null;

  const { error } = await admin
    .from('profiles')
    .update({
      first_name,
      last_name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', auth.sub);

  if (error) {
    console.error('[api/profile]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
