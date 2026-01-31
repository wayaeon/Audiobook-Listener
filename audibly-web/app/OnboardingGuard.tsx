'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const ONBOARDING_CACHE_KEY = 'audibly_onboarded';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

/** Redirects authenticated users without complete profile to /onboarding */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const lastCheckRef = useRef<{ userId: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (pathname === '/login' || pathname === '/onboarding') return;

    const supabase = createClient();
    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const userId = session.user.id;
      const cached = lastCheckRef.current;
      if (cached?.userId === userId && cached.ok) return;

      try {
        const storageKey = `${ONBOARDING_CACHE_KEY}_${userId}`;
        const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
        if (raw) {
          const { ok, ts } = JSON.parse(raw) as { ok: boolean; ts: number };
          if (Date.now() - ts < CACHE_TTL_MS) {
            lastCheckRef.current = { userId, ok };
            if (!ok) router.replace('/onboarding');
            return;
          }
        }
      } catch {}

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .single();
      const hasName = !!(profile?.first_name && profile?.last_name);
      lastCheckRef.current = { userId, ok: hasName };
      if (!hasName) {
        router.replace('/onboarding');
      } else if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            `${ONBOARDING_CACHE_KEY}_${userId}`,
            JSON.stringify({ ok: true, ts: Date.now() })
          );
        } catch {}
      }
    });
  }, [pathname, router]);

  return <>{children}</>;
}
