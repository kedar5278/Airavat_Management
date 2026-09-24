# Airavat Security Management

Responsive security-workforce app built with Next.js, React, TypeScript, Tailwind CSS, and Supabase.

## Supabase setup

1. Create a Supabase project and a single admin user in **Authentication → Users**. Turn off public sign-ups for this admin-only app.
2. Copy `.env.local.example` to `.env.local`. Fill in the project URL, anon/publishable key, chosen admin login ID, and the admin user's Supabase email. The admin password is checked by Supabase Auth and is never stored in this project.
3. Run [`supabase/schema.sql`](supabase/schema.sql) once in the Supabase SQL Editor. After creating the Auth user, run the final `insert into public.admin_users...` statement again with that user's email. This authorizes exactly that user as the app admin.
4. Restart Next.js after changing `.env.local`, then deploy the same environment variables to your hosting provider.

The app uses a private `guard-photos` storage bucket. The SQL creates it and sets RLS policies. Admin data access also requires an active device lease. Two different systems can be signed in at once; each lease renews every 40 seconds and expires after 90 seconds if a device closes without signing out.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000/admin/dashboard.

## Features

- Supabase Auth verified admin ID/password and two active device limit
- Supabase Postgres persistence for guards, attendance, and invoices
- Private Supabase Storage for guard photos, with mobile camera capture
- Responsive roster, guard profile, attendance, and invoice pages
- Guard profile PDF download
