-- Evaluate auth.uid() once per statement instead of once per candidate row.
drop policy if exists "members create incidents" on reliefgrid.incidents;
create policy "members create incidents" on reliefgrid.incidents for insert to authenticated
  with check (reliefgrid.is_org_member(organization_id) and created_by = (select auth.uid()));

drop policy if exists "members create requests" on reliefgrid.resource_requests;
create policy "members create requests" on reliefgrid.resource_requests for insert to authenticated
  with check (reliefgrid.is_org_member(organization_id) and created_by = (select auth.uid()));

drop policy if exists "members add inventory" on reliefgrid.resource_inventory;
create policy "members add inventory" on reliefgrid.resource_inventory for insert to authenticated
  with check (reliefgrid.is_org_member(organization_id) and updated_by = (select auth.uid()));
