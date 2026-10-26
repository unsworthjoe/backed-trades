-- Limits on what can be uploaded: 10 MB a file, and only the kinds of file the app asks for
-- (photos, and PDFs for insurance and other documents). Before this, a signed-in user could put
-- any file of any size up to the project's 50 MB ceiling into their own folder.
-- The type is the one the uploader declares, so this stops accidents and casual abuse, not a
-- determined attacker; the size limit holds either way.

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
where id = 'trade-documents';

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id in ('id-checks', 'trade-photos', 'job-photos');
