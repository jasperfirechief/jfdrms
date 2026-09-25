# Jasper Fire Department RMS

Cloud RMS prototype for Jasper Fire Department using Supabase and a GitHub-hosted frontend.

## Current system
- Supabase Auth email/password login
- Admin / Officer / Firefighter roles
- Daily staffing for three stations
- Department-wide apparatus list shown at every station
- Temporary Driver / Officer / Firefighter crew assignments
- Officer staffing control while off duty
- On-duty access rules for operational modules
- Apparatus checks for Admin, on-duty Officer, and assigned Driver
- Inspections for Admin and on-duty Officers
- Internal incident reports
- Admin user creation through a protected Supabase Edge Function
- Row Level Security policies on operational tables

## First administrator
Supabase Auth currently has no users. Before the RMS can be used, create the first administrator in Supabase Authentication > Users with email/password, then insert the matching profile in public.users with:
- user_id = the Auth user's UUID
- first_name
- last_name
- email
- app_role = admin
- active = true

After that administrator signs in, additional department users can be created from the RMS Personnel screen.

Do not put database passwords, service-role keys, NERIS client secrets, or other secrets in this repository or in browser JavaScript.

## NERIS
NERIS is supported as the planned submission target. The current NERIS API uses OAuth 2.0/integration credentials and a department must be enrolled for an integration before an RMS can submit on its behalf. The NERIS API credentials belong in a server-side secret store, never in the browser. The incident data model in this RMS is deliberately kept separate from the NERIS transport layer so the department record remains authoritative.

## Deployment
The frontend is a single static index.html and can be served by any static host connected to this GitHub repository.
