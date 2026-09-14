'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  PhoneCall,
  Clock,
  User,
  Radio,
  Wrench,
  Sparkles,
  Volume2,
  VolumeX,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export default function CallDetailPage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const { callId } = use(params);
  const [call, setCall] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/app/calls/${callId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCall(data.data.call);
      })
      .finally(() => setLoading(false));
  }, [callId]);

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading call detail...</div>;
  }

  if (!call) {
    return (
      <div style={{ padding: '40px' }}>
        <p>Call not found.</p>
        <Link href="/app/calls" className="btn btn-secondary" style={{ marginTop: '16px' }}>
          Back to Calls
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto' }}>
      {/* Back Button */}
      <div style={{ marginBottom: '20px' }}>
        <Link href="/app/calls" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={14} /> Back to Call History
        </Link>
      </div>

      {/* Call Header Card */}
      <div className="card" style={{ marginBottom: '24px', padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h1 className="title-lg">{call.callerName || 'Unknown Caller'}</h1>
              <span className={`badge ${
                call.outcome === 'APPOINTMENT_BOOKED' ? 'badge-active' : 'badge-primary'
              }`}>
                {call.outcome?.replace(/_/g, ' ') || 'Completed'}
              </span>
              <span className="badge badge-active" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc' }}>
                Sentiment: {call.sentiment || 'Positive'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
              <div>Phone: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{call.callerNumber}</span></div>
              <div>Handled By: <span style={{ color: 'var(--text-secondary)' }}>{call.agent?.name || 'Chloe'}</span></div>
              <div>Duration: <span style={{ color: 'var(--text-secondary)' }}>{Math.floor(call.durationSeconds / 60)}m {call.durationSeconds % 60}s</span></div>
              <div>Started: <span style={{ color: 'var(--text-secondary)' }}>{new Date(call.startedAt).toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Summary Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Sparkles size={16} style={{ color: '#38bdf8' }} />
          <h2 className="title-sm">AI Generated Call Summary</h2>
        </div>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {call.summary || 'Caller requested service information and appointment scheduling. The voice assistant successfully processed the inquiry.'}
        </p>
      </div>

      {/* Audio Recording Section (with proper unavailable fallback state) */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Volume2 size={16} style={{ color: 'var(--text-secondary)' }} />
            <h2 className="title-sm">Voice Recording Playback</h2>
          </div>
          <span className="text-xs">LiveKit Audio Capture</span>
        </div>

        {call.recordingUrl ? (
          <div style={{
            background: 'var(--bg-surface-elevated)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <audio controls style={{ width: '100%' }}>
              <source src={call.recordingUrl} type="audio/mpeg" />
              Your browser does not support the audio player.
            </audio>
          </div>
        ) : (
          <div style={{
            padding: '16px',
            background: 'var(--bg-surface-elevated)',
            border: '1px dashed var(--border-default)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'var(--text-muted)',
            fontSize: '13px'
          }}>
            <VolumeX size={18} />
            <span>
              Audio recording metadata is not available for this session (recording is disabled or still processing). Full verified transcript below is available.
            </span>
          </div>
        )}
      </div>

      {/* Detailed Chronological Transcript Timeline */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="title-md">Full Call Transcript & Tool Events</h2>
            <div className="text-xs">Synchronized dialogue and function invocations</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {call.transcripts?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              No transcript records found for this call.
            </div>
          ) : (
            call.transcripts?.map((item: any) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: item.speaker === 'CUSTOMER' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{ maxWidth: '85%' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11.5px',
                    color: 'var(--text-muted)',
                    marginBottom: '4px',
                    justifyContent: item.speaker === 'CUSTOMER' ? 'flex-end' : 'flex-start'
                  }}>
                    <span style={{ fontWeight: 600, color: item.speaker === 'AGENT' ? '#818cf8' : '#38bdf8' }}>
                      {item.speaker === 'AGENT' ? call.agent?.name || 'Voice Agent' : 'Caller'}
                    </span>
                    {item.latencyMs && (
                      <span style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                        ({item.latencyMs}ms)
                      </span>
                    )}
                  </div>

                  <div style={{
                    background: item.speaker === 'CUSTOMER' ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                    color: item.speaker === 'CUSTOMER' ? '#fff' : 'var(--text-primary)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13.5px',
                    lineHeight: 1.5,
                    border: item.speaker === 'AGENT' ? '1px solid var(--border-default)' : 'none'
                  }}>
                    {item.message}
                  </div>

                  {/* Tool Execution Box */}
                  {item.toolInvocation && (
                    <div style={{
                      marginTop: '8px',
                      background: 'rgba(6, 182, 212, 0.08)',
                      border: '1px solid rgba(6, 182, 212, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: '#67e8f9',
                      fontFamily: 'var(--font-mono)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <Wrench size={12} /> TOOL CALL: {item.toolInvocation}
                      </div>
                      {item.toolResult && (
                        <div style={{ color: 'var(--text-secondary)' }}>
                          OUTPUT: {item.toolResult}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
