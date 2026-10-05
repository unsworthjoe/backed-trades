import { supabase } from '@/lib/supabase';

/**
 * Saves a trade's picks (categories or towns) by adding and removing only what changed. Approved
 * trades are then re-synced with their queues: new picks join at the back, removed ones leave.
 */
export async function saveChoices(
  table: 'trade_category_links' | 'trade_towns',
  tradeId: string,
  saved: number[],
  chosen: number[],
  approved: boolean,
) {
  const column = table === 'trade_category_links' ? 'category_id' : 'town_id';
  const removed = saved.filter((id) => !chosen.includes(id));
  const added = chosen.filter((id) => !saved.includes(id));

  if (removed.length) {
    const { error } = await supabase.from(table).delete().eq('trade_id', tradeId).in(column, removed);
    if (error) throw error;
  }
  if (added.length) {
    const rows = added.map((id) => ({ trade_id: tradeId, [column]: id }));
    const { error } =
      table === 'trade_category_links'
        ? await supabase.from(table).insert(rows as { trade_id: string; category_id: number }[])
        : await supabase.from(table).insert(rows as { trade_id: string; town_id: number }[]);
    if (error) throw error;
  }
  if (approved && (removed.length || added.length)) {
    const { error } = await supabase.rpc('sync_my_queues');
    if (error) throw error;
  }
}
