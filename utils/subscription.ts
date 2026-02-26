import { createClient } from "@/utils/supabase/client";

// Check if user has an active subscription
export async function checkSubscription(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .limit(1)
    .single();

  return !!data;
}

// Get full subscription details
export async function getSubscriptionDetails(userId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data;
}

// Get export count for current month
export async function getUsageCount(userId: string): Promise<number> {
  const supabase = createClient();
  const month = getCurrentMonth();
  const { data } = await supabase
    .from("usage")
    .select("export_count")
    .eq("user_id", userId)
    .eq("month", month)
    .single();

  return data?.export_count ?? 0;
}

// Increment usage for current month (upsert)
export async function incrementUsage(userId: string): Promise<void> {
  const supabase = createClient();
  const month = getCurrentMonth();

  // Try to increment existing row
  const { data: existing } = await supabase
    .from("usage")
    .select("id, export_count")
    .eq("user_id", userId)
    .eq("month", month)
    .single();

  if (existing) {
    await supabase
      .from("usage")
      .update({ export_count: existing.export_count + 1 })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("usage")
      .insert({ user_id: userId, month, export_count: 1 });
  }
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
