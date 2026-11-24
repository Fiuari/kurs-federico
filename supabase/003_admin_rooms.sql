-- Run once after 001_initial.sql and 002_booking_creation.sql. Rerunnable.
begin;

-- Membership can be changed only by the database owner, never from the website.
create table if not exists public.hotel_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.hotel_admins enable row level security;
revoke all on public.hotel_admins from public, anon, authenticated;

create or replace function public.is_hotel_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.hotel_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_hotel_admin() from public, anon, authenticated;
grant execute on function public.is_hotel_admin() to authenticated;

alter table public.rooms enable row level security;
drop policy if exists rooms_admin_read on public.rooms;
create policy rooms_admin_read on public.rooms for select to authenticated
  using ((select public.is_hotel_admin()));
drop policy if exists rooms_admin_insert on public.rooms;
create policy rooms_admin_insert on public.rooms for insert to authenticated
  with check ((select public.is_hotel_admin()));
drop policy if exists rooms_admin_update on public.rooms;
create policy rooms_admin_update on public.rooms for update to authenticated
  using ((select public.is_hotel_admin())) with check ((select public.is_hotel_admin()));
drop policy if exists rooms_admin_delete on public.rooms;
create policy rooms_admin_delete on public.rooms for delete to authenticated
  using ((select public.is_hotel_admin()));

revoke insert, update, delete on public.rooms from anon, authenticated;
grant insert (id, slug, name, description, price_per_night, image_file, image_alt, is_active)
  on public.rooms to authenticated;
-- Keep existing booking links, IDs and creation timestamps stable.
grant update (name, description, price_per_night, image_file, image_alt, is_active)
  on public.rooms to authenticated;
grant delete on public.rooms to authenticated;

-- Existing FK bookings.room_id ON DELETE RESTRICT protects reservation history.
commit;
