'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, PhoneCall, Calendar, Clock, ArrowRight, Play } from 'lucide-react';

export default function ClientCallsPage() {
  const [calls, setCalls] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCalls = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (outcomeFilter) query.set('outcome', outcomeFilter);

    fetch(`/api/app/calls?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCalls(data.data.calls || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCalls();
  }, [outcomeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCalls();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 className="title-xl">Call Logs & Transcripts</h1>
          <p className="text-body" style={{ marginTop: '4px' }}>
            Browse call history, review AI transcripts, inspect tool executions, and audit voice agent outcomes.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '38px' }}
              placeholder="Search by caller name, number, or intent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ width: '200px' }}>
            <select
              className="form-control"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
            >
              <option value="">All Call Outcomes</option>
              <option value="APPOINTMENT_BOOKED">Appointment Booked</option>
              <option value="RESOLVED">Resolved by AI</option>
              <option value="TRANSFERRED">Transferred to Human</option>
              <option value="VOICEMAIL">Voicemail</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary">
            Filter
          </button>
        </form>
      </div>

      {/* Calls Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Caller / Phone</th>
              <th>Agent Handled</th>
              <th>Timestamp</th>
              <th>Duration</th>
              <th>Detected Intent</th>
              <th>Outcome</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading call records...
                </td>
              </tr>
            ) : calls.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No calls recorded yet. You can simulate calls in the Voice Agent Test Workbench!
                </td>
              </tr>
            ) : (
              calls.map((call) => (
                <tr key={call.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{call.callerName || 'Unknown Caller'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {call.callerNumber}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{call.agent?.name || 'Chloe'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(call.startedAt).toLocaleString()}
                  </td>
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
                    <Link href={`/app/calls/${call.id}`} className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '12px' }}>
                      Inspect Transcript
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
