import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenantBusinessRules } from '@/services/rules.service';

function safeJsonParse(val: string | null | undefined, fallback: any = {}) {
  if (!val) return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

/**
 * Internal Machine-to-Machine Agent Runtime API
 * Authenticated strictly via Authorization: Bearer <WORKER_API_SECRET>.
 * Never uses browser cookies or exposes secrets.
 * Provides complete, tenant-isolated clinic profile, business hours, rules, and knowledge.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate via WORKER_API_SECRET
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const expectedSecret = process.env.WORKER_API_SECRET;
    if (!expectedSecret || !token || token !== expectedSecret) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or missing worker API secret.',
          },
        },
        { status: 401 }
      );
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const agentId = searchParams.get('agentId');
    const agentVersionId = searchParams.get('agentVersionId');

    if (!tenantId || !agentId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Both tenantId and agentId are required query parameters.',
          },
        },
        { status: 400 }
      );
    }

    // 3. Verify tenant exists and fetch clinic details & knowledge
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        legalName: true,
        phone: true,
        email: true,
        timezone: true,
        address: true,
        city: true,
        state: true,
        postalCode: true,
        description: true,
        status: true,
        knowledgeDocs: {
          where: { status: 'READY' },
          select: { title: true, content: true },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TENANT_NOT_FOUND',
            message: `Tenant ${tenantId} not found.`,
          },
        },
        { status: 404 }
      );
    }

    if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TENANT_INACTIVE',
            message: `Tenant ${tenantId} is ${tenant.status}.`,
          },
        },
        { status: 403 }
      );
    }

    // 4. Verify agent exists and belongs to tenant
    const agent = await db.agent.findFirst({
      where: { id: agentId, tenantId },
      select: {
        id: true,
        name: true,
        status: true,
        currentVersionId: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent ${agentId} not found for tenant ${tenantId}.`,
          },
        },
        { status: 404 }
      );
    }

    // 5. Resolve target version
    let version;
    if (agentVersionId) {
      version = await db.agentVersion.findFirst({
        where: { id: agentVersionId, agentId },
      });
      if (!version) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VERSION_NOT_FOUND',
              message: `AgentVersion ${agentVersionId} not found for agent ${agentId}.`,
            },
          },
          { status: 404 }
        );
      }
    } else {
      // Fall back to active published version
      if (agent.currentVersionId) {
        version = await db.agentVersion.findFirst({
          where: { id: agent.currentVersionId, agentId },
        });
      }
      if (!version) {
        version = await db.agentVersion.findFirst({
          where: { agentId, isPublished: true },
          orderBy: { versionNumber: 'desc' },
        });
      }
    }

    if (!version) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VERSION_NOT_FOUND',
            message: `No published version found for agent ${agentId}.`,
          },
        },
        { status: 404 }
      );
    }

    // 6. Verify version is published
    if (!version.isPublished) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VERSION_UNPUBLISHED',
            message: `Version v${version.versionNumber} is not published.`,
          },
        },
        { status: 400 }
      );
    }

    // Format clean clinic address
    const addressParts = [tenant.address, tenant.city, tenant.state, tenant.postalCode].filter(Boolean);
    const formattedAddress = addressParts.join(', ') || 'Main Clinic Location';

    // 7. Assemble strictly runtime-safe configuration (NO secrets, NO passwords, NO tenant internals)
    const runtimeConfig = {
      tenantId,
      agentId: agent.id,
      agentVersionId: version.id,
      name: agent.name,
      prompt: version.prompt || version.systemInstructions || 'You are a professional clinic AI voice assistant.',
      greeting: version.greeting || 'Hello, how can I help you today?',
      closingMessage: version.closingMessage || 'Thank you for calling. Goodbye.',
      personality: version.personality || 'professional, empathetic, concise',
      tone: version.tone || 'warm',
      temperature: version.temperature ?? 0.7,
      maxTokens: version.maxTokens ?? 500,
      voiceProvider: version.voiceProvider || 'piper',
      voiceId: version.voiceId || 'en_US-lessac-medium',
      voiceLanguage: version.voiceLanguage || 'en-US',
      aiModel: version.aiModel || 'gemini-2.5-flash',
      sttProvider: (version as any).sttProvider || 'faster-whisper',
      toolsConfig: safeJsonParse(version.toolsConfigJson, {}),
      businessRules: resolveTenantBusinessRules(tenantId, (version as any).businessRulesJson),
      businessHours: safeJsonParse(version.businessHoursJson, {}),
      transferRules: safeJsonParse(version.transferRulesJson, {}),
      clinicProfile: {
        name: tenant.name,
        phone: tenant.phone || '+1 (555) 234-5678',
        email: tenant.email || 'info@clinic.example.com',
        timezone: tenant.timezone || 'America/New_York',
        address: formattedAddress,
        services: [
          'Routine Consultation & Examination',
          'Dental Cleaning & Checkup',
          'Follow-up Appointment',
          'Diagnostic Review',
          'Urgent Care Triage',
        ],
      },
      knowledgeBase: (tenant.knowledgeDocs || []).map((doc) => ({
        title: doc.title,
        content: doc.content || '',
      })),
    };

    return NextResponse.json({
      success: true,
      data: runtimeConfig,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'An unexpected error occurred.',
        },
      },
      { status: 500 }
    );
  }
}
