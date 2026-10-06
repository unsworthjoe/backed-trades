-- The trade app's "My queues" screen. Trades can only read their own
-- queue_members rows, so they can't count the people ahead of them. This
-- returns their place in each queue without showing who else is in it.

create function public.my_queue_places()
returns table (
  queue_id uuid,
  town_name text,
  category_name text,
  status public.queue_member_status,
  -- Active members: 1 = front of the queue. Waiting list: 1 = next to join.
  place integer,
  -- People in the same list (active members, or the waiting list).
  list_size integer,
  cap integer,
  tuned_out boolean,
  consecutive_declines integer,
  -- Jobs posted for this town and trade in the last 30 days.
  jobs_last_30_days integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, t.name, c.name, me.status,
    (select count(*)::integer from public.queue_members o
      where o.queue_id = me.queue_id and o.status = me.status and o.position <= me.position),
    (select count(*)::integer from public.queue_members o
      where o.queue_id = me.queue_id and o.status = me.status),
    q.cap,
    me.tuned_out_at is not null,
    me.consecutive_declines,
    (select count(*)::integer from public.jobs j
      where j.town_id = q.town_id and j.category_id = q.category_id
        and j.created_at > now() - interval '30 days')
  from public.queue_members me
  join public.queues q on q.id = me.queue_id
  join public.towns t on t.id = q.town_id
  join public.trade_categories c on c.id = q.category_id
  where me.trade_id = auth.uid()
  order by me.status, t.name, c.sort_order
$$;

revoke execute on function public.my_queue_places() from public, anon;
grant execute on function public.my_queue_places() to authenticated;
