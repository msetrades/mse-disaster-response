-- ReliefGrid schema. Apply only to the approved MSE Product Suite Supabase project.
create schema if not exists reliefgrid;
revoke all on schema reliefgrid from anon, public;
grant usage on schema reliefgrid to authenticated;

create table if not exists reliefgrid.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  region text not null default '' check (char_length(region) <= 120),
  team_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists reliefgrid.organization_members (
  organization_id uuid not null references reliefgrid.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists reliefgrid_members_user_idx on reliefgrid.organization_members(user_id, organization_id);

create table if not exists reliefgrid.incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references reliefgrid.organizations(id) on delete cascade,
  code text not null default ('RG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  title text not null check (char_length(title) between 3 and 140),
  hazard text not null check (char_length(hazard) between 2 and 60),
  region text not null check (char_length(region) between 2 and 140),
  severity smallint not null default 2 check (severity between 1 and 5),
  status text not null default 'active' check (status in ('active', 'contained', 'resolved')),
  lead text not null default '' check (char_length(lead) <= 100),
  brief text not null default '' check (char_length(brief) <= 800),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);
create index if not exists reliefgrid_incidents_org_status_idx on reliefgrid.incidents(organization_id, status, created_at desc);

create table if not exists reliefgrid.resource_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references reliefgrid.organizations(id) on delete cascade,
  incident_id uuid not null,
  category text not null check (char_length(category) between 2 and 80),
  quantity integer not null check (quantity between 1 and 1000000),
  unit text not null check (char_length(unit) between 1 and 24),
  priority text not null default 'high' check (priority in ('routine', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'partially_fulfilled', 'fulfilled')),
  details text not null default '' check (char_length(details) <= 500),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (incident_id, organization_id) references reliefgrid.incidents(id, organization_id) on delete cascade
);
create index if not exists reliefgrid_requests_org_status_idx on reliefgrid.resource_requests(organization_id, status, priority, created_at desc);

create table if not exists reliefgrid.resource_inventory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references reliefgrid.organizations(id) on delete cascade,
  category text not null check (char_length(category) between 2 and 80),
  label text not null check (char_length(label) between 2 and 120),
  quantity_available integer not null default 0 check (quantity_available between 0 and 1000000),
  unit text not null check (char_length(unit) between 1 and 24),
  region text not null default '' check (char_length(region) <= 140),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index if not exists reliefgrid_inventory_org_cat_idx on reliefgrid.resource_inventory(organization_id, category, quantity_available desc);

create table if not exists reliefgrid.allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references reliefgrid.organizations(id) on delete cascade,
  request_id uuid not null,
  inventory_id uuid not null,
  quantity integer not null check (quantity > 0),
  allocated_by uuid not null default auth.uid() references auth.users(id),
  allocated_at timestamptz not null default now(),
  foreign key (request_id, organization_id) references reliefgrid.resource_requests(id, organization_id) on delete cascade,
  foreign key (inventory_id, organization_id) references reliefgrid.resource_inventory(id, organization_id) on delete cascade
);
create index if not exists reliefgrid_allocations_request_idx on reliefgrid.allocations(organization_id, request_id);

create or replace function reliefgrid.is_org_member(p_org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from reliefgrid.organization_members m where m.organization_id = p_org_id and m.user_id = (select auth.uid()));
$$;
revoke all on function reliefgrid.is_org_member(uuid) from public, anon;
grant execute on function reliefgrid.is_org_member(uuid) to authenticated;

create or replace function reliefgrid.create_organization(p_name text, p_region text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_name)) not between 2 and 100 then raise exception 'Workspace name must be 2 to 100 characters'; end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into reliefgrid.organizations(name, region, team_code, created_by) values (trim(p_name), coalesce(trim(p_region), ''), v_code, auth.uid()) returning id into v_id;
  insert into reliefgrid.organization_members(organization_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end;
$$;
revoke all on function reliefgrid.create_organization(text,text) from public, anon;
grant execute on function reliefgrid.create_organization(text,text) to authenticated;

create or replace function reliefgrid.join_organization(p_team_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into v_id from reliefgrid.organizations where team_code = upper(trim(p_team_code));
  if v_id is null then raise exception 'Workspace code not found'; end if;
  insert into reliefgrid.organization_members(organization_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  return v_id;
end;
$$;
revoke all on function reliefgrid.join_organization(text) from public, anon;
grant execute on function reliefgrid.join_organization(text) to authenticated;

-- Lock the request and each stock row so concurrent responders cannot over-allocate inventory.
create or replace function reliefgrid.allocate_request(p_request_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_req reliefgrid.resource_requests%rowtype; v_already integer; v_remaining integer; v_take integer; v_total integer := 0; v_stock reliefgrid.resource_inventory%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_req from reliefgrid.resource_requests where id = p_request_id for update;
  if not found or not reliefgrid.is_org_member(v_req.organization_id) then raise exception 'Request unavailable'; end if;
  select coalesce(sum(quantity), 0)::integer into v_already from reliefgrid.allocations where request_id = p_request_id;
  v_remaining := greatest(v_req.quantity - v_already, 0);
  if v_remaining = 0 then return 0; end if;
  for v_stock in
    select * from reliefgrid.resource_inventory
    where organization_id = v_req.organization_id and category = v_req.category and quantity_available > 0
    order by created_at, id for update skip locked
  loop
    exit when v_remaining = 0;
    v_take := least(v_remaining, v_stock.quantity_available);
    update reliefgrid.resource_inventory set quantity_available = quantity_available - v_take, updated_at = now(), updated_by = auth.uid() where id = v_stock.id;
    insert into reliefgrid.allocations(organization_id, request_id, inventory_id, quantity, allocated_by)
      values (v_req.organization_id, v_req.id, v_stock.id, v_take, auth.uid());
    v_remaining := v_remaining - v_take;
    v_total := v_total + v_take;
  end loop;
  select coalesce(sum(quantity), 0)::integer into v_already from reliefgrid.allocations where request_id = p_request_id;
  update reliefgrid.resource_requests set status = case when v_already >= quantity then 'fulfilled' when v_already > 0 then 'partially_fulfilled' else 'open' end where id = p_request_id;
  return v_total;
end;
$$;
revoke all on function reliefgrid.allocate_request(uuid) from public, anon;
grant execute on function reliefgrid.allocate_request(uuid) to authenticated;

alter table reliefgrid.organizations enable row level security;
alter table reliefgrid.organization_members enable row level security;
alter table reliefgrid.incidents enable row level security;
alter table reliefgrid.resource_requests enable row level security;
alter table reliefgrid.resource_inventory enable row level security;
alter table reliefgrid.allocations enable row level security;

create policy "members read workspaces" on reliefgrid.organizations for select to authenticated using (reliefgrid.is_org_member(id));
create policy "members read roster" on reliefgrid.organization_members for select to authenticated using (reliefgrid.is_org_member(organization_id));
create policy "members read incidents" on reliefgrid.incidents for select to authenticated using (reliefgrid.is_org_member(organization_id));
create policy "members create incidents" on reliefgrid.incidents for insert to authenticated with check (reliefgrid.is_org_member(organization_id) and created_by = auth.uid());
create policy "members update incidents" on reliefgrid.incidents for update to authenticated using (reliefgrid.is_org_member(organization_id)) with check (reliefgrid.is_org_member(organization_id));
create policy "members read requests" on reliefgrid.resource_requests for select to authenticated using (reliefgrid.is_org_member(organization_id));
create policy "members create requests" on reliefgrid.resource_requests for insert to authenticated with check (reliefgrid.is_org_member(organization_id) and created_by = auth.uid());
create policy "members read inventory" on reliefgrid.resource_inventory for select to authenticated using (reliefgrid.is_org_member(organization_id));
create policy "members add inventory" on reliefgrid.resource_inventory for insert to authenticated with check (reliefgrid.is_org_member(organization_id) and updated_by = auth.uid());
create policy "members read allocations" on reliefgrid.allocations for select to authenticated using (reliefgrid.is_org_member(organization_id));

revoke all on all tables in schema reliefgrid from anon, public;
grant select on reliefgrid.organizations, reliefgrid.organization_members, reliefgrid.incidents, reliefgrid.resource_requests, reliefgrid.resource_inventory, reliefgrid.allocations to authenticated;
grant insert, update on reliefgrid.incidents to authenticated;
grant insert on reliefgrid.resource_requests, reliefgrid.resource_inventory to authenticated;
