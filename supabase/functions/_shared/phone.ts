/**
 * Turns a UK mobile number as people type it ("07700 900123", "+44 7700 900123") into
 * international digits without the "+" ("447700900123"), or null if it isn't a UK mobile.
 */
export function normaliseUkMobile(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, '').replace(/^\+/, '').replace(/^0044/, '44').replace(/^07/, '447');
  return /^447\d{9}$/.test(digits) ? digits : null;
}
