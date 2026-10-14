import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { db } from '@/lib/db';
import { encryptSecret, decryptSecret, maskSecret, isMaskedValue } from '@/lib/encryption';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const integrations = await db.integration.findMany({
      where: { tenantId: session.tenantId },
    });

    // Strictly strip raw secrets; return masked keys for UI display
    const safeIntegrations = integrations.map((int) => {
      let maskedKey: string | null = null;
      if (int.credentialsEncrypted) {
        const decrypted = decryptSecret(int.credentialsEncrypted);
        maskedKey = maskSecret(decrypted);
      }

      let parsedConfig = {};
      try {
        if (int.configJson) parsedConfig = JSON.parse(int.configJson);
      } catch {
        parsedConfig = {};
      }

      return {
        id: int.id,
        tenantId: int.tenantId,
        provider: int.provider,
        name: int.name,
        status: int.status,
        config: parsedConfig,
        maskedKey,
        isConfigured: Boolean(int.credentialsEncrypted),
        lastSyncAt: int.lastSyncAt,
        createdAt: int.createdAt,
        updatedAt: int.updatedAt,
      };
    });

    return NextResponse.json({ success: true, data: { integrations: safeIntegrations } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'UNAUTHORIZED', message: err.message } },
      { status: err.statusCode || 403 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId, ['OWNER', 'ADMIN']);

    const body = await req.json();
    const { provider, name, action, apiKey, config } = body;

    if (!provider) {
      return NextResponse.json({ success: false, error: { message: 'Provider is required' } }, { status: 400 });
    }

    if (action === 'DISCONNECT') {
      await db.integration.deleteMany({
        where: { tenantId: session.tenantId, provider },
      });
      return NextResponse.json({ success: true });
    }

    // Determine encrypted credentials
    const existing = await db.integration.findUnique({
      where: { tenantId_provider: { tenantId: session.tenantId, provider } },
    });

    let credentialsEncrypted = existing?.credentialsEncrypted || null;
    if (apiKey && typeof apiKey === 'string') {
      // Dograh pattern: Only update secret if the incoming value is NOT a masked placeholder
      if (!isMaskedValue(apiKey)) {
        credentialsEncrypted = encryptSecret(apiKey.trim());
      }
    }

    const configJson = config ? JSON.stringify(config) : (existing?.configJson || '{}');

    const integration = await db.integration.upsert({
      where: { tenantId_provider: { tenantId: session.tenantId, provider } },
      update: {
        status: 'CONNECTED',
        credentialsEncrypted,
        configJson,
        lastSyncAt: new Date(),
      },
      create: {
        tenantId: session.tenantId,
        provider,
        name: name || provider,
        status: 'CONNECTED',
        credentialsEncrypted,
        configJson,
        lastSyncAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: integration.id,
        provider: integration.provider,
        name: integration.name,
        status: integration.status,
        isConfigured: Boolean(integration.credentialsEncrypted),
        maskedKey: apiKey ? maskSecret(apiKey) : (existing?.credentialsEncrypted ? maskSecret(decryptSecret(existing.credentialsEncrypted)) : null),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
