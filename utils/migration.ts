import { getSubscriptionId, getCustomerId, isPaidUser, revokePaid } from "@/utils/freebie";

// Attempt to migrate localStorage subscription data to the database
// Called once after login if the user has no DB subscription
export async function attemptMigration(userId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Only attempt if localStorage has subscription data
  if (!isPaidUser()) return false;

  const subscriptionId = getSubscriptionId();
  const customerId = getCustomerId();
  if (!subscriptionId) return false;

  try {
    const response = await fetch("/api/migrate-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription_id: subscriptionId,
        customer_id: customerId,
      }),
    });

    const data = await response.json();

    if (data.success) {
      // Clear localStorage subscription data — DB is now the source of truth
      revokePaid();
      return true;
    }

    if (data.expired) {
      // Subscription is no longer active — clean up localStorage
      revokePaid();
    }

    return false;
  } catch (error) {
    console.error("Migration failed:", error);
    return false;
  }
}
