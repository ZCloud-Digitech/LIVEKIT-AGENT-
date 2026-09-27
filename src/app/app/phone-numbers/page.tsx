'use client';

import { useState, useEffect } from 'react';
import { Phone, Plus, CheckCircle2, XCircle, Power, UserCheck, Radio } from 'lucide-react';

export default function PhoneNumbersPage() {
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newNumber, setNewNumber] = useState('+918040001000');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [provider, setProvider] = useState('Plivo');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchNumbers = () => {
    setLoading(true);
    fetch('/api/app/phone-numbers')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPhoneNumbers(data.data.phoneNumbers || []);
          setAgents(data.data.agents || []);
          if (data.data.agents?.length > 0 && !selectedAgentId) {
            setSelectedAgentId(data.data.agents[0].id);
          }
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNumbers();
  }, []);

  const handleAddNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/app/phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: newNumber,
          provider,
          assignedAgentId: selectedAgentId || undefined,
          direction: 'INBOUND',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchNumbers();
      } else {
        alert(data.error?.message || 'Failed to add phone number');
      }
    } catch (err: any) {
      alert(err.message || 'Error adding phone number');
    }
  };

  const handleAssignAgent = async (numberId: string, agentId: string) => {
    setUpdatingId(numberId);
    try {
      await fetch('/api/app/phone-numbers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: numberId, assignedAgentId: agentId || null }),
      });
      fetchNumbers();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleStatus = async (numberId: string, currentStatus: string) => {
    setUpdatingId(numberId);
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await fetch('/api/app/phone-numbers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: numberId, status: nextStatus }),
      });
      fetchNumbers();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 className="title-xl">Phone Numbers & Inbound SIP Routing</h1>
          <p className="text-body" style={{ marginTop: '4px' }}>
            Authoritative Direct Inward Dialing (DID) numbers mapped directly to your clinic AI voice agents.
          </p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> Register Phone Number
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Phone Number</th>
              <th>Carrier / Trunk</th>
              <th>Direction</th>
              <th>Assigned AI Agent</th>
              <th>Status</th>
              <th>Inbound Calls</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading phone inventory...
                </td>
              </tr>
            ) : phoneNumbers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No phone numbers registered for this tenant. Attach a DID to enable inbound calls.
                </td>
              </tr>
            ) : (
              phoneNumbers.map((num) => {
                const assignedAgent = agents.find((a) => a.id === num.assignedAgentId);
                return (
                  <tr key={num.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                        {num.formatted || num.number}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Created {new Date(num.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-secondary" style={{ fontSize: '12px' }}>
                        {num.provider || 'Plivo'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-primary" style={{ fontSize: '11px' }}>
                        {num.direction || 'INBOUND'}
                      </span>
                    </td>
                    <td>
                      <select
                        className="form-control"
                        style={{ fontSize: '12.5px', padding: '4px 8px', maxWidth: '200px' }}
                        value={num.assignedAgentId || ''}
                        disabled={updatingId === num.id}
                        onChange={(e) => handleAssignAgent(num.id, e.target.value)}
                      >
                        <option value="">Default (First Active Agent)</option>
                        {agents.map((ag) => (
                          <option key={ag.id} value={ag.id}>
                            {ag.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${num.status === 'ACTIVE' ? 'badge-active' : 'badge-paused'}`}>
                        {num.status === 'ACTIVE' ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {num.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{num.incomingCount}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11.5px', padding: '4px 10px' }}
                        disabled={updatingId === num.id}
                        onClick={() => handleToggleStatus(num.id, num.status)}
                      >
                        <Power size={12} /> {num.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
          <div className="card" style={{ maxWidth: '460px', width: '100%', padding: '30px' }}>
            <h2 className="title-md" style={{ marginBottom: '8px' }}>Register Inbound Phone Number</h2>
            <p className="text-body" style={{ fontSize: '13px', marginBottom: '18px', color: 'var(--text-muted)' }}>
              Configure a verified carrier DID (e.g. Indian +91 number via Plivo Zentrunk) for inbound routing.
            </p>
            <form onSubmit={handleAddNumber}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Phone Number (Canonical E.164)</label>
                <input
                  type="text"
                  className="form-control"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="+918040001000"
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Must include country code (e.g. +91 for India, +1 for US/Canada).
                </span>
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Telephony Provider / Carrier</label>
                <select
                  className="form-control"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  <option value="Plivo">Plivo Zentrunk (India ap-south)</option>
                  <option value="Exotel">Exotel ExoTrunk</option>
                  <option value="Telnyx">Telnyx</option>
                  <option value="Twilio">Twilio SIP</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Assigned Voice Agent</label>
                <select
                  className="form-control"
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                >
                  <option value="">Default (First Active Agent)</option>
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Attach Number
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
