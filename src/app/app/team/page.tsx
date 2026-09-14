'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Shield, UserCheck, AlertCircle } from 'lucide-react';

export default function TeamPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    role: 'STAFF',
  });
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = () => {
    setLoading(true);
    fetch('/api/app/team')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setMembers(data.data.members || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError(null);
    try {
      const res = await fetch('/api/app/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to invite team member.');
      }
      setShowModal(false);
      setNewMember({ name: '', email: '', role: 'STAFF' });
      fetchMembers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 className="title-xl">Team & Role-Based Access</h1>
          <p className="text-body" style={{ marginTop: '4px' }}>
            Manage authorized staff members, role tiers, and permissions within this tenant.
          </p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> Invite Member
        </button>
      </div>

      {/* Role Hierarchy Reference Card */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px', background: 'var(--bg-surface-elevated)' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
          Role Permissions Matrix
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <div><strong>OWNER:</strong> Full access + billing & agents</div>
          <div><strong>ADMIN:</strong> Member management & config</div>
          <div><strong>MANAGER:</strong> Calls, analytics & bookings</div>
          <div><strong>STAFF:</strong> View calls & appointments</div>
          <div><strong>VIEWER:</strong> Read-only call review</div>
        </div>
      </div>

      {/* Members Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Member Name</th>
              <th>Email</th>
              <th>Role Tier</th>
              <th>Status</th>
              <th>Member Since</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading team members...
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.user?.name}</div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{m.user?.email}</td>
                  <td>
                    <span className="badge badge-primary">{m.role}</span>
                  </td>
                  <td>
                    <span className="badge badge-active">{m.user?.status}</span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '30px' }}>
            <h2 className="title-md" style={{ marginBottom: '8px' }}>Invite Team Member</h2>
            <p className="text-body" style={{ marginBottom: '20px', fontSize: '13px' }}>
              Assign a role according to the tenant permissions hierarchy.
            </p>

            {error && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                color: '#fb7185',
                fontSize: '13px',
                marginBottom: '16px'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleInvite}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Liam Vance"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="liam@example.com"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tenant Role</label>
                <select
                  className="form-control"
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                >
                  <option value="ADMIN">ADMIN (Agent config, team management)</option>
                  <option value="MANAGER">MANAGER (Calls, appointments, customers)</option>
                  <option value="STAFF">STAFF (Front desk & appointments)</option>
                  <option value="VIEWER">VIEWER (Read-only analytics)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={inviting}>
                  {inviting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
