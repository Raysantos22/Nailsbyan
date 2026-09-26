-- =====================================================================
-- Storage bucket for logo, gallery, staff photos and the payment QR code,
-- plus the scheduled job that auto-cancels unpaid bookings.
--
-- Files are stored under "<business_id>/<folder>/<file>" so the policies
-- can check the uploader is an admin of that business.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do nothing;

-- Is the current user an admin of the business that owns this object path?
-- (Strict UUID check first so a malformed path is denied, not an error.)
create or replace function public.is_media_path_admin(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_folder text := split_part(coalesce(p_name, ''), '/', 1);
begin
  if v_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_business_admin(v_folder::uuid);
end;
$$;
grant execute on function public.is_media_path_admin(text) to anon, authenticated;

-- Public bucket: anyone can fetch files by public URL (no select policy
-- needed for that). Admins can list/upload/replace/delete their own files.
create policy "media: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and public.is_media_path_admin(name));
create policy "media: admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.is_media_path_admin(name));
create policy "media: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_media_path_admin(name))
  with check (bucket_id = 'media' and public.is_media_path_admin(name));
create policy "media: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.is_media_path_admin(name));

-- ---------------------------------------------------------------------
-- Auto-expire unpaid bookings every 15 minutes with pg_cron (available on
-- Supabase Cloud and local). If pg_cron is unavailable, schedule the
-- expire-unpaid-bookings edge function instead (see README).
-- Availability already ignores stale pending bookings, so slots free up
-- on time even between runs.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'expire-unpaid-bookings',
      '*/15 * * * *',
      'select public.expire_unpaid_bookings();'
    );
  else
    raise notice 'pg_cron not available — schedule the expire-unpaid-bookings edge function instead.';
  end if;
end;
$$;
