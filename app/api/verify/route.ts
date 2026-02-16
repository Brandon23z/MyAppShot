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
    const { subscription_id } = await req.json();
    
    if (!subscription_id) {
      return NextResponse.json(
        { error: 'subscription_id is required' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    
    // Retrieve the subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscription_id);
    
    // Check if subscription is active or trialing
    const active = subscription.status === 'active' || subscription.status === 'trialing';
    
    return NextResponse.json({ active });
  } catch (error) {
    console.error('Stripe verify error:', error);
    return NextResponse.json(
      { error: 'Failed to verify subscription', active: false },
      { status: 500 }
    );
  }
}
