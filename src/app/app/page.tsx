'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PhoneCall,
  Clock,
  Calendar,
  CheckCircle2,
  Radio,
  ArrowRight,
  User,
  Volume2,
  Sparkles,
  Play
} from 'lucide-react';

export default function ClientOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/app/overview')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
        <span className="pulse-dot"></span> Loading workspace telemetry...
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const usage = data?.usage || {};
  const agents = data?.agents || [];
  const recentCalls = data?.recentCalls || [];

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 className="title-xl">Workspace Dashboard</h1>
          <p className="text-body" style={{ marginTop: '4px' }}>
            Realtime call analytics, voice agent dispatching, and appointment conversions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/app/appointments" className="btn btn-secondary btn-sm">
            <Calendar size={14} /> View Appointments
          </Link>
          <Link href="/app/agents" className="btn btn-primary btn-sm">
            + New Voice Agent
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: '32px' }}>
        <div className="stat-card">
          <div className="stat-label">Calls Today</div>
          <div className="stat-value">{metrics.callsToday ?? 0}</div>
          <div className="stat-meta" style={{ color: '#34d399' }}>
            {metrics.callsThisWeek ?? 0} total calls this week
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Voice Minutes Used</div>
          <div className="stat-value">{metrics.minutesUsed ?? 0}</div>
          <div className="stat-meta" style={{ color: 'var(--text-secondary)' }}>
            Quota: {metrics.minutesLimit} min ({usage.voice?.remaining ?? 0} remaining)
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Upcoming Appointments</div>
          <div className="stat-value">{metrics.upcomingAppointments ?? 0}</div>
          <div className="stat-meta" style={{ color: '#38bdf8' }}>
            Auto-booked by Voice Agents
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">AI Resolution Rate</div>
          <div className="stat-value" style={{ color: '#34d399' }}>
            {metrics.resolutionRate ?? 94}%
          </div>
          <div className="stat-meta" style={{ color: 'var(--text-muted)' }}>
            Successfully resolved or booked
          </div>
        </div>
      </div>

      {/* Two Column Layout: Voice Agents & Recent Calls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px' }}>
        {/* Active Agents Column */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="title-md">Voice Agents</h2>
              <div className="text-xs">Live conversational workers</div>
            </div>
            <Link href="/app/agents" className="btn btn-outline btn-sm">
              All Agents <ArrowRight size={13} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {agents.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active voice agents yet. Create one to begin answering calls.
              </div>
            ) : (
              agents.map((agent: any) => (
                <div
                  key={agent.id}
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>{agent.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {agent.type?.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <span className={`badge ${agent.status === 'ACTIVE' ? 'badge-active' : 'badge-paused'}`}>
                      <span className="pulse-dot"></span> {agent.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Version: v{agent.versions[0]?.versionNumber || 1}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link href={`/app/agents/${agent.id}/test`} className="btn btn-primary btn-sm" style={{ padding: '4px 10px', fontSize: '12px' }}>
                        <Play size={11} /> Test Voice
                      </Link>
                      <Link href={`/app/agents/${agent.id}`} className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '12px' }}>
                        Configure
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Calls Column */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="title-md">Recent Live Calls</h2>
              <div className="text-xs">Incoming and simulated voice sessions</div>
            </div>
            <Link href="/app/calls" className="btn btn-outline btn-sm">
              Call Log <ArrowRight size={13} />
            </Link>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Caller / Contact</th>
                  <th>Agent</th>
                  <th>Duration</th>
                  <th>Intent</th>
                  <th>Outcome</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No calls recorded yet. Use the Test Voice Sandbox to simulate your first live call!
                    </td>
                  </tr>
                ) : (
                  recentCalls.map((call: any) => (
                    <tr key={call.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{call.callerName || 'Unknown Caller'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {call.callerNumber}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{call.agent?.name || 'Chloe'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {Math.floor(call.durationSeconds / 60)}m {call.durationSeconds % 60}s
                      </td>
                      <td style={{ fontSize: '12.5px' }}>{call.intent || 'General Inquiry'}</td>
                      <td>
                        <span className={`badge ${
                          call.outcome === 'APPOINTMENT_BOOKED'
                            ? 'badge-active'
                            : call.outcome === 'TRANSFERRED'
                            ? 'badge-paused'
                            : 'badge-primary'
                        }`}>
                          {call.outcome?.replace(/_/g, ' ') || 'Completed'}
                        </span>
                      </td>
                      <td>
                        <Link href={`/app/calls/${call.id}`} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '12px' }}>
                          Transcript
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
