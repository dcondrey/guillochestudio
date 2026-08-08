-- Storage bucket for signed pattern exports (per-user path isolation).
-- Referenced by apps/web/src/routes/api/exports/create/+server.ts (upload)
-- and .../exports/[id]/status/+server.ts (createSignedUrl), which predates
-- this migration but had no bucket backing it.
insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload own exports" on storage.objects;
create policy "Users can upload own exports"
    on storage.objects for insert
    with check (
        bucket_id = 'exports'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "Users can read own exports" on storage.objects;
create policy "Users can read own exports"
    on storage.objects for select
    using (
        bucket_id = 'exports'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "Users can delete own exports" on storage.objects;
create policy "Users can delete own exports"
    on storage.objects for delete
    using (
        bucket_id = 'exports'
        and (storage.foldername(name))[1] = auth.uid()::text
    );
