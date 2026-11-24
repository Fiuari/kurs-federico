-- Copy your User UID from Supabase > Authentication > Users.
-- Replace the placeholder below, then run this file in SQL Editor.
-- Do not use an email address here. This is not part of the browser application.
insert into public.hotel_admins (user_id)
values ('f75eef5c-09d7-410f-97eb-b32faac683d4'::uuid)
on conflict (user_id) do nothing;
