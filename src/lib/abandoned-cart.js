export const ABANDONED_CART_DELAY_MS = 45 * 60 * 1000;

export function isAbandonedCartDue(cartUpdatedAt, abandonedCartStage, now = Date.now()) {
  if (!cartUpdatedAt || abandonedCartStage >= 1) {
    return false;
  }

  const updatedAt = Date.parse(cartUpdatedAt);
  return Number.isFinite(updatedAt) && now - updatedAt >= ABANDONED_CART_DELAY_MS;
}
