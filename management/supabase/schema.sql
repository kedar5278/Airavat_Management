-- Run once in the Supabase SQL Editor before deploying the Next.js app.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.guards enable row level security;
alter table public.admin_devices enable row level security;

drop policy if exists "admin can verify own admin record" on public.admin_users;
create policy "admin can verify own admin record" on public.admin_users for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "admin manages guards" on public.guards;
create policy "admin manages guards" on public.guards for all to authenticated using (public.is_app_admin() and public.has_active_admin_device()) with check (public.is_app_admin() and public.has_active_admin_device());
create policy "guard reads own profile" on public.guards for select to authenticated using (
  status = 'Active'
  and right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10)
      = right(regexp_replace(coalesce((select auth.jwt() ->> 'phone'), ''), '\\D', '', 'g'), 10)
);
create policy "admin manages invoices" on public.invoices for all to authenticated using (public.is_app_admin() and public.has_active_admin_device()) with check (public.is_app_admin() and public.has_active_admin_device());
drop policy if exists "admin manages own device slots" on public.admin_devices;
create policy "admin manages own device slots" on public.admin_devices for select to authenticated using (user_id = (select auth.uid()) and public.is_app_admin());

create or replace function public.claim_admin_device(p_device_id text, p_device_name text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid(); v_count integer;
begin
  if v_user is null or not exists (select 1 from public.admin_users where user_id = v_user) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_device_id is null or length(p_device_id) < 16 or length(p_device_id) > 100 then
    raise exception 'Invalid device identifier' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  delete from public.admin_devices where user_id = v_user and expires_at <= now();
  if exists (select 1 from public.admin_devices where user_id = v_user and device_id = p_device_id) then
    update public.admin_devices set device_name = left(coalesce(p_device_name, 'Browser'), 120), last_seen = now(), expires_at = now() + interval '90 seconds'
    where user_id = v_user and device_id = p_device_id;
    return jsonb_build_object('allowed', true, 'active_devices', (select count(*) from public.admin_devices where user_id = v_user));
  end if;
  select count(*) into v_count from public.admin_devices where user_id = v_user and expires_at > now();
  if v_count >= 2 then return jsonb_build_object('allowed', false, 'active_devices', v_count); end if;
  insert into public.admin_devices(user_id, device_id, device_name, last_seen, expires_at)
  values (v_user, p_device_id, left(coalesce(p_device_name, 'Browser'), 120), now(), now() + interval '90 seconds');
  return jsonb_build_object('allowed', true, 'active_devices', v_count + 1);
end;
$$;

create or replace function public.heartbeat_admin_device(p_device_id text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid(); v_updated integer;
begin
  if v_user is null or not exists (select 1 from public.admin_users where user_id = v_user) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  update public.admin_devices set last_seen = now(), expires_at = now() + interval '90 seconds'
  where user_id = v_user and device_id = p_device_id and expires_at > now();
  get diagnostics v_updated = row_count;
  return jsonb_build_object('allowed', v_updated = 1);
end;
$$;

create or replace function public.release_admin_device(p_device_id text)
returns void language sql security definer set search_path = public, pg_temp
as $$ delete from public.admin_devices where user_id = auth.uid() and device_id = p_device_id $$;

-- Private bucket: photos are served using short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guard-photos', 'guard-photos', false, 4000000, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 4000000, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "admin reads guard photos" on storage.objects;
create policy "admin reads guard photos" on storage.objects for select to authenticated using (bucket_id = 'guard-photos' and public.is_app_admin() and public.has_active_admin_device());
drop policy if exists "admin uploads guard photos" on storage.objects;
create policy "admin uploads guard photos" on storage.objects for insert to authenticated with check (bucket_id = 'guard-photos' and public.is_app_admin() and public.has_active_admin_device());
drop policy if exists "admin updates guard photos" on storage.objects;
create policy "admin updates guard photos" on storage.objects for update to authenticated using (bucket_id = 'guard-photos' and public.is_app_admin() and public.has_active_admin_device()) with check (bucket_id = 'guard-photos' and public.is_app_admin() and public.has_active_admin_device());
drop policy if exists "admin deletes guard photos" on storage.objects;
create policy "admin deletes guard photos" on storage.objects for delete to authenticated using (bucket_id = 'guard-photos' and public.is_app_admin() and public.has_active_admin_device());

-- After creating the single admin in Supabase Authentication > Users, replace the email below.
insert into public.admin_users(user_id)
  select id from auth.users where lower(email) = lower('admin@example.com')
on conflict (user_id) do nothing;

grant usage on schema public to authenticated;
grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.guards to authenticated;
grant select on public.admin_devices to authenticated;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.has_active_admin_device() to authenticated;
grant execute on function public.claim_admin_device(text,text) to authenticated;
grant execute on function public.heartbeat_admin_device(text) to authenticated;
grant execute on function public.release_admin_device(text) to authenticated;
