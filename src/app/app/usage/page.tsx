'use client';

import { useState, useEffect } from 'react';
import { Gauge, AlertTriangle, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

export default function UsagePage() {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/app/usage')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUsage(data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Calculating real usage telemetry...</div>;
  }

  const voice = usage?.voice || {};
  const agents = usage?.agents || {};
  const users = usage?.users || {};
  const numbers = usage?.phoneNumbers || {};
  const storage = usage?.storage || {};

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="title-xl">Usage & Entitlement Quotas</h1>
        <p className="text-body" style={{ marginTop: '4px' }}>
          Server-side enforced quota limits and telemetry for the active billing cycle.
        </p>
      </div>

      {/* Threshold Alert if >= 70% */}
      {voice.thresholdAlert && (
        <div style={{
          background: voice.percentage >= 95 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
          border: `1px solid ${voice.percentage >= 95 ? 'rgba(244, 63, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '28px',
          color: voice.percentage >= 95 ? '#fb7185' : '#fbbf24'
        }}>
          <AlertTriangle size={20} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>
              Voice Quota Warning: {voice.percentage}% of monthly minutes consumed ({voice.used} / {voice.limit} min)
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Limits are enforced on the backend. Calls will be rejected once 100% capacity is reached.
            </div>
          </div>
        </div>
      )}

      {/* Main Quotas Grid */}
      <div className="grid grid-cols-2 gap-6" style={{ marginBottom: '32px' }}>
        {/* Voice Minutes Meter */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 className="title-md">Voice Minutes</h2>
              <div className="text-xs">Realtime LiveKit audio execution time</div>
            </div>
            <span className={`badge ${voice.percentage > 85 ? 'badge-paused' : 'badge-active'}`}>
              {voice.percentage}% Used
            </span>
          </div>

          <div style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            {voice.used} <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>/ {voice.limit} min</span>
          </div>

          {/* Progress Bar */}
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{
              width: `${voice.percentage}%`,
              height: '100%',
              background: voice.percentage >= 95 ? 'var(--accent-rose)' : voice.percentage >= 70 ? 'var(--accent-amber)' : 'linear-gradient(90deg, #4f46e5, #06b6d4)',
              transition: 'width 0.4s ease'
            }} />
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Remaining: <strong>{voice.remaining} min</strong></span>
            <span>Resets on 1st of month</span>
          </div>
        </div>

        {/* Voice Agents Meter */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 className="title-md">Active Voice Agents</h2>
              <div className="text-xs">Concurrent AI assistants configured</div>
            </div>
            <span className="badge badge-active">{agents.percentage}% Used</span>
          </div>

          <div style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            {agents.used} <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>/ {agents.limit} max</span>
          </div>

          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{
              width: `${agents.percentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #10b981, #06b6d4)',
            }} />
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Capacity remaining: <strong>{Math.max(0, agents.limit - agents.used)} agents</strong>
          </div>
        </div>

        {/* Team Members Meter */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 className="title-md">Team Seats</h2>
              <div className="text-xs">Authorized tenant members</div>
            </div>
            <span className="badge badge-primary">{users.percentage}% Used</span>
          </div>

          <div style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            {users.used} <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>/ {users.limit} seats</span>
          </div>

          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{
              width: `${users.percentage}%`,
              height: '100%',
              background: '#818cf8',
            }} />
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Available seats: <strong>{Math.max(0, users.limit - users.used)} seats</strong>
          </div>
        </div>

        {/* Dedicated Numbers Meter */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 className="title-md">Phone Numbers</h2>
              <div className="text-xs">Twilio / Telephony Inbound Trunks</div>
            </div>
            <span className="badge badge-active">{numbers.percentage}% Used</span>
          </div>

          <div style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            {numbers.used} <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>/ {numbers.limit} numbers</span>
          </div>

          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{
              width: `${numbers.percentage}%`,
              height: '100%',
              background: '#06b6d4',
            }} />
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Available lines: <strong>{Math.max(0, numbers.limit - numbers.used)} numbers</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
