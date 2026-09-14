'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Radio, Plus, Play, Settings, History, Phone, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AgentsListPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: '',
    type: 'APPOINTMENT_BOOKING',
    greeting: "Hello! How can I assist you today?",
    prompt: 'You are a helpful, professional AI phone agent.',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = () => {
    setLoading(true);
    fetch('/api/app/agents')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAgents(data.data.agents || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/app/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create agent.');
      }
      setShowModal(false);
      setNewAgent({ name: '', type: 'APPOINTMENT_BOOKING', greeting: "Hello! How can I assist you today?", prompt: 'You are a helpful AI agent.' });
      fetchAgents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 className="title-xl">Voice Agents</h1>
          <p className="text-body" style={{ marginTop: '4px' }}>
            Configure persona, speech models, business hours, and tool capabilities for your AI phone assistants.
          </p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> Create Voice Agent
        </button>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-2 gap-6">
        {agents.map((agent) => (
          <div key={agent.id} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div>
                  <h3 className="title-md" style={{ marginBottom: '4px' }}>{agent.name}</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Type: <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{agent.type?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <span className={`badge ${agent.status === 'ACTIVE' ? 'badge-active' : 'badge-paused'}`}>
                  <span className="pulse-dot"></span> {agent.status}
                </span>
              </div>

              {/* Version & Metadata */}
              <div style={{
                background: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: '16px',
                fontSize: '12.5px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px'
              }}>
                <div>
                  <span className="text-xs">Live Version:</span>
                  <div style={{ fontWeight: 600 }}>v{agent.versions[0]?.versionNumber || 1}</div>
                </div>
                <div>
                  <span className="text-xs">Voice Provider:</span>
                  <div style={{ fontWeight: 600 }}>{agent.versions[0]?.voiceProvider || 'Cartesia'}</div>
                </div>
                <div>
                  <span className="text-xs">Total Calls:</span>
                  <div style={{ fontWeight: 600 }}>{agent._count?.calls || 0}</div>
                </div>
                <div>
                  <span className="text-xs">Bookings:</span>
                  <div style={{ fontWeight: 600 }}>{agent._count?.appointments || 0}</div>
                </div>
              </div>

              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px', fontStyle: 'italic' }}>
                "{agent.versions[0]?.greeting || 'Hello, how can I help you today?'}"
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <Link href={`/app/agents/${agent.id}/test`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                <Play size={14} /> Test Workbench
              </Link>
              <Link href={`/app/agents/${agent.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                <Settings size={14} /> Configure
              </Link>
              <Link href={`/app/agents/${agent.id}/versions`} className="btn btn-outline btn-sm" title="Version History">
                <History size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Create Agent Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '32px' }}>
            <h2 className="title-md" style={{ marginBottom: '8px' }}>Create New Voice Agent</h2>
            <p className="text-body" style={{ marginBottom: '20px', fontSize: '13px' }}>
              Set up a new conversational agent. You can configure complete business hours and voice parameters after creation.
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

            <form onSubmit={handleCreateAgent}>
              <div className="form-group">
                <label className="form-label">Agent Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Leo - Appointment Specialist"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Agent Role / Type</label>
                <select
                  className="form-control"
                  value={newAgent.type}
                  onChange={(e) => setNewAgent({ ...newAgent, type: e.target.value })}
                >
                  <option value="APPOINTMENT_BOOKING">Appointment Booking</option>
                  <option value="CUSTOMER_SUPPORT">Customer Support & FAQ</option>
                  <option value="INBOUND">General Inbound Reception</option>
                  <option value="OUTBOUND">Outbound Reminders & Follow-up</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Initial Greeting</label>
                <textarea
                  className="form-control"
                  value={newAgent.greeting}
                  onChange={(e) => setNewAgent({ ...newAgent, greeting: e.target.value })}
                  rows={2}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
