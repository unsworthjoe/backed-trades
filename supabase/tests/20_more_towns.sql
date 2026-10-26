-- Liverpool, Winsford and Northwich: postcodes find them, every trade has a queue there, and the
-- neighbours are the ones intended.

begin;
select plan(11);

select is((select t.slug from public.postcode_districts pd join public.towns t on t.id = pd.town_id
           where pd.district = public.postcode_district('CW7 1AB')), 'winsford', 'CW7 is Winsford');
select is((select count(*)::integer from public.postcode_districts pd join public.towns t on t.id = pd.town_id
           where t.slug = 'northwich' and pd.district in ('CW8', 'CW9')), 2, 'CW8 and CW9 are Northwich');
select is((select t.slug from public.postcode_districts pd join public.towns t on t.id = pd.town_id
           where pd.district = public.postcode_district('L1 8JQ')), 'liverpool', 'L1 is Liverpool');
select is((select t.slug from public.postcode_districts pd join public.towns t on t.id = pd.town_id
           where pd.district = public.postcode_district('L17 2AB')), 'liverpool', 'L17 is Liverpool');
select is((select count(*)::integer from public.postcode_districts pd join public.towns t on t.id = pd.town_id
           where t.slug = 'liverpool'), 40, 'Liverpool has every district from L1 to L40');
select is((select t.name from public.postcode_districts pd join public.towns t on t.id = pd.town_id
           where pd.district = public.postcode_district('L20 7AB')), 'Liverpool', 'Bootle (L20) shows as Liverpool');
select is((select t.name from public.postcode_districts pd join public.towns t on t.id = pd.town_id
           where pd.district = public.postcode_district('L32 5AB')), 'Liverpool', 'Kirkby (L32) shows as Liverpool');
select is((select t.name from public.postcode_districts pd join public.towns t on t.id = pd.town_id
           where pd.district = public.postcode_district('L36 2AB')), 'Liverpool', 'Huyton (L36) shows as Liverpool');

select is((select count(*)::integer from public.queues q join public.towns t on t.id = q.town_id
           where t.slug in ('liverpool', 'winsford', 'northwich')),
  (select count(*)::integer from public.trade_categories) * 3, 'a queue for every category in each new town');

select is((select count(*)::integer from public.town_neighbours tn
           join public.towns a on a.id = tn.town_id join public.towns b on b.id = tn.neighbour_id
           where (a.slug, b.slug) in (('liverpool', 'widnes'), ('widnes', 'liverpool'))), 2, 'Liverpool and Widnes neighbour each other');
select is((select count(*)::integer from public.town_neighbours tn
           join public.towns a on a.id = tn.town_id join public.towns b on b.id = tn.neighbour_id
           where a.slug = 'liverpool' and b.slug in ('warrington', 'northwich', 'winsford')), 0, 'Liverpool isn''t a neighbour of the Cheshire towns');

select * from finish();
rollback;
