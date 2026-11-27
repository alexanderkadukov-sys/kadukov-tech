-- Applied to KADUKOV-TECH. Bucket remains private. Only photos of published products may be read publicly.
create policy catalog_photos_published_read on storage.objects for select to anon,authenticated using (
 bucket_id='catalog-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[1-5][.]jpg$'
 and exists (select 1 from public.catalog_products p where p.id::text=split_part(storage.objects.name,'/',1) and p.published=true)
);
