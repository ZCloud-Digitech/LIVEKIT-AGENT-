'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  UserPlus,
  Activity,
  FileText,
  CreditCard,
  LogOut,
  Shield,
  Radio,
  Server,
  ExternalLink
} from 'lucide-react';
import { AuthSession } from '@/types';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success || !data.data?.session?.isPlatformUser) {
          router.push('/auth/login?tab=admin');
        } else {
          setSession(data.data.session);
        }
      })
      .catch(() => router.push('/auth/login?tab=admin'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
          <span className="pulse-dot"></span> Loading Platform Console...
        </div>
      </div>
    );
  }

  const navItems = [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Clients / Tenants', href: '/admin/clients', icon: Building2 },
    { label: 'Client Onboarding', href: '/admin/onboarding', icon: UserPlus },
    { label: 'System Health', href: '/admin/system-health', icon: Activity },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
    { label: 'Subscription Plans', href: '/admin/plans', icon: CreditCard },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)' }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px',
        borderRight: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 50,
      }}>
        {/* Brand */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '16px',
            boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)'
          }}>
            Z
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>Z Call Agent</div>
            <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600, letterSpacing: '0.04em' }}>
              PLATFORM ADMIN
            </div>
          </div>
        </div>

        {/* Live Status Header Badge */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: '#34d399'
          }}>
            <span className="pulse-dot"></span>
            <span>LiveKit Voice: Ready</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                  border: isActive ? '1px solid var(--border-default)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={17} style={{ color: isActive ? '#818cf8' : 'inherit' }} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--primary-glow)',
              border: '1px solid var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              flexShrink: 0
            }}>
              {session?.name?.charAt(0) || 'A'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {session?.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {session?.platformRole}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          height: '64px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          background: 'rgba(15, 22, 36, 0.6)',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Platform Control Plane</span>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {navItems.find((n) => n.href === pathname)?.label || 'Console'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/" target="_blank" className="btn btn-outline btn-sm">
              <ExternalLink size={13} /> View Landing Page
            </Link>
          </div>
        </header>

        <main style={{ flex: 1, padding: '32px', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
