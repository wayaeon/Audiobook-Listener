import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let r2EnvLoaded = false;
/** Manually load .env.local (same as test script) - Next.js env can differ and cause 401 */
function loadR2EnvFromFile() {
  if (typeof window !== 'undefined' || r2EnvLoaded) return;
  try {
    const envPath = join(process.cwd(), '.env.local');
    if (!existsSync(envPath)) {
      r2EnvLoaded = true;
      return;
    }
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, '');
        if (key.startsWith('R2_') || key === 'AWS_ACCESS_KEY_ID' || key === 'AWS_SECRET_ACCESS_KEY') {
          process.env[key] = val;
        }
      }
    }
  } catch {
    /* ignore */
  }
  r2EnvLoaded = true;
}

function getR2Config() {
  loadR2EnvFromFile();
  const accountId = (process.env.R2_ACCOUNT_ID ?? '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '').trim();
  const bucket = (process.env.R2_BUCKET_NAME ?? 'audibly').trim();
  const prefix = (process.env.R2_PREFIX ?? '').trim();
  const jurisdiction = (process.env.R2_JURISDICTION ?? '').trim().toLowerCase();
  const subdomain = jurisdiction === 'eu' ? 'eu.r2' : 'r2';
  const endpoint = `https://${accountId}.${subdomain}.cloudflarestorage.com`;
  return { accountId, accessKeyId, secretAccessKey, bucket, prefix, endpoint };
}

export function isR2Configured(): boolean {
  const { accountId, accessKeyId, secretAccessKey } = getR2Config();
  return !!(accountId && accessKeyId && secretAccessKey);
}

/** Dev-only: returns config status (no secrets) for debugging 401s */
export function getR2DebugInfo() {
  const { accountId, accessKeyId, secretAccessKey, bucket, endpoint } = getR2Config();
  return {
    accountIdSet: accountId.length > 0,
    accessKeySet: accessKeyId.length > 0,
    secretKeySet: secretAccessKey.length > 0,
    bucket,
    endpoint,
    forcePathStyle: true,
  };
}

function getClient(): S3Client | null {
  const { accountId, accessKeyId, secretAccessKey, endpoint } = getR2Config();
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

export type R2Object = { key: string; size: number; lastModified?: Date };

export async function listAudiobookKeys(): Promise<R2Object[]> {
  const all = await listAllKeys();
  return all.filter((o) => o.key.endsWith('.m4b') || o.key.endsWith('.mp3'));
}

/** List all keys under prefix in one pass – use for catalog (metadata, covers, audio). */
export async function listAllKeys(): Promise<R2Object[]> {
  const client = getClient();
  if (!client) return [];
  const { bucket, prefix } = getR2Config();
  const keys: R2Object[] = [];
  let continuationToken: string | undefined;
  do {
    const cmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });
    const result = await client.send(cmd);
    for (const obj of result.Contents ?? []) {
      if (obj.Key) keys.push({
        key: obj.Key,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ? new Date(obj.LastModified) : undefined,
      });
    }
    continuationToken = result.NextContinuationToken;
  } while (continuationToken);
  return keys;
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const { bucket } = getR2Config();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, cmd, { expiresIn });
}

/** Get R2 object body for streaming. Pass request.signal so stream aborts when client disconnects. */
export async function getObjectBody(
  key: string,
  signal?: AbortSignal
): Promise<{ body: unknown; contentType?: string } | null> {
  const client = getClient();
  if (!client) return null;
  const { bucket } = getR2Config();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const result = await client.send(cmd, { abortSignal: signal });
  const body = result.Body;
  if (!body) return null;
  return { body, contentType: result.ContentType ?? undefined };
}

const METADATA_READ_MAX_BYTES = 512 * 1024; // 512KB default
const M4B_MOOV_READ_BYTES = 4 * 1024 * 1024; // 4MB – m4b embeds cover + chapters in moov atom, which can be large or at end

/** Read first N bytes from R2 for metadata parsing (cover, chapters, tags). */
export async function getObjectFirstBytes(
  key: string,
  maxBytes = METADATA_READ_MAX_BYTES,
  signal?: AbortSignal
): Promise<Buffer | null> {
  const client = getClient();
  if (!client) return null;
  const { bucket } = getR2Config();
  const range = `bytes=0-${maxBytes - 1}`;
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key, Range: range });
  const result = await client.send(cmd, { abortSignal: signal });
  const body = result.Body;
  if (!body) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  const stream = body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    const buf = chunk instanceof Buffer ? chunk : new Uint8Array(chunk);
    chunks.push(buf);
    total += buf.length;
    if (total >= maxBytes) break;
  }
  return Buffer.concat(chunks);
}

/** Read last N bytes from R2 (for m4b where moov atom is at end of file). */
export async function getObjectLastBytes(
  key: string,
  tailBytes: number,
  signal?: AbortSignal
): Promise<Buffer | null> {
  const client = getClient();
  if (!client) return null;
  const { bucket } = getR2Config();
  const range = `bytes=-${tailBytes}`;
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key, Range: range });
  const result = await client.send(cmd, { abortSignal: signal });
  const body = result.Body;
  if (!body) return null;
  const chunks: Uint8Array[] = [];
  const stream = body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    const buf = chunk instanceof Buffer ? chunk : new Uint8Array(chunk);
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export { M4B_MOOV_READ_BYTES };

/** Read full object into buffer (for small files e.g. cover images). Max 5MB. */
export async function getObjectAsBuffer(
  key: string,
  maxBytes = 5 * 1024 * 1024,
  signal?: AbortSignal
): Promise<Buffer | null> {
  const client = getClient();
  if (!client) return null;
  const { bucket } = getR2Config();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const result = await client.send(cmd, { abortSignal: signal });
  const body = result.Body;
  if (!body) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  const stream = body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    const buf = chunk instanceof Buffer ? chunk : new Uint8Array(chunk);
    chunks.push(buf);
    total += buf.length;
    if (total > maxBytes) return null;
  }
  return Buffer.concat(chunks);
}

/** Get object at key as UTF-8 text (e.g. metadata.json). */
export async function getObjectAsText(key: string, signal?: AbortSignal): Promise<string | null> {
  const buf = await getObjectAsBuffer(key, 10 * 1024 * 1024, signal);
  return buf ? buf.toString('utf-8') : null;
}

/** List keys with a given prefix (e.g. folder/ or audiobooks/Author - Book/). */
export async function listKeysWithPrefix(keyPrefix: string): Promise<string[]> {
  const client = getClient();
  if (!client) return [];
  const { bucket } = getR2Config();
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const cmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: keyPrefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });
    const result = await client.send(cmd);
    for (const obj of result.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = result.NextContinuationToken;
  } while (continuationToken);
  return keys;
}
