-- Liverpool, Winsford and Northwich join Runcorn, Widnes and Warrington.
--
-- Each town needs its postcode districts (so a customer's postcode finds it), a queue for every
-- trade category (so trades can join), and its neighbouring towns (jobs and call-outs reach
-- neighbouring queues when the home queue runs short). New towns are active straight away:
-- customers can post jobs there and trades can pick them as areas.
--
-- Postcode districts: Winsford is CW7; Northwich is CW8 and CW9; Liverpool is the city districts
-- L1 to L19 plus L24 and L25. More districts can be added later with another insert; the wider
-- Merseyside districts (L20 to L23, L26 to L40) are left out for now.

insert into public.towns (slug, name) values
  ('liverpool', 'Liverpool'),
  ('winsford', 'Winsford'),
  ('northwich', 'Northwich');

insert into public.postcode_districts (district, town_id)
select d.district, t.id
from (values
  ('CW7', 'winsford'),
  ('CW8', 'northwich'),
  ('CW9', 'northwich'),
  ('L1', 'liverpool'), ('L2', 'liverpool'), ('L3', 'liverpool'), ('L4', 'liverpool'), ('L5', 'liverpool'),
  ('L6', 'liverpool'), ('L7', 'liverpool'), ('L8', 'liverpool'), ('L9', 'liverpool'), ('L10', 'liverpool'),
  ('L11', 'liverpool'), ('L12', 'liverpool'), ('L13', 'liverpool'), ('L14', 'liverpool'), ('L15', 'liverpool'),
  ('L16', 'liverpool'), ('L17', 'liverpool'), ('L18', 'liverpool'), ('L19', 'liverpool'),
  ('L24', 'liverpool'), ('L25', 'liverpool')
) as d (district, town_slug)
join public.towns t on t.slug = d.town_slug;

insert into public.queues (town_id, category_id)
select t.id, c.id
from public.towns t cross join public.trade_categories c
where t.slug in ('liverpool', 'winsford', 'northwich');

-- Neighbours are stored both ways round. Liverpool sits next to Widnes and Runcorn; Northwich and
-- Winsford sit next to each other, Runcorn and Warrington. The original three stay neighbours of
-- each other.
with pairs (a_slug, b_slug) as (values
  ('liverpool', 'widnes'),
  ('liverpool', 'runcorn'),
  ('northwich', 'winsford'),
  ('northwich', 'runcorn'),
  ('northwich', 'warrington'),
  ('winsford', 'runcorn'),
  ('winsford', 'warrington')
)
insert into public.town_neighbours (town_id, neighbour_id)
select a.id, b.id
from pairs p
join public.towns a on a.slug = p.a_slug
join public.towns b on b.slug = p.b_slug
union
select b.id, a.id
from pairs p
join public.towns a on a.slug = p.a_slug
join public.towns b on b.slug = p.b_slug;
