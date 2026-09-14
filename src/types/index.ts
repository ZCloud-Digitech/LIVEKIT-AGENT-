export type PlatformRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT';
export type TenantRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';

export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'ARCHIVED';
export type AgentStatus = 'DRAFT' | 'CONFIGURING' | 'TESTING' | 'ACTIVE' | 'PAUSED' | 'ERROR' | 'ARCHIVED';
export type CallStatus = 'INITIATED' | 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'TRANSFERRED' | 'MISSED';
export type CallOutcome = 'APPOINTMENT_BOOKED' | 'RESOLVED' | 'TRANSFERRED' | 'DROPPED' | 'VOICEMAIL';
export type CallSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
export type AppointmentStatus = 'UPCOMING' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  isPlatformUser: boolean;
  platformRole?: PlatformRole;
  tenantId?: string;
  tenantName?: string;
  tenantRole?: TenantRole;
  isImpersonating?: boolean;
  impersonatedBy?: string; // platform user email
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface EntitlementCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  percentageUsed: number;
  metric: string;
  warningThreshold?: '70%' | '85%' | '95%' | '100%' | null;
}

export interface AgentConfigDraft {
  name: string;
  type: string;
  prompt: string;
  systemInstructions: string;
  greeting: string;
  closingMessage: string;
  personality: string;
  tone: string;
  voiceProvider: string;
  voiceId: string;
  voiceLanguage: string;
  voiceSpeed: number;
  aiModel: string;
  temperature: number;
  maxTokens: number;
  silenceTimeoutMs: number;
  greetingTimeoutMs: number;
  maxDurationSeconds: number;
  fallbackBehavior: string;
  businessHours: {
    enabled: boolean;
    timezone: string;
    schedule: Record<string, { open: string; close: string; closed: boolean }>;
    afterHoursAction: string;
  };
  transferRules: {
    primaryNumber: string;
    fallbackNumber: string;
    timeoutSeconds: number;
    handoffMessage: string;
    conditions: string[];
  };
  tools: {
    check_availability: boolean;
    book_appointment: boolean;
    reschedule_appointment: boolean;
    cancel_appointment: boolean;
    send_sms: boolean;
    transfer_call: boolean;
    create_lead: boolean;
  };
}
