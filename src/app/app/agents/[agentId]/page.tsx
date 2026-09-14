'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Rocket,
  Play,
  History,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Volume2,
  Cpu,
  Clock,
  PhoneForwarded,
  Wrench
} from 'lucide-react';

export default function AgentConfigurationPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);
  const router = useRouter();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [config, setConfig] = useState<any>({
    name: '',
    greeting: '',
    closingMessage: '',
    prompt: '',
    systemInstructions: '',
    personality: 'warm, empathetic, professional',
    tone: 'friendly',
    voiceProvider: 'Cartesia',
    voiceId: 'sonic-english-female',
    voiceLanguage: 'en-US',
    voiceSpeed: 1.0,
    aiModel: 'gpt-4o-mini',
    temperature: 0.6,
    maxTokens: 400,
    silenceTimeoutMs: 2000,
    greetingTimeoutMs: 4000,
    maxDurationSeconds: 600,
    fallbackBehavior: 'transfer_to_human',
    changeSummary: 'Configuration adjustments',
    businessHours: {
      enabled: true,
      timezone: 'America/New_York',
      afterHoursAction: 'take_message_or_emergency_transfer',
    },
    transferRules: {
      primaryNumber: '+1 (555) 234-9999',
      fallbackNumber: '+1 (555) 234-8888',
      timeoutSeconds: 25,
      handoffMessage: 'Please hold while I connect you to a staff member.',
    },
    tools: {
      check_availability: true,
      book_appointment: true,
      reschedule_appointment: true,
      cancel_appointment: true,
      transfer_call: true,
    },
  });

  const fetchAgent = () => {
    setLoading(true);
    fetch(`/api/app/agents/${agentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.agent) {
          const a = data.data.agent;
          setAgent(a);
          const current = a.currentVersion || {};
          let parsedTools = {};
          try {
            parsedTools = typeof current.toolsConfigJson === 'string' ? JSON.parse(current.toolsConfigJson) : current.toolsConfigJson || {};
          } catch (e) {}

          setConfig({
            name: a.name || '',
            greeting: current.greeting || '',
            closingMessage: current.closingMessage || '',
            prompt: current.prompt || '',
            systemInstructions: current.systemInstructions || '',
            personality: current.personality || 'warm, empathetic, professional',
            tone: current.tone || 'friendly',
            voiceProvider: current.voiceProvider || 'Cartesia',
            voiceId: current.voiceId || 'sonic-english-female',
            voiceLanguage: current.voiceLanguage || 'en-US',
            voiceSpeed: current.voiceSpeed || 1.0,
            aiModel: current.aiModel || 'gpt-4o-mini',
            temperature: current.temperature || 0.6,
            maxTokens: current.maxTokens || 400,
            silenceTimeoutMs: current.silenceTimeoutMs || 2000,
            greetingTimeoutMs: current.greetingTimeoutMs || 4000,
            maxDurationSeconds: current.maxDurationSeconds || 600,
            fallbackBehavior: current.fallbackBehavior || 'transfer_to_human',
            changeSummary: `Update version from v${current.versionNumber || 1}`,
            businessHours: {
              enabled: true,
              timezone: 'America/New_York',
              afterHoursAction: 'take_message_or_emergency_transfer',
            },
            transferRules: {
              primaryNumber: '+1 (555) 234-9999',
              fallbackNumber: '+1 (555) 234-8888',
              timeoutSeconds: 25,
              handoffMessage: 'Please hold while I connect you to a staff member.',
            },
            tools: {
              check_availability: true,
              book_appointment: true,
              reschedule_appointment: true,
              cancel_appointment: true,
              transfer_call: true,
              ...parsedTools,
            },
          });
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAgent();
  }, [agentId]);

  const handleSaveDraft = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/app/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to save configuration.');
      }
      setMessage({ text: 'Draft configuration version created successfully!', type: 'success' });
      fetchAgent();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!agent?.currentVersion?.id) return;
    setPublishing(true);
    setMessage(null);
    try {
      // First save latest config draft
      const patchRes = await fetch(`/api/app/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const patchData = await patchRes.json();
      const newVersionId = patchData.data?.agent?.currentVersion?.id;

      // Publish the version
      const pubRes = await fetch(`/api/app/agents/${agentId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: newVersionId }),
      });
      const pubData = await pubRes.json();

      if (!pubRes.ok || !pubData.success) {
        throw new Error(pubData.error?.message || 'Failed to publish version.');
      }

      setMessage({ text: 'Agent version published to production successfully!', type: 'success' });
      fetchAgent();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading agent configuration...</div>;
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link href="/app/agents" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} /> All Agents
          </Link>
          <div>
            <h1 className="title-lg">{agent?.name}</h1>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Active Version: <strong>v{agent?.currentVersion?.versionNumber || 1}</strong> • Status: {agent?.status}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href={`/app/agents/${agentId}/versions`} className="btn btn-outline btn-sm">
            <History size={14} /> Version History
          </Link>
          <Link href={`/app/agents/${agentId}/test`} className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--accent-cyan)', color: '#38bdf8' }}>
            <Play size={14} /> Test Workbench
          </Link>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="btn btn-secondary btn-sm"
            disabled={saving || publishing}
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save Draft Snapshot'}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            className="btn btn-primary btn-sm"
            disabled={saving || publishing}
          >
            <Rocket size={14} /> {publishing ? 'Publishing...' : 'Publish to Live'}
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
          border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          color: message.type === 'success' ? '#34d399' : '#fb7185',
          fontSize: '13.5px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Configuration Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Identity & Speech Section */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="title-md">Persona & Initial Greeting</h2>
              <div className="text-xs">How the voice agent introduces itself to callers</div>
            </div>
            <span className="badge badge-primary">Identity</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Initial Spoken Greeting *</label>
              <textarea
                className="form-control"
                value={config.greeting}
                onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
                rows={2}
                placeholder="Hello! Thank you for calling..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">System Prompt & Instructions *</label>
              <textarea
                className="form-control"
                style={{ minHeight: '120px' }}
                value={config.prompt}
                onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                placeholder="Define role, boundaries, tone, and goals..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Personality Attributes</label>
                <input
                  type="text"
                  className="form-control"
                  value={config.personality}
                  onChange={(e) => setConfig({ ...config, personality: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tone of Voice</label>
                <select
                  className="form-control"
                  value={config.tone}
                  onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                >
                  <option value="friendly">Friendly & Reassuring</option>
                  <option value="professional">Strictly Professional & Formal</option>
                  <option value="empathetic">Empathetic & Caring</option>
                  <option value="direct">Concise & Direct</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Voice & Speech Synthesis Section */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="title-md">Voice Engine & Acoustics</h2>
              <div className="text-xs">LiveKit audio synthesizers and neural voice selection</div>
            </div>
            <span className="badge badge-primary">LiveKit Synthesizer</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Voice Provider</label>
              <select
                className="form-control"
                value={config.voiceProvider}
                onChange={(e) => setConfig({ ...config, voiceProvider: e.target.value })}
              >
                <option value="Cartesia">Cartesia Sonic (Ultra-low latency sub-100ms)</option>
                <option value="ElevenLabs">ElevenLabs Turbo v2.5</option>
                <option value="Deepgram">Deepgram Aura</option>
                <option value="OpenAI">OpenAI TTS Realtime</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Voice Persona ID</label>
              <select
                className="form-control"
                value={config.voiceId}
                onChange={(e) => setConfig({ ...config, voiceId: e.target.value })}
              >
                <option value="sonic-english-female">Chloe (Warm Female - Conversational)</option>
                <option value="sonic-english-male">Liam (Calm Male - Direct)</option>
                <option value="sonic-british-female">Emma (British Professional)</option>
                <option value="sonic-english-custom">Custom Tenant Voice Clone</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Language / Locale</label>
              <select
                className="form-control"
                value={config.voiceLanguage}
                onChange={(e) => setConfig({ ...config, voiceLanguage: e.target.value })}
              >
                <option value="en-US">English (United States)</option>
                <option value="en-GB">English (United Kingdom)</option>
                <option value="es-US">Spanish (United States)</option>
                <option value="fr-FR">French (France)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Speaking Speed ({config.voiceSpeed}x)</label>
              <input
                type="range"
                min="0.8"
                max="1.3"
                step="0.05"
                value={config.voiceSpeed}
                onChange={(e) => setConfig({ ...config, voiceSpeed: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--primary)', marginTop: '8px' }}
              />
            </div>
          </div>
        </div>

        {/* AI Model & Conversation Rules */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="title-md">LLM Intelligence & Conversation Guardrails</h2>
              <div className="text-xs">Reasoning model and latency timeouts</div>
            </div>
            <span className="badge badge-primary">LLM Engine</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Inference Model</label>
              <select
                className="form-control"
                value={config.aiModel}
                onChange={(e) => setConfig({ ...config, aiModel: e.target.value })}
              >
                <option value="gpt-4o-mini">GPT-4o Mini (Ultra-fast, Recommended)</option>
                <option value="gpt-4o">GPT-4o (Complex Multitask Reasoning)</option>
                <option value="claude-3-5-haiku">Claude 3.5 Haiku</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Silence Timeout (ms)</label>
              <input
                type="number"
                className="form-control"
                value={config.silenceTimeoutMs}
                onChange={(e) => setConfig({ ...config, silenceTimeoutMs: parseInt(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Max Call Duration (sec)</label>
              <input
                type="number"
                className="form-control"
                value={config.maxDurationSeconds}
                onChange={(e) => setConfig({ ...config, maxDurationSeconds: parseInt(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* Tools & Function Calling Section */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="title-md">Autonomous Tool Capabilities</h2>
              <div className="text-xs">Tools the voice agent can invoke in realtime during phone conversations</div>
            </div>
            <span className="badge badge-active">Active Tools</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            {Object.entries(config.tools || {}).map(([toolName, enabled]) => (
              <label
                key={toolName}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(enabled)}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      tools: { ...config.tools, [toolName]: e.target.checked },
                    })
                  }
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', textTransform: 'capitalize' }}>
                    {toolName.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Realtime tool execution enabled
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Change Summary Field */}
        <div className="card">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Version Changelog Note</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Updated greeting and enabled transfer rules"
              value={config.changeSummary}
              onChange={(e) => setConfig({ ...config, changeSummary: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
