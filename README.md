# ReliefGrid

ReliefGrid gives a response team a shared operational view of incident status, resource requests, locally available inventory and supply allocations. It is designed for coordination between organizations and teams, not to replace local emergency command, dispatch, clinical triage or verified safety procedures.

## Workflow

1. Create a private team workspace or join one using a code from a trusted teammate.
2. Record an incident using a district/zone-level area description, severity, coordination lead and short operational brief.
3. Post a quantified resource need linked to an active incident and assign a priority.
4. Register available supplies and capacity by category and staging area.
5. Allocate matching inventory to open needs. The database locks request and stock rows, prevents over-allocation, decrements available quantities, and records who allocated what.
6. Update incident state from active to contained or resolved as conditions change.

## Data and safety boundaries

ReliefGrid intentionally has no affected-person registry, case management, medical records, precise home addresses, responder tracking, mapping coordinates, or public incident feed. Enter operational context only. Use established local channels for emergency calls, sensitive tactical information, clinical decisions, evacuation orders and authoritative situation reporting. Inventory and needs are only as reliable as team-entered data.

## Local setup

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Set the Supabase project URL and publishable key in `.env.local`. Apply `supabase/migrations/20261112190000_reliefgrid_response_coordination.sql` to the approved MSE Product Suite project, expose the `reliefgrid` schema in the Supabase Data API, and add the deployed origin to Auth redirect URLs. Every table has RLS enabled; anonymous rights are revoked; all application records are organization-scoped.

## Project

- GitHub: https://github.com/msetrades/mse-disaster-response
- Planned deployment: https://mse-disaster-response.vercel.app
