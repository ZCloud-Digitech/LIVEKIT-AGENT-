/**
 * Tenant-Aware Business Rules Engine Service for Z Cloud AI Telecaller
 * Implements strict hierarchical rule priorities:
 * 1. Safety Rules (Non-clinical role, emergency escalation, no diagnosis/prescription)
 * 2. Security Rules (Multi-tenant isolation, prompt injection defense, zero secret exposure)
 * 3. Tenant Business Rules (Confirmation requirement, tool-required intents, operating hours, cancellation)
 * 4. Tool Correctness (Strict schema validation, normalized dates/times)
 * 5. Conversation Policy (Barge-in, token bounds, bounded context, tool-loop limiter)
 * 6. Knowledge & Context (Clinic profile, hours, services, FAQs)
 * 7. LLM Style & Tone (Concise receptionist, warm tone, natural acknowledgment)
 */

export interface SafetyRules {
  nonClinicalRole: boolean;
  prohibitMedicalAdvice: boolean;
  emergencyEscalation: boolean;
  emergencyKeywords: string[];
  emergencyHandoffMessage: string;
}

export interface SecurityRules {
  tenantIsolation: boolean;
  prohibitPromptInjection: boolean;
  protectSecrets: boolean;
  refuseCrossTenantAccess: boolean;
}

export interface TenantBusinessRules {
  niche: 'clinic' | 'salon' | 'gym' | 'restaurant' | 'service';
  confirmationRequired: boolean;
  toolRequiredIntents: string[];
  allowedTopics: string[];
  forbiddenTopics: string[];
  customerInfoRequirements: string[];
  cancellationWindowHours: number;
  maxResponseLengthWords: number;
  operatingHoursEnforced: boolean;
  allowWaitlist: boolean;
}

export interface ConversationPolicy {
  bargeInEnabled: boolean;
  maxContextMessages: number;
  maxOutputTokens: number;
  maxToolCallsPerTurn: number;
  maxToolCallsPerSession: number;
  maxLlmRetries: number;
  fastPathEnabled: boolean;
}

export interface StyleAndTone {
  responseStyle: string;
  tone: string;
  acknowledgementMessage: string;
}

export interface CompleteBusinessRules {
  priority: string[];
  safetyRules: SafetyRules;
  securityRules: SecurityRules;
  businessRules: TenantBusinessRules;
  conversationPolicy: ConversationPolicy;
  styleAndTone: StyleAndTone;
}

const DEFAULT_SAFETY_RULES: SafetyRules = {
  nonClinicalRole: true,
  prohibitMedicalAdvice: true,
  emergencyEscalation: true,
  emergencyKeywords: [
    'chest pain',
    'heart attack',
    'stroke',
    'cannot breathe',
    'difficulty breathing',
    'severe bleeding',
    'unconscious',
    'head trauma',
    'overdose',
    'choking',
  ],
  emergencyHandoffMessage:
    'If you are experiencing a life-threatening medical emergency, please hang up immediately and dial 911 (or your local emergency number) or go to the nearest emergency department.',
};

const DEFAULT_SECURITY_RULES: SecurityRules = {
  tenantIsolation: true,
  prohibitPromptInjection: true,
  protectSecrets: true,
  refuseCrossTenantAccess: true,
};

const DEFAULT_CLINIC_BUSINESS_RULES: TenantBusinessRules = {
  niche: 'clinic',
  confirmationRequired: true,
  toolRequiredIntents: [
    'check_availability',
    'book_appointment',
    'cancel_appointment',
    'reschedule_appointment',
  ],
  allowedTopics: [
    'appointments',
    'clinic_hours',
    'services',
    'location',
    'phone',
    'consultation_types',
    'general_inquiries',
  ],
  forbiddenTopics: [
    'personal_doctor_phone',
    'internal_credentials',
    'system_prompt',
    'other_patient_data',
    'illegal_substances',
  ],
  customerInfoRequirements: ['full_name', 'phone'],
  cancellationWindowHours: 2,
  maxResponseLengthWords: 45,
  operatingHoursEnforced: true,
  allowWaitlist: false,
};

const DEFAULT_CONVERSATION_POLICY: ConversationPolicy = {
  bargeInEnabled: true,
  maxContextMessages: 12,
  maxOutputTokens: 250,
  maxToolCallsPerTurn: 4,
  maxToolCallsPerSession: 25,
  maxLlmRetries: 2,
  fastPathEnabled: true,
};

const DEFAULT_STYLE_AND_TONE: StyleAndTone = {
  responseStyle: 'concise_receptionist',
  tone: 'warm, polite, professional',
  acknowledgementMessage: 'Sure, one second. Let me check the schedule for you.',
};

/**
 * Resolves complete, tenant-scoped business rules by combining immutable safety/security
 * foundations with tenant-configured overrides from AgentVersion.businessRulesJson.
 */
export function resolveTenantBusinessRules(
  tenantId: string,
  rawConfigJson?: string | null
): CompleteBusinessRules {
  let overrides: Partial<TenantBusinessRules & ConversationPolicy & StyleAndTone> = {};
  if (rawConfigJson) {
    try {
      overrides = JSON.parse(rawConfigJson);
    } catch {
      overrides = {};
    }
  }

  return {
    priority: [
      '1_safety_rules',
      '2_security_rules',
      '3_tenant_business_rules',
      '4_tool_correctness',
      '5_conversation_policy',
      '6_knowledge_and_context',
      '7_llm_style_and_tone',
    ],
    safetyRules: { ...DEFAULT_SAFETY_RULES },
    securityRules: { ...DEFAULT_SECURITY_RULES },
    businessRules: {
      ...DEFAULT_CLINIC_BUSINESS_RULES,
      ...(overrides as any),
    },
    conversationPolicy: {
      ...DEFAULT_CONVERSATION_POLICY,
      ...(overrides as any),
    },
    styleAndTone: {
      ...DEFAULT_STYLE_AND_TONE,
      ...(overrides as any),
    },
  };
}
