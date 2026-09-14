import Link from 'next/link';
import { PhoneCall, ShieldCheck, Activity, Layers, Cpu, Radio, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation */}
      <header style={{
        height: '72px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        background: 'rgba(8, 12, 20, 0.85)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '18px',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)'
          }}>
            Z
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em' }}>Z Call Agent</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1 }}>Control Plane</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="badge badge-active" style={{ textTransform: 'none', gap: '6px' }}>
            <span className="pulse-dot"></span> LiveKit Mesh Operational
          </div>
          <Link href="/auth/login" className="btn btn-secondary btn-sm">
            Sign In
          </Link>
          <Link href="/auth/login" className="btn btn-primary btn-sm">
            Open Dashboard <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, padding: '80px 40px 40px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 60px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            color: '#a5b4fc',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '24px'
          }}>
            <Radio size={14} className="pulse-dot" style={{ background: 'transparent' }} />
            Next-Gen B2B Voice Infrastructure Control Plane
          </div>

          <h1 style={{
            fontSize: '52px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            marginBottom: '20px',
            background: 'linear-gradient(180deg, #ffffff 0%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Deploy & Orchestrate Realtime AI Voice Agents
          </h1>

          <p style={{
            fontSize: '18px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: '36px'
          }}>
            True multi-tenant SaaS control plane for AI voice agents. Powered by LiveKit realtime execution,
            strict tenant isolation, immutable configuration versioning, phone routing, and automated appointment scheduling.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <Link href="/auth/login" className="btn btn-primary btn-lg" style={{ padding: '14px 28px', fontSize: '15px' }}>
              Launch Client Portal <ArrowRight size={16} />
            </Link>
            <Link href="/auth/login?tab=admin" className="btn btn-secondary btn-lg" style={{ padding: '14px 28px', fontSize: '15px' }}>
              Platform Admin Console
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-3 gap-6" style={{ marginBottom: '60px' }}>
          <div className="card card-hover">
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
              marginBottom: '16px'
            }}>
              <ShieldCheck size={24} />
            </div>
            <h3 style={{ fontSize: '17px', marginBottom: '8px' }}>Strict Tenant Isolation & RBAC</h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Guaranteed isolation across data, calls, agents, and phone numbers. Role-aware permissions for OWNER, ADMIN, MANAGER, STAFF, and VIEWER.
            </p>
          </div>

          <div className="card card-hover">
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'rgba(6, 182, 212, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#22d3ee',
              marginBottom: '16px'
            }}>
              <Radio size={24} />
            </div>
            <h3 style={{ fontSize: '17px', marginBottom: '8px' }}>LiveKit Voice Boundary</h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Server-side cryptographic token generation with attached tenant and agent metadata. No credentials or provider keys exposed to the browser.
            </p>
          </div>

          <div className="card card-hover">
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              marginBottom: '16px'
            }}>
              <Layers size={24} />
            </div>
            <h3 style={{ fontSize: '17px', marginBottom: '8px' }}>Agent Versioning & Sandbox</h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Safe configuration deployments with v1 → v2 snapshots, rollback capability, and an interactive in-browser audio test workbench.
            </p>
          </div>
        </div>

        {/* Demo Credentials Helper Box */}
        <div style={{
          background: 'rgba(15, 22, 36, 0.9)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px', color: '#fff', marginBottom: '4px' }}>
              Quick Evaluation & Verification Credentials
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Explore the live system using seeded test accounts for both platform administrators and isolated client tenants.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link href="/auth/login?email=admin@zcallagent.ai" className="btn btn-secondary btn-sm">
              Login as Super Admin
            </Link>
            <Link href="/auth/login?email=owner@apexdental.com" className="btn btn-primary btn-sm">
              Login as Tenant Owner
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '24px 40px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-muted)',
      }}>
        © 2026 Z Call Agent Inc. Production Multi-Tenant Control Plane. All rights reserved.
      </footer>
    </div>
  );
}
