import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let adminInstance: SupabaseClient | null = null;

/** Server-only: creates Supabase client with service_role key. Never expose to client. */
export function createAdminClient(): SupabaseClient | null {
  if (adminInstance) return adminInstance;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url?.trim() || !serviceRoleKey?.trim()) return null;
  adminInstance = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return adminInstance;
}
