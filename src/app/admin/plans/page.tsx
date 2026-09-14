'use client';

import { useState, useEffect } from 'react';
import { CreditCard, Check } from 'lucide-react';

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/plans')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPlans(data.data.plans || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="title-xl">Subscription & Entitlement Tiers</h1>
        <p className="text-body" style={{ marginTop: '4px' }}>
          Configured subscription plans and hard quota boundaries enforced across client tenants.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {plans.map((p) => (
          <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 className="title-md">{p.name}</h3>
                <span className="badge badge-primary">{p.code}</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '16px' }}>
                ${p.priceMonthly}<span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>/mo</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                {p.description}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={15} style={{ color: '#34d399' }} /> {p.monthlyMinutes} Voice Minutes / mo
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={15} style={{ color: '#34d399' }} /> Up to {p.maxAgents} Voice Agents
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={15} style={{ color: '#34d399' }} /> {p.maxPhoneNumbers} Dedicated Phone Numbers
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={15} style={{ color: '#34d399' }} /> Up to {p.maxUsers} Team Members
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={15} style={{ color: '#34d399' }} /> {p.maxConcurrentCalls} Concurrent Calls
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={15} style={{ color: '#34d399' }} /> {p.knowledgeStorageMb} MB Knowledge Store
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
