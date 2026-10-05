import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type Application = {
  trade: Tables<'trades'> | null;
  categoryIds: number[];
  townIds: number[];
  /** The most recent insurance certificate uploaded. */
  insurance: Tables<'trade_documents'> | null;
  registrations: Tables<'trade_registrations'>[];
  /** The most recent ID check started. */
  idCheck: Tables<'id_checks'> | null;
  /** What's still missing, from the database's own check (see my_application_problems). */
  problems: string[];
};

/** The signed-in trade's application. Reloads whenever the screen comes back into view. */
export function useApplication() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [application, setApplication] = useState<Application | null>(null);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [trade, categories, towns, insurance, registrations, idCheck, problems] = await Promise.all([
      supabase.from('trades').select('*').eq('id', userId).maybeSingle(),
      supabase.from('trade_category_links').select('category_id').eq('trade_id', userId),
      supabase.from('trade_towns').select('town_id').eq('trade_id', userId),
      supabase
        .from('trade_documents')
        .select('*')
        .eq('trade_id', userId)
        .eq('doc_type', 'public_liability_insurance')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('trade_registrations').select('*').eq('trade_id', userId).order('created_at'),
      supabase
        .from('id_checks')
        .select('*')
        .eq('trade_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.rpc('my_application_problems'),
    ]);
    const failed = [trade, categories, towns, insurance, registrations, idCheck, problems].find((r) => r.error);
    if (failed) {
      setError(failed.error);
      return;
    }
    setError(null);
    setApplication({
      trade: trade.data,
      categoryIds: (categories.data ?? []).map((c) => c.category_id),
      townIds: (towns.data ?? []).map((t) => t.town_id),
      insurance: insurance.data,
      registrations: registrations.data ?? [],
      idCheck: idCheck.data,
      problems: problems.data ?? [],
    });
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { application, error, reload };
}

type ReferenceData = {
  categories: Tables<'trade_categories'>[];
  towns: Tables<'towns'>[];
};

let cachedReference: ReferenceData | null = null;

/** Trade categories and towns. They rarely change, so they're loaded once per app session. */
export function useReferenceData() {
  const [data, setData] = useState<ReferenceData | null>(cachedReference);

  useFocusEffect(
    useCallback(() => {
      if (cachedReference) return;
      Promise.all([
        supabase.from('trade_categories').select('*').eq('active', true).order('sort_order'),
        supabase.from('towns').select('*').eq('active', true).order('name'),
      ]).then(([categories, towns]) => {
        if (categories.error || towns.error) return;
        cachedReference = { categories: categories.data, towns: towns.data };
        setData(cachedReference);
      });
    }, []),
  );

  return data;
}
