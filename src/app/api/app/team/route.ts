import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { db } from '@/lib/db';
import { checkEntitlement } from '@/services/entitlement.service';
import { recordAuditLog } from '@/services/audit.service';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const members = await db.tenantMember.findMany({
      where: { tenantId: session.tenantId },
      include: { user: { select: { id: true, name: true, email: true, status: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, data: { members } });
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

    const { email, name, role } = await req.json();

    if (!email || !name) {
      return NextResponse.json(
        { success: false, error: { message: 'Name and email are required.' } },
        { status: 400 }
      );
    }

    // Check user limits
    const entitlement = await checkEntitlement(session.tenantId, 'USERS');
    if (!entitlement.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LIMIT_EXCEEDED',
            message: `User limit reached for your plan (${entitlement.currentUsage}/${entitlement.limit}). Upgrade to add more members.`,
          },
        },
        { status: 403 }
      );
    }

    // Check if user already exists
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      const defaultPasswordHash = await hashPassword('TempPassword123!');
      user = await db.user.create({
        data: {
          email,
          name,
          passwordHash: defaultPasswordHash,
          status: 'ACTIVE',
        },
      });
    }

    const existingMember = await db.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId: session.tenantId, userId: user.id } },
    });

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: { message: 'User is already a member of this tenant.' } },
        { status: 400 }
      );
    }

    const member = await db.tenantMember.create({
      data: {
        tenantId: session.tenantId,
        userId: user.id,
        role: role || 'STAFF',
      },
      include: { user: true },
    });

    await recordAuditLog({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorType: 'TENANT_MEMBER',
      action: 'USER_INVITED',
      resource: 'user',
      resourceId: user.id,
      changes: { email, role },
    });

    return NextResponse.json({ success: true, data: { member } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
