import type { SupabaseClient } from '@supabase/supabase-js';
import { verifySupabaseToken } from './auth';
import { createAdminClient } from './supabase-admin';

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
};

export async function getProfileFromToken(
  authHeader: string | null
): Promise<{ profile: Profile | null; isAdmin: boolean }> {
  const auth = await verifySupabaseToken(authHeader);
  if (!auth) return { profile: null, isAdmin: false };

  const admin = createAdminClient();
  if (!admin) return { profile: null, isAdmin: false };

  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, first_name, last_name, role, created_at, updated_at')
    .eq('id', auth.sub)
    .single();

  if (error || !profile) {
    return { profile: null, isAdmin: false };
  }

  return {
    profile: profile as Profile,
    isAdmin: profile.role === 'admin',
  };
}

export async function getProfile(client: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('id, first_name, last_name, role, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function updateProfile(
  client: SupabaseClient,
  userId: string,
  data: { first_name?: string; last_name?: string }
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from('profiles')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  return { error: error ? new Error(error.message) : null };
}
