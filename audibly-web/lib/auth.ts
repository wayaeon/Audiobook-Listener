import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const JWT_ISSUER = (process.env.SUPABASE_JWT_ISSUER ?? '').replace(/\/$/, '');

export async function verifySupabaseToken(authHeader: string | null): Promise<{ sub: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!JWT_SECRET || !JWT_ISSUER) return null;
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: 'authenticated',
    });
    const sub = payload.sub as string;
    return sub ? { sub } : null;
  } catch {
    return null;
  }
}
