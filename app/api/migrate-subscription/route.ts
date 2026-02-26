import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/utils/supabase/server";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate the user
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { subscription_id, customer_id } = await req.json();

    if (!subscription_id) {
      return NextResponse.json({ error: "subscription_id required" }, { status: 400 });
    }

    // Verify the subscription with Stripe
    const stripe = getStripe();
    let sub: Stripe.Subscription;

    try {
      sub = await stripe.subscriptions.retrieve(subscription_id);
    } catch {
      return NextResponse.json({ error: "Invalid subscription", expired: true }, { status: 400 });
    }

    // Check if subscription is still active
    if (sub.status !== "active" && sub.status !== "trialing") {
      return NextResponse.json({ error: "Subscription not active", expired: true }, { status: 400 });
    }

    // Get period end from subscription items (newer Stripe API)
    const item = sub.items?.data?.[0];
    const periodEnd = item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null;

    // Insert into DB using service role (bypasses RLS)
    const admin = getSupabaseAdmin();

    await admin.from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customer_id || (sub.customer as string),
        stripe_subscription_id: subscription_id,
        status: sub.status,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: "Migration failed" }, { status: 500 });
  }
}
