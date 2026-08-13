import React from 'react';
import { ShieldCheck, LogIn } from 'lucide-react';

export const LoginView = () => {
  const handleGoogleLogin = () => {
    // Redirect browser to server OAuth endpoint
    window.location.href = '/api/auth/google';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '24px',
      textAlign: 'center'
    }}>
      <div className="card" style={{
        maxWidth: '420px',
        width: '100%',
        padding: '36px 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        borderRadius: '16px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #e0e0e0)'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(37, 99, 235, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <ShieldCheck size={36} color="var(--accent-blue, #2563eb)" />
        </div>

        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            DOCTRINE OS
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary, #666666)', margin: 0 }}>
            Self-Mastery Personal Operating System
          </p>
        </div>

        <div style={{ width: '100%', borderTop: '1px solid var(--border-color, #eee)', my: '12px' }} />

        <div style={{ width: '100%' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary, #888)', marginBottom: '16px' }}>
            Sign in with your Google account to access your personal persistent schedule and historical logs.
          </p>

          <button
            onClick={handleGoogleLogin}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '14px 20px',
              fontSize: '15px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              borderRadius: '10px',
              backgroundColor: '#4285F4',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(66, 133, 244, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#ffffff" opacity="0.9" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#ffffff" opacity="0.8" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#ffffff" opacity="0.95" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-secondary, #aaa)', marginTop: '8px' }}>
          Secure OAuth 2.0 Authentication • Persistent SQLite Storage
        </div>
      </div>
    </div>
  );
};
