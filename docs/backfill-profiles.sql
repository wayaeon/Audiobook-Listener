-- Run this in Supabase SQL Editor to fix missing profiles and set yourself as admin.
-- Replace 'waya.aeon@gmail.com' with your actual email.

-- 1. Create profile rows for any auth user that doesn't have one
insert into public.profiles (id, role)
select u.id, 'user'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 2. Set yourself as admin
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'waya.aeon@gmail.com');
