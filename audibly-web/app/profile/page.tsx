'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useCatalog } from '@/lib/catalogCache';
import { useRouter } from 'next/navigation';

type AccessRequest = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  created_at: string;
};

export default function ProfilePage() {
  const { catalog: audiobooks, loading } = useCatalog();
  const [user, setUser] = useState<{ email?: string; id?: string; token?: string } | null>(null);
  const [profile, setProfile] = useState<{ first_name?: string | null; last_name?: string | null; role?: string } | null>(null);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const router = useRouter();

  const pendingCount = accessRequests.filter((r) => r.status === 'pending').length;

  const fetchAccessRequests = useCallback(async (token: string) => {
    const res = await fetch('/api/admin/access-requests', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setAccessRequests(data);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser({
          email: session.user.email,
          id: session.user.id,
          token: session.access_token ?? undefined,
        });
        const { data: prof } = await supabase
          .from('profiles')
          .select('first_name, last_name, role')
          .eq('id', session.user.id)
          .single();
        setProfile(prof ?? null);
        if (prof?.role === 'admin' && session.access_token) {
          fetchAccessRequests(session.access_token);
        }
      }
    });
  }, [fetchAccessRequests]);

  const handleSignOut = async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
      router.push('/login');
    }
  };

  // Calculate total duration in hours
  const totalHours = Math.floor(
    audiobooks.reduce((sum, book) => sum + (book.duration || 0), 0) / 3600
  );

  return (
    <main
      className="page-with-nav profile-page"
      style={{
        padding: 'var(--page-padding)',
        paddingBottom: 'var(--profile-content-bottom)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        overflowY: 'auto',
      }}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading profile…
        </div>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)', flex: 1 }}>
          {/* User row – tappable */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
          <button
            type="button"
            onClick={() => alert('Edit profile coming soon!')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flex: 1,
              minWidth: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'white',
              flexShrink: 0,
            }}>
              {(profile?.first_name?.[0] ?? profile?.last_name?.[0] ?? user?.email?.[0])?.toUpperCase() || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user?.email?.split('@')[0] || 'User'}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email || ''}
              </div>
            </div>
          </button>
          {profile?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setRequestsModalOpen(true)}
                style={{
                  position: 'relative',
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'var(--surface-glass)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                aria-label={pendingCount > 0 ? `${pendingCount} pending access requests` : 'Access requests'}
              >
                <BellIcon />
                {pendingCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      minWidth: 18,
                      height: 18,
                      padding: '0 4px',
                      borderRadius: 9,
                      background: 'var(--accent)',
                      color: 'white',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Admin: Requests Modal */}
          {profile?.role === 'admin' && requestsModalOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Access requests"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--page-padding)',
                paddingBottom: 'calc(var(--bottom-nav-height) + var(--page-padding))',
              }}
              onClick={() => setRequestsModalOpen(false)}
            >
              <div
                className="book-card"
                style={{
                  maxWidth: 400,
                  width: '100%',
                  maxHeight: '75vh',
                  overflow: 'auto',
                  padding: '1rem',
                  cursor: 'default',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Access requests</h3>
                  <button
                    type="button"
                    onClick={() => setRequestsModalOpen(false)}
                    style={{
                      padding: 4,
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      borderRadius: 6,
                    }}
                    aria-label="Close"
                  >
                    <CloseIcon />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {accessRequests.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>No requests</p>
                  ) : (
                    accessRequests.map((req) => (
                      <div
                        key={req.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          padding: '10px 12px',
                          background: 'var(--surface-elevated)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {req.email}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {[req.first_name, req.last_name].filter(Boolean).join(' ') || '—'}
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--muted)', marginTop: 2 }}>
                            {req.status} · {new Date(req.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        {req.status === 'pending' && (
                          <button
                            type="button"
                            disabled={!!invitingId}
                            onClick={async () => {
                              if (!user?.token) return;
                              setInvitingId(req.id);
                              try {
                                const res = await fetch('/api/admin/invite', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${user.token}`,
                                  },
                                  body: JSON.stringify({ requestId: req.id }),
                                });
                                const data = await res.json().catch(() => ({}));
                                if (res.ok) {
                                  setAccessRequests((prev) =>
                                    prev.map((r) => (r.id === req.id ? { ...r, status: 'invited' } : r))
                                  );
                                } else {
                                  alert(data.error || 'Failed to send invite');
                                }
                              } finally {
                                setInvitingId(null);
                              }
                            }}
                            style={{
                              padding: '5px 10px',
                              background: 'var(--accent)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 500,
                              cursor: invitingId ? 'not-allowed' : 'pointer',
                              fontSize: '0.8125rem',
                            }}
                          >
                            {invitingId === req.id ? 'Sending…' : 'Invite'}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Listening Statistics */}
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px' }}>
              Listening Statistics
            </h2>
            {audiobooks.length === 0 && totalHours === 0 ? (
              <div
                className="book-card"
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  cursor: 'default',
                  opacity: 0.85,
                }}
              >
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                  Your listening stats will appear here
                </p>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.8125rem' }}>
                  Start listening to see hours, books completed, and more
                </p>
              </div>
            ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {[
                { value: audiobooks.length, label: 'Total Books', sub: null },
                { value: totalHours, label: 'Total Hours', sub: null },
                { value: 0, label: 'Books completed', sub: 'This year' },
                { value: 0, label: 'Day streak', sub: null },
              ].map((stat) => {
                const isEmpty = stat.value === 0;
                return (
                  <div
                    key={stat.label}
                    className="book-card"
                    style={{
                      padding: '20px',
                      textAlign: 'center',
                      cursor: 'default',
                      opacity: isEmpty ? 0.75 : 1,
                    }}
                  >
                    <div
                      className={isEmpty ? '' : 'profile-stat-value'}
                      style={{
                        fontSize: '2.25rem',
                        fontWeight: 700,
                        marginBottom: '4px',
                        background: isEmpty ? 'none' : undefined,
                        color: isEmpty ? 'var(--text-secondary)' : undefined,
                      }}
                    >
                      {isEmpty ? '—' : stat.value}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {stat.label}
                    </div>
                    {stat.sub && (
                      <div style={{ fontSize: '0.6875rem', color: 'var(--muted)', marginTop: 2 }}>
                        {stat.sub}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* Settings */}
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px' }}>
              Settings
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { icon: '⚙️', title: 'Playback Settings', sub: 'Speed, skip intervals, sleep timer' },
                { icon: '💾', title: 'Downloads', sub: 'Manage offline audiobooks' },
                { icon: '❓', title: 'Help & Support', sub: 'FAQ, tutorials, contact' },
              ].map((item) => (
                <button
                  key={item.title}
                  onClick={() => alert(`${item.title} coming soon!`)}
                  className="profile-settings-btn"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--surface-glass)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--overlay-radius)',
                    color: 'var(--text)',
                    fontSize: '0.9375rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{item.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'transparent',
              border: '1px solid #ef4444',
              borderRadius: 'var(--overlay-radius)',
              color: '#ef4444',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ef4444';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#ef4444';
            }}
          >
            Sign Out
          </button>

          {/* App Version – bottom of screen */}
          <div
            style={{
              textAlign: 'center',
              padding: '16px',
              paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
              marginTop: 'auto',
              color: 'var(--muted)',
              fontSize: '0.8125rem',
            }}
          >
            Libera v1.0.0
          </div>
        </div>
      )}
    </main>
  );
}

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="20" height="20">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="20" height="20">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

