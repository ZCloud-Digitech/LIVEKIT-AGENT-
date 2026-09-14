'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Filter, Building2, UserCheck, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function AdminClientsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTenants = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (statusFilter) query.set('status', statusFilter);

    fetch(`/api/admin/tenants?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setTenants(data.data.tenants || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTenants();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTenants();
  };

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

  const toggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to change tenant status to ${newStatus}?`)) return;

    await fetch(`/api/admin/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchTenants();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 className="title-xl">Clients & Tenants</h1>
          <p className="text-body" style={{ marginTop: '4px' }}>
            Multi-tenant directory, subscription health, and support impersonation controls.
          </p>
        </div>
        <Link href="/admin/onboarding" className="btn btn-primary">
          + Onboard New Client
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '38px' }}
              placeholder="Search by business name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ width: '180px' }}>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="TRIAL">Trial</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary">
            Apply Filter
          </button>
        </form>
      </div>

      {/* Tenants Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Business Name & Tenant ID</th>
              <th>Industry</th>
              <th>Subscription Plan</th>
              <th>Status</th>
              <th>Agents</th>
              <th>Total Calls</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading tenants...
                </td>
              </tr>
            ) : tenants.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No tenants matching criteria.
                </td>
              </tr>
            ) : (
              tenants.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {t.id}
                    </div>
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
                  <td style={{ fontWeight: 600 }}>{t._count?.calls || 0}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link href={`/admin/clients/${t.id}`} className="btn btn-secondary btn-sm">
                        Inspect
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleImpersonate(t.id)}
                        className="btn btn-outline btn-sm"
                        style={{ borderColor: 'rgba(99, 102, 241, 0.4)', color: '#a5b4fc' }}
                        title="Enter client tenant in support mode"
                      >
                        <UserCheck size={13} /> Support Mode
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTenantStatus(t.id, t.status)}
                        className={`btn btn-sm ${t.status === 'ACTIVE' ? 'btn-danger' : 'btn-secondary'}`}
                      >
                        {t.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
