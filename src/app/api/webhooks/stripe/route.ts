import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';

/**
 * Stripe Payment Webhook Handler
 * Idempotently handles subscription checkout, renewal, and failed payment webhooks.
 * Uses timing-safe HMAC-SHA256 signature verification.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('stripe-signature') || '';
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // 1. Strict Signature Verification: Never process or activate paid plans on unverified requests
    if (!webhookSecret) {
      return NextResponse.json(
        { success: false, error: 'STRIPE_WEBHOOK_SECRET is not configured. Webhook processing is rejected.' },
        { status: 500 }
      );
    }

    if (!signatureHeader) {
      return NextResponse.json(
        { success: false, error: 'Missing stripe-signature header. Unverified requests are rejected.' },
        { status: 401 }
      );
    }

    const parts = signatureHeader.split(',');
    let timestamp = '';
    let signature = '';

    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === 't') timestamp = v;
      if (k === 'v1') signature = v;
    }

    if (!timestamp || !signature) {
      return NextResponse.json({ success: false, error: 'Invalid stripe-signature format' }, { status: 400 });
    }

    // Replay attack protection: Enforce 300-second timestamp tolerance
    const timestampSec = parseInt(timestamp, 10);
    const currentSec = Math.floor(Date.now() / 1000);
    if (isNaN(timestampSec) || Math.abs(currentSec - timestampSec) > 300) {
      return NextResponse.json(
        { success: false, error: 'Webhook signature timestamp outside acceptable 300-second tolerance window' },
        { status: 400 }
      );
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    const signatureBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');

    const isSignatureValid =
      signatureBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(signatureBuf, expectedBuf);

    if (!isSignatureValid) {
      return NextResponse.json({ success: false, error: 'Webhook signature verification failed' }, { status: 401 });
    }

    // 2. Parse Event Payload
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { id: eventId, type: eventType, data } = event;
    const object = data?.object || {};

    // 3. Webhook Idempotency Check: prevent duplicate event processing
    const idempotencyKey = `stripe_evt_${eventId}`;
    const existingDelivery = await db.auditLog.findFirst({
      where: { action: idempotencyKey },
    });
    if (existingDelivery) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // 4. Handle Specific Event Types
    switch (eventType) {
      case 'checkout.session.completed': {
        // Strict payment check: never activate paid plans if payment status is unpaid
        if (object.payment_status && object.payment_status !== 'paid') {
          return NextResponse.json({ received: true, status: 'unpaid_pending' });
        }

        const tenantId = object.client_reference_id || object.metadata?.tenantId;
        const planId = object.metadata?.planId;
        const planCode = object.metadata?.planCode || 'PRO';

        if (tenantId) {
          // Resolve plan
          let plan = planId ? await db.plan.findUnique({ where: { id: planId } }) : null;
          if (!plan) {
            plan = await db.plan.findFirst({ where: { code: planCode } });
          }

          if (plan) {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            await db.$transaction(async (tx) => {
              await tx.tenantSubscription.upsert({
                where: { id: `sub_${tenantId}` },
                update: {
                  planId: plan.id,
                  status: 'ACTIVE',
                  stripeCustomerId: object.customer || null,
                  stripeSubId: object.subscription || null,
                  currentPeriodStart: now,
                  currentPeriodEnd: periodEnd,
                  updatedAt: now,
                },
                create: {
                  id: `sub_${tenantId}`,
                  tenantId,
                  planId: plan.id,
                  status: 'ACTIVE',
                  stripeCustomerId: object.customer || null,
                  stripeSubId: object.subscription || null,
                  currentPeriodStart: now,
                  currentPeriodEnd: periodEnd,
                },
              });

              await tx.tenant.update({
                where: { id: tenantId },
                data: { status: 'ACTIVE', planId: plan.id },
              });
            });
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const stripeCustomerId = object.customer;
        const stripeSubId = object.subscription;

        if (stripeCustomerId || stripeSubId) {
          const sub = await db.tenantSubscription.findFirst({
            where: {
              OR: [{ stripeCustomerId }, { stripeSubId }],
            },
          });

          if (sub) {
            const periodStart = object.period_start ? new Date(object.period_start * 1000) : new Date();
            const periodEnd = object.period_end ? new Date(object.period_end * 1000) : new Date(Date.now() + 30 * 86400000);

            await db.tenantSubscription.update({
              where: { id: sub.id },
              data: {
                status: 'ACTIVE',
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
              },
            });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const stripeCustomerId = object.customer;
        const stripeSubId = object.subscription;

        if (stripeCustomerId || stripeSubId) {
          const sub = await db.tenantSubscription.findFirst({
            where: {
              OR: [{ stripeCustomerId }, { stripeSubId }],
            },
          });

          if (sub) {
            await db.tenantSubscription.update({
              where: { id: sub.id },
              data: { status: 'PAST_DUE' },
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const stripeSubId = object.id;
        if (stripeSubId) {
          await db.tenantSubscription.updateMany({
            where: { stripeSubId },
            data: { status: 'CANCELLED' },
          });
        }
        break;
      }
    }

    // 5. Record Idempotent Delivery Log
    await db.auditLog.create({
      data: {
        tenantId: object.metadata?.tenantId || null,
        actorId: 'stripe_webhook',
        actorEmail: 'system@stripe.com',
        actorType: 'PLATFORM_USER',
        action: idempotencyKey,
        resource: 'stripe_webhook',
        changes: JSON.stringify({ type: eventType, id: eventId }),
      },
    });

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Stripe webhook processing error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

