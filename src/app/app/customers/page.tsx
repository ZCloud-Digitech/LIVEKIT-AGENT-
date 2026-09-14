'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Plus, Phone, Mail, Calendar, Tag } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newCust, setNewCust] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
  });

  const fetchCustomers = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (search) query.set('search', search);

    fetch(`/api/app/customers?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCustomers(data.data.customers || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/app/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCust),
    });
    setShowModal(false);
    setNewCust({ name: '', phone: '', email: '', notes: '' });
    fetchCustomers();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 className="title-xl">Customers & Contacts</h1>
          <p className="text-body" style={{ marginTop: '4px' }}>
            Tenant-isolated customer CRM directory, call records, and appointment history.
          </p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> Add Contact
        </button>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '16px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '38px' }}
              placeholder="Search by patient name, phone number, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>
      </div>

      {/* Customers Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Contact Details</th>
              <th>Total Calls</th>
              <th>Appointments</th>
              <th>Tags</th>
              <th>Notes</th>
              <th>Last Contact</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading contacts...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No contacts found. Incoming callers are automatically captured into this directory!
                </td>
              </tr>
            ) : (
              customers.map((cust) => {
                let tagsArray: string[] = [];
                try {
                  tagsArray = typeof cust.tags === 'string' ? JSON.parse(cust.tags) : cust.tags || [];
                } catch (e) {}

                return (
                  <tr key={cust.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{cust.name}</div>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{cust.phone}</div>
                      {cust.email && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cust.email}</div>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{cust.totalCalls}</td>
                    <td style={{ fontWeight: 600 }}>{cust._count?.appointments || 0}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {tagsArray.map((tag, i) => (
                          <span key={i} className="badge badge-primary" style={{ fontSize: '10px' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                      {cust.notes || '—'}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {cust.lastContactedAt ? new Date(cust.lastContactedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Customer Modal */}
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
            <h2 className="title-md" style={{ marginBottom: '16px' }}>Add Customer / Patient</h2>
            <form onSubmit={handleCreateCustomer}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Rachel Adams"
                  value={newCust.name}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="+1 (555) 333-8899"
                  value={newCust.phone}
                  onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="rachel@example.com"
                  value={newCust.email}
                  onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-control"
                  placeholder="Special preferences, insurance notes..."
                  value={newCust.notes}
                  onChange={(e) => setNewCust({ ...newCust, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
