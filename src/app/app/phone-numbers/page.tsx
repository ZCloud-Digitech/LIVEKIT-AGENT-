'use client';

import { useState, useEffect } from 'react';
import { Phone, Plus, Radio, CheckCircle2 } from 'lucide-react';

export default function PhoneNumbersPage() {
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newNumber, setNewNumber] = useState('+1 (555) 890-1234');

  const fetchNumbers = () => {
    setLoading(true);
    fetch('/api/app/phone-numbers')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPhoneNumbers(data.data.phoneNumbers || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNumbers();
  }, []);

  const handleAddNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/app/phone-numbers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: newNumber }),
    });
    setShowModal(false);
    fetchNumbers();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 className="title-xl">Phone Numbers & Inbound Routing</h1>
          <p className="text-body" style={{ marginTop: '4px' }}>
            Direct Inward Dialing (DID) numbers mapped directly to your LiveKit voice agents.
          </p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> Add Phone Number
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Phone Number</th>
              <th>Provider / Carrier</th>
              <th>Assigned Voice Agent</th>
              <th>Status</th>
              <th>Incoming Calls</th>
              <th>Outgoing Calls</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading phone inventory...
                </td>
              </tr>
            ) : phoneNumbers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No phone numbers registered for this tenant.
                </td>
              </tr>
            ) : (
              phoneNumbers.map((num) => (
                <tr key={num.id}>
                  <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                    {num.formatted || num.number}
                  </td>
                  <td>{num.provider}</td>
                  <td style={{ color: '#818cf8', fontWeight: 500 }}>
                    Chloe - Dental Reception & Scheduling
                  </td>
                  <td>
                    <span className="badge badge-active">
                      <CheckCircle2 size={12} /> {num.status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{num.incomingCount}</td>
                  <td style={{ fontWeight: 600 }}>{num.outgoingCount}</td>
                </tr>
              ))
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
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '30px' }}>
            <h2 className="title-md" style={{ marginBottom: '16px' }}>Attach Inbound Phone Number</h2>
            <form onSubmit={handleAddNumber}>
              <div className="form-group">
                <label className="form-label">Phone Number (E.164 format)</label>
                <input
                  type="text"
                  className="form-control"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
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
