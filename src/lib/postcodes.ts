import { supabase } from '@/lib/supabase';

export type PostcodeCheck =
  | { ok: true; postcode: string; district: string; town: string }
  | { ok: false; reason: 'invalid' | 'not_covered' | 'unavailable'; postcode?: string };

/**
 * Checks a UK postcode exists (postcodes.io, free) and that Backed. covers its district. If
 * postcodes.io is down, we fall back to a format check so customers aren't blocked.
 */
export async function checkPostcode(input: string): Promise<PostcodeCheck> {
  const compact = input.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) return { ok: false, reason: 'invalid' };

  let postcode = `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  let district = compact.slice(0, -3);
  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`);
    if (response.status === 404) return { ok: false, reason: 'invalid' };
    if (response.ok) {
      const { result } = (await response.json()) as { result: { postcode: string; outcode: string } };
      postcode = result.postcode;
      district = result.outcode;
    }
  } catch {
    // postcodes.io unreachable: carry on with the format check.
  }

  const { data, error } = await supabase
    .from('postcode_districts')
    .select('towns(name)')
    .eq('district', district)
    .maybeSingle();
  if (error) return { ok: false, reason: 'unavailable', postcode };
  if (!data?.towns) return { ok: false, reason: 'not_covered', postcode };
  return { ok: true, postcode, district, town: data.towns.name };
}
