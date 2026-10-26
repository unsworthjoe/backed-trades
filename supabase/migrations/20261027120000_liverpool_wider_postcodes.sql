-- The rest of the Liverpool postcodes: L20 to L23 (Bootle, Crosby and others) and L26 to L40
-- (Halewood, Kirkby, Huyton, Prescot and others). They count as Liverpool: a customer who enters
-- one of these postcodes sees "Liverpool", and the job goes to Liverpool's queues. No new towns are
-- listed on the site; people in these areas think of Liverpool.

insert into public.postcode_districts (district, town_id)
select 'L' || n, t.id
from generate_series(20, 40) as n
join public.towns t on t.slug = 'liverpool'
where n not in (24, 25);
