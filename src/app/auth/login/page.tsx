'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Shield, Lock, Mail, ArrowRight, CheckCircle2, AlertCircle, Building, Headphones } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'admin' ? 'platform' : 'tenant';
  const initialEmail = searchParams.get('email') || '';

  const [activeTab, setActiveTab] = useState<'tenant' | 'platform'>(initialTab);
  const [email, setEmail] = useState(initialEmail || (initialTab === 'platform' ? 'admin@zcallagent.ai' : 'owner@apexdental.com'));
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          loginType: activeTab,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Login failed. Please verify credentials.');
      }

      // Redirect according to role
      router.push(data.data.redirectUrl);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (userEmail: string, tab: 'tenant' | 'platform') => {
    setActiveTab(tab);
    setEmail(userEmail);
    setPassword('Password123!');
    setError(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 20%, rgba(99, 102, 241, 0.12), transparent 60%), var(--bg-app)',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: '20px',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
            }}>
              Z
            </div>
            <span style={{ fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em' }}>Z Call Agent</span>
          </Link>
          <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Realtime AI Voice Agent Control Plane
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'var(--bg-surface-elevated)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('tenant');
              setEmail('owner@apexdental.com');
              setError(null);
            }}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: activeTab === 'tenant' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'tenant' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            <Building size={14} /> Client Portal
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('platform');
              setEmail('admin@zcallagent.ai');
              setError(null);
            }}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: activeTab === 'platform' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'platform' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            <Shield size={14} /> Platform Admin
          </button>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px' }}>
              {activeTab === 'platform' ? 'Platform Console Login' : 'Sign in to your Tenant'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {activeTab === 'platform'
                ? 'Internal management, telemetry, and tenant orchestration'
                : 'Manage your voice agents, call analytics, and scheduling'}
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#fb7185',
              fontSize: '13px',
              marginBottom: '20px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  className="form-control"
                  style={{ paddingLeft: '38px' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Password</label>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  className="form-control"
                  style={{ paddingLeft: '38px' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '12px', padding: '10px' }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight size={15} />
            </button>
          </form>

          {/* Seed Quick Fills */}
          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '10px' }}>
              Quick Test Credentials (Password: Password123!)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'flex-start', fontSize: '12px' }}
                onClick={() => quickFill('admin@zcallagent.ai', 'platform')}
              >
                <Shield size={13} style={{ color: '#818cf8' }} /> Super Admin: admin@zcallagent.ai
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'flex-start', fontSize: '12px' }}
                onClick={() => quickFill('owner@apexdental.com', 'tenant')}
              >
                <Building size={13} style={{ color: '#34d399' }} /> Tenant A Owner: owner@apexdental.com
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'flex-start', fontSize: '12px' }}
                onClick={() => quickFill('owner@metrohealth.com', 'tenant')}
              >
                <Building size={13} style={{ color: '#38bdf8' }} /> Tenant B Owner: owner@metrohealth.com
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
