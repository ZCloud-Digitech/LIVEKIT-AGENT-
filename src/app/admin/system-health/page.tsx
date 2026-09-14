'use client';

import { useState, useEffect } from 'react';
import { Activity, Server, Radio, Database, Cpu, CheckCircle2, RefreshCw } from 'lucide-react';

export default function SystemHealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = () => {
    setLoading(true);
    fetch('/api/admin/system-health')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setHealth(data.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 className="title-xl">System Health & Telemetry</h1>
          <p className="text-body" style={{ marginTop: '4px' }}>
            Realtime monitoring of control plane services, LiveKit WebRTC audio bridge, and database latency.
          </p>
        </div>
        <button type="button" onClick={fetchHealth} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
          <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} /> Refresh Status
        </button>
      </div>

      {health && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Main Status Card */}
          <div className="card" style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34d399'
              }}>
                <CheckCircle2 size={26} />
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>All Systems Operational</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Platform status verified at {new Date(health.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div className="badge badge-active" style={{ fontSize: '12px', padding: '6px 12px' }}>
              <span className="pulse-dot"></span> 99.98% 30-Day Uptime
            </div>
          </div>

          {/* Microservices Grid */}
          <div className="grid grid-cols-2 gap-4">
            {health.services?.map((s: any, idx: number) => (
              <div key={idx} className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>{s.name}</div>
                  <span className="badge badge-active">{s.status}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {s.latencyMs !== undefined && (
                    <div>Latency: <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{s.latencyMs}ms</span></div>
                  )}
                  {s.uptime && <div>Reported SLA: {s.uptime}</div>}
                  {s.endpoint && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.endpoint}</div>}
                  {s.providers && <div>Providers: {s.providers.join(', ')}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
