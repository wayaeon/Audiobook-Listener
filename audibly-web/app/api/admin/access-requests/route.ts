import { NextResponse } from 'next/server';
import { getProfileFromToken } from '@/lib/profiles';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  const { isAdmin } = await getProfileFromToken(request.headers.get('authorization'));
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('access_requests')
    .select('id, email, first_name, last_name, status, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/access-requests]', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
