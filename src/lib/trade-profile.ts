import { supabase } from '@/lib/supabase';

/** What `trade_profile()` returns: everything about a trade that's meant to be public. */
export type TradeProfile = {
  business_name: string;
  bio: string;
  member_since: string | null;
  id_checked: boolean;
  insured_until: string | null;
  company_checked: boolean;
  registrations: string[];
  categories: string[];
  jobs_completed: number;
  rating: {
    count: number;
    overall: number | null;
    quality: number | null;
    reliability: number | null;
    tidiness: number | null;
    value: number | null;
  };
  reviews: {
    overall: number;
    quality: number;
    reliability: number;
    tidiness: number;
    value: number;
    comment: string;
    created_at: string;
    first_name: string;
    job_title: string | null;
    town: string | null;
  }[];
};

/** A trade's public profile, or null if they aren't an approved trade. */
export async function loadTradeProfile(tradeId: string): Promise<TradeProfile | null> {
  const { data, error } = await supabase.rpc('trade_profile', { p_trade_id: tradeId });
  if (error) throw error;
  return (data as TradeProfile | null) ?? null;
}
