/**
 * DOCTRINE FINANCIAL ENGINE — DETERMINISTIC MONEY UTILITY
 *
 * ARCHITECTURAL RULE:
 * 1. Money is stored strictly in integer Paise (1 Rupee = 100 Paise).
 * 2. All monetary calculations are performed deterministically in JS / DB logic.
 * 3. Gemini / AI models MUST NEVER perform authoritative monetary arithmetic.
 */

/**
 * Converts a human-readable Rupee decimal value into integer Paise.
 * e.g., 220 -> 22000, 185.50 -> 18550, 499.99 -> 49999, 0.01 -> 1
 *
 * @param {number} rupees - Rupee amount
 * @returns {number} Integer paise
 */
export function rupeesToPaise(rupees) {
  if (typeof rupees !== 'number' || !Number.isFinite(rupees)) {
    throw new TypeError(`[Money Error] Invalid rupee amount: ${rupees}. Must be a finite number.`);
  }
  if (rupees < 0) {
    throw new RangeError(`[Money Error] Negative rupee amount not allowed: ${rupees}.`);
  }
  // Math.round((rupees + Number.EPSILON) * 100) avoids binary floating-point rounding errors
  const paise = Math.round((rupees + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError(`[Money Error] Amount exceeds safe integer bounds: ${rupees}.`);
  }
  return paise;
}

/**
 * Converts integer Paise into a human-readable Rupee number formatted to 2 decimal places.
 * e.g., 22000 -> 220.00, 18550 -> 185.50, 49999 -> 499.99, 1 -> 0.01
 *
 * @param {number} paise - Integer paise
 * @returns {number} Rupee amount
 */
export function paiseToRupees(paise) {
  if (typeof paise !== 'number' || !Number.isInteger(paise)) {
    throw new TypeError(`[Money Error] Invalid paise value: ${paise}. Must be an integer.`);
  }
  if (paise < 0) {
    throw new RangeError(`[Money Error] Negative paise value not allowed: ${paise}.`);
  }
  return Math.round(paise) / 100;
}

/**
 * Formats integer Paise into a human-readable INR currency string.
 * e.g., 22000 -> "₹220.00", 18550 -> "₹185.50"
 *
 * @param {number} paise - Integer paise
 * @returns {string} Formatted currency string
 */
export function formatPaiseToINR(paise) {
  const rupees = paiseToRupees(paise);
  return `₹${rupees.toFixed(2)}`;
}
