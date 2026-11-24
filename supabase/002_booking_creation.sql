-- Run AFTER 001_initial.sql in Supabase SQL Editor. Safe to run again.
begin;

-- A simulated payment is never recorded as a real paid transaction.
alter table public.bookings add column if not exists demo_paid boolean not null default false;

-- Only occupancy is public. Guest names and user IDs remain protected by RLS.
create or replace function public.room_availability()
returns table (room_id uuid, check_in date, check_out date)
language sql stable security definer set search_path = ''
as $$
  select b.room_id, b.check_in, b.check_out
  from public.bookings b
  where b.status = 'confirmed'
    and b.check_out > (now() at time zone 'Europe/Kyiv')::date
    and b.check_in <= (now() at time zone 'Europe/Kyiv')::date + 31;
$$;
revoke all on function public.room_availability() from public, anon, authenticated;
grant execute on function public.room_availability() to anon, authenticated;

create or replace function public.create_booking(
  p_id uuid, p_room_id uuid, p_guest_name text,
  p_check_in date, p_check_out date,
  p_arrival_time time, p_departure_time time,
  p_payment_method text, p_expected_rate numeric
)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Kyiv')::date;
  v_rate numeric;
  v_booking public.bookings;
begin
  if v_user is null then raise exception 'SIGN_IN_REQUIRED' using errcode = '42501'; end if;
  if p_id is null then raise exception 'INVALID_BOOKING'; end if;

  -- Serialize retries of the same request (including a lost HTTP response).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  select * into v_booking from public.bookings where id = p_id;
  if found then
    if v_booking.user_id = v_user
      and v_booking.room_id = p_room_id
      and v_booking.guest_name = trim(p_guest_name)
      and v_booking.check_in = p_check_in and v_booking.check_out = p_check_out
      and v_booking.arrival_time = p_arrival_time and v_booking.departure_time = p_departure_time
      and v_booking.payment_method = p_payment_method then
      return v_booking;
    end if;
    raise exception 'REQUEST_ALREADY_USED';
  end if;

  if p_guest_name is null or length(trim(p_guest_name)) not between 1 and 100
    or p_check_in is null or p_check_out is null
    or p_check_in <= v_today or p_check_out > v_today + 31 or p_check_out <= p_check_in
    or p_arrival_time is null or p_arrival_time not in (time '14:00', time '16:00', time '18:00')
    or p_departure_time is null or p_departure_time not in (time '08:00', time '10:00', time '12:00')
    or p_payment_method is null or p_payment_method not in ('desk', 'online') then
    raise exception 'INVALID_BOOKING';
  end if;

  select price_per_night into v_rate from public.rooms
    where id = p_room_id and is_active = true for share;
  if not found then raise exception 'ROOM_UNAVAILABLE'; end if;
  if p_expected_rate is distinct from v_rate then raise exception 'PRICE_CHANGED'; end if;

  -- The existing exclusion constraint prevents overlapping concurrent reservations.
  insert into public.bookings (
    id, room_id, user_id, guest_name, check_in, check_out,
    arrival_time, departure_time, nightly_rate, payment_method, demo_paid
  ) values (
    p_id, p_room_id, v_user, trim(p_guest_name), p_check_in, p_check_out,
    p_arrival_time, p_departure_time, v_rate, p_payment_method, p_payment_method = 'online'
  ) returning * into v_booking;
  return v_booking;
end;
$$;
revoke all on function public.create_booking(uuid,uuid,text,date,date,time,time,text,numeric) from public, anon, authenticated;
grant execute on function public.create_booking(uuid,uuid,text,date,date,time,time,text,numeric) to authenticated;

-- No direct browser inserts/updates: owner, rate and payment flags come from the function.
revoke insert, update, delete on public.bookings from anon, authenticated;
commit;
