'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase';

type AuthState = {
  accessToken: string | null;
  userId: string | null;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ accessToken: null, userId: null });

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    const apply = (token: string | null, uid: string | null) =>
      setState((prev) => {
        if (prev.accessToken === token && prev.userId === uid) return prev;
        return { accessToken: token, userId: uid };
      });

    supabase.auth.getSession().then(({ data: { session } }) => {
      apply(session?.access_token ?? null, session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      apply(session?.access_token ?? null, session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = state;
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) return { accessToken: null, userId: null };
  return ctx;
}
