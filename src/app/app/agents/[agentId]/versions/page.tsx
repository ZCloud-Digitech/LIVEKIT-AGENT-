'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, History, RotateCcw, CheckCircle2 } from 'lucide-react';

export default function AgentVersionsPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rollingBack, setRollingBack] = useState<number | null>(null);

  const fetchAgent = () => {
    setLoading(true);
    fetch(`/api/app/agents/${agentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAgent(data.data.agent);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAgent();
  }, [agentId]);

  const handleRollback = async (versionNumber: number) => {
    if (!confirm(`Are you sure you want to rollback to configuration v${versionNumber}?`)) return;
    setRollingBack(versionNumber);

    try {
      const res = await fetch(`/api/app/agents/${agentId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetVersionNumber: versionNumber }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error?.message || 'Rollback failed.');
      } else {
        alert(`Successfully rolled back to v${versionNumber}!`);
        fetchAgent();
      }
    } finally {
      setRollingBack(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading version tree...</div>;
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href={`/app/agents/${agentId}`} className="btn btn-secondary btn-sm" style={{ marginBottom: '16px' }}>
          <ArrowLeft size={14} /> Back to Agent Editor
        </Link>
        <h1 className="title-lg">Version History: {agent?.name}</h1>
        <p className="text-body" style={{ marginTop: '4px' }}>
          Inspect configuration snapshots, see published production releases, and trigger instant one-click rollback.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {agent?.versions?.map((ver: any) => (
          <div
            key={ver.id}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderLeft: ver.isPublished ? '4px solid var(--accent-emerald)' : '1px solid var(--border-default)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>v{ver.versionNumber}</span>
                {ver.isPublished && (
                  <span className="badge badge-active">
                    <CheckCircle2 size={12} /> Active Production
                  </span>
                )}
              </div>

              <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                {ver.changeSummary || 'Configuration snapshot'}
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '16px' }}>
                <div>Created: {new Date(ver.createdAt).toLocaleString()}</div>
                <div>Model: <span style={{ color: 'var(--text-secondary)' }}>{ver.aiModel}</span></div>
                <div>Voice: <span style={{ color: 'var(--text-secondary)' }}>{ver.voiceProvider} ({ver.voiceId})</span></div>
              </div>
            </div>

            <div>
              {!ver.isPublished && (
                <button
                  type="button"
                  onClick={() => handleRollback(ver.versionNumber)}
                  className="btn btn-secondary btn-sm"
                  disabled={rollingBack === ver.versionNumber}
                >
                  <RotateCcw size={13} /> {rollingBack === ver.versionNumber ? 'Rolling back...' : 'Rollback to this'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
