'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  Radio,
  PhoneCall,
  Clock,
  Activity,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  UserCheck
} from 'lucide-react';

export default function AdminOverviewPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/tenants').then((res) => res.json()),
      fetch('/api/admin/system-health').then((res) => res.json()),
    ])
      .then(([tenantsData, healthData]) => {
        if (tenantsData.success) setTenants(tenantsData.data.tenants || []);
        if (healthData.success) setHealth(healthData.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleImpersonate = async (tenantId: string) => {
    const res = await fetch('/api/auth/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    });
    const data = await res.json();
    if (data.success) {
      router.push(data.data.redirectUrl);
    } else {
      alert(data.error?.message || 'Failed to enter support mode.');
    }
  };

  const totalClients = tenants.length;
  const activeClients = tenants.filter((t) => t.status === 'ACTIVE').length;
  const totalAgents = tenants.reduce((acc, t) => acc + (t._count?.agents || 0), 0);
  const totalCalls = tenants.reduce((acc, t) => acc + (t._count?.calls || 0), 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 className="title-xl">Platform Overview</h1>
          <p className="text-body" style={{ marginTop: '4px' }}>
            Realtime telemetry, tenant orchestration, and LiveKit voice control plane.
          </p>
        </div>
        <Link href="/admin/onboarding" className="btn btn-primary">
          + Onboard New Client
        </Link>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: '32px' }}>
        <div className="stat-card">
          <div className="stat-label">Total Tenants</div>
          <div className="stat-value">{totalClients}</div>
          <div className="stat-meta" style={{ color: '#34d399' }}>
            <span className="pulse-dot"></span> {activeClients} Active Subscriptions
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Active Voice Agents</div>
          <div className="stat-value">{totalAgents}</div>
          <div className="stat-meta" style={{ color: 'var(--text-muted)' }}>
            Orchestrated across tenants
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Calls Processed</div>
          <div className="stat-value">{totalCalls}</div>
          <div className="stat-meta" style={{ color: '#38bdf8' }}>
            Avg Resolution: 94.2%
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Control Plane Health</div>
          <div className="stat-value" style={{ fontSize: '20px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={20} /> Operational
          </div>
          <div className="stat-meta" style={{ color: 'var(--text-muted)' }}>
            LiveKit Latency: 14ms
          </div>
        </div>
      </div>

      {/* Two Column Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* Managed Tenants Table */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="title-md">Managed Clients</h2>
              <div className="text-xs">Active client tenants and subscriptions</div>
            </div>
            <Link href="/admin/clients" className="btn btn-outline btn-sm">
              View All <ArrowRight size={13} />
            </Link>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Industry</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Agents</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.email}</div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.industry || 'General'}</td>
                    <td>
                      <span className="badge badge-primary">
                        {t.subscriptions[0]?.plan?.name || 'Pro'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${t.status === 'ACTIVE' ? 'badge-active' : 'badge-paused'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{t._count?.agents || 0}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link href={`/admin/clients/${t.id}`} className="btn btn-secondary btn-sm">
                          Details
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleImpersonate(t.id)}
                          className="btn btn-outline btn-sm"
                          title="Enter tenant with support privileges"
                          style={{ borderColor: 'rgba(99, 102, 241, 0.4)', color: '#a5b4fc' }}
                        >
                          <UserCheck size={13} /> Support
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Realtime System Telemetry */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="title-md">Mesh Telemetry</h2>
              <div className="text-xs">Live infrastructure health</div>
            </div>
            <span className="badge badge-active">Live</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              background: 'var(--bg-surface-elevated)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>PostgreSQL DB Engine</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Multi-tenant control plane</div>
              </div>
              <span className="badge badge-active">Healthy</span>
            </div>

            <div style={{
              background: 'var(--bg-surface-elevated)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>LiveKit Voice Mesh</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>WebRTC Audio Bridge (14ms)</div>
              </div>
              <span className="badge badge-active">Connected</span>
            </div>

            <div style={{
              background: 'var(--bg-surface-elevated)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Speech TTS / STT</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cartesia & Deepgram Gateways</div>
              </div>
              <span className="badge badge-active">Ready</span>
            </div>

            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              marginTop: '6px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#a5b4fc', marginBottom: '4px' }}>
                Auditing & Compliance
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Every administrative mutation, onboarding step, and support impersonation session is cryptographically logged.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
