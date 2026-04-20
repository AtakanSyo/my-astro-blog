-- Telescopes catalog + user ratings
-- Run this in Supabase SQL Editor (or via Supabase CLI migrations).

create extension if not exists pgcrypto;

create table if not exists public.telescopes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  brand text not null,
  model text not null,
  telescope_type text not null,
  mount_type text,
  aperture_mm integer,
  focal_length_mm integer,
  f_ratio numeric(4,2),
  price_usd numeric(10,2),
  short_description text,
  image_url text,
  editorial_rating numeric(3,1) not null default 0.0,
  user_rating numeric(4,2) not null default 0.0,
  user_rating_count integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint telescopes_editorial_rating_range
    check (editorial_rating >= 0 and editorial_rating <= 10),
  constraint telescopes_user_rating_range
    check (user_rating >= 0 and user_rating <= 10),
  constraint telescopes_user_rating_count_nonnegative
    check (user_rating_count >= 0)
);

create table if not exists public.telescope_user_ratings (
  id uuid primary key default gen_random_uuid(),
  telescope_id uuid not null references public.telescopes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating numeric(3,1) not null,
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint telescope_user_ratings_rating_range
    check (rating >= 0 and rating <= 10),
  constraint telescope_user_ratings_unique_user_per_telescope
    unique (telescope_id, user_id)
);

create index if not exists idx_telescopes_slug on public.telescopes(slug);
create index if not exists idx_telescopes_brand on public.telescopes(brand);
create index if not exists idx_telescope_user_ratings_telescope_id
  on public.telescope_user_ratings(telescope_id);
create index if not exists idx_telescope_user_ratings_user_id
  on public.telescope_user_ratings(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_telescopes_set_updated_at on public.telescopes;
create trigger trg_telescopes_set_updated_at
before update on public.telescopes
for each row
execute function public.set_updated_at();

drop trigger if exists trg_telescope_user_ratings_set_updated_at on public.telescope_user_ratings;
create trigger trg_telescope_user_ratings_set_updated_at
before update on public.telescope_user_ratings
for each row
execute function public.set_updated_at();

create or replace function public.refresh_telescope_user_rating_aggregate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_telescope_id uuid;
begin
  target_telescope_id = coalesce(new.telescope_id, old.telescope_id);

  update public.telescopes t
  set
    user_rating = coalesce(agg.avg_rating, 0),
    user_rating_count = coalesce(agg.rating_count, 0)
  from (
    select
      r.telescope_id,
      round(avg(r.rating)::numeric, 2) as avg_rating,
      count(*)::int as rating_count
    from public.telescope_user_ratings r
    where r.telescope_id = target_telescope_id
    group by r.telescope_id
  ) agg
  where t.id = target_telescope_id
    and t.id = agg.telescope_id;

  if not found then
    update public.telescopes
    set user_rating = 0, user_rating_count = 0
    where id = target_telescope_id;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_refresh_telescope_user_rating_after_insert
  on public.telescope_user_ratings;
create trigger trg_refresh_telescope_user_rating_after_insert
after insert on public.telescope_user_ratings
for each row
execute function public.refresh_telescope_user_rating_aggregate();

drop trigger if exists trg_refresh_telescope_user_rating_after_update
  on public.telescope_user_ratings;
create trigger trg_refresh_telescope_user_rating_after_update
after update on public.telescope_user_ratings
for each row
execute function public.refresh_telescope_user_rating_aggregate();

drop trigger if exists trg_refresh_telescope_user_rating_after_delete
  on public.telescope_user_ratings;
create trigger trg_refresh_telescope_user_rating_after_delete
after delete on public.telescope_user_ratings
for each row
execute function public.refresh_telescope_user_rating_aggregate();

alter table public.telescopes enable row level security;
alter table public.telescope_user_ratings enable row level security;

drop policy if exists "telescopes_are_readable_by_everyone" on public.telescopes;
create policy "telescopes_are_readable_by_everyone"
on public.telescopes
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "only_authenticated_can_insert_ratings" on public.telescope_user_ratings;
create policy "only_authenticated_can_insert_ratings"
on public.telescope_user_ratings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users_can_update_own_ratings" on public.telescope_user_ratings;
create policy "users_can_update_own_ratings"
on public.telescope_user_ratings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users_can_delete_own_ratings" on public.telescope_user_ratings;
create policy "users_can_delete_own_ratings"
on public.telescope_user_ratings
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ratings_are_readable_by_everyone" on public.telescope_user_ratings;
create policy "ratings_are_readable_by_everyone"
on public.telescope_user_ratings
for select
to anon, authenticated
using (true);
