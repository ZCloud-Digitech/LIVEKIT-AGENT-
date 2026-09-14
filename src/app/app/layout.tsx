'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Radio,
  PhoneCall,
  Calendar,
  Users,
  Phone,
  BookOpen,
  Puzzle,
  BarChart3,
  Gauge,
  UserPlus,
  Settings,
  LogOut,
  Building,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { AuthSession } from '@/types';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success || !data.data?.session?.tenantId) {
          router.push('/auth/login');
        } else {
          setSession(data.data.session);
        }
      })
      .catch(() => router.push('/auth/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/auth/login');
  };

  const handleExitSupportMode = async () => {
    const res = await fetch('/api/auth/stop-impersonation', { method: 'POST' });
    const data = await res.json();
    router.push(data.data?.redirectUrl || '/admin');
    router.refresh();
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
          <span className="pulse-dot"></span> Resolving Tenant Context...
        </div>
      </div>
    );
  }

  const navItems = [
    { label: 'Overview', href: '/app', icon: LayoutDashboard },
    { label: 'Voice Agents', href: '/app/agents', icon: Radio },
    { label: 'Calls & Transcripts', href: '/app/calls', icon: PhoneCall },
    { label: 'Appointments', href: '/app/appointments', icon: Calendar },
    { label: 'Customers (CRM)', href: '/app/customers', icon: Users },
    { label: 'Phone Numbers', href: '/app/phone-numbers', icon: Phone },
    { label: 'Knowledge Base', href: '/app/knowledge', icon: BookOpen },
    { label: 'Integrations', href: '/app/integrations', icon: Puzzle },
    { label: 'Usage & Quotas', href: '/app/usage', icon: Gauge },
    { label: 'Team & Roles', href: '/app/team', icon: UserPlus },
    { label: 'Settings', href: '/app/settings', icon: Settings },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-app)' }}>
      {/* Impersonation / Support Mode Banner */}
      {session?.isImpersonating && (
        <div className="impersonation-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={16} />
            <span>
              <strong>Support Mode Active:</strong> You are viewing <strong>{session.tenantName}</strong> as platform administrator ({session.impersonatedBy}). All actions are audited.
            </span>
          </div>
          <button
            type="button"
            onClick={handleExitSupportMode}
            className="btn btn-sm"
            style={{ background: '#fff', color: '#b91c1c', fontWeight: 600, border: 'none' }}
          >
            Exit Support Mode
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        <aside style={{
          width: '260px',
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: session?.isImpersonating ? '40px' : 0,
          height: session?.isImpersonating ? 'calc(100vh - 40px)' : '100vh',
          zIndex: 50,
        }}>
          {/* Tenant Switcher / Profile Box */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #06b6d4, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: '16px',
              flexShrink: 0
            }}>
              {session?.tenantName?.charAt(0) || 'T'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 700, fontSize: '14.5px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {session?.tenantName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span className="badge badge-active" style={{ fontSize: '10px', padding: '1px 6px' }}>
                  {session?.tenantRole}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '9px 14px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                    border: isActive ? '1px solid var(--border-default)' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={16} style={{ color: isActive ? '#38bdf8' : 'inherit' }} />
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
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {session?.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {session?.email}
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <header style={{
            height: '64px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            background: 'rgba(15, 22, 36, 0.6)',
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{session?.tenantName}</span>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {navItems.find((n) => n.href === pathname || (n.href !== '/app' && pathname.startsWith(n.href)))?.label || 'Portal'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="badge badge-active" style={{ textTransform: 'none', gap: '6px' }}>
                <span className="pulse-dot"></span> LiveKit Realtime Audio Connected
              </div>
              <Link href="/app/agents" className="btn btn-primary btn-sm">
                <Radio size={13} /> Manage Agents
              </Link>
            </div>
          </header>

          <main style={{ flex: 1, padding: '32px', maxWidth: '1350px', width: '100%', margin: '0 auto' }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
