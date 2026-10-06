-- Messages, completion and reviews (build step 6). The engine already
-- handles marking done, signing off, blind reviews and customer ratings;
-- this adds the notifications around them and the trade's public profile.

-- ---------------------------------------------------------------------------
-- New message notifications
-- ---------------------------------------------------------------------------

-- Trades get a push for every message. Customers get a text, but at most one
-- per job every 30 minutes (texts cost money, and one tells them to look).
create function private.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.job_matches;
  v_customer_id uuid;
  v_recipient uuid;
begin
  select * into v_match from public.job_matches where id = new.match_id;
  select customer_id into v_customer_id from public.jobs where id = v_match.job_id;
  v_recipient := case when new.sender_id = v_match.trade_id then v_customer_id else v_match.trade_id end;

  if v_recipient = v_customer_id and exists (
    select 1 from public.notification_outbox
    where user_id = v_recipient and template = 'new_message'
      and data ->> 'match_id' = new.match_id::text
      and created_at > now() - interval '30 minutes'
  ) then
    return null;
  end if;

  perform private.notify(v_recipient, 'new_message',
    jsonb_build_object(
      'job_id', v_match.job_id,
      'match_id', new.match_id,
      'sender_name', (select full_name from public.profiles where id = new.sender_id),
      'preview', left(new.body, 120)
    ),
    now());
  return null;
end;
$$;

create trigger messages_notify after insert on public.messages
  for each row execute function private.notify_new_message();

-- ---------------------------------------------------------------------------
-- Tell the trade when a review of them goes public
-- ---------------------------------------------------------------------------

create function private.notify_review_released()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(new.trade_id, 'review_released',
    jsonb_build_object(
      'job_id', (select job_id from public.job_matches where id = new.match_id),
      'match_id', new.match_id,
      'overall', new.overall
    ),
    now());
  return null;
end;
$$;

create trigger reviews_notify_released after update of released_at on public.reviews
  for each row when (old.released_at is null and new.released_at is not null)
  execute function private.notify_review_released();

-- ---------------------------------------------------------------------------
-- A trade's profile: what customers see about who's doing their job
-- ---------------------------------------------------------------------------

-- Only approved trades. Reviews are the released, visible ones, with the
-- reviewer's first name only. Safe for anyone to call: everything in it is
-- meant to be public.
create function public.trade_profile(p_trade_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business_name', t.business_name,
    'bio', t.bio,
    'member_since', t.approved_at,
    'id_checked', exists (select 1 from public.id_checks where trade_id = t.id and result = 'passed'),
    'insured_until', (
      select max(expires_on) from public.trade_documents
      where trade_id = t.id and doc_type = 'public_liability_insurance' and status = 'approved'
    ),
    'company_checked', t.company_checked_at is not null,
    'registrations', coalesce((
      select jsonb_agg(r.scheme order by r.scheme) from public.trade_registrations r
      where r.trade_id = t.id and r.status = 'approved'
        and (r.expires_on is null or r.expires_on >= (now() at time zone 'Europe/London')::date)
    ), '[]'),
    'categories', coalesce((
      select jsonb_agg(c.name order by c.sort_order) from public.trade_category_links l
      join public.trade_categories c on c.id = l.category_id
      where l.trade_id = t.id
    ), '[]'),
    'jobs_completed', (
      select count(*) from public.job_matches m
      where m.trade_id = t.id and m.ended_at is null and private.match_completed_at(m) is not null
    ),
    'rating', (
      select jsonb_build_object(
        'count', count(*),
        'overall', round(avg(overall), 1),
        'quality', round(avg(quality), 1),
        'reliability', round(avg(reliability), 1),
        'tidiness', round(avg(tidiness), 1),
        'value', round(avg(value), 1)
      )
      from public.reviews
      where trade_id = t.id and released_at is not null and hidden_at is null
    ),
    'reviews', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select r.overall, r.quality, r.reliability, r.tidiness, r.value, r.comment, r.created_at,
          split_part(p.full_name, ' ', 1) as first_name,
          j.title as job_title,
          tw.name as town
        from public.reviews r
        join public.profiles p on p.id = r.customer_id
        join public.job_matches m on m.id = r.match_id
        join public.jobs j on j.id = m.job_id
        join public.towns tw on tw.id = j.town_id
        where r.trade_id = t.id and r.released_at is not null and r.hidden_at is null
        order by r.created_at desc
        limit 20
      ) x
    ), '[]')
  )
  from public.trades t
  where t.id = p_trade_id and t.status = 'approved'
$$;

revoke execute on function public.trade_profile(uuid) from public;
grant execute on function public.trade_profile(uuid) to anon, authenticated;
