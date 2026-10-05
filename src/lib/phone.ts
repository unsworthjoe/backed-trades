/** "447700900123", "+447700900123" or "07700900123" -> "07700 900123" (anything else is left as is). */
export function formatUkPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '').replace(/^44/, '0');
  return /^0\d{10}$/.test(digits) ? `${digits.slice(0, 5)} ${digits.slice(5)}` : phone;
}

/** A tel: link that works from anywhere: "tel:+447700900123". */
export function telLink(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '').replace(/^0/, '44');
  return `tel:+${digits}`;
}
