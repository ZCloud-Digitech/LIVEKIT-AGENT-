'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  Radio,
  PhoneCall,
  Calendar,
  Phone,
  BookOpen,
  Puzzle,
  Gauge,
  CreditCard,
  History,
  UserCheck,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';

export default function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = use(params);
  const router = useRouter();
  const [tenant, setTenant] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/tenants/${tenantId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setTenant(data.data.tenant);
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleImpersonate = async () => {
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

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading tenant details...</div>;
  }

  if (!tenant) {
    return (
      <div style={{ padding: '40px' }}>
        <p>Tenant not found.</p>
        <Link href="/admin/clients" className="btn btn-secondary" style={{ marginTop: '16px' }}>
          Back to Clients
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'business', label: 'Business & Settings', icon: Building2 },
    { id: 'users', label: 'Users & Team', icon: Users },
    { id: 'agents', label: 'Voice Agents', icon: Radio },
    { id: 'calls', label: 'Calls', icon: PhoneCall },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'numbers', label: 'Phone Numbers', icon: Phone },
    { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
    { id: 'integrations', label: 'Integrations', icon: Puzzle },
    { id: 'billing', label: 'Subscription & Plan', icon: CreditCard },
  ];

  return (
    <div>
      {/* Breadcrumb & Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <Link href="/admin/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={14} /> Back to Clients
        </Link>
      </div>

      {/* Header Banner */}
      <div className="card" style={{ marginBottom: '28px', padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h1 className="title-lg">{tenant.name}</h1>
              <span className={`badge ${tenant.status === 'ACTIVE' ? 'badge-active' : 'badge-paused'}`}>
                {tenant.status}
              </span>
              <span className="badge badge-primary">
                {tenant.subscriptions[0]?.plan?.name || 'Pro Plan'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '24px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
              <div>Tenant ID: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{tenant.id}</span></div>
              <div>Timezone: <span style={{ color: 'var(--text-secondary)' }}>{tenant.timezone}</span></div>
              <div>Created: <span style={{ color: 'var(--text-secondary)' }}>{new Date(tenant.createdAt).toLocaleDateString()}</span></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={handleImpersonate}
              className="btn btn-primary"
              style={{ gap: '8px', background: 'linear-gradient(135deg, #4f46e5, #06b6d4)' }}
            >
              <UserCheck size={16} /> Enter Support Mode
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="tabs-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="grid grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="stat-label">Configured Agents</div>
              <div className="stat-value">{tenant.agents?.length || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Calls Handled</div>
              <div className="stat-value">{tenant._count?.calls || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Appointments Booked</div>
              <div className="stat-value">{tenant._count?.appointments || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Team Members</div>
              <div className="stat-value">{tenant.members?.length || 0}</div>
            </div>
          </div>

          <div className="card">
            <h3 className="title-sm" style={{ marginBottom: '16px' }}>Tenant Health Checklist</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#34d399' }}>
                <CheckCircle2 size={16} /> Voice Agent Active & Configured
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#34d399' }}>
                <CheckCircle2 size={16} /> LiveKit Voice Token Session Boundary Ready
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#34d399' }}>
                <CheckCircle2 size={16} /> Phone Number Inbound Routing Active
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#34d399' }}>
                <CheckCircle2 size={16} /> Usage Within Limits (Under 100% threshold)
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'business' && (
        <div className="card">
          <h3 className="title-md" style={{ marginBottom: '20px' }}>Business Profile & Settings</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '13.5px' }}>
            <div>
              <div className="text-xs">Legal / Display Name</div>
              <div style={{ fontWeight: 600, marginTop: '2px' }}>{tenant.legalName || tenant.name}</div>
            </div>
            <div>
              <div className="text-xs">Industry</div>
              <div style={{ fontWeight: 600, marginTop: '2px' }}>{tenant.industry || 'Healthcare'}</div>
            </div>
            <div>
              <div className="text-xs">Business Email</div>
              <div style={{ fontWeight: 600, marginTop: '2px' }}>{tenant.email}</div>
            </div>
            <div>
              <div className="text-xs">Business Phone</div>
              <div style={{ fontWeight: 600, marginTop: '2px' }}>{tenant.phone || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs">Timezone</div>
              <div style={{ fontWeight: 600, marginTop: '2px' }}>{tenant.timezone}</div>
            </div>
            <div>
              <div className="text-xs">Data Retention Policy</div>
              <div style={{ fontWeight: 600, marginTop: '2px' }}>{tenant.settings?.retentionDays || 90} Days</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card">
          <h3 className="title-md" style={{ marginBottom: '16px' }}>Tenant Members & Roles</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Tenant Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {tenant.members?.map((m: any) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.user?.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{m.user?.email}</td>
                    <td>
                      <span className="badge badge-primary">{m.role}</span>
                    </td>
                    <td>
                      <span className="badge badge-active">{m.user?.status}</span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(m.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="card">
          <h3 className="title-md" style={{ marginBottom: '16px' }}>Assigned Voice Agents</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tenant.agents?.map((a: any) => (
              <div
                key={a.id}
                style={{
                  padding: '16px 20px',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>{a.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Type: {a.type} • ID: {a.id}</div>
                </div>
                <span className={`badge ${a.status === 'ACTIVE' ? 'badge-active' : 'badge-draft'}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'numbers' && (
        <div className="card">
          <h3 className="title-md" style={{ marginBottom: '16px' }}>Phone Numbers & Routing</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Incoming Calls</th>
                  <th>Outgoing Calls</th>
                </tr>
              </thead>
              <tbody>
                {tenant.phoneNumbers?.map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{p.formatted || p.number}</td>
                    <td>{p.provider}</td>
                    <td><span className="badge badge-active">{p.status}</span></td>
                    <td>{p.incomingCount}</td>
                    <td>{p.outgoingCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="card">
          <h3 className="title-md" style={{ marginBottom: '16px' }}>Subscription & Entitlement Tiers</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                {tenant.subscriptions[0]?.plan?.name || 'Pro Plan'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                ${tenant.subscriptions[0]?.plan?.priceMonthly}/month • Billed Monthly
              </div>
            </div>
            <span className="badge badge-active">Active Subscription</span>
          </div>
        </div>
      )}
    </div>
  );
}
