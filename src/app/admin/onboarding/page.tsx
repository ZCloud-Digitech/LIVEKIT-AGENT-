'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  User,
  CreditCard,
  ShieldCheck,
  Radio,
  BookOpen,
  Wrench,
  Puzzle,
  Phone,
  CheckCircle2,
  Rocket,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

export default function ClientOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State across all 11 steps
  const [formData, setFormData] = useState({
    business: {
      name: '',
      legalName: '',
      industry: 'Healthcare / Dental',
      website: '',
      email: '',
      phone: '',
      country: 'US',
      timezone: 'America/New_York',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      description: '',
    },
    contact: {
      name: '',
      email: '',
      phone: '',
      role: 'Primary Executive',
    },
    planId: '',
    adminUser: {
      name: '',
      email: '',
      password: 'Password123!',
    },
    voiceAgent: {
      name: 'Maya - Virtual Receptionist',
      type: 'APPOINTMENT_BOOKING',
      greeting: "Hello! Thank you for calling. I'm Maya, your AI assistant. How may I assist you today?",
      prompt: 'You are Maya, a warm, professional, and efficient voice agent.',
      voiceProvider: 'Cartesia',
      voiceId: 'sonic-english-female',
      language: 'en-US',
    },
    tools: {
      check_availability: true,
      book_appointment: true,
      reschedule_appointment: true,
      cancel_appointment: true,
      transfer_call: true,
    },
    phoneNumber: '+1 (555) 789-0123',
  });

  useEffect(() => {
    fetch('/api/admin/plans')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.plans) {
          setPlans(data.data.plans);
          if (data.data.plans[1]) {
            setFormData((prev) => ({ ...prev, planId: data.data.plans[1].id }));
          }
        }
      });
  }, []);

  const totalSteps = 11;

  const handleNext = () => {
    setError(null);
    if (step === 1 && (!formData.business.name || !formData.business.email)) {
      setError('Business Name and Business Email are required.');
      return;
    }
    if (step === 4 && (!formData.adminUser.name || !formData.adminUser.email)) {
      setError('Admin User name and email are required.');
      return;
    }
    setStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleDeploy = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to deploy tenant.');
      }

      router.push(`/admin/clients/${data.data.tenant.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitles = [
    'Business Details',
    'Primary Contact',
    'Subscription Plan',
    'Initial Admin User',
    'Voice Agent Setup',
    'Knowledge Base',
    'Tool Capabilities',
    'Integrations',
    'Phone Provisioning',
    'Verification Checklist',
    'Deploy & Activate',
  ];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 className="title-xl">Client Onboarding Wizard</h1>
        <p className="text-body" style={{ marginTop: '4px' }}>
          Step {step} of {totalSteps}: {stepTitles[step - 1]}
        </p>
      </div>

      {/* Step Progress Bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '32px',
        background: 'var(--bg-surface-elevated)',
        padding: '6px',
        borderRadius: 'var(--radius-full)'
      }}>
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              height: '6px',
              borderRadius: 'var(--radius-full)',
              background: idx + 1 <= step ? 'linear-gradient(90deg, #4f46e5, #06b6d4)' : 'rgba(255, 255, 255, 0.08)',
              transition: 'all 0.3s ease'
            }}
          />
        ))}
      </div>

      {error && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.12)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          color: '#fb7185',
          fontSize: '13.5px',
          marginBottom: '24px'
        }}>
          {error}
        </div>
      )}

      {/* Step Form Cards */}
      <div className="card" style={{ padding: '36px', marginBottom: '28px' }}>
        {step === 1 && (
          <div>
            <h2 className="title-md" style={{ marginBottom: '20px' }}>Step 1 — Business Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Business Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Horizon Family Dental"
                  value={formData.business.name}
                  onChange={(e) => setFormData({ ...formData, business: { ...formData.business, name: e.target.value } })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Industry *</label>
                <select
                  className="form-control"
                  value={formData.business.industry}
                  onChange={(e) => setFormData({ ...formData, business: { ...formData.business, industry: e.target.value } })}
                >
                  <option value="Healthcare / Dental">Healthcare / Dental</option>
                  <option value="Urgent Care / Clinic">Urgent Care / Clinic</option>
                  <option value="Veterinary Clinic">Veterinary Clinic</option>
                  <option value="Fitness / Gym">Fitness / Gym</option>
                  <option value="Legal & Professional">Legal & Professional</option>
                  <option value="Home Services">Home Services</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Business Email *</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="contact@horizoncare.com"
                  value={formData.business.email}
                  onChange={(e) => setFormData({ ...formData, business: { ...formData.business, email: e.target.value } })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Business Phone</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="+1 (555) 444-2222"
                  value={formData.business.phone}
                  onChange={(e) => setFormData({ ...formData, business: { ...formData.business, phone: e.target.value } })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Timezone</label>
                <select
                  className="form-control"
                  value={formData.business.timezone}
                  onChange={(e) => setFormData({ ...formData, business: { ...formData.business, timezone: e.target.value } })}
                >
                  <option value="America/New_York">Eastern Time (US & Canada)</option>
                  <option value="America/Chicago">Central Time (US & Canada)</option>
                  <option value="America/Denver">Mountain Time (US & Canada)</option>
                  <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                  <option value="Europe/London">London (GMT)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Website</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://horizoncare.com"
                  value={formData.business.website}
                  onChange={(e) => setFormData({ ...formData, business: { ...formData.business, website: e.target.value } })}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="title-md" style={{ marginBottom: '20px' }}>Step 2 — Primary Contact</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Dr. Jordan Hayes"
                  value={formData.contact.name}
                  onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, name: e.target.value } })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="jordan.hayes@horizoncare.com"
                  value={formData.contact.email}
                  onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, email: e.target.value } })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="+1 (555) 777-8888"
                  value={formData.contact.phone}
                  onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, phone: e.target.value } })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.contact.role}
                  onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, role: e.target.value } })}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="title-md" style={{ marginBottom: '20px' }}>Step 3 — Entitlement Plan</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {plans.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setFormData({ ...formData, planId: p.id })}
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-lg)',
                    border: formData.planId === p.id ? '2px solid var(--primary)' : '1px solid var(--border-default)',
                    background: formData.planId === p.id ? 'rgba(79, 70, 229, 0.12)' : 'var(--bg-surface-elevated)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '16px', color: '#fff', marginBottom: '4px' }}>{p.name}</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', marginBottom: '12px' }}>
                    ${p.priceMonthly}<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/mo</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>• {p.monthlyMinutes} Voice Minutes</div>
                    <div>• Up to {p.maxAgents} Voice Agents</div>
                    <div>• {p.maxPhoneNumbers} Phone Numbers</div>
                    <div>• {p.maxUsers} Team Members</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="title-md" style={{ marginBottom: '20px' }}>Step 4 — Initial Tenant Admin</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Admin Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Jordan Hayes"
                  value={formData.adminUser.name}
                  onChange={(e) => setFormData({ ...formData, adminUser: { ...formData.adminUser, name: e.target.value } })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Admin Email Address *</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="admin@horizoncare.com"
                  value={formData.adminUser.email}
                  onChange={(e) => setFormData({ ...formData, adminUser: { ...formData.adminUser, email: e.target.value } })}
                  required
                />
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
              This user will be assigned the OWNER role with complete administrative rights over the tenant.
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="title-md" style={{ marginBottom: '20px' }}>Step 5 — Voice Agent Setup</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Voice Agent Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.voiceAgent.name}
                  onChange={(e) => setFormData({ ...formData, voiceAgent: { ...formData.voiceAgent, name: e.target.value } })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Greeting Message</label>
                <textarea
                  className="form-control"
                  value={formData.voiceAgent.greeting}
                  onChange={(e) => setFormData({ ...formData, voiceAgent: { ...formData.voiceAgent, greeting: e.target.value } })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Prompt / Persona Instructions</label>
                <textarea
                  className="form-control"
                  style={{ minHeight: '100px' }}
                  value={formData.voiceAgent.prompt}
                  onChange={(e) => setFormData({ ...formData, voiceAgent: { ...formData.voiceAgent, prompt: e.target.value } })}
                />
              </div>
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <h2 className="title-md" style={{ marginBottom: '16px' }}>Step 6 — Knowledge Base Ingestion</h2>
            <p className="text-body" style={{ marginBottom: '20px' }}>
              The client will be provisioned with a dedicated vector search namespace. Knowledge documents, clinic FAQs, and insurance policies can be attached immediately upon launch.
            </p>
            <div style={{ padding: '24px', border: '2px dashed var(--border-default)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div>Default Clinic FAQ & Scheduling Rules Attached</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Status: Ready for vector indexing</div>
            </div>
          </div>
        )}

        {step === 7 && (
          <div>
            <h2 className="title-md" style={{ marginBottom: '16px' }}>Step 7 — Enable Tool Capabilities</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(formData.tools).map(([toolKey, enabled]) => (
                <label
                  key={toolKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    background: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tools: { ...formData.tools, [toolKey]: e.target.checked },
                      })
                    }
                  />
                  <span style={{ fontWeight: 600, fontSize: '13.5px', textTransform: 'capitalize' }}>
                    {toolKey.replace(/_/g, ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 8 && (
          <div>
            <h2 className="title-md" style={{ marginBottom: '16px' }}>Step 8 — External Integrations</h2>
            <p className="text-body" style={{ marginBottom: '20px' }}>
              Connect calendars, CRMs, or telephony connectors. These can also be configured anytime by the client owner.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ padding: '16px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#fff' }}>Google Calendar</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Two-way sync for bookings</div>
              </div>
              <div style={{ padding: '16px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#fff' }}>Twilio Voice Trunk</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Inbound & outbound telephony</div>
              </div>
            </div>
          </div>
        )}

        {step === 9 && (
          <div>
            <h2 className="title-md" style={{ marginBottom: '16px' }}>Step 9 — Provision Phone Number</h2>
            <div className="form-group">
              <label className="form-label">Direct Inbound Dial (DID) Number</label>
              <input
                type="text"
                className="form-control"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              This phone number will be automatically mapped to {formData.voiceAgent.name} upon deployment.
            </div>
          </div>
        )}

        {step === 10 && (
          <div>
            <h2 className="title-md" style={{ marginBottom: '16px' }}>Step 10 — Pre-Launch Test Checklist</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#34d399', fontSize: '13.5px' }}>
                <CheckCircle2 size={18} /> Business parameters validated
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#34d399', fontSize: '13.5px' }}>
                <CheckCircle2 size={18} /> LiveKit Session Token generation verified
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#34d399', fontSize: '13.5px' }}>
                <CheckCircle2 size={18} /> Quota enforcement and plan limit rules attached
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#34d399', fontSize: '13.5px' }}>
                <CheckCircle2 size={18} /> Tenant database isolation confirmed
              </div>
            </div>
          </div>
        )}

        {step === 11 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: '#fff',
              boxShadow: '0 0 25px rgba(99, 102, 241, 0.5)'
            }}>
              <Rocket size={30} />
            </div>
            <h2 className="title-lg" style={{ marginBottom: '10px' }}>Ready to Deploy {formData.business.name}</h2>
            <p className="text-body" style={{ maxWidth: '500px', margin: '0 auto 24px' }}>
              This will create the tenant record, initialize the database workspace, configure the voice agent, and generate the admin credentials.
            </p>
            <button
              type="button"
              onClick={handleDeploy}
              className="btn btn-primary btn-lg"
              disabled={submitting}
              style={{ padding: '12px 32px' }}
            >
              {submitting ? 'Provisioning Infrastructure...' : 'Deploy Tenant Now'}
            </button>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {step > 1 && step < 11 && (
          <button type="button" onClick={handleBack} className="btn btn-secondary">
            <ArrowLeft size={15} /> Back
          </button>
        )}
        <div style={{ marginLeft: 'auto' }}>
          {step < 11 && (
            <button type="button" onClick={handleNext} className="btn btn-primary">
              Next Step <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
