'use client';

import { useState, useEffect } from 'react';
import { History, Shield, RefreshCw } from 'lucide-react';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = () => {
    setLoading(true);
    fetch('/api/admin/audit-logs')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setLogs(data.data.logs || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 className="title-xl">Immutable Audit Trail</h1>
          <p className="text-body" style={{ marginTop: '4px' }}>
            Comprehensive log of administrative operations, agent updates, tenant creations, and support mode sessions.
          </p>
        </div>
        <button type="button" onClick={fetchLogs} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
          <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} /> Refresh
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor & Context</th>
              <th>Action Type</th>
              <th>Resource</th>
              <th>IP Address</th>
              <th>Payload / Changes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading audit stream...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No audit logs recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{log.actorEmail}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.actorType}</div>
                  </td>
                  <td>
                    <span className="badge badge-primary">{log.action}</span>
                  </td>
                  <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                    {log.resource}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {log.ipAddress || '127.0.0.1'}
                  </td>
                  <td>
                    <pre style={{
                      margin: 0,
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-xs)',
                      maxWidth: '300px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {log.changes}
                    </pre>
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
