-- Index product foreign keys for joins and parent-row updates/deletes.
create index if not exists "mse_fk_allocations_1" on "reliefgrid"."allocations" ("allocated_by");
create index if not exists "mse_fk_allocations_2" on "reliefgrid"."allocations" ("inventory_id", "organization_id");
create index if not exists "mse_fk_allocations_3" on "reliefgrid"."allocations" ("request_id", "organization_id");
create index if not exists "mse_fk_incidents_1" on "reliefgrid"."incidents" ("created_by");
create index if not exists "mse_fk_organizations_1" on "reliefgrid"."organizations" ("created_by");
create index if not exists "mse_fk_resource_inventory_1" on "reliefgrid"."resource_inventory" ("updated_by");
create index if not exists "mse_fk_resource_requests_1" on "reliefgrid"."resource_requests" ("created_by");
create index if not exists "mse_fk_resource_requests_2" on "reliefgrid"."resource_requests" ("incident_id", "organization_id");

