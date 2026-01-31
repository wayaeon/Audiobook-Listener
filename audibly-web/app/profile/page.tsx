'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useCatalog } from '@/lib/catalogCache';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { catalog: audiobooks, loading } = useCatalog();
  const [user, setUser] = useState<{ email?: string; id?: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          email: session.user.email,
          id: session.user.id,
        });
      }
    });
  }, []);

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
    <main className="page-with-nav" style={{ padding: 'var(--page-padding)' }}>
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading profile…
        </div>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>
          {/* User Info Card */}
          <div className="book-card" style={{ 
            padding: '24px',
            cursor: 'default'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px',
              marginBottom: '16px'
            }}>
              {/* Avatar */}
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'white',
                flexShrink: 0,
              }}>
                {user?.email?.[0].toUpperCase() || 'U'}
              </div>
              
              {/* User Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 600,
                  marginBottom: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {user?.email?.split('@')[0] || 'User'}
                </div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {user?.email || 'No email'}
                </div>
              </div>
            </div>
          </div>

          {/* Listening Statistics */}
          <div>
            <h2 style={{ 
              fontSize: '1.25rem', 
              fontWeight: 600,
              marginBottom: '16px'
            }}>
              Listening Statistics
            </h2>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px'
            }}>
              {/* Total Books */}
              <div className="book-card" style={{ 
                padding: '20px',
                textAlign: 'center',
                cursor: 'default'
              }}>
                <div style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: 700,
                  marginBottom: '8px',
                  background: 'var(--accent-gradient)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  {audiobooks.length}
                </div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--text-secondary)' 
                }}>
                  Total Books
                </div>
              </div>

              {/* Total Hours */}
              <div className="book-card" style={{ 
                padding: '20px',
                textAlign: 'center',
                cursor: 'default'
              }}>
                <div style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: 700,
                  marginBottom: '8px',
                  background: 'var(--accent-gradient)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  {totalHours}
                </div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--text-secondary)' 
                }}>
                  Total Hours
                </div>
              </div>

              {/* Completed This Year */}
              <div className="book-card" style={{ 
                padding: '20px',
                textAlign: 'center',
                cursor: 'default'
              }}>
                <div style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: 700,
                  marginBottom: '8px',
                  background: 'var(--accent-gradient)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  0
                </div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--text-secondary)' 
                }}>
                  Completed 2026
                </div>
              </div>

              {/* Current Streak */}
              <div className="book-card" style={{ 
                padding: '20px',
                textAlign: 'center',
                cursor: 'default'
              }}>
                <div style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: 700,
                  marginBottom: '8px',
                  background: 'var(--accent-gradient)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  0
                </div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--text-secondary)' 
                }}>
                  Day Streak
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 style={{ 
              fontSize: '1.25rem', 
              fontWeight: 600,
              marginBottom: '16px'
            }}>
              Settings
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Settings Button */}
              <button
                onClick={() => alert('Settings coming soon!')}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: 'var(--surface-glass)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--overlay-radius)',
                  color: 'var(--text)',
                  fontSize: '1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-elevated)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface-glass)';
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>⚙️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>Playback Settings</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Speed, skip intervals, sleep timer
                  </div>
                </div>
              </button>

              {/* Downloads Manager */}
              <button
                onClick={() => alert('Downloads manager coming soon!')}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: 'var(--surface-glass)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--overlay-radius)',
                  color: 'var(--text)',
                  fontSize: '1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-elevated)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface-glass)';
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>💾</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>Downloads</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Manage offline audiobooks
                  </div>
                </div>
              </button>

              {/* Help & Support */}
              <button
                onClick={() => alert('Help & Support coming soon!')}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: 'var(--surface-glass)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--overlay-radius)',
                  color: 'var(--text)',
                  fontSize: '1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-elevated)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface-glass)';
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>❓</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>Help & Support</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    FAQ, tutorials, contact
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              padding: '16px',
              background: 'transparent',
              border: '1px solid #ef4444',
              borderRadius: 'var(--overlay-radius)',
              color: '#ef4444',
              fontSize: '1rem',
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

          {/* App Version */}
          <div style={{ 
            textAlign: 'center', 
            padding: '20px',
            color: 'var(--muted)',
            fontSize: '0.875rem'
          }}>
            Audibly v1.0.0
          </div>
        </div>
      )}
    </main>
  );
}
