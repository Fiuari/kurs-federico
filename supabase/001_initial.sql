-- Execute the entire file in the project's SQL Editor.
-- Initial schema: one row represents one individually bookable room.
begin;

create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 1 and 100),
  description text not null default '',
  price_per_night numeric(10,2) not null check (price_per_night > 0),
  image_file text not null,
  image_alt text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  guest_name text not null check (length(trim(guest_name)) between 1 and 100),
  check_in date not null,
  check_out date not null,
  arrival_time time not null default '14:00',
  departure_time time not null default '12:00',
  nightly_rate numeric(10,2) not null check (nightly_rate > 0),
  total_amount numeric(12,2) generated always as ((check_out - check_in) * nightly_rate) stored,
  payment_method text not null check (payment_method in ('desk', 'online')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint booking_dates_valid check (check_out > check_in),
  constraint bookings_no_overlap exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status = 'confirmed')
);

create index if not exists bookings_user_id_idx on public.bookings(user_id);

alter table public.rooms enable row level security;
alter table public.bookings enable row level security;

-- Browser access for this setup step is read-only.
-- Booking creation and administrator writes will get explicit server-side rules later.
revoke all on public.rooms from anon, authenticated;
revoke all on public.bookings from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.rooms to anon, authenticated;
grant select on public.bookings to authenticated;

drop policy if exists rooms_public_read on public.rooms;
create policy rooms_public_read on public.rooms
  for select to anon, authenticated using (is_active = true);

drop policy if exists bookings_owner_read on public.bookings;
create policy bookings_owner_read on public.bookings
  for select to authenticated using ((select auth.uid()) = user_id);

-- Seed rooms follows. Rerunning preserves any existing room edits.

insert into public.rooms (slug, name, description, price_per_night, image_file, image_alt) values
('superior-twin', 'Superior Twin', 'Explore the Superior Twin at BankHotel in Lviv, with views of the historic city and a marble bathroom.', '3200', 'roomonemain.png', 'Superior Twin bedroom with an upholstered headboard and a pendant lamp'),
('deluxe-double', 'Deluxe Double', 'Deluxe Double at BankHotel in Lviv, a comfortable room for couples or friends.', '4100', 'roomtwomain.webp', 'Deluxe Double interior'),
('presidential-suite', 'Presidential Suite', 'Explore the Presidential Suite with a separate bedroom, living area and private bathroom.', '7800', 'roomthreemain.webp', 'Presidential Suite interior'),
('cozy-single', 'Cozy Single', 'Discover the Cozy Single, a peaceful room for a solo stay at BankHotel in Lviv.', '2400', 'roomfourmain.jpg', 'Cozy Single interior')
on conflict (slug) do nothing;

commit;

select id, name, price_per_night from public.rooms order by price_per_night;
