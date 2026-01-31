const CLIENT_ID = process.env.ONEDRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.ONEDRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.ONEDRIVE_REFRESH_TOKEN;
const TENANT = process.env.ONEDRIVE_TENANT_ID ?? 'common';
const FOLDER_PATH = process.env.ONEDRIVE_FOLDER_PATH ?? '/Audiobooks';

let cachedAccessToken: string | null = null;
let cachedExpiry = 0;

export function isOneDriveConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

export async function getAccessToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) return null;
  if (cachedAccessToken && Date.now() < cachedExpiry) return cachedAccessToken;

  const url = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; expires_in?: number; refresh_token?: string };
  cachedAccessToken = data.access_token ?? null;
  cachedExpiry = Date.now() + ((data.expires_in ?? 3600) - 300) * 1000;
  return cachedAccessToken;
}

export type DriveItem = { id: string; name: string; isFolder: boolean; size: number };

export async function listFolderChildren(pathOrItemId: string, token: string): Promise<DriveItem[]> {
  const isPath = pathOrItemId.startsWith('/') || !pathOrItemId.includes('-');
  const resource = isPath
    ? `https://graph.microsoft.com/v1.0/me/drive/root:${pathOrItemId.startsWith('/') ? pathOrItemId : '/' + pathOrItemId}:/children`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${pathOrItemId}/children`;
  const res = await fetch(resource, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { value?: { id: string; name: string; folder?: unknown; size?: number }[] };
  return (data.value ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    isFolder: 'folder' in item && item.folder != null,
    size: item.size ?? 0,
  }));
}

export async function getDownloadUrl(itemId: string, token: string): Promise<string | null> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/content`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'manual',
  });
  if (res.status !== 302 && res.status !== 307) return null;
  const location = res.headers.get('location');
  return location;
}

export async function buildOneDriveCatalog(): Promise<
  { id: string; title: string; author: string; sourceFileCount: number; sourceFileIds: string[]; chapters: never[] }[]
> {
  const token = await getAccessToken();
  if (!token) return [];

  const rootPath = FOLDER_PATH.trim() || '/';
  const children = await listFolderChildren(rootPath, token);
  const catalog: { id: string; title: string; author: string; sourceFileCount: number; sourceFileIds: string[]; chapters: never[] }[] = [];

  for (const child of children) {
    if (child.isFolder) {
      const sub = await listFolderChildren(child.id, token);
      const audio = sub.filter((s) => !s.isFolder && (s.name.endsWith('.m4b') || s.name.endsWith('.mp3')));
      if (audio.length === 0) continue;
      audio.sort((a, b) => a.name.localeCompare(b.name));
      catalog.push({
        id: child.id,
        title: child.name,
        author: '',
        sourceFileCount: audio.length,
        sourceFileIds: audio.map((a) => a.id),
        chapters: [],
      });
    } else if (child.name.endsWith('.m4b') || child.name.endsWith('.mp3')) {
      const base = child.name.replace(/\.(m4b|mp3)$/i, '');
      catalog.push({
        id: child.id,
        title: base,
        author: '',
        sourceFileCount: 1,
        sourceFileIds: [child.id],
        chapters: [],
      });
    }
  }

  return catalog;
}

export async function getOneDriveStreamUrl(itemId: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return getDownloadUrl(itemId, token);
}
