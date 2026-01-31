import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  let body: { email?: string; firstName?: string; lastName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const firstName = (body.firstName ?? '').trim().slice(0, 100);
  const lastName = (body.lastName ?? '').trim().slice(0, 100);

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  const { error } = await supabase.from('access_requests').insert({
    email,
    first_name: firstName || null,
    last_name: lastName || null,
    status: 'pending',
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'This email has already requested access' },
        { status: 409 }
      );
    }
    console.error('[access-requests]', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
