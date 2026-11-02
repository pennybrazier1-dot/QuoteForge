-- Public intake: return a contact display name, never expose workspace phone by default.
-- DROP required because RETURNS TABLE shape changes (Postgres cannot OR REPLACE that).
drop function if exists public.get_public_intake_workspace(text);

create function public.get_public_intake_workspace(p_slug text)
returns table (
  business_name text,
  phone text,
  trade_type text,
  contact_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_slug is null or length(trim(p_slug)) < 8 then
    return;
  end if;

  return query
  select
    w.business_name,
    null::text as phone,
    w.trade_type,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(w.business_name), ''),
      'your tradesperson'
    ) as contact_name
  from public.workspaces w
  left join lateral (
    select pr.full_name
    from public.profiles pr
    where pr.workspace_id = w.id
    order by pr.created_at asc nulls last
    limit 1
  ) p on true
  where w.public_enquiry_slug = lower(trim(p_slug))
  limit 1;
end;
$$;

revoke all on function public.get_public_intake_workspace(text) from public;
grant execute on function public.get_public_intake_workspace(text) to anon, authenticated;
