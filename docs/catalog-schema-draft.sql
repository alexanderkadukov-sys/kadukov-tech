-- Draft schema only. Apply to a NEW, dedicated test project after review.
-- No customer data, no supplier costs, no credentials.
begin;
create table public.catalog_products (
 id uuid primary key default gen_random_uuid(),
 sku text not null check (length(btrim(sku)) between 1 and 80),
 name text not null check (length(btrim(name)) between 1 and 160),
 catalog text not null check (catalog in ('electronics','parts')),
 category text not null check (length(btrim(category)) between 1 and 80),
 brand text not null default '' check (length(brand)<=80),
 compatibility text not null default '' check (length(compatibility)<=300),
 description text not null default '' check (length(description)<=1500),
 price_rub integer check (price_rub between 0 and 100000000),
 stock_status text not null default 'unknown' check (stock_status in ('unknown','in_stock','on_order','out_of_stock')),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index catalog_products_sku_unique on public.catalog_products(lower(btrim(sku)));
create index catalog_products_browse_idx on public.catalog_products(catalog,category) where published;
alter table public.catalog_products enable row level security;
revoke all on public.catalog_products from public,anon,authenticated;
grant select on public.catalog_products to anon;
grant select,insert,update,delete on public.catalog_products to authenticated;
create policy public_catalog_read on public.catalog_products for select to anon,authenticated using (published);
-- Roles must be assigned by a trusted server administrator, never user_metadata.
-- Administrator must have a verified MFA session (aal2) to view drafts or mutate records.
create policy admin_catalog_read on public.catalog_products for select to authenticated using (
 (select auth.jwt()->'app_metadata'->>'catalog_role')='admin' and (select auth.jwt()->>'aal')='aal2');
create policy admin_catalog_insert on public.catalog_products for insert to authenticated with check (
 (select auth.jwt()->'app_metadata'->>'catalog_role')='admin' and (select auth.jwt()->>'aal')='aal2');
create policy admin_catalog_update on public.catalog_products for update to authenticated using (
 (select auth.jwt()->'app_metadata'->>'catalog_role')='admin' and (select auth.jwt()->>'aal')='aal2') with check (
 (select auth.jwt()->'app_metadata'->>'catalog_role')='admin' and (select auth.jwt()->>'aal')='aal2');
create policy admin_catalog_delete on public.catalog_products for delete to authenticated using (
 (select auth.jwt()->'app_metadata'->>'catalog_role')='admin' and (select auth.jwt()->>'aal')='aal2');
create function public.catalog_set_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
revoke execute on function public.catalog_set_updated_at() from public,anon,authenticated;
create trigger catalog_products_updated before update on public.catalog_products for each row execute function public.catalog_set_updated_at();
commit;
