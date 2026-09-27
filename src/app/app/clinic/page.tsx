'use client';

import { useState, useEffect } from 'react';
import { Building2, Stethoscope, Clock, ShieldAlert, Plus, CheckCircle2, Trash2, Edit3, Save } from 'lucide-react';

export default function ClinicManagementPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'services' | 'hours' | 'escalation'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Profile State
  const [profile, setProfile] = useState({
    clinicName: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    timezone: 'America/New_York',
    website: '',
    emergencyInstruction: '',
  });

  // Services State
  const [services, setServices] = useState<any[]>([]);
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    durationMinutes: 30,
    price: 100,
    active: true,
  });
  const [showAddService, setShowAddService] = useState(false);

  // Hours State
  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>({
    monday: { open: '08:00', close: '18:00', closed: false },
    tuesday: { open: '08:00', close: '18:00', closed: false },
    wednesday: { open: '08:00', close: '18:00', closed: false },
    thursday: { open: '08:00', close: '18:00', closed: false },
    friday: { open: '08:00', close: '17:00', closed: false },
    saturday: { open: '09:00', close: '13:00', closed: false },
    sunday: { open: '00:00', close: '00:00', closed: true },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profRes, servRes, hrsRes] = await Promise.all([
        fetch('/api/app/clinic/profile').then((r) => r.json()),
        fetch('/api/app/clinic/services').then((r) => r.json()),
        fetch('/api/app/clinic/hours').then((r) => r.json()),
      ]);

      if (profRes.success && profRes.data?.profile) {
        setProfile({
          clinicName: profRes.data.profile.clinicName || '',
          description: profRes.data.profile.description || '',
          phone: profRes.data.profile.phone || '',
          email: profRes.data.profile.email || '',
          address: profRes.data.profile.address || '',
          timezone: profRes.data.profile.timezone || 'America/New_York',
          website: profRes.data.profile.website || '',
          emergencyInstruction: profRes.data.profile.emergencyInstruction || '',
        });
      }

      if (servRes.success && servRes.data?.services) {
        setServices(servRes.data.services);
      }

      if (hrsRes.success && hrsRes.data?.hours) {
        setHours(hrsRes.data.hours);
      }
    } catch (err) {
      console.error('Error loading clinic configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/app/clinic/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Clinic profile and clinical safety rules updated successfully!');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.name.trim()) return;
    try {
      const res = await fetch('/api/app/clinic/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newService),
      });
      const data = await res.json();
      if (data.success) {
        setServices([...services, data.data.service]);
        setNewService({ name: '', description: '', durationMinutes: 30, price: 100, active: true });
        setShowAddService(false);
        showNotification('New clinic service added.');
      }
    } catch (err) {
      console.error('Failed to create service:', err);
    }
  };

  const handleToggleService = async (service: any) => {
    try {
      const res = await fetch('/api/app/clinic/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: service.id, active: !service.active }),
      });
      const data = await res.json();
      if (data.success) {
        setServices(services.map((s) => (s.id === service.id ? data.data.service : s)));
        showNotification(`Service "${service.name}" ${!service.active ? 'enabled' : 'disabled'}.`);
      }
    } catch (err) {
      console.error('Failed to update service:', err);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Are you sure you want to remove this service?')) return;
    try {
      const res = await fetch(`/api/app/clinic/services?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setServices(services.filter((s) => s.id !== id));
        showNotification('Service deleted or archived.');
      }
    } catch (err) {
      console.error('Failed to delete service:', err);
    }
  };

  const handleSaveHours = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/app/clinic/hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Weekly business hours saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', color: 'var(--text-secondary)' }}>
        Loading clinic intelligence configuration...
      </div>
    );
  }

  const daysList = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div style={{ maxWidth: '960px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="title-xl">Clinic Administration & Business Tools</h1>
        <p className="text-body" style={{ marginTop: '4px' }}>
          Configure clinic profile, operating hours, healthcare services, and AI safety guardrails.
        </p>
      </div>

      {successMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          color: '#34d399',
          fontSize: '13.5px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-nav" style={{ marginBottom: '24px' }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <Building2 size={15} style={{ display: 'inline', marginRight: '6px' }} />
          Clinic Profile
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          <Stethoscope size={15} style={{ display: 'inline', marginRight: '6px' }} />
          Services ({services.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'hours' ? 'active' : ''}`}
          onClick={() => setActiveTab('hours')}
        >
          <Clock size={15} style={{ display: 'inline', marginRight: '6px' }} />
          Operating Hours
        </button>
      </div>

      {/* TAB 1: PROFILE */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h2 className="title-md" style={{ marginBottom: '16px' }}>General Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Clinic Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={profile.clinicName}
                  onChange={(e) => setProfile({ ...profile, clinicName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+1 (555) 234-5678"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="contact@clinic.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Official Website</label>
                <input
                  type="url"
                  className="form-control"
                  value={profile.website}
                  onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                  placeholder="https://apexdental.com"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Physical Address</label>
              <input
                type="text"
                className="form-control"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="100 Medical Plaza, Suite 400, New York, NY"
              />
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Clinic Timezone</label>
              <select
                className="form-control"
                value={profile.timezone}
                onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
              >
                <option value="America/New_York">Eastern Time (America/New_York)</option>
                <option value="America/Chicago">Central Time (America/Chicago)</option>
                <option value="America/Denver">Mountain Time (America/Denver)</option>
                <option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
                <option value="Asia/Kolkata">India Standard Time (Asia/Kolkata)</option>
                <option value="Europe/London">Greenwich Mean Time (Europe/London)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Clinic Description & Overview</label>
              <textarea
                className="form-control"
                rows={3}
                value={profile.description}
                onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                placeholder="Comprehensive family dental care, oral surgery, and cosmetic dentistry."
              />
            </div>
          </div>

          <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#f87171' }}>
              <ShieldAlert size={18} />
              <h2 className="title-md" style={{ color: '#f87171' }}>Medical Emergency & Escalation Policy</h2>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '14px' }}>
              The AI assistant is strictly administrative and will recite this instruction whenever life-threatening symptoms are detected.
            </p>
            <textarea
              className="form-control"
              rows={3}
              value={profile.emergencyInstruction}
              onChange={(e) => setProfile({ ...profile, emergencyInstruction: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      )}

      {/* TAB 2: SERVICES */}
      {activeTab === 'services' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p className="text-body">
              Active services can be offered and booked by the AI telecaller during calls.
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddService(!showAddService)}>
              <Plus size={15} /> Add Service
            </button>
          </div>

          {showAddService && (
            <form onSubmit={handleAddService} className="card" style={{ marginBottom: '20px' }}>
              <h3 className="title-sm" style={{ marginBottom: '14px' }}>Add Healthcare Service</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Service Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Teeth Whitening"
                    value={newService.name}
                    onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (Minutes)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={newService.durationMinutes}
                    onChange={(e) => setNewService({ ...newService, durationMinutes: parseInt(e.target.value) || 30 })}
                    min={10}
                    max={240}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Professional laser whitening and fluoride treatment"
                  value={newService.description}
                  onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="submit" className="btn btn-primary btn-sm">Create Service</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddService(false)}>Cancel</button>
              </div>
            </form>
          )}

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Description</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.description || '—'}</td>
                    <td>{s.durationMinutes} mins</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleService(s)}
                        className={`badge ${s.active ? 'badge-active' : 'badge-inactive'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                      >
                        {s.active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteService(s.id)}
                        className="btn btn-sm btn-icon"
                        style={{ color: '#f87171' }}
                        title="Delete service"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: HOURS */}
      {activeTab === 'hours' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h2 className="title-md" style={{ marginBottom: '12px' }}>Weekly Operating Hours</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              The AI automatically generates appointment availability slots within these operating hours and blocks closed days.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {daysList.map((day) => {
                const daySchedule = hours[day] || { open: '08:00', close: '18:00', closed: false };
                return (
                  <div
                    key={day}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'var(--bg-card-secondary, rgba(255,255,255,0.03))',
                      borderRadius: 'var(--radius-md)',
                      opacity: daySchedule.closed ? 0.6 : 1,
                    }}
                  >
                    <div style={{ width: '130px', fontWeight: 600, textTransform: 'capitalize' }}>
                      {day}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={daySchedule.closed}
                          onChange={(e) => {
                            setHours({
                              ...hours,
                              [day]: { ...daySchedule, closed: e.target.checked },
                            });
                          }}
                        />
                        Closed
                      </label>

                      {!daySchedule.closed ? (
                        <>
                          <input
                            type="time"
                            className="form-control"
                            style={{ width: '120px' }}
                            value={daySchedule.open}
                            onChange={(e) => {
                              setHours({
                                ...hours,
                                [day]: { ...daySchedule, open: e.target.value },
                              });
                            }}
                          />
                          <span style={{ color: 'var(--text-muted)' }}>to</span>
                          <input
                            type="time"
                            className="form-control"
                            style={{ width: '120px' }}
                            value={daySchedule.close}
                            onChange={(e) => {
                              setHours({
                                ...hours,
                                [day]: { ...daySchedule, close: e.target.value },
                              });
                            }}
                          />
                        </>
                      ) : (
                        <div style={{ color: '#f87171', fontSize: '13px', fontStyle: 'italic', width: '265px', textAlign: 'center' }}>
                          Clinic Closed
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button type="button" onClick={handleSaveHours} className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Operating Hours'}
          </button>
        </div>
      )}
    </div>
  );
}
