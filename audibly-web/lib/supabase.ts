import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) return null;
  if (clientInstance) return clientInstance;
  clientInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  return clientInstance;
}
