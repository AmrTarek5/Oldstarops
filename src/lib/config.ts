// Tunable business thresholds. These encode judgment calls the spec left
// open (what counts as a "whale", how a flex/COD fee is detected, etc.) -
// adjust them here as OldStar's actual rules get confirmed, rather than
// hunting through page/query code.

/** Lifetime spend (EGP) at/above which a customer counts as a whale even without a manual VIP flag. */
export const WHALE_SPEND_THRESHOLD = Number(process.env.WHALE_SPEND_THRESHOLD || 15000);

/** Orders with this many items or more count as "bulk orders". */
export const BULK_ORDER_MIN_ITEMS = 3;

/**
 * There's no dedicated "flex/COD fee" field synced from Shopify. This
 * detects it heuristically by matching a line item title against these
 * patterns (case-insensitive). Update to match OldStar's actual product/fee
 * naming once confirmed.
 */
export const FLEX_FEE_TITLE_PATTERNS = [/flex fee/i, /cod fee/i, /delivery fee/i];

/**
 * Bosta doesn't tell us when COD cash is actually remitted to the merchant
 * (no remittance data in the schema yet). As a rough proxy, COD collected
 * more than this many days ago is treated as "settled"; more recent is
 * "live" (collected by the courier, not yet in OldStar's account).
 */
export const BOSTA_REMITTANCE_GRACE_DAYS = 3;

/**
 * Fallback estimated Bosta fee for a return pickup when return_requests.pickup_fee
 * hasn't been recorded (e.g. pickup automation not wired to a real fee yet).
 */
export const RETURN_PICKUP_FLAT_FEE_ESTIMATE = Number(
  process.env.RETURN_PICKUP_FLAT_FEE_ESTIMATE || 50
);
