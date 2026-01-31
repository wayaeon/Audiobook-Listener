import { SignJWT, jwtVerify } from 'jose';

const SECRET = process.env.SUPABASE_JWT_SECRET ?? process.env.STREAM_TOKEN_SECRET ?? 'dev-stream-secret';
const EXPIRES_IN = 3600; // 1 hour

export async function createStreamToken(audiobookId: string, index: number): Promise<string> {
  const key = new TextEncoder().encode(SECRET);
  return new SignJWT({ id: audiobookId, index })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + EXPIRES_IN)
    .sign(key);
}

export async function verifyStreamToken(token: string): Promise<{ id: string; index: number } | null> {
  try {
    const key = new TextEncoder().encode(SECRET);
    const { payload } = await jwtVerify(token, key);
    const id = payload.id as string;
    const index = typeof payload.index === 'number' ? payload.index : parseInt(String(payload.index), 10);
    if (!id || Number.isNaN(index) || index < 0) return null;
    return { id, index };
  } catch {
    return null;
  }
}
