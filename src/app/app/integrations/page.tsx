'use client';

import { useState, useEffect } from 'react';
import { Puzzle, CheckCircle2, Calendar, Phone, Webhook, Database } from 'lucide-react';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = () => {
    setLoading(true);
    fetch('/api/app/integrations')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setIntegrations(data.data.integrations || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const toggleIntegration = async (provider: string, name: string, isConnected: boolean) => {
    await fetch('/api/app/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        name,
        action: isConnected ? 'DISCONNECT' : 'CONNECT',
      }),
    });
    fetchIntegrations();
  };

  const connectors = [
    {
      provider: 'GOOGLE_CALENDAR',
      name: 'Google Calendar',
      description: 'Synchronize availability and insert booked appointments directly into your clinic calendar.',
      icon: Calendar,
    },
    {
      provider: 'MS_CALENDAR',
      name: 'Microsoft Outlook Calendar',
      description: 'Office 365 / Outlook calendar integration for business scheduling.',
      icon: Calendar,
    },
    {
      provider: 'HUBSPOT',
      name: 'HubSpot CRM',
      description: 'Sync caller contacts, call durations, and call recordings into HubSpot deals.',
      icon: Database,
    },
    {
      provider: 'TWILIO',
      name: 'Twilio Voice Trunk',
      description: 'PSTN phone number termination and SIP trunking for LiveKit realtime execution.',
      icon: Phone,
    },
    {
      provider: 'WEBHOOK',
      name: 'Custom Webhooks',
      description: 'Realtime JSON payloads dispatched on call.completed and appointment.created events.',
      icon: Webhook,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="title-xl">Integrations Marketplace</h1>
        <p className="text-body" style={{ marginTop: '4px' }}>
          Connect your voice agents to external calendars, telephony providers, and CRMs.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {connectors.map((c) => {
          const isConnected = integrations.some((i) => i.provider === c.provider && i.status === 'CONNECTED');
          const Icon = c.icon;

          return (
            <div key={c.provider} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(99, 102, 241, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#818cf8'
                    }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="title-sm">{c.name}</h3>
                      <span className={`badge ${isConnected ? 'badge-active' : 'badge-draft'}`} style={{ marginTop: '4px' }}>
                        {isConnected ? 'Connected & Active' : 'Not Connected'}
                      </span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                  {c.description}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => toggleIntegration(c.provider, c.name, isConnected)}
                  className={`btn btn-sm ${isConnected ? 'btn-danger' : 'btn-primary'}`}
                >
                  {isConnected ? 'Disconnect Integration' : 'Connect Integration'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
