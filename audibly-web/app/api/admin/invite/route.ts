import { NextResponse } from 'next/server';
import { getProfileFromToken } from '@/lib/profiles';
import { createAdminClient } from '@/lib/supabase-admin';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const { isAdmin } = await getProfileFromToken(request.headers.get('authorization'));
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  let body: { email?: string; requestId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let email: string;

  if (body.requestId) {
    const { data: req, error: fetchError } = await admin
      .from('access_requests')
      .select('email')
      .eq('id', body.requestId)
      .single();

    if (fetchError || !req?.email) {
      return NextResponse.json({ error: 'Access request not found' }, { status: 404 });
    }
    email = req.email.trim().toLowerCase();
  } else {
    email = (body.email ?? '').trim().toLowerCase();
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const redirectTo = `${siteUrl}/login`;

  const { data: user, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { redirectTo },
    redirectTo,
  });

  if (error) {
    if (error.message?.toLowerCase().includes('already') || error.message?.toLowerCase().includes('exists')) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }
    console.error('[admin/invite]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send invitation' },
      { status: 500 }
    );
  }

  await admin
    .from('access_requests')
    .update({ status: 'invited' })
    .eq('email', email);

  return NextResponse.json({ success: true, invited: user?.user?.email ?? email });
}
