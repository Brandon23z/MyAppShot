// Free tier and payment tracking using localStorage (no accounts needed)

const STORAGE_KEYS = {
  USES: 'screenclip_uses',
  RESET_DATE: 'screenclip_reset_date',
  PAID: 'screenclip_paid',
  CUSTOMER_ID: 'screenclip_customer_id',
  SUBSCRIPTION_ID: 'screenclip_subscription_id',
  LAST_VERIFIED: 'screenclip_last_verified',
};

const FREE_LIMIT = 3;

// Get current month string (YYYY-MM)
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Check if user is paid
export function isPaidUser(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.PAID) === 'true';
}

// Get current usage count
export function getUsageCount(): number {
  if (typeof window === 'undefined') return 0;
  
  const resetDate = localStorage.getItem(STORAGE_KEYS.RESET_DATE);
  const currentMonth = getCurrentMonth();
  
  // Reset if it's a new month
  if (resetDate !== currentMonth) {
    localStorage.setItem(STORAGE_KEYS.RESET_DATE, currentMonth);
    localStorage.setItem(STORAGE_KEYS.USES, '0');
    return 0;
  }
  
  const uses = localStorage.getItem(STORAGE_KEYS.USES);
  return uses ? parseInt(uses, 10) : 0;
}

// Check if user has hit the free limit
export function hasHitFreeLimit(): boolean {
  if (isPaidUser()) return false;
  return getUsageCount() >= FREE_LIMIT;
}

// Increment usage count
export function incrementUsage(): void {
  if (typeof window === 'undefined') return;
  
  const currentCount = getUsageCount();
  localStorage.setItem(STORAGE_KEYS.USES, String(currentCount + 1));
}

// Mark user as paid (after successful checkout)
export function markAsPaid(customerId?: string, subscriptionId?: string): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(STORAGE_KEYS.PAID, 'true');
  if (customerId) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_ID, customerId);
  }
  if (subscriptionId) {
    localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION_ID, subscriptionId);
  }
}

// Get stored subscription ID
export function getSubscriptionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.SUBSCRIPTION_ID);
}

// Get stored customer ID
export function getCustomerId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.CUSTOMER_ID);
}

// Revoke paid status (when subscription is no longer active)
export function revokePaid(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(STORAGE_KEYS.PAID);
  localStorage.removeItem(STORAGE_KEYS.CUSTOMER_ID);
  localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION_ID);
  localStorage.removeItem(STORAGE_KEYS.LAST_VERIFIED);
}

// Check if verification is cached (within 1 hour)
export function isVerificationCached(): boolean {
  if (typeof window === 'undefined') return false;
  
  const lastVerified = localStorage.getItem(STORAGE_KEYS.LAST_VERIFIED);
  if (!lastVerified) return false;
  
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  return parseInt(lastVerified, 10) > oneHourAgo;
}

// Update verification timestamp
export function updateVerificationCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.LAST_VERIFIED, String(Date.now()));
}

// Get remaining free exports
export function getRemainingExports(): number {
  if (isPaidUser()) return Infinity;
  return Math.max(0, FREE_LIMIT - getUsageCount());
}
