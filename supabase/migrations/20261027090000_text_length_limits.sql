-- Length limits on free-text fields, so one signed-in user can't store megabytes of text.
-- Each limit sits above what the app's own text boxes allow (job title 80, job description 2000,
-- business bio 600, messages 4000), so nobody meets them in normal use.
-- NOT VALID: checked for new and changed rows only, so rows saved before this can't block anything.

alter table public.profiles add constraint profiles_full_name_length check (char_length(full_name) <= 100) not valid;
alter table public.trades add constraint trades_business_name_length check (char_length(business_name) <= 120) not valid;
alter table public.trades add constraint trades_bio_length check (char_length(bio) <= 2000) not valid;
alter table public.trade_photos add constraint trade_photos_caption_length check (char_length(caption) <= 200) not valid;
alter table public.trade_registrations
  add constraint trade_registrations_number_length check (char_length(registration_number) <= 50) not valid;
alter table public.jobs add constraint jobs_title_length check (char_length(title) <= 150) not valid;
alter table public.jobs add constraint jobs_description_length check (char_length(description) <= 4000) not valid;
alter table public.job_addresses add constraint job_addresses_line_length check (char_length(address_line) <= 200) not valid;
alter table public.reviews add constraint reviews_comment_length check (char_length(comment) <= 4000) not valid;
alter table public.customer_ratings add constraint customer_ratings_comment_length check (char_length(comment) <= 4000) not valid;
alter table public.reports add constraint reports_reason_length check (char_length(reason) <= 200) not valid;
alter table public.reports add constraint reports_details_length check (char_length(details) <= 4000) not valid;
