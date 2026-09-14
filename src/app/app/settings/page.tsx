'use client';

import { useState, useEffect } from 'react';
import { Settings, Shield, Clock, Bell, CheckCircle2 } from 'lucide-react';

export default function TenantSettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [settings, setSettings] = useState({
    businessName: 'Apex Dental Care',
    notificationEmail: 'alerts@apexdental.com',
    timezone: 'America/New_York',
    retentionDays: 90,
    recordCalls: true,
    autoTranscribe: true,
    aiSummaryEnabled: true,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 600);
  };

  return (
    <div style={{ maxWidth: '850px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="title-xl">Workspace Settings</h1>
        <p className="text-body" style={{ marginTop: '4px' }}>
          Configure retention policies, recording preferences, and organization defaults.
        </p>
      </div>

      {saved && (
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
          <CheckCircle2 size={16} /> Organization settings updated successfully!
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Organization Info */}
        <div className="card">
          <h2 className="title-md" style={{ marginBottom: '16px' }}>Organization Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Business Name</label>
              <input
                type="text"
                className="form-control"
                value={settings.businessName}
                onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notification Email</label>
              <input
                type="email"
                className="form-control"
                value={settings.notificationEmail}
                onChange={(e) => setSettings({ ...settings, notificationEmail: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Default Timezone</label>
              <select
                className="form-control"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              >
                <option value="America/New_York">Eastern Time (US & Canada)</option>
                <option value="America/Chicago">Central Time (US & Canada)</option>
                <option value="America/Denver">Mountain Time (US & Canada)</option>
                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Data Retention (Days)</label>
              <select
                className="form-control"
                value={settings.retentionDays}
                onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) })}
              >
                <option value={30}>30 Days</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days (Recommended)</option>
                <option value={180}>180 Days</option>
                <option value={365}>365 Days (1 Year)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Call Intelligence Options */}
        <div className="card">
          <h2 className="title-md" style={{ marginBottom: '16px' }}>Call Intelligence & Compliance</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.recordCalls}
                onChange={(e) => setSettings({ ...settings, recordCalls: e.target.checked })}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Enable Call Audio Recording</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Stores audio recordings securely on LiveKit S3 storage in accordance with regional consent laws.
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.autoTranscribe}
                onChange={(e) => setSettings({ ...settings, autoTranscribe: e.target.checked })}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Automated Speech Transcription</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Realtime Deepgram speech-to-text transcript generation with millisecond offsets.
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.aiSummaryEnabled}
                onChange={(e) => setSettings({ ...settings, aiSummaryEnabled: e.target.checked })}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '13.5px' }}>AI Summary & Sentiment Extraction</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Generates an executive briefing and outcome tags after each call ends.
                </div>
              </div>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Workspace Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
