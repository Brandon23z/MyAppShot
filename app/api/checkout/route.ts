import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, {
    apiVersion: '2026-01-28.clover',
  });
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const body = await req.json().catch(() => ({}));
    const { user_id, email } = body;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      ...(email && { customer_email: email }),
      ...(user_id && {
        metadata: { user_id },
        subscription_data: { metadata: { user_id } },
      }),
      success_url: `${origin}/?paid=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
