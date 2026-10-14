import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, signSessionToken, createSessionCookieHeader } from '@/lib/auth';
import { recordAuditLog } from '@/services/audit.service';
import { AuthSession } from '@/types';

/**
 * Self-Serve Customer SaaS Signup API
 * Creates User, Tenant, TenantMember (OWNER), Default Subscription, Clinic Profile,
 * and an initial configured Agent so the business is immediately ready to take/test calls.
 */
export async function POST(req: NextRequest) {
  try {
    const {
      name,
      email,
      password,
      businessName,
      phone,
      industry,
      timezone,
      country,
      language,
      voiceLanguage,
      voiceProvider,
      voiceId,
    } = await req.json();

    if (!email || !password || !name || !businessName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Name, email, password, and business name are required.',
          },
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'Password must be at least 8 characters long.',
          },
        },
        { status: 400 }
      );
    }

    // 1. Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email address already exists. Please log in.',
          },
        },
        { status: 409 }
      );
    }

    // 2. Hash password
    const passwordHash = await hashPassword(password);
    const normalizedEmail = email.toLowerCase().trim();

    // India-friendly defaults
    const resolvedTimezone = timezone || 'Asia/Kolkata';
    const resolvedCountry = country || 'IN';
    const resolvedLanguage = language || voiceLanguage || 'en-IN';
    const resolvedPhone = phone ? phone.trim() : '+91 80 4000 1000';
    const resolvedVoiceProvider = voiceProvider || 'piper';
    const resolvedVoiceId = voiceId || (resolvedVoiceProvider === 'sarvam' ? 'bulbul:v4-flash' : 'en_US-lessac-medium');

    // 3. Resolve Starter/Free Plan for trial
    let starterPlan = await db.plan.findFirst({
      where: { code: 'STARTER' },
    });
    if (!starterPlan) {
      starterPlan = await db.plan.findFirst();
    }

    // 4. Atomic Onboarding Transaction
    const result = await db.$transaction(async (tx) => {
      // 4a. Create User
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: name.trim(),
          passwordHash,
          status: 'ACTIVE',
        },
      });

      // 4b. Create Tenant with India-friendly defaults
      const tenant = await tx.tenant.create({
        data: {
          name: businessName.trim(),
          email: normalizedEmail,
          phone: resolvedPhone,
          country: resolvedCountry,
          industry: industry || 'Healthcare / Clinic',
          timezone: resolvedTimezone,
          status: 'TRIAL',
          planId: starterPlan?.id || null,
        },
      });

      // 4c. Create Membership as OWNER
      await tx.tenantMember.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      // 4d. Create Tenant Setting
      await tx.tenantSetting.create({
        data: {
          tenantId: tenant.id,
          recordCalls: true,
          autoTranscribe: true,
          aiSummaryEnabled: true,
          retentionDays: 90,
          notificationEmail: normalizedEmail,
        },
      });

      // 4e. Create Default Active Subscription
      if (starterPlan) {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await tx.tenantSubscription.create({
          data: {
            tenantId: tenant.id,
            planId: starterPlan.id,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      }

      // 4f. Create Clinic Profile with India-friendly defaults
      await tx.clinicProfile.create({
        data: {
          tenantId: tenant.id,
          clinicName: businessName.trim(),
          phone: resolvedPhone,
          email: normalizedEmail,
          timezone: resolvedTimezone,
        },
      });

      // 4g. Create Default Business Hours (Mon-Sat standard for clinics in India)
      const openDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (const day of openDays) {
        await tx.businessHours.create({
          data: {
            tenantId: tenant.id,
            dayOfWeek: day,
            openTime: '09:00',
            closeTime: '18:00',
            closed: false,
          },
        });
      }
      await tx.businessHours.create({
        data: {
          tenantId: tenant.id,
          dayOfWeek: 'sunday',
          openTime: '00:00',
          closeTime: '00:00',
          closed: true,
        },
      });

      // 4h. Create Initial Default AI Voice Agent configured with language and voice
      const agent = await tx.agent.create({
        data: {
          tenantId: tenant.id,
          name: `${businessName.trim()} Assistant`,
          type: 'APPOINTMENT_BOOKING',
          status: 'ACTIVE',
        },
      });

      const version = await tx.agentVersion.create({
        data: {
          agentId: agent.id,
          versionNumber: 1,
          prompt: `You are the official AI receptionist for ${businessName.trim()}.\nAnswer patient questions politely, verify clinic hours, and schedule appointments.`,
          greeting: `Hello! Thank you for calling ${businessName.trim()}. How can I assist you today?`,
          closingMessage: `Thank you for calling ${businessName.trim()}. Have a wonderful day!`,
          voiceProvider: resolvedVoiceProvider,
          voiceId: resolvedVoiceId,
          voiceLanguage: resolvedLanguage,
          aiModel: 'gemini-2.5-flash',
          llmProvider: 'gemini',
          sttProvider: 'faster-whisper',
          temperature: 0.7,
          isPublished: true,
        },
      });

      await tx.agent.update({
        where: { id: agent.id },
        data: { currentVersionId: version.id },
      });

      return { user, tenant };
    });

    // 5. Create Session & Cookie
    const session: AuthSession = {
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      isPlatformUser: false,
      tenantId: result.tenant.id,
      tenantName: result.tenant.name,
      tenantRole: 'OWNER' as any,
    };

    const token = signSessionToken(session);

    await recordAuditLog({
      tenantId: result.tenant.id,
      actorId: result.user.id,
      actorEmail: result.user.email,
      actorType: 'TENANT_MEMBER',
      action: 'TENANT_SIGNUP_COMPLETED',
      resource: 'auth',
    });

    const res = NextResponse.json({
      success: true,
      data: {
        session,
        redirectUrl: '/app',
      },
    });

    res.headers.set('Set-Cookie', createSessionCookieHeader(token));
    return res;
  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'An error occurred during account creation.',
        },
      },
      { status: 500 }
    );
  }
}



