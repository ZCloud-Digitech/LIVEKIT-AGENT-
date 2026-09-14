'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Plus, CheckCircle2, XCircle } from 'lucide-react';

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newApt, setNewApt] = useState({
    title: 'Dental Exam',
    serviceName: 'Routine Dental Cleaning',
    date: '2026-09-20',
    time: '11:00',
    durationMinutes: 45,
    notes: 'Direct scheduling via portal',
  });

  const fetchAppointments = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (statusFilter) query.set('status', statusFilter);

    fetch(`/api/app/appointments?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAppointments(data.data.appointments || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAppointments();
  }, [statusFilter]);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/app/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newApt),
    });
    setShowModal(false);
    fetchAppointments();
  };

  const handleUpdateStatus = async (appointmentId: string, status: string) => {
    await fetch('/api/app/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UPDATE_STATUS', appointmentId, status }),
    });
    fetchAppointments();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 className="title-xl">Appointments</h1>
          <p className="text-body" style={{ marginTop: '4px' }}>
            Appointments scheduled autonomously by AI voice agents and calendar connectors.
          </p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> Book Appointment
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="tabs-nav" style={{ marginBottom: '20px' }}>
        <button
          type="button"
          className={`tab-btn ${statusFilter === '' ? 'active' : ''}`}
          onClick={() => setStatusFilter('')}
        >
          All Appointments
        </button>
        <button
          type="button"
          className={`tab-btn ${statusFilter === 'UPCOMING' ? 'active' : ''}`}
          onClick={() => setStatusFilter('UPCOMING')}
        >
          Upcoming
        </button>
        <button
          type="button"
          className={`tab-btn ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('COMPLETED')}
        >
          Completed
        </button>
        <button
          type="button"
          className={`tab-btn ${statusFilter === 'CANCELLED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('CANCELLED')}
        >
          Cancelled
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Patient / Customer</th>
              <th>Service / Title</th>
              <th>Date & Time</th>
              <th>Booked By</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading appointments...
                </td>
              </tr>
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No appointments found for this filter.
                </td>
              </tr>
            ) : (
              appointments.map((apt) => (
                <tr key={apt.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{apt.customer?.name || 'Walk-in Customer'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{apt.customer?.phone || 'No phone'}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{apt.serviceName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{apt.title}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{apt.date}</div>
                    <div style={{ fontSize: '12px', color: '#38bdf8' }}>{apt.time} ({apt.durationMinutes}m)</div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {apt.agent?.name || 'Voice Agent (Autonomous)'}
                  </td>
                  <td>
                    <span className={`badge ${
                      apt.status === 'UPCOMING' ? 'badge-active' : apt.status === 'COMPLETED' ? 'badge-primary' : 'badge-paused'
                    }`}>
                      {apt.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {apt.status === 'UPCOMING' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(apt.id, 'COMPLETED')}
                            className="btn btn-secondary btn-sm"
                            title="Mark as completed"
                          >
                            <CheckCircle2 size={13} style={{ color: '#34d399' }} /> Done
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(apt.id, 'CANCELLED')}
                            className="btn btn-outline btn-sm"
                            title="Cancel appointment"
                          >
                            <XCircle size={13} style={{ color: '#fb7185' }} /> Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Booking Modal */}
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
            <h2 className="title-md" style={{ marginBottom: '16px' }}>Schedule Appointment</h2>
            <form onSubmit={handleCreateAppointment}>
              <div className="form-group">
                <label className="form-label">Service</label>
                <input
                  type="text"
                  className="form-control"
                  value={newApt.serviceName}
                  onChange={(e) => setNewApt({ ...newApt, serviceName: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={newApt.date}
                    onChange={(e) => setNewApt({ ...newApt, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time (HH:MM)</label>
                  <input
                    type="time"
                    className="form-control"
                    value={newApt.time}
                    onChange={(e) => setNewApt({ ...newApt, time: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Book Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
