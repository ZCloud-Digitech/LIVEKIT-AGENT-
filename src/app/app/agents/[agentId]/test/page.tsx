'use client';

import { useState, useEffect, useRef, use } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import Link from 'next/link';
import {
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Play,
  Activity,
  CheckCircle2,
  Wrench,
  Clock,
  Sparkles,
  ArrowLeft,
  Volume2,
  Send,
  Lock
} from 'lucide-react';

interface TranscriptItem {
  speaker: 'AGENT' | 'CUSTOMER' | 'SYSTEM';
  message: string;
  toolInvocation?: string;
  toolResult?: string;
  latencyMs?: number;
  timestamp: string;
}

export default function AgentTestWorkbenchPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);
  const [agent, setAgent] = useState<any>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [userInput, setUserInput] = useState('');
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [savingCall, setSavingCall] = useState(false);
  const timerRef = useRef<any>(null);
  const roomRef = useRef<Room | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/app/agents/${agentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAgent(data.data.agent);
      });
  }, [agentId]);

  useEffect(() => {
    if (sessionActive) {
      timerRef.current = setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [sessionActive]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  const startSession = async () => {
    try {
      const res = await fetch(`/api/app/agents/${agentId}/livekit-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTestSession: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error?.message || 'Failed to start realtime session.');
        return;
      }

      setTokenData(data.data);
      setSessionActive(true);
      setMicActive(true);
      setSessionDuration(0);

      const greetingText =
        agent?.currentVersion?.greeting ||
        "Hello! Thank you for calling. I'm your AI voice assistant. How can I assist you today?";

      setTranscripts([
        {
          speaker: 'SYSTEM',
          message: `LiveKit WebRTC session connected. Room: ${data.data.roomName}`,
          timestamp: new Date().toLocaleTimeString(),
        },
        {
          speaker: 'AGENT',
          message: greetingText,
          latencyMs: 140,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      // Connect to LiveKit Room via livekit-client
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          audioElement.id = 'livekit-agent-remote-audio';
          document.body.appendChild(audioElement);
          setAgentSpeaking(true);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
        setAgentSpeaking(false);
      });

      room.on(RoomEvent.Disconnected, () => {
        setSessionActive(false);
        setMicActive(false);
      });

      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant: any) => {
        try {
          const str = new TextDecoder().decode(payload);
          const parsed = JSON.parse(str);
          if (parsed.type === 'transcript') {
            setTranscripts((prev) => [
              ...prev,
              {
                speaker: parsed.speaker || 'AGENT',
                message: parsed.message || '',
                toolInvocation: parsed.toolInvocation,
                toolResult: parsed.toolResult,
                latencyMs: parsed.latencyMs,
                timestamp: parsed.timestamp || new Date().toLocaleTimeString(),
              },
            ]);
          }
        } catch {
          // ignore non-json data
        }
      });

      await room.connect(data.data.wsUrl, data.data.token);

      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch (micErr) {
        console.warn('Microphone unavailable or permission denied:', micErr);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const endSession = async () => {
    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch (err) {
        console.warn('LiveKit disconnect error:', err);
      }
      roomRef.current = null;
    }
    const oldAudio = document.getElementById('livekit-agent-remote-audio');
    if (oldAudio) oldAudio.remove();
    setSessionActive(false);
    setMicActive(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.onstart = () => setAgentSpeaking(true);
      utterance.onend = () => setAgentSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || !sessionActive) return;

    const userText = userInput.trim();
    setUserInput('');

    // Add customer speech
    setTranscripts((prev) => [
      ...prev,
      {
        speaker: 'CUSTOMER',
        message: userText,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    // Send over LiveKit Data Channel if room connected
    if (roomRef.current && roomRef.current.state === 'connected') {
      try {
        const payload = new TextEncoder().encode(userText);
        await roomRef.current.localParticipant.publishData(payload, { reliable: true });
      } catch (sendErr) {
        console.warn('Failed to publish data message to LiveKit room:', sendErr);
      }
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link href={`/app/agents/${agentId}`} className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} /> Agent Editor
          </Link>
          <div>
            <h1 className="title-lg">Voice Agent Test Workbench</h1>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              Testing agent: <strong>{agent?.name}</strong> • LiveKit Realtime Audio Bridge
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {!sessionActive ? (
            <button
              type="button"
              onClick={startSession}
              className="btn btn-primary"
              style={{ gap: '8px', background: 'linear-gradient(135deg, #4f46e5, #06b6d4)' }}
            >
              <Play size={15} /> Start Realtime Test Session
            </button>
          ) : (
            <button
              type="button"
              onClick={endSession}
              className="btn btn-danger"
              style={{ gap: '8px' }}
              disabled={savingCall}
            >
              <PhoneOff size={15} /> {savingCall ? 'Saving Call Record...' : 'End Test Session'}
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px' }}>
        {/* Left Column: Live Audio Stage & Realtime Transcript */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Audio Waveform Stage */}
          <div className="card" style={{
            background: 'linear-gradient(180deg, rgba(15, 22, 36, 0.95) 0%, rgba(8, 12, 20, 0.95) 100%)',
            padding: '28px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`pulse-dot ${sessionActive ? '' : 'style-paused'}`} style={{ background: sessionActive ? 'var(--accent-emerald)' : 'var(--text-muted)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  {sessionActive ? (agentSpeaking ? 'Agent Speaking (TTS)' : 'Listening for Caller') : 'Session Inactive'}
                </span>
              </div>

              {sessionActive && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#38bdf8' }}>
                  {Math.floor(sessionDuration / 60).toString().padStart(2, '0')}:{(sessionDuration % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>

            {/* Waveform Visualization */}
            <div style={{
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              margin: '20px 0'
            }}>
              {Array.from({ length: 32 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '5px',
                    height: sessionActive
                      ? `${Math.max(8, Math.sin((i + sessionDuration * 4) * 0.5) * (agentSpeaking ? 55 : 20) + 30)}px`
                      : '6px',
                    background: agentSpeaking ? 'var(--accent-cyan)' : sessionActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    transition: 'height 0.1s ease',
                    boxShadow: sessionActive ? (agentSpeaking ? '0 0 10px rgba(6, 182, 212, 0.5)' : '0 0 8px rgba(99, 102, 241, 0.4)') : 'none',
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '10px' }}>
              <div className="badge badge-active">
                <Volume2 size={13} /> {agent?.currentVersion?.voiceProvider || 'Cartesia'} Synthesizer
              </div>
              <div className="badge badge-primary">
                <Clock size={13} /> Latency: 210ms
              </div>
            </div>
          </div>

          {/* Transcript Timeline Feed */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '480px' }}>
            <div className="card-header" style={{ marginBottom: '12px' }}>
              <div>
                <h3 className="title-sm">Realtime Conversation Feed</h3>
                <div className="text-xs">Live speaker diarization and function calls</div>
              </div>
            </div>

            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                paddingRight: '6px',
                marginBottom: '16px'
              }}
            >
              {transcripts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Click "Start Realtime Test Session" to begin testing the voice agent with live audio speech recognition.
                </div>
              ) : (
                transcripts.map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: t.speaker === 'CUSTOMER' ? 'flex-end' : t.speaker === 'SYSTEM' ? 'center' : 'flex-start',
                    }}
                  >
                    {t.speaker === 'SYSTEM' ? (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>
                        {t.message}
                      </div>
                    ) : (
                      <div style={{ maxWidth: '85%' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11.5px',
                          color: 'var(--text-muted)',
                          marginBottom: '4px',
                          justifyContent: t.speaker === 'CUSTOMER' ? 'flex-end' : 'flex-start'
                        }}>
                          <span style={{ fontWeight: 600, color: t.speaker === 'AGENT' ? '#818cf8' : '#38bdf8' }}>
                            {t.speaker === 'AGENT' ? agent?.name || 'Agent' : 'Caller'}
                          </span>
                          <span>• {t.timestamp}</span>
                          {t.latencyMs && (
                            <span style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                              ({t.latencyMs}ms)
                            </span>
                          )}
                        </div>

                        <div style={{
                          background: t.speaker === 'CUSTOMER' ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                          color: t.speaker === 'CUSTOMER' ? '#fff' : 'var(--text-primary)',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '13.5px',
                          lineHeight: 1.4,
                          border: t.speaker === 'AGENT' ? '1px solid var(--border-default)' : 'none'
                        }}>
                          {t.message}
                        </div>

                        {/* Tool Call Notification pill */}
                        {t.toolInvocation && (
                          <div style={{
                            marginTop: '6px',
                            background: 'rgba(6, 182, 212, 0.08)',
                            border: '1px solid rgba(6, 182, 212, 0.25)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 10px',
                            fontSize: '11.5px',
                            color: '#67e8f9',
                            fontFamily: 'var(--font-mono)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                              <Wrench size={11} /> TOOL: {t.toolInvocation}
                            </div>
                            {t.toolResult && (
                              <div style={{ color: 'var(--text-secondary)' }}>
                                RESULT: {t.toolResult}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Input bar for simulated speech typing */}
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-control"
                placeholder={sessionActive ? "Type or speak to the agent (e.g. 'I'd like to book an appointment tomorrow')..." : "Start session first to speak..."}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={!sessionActive}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!sessionActive || !userInput.trim()}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: LiveKit Boundary & Runtime Metadata Inspector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Server-Side LiveKit Token Boundary Inspector */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="title-sm">LiveKit Security Boundary</h3>
                <div className="text-xs">Server-signed WebRTC tokens</div>
              </div>
              <span className="badge badge-active">
                <Lock size={11} /> Server Encrypted
              </span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p>
                In strict adherence to product principle #9, LiveKit credentials and API secrets are never exposed to the client.
                The backend signs session tokens on-demand with attached tenant metadata.
              </p>

              {tokenData ? (
                <div style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '11.5px',
                  fontFamily: 'var(--font-mono)'
                }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Room:</span> {tokenData.roomName}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Endpoint:</span> {tokenData.wsUrl}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Session ID:</span> {tokenData.sessionId}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Environment:</span> {tokenData.metadata?.environment}</div>
                  <div style={{
                    marginTop: '6px',
                    padding: '6px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '4px',
                    wordBreak: 'break-all',
                    color: 'var(--text-muted)',
                    fontSize: '10.5px'
                  }}>
                    {tokenData.token.substring(0, 45)}...[SIGNED_JWT]
                  </div>
                </div>
              ) : (
                <div style={{ padding: '16px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Start session to view negotiated room metadata and LiveKit token parameters.
                </div>
              )}
            </div>
          </div>

          {/* Quick Simulation Prompts */}
          <div className="card">
            <h3 className="title-sm" style={{ marginBottom: '12px' }}>Test Conversation Prompts</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: '12px' }}
                disabled={!sessionActive}
                onClick={() => {
                  setUserInput("Hi Chloe, I want to book an appointment for tomorrow morning.");
                }}
              >
                1. "I want to book an appointment for tomorrow morning."
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: '12px' }}
                disabled={!sessionActive}
                onClick={() => {
                  setUserInput("Yes, 10:30 AM is perfect for me. Please confirm it.");
                }}
              >
                2. "Yes, 10:30 AM is perfect for me. Please confirm it."
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: '12px' }}
                disabled={!sessionActive}
                onClick={() => {
                  setUserInput("What are your clinic business hours and do you accept Delta Dental?");
                }}
              >
                3. "What are your business hours and do you take Delta Dental?"
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
